"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { Car } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useT } from "@/lib/i18n/provider";
import { formatEur } from "@/lib/utils";

export function CarIndex({ cars }: { cars: Car[] }) {
  const t = useT();
  const [active, setActive] = useState<number | null>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 28, mass: 0.6 });
  const y = useSpring(my, { stiffness: 220, damping: 28, mass: 0.6 });

  const handleMove = (e: React.MouseEvent) => {
    mx.set(e.clientX);
    my.set(e.clientY);
  };

  return (
    <div onMouseMove={handleMove} className="relative">
      {/* Floating cinematic preview (desktop only) */}
      <AnimatePresence>
        {active !== null && (
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ x, y, translateX: "-50%", translateY: "-50%" }}
            className="pointer-events-none fixed left-0 top-0 z-40 hidden h-64 w-96 overflow-hidden rounded-[var(--radius-lg)] shadow-2xl lg:block"
          >
            <Image
              src={cars[active].images[0]}
              alt=""
              fill
              sizes="384px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-foreground/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-border">
        {cars.map((car, i) => {
          const pricing = getCarPricing(car);
          return (
            <Link
              key={car.id}
              href={`/cars/${car.slug}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className="group relative flex items-center gap-5 border-b border-border py-6 transition-colors hover:bg-foreground/[0.02] md:gap-8 md:py-8"
            >
              <span className="label-mono w-8 shrink-0 text-muted-foreground transition-colors group-hover:text-primary">
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Mobile thumbnail */}
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] lg:hidden">
                <Image
                  src={car.images[0]}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-display truncate text-2xl font-light tracking-tight transition-all duration-300 group-hover:translate-x-2 md:text-4xl">
                  {car.name}
                </h3>
              </div>

              <span className="label-mono hidden shrink-0 text-muted-foreground sm:block">
                {t.categories[car.category]}
              </span>

              <div className="shrink-0 text-right">
                {pricing.isFrom && (
                  <span className="label-mono mr-2 text-muted-foreground">
                    {t.product.from}
                  </span>
                )}
                <span className="font-display text-xl tracking-tight md:text-2xl">
                  {formatEur(pricing.fromPrice)}
                </span>
              </div>

              <ArrowUpRight className="h-5 w-5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-primary group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
