"use client";

import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { statusLabel } from "@/lib/admin/i18n";
import type { PromotionOption } from "@/lib/admin/promotion-status";

/** `YYYY-MM-DD` → `DD.MM.YYYY`. */
const day = (iso: string) => iso.split("-").reverse().join(".");

/**
 * Checkbox list of every promotion, posted as repeated `promotionIds`. A
 * product can sit in several (one per campaign across the year); on any day
 * the storefront applies the biggest discount among those running.
 */
export function PromotionPicker({
  promotions,
  selected,
}: {
  promotions: PromotionOption[];
  selected: number[];
}) {
  const { t } = useAdminLang();
  if (promotions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.products.noPromotion}</p>;
  }
  return (
    <div>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-[var(--radius-md)] border p-2">
        {promotions.map((p) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] px-1.5 py-1.5 text-sm hover:bg-foreground/[0.03]"
          >
            <input
              type="checkbox"
              name="promotionIds"
              value={p.id}
              defaultChecked={selected.includes(p.id)}
              className="mt-1 accent-[var(--primary)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 tabular-nums text-primary">-{p.discountPercent}%</span>
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {day(p.startDate)} - {day(p.endDate)}
                </span>
                <StatusBadge status={p.state} label={statusLabel(t, p.state)} />
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t.promotions.overlapHint}</p>
    </div>
  );
}
