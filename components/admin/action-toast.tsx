"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminT } from "@/lib/admin/i18n-provider";

/**
 * Where failures from actions that aren't attached to a form get reported —
 * the `⋯` row menu and the two-step delete buttons. A form has `ActionNotice`
 * under its submit button; a row action has no such anchor, and the row it
 * belongs to may itself be gone, so the message goes to a fixed panel instead.
 *
 * Errors stay until dismissed: an admin who clicked delete and walked away
 * should still find out it failed.
 */

type Toast = { id: number; message: string; tone: "error" | "success" };

type ToastApi = {
  error: (message: string) => void;
  success: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const SUCCESS_MS = 4000;

export function ActionToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Toast["tone"]) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, tone }]);
      // Success is a confirmation you can miss safely; an error is not.
      if (tone === "success") setTimeout(() => dismiss(id), SUCCESS_MS);
    },
    [dismiss],
  );

  const [api] = useState<ToastApi>(() => ({
    error: (message: string) => push(message, "error"),
    success: (message: string) => push(message, "success"),
  }));

  return (
    <ToastContext value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const t = useAdminT();
  if (typeof document === "undefined" || toasts.length === 0) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm shadow-lg",
            toast.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {toast.tone === "error" && (
            <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
          )}
          <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t.errors.dismiss}
            className="-mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.08]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Report an action failure. Outside a provider this is a no-op rather than a
 * crash — a missing toast host must never take down the page it was meant to
 * report an error on.
 */
export function useActionToast(): ToastApi {
  const ctx = useContext(ToastContext);
  const [fallback] = useState<ToastApi>(() => ({
    error: () => {},
    success: () => {},
  }));
  return ctx ?? fallback;
}
