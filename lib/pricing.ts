import type { Product } from "@/lib/data/products";
import type { DeliverySettings } from "@/lib/types";

export type ProductPricing = {
  price: number; // lei
};

export type DeliveryRegion = "chisinau" | "outside";

/**
 * What the customer pays for delivery, from the admin-managed
 * `DeliverySettings` row. Pickup and orders at or above the free-delivery
 * threshold cost nothing; `null` settings mean the shop hasn't configured
 * delivery pricing, so we quote nothing rather than guess.
 */
export function deliveryFee(
  delivery: DeliverySettings | null,
  subtotal: number,
  region: DeliveryRegion,
): number | null {
  if (!delivery) return null;
  if (subtotal >= delivery.freeDeliveryThreshold) return 0;
  return region === "chisinau"
    ? delivery.deliveryCostChisinau
    : delivery.deliveryCostOutside;
}

export function getProductPricing(product: Product): ProductPricing {
  return { price: product.price };
}

/** Lowest price across the whole catalog — used for hero copy. */
export function catalogStartingPrice(products: Product[]): number {
  return products.reduce((min, p) => Math.min(min, p.price), Infinity);
}
