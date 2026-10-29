import { categoryHref, localePath, productHref, shopHref, type Locale } from "../i18n/routing";
import type { LegacyTarget } from "../legacy-redirects";
import { getCategoryOptions, getProductById, getRetiredProductTarget } from "./products";

/**
 * Locale-prefixed URL for a legacy redirect target, resolved against the live
 * catalog so the redirect lands on the final canonical URL in one hop. A
 * product that has since been deactivated follows it to its category; a
 * category with nothing left in it falls back to the catalog.
 */
export async function resolveLegacyTarget(lang: Locale, target: LegacyTarget): Promise<string> {
  if ("path" in target) return localePath(lang, target.path);
  if ("product" in target) {
    const product = await getProductById(target.product);
    if (product) return productHref(lang, product);
    const retired = await getRetiredProductTarget(target.product);
    return retired?.category ? categoryHref(lang, retired.category) : shopHref(lang);
  }
  const category = (await getCategoryOptions()).find((c) => c.id === target.category);
  return category ? categoryHref(lang, category) : shopHref(lang);
}
