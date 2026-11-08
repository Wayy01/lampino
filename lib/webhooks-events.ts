// Client-safe webhook event catalogue. Kept separate from lib/webhooks.ts (which
// imports prisma + node:crypto) so admin client components can list the events
// without pulling server-only code into the browser bundle.

// Known event types. Adding one is additive: extend this list, give the
// endpoint-create form a checkbox, and add a `dispatch*` builder in lib/webhooks.
export const WEBHOOK_EVENTS = ["shipment.created"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
