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

export type ShippingActionState = { ok?: boolean; error?: string } | null;

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
    // One waybill per order — delete the existing shipment to re-create.
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
      if (e instanceof NovaPostError) {
        throw new ActionRefusal("courierFailed", describeNovaPostError(e));
      }
      throw e;
    }

    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: "novapost",
        carrierTitle: "Nova Post",
        trackingNumber: result.number,
        courierShipmentId: result.id,
        status: "created",
        codAmount,
        payload: result.body as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "shipped" } });

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
    // One waybill per order — delete the existing shipment to re-create.
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

    let result;
    try {
      result = await createFanCourierAwb({ apiKey }, request);
    } catch (e) {
      if (e instanceof FanCourierError) {
        throw new ActionRefusal("courierFailed", describeFanCourierError(e));
      }
      throw e;
    }

    await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: "fancourier",
        carrierTitle: "Fan Courier",
        trackingNumber: result.number,
        status: "created",
        codAmount,
        payload: result.body as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "shipped" } });

    revalidatePath("/admin/[lang]/orders/[id]", "page");
    revalidatePath("/admin/[lang]/orders", "page");
    return { ok: true };
  });
}
