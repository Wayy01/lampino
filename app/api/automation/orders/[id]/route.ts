// Ligatto order-automation API — the residual edit window. While an agent-placed
// order is still `pending` (no human has acted on it), the AI agent may add/change
// items and fix buyer/delivery details. Once an admin moves it to `confirmed` it
// locks and the agent must hand off to a human. Replacing `items` re-prices the
// whole order at current catalog prices and re-checks stock; an edit without
// `items` keeps the stored lines and prices. A pending order holds no stock (it is
// taken on confirm, as for storefront checkout), so no edit moves any.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { releaseStock } from "@/lib/stock";
import { requireAutomationToken } from "@/lib/api/automation-auth";
import type { DeliveryRegion } from "@/lib/pricing";
import { regionFromCity } from "@/lib/orders/region";
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
  readListenerId,
} from "@/lib/api/automation-orders";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAutomationToken(request);
  if ("response" in auth) return auth.response;
  const agent = auth.agent;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const lang = parseLang(body.lang);

  const current = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      source: true,
      customerName: true,
      customerPhone: true,
      deliveryMethod: true,
      deliveryRegion: true,
      city: true,
      address: true,
      postalCode: true,
      country: true,
      specialInstructions: true,
    },
  });
  if (!current) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  // An agent only edits the orders it placed itself (`source` is the agent's
  // name, which survives a delete-and-recreate token rotation). Storefront
  // orders and other agents' orders are out of its scope — hide them as 404.
  if (current.source !== agent.name) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  // The lock is status-based: only an untouched `pending` order is editable.
  if (current.status !== "pending") {
    return NextResponse.json({ ok: false, error: "locked", status: current.status }, { status: 409 });
  }

  // Customer: a present `customer` block fully replaces it.
  let name = current.customerName;
  let phone = current.customerPhone;
  if (body.customer !== undefined) {
    const c = body.customer as Record<string, unknown> | null;
    const contact = validateContact(c?.name, c?.phone);
    if (!contact) return NextResponse.json({ ok: false, error: "invalid_contact" }, { status: 400 });
    name = contact.name;
    phone = contact.phone;
  }

  // Delivery: a present `delivery` block fully replaces method + all fields.
  let method: "pickup" | "delivery" = current.deliveryMethod === "delivery" ? "delivery" : "pickup";
  let address = current.address;
  let city = current.city;
  let postalCode = current.postalCode;
  let country = current.country;
  let notes = current.specialInstructions;
  if (body.delivery !== undefined) {
    const d = body.delivery as Record<string, unknown> | null;
    method = parseMethod(d?.method);
    notes = clampNotes(d?.notes) || null;
    if (method === "delivery") {
      const addr = validateDeliveryAddress(d?.address, d?.city);
      if (!addr) return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400 });
      address = addr.address;
      city = addr.city;
      postalCode = clampPostalCode(d?.postalCode) || null;
      country = "Moldova";
    } else {
      address = null;
      city = null;
      postalCode = null;
      country = null;
    }
  }
  // Pricing bucket is derived from the (new or kept) city, never the payload.
  const region: DeliveryRegion = method === "delivery" ? regionFromCity(city) : "outside";

  // Items: a present `items` list replaces the full set, re-priced and
  // stock-checked like a new order.
  const repriced = body.items !== undefined
    ? await resolveOrderLines(sanitizeLines(body.items), lang)
    : null;
  if (repriced) {
    if (repriced.short.length > 0) {
      return NextResponse.json({ ok: false, error: "out_of_stock", rejected: repriced.short }, { status: 409 });
    }
    if (repriced.gone.length > 0) {
      return NextResponse.json({ ok: false, error: "unavailable", rejected: repriced.gone }, { status: 409 });
    }
    if (repriced.resolved.length === 0) {
      return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
    }
  }
  // Correlation id: a present key updates it (empty → cleared); an absent key
  // leaves it untouched.
  const listener = readListenerId(body); // undefined = absent, null = clear, string = set

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Re-assert `pending` under a row lock: the pre-check above ran outside
      // this transaction, and an admin transition (confirm/cancel) may have
      // landed in between. The idempotent write takes a Postgres row lock, so
      // the edit can't interleave with a concurrent transition or second PATCH.
      const { count } = await tx.order.updateMany({
        where: { id, status: "pending" },
        data: { status: "pending" },
      });
      if (count === 0) throw new OrderLocked();
      // Without `items` the stored lines stand at the prices they were placed
      // at; only the delivery fee is recomputed, since the delivery block may
      // change. The lines are read under the lock, so a concurrent items edit
      // can't leave the total out of step with them.
      let itemsNet = repriced?.totals.itemsNet ?? 0;
      if (!repriced) {
        const held = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { priceEach: true, quantity: true },
        });
        itemsNet = held.reduce((sum, i) => sum + Number(i.priceEach) * i.quantity, 0);
      }
      const fee = await computeFee(method, region, itemsNet);
      if (repriced) {
        // Orders placed before agent orders stopped reserving at placement may
        // still hold their old lines' units. Give those back before the lines
        // are replaced, so the order joins the take-on-confirm flow.
        const fresh = await tx.order.findUnique({
          where: { id },
          select: {
            stockReserved: true,
            items: { select: { productId: true, productVariantId: true, quantity: true } },
          },
        });
        if (!fresh) throw new OrderLocked();
        if (fresh.stockReserved) {
          await releaseStock(
            tx,
            fresh.items.map((i) => ({
              productId: i.productId,
              variantId: i.productVariantId,
              quantity: i.quantity,
            })),
          );
        }
      }
      return tx.order.update({
        where: { id },
        data: {
          customerName: name,
          customerPhone: phone,
          address,
          city,
          postalCode,
          country,
          specialInstructions: notes,
          ...(repriced ? { stockReserved: false } : {}),
          deliveryMethod: method,
          deliveryRegion: method === "delivery" ? region : null,
          ...(listener !== undefined ? { webhookListenerId: listener } : {}),
          totalPrice: new Prisma.Decimal(itemsNet + fee),
          ...(repriced
            ? {
                items: {
                  deleteMany: {},
                  create: repriced.resolved.map((r) => ({
                    productId: r.productId,
                    productVariantId: r.variantId,
                    quantity: r.quantity,
                    priceEach: r.priceEach,
                  })),
                },
              }
            : {}),
        },
        select: ORDER_SELECT,
      });
    });

    const summary = repriced
      ? buildOrderSummary(order, repriced.resolved, repriced.totals)
      : storedOrderSummary(order, lang);
    return NextResponse.json({ ok: true, order: summary }, { status: 200 });
  } catch (error) {
    if (error instanceof OrderLocked) {
      // Lost the race to an admin transition — report the order's state now.
      const row = await prisma.order.findUnique({ where: { id }, select: { status: true } });
      return NextResponse.json(
        { ok: false, error: "locked", status: row?.status ?? "unknown" },
        { status: 409 },
      );
    }
    console.error("automation order update failed", id, error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

/** Thrown inside the edit transaction when the order is no longer `pending`. */
class OrderLocked extends Error {
  constructor() {
    super("order locked");
  }
}
