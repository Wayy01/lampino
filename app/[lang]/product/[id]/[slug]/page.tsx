import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getProductById, getRelatedProducts } from "@/lib/data/products";
import { getContactSettings, getProductPerks } from "@/lib/data/settings";
import { decodeSlug } from "@/lib/slug";
import {
  categoryHref,
  isLocale,
  localePath,
  productHref,
  productPaths,
  shopHref,
} from "@/lib/i18n/routing";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { formatPrice, parseId, pick } from "@/lib/utils";
import {
  SITE_NAME,
  absoluteUrl,
  fill,
  localeAlternates,
  metaDescription,
  openGraphFor,
} from "@/lib/seo";
import { breadcrumbSchema, productPrices, productSchema } from "@/lib/schema";
import { redirectRetiredProduct } from "../retired";
import { JsonLd } from "@/components/site/json-ld";
import { ProductDetail } from "@/components/site/product-detail";
import { RelatedProducts } from "@/components/site/related-products";
import { ViewTracker } from "@/components/site/view-tracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const product = await getProductById(parseId(id) ?? 0);
  // A deleted or deactivated product 404s in the page below; keep the head of
  // that response out of the index.
  if (!product) return { title: SITE_NAME, robots: { index: false, follow: false } };

  const d = dictionaries[l].seo;
  const name = pick(l, product.name_ro, product.name_ru);
  const prices = productPrices(product);
  const price =
    prices.length > 1
      ? fill(d.priceFrom, { price: formatPrice(Math.min(...prices)) })
      : formatPrice(prices[0]);
  const title = product.category
    ? fill(d.productTitle, {
        name,
        category: pick(l, product.category.name_ro, product.category.name_ru),
        price,
      })
    : `${name} – ${price}`;
  const description = metaDescription(
    fill(d.productDescription, {
      name,
      price,
      description: pick(l, product.description_ro, product.description_ru),
    }),
  );
  const images = product.images.map((i) => absoluteUrl(i.imageUrl));
  // The slug is decorative and any mismatch redirects, so the canonical is
  // built from the current name rather than from the requested URL.
  const paths = productPaths(product);

  return {
    title,
    description,
    alternates: localeAlternates(l, paths),
    openGraph: openGraphFor(l, { title: name, description, path: paths, images }),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string; slug: string }>;
}) {
  const { lang, id, slug } = await params;
  if (!isLocale(lang)) notFound();

  const product = await getProductById(parseId(id) ?? 0);
  if (!product) return redirectRetiredProduct(lang, id);

  // Redirect permanently to the canonical name slug when it doesn't match
  // (renamed product, Romanian slug on a /ru URL, stale link, hand-typed URL) —
  // the id is the source of truth.
  const canonical = productHref(lang, product);
  if (`/${lang}/product/${id}/${encodeURIComponent(decodeSlug(slug))}` !== canonical) {
    permanentRedirect(canonical);
  }

  const [contact, related, perks] = await Promise.all([
    getContactSettings(),
    getRelatedProducts(product, 3),
    getProductPerks(),
  ]);
  const nav = dictionaries[lang].nav;

  return (
    <>
      <JsonLd
        data={[
          productSchema(product, lang),
          breadcrumbSchema([
            { name: nav.home, path: localePath(lang) },
            { name: nav.products, path: shopHref(lang) },
            ...(product.category
              ? [
                  {
                    name: pick(lang, product.category.name_ro, product.category.name_ru),
                    path: categoryHref(lang, product.category),
                  },
                ]
              : []),
            {
              name: pick(lang, product.name_ro, product.name_ru),
              path: canonical,
            },
          ]),
        ]}
      />
      <ViewTracker kind="product" id={product.id} />
      <ProductDetail product={product} contact={contact} perks={perks} />
      <RelatedProducts products={related} />
    </>
  );
}
