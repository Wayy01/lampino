import type { Metadata } from "next";
import { Catalog } from "@/components/site/catalog";

export const metadata: Metadata = {
  title: "The fleet — Atelier",
  description:
    "Every car we broker, with the best price across our partners. From €500/day.",
};

export default function CarsPage() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <Catalog />
    </div>
  );
}
