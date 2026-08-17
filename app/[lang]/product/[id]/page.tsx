import { notFound, redirect } from "next/navigation";
import { getProductById } from "@/lib/data/products";
import { isLocale, productHref } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

// Catches legacy lampino-md links (`/product/<id>`, no slug segment) from
// before the cutover and sends them to the canonical `/product/<id>/<slug>`.
export default async function ProductIdOnlyPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const product = await getProductById(Number(id));
  if (!product) notFound();

  redirect(productHref(lang, product.id, product.name_ro));
}
