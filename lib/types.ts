// Serializable view models mirroring the Prisma schema, but with `number`
// in place of `Decimal` and relations pre-included. The lib/data/* layer
// returns these shapes today from mock data and will return the same shapes
// from real Prisma queries later — so components never change.

export type Locale = "ro" | "ru";

export interface Category {
  id: number;
  name_ro: string;
  name_ru: string;
  slug: string;
  position: number;
  imageUrl: string | null;
  productCount?: number;
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
}

export interface Product {
  id: number;
  name_ro: string;
  name_ru: string;
  description_ro: string;
  description_ru: string;
  price: number;
  reducedPrice: number | null;
  stock: number;
  hasVariants: boolean;
  specifications: Record<string, string>;
  categoryId: number | null;
  category: Category | null;
  featured: boolean;
  featuredOrder: number;
  isActive: boolean;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: ProductVariant[];
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
  specifications: Record<string, string>;
  includes_ro: string[];
  includes_ru: string[];
  categoryId: number | null;
  category: Category | null;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: RentalPackageVariant[];
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
}

export interface PromoBanner {
  message_ro: string;
  message_ru: string;
  ctaText_ro: string;
  ctaText_ru: string;
  ctaLink: string;
  isActive: boolean;
}
