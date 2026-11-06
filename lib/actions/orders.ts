"use server";

// Public storefront checkout. Cart and buy-now both submit here: it creates a
// real `Order` + `OrderItem` rows, resolving prices from the DB rather than
// trusting the client — mirrors `submitRentalApplication`.
import { bestActivePromotion, effectiveReducedPrice } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { getDeliverySettings } from "@/lib/data/settings";
import { deliveryFee, type DeliveryRegion } from "@/lib/pricing";
import { sendNewOrderAlert } from "@/lib/telegram";
import { withinRateLimit } from "@/lib/rate-limit";
import { mergeLines } from "@/lib/stock";

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
  | "too_many_requests"
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

// Public input caps — enough for any real order, small enough that a script
// can't fill the table (or blow past Telegram's 4096-char message limit).
const MAX_NAME = 100;
const MAX_PHONE = 30;
const MAX_ADDRESS = 300;
const MAX_NOTES = 1000;
const MAX_LINES = 50;
const MAX_QUANTITY = 1000;
// Digits with the usual separators, 6–15 digits in total.
const PHONE_RE = /^\+?[\d\s().-]{6,30}$/;

export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  try {
    const name = typeof input.customerName === "string" ? input.customerName.trim() : "";
    const phone = typeof input.customerPhone === "string" ? input.customerPhone.trim() : "";
    const digits = phone.replace(/\D/g, "").length;
    if (
      !name ||
      name.length > MAX_NAME ||
      phone.length > MAX_PHONE ||
      !PHONE_RE.test(phone) ||
      digits < 6 ||
      digits > 15
    ) {
      return { ok: false, error: "invalid_contact" };
    }

    if (
      (input.method !== "pickup" && input.method !== "delivery") ||
      (input.method === "delivery" && input.region !== "chisinau" && input.region !== "outside")
    ) {
      return { ok: false, error: "invalid_address" };
    }
    const address = typeof input.address === "string" ? input.address.trim() : "";
    if (input.method === "delivery" && (!address || address.length > MAX_ADDRESS)) {
      return { ok: false, error: "invalid_address" };
    }
    const notes =
      typeof input.notes === "string" ? input.notes.trim().slice(0, MAX_NOTES) : "";

    const requested = mergeLines(
      (Array.isArray(input.items) ? input.items : [])
        .slice(0, MAX_LINES)
        .filter((i) => Number.isInteger(i?.productId) && i.productId > 0)
        .map((i) => ({
          productId: i.productId,
          variantId:
            Number.isInteger(i.variantId) && (i.variantId as number) > 0
              ? (i.variantId as number)
              : null,
          quantity: Math.min(
            MAX_QUANTITY,
            Math.max(1, Math.floor(Number(i.quantity) || 0)),
          ),
        })),
    );
    if (requested.length === 0) return { ok: false, error: "empty_cart" };

    // Checked after validation so typos don't burn the customer's attempts.
    if (!(await withinRateLimit("order", 5, 10 * 60_000))) {
      return { ok: false, error: "too_many_requests" };
    }

    const productIds = [...new Set(requested.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        variants: true,
        promotions: { select: { startDate: true, endDate: true, discountPercent: true } },
      },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    // One clock for the whole order, so a promotion that ends mid-request
    // can't price two lines of the same cart differently.
    const now = new Date();
    // What the storefront showed: list price, the manual reduced price, or the
    // best running promotion, whichever is lowest (lib/promotions.ts).
    const charge = (
      price: Prisma.Decimal,
      reduced: Prisma.Decimal | null,
      pct: number | null,
    ): Prisma.Decimal => {
      const r = effectiveReducedPrice(Number(price), reduced === null ? null : Number(reduced), pct);
      return r === null ? price : new Prisma.Decimal(r);
    };

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
      const pct = bestActivePromotion(product.promotions, now)?.discountPercent ?? null;
      let priceEach = charge(product.price, product.reducedPrice, pct);
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
        priceEach = charge(variant.price, variant.reducedPrice, pct);
        available = variant.stock;
      } else if (product.hasVariants && product.variants.length > 0) {
        // A variant product can only be bought as one of its variants — a line
        // without one means the variant it was added with has been deleted.
        gone.push({ productId: product.id, variantId: null, available: 0 });
        continue;
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

    // Stock is checked above but not taken: it is reserved when an admin
    // confirms the order (lib/admin/actions/orders.ts). Taking it here let
    // anonymous, unverified orders empty the shop until someone cancelled them.
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
        specialInstructions: notes || null,
        status: "pending",
        stockReserved: false,
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
  } catch (error) {
    console.error("submitOrder", error);
    return { ok: false, error: "server_error" };
  }
}
