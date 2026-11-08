// Shared outcome of a courier "cancel/delete waybill" call. The create flow is
// authoritative over the local `Shipment` row; this is authoritative over the
// real waybill at the carrier. A caller deletes the local row only on
// `cancelled` or `alreadyGone`; on `refused` it keeps the row (and the live
// waybill) and offers a Lampino-only removal instead. Transport, timeout and
// auth failures are thrown as the carrier's own error type rather than returned,
// so the operator retries instead of orphaning a live AWB.
export type CancelResult =
  | { status: "cancelled" } // the carrier removed the waybill
  | { status: "alreadyGone" } // nothing to cancel (already cancelled / never registered)
  // Carrier wouldn't cancel it (picked up / in transit / no permission / rejected
  // the request). `reason` is the carrier's raw diagnostic — for SERVER LOGS ONLY,
  // never surfaced to the operator (it can carry internal field/validation keys).
  | { status: "refused"; reason?: string };
