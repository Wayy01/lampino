import type { Metadata } from "next";
import { Catalog } from "@/components/site/catalog";
import {
  getProducts,
  getCategoryOptions,
  type ProductCategory,
} from "@/lib/data/products";
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

export const metadata: Metadata = {
  title: "Produse — Lampino",
  description:
    "Becuri LED, becuri smart, lumini de Crăciun, benzi LED și iluminat exterior. De la 79 lei.",
};

export const dynamic = "force-dynamic";

const parseList = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] =>
  (raw ? raw.split(",") : []).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );

export default async function MagazinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const [products, categoryOptions] = await Promise.all([
    getProducts(),
    getCategoryOptions(),
  ]);

  // Category is addressed by its numeric id in the URL (`?category=13`); map it
  // back to the slug the catalog filters on.
  const rawCat = Number(get("category"));
  const matched = categoryOptions.find((c) => c.id === rawCat);
  const initialCategory: ProductCategory | "all" = matched ? matched.slug : "all";

  // A shared `max` in the URL is honoured when it's a sane positive value the
  // catalog can actually contain; otherwise fall back to the ceiling (no filter).
  const ceiling = priceCeiling(products);
  const rawMax = Number(get("max"));
  const initialMaxPrice =
    rawMax > 0 && rawMax <= ceiling ? rawMax : ceiling;

  const rawSort = get("sort");
  const initialSort: SortKey = isSortKey(rawSort) ? rawSort : DEFAULT_SORT;

  const rawPage = Number(get("page"));
  const initialPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const initialColorTemps: ColorTempKey[] = parseList(
    get("color"),
    COLOR_TEMP_ORDER,
  );
  const initialSockets: SocketKey[] = parseList(get("socket"), SOCKET_ORDER);
  const initialLumens: LumensKey[] = parseList(get("lumens"), LUMENS_ORDER);

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <Catalog
        products={products}
        categoryOptions={categoryOptions}
        initialCategory={initialCategory}
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
