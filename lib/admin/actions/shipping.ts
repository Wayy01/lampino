"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { langFromForm } from "@/lib/admin/i18n";
import { ActionRefusal, runFormAction } from "@/lib/admin/errors";
import { decryptSecret } from "@/lib/admin/crypto";
import {
  buildNovaPostRequestFromForm,
  buildFanCourierRequestFromForm,
} from "@/lib/admin/shipping-request";
import {
  createShipment,
  describeNovaPostError,
  NovaPostError,
} from "@/lib/courier/novapost";
import {
  createShipment as createFanCourierAwb,
  describeFanCourierError,
  FanCourierError,
} from "@/lib/courier/fancourier";
import { dispatchShipmentCreated } from "@/lib/webhooks";

export type ShippingActionState = { ok?: boolean; error?: string } | null;

/**
 * Reserve the single Shipment row for an order before the (non-idempotent)
 * courier call. The `@unique(orderId)` constraint turns a concurrent or retried
 * submission into a P2002 here — surfaced as `shipmentExists` — so no second
 * real waybill is ever minted. The row is finalized with the tracking number on
 * success, or deleted by the caller if the courier call fails.
 */
async function reserveShipment(
  orderId: number,
  carrier: string,
  carrierTitle: string,
  codAmount: Prisma.Decimal | null,
) {
  try {
    return await prisma.shipment.create({
      data: { orderId, carrier, carrierTitle, trackingNumber: "", status: "pending", codAmount },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ActionRefusal("shipmentExists");
    }
    throw e;
  }
}

/**
 * Create a Nova Post waybill for an order and record it as a `Shipment`.
 * Bound to the order id in the form component. Refuses (without hitting the API)
 * when the order already has a shipment or the courier isn't configured.
 */
export async function createNovaPostShipment(
  orderId: number,
  _prev: ShippingActionState,
  fd: FormData,
): Promise<ShippingActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          shipments: { select: { id: true } },
        },
      }),
      prisma.shippingSettings.findFirst({ where: { isActive: true } }),
    ]);

    if (!order) throw new ActionRefusal("sourceMissing");
    // Fast-path refusal for a nicer message; the DB unique constraint on
    // Shipment.orderId (reserved below) is the authoritative guard.
    if (order.shipments.length > 0) throw new ActionRefusal("shipmentExists");

    const apiKey = decryptSecret(settings?.novapostApiKey);
    if (!settings?.novapostEnabled || !apiKey || !settings.novapostSenderDivisionId) {
      throw new ActionRefusal("courierNotConfigured");
    }

    const request = buildNovaPostRequestFromForm(order, settings, fd);

    // Nova Pay (cash-on-delivery): the amount to collect, recorded on the
    // shipment. The request also carries it as `cod` so the COD service is sent
    // to Nova Post (built from the account's COD contract in createShipment).
    const codAmount =
      request.cod && request.cod.amount > 0 ? new Prisma.Decimal(request.cod.amount) : null;

    // Reserve the one-shipment-per-order slot BEFORE hitting the courier. The
    // @unique(orderId) constraint makes this atomic: a concurrent or retried
    // submission fails here (P2002 → shipmentExists) rather than minting a
    // second real waybill at the courier.
    const reservation = await reserveShipment(order.id, "novapost", "Nova Post", codAmount);

    let result;
    try {
      result = await createShipment(
        {
          apiKey,
          sandbox: settings.novapostSandbox,
          countryCode: settings.novapostSenderCountryCode || "MD",
          companyTin: settings.novapostSenderCompanyTin || undefined,
        },
        request,
      );
    } catch (e) {
      // Release the reservation so the operator can fix the input and retry.
      await prisma.shipment.delete({ where: { id: reservation.id } }).catch(() => {});
      if (e instanceof NovaPostError) {
        throw new ActionRefusal("courierFailed", describeNovaPostError(e));
      }
      throw e;
    }

    const shipment = await prisma.shipment.update({
      where: { id: reservation.id },
      data: {
        trackingNumber: result.number,
        courierShipmentId: result.id,
        status: "created",
        payload: result.body as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "shipped" } });

    // Outbound webhook — fire-and-forget, never blocks or fails the shipment.
    void dispatchShipmentCreated(shipment.id).catch((e) => console.error("[webhooks]", e));

    revalidatePath("/admin/[lang]/orders/[id]", "page");
    revalidatePath("/admin/[lang]/orders", "page");
    return { ok: true };
  });
}

/**
 * Create a Fan Courier waybill for an order and record it as a `Shipment`.
 * Bound to the order id in the form component. Refuses (without hitting the API)
 * when the order already has a shipment or the courier isn't configured.
 */
export async function createFanCourierShipment(
  orderId: number,
  _prev: ShippingActionState,
  fd: FormData,
): Promise<ShippingActionState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);

  return runFormAction(lang, async () => {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          shipments: { select: { id: true } },
        },
      }),
      prisma.shippingSettings.findFirst({ where: { isActive: true } }),
    ]);

    if (!order) throw new ActionRefusal("sourceMissing");
    // Fast-path refusal for a nicer message; the DB unique constraint on
    // Shipment.orderId (reserved below) is the authoritative guard.
    if (order.shipments.length > 0) throw new ActionRefusal("shipmentExists");

    const apiKey = decryptSecret(settings?.fancourierApiKey);
    if (!settings?.fancourierEnabled || !apiKey) {
      throw new ActionRefusal("courierNotConfigured");
    }

    const request = buildFanCourierRequestFromForm(order, settings, fd);

    // Ramburs (cash-on-delivery): the amount to collect, recorded on the
    // shipment and also carried in the request so the courier collects it.
    const codAmount =
      request.cod && request.cod.amount > 0 ? new Prisma.Decimal(request.cod.amount) : null;

    // Reserve the one-shipment-per-order slot BEFORE hitting the courier (see
    // the Nova Post action for the rationale — atomic duplicate-waybill guard).
    const reservation = await reserveShipment(order.id, "fancourier", "Fan Courier", codAmount);

    let result;
    try {
      result = await createFanCourierAwb({ apiKey }, request);
    } catch (e) {
      // Release the reservation so the operator can fix the input and retry.
      await prisma.shipment.delete({ where: { id: reservation.id } }).catch(() => {});
      if (e instanceof FanCourierError) {
        throw new ActionRefusal("courierFailed", describeFanCourierError(e));
      }
      throw e;
    }

    const shipment = await prisma.shipment.update({
      where: { id: reservation.id },
      data: {
        trackingNumber: result.number,
        status: "created",
        payload: result.body as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "shipped" } });

    // Outbound webhook — fire-and-forget, never blocks or fails the shipment.
    void dispatchShipmentCreated(shipment.id).catch((e) => console.error("[webhooks]", e));

    revalidatePath("/admin/[lang]/orders/[id]", "page");
    revalidatePath("/admin/[lang]/orders", "page");
    return { ok: true };
  });
}
