"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Truck, ChevronRight, ArrowLeft, Building2, Home, GripVertical } from "lucide-react";
import {
  createNovaPostShipment,
  createFanCourierShipment,
  type ShippingActionState,
} from "@/lib/admin/actions/shipping";
import { toFanCourierUnits } from "@/lib/courier/parcel";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { NovaPostSearchField } from "@/components/admin/novapost-search-field";
import { FanCourierCityField } from "@/components/admin/fancourier-city-field";
import { AdminSelect } from "@/components/admin/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Field,
  TextInput,
  TextArea,
  SubmitButton,
  ActionNotice,
  LangField,
  AdminForm,
} from "@/components/admin/form-controls";

export type ShipmentItem = {
  name: string;
  category: string;
  qty: number;
  unitValue: number;
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
};

type ParcelFallback = { weightG: number; lengthMm: number; widthMm: number; heightMm: number };

type ComputedParcel = {
  description: string;
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  value: number;
  qty: number;
};

// Split a total declared value across parcels, proportional to each parcel's
// goods value; the last parcel absorbs the rounding remainder so the parts sum
// back to the total.
function splitInsurance(values: number[], total: number): number[] {
  const n = values.length;
  if (n === 0) return [];
  const sum = values.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let used = 0;
  for (let i = 0; i < n; i += 1) {
    const prop = sum > 0 ? values[i] / sum : 1 / n;
    const v = i === n - 1 ? total - used : Math.round(total * prop * 100) / 100;
    const clamped = Math.max(0, Math.round(v * 100) / 100);
    out.push(clamped);
    used += clamped;
  }
  return out;
}

// Distribute the order's units across `count` parcels (greedy, fewest-units
// first), then recalculate each parcel's weight and dimensions — max footprint
// per axis, stacking the total unit count along the shortest axis. Mirrors the
// single-parcel assembleParcel, applied per parcel.
function distributeParcels(
  items: ShipmentItem[],
  count: number,
  fallback: ParcelFallback,
): ComputedParcel[] {
  type Bin = {
    qty: number;
    weight: number;
    value: number;
    units: { w: number; l: number; h: number }[];
    lines: Map<string, number>;
  };
  const bins: Bin[] = Array.from({ length: count }, () => ({
    qty: 0,
    weight: 0,
    value: 0,
    units: [],
    lines: new Map(),
  }));

  for (const it of items) {
    const w = it.weightG > 0 ? it.weightG : fallback.weightG;
    const wd = it.widthMm > 0 ? it.widthMm : fallback.widthMm;
    const ln = it.lengthMm > 0 ? it.lengthMm : fallback.lengthMm;
    const ht = it.heightMm > 0 ? it.heightMm : fallback.heightMm;
    for (let u = 0; u < it.qty; u += 1) {
      let ti = 0;
      for (let i = 1; i < count; i += 1) if (bins[i].qty < bins[ti].qty) ti = i;
      const b = bins[ti];
      b.qty += 1;
      b.weight += w;
      b.value += it.unitValue;
      b.units.push({ w: wd, l: ln, h: ht });
      b.lines.set(it.name, (b.lines.get(it.name) ?? 0) + 1);
    }
  }

  return bins.map((b, idx) => {
    const maxW = b.units.length ? Math.max(...b.units.map((u) => u.w)) : fallback.widthMm;
    const maxL = b.units.length ? Math.max(...b.units.map((u) => u.l)) : fallback.lengthMm;
    const maxH = b.units.length ? Math.max(...b.units.map((u) => u.h)) : fallback.heightMm;
    const axes: [string, number][] = [
      ["w", maxW],
      ["l", maxL],
      ["h", maxH],
    ];
    const stackAxis = axes.slice().sort((a, b2) => a[1] - b2[1])[0][0];
    const qty = Math.max(1, b.qty);
    const description =
      [...b.lines.entries()].map(([name, n]) => `${n}× ${name}`).join("; ").slice(0, 120) ||
      `Colet ${idx + 1}`;
    return {
      description,
      weightG: Math.round(b.weight) || fallback.weightG,
      widthMm: Math.round(stackAxis === "w" ? maxW * qty : maxW),
      lengthMm: Math.round(stackAxis === "l" ? maxL * qty : maxL),
      heightMm: Math.round(stackAxis === "h" ? maxH * qty : maxH),
      value: b.value,
      qty: b.qty,
    };
  });
}

type Carrier = "novapost" | "fancourier";

const ghostBtn =
  "flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm transition-colors hover:bg-foreground/[0.03]";

type Recipient = { name: string; phone: string; email: string };
type OrderAddress = { city: string | null; street: string | null; postCode: string | null };

type TokenTarget = "street" | "building" | "flat";
type AddressPart = { label: string; target: TokenTarget };

// Split the order's single address line into clean, field-targeted parts so the
// door fields can be auto-filled and re-assigned with one click. Nova Post wants
// a bare street *name* (its search won't match "str. … 128"), the house number
// in `building`, and the apartment in `flat` — so prefixes are stripped and a
// "street + number" part is split across street and building. The lookahead
// keeps real names ("bulevardul", "Aprilie") from matching a prefix.
const FLAT_RE = /^(?:ap|apt|apart|apartament|кв|#)(?=[\s.\d]|$)\.?\s*/i;
const BUILDING_RE = /^(?:bl|bloc|korp|корп)(?=[\s.\d]|$)\.?\s*/i;
const STREET_RE =
  /^(?:str|strada|bd|b-dul|bulevardul|șos|sos|șoseaua|aleea|alee|стр|ул)(?=[\s.\d]|$)\.?\s*/i;

function parseAddressParts(addr: string | null): AddressPart[] {
  if (!addr) return [];
  const parts: AddressPart[] = [];
  const push = (label: string, target: TokenTarget) => {
    const l = label.trim();
    if (l) parts.push({ label: l, target });
  };
  for (const raw of addr.split(",")) {
    const part = raw.trim();
    if (!part) continue;
    if (FLAT_RE.test(part)) {
      push(part.replace(FLAT_RE, ""), "flat");
    } else if (BUILDING_RE.test(part)) {
      push(part.replace(BUILDING_RE, ""), "building");
    } else {
      const name = part.replace(STREET_RE, "");
      const m = name.match(/^(.*?[^\s\d])\s+(\d+[a-z]?)$/i);
      if (m) {
        push(m[1], "street");
        push(m[2], "building");
      } else {
        push(name, "street");
      }
    }
  }
  return parts;
}

// Wraps a plain input so a dragged address-part chip can be dropped onto it.
function DropField({
  onDrop,
  children,
}: {
  onDrop: (text: string) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const text = e.dataTransfer.getData("text/plain").trim();
        if (text) onDrop(text);
      }}
      className={`rounded-[var(--radius-md)] ${
        over ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {children}
    </div>
  );
}

// A draggable reference to an original order value (city, post code, address
// part). Drop it on a matching field to fill/search it — the ergonomic way to
// move the order's data into the courier form.
function RefChip({ label }: { label: string }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", label);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="flex cursor-grab items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:border-primary hover:bg-primary/[0.04] active:cursor-grabbing"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
      {label}
    </span>
  );
}

export function ShipmentDialog({
  orderId,
  recipient,
  address,
  items,
  fallback,
  fancourierFallback,
  insuranceTotal,
  novapostConfigured,
  fancourierConfigured,
}: {
  orderId: number;
  recipient: Recipient;
  address: OrderAddress;
  items: ShipmentItem[];
  fallback: ParcelFallback;
  fancourierFallback: ParcelFallback;
  insuranceTotal: number;
  novapostConfigured: boolean;
  fancourierConfigured: boolean;
}) {
  const t = useAdminT();
  const s = t.orders.shipment;
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState<Carrier | null>(null);

  function change(next: boolean) {
    setOpen(next);
    if (!next) setCarrier(null);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ghostBtn}>
        <Truck className="h-4 w-4" strokeWidth={1.75} />
        {s.create}
      </button>

      <Dialog open={open} onOpenChange={change}>
        <DialogContent className={carrier === null ? "max-w-md" : "max-w-2xl"}>
          {carrier === null ? (
            <CarrierChooser
              novapostConfigured={novapostConfigured}
              fancourierConfigured={fancourierConfigured}
              onPick={setCarrier}
            />
          ) : carrier === "novapost" ? (
            <NovaPostShipmentForm
              orderId={orderId}
              recipient={recipient}
              address={address}
              items={items}
              fallback={fallback}
              insuranceTotal={insuranceTotal}
              onBack={() => setCarrier(null)}
              onDone={() => change(false)}
            />
          ) : (
            <FanCourierShipmentForm
              orderId={orderId}
              recipient={recipient}
              address={address}
              items={items}
              fallback={fancourierFallback}
              insuranceTotal={insuranceTotal}
              onBack={() => setCarrier(null)}
              onDone={() => change(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CarrierChooser({
  novapostConfigured,
  fancourierConfigured,
  onPick,
}: {
  novapostConfigured: boolean;
  fancourierConfigured: boolean;
  onPick: (c: Carrier) => void;
}) {
  const t = useAdminT();
  const s = t.orders.shipment;

  const carriers: {
    id: Carrier;
    name: string;
    desc: string;
    enabled: boolean;
    hint: string | null;
  }[] = [
    {
      id: "novapost",
      name: t.nav.novaPost,
      desc: t.settings.shipping.novaPostDesc,
      enabled: novapostConfigured,
      hint: novapostConfigured ? null : s.needsConfig,
    },
    {
      id: "fancourier",
      name: t.nav.fanCourier,
      desc: t.settings.shipping.fanCourierDesc,
      enabled: fancourierConfigured,
      hint: fancourierConfigured ? null : s.needsConfig,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>{s.chooseCarrier}</DialogTitle>
        <DialogDescription className="mt-1">{s.chooseCarrierDesc}</DialogDescription>
      </div>
      <div className="grid gap-3">
        {carriers.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!c.enabled}
            onClick={() => onPick(c.id)}
            className="flex items-center gap-3 rounded-[var(--radius-md)] border p-4 text-left transition-colors enabled:cursor-pointer enabled:hover:bg-foreground/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-muted">
              <Truck className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.desc}</div>
            </div>
            {c.enabled ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {c.hint}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type ParcelOverride = Partial<
  Pick<ComputedParcel, "description" | "weightG" | "lengthMm" | "widthMm" | "heightMm">
> & { insuranceCost?: number };

function NovaPostShipmentForm({
  orderId,
  recipient,
  address,
  items,
  fallback,
  insuranceTotal,
  onBack,
  onDone,
}: {
  orderId: number;
  recipient: Recipient;
  address: OrderAddress;
  items: ShipmentItem[];
  fallback: ParcelFallback;
  insuranceTotal: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useAdminT();
  const s = t.orders.shipment;
  const parts = parseAddressParts(address.street);
  const [deliveryType, setDeliveryType] = useState<"branch" | "door">("door");
  const [settlementId, setSettlementId] = useState("");
  const streetSeed = parts
    .filter((p) => p.target === "street")
    .map((p) => p.label)
    .join(" ");
  const [building, setBuilding] = useState(
    parts.find((p) => p.target === "building")?.label ?? "",
  );
  const [flat, setFlat] = useState(parts.find((p) => p.target === "flat")?.label ?? "");
  const [postCode, setPostCode] = useState(address.postCode ?? "");
  const [novaPay, setNovaPay] = useState(true);
  const [declaredValue, setDeclaredValue] = useState(String(insuranceTotal));
  // Lampino's address-delivery fee, collected on top of the goods value: the
  // COD total is declared value + fee, while the parcel insurance stays goods-only.
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [state, formAction] = useActionState<ShippingActionState, FormData>(
    createNovaPostShipment.bind(null, orderId),
    null,
  );

  // Parcel splitting: the unit count caps how many parcels make sense. Editing
  // the count re-distributes and clears per-parcel overrides (indices shift).
  const totalUnits = Math.max(1, items.reduce((sum, i) => sum + i.qty, 0));
  const [parcelCount, setParcelCount] = useState(1);
  const [overrides, setOverrides] = useState<Record<number, ParcelOverride>>({});
  const count = Math.min(Math.max(1, parcelCount), totalUnits);

  function changeCount(next: number) {
    setParcelCount(Math.min(Math.max(1, next || 1), totalUnits));
    setOverrides({});
  }
  function setOverride(i: number, field: keyof ParcelOverride, value: string) {
    setOverrides((prev) => ({ ...prev, [i]: { ...prev[i], [field]: value } }));
  }

  // Recompute parcels from the item distribution, split the declared value
  // across them (proportional to parcel value, last gets the remainder), then
  // apply any manual overrides. This is what the form submits as `parcelsJson`.
  const declaredTotal = Math.max(0, Number(declaredValue) || 0);
  const codTotal = declaredTotal + Math.max(0, Number(deliveryFee) || 0);
  const base = distributeParcels(items, count, fallback);
  const insuranceSplit = splitInsurance(
    base.map((p) => p.value),
    declaredTotal,
  );
  const parcels = base.map((p, i) => {
    const o = overrides[i] ?? {};
    const num = (v: unknown, fb: number) => {
      const n = Number(v);
      return v !== undefined && v !== "" && Number.isFinite(n) ? n : fb;
    };
    return {
      description: o.description !== undefined && o.description !== "" ? o.description : p.description,
      weightG: num(o.weightG, p.weightG),
      lengthMm: num(o.lengthMm, p.lengthMm),
      widthMm: num(o.widthMm, p.widthMm),
      heightMm: num(o.heightMm, p.heightMm),
      insuranceCost: num(o.insuranceCost, insuranceSplit[i]),
      qty: p.qty,
    };
  });
  // Note carries per-item detail incl. category (the "additional information"
  // Nova Post shows the courier), mirroring aminterra's qty,category,name note.
  const noteDefault = items
    .map((i) => [i.qty, i.category, i.name].filter(Boolean).join(", "))
    .join("; ")
    .slice(0, 255);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          aria-label={s.back}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <DialogTitle>{t.nav.novaPost}</DialogTitle>
      </div>

      <AdminForm action={formAction}>
        <LangField />
        <input type="hidden" name="deliveryType" value={deliveryType} />

        <div className="text-sm font-medium">{s.recipient}</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label={s.name} htmlFor="rc_name">
            <TextInput id="rc_name" name="recipientName" defaultValue={recipient.name} />
          </Field>
          <Field label={s.phone} htmlFor="rc_phone">
            <TextInput id="rc_phone" name="recipientPhone" type="tel" defaultValue={recipient.phone} />
          </Field>
          <Field label={s.email} htmlFor="rc_email">
            <TextInput id="rc_email" name="recipientEmail" type="email" defaultValue={recipient.email} />
          </Field>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 label-mono text-muted-foreground">{s.deliveryType}</div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { v: "door", icon: Home, title: s.toDoor, desc: s.doorDesc },
                { v: "branch", icon: Building2, title: s.toBranch, desc: s.branchDesc },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = deliveryType === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDeliveryType(opt.v)}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/[0.04]" : "hover:bg-foreground/[0.03]"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{opt.title}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 sm:w-1/2 sm:pr-1.5">
          <Field label={s.payer} htmlFor="rc_payer">
            <AdminSelect
              id="rc_payer"
              name="payerType"
              defaultValue="Recipient"
              options={[
                { value: "Recipient", label: s.payerRecipient },
                { value: "Sender", label: s.payerSender },
              ]}
            />
          </Field>
        </div>

        {(address.city || address.postCode) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{s.originalValues}</span>
            {address.city && <RefChip label={address.city} />}
            {address.postCode && <RefChip label={address.postCode} />}
          </div>
        )}

        <div className="mt-3">
          <NovaPostSearchField
            type="settlements"
            name="recipientSettlementId"
            labelName="recipientSettlementName"
            label={s.settlement}
            initialQuery={address.city}
            onSelect={(id) => setSettlementId(id)}
            acceptDrop
            keySet
          />
        </div>

        {deliveryType === "branch" ? (
          <div className="mt-3">
            <NovaPostSearchField
              type="divisions"
              name="recipientDivisionId"
              labelName="recipientDivisionName"
              label={s.branch}
              settlementId={settlementId}
              initialQuery={address.city}
              disabled={!settlementId}
              placeholder={s.selectSettlementFirst}
              keySet
            />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {address.street && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{s.originalAddress}:</span>{" "}
                {address.street}
              </p>
            )}
            {parts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{s.dragHint}</span>
                {parts.map((p, i) => (
                  <RefChip key={i} label={p.label} />
                ))}
              </div>
            )}
            <NovaPostSearchField
              type="streets"
              submit="label"
              name="recipientStreet"
              label={s.street}
              initialQuery={streetSeed}
              settlementId={settlementId}
              acceptDrop
              keySet
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={s.building} htmlFor="rc_building">
                <DropField onDrop={setBuilding}>
                  <TextInput
                    id="rc_building"
                    name="recipientBuilding"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                  />
                </DropField>
              </Field>
              <Field label={s.flat} htmlFor="rc_flat">
                <DropField onDrop={setFlat}>
                  <TextInput
                    id="rc_flat"
                    name="recipientFlat"
                    value={flat}
                    onChange={(e) => setFlat(e.target.value)}
                  />
                </DropField>
              </Field>
              <Field label={s.postCode} htmlFor="rc_post">
                <DropField onDrop={setPostCode}>
                  <TextInput
                    id="rc_post"
                    name="recipientPostCode"
                    value={postCode}
                    onChange={(e) => setPostCode(e.target.value)}
                  />
                </DropField>
              </Field>
            </div>
          </div>
        )}

        <div className="mt-5 border-t pt-4 text-sm font-medium">{s.summary}</div>

        {/* Nova Pay (cash-on-delivery). Declared value shows when enabled and is
            always what the parcel's insurance is submitted as. */}
        <div className="mt-3 rounded-[var(--radius-md)] border p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.novaPay}</div>
              <div className="text-xs text-muted-foreground">{s.novaPayDesc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={novaPay}
              aria-label={s.novaPay}
              onClick={() => setNovaPay((v) => !v)}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                novaPay ? "bg-primary" : "bg-foreground/20"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
                  novaPay ? "left-[1.125rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <input type="hidden" name="novaPay" value={novaPay ? "1" : ""} />
          {novaPay && (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label={s.insurance} htmlFor="pc_cod">
                  <TextInput
                    id="pc_cod"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                  />
                </Field>
                <Field label={s.deliveryFee} htmlFor="pc_fee">
                  <TextInput
                    id="pc_fee"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {s.codTotal}:{" "}
                <span className="font-medium text-foreground">{codTotal}</span>
              </div>
            </>
          )}
        </div>

        {/* The parcel's declared value / insurance (goods only), always submitted. */}
        <input type="hidden" name="parcelInsurance" value={declaredValue} />
        {/* Address-delivery fee added to the COD total collected on delivery. */}
        <input type="hidden" name="codDeliveryFee" value={deliveryFee} />

        <div className="mt-3">
          <Field label={s.note} htmlFor="pc_note">
            <TextArea id="pc_note" name="note" rows={2} defaultValue={noteDefault} />
          </Field>
        </div>

        <div className="mt-3 sm:w-1/3">
          <Field label={s.parcelCount} htmlFor="pc_count">
            <TextInput
              id="pc_count"
              type="number"
              min="1"
              max={totalUnits}
              inputMode="numeric"
              value={String(count)}
              onChange={(e) => changeCount(Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Parcels — weight and dimensions recalculated as the count changes. */}
        <input
          type="hidden"
          name="parcelsJson"
          value={JSON.stringify(
            parcels.map((p) => ({
              description: p.description,
              weightG: p.weightG,
              lengthMm: p.lengthMm,
              widthMm: p.widthMm,
              heightMm: p.heightMm,
              insuranceCost: p.insuranceCost,
            })),
          )}
        />
        <div className="mt-3 flex flex-col gap-3">
          {parcels.map((p, i) => (
            <div key={i} className="rounded-[var(--radius-md)] border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {s.parcel} {i + 1}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.qty} {s.items}
                </div>
              </div>
              <div className="mt-3">
                <Field label={s.description} htmlFor={`pc_desc_${i}`}>
                  <TextInput
                    id={`pc_desc_${i}`}
                    value={p.description}
                    onChange={(e) => setOverride(i, "description", e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label={s.weightG} htmlFor={`pc_w_${i}`}>
                  <TextInput
                    id={`pc_w_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.weightG)}
                    onChange={(e) => setOverride(i, "weightG", e.target.value)}
                  />
                </Field>
                <Field label={s.insurance} htmlFor={`pc_ins_${i}`}>
                  <TextInput
                    id={`pc_ins_${i}`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={String(p.insuranceCost)}
                    onChange={(e) => setOverride(i, "insuranceCost", e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <Field label={s.widthMm} htmlFor={`pc_wd_${i}`}>
                  <TextInput
                    id={`pc_wd_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.widthMm)}
                    onChange={(e) => setOverride(i, "widthMm", e.target.value)}
                  />
                </Field>
                <Field label={s.lengthMm} htmlFor={`pc_l_${i}`}>
                  <TextInput
                    id={`pc_l_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.lengthMm)}
                    onChange={(e) => setOverride(i, "lengthMm", e.target.value)}
                  />
                </Field>
                <Field label={s.heightMm} htmlFor={`pc_h_${i}`}>
                  <TextInput
                    id={`pc_h_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.heightMm)}
                    onChange={(e) => setOverride(i, "heightMm", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
          <SubmitButton>{s.submit}</SubmitButton>
          <button type="button" onClick={onDone} className={ghostBtn}>
            {s.cancel}
          </button>
          <ActionNotice state={state} />
        </div>
      </AdminForm>
    </div>
  );
}

type FanParcelOverride = {
  weightKg?: string;
  lengthCm?: string;
  widthCm?: string;
  heightCm?: string;
};

// Fan Courier is door-to-street only (no branch pickup), uses native kg/cm, and
// carries a single shipment-level declared value + ramburs (COD) rather than
// per-parcel insurance — so this form diverges from the Nova Post one despite
// sharing the parcel-distribution and address-part helpers.
function FanCourierShipmentForm({
  orderId,
  recipient,
  address,
  items,
  fallback,
  insuranceTotal,
  onBack,
  onDone,
}: {
  orderId: number;
  recipient: Recipient;
  address: OrderAddress;
  items: ShipmentItem[];
  fallback: ParcelFallback;
  insuranceTotal: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useAdminT();
  const s = t.orders.shipment;
  const parts = parseAddressParts(address.street);
  const streetSeed = parts
    .filter((p) => p.target === "street")
    .map((p) => p.label)
    .join(" ");
  const [nr, setNr] = useState(parts.find((p) => p.target === "building")?.label ?? "");
  const [flat, setFlat] = useState(parts.find((p) => p.target === "flat")?.label ?? "");
  const [zip, setZip] = useState(address.postCode ?? "");
  const [cod, setCod] = useState(true);
  const [codAmount, setCodAmount] = useState(String(insuranceTotal));
  // Lampino's address-delivery fee, added to the ramburs total collected.
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [declaredValue, setDeclaredValue] = useState(String(insuranceTotal));
  const codTotal = Math.max(0, Number(codAmount) || 0) + Math.max(0, Number(deliveryFee) || 0);
  const [state, formAction] = useActionState<ShippingActionState, FormData>(
    createFanCourierShipment.bind(null, orderId),
    null,
  );

  const totalUnits = Math.max(1, items.reduce((sum, i) => sum + i.qty, 0));
  const [parcelCount, setParcelCount] = useState(1);
  const [overrides, setOverrides] = useState<Record<number, FanParcelOverride>>({});
  const count = Math.min(Math.max(1, parcelCount), totalUnits);

  function changeCount(next: number) {
    setParcelCount(Math.min(Math.max(1, next || 1), totalUnits));
    setOverrides({});
  }
  function setOverride(i: number, field: keyof FanParcelOverride, value: string) {
    setOverrides((prev) => ({ ...prev, [i]: { ...prev[i], [field]: value } }));
  }

  // Distribute the units (canonical g/mm), convert each parcel to Fan Courier
  // units (kg/cm), then apply any manual overrides. Submitted as `parcelsJson`.
  const base = distributeParcels(items, count, fallback);
  const num = (v: unknown, fb: number) => {
    const n = Number(v);
    return v !== undefined && v !== "" && Number.isFinite(n) ? n : fb;
  };
  const parcels = base.map((p, i) => {
    const fc = toFanCourierUnits(p);
    const o = overrides[i] ?? {};
    return {
      weightKg: num(o.weightKg, fc.weightKg),
      lengthCm: num(o.lengthCm, fc.lengthCm),
      widthCm: num(o.widthCm, fc.widthCm),
      heightCm: num(o.heightCm, fc.heightCm),
      qty: p.qty,
    };
  });

  // Content mirrors the Nova Post note: qty, category, name per item — the
  // description the courier prints for the shipment.
  const contentDefault = items
    .map((i) => [i.qty, i.category, i.name].filter(Boolean).join(", "))
    .join("; ")
    .slice(0, 255);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          aria-label={s.back}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <DialogTitle>{t.nav.fanCourier}</DialogTitle>
      </div>

      <AdminForm action={formAction}>
        <LangField />

        <div className="text-sm font-medium">{s.recipient}</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <Field label={s.name} htmlFor="fc_name">
            <TextInput id="fc_name" name="recipientName" defaultValue={recipient.name} />
          </Field>
          <Field label={s.phone} htmlFor="fc_phone">
            <TextInput id="fc_phone" name="recipientPhone" type="tel" defaultValue={recipient.phone} />
          </Field>
          <Field label={s.email} htmlFor="fc_email">
            <TextInput id="fc_email" name="recipientEmail" type="email" defaultValue={recipient.email} />
          </Field>
        </div>

        {(address.city || address.postCode) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{s.originalValues}</span>
            {address.city && <RefChip label={address.city} />}
            {address.postCode && <RefChip label={address.postCode} />}
          </div>
        )}

        <div className="mt-3">
          <FanCourierCityField
            cityName="recipientCity"
            countyName="recipientCounty"
            label={s.city}
            initialCity={address.city}
            keySet
          />
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {address.street && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{s.originalAddress}:</span>{" "}
              {address.street}
            </p>
          )}
          {parts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{s.dragHint}</span>
              {parts.map((p, i) => (
                <RefChip key={i} label={p.label} />
              ))}
            </div>
          )}
          <Field label={s.street} htmlFor="fc_street">
            <TextInput id="fc_street" name="recipientStreet" defaultValue={streetSeed} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={s.number} htmlFor="fc_nr">
              <DropField onDrop={setNr}>
                <TextInput
                  id="fc_nr"
                  name="recipientNr"
                  value={nr}
                  onChange={(e) => setNr(e.target.value)}
                />
              </DropField>
            </Field>
            <Field label={s.block} htmlFor="fc_bl">
              <TextInput id="fc_bl" name="recipientBlock" />
            </Field>
            <Field label={s.staircase} htmlFor="fc_sc">
              <TextInput id="fc_sc" name="recipientStaircase" />
            </Field>
            <Field label={s.floor} htmlFor="fc_et">
              <TextInput id="fc_et" name="recipientFloor" />
            </Field>
            <Field label={s.flat} htmlFor="fc_ap">
              <DropField onDrop={setFlat}>
                <TextInput
                  id="fc_ap"
                  name="recipientFlat"
                  value={flat}
                  onChange={(e) => setFlat(e.target.value)}
                />
              </DropField>
            </Field>
            <Field label={s.postCode} htmlFor="fc_zip">
              <DropField onDrop={setZip}>
                <TextInput
                  id="fc_zip"
                  name="recipientZipcode"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </DropField>
            </Field>
          </div>
          <Field label={s.addressNote} htmlFor="fc_extra">
            <TextInput id="fc_extra" name="recipientExtra" />
          </Field>
        </div>

        <div className="mt-3 sm:w-1/2 sm:pr-1.5">
          <Field label={s.payer} htmlFor="fc_payer">
            <AdminSelect
              id="fc_payer"
              name="payer"
              defaultValue="client"
              options={[
                { value: "client", label: s.payerClient },
                { value: "recipient", label: s.payerRecipient },
                { value: "sender", label: s.payerSender },
              ]}
            />
          </Field>
        </div>

        <div className="mt-5 border-t pt-4 text-sm font-medium">{s.summary}</div>

        {/* Ramburs (cash-on-delivery). Amount + payout type show when enabled. */}
        <div className="mt-3 rounded-[var(--radius-md)] border p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.cashOnDelivery}</div>
              <div className="text-xs text-muted-foreground">{s.cashOnDeliveryDesc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cod}
              aria-label={s.cashOnDelivery}
              onClick={() => setCod((v) => !v)}
              className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                cod ? "bg-primary" : "bg-foreground/20"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-all ${
                  cod ? "left-[1.125rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <input type="hidden" name="cod" value={cod ? "1" : ""} />
          {cod && (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label={s.codAmount} htmlFor="fc_cod">
                  <TextInput
                    id="fc_cod"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={codAmount}
                    onChange={(e) => setCodAmount(e.target.value)}
                  />
                </Field>
                <Field label={s.deliveryFee} htmlFor="fc_fee">
                  <TextInput
                    id="fc_fee"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </Field>
                <Field label={s.rambursType} htmlFor="fc_rtype">
                  <AdminSelect
                    id="fc_rtype"
                    name="rambursType"
                    defaultValue="cont"
                    options={[
                      { value: "cont", label: s.rambursCont },
                      { value: "cash", label: s.rambursCash },
                      { value: "instrumente_plata", label: s.rambursInstrument },
                    ]}
                  />
                </Field>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {s.codTotal}: <span className="font-medium text-foreground">{codTotal}</span>
              </div>
            </>
          )}
          <input type="hidden" name="codAmount" value={codAmount} />
          {/* Address-delivery fee added to the ramburs total collected. */}
          <input type="hidden" name="codDeliveryFee" value={deliveryFee} />
        </div>

        <div className="mt-3 sm:w-1/2">
          <Field label={s.insurance} htmlFor="fc_declared">
            <TextInput
              id="fc_declared"
              name="declaredValue"
              type="number"
              min="0"
              inputMode="numeric"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={s.content} htmlFor="fc_content">
            <TextArea id="fc_content" name="content" rows={2} defaultValue={contentDefault} />
          </Field>
          <Field label={s.comments} htmlFor="fc_comments">
            <TextArea id="fc_comments" name="comments" rows={2} />
          </Field>
        </div>

        <div className="mt-3 sm:w-1/3">
          <Field label={s.parcelCount} htmlFor="fc_count">
            <TextInput
              id="fc_count"
              type="number"
              min="1"
              max={totalUnits}
              inputMode="numeric"
              value={String(count)}
              onChange={(e) => changeCount(Number(e.target.value))}
            />
          </Field>
        </div>

        {/* Parcels — weight and dimensions recalculated as the count changes. */}
        <input
          type="hidden"
          name="parcelsJson"
          value={JSON.stringify(
            parcels.map((p) => ({
              weightKg: p.weightKg,
              lengthCm: p.lengthCm,
              widthCm: p.widthCm,
              heightCm: p.heightCm,
            })),
          )}
        />
        <div className="mt-3 flex flex-col gap-3">
          {parcels.map((p, i) => (
            <div key={i} className="rounded-[var(--radius-md)] border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {s.parcel} {i + 1}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.qty} {s.items}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label={s.weightKg} htmlFor={`fc_pw_${i}`}>
                  <TextInput
                    id={`fc_pw_${i}`}
                    type="number"
                    min="0.1"
                    step="0.001"
                    inputMode="decimal"
                    value={String(p.weightKg)}
                    onChange={(e) => setOverride(i, "weightKg", e.target.value)}
                  />
                </Field>
                <Field label={s.lengthCm} htmlFor={`fc_pl_${i}`}>
                  <TextInput
                    id={`fc_pl_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.lengthCm)}
                    onChange={(e) => setOverride(i, "lengthCm", e.target.value)}
                  />
                </Field>
                <Field label={s.widthCm} htmlFor={`fc_pwd_${i}`}>
                  <TextInput
                    id={`fc_pwd_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.widthCm)}
                    onChange={(e) => setOverride(i, "widthCm", e.target.value)}
                  />
                </Field>
                <Field label={s.heightCm} htmlFor={`fc_ph_${i}`}>
                  <TextInput
                    id={`fc_ph_${i}`}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={String(p.heightCm)}
                    onChange={(e) => setOverride(i, "heightCm", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
          <SubmitButton>{s.submit}</SubmitButton>
          <button type="button" onClick={onDone} className={ghostBtn}>
            {s.cancel}
          </button>
          <ActionNotice state={state} />
        </div>
      </AdminForm>
    </div>
  );
}
