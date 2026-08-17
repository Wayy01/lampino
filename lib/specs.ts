// Public-site specification helpers. Products and rental packages store their
// specs in the `specifications` Json column, in one of three shapes:
//
//   • bilingual (current/prod): `{ [id]: { label_ro, label_ru, value_ro, value_ru } }`
//   • legacy flat:              `{ [key]: "value" }`
//   • legacy flattened (old CMS import — most of the imported catalog):
//     `{ "field_<id>_name_ro": ..., "field_<id>_name_ru": ...,
//        "field_<id>_value_ro": ..., "field_<id>_value_ru": ... }`
//
// `normalizeSpecs` upgrades any of these into the canonical bilingual record so
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

/** Old-CMS labels were authored for inline "Label: value" display and carry a
 * trailing colon; strip it now that label and value render on separate lines. */
const stripTrailingColon = (s: string): string => s.replace(/\s*:\s*$/, "").trim();

// A second legacy shape from the old CMS import: each spec's four fields land
// as separate top-level keys (`field_<id>_name_ro`, `_name_ru`, `_value_ro`,
// `_value_ru`) instead of nested under one id. Almost every product/rental in
// the imported catalog uses this shape.
const FLATTENED_FIELD_KEY = /^field_(\d+)_(name_ro|name_ru|value_ro|value_ru)$/;
type FlattenedPart = "name_ro" | "name_ru" | "value_ro" | "value_ru";

/** Normalize a raw `specifications` Json value into the canonical bilingual record. */
export function normalizeSpecs(json: unknown): Specifications {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const raw = json as Record<string, unknown>;
  const out: Specifications = {};

  // Reassemble the flattened shape first, so its 4 keys-per-spec don't also
  // get picked up individually by the legacy-flat branch below.
  const grouped = new Map<string, Partial<Record<FlattenedPart, string>>>();
  const consumed = new Set<string>();
  for (const [key, value] of Object.entries(raw)) {
    const match = key.match(FLATTENED_FIELD_KEY);
    if (!match || typeof value !== "string") continue;
    consumed.add(key);
    const [, id, part] = match;
    const parts = grouped.get(id) ?? {};
    parts[part as FlattenedPart] = value;
    grouped.set(id, parts);
  }
  for (const [id, parts] of grouped) {
    const label_ro =
      stripTrailingColon(asString(parts.name_ro)) || stripTrailingColon(asString(parts.name_ru));
    const label_ru =
      stripTrailingColon(asString(parts.name_ru)) || stripTrailingColon(asString(parts.name_ro));
    const value_ro = asString(parts.value_ro) || asString(parts.value_ru);
    const value_ru = asString(parts.value_ru) || asString(parts.value_ro);
    if (!value_ro && !value_ru) continue;
    out[`field_${id}`] = {
      label_ro: label_ro || prettifyKey(id),
      label_ru: label_ru || prettifyKey(id),
      value_ro,
      value_ru,
    };
  }

  for (const [id, entry] of Object.entries(raw)) {
    if (consumed.has(id)) continue;
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
