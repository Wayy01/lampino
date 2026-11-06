import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  absoluteUrl,
  fill,
  localeAlternates,
  metaDescription,
  openGraphFor,
} from "@/lib/seo";
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
import { getCategoryImage, getCategoryLanding } from "@/lib/data/categories";
import type { CategoryLanding, CategoryOption, Product } from "@/lib/types";
import { ShopView, queryWithout, shopCanonical, type ShopSearchParams } from "../shop";

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

/**
 * Title and description: the admin's landing copy when written, otherwise
 * built from the name and the lowest price — never empty.
 */
function headCopy(
  lang: Locale,
  category: CategoryOption,
  landing: CategoryLanding | null,
  products: Product[],
): { title: string; description: string } {
  const d = dictionaries[lang].seo;
  const copy = landing?.[lang];
  const name = pick(lang, category.name_ro, category.name_ru);
  const prices = products
    .filter((p) => p.category?.id === category.id)
    .map(effectivePrice);
  const title = copy?.seoTitle || fill(d.categoryTitle, { name });
  const description = metaDescription(
    copy?.seoDescription ||
      fill(d.categoryDescription, {
        name,
        price: formatPrice(prices.length ? Math.min(...prices) : 0),
      }),
  );
  return { title, description };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const { lang, category: segment } = await params;
  if (!isLocale(lang)) return {};
  const [options, products] = await Promise.all([getCategoryOptions(), getProducts()]);
  const match = resolve(lang, segment, options);
  if (!match) return {};

  const { category } = match;
  const landing = await getCategoryLanding(category.id);
  const head = headCopy(lang, category, landing, products);
  // `?page=N` is self-canonical; sort/filter views canonicalize to the category.
  const { path, titleSuffix, descriptionSuffix } = shopCanonical(
    lang,
    categoryPaths(category),
    await searchParams,
  );
  const title = `${head.title}${titleSuffix}`;
  const description = `${head.description}${descriptionSuffix}`;
  const firstImage = products.find((p) => p.category?.id === category.id && p.images[0])?.images[0];
  const image =
    landing?.ogImageUrl || (await getCategoryImage(category.id)) || firstImage?.imageUrl;
  return {
    // The layout appends "| Lampino" — unless the admin's title already names the shop.
    title: /lampino/i.test(head.title) ? { absolute: title } : title,
    description,
    alternates: localeAlternates(lang, path),
    openGraph: openGraphFor(lang, {
      title,
      description,
      path,
      ...(image && { images: [absoluteUrl(image)] }),
    }),
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

  const landing = await getCategoryLanding(match.category.id);
  return (
    <ShopView
      lang={lang}
      sp={sp}
      products={products}
      categoryOptions={categoryOptions}
      category={match.category}
      landing={landing?.[lang] ?? null}
      description={headCopy(lang, match.category, landing, products).description}
    />
  );
}
