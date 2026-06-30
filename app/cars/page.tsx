import type { Metadata } from "next";
import { Catalog } from "@/components/site/catalog";
import { categories, type CarCategory } from "@/lib/data/cars";

export const metadata: Metadata = {
  title: "The fleet — Atelier",
  description:
    "Every car we broker, with the best price across our partners. From €500/day.",
};

const PRICE_STEPS = [600, 800, 1300];

export default async function CarsPage({
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
  const initialCategory: CarCategory | "all" =
    rawCat && categories.includes(rawCat as CarCategory)
      ? (rawCat as CarCategory)
      : "all";

  const rawMax = Number(get("max"));
  const initialMaxPrice = PRICE_STEPS.includes(rawMax) ? rawMax : 1300;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <Catalog
        initialCategory={initialCategory}
        initialMaxPrice={initialMaxPrice}
        initialLocation={get("location") ?? null}
        initialPickup={get("pickup") ?? null}
        initialReturn={get("return") ?? null}
      />
    </div>
  );
}
