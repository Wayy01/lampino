import type { MetadataRoute } from "next";
import { getProductIndex } from "@/lib/data/products";
import { getRentalIndex } from "@/lib/data/rentals";
import { getSpecialOffersMeta } from "@/lib/data/offers";
import { absoluteUrl } from "@/lib/seo";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localePath,
  productPath,
  rentalPath,
} from "@/lib/i18n/routing";
import type { CatalogIndexEntry } from "@/lib/types";

// The catalog is admin-editable and every storefront page is `force-dynamic`,
// so the sitemap is built per request too: a product published at 10:00 shows
// up in the XML immediately, and `next build` never needs the database.
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/**
 * One `<url>` per locale for the same page, each carrying the full hreflang set
 * (both locales plus `x-default`) — Google wants every language version listed
 * *and* cross-referencing all of its twins. `path` is locale-less.
 */
function localized(
  path: string,
  lastModified: string,
  changeFrequency: Entry["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap {
  const languages = {
    ro: absoluteUrl(localePath("ro", path)),
    ru: absoluteUrl(localePath("ru", path)),
    "x-default": absoluteUrl(localePath(DEFAULT_LOCALE, path)),
  };
  return LOCALES.map((lang) => ({
    url: absoluteUrl(localePath(lang, path)),
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

/** Most recent `updatedAt` in a set — the lastmod for the page that lists it. */
function newest(rows: CatalogIndexEntry[], fallback: string): string {
  if (rows.length === 0) return fallback;
  return rows.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), rows[0].updatedAt);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, rentals, offers] = await Promise.all([
    getProductIndex(),
    getRentalIndex(),
    getSpecialOffersMeta(),
  ]);

  const now = new Date().toISOString();
  const productsUpdated = newest(products, now);
  const rentalsUpdated = newest(rentals, now);

  return [
    ...localized("", productsUpdated, "daily", 1),
    ...localized("/magazin", productsUpdated, "daily", 0.9),
    ...localized("/arenda", rentalsUpdated, "weekly", 0.8),
    ...(offers ? localized("/oferte-speciale", now, "weekly", 0.7) : []),
    ...localized("/contact", now, "yearly", 0.4),
    ...localized("/terms", now, "yearly", 0.2),
    ...localized("/privacy", now, "yearly", 0.2),
    ...products.flatMap((p) =>
      localized(productPath(p.id, p.slugSource), p.updatedAt, "weekly", 0.8),
    ),
    ...rentals.flatMap((r) =>
      localized(rentalPath(r.id, r.slugSource), r.updatedAt, "monthly", 0.6),
    ),
  ];
}
