"use client";

import { ExternalLink, Package, Sparkles } from "lucide-react";
import { productHref, rentalHref } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import type { ProductStat, RentalStat } from "@/lib/admin/analytics";
import { formatDwell } from "@/lib/admin/analytics-format";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";

/** views → intent conversion as a whole-percent string, or "—" without views. */
function conversion(intent: number, views: number): string {
  if (views <= 0) return "—";
  return `${Math.round((intent / views) * 100)}%`;
}

const num = "font-mono text-xs";

function NameCell({
  name,
  href,
  isActive,
  inactiveLabel,
}: {
  name: string;
  href: string;
  isActive: boolean;
  inactiveLabel: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 font-medium">
        <span className="truncate">{name}</span>
        {isActive && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {!isActive && (
        <div className="text-xs text-muted-foreground">{inactiveLabel}</div>
      )}
    </div>
  );
}

export function ProductAnalyticsTable({ rows }: { rows: ProductStat[] }) {
  const { t, lang } = useAdminLang();
  const a = t.analytics;

  const columns: Column<ProductStat>[] = [
    {
      key: "product",
      header: a.colProduct,
      primary: true,
      cell: (p) => (
        <NameCell
          name={pick(lang, p.name_ro, p.name_ru)}
          href={productHref(lang, p.id, pick(lang, p.name_ro, p.name_ru))}
          isActive={p.isActive}
          inactiveLabel={t.statuses.inactive}
        />
      ),
    },
    {
      key: "views",
      header: a.colViews,
      align: "right",
      cell: (p) => <span className={num}>{p.views}</span>,
    },
    {
      key: "time",
      header: a.colTime,
      align: "right",
      hideOnMobile: true,
      cell: (p) => (
        <span className={`${num} text-muted-foreground`}>
          {formatDwell(p.avgDwellMs)}
        </span>
      ),
    },
    {
      key: "cart",
      header: a.colCart,
      align: "right",
      cell: (p) => <span className={num}>{p.addToCart}</span>,
    },
    {
      key: "conv",
      header: a.colConversion,
      align: "right",
      hideOnMobile: true,
      cell: (p) => (
        <span className={`${num} text-muted-foreground`}>
          {conversion(p.addToCart, p.views)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      empty={
        <EmptyState
          icon={<Package className="h-8 w-8" strokeWidth={1.25} />}
          message={a.empty}
        />
      }
    />
  );
}

export function RentalAnalyticsTable({ rows }: { rows: RentalStat[] }) {
  const { t, lang } = useAdminLang();
  const a = t.analytics;

  const columns: Column<RentalStat>[] = [
    {
      key: "package",
      header: a.colPackage,
      primary: true,
      cell: (r) => (
        <NameCell
          name={pick(lang, r.title_ro, r.title_ru)}
          href={rentalHref(lang, r.id, pick(lang, r.title_ro, r.title_ru))}
          isActive={r.isActive}
          inactiveLabel={t.statuses.inactive}
        />
      ),
    },
    {
      key: "views",
      header: a.colViews,
      align: "right",
      cell: (r) => <span className={num}>{r.views}</span>,
    },
    {
      key: "time",
      header: a.colTime,
      align: "right",
      hideOnMobile: true,
      cell: (r) => (
        <span className={`${num} text-muted-foreground`}>
          {formatDwell(r.avgDwellMs)}
        </span>
      ),
    },
    {
      key: "requests",
      header: a.colRequests,
      align: "right",
      cell: (r) => <span className={num}>{r.inquiries}</span>,
    },
    {
      key: "conv",
      header: a.colConversion,
      align: "right",
      hideOnMobile: true,
      cell: (r) => (
        <span className={`${num} text-muted-foreground`}>
          {conversion(r.inquiries, r.views)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      empty={
        <EmptyState
          icon={<Sparkles className="h-8 w-8" strokeWidth={1.25} />}
          message={a.empty}
        />
      }
    />
  );
}
