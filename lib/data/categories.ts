import { prisma } from "../prisma";
import type { Category } from "../types";
import { serializeCategory } from "./products";

/** Map of categoryId → count of active products, for the "N products" badges. */
async function activeProductCounts(): Promise<Map<number, number>> {
  const groups = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const map = new Map<number, number>();
  for (const g of groups) {
    if (g.categoryId !== null) map.set(g.categoryId, g._count._all);
  }
  return map;
}

export async function getCategories(): Promise<Category[]> {
  const [rows, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    activeProductCounts(),
  ]);
  return rows.map((c) => ({
    ...serializeCategory(c),
    productCount: counts.get(c.id) ?? 0,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const row = await prisma.category.findUnique({ where: { slug } });
  if (!row) return null;
  const counts = await activeProductCounts();
  return { ...serializeCategory(row), productCount: counts.get(row.id) ?? 0 };
}

/**
 * Categories to spotlight on the homepage. Driven by `HomepageSettings`
 * (`featuredCategoryIds`, order-preserving, capped at `maxCategories`); falls
 * back to the first categories in display order when nothing is configured.
 * Only categories that actually hold active products are surfaced.
 */
export async function getFeaturedCategories(): Promise<Category[]> {
  const [settings, categories] = await Promise.all([
    prisma.homepageSettings.findFirst({ where: { isActive: true } }),
    getCategories(),
  ]);

  const withProducts = categories.filter((c) => (c.productCount ?? 0) > 0);
  const pool = withProducts.length > 0 ? withProducts : categories;
  const max = Math.max(1, settings?.maxCategories ?? 3);

  const rawIds = settings?.featuredCategoryIds;
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((n): n is number => typeof n === "number")
    : [];

  const byId = new Map(pool.map((c) => [c.id, c]));
  const chosen = ids
    .map((id) => byId.get(id))
    .filter((c): c is Category => Boolean(c));

  const list = chosen.length > 0 ? chosen : pool;
  return list.slice(0, max);
}
