import { notFound, permanentRedirect } from "next/navigation";
import { getProductById } from "@/lib/data/products";
import { isLocale, productHref } from "@/lib/i18n/routing";
import { parseId } from "@/lib/utils";
import { redirectRetiredProduct } from "./retired";

export const dynamic = "force-dynamic";

// Catches legacy lampino-md links (`/product/<id>`, no slug segment) from
// before the cutover and moves them permanently to `/product/<id>/<slug>`.
export default async function ProductIdOnlyPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const product = await getProductById(parseId(id) ?? 0);
  if (!product) return redirectRetiredProduct(lang, id);

  permanentRedirect(productHref(lang, product));
}
