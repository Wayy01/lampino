import { prisma } from "../prisma";
import { getProducts } from "./products";
import { getRentalPackages } from "./rentals";
import type { Product, RentalPackage } from "../types";

export type SpecialOffers = {
  title_ro: string;
  title_ru: string;
  description_ro: string;
  description_ru: string;
  mediaUrl: string | null;
  mediaType: string;
  products: Product[];
  rentals: RentalPackage[];
};

function ids(json: unknown): number[] {
  return Array.isArray(json)
    ? json.filter((n): n is number => typeof n === "number")
    : [];
}

export type SpecialOffersMeta = Pick<
  SpecialOffers,
  "title_ro" | "title_ru" | "description_ro" | "description_ru"
>;

/**
 * Just the admin-authored headline of `/oferte-speciale`, without resolving the
 * catalog behind it — enough for `generateMetadata` and for the sitemap to know
 * whether the page is published at all (`null` when it isn't).
 */
export async function getSpecialOffersMeta(): Promise<SpecialOffersMeta | null> {
  const page = await prisma.specialOffersPage.findFirst({
    where: { isActive: true },
    select: {
      title_ro: true,
      title_ru: true,
      description_ro: true,
      description_ru: true,
    },
  });
  return page;
}

/**
 * The `/oferte-speciale` page. `SpecialOffersPage` picks its contents one of
 * two ways: `manual` uses the explicitly selected ids (order preserved), and
 * `category` takes everything active in one category. Returns `null` when the
 * admin hasn't published the page, which the route turns into a 404.
 */
export async function getSpecialOffers(): Promise<SpecialOffers | null> {
  const page = await prisma.specialOffersPage.findFirst({
    where: { isActive: true },
  });
  if (!page) return null;

  const [allProducts, allRentals] = await Promise.all([
    getProducts(),
    getRentalPackages(),
  ]);

  let products: Product[];
  let rentals: RentalPackage[];

  if (page.selectionMethod === "category" && page.filterByCategoryId !== null) {
    products = allProducts.filter((p) => p.categoryId === page.filterByCategoryId);
    rentals = allRentals.filter((r) => r.categoryId === page.filterByCategoryId);
  } else {
    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const rentalById = new Map(allRentals.map((r) => [r.id, r]));
    products = ids(page.selectedProductIds)
      .map((id) => productById.get(id))
      .filter((p): p is Product => Boolean(p));
    rentals = ids(page.selectedRentalPackageIds)
      .map((id) => rentalById.get(id))
      .filter((r): r is RentalPackage => Boolean(r));
  }

  return {
    title_ro: page.title_ro,
    title_ru: page.title_ru,
    description_ro: page.description_ro,
    description_ru: page.description_ru,
    mediaUrl: page.mediaUrl,
    mediaType: page.mediaType,
    products,
    rentals,
  };
}
