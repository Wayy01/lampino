"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check } from "lucide-react";
import type { Car } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useT } from "@/lib/i18n/provider";
import { formatEur } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";

export function OrderDialog({
  car,
  trigger,
}: {
  car: Car;
  trigger: ReactNode;
}) {
  const t = useT();
  const pricing = getCarPricing(car);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setTimeout(() => setSent(false), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center py-6 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-7 w-7" />
            </div>
            <DialogTitle className="mt-6">{t.order.successTitle}</DialogTitle>
            <DialogDescription className="mt-3 max-w-xs">
              {t.order.successText}
            </DialogDescription>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="mt-7">
                {t.order.close}
              </Button>
            </DialogClose>
          </motion.div>
        ) : (
          <>
            <div>
              <div className="label-mono text-primary">{t.order.title}</div>
              <DialogTitle className="mt-2">{car.name}</DialogTitle>
              <DialogDescription className="mt-2">
                {t.order.subtitle}
              </DialogDescription>
              <div className="mt-4 flex items-baseline gap-1.5">
                {pricing.isFrom && (
                  <span className="label-mono text-muted-foreground">
                    {t.product.from}
                  </span>
                )}
                <span className="font-display text-2xl tracking-tight">
                  {formatEur(pricing.fromPrice)}
                </span>
                <span className="label-mono text-muted-foreground">
                  {t.product.perDay}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pickup">{t.order.pickup}</Label>
                  <Input id="pickup" type="date" required />
                </div>
                <div>
                  <Label htmlFor="dropoff">{t.order.dropoff}</Label>
                  <Input id="dropoff" type="date" required />
                </div>
              </div>
              <div>
                <Label htmlFor="name">{t.order.name}</Label>
                <Input id="name" required autoComplete="name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">{t.order.email}</Label>
                  <Input id="email" type="email" required autoComplete="email" />
                </div>
                <div>
                  <Label htmlFor="phone">{t.order.phone}</Label>
                  <Input id="phone" type="tel" autoComplete="tel" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">{t.order.notes}</Label>
                <Textarea id="notes" rows={2} />
              </div>
              <Button type="submit" size="lg" className="group mt-1 w-full">
                {t.order.submit}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
