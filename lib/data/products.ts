import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma";
import { normalizeSpecs } from "../specs";
import { parseId } from "../utils";
import { productPaths } from "../i18n/routing";
import { bestActivePromotion, effectiveReducedPrice } from "../promotions";
import type { ActivePromotion, CatalogIndexEntry, Category, CategoryOption, Product } from "../types";

export type { Product, CategoryOption } from "../types";

// Categories are dynamic (admin-managed), so a category is just its slug string.
export type ProductCategory = string;

// ---------------------------------------------------------------------------
// Prisma → view-model serialization (Decimal → number, specs normalized,
// relations flattened) so client components only ever see plain JSON.
// ---------------------------------------------------------------------------

export const promotionSelect = {
  id: true,
  name_ro: true,
  name_ru: true,
  startDate: true,
  endDate: true,
  discountPercent: true,
} satisfies Prisma.PromotionSelect;

const productInclude = {
  category: true,
  images: { orderBy: [{ isMain: "desc" }, { id: "asc" }] },
  videos: { orderBy: { id: "asc" } },
  variants: { orderBy: { sortOrder: "asc" } },
  // Every linked promotion, past and future; the running one is picked per
  // request in serialize, so a scheduled sale switches on by itself.
  promotions: { select: promotionSelect },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export function serializeCategory(
  category: { id: number; name_ro: string; name_ru: string; slug: string; position: number; imageUrl: string | null },
): Category {
  return {
    id: category.id,
    name_ro: category.name_ro,
    name_ru: category.name_ru,
    slug: category.slug,
    position: category.position,
    imageUrl: category.imageUrl,
  };
}

/** The running promotion as a view model, or null. Shared with rentals. */
export function activePromotion(
  promotions: Prisma.PromotionGetPayload<{ select: typeof promotionSelect }>[],
  now: Date,
): ActivePromotion | null {
  const p = bestActivePromotion(promotions, now);
  return p
    ? {
        id: p.id,
        name_ro: p.name_ro,
        name_ru: p.name_ru,
        discountPercent: p.discountPercent,
        endDate: p.endDate.toISOString(),
      }
    : null;
}

const decimalOrNull = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

function serializeProduct(row: ProductRow, now = new Date()): Product {
  const promotion = activePromotion(row.promotions, now);
  const pct = promotion?.discountPercent ?? null;
  return {
    id: row.id,
    name_ro: row.name_ro,
    name_ru: row.name_ru,
    description_ro: row.description_ro,
    description_ru: row.description_ru,
    price: Number(row.price),
    reducedPrice: effectiveReducedPrice(Number(row.price), decimalOrNull(row.reducedPrice), pct),
    stock: row.stock,
    hasVariants: row.hasVariants,
    specifications: normalizeSpecs(row.specifications),
    categoryId: row.categoryId,
    category: row.category ? serializeCategory(row.category) : null,
    featured: row.featured,
    featuredOrder: row.featuredOrder,
    isActive: row.isActive,
    images: row.images.map((i) => ({ id: i.id, imageUrl: i.imageUrl, isMain: i.isMain })),
    videos: row.videos.map((v) => ({ id: v.id, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl })),
    variants: row.variants.map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size,
      price: Number(v.price),
      reducedPrice: effectiveReducedPrice(Number(v.price), decimalOrNull(v.reducedPrice), pct),
      stock: v.stock,
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
      imageUrls: v.imageUrls,
    })),
    promotion,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getProducts(options?: {
  categorySlug?: string;
}): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(options?.categorySlug
        ? { category: { slug: options.categorySlug } }
        : {}),
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { featuredOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => serializeProduct(r));
}

export async function getFeaturedProducts(limit = 9): Promise<Product[]> {
  const settings = await prisma.homepageSettings.findFirst({ where: { isActive: true } });
  const categoryId = settings?.featuredProductsCategoryId ?? undefined;

  const featured = await prisma.product.findMany({
    where: { isActive: true, featured: true, categoryId },
    include: productInclude,
    orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  if (featured.length >= limit) return featured.map((r) => serializeProduct(r));

  // Top up with the newest active products when not enough are flagged featured.
  const seen = new Set(featured.map((p) => p.id));
  const fill = await prisma.product.findMany({
    where: { isActive: true, id: { notIn: [...seen] }, categoryId },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit - featured.length,
  });
  return [...featured, ...fill].map((r) => serializeProduct(r));
}

export async function getProductById(id: number): Promise<Product | null> {
  if (parseId(id) === null) return null;
  const row = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: productInclude,
  });
  return row ? serializeProduct(row) : null;
}

/**
 * Where a deactivated product's URL should send visitors now: its category
 * while that still lists active products, otherwise the bare catalog (`null`
 * category). Returns `null` when the id was never a product — that stays a 404.
 */
export async function getRetiredProductTarget(
  id: number,
): Promise<{ category: CategoryOption | null } | null> {
  if (parseId(id) === null) return null;
  const row = await prisma.product.findUnique({
    where: { id },
    select: { isActive: true, categoryId: true },
  });
  if (!row || row.isActive) return null;
  const options = await getCategoryOptions();
  return { category: options.find((c) => c.id === row.categoryId) ?? null };
}

export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  if (product.categoryId === null) return [];
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      id: { not: product.id },
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => serializeProduct(r));
}

/** Every indexable product as a sitemap row — no relations, no serialization. */
export async function getProductIndex(): Promise<CatalogIndexEntry[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name_ro: true,
      name_ru: true,
      categoryId: true,
      updatedAt: true,
      images: { select: { imageUrl: true }, orderBy: [{ isMain: "desc" }, { id: "asc" }] },
    },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    paths: productPaths(r),
    images: r.images.map((i) => i.imageUrl),
    categoryId: r.categoryId,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Id of the category that used to answer to `slug` before a rename, if any. */
export async function findCategoryIdByFormerSlug(slug: string): Promise<number | null> {
  const row = await prisma.category.findFirst({
    where: { formerSlugs: { has: slug } },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Category options in display order for the catalog filter + magazin URL
 * mapping. Categories are shared with rental packages, so the ones holding no
 * active product (venue categories, retired collections) are dropped — a filter
 * that can only ever return an empty grid is noise.
 */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const [rows, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { isActive: true },
      _count: { _all: true },
    }),
  ]);
  const stocked = new Set(
    counts
      .filter((g) => g.categoryId !== null && g._count._all > 0)
      .map((g) => g.categoryId as number),
  );
  return rows
    .filter((c) => stocked.has(c.id))
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name_ro: c.name_ro,
      name_ru: c.name_ru,
    }));
}
