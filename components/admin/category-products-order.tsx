"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { reorderCategoryProducts } from "@/lib/admin/actions/categories";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { useActionToast } from "@/components/admin/action-toast";
import { DataTable, type Column } from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminImage } from "@/components/admin/media";
import {
  DragHandle,
  draggingRow,
  moveItem,
  useReorder,
} from "@/components/admin/reorder";
import { formatPrice } from "@/lib/utils";

export type CategoryProductRow = {
  id: number;
  name_ro: string;
  name_ru: string;
  imageUrl: string | null;
  price: number;
  reducedPrice: number | null;
  isActive: boolean;
};

/**
 * Drag a category's products into the order its storefront page shows by
 * default. Same local-order-then-commit pattern as the categories table.
 */
export function CategoryProductsOrder({
  categoryId,
  rows,
}: {
  categoryId: number;
  rows: CategoryProductRow[];
}) {
  const { t, lang } = useAdminLang();
  const toast = useActionToast();
  const [, startTransition] = useTransition();
  const [idOrder, setIdOrder] = useState<number[] | null>(null);
  const pendingIds = useRef<number[]>([]);

  const order = useMemo(() => {
    if (!idOrder) return rows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const known = new Set(idOrder);
    return [
      ...idOrder.map((id) => byId.get(id)).filter((r): r is CategoryProductRow => r !== undefined),
      ...rows.filter((r) => !known.has(r.id)),
    ];
  }, [rows, idOrder]);

  const reorder = useReorder({
    count: order.length,
    onMove: (from, to) => {
      const ids = moveItem(order.map((p) => p.id), from, to);
      pendingIds.current = ids;
      setIdOrder(ids);
    },
    onCommit: () => {
      const ids = pendingIds.current;
      startTransition(async () => {
        try {
          const result = await reorderCategoryProducts(lang, categoryId, ids);
          if (result.ok) toast.success(t.categories.productOrder.saved);
          else toast.error(result.error);
        } catch {
          toast.error(t.errors.unexpected);
        }
      });
    },
  });

  const columns: Column<CategoryProductRow>[] = [
    {
      key: "order",
      header: <span className="sr-only">{t.categories.order}</span>,
      className: "w-12 pr-0",
      cell: (p) => (
        <DragHandle
          label={t.common.dragToReorder}
          {...reorder.handleProps(order.findIndex((r) => r.id === p.id))}
        />
      ),
    },
    {
      key: "position",
      header: "#",
      className: "w-10 tabular-nums text-muted-foreground",
      cell: (p) => order.findIndex((r) => r.id === p.id) + 1,
    },
    {
      key: "product",
      header: t.products.product,
      primary: true,
      cell: (p) => (
        <Link href={`/admin/${lang}/products/${p.id}`} className="flex items-center gap-3 hover:underline">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
            {p.imageUrl && (
              <AdminImage src={p.imageUrl} alt="" sizes="40px" compact unoptimized className="object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium">{lang === "ru" ? p.name_ru : p.name_ro}</div>
            <div className="truncate text-xs text-muted-foreground">
              {lang === "ru" ? p.name_ro : p.name_ru}
            </div>
          </div>
        </Link>
      ),
    },
    {
      key: "price",
      header: t.products.price,
      hideOnMobile: true,
      cell: (p) => (
        <span className="tabular-nums">{formatPrice(p.reducedPrice ?? p.price)}</span>
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
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {t.categories.productOrder.hint}
      </p>
      <DataTable
        columns={columns}
        rows={order}
        rowKey={(p) => p.id}
        rowProps={(_, i) => reorder.itemProps(i)}
        rowClassName={(_, i) => (reorder.dragIndex === i ? draggingRow : undefined)}
        empty={
          <EmptyState
            icon={<Package className="h-8 w-8" strokeWidth={1.25} />}
            message={t.categories.productOrder.empty}
          />
        }
      />
    </>
  );
}
