"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";

export type HomepageActionState = { ok?: boolean; error?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function strOrNull(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}

function intOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

export async function updateHero(
  _prev: HomepageActionState,
  fd: FormData,
): Promise<HomepageActionState> {
  await requireAdmin(langFromForm(fd));

  const data = {
    leftHeading_ro: str(fd, "leftHeading_ro"),
    leftHeading_ru: str(fd, "leftHeading_ru"),
    leftButtonText_ro: str(fd, "leftButtonText_ro"),
    leftButtonText_ru: str(fd, "leftButtonText_ru"),
    leftButtonUrl: str(fd, "leftButtonUrl") || "/magazin",
    leftImageUrl: strOrNull(fd, "leftImageUrl"),
    rightImageUrl: strOrNull(fd, "rightImageUrl"),
    leftMediaUrl: strOrNull(fd, "leftMediaUrl"),
    leftMediaType: str(fd, "leftMediaType") === "video" ? "video" : "image",
    rightMediaUrl: strOrNull(fd, "rightMediaUrl"),
    rightMediaType: str(fd, "rightMediaType") === "video" ? "video" : "image",
    isActive: fd.get("isActive") === "on",
  };
  if (!data.leftHeading_ro || !data.leftHeading_ru) {
    return { error: getAdminDict(langFromForm(fd)).homepage.errors.headingsRequired };
  }

  const existing = await prisma.heroContent.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.heroContent.update({ where: { id: existing.id }, data });
  } else {
    await prisma.heroContent.create({ data });
  }

  revalidatePath("/admin/[lang]/homepage", "page");
  return { ok: true };
}

export async function updateHomepage(
  _prev: HomepageActionState,
  fd: FormData,
): Promise<HomepageActionState> {
  await requireAdmin(langFromForm(fd));

  const featuredCategoryIds = fd
    .getAll("featuredCategoryIds")
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v));

  const data = {
    featuredCategoryIds,
    maxCategories: intOrNull(fd, "maxCategories") ?? 3,
    featuredProductsCategoryId: intOrNull(fd, "featuredProductsCategoryId"),
    featuredRentalsCategoryId: intOrNull(fd, "featuredRentalsCategoryId"),
    isActive: fd.get("isActive") === "on",
    welcomeHeading_ro: str(fd, "welcomeHeading_ro"),
    welcomeHeading_ru: str(fd, "welcomeHeading_ru"),
    welcomeDescription_ro: str(fd, "welcomeDescription_ro"),
    welcomeDescription_ru: str(fd, "welcomeDescription_ru"),
    welcomeButtonText_ro: str(fd, "welcomeButtonText_ro"),
    welcomeButtonText_ru: str(fd, "welcomeButtonText_ru"),
    welcomeButtonUrl: str(fd, "welcomeButtonUrl") || "/magazin",
    categoryHeading_ro: str(fd, "categoryHeading_ro"),
    categoryHeading_ru: str(fd, "categoryHeading_ru"),
    productHeading_ro: str(fd, "productHeading_ro"),
    productHeading_ru: str(fd, "productHeading_ru"),
    rentalHeading_ro: str(fd, "rentalHeading_ro"),
    rentalHeading_ru: str(fd, "rentalHeading_ru"),
  };
  if (!data.welcomeHeading_ro || !data.welcomeHeading_ru) {
    return { error: getAdminDict(langFromForm(fd)).homepage.errors.headingsRequired };
  }

  const existing = await prisma.homepageSettings.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.homepageSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.homepageSettings.create({ data });
  }

  revalidatePath("/admin/[lang]/homepage", "page");
  return { ok: true };
}

export async function updateBanner(
  _prev: HomepageActionState,
  fd: FormData,
): Promise<HomepageActionState> {
  await requireAdmin(langFromForm(fd));

  const data = {
    message_ro: str(fd, "message_ro"),
    message_ru: str(fd, "message_ru"),
    ctaText_ro: str(fd, "ctaText_ro"),
    ctaText_ru: str(fd, "ctaText_ru"),
    ctaLink: str(fd, "ctaLink") || "/oferte-speciale",
    isActive: fd.get("isActive") === "on",
    showOnDesktop: fd.get("showOnDesktop") === "on",
    showOnMobile: fd.get("showOnMobile") === "on",
    backgroundColor: str(fd, "backgroundColor") || "#000000",
    textColor: str(fd, "textColor") || "#FFFFFF",
  };
  if (!data.message_ro || !data.message_ru) {
    return { error: getAdminDict(langFromForm(fd)).homepage.errors.messagesRequired };
  }

  const existing = await prisma.promoBanner.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.promoBanner.update({ where: { id: existing.id }, data });
  } else {
    await prisma.promoBanner.create({ data });
  }

  revalidatePath("/admin/[lang]/homepage", "page");
  return { ok: true };
}
