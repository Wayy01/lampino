"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowLeft, Check, Minus, Plus, Trash2 } from "lucide-react";
import { useCart, unitPrice } from "@/lib/cart/provider";
import { useLang, useT } from "@/lib/i18n/provider";
import { formatPrice, pick } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";

const EASE = [0.22, 1, 0.36, 1] as const;

type View = "cart" | "checkout";

export function CartDrawer() {
  const { lang, t } = useLang();
  const { items, count, subtotal, setQuantity, removeItem, clear, isOpen, closeCart } =
    useCart();
  const [view, setView] = useState<View>("cart");
  const [sent, setSent] = useState(false);

  // Reset internal view whenever the drawer closes.
  useEffect(() => {
    if (!isOpen) {
      const id = setTimeout(() => {
        setView("cart");
        setSent(false);
      }, 300);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const onOpenChange = (next: boolean) => {
    if (!next) closeCart();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    clear();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5 pr-14">
          <SheetTitle>
            {view === "checkout" ? t.order.title : t.cart.title}
          </SheetTitle>
          {count > 0 && !sent && (
            <span className="label-mono text-muted-foreground">
              {count} {count === 1 ? t.cart.itemsOne : t.cart.itemsMany}
            </span>
          )}
        </div>

        {sent ? (
          <SuccessView onClose={closeCart} />
        ) : items.length === 0 ? (
          <EmptyView onClose={closeCart} />
        ) : view === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const variantId = item.variant?.id ?? null;
                  const variantLabel = item.variant
                    ? [
                        pick(lang, item.variant.name_ro, item.variant.name_ru),
                        item.variant.size,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null;
                  return (
                    <li
                      key={`${item.product.id}:${variantId ?? ""}`}
                      className="flex gap-4 py-5"
                    >
                      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
                        <Image
                          src={item.product.images[0].imageUrl}
                          alt={pick(lang, item.product.name_ro, item.product.name_ru)}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-display truncate text-lg tracking-tight">
                              {pick(lang, item.product.name_ro, item.product.name_ru)}
                            </h3>
                            {variantLabel && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {variantLabel}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.product.id, variantId)}
                            aria-label={t.cart.remove}
                            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <Stepper
                            quantity={item.quantity}
                            onDecrease={() =>
                              setQuantity(
                                item.product.id,
                                variantId,
                                item.quantity - 1,
                              )
                            }
                            onIncrease={() =>
                              setQuantity(
                                item.product.id,
                                variantId,
                                item.quantity + 1,
                              )
                            }
                            decreaseLabel={t.cart.remove}
                            increaseLabel={t.cart.add}
                          />
                          <span className="font-display text-lg tracking-tight">
                            {formatPrice(unitPrice(item) * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-border px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="label-mono text-muted-foreground">
                  {t.cart.total}
                </span>
                <span className="font-display text-2xl tracking-tight">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <Button
                size="lg"
                className="group mt-5 w-full"
                onClick={() => setView("checkout")}
              >
                {t.cart.checkout}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </>
        ) : (
          <CheckoutView
            total={subtotal}
            onBack={() => setView("cart")}
            onSubmit={handleSubmit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stepper({
  quantity,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border">
      <button
        onClick={onDecrease}
        aria-label={decreaseLabel}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-6 text-center text-sm font-medium tabular-nums">
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        aria-label={increaseLabel}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CheckoutView({
  total,
  onBack,
  onSubmit,
}: {
  total: number;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="px-6 pt-4">
        <button
          onClick={onBack}
          className="group label-mono inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          {t.cart.backToCart}
        </button>
        <p className="mt-4 text-sm text-muted-foreground">{t.order.subtitle}</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 px-6 py-5">
        <div>
          <Label htmlFor="cart-name">{t.order.name}</Label>
          <Input id="cart-name" required autoComplete="name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <Label htmlFor="cart-email">{t.order.email}</Label>
            <Input id="cart-email" type="email" required autoComplete="email" />
          </div>
          <div className="min-w-0">
            <Label htmlFor="cart-phone">{t.order.phone}</Label>
            <Input id="cart-phone" type="tel" autoComplete="tel" />
          </div>
        </div>
        <div>
          <Label htmlFor="cart-notes">{t.order.notes}</Label>
          <Textarea id="cart-notes" rows={2} />
        </div>

        <div className="mt-1 flex items-baseline justify-between border-t border-border pt-4">
          <span className="label-mono text-muted-foreground">{t.cart.total}</span>
          <span className="font-display text-2xl tracking-tight">
            {formatPrice(total)}
          </span>
        </div>

        <Button type="submit" size="lg" className="group w-full">
          {t.order.submit}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </form>
    </div>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <AnimatePresence>
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
          {t.order.successTitle}
        </h3>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          {t.order.successText}
        </p>
        <Button variant="outline" size="sm" className="mt-7" onClick={onClose}>
          {t.order.close}
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}

function EmptyView({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <h3 className="font-display text-2xl tracking-tight">{t.cart.empty}</h3>
      <p className="mt-3 max-w-xs text-sm text-muted-foreground">
        {t.cart.emptyHint}
      </p>
      <Button variant="outline" size="sm" className="mt-7" onClick={onClose}>
        {t.cart.continueShopping}
      </Button>
    </div>
  );
}
