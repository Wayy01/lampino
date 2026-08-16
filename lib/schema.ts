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

export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const availabilityUrl = (inStock: boolean) =>
  `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

/**
 * The shop itself. `Store` is a `LocalBusiness`, which is what a Moldovan
 * storefront with a physical address should be. Contact fields come from the
 * admin-managed `ContactSettings` row and are omitted when it isn't seeded.
 */
export function storeSchema(lang: Locale, contact: ContactSettings | null): JsonLdNode {
  const socials = contact
    ? [contact.facebookUrl, contact.instagramUrl, contact.tiktokUrl].filter(Boolean)
    : [];

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl(localePath(lang)),
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/icon.svg"),
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
    }),
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
export function productSchema(product: Product, lang: Locale): JsonLdNode {
  const url = absoluteUrl(productHref(lang, product.id, product.name_ro));
  const hasVariants = product.hasVariants && product.variants.length > 0;
  const prices = hasVariants
    ? product.variants.map((v) => v.reducedPrice ?? v.price)
    : [product.reducedPrice ?? product.price];
  const inStock = hasVariants
    ? product.variants.some((v) => v.stock > 0)
    : product.stock > 0;

  const offers =
    prices.length > 1
      ? {
          "@type": "AggregateOffer",
          url,
          priceCurrency: CURRENCY,
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: prices.length,
          availability: availabilityUrl(inStock),
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
  };
}

/**
 * Rental packages are a booked service, not stock on a shelf, so they're marked
 * up as `Service` with a starting-price offer rather than as a `Product` — a
 * `Product` without availability just earns Search Console warnings.
 */
export function rentalSchema(pkg: RentalPackage, lang: Locale): JsonLdNode {
  const url = absoluteUrl(rentalHref(lang, pkg.id, pkg.title_ro));
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
