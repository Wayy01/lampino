"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { slugify } from "@/lib/slug";
import { categorySlug, LOCALES } from "@/lib/i18n/routing";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import { isAllowedImageUrl } from "@/lib/admin/validate";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";

export type CategoryActionState = { ok?: boolean; error?: string } | null;

type SlugSource = Parameters<typeof categorySlug>[1] & { formerSlugs: string[] };

/**
 * The storefront URL slug comes from the name (or the admin override), so a
 * rename moves the landing page. Remember the outgoing slugs — the page 308s
 * them to the current one — and forget any that are current again.
 */
function formerSlugsAfter(before: SlugSource, after: Parameters<typeof categorySlug>[1]): string[] {
  const current = new Set(LOCALES.map((l) => categorySlug(l, after)));
  return [
    ...new Set([...before.formerSlugs, ...LOCALES.map((l) => categorySlug(l, before))]),
  ].filter((s) => !current.has(s));
}

/**
 * The storefront landing slug `after` would get that another category already
 * answers to, or null. Two categories can't share `/magazin/<slug>`.
 */
async function landingSlugClash(
  id: number | null,
  after: Parameters<typeof categorySlug>[1],
): Promise<string | null> {
  const others = await prisma.category.findMany({ where: id === null ? {} : { id: { not: id } } });
  for (const l of LOCALES) {
    const mine = categorySlug(l, after);
    if (others.some((o) => categorySlug(l, o) === mine)) return mine;
  }
  return null;
}

/** `[{ q, a }]` from the FAQ editor's hidden JSON field. */
function faqFromForm(fd: FormData, key: string): Prisma.InputJsonValue {
  try {
    const rows: unknown = JSON.parse(String(fd.get(key) ?? "[]"));
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r) => ({
        q: typeof r?.q === "string" ? r.q.trim() : "",
        a: typeof r?.a === "string" ? r.a.trim() : "",
      }))
      .filter((r) => r.q && r.a);
  } catch {
    return [];
  }
}

/** Landing-page SEO content (`/admin/<lang>/categories/<id>`). */
export async function saveCategorySeo(
  id: number,
  _prev: CategoryActionState,
  fd: FormData,
): Promise<CategoryActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const dict = getAdminDict(lang);
    const errors = dict.categories.errors;
    const field = (key: string) => String(fd.get(key) ?? "").trim();
    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) return { error: dict.errors.recordMissing };

    const urlSlug_ro = slugify(field("urlSlug_ro"));
    const urlSlug_ru = slugify(field("urlSlug_ru"));
    const after = { ...before, urlSlug_ro, urlSlug_ru };

    const clash = await landingSlugClash(id, after);
    if (clash) return { error: `${errors.slugInUse} (${clash})` };

    const ogImageUrl = field("ogImageUrl") || null;
    if (ogImageUrl && !isAllowedImageUrl(ogImageUrl)) {
      return { error: dict.errors.invalidMediaUrl };
    }

    await prisma.category.update({
      where: { id },
      data: {
        urlSlug_ro,
        urlSlug_ru,
        formerSlugs: formerSlugsAfter(before, after),
        seoTitle_ro: field("seoTitle_ro"),
        seoTitle_ru: field("seoTitle_ru"),
        seoDescription_ro: field("seoDescription_ro"),
        seoDescription_ru: field("seoDescription_ru"),
        h1_ro: field("h1_ro"),
        h1_ru: field("h1_ru"),
        intro_ro: field("intro_ro"),
        intro_ru: field("intro_ru"),
        body_ro: field("body_ro"),
        body_ru: field("body_ru"),
        faq_ro: faqFromForm(fd, "faq_ro"),
        faq_ru: faqFromForm(fd, "faq_ru"),
        ogImageUrl,
      },
    });

    revalidatePath("/admin/[lang]/categories", "page");
    revalidatePath("/admin/[lang]/categories/[id]", "page");
    return { ok: true };
  });
}

export async function saveCategory(
  id: number | null,
  _prev: CategoryActionState,
  fd: FormData,
): Promise<CategoryActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const errors = getAdminDict(lang).categories.errors;

    const name_ro = String(fd.get("name_ro") ?? "").trim();
    const name_ru = String(fd.get("name_ru") ?? "").trim();
    if (!name_ro || !name_ru) return { error: errors.namesRequired };

    const slug = slugify(String(fd.get("slug") ?? "").trim() || name_ro);
    if (!slug) return { error: errors.slugEmpty };

    const clash = await prisma.category.findUnique({ where: { slug } });
    if (clash && clash.id !== id) return { error: `${errors.slugInUse} (${slug})` };

    const imageUrl = String(fd.get("imageUrl") ?? "").trim() || null;
    if (imageUrl && !isAllowedImageUrl(imageUrl)) {
      return { error: getAdminDict(lang).errors.invalidMediaUrl };
    }

    // A rename moves the storefront landing URL; it must not land on another
    // category's (by name or by its SEO slug override).
    const before = id === null ? null : await prisma.category.findUnique({ where: { id } });
    if (id !== null && !before) return { error: getAdminDict(lang).errors.recordMissing };
    const landingClash = await landingSlugClash(id, {
      id: id ?? 0,
      name_ro,
      name_ru,
      urlSlug_ro: before?.urlSlug_ro ?? "",
      urlSlug_ru: before?.urlSlug_ru ?? "",
    });
    if (landingClash) return { error: `${errors.slugInUse} (${landingClash})` };

    if (id === null) {
      const last = await prisma.category.aggregate({ _max: { position: true } });
      await prisma.category.create({
        data: {
          name_ro,
          name_ru,
          slug,
          imageUrl,
          position: (last._max.position ?? -1) + 1,
        },
      });
    } else {
      await prisma.category.update({
        where: { id },
        data: {
          name_ro,
          name_ru,
          slug,
          imageUrl,
          ...(before && { formerSlugs: formerSlugsAfter(before, { ...before, name_ro, name_ru }) }),
        },
      });
    }

    revalidatePath("/admin/[lang]/categories", "page");
    return { ok: true };
  });
}

export async function deleteCategory(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    // Products and rental packages keep existing but lose the category (SetNull).
    // The homepage and special-offers settings hold category ids as plain
    // columns with no foreign key, so clear them here in the same transaction —
    // otherwise those sections filter by a dead id and render empty, and the
    // admin selects keep re-posting it.
    await prisma.$transaction(async (tx) => {
      const settings = await tx.homepageSettings.findMany({
        select: { id: true, featuredCategoryIds: true },
      });
      for (const s of settings) {
        const ids = Array.isArray(s.featuredCategoryIds) ? s.featuredCategoryIds : [];
        const kept = ids.filter((v) => Number(v) !== id);
        if (kept.length !== ids.length) {
          await tx.homepageSettings.update({
            where: { id: s.id },
            data: { featuredCategoryIds: kept as Prisma.InputJsonValue },
          });
        }
      }
      await tx.homepageSettings.updateMany({
        where: { featuredProductsCategoryId: id },
        data: { featuredProductsCategoryId: null },
      });
      await tx.homepageSettings.updateMany({
        where: { featuredRentalsCategoryId: id },
        data: { featuredRentalsCategoryId: null },
      });
      await tx.specialOffersPage.updateMany({
        where: { filterByCategoryId: id },
        data: { filterByCategoryId: null },
      });
      await tx.category.delete({ where: { id } });
    });
    revalidatePath("/admin/[lang]/categories", "page");
    revalidatePath("/admin/[lang]/homepage", "page");
  });
}

/**
 * Persist the order the admin dragged the list into. Takes the full id list
 * and rewrites `position` to match it, which also normalizes any duplicate or
 * gapped positions left behind by older data.
 */
export async function reorderCategories(
  lang: AdminLang,
  ids: number[],
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    const ordered = [...new Set(ids.filter((id) => Number.isInteger(id)))];
    const existing = await prisma.category.findMany({ select: { id: true } });
    const known = new Set(existing.map((c) => c.id));
    // A stale client list is refused rather than renumbering half the table —
    // and now says so, instead of letting the new order silently revert on the
    // next load.
    if (ordered.length !== known.size || ordered.some((id) => !known.has(id))) {
      throw new ActionRefusal("reorderStale");
    }

    await prisma.$transaction(
      ordered.map((id, i) =>
        prisma.category.update({ where: { id }, data: { position: i } }),
      ),
    );
    revalidatePath("/admin/[lang]/categories", "page");
  });
}

/**
 * Persist the order the admin dragged a category's products into
 * (`/admin/<lang>/categories/<id>/products`). Same contract as
 * `reorderCategories`: the full id list of the category's (non-deleted)
 * products, refused when it no longer matches the table.
 */
export async function reorderCategoryProducts(
  lang: AdminLang,
  categoryId: number,
  ids: number[],
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    const ordered = [...new Set(ids.filter((id) => Number.isInteger(id)))];
    const existing = await prisma.product.findMany({
      where: { categoryId, deletedAt: null },
      select: { id: true },
    });
    const known = new Set(existing.map((p) => p.id));
    if (ordered.length !== known.size || ordered.some((id) => !known.has(id))) {
      throw new ActionRefusal("reorderStale");
    }

    await prisma.$transaction(
      ordered.map((id, i) =>
        prisma.product.update({ where: { id }, data: { categoryOrder: i } }),
      ),
    );
    revalidatePath("/admin/[lang]/categories/[id]/products", "page");
  });
}
