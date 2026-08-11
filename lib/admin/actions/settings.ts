"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { langFromForm } from "@/lib/admin/i18n";

export type SettingsActionState = { ok?: boolean; error?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function dec(fd: FormData, key: string, fallback: number): Prisma.Decimal {
  const value = Number(str(fd, key));
  return new Prisma.Decimal(Number.isFinite(value) && value >= 0 ? value : fallback);
}

function color(fd: FormData, key: string, fallback: string): string {
  const value = str(fd, key);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

const revalidate = () => revalidatePath("/admin/[lang]/settings", "page");

export async function updateContact(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  await requireAdmin(langFromForm(fd));

  const data = {
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    whatsapp: str(fd, "whatsapp"),
    address_ro: str(fd, "address_ro"),
    address_ru: str(fd, "address_ru"),
    city_ro: str(fd, "city_ro"),
    city_ru: str(fd, "city_ru"),
    country_ro: str(fd, "country_ro"),
    country_ru: str(fd, "country_ru"),
    businessHours_ro: str(fd, "businessHours_ro"),
    businessHours_ru: str(fd, "businessHours_ru"),
    facebookUrl: str(fd, "facebookUrl"),
    instagramUrl: str(fd, "instagramUrl"),
    tiktokUrl: str(fd, "tiktokUrl"),
    isActive: fd.get("isActive") === "on",
  };

  const existing = await prisma.contactSettings.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.contactSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.contactSettings.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function updateDelivery(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  await requireAdmin(langFromForm(fd));

  const data = {
    freeDeliveryThreshold: dec(fd, "freeDeliveryThreshold", 1500),
    deliveryCostChisinau: dec(fd, "deliveryCostChisinau", 50),
    deliveryCostOutside: dec(fd, "deliveryCostOutside", 90),
    isActive: fd.get("isActive") === "on",
  };

  const existing = await prisma.deliverySettings.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.deliverySettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.deliverySettings.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function updateTheme(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  await requireAdmin(langFromForm(fd));

  const data = {
    colorPrimary: color(fd, "colorPrimary", "#3B82F6"),
    colorSecondary: color(fd, "colorSecondary", "#10B981"),
    colorTertiary: color(fd, "colorTertiary", "#F59E0B"),
    colorAccent: color(fd, "colorAccent", "#8B5CF6"),
    colorSuccess: color(fd, "colorSuccess", "#22C55E"),
    colorWarning: color(fd, "colorWarning", "#F97316"),
    colorError: color(fd, "colorError", "#EF4444"),
    colorInfo: color(fd, "colorInfo", "#06B6D4"),
    isActive: fd.get("isActive") === "on",
  };

  const existing = await prisma.themeSettings.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.themeSettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.themeSettings.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function updateSpecialOffers(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  await requireAdmin(langFromForm(fd));

  const ids = (key: string) =>
    fd
      .getAll(key)
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v));

  const filterRaw = Number(str(fd, "filterByCategoryId"));
  const data = {
    title_ro: str(fd, "title_ro"),
    title_ru: str(fd, "title_ru"),
    description_ro: str(fd, "description_ro"),
    description_ru: str(fd, "description_ru"),
    mediaUrl: str(fd, "mediaUrl") || null,
    mediaType: str(fd, "mediaType") === "video" ? "video" : "image",
    selectionMethod: str(fd, "selectionMethod") === "category" ? "category" : "manual",
    selectedProductIds: ids("selectedProductIds"),
    selectedRentalPackageIds: ids("selectedRentalPackageIds"),
    filterByCategoryId: Number.isInteger(filterRaw) && filterRaw > 0 ? filterRaw : null,
    isActive: fd.get("isActive") === "on",
  };

  const existing = await prisma.specialOffersPage.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    await prisma.specialOffersPage.update({ where: { id: existing.id }, data });
  } else {
    await prisma.specialOffersPage.create({ data });
  }
  revalidate();
  return { ok: true };
}
