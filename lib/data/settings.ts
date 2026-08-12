import { prisma } from "../prisma";
import type {
  ContactSettings,
  DeliverySettings,
  HeroMedia,
  HomepageSettings,
  PromoBanner,
  ThemeSettings,
} from "../types";

/**
 * Resolve the hero from the active `HeroContent` row: the background media plus
 * the admin-authored heading and call-to-action. The schema carries two media
 * slots (left + right), but the hero renders a single background video — so we
 * pick the first available video for `videoUrl` and use the other media (or a
 * still image) as the poster fallback. Returns nulls on any failure so the
 * homepage falls back to the bundled clip and its dictionary copy.
 */
export async function getHeroMedia(): Promise<HeroMedia> {
  const empty: HeroMedia = {
    videoUrl: null,
    posterUrl: null,
    heading_ro: null,
    heading_ru: null,
    buttonText_ro: null,
    buttonText_ru: null,
    buttonUrl: null,
  };
  try {
    const hero = await prisma.heroContent.findFirst({ where: { isActive: true } });
    if (!hero) return empty;

    const media = [
      { url: hero.leftMediaUrl, type: hero.leftMediaType },
      { url: hero.rightMediaUrl, type: hero.rightMediaType },
    ];

    const videoUrl =
      media.find((m) => m.type === "video" && m.url)?.url ?? null;
    const posterUrl =
      media.find((m) => m.type === "image" && m.url)?.url ??
      hero.leftImageUrl ??
      hero.rightImageUrl ??
      null;

    return {
      videoUrl,
      posterUrl,
      heading_ro: hero.leftHeading_ro || null,
      heading_ru: hero.leftHeading_ru || null,
      buttonText_ro: hero.leftButtonText_ro || null,
      buttonText_ru: hero.leftButtonText_ru || null,
      buttonUrl: hero.leftButtonUrl || null,
    };
  } catch {
    return empty;
  }
}

// Contact details for the footer, the WhatsApp / Call-us actions and the legal
// pages. The DB may be unseeded, so failures resolve to `null` and the UI
// simply hides those blocks.
export async function getContactSettings(): Promise<ContactSettings | null> {
  try {
    const s = await prisma.contactSettings.findFirst({ where: { isActive: true } });
    if (!s) return null;
    return {
      phone: s.phone,
      email: s.email,
      whatsapp: s.whatsapp,
      address_ro: s.address_ro,
      address_ru: s.address_ru,
      city_ro: s.city_ro,
      city_ru: s.city_ru,
      country_ro: s.country_ro,
      country_ru: s.country_ru,
      businessHours_ro: s.businessHours_ro,
      businessHours_ru: s.businessHours_ru,
      facebookUrl: s.facebookUrl,
      instagramUrl: s.instagramUrl,
      tiktokUrl: s.tiktokUrl,
    };
  } catch {
    return null;
  }
}

/** Admin-authored headings and welcome block for the homepage / rentals page. */
export async function getHomepageSettings(): Promise<HomepageSettings | null> {
  try {
    const s = await prisma.homepageSettings.findFirst({ where: { isActive: true } });
    if (!s) return null;
    return {
      welcomeHeading_ro: s.welcomeHeading_ro,
      welcomeHeading_ru: s.welcomeHeading_ru,
      welcomeDescription_ro: s.welcomeDescription_ro,
      welcomeDescription_ru: s.welcomeDescription_ru,
      welcomeButtonText_ro: s.welcomeButtonText_ro,
      welcomeButtonText_ru: s.welcomeButtonText_ru,
      welcomeButtonUrl: s.welcomeButtonUrl,
      categoryHeading_ro: s.categoryHeading_ro,
      categoryHeading_ru: s.categoryHeading_ru,
      productHeading_ro: s.productHeading_ro,
      productHeading_ru: s.productHeading_ru,
      rentalHeading_ro: s.rentalHeading_ro,
      rentalHeading_ru: s.rentalHeading_ru,
    };
  } catch {
    return null;
  }
}

/** Delivery pricing shown in the cart and sent with the WhatsApp order. */
export async function getDeliverySettings(): Promise<DeliverySettings | null> {
  try {
    const s = await prisma.deliverySettings.findFirst({ where: { isActive: true } });
    if (!s) return null;
    return {
      freeDeliveryThreshold: Number(s.freeDeliveryThreshold),
      deliveryCostChisinau: Number(s.deliveryCostChisinau),
      deliveryCostOutside: Number(s.deliveryCostOutside),
    };
  } catch {
    return null;
  }
}

/** The announcement bar above the navbar. `null` when the admin disabled it. */
export async function getPromoBanner(): Promise<PromoBanner | null> {
  try {
    const b = await prisma.promoBanner.findFirst({ where: { isActive: true } });
    if (!b) return null;
    return {
      message_ro: b.message_ro,
      message_ru: b.message_ru,
      ctaText_ro: b.ctaText_ro,
      ctaText_ru: b.ctaText_ru,
      ctaLink: b.ctaLink,
      isActive: b.isActive,
      showOnDesktop: b.showOnDesktop,
      showOnMobile: b.showOnMobile,
      backgroundColor: b.backgroundColor,
      textColor: b.textColor,
    };
  } catch {
    return null;
  }
}

/** Palette overrides injected as CSS variables by the storefront layout. */
export async function getThemeSettings(): Promise<ThemeSettings | null> {
  try {
    const t = await prisma.themeSettings.findFirst({ where: { isActive: true } });
    if (!t) return null;
    return {
      colorPrimary: t.colorPrimary,
      colorSecondary: t.colorSecondary,
      colorTertiary: t.colorTertiary,
      colorAccent: t.colorAccent,
      colorSuccess: t.colorSuccess,
      colorWarning: t.colorWarning,
      colorError: t.colorError,
      colorInfo: t.colorInfo,
    };
  } catch {
    return null;
  }
}
