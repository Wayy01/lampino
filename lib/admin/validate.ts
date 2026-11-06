// Input checks shared by the admin actions — the layer that keeps a typo from
// turning into a Prisma error the admin can't act on.
import { REMOTE_IMAGE_HOSTS } from "@/lib/media-hosts";
import { MAX_INT } from "@/lib/utils";

/** Files written by the upload action are served from here. */
const UPLOAD_PREFIX = "/uploads/";

/** An image the storefront's `next/image` can actually render. */
export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith(UPLOAD_PREFIX) && !url.includes("..")) return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (REMOTE_IMAGE_HOSTS as readonly string[]).includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/** A video source a `<video>` tag can play: an upload or any http(s) URL. */
export function isAllowedVideoUrl(url: string): boolean {
  if (url.startsWith(UPLOAD_PREFIX) && !url.includes("..")) return true;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** A whole number in `[min, max]` that fits a Postgres `integer`. */
export function isIntInRange(n: number, min = 0, max = MAX_INT): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

/** A positive Int4 id, or null for an empty/invalid value. */
export function idOrNull(n: number | null): number | null {
  return n !== null && isIntInRange(n, 1) ? n : null;
}
