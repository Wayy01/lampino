"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import {
  updateApplicationStatus,
  deleteApplication,
  type ApplicationActionState,
} from "@/lib/admin/actions/applications";
import { APPLICATION_STATUSES } from "@/lib/admin/application-status";
import { statusLabel } from "@/lib/admin/i18n";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { AdminSelect } from "@/components/admin/select";
import {
  SubmitButton,
  ActionNotice,
  LangField,
} from "@/components/admin/form-controls";

export function ApplicationStatusForm({
  applicationId,
  status,
}: {
  applicationId: number;
  status: string;
}) {
  const { t, lang } = useAdminLang();
  const [state, formAction] = useActionState<ApplicationActionState, FormData>(
    updateApplicationStatus.bind(null, applicationId),
    null,
  );

  return (
    <>
      <form action={formAction} className="flex items-center gap-2">
        <LangField />
        <AdminSelect
          name="status"
          defaultValue={status}
          ariaLabel={t.orders.statusTitle}
          options={APPLICATION_STATUSES.map((s) => ({
            value: s,
            label: statusLabel(t, s),
          }))}
        />
        <SubmitButton className="shrink-0">{t.common.update}</SubmitButton>
      </form>
      <div className="mt-3">
        <ActionNotice state={state} />
      </div>
      <div className="mt-4 border-t pt-3">
        <ConfirmButton
          action={deleteApplication.bind(null, lang, applicationId)}
          confirmLabel={t.applications.deleteApplicationConfirm}
        >
          <Trash2 className="h-4 w-4" />
          {t.applications.deleteApplication}
        </ConfirmButton>
      </div>
    </>
  );
}
