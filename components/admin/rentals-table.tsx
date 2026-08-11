"use client";

import Image from "next/image";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { rentalHref } from "@/lib/i18n/routing";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import {
  setRentalActive,
  duplicateRental,
  removeRental,
} from "@/lib/admin/actions/rentals";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { RowActions, type RowAction } from "@/components/admin/row-actions";

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
  const { t, lang, href } = useAdminLang();

  const actions = (r: RentalRow): RowAction[] => [
    {
      key: "edit",
      label: t.common.edit,
      icon: <Pencil className="h-4 w-4" />,
      href: href(`/rentals/${r.id}`),
    },
    // The shop serves active packages only, so this link would 404 on a
    // hidden one — offer it only when there is a page to open.
    ...(r.isActive
      ? [
          {
            key: "view",
            label: t.common.viewOnSite,
            icon: <ExternalLink className="h-4 w-4" />,
            externalHref: rentalHref(lang, r.id, r.title),
          },
        ]
      : []),
    {
      key: "active",
      label: r.isActive ? t.common.deactivate : t.common.activate,
      icon: r.isActive ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      ),
      run: () => setRentalActive(r.id, !r.isActive),
    },
    {
      key: "duplicate",
      label: t.common.duplicate,
      icon: <Copy className="h-4 w-4" />,
      run: () => duplicateRental(lang, r.id),
    },
    {
      key: "delete",
      // Applications cascade with the package, so say how many go with it.
      label:
        r.applicationCount > 0
          ? `${t.common.delete} · ${r.applicationCount} ${t.rentals.applicationsCount}`
          : t.common.delete,
      icon: <Trash2 className="h-4 w-4" />,
      run: () => removeRental(r.id),
      confirm: true,
      danger: true,
    },
  ];

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
            <div className="truncate text-xs text-muted-foreground">
              {/* The status column is desktop-only; below md it collapses into
                  this line. The trailing separator goes with it. */}
              {!r.isActive && (
                <span className="md:hidden">
                  {t.statuses.inactive}
                  {r.variantCount > 0 && " · "}
                </span>
              )}
              {r.variantCount > 0 && (
                <span>
                  {r.variantCount} {t.products.variantsCount}
                </span>
              )}
            </div>
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
    {
      key: "actions",
      header: <span className="sr-only">{t.common.actions}</span>,
      align: "right",
      // No left gutter: the button is its own hit target and the name column
      // needs the space more than the divider does.
      className: "w-12 pl-0",
      cell: (r) => (
        <div className="flex justify-end">
          <RowActions
            actions={actions(r)}
            label={`${t.common.actions} — ${r.title}`}
          />
        </div>
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
