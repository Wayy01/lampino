// A promotion has no status column — its state is derived from the date
// window, so the admin and the storefront always agree on what is running.
export type PromotionState = "scheduled" | "active" | "expired";

export function promotionState(
  startDate: Date,
  endDate: Date,
  now: Date = new Date(),
): PromotionState {
  if (now < startDate) return "scheduled";
  if (now > endDate) return "expired";
  return "active";
}

/** `YYYY-MM-DD` for `<input type="date">`, in local time. */
export function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
