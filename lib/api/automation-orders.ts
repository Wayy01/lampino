// Shared bits for the Ligatto order-automation route handlers
// (app/api/automation/orders). Request parsing, the Prisma select used to build
// an order summary + Telegram alert, and the transaction-rollback sentinel.
import { Prisma } from "@/lib/generated/prisma";
import type { Locale } from "@/lib/i18n/routing";
import type { RejectedLine } from "@/lib/orders/resolve";

// Agent-placed orders have no email; store the shop's own so the row stays a
// valid contact point (same as storefront checkout).
export const FALLBACK_EMAIL = "contact@lampino.md";

export function parseLang(v: unknown): Locale {
  return v === "ru" ? "ru" : "ro";
}

export function parseMethod(v: unknown): "pickup" | "delivery" {
  return v === "delivery" ? "delivery" : "pickup";
}

/** The optional `Idempotency-Key` header: trimmed and capped, or null. */
export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key");
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  return key ? key.slice(0, 200) : null;
}

/**
 * Opaque correlation id (e.g. a Ligatto conversation id) from the request body:
 * CR/LF-stripped (so it's safe to substitute into an outbound webhook header),
 * trimmed and capped, or null. `undefined` when the caller omitted the key — the
 * PATCH path uses that to tell "clear it" from "leave it".
 */
export function readListenerId(body: Record<string, unknown>): string | null | undefined {
  if (!("webhook_listener_id" in body)) return undefined;
  const raw = body.webhook_listener_id;
  if (typeof raw !== "string") return null;
  const v = raw.replace(/[\r\n]/g, "").trim().slice(0, 200);
  return v || null;
}

/** Thrown inside the order transaction to roll stock decrements back. */
export class StockShortage extends Error {
  constructor(readonly lines: RejectedLine[]) {
    super("stock shortage");
  }
}

/** Order fields needed to build a summary and the Telegram alert. */
export const ORDER_SELECT = {
  id: true,
  status: true,
  source: true,
  customerName: true,
  customerPhone: true,
  deliveryMethod: true,
  deliveryRegion: true,
  city: true,
  address: true,
  postalCode: true,
  specialInstructions: true,
  totalPrice: true,
  items: {
    select: {
      productId: true,
      productVariantId: true,
      quantity: true,
      priceEach: true,
      product: { select: { name_ro: true, name_ru: true } },
      productVariant: { select: { name_ro: true, name_ru: true } },
    },
  },
} satisfies Prisma.OrderSelect;
