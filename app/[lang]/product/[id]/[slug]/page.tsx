import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProductById, getRelatedProducts } from "@/lib/data/products";
import { getContactSettings } from "@/lib/data/settings";
import { slugify } from "@/lib/slug";
import { isLocale, productHref } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
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
  const product = await getProductById(Number(id));
  if (!product) return { title: "Lampino" };
  const name = pick(isLocale(lang) ? lang : "ro", product.name_ro, product.name_ru);
  const description = pick(
    isLocale(lang) ? lang : "ro",
    product.description_ro,
    product.description_ru,
  );
  return {
    title: `${name} — Lampino`,
    description: `${name} — ${product.price} lei. ${description}`,
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
  if (slug !== canonical) redirect(productHref(lang, product.id, product.name_ro));

  const [contact, related] = await Promise.all([
    getContactSettings(),
    getRelatedProducts(product, 3),
  ]);
  return (
    <>
      <ViewTracker kind="product" id={product.id} />
      <ProductDetail product={product} contact={contact} />
      <RelatedProducts products={related} />
    </>
  );
}
