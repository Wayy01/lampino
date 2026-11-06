import { prisma } from "@/lib/prisma";
import { ActionRefusal } from "@/lib/admin/errors";

/**
 * Refuse a save whose category was deleted after the form was opened (another
 * tab, another admin). Without this the insert fails on the foreign key and
 * the admin is told the record is "still referenced", which reads like a
 * delete error and gives no hint what to change.
 */
export async function relationsExist(categoryId: number | null | undefined): Promise<void> {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw new ActionRefusal("relationMissing");
}

/**
 * The checked promotion ids that still exist, as `connect`/`set` targets. A
 * promotion deleted in another tab is simply dropped rather than failing the
 * whole product save.
 */
export async function promotionLinks(ids: number[]): Promise<{ id: number }[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.promotion.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((r) => ({ id: r.id }));
}
