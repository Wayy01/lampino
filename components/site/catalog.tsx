"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LayoutGrid, List } from "lucide-react";
import { cars as allCars, categories, type CarCategory } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useT } from "@/lib/i18n/provider";
import { cn, formatEur } from "@/lib/utils";
import { CarIndex } from "./car-index";
import { CarCard } from "./car-card";

type View = "index" | "gallery";

const PRICE_STEPS = [600, 800, 1300] as const;

export function Catalog() {
  const t = useT();
  const [view, setView] = useState<View>("index");
  const [category, setCategory] = useState<CarCategory | "all">("all");

  // Gallery is the default on mobile; index stays the default on desktop.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setView("gallery");
    }
  }, []);

  const [maxPrice, setMaxPrice] = useState<number>(1300);
  const [multiOnly, setMultiOnly] = useState(false);

  const filtered = useMemo(() => {
    return allCars.filter((car) => {
      const pricing = getCarPricing(car);
      if (category !== "all" && car.category !== category) return false;
      if (pricing.fromPrice > maxPrice) return false;
      if (multiOnly && !pricing.isFrom) return false;
      return true;
    });
  }, [category, maxPrice, multiOnly]);

  const reset = () => {
    setCategory("all");
    setMaxPrice(1300);
    setMultiOnly(false);
  };

  return (
    <div>
      {/* Editorial header */}
      <div className="mb-12 max-w-2xl">
        <div className="label-mono flex items-center gap-3 text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          <span>{t.catalog.kicker}</span>
        </div>
        <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,5rem)] font-light leading-[0.95] tracking-[-0.03em]">
          {t.catalog.title}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          {t.catalog.subtitle}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-6 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Pill active={category === "all"} onClick={() => setCategory("all")}>
              {t.catalog.all}
            </Pill>
            {categories.map((c) => (
              <Pill
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
              >
                {t.categories[c]}
              </Pill>
            ))}
          </div>

          {/* View toggle */}
          <div className="label-mono flex items-center gap-1 rounded-full border border-foreground/15 bg-muted/60 p-1 shadow-sm">
            <button
              onClick={() => setView("gallery")}
              aria-pressed={view === "gallery"}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors cursor-pointer",
                view === "gallery"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              {t.catalog.viewGallery}
            </button>
            <button
              onClick={() => setView("index")}
              aria-pressed={view === "index"}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors cursor-pointer",
                view === "index"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-4 w-4" />
              {t.catalog.viewIndex}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {/* Max price */}
          <div className="flex items-center gap-3">
            <span className="label-mono text-muted-foreground">
              {t.catalog.maxPrice}
            </span>
            <div className="flex items-center gap-1">
              {PRICE_STEPS.map((p) => (
                <Pill
                  key={p}
                  active={maxPrice === p}
                  onClick={() => setMaxPrice(p)}
                >
                  {formatEur(p)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Multi-partner toggle */}
          <button
            onClick={() => setMultiOnly((v) => !v)}
            aria-pressed={multiOnly}
            className="label-mono flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
                multiOnly
                  ? "border-primary bg-primary"
                  : "border-foreground/30",
              )}
            >
              {multiOnly && (
                <span className="h-1.5 w-1.5 rounded-[1px] bg-primary-foreground" />
              )}
            </span>
            {t.catalog.bestPriceOnly}
          </button>

          <button
            onClick={reset}
            className="label-mono text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline cursor-pointer"
          >
            {t.catalog.reset}
          </button>

          <span className="label-mono ml-auto text-muted-foreground">
            {filtered.length} {t.catalog.results}
          </span>
        </div>
      </div>

      {/* Results */}
      <div className="mt-10 min-h-[40vh]">
        {filtered.length === 0 ? (
          <p className="font-display py-20 text-center text-2xl text-muted-foreground">
            {t.catalog.empty}
          </p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {view === "index" ? (
                <CarIndex cars={filtered} />
              ) : (
                <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((car, i) => (
                    <CarCard key={car.id} car={car} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "label-mono rounded-full border px-3 py-1.5 transition-colors cursor-pointer",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
