import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma";
import { normalizeSpecs } from "../specs";
import { parseId } from "../utils";
import { rentalPaths } from "../i18n/routing";
import { activePromotion, promotionSelect, serializeCategory } from "./products";
import { effectiveReducedPrice } from "../promotions";
import type { CatalogIndexEntry, RentalPackage } from "../types";

export type { RentalPackage } from "../types";

const rentalInclude = {
  category: true,
  images: { orderBy: [{ isMain: "desc" }, { id: "asc" }] },
  videos: { orderBy: { id: "asc" } },
  variants: { orderBy: { sortOrder: "asc" } },
  // Every linked promotion, past and future; the running one is picked per
  // request in serialize, so a scheduled sale switches on by itself.
  promotions: { select: promotionSelect },
} satisfies Prisma.RentalPackageInclude;

type RentalRow = Prisma.RentalPackageGetPayload<{ include: typeof rentalInclude }>;

/** Json → clean string[] for the `includes_ro` / `includes_ru` checklist columns. */
function toStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function serializeRental(row: RentalRow, now = new Date()): RentalPackage {
  const promotion = activePromotion(row.promotions, now);
  const pct = promotion?.discountPercent ?? null;
  const dec = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));
  return {
    id: row.id,
    title_ro: row.title_ro,
    title_ru: row.title_ru,
    description_ro: row.description_ro,
    description_ru: row.description_ru,
    price: Number(row.price),
    reducedPrice: effectiveReducedPrice(Number(row.price), dec(row.reducedPrice), pct),
    hasVariants: row.hasVariants,
    specifications: normalizeSpecs(row.specifications),
    includes_ro: toStringArray(row.includes_ro),
    includes_ru: toStringArray(row.includes_ru),
    categoryId: row.categoryId,
    category: row.category ? serializeCategory(row.category) : null,
    images: row.images.map((i) => ({ id: i.id, imageUrl: i.imageUrl, isMain: i.isMain })),
    videos: row.videos.map((v) => ({ id: v.id, videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl })),
    variants: row.variants.map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size,
      price: Number(v.price),
      reducedPrice: effectiveReducedPrice(Number(v.price), dec(v.reducedPrice), pct),
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
    })),
    promotion,
  };
}

export async function getRentalPackages(): Promise<RentalPackage[]> {
  const rows = await prisma.rentalPackage.findMany({
    where: { isActive: true },
    include: rentalInclude,
    orderBy: [{ price: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => serializeRental(r));
}

/** Rental packages to spotlight on the homepage, filtered by `featuredRentalsCategoryId` when the admin set one. */
export async function getFeaturedRentals(limit = 3): Promise<RentalPackage[]> {
  const settings = await prisma.homepageSettings.findFirst({ where: { isActive: true } });
  const rows = await prisma.rentalPackage.findMany({
    where: { isActive: true, categoryId: settings?.featuredRentalsCategoryId ?? undefined },
    include: rentalInclude,
    orderBy: [{ price: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => serializeRental(r));
}

/** Every indexable rental package as a sitemap row. */
export async function getRentalIndex(): Promise<CatalogIndexEntry[]> {
  const rows = await prisma.rentalPackage.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title_ro: true,
      title_ru: true,
      updatedAt: true,
      images: { select: { imageUrl: true }, orderBy: [{ isMain: "desc" }, { id: "asc" }] },
    },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    paths: rentalPaths(r),
    images: r.images.map((i) => i.imageUrl),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getRentalPackageById(id: number): Promise<RentalPackage | null> {
  if (parseId(id) === null) return null;
  const row = await prisma.rentalPackage.findFirst({
    where: { id, isActive: true },
    include: rentalInclude,
  });
  return row ? serializeRental(row) : null;
}

/** True when the id belongs to a package that exists but is deactivated. */
export async function isRetiredRental(id: number): Promise<boolean> {
  if (parseId(id) === null) return false;
  const row = await prisma.rentalPackage.findUnique({ where: { id }, select: { isActive: true } });
  return row !== null && !row.isActive;
}

/** Other packages to suggest on a rental detail page — same category first, then any. */
export async function getRelatedRentals(
  pkg: RentalPackage,
  limit = 3,
): Promise<RentalPackage[]> {
  const rows = await prisma.rentalPackage.findMany({
    where: { isActive: true, id: { not: pkg.id } },
    include: rentalInclude,
    orderBy: [
      { categoryId: pkg.categoryId ? "asc" : "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
  });
  // Prefer same-category packages, but always return up to `limit`.
  const sameCat = rows.filter((r) => r.categoryId === pkg.categoryId);
  const others = rows.filter((r) => r.categoryId !== pkg.categoryId);
  return [...sameCat, ...others].slice(0, limit).map((r) => serializeRental(r));
}
