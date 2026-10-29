// Site-wide SEO primitives: the canonical origin, the hreflang block every
// public page repeats, and the small formatting helpers metadata needs.
// `metadataBase` is set once in the storefront layout, so the `alternates`
// returned here stay relative and Next resolves them to absolute URLs.
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/lib/i18n/routing";
import { stripMarkdown } from "@/lib/markdown";

export const SITE_NAME = "Lampino";

/**
 * Production origin. Overridden per environment with `NEXT_PUBLIC_SITE_URL`
 * (staging, preview deploys); the default is the live domain so a build with
 * no env var still emits correct canonicals and sitemap entries.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lampino.md"
).replace(/\/+$/, "");

/** ISO 4217 for the Moldovan leu — what `formatPrice` renders as "lei". */
export const CURRENCY = "MDL";

/** `og:locale` values for the two storefront locales. */
export const OG_LOCALE: Record<Locale, string> = { ro: "ro_RO", ru: "ru_RU" };

/** Absolute URL for a site-relative path; already-absolute URLs pass through. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * A page's locale-less path: one string when both twins share it (`/magazin`),
 * or one per locale when the slug is translated (`productPaths`).
 */
export type LocalizedPath = string | Record<Locale, string>;

const pathFor = (lang: Locale, path: LocalizedPath) =>
  typeof path === "string" ? path : path[lang];

/**
 * Canonical + hreflang block for a page (`""` for the home page, `"/magazin"`,
 * or a per-locale record). Google wants both localized twins *and* an
 * `x-default` on every page, pointing at the default locale, and the canonical
 * must be the same URL this page lists for its own language.
 */
export function localeAlternates(lang: Locale, path: LocalizedPath = ""): Metadata["alternates"] {
  return {
    canonical: localePath(lang, pathFor(lang, path)),
    languages: hreflangs(path, (p) => p),
  };
}

/** The `ro` / `ru` / `x-default` map for a page, each URL passed through `map`. */
export function hreflangs(
  path: LocalizedPath,
  map: (url: string) => string,
): Record<Locale | "x-default", string> {
  return {
    ro: map(localePath("ro", pathFor("ro", path))),
    ru: map(localePath("ru", pathFor("ru", path))),
    "x-default": map(localePath(DEFAULT_LOCALE, pathFor(DEFAULT_LOCALE, path))),
  };
}

/**
 * The Open Graph block for a page. Next *replaces* `openGraph` wholesale when a
 * child route defines it — it doesn't merge with the layout's — so every page
 * has to restate `siteName` and the locale pair or they silently disappear.
 * `path` is locale-less, like `localeAlternates`.
 */
export function openGraphFor(
  lang: Locale,
  content: { title: string; description: string; path?: LocalizedPath; images?: string[] },
): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: OG_LOCALE[lang],
    alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    title: content.title,
    description: content.description,
    url: localePath(lang, pathFor(lang, content.path ?? "")),
    ...(content.images?.length && { images: content.images }),
  };
}

/** Search engines cut descriptions around 160 characters — cut on a word. */
export function metaDescription(text: string, max = 160): string {
  const clean = stripMarkdown(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]$/, "")}…`;
}

/** Fill `{key}` placeholders in a dictionary template. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}
