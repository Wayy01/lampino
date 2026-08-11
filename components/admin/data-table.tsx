"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Extra classes for both the header and body cell. */
  className?: string;
  /** Hide the column below the md breakpoint — keep 2–3 essentials visible. */
  hideOnMobile?: boolean;
  align?: "left" | "right";
  /**
   * The identity column — the one carrying the row's name. On narrow screens
   * it absorbs the leftover width and truncates, instead of sizing to its
   * text and pushing the rest of the row off-screen. Defaults to the first
   * column; set it explicitly when the first column is a fixed-width control
   * (e.g. the reorder arrows in the categories table).
   */
  primary?: boolean;
};

/**
 * The one table used across the admin. Wrap it in nothing — it brings its own
 * surface. Rows become clickable when `rowHref` is set; clicks on interactive
 * elements inside a row are left alone.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const router = useRouter();

  // A table cell sizes to its content, so a long name would widen the whole
  // row past the viewport. Pinning the identity cell to `w-full max-w-0` lets
  // it take whatever space is left and truncate — only below `sm`, where the
  // space actually runs out; wider screens keep their content-sized columns.
  const primaryIndex = Math.max(
    0,
    columns.findIndex((col) => col.primary),
  );
  const primaryCell = "max-sm:w-full max-sm:max-w-0";

  const handleRowClick = (e: React.MouseEvent, row: T) => {
    if (!rowHref) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button,form,input,select,textarea,label")) return;
    router.push(rowHref(row));
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border bg-surface shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
      {rows.length === 0 ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    className={cn(
                      "label-mono whitespace-nowrap px-4 py-3 text-left font-normal text-muted-foreground first:pl-5 last:pr-5",
                      col.align === "right" && "text-right",
                      col.hideOnMobile && "hidden md:table-cell",
                      i === primaryIndex && primaryCell,
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={(e) => handleRowClick(e, row)}
                  className={cn(
                    "border-b last:border-b-0",
                    rowHref &&
                      "cursor-pointer transition-colors hover:bg-foreground/[0.02]",
                  )}
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3.5 first:pl-5 last:pr-5",
                        col.align === "right" && "text-right",
                        col.hideOnMobile && "hidden md:table-cell",
                        i === primaryIndex && primaryCell,
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="border-t px-5 py-3">{footer}</div>}
    </div>
  );
}
