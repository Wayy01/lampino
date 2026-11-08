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
  cancelShipment as cancelNovaPostShipment,
  describeNovaPostError,
  NovaPostError,
} from "@/lib/courier/novapost";
import {
  createShipment as createFanCourierAwb,
  cancelShipment as cancelFanCourierShipment,
  describeFanCourierError,
  FanCourierError,
} from "@/lib/courier/fancourier";
import type { CancelResult } from "@/lib/courier/cancel";
import type { ShippingSettings } from "@/lib/generated/prisma";
import { dispatchShipmentCreated } from "@/lib/webhooks";

export type ShippingActionState = { ok?: boolean; error?: string } | null;

/**
 * Result of the delete-shipment action. `ok` closes the panel; `error` renders
 * through `ActionNotice`. `refused` is the distinct in-between state: the carrier
 * wouldn't cancel the waybill (it's already in transit / picked up), so nothing
 * was deleted and the UI offers a Lampino-only removal instead.
 */
export type DeleteShipmentState =
  | { ok?: boolean; error?: string; refused?: boolean }
  | null;

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

type ShipmentRow = {
  carrier: string;
  trackingNumber: string;
  courierShipmentId: string | null;
};

/**
 * Try to cancel a shipment's waybill at its carrier. Returns a `CancelResult`;
 * it never throws for an expected failure. Any carrier rejection, auth/validation
 * error, transport failure, missing configuration, or missing carrier id resolves
 * to `refused` — the caller then offers a Lampino-only removal rather than
 * surfacing the error or silently dropping the row. The carrier's raw diagnostic
 * is logged server-side only; it never reaches the operator.
 *
 * Nova Post cancels strictly by the stored `courierShipmentId` (its delete wants
 * the integer/uuid id, not the waybill number — passing the number gets a bare
 * validation rejection); Fan Courier by the AWB (tracking) number.
 */
async function cancelAtCarrier(
  shipment: ShipmentRow,
  settings: ShippingSettings | null,
): Promise<CancelResult> {
  try {
    if (shipment.carrier === "novapost") {
      const apiKey = decryptSecret(settings?.novapostApiKey);
      // Can't reach the carrier (disabled / key gone) or no id to delete by — we
      // can't verify or cancel the waybill, so offer the local-only removal.
      if (!settings?.novapostEnabled || !apiKey || !shipment.courierShipmentId) {
        return { status: "refused" };
      }
      return await cancelNovaPostShipment(
        {
          apiKey,
          sandbox: settings.novapostSandbox,
          countryCode: settings.novapostSenderCountryCode || "MD",
          companyTin: settings.novapostSenderCompanyTin || undefined,
        },
        shipment.courierShipmentId,
      );
    }

    if (shipment.carrier === "fancourier") {
      const apiKey = decryptSecret(settings?.fancourierApiKey);
      if (!settings?.fancourierEnabled || !apiKey) return { status: "refused" };
      // A half-reserved row that never got an AWB has nothing to cancel remotely.
      if (!shipment.trackingNumber) return { status: "alreadyGone" };
      return await cancelFanCourierShipment({ apiKey }, shipment.trackingNumber);
    }

    // Unknown carrier — nothing we know how to cancel remotely.
    return { status: "alreadyGone" };
  } catch (e) {
    // Transport / auth / unexpected carrier error. Log the detail for us; the
    // operator only ever sees the generic "couldn't cancel" choice.
    console.error("[shipment-cancel]", shipment.carrier, e);
    return { status: "refused" };
  }
}

/**
 * Drop the local `Shipment` row and roll the order back from `shipped` to the
 * pre-shipping `confirmed` state (so a fresh waybill can be created and the
 * `@unique(orderId)` slot is freed). Both statuses hold stock, so `stockReserved`
 * is untouched; a status the operator advanced to by hand (e.g. `delivered`) is
 * left alone via the `status: "shipped"` guard.
 */
async function removeShipmentRow(shipmentId: number, orderId: number) {
  await prisma.$transaction([
    prisma.shipment.delete({ where: { id: shipmentId } }),
    prisma.order.updateMany({
      where: { id: orderId, status: "shipped" },
      data: { status: "confirmed" },
    }),
  ]);
}

/**
 * Delete an order's shipment. `mode:"auto"` (the default) is carrier-first: it
 * cancels the real waybill, then removes the local row — but only when the
 * carrier actually cancelled it (or it was already gone). When the carrier
 * refuses because the parcel is already in transit, nothing is deleted and the
 * action returns `refused` so the UI can offer a Lampino-only removal. That
 * second step submits `mode:"local"`, which skips the carrier and removes only
 * the local row, leaving the live waybill alone. Bound to the order id in the UI.
 */
export async function deleteShipment(
  orderId: number,
  _prev: DeleteShipmentState,
  fd: FormData,
): Promise<DeleteShipmentState> {
  const lang = langFromForm(fd);
  await requireAdmin(lang);
  const localOnly = String(fd.get("mode") ?? "auto") === "local";

  return runFormAction(lang, async () => {
    const shipment = await prisma.shipment.findUnique({
      where: { orderId },
      select: {
        id: true,
        orderId: true,
        carrier: true,
        trackingNumber: true,
        courierShipmentId: true,
      },
    });
    if (!shipment) throw new ActionRefusal("shipmentMissing");

    if (!localOnly) {
      // Carrier-first: never drop the local row before the real waybill is gone.
      const settings = await prisma.shippingSettings.findFirst({ where: { isActive: true } });
      const outcome = await cancelAtCarrier(shipment, settings);
      if (outcome.status === "refused") {
        // Couldn't cancel the waybill (in transit / rejected / unreachable) — it
        // stays live at the carrier. Offer a Lampino-only removal via the
        // follow-up `mode:"local"` submit. The raw reason stays in the server log
        // (cancelAtCarrier); nothing internal is returned to the client.
        if (outcome.reason) console.error("[shipment-cancel] refused:", shipment.carrier, outcome.reason);
        return { refused: true };
      }
      // "cancelled" / "alreadyGone": safe to remove the local row below.
    }

    await removeShipmentRow(shipment.id, shipment.orderId);
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
