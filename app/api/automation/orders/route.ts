// Ligatto order-automation API — placement. The AI agent assembles the order in
// the conversation and calls this once it's complete; we create a normal `pending`
// Order (same as storefront checkout), resolving price/stock from the DB — never
// the payload. Editing afterwards is PATCH /api/automation/orders/{id}.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { sendNewOrderAlert } from "@/lib/telegram";
import { reserveStock } from "@/lib/stock";
import { requireAutomationToken } from "@/lib/api/automation-auth";
import {
  resolveOrderLines,
  computeFee,
  buildOrderSummary,
  storedOrderSummary,
} from "@/lib/orders/resolve";
import {
  validateContact,
  validateDeliveryAddress,
  clampPostalCode,
  clampNotes,
  sanitizeLines,
} from "@/lib/orders/validate";
import {
  FALLBACK_EMAIL,
  ORDER_SELECT,
  StockShortage,
  parseLang,
  parseMethod,
  parseRegion,
  readIdempotencyKey,
  readListenerId,
} from "@/lib/api/automation-orders";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAutomationToken(request);
  if ("response" in auth) return auth.response;
  const agent = auth.agent;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const lang = parseLang(body.lang);
  const customer = body.customer as Record<string, unknown> | undefined;
  const delivery = body.delivery as Record<string, unknown> | undefined;
  const method = parseMethod(delivery?.method);
  const region = parseRegion(delivery?.region);

  const contact = validateContact(customer?.name, customer?.phone);
  if (!contact) return NextResponse.json({ ok: false, error: "invalid_contact" }, { status: 400 });

  let address: string | null = null;
  let city: string | null = null;
  let postalCode = "";
  if (method === "delivery") {
    const addr = validateDeliveryAddress(delivery?.address, delivery?.city);
    if (!addr) return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400 });
    address = addr.address;
    city = addr.city;
    postalCode = clampPostalCode(delivery?.postalCode);
  }
  const notes = clampNotes(delivery?.notes);

  // Opaque correlation id (e.g. a Ligatto conversation id) echoed back on the
  // shipment webhook so the receiver can tie the event to its conversation.
  const webhookListenerId = readListenerId(body) ?? null;

  const requested = sanitizeLines(body.items);
  if (requested.length === 0) return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });

  const idempotencyKey = readIdempotencyKey(request);
  // Idempotent replay: a retried call with a key we've already placed returns
  // that order rather than creating a second.
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey },
      select: ORDER_SELECT,
    });
    if (existing) {
      return NextResponse.json({ ok: true, order: storedOrderSummary(existing, lang) }, { status: 200 });
    }
  }

  const { resolved, gone, short, totals } = await resolveOrderLines(requested, lang);
  if (short.length > 0) return NextResponse.json({ ok: false, error: "out_of_stock", rejected: short }, { status: 409 });
  if (gone.length > 0) return NextResponse.json({ ok: false, error: "unavailable", rejected: gone }, { status: 409 });
  if (resolved.length === 0) return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });

  const fee = await computeFee(method, region, totals.itemsNet);
  const contactSettings = await prisma.contactSettings.findFirst({ where: { isActive: true } });

  try {
    const order = await prisma.$transaction(async (tx) => {
      const shortage = await reserveStock(tx, resolved);
      if (shortage.length > 0) throw new StockShortage(shortage);
      return tx.order.create({
        data: {
          customerName: contact.name,
          customerEmail: contactSettings?.email?.trim() || FALLBACK_EMAIL,
          customerPhone: contact.phone,
          address,
          city,
          postalCode: postalCode || null,
          country: method === "delivery" ? "Moldova" : null,
          specialInstructions: notes || null,
          status: "pending",
          stockReserved: true,
          source: agent.name,
          idempotencyKey,
          deliveryMethod: method,
          deliveryRegion: method === "delivery" ? region : null,
          webhookListenerId,
          totalPrice: new Prisma.Decimal(totals.itemsNet + fee),
          items: {
            create: resolved.map((r) => ({
              productId: r.productId,
              productVariantId: r.variantId,
              quantity: r.quantity,
              priceEach: r.priceEach,
            })),
          },
        },
        select: ORDER_SELECT,
      });
    });

    sendNewOrderAlert(order).catch((err) =>
      console.error("Failed to send Telegram order alert", order.id, err),
    );

    return NextResponse.json({ ok: true, order: buildOrderSummary(order, resolved, totals) }, { status: 200 });
  } catch (error) {
    if (error instanceof StockShortage) {
      return NextResponse.json({ ok: false, error: "out_of_stock", rejected: error.lines }, { status: 409 });
    }
    // A concurrent retry with the same key won the unique constraint — return its order.
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey },
        select: ORDER_SELECT,
      });
      if (existing) {
        return NextResponse.json({ ok: true, order: storedOrderSummary(existing, lang) }, { status: 200 });
      }
    }
    console.error("automation order create failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
