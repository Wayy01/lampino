"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { SpecialOffers } from "@/lib/data/offers";
import { useLang, useT } from "@/lib/i18n/provider";
import { pick } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { ProductCard } from "./product-card";
import { RentalCard } from "./rental-card";
import { MaskReveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

// The `/oferte-speciale` landing page. Every string, the hero media and both
// collections come from the `SpecialOffersPage` row the admin publishes.
export function OffersContent({ offers }: { offers: SpecialOffers }) {
  const { lang } = useLang();
  const t = useT();

  const title = pick(lang, offers.title_ro, offers.title_ru);
  const description = pick(lang, offers.description_ro, offers.description_ru);
  const empty = offers.products.length === 0 && offers.rentals.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-32 sm:px-8 md:pt-40">
      <div className="max-w-3xl">
        <h1 className="font-display text-[clamp(2.5rem,8vw,6rem)] font-light leading-[0.95] tracking-[-0.03em]">
          <MaskReveal>{title}</MaskReveal>
        </h1>
        {description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
            className="mt-8 text-lg text-muted-foreground"
          >
            {description}
          </motion.p>
        )}
      </div>

      {offers.mediaUrl && (
        <div className="relative mt-14 aspect-[21/9] overflow-hidden rounded-[var(--radius-lg)] bg-muted">
          {offers.mediaType === "video" ? (
            <video
              className="h-full w-full object-cover"
              src={offers.mediaUrl}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden
            />
          ) : (
            <Image
              src={offers.mediaUrl}
              alt={title}
              fill
              sizes="100vw"
              className="object-cover"
            />
          )}
        </div>
      )}

      {empty && (
        <p className="mt-20 text-muted-foreground">{t.offers.empty}</p>
      )}

      {offers.products.length > 0 && (
        <section className="mt-24 md:mt-32">
          <SectionHeading
            index="01"
            kicker={t.featured.kicker}
            title={t.offers.products}
          />
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
            {offers.products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </section>
      )}

      {offers.rentals.length > 0 && (
        <section className="mt-24 md:mt-32">
          <SectionHeading
            index="02"
            kicker={t.arenda.kicker}
            title={t.offers.rentals}
          />
          <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
            {offers.rentals.map((pkg, i) => (
              <RentalCard key={pkg.id} pkg={pkg} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
