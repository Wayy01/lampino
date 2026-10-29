// Promotion scheduling and pricing. A promotion is a date window plus a
// percentage; a product or rental package can belong to any number of them,
// so a whole year of campaigns can be planned at once. On any given moment
// the storefront and checkout apply the best currently-running one.
//
// Pure functions only: shared by lib/data/* (display), lib/actions/orders.ts
// (what the customer is charged), and the admin (date inputs, status badges).

/** Every promotion date is a calendar day in the shop's own timezone. */
export const SHOP_TIME_ZONE = "Europe/Chisinau";

export type PromotionWindow = {
  startDate: Date;
  endDate: Date;
  discountPercent: number;
};

export type PromotionState = "scheduled" | "active" | "expired";

export function promotionState(
  p: Pick<PromotionWindow, "startDate" | "endDate">,
  now: Date = new Date(),
): PromotionState {
  if (now < p.startDate) return "scheduled";
  if (now > p.endDate) return "expired";
  return "active";
}

/** A usable discount: strictly between 0 and 100 percent. */
function validPercent(pct: number): boolean {
  return Number.isFinite(pct) && pct > 0 && pct < 100;
}

/**
 * The promotion to apply right now: among those running at `now`, the one
 * with the biggest discount. Overlaps are allowed on purpose — a product can
 * sit in a seasonal sale and a clearance at once, and gets the better deal.
 */
export function bestActivePromotion<T extends PromotionWindow>(
  promotions: readonly T[],
  now: Date = new Date(),
): T | null {
  let best: T | null = null;
  for (const p of promotions) {
    if (promotionState(p, now) !== "active" || !validPercent(p.discountPercent)) continue;
    if (!best || p.discountPercent > best.discountPercent) best = p;
  }
  return best;
}

/**
 * The reduced price to show and charge, or null when there is none. Starts
 * from the list price; a promotion is rounded to whole lei (prices display
 * without decimals, so the customer is charged exactly what they saw). A
 * manual reduced price set on the product still applies — whichever is lower
 * wins.
 */
export function effectiveReducedPrice(
  price: number,
  manualReduced: number | null,
  discountPercent: number | null,
): number | null {
  let best = manualReduced !== null && manualReduced < price ? manualReduced : null;
  if (discountPercent !== null && validPercent(discountPercent)) {
    const promo = Math.round(price * (1 - discountPercent / 100));
    if (promo < price && (best === null || promo < best)) best = promo;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Calendar days in the shop timezone. The server runs in Europe/Berlin and
// browsers anywhere, so "1 December" has to be pinned to Chisinau explicitly
// or a sale would start an hour (or a day) off.

/** Minutes the zone is ahead of UTC at `instant`. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a wall-clock time in `timeZone` happens (DST-aware). */
function zonedInstant(
  y: number, m: number, d: number,
  h: number, mi: number, s: number, ms: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms);
  let instant = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  // Re-check once: the first guess can sit on the other side of a DST switch.
  instant = guess - zoneOffsetMinutes(new Date(instant), timeZone) * 60_000;
  return new Date(instant);
}

/**
 * `YYYY-MM-DD` → the first (`start`) or last (`end`) millisecond of that day
 * in the shop timezone. An end date covers its whole day, so a one-day sale
 * has start === end. Returns null for anything that isn't a real date.
 */
export function shopDayBoundary(value: string, edge: "start" | "end"): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return edge === "start"
    ? zonedInstant(y, m, d, 0, 0, 0, 0, SHOP_TIME_ZONE)
    : zonedInstant(y, m, d, 23, 59, 59, 999, SHOP_TIME_ZONE);
}

/** An instant as the `YYYY-MM-DD` shop-timezone day, for `<input type="date">`. */
export function toShopDateInput(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
