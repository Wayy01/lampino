// The `Order` row both checkout paths write — storefront `submitOrder` and the
// Ligatto automation POST — so its shape (contact email, country, region,
// totals, item lines) is decided in one place. Each caller adds what differs:
// the stock flag, the origin, and the automation-only correlation fields.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import type { DeliveryRegion } from "@/lib/pricing";
import type { ResolvedLine } from "@/lib/orders/resolve";

// Neither path collects an email; store the shop's own so the row stays a
// valid contact point for the team.
const FALLBACK_EMAIL = "contact@lampino.md";

export type NewOrderFields = {
  contact: { name: string; phone: string };
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
export async function newOrderData(f: NewOrderFields) {
  const contactSettings = await prisma.contactSettings.findFirst({ where: { isActive: true } });
  return {
    customerName: f.contact.name,
    customerEmail: contactSettings?.email?.trim() || FALLBACK_EMAIL,
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
