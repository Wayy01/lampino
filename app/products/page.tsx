import type { Metadata } from "next";
import { Catalog } from "@/components/site/catalog";
import { categories, type ProductCategory } from "@/lib/data/products";
import {
  COLOR_TEMP_ORDER,
  DEFAULT_SORT,
  isSortKey,
  LUMENS_ORDER,
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

const PRICE_STEPS = [200, 500, 1200];

const parseList = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] =>
  (raw ? raw.split(",") : []).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const rawCat = get("category");
  const initialCategory: ProductCategory | "all" =
    rawCat && categories.includes(rawCat as ProductCategory)
      ? (rawCat as ProductCategory)
      : "all";

  const rawMax = Number(get("max"));
  const initialMaxPrice = PRICE_STEPS.includes(rawMax) ? rawMax : 1200;

  const rawSort = get("sort");
  const initialSort: SortKey = isSortKey(rawSort) ? rawSort : DEFAULT_SORT;
  const initialColorTemps: ColorTempKey[] = parseList(
    get("color"),
    COLOR_TEMP_ORDER,
  );
  const initialSockets: SocketKey[] = parseList(get("socket"), SOCKET_ORDER);
  const initialLumens: LumensKey[] = parseList(get("lumens"), LUMENS_ORDER);

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <Catalog
        initialCategory={initialCategory}
        initialMaxPrice={initialMaxPrice}
        initialSort={initialSort}
        initialColorTemps={initialColorTemps}
        initialSockets={initialSockets}
        initialLumens={initialLumens}
      />
    </div>
  );
}
