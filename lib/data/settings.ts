import { prisma } from "../prisma";
import type { ContactInfo, HeroMedia } from "../types";

/**
 * Resolve the hero background media from the active `HeroContent` row. The
 * schema carries two media slots (left + right), but the hero renders a single
 * background video — so we pick the first available video for `videoUrl` and
 * use the other media (or a still image) as the poster fallback. Returns nulls
 * on any failure so the homepage falls back to the bundled clip.
 */
export async function getHeroMedia(): Promise<HeroMedia> {
  const empty: HeroMedia = {
    videoUrl: null,
    posterUrl: null,
    heading_ro: null,
    heading_ru: null,
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
    };
  } catch {
    return empty;
  }
}

// Contact details for the WhatsApp / Call-us actions. The DB may be unseeded
// (or unreachable in local mock mode), so failures resolve to `null` and the
// UI simply hides those buttons.
export async function getContactSettings(): Promise<ContactInfo | null> {
  try {
    const settings = await prisma.contactSettings.findFirst({
      where: { isActive: true },
    });
    if (!settings) return null;
    return { phone: settings.phone, whatsapp: settings.whatsapp };
  } catch {
    return null;
  }
}
