// Public-site specification helpers. Products and rental packages store their
// specs in the `specifications` Json column, in one of two shapes:
//
//   • bilingual (current/prod): `{ [id]: { label_ro, label_ru, value_ro, value_ru } }`
//   • legacy flat:              `{ [key]: "value" }`
//
// `normalizeSpecs` upgrades either shape into the canonical bilingual record so
// components only ever deal with `SpecEntry`. Known legacy keys (the lighting
// attributes) pick up their translated labels from the storefront dictionary;
// unknown keys fall back to a prettified version of the key itself.
import type { Locale, SpecEntry, Specifications } from "@/lib/types";
import { dictionaries } from "@/lib/i18n/dictionaries";

const roLabels = dictionaries.ro.specsLabels as Record<string, string>;
const ruLabels = dictionaries.ru.specsLabels as Record<string, string>;

/** "colorTemp" → "Color temp", "power-draw" → "Power draw". */
function prettifyKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Normalize a raw `specifications` Json value into the canonical bilingual record. */
export function normalizeSpecs(json: unknown): Specifications {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Specifications = {};
  for (const [id, entry] of Object.entries(json as Record<string, unknown>)) {
    if (typeof entry === "string") {
      // Legacy flat entry: dictionary label when the key is known, else prettified.
      const value = entry.trim();
      if (!value) continue;
      out[id] = {
        label_ro: roLabels[id] ?? prettifyKey(id),
        label_ru: ruLabels[id] ?? prettifyKey(id),
        value_ro: value,
        value_ru: value,
      };
      continue;
    }
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      const spec: SpecEntry = {
        label_ro: asString(e.label_ro) || roLabels[id] || prettifyKey(id),
        label_ru: asString(e.label_ru) || ruLabels[id] || prettifyKey(id),
        value_ro: asString(e.value_ro) || asString(e.value_ru),
        value_ru: asString(e.value_ru) || asString(e.value_ro),
      };
      // Drop entries with no value in either language.
      if (spec.value_ro || spec.value_ru) out[id] = spec;
    }
  }
  return out;
}

/** Ordered `[id, entry]` pairs (Json insertion order is preserved). */
export function specList(specs: Specifications): [string, SpecEntry][] {
  return Object.entries(specs);
}

export function specLabel(entry: SpecEntry, lang: Locale): string {
  return lang === "ru" ? entry.label_ru || entry.label_ro : entry.label_ro || entry.label_ru;
}

export function specValue(entry: SpecEntry, lang: Locale): string {
  return lang === "ru" ? entry.value_ru || entry.value_ro : entry.value_ro || entry.value_ru;
}

/** Raw value for a given spec key in a locale-neutral way — used by catalog facets. */
export function rawSpecValue(specs: Specifications, key: string): string | undefined {
  const entry = specs[key];
  if (!entry) return undefined;
  return entry.value_ro || entry.value_ru || undefined;
}
