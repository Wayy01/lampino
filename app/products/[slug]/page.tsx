import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  products,
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/data/products";
import { getContactSettings } from "@/lib/data/settings";
import { toSlug } from "@/lib/slug";
import { ProductDetail } from "@/components/site/product-detail";
import { RelatedProducts } from "@/components/site/related-products";

export function generateStaticParams() {
  return products.map((product) => ({
    slug: toSlug(product.id, product.name_ro),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Lampino" };
  return {
    title: `${product.name_ro} — Lampino`,
    description: `${product.name_ro} — ${product.price} lei. ${product.description_ro}`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [contact, related] = await Promise.all([
    getContactSettings(),
    getRelatedProducts(product, 3),
  ]);
  return (
    <>
      <ProductDetail product={product} contact={contact} />
      <RelatedProducts products={related} />
    </>
  );
}
