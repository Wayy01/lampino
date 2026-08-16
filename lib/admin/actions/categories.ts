"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { slugify } from "@/lib/slug";
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
      await prisma.category.update({
        where: { id },
        data: { name_ro, name_ru, slug, imageUrl },
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
    await prisma.category.delete({ where: { id } });
    revalidatePath("/admin/[lang]/categories", "page");
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
