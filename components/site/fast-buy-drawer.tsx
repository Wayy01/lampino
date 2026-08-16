"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/data/products";
import type { ProductVariant } from "@/lib/types";
import { useLang } from "@/lib/i18n/provider";
import { formatPrice, pick } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { submitOrder } from "@/lib/actions/orders";
import { OrderError, type OrderFailure } from "./order-error";
import { useOrderForm, OrderFields } from "./order-fields";

const EASE = [0.22, 1, 0.36, 1] as const;

export function FastBuyDrawer({
  open,
  onOpenChange,
  product,
  variant,
  quantity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
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
  const form = useOrderForm();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<OrderFailure | null>(null);
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
      setFailure(null);
    }
  }

  const total = unitPrice * qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setFailure(null);
    const res = await submitOrder({
      items: [{ productId: product.id, variantId: variant?.id ?? null, quantity: qty }],
      customerName: form.customer,
      customerPhone: form.phone,
      method: form.method,
      region: form.region,
      address: form.method === "delivery" ? form.address : null,
      notes: form.notes || null,
    });
    setPending(false);
    if (res.ok) setSent(true);
    else setFailure(res);
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label={t.cart.remove}
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-7 text-center text-sm font-medium tabular-nums">
                    {qty}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQty((q) => Math.min(stock, q + 1))}
                    disabled={qty >= stock}
                    aria-label={t.cart.add}
                    className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <OrderFields form={form} idPrefix="fb" />

              <div className="mt-1 flex items-baseline justify-between border-t border-border pt-4">
                <span className="label-mono text-muted-foreground">{t.cart.total}</span>
                <span className="font-display text-2xl tracking-tight">
                  {formatPrice(total)}
                </span>
              </div>

              {failure && (
                <OrderError
                  failure={failure}
                  nameOf={() =>
                    variantLabel
                      ? `${pick(lang, product.name_ro, product.name_ru)} · ${variantLabel}`
                      : pick(lang, product.name_ro, product.name_ru)
                  }
                />
              )}

              <Button type="submit" size="lg" className="group w-full" disabled={pending}>
                {pending ? t.fastBuy.sending : t.fastBuy.submit}
                {!pending && (
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                )}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
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
