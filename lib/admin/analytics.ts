// Popularity analytics for the admin dashboard. Aggregates the raw
// `AnalyticsEvent` rows (written by /api/track) into per-product and
// per-rental engagement, joined with the current catalog so a renamed or
// deleted item never leaves a dangling row. Orphaned events — pointing at a
// product/rental that no longer exists — are simply dropped by the join.
//
// Product intent is the add-to-cart count. Rentals have no cart (they go
// through the inquiry flow), so their intent signal is the count of
// `RentalApplication` rows in the same window — reusing data the app already
// keeps rather than tracking a second event.
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";

export type ProductStat = {
  id: number;
  name_ro: string;
  name_ru: string;
  isActive: boolean;
  views: number;
  avgDwellMs: number | null;
  addToCart: number;
  orders: number;
};

export type RentalStat = {
  id: number;
  title_ro: string;
  title_ru: string;
  isActive: boolean;
  views: number;
  avgDwellMs: number | null;
  inquiries: number;
};

export type AnalyticsOverview = {
  productViews: number;
  rentalViews: number;
  addToCart: number;
  avgDwellMs: number | null;
};

/** Metric that orders both tables; `intent` = add-to-cart / inquiries. */
export type AnalyticsSort = "views" | "dwell" | "intent" | "views_asc";

export const ANALYTICS_PERIODS = [7, 30, 90] as const;

export type AnalyticsData = {
  overview: AnalyticsOverview;
  products: ProductStat[];
  rentals: RentalStat[];
};

/** `sinceDays` null = all time. */
export async function getAnalytics(
  sinceDays: number | null,
  sort: AnalyticsSort,
): Promise<AnalyticsData> {
  const createdAt = sinceDays
    ? { gte: new Date(Date.now() - sinceDays * 86_400_000) }
    : undefined;
  const inWindow: Prisma.AnalyticsEventWhereInput = createdAt ? { createdAt } : {};

  const [
    productViewAgg,
    rentalViewAgg,
    addToCartAgg,
    overallDwell,
    productViewByItem,
    rentalViewByItem,
    addToCartByItem,
    orderByItem,
    inquiryByItem,
    products,
    rentals,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...inWindow, type: "product_view" } }),
    prisma.analyticsEvent.count({ where: { ...inWindow, type: "rental_view" } }),
    prisma.analyticsEvent.count({ where: { ...inWindow, type: "add_to_cart" } }),
    prisma.analyticsEvent.aggregate({
      where: { ...inWindow, type: { in: ["product_view", "rental_view"] } },
      _avg: { dwellMs: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["productId"],
      where: { ...inWindow, type: "product_view", productId: { not: null } },
      _count: { _all: true },
      _avg: { dwellMs: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["rentalPackageId"],
      where: { ...inWindow, type: "rental_view", rentalPackageId: { not: null } },
      _count: { _all: true },
      _avg: { dwellMs: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["productId"],
      where: { ...inWindow, type: "add_to_cart", productId: { not: null } },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: createdAt ? { createdAt } : undefined,
      },
      _count: { _all: true },
    }),
    prisma.rentalApplication.groupBy({
      by: ["rentalPackageId"],
      where: createdAt ? { createdAt } : {},
      _count: { _all: true },
    }),
    prisma.product.findMany({
      select: { id: true, name_ro: true, name_ru: true, isActive: true },
    }),
    prisma.rentalPackage.findMany({
      select: { id: true, title_ro: true, title_ru: true, isActive: true },
    }),
  ]);

  const productViews = new Map(
    productViewByItem.map((r) => [
      r.productId!,
      { views: r._count._all, avg: r._avg.dwellMs },
    ]),
  );
  const carts = new Map(
    addToCartByItem.map((r) => [r.productId!, r._count._all]),
  );
  const orderCounts = new Map(
    orderByItem.map((r) => [r.productId!, r._count._all]),
  );
  const rentalViews = new Map(
    rentalViewByItem.map((r) => [
      r.rentalPackageId!,
      { views: r._count._all, avg: r._avg.dwellMs },
    ]),
  );
  const inquiries = new Map(
    inquiryByItem.map((r) => [r.rentalPackageId, r._count._all]),
  );

  const productStats: ProductStat[] = products.map((p) => {
    const v = productViews.get(p.id);
    return {
      id: p.id,
      name_ro: p.name_ro,
      name_ru: p.name_ru,
      isActive: p.isActive,
      views: v?.views ?? 0,
      avgDwellMs: v?.avg ?? null,
      addToCart: carts.get(p.id) ?? 0,
      orders: orderCounts.get(p.id) ?? 0,
    };
  });

  const rentalStats: RentalStat[] = rentals.map((r) => {
    const v = rentalViews.get(r.id);
    return {
      id: r.id,
      title_ro: r.title_ro,
      title_ru: r.title_ru,
      isActive: r.isActive,
      views: v?.views ?? 0,
      avgDwellMs: v?.avg ?? null,
      inquiries: inquiries.get(r.id) ?? 0,
    };
  });

  return {
    overview: {
      productViews: productViewAgg,
      rentalViews: rentalViewAgg,
      addToCart: addToCartAgg,
      avgDwellMs: overallDwell._avg.dwellMs,
    },
    products: sortProducts(productStats, sort),
    rentals: sortRentals(rentalStats, sort),
  };
}

function sortProducts(rows: ProductStat[], sort: AnalyticsSort): ProductStat[] {
  const by: Record<AnalyticsSort, (a: ProductStat, b: ProductStat) => number> = {
    views: (a, b) => b.views - a.views,
    views_asc: (a, b) => a.views - b.views,
    dwell: (a, b) => (b.avgDwellMs ?? 0) - (a.avgDwellMs ?? 0),
    intent: (a, b) => b.addToCart - a.addToCart,
  };
  return [...rows].sort(by[sort]);
}

function sortRentals(rows: RentalStat[], sort: AnalyticsSort): RentalStat[] {
  const by: Record<AnalyticsSort, (a: RentalStat, b: RentalStat) => number> = {
    views: (a, b) => b.views - a.views,
    views_asc: (a, b) => a.views - b.views,
    dwell: (a, b) => (b.avgDwellMs ?? 0) - (a.avgDwellMs ?? 0),
    intent: (a, b) => b.inquiries - a.inquiries,
  };
  return [...rows].sort(by[sort]);
}
