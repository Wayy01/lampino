"use client";

import { useState } from "react";
import { MapPin, Store, Truck } from "lucide-react";
import { useLang } from "@/lib/i18n/provider";
import type { DeliveryRegion } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Input, Textarea, Label } from "@/components/ui/input";

// The customer portion shared by every checkout form (product buy-now, cart
// checkout) so they stay pixel-identical and can't drift.

export type Method = "pickup" | "delivery";

export type OrderForm = {
  customer: string;
  phone: string;
  method: Method;
  region: DeliveryRegion;
  address: string;
  notes: string;
};

export function useOrderForm() {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<Method>("pickup");
  const [region, setRegion] = useState<DeliveryRegion>("chisinau");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const reset = () => {
    setCustomer("");
    setPhone("");
    setMethod("pickup");
    setRegion("chisinau");
    setAddress("");
    setNotes("");
  };
  return {
    values: { customer, phone, method, region, address, notes } as OrderForm,
    customer,
    setCustomer,
    phone,
    setPhone,
    method,
    setMethod,
    region,
    setRegion,
    address,
    setAddress,
    notes,
    setNotes,
    reset,
  };
}

export type OrderFormApi = ReturnType<typeof useOrderForm>;

export function OrderFields({
  form,
  idPrefix,
}: {
  form: OrderFormApi;
  idPrefix: string;
}) {
  const { t } = useLang();
  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-name`}>{t.fastBuy.name}</Label>
        <Input
          id={`${idPrefix}-name`}
          required
          autoComplete="name"
          value={form.customer}
          onChange={(e) => form.setCustomer(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-phone`}>{t.fastBuy.phone}</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          required
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => form.setPhone(e.target.value)}
        />
      </div>

      {/* Delivery method */}
      <div>
        <Label>{t.fastBuy.method}</Label>
        <div className="grid grid-cols-2 gap-2">
          <MethodButton
            active={form.method === "pickup"}
            icon={<Store className="h-4 w-4" />}
            label={t.fastBuy.pickup}
            onClick={() => form.setMethod("pickup")}
          />
          <MethodButton
            active={form.method === "delivery"}
            icon={<Truck className="h-4 w-4" />}
            label={t.fastBuy.delivery}
            onClick={() => form.setMethod("delivery")}
          />
        </div>
      </div>

      {form.method === "delivery" && (
        <>
          <div>
            <Label>{t.cart.delivery}</Label>
            <div className="grid grid-cols-2 gap-2">
              <MethodButton
                active={form.region === "chisinau"}
                icon={<MapPin className="h-4 w-4" />}
                label={t.cart.deliveryChisinau}
                onClick={() => form.setRegion("chisinau")}
              />
              <MethodButton
                active={form.region === "outside"}
                icon={<MapPin className="h-4 w-4" />}
                label={t.cart.deliveryOutside}
                onClick={() => form.setRegion("outside")}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-address`}>{t.fastBuy.address}</Label>
            <Input
              id={`${idPrefix}-address`}
              required
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => form.setAddress(e.target.value)}
            />
          </div>
        </>
      )}

      <div>
        <Label htmlFor={`${idPrefix}-notes`}>{t.fastBuy.notes}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
        />
      </div>
    </>
  );
}

export function MethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border text-sm font-medium transition-colors cursor-pointer",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

