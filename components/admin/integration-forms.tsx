"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateNovaPost,
  updateFanCourier,
  type SettingsActionState,
} from "@/lib/admin/actions/settings";
import { useAdminT } from "@/lib/admin/i18n-provider";
import type { AdminDict } from "@/lib/admin/i18n";
import { SectionCard } from "@/components/admin/section-card";
import { NovaPostSearchField } from "@/components/admin/novapost-search-field";
import {
  Field,
  TextInput,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

type ShippingDict = AdminDict["settings"]["shipping"];

// Both courier forms read from the single ShippingSettings row. Each form only
// *submits* its own courier's fields, so the per-courier Save actions never
// clobber each other. Fields are grouped like aminterra: integration/token,
// sender information, then default shipping details.
export type ShippingData = {
  novapostEnabled: boolean;
  novapostSandbox: boolean;
  novapostSenderCompanyTin: string;
  novapostSenderDivisionId: string;
  novapostSenderDivisionName: string;
  novapostSenderCountryCode: string;
  novapostDefaultCategory: string;
  novapostSenderName: string;
  novapostSenderPhone: string;
  novapostSenderEmail: string;
  novapostParcelWeightG: number;
  novapostParcelLengthMm: number;
  novapostParcelWidthMm: number;
  novapostParcelHeightMm: number;
  fancourierEnabled: boolean;
  fancourierUseDefaultSender: boolean;
  fancourierServiceType: string;
  fancourierSenderCounty: string;
  fancourierSenderCity: string;
  fancourierSenderStreet: string;
  fancourierSenderNr: string;
  fancourierSenderZipcode: string;
  fancourierDefaultCategory: string;
  fancourierSenderName: string;
  fancourierSenderPhone: string;
  fancourierSenderEmail: string;
  fancourierParcelWeightKg: number;
  fancourierParcelLengthCm: number;
  fancourierParcelWidthCm: number;
  fancourierParcelHeightCm: number;
};

function FormFooter({ state, label }: { state: SettingsActionState; label: string }) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
      <SubmitButton>{label}</SubmitButton>
      <ActionNotice state={state} />
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 mb-3 border-t pt-4 text-sm font-medium text-foreground first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </div>
  );
}

// Write-only API-key field. The current value is never sent to the client — the
// input is always empty; a blank submit keeps the stored key, a pasted value
// replaces it, and the "clear" checkbox (shown only when a key exists) wipes it.
function ApiKeyField({ name, isSet, s }: { name: string; isSet: boolean; s: ShippingDict }) {
  return (
    <div className="mt-4 max-w-xl">
      <Field label={s.apiKey} htmlFor={`${name}_input`}>
        {/* Write-only: a saved key is shown only as a dots placeholder — the real
            value never reaches the client. Typing a new value overwrites it. */}
        <TextInput
          id={`${name}_input`}
          name={name}
          type="password"
          autoComplete="off"
          placeholder={isSet ? "••••••••••••••••" : s.apiKeyEnter}
          aria-label={isSet ? s.configured : s.apiKey}
        />
      </Field>
      {isSet && (
        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{s.apiKeyKeep}</span>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" name={`${name}Clear`} className="accent-[var(--primary)]" />
            {s.clearKey}
          </label>
        </div>
      )}
    </div>
  );
}

// Sender name/phone/email grid (field names prefixed per courier). No heading —
// the form wraps it in the "Sender information" section.
function SenderIdentity({
  prefix,
  s,
  values,
  readOnly,
}: {
  prefix: string;
  s: ShippingDict;
  values: { name: string; phone: string; email: string };
  readOnly?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={s.senderName} htmlFor={`${prefix}_sname`}>
        <TextInput id={`${prefix}_sname`} name={`${prefix}SenderName`} defaultValue={values.name} readOnly={readOnly} />
      </Field>
      <Field label={s.senderPhone} htmlFor={`${prefix}_sphone`}>
        <TextInput id={`${prefix}_sphone`} name={`${prefix}SenderPhone`} type="tel" defaultValue={values.phone} readOnly={readOnly} />
      </Field>
      <Field label={s.senderEmail} htmlFor={`${prefix}_semail`}>
        <TextInput id={`${prefix}_semail`} name={`${prefix}SenderEmail`} type="email" defaultValue={values.email} readOnly={readOnly} />
      </Field>
    </div>
  );
}

// Default-parcel weight + dimensions (units supplied by the caller). No heading.
function ParcelFields({
  weight,
  dims,
}: {
  weight: { name: string; label: string; value: number; step?: string };
  dims: { name: string; label: string; value: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Field label={weight.label} htmlFor={`${weight.name}_i`}>
        <TextInput id={`${weight.name}_i`} name={weight.name} type="number" min="0" step={weight.step} inputMode="decimal" defaultValue={weight.value} />
      </Field>
      {dims.map((d) => (
        <Field key={d.name} label={d.label} htmlFor={`${d.name}_i`}>
          <TextInput id={`${d.name}_i`} name={d.name} type="number" min="0" inputMode="numeric" defaultValue={d.value} />
        </Field>
      ))}
    </div>
  );
}

export function NovaPostForm({
  shipping,
  keySet,
}: {
  shipping: ShippingData | null;
  keySet: boolean;
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [state, formAction] = useActionState<SettingsActionState, FormData>(updateNovaPost, null);

  return (
    <SectionCard title={s.novapost} icon={<Package className="h-4 w-4" strokeWidth={1.75} />}>
      <AdminForm action={formAction}>
        <LangField />

        {/* Token & integration details */}
        <SubHeading>{s.integrationDetails}</SubHeading>
        <p className="mb-3 rounded-[var(--radius-md)] border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {s.apiKeyHint}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Toggle name="novapostEnabled" label={s.enabled} defaultChecked={shipping?.novapostEnabled ?? false} />
          <Toggle name="novapostSandbox" label={s.sandbox} defaultChecked={shipping?.novapostSandbox ?? false} />
        </div>
        <ApiKeyField name="novapostApiKey" isSet={keySet} s={s} />

        {/* Sender information */}
        <SubHeading>{s.sender}</SubHeading>
        <div className="max-w-xl">
          <NovaPostSearchField
            type="divisions"
            name="novapostSenderDivisionId"
            labelName="novapostSenderDivisionName"
            label={s.senderDivisionId}
            defaultValue={shipping?.novapostSenderDivisionId}
            defaultLabel={shipping?.novapostSenderDivisionName}
            keySet={keySet}
          />
        </div>
        <div className="mt-4">
          <SenderIdentity
            prefix="novapost"
            s={s}
            values={{
              name: shipping?.novapostSenderName ?? "",
              phone: shipping?.novapostSenderPhone ?? "",
              email: shipping?.novapostSenderEmail ?? "",
            }}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label={s.senderTin} htmlFor="np_tin">
            <TextInput id="np_tin" name="novapostSenderCompanyTin" defaultValue={shipping?.novapostSenderCompanyTin} />
          </Field>
          <Field label={s.countryCode} htmlFor="np_cc">
            <TextInput id="np_cc" name="novapostSenderCountryCode" defaultValue={shipping?.novapostSenderCountryCode ?? "MD"} />
          </Field>
        </div>

        {/* Default shipping details */}
        <SubHeading>{s.defaultShipping}</SubHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={s.defaultCategory} htmlFor="np_cat">
            <TextInput id="np_cat" name="novapostDefaultCategory" defaultValue={shipping?.novapostDefaultCategory} />
          </Field>
        </div>
        <p className="mt-3 mb-3 text-xs text-muted-foreground">{s.fallbackHint}</p>
        <ParcelFields
          weight={{ name: "novapostParcelWeightG", label: s.weightG, value: shipping?.novapostParcelWeightG ?? 2000 }}
          dims={[
            { name: "novapostParcelLengthMm", label: s.lengthMm, value: shipping?.novapostParcelLengthMm ?? 240 },
            { name: "novapostParcelWidthMm", label: s.widthMm, value: shipping?.novapostParcelWidthMm ?? 160 },
            { name: "novapostParcelHeightMm", label: s.heightMm, value: shipping?.novapostParcelHeightMm ?? 200 },
          ]}
        />

        <FormFooter state={state} label={s.save} />
      </AdminForm>
    </SectionCard>
  );
}

export function FanCourierForm({
  shipping,
  keySet,
}: {
  shipping: ShippingData | null;
  keySet: boolean;
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [state, formAction] = useActionState<SettingsActionState, FormData>(updateFanCourier, null);
  // When the account's default from-address is used, the local sender fields are
  // ignored by the API — so read-only them (readOnly, not disabled, so re-saving
  // never wipes the stored values) and dim the block.
  const [useDefaultSender, setUseDefaultSender] = useState(
    shipping?.fancourierUseDefaultSender ?? true,
  );

  return (
    <SectionCard title={s.fancourier} icon={<Truck className="h-4 w-4" strokeWidth={1.75} />}>
      <AdminForm action={formAction}>
        <LangField />

        {/* Token & integration details */}
        <SubHeading>{s.integrationDetails}</SubHeading>
        <p className="mb-3 rounded-[var(--radius-md)] border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {s.apiKeyHint}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Toggle name="fancourierEnabled" label={s.enabled} defaultChecked={shipping?.fancourierEnabled ?? false} />
        </div>
        <ApiKeyField name="fancourierApiKey" isSet={keySet} s={s} />

        {/* Sender information */}
        <SubHeading>{s.sender}</SubHeading>
        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
          <Toggle
            name="fancourierUseDefaultSender"
            label={s.useDefaultSender}
            defaultChecked={useDefaultSender}
            onChange={setUseDefaultSender}
          />
        </div>
        <div
          className={cn(useDefaultSender && "opacity-50")}
          aria-disabled={useDefaultSender || undefined}
        >
          <SenderIdentity
            prefix="fancourier"
            s={s}
            readOnly={useDefaultSender}
            values={{
              name: shipping?.fancourierSenderName ?? "",
              phone: shipping?.fancourierSenderPhone ?? "",
              email: shipping?.fancourierSenderEmail ?? "",
            }}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={s.senderCounty} htmlFor="fc_county">
              <TextInput id="fc_county" name="fancourierSenderCounty" defaultValue={shipping?.fancourierSenderCounty} readOnly={useDefaultSender} />
            </Field>
            <Field label={s.senderCity} htmlFor="fc_city">
              <TextInput id="fc_city" name="fancourierSenderCity" defaultValue={shipping?.fancourierSenderCity} readOnly={useDefaultSender} />
            </Field>
            <Field label={s.senderStreet} htmlFor="fc_street">
              <TextInput id="fc_street" name="fancourierSenderStreet" defaultValue={shipping?.fancourierSenderStreet} readOnly={useDefaultSender} />
            </Field>
            <Field label={s.senderNr} htmlFor="fc_nr">
              <TextInput id="fc_nr" name="fancourierSenderNr" defaultValue={shipping?.fancourierSenderNr} readOnly={useDefaultSender} />
            </Field>
            <Field label={s.senderZip} htmlFor="fc_zip">
              <TextInput id="fc_zip" name="fancourierSenderZipcode" defaultValue={shipping?.fancourierSenderZipcode} readOnly={useDefaultSender} />
            </Field>
          </div>
        </div>

        {/* Default shipping details */}
        <SubHeading>{s.defaultShipping}</SubHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={s.serviceType} htmlFor="fc_svc">
            <TextInput id="fc_svc" name="fancourierServiceType" defaultValue={shipping?.fancourierServiceType ?? "standard"} />
          </Field>
          <Field label={s.defaultCategory} htmlFor="fc_cat">
            <TextInput id="fc_cat" name="fancourierDefaultCategory" defaultValue={shipping?.fancourierDefaultCategory} />
          </Field>
        </div>
        <p className="mt-3 mb-3 text-xs text-muted-foreground">{s.fallbackHint}</p>
        <ParcelFields
          weight={{ name: "fancourierParcelWeightKg", label: s.weightKg, value: shipping?.fancourierParcelWeightKg ?? 1, step: "0.001" }}
          dims={[
            { name: "fancourierParcelLengthCm", label: s.lengthCm, value: shipping?.fancourierParcelLengthCm ?? 24 },
            { name: "fancourierParcelWidthCm", label: s.widthCm, value: shipping?.fancourierParcelWidthCm ?? 16 },
            { name: "fancourierParcelHeightCm", label: s.heightCm, value: shipping?.fancourierParcelHeightCm ?? 20 },
          ]}
        />

        <FormFooter state={state} label={s.save} />
      </AdminForm>
    </SectionCard>
  );
}
