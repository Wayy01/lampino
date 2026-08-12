// Client-side storefront analytics. Fire-and-forget POSTs to /api/track — a
// dropped beacon is never worth interrupting the shopper, so every failure is
// swallowed. Kept intentionally tiny: an anonymous per-browser id plus a
// single sender that survives page unload via `sendBeacon`.

const VISITOR_KEY = "lampino-vid";

/** Event shapes accepted by the /api/track route handler. */
export type TrackPayload =
  | { type: "product_view"; productId: number; dwellMs: number }
  | { type: "rental_view"; rentalPackageId: number; dwellMs: number }
  | { type: "add_to_cart"; productId: number };

/**
 * Stable anonymous id for this browser, minted on first use. No personal data —
 * it only lets the dashboard separate unique visitors from repeat views.
 */
function visitorId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Send one analytics event. Uses `navigator.sendBeacon` so view events still
 * arrive when fired from a page that's being torn down (tab close, navigation);
 * falls back to a keepalive `fetch`. Never throws.
 */
export function track(payload: TrackPayload): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ ...payload, visitorId: visitorId() });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/track", blob)) return;
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never surface an error to the shopper.
  }
}
