"use client";

import { Check, ExternalLink, MessageSquareText, Trash2, X } from "lucide-react";
import { useAdminLang } from "@/lib/admin/i18n-provider";
import { deleteReview, setReviewStatus } from "@/lib/admin/actions/reviews";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { RowActions, type RowAction } from "@/components/admin/row-actions";

export type ReviewRow = {
  id: number;
  productName: string;
  /** Storefront URL of the product, or null when it's no longer live. */
  productHref: string | null;
  authorName: string;
  rating: number;
  body: string;
  status: string;
  date: string;
};

export function ReviewsTable({ rows, footer }: { rows: ReviewRow[]; footer?: React.ReactNode }) {
  const { t, lang } = useAdminLang();
  const r = t.reviews;

  const columns: Column<ReviewRow>[] = [
    {
      key: "review",
      header: r.text,
      cell: (row) => (
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-primary" aria-label={`${row.rating}/5`}>
              {"★".repeat(row.rating)}
              <span className="text-foreground/20">{"★".repeat(5 - row.rating)}</span>
            </span>
            <span className="truncate font-medium">{row.authorName}</span>
          </div>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{row.body}</p>
        </div>
      ),
    },
    {
      key: "product",
      header: r.product,
      hideOnMobile: true,
      cell: (row) => <span className="line-clamp-2 text-sm">{row.productName}</span>,
    },
    {
      key: "status",
      header: r.status,
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge
            status={row.status}
            label={(r.statuses as Record<string, string>)[row.status] ?? row.status}
          />
          <span className="text-xs text-muted-foreground">{row.date}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => {
        const actions: RowAction[] = [
          ...(row.status !== "approved"
            ? [{ key: "approve", label: r.approve, icon: <Check className="h-4 w-4" />, run: () => setReviewStatus(lang, row.id, "approved") }]
            : []),
          ...(row.status !== "rejected"
            ? [{ key: "reject", label: r.reject, icon: <X className="h-4 w-4" />, run: () => setReviewStatus(lang, row.id, "rejected") }]
            : []),
          ...(row.productHref
            ? [{ key: "view", label: r.viewProduct, icon: <ExternalLink className="h-4 w-4" />, externalHref: `${row.productHref}#reviews` }]
            : []),
          { key: "delete", label: r.remove, icon: <Trash2 className="h-4 w-4" />, run: () => deleteReview(lang, row.id), confirm: true, danger: true },
        ];
        return <RowActions actions={actions} label={`${t.common.actions}: ${row.authorName}`} />;
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      footer={footer}
      empty={<EmptyState icon={<MessageSquareText className="h-8 w-8" strokeWidth={1.25} />} message={r.empty} />}
    />
  );
}
