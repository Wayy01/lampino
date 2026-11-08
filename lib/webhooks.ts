// Outbound webhooks. When an order ships, Lampino POSTs a `shipment.created`
// event to every enabled endpoint subscribed to it (admin: Integrations →
// Webhooks) so external systems — chiefly Ligatto — can close the loop with the
// customer (tracking number, carrier, items).
//
// There is no job queue, so dispatch runs in-process and fire-and-forget, the
// same way `lib/telegram.ts` sends alerts: callers kick it off without awaiting
// and it never throws. Each delivery does up to MAX_ATTEMPTS tries with short
// backoff (retrying only transient failures) and records a WebhookDelivery row
// — the admin's observability substitute for a queue's attempt log.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { type WebhookEvent } from "@/lib/webhooks-events";
import {
  parseHeaderLines,
  RESERVED_HEADER_NAMES,
  substituteVars,
  type WebhookVarKey,
} from "@/lib/webhooks-example";

export { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks-events";

const MAX_ATTEMPTS = 3;
// Backoff before retry N+1 (ms). Short — this runs in-process, not on a queue.
const BACKOFF_MS = [1000, 3000];
const TIMEOUT_MS = 10_000;
const ERROR_SNIPPET = 500;

type DeliveryRefs = { orderId: number | null; shipmentId: number | null };

function num(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Build and dispatch a `shipment.created` event for a freshly created shipment.
 * Loads everything the payload needs itself so callers (the courier actions)
 * only pass the new shipment id. Fire-and-forget: await nothing, never throws.
 */
export async function dispatchShipmentCreated(shipmentId: number): Promise<void> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      carrier: true,
      carrierTitle: true,
      trackingNumber: true,
      codAmount: true,
      labelUrl: true,
      order: {
        select: {
          id: true,
          source: true,
          status: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          deliveryMethod: true,
          deliveryRegion: true,
          city: true,
          address: true,
          postalCode: true,
          webhookListenerId: true,
          totalPrice: true,
          items: {
            select: {
              productId: true,
              productVariantId: true,
              quantity: true,
              priceEach: true,
              product: { select: { name_ro: true } },
              productVariant: { select: { name_ro: true } },
            },
          },
        },
      },
    },
  });

  // Shipment or its order vanished between creation and this background call.
  if (!shipment?.order) return;
  const order = shipment.order;

  // Flat variables: substituted into header templates (e.g.
  // `SB-CONVERSATION: {{webhook_listener_id}}`) and emitted under `variables` so
  // receivers that merge a flat bag (Ligatto reads `variables`) get usable fields.
  const vars: Record<WebhookVarKey, string> = {
    webhook_listener_id: order.webhookListenerId ?? "",
    order_id: String(order.id),
    order_source: order.source ?? "",
    order_status: order.status ?? "",
    order_total: String(num(order.totalPrice) ?? ""),
    customer_name: order.customerName ?? "",
    customer_phone: order.customerPhone ?? "",
    customer_email: order.customerEmail ?? "",
    delivery_city: order.city ?? "",
    delivery_address: order.address ?? "",
    tracking_number: shipment.trackingNumber ?? "",
    carrier: shipment.carrier ?? "",
    carrier_name: shipment.carrierTitle ?? shipment.carrier ?? "",
    cod_amount: String(num(shipment.codAmount) ?? ""),
  };

  const payload = {
    event: "shipment.created" satisfies WebhookEvent,
    createdAt: new Date().toISOString(),
    variables: vars,
    data: {
      order: {
        id: order.id,
        source: order.source,
        status: order.status,
        customer: {
          name: order.customerName,
          phone: order.customerPhone,
          email: order.customerEmail,
        },
        delivery: {
          method: order.deliveryMethod,
          region: order.deliveryRegion,
          city: order.city,
          address: order.address,
          postalCode: order.postalCode,
        },
        total: num(order.totalPrice),
      },
      shipment: {
        id: shipment.id,
        carrier: shipment.carrier,
        carrierTitle: shipment.carrierTitle,
        trackingNumber: shipment.trackingNumber,
        codAmount: num(shipment.codAmount),
        labelUrl: shipment.labelUrl,
      },
      items: order.items.map((it) => ({
        productId: it.productId,
        variantId: it.productVariantId,
        name: it.productVariant?.name_ro ?? it.product?.name_ro ?? null,
        quantity: it.quantity,
        priceEach: num(it.priceEach),
      })),
    },
  };

  await dispatch("shipment.created", payload, vars, { orderId: order.id, shipmentId: shipment.id });
}

/** POST `payload` to every enabled endpoint subscribed to `event`. */
async function dispatch(
  event: WebhookEvent,
  payload: unknown,
  vars: Record<string, string>,
  refs: DeliveryRefs,
): Promise<void> {
  const all = await prisma.webhookEndpoint.findMany({
    where: { enabled: true, event },
  });
  // Correlation-only endpoints (e.g. Ligatto) must not receive orders without a
  // correlation id — that would send an empty {{webhook_listener_id}} the receiver
  // rejects, and leak storefront-order PII to them for no reason.
  const hasListener = vars.webhook_listener_id !== "";
  const endpoints = all.filter((ep) => !ep.requiresListenerId || hasListener);
  if (endpoints.length === 0) return;

  const body = JSON.stringify(payload);
  // `deliver` swallows its own errors, so one bad endpoint can't reject the lot.
  await Promise.all(endpoints.map((ep) => deliver(ep, event, body, payload, vars, refs)));
}

type Endpoint = Awaited<ReturnType<typeof prisma.webhookEndpoint.findMany>>[number];

async function deliver(
  endpoint: Endpoint,
  event: WebhookEvent,
  body: string,
  payload: unknown,
  vars: Record<string, string>,
  refs: DeliveryRefs,
): Promise<void> {
  const deliveryId = randomUUID();
  const headers: Record<string, string> = {};
  // Admin-configured headers first (the receiver's auth token / correlation id
  // live here, with {{placeholders}} filled from this order's vars), but never
  // let them shadow the headers Lampino sets itself.
  for (const [name, value] of parseHeaderLines(endpoint.headers)) {
    // Strip CR/LF from the substituted value: a var carrying a newline would make
    // fetch throw on the header (failing the whole delivery) — and guards header
    // injection regardless.
    if (!RESERVED_HEADER_NAMES.has(name.toLowerCase())) {
      headers[name] = substituteVars(value, vars).replace(/[\r\n]+/g, " ").trim();
    }
  }
  headers["Content-Type"] = "application/json";
  headers["User-Agent"] = "Lampino-Webhooks/1";
  headers["X-Lampino-Event"] = event;
  headers["X-Lampino-Delivery"] = deliveryId;

  let attempts = 0;
  let httpStatus: number | null = null;
  let error: string | null = null;
  let ok = false;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts = i + 1;
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      httpStatus = res.status;
      if (res.ok) {
        ok = true;
        error = null;
        break;
      }
      error = (await res.text().catch(() => "")).slice(0, ERROR_SNIPPET) || `HTTP ${res.status}`;
      // 4xx is the receiver rejecting the request — retrying won't help.
      if (res.status < 500) break;
    } catch (e) {
      // Network error / timeout — transient, worth retrying.
      httpStatus = null;
      error = String(e instanceof Error ? e.message : e).slice(0, ERROR_SNIPPET);
    }
    if (i < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[i]);
  }

  try {
    await prisma.webhookDelivery.create({
      data: {
        deliveryId,
        endpointId: endpoint.id,
        event,
        orderId: refs.orderId,
        shipmentId: refs.shipmentId,
        status: ok ? "success" : "failed",
        attempts,
        httpStatus,
        error: ok ? null : error,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    console.error("[webhooks] failed to record delivery", e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
