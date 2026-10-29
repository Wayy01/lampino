// JSON-LD builders (schema.org). Rendered through `<JsonLd>` on the pages that
// own the entity: the storefront layout carries the store + website nodes, the
// detail pages carry the product/service plus their breadcrumb trail.
//
// Everything here is derived from real data — nothing is invented to satisfy a
// "recommended" field, because invalid structured data costs more in Search
// Console than a missing optional property.
import { CURRENCY, SITE_NAME, SITE_URL, absoluteUrl, metaDescription } from "@/lib/seo";
import { localePath, productHref, rentalHref, type Locale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import type { ContactSettings, Product, RentalPackage } from "@/lib/types";
import type { ProductReviews } from "@/lib/data/reviews";

export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const availabilityUrl = (inStock: boolean) =>
  `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

const DAYS: Record<string, string> = {
  lun: "Monday", mar: "Tuesday", mie: "Wednesday", joi: "Thursday",
  vin: "Friday", sam: "Saturday", sâm: "Saturday", dum: "Sunday",
};
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * `OpeningHoursSpecification` from the admin's free-text Romanian hours
 * ("Lun-Vin: 9:00 - 18:00, Sâm: 10:00 - 14:00"). Returns nothing unless every
 * segment parses ("Weekend" and "Zilnic" are understood too) — wrong hours in
 * markup are worse than none.
 */
export function openingHours(text: string): JsonLdNode[] | undefined {
  const pad = (t: string) => t.padStart(5, "0");
  const specs: JsonLdNode[] = [];
  for (const part of text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const m = part
      .toLowerCase()
      .replace(/^weekend\b/, "sâm-dum")
      .replace(/^zilnic\b/, "lun-dum")
      .match(/^(\p{L}{3})\p{L}*\.?\s*(?:[-–]\s*(\p{L}{3})\p{L}*\.?)?\s*:?\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/u);
    const from = m && DAYS[m[1]];
    const to = m && (m[2] ? DAYS[m[2]] : from);
    if (!m || !from || !to) return undefined;
    const days = WEEK.slice(WEEK.indexOf(from), WEEK.indexOf(to) + 1);
    if (days.length === 0) return undefined;
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days.map((d) => `https://schema.org/${d}`),
      opens: pad(m[3]),
      closes: pad(m[4]),
    });
  }
  return specs.length ? specs : undefined;
}

/**
 * The shop itself. `Store` is a `LocalBusiness`, which is what a Moldovan
 * storefront with a physical address should be. Contact fields come from the
 * admin-managed `ContactSettings` row and are omitted when it isn't seeded.
 */
export function storeSchema(lang: Locale, contact: ContactSettings | null): JsonLdNode {
  const socials = contact
    ? [contact.facebookUrl, contact.instagramUrl, contact.tiktokUrl, contact.googleBusinessUrl].filter(Boolean)
    : [];
  // Hours are parsed from the Romanian field: day names there are predictable.
  const hours = contact ? openingHours(contact.businessHours_ro) : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl(localePath(lang)),
    logo: absoluteUrl("/icon.png"),
    image: absoluteUrl("/icon.png"),
    currenciesAccepted: CURRENCY,
    ...(contact && {
      telephone: contact.phone,
      email: contact.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: pick(lang, contact.address_ro, contact.address_ru),
        addressLocality: pick(lang, contact.city_ro, contact.city_ru),
        addressCountry: "MD",
      },
      areaServed: { "@type": "Country", name: "Moldova" },
      ...(contact.latitude !== null &&
        contact.longitude !== null && {
          geo: { "@type": "GeoCoordinates", latitude: contact.latitude, longitude: contact.longitude },
        }),
      ...(contact.googleBusinessUrl && { hasMap: contact.googleBusinessUrl }),
    }),
    ...(hours && { openingHoursSpecification: hours }),
    ...(socials.length > 0 && { sameAs: socials }),
  };
}

export function websiteSchema(lang: Locale, description: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl(localePath(lang)),
    name: SITE_NAME,
    description,
    inLanguage: lang,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** Breadcrumb trail; `path` is a locale-prefixed app path. */
export function breadcrumbSchema(
  items: { name: string; path: string }[],
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(items: readonly { q: string; a: string }[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * A product with its offer. Variants collapse into an `AggregateOffer` with the
 * real low/high range; a single-price product gets a plain `Offer`. Prices are
 * the ones the customer actually pays (reduced price wins), matching what the
 * page renders — Google flags mismatches between markup and visible price.
 */
/** The prices a customer can actually pay for a product (reduced wins), one per variant. */
export function productPrices(product: Product): number[] {
  return product.hasVariants && product.variants.length > 0
    ? product.variants.map((v) => v.reducedPrice ?? v.price)
    : [product.reducedPrice ?? product.price];
}

/** The product's offer: an `AggregateOffer` over its variants, else a plain `Offer`. */
function productOffer(product: Product, url: string): JsonLdNode {
  const hasVariants = product.hasVariants && product.variants.length > 0;
  const prices = productPrices(product);
  const inStock = hasVariants
    ? product.variants.some((v) => v.stock > 0)
    : product.stock > 0;

  return prices.length > 1
    ? {
        "@type": "AggregateOffer",
        url,
        priceCurrency: CURRENCY,
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        offerCount: prices.length,
        availability: availabilityUrl(inStock),
        itemCondition: "https://schema.org/NewCondition",
      }
    : {
        "@type": "Offer",
        url,
        priceCurrency: CURRENCY,
        price: prices[0],
        availability: availabilityUrl(inStock),
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@id": ORGANIZATION_ID },
      };
}

/**
 * `reviews` are the approved ones only. Rating markup appears only when there
 * is at least one — Google treats invented or self-serving ratings as spam.
 */
export function productSchema(
  product: Product,
  lang: Locale,
  reviews?: ProductReviews,
): JsonLdNode {
  const url = absoluteUrl(productHref(lang, product));
  const offers = productOffer(product, url);
  const rated = reviews && reviews.count > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: pick(lang, product.name_ro, product.name_ru),
    description: metaDescription(
      pick(lang, product.description_ro, product.description_ru),
      300,
    ),
    sku: `LMP-${product.id}`,
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(product.images.length > 0 && {
      image: product.images.map((i) => absoluteUrl(i.imageUrl)),
    }),
    ...(product.category && {
      category: pick(lang, product.category.name_ro, product.category.name_ru),
    }),
    offers,
    ...(rated && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviews.average,
        reviewCount: reviews.count,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.authorName },
        datePublished: r.createdAt.slice(0, 10),
        reviewBody: r.body,
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
    }),
  };
}

/**
 * Rental packages are a booked service, not stock on a shelf, so they're marked
 * up as `Service` with a starting-price offer rather than as a `Product` — a
 * `Product` without availability just earns Search Console warnings.
 */
export function rentalSchema(pkg: RentalPackage, lang: Locale): JsonLdNode {
  const url = absoluteUrl(rentalHref(lang, pkg));
  const prices = pkg.variants.length
    ? pkg.variants.map((v) => v.reducedPrice ?? v.price)
    : [pkg.reducedPrice ?? pkg.price];

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: pick(lang, pkg.title_ro, pkg.title_ru),
    description: metaDescription(
      pick(lang, pkg.description_ro, pkg.description_ru),
      300,
    ),
    serviceType: pkg.category
      ? pick(lang, pkg.category.name_ro, pkg.category.name_ru)
      : pick(lang, "Închiriere echipament de iluminat", "Аренда осветительного оборудования"),
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: "Moldova" },
    ...(pkg.images.length > 0 && {
      image: pkg.images.map((i) => absoluteUrl(i.imageUrl)),
    }),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: CURRENCY,
      price: Math.min(...prices),
    },
  };
}

/** Catalog listing — the products actually rendered, in the order shown. */
export function itemListSchema(
  items: { name: string; path: string }[],
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

/**
 * A category landing page: `CollectionPage` whose main entity is the list of
 * products shown on it, each with its URL, image and offer.
 */
export function collectionPageSchema(
  lang: Locale,
  page: { name: string; description: string; path: string; products: Product[] },
): JsonLdNode {
  const url = absoluteUrl(page.path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: page.name,
    description: page.description,
    inLanguage: lang,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: page.products.length,
      itemListElement: page.products.map((p, i) => {
        const productUrl = absoluteUrl(productHref(lang, p));
        return {
          "@type": "ListItem",
          position: i + 1,
          url: productUrl,
          item: {
            "@type": "Product",
            name: pick(lang, p.name_ro, p.name_ru),
            url: productUrl,
            ...(p.images[0] && { image: absoluteUrl(p.images[0].imageUrl) }),
            offers: productOffer(p, productUrl),
          },
        };
      }),
    },
  };
}
