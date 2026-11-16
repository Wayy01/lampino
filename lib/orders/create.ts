// The `Order` row both checkout paths write — storefront `submitOrder` and the
// Ligatto automation POST — so its shape (contact email, country, region,
// totals, item lines) is decided in one place. Each caller adds what differs:
// the stock flag, the origin, and the automation-only correlation fields.
import { Prisma } from "@/lib/generated/prisma";
import type { DeliveryRegion } from "@/lib/pricing";
import type { ResolvedLine } from "@/lib/orders/resolve";

export type NewOrderFields = {
  contact: { name: string; phone: string };
  /** Neither path collects one — the shop's own, from `getShopEmail`. */
  email: string;
  method: "pickup" | "delivery";
  region: DeliveryRegion;
  address: string | null;
  city: string | null;
  postalCode: string;
  notes: string;
  resolved: ResolvedLine[];
  itemsNet: number;
  fee: number;
};

/** The shared `order.create` data for a new `pending` order. */
export function newOrderData(f: NewOrderFields) {
  return {
    customerName: f.contact.name,
    customerEmail: f.email,
    customerPhone: f.contact.phone,
    address: f.address,
    city: f.city,
    postalCode: f.postalCode || null,
    country: f.method === "delivery" ? "Moldova" : null,
    specialInstructions: f.notes || null,
    status: "pending",
    deliveryMethod: f.method,
    deliveryRegion: f.method === "delivery" ? f.region : null,
    totalPrice: new Prisma.Decimal(f.itemsNet + f.fee),
    items: {
      create: f.resolved.map((r) => ({
        productId: r.productId,
        productVariantId: r.variantId,
        quantity: r.quantity,
        priceEach: r.priceEach,
      })),
    },
  } satisfies Prisma.OrderCreateInput;
}
