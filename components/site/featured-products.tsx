"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref } from "@/lib/i18n/routing";
import { SectionHeading } from "./section-heading";
import { ProductCard } from "./product-card";
import { Reveal } from "./reveal";

export function FeaturedProducts({
  products,
  heading,
}: {
  products: Product[];
  heading?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const featured = products.slice(0, 9);

  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 md:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          index="01"
          kicker={t.featured.kicker}
          title={heading || t.featured.title}
        />
        <Reveal>
          <Link
            href={shopHref(lang)}
            className="group label-mono inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            {t.featured.viewAll}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>

      <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        {featured.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
}
