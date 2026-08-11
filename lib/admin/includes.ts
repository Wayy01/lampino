// The rental `includes_ro` / `includes_ru` columns are Json string arrays —
// the checklist shown on a package page. Same read/write contract the
// storefront uses in lib/data/rentals.ts.

export function includesFromJson(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
}

export function includesToJson(rows: string[]): string[] {
  return rows.map((row) => row.trim()).filter((row) => row.length > 0);
}
