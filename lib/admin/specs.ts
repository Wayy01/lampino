// Bilingual product specifications, stored in the `specifications` Json
// column as `{ [id]: { label_ro, label_ru, value_ro, value_ru } }`.
//
// Legacy rows use the flat shape `{ [key]: "value" }` with the six canonical
// keys translated by the storefront dictionary; `specsFromJson` upgrades them
// on read (labels from the dictionary, the neutral value copied to both
// languages), and the next save persists the bilingual shape.
import { dictionaries } from "@/lib/i18n/dictionaries";
import { slugify } from "@/lib/slug";

export type SpecRow = {
  id: string;
  label_ro: string;
  label_ru: string;
  value_ro: string;
  value_ru: string;
};

type SpecJsonEntry = {
  label_ro?: string;
  label_ru?: string;
  value_ro?: string;
  value_ru?: string;
};

const roLabels = dictionaries.ro.specsLabels as Record<string, string>;
const ruLabels = dictionaries.ru.specsLabels as Record<string, string>;

export function specsFromJson(json: unknown): SpecRow[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, unknown>).map(([id, entry]) => {
    if (typeof entry === "string") {
      // Legacy flat entry: dictionary label when the key is known, else the key.
      return {
        id,
        label_ro: roLabels[id] ?? id,
        label_ru: ruLabels[id] ?? id,
        value_ro: entry,
        value_ru: entry,
      };
    }
    const spec = (entry ?? {}) as SpecJsonEntry;
    return {
      id,
      label_ro: spec.label_ro ?? "",
      label_ru: spec.label_ru ?? "",
      value_ro: spec.value_ro ?? "",
      value_ru: spec.value_ru ?? "",
    };
  });
}

export function specsToJson(
  rows: SpecRow[],
): Record<string, Required<SpecJsonEntry>> {
  const result: Record<string, Required<SpecJsonEntry>> = {};
  rows.forEach((row, index) => {
    const id = slugify(row.id.trim() || row.label_ro.trim()) || `spec-${index + 1}`;
    result[id] = {
      label_ro: row.label_ro.trim(),
      label_ru: row.label_ru.trim(),
      value_ro: row.value_ro.trim(),
      value_ru: row.value_ru.trim(),
    };
  });
  return result;
}

/** True when a draft row carries no content and can be dropped on save. */
export function isEmptySpecRow(row: SpecRow): boolean {
  return !(
    row.id.trim() ||
    row.label_ro.trim() ||
    row.label_ru.trim() ||
    row.value_ro.trim() ||
    row.value_ru.trim()
  );
}
