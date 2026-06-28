"use client";

import { Check } from "lucide-react";
import type { Car } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { useT } from "@/lib/i18n/provider";
import { cn, formatEur } from "@/lib/utils";

export function PartnerPricing({ car }: { car: Car }) {
  const t = useT();
  const pricing = getCarPricing(car);

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
      <div className="label-mono mb-5 text-muted-foreground">
        {t.product.partnersTitle}
      </div>

      <ul className="space-y-2">
        {pricing.partners.map((partner, i) => {
          const best = i === 0 && pricing.isFrom;
          return (
            <li
              key={partner.id}
              className={cn(
                "flex items-center justify-between rounded-[var(--radius-md)] border px-4 py-3.5 transition-colors",
                best
                  ? "border-primary/30 bg-accent"
                  : "border-border bg-background",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium">{partner.name}</span>
                {best && (
                  <span className="label-mono flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                    <Check className="h-3 w-3" />
                    {t.product.bestPrice}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    "font-display text-lg tracking-tight",
                    best && "text-primary",
                  )}
                >
                  {formatEur(partner.pricePerDay)}
                </span>
                <span className="label-mono text-muted-foreground">
                  {t.product.perDay}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        {pricing.isFrom
          ? t.product.partnersMany.replace("{n}", String(pricing.partnerCount))
          : t.product.partnersOne}
      </p>
    </div>
  );
}
