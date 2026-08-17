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
  return fillMissingImages(list.slice(0, max));
}

/**
 * Categories with no admin-set image borrow one at random from one of their
 * own active products' main image, matching the old site's homepage tiles.
 */
async function fillMissingImages(categories: Category[]): Promise<Category[]> {
  const missingIds = categories.filter((c) => !c.imageUrl).map((c) => c.id);
  if (missingIds.length === 0) return categories;

  const products = await prisma.product.findMany({
    where: { categoryId: { in: missingIds }, isActive: true },
    select: {
      categoryId: true,
      images: { where: { isMain: true }, take: 1, select: { imageUrl: true } },
    },
  });

  const imagesByCategory = new Map<number, string[]>();
  for (const p of products) {
    if (p.categoryId === null || p.images.length === 0) continue;
    const list = imagesByCategory.get(p.categoryId) ?? [];
    list.push(p.images[0].imageUrl);
    imagesByCategory.set(p.categoryId, list);
  }

  return categories.map((c) => {
    if (c.imageUrl) return c;
    const images = imagesByCategory.get(c.id);
    if (!images || images.length === 0) return c;
    return { ...c, imageUrl: images[Math.floor(Math.random() * images.length)] };
  });
}
