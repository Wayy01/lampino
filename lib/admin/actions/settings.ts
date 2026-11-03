"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { langFromForm } from "@/lib/admin/i18n";
import { runFormAction } from "@/lib/admin/errors";
import { encryptSecret } from "@/lib/admin/crypto";

export type SettingsActionState = { ok?: boolean; error?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// A cleared input posts "", which `Number("")` turns into a valid 0 — so the
// empty case has to be caught before the numeric check or clearing "free
// delivery threshold" would silently mean "free delivery on every order".
function dec(fd: FormData, key: string, fallback: number): Prisma.Decimal {
  const raw = str(fd, key);
  if (raw === "") return new Prisma.Decimal(fallback);
  const value = Number(raw);
  return new Prisma.Decimal(Number.isFinite(value) && value >= 0 ? value : fallback);
}

function color(fd: FormData, key: string, fallback: string): string {
  const value = str(fd, key);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

// Non-negative integer fields (parcel weight in grams, dimensions in mm). Like
// `dec`, a cleared input posts "" and must fall back rather than become 0.
function int(fd: FormData, key: string, fallback: number): number {
  const raw = str(fd, key);
  if (raw === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

const revalidate = () => revalidatePath("/admin/[lang]/settings", "page");

/** A coordinate in ±`limit` degrees (comma decimals accepted), or null when blank/invalid. */
function coordinate(fd: FormData, key: string, limit: number): number | null {
  const raw = str(fd, key).replace(",", ".");
  const n = Number(raw);
  return raw && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export async function updateContact(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
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
      googleBusinessUrl: str(fd, "googleBusinessUrl"),
      latitude: coordinate(fd, "latitude", 90),
      longitude: coordinate(fd, "longitude", 180),
      isActive: fd.get("isActive") === "on",
    };

    // Same row the settings page loaded and the storefront shows.
    const existing = await prisma.contactSettings.findFirst({
      orderBy: [{ isActive: "desc" }, { id: "desc" }],
    });
    if (existing) {
      await prisma.contactSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.contactSettings.create({ data });
    }
    revalidate();
    return { ok: true };
  });
}

export async function updateDelivery(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
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
  });
}

// Keep in sync with ProductPageForm (a "use server" file can only export actions).
const PRODUCT_PERK_SLOTS = 4;

export async function updateProductPage(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const slots = Array.from({ length: PRODUCT_PERK_SLOTS }, (_, i) => i);
    // Positions are kept (blanks included) so RO and RU rows stay paired;
    // the storefront drops the blanks.
    const data = {
      perks_ro: slots.map((i) => str(fd, `perk_ro_${i}`).slice(0, 120)),
      perks_ru: slots.map((i) => str(fd, `perk_ru_${i}`).slice(0, 120)),
    };

    const existing = await prisma.productPageSettings.findFirst({ orderBy: { id: "asc" } });
    if (existing) {
      await prisma.productPageSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.productPageSettings.create({ data });
    }
    revalidate();
    return { ok: true };
  });
}

// Write-only encrypted secret: a `<field>Clear` checkbox wipes it, a pasted
// value is encrypted and stored, and a blank input leaves the existing
// ciphertext untouched (so re-saving the form never erases the key).
function writeOnlyKey(fd: FormData, field: string, current: string): string {
  if (fd.get(`${field}Clear`) === "on") return "";
  const raw = str(fd, field);
  return raw === "" ? current : encryptSecret(raw);
}

// Each courier has its own page + action, writing ONLY its own columns — sender
// identity and the default parcel are per-courier (Nova Post in g/mm, Fan
// Courier in kg/cm). An update touches no other courier's fields, so saving one
// integration never clobbers another's key or config.
export async function updateNovaPost(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const existing = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });
    const data = {
      novapostEnabled: fd.get("novapostEnabled") === "on",
      novapostSandbox: fd.get("novapostSandbox") === "on",
      novapostApiKey: writeOnlyKey(fd, "novapostApiKey", existing?.novapostApiKey ?? ""),
      novapostSenderCompanyTin: str(fd, "novapostSenderCompanyTin"),
      novapostSenderDivisionId: str(fd, "novapostSenderDivisionId"),
      novapostSenderDivisionName: str(fd, "novapostSenderDivisionName"),
      novapostSenderCountryCode: str(fd, "novapostSenderCountryCode") || "MD",
      novapostDefaultCategory: str(fd, "novapostDefaultCategory"),
      novapostSenderName: str(fd, "novapostSenderName"),
      novapostSenderPhone: str(fd, "novapostSenderPhone"),
      novapostSenderEmail: str(fd, "novapostSenderEmail"),
      novapostParcelWeightG: int(fd, "novapostParcelWeightG", 2000),
      novapostParcelLengthMm: int(fd, "novapostParcelLengthMm", 240),
      novapostParcelWidthMm: int(fd, "novapostParcelWidthMm", 160),
      novapostParcelHeightMm: int(fd, "novapostParcelHeightMm", 200),
      isActive: true,
    };
    if (existing) {
      await prisma.shippingSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.shippingSettings.create({ data });
    }
    revalidatePath("/admin/[lang]/integrations/nova-post", "page");
    return { ok: true };
  });
}

export async function updateFanCourier(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const existing = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });
    const data = {
      fancourierEnabled: fd.get("fancourierEnabled") === "on",
      fancourierApiKey: writeOnlyKey(fd, "fancourierApiKey", existing?.fancourierApiKey ?? ""),
      fancourierUseDefaultSender: fd.get("fancourierUseDefaultSender") === "on",
      fancourierServiceType: str(fd, "fancourierServiceType") || "standard",
      fancourierSenderCounty: str(fd, "fancourierSenderCounty"),
      fancourierSenderCity: str(fd, "fancourierSenderCity"),
      fancourierSenderStreet: str(fd, "fancourierSenderStreet"),
      fancourierSenderNr: str(fd, "fancourierSenderNr"),
      fancourierSenderZipcode: str(fd, "fancourierSenderZipcode"),
      fancourierDefaultCategory: str(fd, "fancourierDefaultCategory"),
      fancourierSenderName: str(fd, "fancourierSenderName"),
      fancourierSenderPhone: str(fd, "fancourierSenderPhone"),
      fancourierSenderEmail: str(fd, "fancourierSenderEmail"),
      fancourierParcelWeightKg: dec(fd, "fancourierParcelWeightKg", 1),
      fancourierParcelLengthCm: int(fd, "fancourierParcelLengthCm", 24),
      fancourierParcelWidthCm: int(fd, "fancourierParcelWidthCm", 16),
      fancourierParcelHeightCm: int(fd, "fancourierParcelHeightCm", 20),
      isActive: true,
    };
    if (existing) {
      await prisma.shippingSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.shippingSettings.create({ data });
    }
    revalidatePath("/admin/[lang]/integrations/fan-courier", "page");
    return { ok: true };
  });
}

export async function updateTheme(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
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
  });
}

export async function updateSpecialOffers(
  _prev: SettingsActionState,
  fd: FormData,
): Promise<SettingsActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const ids = (key: string) =>
      fd
        .getAll(key)
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v));

    const filterRaw = Number(str(fd, "filterByCategoryId"));
    const method =
      str(fd, "selectionMethod") === "category" ? "category" : "manual";

    // The form only renders the controls belonging to the active selection
    // method, so the other half posts nothing. Writing both halves every time
    // would erase whichever one is currently hidden.
    const selection =
      method === "category"
        ? {
            filterByCategoryId:
              Number.isInteger(filterRaw) && filterRaw > 0 ? filterRaw : null,
          }
        : {
            selectedProductIds: ids("selectedProductIds"),
            selectedRentalPackageIds: ids("selectedRentalPackageIds"),
          };

    const data = {
      title_ro: str(fd, "title_ro"),
      title_ru: str(fd, "title_ru"),
      description_ro: str(fd, "description_ro"),
      description_ru: str(fd, "description_ru"),
      mediaUrl: str(fd, "mediaUrl") || null,
      mediaType: str(fd, "mediaType") === "video" ? "video" : "image",
      selectionMethod: method,
      ...selection,
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
  });
}
