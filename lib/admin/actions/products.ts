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
import { specsToJson, isEmptySpecRow, type SpecRow } from "@/lib/admin/specs";
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
  price: number;
  reducedPrice: number | null;
  stock: number;
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

type ParsedProduct = {
  scalars: Omit<Prisma.ProductUncheckedCreateInput, "id" | "images" | "videos" | "variants">;
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
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: errors.stockInvalid };
  }

  const specRows = json<SpecRow[]>(fd, "specifications", []).filter(
    (row) => !isEmptySpecRow(row),
  );
  const images = json<ImagePayload[]>(fd, "images", []).filter((i) => i.imageUrl.trim());
  const videos = json<VideoPayload[]>(fd, "videos", []).filter((v) => v.videoUrl.trim());
  const variants = json<VariantPayload[]>(fd, "variants", []).filter(
    (v) => v.name_ro.trim() && v.name_ru.trim(),
  );

  // Variants carry their own money and stock, and are just as capable of
  // overflowing the column or undercutting their own reduced price.
  for (const v of variants) {
    if (overMoney(v.price) || overMoney(v.reducedPrice)) {
      return { error: errors.priceTooLarge };
    }
    if (v.reducedPrice !== null && v.reducedPrice >= v.price) {
      return { error: errors.reducedBelowPrice };
    }
    if (!Number.isInteger(v.stock) || v.stock < 0) {
      return { error: errors.stockInvalid };
    }
  }

  return {
    scalars: {
      name_ro,
      name_ru,
      description_ro: str(fd, "description_ro"),
      description_ru: str(fd, "description_ru"),
      price: new Prisma.Decimal(price),
      reducedPrice: reducedPrice === null ? null : new Prisma.Decimal(reducedPrice),
      stock,
      hasVariants: variants.length > 0,
      specifications: specsToJson(specRows),
      categoryId: numOrNull(fd, "categoryId"),
      promotionId: numOrNull(fd, "promotionId"),
      featured: fd.get("featured") === "on",
      featuredOrder: numOrNull(fd, "featuredOrder") ?? 0,
      isActive: fd.get("isActive") === "on",
    },
    images,
    videos,
    variants,
  };
}

const variantData = (v: VariantPayload) => ({
  name_ro: v.name_ro.trim(),
  name_ru: v.name_ru.trim(),
  size: v.size?.trim() || null,
  price: new Prisma.Decimal(v.price),
  reducedPrice: v.reducedPrice === null ? null : new Prisma.Decimal(v.reducedPrice),
  stock: v.stock,
  isDefault: v.isDefault,
  sortOrder: v.sortOrder,
});

export async function createProduct(
  _prev: ProductActionState,
  fd: FormData,
): Promise<ProductActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const parsed = parseProduct(fd);
    if ("error" in parsed) return { error: parsed.error };

    const product = await prisma.product.create({
      data: {
        ...parsed.scalars,
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

    const keptVariantIds = parsed.variants
      .map((v) => v.id)
      .filter((v): v is number => v !== null);

    await prisma.$transaction([
      prisma.product.update({ where: { id }, data: parsed.scalars }),
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

export async function deleteProduct(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.product.delete({ where: { id } });
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
    await prisma.product.delete({ where: { id } });
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
        promotionId: source.promotionId,
        featured: false,
        featuredOrder: source.featuredOrder,
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
          })),
        },
      },
    });

    revalidateProducts();
    redirect(`/admin/${lang}/products/${copy.id}`);
  });
}
