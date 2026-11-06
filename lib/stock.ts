// Stock bookkeeping for product orders. An order takes its units out of stock
// the moment it is placed (`Order.stockReserved`), and gives them back when it
// is cancelled or deleted before it ships.
import type { Prisma } from "@/lib/generated/prisma";

export type StockLine = {
  productId: number | null;
  variantId: number | null;
  quantity: number;
};

/**
 * Take `quantity` units for every line, or none at all. Each decrement is a
 * conditional `stock >= quantity` update, so two checkouts racing for the last
 * unit can't both win. Returns the lines that couldn't be filled, with what is
 * actually left; the caller must roll the transaction back when any come back.
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
): Promise<{ productId: number; variantId: number | null; available: number }[]> {
  const short: { productId: number; variantId: number | null; available: number }[] = [];
  for (const line of lines) {
    if (line.productId === null) continue;
    if (line.variantId !== null) {
      const { count } = await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (count === 0) {
        const row = await tx.productVariant.findUnique({
          where: { id: line.variantId },
          select: { stock: true },
        });
        short.push({ productId: line.productId, variantId: line.variantId, available: row?.stock ?? 0 });
      }
    } else {
      const { count } = await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (count === 0) {
        const row = await tx.product.findUnique({
          where: { id: line.productId },
          select: { stock: true },
        });
        short.push({ productId: line.productId, variantId: null, available: row?.stock ?? 0 });
      }
    }
  }
  return short;
}

/** Put every line's units back. Lines whose product/variant is gone are skipped. */
export async function releaseStock(
  tx: Prisma.TransactionClient,
  lines: StockLine[],
): Promise<void> {
  for (const line of lines) {
    if (line.variantId !== null) {
      await tx.productVariant.updateMany({
        where: { id: line.variantId },
        data: { stock: { increment: line.quantity } },
      });
    } else if (line.productId !== null) {
      await tx.product.updateMany({
        where: { id: line.productId },
        data: { stock: { increment: line.quantity } },
      });
    }
  }
}

/** Merge lines for the same product + variant so stock is checked on the total. */
export function mergeLines<T extends StockLine>(lines: T[]): T[] {
  const merged = new Map<string, T>();
  for (const line of lines) {
    const key = `${line.productId}:${line.variantId ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += line.quantity;
    else merged.set(key, { ...line });
  }
  return [...merged.values()];
}
