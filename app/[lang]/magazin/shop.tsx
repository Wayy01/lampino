// The catalog view shared by `/magazin` and its category landing pages
// (`/magazin/<category-slug>`). Everything except the category comes from the
// query string, which the client catalog keeps in sync.
import Link from "next/link";
import { Catalog } from "@/components/site/catalog";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { JsonLd } from "@/components/site/json-ld";
import { RichText } from "@/components/site/rich-text";
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqSchema,
} from "@/lib/schema";
import {
  categoryHref,
  localePath,
  shopHref,
  type Locale,
} from "@/lib/i18n/routing";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { fill, type LocalizedPath } from "@/lib/seo";
import { pick } from "@/lib/utils";
import { forListing } from "@/lib/data/products";
import type { CategoryLandingCopy, CategoryOption, Product } from "@/lib/types";
import {
  COLOR_TEMP_ORDER,
  DEFAULT_SORT,
  isSortKey,
  LUMENS_ORDER,
  PAGE_SIZE,
  priceCeiling,
  SOCKET_ORDER,
  sortProducts,
  type ColorTempKey,
  type LumensKey,
  type SocketKey,
  type SortKey,
} from "@/lib/filters";

export type ShopSearchParams = { [key: string]: string | string[] | undefined };

/** Query params that narrow or reorder the grid — their views canonicalize away. */
const FILTER_PARAMS = ["sort", "max", "color", "socket", "lumens"];

const parseList = <T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
): T[] =>
  (raw ? raw.split(",") : []).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );

/** First value of a query param. */
export function firstParam(sp: ShopSearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** The query string minus `drop` — what a redirect carries over. */
export function queryWithout(sp: ShopSearchParams, drop: string): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === drop || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) out.append(k, item);
  }
  return out.toString();
}

/** Requested page number (1 when absent or malformed). */
export function requestedPage(sp: ShopSearchParams): number {
  const raw = Number(firstParam(sp, "page"));
  return Number.isInteger(raw) && raw > 1 ? raw : 1;
}

/**
 * Canonical path and title suffix for a shop view. A plain `?page=N` is its
 * own canonical page (with "– pagina N" in the title); any sort or filter
 * folds back to the clean listing.
 */
export function shopCanonical(
  lang: Locale,
  base: LocalizedPath,
  sp: ShopSearchParams,
): { path: LocalizedPath; titleSuffix: string; descriptionSuffix: string } {
  const page = requestedPage(sp);
  const filtered = FILTER_PARAMS.some((k) => firstParam(sp, k) !== undefined);
  const label = fill(dictionaries[lang].seo.pageSuffix, { n: page });
  const titleSuffix = page > 1 ? ` – ${label}` : "";
  const descriptionSuffix = page > 1 ? ` ${label[0].toUpperCase()}${label.slice(1)}.` : "";
  if (page === 1 || filtered) return { path: base, titleSuffix, descriptionSuffix };
  const withPage = (p: string) => `${p}?page=${page}`;
  return {
    path: typeof base === "string" ? withPage(base) : { ro: withPage(base.ro), ru: withPage(base.ru) },
    titleSuffix,
    descriptionSuffix,
  };
}

/** Up to three other categories, the ones next to this one in display order first. */
function relatedCategories(all: CategoryOption[], current: CategoryOption): CategoryOption[] {
  const i = all.findIndex((c) => c.id === current.id);
  const others = [...all.slice(i + 1), ...all.slice(0, i)];
  return others.slice(0, 3);
}

export function ShopView({
  lang,
  sp,
  products,
  categoryOptions,
  category,
  landing,
  description,
}: {
  lang: Locale;
  sp: ShopSearchParams;
  products: Product[];
  categoryOptions: CategoryOption[];
  category: CategoryOption | null;
  /** The category's landing copy in `lang`; null on the bare catalog. */
  landing: CategoryLandingCopy | null;
  /** The page's meta description, reused for the CollectionPage node. */
  description: string;
}) {
  const get = (k: string) => firstParam(sp, k);
  const d = dictionaries[lang];

  // A category page only ever shows its own products (picking another category
  // navigates), so only those go to the client — and the price ceiling must be
  // computed from that same list, or the client sees an active price filter.
  const shown = category ? products.filter((p) => p.category?.id === category.id) : products;

  // A shared `max` in the URL is honoured when it's a sane positive value the
  // catalog can actually contain; otherwise fall back to the ceiling (no filter).
  const ceiling = priceCeiling(shown);
  const rawMax = Number(get("max"));
  const initialMaxPrice = rawMax > 0 && rawMax <= ceiling ? rawMax : ceiling;

  const rawSort = get("sort");
  const initialSort: SortKey = isSortKey(rawSort) ? rawSort : DEFAULT_SORT;
  const initialPage = requestedPage(sp);

  const initialColorTemps: ColorTempKey[] = parseList(get("color"), COLOR_TEMP_ORDER);
  const initialSockets: SocketKey[] = parseList(get("socket"), SOCKET_ORDER);
  const initialLumens: LumensKey[] = parseList(get("lumens"), LUMENS_ORDER);

  const name = category ? pick(lang, category.name_ro, category.name_ru) : d.catalog.title;
  const heading = landing?.h1 || name;
  const pagePath = category ? categoryHref(lang, category) : shopHref(lang);

  // The products on the requested page, in the order the grid shows them —
  // what the ItemList describes. (Advanced filters only exist client-side.)
  const listed = sortProducts(shown, initialSort, category !== null);
  const onPage = listed.slice((initialPage - 1) * PAGE_SIZE, initialPage * PAGE_SIZE);

  const trail = [
    { name: d.nav.home, href: localePath(lang) },
    { name: d.nav.products, href: shopHref(lang) },
    ...(category ? [{ name, href: pagePath }] : []),
  ];
  const faq = landing?.faq ?? [];
  const related = category ? relatedCategories(categoryOptions, category) : [];

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <JsonLd
        data={[
          breadcrumbSchema(trail.map((t) => ({ name: t.name, path: t.href }))),
          collectionPageSchema(lang, { name: heading, description, path: pagePath, products: onPage }),
          ...(faq.length > 0 ? [faqSchema(faq.map((f) => ({ q: f.q, a: f.a })))] : []),
        ]}
      />
      <Breadcrumbs items={trail} label={d.catalog.breadcrumb} className="mb-8" />
      <Catalog
        // Each category is its own page: remount so state starts from the URL.
        key={category?.id ?? "all"}
        products={shown.map(forListing)}
        categoryOptions={categoryOptions}
        initialCategory={category?.slug ?? "all"}
        initialMaxPrice={initialMaxPrice}
        initialSort={initialSort}
        initialPage={initialPage}
        initialColorTemps={initialColorTemps}
        initialSockets={initialSockets}
        initialLumens={initialLumens}
        heading={category ? heading : undefined}
        intro={landing?.intro || undefined}
      />

      {landing?.body && (
        <section className="mt-24 border-t border-border pt-14">
          <RichText source={landing.body} lead={false} className="max-w-3xl" />
        </section>
      )}

      {faq.length > 0 && (
        <section className="mt-20 max-w-3xl">
          <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-light tracking-[-0.02em]">
            {d.catalog.faqTitle}
          </h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {faq.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                  <h3>{item.q}</h3>
                  <span aria-hidden className="text-2xl font-light text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 leading-relaxed text-foreground/75">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-label={d.catalog.relatedCategories} className="mt-20">
          <p className="label-mono text-muted-foreground">{d.catalog.relatedCategories}</p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {related.map((c) => (
              <li key={c.id}>
                <Link
                  href={categoryHref(lang, c)}
                  className="inline-flex rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {pick(lang, c.name_ro, c.name_ru)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
