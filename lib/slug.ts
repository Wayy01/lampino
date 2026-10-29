// Cosmetic name slugs for SEO/readable URLs. Product URLs carry the id and the
// name slug as separate path segments (`/<lang>/product/<id>/<name-slug>`), and
// lookup ALWAYS uses only the numeric id — the name part is decorative, so
// renaming a product never breaks a link and we never need a `slug` column in
// the database.

const DIACRITICS: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
};

// Russian names get Latin slugs (`/ru/product/24/girlyanda-na-batareykakh`):
// readable in a shared link, and never percent-encoded into an unreadable
// `%D0%B3…` run. A practical BGN/PCGN-style table, not a reversible one.
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (c) => DIACRITICS[c] ?? c)
    .replace(/[а-яё]/g, (c) => CYRILLIC[c] ?? "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function toSlug(id: number, name: string): string {
  const tail = slugify(name);
  return tail ? `${id}-${tail}` : `${id}`;
}

export function parseId(slug: string): number | null {
  const id = Number.parseInt(slug, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Decode a URL slug segment for comparison against `slugify()`'s output.
 * Next's dynamic route params aren't reliably pre-decoded, so a slug that was
 * percent-encoded when built (see `productPath`/`rentalPath`) needs decoding
 * back before a `===` check — otherwise the canonical-slug redirect never
 * matches and loops forever. Falls back to the raw value on malformed input.
 */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
