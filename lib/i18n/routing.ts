// Locale-aware URL helpers. Every public route is prefixed with the active
// locale (`/ro/...`, `/ru/...`); these builders keep that prefix consistent
// across links, the language switcher, and the proxy redirect.
import { slugify } from "@/lib/slug";
import type { Lang } from "./dictionaries";

export type Locale = Lang;

export const LOCALES: readonly Locale[] = ["ro", "ru"];
export const DEFAULT_LOCALE: Locale = "ro";

export function isLocale(value: string | undefined): value is Locale {
  return value === "ro" || value === "ru";
}

/** Prefix an app-relative path (starting with `/`, or empty for the home page). */
export function localePath(lang: Locale, path = ""): string {
  return `/${lang}${path}`;
}

/** Catalog ("magazin") route, optionally carrying a query string. */
export function shopHref(lang: Locale, query = ""): string {
  return `/${lang}/magazin${query ? `?${query}` : ""}`;
}

/**
 * Locale-less product path (`/product/<id>/<name-slug>`). Detail URLs differ
 * only by their locale prefix — the slug always comes from the Romanian name —
 * so the sitemap and hreflang builders prefix this once per locale themselves.
 */
export function productPath(id: number, name: string): string {
  return `/product/${id}/${slugify(name) || "produs"}`;
}

/**
 * Canonical product URL: `/<lang>/product/<id>/<name-slug>`.
 * The name slug is decorative — lookups only ever use the numeric id — so a
 * missing/empty slug falls back to a stable placeholder.
 */
export function productHref(lang: Locale, id: number, name: string): string {
  return localePath(lang, productPath(id, name));
}

/** Rental packages landing page (`/arenda`). */
export function rentalsHref(lang: Locale): string {
  return `/${lang}/arenda`;
}

/** Locale-less rental-package path (`/rental-package/<id>/<title-slug>`). */
export function rentalPath(id: number, title: string): string {
  return `/rental-package/${id}/${slugify(title) || "pachet"}`;
}

/**
 * Canonical rental-package URL: `/<lang>/rental-package/<id>/<title-slug>`.
 * Like products, the slug is decorative and lookups use only the numeric id.
 */
export function rentalHref(lang: Locale, id: number, title: string): string {
  return localePath(lang, rentalPath(id, title));
}
