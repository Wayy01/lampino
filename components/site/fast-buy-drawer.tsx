"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Minus, Plus, Store, Truck } from "lucide-react";
import type { Product } from "@/lib/data/products";
import type { ProductVariant } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { formatPrice, pick, cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";

const EASE = [0.22, 1, 0.36, 1] as const;

type Method = "pickup" | "delivery";

export function FastBuyDrawer({
  open,
  onOpenChange,
  product,
  variant,
  quantity,
  whatsapp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  whatsapp: string;
}) {
  const { lang, t } = useLang();

  const unitPrice = variant?.price ?? product.price;
  const stock = variant?.stock ?? product.stock;

  const name = pick(lang, product.name_ro, product.name_ru);
  const variantLabel = variant
    ? [pick(lang, variant.name_ro, variant.name_ru), variant.size]
        .filter(Boolean)
        .join(" · ")
    : null;

  const [qty, setQty] = useState(quantity);
  const [method, setMethod] = useState<Method>("pickup");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  // Sync with the current selection whenever the drawer transitions to open —
  // adjusting state during render (React's recommended alternative to an
  // effect) so the quantity/success state reset the moment it reopens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQty(Math.min(Math.max(1, quantity), Math.max(1, stock)));
      setSent(false);
    }
  }

  const total = unitPrice * qty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = [
      `${t.fastBuy.title}: ${name}${variantLabel ? ` (${variantLabel})` : ""}`,
      `${t.product.quantity}: ${qty}`,
      `${t.cart.total}: ${formatPrice(total)}`,
      `${t.fastBuy.name}: ${customer}`,
      `${t.fastBuy.phone}: ${phone}`,
      `${t.fastBuy.method}: ${method === "pickup" ? t.fastBuy.pickup : t.fastBuy.delivery}`,
      ...(method === "delivery" ? [`${t.fastBuy.address}: ${address}`] : []),
      ...(notes ? [`${t.fastBuy.notes}: ${notes}`] : []),
    ];
    const digits = whatsapp.replace(/[^\d]/g, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setSent(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5 pr-14">
          <SheetTitle>{t.fastBuy.title}</SheetTitle>
        </div>

        {sent ? (
          <SuccessView onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
            <div className="px-6 pt-4">
              <p className="text-sm text-muted-foreground">{t.fastBuy.subtitle}</p>

              {/* Product summary */}
              <div className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-background px-4 py-3">
                <div className="min-w-0">
                  <p className="font-display truncate text-lg tracking-tight">{name}</p>
                  {variantLabel && (
                    <p className="truncate text-xs text-muted-foreground">{variantLabel}</p>
                  )}
                </div>
                <span className="font-display shrink-0 text-lg tracking-tight">
                  {formatPrice(unitPrice)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-5">
              {/* Quantity */}
              <div className="flex items-center justify-between">
                <span className="label-mono text-muted-foreground">{t.product.quantity}</span>
                <div className="flex items-center gap-1 rounded-full border border-border">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label={t.cart.remove}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-medium tabular-nums">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                    disabled={qty >= stock}
                    aria-label={t.cart.add}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="fb-name">{t.fastBuy.name}</Label>
                <Input
                  id="fb-name"
                  required
                  autoComplete="name"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="fb-phone">{t.fastBuy.phone}</Label>
                <Input
                  id="fb-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Delivery method */}
              <div>
                <Label>{t.fastBuy.method}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <MethodButton
                    active={method === "pickup"}
                    icon={<Store className="h-4 w-4" />}
                    label={t.fastBuy.pickup}
                    onClick={() => setMethod("pickup")}
                  />
                  <MethodButton
                    active={method === "delivery"}
                    icon={<Truck className="h-4 w-4" />}
                    label={t.fastBuy.delivery}
                    onClick={() => setMethod("delivery")}
                  />
                </div>
              </div>

              {method === "delivery" && (
                <div>
                  <Label htmlFor="fb-address">{t.fastBuy.address}</Label>
                  <Input
                    id="fb-address"
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="fb-notes">{t.fastBuy.notes}</Label>
                <Textarea
                  id="fb-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="mt-1 flex items-baseline justify-between border-t border-border pt-4">
                <span className="label-mono text-muted-foreground">{t.cart.total}</span>
                <span className="font-display text-2xl tracking-tight">
                  {formatPrice(total)}
                </span>
              </div>

              <Button type="submit" size="lg" className="group w-full">
                {t.fastBuy.submit}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MethodButton({
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

function SuccessView({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-7 w-7" />
      </div>
      <h3 className="font-display mt-6 text-2xl tracking-tight">
        {t.fastBuy.successTitle}
      </h3>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        {t.fastBuy.successText}
      </p>
      <Button variant="outline" size="sm" className="mt-7" onClick={onClose}>
        {t.fastBuy.close}
      </Button>
    </motion.div>
  );
}
