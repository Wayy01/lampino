"use server";

// Public storefront checkout. Cart and buy-now both submit here: it creates a
// real `Order` + `OrderItem` rows, resolving prices from the DB rather than
// trusting the client. Pricing/stock resolution and input validation are shared
// with the Ligatto automation API through `lib/orders/{resolve,validate,create}.ts`.
import { prisma } from "@/lib/prisma";
import { sendNewOrderAlert } from "@/lib/telegram";
import { newOrderData } from "@/lib/orders/create";
import { withinRateLimit } from "@/lib/rate-limit";
import { type DeliveryRegion } from "@/lib/pricing";
import {
  resolveOrderLines,
  computeFee,
  type RejectedLine,
} from "@/lib/orders/resolve";
import {
  validateContact,
  validateDeliveryAddress,
  clampPostalCode,
  clampNotes,
  sanitizeLines,
} from "@/lib/orders/validate";

export type OrderItemInput = {
  productId: number;
  variantId: number | null;
  quantity: number;
};

export type SubmitOrderInput = {
  items: OrderItemInput[];
  customerName: string;
  customerPhone: string;
  method: "pickup" | "delivery";
  region: DeliveryRegion;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  notes: string | null;
};

/** Every way checkout can be refused. The UI maps these to `t.order.errors`. */
export type SubmitOrderError =
  | "invalid_contact"
  | "invalid_address"
  | "empty_cart"
  | "unavailable"
  | "out_of_stock"
  | "too_many_requests"
  | "server_error";

// Do NOT re-export `RejectedLine` from here (`export type { RejectedLine }`).
// In a "use server" file the build treats a re-export as a server action and
// emits `registerServerReference(RejectedLine, …)` — a ReferenceError at module
// load that 500s every checkout. Import it from `@/lib/orders/resolve` instead.

export type SubmitOrderResult =
  | { ok: true; orderId: number }
  | { ok: false; error: SubmitOrderError; rejected?: RejectedLine[] };

export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  try {
    const contact = validateContact(input.customerName, input.customerPhone);
    if (!contact) return { ok: false, error: "invalid_contact" };

    // Server actions take arbitrary runtime input — the TypeScript type on
    // `method`/`region` guarantees nothing. Reject anything but the two known
    // values rather than storing a forged string as the order's deliveryMethod.
    if (
      (input.method !== "pickup" && input.method !== "delivery") ||
      (input.method === "delivery" && input.region !== "chisinau" && input.region !== "outside")
    ) {
      return { ok: false, error: "invalid_address" };
    }

    let address: string | null = null;
    let city: string | null = null;
    let postalCode = "";
    if (input.method === "delivery") {
      const addr = validateDeliveryAddress(input.address, input.city);
      if (!addr) return { ok: false, error: "invalid_address" };
      address = addr.address;
      city = addr.city;
      postalCode = clampPostalCode(input.postalCode);
    }
    const notes = clampNotes(input.notes);

    const requested = sanitizeLines(input.items);
    if (requested.length === 0) return { ok: false, error: "empty_cart" };

    // Checked after validation so typos don't burn the customer's attempts.
    if (!(await withinRateLimit("order", 5, 10 * 60_000))) {
      return { ok: false, error: "too_many_requests" };
    }

    // Price and stock are resolved server-side from the catalog — never the
    // client. A line the catalog can no longer supply is reported back rather
    // than dropped. Refuse the whole order when any line can't be filled — a
    // partial order the customer never agreed to is worse than being asked to
    // adjust the cart.
    const { resolved, gone, short, totals } = await resolveOrderLines(requested, "ro");
    if (short.length > 0) return { ok: false, error: "out_of_stock", rejected: short };
    if (gone.length > 0) return { ok: false, error: "unavailable", rejected: gone };
    if (resolved.length === 0) return { ok: false, error: "empty_cart" };

    const fee = await computeFee(input.method, input.region, totals.itemsNet);

    // Stock is checked above but NOT taken here: it is reserved when an admin
    // confirms the order (lib/admin/actions/orders.ts). Reserving at checkout
    // let anonymous, unverified orders empty the shop until someone cancelled
    // them.
    const order = await prisma.order.create({
      data: {
        ...(await newOrderData({
          contact,
          method: input.method,
          region: input.region,
          address,
          city,
          postalCode,
          notes,
          resolved,
          itemsNet: totals.itemsNet,
          fee,
        })),
        stockReserved: false,
      },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        address: true,
        city: true,
        postalCode: true,
        totalPrice: true,
        items: {
          select: {
            quantity: true,
            priceEach: true,
            product: { select: { name_ro: true } },
            productVariant: { select: { name_ro: true } },
          },
        },
      },
    });

    sendNewOrderAlert(order).catch((err) =>
      console.error("Failed to send Telegram order alert", order.id, err),
    );

    return { ok: true, orderId: order.id };
  } catch (error) {
    console.error("submitOrder", error);
    return { ok: false, error: "server_error" };
  }
}
