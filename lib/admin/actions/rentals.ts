"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import {
  adminDictionaries,
  getAdminDict,
  langFromForm,
  type AdminLang,
} from "@/lib/admin/i18n";
import {
  specsToJson,
  isEmptySpecRow,
  hasDuplicateSpecKeys,
  type SpecRow,
} from "@/lib/admin/specs";
import {
  idOrNull,
  isAllowedImageUrl,
  isAllowedVideoUrl,
} from "@/lib/admin/validate";
import { promotionLinks, relationsExist } from "@/lib/admin/relations";
import { includesToJson } from "@/lib/admin/includes";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";

export type RentalActionState = { ok?: boolean; error?: string } | null;

// Payload shapes serialized by the form's client-side editors into hidden
// JSON fields. Kept here so form and action can't drift apart.
export type ImagePayload = { imageUrl: string; isMain: boolean };
export type VideoPayload = { videoUrl: string; thumbnailUrl: string | null };
// Rental variants carry no stock — a package is booked by date, not counted.
export type VariantPayload = {
  id: number | null;
  name_ro: string;
  name_ru: string;
  size: string | null;
  /** null when the field was left blank — refused on save, never stored as 0. */
  price: number | null;
  reducedPrice: number | null;
  isDefault: boolean;
  sortOrder: number;
};

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function numOrNull(fd: FormData, key: string): number | null {
  const raw = str(fd, key);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// `price` columns are Decimal(10,2); anything larger is a Postgres
// `numeric field overflow` that escapes the action as an unhandled 500.
const MAX_MONEY = 99_999_999.99;
const overMoney = (n: number | null) => n !== null && (n < 0 || n > MAX_MONEY);

function json<T>(fd: FormData, key: string, fallback: T): T {
  try {
    return JSON.parse(String(fd.get(key) ?? "")) as T;
  } catch {
    return fallback;
  }
}

/** A hidden JSON field as an array of objects; anything else becomes `[]`. */
function jsonRows(fd: FormData, key: string): Record<string, unknown>[] {
  const parsed = json<unknown>(fd, key, []);
  return Array.isArray(parsed)
    ? parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    : [];
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const finiteOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

type ParsedRental = {
  scalars: Omit<
    Prisma.RentalPackageUncheckedCreateInput,
    "id" | "images" | "videos" | "variants" | "promotions"
  >;
  promotionIds: number[];
  images: ImagePayload[];
  videos: VideoPayload[];
  variants: VariantPayload[];
};

function parseRental(fd: FormData): ParsedRental | { error: string } {
  const errors = getAdminDict(langFromForm(fd)).rentals.errors;
  const title_ro = str(fd, "title_ro");
  const title_ru = str(fd, "title_ru");
  const price = numOrNull(fd, "price");
  if (!title_ro || !title_ru) return { error: errors.titlesRequired };
  if (price === null || price < 0) return { error: errors.priceRequired };

  const reducedPrice = numOrNull(fd, "reducedPrice");
  if (reducedPrice !== null && reducedPrice >= price) {
    return { error: errors.reducedBelowPrice };
  }
  if (overMoney(price) || overMoney(reducedPrice)) {
    return { error: errors.priceTooLarge };
  }

  const shared = getAdminDict(langFromForm(fd)).errors;
  const categoryId = numOrNull(fd, "categoryId");
  if (categoryId !== null && idOrNull(categoryId) === null) {
    return { error: shared.invalidNumber };
  }
  // Any number of promotions (one per campaign across the year).
  const promotionIds = [
    ...new Set(
      fd
        .getAll("promotionIds")
        .map((v) => idOrNull(Number(v)))
        .filter((v): v is number => v !== null),
    ),
  ];

  const specRows: SpecRow[] = jsonRows(fd, "specifications")
    .map((r) => ({
      id: text(r.id),
      label_ro: text(r.label_ro),
      label_ru: text(r.label_ru),
      value_ro: text(r.value_ro),
      value_ru: text(r.value_ru),
    }))
    .filter((row) => !isEmptySpecRow(row));
  if (hasDuplicateSpecKeys(specRows)) return { error: shared.duplicateSpecId };

  const images: ImagePayload[] = jsonRows(fd, "images")
    .map((r) => ({ imageUrl: text(r.imageUrl).trim(), isMain: r.isMain === true }))
    .filter((i) => i.imageUrl);
  const videos: VideoPayload[] = jsonRows(fd, "videos")
    .map((r) => ({
      videoUrl: text(r.videoUrl).trim(),
      thumbnailUrl: text(r.thumbnailUrl).trim() || null,
    }))
    .filter((v) => v.videoUrl);
  if (
    images.some((i) => !isAllowedImageUrl(i.imageUrl)) ||
    videos.some(
      (v) =>
        !isAllowedVideoUrl(v.videoUrl) ||
        (v.thumbnailUrl !== null && !isAllowedImageUrl(v.thumbnailUrl)),
    )
  ) {
    return { error: shared.invalidMediaUrl };
  }

  const variants: VariantPayload[] = jsonRows(fd, "variants")
    .map((r, i) => ({
      id: idOrNull(finiteOrNull(r.id)),
      name_ro: text(r.name_ro).trim(),
      name_ru: text(r.name_ru).trim(),
      size: text(r.size).trim() || null,
      price: finiteOrNull(r.price),
      reducedPrice: finiteOrNull(r.reducedPrice),
      isDefault: r.isDefault === true,
      sortOrder: i,
    }))
    .filter((v) => v.name_ro && v.name_ru);

  // Variants carry their own money and are just as capable of overflowing the
  // column or undercutting their own reduced price.
  for (const v of variants) {
    // A blank variant price used to be saved as 0 lei.
    if (v.price === null || v.price < 0) return { error: errors.priceRequired };
    if (overMoney(v.price) || overMoney(v.reducedPrice)) {
      return { error: errors.priceTooLarge };
    }
    if (v.reducedPrice !== null && v.reducedPrice >= v.price) {
      return { error: errors.reducedBelowPrice };
    }
  }

  return {
    scalars: {
      title_ro,
      title_ru,
      description_ro: str(fd, "description_ro"),
      description_ru: str(fd, "description_ru"),
      price: new Prisma.Decimal(price),
      reducedPrice: reducedPrice === null ? null : new Prisma.Decimal(reducedPrice),
      hasVariants: variants.length > 0,
      specifications: specsToJson(specRows),
      includes_ro: includesToJson(json<string[]>(fd, "includes_ro", [])),
      includes_ru: includesToJson(json<string[]>(fd, "includes_ru", [])),
      categoryId,
      isActive: fd.get("isActive") === "on",
    },
    promotionIds,
    images,
    videos,
    variants,
  };
}

const variantData = (v: VariantPayload) => ({
  name_ro: v.name_ro.trim(),
  name_ru: v.name_ru.trim(),
  size: v.size?.trim() || null,
  // Non-null by now: `parseRental` refuses a variant without a price.
  price: new Prisma.Decimal(v.price ?? 0),
  reducedPrice: v.reducedPrice === null ? null : new Prisma.Decimal(v.reducedPrice),
  isDefault: v.isDefault,
  sortOrder: v.sortOrder,
});

export async function createRental(
  _prev: RentalActionState,
  fd: FormData,
): Promise<RentalActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parseRental(fd);
    if ("error" in parsed) return { error: parsed.error };
    await relationsExist(parsed.scalars.categoryId);
    const promotions = await promotionLinks(parsed.promotionIds);

    const rental = await prisma.rentalPackage.create({
      data: {
        ...parsed.scalars,
        promotions: { connect: promotions },
        images: { create: parsed.images },
        videos: { create: parsed.videos },
        variants: { create: parsed.variants.map(variantData) },
      },
    });

    revalidatePath("/admin/[lang]/rentals", "page");
    redirect(`/admin/${lang}/rentals/${rental.id}`);
  });
}

export async function updateRental(
  id: number,
  _prev: RentalActionState,
  fd: FormData,
): Promise<RentalActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parseRental(fd);
    if ("error" in parsed) return { error: parsed.error };
    await relationsExist(parsed.scalars.categoryId);
    const promotions = await promotionLinks(parsed.promotionIds);

    const keptVariantIds = parsed.variants
      .map((v) => v.id)
      .filter((v): v is number => v !== null);

    await prisma.$transaction([
      // `deletedAt: null`: a stale tab must not resurrect a deleted rental.
      prisma.rentalPackage.update({
        where: { id, deletedAt: null },
        data: { ...parsed.scalars, promotions: { set: promotions } },
      }),
      // Images and videos carry no foreign keys — rebuild them wholesale.
      prisma.rentalPackageImage.deleteMany({ where: { rentalPackageId: id } }),
      prisma.rentalPackageImage.createMany({
        data: parsed.images.map((i) => ({ ...i, rentalPackageId: id })),
      }),
      prisma.rentalPackageVideo.deleteMany({ where: { rentalPackageId: id } }),
      prisma.rentalPackageVideo.createMany({
        data: parsed.videos.map((v) => ({ ...v, rentalPackageId: id })),
      }),
      // Variants are referenced by order items and rental applications, so
      // update in place where possible.
      prisma.rentalPackageVariant.deleteMany({
        where: { rentalPackageId: id, id: { notIn: keptVariantIds } },
      }),
      ...parsed.variants.map((v) =>
        v.id === null
          ? prisma.rentalPackageVariant.create({
              data: { ...variantData(v), rentalPackageId: id },
            })
          : // Scoped to this package so a stale variant id from another tab
            // matches nothing instead of rolling back the whole transaction.
            prisma.rentalPackageVariant.updateMany({
              where: { id: v.id, rentalPackageId: id },
              data: variantData(v),
            }),
      ),
    ]);

    revalidatePath("/admin/[lang]/rentals", "page");
    revalidatePath("/admin/[lang]/rentals/[id]", "page");
    return { ok: true };
  });
}

export async function deleteRental(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await softDeleteRental(id);
    revalidatePath("/admin/[lang]/rentals", "page");
    redirect(`/admin/${lang}/rentals`);
  });
}

/**
 * "Delete" hides the package for good but keeps the row: its URL keeps
 * redirecting to /arenda instead of 404ing, and the customer applications that
 * cascade with it in the schema are never lost.
 */
async function softDeleteRental(id: number): Promise<void> {
  await prisma.rentalPackage.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Row actions — the `⋯` menu on the rentals table.
// ---------------------------------------------------------------------------

function revalidateRentals(): void {
  revalidatePath("/admin/[lang]/rentals", "page");
  revalidatePath("/admin/[lang]/rentals/[id]", "page");
}

export async function setRentalActive(
  lang: AdminLang,
  id: number,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.rentalPackage.update({ where: { id, deletedAt: null }, data: { isActive } });
    revalidateRentals();
  });
}

/** Delete from the list — same as `deleteRental` minus the redirect. */
export async function removeRental(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await softDeleteRental(id);
    revalidateRentals();
  });
}

/**
 * Copy a package with its images, videos and variants, then open the copy.
 * Rental applications are never copied — they belong to the original booking.
 */
export async function duplicateRental(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    const source = await prisma.rentalPackage.findUnique({
      where: { id },
      include: {
        images: { orderBy: { id: "asc" } },
        videos: { orderBy: { id: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        promotions: { select: { id: true } },
      },
    });
    if (!source) throw new ActionRefusal("sourceMissing");

    const copy = await prisma.rentalPackage.create({
      data: {
        title_ro: `${source.title_ro} ${adminDictionaries.ro.common.copySuffix}`,
        title_ru: `${source.title_ru} ${adminDictionaries.ru.common.copySuffix}`,
        description_ro: source.description_ro,
        description_ru: source.description_ru,
        price: source.price,
        reducedPrice: source.reducedPrice,
        hasVariants: source.hasVariants,
        specifications: (source.specifications ?? {}) as Prisma.InputJsonValue,
        includes_ro: (source.includes_ro ?? []) as Prisma.InputJsonValue,
        includes_ru: (source.includes_ru ?? []) as Prisma.InputJsonValue,
        categoryId: source.categoryId,
        promotions: { connect: source.promotions.map((p) => ({ id: p.id })) },
        isActive: false,
        images: {
          create: source.images.map((i) => ({
            imageUrl: i.imageUrl,
            isMain: i.isMain,
          })),
        },
        videos: {
          create: source.videos.map((v) => ({
            videoUrl: v.videoUrl,
            thumbnailUrl: v.thumbnailUrl,
          })),
        },
        variants: {
          create: source.variants.map((v) => ({
            name_ro: v.name_ro,
            name_ru: v.name_ru,
            size: v.size,
            price: v.price,
            reducedPrice: v.reducedPrice,
            isDefault: v.isDefault,
            sortOrder: v.sortOrder,
          })),
        },
      },
    });

    revalidateRentals();
    redirect(`/admin/${lang}/rentals/${copy.id}`);
  });
}
