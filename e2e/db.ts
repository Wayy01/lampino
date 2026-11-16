// Direct DB access for the browser tests: arrange state the UI can't (stock
// levels, extra settings rows) and assert on the rows the UI created. Every
// order a test places has a customer name starting with `E2E`, so cleanup can
// find them.
import { createHmac } from "node:crypto";
import { PrismaClient } from "../lib/generated/prisma";
import { releaseStock } from "../lib/stock";

export const prisma = new PrismaClient();

export const E2E = "E2E";

/** A signed `lampino-admin` cookie value for the first admin user. */
export async function adminCookie(): Promise<string> {
  const u = await prisma.adminUser.findFirstOrThrow({ orderBy: { id: "asc" } });
  const payload = Buffer.from(
    JSON.stringify({ userId: u.id, username: u.username, role: u.role, expiresAt: Date.now() + 3600_000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** An in-stock product without variants, and a product with an in-stock variant. */
export async function fixtures() {
  const plain = await prisma.product.findFirstOrThrow({
    where: { isActive: true, hasVariants: false, stock: { gte: 5 } },
    orderBy: { id: "asc" },
  });
  const variant = await prisma.productVariant.findFirstOrThrow({
    where: { stock: { gte: 3 }, product: { isActive: true, hasVariants: true } },
    orderBy: { id: "asc" },
    include: { product: true },
  });
  return { plain, variant };
}

export const stockOf = async (productId: number) =>
  (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;

export const latestOrder = (customerName: string) =>
  prisma.order.findFirst({
    where: { customerName },
    orderBy: { id: "desc" },
    include: { items: true },
  });

/** Delete every test order, giving back units the ones holding stock took. */
export async function cleanupOrders(): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { customerName: { startsWith: E2E } },
    include: { items: true },
  });
  await prisma.$transaction(async (tx) => {
    for (const o of orders) {
      if (o.stockReserved) {
        await releaseStock(
          tx,
          o.items.map((i) => ({ productId: i.productId, variantId: i.productVariantId, quantity: i.quantity })),
        );
      }
      await tx.order.delete({ where: { id: o.id } });
    }
  });
  return orders.length;
}
