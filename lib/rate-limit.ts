// In-memory, per-process throttle for the public server actions (checkout,
// rental inquiry). Good enough for the single `next start` process this shop
// runs on; it resets on restart, which is fine for spam protection.
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

async function clientIp(): Promise<string | null> {
  const h = await headers();
  // nginx sets X-Real-IP to the socket address. X-Forwarded-For's *first*
  // entry is whatever the client sent (nginx only appends), so it can't be
  // trusted; fall back to its last entry, the one our proxy added.
  const real = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return real || forwarded || null;
}

/**
 * `true` when the caller is still under `limit` hits per `windowMs` for
 * `scope`. Callers with no identifiable IP are never throttled — sharing one
 * bucket between all of them would lock out every real customer at once.
 */
export async function withinRateLimit(
  scope: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const ip = await clientIp();
  if (!ip) return true;

  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }

  const key = `${scope}:${ip}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
