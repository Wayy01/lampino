"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  products as allProducts,
  categories,
  type ProductCategory,
} from "@/lib/data/products";
import {
  buildFacets,
  classifyColorTemp,
  classifyLumens,
  classifySocket,
  sortProducts,
  DEFAULT_SORT,
  SORT_KEYS,
  type ColorTempKey,
  type LumensKey,
  type SocketKey,
  type SortKey,
} from "@/lib/filters";
import { useT } from "@/lib/i18n/provider";
import { cn, formatPrice } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductCard } from "./product-card";
import type { Facets } from "@/lib/filters";

const PRICE_STEPS = [200, 500, 1200] as const;
const MAX_PRICE = 1200;

type CatalogProps = {
  initialCategory?: ProductCategory | "all";
  initialMaxPrice?: number;
  initialSort?: SortKey;
  initialColorTemps?: ColorTempKey[];
  initialSockets?: SocketKey[];
  initialLumens?: LumensKey[];
};

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function Catalog({
  initialCategory = "all",
  initialMaxPrice = MAX_PRICE,
  initialSort = DEFAULT_SORT,
  initialColorTemps = [],
  initialSockets = [],
  initialLumens = [],
}: CatalogProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();

  const [category, setCategory] = useState<ProductCategory | "all">(
    initialCategory,
  );
  const [maxPrice, setMaxPrice] = useState<number>(initialMaxPrice);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [colorTemps, setColorTemps] = useState<Set<ColorTempKey>>(
    () => new Set(initialColorTemps),
  );
  const [sockets, setSockets] = useState<Set<SocketKey>>(
    () => new Set(initialSockets),
  );
  const [lumens, setLumens] = useState<Set<LumensKey>>(
    () => new Set(initialLumens),
  );
  const [open, setOpen] = useState(false);

  // Facet options are derived from the data, so empty ones never render.
  const facets = useMemo(() => buildFacets(allProducts), []);

  const filtered = useMemo(() => {
    const list = allProducts.filter((product) => {
      if (category !== "all" && product.category?.slug !== category)
        return false;
      if (product.price > maxPrice) return false;
      if (colorTemps.size) {
        const ct = classifyColorTemp(product.specifications.colorTemp);
        if (!ct || !colorTemps.has(ct)) return false;
      }
      if (sockets.size && !sockets.has(classifySocket(product.specifications.base)))
        return false;
      if (lumens.size) {
        const lm = classifyLumens(product.specifications.lumens);
        if (!lm || !lumens.has(lm)) return false;
      }
      return true;
    });
    return sortProducts(list, sort);
  }, [category, maxPrice, colorTemps, sockets, lumens, sort]);

  // Two-way URL sync: reflect the active filters in the query string so the view
  // survives refresh, back/forward, and can be shared. Defaults are omitted to
  // keep URLs clean.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (maxPrice !== MAX_PRICE) params.set("max", String(maxPrice));
    if (sort !== DEFAULT_SORT) params.set("sort", sort);
    if (colorTemps.size) params.set("color", [...colorTemps].join(","));
    if (sockets.size) params.set("socket", [...sockets].join(","));
    if (lumens.size) params.set("lumens", [...lumens].join(","));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [category, maxPrice, sort, colorTemps, sockets, lumens, pathname, router]);

  const advancedCount =
    colorTemps.size +
    sockets.size +
    lumens.size +
    (maxPrice !== MAX_PRICE ? 1 : 0);

  const isDirty =
    category !== "all" ||
    sort !== DEFAULT_SORT ||
    advancedCount > 0;

  const reset = () => {
    setCategory("all");
    setMaxPrice(MAX_PRICE);
    setSort(DEFAULT_SORT);
    setColorTemps(new Set());
    setSockets(new Set());
    setLumens(new Set());
  };

  // Removable chips for every active advanced filter, visible even when the
  // panel is collapsed so the current state is always legible.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (maxPrice !== MAX_PRICE)
    chips.push({
      key: "price",
      label: `≤ ${formatPrice(maxPrice)}`,
      onRemove: () => setMaxPrice(MAX_PRICE),
    });
  colorTemps.forEach((c) =>
    chips.push({
      key: `color-${c}`,
      label: t.catalog.colorOptions[c],
      onRemove: () => setColorTemps((s) => toggle(s, c)),
    }),
  );
  sockets.forEach((s) =>
    chips.push({
      key: `socket-${s}`,
      label: t.catalog.socketOptions[s],
      onRemove: () => setSockets((prev) => toggle(prev, s)),
    }),
  );
  lumens.forEach((l) =>
    chips.push({
      key: `lumens-${l}`,
      label: t.catalog.brightnessOptions[l],
      onRemove: () => setLumens((prev) => toggle(prev, l)),
    }),
  );

  const panelProps: FiltersPanelProps = {
    t,
    facets,
    category,
    setCategory,
    maxPrice,
    setMaxPrice,
    colorTemps,
    setColorTemps,
    sockets,
    setSockets,
    lumens,
    setLumens,
    isDirty,
    reset,
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
      </div>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-12">
        {/* Desktop: persistent sticky filter panel */}
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
          <FiltersPanel {...panelProps} />
        </aside>

        {/* Main column: toolbar + chips + results */}
        <div className="min-w-0">
          {/* Toolbar: filters (mobile) · sort · reset · count */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border pb-6">
            <button
              onClick={() => setOpen(true)}
              className={cn(
                "label-mono inline-flex items-center gap-2 rounded-full border px-4 py-1.5 transition-colors cursor-pointer lg:hidden",
                advancedCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-foreground/25 bg-foreground/[0.04] text-foreground hover:border-primary hover:text-primary",
              )}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M1 3.5h12M3 7h8M5 10.5h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {t.catalog.filters}
              {advancedCount > 0 && ` (${advancedCount})`}
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span className="label-mono text-muted-foreground">
                {t.catalog.sort}
              </span>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="label-mono h-auto w-auto max-w-full gap-2 rounded-full border-foreground/25 bg-foreground/[0.04] px-4 py-1.5 text-[0.72rem] text-foreground hover:border-primary focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_KEYS.map((k) => (
                    <SelectItem key={k} value={k} className="label-mono">
                      {t.catalog.sortOptions[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isDirty && (
              <button
                onClick={reset}
                className="label-mono text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline cursor-pointer"
              >
                {t.catalog.reset}
              </button>
            )}

            <span className="label-mono ml-auto text-muted-foreground">
              {filtered.length} {t.catalog.results}
            </span>
          </div>

          {/* Applied-filter chips */}
          {chips.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.onRemove}
                  className="label-mono inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-primary transition-colors hover:bg-primary/10 cursor-pointer"
                >
                  {chip.label}
                  <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="mt-10 min-h-[40vh]">
            {filtered.length === 0 ? (
              <p className="font-display py-20 text-center text-2xl text-muted-foreground">
                {t.catalog.empty}
              </p>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3"
              >
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: filter panel behind a slide-in drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="sm:max-w-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-5 pr-14">
            <SheetTitle>{t.catalog.filters}</SheetTitle>
            <span className="label-mono text-muted-foreground">
              {filtered.length} {t.catalog.results}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <FiltersPanel {...panelProps} />
          </div>
          <div className="border-t border-border px-6 py-5">
            <button
              onClick={() => setOpen(false)}
              className="label-mono w-full rounded-full bg-primary px-6 py-3 text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
            >
              {t.catalog.showResults}
              {` (${filtered.length})`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type FiltersPanelProps = {
  t: ReturnType<typeof useT>;
  facets: Facets;
  category: ProductCategory | "all";
  setCategory: (c: ProductCategory | "all") => void;
  maxPrice: number;
  setMaxPrice: (p: number) => void;
  colorTemps: Set<ColorTempKey>;
  setColorTemps: React.Dispatch<React.SetStateAction<Set<ColorTempKey>>>;
  sockets: Set<SocketKey>;
  setSockets: React.Dispatch<React.SetStateAction<Set<SocketKey>>>;
  lumens: Set<LumensKey>;
  setLumens: React.Dispatch<React.SetStateAction<Set<LumensKey>>>;
  isDirty: boolean;
  reset: () => void;
};

function FiltersPanel({
  t,
  facets,
  category,
  setCategory,
  maxPrice,
  setMaxPrice,
  colorTemps,
  setColorTemps,
  sockets,
  setSockets,
  lumens,
  setLumens,
  isDirty,
  reset,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-col gap-7">
      <FacetRow label={t.catalog.category}>
        <Pill active={category === "all"} onClick={() => setCategory("all")}>
          {t.catalog.all}
        </Pill>
        {categories.map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>
            {t.categories[c]}
          </Pill>
        ))}
      </FacetRow>

      <FacetRow label={t.catalog.maxPrice}>
        {PRICE_STEPS.map((p) => (
          <Pill key={p} active={maxPrice === p} onClick={() => setMaxPrice(p)}>
            ≤ {formatPrice(p)}
          </Pill>
        ))}
      </FacetRow>

      {facets.colorTemps.length >= 2 && (
        <FacetRow label={t.catalog.color}>
          {facets.colorTemps.map((c) => (
            <Pill
              key={c}
              active={colorTemps.has(c)}
              onClick={() => setColorTemps((s) => toggle(s, c))}
            >
              {t.catalog.colorOptions[c]}
            </Pill>
          ))}
        </FacetRow>
      )}

      {facets.sockets.length >= 2 && (
        <FacetRow label={t.catalog.socket}>
          {facets.sockets.map((s) => (
            <Pill
              key={s}
              active={sockets.has(s)}
              onClick={() => setSockets((prev) => toggle(prev, s))}
            >
              {t.catalog.socketOptions[s]}
            </Pill>
          ))}
        </FacetRow>
      )}

      {facets.lumens.length >= 2 && (
        <FacetRow label={t.catalog.brightness}>
          {facets.lumens.map((l) => (
            <Pill
              key={l}
              active={lumens.has(l)}
              onClick={() => setLumens((prev) => toggle(prev, l))}
            >
              {t.catalog.brightnessOptions[l]}
            </Pill>
          ))}
        </FacetRow>
      )}

      {isDirty && (
        <button
          onClick={reset}
          className="label-mono self-start text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline cursor-pointer"
        >
          {t.catalog.reset}
        </button>
      )}
    </div>
  );
}

function FacetRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="label-mono text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
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
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
