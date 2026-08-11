// Cosmetic name slugs for SEO/readable URLs. Product URLs carry the id and the
// name slug as separate path segments (`/<lang>/product/<id>/<name-slug>`), and
// lookup ALWAYS uses only the numeric id — the name part is decorative, so
// renaming a product never breaks a link and we never need a `slug` column in
// the database. (`toSlug`/`parseId` remain for the legacy combined "<id>-<name>"
// form still used by the mock data-access layer.)

const DIACRITICS: Record<string, string> = {
  ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (c) => DIACRITICS[c] ?? c)
    .replace(/[^a-z0-9а-я\s-]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function toSlug(id: number, name: string): string {
  const tail = slugify(name);
  return tail ? `${id}-${tail}` : `${id}`;
}

export function parseId(slug: string): number | null {
  const id = Number.parseInt(slug, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
