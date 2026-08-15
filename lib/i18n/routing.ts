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

/**
 * Request header carrying the resolved locale, set by `proxy.ts`.
 *
 * Only `not-found.tsx` needs it: that file must be a Server Component (a
 * client one is ignored in favour of Next's built-in 404) and is rendered
 * without `params`, so the `[lang]` segment is otherwise unreachable from it.
 */
export const LOCALE_HEADER = "x-lampino-locale";

/** Prefix an app-relative path (starting with `/`, or empty for the home page). */
export function localePath(lang: Locale, path = ""): string {
  return `/${lang}${path}`;
}

/** Catalog ("magazin") route, optionally carrying a query string. */
export function shopHref(lang: Locale, query = ""): string {
  return `/${lang}/magazin${query ? `?${query}` : ""}`;
}

/**
 * Canonical product URL: `/<lang>/product/<id>/<name-slug>`.
 * The name slug is decorative — lookups only ever use the numeric id — so a
 * missing/empty slug falls back to a stable placeholder.
 */
export function productHref(lang: Locale, id: number, name: string): string {
  return `/${lang}/product/${id}/${slugify(name) || "produs"}`;
}

/** Rental packages landing page (`/arenda`). */
export function rentalsHref(lang: Locale): string {
  return `/${lang}/arenda`;
}

/**
 * Canonical rental-package URL: `/<lang>/rental-package/<id>/<title-slug>`.
 * Like products, the slug is decorative and lookups use only the numeric id.
 */
export function rentalHref(lang: Locale, id: number, title: string): string {
  return `/${lang}/rental-package/${id}/${slugify(title) || "pachet"}`;
}
