"use client";

import type { RentalPackage } from "@/lib/types";
import { useT } from "@/lib/i18n/provider";
import { SectionHeading } from "./section-heading";
import { RentalCard } from "./rental-card";

export function FeaturedRentals({
  packages,
  heading,
}: {
  packages: RentalPackage[];
  heading?: string;
}) {
  const t = useT();

  if (packages.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
      <SectionHeading
        index="03"
        kicker={t.arenda.kicker}
        title={heading || t.arenda.title}
      />

      <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        {packages.map((pkg, i) => (
          <RentalCard key={pkg.id} pkg={pkg} index={i} />
        ))}
      </div>
    </section>
  );
}
