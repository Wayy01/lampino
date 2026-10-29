import type { MetadataRoute } from "next";
import { getCategoryOptions, getProductIndex } from "@/lib/data/products";
import { getRentalIndex } from "@/lib/data/rentals";
import { getSpecialOffersMeta } from "@/lib/data/offers";
import { absoluteUrl, hreflangs, type LocalizedPath } from "@/lib/seo";
import { LOCALES, categoryPaths } from "@/lib/i18n/routing";
import type { CatalogIndexEntry } from "@/lib/types";

// The catalog is admin-editable and every storefront page is `force-dynamic`,
// so the sitemap is built per request too: a product published at 10:00 shows
// up in the XML immediately, and `next build` never needs the database.
export const dynamic = "force-dynamic";

type Entry = MetadataRoute.Sitemap[number];

/**
 * One `<url>` per locale for the same page, each carrying the full hreflang set
 * (both locales plus `x-default`) — Google wants every language version listed
 * *and* cross-referencing all of its twins. Built from the same paths as the
 * pages' own canonicals (`localeAlternates`), so the two can never disagree.
 */
function localized(
  path: LocalizedPath,
  lastModified: string,
  changeFrequency: Entry["changeFrequency"],
  priority: number,
  images: string[] = [],
): MetadataRoute.Sitemap {
  const languages = hreflangs(path, absoluteUrl);
  return LOCALES.map((lang) => ({
    url: languages[lang],
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
    // Doubles as the image sitemap — the old separate `sitemap-images.xml`
    // now redirects here (next.config.ts).
    ...(images.length > 0 && { images: images.map(absoluteUrl) }),
  }));
}

/** Most recent `updatedAt` in a set — the lastmod for the page that lists it. */
function newest(rows: CatalogIndexEntry[], fallback: string): string {
  if (rows.length === 0) return fallback;
  return rows.reduce((latest, r) => (r.updatedAt > latest ? r.updatedAt : latest), rows[0].updatedAt);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, rentals, offers, categories] = await Promise.all([
    getProductIndex(),
    getRentalIndex(),
    getSpecialOffersMeta(),
    getCategoryOptions(),
  ]);

  const now = new Date().toISOString();
  const productsUpdated = newest(products, now);
  const rentalsUpdated = newest(rentals, now);

  return [
    ...localized("", productsUpdated, "daily", 1),
    ...localized("/magazin", productsUpdated, "daily", 0.9),
    // Only categories that list an active product — `getCategoryOptions` drops
    // the rest, and their URLs redirect to /magazin.
    ...categories.flatMap((c) =>
      localized(
        categoryPaths(c),
        newest(products.filter((p) => p.categoryId === c.id), productsUpdated),
        "daily",
        0.85,
      ),
    ),
    ...localized("/arenda", rentalsUpdated, "weekly", 0.8),
    ...(offers ? localized("/oferte-speciale", now, "weekly", 0.7) : []),
    ...localized("/contact", now, "yearly", 0.4),
    ...localized("/terms", now, "yearly", 0.2),
    ...localized("/privacy", now, "yearly", 0.2),
    ...products.flatMap((p) => localized(p.paths, p.updatedAt, "weekly", 0.8, p.images)),
    ...rentals.flatMap((r) => localized(r.paths, r.updatedAt, "monthly", 0.6, r.images)),
  ];
}
