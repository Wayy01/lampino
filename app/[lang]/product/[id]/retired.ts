import { notFound, permanentRedirect } from "next/navigation";
import { getRetiredProductTarget } from "@/lib/data/products";
import { resolveLegacyTarget } from "@/lib/data/legacy";
import { DELETED_PRODUCTS } from "@/lib/legacy-redirects";
import { categoryHref, shopHref, type Locale } from "@/lib/i18n/routing";
import { parseId } from "@/lib/utils";

/**
 * A product URL whose product is gone. A deactivated product still has a row,
 * so its link — bookmarked, shared, or already indexed — moves permanently to
 * its category (or the catalog). A deleted one goes where `DELETED_PRODUCTS`
 * says; an id that never existed is a real 404.
 */
export async function redirectRetiredProduct(lang: Locale, id: string): Promise<never> {
  const numericId = parseId(id) ?? 0;
  const target = await getRetiredProductTarget(numericId);
  if (!target) {
    const deleted = DELETED_PRODUCTS[numericId];
    if (deleted) permanentRedirect(await resolveLegacyTarget(lang, deleted));
    notFound();
  }
  permanentRedirect(target.category ? categoryHref(lang, target.category) : shopHref(lang));
}
