"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  createLigattoAgent,
  toggleLigattoAgent,
  deleteLigattoAgent,
  type LigattoAgentActionState,
} from "@/lib/admin/actions/settings";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { statusLabel, type AdminDict } from "@/lib/admin/i18n";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { LigattoMark } from "@/components/admin/ligatto-mark";
import {
  Field,
  TextInput,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

type ShippingDict = AdminDict["settings"]["shipping"];

export type LigattoAgentView = {
  id: number;
  name: string;
  enabled: boolean;
  created: string;
};

export function LigattoAgents({ agents }: { agents: LigattoAgentView[] }) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [state, formAction] = useActionState<LigattoAgentActionState, FormData>(
    createLigattoAgent,
    null,
  );

  return (
    <SectionCard title={s.ligatto} icon={<LigattoMark className="h-4 w-4" />}>
      <p className="mb-4 text-sm text-muted-foreground">{s.ligattoHint}</p>

      {state?.ok && state.token && (
        <TokenReveal name={state.agentName ?? ""} token={state.token} s={s} />
      )}

      {agents.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {s.noAgents}
        </p>
      ) : (
        <ul className="divide-y rounded-[var(--radius-md)] border">
          {agents.map((a) => {
            const flag = a.enabled ? "active" : "inactive";
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.name}</span>
                    <StatusBadge status={flag} label={statusLabel(t, flag)} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.created}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <form action={toggleLigattoAgent}>
                    <LangField />
                    <input type="hidden" name="id" value={a.id} />
                    <RowButton>{a.enabled ? s.disable : s.enable}</RowButton>
                  </form>
                  <form action={deleteLigattoAgent}>
                    <LangField />
                    <input type="hidden" name="id" value={a.id} />
                    <RowButton danger>{s.remove}</RowButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AdminForm action={formAction} className="mt-5 border-t pt-4">
        <LangField />
        <div className="flex flex-wrap items-end gap-3">
          <Field label={s.agentName} htmlFor="ligatto_agent_name" className="min-w-[16rem] flex-1">
            <TextInput
              id="ligatto_agent_name"
              name="agentName"
              placeholder={s.agentNamePlaceholder}
              autoComplete="off"
              maxLength={60}
            />
          </Field>
          <SubmitButton>{s.addAgent}</SubmitButton>
        </div>
        {state?.error && (
          <div className="mt-3">
            <ActionNotice state={state} />
          </div>
        )}
      </AdminForm>
    </SectionCard>
  );
}

function RowButton({
  children,
  danger,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      className={
        "cursor-pointer rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-medium transition-colors " +
        (danger
          ? "text-red-700 hover:border-red-300 hover:bg-red-50"
          : "text-muted-foreground hover:border-foreground/30 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

// One-time reveal of a freshly created agent token. It's stored encrypted and
// never sent to the client again, so this is the admin's only chance to copy it.
function TokenReveal({ name, token, s }: { name: string; token: string; s: ShippingDict }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-4 rounded-[var(--radius-md)] border border-primary/40 bg-primary/5 px-4 py-3">
      <p className="text-sm font-medium">{name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{s.tokenOnce}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-[var(--radius-sm)] border bg-background px-3 py-2 font-mono text-xs">
          {token}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(token).then(
              () => setCopied(true),
              () => {},
            );
          }}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 text-xs font-medium transition-colors hover:border-foreground/30"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? s.copied : s.copy}
        </button>
      </div>
    </div>
  );
}
