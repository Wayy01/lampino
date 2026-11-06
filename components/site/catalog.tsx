"use client";

import { rememberShopQuery } from "@/lib/shop-return";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { ProductCategory } from "@/lib/data/products";
import type { CategoryOption, Locale, Product } from "@/lib/types";
import {
  buildFacets,
  classifyColorTemp,
  classifyLumens,
  classifySocket,
  effectivePrice,
  priceCeiling,
  priceSteps,
  sortProducts,
  DEFAULT_SORT,
  PAGE_SIZE,
  SORT_KEYS,
  type ColorTempKey,
  type LumensKey,
  type SocketKey,
  type SortKey,
} from "@/lib/filters";
import { rawSpecValue } from "@/lib/specs";
import { useLang, useT } from "@/lib/i18n/provider";
import { categoryHref, shopHref } from "@/lib/i18n/routing";
import { cn, formatPrice, pick } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ProductCardTile } from "./product-card-tile";
import type { Facets } from "@/lib/filters";

type CatalogProps = {
  products: Product[];
  categoryOptions: CategoryOption[];
  initialCategory?: ProductCategory | "all";
  initialMaxPrice?: number;
  initialSort?: SortKey;
  initialPage?: number;
  initialColorTemps?: ColorTempKey[];
  initialSockets?: SocketKey[];
  initialLumens?: LumensKey[];
  /** Landing-page H1 and intro, server-written; default to the catalog title. */
  heading?: string;
  intro?: string;
};

// Compact, ellipsis-aware page window: always shows first/last and a neighbour
// on each side of the current page.
function pageList(current: number, total: number): (number | "…")[] {
  const wanted = new Set([1, total, current, current - 1, current + 1]);
  const pages = [...wanted]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function Catalog({
  products,
  categoryOptions,
  initialCategory = "all",
  initialMaxPrice,
  initialSort = DEFAULT_SORT,
  initialPage = 1,
  initialColorTemps = [],
  initialSockets = [],
  initialLumens = [],
  heading,
  intro,
}: CatalogProps) {
  const t = useT();
  const { lang } = useLang();

  // The max-price ceiling and its pills are derived from the live catalog, so the
  // priciest product is always reachable — no hardcoded cap can hide it.
  const priceCap = useMemo(() => priceCeiling(products), [products]);
  const steps = useMemo(() => priceSteps(priceCap), [priceCap]);

  // The category is the page (`/magazin/<slug>`): picking another one navigates,
  // and ShopView remounts the catalog per category, so it never changes here.
  const category: ProductCategory | "all" = initialCategory;
  const [maxPrice, setMaxPrice] = useState<number>(initialMaxPrice ?? priceCap);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [page, setPage] = useState<number>(initialPage);
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
  const resultsRef = useRef<HTMLDivElement>(null);

  // Paging swaps the whole grid under the reader, so send them back to the top
  // of the results. Only the pagination controls call this — a filter change
  // also resets to page 1, but yanking the view while someone is working the
  // filter panel would be worse than leaving it alone.
  const [hasPaged, setHasPaged] = useState(false);
  const goToPage = (p: number) => {
    setHasPaged(true);
    setPage(p);
    resultsRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  };

  // Any filter change resets pagination to the first page. Wrap the raw setters
  // so callers (panel + chips) get this for free.
  const changeMaxPrice = (p: number) => {
    setMaxPrice(p);
    setPage(1);
  };
  const changeSort = (s: SortKey) => {
    setSort(s);
    setPage(1);
  };
  const changeColorTemps: typeof setColorTemps = (v) => {
    setColorTemps(v);
    setPage(1);
  };
  const changeSockets: typeof setSockets = (v) => {
    setSockets(v);
    setPage(1);
  };
  const changeLumens: typeof setLumens = (v) => {
    setLumens(v);
    setPage(1);
  };

  // Facet options are derived from the data, so empty ones never render.
  const facets = useMemo(() => buildFacets(products), [products]);

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      if (category !== "all" && product.category?.slug !== category)
        return false;
      if (effectivePrice(product) > maxPrice) return false;
      if (colorTemps.size) {
        const ct = classifyColorTemp(
          rawSpecValue(product.specifications, "colorTemp"),
        );
        if (!ct || !colorTemps.has(ct)) return false;
      }
      if (
        sockets.size &&
        !sockets.has(classifySocket(rawSpecValue(product.specifications, "base")))
      )
        return false;
      if (lumens.size) {
        const lm = classifyLumens(rawSpecValue(product.specifications, "lumens"));
        if (!lm || !lumens.has(lm)) return false;
      }
      return true;
    });
    return sortProducts(list, sort, category !== "all");
  }, [products, category, maxPrice, colorTemps, sockets, lumens, sort]);

  // Pagination is derived from the filtered list; `currentPage` is clamped so a
  // shrinking result set never leaves us on an empty page. (Every filter change
  // also resets `page` to 1 via the change* setters, so the clamp only guards
  // transient renders.)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const activeCategory =
    category === "all" ? null : categoryOptions.find((c) => c.slug === category) ?? null;

  // Reflect the active filters in the URL so the view survives refresh,
  // back/forward, and can be shared. The category is the path — each one has its
  // own landing page (`/magazin/<slug>`) — and everything else is the query.
  // When any of those is active, sort + page are surfaced too so the URL is a
  // complete snapshot (e.g. /magazin/ghirlande-de-interior?sort=featured&page=1).
  //
  // We update the URL with history.replaceState (a pure client-side history edit)
  // rather than router.replace: the catalog filters entirely on the client, so a
  // server round-trip is wasteful — and on a `force-dynamic` route it would also
  // hand back fresh `products`/`categoryOptions` arrays, re-firing this effect in
  // an endless replace loop. The guard skips no-op writes for good measure.
  const queryFor = (pageNumber: number) => {
    const params = new URLSearchParams();
    if (maxPrice !== priceCap) params.set("max", String(maxPrice));
    if (colorTemps.size) params.set("color", [...colorTemps].join(","));
    if (sockets.size) params.set("socket", [...sockets].join(","));
    if (lumens.size) params.set("lumens", [...lumens].join(","));

    // Defaults stay out of the URL, so page two is plainly `?page=2` — the
    // self-canonical form the page's metadata declares.
    if (sort !== DEFAULT_SORT) params.set("sort", sort);
    if (pageNumber > 1) params.set("page", String(pageNumber));
    return params.toString();
  };
  const urlFor = (pageNumber: number) => {
    const qs = queryFor(pageNumber);
    return activeCategory ? categoryHref(lang, activeCategory, qs) : shopHref(lang, qs);
  };

  useEffect(() => {
    const qs = queryFor(currentPage);
    // "Back to store" rebuilds the URL from this, so the category rides along
    // as an id: the slug differs per locale.
    rememberShopQuery(
      [activeCategory && `category=${activeCategory.id}`, qs].filter(Boolean).join("&"),
    );
    const target = urlFor(currentPage);
    if (target !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", target);
    }
    // queryFor/urlFor are re-created every render and read only the state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeCategory,
    lang,
    maxPrice,
    priceCap,
    sort,
    currentPage,
    colorTemps,
    sockets,
    lumens,
  ]);

  const advancedCount =
    colorTemps.size +
    sockets.size +
    lumens.size +
    (maxPrice !== priceCap ? 1 : 0);

  // Reset clears the filters on top of the page; the category itself stays.
  const isDirty = sort !== DEFAULT_SORT || advancedCount > 0;

  const reset = () => {
    setMaxPrice(priceCap);
    setSort(DEFAULT_SORT);
    setColorTemps(new Set());
    setSockets(new Set());
    setLumens(new Set());
    setPage(1);
  };

  // Removable chips for every active advanced filter, visible even when the
  // panel is collapsed so the current state is always legible.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (maxPrice !== priceCap)
    chips.push({
      key: "price",
      label: `≤ ${formatPrice(maxPrice)}`,
      onRemove: () => changeMaxPrice(priceCap),
    });
  colorTemps.forEach((c) =>
    chips.push({
      key: `color-${c}`,
      label: t.catalog.colorOptions[c],
      onRemove: () => changeColorTemps((s) => toggle(s, c)),
    }),
  );
  sockets.forEach((s) =>
    chips.push({
      key: `socket-${s}`,
      label: t.catalog.socketOptions[s],
      onRemove: () => changeSockets((prev) => toggle(prev, s)),
    }),
  );
  lumens.forEach((l) =>
    chips.push({
      key: `lumens-${l}`,
      label: t.catalog.brightnessOptions[l],
      onRemove: () => changeLumens((prev) => toggle(prev, l)),
    }),
  );

  const panelProps: FiltersPanelProps = {
    t,
    lang,
    categoryOptions,
    facets,
    category,
    maxPrice,
    setMaxPrice: changeMaxPrice,
    priceSteps: steps,
    colorTemps,
    setColorTemps: changeColorTemps,
    sockets,
    setSockets: changeSockets,
    lumens,
    setLumens: changeLumens,
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
          {heading ??
            (activeCategory
              ? pick(lang, activeCategory.name_ro, activeCategory.name_ru)
              : t.catalog.title)}
        </h1>
        {intro && (
          <p className="mt-6 text-base leading-relaxed text-foreground/75 md:text-lg">
            {intro}
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[320px_1fr] lg:items-start lg:gap-12">
        {/* Desktop: persistent sticky filter panel */}
        <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
          <div className="rounded-[var(--radius-lg)] border border-white/50 bg-surface/55 p-6 shadow-[0_8px_32px_-12px_rgba(20,17,15,0.18)] ring-1 ring-foreground/[0.06] backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-2.5 border-b border-border pb-4">
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M1 3.5h12M3 7h8M5 10.5h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="label-mono text-foreground">
                {t.catalog.filters}
              </span>
              {advancedCount > 0 && (
                <span className="label-mono ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-primary-foreground">
                  {advancedCount}
                </span>
              )}
            </div>
            <FiltersPanel {...panelProps} />
          </div>
        </aside>

        {/* Main column: toolbar + chips + results */}
        <div className="min-w-0">
          {/* Toolbar: filters (mobile) · sort · reset · count */}
          {/* A fixed two-row grid on phones (filters · sort, then the count):
              a free-wrapping row changed height when the web font swapped in,
              shoving the whole product grid down (layout shift). */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border pb-6 sm:flex sm:flex-wrap sm:gap-x-5">
            <Button
              variant="bare"
              size="none"
              pill
              onClick={() => setOpen(true)}
              className={cn(
                "label-mono shrink-0 border px-4 py-1.5 lg:hidden",
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
            </Button>

            {/* No "Sort" label on phones: the row is too narrow for it. */}
            <div className="flex min-w-0 items-center gap-2">
              <span className="label-mono hidden shrink-0 text-muted-foreground sm:inline">
                {t.catalog.sort}
              </span>
              <Select
                value={sort}
                onValueChange={(v) => changeSort(v as SortKey)}
              >
                <SelectTrigger
                  aria-label={t.catalog.sort}
                  className="label-mono h-auto w-auto min-w-0 max-w-full gap-2 [&>span]:truncate rounded-full border-foreground/25 bg-foreground/[0.04] px-4 py-1.5 text-[0.72rem] text-foreground hover:border-primary focus:ring-0"
                >
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
              <Button variant="quiet" size="none" onClick={reset}>
                {t.catalog.reset}
              </Button>
            )}

            <span className="label-mono col-span-2 text-muted-foreground sm:ml-auto">
              {filtered.length} {t.catalog.results}
            </span>
          </div>

          {/* Applied-filter chips */}
          {chips.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <Button
                  key={chip.key}
                  variant="chip"
                  size="chip"
                  pill
                  onClick={chip.onRemove}
                >
                  {chip.label}
                  <span aria-hidden>✕</span>
                </Button>
              ))}
            </div>
          )}

          {/* Results. `scroll-mt-32` keeps the fixed navbar + promo banner from
              covering the top row when `goToPage` scrolls back up. */}
          <div ref={resultsRef} className="mt-10 min-h-[40vh] scroll-mt-32">
            {filtered.length === 0 ? (
              <p className="font-display py-20 text-center text-2xl text-muted-foreground">
                {t.catalog.empty}
              </p>
            ) : (
              <motion.div
                key={currentPage}
                // The first grid is server HTML and must paint as-is; only a
                // page change animates.
                initial={hasPaged ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 xl:grid-cols-3"
              >
                {paged.map((product, i) => (
                  <ProductCardTile
                    key={product.id}
                    product={product}
                    index={i}
                    aboveFold={!hasPaged && i < 4}
                    lcp={!hasPaged && i < 2}
                  />
                ))}
              </motion.div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-16 flex items-center justify-center gap-2"
            >
              <PageButton
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
                aria-label={t.catalog.prevPage}
              >
                ‹
              </PageButton>
              {pageList(currentPage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="label-mono px-1 text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <PageButton
                    key={p}
                    active={p === currentPage}
                    // A real link so crawlers reach products past page one.
                    href={urlFor(p)}
                    onClick={() => goToPage(p)}
                    aria-current={p === currentPage ? "page" : undefined}
                  >
                    {p}
                  </PageButton>
                ),
              )}
              <PageButton
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
                aria-label={t.catalog.nextPage}
              >
                ›
              </PageButton>
            </nav>
          )}
        </div>
      </div>

      {/* Mobile: filter panel behind a slide-in drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        {/* Solid on phones — a translucent panel makes the filter text hard to
            read over a scrolling product grid. Glass only from `lg` up. */}
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="border-border bg-surface sm:max-w-md lg:border-white/40 lg:bg-surface/70 lg:backdrop-blur-2xl"
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
            <Button
              size="none"
              pill
              onClick={() => setOpen(false)}
              className="label-mono w-full px-6 py-3"
            >
              {t.catalog.showResults}
              {` (${filtered.length})`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type FiltersPanelProps = {
  t: ReturnType<typeof useT>;
  lang: Locale;
  categoryOptions: CategoryOption[];
  facets: Facets;
  category: ProductCategory | "all";
  maxPrice: number;
  setMaxPrice: (p: number) => void;
  priceSteps: number[];
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
  lang,
  categoryOptions,
  facets,
  category,
  maxPrice,
  setMaxPrice,
  priceSteps,
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
    <div className="flex flex-col divide-y divide-border">
      {/* Categories read as a plain vertical list: the names are real words in
          two languages, so the uppercase mono pills used for the short facets
          below were the hardest thing in the panel to scan. */}
      <FacetRow label={t.catalog.category} stack>
        <CategoryRow active={category === "all"} href={shopHref(lang)}>
          {t.catalog.all}
        </CategoryRow>
        {categoryOptions.map((c) => (
          <CategoryRow
            key={c.id}
            active={category === c.slug}
            href={categoryHref(lang, c)}
          >
            {pick(lang, c.name_ro, c.name_ru)}
          </CategoryRow>
        ))}
      </FacetRow>

      <FacetRow label={t.catalog.maxPrice}>
        {priceSteps.map((p) => (
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
        <Button variant="quiet" size="none" onClick={reset} className="self-start pt-5">
          {t.catalog.reset}
        </Button>
      )}
    </div>
  );
}

function FacetRow({
  label,
  children,
  stack = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Full-width vertical list instead of wrapping pills. */
  stack?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
      <span className="label-mono text-foreground">{label}</span>
      <div
        className={cn(
          stack
            ? "flex flex-col gap-1.5"
            : "flex flex-wrap items-center gap-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * One line of the category list. Reads as text rather than as a chip — normal
 * sentence case, sans-serif — but each line carries the same bordered surface
 * as the facet pills below it, so the list scans as a set of controls instead
 * of a paragraph. Selected is a solid primary fill.
 */
// A link to the category's landing page: each category has its own server-
// rendered intro, description and FAQ, so picking one is a navigation.
function CategoryRow({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center justify-start rounded-[var(--radius-sm)] border px-3 py-2 text-left text-sm font-normal leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary font-medium text-primary-foreground shadow-[0_1px_6px_-1px_var(--primary)]"
          : "border-foreground/15 bg-foreground/[0.035] text-foreground hover:border-primary hover:bg-primary/[0.07] hover:text-primary",
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </Link>
  );
}

function PageButton({
  active = false,
  disabled = false,
  href,
  onClick,
  children,
  ...rest
}: {
  active?: boolean;
  disabled?: boolean;
  /** Renders a link (plain clicks still page in place). */
  href?: string;
  onClick: () => void;
  children: React.ReactNode;
} & React.AriaAttributes) {
  const className = cn(
    "label-mono h-9 min-w-9 border px-3",
    disabled
      ? "cursor-not-allowed border-foreground/10 text-muted-foreground/40"
      : active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-foreground/20 text-foreground/70 hover:border-primary hover:text-primary",
  );
  if (href && !disabled) {
    return (
      <a
        href={href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onClick();
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...rest}
      >
        {children}
      </a>
    );
  }
  return (
    <Button
      variant="bare"
      size="none"
      pill
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...rest}
    >
      {children}
    </Button>
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
    <Button
      variant="bare"
      size="chip"
      pill
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "label-mono border",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[0_1px_6px_-1px_var(--primary)]"
          : "border-foreground/30 text-foreground/85 hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </Button>
  );
}
