// A promotion has no status column: its state is derived from the date
// window, so the admin and the storefront always agree on what is running.
// The rules live in lib/promotions.ts; this is the admin-side surface.
import {
  promotionState as stateOf,
  toShopDateInput,
  type PromotionState,
} from "@/lib/promotions";

export type { PromotionState };

export function promotionState(
  startDate: Date,
  endDate: Date,
  now: Date = new Date(),
): PromotionState {
  return stateOf({ startDate, endDate }, now);
}

/** `YYYY-MM-DD` for `<input type="date">`, as a day in the shop timezone. */
export const toDateInput = toShopDateInput;

/** A promotion as offered in the product / rental form's picker. */
export type PromotionOption = {
  id: number;
  name: string;
  /** `YYYY-MM-DD`, shop timezone. */
  startDate: string;
  endDate: string;
  discountPercent: number;
  state: PromotionState;
};

export function toPromotionOption(
  p: { id: number; startDate: Date; endDate: Date; discountPercent: number },
  name: string,
  now: Date = new Date(),
): PromotionOption {
  return {
    id: p.id,
    name,
    startDate: toShopDateInput(p.startDate),
    endDate: toShopDateInput(p.endDate),
    discountPercent: p.discountPercent,
    state: promotionState(p.startDate, p.endDate, now),
  };
}
