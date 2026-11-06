"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import { runAction, runFormAction, type ActionResult } from "@/lib/admin/errors";
import { shopDayBoundary } from "@/lib/promotions";

export type PromotionActionState = { ok?: boolean; error?: string } | null;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function numOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * `<input type="date">` posts `YYYY-MM-DD`. It is read as a calendar day in
 * the shop's timezone (Europe/Chisinau, DST-aware), not the server's, and the
 * end date covers its whole day, so a sale runs exactly the days entered.
 */
function dateOrNull(fd: FormData, key: string, edge: "start" | "end"): Date | null {
  return shopDayBoundary(str(fd, key), edge);
}

function ids(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0 && v <= 2_147_483_647);
}

type ParsedPromotion = {
  scalars: Omit<Prisma.PromotionUncheckedCreateInput, "id">;
  productIds: number[];
  rentalIds: number[];
};

function parsePromotion(fd: FormData): ParsedPromotion | { error: string } {
  const errors = getAdminDict(langFromForm(fd)).promotions.errors;
  const name_ro = str(fd, "name_ro");
  const name_ru = str(fd, "name_ru");
  if (!name_ro || !name_ru) return { error: errors.namesRequired };

  const startDate = dateOrNull(fd, "startDate", "start");
  const endDate = dateOrNull(fd, "endDate", "end");
  if (!startDate || !endDate) return { error: errors.datesRequired };
  // The end date runs to 23:59 of its own day, so a single-day promotion
  // (start === end) is valid; only an end *before* the start is rejected.
  if (endDate < startDate) return { error: errors.endBeforeStart };

  const discountPercent = numOrNull(fd, "discountPercent");
  if (discountPercent === null || discountPercent < 0 || discountPercent > 100) {
    return { error: errors.discountRange };
  }

  return {
    scalars: {
      name_ro,
      name_ru,
      description_ro: str(fd, "description_ro") || null,
      description_ru: str(fd, "description_ru") || null,
      startDate,
      endDate,
      discountPercent,
      featured: fd.get("featured") === "on",
    },
    productIds: ids(fd, "productIds"),
    rentalIds: ids(fd, "rentalIds"),
  };
}

/**
 * Membership is many-to-many: a product can be in any number of promotions
 * (one per campaign across the year), so saving one promotion never takes
 * products away from another. `set` replaces exactly this promotion's list.
 */
function members(productIds: number[], rentalIds: number[]) {
  return {
    products: { set: productIds.map((id) => ({ id })) },
    rentals: { set: rentalIds.map((id) => ({ id })) },
  };
}

/** Drop ids deleted in another tab instead of failing the whole save. */
async function existingIds(productIds: number[], rentalIds: number[]) {
  const [products, rentals] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } }),
    prisma.rentalPackage.findMany({ where: { id: { in: rentalIds } }, select: { id: true } }),
  ]);
  return { productIds: products.map((p) => p.id), rentalIds: rentals.map((r) => r.id) };
}

function revalidate(): void {
  revalidatePath("/admin/[lang]/promotions", "page");
  revalidatePath("/admin/[lang]/promotions/[id]", "page");
}

export async function createPromotion(
  _prev: PromotionActionState,
  fd: FormData,
): Promise<PromotionActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parsePromotion(fd);
    if ("error" in parsed) return { error: parsed.error };

    const ids = await existingIds(parsed.productIds, parsed.rentalIds);
    const promotion = await prisma.promotion.create({
      data: {
        ...parsed.scalars,
        products: { connect: ids.productIds.map((id) => ({ id })) },
        rentals: { connect: ids.rentalIds.map((id) => ({ id })) },
      },
    });

    revalidate();
    redirect(`/admin/${lang}/promotions/${promotion.id}`);
  });
}

export async function updatePromotion(
  id: number,
  _prev: PromotionActionState,
  fd: FormData,
): Promise<PromotionActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parsePromotion(fd);
    if ("error" in parsed) return { error: parsed.error };

    const ids = await existingIds(parsed.productIds, parsed.rentalIds);
    await prisma.promotion.update({
      where: { id },
      data: { ...parsed.scalars, ...members(ids.productIds, ids.rentalIds) },
    });

    revalidate();
    return { ok: true };
  });
}

export async function deletePromotion(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    // Join rows cascade; the products themselves are untouched.
    await prisma.promotion.delete({ where: { id } });
    revalidatePath("/admin/[lang]/promotions", "page");
    redirect(`/admin/${lang}/promotions`);
  });
}
