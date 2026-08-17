"use server";

// Public storefront checkout. Cart and buy-now both submit here: it creates a
// real `Order` + `OrderItem` rows, resolving prices from the DB rather than
// trusting the client — mirrors `submitRentalApplication`.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { getDeliverySettings } from "@/lib/data/settings";
import { deliveryFee, type DeliveryRegion } from "@/lib/pricing";
import { sendNewOrderAlert } from "@/lib/telegram";

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

/** Every way checkout can be refused. The UI maps these to `t.order.errors`. */
export type SubmitOrderError =
  | "invalid_contact"
  | "invalid_address"
  | "empty_cart"
  | "unavailable"
  | "out_of_stock"
  | "server_error";

/** A line the customer asked for that the catalog can no longer supply. */
export type RejectedLine = {
  productId: number;
  variantId: number | null;
  /** Units actually available; 0 when the product itself is gone. */
  available: number;
};

export type SubmitOrderResult =
  | { ok: true; orderId: number }
  | { ok: false; error: SubmitOrderError; rejected?: RejectedLine[] };

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

    // Price and stock are resolved server-side from the catalog — never the
    // client. A line the catalog can no longer supply is reported back rather
    // than dropped, so the customer is told what changed instead of receiving
    // a confirmation for a smaller order than they placed.
    const resolved: {
      productId: number;
      variantId: number | null;
      quantity: number;
      priceEach: Prisma.Decimal;
    }[] = [];
    const gone: RejectedLine[] = [];
    const short: RejectedLine[] = [];

    for (const line of requested) {
      const product = productById.get(line.productId);
      if (!product) {
        gone.push({ productId: line.productId, variantId: line.variantId, available: 0 });
        continue;
      }
      let priceEach = product.reducedPrice ?? product.price;
      let variantId: number | null = null;
      let available = product.stock;
      if (line.variantId) {
        const variant = product.variants.find((v) => v.id === line.variantId);
        if (!variant) {
          // The size/colour they chose is gone even though the product stayed.
          gone.push({ productId: product.id, variantId: line.variantId, available: 0 });
          continue;
        }
        variantId = variant.id;
        priceEach = variant.reducedPrice ?? variant.price;
        available = variant.stock;
      }

      // Stock was never checked here before: an order for 50 of a 2-in-stock
      // lamp was accepted silently and only discovered when someone read it.
      if (available < line.quantity) {
        short.push({ productId: product.id, variantId, available });
        continue;
      }

      resolved.push({
        productId: product.id,
        variantId,
        quantity: line.quantity,
        priceEach,
      });
    }

    // Refuse the whole order when any line can't be filled — a partial order
    // the customer never agreed to is worse than being asked to adjust the cart.
    if (short.length > 0) {
      return { ok: false, error: "out_of_stock", rejected: short };
    }
    if (gone.length > 0) {
      return { ok: false, error: "unavailable", rejected: gone };
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
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        address: true,
        city: true,
        totalPrice: true,
        items: {
          select: {
            quantity: true,
            priceEach: true,
            product: { select: { name_ro: true } },
            productVariant: { select: { name_ro: true } },
          },
        },
      },
    });

    sendNewOrderAlert(order).catch((err) =>
      console.error("Failed to send Telegram order alert", order.id, err),
    );

    return { ok: true, orderId: order.id };
  } catch {
    return { ok: false, error: "server_error" };
  }
}
