"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cars } from "@/lib/data/cars";
import { useT } from "@/lib/i18n/provider";
import { SectionHeading } from "./section-heading";
import { CarCard } from "./car-card";
import { Reveal } from "./reveal";

export function FeaturedCars() {
  const t = useT();
  const featured = cars.slice(0, 6);

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          index="02"
          kicker={t.featured.kicker}
          title={t.featured.title}
        />
        <Reveal>
          <Link
            href="/cars"
            className="group label-mono inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            {t.featured.viewAll}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        {featured.map((car, i) => (
          <CarCard key={car.id} car={car} index={i} />
        ))}
      </div>
    </section>
  );
}
