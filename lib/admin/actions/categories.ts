"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { slugify } from "@/lib/slug";
import { getAdminDict, langFromForm } from "@/lib/admin/i18n";

export type CategoryActionState = { ok?: boolean; error?: string } | null;

export async function saveCategory(
  id: number | null,
  _prev: CategoryActionState,
  fd: FormData,
): Promise<CategoryActionState> {
  await requireAdmin(langFromForm(fd));
  const errors = getAdminDict(langFromForm(fd)).categories.errors;

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
}

export async function deleteCategory(id: number): Promise<void> {
  await requireAdmin();
  // Products and rental packages keep existing but lose the category (SetNull).
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/[lang]/categories", "page");
}

/**
 * Persist the order the admin dragged the list into. Takes the full id list
 * and rewrites `position` to match it, which also normalizes any duplicate or
 * gapped positions left behind by older data.
 */
export async function reorderCategories(ids: number[]): Promise<void> {
  await requireAdmin();
  const ordered = [...new Set(ids.filter((id) => Number.isInteger(id)))];
  const existing = await prisma.category.findMany({ select: { id: true } });
  const known = new Set(existing.map((c) => c.id));
  // Ignore a stale client list rather than renumbering half the table.
  if (ordered.length !== known.size || ordered.some((id) => !known.has(id))) {
    return;
  }

  await prisma.$transaction(
    ordered.map((id, i) =>
      prisma.category.update({ where: { id }, data: { position: i } }),
    ),
  );
  revalidatePath("/admin/[lang]/categories", "page");
}
