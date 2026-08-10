import { prisma } from "../prisma";
import type { ContactInfo } from "../types";

// The hero background video in production comes from the HeroContent row
// (left_media_url when its type is "video"). Returns null on any failure or
// when no video is set — the homepage then falls back to the bundled clip.
export async function getHeroVideoUrl(): Promise<string | null> {
  try {
    const hero = await prisma.heroContent.findFirst({
      where: { isActive: true },
    });
    if (!hero) return null;
    return hero.leftMediaType === "video" ? hero.leftMediaUrl : null;
  } catch {
    return null;
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
