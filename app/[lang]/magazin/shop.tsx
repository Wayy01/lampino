// The catalog view shared by `/magazin` and its category landing pages
// (`/magazin/<category-slug>`). Everything except the category comes from the
// query string, which the client catalog keeps in sync.
import { Catalog } from "@/components/site/catalog";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";
import {
  categoryHref,
  localePath,
  productHref,
  shopHref,
  type Locale,
} from "@/lib/i18n/routing";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/utils";
import type { CategoryOption, Product } from "@/lib/types";
import {
  COLOR_TEMP_ORDER,
  DEFAULT_SORT,
  isSortKey,
  LUMENS_ORDER,
  priceCeiling,
  SOCKET_ORDER,
  type ColorTempKey,
  type LumensKey,
  type SocketKey,
  type SortKey,
} from "@/lib/filters";

export type ShopSearchParams = { [key: string]: string | string[] | undefined };

const parseList = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] =>
  (raw ? raw.split(",") : []).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );

/** First value of a query param. */
export function firstParam(sp: ShopSearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** The query string minus `drop` — what a redirect carries over. */
export function queryWithout(sp: ShopSearchParams, drop: string): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === drop || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) out.append(k, item);
  }
  return out.toString();
}

export function ShopView({
  lang,
  sp,
  products,
  categoryOptions,
  category,
}: {
  lang: Locale;
  sp: ShopSearchParams;
  products: Product[];
  categoryOptions: CategoryOption[];
  category: CategoryOption | null;
}) {
  const get = (k: string) => firstParam(sp, k);

  // A shared `max` in the URL is honoured when it's a sane positive value the
  // catalog can actually contain; otherwise fall back to the ceiling (no filter).
  const ceiling = priceCeiling(products);
  const rawMax = Number(get("max"));
  const initialMaxPrice = rawMax > 0 && rawMax <= ceiling ? rawMax : ceiling;

  const rawSort = get("sort");
  const initialSort: SortKey = isSortKey(rawSort) ? rawSort : DEFAULT_SORT;

  const rawPage = Number(get("page"));
  const initialPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const initialColorTemps: ColorTempKey[] = parseList(get("color"), COLOR_TEMP_ORDER);
  const initialSockets: SocketKey[] = parseList(get("socket"), SOCKET_ORDER);
  const initialLumens: LumensKey[] = parseList(get("lumens"), LUMENS_ORDER);

  const nav = dictionaries[lang].nav;
  const listed = category
    ? products.filter((p) => p.category?.id === category.id)
    : products;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: nav.home, path: localePath(lang) },
            { name: nav.products, path: shopHref(lang) },
            ...(category
              ? [
                  {
                    name: pick(lang, category.name_ro, category.name_ru),
                    path: categoryHref(lang, category),
                  },
                ]
              : []),
          ]),
          itemListSchema(
            listed.map((p) => ({
              name: pick(lang, p.name_ro, p.name_ru),
              path: productHref(lang, p),
            })),
          ),
        ]}
      />
      <Catalog
        products={products}
        categoryOptions={categoryOptions}
        initialCategory={category?.slug ?? "all"}
        initialMaxPrice={initialMaxPrice}
        initialSort={initialSort}
        initialPage={initialPage}
        initialColorTemps={initialColorTemps}
        initialSockets={initialSockets}
        initialLumens={initialLumens}
      />
    </div>
  );
}
