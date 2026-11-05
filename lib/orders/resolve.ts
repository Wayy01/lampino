// Shared order resolution: turn a list of requested product lines into priced,
// stock-checked lines, resolving price and stock from the catalog — never the
// client. Extracted from `submitOrder` (lib/actions/orders.ts) so the storefront
// checkout and the Ligatto automation API (app/api/automation/orders) price and
// classify lines through exactly the same logic.
import { bestActivePromotion, effectiveReducedPrice } from "@/lib/promotions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { getDeliverySettings } from "@/lib/data/settings";
import { deliveryFee, type DeliveryRegion } from "@/lib/pricing";
import { pick } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/routing";

export type RequestedLine = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

/** A priced, in-stock line ready to become an `OrderItem`. */
export type ResolvedLine = {
  productId: number;
  variantId: number | null;
  quantity: number;
  /** Localized product (and variant) name, for the order summary. */
  name: string;
  /** Undiscounted unit price, lei. */
  unitListPrice: number;
  /** Unit price actually charged after promotions / reduced price, lei. */
  unitPrice: number;
  /** `unitPrice` as a Decimal, for the `OrderItem.priceEach` column. */
  priceEach: Prisma.Decimal;
};

/** A line the catalog can no longer supply. `available` is 0 when the product/variant is gone. */
export type RejectedLine = {
  productId: number;
  variantId: number | null;
  available: number;
};

export type ResolveTotals = {
  /** Sum of list prices before discounts. */
  itemsGross: number;
  /** Total saved via promotions and reduced prices. */
  discountTotal: number;
  /** What the items actually cost, after discounts (the checkout subtotal). */
  itemsNet: number;
};

export type ResolveResult = {
  resolved: ResolvedLine[];
  gone: RejectedLine[];
  short: RejectedLine[];
  totals: ResolveTotals;
};

/**
 * Price and stock-check every requested line against the live catalog. A line
 * the catalog can't supply is reported (in `gone`/`short`) rather than dropped,
 * so the caller can tell the customer what changed. Stock here is only *read* —
 * the atomic reservation happens in `reserveStock` inside the caller's commit
 * transaction.
 */
export async function resolveOrderLines(
  requested: RequestedLine[],
  lang: Locale,
  // When false, lines are priced regardless of stock (never classified `short`).
  // Used by the pending-order edit path, where the order already holds its units
  // and the authoritative check is the in-transaction release→reserve.
  { checkStock = true }: { checkStock?: boolean } = {},
): Promise<ResolveResult> {
  const productIds = [...new Set(requested.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: {
      variants: true,
      promotions: { select: { startDate: true, endDate: true, discountPercent: true } },
    },
  });
  const productById = new Map(products.map((p) => [p.id, p]));
  // One clock for the whole order, so a promotion that ends mid-request can't
  // price two lines of the same cart differently.
  const now = new Date();
  // What the storefront showed: list price, the manual reduced price, or the
  // best running promotion, whichever is lowest (lib/promotions.ts).
  const charge = (
    price: Prisma.Decimal,
    reduced: Prisma.Decimal | null,
    pct: number | null,
  ): Prisma.Decimal => {
    const r = effectiveReducedPrice(Number(price), reduced === null ? null : Number(reduced), pct);
    return r === null ? price : new Prisma.Decimal(r);
  };

  const resolved: ResolvedLine[] = [];
  const gone: RejectedLine[] = [];
  const short: RejectedLine[] = [];

  for (const line of requested) {
    const product = productById.get(line.productId);
    if (!product) {
      gone.push({ productId: line.productId, variantId: line.variantId, available: 0 });
      continue;
    }
    const pct = bestActivePromotion(product.promotions, now)?.discountPercent ?? null;
    let listPrice: Prisma.Decimal = product.price;
    let priceEach = charge(product.price, product.reducedPrice, pct);
    let variantId: number | null = null;
    let available = product.stock;
    let name = pick(lang, product.name_ro, product.name_ru);
    if (line.variantId) {
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant) {
        // The size/colour they chose is gone even though the product stayed.
        gone.push({ productId: product.id, variantId: line.variantId, available: 0 });
        continue;
      }
      variantId = variant.id;
      listPrice = variant.price;
      priceEach = charge(variant.price, variant.reducedPrice, pct);
      available = variant.stock;
      name = `${pick(lang, product.name_ro, product.name_ru)} — ${pick(lang, variant.name_ro, variant.name_ru)}`;
    } else if (product.hasVariants && product.variants.length > 0) {
      // A variant product can only be bought as one of its variants — a line
      // without one means the variant it was added with has been deleted.
      gone.push({ productId: product.id, variantId: null, available: 0 });
      continue;
    }

    if (checkStock && available < line.quantity) {
      short.push({ productId: product.id, variantId, available });
      continue;
    }

    resolved.push({
      productId: product.id,
      variantId,
      quantity: line.quantity,
      name,
      unitListPrice: Number(listPrice),
      unitPrice: Number(priceEach),
      priceEach,
    });
  }

  const itemsNet = resolved.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
  const itemsGross = resolved.reduce((sum, r) => sum + r.unitListPrice * r.quantity, 0);
  return {
    resolved,
    gone,
    short,
    totals: { itemsGross, discountTotal: itemsGross - itemsNet, itemsNet },
  };
}

/**
 * The delivery fee for an order, resolved from `DeliverySettings` — pickup and
 * orders at/above the free-delivery threshold cost nothing. Mirrors the fee
 * logic `submitOrder` has always used.
 */
export async function computeFee(
  method: "pickup" | "delivery",
  region: DeliveryRegion,
  itemsNet: number,
): Promise<number> {
  if (method !== "delivery") return 0;
  const delivery = await getDeliverySettings();
  return deliveryFee(delivery, itemsNet, region) ?? 0;
}

/** The order summary returned by the automation API. */
export type OrderSummary = {
  id: number;
  status: string;
  source: string;
  customer: { name: string; phone: string | null };
  delivery: {
    method: string | null;
    region: string | null;
    city: string | null;
    address: string | null;
    postalCode: string | null;
    notes: string | null;
  };
  items: {
    productId: number;
    variantId: number | null;
    name: string;
    quantity: number;
    unitListPrice: number;
    unitPrice: number;
    lineDiscount: number;
    lineTotal: number;
  }[];
  totals: {
    itemsGross: number;
    discountTotal: number;
    itemsNet: number;
    shippingFee: number;
    grandTotal: number;
    currency: "MDL";
  };
};

/** A row shape sufficient to describe an order in a summary. */
export type SummarizableOrder = {
  id: number;
  status: string;
  source: string;
  customerName: string;
  customerPhone: string | null;
  deliveryMethod: string | null;
  deliveryRegion: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  specialInstructions: string | null;
  totalPrice: Prisma.Decimal;
};

/**
 * Build the JSON summary from the stored order plus the in-request resolved
 * lines. The shipping fee is derived from the stored total so it always matches
 * exactly what was charged (`grandTotal = itemsNet + shippingFee`).
 */
export function buildOrderSummary(
  order: SummarizableOrder,
  resolved: ResolvedLine[],
  totals: ResolveTotals,
): OrderSummary {
  const grandTotal = Number(order.totalPrice);
  return {
    id: order.id,
    status: order.status,
    source: order.source,
    customer: { name: order.customerName, phone: order.customerPhone },
    delivery: {
      method: order.deliveryMethod,
      region: order.deliveryRegion,
      city: order.city,
      address: order.address,
      postalCode: order.postalCode,
      notes: order.specialInstructions,
    },
    items: resolved.map((r) => ({
      productId: r.productId,
      variantId: r.variantId,
      name: r.name,
      quantity: r.quantity,
      unitListPrice: r.unitListPrice,
      unitPrice: r.unitPrice,
      lineDiscount: (r.unitListPrice - r.unitPrice) * r.quantity,
      lineTotal: r.unitPrice * r.quantity,
    })),
    totals: {
      itemsGross: totals.itemsGross,
      discountTotal: totals.discountTotal,
      itemsNet: totals.itemsNet,
      shippingFee: grandTotal - totals.itemsNet,
      grandTotal,
      currency: "MDL",
    },
  };
}

/** A stored `OrderItem` row, with the names needed to describe it. */
export type StoredOrderItem = {
  productId: number | null;
  productVariantId: number | null;
  quantity: number;
  priceEach: Prisma.Decimal;
  product: { name_ro: string; name_ru: string } | null;
  productVariant: { name_ro: string; name_ru: string } | null;
};

/**
 * Summarize an order from its stored rows (used for the idempotent-replay path,
 * where there is no in-request resolution). Only the charged `priceEach` is
 * stored — the original list price is not — so discounts are not broken out
 * here; the charged totals stay exact because `shippingFee` is derived from the
 * stored `totalPrice`.
 */
export function storedOrderSummary(
  order: SummarizableOrder & { items: StoredOrderItem[] },
  lang: Locale,
): OrderSummary {
  const resolved: ResolvedLine[] = order.items.map((it) => {
    const unit = Number(it.priceEach);
    const base = it.product ? pick(lang, it.product.name_ro, it.product.name_ru) : "—";
    const name = it.productVariant
      ? `${base} — ${pick(lang, it.productVariant.name_ro, it.productVariant.name_ru)}`
      : base;
    return {
      productId: it.productId ?? 0,
      variantId: it.productVariantId,
      quantity: it.quantity,
      name,
      unitListPrice: unit,
      unitPrice: unit,
      priceEach: it.priceEach,
    };
  });
  const itemsNet = resolved.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
  return buildOrderSummary(order, resolved, {
    itemsGross: itemsNet,
    discountTotal: 0,
    itemsNet,
  });
}
