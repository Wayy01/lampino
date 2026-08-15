// Storefront analytics sink. Receives fire-and-forget beacons from
// `lib/analytics/track.ts` and writes one `AnalyticsEvent` row. This is the one
// public write path outside the server actions in `lib/actions/*` — beacons
// have to reach an endpoint `navigator.sendBeacon` can POST to, which a server
// action can't be. Everything is best-effort: bad input is dropped with 204 so
// a misbehaving client never sees an error and never learns anything about the
// schema.
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VIEW_TYPES = new Set(["product_view", "rental_view"]);
const ALL_TYPES = new Set([...VIEW_TYPES, "add_to_cart"]);

// A view longer than this is a left-open tab, not attention — cap it so a
// single forgotten tab can't skew the average dwell time.
const MAX_DWELL_MS = 30 * 60 * 1000;

// A refresh or back/forward within this window is the same visit, not a new
// one — skip logging it so reloading a page doesn't inflate its view count.
const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/** A finite integer id in the plausible range, or null. */
function id(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as Record<string, unknown>;
    const type = typeof data.type === "string" ? data.type : "";
    if (!ALL_TYPES.has(type)) return noContent();

    const productId = id(data.productId);
    const rentalPackageId = id(data.rentalPackageId);
    const visitorId =
      typeof data.visitorId === "string" && data.visitorId.length <= 64
        ? data.visitorId
        : null;

    // Every event has to point at exactly one entity of the right kind.
    if (type === "rental_view" && rentalPackageId === null) return noContent();
    if (type !== "rental_view" && productId === null) return noContent();

    let dwellMs: number | null = null;
    if (VIEW_TYPES.has(type)) {
      const raw = data.dwellMs;
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
        return noContent();
      }
      dwellMs = Math.min(Math.round(raw), MAX_DWELL_MS);

      if (visitorId) {
        const recent = await prisma.analyticsEvent.findFirst({
          where: {
            type,
            visitorId,
            productId: type === "rental_view" ? null : productId,
            rentalPackageId: type === "rental_view" ? rentalPackageId : null,
            createdAt: { gte: new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS) },
          },
          select: { id: true },
        });
        if (recent) return noContent();
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        type,
        productId: type === "rental_view" ? null : productId,
        rentalPackageId: type === "rental_view" ? rentalPackageId : null,
        dwellMs,
        visitorId,
      },
    });
  } catch {
    // Malformed JSON, DB hiccup — nothing the caller can or should act on.
  }
  return noContent();
}

function noContent() {
  return new Response(null, { status: 204 });
}
