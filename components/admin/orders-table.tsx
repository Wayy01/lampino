"use client";

import { Inbox } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { statusLabel } from "@/lib/admin/i18n";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export type OrderRow = {
  id: number;
  customerName: string;
  customerEmail: string;
  city: string | null;
  status: string;
  total: number;
  itemCount: number;
  date: string;
};

export function OrdersTable({
  rows,
  footer,
}: {
  rows: OrderRow[];
  footer?: React.ReactNode;
}) {
  const { t, href } = useAdminLang();

  const columns: Column<OrderRow>[] = [
    {
      key: "order",
      header: t.orders.order,
      cell: (o) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{o.customerName}</div>
          <div className="text-xs text-muted-foreground">
            #{o.id} · {o.date}
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: t.orders.email,
      hideOnMobile: true,
      cell: (o) => (
        <span className="text-muted-foreground">{o.customerEmail}</span>
      ),
    },
    {
      key: "city",
      header: t.orders.city,
      hideOnMobile: true,
      cell: (o) => <span className="text-muted-foreground">{o.city ?? "—"}</span>,
    },
    {
      key: "items",
      header: t.orders.items,
      hideOnMobile: true,
      align: "right",
      cell: (o) => (
        <span className="font-mono text-xs text-muted-foreground">
          {o.itemCount}
        </span>
      ),
    },
    {
      key: "status",
      header: t.orders.status,
      cell: (o) => (
        <StatusBadge status={o.status} label={statusLabel(t, o.status)} />
      ),
    },
    {
      key: "total",
      header: t.orders.total,
      align: "right",
      cell: (o) => (
        <span className="whitespace-nowrap font-medium">
          {formatPrice(o.total)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(o) => o.id}
      rowHref={(o) => href(`/orders/${o.id}`)}
      footer={footer}
      empty={
        <EmptyState
          icon={<Inbox className="h-8 w-8" strokeWidth={1.25} />}
          message={t.orders.noMatch}
        />
      }
    />
  );
}
