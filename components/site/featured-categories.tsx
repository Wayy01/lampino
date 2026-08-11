"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Category } from "@/lib/types";
import { useLang, useT } from "@/lib/i18n/provider";
import { shopHref } from "@/lib/i18n/routing";
import { pick, cn } from "@/lib/utils";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FeaturedCategories({ categories }: { categories: Category[] }) {
  const t = useT();
  const { lang } = useLang();

  if (categories.length === 0) return null;

  // Keep the desktop grid intentional whatever the admin configures.
  const cols =
    categories.length <= 2
      ? "md:grid-cols-2"
      : categories.length === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3";

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 md:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <SectionHeading
            index="01"
            kicker={t.featuredCategories.kicker}
            title={t.featuredCategories.title}
          />
        </div>
        <Reveal delay={0.15}>
          <Link
            href={shopHref(lang)}
            className="group label-mono inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary"
          >
            {t.featuredCategories.browse}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>

      {/* Mobile: swipeable snap row. md+: intentional grid. */}
      <div
        className={cn(
          "mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-14 md:grid md:gap-5 md:overflow-visible md:pb-0",
          cols,
        )}
      >
        {categories.map((category, i) => (
          <CategoryTile
            key={category.id}
            category={category}
            index={i}
            countWord={t.catalog.results}
            explore={t.featuredCategories.explore}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryTile({
  category,
  index,
  countWord,
  explore,
}: {
  category: Category;
  index: number;
  countWord: string;
  explore: string;
}) {
  const { lang } = useLang();
  const name = pick(lang, category.name_ro, category.name_ru);
  const count = category.productCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: EASE }}
      className="min-w-[78%] shrink-0 snap-start sm:min-w-[46%] md:min-w-0"
    >
      <Link
        href={shopHref(lang, `category=${category.id}`)}
        className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[var(--radius-lg)] bg-muted"
      >
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 78vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-accent/40 to-surface" />
        )}

        {/* Warm scrim so the label always reads. */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/15 to-transparent" />

        {/* Hover affordance */}
        <div className="absolute right-4 top-4 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          <ArrowUpRight className="h-5 w-5" />
        </div>

        <div className="relative z-10 p-5">
          {count > 0 && (
            <div className="label-mono mb-2 text-background/75">
              {count} {countWord}
            </div>
          )}
          <h3 className="font-display text-2xl leading-tight tracking-tight text-background md:text-[1.6rem]">
            {name}
          </h3>
          <span className="label-mono mt-3 inline-flex items-center gap-1.5 text-primary-foreground/0 transition-colors duration-300 group-hover:text-background/80">
            {explore}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
