"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Building2, Home, Package, TriangleAlert, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  updateNovaPost,
  updateFanCourier,
  type SettingsActionState,
} from "@/lib/admin/actions/settings";
import { useAdminT } from "@/lib/admin/i18n-provider";
import type { AdminDict } from "@/lib/admin/i18n";
import type { ContractOption } from "@/lib/courier/novapost";
import type { NovaPostSenderGap } from "@/lib/admin/shipping";
import { SectionCard } from "@/components/admin/section-card";
import { NovaPostSearchField } from "@/components/admin/novapost-search-field";
import { AdminSelect, type AdminSelectOption } from "@/components/admin/select";
import {
  Field,
  TextInput,
  Toggle,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
  ChoiceCards,
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
  novapostSenderType: "division" | "address";
  novapostSenderSettlementId: string;
  novapostSenderSettlementName: string;
  novapostSenderStreet: string;
  novapostSenderBuilding: string;
  novapostSenderFlat: string;
  novapostSenderPostCode: string;
  novapostSenderAddressNote: string;
  novapostClientContractNumber: string;
  novapostCodContractNumber: string;
  novapostCodAccount: string;
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

function FormFooter({
  state,
  label,
  children,
}: {
  state: SettingsActionState;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
      <SubmitButton>{label}</SubmitButton>
      <ActionNotice state={state} />
      {children}
    </div>
  );
}

// An enabled courier that still can't ship (no key, no departure point) is not
// offered on orders. Saving succeeds either way, so the form says what's missing.
function NotReadyNotice({ lead, missing }: { lead: string; missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      {lead} {missing.join(", ")}
    </p>
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

type LoadedContracts = {
  tin: string;
  refresh: unknown;
  list: ContractOption[];
  /** Why there is no list: Nova Post refused the key, refused the TIN, or the
   *  lookup failed some other way (outage, timeout, expired admin session). */
  error: "key" | "tin" | "other" | null;
};

// The sender company's contracts for `tin`, fetched through the admin proxy
// (the key stays on the server). `null` while the answer is still out — which
// includes right after a save: `refresh` is the form's action state, and a new
// key, the sandbox switch or the country all change the list, so one fetched
// before the save says nothing about the settings now in force.
function useNovaPostContracts(tin: string, refresh: unknown): LoadedContracts | null {
  const [loaded, setLoaded] = useState<LoadedContracts | null>(null);
  useEffect(() => {
    if (!tin) return;
    const ac = new AbortController();
    fetch(`/api/admin/novapost/contracts?tin=${encodeURIComponent(tin)}`, { signal: ac.signal })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          contracts?: ContractOption[];
          error?: string;
        };
        if (r.ok) {
          setLoaded({ tin, refresh, list: j.contracts ?? [], error: null });
        } else {
          const error = j.error === "bad_key" ? "key" : j.error === "bad_tin" ? "tin" : "other";
          setLoaded({ tin, refresh, list: [], error });
        }
      })
      .catch(() => {
        if (!ac.signal.aborted) setLoaded({ tin, refresh, list: [], error: "other" });
      });
    return () => ac.abort();
  }, [tin, refresh]);
  return loaded?.tin === tin && loaded.refresh === refresh ? loaded : null;
}

// A TIN as it is saved and looked up: without whitespace (the server's
// `normalizeCompanyTin`, which this client file can't import).
function bareTin(value: string): string {
  return value.replace(/\s+/g, "");
}

// A COD option is one payout account of one contract; the select carries both
// in a single value. Account ids (uuids) never contain the separator.
function codValue(number: string, account: string | null): string {
  return `${number}|${account ?? ""}`;
}

function splitCodValue(value: string): { number: string; account: string } {
  const at = value.lastIndexOf("|");
  return at < 0
    ? { number: value, account: "" }
    : { number: value.slice(0, at), account: value.slice(at + 1) };
}

// "Automatic" + the given options. The saved pick is always offered, even
// before the list loads or once the contract has lapsed — otherwise the select
// would post "" and a plain re-save would silently drop the choice.
function contractOptions(
  listed: AdminSelectOption[],
  selected: string,
  selectedNumber: string,
  loaded: boolean,
  s: ShippingDict,
): AdminSelectOption[] {
  const options: AdminSelectOption[] = [{ value: "", label: s.contractAuto }, ...listed];
  if (selected && !listed.some((o) => o.value === selected)) {
    options.push({
      value: selected,
      label: loaded ? `${selectedNumber} · ${s.contractInactive}` : selectedNumber,
    });
  }
  return options;
}

export function NovaPostForm({
  shipping,
  keySet,
  senderGaps,
}: {
  shipping: ShippingData | null;
  keySet: boolean;
  /** What the *saved* departure point still lacks (see `novapostSenderGaps`). */
  senderGaps: NovaPostSenderGap[];
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const sh = t.orders.shipment;
  const [state, formAction] = useActionState<SettingsActionState, FormData>(updateNovaPost, null);

  const [senderType, setSenderType] = useState<"division" | "address">(
    shipping?.novapostSenderType ?? "division",
  );
  const [settlementId, setSettlementId] = useState(shipping?.novapostSenderSettlementId ?? "");
  const [postCode, setPostCode] = useState(shipping?.novapostSenderPostCode ?? "");

  // Why the saved, enabled integration isn't offered on orders yet — the same
  // conditions the order page checks, named field by field.
  const gapLabels: Record<NovaPostSenderGap, string> = {
    division: sh.branch,
    settlement: sh.settlement,
    street: s.senderStreet,
    building: sh.building,
    postCode: s.senderZip,
  };
  const notReady = shipping?.novapostEnabled
    ? [...(keySet ? [] : [s.apiKey]), ...senderGaps.map((g) => gapLabels[g])]
    : [];

  const savedTin = shipping?.novapostSenderCompanyTin ?? "";
  const [tin, setTin] = useState(savedTin);
  // The TIN the contract list is fetched for: what the field held when the
  // admin last left it (or pressed Enter) — not every prefix typed on the way,
  // each of which would be a lookup of its own, possibly of another company.
  const [lookupTin, setLookupTin] = useState(savedTin);
  // Nova Post matches a TIN without whitespace; the save strips it too.
  const liveTin = bareTin(tin);
  // Contracts are looked up by the company TIN, so there is no list without
  // both the key and a TIN.
  const listTin = keySet ? bareTin(lookupTin) : "";
  const fetched = useNovaPostContracts(listTin, state);
  // While the field is mid-edit, the list on hand belongs to another TIN.
  const contracts = listTin === liveTin ? fetched : null;

  // Contract picks belong to the TIN they were made under. Once the field holds
  // another company's TIN they no longer apply — and are not posted — and they
  // come back if the TIN is restored.
  const [picks, setPicks] = useState({
    tin: bareTin(savedTin),
    client: shipping?.novapostClientContractNumber ?? "",
    cod: shipping?.novapostCodContractNumber ?? "",
    codAccount: shipping?.novapostCodAccount ?? "",
  });
  const pick =
    picks.tin === liveTin ? picks : { tin: liveTin, client: "", cod: "", codAccount: "" };

  const clientOptions: AdminSelectOption[] = (contracts?.list ?? [])
    .filter((c) => c.type === "Client")
    .map((c) => ({ value: c.number, label: c.number }));
  // One option per payout account: every contract in the list belongs to the
  // one sender company (named under the TIN field), so an option is its number
  // plus the tail of the account Nova Pay would pay out to.
  const codListed = (contracts?.list ?? []).filter((c) => c.type === "COD");
  const codOptions: AdminSelectOption[] = codListed.map((c) => ({
    value: codValue(c.number, c.account),
    label: c.accountTail ? `${c.number} · …${c.accountTail}` : c.number,
  }));
  // A contract saved without an account means its first one.
  const codFirst = codListed.find((c) => c.number === pick.cod);
  const codSelected = !pick.cod
    ? ""
    : codValue(pick.cod, pick.codAccount || (codFirst?.account ?? ""));

  const contractsNote = !keySet
    ? s.contractsNeedKey
    : !liveTin
      ? s.contractsNeedTin
      : !contracts
        ? s.contractsLoading
        : contracts.error === "key"
          ? s.contractsBadKey
          : contracts.error === "tin"
            ? s.contractsBadTin
            : contracts.error
              ? s.contractsError
              : contracts.list.length === 0
                ? s.contractsNone
                : null;
  // Only a list that actually arrived can call a saved contract inactive.
  const loaded = Boolean(contracts && !contracts.error);
  const pickInactive =
    loaded &&
    ((pick.client !== "" && !clientOptions.some((o) => o.value === pick.client)) ||
      (codSelected !== "" && !codOptions.some((o) => o.value === codSelected)));

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
        {notReady.length > 0 && (
          <div className="mt-3 flex">
            <NotReadyNotice lead={s.notReady} missing={notReady} />
          </div>
        )}
        <ApiKeyField name="novapostApiKey" isSet={keySet} s={s} />

        {/* Contracts: which agreements shipments are billed and paid out on */}
        <SubHeading>{s.contracts}</SubHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={s.senderTin} htmlFor="np_tin" hint={contracts?.list[0]?.companyName ?? undefined}>
            <TextInput
              id="np_tin"
              name="novapostSenderCompanyTin"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              onBlur={() => setLookupTin(tin)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setLookupTin(tin);
              }}
            />
          </Field>
          <Field label={s.clientContract} htmlFor="np_contract" hint={s.clientContractHint}>
            <AdminSelect
              id="np_contract"
              name="novapostClientContractNumber"
              value={pick.client}
              onValueChange={(client) => setPicks({ ...pick, client })}
              options={contractOptions(clientOptions, pick.client, pick.client, loaded, s)}
            />
          </Field>
          <Field label={s.codContract} htmlFor="np_cod_contract" hint={s.codContractHint}>
            <input type="hidden" name="novapostCodContractNumber" value={pick.cod} />
            <input
              type="hidden"
              name="novapostCodAccount"
              value={splitCodValue(codSelected).account}
            />
            <AdminSelect
              id="np_cod_contract"
              value={codSelected}
              onValueChange={(value) => {
                const { number, account } = splitCodValue(value);
                setPicks({ ...pick, cod: number, codAccount: account });
              }}
              options={contractOptions(codOptions, codSelected, pick.cod, loaded, s)}
            />
          </Field>
        </div>
        {contractsNote && <p className="mt-3 text-xs text-muted-foreground">{contractsNote}</p>}
        {pickInactive && (
          <p className="mt-3 text-xs text-[var(--warning,#F97316)]">{s.contractInactiveNote}</p>
        )}

        {/* Sender information */}
        <SubHeading>{s.sender}</SubHeading>
        <input type="hidden" name="novapostSenderType" value={senderType} />
        <div className="mb-1.5 label-mono text-muted-foreground">{s.departure}</div>
        <ChoiceCards
          className="max-w-xl"
          value={senderType}
          onChange={setSenderType}
          options={[
            { value: "division", icon: Building2, title: s.fromDivision, description: s.fromDivisionDesc },
            { value: "address", icon: Home, title: s.fromAddress, description: s.fromAddressDesc },
          ]}
        />
        {/* Both departure points stay mounted (the inactive one hidden) so each
            keeps its values — and keeps posting them — across a switch. */}
        <div className={cn("mt-4 max-w-xl", senderType !== "division" && "hidden")}>
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
        <div className={cn("mt-4 flex flex-col gap-4", senderType !== "address" && "hidden")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <NovaPostSearchField
              type="settlements"
              name="novapostSenderSettlementId"
              labelName="novapostSenderSettlementName"
              label={`${sh.settlement} *`}
              defaultValue={shipping?.novapostSenderSettlementId}
              defaultLabel={shipping?.novapostSenderSettlementName}
              // The directory knows the settlement's postal code — fill it in, so
              // picking a city doesn't leave the address one field short. A
              // settlement without one (or a cleared field) empties the code:
              // the previous city's must not ride along onto waybills.
              onSelect={(id, _label, code) => {
                setSettlementId(id);
                setPostCode(code ?? "");
              }}
              keySet={keySet}
            />
            <NovaPostSearchField
              type="streets"
              submit="label"
              name="novapostSenderStreet"
              label={`${s.senderStreet} *`}
              defaultValue={shipping?.novapostSenderStreet}
              defaultLabel={shipping?.novapostSenderStreet}
              settlementId={settlementId}
              disabled={!settlementId}
              placeholder={sh.selectSettlementFirst}
              keySet={keySet}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label={`${sh.building} *`} htmlFor="np_building">
              <TextInput id="np_building" name="novapostSenderBuilding" maxLength={100} defaultValue={shipping?.novapostSenderBuilding} />
            </Field>
            <Field label={sh.flat} htmlFor="np_flat">
              <TextInput id="np_flat" name="novapostSenderFlat" maxLength={10} defaultValue={shipping?.novapostSenderFlat} />
            </Field>
            <Field label={`${s.senderZip} *`} htmlFor="np_post">
              <TextInput
                id="np_post"
                name="novapostSenderPostCode"
                maxLength={10}
                value={postCode}
                onChange={(e) => setPostCode(e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">* {s.addressRequiredHint}</p>
          <div className="max-w-xl">
            <Field label={s.addressNote} htmlFor="np_addr_note">
              <TextInput id="np_addr_note" name="novapostSenderAddressNote" maxLength={100} defaultValue={shipping?.novapostSenderAddressNote} />
            </Field>
          </div>
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

        <FormFooter state={state} label={s.save}>
          <NotReadyNotice lead={s.notReady} missing={notReady} />
        </FormFooter>
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
