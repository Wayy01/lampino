import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { localeAlternates, openGraphFor } from "@/lib/seo";
import { categoryHref, isLocale, shopHref } from "@/lib/i18n/routing";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { getProducts, getCategoryOptions } from "@/lib/data/products";
import {
  ShopView,
  firstParam,
  queryWithout,
  shopCanonical,
  type ShopSearchParams,
} from "./shop";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const d = dictionaries[l].seo;
  // `?page=N` is its own canonical page; sort/filter views fold back to the
  // bare catalog so the facets never compete with it in the index.
  const { path, titleSuffix, descriptionSuffix } = shopCanonical(l, "/magazin", await searchParams);
  const title = `${d.shopTitle}${titleSuffix}`;
  const description = `${d.shopDescription}${descriptionSuffix}`;
  return {
    title,
    description,
    alternates: localeAlternates(l, path),
    openGraph: openGraphFor(l, { title, description, path }),
  };
}

export const dynamic = "force-dynamic";

export default async function MagazinPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const sp = await searchParams;
  const [products, categoryOptions] = await Promise.all([
    getProducts(),
    getCategoryOptions(),
  ]);

  // Legacy `?category=<id>` URLs (old links, already-indexed filter views) move
  // permanently to the category's own landing page, keeping the other filters.
  // An id that no longer lists anything drops back to the bare catalog.
  const rawCategory = firstParam(sp, "category");
  if (rawCategory !== undefined) {
    const matched = categoryOptions.find((c) => String(c.id) === rawCategory);
    const rest = queryWithout(sp, "category");
    permanentRedirect(matched ? categoryHref(lang, matched, rest) : shopHref(lang, rest));
  }

  return (
    <ShopView
      lang={lang}
      sp={sp}
      products={products}
      categoryOptions={categoryOptions}
      category={null}
      landing={null}
      description={dictionaries[lang].seo.shopDescription}
    />
  );
}
