"use client";

import Image from "next/image";
import { Package, Star } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export type ProductRow = {
  id: number;
  name: string;
  categoryName: string | null;
  price: number;
  reducedPrice: number | null;
  stock: number;
  variantCount: number;
  featured: boolean;
  isActive: boolean;
  imageUrl: string | null;
};

export function ProductsTable({
  rows,
  footer,
}: {
  rows: ProductRow[];
  footer?: React.ReactNode;
}) {
  const { t, href } = useAdminLang();

  const columns: Column<ProductRow>[] = [
    {
      key: "product",
      header: t.products.product,
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
            {p.imageUrl && (
              <Image
                src={p.imageUrl}
                alt=""
                fill
                sizes="40px"
                unoptimized
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="truncate">{p.name}</span>
              {p.featured && (
                <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
              )}
            </div>
            {p.variantCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {p.variantCount} {t.products.variantsCount}
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
      cell: (p) => (
        <span className="text-muted-foreground">{p.categoryName ?? "—"}</span>
      ),
    },
    {
      key: "price",
      header: t.products.price,
      align: "right",
      cell: (p) =>
        p.reducedPrice !== null ? (
          <div className="whitespace-nowrap">
            <span className="font-medium">{formatPrice(p.reducedPrice)}</span>
            <span className="ml-1.5 text-xs text-muted-foreground line-through">
              {formatPrice(p.price)}
            </span>
          </div>
        ) : (
          <span className="whitespace-nowrap font-medium">
            {formatPrice(p.price)}
          </span>
        ),
    },
    {
      key: "stock",
      header: t.products.stock,
      align: "right",
      cell: (p) => (
        <span
          className={
            p.stock === 0
              ? "font-mono text-xs text-red-600"
              : p.stock <= 5
                ? "font-mono text-xs text-amber-600"
                : "font-mono text-xs text-muted-foreground"
          }
        >
          {p.stock}
        </span>
      ),
    },
    {
      key: "status",
      header: t.products.status,
      hideOnMobile: true,
      cell: (p) => (
        <StatusBadge
          status={p.isActive ? "active" : "inactive"}
          label={p.isActive ? t.statuses.active : t.statuses.inactive}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      rowHref={(p) => href(`/products/${p.id}`)}
      footer={footer}
      empty={
        <EmptyState
          icon={<Package className="h-8 w-8" strokeWidth={1.25} />}
          message={t.products.noMatch}
        />
      }
    />
  );
}
