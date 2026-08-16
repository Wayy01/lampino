"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LoaderCircle, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { useActionToast } from "@/components/admin/action-toast";
import type { ActionResult } from "@/lib/admin/errors";

export type RowAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Admin route to navigate to. */
  href?: string;
  /** Storefront (or any external) URL — opens in a new tab. */
  externalHref?: string;
  /**
   * Server action, run in a transition; the menu closes when it settles.
   * A `{ ok: false }` result is reported as a toast — the row this menu
   * belongs to may be gone by then, so there is nowhere inline to put it.
   */
  run?: () => Promise<ActionResult>;
  /** Requires a second tap/click before running. For destructive actions. */
  confirm?: boolean;
  danger?: boolean;
};

const MENU_WIDTH = 224; // px — matches w-56 on the panel
const ITEM_HEIGHT = 40;
const MARGIN = 8;

/**
 * The `⋯` menu on a table row. One control for both breakpoints: a popover
 * anchored to the button on desktop, a bottom sheet on phones — where a
 * hover-revealed icon strip would be unreachable and a row of tiny icon
 * buttons would not fit next to the row's own content.
 *
 * The panel is portalled to `<body>` because the table scrolls horizontally
 * and clips anything positioned inside a cell.
 */
export function RowActions({
  actions,
  label,
}: {
  actions: RowAction[];
  /** Accessible name, e.g. "Actions — Lampa X". */
  label: string;
}) {
  const t = useAdminT();
  const toast = useActionToast();
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const armTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(armTimer.current), []);

  const close = () => {
    setOpen(false);
    setArmed(null);
    clearTimeout(armTimer.current);
  };

  // Measured when the menu opens rather than in an effect: the trigger is
  // already on screen, so there is nothing to wait for. The popover sits below
  // the button, flipping above it when the viewport bottom is closer than the
  // menu is tall.
  const openMenu = () => {
    const isSheet = window.matchMedia("(max-width: 639px)").matches;
    const rect = triggerRef.current?.getBoundingClientRect();
    setSheet(isSheet);
    if (isSheet || !rect) {
      setCoords(null);
    } else {
      const height = actions.length * ITEM_HEIGHT + MARGIN * 2;
      const below = rect.bottom + 6;
      setCoords({
        top:
          below + height > window.innerHeight - MARGIN
            ? Math.max(MARGIN, rect.top - height - 6)
            : below,
        left: Math.min(
          Math.max(MARGIN, rect.right - MENU_WIDTH),
          window.innerWidth - MENU_WIDTH - MARGIN,
        ),
      });
    }
    setOpen(true);
  };

  // Escape closes; so does scrolling or resizing the page out from under an
  // anchored popover (the sheet is fixed to the bottom, so it can stay).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => {
      if (!sheet) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, sheet]);

  useEffect(() => {
    if (open && sheet) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open, sheet]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, coords]);

  const select = (action: RowAction) => {
    if (action.confirm && armed !== action.key) {
      setArmed(action.key);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(null), 3000);
      return;
    }
    if (action.href) {
      close();
      router.push(action.href);
      return;
    }
    if (action.externalHref) {
      close();
      window.open(action.externalHref, "_blank", "noopener,noreferrer");
      return;
    }
    if (!action.run) return;
    setArmed(null);
    setRunning(action.key);
    const run = action.run;
    startTransition(async () => {
      try {
        const result = await run();
        if (result && !result.ok) toast.error(result.error);
      } catch {
        toast.error(t.errors.unexpected);
      } finally {
        setRunning(null);
        setOpen(false);
      }
    });
  };

  const items = (
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      // A portal's events bubble through the React tree, not the DOM one, so
      // without this a click in the menu reaches the row that rendered it —
      // and rows navigate when clicked.
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-[95] overflow-hidden border border-border bg-surface shadow-xl outline-none",
        sheet
          ? "inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
          : "w-56 rounded-[var(--radius-md)] py-2",
      )}
      style={sheet || !coords ? undefined : { top: coords.top, left: coords.left }}
    >
      {sheet && (
        <div className="label-mono truncate px-4 pb-2 pt-1 text-muted-foreground">
          {label}
        </div>
      )}
      {actions.map((action) => {
        const isArmed = armed === action.key;
        const isRunning = running === action.key;
        return (
          <button
            key={action.key}
            type="button"
            role="menuitem"
            disabled={running !== null}
            onClick={() => select(action)}
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 px-4 text-left text-sm transition-colors disabled:opacity-50",
              sheet ? "h-12" : "h-10",
              isArmed
                ? "bg-red-50 text-red-700"
                : action.danger
                  ? "text-muted-foreground hover:bg-red-50 hover:text-red-700"
                  : "hover:bg-foreground/[0.04]",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {isRunning ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                action.icon
              )}
            </span>
            <span className="truncate">
              {isArmed ? t.common.sure : action.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : openMenu())}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground aria-expanded:bg-foreground/[0.06] aria-expanded:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <>
            <div
              className={cn(
                "fixed inset-0 z-[94]",
                sheet && "bg-foreground/30 backdrop-blur-[2px]",
              )}
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            />
            {items}
          </>,
          document.body,
        )}
    </>
  );
}
