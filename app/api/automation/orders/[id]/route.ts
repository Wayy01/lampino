// Ligatto order-automation API — the residual edit window. While an agent-placed
// order is still `pending` (no human has acted on it), the AI agent may add/change
// items and fix buyer/delivery details. Once an admin moves it to `confirmed` it
// locks and the agent must hand off to a human. Editing re-prices the whole order at
// current catalog prices and re-reserves stock atomically.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { reserveStock, releaseStock, mergeLines } from "@/lib/stock";
import { requireAutomationToken } from "@/lib/api/automation-auth";
import {
  resolveOrderLines,
  computeFee,
  buildOrderSummary,
  type RequestedLine,
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
  StockShortage,
  parseLang,
  parseMethod,
  parseRegion,
  readListenerId,
} from "@/lib/api/automation-orders";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAutomationToken(request);
  if ("response" in auth) return auth.response;

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
      items: { select: { productId: true, productVariantId: true, quantity: true } },
    },
  });
  if (!current) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  // The automation API only edits orders it placed (a Ligatto agent origin);
  // storefront orders ("web") are out of its scope — hide them as 404.
  if (current.source === "web") {
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
  let region = parseRegion(current.deliveryRegion);
  let address = current.address;
  let city = current.city;
  let postalCode = current.postalCode;
  let country = current.country;
  let notes = current.specialInstructions;
  if (body.delivery !== undefined) {
    const d = body.delivery as Record<string, unknown> | null;
    method = parseMethod(d?.method);
    region = parseRegion(d?.region);
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

  // Items: a present `items` list replaces the full set; otherwise keep current.
  const target: RequestedLine[] =
    body.items !== undefined
      ? sanitizeLines(body.items)
      : mergeLines(
          current.items.flatMap((i) =>
            i.productId === null
              ? []
              : [{ productId: i.productId, variantId: i.productVariantId, quantity: i.quantity }],
          ),
        );
  if (target.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
  }

  // Price without a stock pre-check: the order already holds its units, so the
  // authoritative check is the in-transaction release→reserve below.
  const { resolved, gone, totals } = await resolveOrderLines(target, lang, { checkStock: false });
  if (gone.length > 0) {
    return NextResponse.json({ ok: false, error: "unavailable", rejected: gone }, { status: 409 });
  }
  if (resolved.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
  }

  // Correlation id: a present key updates it (empty → cleared); an absent key
  // leaves it untouched.
  const listener = readListenerId(body); // undefined = absent, null = clear, string = set

  const fee = await computeFee(method, region, totals.itemsNet);
  const currentLines = current.items.map((i) => ({
    productId: i.productId,
    variantId: i.productVariantId,
    quantity: i.quantity,
  }));

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Give back what the order held, then take the new set — net-correct even
      // when lines overlap, and a shortage rolls the whole thing back.
      await releaseStock(tx, currentLines);
      const shortage = await reserveStock(tx, resolved);
      if (shortage.length > 0) throw new StockShortage(shortage);
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
          stockReserved: true,
          deliveryMethod: method,
          deliveryRegion: method === "delivery" ? region : null,
          ...(listener !== undefined ? { webhookListenerId: listener } : {}),
          totalPrice: new Prisma.Decimal(totals.itemsNet + fee),
          items: {
            deleteMany: {},
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

    return NextResponse.json({ ok: true, order: buildOrderSummary(order, resolved, totals) }, { status: 200 });
  } catch (error) {
    if (error instanceof StockShortage) {
      return NextResponse.json({ ok: false, error: "out_of_stock", rejected: error.lines }, { status: 409 });
    }
    console.error("automation order update failed", id, error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
