// Faceted-filter helpers for the product catalog.
//
// The catalog filters on values derived from each product's free-form
// `specifications` map (colorTemp, base, lumens). These classifiers bucket those
// raw strings into a small, stable set of keys, and `buildFacets` reports only
// the buckets that actually occur in the data — so the UI never renders an empty
// option. All functions are pure and data-driven; adding products with new spec
// values automatically surfaces the matching facets.
import type { Product } from "./types";
import { rawSpecValue } from "./specs";

/* ----------------------------- Color temperature ---------------------------- */

export type ColorTempKey = "warm" | "neutral" | "cool" | "tunable" | "rgb";
export const COLOR_TEMP_ORDER: ColorTempKey[] = [
  "warm",
  "neutral",
  "cool",
  "tunable",
  "rgb",
];

/** Bucket a raw colorTemp string ("2700K", "2700–6500K", "RGB") into a key. */
export function classifyColorTemp(raw: string | undefined): ColorTempKey | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v.includes("RGB")) return "rgb";
  // A numeric range (e.g. "2700–6500K") means tunable white.
  if (/\d\s*[–-]\s*\d/.test(v)) return "tunable";
  const k = parseInt(v, 10);
  if (Number.isNaN(k)) return null;
  if (k <= 3000) return "warm";
  if (k <= 4500) return "neutral";
  return "cool";
}

/* --------------------------------- Socket ---------------------------------- */

export type SocketKey = "e27" | "e14" | "gu10" | "integrated";
export const SOCKET_ORDER: SocketKey[] = ["e27", "e14", "gu10", "integrated"];

/** Bucket a raw base string ("E27", "GU10", "—") into a socket key. */
export function classifySocket(raw: string | undefined): SocketKey {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "E27") return "e27";
  if (v === "E14") return "e14";
  if (v === "GU10") return "gu10";
  return "integrated"; // "—", "", or any non-socket value
}

/* ------------------------------- Brightness -------------------------------- */

export type LumensKey = "ambient" | "cozy" | "bright" | "powerful";
export const LUMENS_ORDER: LumensKey[] = [
  "ambient",
  "cozy",
  "bright",
  "powerful",
];

/** Bucket a raw lumens value into a brightness key. */
export function classifyLumens(raw: string | undefined): LumensKey | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 400) return "ambient";
  if (n <= 1000) return "cozy";
  if (n <= 2000) return "bright";
  return "powerful";
}

/* -------------------------------- Facets ----------------------------------- */

export type Facets = {
  colorTemps: ColorTempKey[];
  sockets: SocketKey[];
  lumens: LumensKey[];
};

/** Distinct, present facet options across the given products, in display order. */
export function buildFacets(products: Product[]): Facets {
  const colors = new Set<ColorTempKey>();
  const sockets = new Set<SocketKey>();
  const lumens = new Set<LumensKey>();
  for (const p of products) {
    const ct = classifyColorTemp(rawSpecValue(p.specifications, "colorTemp"));
    if (ct) colors.add(ct);
    sockets.add(classifySocket(rawSpecValue(p.specifications, "base")));
    const lm = classifyLumens(rawSpecValue(p.specifications, "lumens"));
    if (lm) lumens.add(lm);
  }
  return {
    colorTemps: COLOR_TEMP_ORDER.filter((k) => colors.has(k)),
    sockets: SOCKET_ORDER.filter((k) => sockets.has(k)),
    lumens: LUMENS_ORDER.filter((k) => lumens.has(k)),
  };
}

/* --------------------------------- Sort ------------------------------------ */

export type SortKey = "featured" | "price-asc" | "price-desc";
export const SORT_KEYS: SortKey[] = ["featured", "price-asc", "price-desc"];
export const DEFAULT_SORT: SortKey = "featured";

export function isSortKey(v: string | undefined): v is SortKey {
  return v === "featured" || v === "price-asc" || v === "price-desc";
}

/** Return a sorted copy of the list for the given sort key. */
export function sortProducts(list: Product[], key: SortKey): Product[] {
  const copy = list.slice();
  switch (key) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "featured":
    default:
      return copy.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.featuredOrder - b.featuredOrder;
      });
  }
}
