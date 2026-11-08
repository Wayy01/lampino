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
