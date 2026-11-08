"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteShipment, type DeleteShipmentState } from "@/lib/admin/actions/shipping";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SubmitButton, ActionNotice, LangField } from "@/components/admin/form-controls";

// The order page's shipment section once a waybill exists: shows the carrier and
// AWB, and offers deletion. Delete is carrier-first — it cancels the real waybill
// then removes the local row. If the carrier refuses (the parcel is already in
// transit), the dialog switches to a second step offering a Lampino-only removal
// that leaves the live waybill alone.
export function ShipmentPanel({
  orderId,
  carrierTitle,
  trackingNumber,
}: {
  orderId: number;
  carrierTitle: string;
  trackingNumber: string;
}) {
  const t = useAdminT();
  const s = t.orders.shipment;
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{s.carrier}:</span>
          <span className="font-medium">{carrierTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{s.tracking}:</span>
          <span className="font-mono font-medium">{trackingNumber}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-red-200 px-3 text-sm text-red-700 transition-colors hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        {s.delete}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {/* The form (and its action state) lives in a child that unmounts with
              the dialog, so closing after a carrier refusal resets the flow: a
              reopen starts at the carrier-cancel step again, never directly in
              the local-only second step. */}
          <DeleteShipmentForm orderId={orderId} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeleteShipmentForm({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const t = useAdminT();
  const s = t.orders.shipment;
  const [state, formAction] = useActionState<DeleteShipmentState, FormData>(
    deleteShipment.bind(null, orderId),
    null,
  );

  // No success handler needed: a successful delete revalidates the page, so the
  // whole shipment section re-renders back to the create flow and this dialog
  // unmounts. A `refused` or `error` result changes nothing server-side, so the
  // dialog stays open to show the next step.
  const refused = Boolean(state?.refused);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>{refused ? s.cancelRefusedTitle : s.deleteConfirmTitle}</DialogTitle>
        <DialogDescription className="mt-1">
          {refused ? s.cancelRefusedBody : s.deleteConfirmBody}
        </DialogDescription>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <LangField />
        {/* The first submit cancels at the carrier; after a refusal the same
            form re-submits as a Lampino-only removal. */}
        <input type="hidden" name="mode" value={refused ? "local" : "auto"} />
        <SubmitButton>{refused ? s.removeLocalOnly : s.deleteConfirm}</SubmitButton>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm transition-colors hover:bg-foreground/[0.03]"
        >
          {s.keep}
        </button>
        <ActionNotice state={state} />
      </form>
    </div>
  );
}
