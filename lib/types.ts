// Serializable view models mirroring the Prisma schema, but with `number`
// in place of `Decimal` and relations pre-included. Every one of these is
// produced by the lib/data/* layer from a real Prisma query, so components
// never see a `Decimal` and never touch `prisma` themselves.

export type Locale = "ro" | "ru";

export interface Category {
  id: number;
  name_ro: string;
  name_ru: string;
  slug: string;
  /** Admin overrides of the landing-page URL slug; empty = derived from the name. */
  urlSlug_ro: string;
  urlSlug_ru: string;
  position: number;
  imageUrl: string | null;
  productCount?: number;
}

export type FaqItem = { q: string; a: string };

/** Admin-written landing-page content for one language; empty strings = use the default. */
export interface CategoryLandingCopy {
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  /** Markdown subset (`lib/markdown.ts`). */
  body: string;
  faq: FaqItem[];
}

export interface CategoryLanding {
  ro: CategoryLandingCopy;
  ru: CategoryLandingCopy;
  ogImageUrl: string | null;
  updatedAt: string;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  isMain: boolean;
}

export interface ProductVideo {
  id: number;
  videoUrl: string;
  thumbnailUrl: string | null;
}

export interface ProductVariant {
  id: number;
  name_ro: string;
  name_ru: string;
  size: string | null;
  price: number;
  reducedPrice: number | null;
  stock: number;
  isDefault: boolean;
  sortOrder: number;
  /** Product image URLs shown for this variant; empty = all of them. */
  imageUrls: string[];
}

/**
 * A single bilingual specification, as stored in the `specifications` Json
 * column: `{ [id]: { label_ro, label_ru, value_ro, value_ru } }`. The data
 * layer normalizes every product/rental into this shape (legacy flat rows —
 * `{ [key]: "value" }` — are upgraded on read), so components only ever see it.
 */
export interface SpecEntry {
  label_ro: string;
  label_ru: string;
  value_ro: string;
  value_ru: string;
  /** Saved display order; legacy entries have none. See `specList`. */
  position?: number;
}

export type Specifications = Record<string, SpecEntry>;

/** The promotion currently applied to a product / rental (see lib/promotions.ts). */
export interface ActivePromotion {
  id: number;
  name_ro: string;
  name_ru: string;
  discountPercent: number;
  /** ISO instant the promotion ends (last millisecond of its last day). */
  endDate: string;
}

export interface Product {
  id: number;
  name_ro: string;
  name_ru: string;
  description_ro: string;
  description_ru: string;
  /** Admin alt text for the images; empty = name + category (`productImageAlt`). */
  imageAlt_ro: string;
  imageAlt_ru: string;
  price: number;
  reducedPrice: number | null;
  stock: number;
  hasVariants: boolean;
  specifications: Specifications;
  categoryId: number | null;
  category: Category | null;
  featured: boolean;
  featuredOrder: number;
  /** Position inside its category (admin drag order); the category page default sort. */
  categoryOrder: number;
  isActive: boolean;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: ProductVariant[];
  /** Running promotion already folded into every `reducedPrice`; null if none. */
  promotion: ActivePromotion | null;
}

/**
 * A catalog row reduced to what the sitemap needs: the id the URL is keyed on,
 * the Romanian name/title the decorative slug is built from, and a lastmod.
 */
export interface CatalogIndexEntry {
  id: number;
  /** Locale-less detail path per locale (slugs are translated). */
  paths: Record<Locale, string>;
  updatedAt: string;
  /** Absolute-or-site-relative image URLs, main image first, for the image sitemap. */
  images: string[];
  /** Products only: dates the category landing page in the sitemap. */
  categoryId?: number | null;
}

/** Category in display order; `slug` is the catalog's internal filter key (URLs use `categoryHref`). */
export interface CategoryOption {
  id: number;
  slug: string;
  name_ro: string;
  name_ru: string;
  urlSlug_ro: string;
  urlSlug_ru: string;
}

export interface RentalPackageVariant {
  id: number;
  name_ro: string;
  name_ru: string;
  size: string | null;
  price: number;
  reducedPrice: number | null;
  isDefault: boolean;
  sortOrder: number;
}

export interface RentalPackage {
  id: number;
  title_ro: string;
  title_ru: string;
  description_ro: string;
  description_ru: string;
  price: number;
  reducedPrice: number | null;
  hasVariants: boolean;
  specifications: Specifications;
  includes_ro: string[];
  includes_ru: string[];
  categoryId: number | null;
  category: Category | null;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: RentalPackageVariant[];
  /** Running promotion already folded into every `reducedPrice`; null if none. */
  promotion: ActivePromotion | null;
}

export type MediaType = "image" | "video";

/** A single gallery slide — an image or a self-hosted video. */
export interface MediaItem {
  type: MediaType;
  src: string;
  thumbnail?: string | null;
}

/** Minimal contact info surfaced on the product page (WhatsApp + phone). */
export interface ContactInfo {
  phone: string;
  whatsapp: string;
}

/** Delivery pricing, rendered in the cart and quoted in the WhatsApp order. */
export interface DeliverySettings {
  freeDeliveryThreshold: number;
  deliveryCostChisinau: number;
  deliveryCostOutside: number;
}

/** Palette overrides from `ThemeSettings`, injected as CSS variables. */
export interface ThemeSettings {
  colorPrimary: string;
  colorSecondary: string;
  colorTertiary: string;
  colorAccent: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;
  colorInfo: string;
}

export interface HeroContent {
  leftHeading_ro: string;
  leftHeading_ru: string;
  leftButtonText_ro: string;
  leftButtonText_ru: string;
  leftButtonUrl: string;
  leftImageUrl: string | null;
  rightImageUrl: string | null;
  // media_url / media_type from the DB — overrides the image when type is "video"
  leftMediaUrl: string | null;
  leftMediaType: MediaType;
  rightMediaUrl: string | null;
  rightMediaType: MediaType;
}

export interface HomepageSettings {
  welcomeHeading_ro: string;
  welcomeHeading_ru: string;
  welcomeDescription_ro: string;
  welcomeDescription_ru: string;
  welcomeButtonText_ro: string;
  welcomeButtonText_ru: string;
  welcomeButtonUrl: string;
  categoryHeading_ro: string;
  categoryHeading_ru: string;
  productHeading_ro: string;
  productHeading_ru: string;
  rentalHeading_ro: string;
  rentalHeading_ru: string;
}

/**
 * Resolved hero background media. The schema carries two media slots (left +
 * right); the hero shows a single background video, so the data layer picks the
 * best video for `videoUrl` and uses the other media as the `posterUrl`
 * fallback shown before/if the video can't play.
 */
export interface HeroMedia {
  videoUrl: string | null;
  posterUrl: string | null;
  heading_ro: string | null;
  heading_ru: string | null;
  buttonText_ro: string | null;
  buttonText_ru: string | null;
  buttonUrl: string | null;
}

export interface ContactSettings {
  phone: string;
  email: string;
  whatsapp: string;
  address_ro: string;
  address_ru: string;
  city_ro: string;
  city_ru: string;
  country_ro: string;
  country_ru: string;
  businessHours_ro: string;
  businessHours_ru: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  /** Google Business Profile link — listed in the Store markup's `sameAs`. */
  googleBusinessUrl: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PromoBanner {
  message_ro: string;
  message_ru: string;
  ctaText_ro: string;
  ctaText_ru: string;
  ctaLink: string;
  isActive: boolean;
  showOnDesktop: boolean;
  showOnMobile: boolean;
  backgroundColor: string;
  textColor: string;
}
