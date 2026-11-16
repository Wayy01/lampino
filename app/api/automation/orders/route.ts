// Ligatto order-automation API — placement. The AI agent assembles the order in
// the conversation and calls this once it's complete; we create a normal `pending`
// Order (same as storefront checkout), resolving price/stock from the DB — never
// the payload. Like checkout, stock is only checked here; the units are taken
// when an admin confirms the order (lib/orders/status.ts). Editing afterwards is PATCH /api/automation/orders/{id}.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { sendNewOrderAlert } from "@/lib/telegram";
import { requireAutomationToken } from "@/lib/api/automation-auth";
import type { DeliveryRegion } from "@/lib/pricing";
import type { Locale } from "@/lib/i18n/routing";
import { regionFromCity } from "@/lib/orders/region";
import { newOrderData } from "@/lib/orders/create";
import { getShopEmail } from "@/lib/data/settings";
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
  ORDER_SELECT,
  parseLang,
  parseMethod,
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

  const contact = validateContact(customer?.name, customer?.phone);
  if (!contact) return NextResponse.json({ ok: false, error: "invalid_contact" }, { status: 400 });

  let address: string | null = null;
  let city: string | null = null;
  let postalCode = "";
  // Pricing bucket is derived from the city, never trusted from the payload; it
  // only matters for delivery (pickup fees are 0).
  let region: DeliveryRegion = "outside";
  if (method === "delivery") {
    const addr = validateDeliveryAddress(delivery?.address, delivery?.city);
    if (!addr) return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400 });
    address = addr.address;
    city = addr.city;
    postalCode = clampPostalCode(delivery?.postalCode);
    region = regionFromCity(city);
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
    const replay = await replayIdempotent(idempotencyKey, agent.name, lang);
    if (replay) return replay;
  }

  const { resolved, gone, short, totals } = await resolveOrderLines(requested, lang);
  if (short.length > 0) return NextResponse.json({ ok: false, error: "out_of_stock", rejected: short }, { status: 409 });
  if (gone.length > 0) return NextResponse.json({ ok: false, error: "unavailable", rejected: gone }, { status: 409 });
  if (resolved.length === 0) return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });

  const [fee, email] = await Promise.all([
    computeFee(method, region, totals.itemsNet),
    getShopEmail(),
  ]);
  const data = newOrderData({
    contact,
    email,
    method,
    region,
    address,
    city,
    postalCode,
    notes,
    resolved,
    itemsNet: totals.itemsNet,
    fee,
  });

  try {
    const order = await prisma.order.create({
      data: {
        ...data,
        stockReserved: false,
        source: agent.name,
        idempotencyKey,
        webhookListenerId,
      },
      select: ORDER_SELECT,
    });

    sendNewOrderAlert(order).catch((err) =>
      console.error("Failed to send Telegram order alert", order.id, err),
    );

    return NextResponse.json({ ok: true, order: buildOrderSummary(order, resolved, totals) }, { status: 200 });
  } catch (error) {
    // A concurrent retry with the same key won the unique constraint — return its order.
    if (
      idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await replayIdempotent(idempotencyKey, agent.name, lang);
      if (replay) return replay;
    }
    console.error("automation order create failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

/**
 * The response for a key that already placed an order, or null when it hasn't.
 * Keys are unique across all agents, so a key another agent already used is a
 * conflict — never a replay of that agent's order (and its customer's details).
 */
async function replayIdempotent(
  idempotencyKey: string,
  agentName: string,
  lang: Locale,
): Promise<NextResponse | null> {
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: ORDER_SELECT,
  });
  if (!existing) return null;
  if (existing.source !== agentName) {
    return NextResponse.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, order: storedOrderSummary(existing, lang) }, { status: 200 });
}
