import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProductById, getRelatedProducts } from "@/lib/data/products";
import { getContactSettings } from "@/lib/data/settings";
import { decodeSlug, slugify } from "@/lib/slug";
import {
  isLocale,
  localePath,
  productHref,
  productPath,
  shopHref,
} from "@/lib/i18n/routing";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/utils";
import {
  SITE_NAME,
  absoluteUrl,
  localeAlternates,
  metaDescription,
  openGraphFor,
} from "@/lib/seo";
import { breadcrumbSchema, productSchema } from "@/lib/schema";
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
  const product = await getProductById(Number(id));
  // A deleted or deactivated product 404s in the page below; keep the head of
  // that response out of the index.
  if (!product) return { title: SITE_NAME, robots: { index: false, follow: false } };

  const name = pick(l, product.name_ro, product.name_ru);
  const description = metaDescription(
    `${name} — ${product.price} lei. ${pick(l, product.description_ro, product.description_ru)}`,
  );
  const images = product.images.map((i) => absoluteUrl(i.imageUrl));

  return {
    title: name,
    description,
    // The slug is decorative and any mismatch redirects, so the canonical is
    // built from the current name rather than from the requested URL.
    alternates: localeAlternates(l, productPath(product.id, product.name_ro)),
    openGraph: openGraphFor(l, {
      title: name,
      description,
      path: productPath(product.id, product.name_ro),
      images,
    }),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ lang: string; id: string; slug: string }>;
}) {
  const { lang, id, slug } = await params;
  if (!isLocale(lang)) notFound();

  const product = await getProductById(Number(id));
  if (!product) notFound();

  // Redirect to the canonical name slug when it doesn't match (renamed product,
  // stale link, or hand-typed URL) — the id is the source of truth.
  const canonical = slugify(product.name_ro) || "produs";
  if (decodeSlug(slug) !== canonical) redirect(productHref(lang, product.id, product.name_ro));

  const [contact, related] = await Promise.all([
    getContactSettings(),
    getRelatedProducts(product, 3),
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
            {
              name: pick(lang, product.name_ro, product.name_ru),
              path: productHref(lang, product.id, product.name_ro),
            },
          ]),
        ]}
      />
      <ViewTracker kind="product" id={product.id} />
      <ProductDetail product={product} contact={contact} />
      <RelatedProducts products={related} />
    </>
  );
}
