import type { ShippingSettings } from "@/lib/generated/prisma";
import type { ShippingData } from "@/components/admin/integration-forms";
import { num } from "@/lib/admin/serialize";

// Serialize the ShippingSettings row to the client view model. The encrypted
// API-key columns are deliberately omitted — they never cross to the client;
// pages pass a separate `keySet` boolean derived from whether the column is set.
export function toShippingData(s: ShippingSettings | null): ShippingData | null {
  if (!s) return null;
  return {
    novapostEnabled: s.novapostEnabled,
    novapostSandbox: s.novapostSandbox,
    novapostSenderCompanyTin: s.novapostSenderCompanyTin,
    novapostSenderDivisionId: s.novapostSenderDivisionId,
    novapostSenderDivisionName: s.novapostSenderDivisionName,
    novapostSenderType: s.novapostSenderType === "address" ? "address" : "division",
    novapostSenderSettlementId: s.novapostSenderSettlementId,
    novapostSenderSettlementName: s.novapostSenderSettlementName,
    novapostSenderStreet: s.novapostSenderStreet,
    novapostSenderBuilding: s.novapostSenderBuilding,
    novapostSenderFlat: s.novapostSenderFlat,
    novapostSenderPostCode: s.novapostSenderPostCode,
    novapostSenderAddressNote: s.novapostSenderAddressNote,
    novapostClientContractNumber: s.novapostClientContractNumber,
    novapostCodContractNumber: s.novapostCodContractNumber,
    novapostCodAccount: s.novapostCodAccount,
    novapostSenderCountryCode: s.novapostSenderCountryCode,
    novapostDefaultCategory: s.novapostDefaultCategory,
    novapostSenderName: s.novapostSenderName,
    novapostSenderPhone: s.novapostSenderPhone,
    novapostSenderEmail: s.novapostSenderEmail,
    novapostParcelWeightG: s.novapostParcelWeightG,
    novapostParcelLengthMm: s.novapostParcelLengthMm,
    novapostParcelWidthMm: s.novapostParcelWidthMm,
    novapostParcelHeightMm: s.novapostParcelHeightMm,
    fancourierEnabled: s.fancourierEnabled,
    fancourierUseDefaultSender: s.fancourierUseDefaultSender,
    fancourierServiceType: s.fancourierServiceType,
    fancourierSenderCounty: s.fancourierSenderCounty,
    fancourierSenderCity: s.fancourierSenderCity,
    fancourierSenderStreet: s.fancourierSenderStreet,
    fancourierSenderNr: s.fancourierSenderNr,
    fancourierSenderZipcode: s.fancourierSenderZipcode,
    fancourierDefaultCategory: s.fancourierDefaultCategory,
    fancourierSenderName: s.fancourierSenderName,
    fancourierSenderPhone: s.fancourierSenderPhone,
    fancourierSenderEmail: s.fancourierSenderEmail,
    fancourierParcelWeightKg: num(s.fancourierParcelWeightKg),
    fancourierParcelLengthCm: s.fancourierParcelLengthCm,
    fancourierParcelWidthCm: s.fancourierParcelWidthCm,
    fancourierParcelHeightCm: s.fancourierParcelHeightCm,
  };
}

export type NovaPostSenderGap = "division" | "settlement" | "street" | "building" | "postCode";

/**
 * What the Nova Post sender still lacks to ship from its chosen departure
 * point: the branch in division mode, or any missing part of the pickup address
 * in address mode (Nova Post needs the city, street, building and postal code).
 * The settings form names these, so an enabled-but-incomplete integration says
 * why it isn't offered on orders.
 */
export function novapostSenderGaps(s: ShippingSettings): NovaPostSenderGap[] {
  if (s.novapostSenderType !== "address") return s.novapostSenderDivisionId ? [] : ["division"];
  const gaps: NovaPostSenderGap[] = [];
  if (!s.novapostSenderSettlementId) gaps.push("settlement");
  if (!s.novapostSenderStreet) gaps.push("street");
  if (!s.novapostSenderBuilding) gaps.push("building");
  if (!s.novapostSenderPostCode) gaps.push("postCode");
  return gaps;
}

/**
 * Whether the Nova Post sender has somewhere to ship from. Shared by the order
 * page and the create-shipment action so the two gates can't drift apart.
 */
export function novapostSenderReady(s: ShippingSettings): boolean {
  return novapostSenderGaps(s).length === 0;
}
