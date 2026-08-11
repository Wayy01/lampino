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

export async function moveCategory(
  id: number,
  direction: "up" | "down",
): Promise<void> {
  await requireAdmin();
  const ordered = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
  const index = ordered.findIndex((c) => c.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= ordered.length) return;

  // Normalize positions to indexes while swapping, in case of duplicates.
  const next = [...ordered];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  await prisma.$transaction(
    next.map((c, i) =>
      prisma.category.update({ where: { id: c.id }, data: { position: i } }),
    ),
  );
  revalidatePath("/admin/[lang]/categories", "page");
}
