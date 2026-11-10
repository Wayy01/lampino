// Lampino owns the city → delivery-region mapping. Callers (storefront, the
// Ligatto automation API) send a free-text city; the two-bucket pricing region
// (`chisinau` vs `outside`, see `lib/pricing.ts`) is derived here, never trusted
// from the payload — region is purely a pricing input, and everything price-like
// is resolved from Lampino's own data.
//
// Only the city of Chișinău itself (and its spelling/transliteration variants)
// bills at the city rate; everything else — suburbs, other towns, an empty or
// unrecognized city — is `outside`. Undercharging delivery is the worse failure
// for the shop, so the rule stays narrow and the resolved region is echoed back
// on every order for a human to correct.
import type { DeliveryRegion } from "@/lib/pricing";

// Lowercase + strip diacritics so "Chișinău", "CHISINAU", "Chisinau" all fold to
// the same plain-ASCII "chisinau". NFD decomposition turns ș/ț/ă/â/î into base
// letter + combining mark, which the replace drops.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Whole-word match for Chișinău: the folded Latin form ("chisinau", e.g. in
// "mun. Chisinau" or "Chisinau, Botanica") or a "kishin…" transliteration. The
// word boundaries keep a street like "chisinauului" from matching.
const CHISINAU_RE = /\bchisinau\b|\bkishin/;

/**
 * Derive the delivery-region pricing bucket from a free-text city. Only the city
 * of Chișinău (Latin or the Cyrillic "Кишинёв/Кишинев") bills at the city rate;
 * everything else — including an empty/unrecognized city — is `outside`.
 */
export function regionFromCity(rawCity: unknown): DeliveryRegion {
  const city = typeof rawCity === "string" ? rawCity : "";
  if (/кишин/i.test(city)) return "chisinau";
  return CHISINAU_RE.test(fold(city)) ? "chisinau" : "outside";
}
