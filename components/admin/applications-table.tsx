"use client";

import { CalendarClock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { statusLabel, eventLabel } from "@/lib/admin/i18n";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";

export type ApplicationRow = {
  id: number;
  customerName: string;
  eventType: string;
  eventLocation: string;
  eventDate: string;
  guestCount: number;
  status: string;
  total: number;
  /** Submission date, shown next to the id. */
  date: string;
};

export function ApplicationsTable({
  rows,
  footer,
}: {
  rows: ApplicationRow[];
  footer?: React.ReactNode;
}) {
  const { t, href } = useAdminLang();

  const columns: Column<ApplicationRow>[] = [
    {
      key: "application",
      header: t.applications.application,
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{a.customerName}</div>
          <div className="text-xs text-muted-foreground">
            #{a.id} · {a.date}
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: t.applications.event,
      hideOnMobile: true,
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate">{eventLabel(t, a.eventType)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {a.eventLocation}
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: t.applications.date,
      hideOnMobile: true,
      cell: (a) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {a.eventDate}
        </span>
      ),
    },
    {
      key: "guests",
      header: t.applications.guests,
      hideOnMobile: true,
      align: "right",
      cell: (a) => (
        <span className="font-mono text-xs text-muted-foreground">
          {a.guestCount}
        </span>
      ),
    },
    {
      key: "status",
      header: t.orders.status,
      cell: (a) => (
        <StatusBadge status={a.status} label={statusLabel(t, a.status)} />
      ),
    },
    {
      key: "total",
      header: t.orders.total,
      align: "right",
      cell: (a) => (
        <span className="whitespace-nowrap font-medium">
          {formatPrice(a.total)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(a) => a.id}
      rowHref={(a) => href(`/applications/${a.id}`)}
      footer={footer}
      empty={
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" strokeWidth={1.25} />}
          message={t.applications.noMatch}
        />
      }
    />
  );
}
