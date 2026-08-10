import type { Product } from "@/lib/data/products";

export type ProductPricing = {
  price: number; // lei
};

export function getProductPricing(product: Product): ProductPricing {
  return { price: product.price };
}

/** Lowest price across the whole catalog — used for hero copy. */
export function catalogStartingPrice(products: Product[]): number {
  return products.reduce((min, p) => Math.min(min, p.price), Infinity);
}
