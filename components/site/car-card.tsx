"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowUpRight, Users, Cog, Zap } from "lucide-react";
import type { Car } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useT } from "@/lib/i18n/provider";
import { formatEur } from "@/lib/utils";

export function CarCard({ car, index = 0 }: { car: Car; index?: number }) {
  const t = useT();
  const pricing = getCarPricing(car);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/cars/${car.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-muted">
          <Image
            src={car.images[0]}
            alt={car.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="absolute left-4 top-4">
            <span className="label-mono rounded-full bg-background/85 px-3 py-1 backdrop-blur">
              {t.categories[car.category]}
            </span>
          </div>

          {pricing.isFrom && (
            <div className="absolute right-4 top-4">
              <span className="label-mono rounded-full bg-primary px-3 py-1 text-primary-foreground">
                {pricing.partnerCount} partner
              </span>
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-background text-foreground opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl tracking-tight transition-colors group-hover:text-primary">
              {car.name}
            </h3>
            <div className="mt-2 flex items-center gap-4 text-muted-foreground">
              <Spec icon={<Users className="h-3.5 w-3.5" />} value={car.seats} />
              <Spec
                icon={<Zap className="h-3.5 w-3.5" />}
                value={`${car.power} ${t.specsLabels.hp}`}
              />
              <Spec
                icon={<Cog className="h-3.5 w-3.5" />}
                value={t.values[car.transmission]}
              />
            </div>
          </div>
          <div className="text-right">
            {pricing.isFrom && (
              <div className="label-mono text-muted-foreground">
                {t.product.from}
              </div>
            )}
            <div className="font-display text-2xl tracking-tight">
              {formatEur(pricing.fromPrice)}
            </div>
            <div className="label-mono text-muted-foreground">
              {t.product.perDay}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Spec({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {icon}
      {value}
    </span>
  );
}
