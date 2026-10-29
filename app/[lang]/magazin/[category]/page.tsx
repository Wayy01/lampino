import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { fill, localeAlternates, metaDescription, openGraphFor } from "@/lib/seo";
import {
  categoryHref,
  categoryPaths,
  categorySlug,
  isLocale,
  shopHref,
  type Locale,
} from "@/lib/i18n/routing";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { decodeSlug } from "@/lib/slug";
import { formatPrice, pick } from "@/lib/utils";
import { effectivePrice } from "@/lib/filters";
import {
  findCategoryIdByFormerSlug,
  getProducts,
  getCategoryOptions,
} from "@/lib/data/products";
import type { CategoryOption } from "@/lib/types";
import { ShopView, queryWithout, type ShopSearchParams } from "../shop";

export const dynamic = "force-dynamic";

type Params = Promise<{ lang: string; category: string }>;

/**
 * Resolve the URL segment to a category. `exact` is false when it matched only
 * a non-canonical form — the other locale's slug, the admin slug, or the bare
 * id — which the page then redirects to the canonical slug.
 */
function resolve(
  lang: Locale,
  segment: string,
  options: CategoryOption[],
): { category: CategoryOption; exact: boolean } | null {
  const raw = decodeSlug(segment).toLowerCase();
  const exact = options.find((c) => categorySlug(lang, c) === raw);
  if (exact) return { category: exact, exact: true };
  const loose = options.find(
    (c) =>
      categorySlug(lang === "ro" ? "ru" : "ro", c) === raw ||
      c.slug === raw ||
      String(c.id) === raw,
  );
  return loose ? { category: loose, exact: false } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, category: segment } = await params;
  if (!isLocale(lang)) return {};
  const [options, products] = await Promise.all([getCategoryOptions(), getProducts()]);
  const match = resolve(lang, segment, options);
  if (!match) return {};

  const { category } = match;
  const d = dictionaries[lang].seo;
  const name = pick(lang, category.name_ro, category.name_ru);
  const prices = products
    .filter((p) => p.category?.id === category.id)
    .map(effectivePrice);
  const title = fill(d.categoryTitle, { name });
  const description = metaDescription(
    fill(d.categoryDescription, {
      name,
      price: formatPrice(prices.length ? Math.min(...prices) : 0),
    }),
  );
  const paths = categoryPaths(category);
  return {
    title,
    description,
    // Filters on top of a category (sort, price, page) canonicalize to it.
    alternates: localeAlternates(lang, paths),
    openGraph: openGraphFor(lang, { title, description, path: paths }),
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<ShopSearchParams>;
}) {
  const { lang, category: segment } = await params;
  if (!isLocale(lang)) notFound();

  const sp = await searchParams;
  const [products, categoryOptions] = await Promise.all([
    getProducts(),
    getCategoryOptions(),
  ]);

  const match = resolve(lang, segment, categoryOptions);
  const rest = queryWithout(sp, "category");
  if (!match) {
    // A slug the category had before a rename moves on to its current page;
    // anything else (or a category with nothing left in it) goes to the catalog.
    const formerId = await findCategoryIdByFormerSlug(decodeSlug(segment).toLowerCase());
    const renamed = categoryOptions.find((c) => c.id === formerId);
    permanentRedirect(renamed ? categoryHref(lang, renamed, rest) : shopHref(lang, rest));
  }
  if (!match.exact) permanentRedirect(categoryHref(lang, match.category, rest));

  return (
    <ShopView
      lang={lang}
      sp={sp}
      products={products}
      categoryOptions={categoryOptions}
      category={match.category}
    />
  );
}
