"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  DoorOpen,
  Cog,
  Fuel,
  Zap,
  Calendar,
  Check,
} from "lucide-react";
import type { Car } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useLang } from "@/lib/i18n/provider";
import { formatEur } from "@/lib/utils";
import { CarGallery } from "./car-gallery";
import { OrderDialog } from "./order-dialog";
import { Button } from "@/components/ui/button";

const EASE = [0.22, 1, 0.36, 1] as const;

export function CarDetail({ car }: { car: Car }) {
  const { lang, t } = useLang();
  const pricing = getCarPricing(car);

  const specs = [
    { icon: Users, label: t.specsLabels.seats, value: car.seats },
    { icon: DoorOpen, label: t.specsLabels.doors, value: car.doors },
    {
      icon: Cog,
      label: t.specsLabels.transmission,
      value: t.values[car.transmission],
    },
    { icon: Fuel, label: t.specsLabels.fuel, value: t.values[car.fuel] },
    {
      icon: Zap,
      label: t.specsLabels.power,
      value: `${car.power} ${t.specsLabels.hp}`,
    },
    { icon: Calendar, label: t.specsLabels.year, value: car.year },
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <Link
          href="/cars"
          className="group label-mono inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {t.product.back}
        </Link>
      </motion.div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-mono text-primary">
            {t.categories[car.category]}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-display mt-3 text-[clamp(2.25rem,6vw,4.5rem)] font-light leading-[0.95] tracking-[-0.03em]"
          >
            {car.name}
          </motion.h1>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
        {/* Left: gallery + overview + specs */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          >
            <CarGallery images={car.images} alt={car.name} />
          </motion.div>

          <div className="mt-14">
            <div className="label-mono mb-5 text-muted-foreground">
              {t.product.overview}
            </div>
            <p className="font-display max-w-xl text-2xl font-light leading-snug tracking-tight md:text-3xl">
              {car.description[lang]}
            </p>
          </div>

          <div className="mt-14">
            <div className="label-mono mb-6 text-muted-foreground">
              {t.product.specs}
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-border bg-border sm:grid-cols-3">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-col gap-3 bg-background p-5"
                >
                  <spec.icon
                    className="h-5 w-5 text-primary"
                    strokeWidth={1.5}
                  />
                  <div>
                    <div className="label-mono text-muted-foreground">
                      {spec.label}
                    </div>
                    <div className="mt-1 font-medium">{spec.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: sticky booking panel */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 md:p-7">
            <div className="flex items-baseline gap-1.5">
              <span className="label-mono text-muted-foreground">
                {t.product.from}
              </span>
              <span className="font-display text-4xl tracking-tight">
                {formatEur(pricing.fromPrice)}
              </span>
              <span className="label-mono text-muted-foreground">
                {t.product.perDay}
              </span>
            </div>

            <OrderDialog
              car={car}
              trigger={
                <Button size="lg" className="group mt-6 w-full">
                  {t.product.request}
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              }
            />

            <ul className="mt-7 space-y-3 border-t border-border pt-6">
              {t.product.includedItems.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
