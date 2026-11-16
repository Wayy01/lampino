// Order status transitions and the stock that moves with them. Shared by the
// admin status dropdown (lib/admin/actions/orders.ts) and the courier actions
// (lib/admin/actions/shipping.ts), so every path into `confirmed`/`shipped`
// takes the order's units the same way. Plain module — a "use server" file may
// only export async functions.
import type { Prisma } from "@/lib/generated/prisma";
import { releaseStock, reserveStock } from "@/lib/stock";
import { ActionRefusal } from "@/lib/admin/errors";

// Statuses that hold the order's units. Checkout no longer reserves, so stock
// is taken when an order moves here out of pending (or back from cancelled).
export const HOLDS_STOCK = new Set(["confirmed", "shipped", "delivered"]);
// Only orders in the current flow get reserved on the way in; older
// confirmed/shipped rows predate stock tracking and are left alone.
export const RESERVE_FROM = new Set(["pending", "cancelled"]);

/**
 * Move an order to `status`, reserving or releasing its units as the move
 * requires. Must run inside the caller's transaction. A refusal throws an
 * `ActionRefusal` (`orderChanged` / `insufficientStock`), which rolls the
 * transaction back, including any units already taken. A no-op when the order
 * is already in `status`.
 */
export async function changeOrderStatus(
  tx: Prisma.TransactionClient,
  id: number,
  status: string,
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      stockReserved: true,
      items: { select: { productId: true, productVariantId: true, quantity: true } },
    },
  });
  if (status === order.status) return;
  const lines = order.items.map((i) => ({
    productId: i.productId,
    variantId: i.productVariantId,
    quantity: i.quantity,
  }));

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
}
