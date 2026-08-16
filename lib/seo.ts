// Site-wide SEO primitives: the canonical origin, the hreflang block every
// public page repeats, and the small formatting helpers metadata needs.
// `metadataBase` is set once in the storefront layout, so the `alternates`
// returned here stay relative and Next resolves them to absolute URLs.
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/lib/i18n/routing";

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
 * Canonical + hreflang block for a locale-less path (`""` for the home page,
 * `"/magazin"`, `"/product/12/bec-led"`). Google wants both localized twins
 * *and* an `x-default` on every page, pointing at the default locale.
 */
export function localeAlternates(lang: Locale, path = ""): Metadata["alternates"] {
  return {
    canonical: localePath(lang, path),
    languages: {
      ro: localePath("ro", path),
      ru: localePath("ru", path),
      "x-default": localePath(DEFAULT_LOCALE, path),
    },
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
  content: { title: string; description: string; path?: string; images?: string[] },
): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: OG_LOCALE[lang],
    alternateLocale: LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
    title: content.title,
    description: content.description,
    url: localePath(lang, content.path ?? ""),
    ...(content.images?.length && { images: content.images }),
  };
}

/** Search engines cut descriptions around 160 characters — cut on a word. */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:—-]$/, "")}…`;
}
