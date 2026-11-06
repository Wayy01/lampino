// Permanent redirects for URLs from the sites before this one: the Tilda shop
// (`/lamp/tproduct/<tilda-id>-<slug>`, `/outside_garlands`, `/pageNNN.html`)
// and products/rentals deleted from this catalog since launch. The URL lists
// come from the Wayback Machine's index of lampino.md, the names behind the
// deleted ids from its archived pages.
//
// Pure data, no imports: `proxy.ts` reads it on every request. A target names
// a product or category by id rather than by URL, because their canonical
// slugs come from the live names — `/api/legacy` resolves those against the
// database and answers the 301.

export type LegacyTarget =
  | { product: number }
  | { category: number }
  /** Locale-less storefront path: "" (home), "/magazin", "/arenda", ... */
  | { path: string };

/** Request header `proxy.ts` hands the target to `/api/legacy` in: `<lang>:<kind>:<id>`. */
export const LEGACY_HEADER = "x-lampino-legacy";

const SHOP: LegacyTarget = { path: "/magazin" };
const RENTALS: LegacyTarget = { path: "/arenda" };
const HOME: LegacyTarget = { path: "" };

/** Product ids deleted from the database, by what the archived page sold. */
export const DELETED_PRODUCTS: Record<number, LegacyTarget> = {
  9: { product: 12 }, // Becul led (mat) - COLOR - portocaliu
  11: { product: 12 }, // Becul led (mat) - COLOR - galben
  13: { category: 4 }, // Lampa GLASSLIGHT
  16: SHOP, // Vaze 10x10 cm — vases are no longer sold
  17: SHOP, // Vaze 10x15 cm
  18: SHOP, // Vaze 10x20 cm
  36: { product: 56 }, // Corp de iluminat Copac PEARL LEAVES → PEARL
  37: { category: 4 }, // Corp de iluminat RICE-LEAVES
  43: { product: 69 }, // Lumânări electrice în vaze din sticlă (set din 3)
  74: { product: 65 }, // Ghirlandă Cluster 50m, fir cupru subțire
  // Never archived, so what they were is unknown: the catalog is the closest page.
  ...Object.fromEntries(
    [1, 7, 8, 10, 27, 28, 29, 30, 31, 46, 47, 48, 49, 50, 51, 52, 53, 71, 90, 91, 92, 97, 98].map(
      (id) => [id, SHOP],
    ),
  ),
};

/** Rental packages 1–12 (tents, romantic sets, 48h lamp hire) were all retired. */
export const DELETED_RENTALS: Record<number, LegacyTarget> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [i + 1, RENTALS]),
);

/** Tilda store sections (first path segment) → today's category or page. */
const TILDA_SECTIONS: Record<string, LegacyTarget> = {
  batareiki: { category: 7 },
  "christmas-tree-lamp": { category: 4 },
  garlands_batteries: { category: 14 },
  ghirlandidleaiolok: { category: 18 },
  lamp: { category: 2 },
  lumnri: { category: 9 },
  "neon-sign": { category: 5 },
  outside_garlands: { category: 1 },
  "store-curtain": { category: 3 },
  svetiliniki: { category: 4 },
  yolki: { category: 18 },
  store: SHOP,
  "toate-produsele": SHOP,
  tproduct: SHOP,
  "romantic-gifts": SHOP,
  "cina-romantica": RENTALS,
  "romantic-decor": RENTALS,
  "lampino-nunta": RENTALS,
  "galereia-lampino": RENTALS,
  delivery: { path: "/terms" },
  "privacy-policy-ru": { path: "/privacy" },
  "--": HOME,
};

/**
 * Tilda product slugs (transliterated Russian) → today's product, first match
 * wins, so specific patterns sit above general ones. A slug matching nothing
 * falls back to its section.
 */
const TILDA_PRODUCTS: [RegExp, LegacyTarget][] = [
  [/batareiki-aaa/, { product: 21 }],
  [/besplamennie-elektricheskie-svechi/, { category: 9 }],
  [/svetilnik-willow|derevo-svetilnik-willow/, { category: 4 }],
  [/fairy-?lights/, { category: 3 }],
  [/probkovaya-girlyanda|girlyandi-s-probkoi|bottle-lights/, { category: 14 }],
  [/pearl-leaves|derevo-svetilnik-pearl/, { product: 56 }],
  [/filamentnaya-lampa-s14/, { product: 6 }],
  [/svetodiodnaya-lampa/, { product: 12 }],
  [/dekorativnie-elektricheskie-svechi-10-sm/, { product: 42 }],
  [/elektricheskie-svechi-v-steklyannih-vaza/, { product: 69 }],
  [/happy-birthday/, { product: 15 }],
  [/all-you-need-is-love/, { product: 23 }],
  [/patio-casual/, { product: 4 }],
  [/girlyanda-patio/, { product: 67 }],
  [/waterfall/, { product: 14 }],
  [/retro-maxi/, { product: 32 }],
  [/retro-mini/, { product: 35 }],
  [/cluster-na-batareikah/, { product: 20 }],
  [/elastichnoi-niti-cluster/, { product: 39 }],
  [/zanaves-na-tonkoi-niti-sluster/, { product: 55 }],
  [/girlyanda-cluster/, { product: 88 }],
  [/golden-leaves/, { product: 38 }],
  [/na-tonkoi-niti-smart/, { product: 34 }],
  [/na-tonkoi-niti(-rosa)?-na-batarei/, { product: 24 }],
  [/zvezdnii-zanaves|zanaves-na-elastichnoi-niti-star/, { product: 33 }],
  [/zanaves-na-elastichnoi-niti/, { product: 2 }],
  [/zanaves-na-tonkoi-niti/, { product: 22 }],
  [/girlyanda-na-tonkoi-niti/, { product: 19 }],
  [/girlyanda-infinity/, { category: 1 }],
  [/podarochnie-paketi/, { product: 45 }],
  [/vazi/, SHOP],
];

/**
 * Where a legacy URL goes, or `null` when the path isn't one. `pathname` is the
 * raw request path; locale-prefixed paths only match the few renamed pages.
 */
export function legacyTarget(pathname: string): LegacyTarget | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  // Pages renamed under the current locale scheme.
  const local = path.match(/^\/(?:ro|ru)\/(aplica|politica-de-confidentialitate)$/);
  if (local) return local[1] === "aplica" ? RENTALS : { path: "/privacy" };

  // Tilda's standalone pages (`/page25758566.html`) have no known successor.
  if (/^\/page\d+\.html$/.test(path)) return HOME;

  const segments = path.split("/").filter(Boolean);
  const section = TILDA_SECTIONS[segments[0] ?? ""];
  if (!section) return null;

  const tproduct = segments.indexOf("tproduct");
  if (tproduct !== -1 && segments[tproduct + 1]) {
    const slug = segments[tproduct + 1];
    for (const [pattern, target] of TILDA_PRODUCTS) {
      if (pattern.test(slug)) return target;
    }
  }
  return section;
}
