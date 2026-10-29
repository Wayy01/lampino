"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { slugify } from "@/lib/slug";
import { categorySlug, LOCALES } from "@/lib/i18n/routing";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";

export type CategoryActionState = { ok?: boolean; error?: string } | null;

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
      // The storefront URL slug comes from the name, so a rename moves the
      // category page. Remember the outgoing slugs; the page 308s them on.
      const before = await prisma.category.findUnique({ where: { id } });
      const current = new Set(LOCALES.map((l) => categorySlug(l, { id, name_ro, name_ru })));
      const formerSlugs = before
        ? [
            ...new Set([
              ...before.formerSlugs,
              ...LOCALES.map((l) => categorySlug(l, before)),
            ]),
          ].filter((s) => !current.has(s))
        : [];
      await prisma.category.update({
        where: { id },
        data: { name_ro, name_ru, slug, imageUrl, formerSlugs },
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
