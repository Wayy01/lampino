"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";

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
 * `<input type="date">` posts `YYYY-MM-DD`, which `new Date()` reads as UTC
 * midnight — east of Greenwich that lands *inside* the previous local day, so a
 * promotion would expire hours before its stated last date. Parse the parts
 * explicitly instead, and let the end date cover its whole day.
 */
function dateOrNull(
  fd: FormData,
  key: string,
  edge: "start" | "end" = "start",
): Date | null {
  const raw = str(fd, key);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const value =
    edge === "start"
      ? new Date(y, m - 1, d, 0, 0, 0, 0)
      : new Date(y, m - 1, d, 23, 59, 59, 999);
  return Number.isNaN(value.getTime()) ? null : value;
}

function ids(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v));
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
 * Products and rental packages point at the promotion, so membership is
 * rewritten from both ends: drop the rows that were unchecked, claim the
 * checked ones (including any stolen from another promotion).
 */
function assignmentOps(id: number, productIds: number[], rentalIds: number[]) {
  return [
    prisma.product.updateMany({
      where: { promotionId: id, id: { notIn: productIds } },
      data: { promotionId: null },
    }),
    prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { promotionId: id },
    }),
    prisma.rentalPackage.updateMany({
      where: { promotionId: id, id: { notIn: rentalIds } },
      data: { promotionId: null },
    }),
    prisma.rentalPackage.updateMany({
      where: { id: { in: rentalIds } },
      data: { promotionId: id },
    }),
  ];
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
  const parsed = parsePromotion(fd);
  if ("error" in parsed) return { error: parsed.error };

  const promotion = await prisma.promotion.create({ data: parsed.scalars });
  // Assignments need the new id, so they follow the insert.
  await prisma.$transaction(
    assignmentOps(promotion.id, parsed.productIds, parsed.rentalIds),
  );

  revalidate();
  redirect(`/admin/${lang}/promotions/${promotion.id}`);
}

export async function updatePromotion(
  id: number,
  _prev: PromotionActionState,
  fd: FormData,
): Promise<PromotionActionState> {
  await requireAdmin(langFromForm(fd));
  const parsed = parsePromotion(fd);
  if ("error" in parsed) return { error: parsed.error };

  await prisma.$transaction([
    prisma.promotion.update({ where: { id }, data: parsed.scalars }),
    ...assignmentOps(id, parsed.productIds, parsed.rentalIds),
  ]);

  revalidate();
  return { ok: true };
}

export async function deletePromotion(
  lang: AdminLang,
  id: number,
): Promise<void> {
  await requireAdmin(lang);
  await prisma.$transaction([
    ...assignmentOps(id, [], []),
    prisma.promotion.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/[lang]/promotions", "page");
  redirect(`/admin/${lang}/promotions`);
}
