"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowUpRight, Check } from "lucide-react";
import type { RentalPackage } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { pick, formatPrice } from "@/lib/utils";
import { rentalHref } from "@/lib/i18n/routing";

export function RentalCard({
  pkg,
  index = 0,
}: {
  pkg: RentalPackage;
  index?: number;
}) {
  const { lang, t } = useLang();

  const title = pick(lang, pkg.title_ro, pkg.title_ru);
  const category = pkg.category
    ? pick(lang, pkg.category.name_ro, pkg.category.name_ru)
    : null;
  const includes = pick(lang, pkg.includes_ro, pkg.includes_ru);
  const preview = includes.slice(0, 3);
  const rest = includes.length - preview.length;
  const image = pkg.images[0]?.imageUrl;

  const hasReduced = pkg.reducedPrice != null && pkg.reducedPrice < pkg.price;
  const shown = hasReduced ? pkg.reducedPrice! : pkg.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.6,
        delay: (index % 3) * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="h-full"
    >
      <Link
        href={rentalHref(lang, pkg.id, pkg.title_ro)}
        className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface transition-shadow duration-500 hover:shadow-[0_24px_60px_-28px_rgba(20,17,15,0.4)]"
      >
        {/* Magazine-cover header */}
        <div className="relative aspect-[16/11] overflow-hidden bg-muted">
          {image ? (
            <Image
              src={image}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-accent via-muted to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/20 to-transparent" />

          {category && (
            <span className="label-mono absolute left-4 top-4 rounded-full bg-background/85 px-3 py-1 text-foreground backdrop-blur">
              {category}
            </span>
          )}

          <h3 className="font-display absolute inset-x-0 bottom-0 p-5 text-2xl leading-[1.1] tracking-tight text-background md:text-[1.7rem]">
            {title}
          </h3>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 p-5">
          {preview.length > 0 && (
            <ul className="space-y-2">
              {preview.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    strokeWidth={2}
                  />
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
              {rest > 0 && (
                <li className="label-mono pl-[26px] text-primary">
                  {t.arenda.more} {rest} {t.arenda.items}
                </li>
              )}
            </ul>
          )}

          <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
            <div>
              <div className="label-mono text-muted-foreground">
                {t.arenda.from}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl tracking-tight">
                  {formatPrice(shown)}
                </span>
                {hasReduced && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(pkg.price)}
                  </span>
                )}
              </div>
            </div>
            <span className="label-mono inline-flex items-center gap-1.5 text-foreground transition-colors group-hover:text-primary">
              {t.arenda.viewPackage}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
