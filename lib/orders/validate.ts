// Shared order input validation, extracted from `submitOrder` so the storefront
// checkout and the Ligatto automation API apply the same limits and rules.
import { mergeLines } from "@/lib/stock";
import type { RequestedLine } from "@/lib/orders/resolve";

// Input caps — enough for any real order, small enough that a script can't fill
// the table (or blow past Telegram's 4096-char message limit).
export const MAX_NAME = 100;
export const MAX_PHONE = 30;
export const MAX_ADDRESS = 300;
export const MAX_NOTES = 1000;
export const MAX_LINES = 50;
export const MAX_QUANTITY = 1000;
// Digits with the usual separators, 6–15 digits in total.
const PHONE_RE = /^\+?[\d\s().-]{6,30}$/;

/** Validate + normalize the customer contact, or null when it's unusable. */
export function validateContact(
  rawName: unknown,
  rawPhone: unknown,
): { name: string; phone: string } | null {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const phone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const digits = phone.replace(/\D/g, "").length;
  if (
    !name ||
    name.length > MAX_NAME ||
    phone.length > MAX_PHONE ||
    !PHONE_RE.test(phone) ||
    digits < 6 ||
    digits > 15
  ) {
    return null;
  }
  return { name, phone };
}

/** Validate + normalize a delivery address, or null when it's unusable. */
export function validateDeliveryAddress(
  rawAddress: unknown,
  rawCity: unknown,
): { address: string; city: string } | null {
  const address = typeof rawAddress === "string" ? rawAddress.trim() : "";
  const city = typeof rawCity === "string" ? rawCity.trim() : "";
  if (!address || address.length > MAX_ADDRESS || !city || city.length > MAX_ADDRESS) {
    return null;
  }
  return { address, city };
}

export function clampPostalCode(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 20) : "";
}

export function clampNotes(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, MAX_NOTES) : "";
}

/**
 * Normalize raw requested items: drop malformed lines, clamp quantities, cap the
 * line count, and merge duplicate product+variant lines so stock is checked on
 * the summed quantity.
 */
export function sanitizeLines(items: unknown): RequestedLine[] {
  return mergeLines(
    (Array.isArray(items) ? items : [])
      .slice(0, MAX_LINES)
      .filter(
        (i): i is { productId: number; variantId?: unknown; quantity?: unknown } =>
          !!i && Number.isInteger((i as { productId?: unknown }).productId) &&
          (i as { productId: number }).productId > 0,
      )
      .map((i) => ({
        productId: i.productId,
        variantId:
          Number.isInteger(i.variantId) && (i.variantId as number) > 0
            ? (i.variantId as number)
            : null,
        quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(i.quantity) || 0))),
      })),
  );
}
