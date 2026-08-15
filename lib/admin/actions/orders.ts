"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { ORDER_STATUSES } from "@/lib/admin/order-status";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import { runAction, runFormAction, type ActionResult } from "@/lib/admin/errors";

export type OrderActionState = { ok?: boolean; error?: string } | null;

export async function updateOrderStatus(
  id: number,
  _prev: OrderActionState,
  fd: FormData,
): Promise<OrderActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const status = String(fd.get("status") ?? "");
    if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
      return { error: getAdminDict(lang).orders.errors.unknownStatus };
    }
    await prisma.order.update({ where: { id }, data: { status } });
    revalidatePath("/admin/[lang]/orders", "page");
    revalidatePath("/admin/[lang]/orders/[id]", "page");
    return { ok: true };
  });
}

export async function deleteOrder(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.order.delete({ where: { id } }); // items cascade
    revalidatePath("/admin/[lang]/orders", "page");
    redirect(`/admin/${lang}/orders`);
  });
}
