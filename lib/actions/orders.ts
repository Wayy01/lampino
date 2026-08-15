"use server";

// Public storefront checkout. Cart and buy-now both submit here: it creates a
// real `Order` + `OrderItem` rows, resolving prices from the DB rather than
// trusting the client — mirrors `submitRentalApplication`.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { getDeliverySettings } from "@/lib/data/settings";
import { deliveryFee, type DeliveryRegion } from "@/lib/pricing";

export type OrderItemInput = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

export type SubmitOrderInput = {
  items: OrderItemInput[];
  customerName: string;
  customerPhone: string;
  method: "pickup" | "delivery";
  region: DeliveryRegion;
  address: string | null;
  notes: string | null;
};

export type SubmitOrderResult =
  | { ok: true; orderId: number }
  | { ok: false; error: string };

// Storefront checkout doesn't collect an email; store the shop's own so the
// row stays a valid contact point for the team.
const FALLBACK_EMAIL = "contact@lampino.md";

export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  try {
    const name = input.customerName?.trim();
    const phone = input.customerPhone?.trim();
    if (!name || !phone) return { ok: false, error: "invalid_contact" };

    const address = input.address?.trim() || "";
    if (input.method === "delivery" && !address) {
      return { ok: false, error: "invalid_address" };
    }

    const requested = (Array.isArray(input.items) ? input.items : [])
      .filter((i) => Number.isInteger(i.productId) && i.productId > 0)
      .map((i) => ({
        productId: i.productId,
        variantId:
          Number.isInteger(i.variantId) && (i.variantId as number) > 0
            ? (i.variantId as number)
            : null,
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 0)),
      }));
    if (requested.length === 0) return { ok: false, error: "empty_cart" };

    const productIds = [...new Set(requested.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    // Price is resolved server-side from the catalog — never the client. A
    // line whose product was deleted or deactivated since it was added to the
    // cart is silently dropped rather than failing the whole order.
    const resolved: {
      productId: number;
      variantId: number | null;
      quantity: number;
      priceEach: Prisma.Decimal;
    }[] = [];
    for (const line of requested) {
      const product = productById.get(line.productId);
      if (!product) continue;
      let priceEach = product.reducedPrice ?? product.price;
      let variantId: number | null = null;
      if (line.variantId) {
        const variant = product.variants.find((v) => v.id === line.variantId);
        if (variant) {
          variantId = variant.id;
          priceEach = variant.reducedPrice ?? variant.price;
        }
      }
      resolved.push({
        productId: product.id,
        variantId,
        quantity: line.quantity,
        priceEach,
      });
    }
    if (resolved.length === 0) return { ok: false, error: "empty_cart" };

    const subtotal = resolved.reduce(
      (sum, r) => sum + Number(r.priceEach) * r.quantity,
      0,
    );

    const delivery =
      input.method === "delivery" ? await getDeliverySettings() : null;
    const fee =
      input.method === "delivery"
        ? (deliveryFee(delivery, subtotal, input.region) ?? 0)
        : 0;

    const contact = await prisma.contactSettings.findFirst({
      where: { isActive: true },
    });

    const order = await prisma.order.create({
      data: {
        customerName: name,
        customerEmail: contact?.email?.trim() || FALLBACK_EMAIL,
        customerPhone: phone,
        address: input.method === "delivery" ? address : null,
        city:
          input.method === "delivery"
            ? input.region === "chisinau"
              ? "Chișinău"
              : null
            : null,
        country: input.method === "delivery" ? "Moldova" : null,
        specialInstructions: input.notes?.trim() || null,
        status: "pending",
        totalPrice: new Prisma.Decimal(subtotal + fee),
        items: {
          create: resolved.map((r) => ({
            productId: r.productId,
            productVariantId: r.variantId,
            quantity: r.quantity,
            priceEach: r.priceEach,
          })),
        },
      },
      select: { id: true },
    });

    return { ok: true, orderId: order.id };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
