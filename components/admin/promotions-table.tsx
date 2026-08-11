"use client";

import { BadgePercent, Star } from "lucide-react";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { statusLabel } from "@/lib/admin/i18n";
import type { PromotionState } from "@/lib/admin/promotion-status";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export type PromotionRow = {
  id: number;
  name: string;
  /** Short description snippet; falls back to the date window when absent. */
  description: string | null;
  period: string;
  discountPercent: number;
  productCount: number;
  rentalCount: number;
  featured: boolean;
  state: PromotionState;
};

export function PromotionsTable({
  rows,
  footer,
}: {
  rows: PromotionRow[];
  footer?: React.ReactNode;
}) {
  const { t, href } = useAdminLang();

  const items = (p: PromotionRow) => {
    const parts: string[] = [];
    if (p.productCount > 0) {
      parts.push(`${p.productCount} ${t.promotions.productsCount}`);
    }
    if (p.rentalCount > 0) {
      parts.push(`${p.rentalCount} ${t.promotions.rentalsCount}`);
    }
    return parts.length > 0 ? parts.join(" · ") : t.promotions.noneAssigned;
  };

  const columns: Column<PromotionRow>[] = [
    {
      key: "promotion",
      header: t.promotions.promotion,
      cell: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{p.name}</span>
            {p.featured && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
            )}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {p.description ?? p.period}
          </div>
        </div>
      ),
    },
    {
      key: "period",
      header: t.promotions.period,
      hideOnMobile: true,
      cell: (p) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {p.period}
        </span>
      ),
    },
    {
      key: "discount",
      header: t.promotions.discount,
      align: "right",
      cell: (p) => (
        <span className="whitespace-nowrap font-mono text-xs font-medium">
          {p.discountPercent}%
        </span>
      ),
    },
    {
      key: "items",
      header: t.promotions.items,
      hideOnMobile: true,
      align: "right",
      cell: (p) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {items(p)}
        </span>
      ),
    },
    {
      key: "status",
      header: t.products.status,
      cell: (p) => (
        <StatusBadge status={p.state} label={statusLabel(t, p.state)} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      rowHref={(p) => href(`/promotions/${p.id}`)}
      footer={footer}
      empty={
        <EmptyState
          icon={<BadgePercent className="h-8 w-8" strokeWidth={1.25} />}
          message={t.promotions.noMatch}
        />
      }
    />
  );
}
