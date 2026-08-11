import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma";
import { normalizeSpecs } from "../specs";
import type { Category, CategoryOption, Product } from "../types";

export type { Product, CategoryOption } from "../types";

// Categories are dynamic (admin-managed), so a category is just its slug string.
export type ProductCategory = string;

// ---------------------------------------------------------------------------
// Prisma → view-model serialization (Decimal → number, specs normalized,
// relations flattened) so client components only ever see plain JSON.
// ---------------------------------------------------------------------------

const productInclude = {
  category: true,
  images: { orderBy: [{ isMain: "desc" }, { id: "asc" }] },
  videos: { orderBy: { id: "asc" } },
  variants: { orderBy: { sortOrder: "asc" } },
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

function serializeProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name_ro: row.name_ro,
    name_ru: row.name_ru,
    description_ro: row.description_ro,
    description_ru: row.description_ru,
    price: Number(row.price),
    reducedPrice: row.reducedPrice === null ? null : Number(row.reducedPrice),
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
      reducedPrice: v.reducedPrice === null ? null : Number(v.reducedPrice),
      stock: v.stock,
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
    })),
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
  return rows.map(serializeProduct);
}

export async function getFeaturedProducts(limit = 9): Promise<Product[]> {
  const featured = await prisma.product.findMany({
    where: { isActive: true, featured: true },
    include: productInclude,
    orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  if (featured.length >= limit) return featured.map(serializeProduct);

  // Top up with the newest active products when not enough are flagged featured.
  const seen = new Set(featured.map((p) => p.id));
  const fill = await prisma.product.findMany({
    where: { isActive: true, id: { notIn: [...seen] } },
    include: productInclude,
    orderBy: { createdAt: "desc" },
    take: limit - featured.length,
  });
  return [...featured, ...fill].map(serializeProduct);
}

export async function getProductById(id: number): Promise<Product | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: productInclude,
  });
  return row ? serializeProduct(row) : null;
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
  return rows.map(serializeProduct);
}

/** Category options in display order for the catalog filter + magazin URL mapping. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const rows = await prisma.category.findMany({ orderBy: { position: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name_ro: c.name_ro,
    name_ru: c.name_ru,
  }));
}
