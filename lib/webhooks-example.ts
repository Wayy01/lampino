// Client-safe example-request builder, shared by the admin UI (live curl
// preview + per-row examples) and the dispatcher's header merge. No server
// imports, so it is safe in browser bundles.
import { type WebhookEvent } from "@/lib/webhooks-events";

// Header names Lampino always sets itself; a custom header duplicating one of
// these (case-insensitively) is dropped so it can't shadow the real value.
// `authorization` is deliberately NOT here — the receiver's auth token (if any)
// is exactly what the admin supplies through custom headers.
export const RESERVED_HEADER_NAMES = new Set([
  "content-type",
  "user-agent",
  "x-lampino-event",
  "x-lampino-delivery",
]);

/**
 * Substitute `{{key}}` placeholders with values from `vars` (unknown keys → "").
 * Used for header values and (in the preview) the example request, so a receiver
 * that needs per-order values — e.g. `SB-CONVERSATION: {{webhook_listener_id}}` —
 * gets them filled at send time.
 */
export function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "",
  );
}

/** Parse a "Name: value" per-line blob into ordered, trimmed pairs. */
export function parseHeaderLines(raw: string | null | undefined): [string, string][] {
  if (!raw) return [];
  const out: [string, string][] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx <= 0) continue;
    const name = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (name) out.push([name, value]);
  }
  return out;
}

// The {{placeholder}} variable names Lampino substitutes into header templates
// and emits under `variables`. Single source of truth: both the live `vars` map
// (lib/webhooks.ts) and WEBHOOK_EXAMPLE_VARS below are typed `Record<WebhookVarKey,
// string>`, so adding/removing a key in one without the other is a compile error.
export type WebhookVarKey =
  | "webhook_listener_id"
  | "order_id"
  | "order_source"
  | "order_status"
  | "order_total"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "delivery_city"
  | "delivery_address"
  | "tracking_number"
  | "carrier"
  | "carrier_name"
  | "cod_amount";

// Example values for the placeholder variables — shown in the admin curl preview.
export const WEBHOOK_EXAMPLE_VARS: Record<WebhookVarKey, string> = {
  webhook_listener_id: "6f1e8c90-conversation-id",
  order_id: "1234",
  order_source: "agent-whatsapp",
  order_status: "shipped",
  order_total: "250",
  customer_name: "Ion Popescu",
  customer_phone: "+373 60 000 000",
  customer_email: "ion@example.com",
  delivery_city: "Chișinău",
  delivery_address: "Str. Exemplu 1",
  tracking_number: "NP00012345",
  carrier: "novapost",
  carrier_name: "Nova Post",
  cod_amount: "250",
};

// Representative payloads, one per event type. Shape MUST mirror the real
// builders in lib/webhooks.ts (e.g. dispatchShipmentCreated) so the preview an
// admin sees matches what gets sent.
export const WEBHOOK_EXAMPLE_PAYLOADS: Record<WebhookEvent, unknown> = {
  "shipment.created": {
    event: "shipment.created",
    createdAt: "2026-01-15T10:30:00.000Z",
    variables: WEBHOOK_EXAMPLE_VARS,
    data: {
      order: {
        id: 1234,
        source: "agent-whatsapp",
        status: "shipped",
        customer: {
          name: "Ion Popescu",
          phone: "+373 60 000 000",
          email: "ion@example.com",
        },
        delivery: {
          method: "delivery",
          region: "chisinau",
          city: "Chișinău",
          address: "Str. Exemplu 1",
          postalCode: "MD-2000",
        },
        total: 250,
      },
      shipment: {
        id: 56,
        carrier: "novapost",
        carrierTitle: "Nova Post",
        trackingNumber: "NP00012345",
        codAmount: 250,
        labelUrl: null,
      },
      items: [
        { productId: 42, variantId: null, name: "Bec LED 9W E27", quantity: 2, priceEach: 100 },
      ],
    },
  },
};

const DELIVERY_PLACEHOLDER = "11111111-1111-1111-1111-111111111111";

/**
 * Build a copy-pasteable curl command showing exactly what Lampino sends for an
 * endpoint: the standard headers (delivery id as a placeholder), any custom
 * headers the admin configured (e.g. the receiver's auth token), and the event's
 * example JSON body.
 */
export function buildWebhookCurl({
  url,
  event,
  customHeaders,
}: {
  url: string;
  event: WebhookEvent;
  customHeaders?: string | null;
}): string {
  const headers: [string, string][] = [
    ["Content-Type", "application/json"],
    ["User-Agent", "Lampino-Webhooks/1"],
    ["X-Lampino-Event", event],
    ["X-Lampino-Delivery", DELIVERY_PLACEHOLDER],
    ...parseHeaderLines(customHeaders)
      .filter(([name]) => !RESERVED_HEADER_NAMES.has(name.toLowerCase()))
      .map(([name, value]) => [name, substituteVars(value, WEBHOOK_EXAMPLE_VARS)] as [string, string]),
  ];
  const body = JSON.stringify(WEBHOOK_EXAMPLE_PAYLOADS[event], null, 2);
  // Single-quote the body for the shell; our example data contains no quotes.
  return [
    `curl -X POST '${url || "https://example.com/webhook"}' \\`,
    ...headers.map(([name, value]) => `  -H '${name}: ${value}' \\`),
    `  -d '${body}'`,
  ].join("\n");
}
