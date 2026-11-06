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
// Statuses that hold the order's units. Checkout no longer reserves, so stock
// is taken when an order moves here out of pending (or back from cancelled).
const HOLDS_STOCK = new Set(["confirmed", "shipped", "delivered"]);
// Only orders in the current flow get reserved on the way in; older
// confirmed/shipped rows predate stock tracking and are left alone.
const RESERVE_FROM = new Set(["pending", "cancelled"]);

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
      if (status === order.status) return;

      let stockReserved = order.stockReserved;
      const take = HOLDS_STOCK.has(status) && !order.stockReserved && RESERVE_FROM.has(order.status);
      const give = (status === "cancelled" || status === "pending") && order.stockReserved;
      if (take) stockReserved = true;
      if (give) stockReserved = false;

      // Conditional on what we just read: the row lock makes a second tab's
      // concurrent change wait, then match nothing, so stock moves only once.
      const { count } = await tx.order.updateMany({
        where: { id, status: order.status, stockReserved: order.stockReserved },
        data: { status, stockReserved },
      });
      if (count !== 1) throw new ActionRefusal("orderChanged");

      if (take) {
        const short = await reserveStock(tx, lines);
        if (short.length > 0) throw new ActionRefusal("insufficientStock");
      }
      if (give) await releaseStock(tx, lines);
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
      const { count } = await tx.order.deleteMany({
        where: { id, status: order.status, stockReserved: order.stockReserved },
      }); // items cascade
      if (count !== 1) throw new ActionRefusal("orderChanged");
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
    });
    revalidateStock();
    redirect(`/admin/${lang}/orders`);
  });
}
