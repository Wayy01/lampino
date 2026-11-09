import type { ShippingSettings } from "@/lib/generated/prisma";
import { ActionRefusal } from "@/lib/admin/errors";
import { num } from "@/lib/admin/serialize";
import type { NovaPostShipmentRequest, NovaPostParcel } from "@/lib/courier/novapost";
import type { FanCourierShipmentRequest, FanCourierParcel } from "@/lib/courier/fancourier";

// Pure request-building for the shipment drawer, split out of the "use server"
// action file (which may only export actions) so it stays unit-testable.

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Positive number from the form, else the fallback (parcel dims/weight/value). */
function pos(fd: FormData, key: string, fallback: number): number {
  const n = Number(str(fd, key));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function posOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Parse the drawer's serialized parcel list. The drawer distributes the order's
 * units across N parcels and recalculates each one's weight/dimensions, sending
 * the result as `parcelsJson`. Falls back to a single parcel from the flat
 * fields (and finally the store defaults) so a malformed payload never aborts.
 */
function parseParcels(
  fd: FormData,
  settings: ShippingSettings,
  order: OrderForShipment,
): NovaPostParcel[] {
  const raw = str(fd, "parcelsJson");
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown[];
      if (Array.isArray(arr) && arr.length > 0) {
        const parcels = arr.map((item, i): NovaPostParcel => {
          const p = (item ?? {}) as Record<string, unknown>;
          const insurance = Number(p.insuranceCost);
          return {
            description: String(p.description ?? "").trim() || `Order #${order.id} (${i + 1})`,
            weightG: posOr(p.weightG, settings.novapostParcelWeightG),
            lengthMm: posOr(p.lengthMm, settings.novapostParcelLengthMm),
            widthMm: posOr(p.widthMm, settings.novapostParcelWidthMm),
            heightMm: posOr(p.heightMm, settings.novapostParcelHeightMm),
            insuranceCost: Number.isFinite(insurance) && insurance >= 0 ? insurance : 0,
          };
        });
        if (parcels.length > 0) return parcels;
      }
    } catch {
      // fall through to the single-parcel fallback
    }
  }
  return [
    {
      description: str(fd, "parcelDescription") || `Order #${order.id}`,
      weightG: pos(fd, "parcelWeightG", settings.novapostParcelWeightG),
      lengthMm: pos(fd, "parcelLengthMm", settings.novapostParcelLengthMm),
      widthMm: pos(fd, "parcelWidthMm", settings.novapostParcelWidthMm),
      heightMm: pos(fd, "parcelHeightMm", settings.novapostParcelHeightMm),
      insuranceCost: pos(fd, "parcelInsurance", 0),
    },
  ];
}

export type OrderForShipment = {
  id: number;
  customerName: string;
  customerPhone: string | null;
};

/**
 * Build the Nova Post shipment request from the drawer form + the order + the
 * stored sender config. Throws `ActionRefusal("recipientRequired")` when the
 * recipient is incomplete. The parcel values come from the drawer, which
 * pre-fills them from the order's item dimensions.
 */
export function buildNovaPostRequestFromForm(
  order: OrderForShipment,
  settings: ShippingSettings,
  fd: FormData,
): NovaPostShipmentRequest {
  const settlementId = str(fd, "recipientSettlementId");
  const deliveryType = str(fd, "deliveryType") === "door" ? "door" : "branch";
  const divisionId = str(fd, "recipientDivisionId");
  const street = str(fd, "recipientStreet");

  if (
    !settlementId ||
    (deliveryType === "branch" && !divisionId) ||
    (deliveryType === "door" && !street)
  ) {
    throw new ActionRefusal("recipientRequired");
  }

  // Nova Pay (COD): one amount — the order's grand total by default — is both
  // what's collected on delivery and the parcels' declared value / insurance.
  const novaPay = str(fd, "novaPay") === "1";
  const codAmount = pos(fd, "parcelInsurance", 0);

  // Nova Post refuses a COD above the parcels' total insurance
  // (validation.cod.amount_exceeds_insurance_total_cost). The drawer already
  // insures the COD total, but enforce it here too — manual per-parcel
  // overrides can leave a shortfall, which is added to the last parcel.
  const parcels = parseParcels(fd, settings, order);
  if (novaPay && codAmount > 0) {
    const insured = parcels.reduce((sum, p) => sum + p.insuranceCost, 0);
    if (insured < codAmount) {
      parcels[parcels.length - 1].insuranceCost += codAmount - insured;
    }
  }

  return {
    clientOrder: `Order #${order.id}`,
    note: str(fd, "note") || null,
    payerType: str(fd, "payerType") === "Sender" ? "Sender" : "Recipient",
    cod: novaPay && codAmount > 0 ? { amount: codAmount } : null,
    sender: {
      name: settings.novapostSenderName,
      phone: settings.novapostSenderPhone,
      email: settings.novapostSenderEmail,
      companyTin: settings.novapostSenderCompanyTin,
      countryCode: settings.novapostSenderCountryCode || "MD",
      divisionId: settings.novapostSenderDivisionId,
    },
    recipient: {
      name: str(fd, "recipientName") || order.customerName,
      phone: str(fd, "recipientPhone") || order.customerPhone || "",
      email: str(fd, "recipientEmail"),
      countryCode: "MD",
      settlementId,
      settlementName: str(fd, "recipientSettlementName") || undefined,
      divisionId: deliveryType === "branch" ? divisionId : null,
      address:
        deliveryType === "door"
          ? {
              street,
              building: str(fd, "recipientBuilding") || undefined,
              flat: str(fd, "recipientFlat") || undefined,
              postCode: str(fd, "recipientPostCode") || undefined,
            }
          : null,
    },
    parcels,
  };
}

// --- Fan Courier -------------------------------------------------------------

/**
 * Parse the drawer's serialized parcel list for Fan Courier (native kg/cm). The
 * drawer distributes the order's units across N parcels and recalculates each
 * one's weight/dimensions. Falls back to a single parcel from the store defaults
 * so a malformed payload never aborts.
 */
function parseFanCourierParcels(fd: FormData, settings: ShippingSettings): FanCourierParcel[] {
  const defWeight = num(settings.fancourierParcelWeightKg) || 1;
  const fallback: FanCourierParcel = {
    weightKg: defWeight,
    lengthCm: settings.fancourierParcelLengthCm,
    widthCm: settings.fancourierParcelWidthCm,
    heightCm: settings.fancourierParcelHeightCm,
  };
  const raw = str(fd, "parcelsJson");
  if (raw) {
    try {
      const arr = JSON.parse(raw) as unknown[];
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((item): FanCourierParcel => {
          const p = (item ?? {}) as Record<string, unknown>;
          return {
            weightKg: posOr(p.weightKg, fallback.weightKg),
            lengthCm: posOr(p.lengthCm, fallback.lengthCm),
            widthCm: posOr(p.widthCm, fallback.widthCm),
            heightCm: posOr(p.heightCm, fallback.heightCm),
          };
        });
      }
    } catch {
      // fall through to the single-parcel fallback
    }
  }
  return [fallback];
}

export type OrderForFanCourier = OrderForShipment & {
  customerEmail: string;
};

/**
 * Build the Fan Courier shipment request from the drawer form + the order + the
 * stored sender config. Throws `ActionRefusal("recipientRequired")` when the
 * recipient's name, phone, city or street is missing (Fan Courier is door-to-
 * street only — those four are mandatory).
 */
export function buildFanCourierRequestFromForm(
  order: OrderForFanCourier,
  settings: ShippingSettings,
  fd: FormData,
): FanCourierShipmentRequest {
  const name = str(fd, "recipientName") || order.customerName;
  const phone = str(fd, "recipientPhone") || order.customerPhone || "";
  const city = str(fd, "recipientCity");
  const street = str(fd, "recipientStreet");

  if (!name || !phone || !city || !street) {
    throw new ActionRefusal("recipientRequired");
  }

  const payerRaw = str(fd, "payer");
  const payer: FanCourierShipmentRequest["payer"] =
    payerRaw === "sender" ? "sender" : payerRaw === "recipient" ? "recipient" : "client";

  // Ramburs (cash-on-delivery): the amount collected at the door — the order's
  // grand total by default.
  const codOn = str(fd, "cod") === "1";
  const codTotal = pos(fd, "codAmount", 0);
  const typeRaw = str(fd, "rambursType");
  const rambursType: "cont" | "cash" | "instrumente_plata" =
    typeRaw === "cash" ? "cash" : typeRaw === "instrumente_plata" ? "instrumente_plata" : "cont";

  // Declared value (insurance): optional at Fan Courier — unlike Nova Post it
  // has no COD≤insurance rule, and insurance is a paid add-on. The form prefills
  // the order total; a cleared field means "ship uninsured" and stays 0 (the
  // body builder then omits the `insurance` key entirely).
  const declaredValue = pos(fd, "declaredValue", 0);

  return {
    serviceType: settings.fancourierServiceType || "standard",
    payer,
    declaredValue,
    cod: codOn && codTotal > 0 ? { amount: codTotal, type: rambursType } : null,
    content: str(fd, "content") || `Order #${order.id}`,
    comments: str(fd, "comments"),
    customerReference: String(order.id),
    sender: {
      useDefault: settings.fancourierUseDefaultSender,
      name: settings.fancourierSenderName,
      phone: settings.fancourierSenderPhone,
      email: settings.fancourierSenderEmail,
      county: settings.fancourierSenderCounty,
      city: settings.fancourierSenderCity,
      street: settings.fancourierSenderStreet,
      nr: settings.fancourierSenderNr,
      zipcode: settings.fancourierSenderZipcode,
    },
    recipient: {
      name,
      phone,
      email: str(fd, "recipientEmail") || order.customerEmail || "",
      county: str(fd, "recipientCounty"),
      city,
      street,
      nr: str(fd, "recipientNr"),
      block: str(fd, "recipientBlock"),
      staircase: str(fd, "recipientStaircase"),
      floor: str(fd, "recipientFloor"),
      flat: str(fd, "recipientFlat"),
      zipcode: str(fd, "recipientZipcode"),
      extra: str(fd, "recipientExtra"),
    },
    parcels: parseFanCourierParcels(fd, settings),
  };
}
