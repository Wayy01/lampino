"use client";

import { useActionState, useState } from "react";
import { Webhook } from "lucide-react";
import {
  createWebhookEndpoint,
  toggleWebhookEndpoint,
  deleteWebhookEndpoint,
  type WebhookEndpointActionState,
} from "@/lib/admin/actions/settings";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhooks-events";
import { buildWebhookCurl } from "@/lib/webhooks-example";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { statusLabel, type AdminDict } from "@/lib/admin/i18n";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Field,
  TextInput,
  TextArea,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

type ShippingDict = AdminDict["settings"]["shipping"];

export type WebhookEndpointView = {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  event: string;
  headers: string;
  requiresListenerId: boolean;
  created: string;
};

export type WebhookDeliveryView = {
  id: number;
  endpoint: string;
  event: string;
  status: string;
  attempts: number;
  httpStatus: number | null;
  error: string | null;
  time: string;
};

function eventLabel(s: ShippingDict, event: string): string {
  if (event === "shipment.created") return s.eventShipmentCreated;
  return event;
}

function asEvent(event: string): WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(event)
    ? (event as WebhookEvent)
    : WEBHOOK_EVENTS[0];
}

function CurlBlock({ code }: { code: string }) {
  return (
    <pre className="mt-2 max-h-80 overflow-auto rounded-[var(--radius-sm)] border bg-background px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
      {code}
    </pre>
  );
}

export function WebhookEndpoints({
  endpoints,
  deliveries,
}: {
  endpoints: WebhookEndpointView[];
  deliveries: WebhookDeliveryView[];
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [state, formAction] = useActionState<WebhookEndpointActionState, FormData>(
    createWebhookEndpoint,
    null,
  );

  // Live-preview state for the create form.
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState<WebhookEvent>(WEBHOOK_EVENTS[0]);
  const [headers, setHeaders] = useState("");

  return (
    <>
      <SectionCard title={s.webhooks} icon={<Webhook className="h-4 w-4" />}>
        <p className="mb-4 text-sm text-muted-foreground">{s.webhooksHint}</p>

        {endpoints.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {s.noEndpoints}
          </p>
        ) : (
          <ul className="divide-y rounded-[var(--radius-md)] border">
            {endpoints.map((e) => (
              <EndpointRow key={e.id} endpoint={e} />
            ))}
          </ul>
        )}

        <AdminForm action={formAction} className="mt-5 border-t pt-4">
          <LangField />
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={s.endpointName}
              htmlFor="webhook_endpoint_name"
              className="min-w-[14rem] flex-1"
            >
              <TextInput
                id="webhook_endpoint_name"
                name="endpointName"
                placeholder={s.endpointNamePlaceholder}
                autoComplete="off"
                maxLength={60}
              />
            </Field>
            <Field
              label={s.endpointUrl}
              htmlFor="webhook_endpoint_url"
              className="min-w-[18rem] flex-[2]"
            >
              <TextInput
                id="webhook_endpoint_url"
                name="endpointUrl"
                type="url"
                placeholder={s.endpointUrlPlaceholder}
                autoComplete="off"
                maxLength={2048}
                value={url}
                onChange={(ev) => setUrl(ev.target.value)}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label={s.eventType} htmlFor="webhook_endpoint_event" className="min-w-[14rem]">
              <select
                id="webhook_endpoint_event"
                name="event"
                value={event}
                onChange={(ev) => setEvent(asEvent(ev.target.value))}
                className="h-9 w-full rounded-[var(--radius-sm)] border bg-background px-3 text-sm"
              >
                {WEBHOOK_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {eventLabel(s, ev)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label={s.customHeaders}
            htmlFor="webhook_endpoint_headers"
            hint={s.customHeadersHint}
            className="mt-3"
          >
            <TextArea
              id="webhook_endpoint_headers"
              name="headers"
              rows={3}
              placeholder={s.customHeadersPlaceholder}
              maxLength={4000}
              value={headers}
              onChange={(ev) => setHeaders(ev.target.value)}
              className="font-mono"
            />
          </Field>

          <div className="mt-3">
            <Toggle name="requiresListenerId" label={s.requiresListenerId} />
            <p className="mt-1 text-xs text-muted-foreground">{s.requiresListenerIdHint}</p>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">{s.exampleRequest}</p>
            <CurlBlock code={buildWebhookCurl({ url, event, customHeaders: headers })} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <SubmitButton>{s.addEndpoint}</SubmitButton>
            <ActionNotice state={state} />
          </div>
        </AdminForm>
      </SectionCard>

      <SectionCard title={s.recentDeliveries}>
        {deliveries.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            {s.noDeliveries}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{s.deliveryTime}</th>
                  <th className="px-3 py-2 font-medium">{s.deliveryEndpoint}</th>
                  <th className="px-3 py-2 font-medium">{s.deliveryEvent}</th>
                  <th className="px-3 py-2 font-medium">{s.deliveryStatus}</th>
                  <th className="px-3 py-2 text-right font-medium">{s.deliveryAttempts}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deliveries.map((d) => {
                  const ok = d.status === "success";
                  const detail = [d.httpStatus ? `HTTP ${d.httpStatus}` : null, d.error]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={d.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{d.time}</td>
                      <td className="px-3 py-2">{d.endpoint}</td>
                      <td className="px-3 py-2 text-muted-foreground">{eventLabel(s, d.event)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                            (ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")
                          }
                          title={ok ? undefined : detail || undefined}
                        >
                          {ok ? s.deliverySuccess : s.deliveryFailed}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {d.attempts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function EndpointRow({ endpoint: e }: { endpoint: WebhookEndpointView }) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [open, setOpen] = useState(false);
  const flag = e.enabled ? "active" : "inactive";
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{e.name}</span>
            <StatusBadge status={flag} label={statusLabel(t, flag)} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{e.url}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {eventLabel(s, e.event)}
            {e.requiresListenerId ? ` · ${s.correlatedOnly}` : ""} · {e.created}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RowButton onClick={() => setOpen((v) => !v)} type="button">
            {open ? s.hideExample : s.showExample}
          </RowButton>
          <form action={toggleWebhookEndpoint}>
            <LangField />
            <input type="hidden" name="id" value={e.id} />
            <RowButton>{e.enabled ? s.disable : s.enable}</RowButton>
          </form>
          <form action={deleteWebhookEndpoint}>
            <LangField />
            <input type="hidden" name="id" value={e.id} />
            <RowButton danger>{s.remove}</RowButton>
          </form>
        </div>
      </div>
      {open && (
        <CurlBlock
          code={buildWebhookCurl({ url: e.url, event: asEvent(e.event), customHeaders: e.headers })}
        />
      )}
    </li>
  );
}

function RowButton({
  children,
  danger,
  onClick,
  type = "submit",
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
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
