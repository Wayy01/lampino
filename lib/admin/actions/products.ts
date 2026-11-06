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
  isIntInRange,
} from "@/lib/admin/validate";
import { promotionLinks, relationsExist } from "@/lib/admin/relations";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";

export type ProductActionState = { ok?: boolean; error?: string } | null;

// Payload shapes serialized by the form's client-side editors into hidden
// JSON fields. Kept here so form and action can't drift apart.
export type ImagePayload = { imageUrl: string; isMain: boolean };
export type VideoPayload = { videoUrl: string; thumbnailUrl: string | null };
export type VariantPayload = {
  id: number | null;
  name_ro: string;
  name_ru: string;
  size: string | null;
  /** null when the field was left blank — refused on save, never stored as 0. */
  price: number | null;
  reducedPrice: number | null;
  stock: number;
  isDefault: boolean;
  sortOrder: number;
  /** Subset of the product's image URLs; empty = the variant shows them all. */
  imageUrls: string[];
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

/** A hidden JSON field as an array of objects; anything else becomes `[]`. */
function jsonRows(fd: FormData, key: string): Record<string, unknown>[] {
  try {
    const parsed: unknown = JSON.parse(String(fd.get(key) ?? ""));
    return Array.isArray(parsed)
      ? parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      : [];
  } catch {
    return [];
  }
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const finiteOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

type ParsedProduct = {
  scalars: Omit<Prisma.ProductUncheckedCreateInput, "id" | "images" | "videos" | "variants" | "promotions">;
  promotionIds: number[];
  images: ImagePayload[];
  videos: VideoPayload[];
  variants: VariantPayload[];
};

function parseProduct(fd: FormData): ParsedProduct | { error: string } {
  const errors = getAdminDict(langFromForm(fd)).products.errors;
  const name_ro = str(fd, "name_ro");
  const name_ru = str(fd, "name_ru");
  const price = numOrNull(fd, "price");
  if (!name_ro || !name_ru) return { error: errors.namesRequired };
  if (price === null || price < 0) return { error: errors.priceRequired };

  const reducedPrice = numOrNull(fd, "reducedPrice");
  if (reducedPrice !== null && reducedPrice >= price) {
    return { error: errors.reducedBelowPrice };
  }
  if (overMoney(price) || overMoney(reducedPrice)) {
    return { error: errors.priceTooLarge };
  }

  const stock = numOrNull(fd, "stock") ?? 0;
  if (!isIntInRange(stock)) {
    return { error: errors.stockInvalid };
  }
  const shared = getAdminDict(langFromForm(fd)).errors;
  const featuredOrder = numOrNull(fd, "featuredOrder") ?? 0;
  if (!isIntInRange(featuredOrder)) return { error: shared.invalidNumber };
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
      stock: finiteOrNull(r.stock) ?? 0,
      isDefault: r.isDefault === true,
      sortOrder: i,
      // Only URLs that are still product images; a removed image drops out.
      imageUrls: Array.isArray(r.imageUrls)
        ? [...new Set(r.imageUrls.filter((u): u is string => typeof u === "string"))].filter(
            (u) => images.some((img) => img.imageUrl === u),
          )
        : [],
    }))
    .filter((v) => v.name_ro && v.name_ru);

  // Variants carry their own money and stock, and are just as capable of
  // overflowing the column or undercutting their own reduced price.
  for (const v of variants) {
    // A blank variant price used to be saved as 0 lei and sold for free.
    if (v.price === null || v.price < 0) return { error: errors.priceRequired };
    if (overMoney(v.price) || overMoney(v.reducedPrice)) {
      return { error: errors.priceTooLarge };
    }
    if (v.reducedPrice !== null && v.reducedPrice >= v.price) {
      return { error: errors.reducedBelowPrice };
    }
    if (!isIntInRange(v.stock)) {
      return { error: errors.stockInvalid };
    }
  }

  return {
    scalars: {
      name_ro,
      name_ru,
      description_ro: str(fd, "description_ro"),
      description_ru: str(fd, "description_ru"),
      imageAlt_ro: str(fd, "imageAlt_ro").trim(),
      imageAlt_ru: str(fd, "imageAlt_ru").trim(),
      price: new Prisma.Decimal(price),
      reducedPrice: reducedPrice === null ? null : new Prisma.Decimal(reducedPrice),
      stock,
      hasVariants: variants.length > 0,
      specifications: specsToJson(specRows),
      categoryId,
      featured: fd.get("featured") === "on",
      featuredOrder,
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
  // Non-null by now: `parseProduct` refuses a variant without a price.
  price: new Prisma.Decimal(v.price ?? 0),
  reducedPrice: v.reducedPrice === null ? null : new Prisma.Decimal(v.reducedPrice),
  stock: v.stock,
  isDefault: v.isDefault,
  sortOrder: v.sortOrder,
  imageUrls: v.imageUrls,
});

/** The slot after the last product in `categoryId` — where new arrivals land. */
async function nextCategoryOrder(categoryId: number | null | undefined): Promise<number> {
  const last = await prisma.product.aggregate({
    where: { categoryId: categoryId ?? null },
    _max: { categoryOrder: true },
  });
  return (last._max.categoryOrder ?? -1) + 1;
}

export async function createProduct(
  _prev: ProductActionState,
  fd: FormData,
): Promise<ProductActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parseProduct(fd);
    if ("error" in parsed) return { error: parsed.error };
    await relationsExist(parsed.scalars.categoryId);
    const promotions = await promotionLinks(parsed.promotionIds);

    const product = await prisma.product.create({
      data: {
        ...parsed.scalars,
        categoryOrder: await nextCategoryOrder(parsed.scalars.categoryId),
        promotions: { connect: promotions },
        images: { create: parsed.images },
        videos: { create: parsed.videos },
        variants: { create: parsed.variants.map(variantData) },
      },
    });

    revalidatePath("/admin/[lang]/products", "page");
    redirect(`/admin/${lang}/products/${product.id}`);
  });
}

export async function updateProduct(
  id: number,
  _prev: ProductActionState,
  fd: FormData,
): Promise<ProductActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parseProduct(fd);
    if ("error" in parsed) return { error: parsed.error };
    await relationsExist(parsed.scalars.categoryId);
    const promotions = await promotionLinks(parsed.promotionIds);

    // Moving to another category puts the product at the end of that one.
    const before = await prisma.product.findUnique({
      where: { id },
      select: { categoryId: true },
    });
    if (!before) return { error: getAdminDict(lang).errors.recordMissing };
    const categoryOrder =
      before.categoryId === (parsed.scalars.categoryId ?? null)
        ? undefined
        : await nextCategoryOrder(parsed.scalars.categoryId);

    const keptVariantIds = parsed.variants
      .map((v) => v.id)
      .filter((v): v is number => v !== null);

    await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: { ...parsed.scalars, categoryOrder, promotions: { set: promotions } },
      }),
      // Images and videos carry no foreign keys — rebuild them wholesale.
      prisma.productImage.deleteMany({ where: { productId: id } }),
      prisma.productImage.createMany({
        data: parsed.images.map((i) => ({ ...i, productId: id })),
      }),
      prisma.productVideo.deleteMany({ where: { productId: id } }),
      prisma.productVideo.createMany({
        data: parsed.videos.map((v) => ({ ...v, productId: id })),
      }),
      // Variants are referenced by order items, so update in place where possible.
      prisma.productVariant.deleteMany({
        where: { productId: id, id: { notIn: keptVariantIds } },
      }),
      // `updateMany` scopes the write to this product, so a variant id posted
      // from a stale tab (or another product's row) matches nothing instead of
      // throwing P2025 and rolling back the entire save.
      ...parsed.variants.map((v) =>
        v.id === null
          ? prisma.productVariant.create({
              data: { ...variantData(v), productId: id },
            })
          : prisma.productVariant.updateMany({
              where: { id: v.id, productId: id },
              data: variantData(v),
            }),
      ),
    ]);

    revalidatePath("/admin/[lang]/products", "page");
    revalidatePath("/admin/[lang]/products/[id]", "page");
    return { ok: true };
  });
}

/**
 * "Delete" hides the product for good but keeps the row: its URL (already
 * indexed, bookmarked, linked) then keeps redirecting to its category instead
 * of turning into a 404, and order history keeps its product link.
 */
async function softDeleteProduct(id: number): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { isActive: false, featured: false, deletedAt: new Date() },
  });
}

export async function deleteProduct(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await softDeleteProduct(id);
    revalidatePath("/admin/[lang]/products", "page");
    redirect(`/admin/${lang}/products`);
  });
}

// ---------------------------------------------------------------------------
// Row actions — the `⋯` menu on the products table. Each one is a single
// field flip or a whole-row operation, so they take ids rather than a FormData.
// ---------------------------------------------------------------------------

function revalidateProducts(): void {
  revalidatePath("/admin/[lang]/products", "page");
  revalidatePath("/admin/[lang]/products/[id]", "page");
  revalidatePath("/admin/[lang]", "page"); // dashboard counts
}

export async function setProductActive(
  lang: AdminLang,
  id: number,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.product.update({ where: { id }, data: { isActive } });
    revalidateProducts();
  });
}

export async function setProductFeatured(
  lang: AdminLang,
  id: number,
  featured: boolean,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.product.update({ where: { id }, data: { featured } });
    revalidateProducts();
  });
}

/** Delete from the list — same as `deleteProduct` minus the redirect. */
export async function removeProduct(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await softDeleteProduct(id);
    revalidateProducts();
  });
}

/**
 * Copy a product with its images, videos and variants, then open the copy.
 * The duplicate starts hidden and unfeatured so an unfinished clone can never
 * show up in the shop.
 */
export async function duplicateProduct(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    const source = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { id: "asc" } },
        videos: { orderBy: { id: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        promotions: { select: { id: true } },
      },
    });
    if (!source) throw new ActionRefusal("sourceMissing");

    const copy = await prisma.product.create({
      data: {
        name_ro: `${source.name_ro} ${adminDictionaries.ro.common.copySuffix}`,
        name_ru: `${source.name_ru} ${adminDictionaries.ru.common.copySuffix}`,
        description_ro: source.description_ro,
        description_ru: source.description_ru,
        price: source.price,
        reducedPrice: source.reducedPrice,
        stock: source.stock,
        hasVariants: source.hasVariants,
        specifications: (source.specifications ?? {}) as Prisma.InputJsonValue,
        categoryId: source.categoryId,
        promotions: { connect: source.promotions.map((p) => ({ id: p.id })) },
        featured: false,
        featuredOrder: source.featuredOrder,
        categoryOrder: await nextCategoryOrder(source.categoryId),
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
            stock: v.stock,
            isDefault: v.isDefault,
            sortOrder: v.sortOrder,
            imageUrls: v.imageUrls,
          })),
        },
      },
    });

    revalidateProducts();
    redirect(`/admin/${lang}/products/${copy.id}`);
  });
}
