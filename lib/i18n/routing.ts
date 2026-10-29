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

/** A bilingual name, as every catalog model carries it. */
type Bilingual = { name_ro: string; name_ru: string };

const localName = (lang: Locale, n: Bilingual) => (lang === "ru" ? n.name_ru : n.name_ro) || n.name_ro;

/**
 * Locale-less product path (`/product/<id>/<name-slug>`). The slug is built
 * from the name in the page's own language — Romanian for `/ro`, transliterated
 * Russian for `/ru` — so the two twins differ past their locale prefix and
 * hreflang builders need one path per locale (see `productPaths`).
 */
export function productPath(id: number, name: string): string {
  // `slugify` only emits [a-z0-9-], but keep the encoding as a guard: a raw
  // non-Latin1 byte in a redirect's `Location` header crashes Node with
  // ERR_INVALID_CHAR.
  return `/product/${id}/${encodeURIComponent(slugify(name) || "produs")}`;
}

/** The product's locale-less path in each language, for hreflang + sitemap. */
export function productPaths(p: { id: number } & Bilingual): Record<Locale, string> {
  return { ro: productPath(p.id, localName("ro", p)), ru: productPath(p.id, localName("ru", p)) };
}

/**
 * Canonical product URL: `/<lang>/product/<id>/<name-slug>`.
 * The name slug is decorative — lookups only ever use the numeric id — so a
 * stale slug redirects and an empty one falls back to a stable placeholder.
 */
export function productHref(lang: Locale, p: { id: number } & Bilingual): string {
  return localePath(lang, productPaths(p)[lang]);
}

/** Rental packages landing page (`/arenda`). */
export function rentalsHref(lang: Locale): string {
  return `/${lang}/arenda`;
}

type Titled = { id: number; title_ro: string; title_ru: string };

/** Locale-less rental-package path (`/rental-package/<id>/<title-slug>`). */
export function rentalPath(id: number, title: string): string {
  return `/rental-package/${id}/${encodeURIComponent(slugify(title) || "pachet")}`;
}

/** The package's locale-less path in each language, for hreflang + sitemap. */
export function rentalPaths(r: Titled): Record<Locale, string> {
  return {
    ro: rentalPath(r.id, r.title_ro),
    ru: rentalPath(r.id, r.title_ru || r.title_ro),
  };
}

/**
 * Canonical rental-package URL: `/<lang>/rental-package/<id>/<title-slug>`.
 * Like products, the slug is decorative and lookups use only the numeric id.
 */
export function rentalHref(lang: Locale, r: Titled): string {
  return localePath(lang, rentalPaths(r)[lang]);
}

/**
 * Category slug in the page's language (`ghirlande-de-exterior`,
 * `ulichnye-girlyandy`). Derived from the name rather than the admin `slug`
 * column, which holds legacy English keys the catalog filters on internally.
 */
export function categorySlug(lang: Locale, c: { id: number } & Bilingual): string {
  return slugify(localName(lang, c)) || `categorie-${c.id}`;
}

/** Locale-less category landing path (`/magazin/<category-slug>`). */
export function categoryPaths(c: { id: number } & Bilingual): Record<Locale, string> {
  return {
    ro: `/magazin/${categorySlug("ro", c)}`,
    ru: `/magazin/${categorySlug("ru", c)}`,
  };
}

/** Category landing page, optionally carrying the catalog's other filters. */
export function categoryHref(
  lang: Locale,
  c: { id: number } & Bilingual,
  query = "",
): string {
  return `${localePath(lang, categoryPaths(c)[lang])}${query ? `?${query}` : ""}`;
}
