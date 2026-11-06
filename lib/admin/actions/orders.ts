"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { ORDER_STATUSES } from "@/lib/admin/order-status";
import { getAdminDict, langFromForm, type AdminLang } from "@/lib/admin/i18n";
import {
  ActionRefusal,
  runAction,
  runFormAction,
  type ActionResult,
} from "@/lib/admin/errors";
import { releaseStock, reserveStock } from "@/lib/stock";

export type OrderActionState = { ok?: boolean; error?: string } | null;

// Units of a shipped or delivered order have physically left, so deleting
// one of those never puts stock back.
const RESTOCK_ON_DELETE = new Set(["pending", "confirmed"]);

function revalidateStock(): void {
  revalidatePath("/admin/[lang]/orders", "page");
  revalidatePath("/admin/[lang]/orders/[id]", "page");
  revalidatePath("/admin/[lang]/products", "page");
  revalidatePath("/admin/[lang]/products/[id]", "page");
}

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
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          status: true,
          stockReserved: true,
          items: { select: { productId: true, productVariantId: true, quantity: true } },
        },
      });
      const lines = order.items.map((i) => ({
        productId: i.productId,
        variantId: i.productVariantId,
        quantity: i.quantity,
      }));
      let stockReserved = order.stockReserved;

      if (status === "cancelled" && order.stockReserved) {
        // Cancelling gives the units back to the shop.
        await releaseStock(tx, lines);
        stockReserved = false;
      } else if (order.status === "cancelled" && status !== "cancelled") {
        // Reviving a cancelled order takes the units again — or refuses.
        const short = await reserveStock(tx, lines);
        if (short.length > 0) throw new ActionRefusal("insufficientStock");
        stockReserved = true;
      }

      await tx.order.update({ where: { id }, data: { status, stockReserved } });
    });
    revalidateStock();
    return { ok: true };
  });
}

export async function deleteOrder(
  lang: AdminLang,
  id: number,
): Promise<ActionResult> {
  await requireAdmin(lang);
  return runAction(lang, async () => {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          status: true,
          stockReserved: true,
          items: { select: { productId: true, productVariantId: true, quantity: true } },
        },
      });
      if (order.stockReserved && RESTOCK_ON_DELETE.has(order.status)) {
        await releaseStock(
          tx,
          order.items.map((i) => ({
            productId: i.productId,
            variantId: i.productVariantId,
            quantity: i.quantity,
          })),
        );
      }
      await tx.order.delete({ where: { id } }); // items cascade
    });
    revalidateStock();
    redirect(`/admin/${lang}/orders`);
  });
}
