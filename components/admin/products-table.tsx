"use client";

import Image from "next/image";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Package,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { productHref } from "@/lib/i18n/routing";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import {
  setProductActive,
  setProductFeatured,
  duplicateProduct,
  removeProduct,
} from "@/lib/admin/actions/products";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { RowActions, type RowAction } from "@/components/admin/row-actions";

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
  const { t, lang, href } = useAdminLang();

  // What the hidden columns contribute to the sub-line on narrow screens. The
  // trailing separator lives in here so it disappears along with the text.
  const mobileMeta = (p: ProductRow) => {
    const parts: string[] = [];
    if (!p.isActive) parts.push(t.statuses.inactive);
    if (p.stock <= 5) parts.push(`${t.products.stock} ${p.stock}`);
    if (parts.length === 0) return null;
    return parts.join(" · ") + (p.variantCount > 0 ? " · " : "");
  };

  const actions = (p: ProductRow): RowAction[] => [
    {
      key: "edit",
      label: t.common.edit,
      icon: <Pencil className="h-4 w-4" />,
      href: href(`/products/${p.id}`),
    },
    // The shop serves active products only, so this link would 404 on a
    // hidden one — offer it only when there is a page to open.
    ...(p.isActive
      ? [
          {
            key: "view",
            label: t.common.viewOnSite,
            icon: <ExternalLink className="h-4 w-4" />,
            externalHref: productHref(lang, p.id, p.name),
          },
        ]
      : []),
    {
      key: "active",
      label: p.isActive ? t.common.deactivate : t.common.activate,
      icon: p.isActive ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      ),
      run: () => setProductActive(p.id, !p.isActive),
    },
    {
      key: "featured",
      label: p.featured ? t.products.unfeature : t.products.feature,
      icon: p.featured ? (
        <StarOff className="h-4 w-4" />
      ) : (
        <Star className="h-4 w-4" />
      ),
      run: () => setProductFeatured(p.id, !p.featured),
    },
    {
      key: "duplicate",
      label: t.common.duplicate,
      icon: <Copy className="h-4 w-4" />,
      run: () => duplicateProduct(lang, p.id),
    },
    {
      key: "delete",
      label: t.common.delete,
      icon: <Trash2 className="h-4 w-4" />,
      run: () => removeProduct(p.id),
      confirm: true,
      danger: true,
    },
  ];

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
            <div className="truncate text-xs text-muted-foreground">
              {/* Status and stock are desktop-only columns; below md they
                  collapse into this line, stock only when it needs watching. */}
              <span className="md:hidden">{mobileMeta(p)}</span>
              {p.variantCount > 0 && (
                <span>
                  {p.variantCount} {t.products.variantsCount}
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
      hideOnMobile: true,
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
    {
      key: "actions",
      header: <span className="sr-only">{t.common.actions}</span>,
      align: "right",
      // No left gutter: the button is its own hit target and the name column
      // needs the space more than the divider does.
      className: "w-12 pl-0",
      cell: (p) => (
        <div className="flex justify-end">
          <RowActions
            actions={actions(p)}
            label={`${t.common.actions} — ${p.name}`}
          />
        </div>
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
