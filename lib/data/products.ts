import { products as allProducts, categories as allCategories } from "../mock-data";
import type { Product } from "../types";
import { parseId } from "../slug";

// The raw catalog (schema-shaped view models) is re-exported for the client
// components that read it synchronously (catalog grid, cart hydration).
export { products } from "../mock-data";
export type { Product } from "../types";

// Category slugs, in display order — the union that the catalog filters on.
export type ProductCategory =
  | "led"
  | "smart"
  | "christmas"
  | "vintage"
  | "strip"
  | "outdoor"
  | "ceiling"
  | "pendant"
  | "table"
  | "floor"
  | "spot"
  | "accessories";

export const categories: ProductCategory[] = allCategories
  .slice()
  .sort((a, b) => a.position - b.position)
  .map((c) => c.slug as ProductCategory);

// NOTE: each function mirrors the shape of its eventual Prisma query.
// To go live, replace the body with `prisma.product.findMany(...)` etc.
// Signatures and return shapes stay identical, so callers never change.

export async function getProducts(options?: {
  categorySlug?: string;
}): Promise<Product[]> {
  let list = allProducts.filter((p) => p.isActive);
  if (options?.categorySlug) {
    list = list.filter((p) => p.category?.slug === options.categorySlug);
  }
  return list;
}

export async function getFeaturedProducts(limit = 9): Promise<Product[]> {
  return allProducts
    .filter((p) => p.isActive && p.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .slice(0, limit);
}

export async function getProductById(id: number): Promise<Product | null> {
  return allProducts.find((p) => p.id === id && p.isActive) ?? null;
}

/** Look up a product from a URL slug (`<id>-<name>`) — only the id matters. */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const id = parseId(slug);
  return id === null ? null : getProductById(id);
}

export async function getRelatedProducts(
  product: Product,
  limit = 4,
): Promise<Product[]> {
  return allProducts
    .filter(
      (p) =>
        p.isActive && p.id !== product.id && p.categoryId === product.categoryId,
    )
    .slice(0, limit);
}
