"use client";

import { TriangleAlert } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { RejectedLine, SubmitOrderResult } from "@/lib/actions/orders";

/** The failure half of a `submitOrder` result — what the drawers hold onto. */
export type OrderFailure = Extract<SubmitOrderResult, { ok: false }>;

/**
 * Why the order was refused, in the customer's own terms. Replaces the single
 * "something went wrong" line that used to cover a missing phone number, an
 * emptied cart and a dead database alike.
 *
 * `nameOf` resolves a rejected line back to a product name, so "not enough
 * stock" can say *which* item and how many are left.
 */
export function OrderError({
  failure,
  nameOf,
}: {
  failure: OrderFailure;
  nameOf?: (line: RejectedLine) => string | null;
}) {
  const t = useT();
  const message = t.order.errors[failure.error];
  const lines = failure.rejected ?? [];
  const detailed = lines.length > 0 && failure.error === "out_of_stock";

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-red-50 px-3 py-2.5 text-sm text-red-700"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="leading-snug">{message}</p>
        {lines.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-snug">
            {lines.map((line) => (
              <li key={`${line.productId}:${line.variantId ?? ""}`}>
                {nameOf?.(line) ?? `#${line.productId}`}
                {detailed && ` — ${t.order.stockLeft} ${line.available}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
