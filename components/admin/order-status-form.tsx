"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import {
  updateOrderStatus,
  deleteOrder,
  type OrderActionState,
} from "@/lib/admin/actions/orders";
import { ORDER_STATUSES } from "@/lib/admin/order-status";
import { statusLabel } from "@/lib/admin/i18n";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminSelect } from "@/components/admin/select";
import {
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

export function OrderStatusForm({
  orderId,
  status,
}: {
  orderId: number;
  status: string;
}) {
  const { t, lang } = useAdminLang();
  const [state, formAction] = useActionState<OrderActionState, FormData>(
    updateOrderStatus.bind(null, orderId),
    null,
  );

  return (
    <>
      <AdminForm action={formAction} className="flex items-center gap-2">
        <LangField />
        <AdminSelect
          name="status"
          defaultValue={status}
          ariaLabel={t.orders.statusTitle}
          options={ORDER_STATUSES.map((s) => ({
            value: s,
            label: statusLabel(t, s),
          }))}
        />
        <SubmitButton className="shrink-0">{t.common.update}</SubmitButton>
      </AdminForm>
      <div className="mt-3">
        <ActionNotice state={state} />
      </div>
      <div className="mt-4 border-t pt-3">
        <ConfirmButton
          action={deleteOrder.bind(null, lang, orderId)}
          confirmLabel={t.orders.deleteOrderConfirm}
        >
          <Trash2 className="h-4 w-4" />
          {t.orders.deleteOrder}
        </ConfirmButton>
      </div>
    </>
  );
}
