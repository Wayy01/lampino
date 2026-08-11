import { prisma } from "../prisma";
import { Prisma } from "../generated/prisma";
import { normalizeSpecs } from "../specs";
import { serializeCategory } from "./products";
import type { RentalPackage } from "../types";

export type { RentalPackage } from "../types";

const rentalInclude = {
  category: true,
  images: { orderBy: [{ isMain: "desc" }, { id: "asc" }] },
  videos: { orderBy: { id: "asc" } },
  variants: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.RentalPackageInclude;

type RentalRow = Prisma.RentalPackageGetPayload<{ include: typeof rentalInclude }>;

/** Json → clean string[] for the `includes_ro` / `includes_ru` checklist columns. */
function toStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function serializeRental(row: RentalRow): RentalPackage {
  return {
    id: row.id,
    title_ro: row.title_ro,
    title_ru: row.title_ru,
    description_ro: row.description_ro,
    description_ru: row.description_ru,
    price: Number(row.price),
    reducedPrice: row.reducedPrice === null ? null : Number(row.reducedPrice),
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
      reducedPrice: v.reducedPrice === null ? null : Number(v.reducedPrice),
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
    })),
  };
}

export async function getRentalPackages(): Promise<RentalPackage[]> {
  const rows = await prisma.rentalPackage.findMany({
    where: { isActive: true },
    include: rentalInclude,
    orderBy: [{ price: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeRental);
}

export async function getRentalPackageById(id: number): Promise<RentalPackage | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await prisma.rentalPackage.findFirst({
    where: { id, isActive: true },
    include: rentalInclude,
  });
  return row ? serializeRental(row) : null;
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
  return [...sameCat, ...others].slice(0, limit).map(serializeRental);
}
