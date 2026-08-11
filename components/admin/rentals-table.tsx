"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export type RentalRow = {
  id: number;
  title: string;
  categoryName: string | null;
  price: number;
  reducedPrice: number | null;
  variantCount: number;
  applicationCount: number;
  isActive: boolean;
  imageUrl: string | null;
};

export function RentalsTable({
  rows,
  footer,
}: {
  rows: RentalRow[];
  footer?: React.ReactNode;
}) {
  const { t, href } = useAdminLang();

  const columns: Column<RentalRow>[] = [
    {
      key: "package",
      header: t.rentals.package,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
            {r.imageUrl && (
              <Image
                src={r.imageUrl}
                alt=""
                fill
                sizes="40px"
                unoptimized
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{r.title}</div>
            {r.variantCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {r.variantCount} {t.products.variantsCount}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t.products.category,
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.categoryName ?? "—"}</span>
      ),
    },
    {
      key: "price",
      header: t.products.price,
      align: "right",
      cell: (r) =>
        r.reducedPrice !== null ? (
          <div className="whitespace-nowrap">
            <span className="font-medium">{formatPrice(r.reducedPrice)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground line-through">
              {formatPrice(r.price)}
            </span>
          </div>
        ) : (
          <span className="whitespace-nowrap font-medium">
            {formatPrice(r.price)}
          </span>
        ),
    },
    {
      key: "applications",
      header: t.rentals.applicationsCount,
      align: "right",
      hideOnMobile: true,
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.applicationCount}
        </span>
      ),
    },
    {
      key: "status",
      header: t.products.status,
      hideOnMobile: true,
      cell: (r) => (
        <StatusBadge
          status={r.isActive ? "active" : "inactive"}
          label={r.isActive ? t.statuses.active : t.statuses.inactive}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      rowHref={(r) => href(`/rentals/${r.id}`)}
      footer={footer}
      empty={
        <EmptyState
          icon={<Sparkles className="h-8 w-8" strokeWidth={1.25} />}
          message={t.rentals.noMatch}
        />
      }
    />
  );
}
