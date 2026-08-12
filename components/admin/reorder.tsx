"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Drag-to-reorder for every ordered list in the admin — form sub-collections
 * (images, videos, variants, specs) and the categories table alike.
 *
 * Built on pointer events rather than HTML5 drag-and-drop, which does not fire
 * on touch screens at all. The item under the pointer is found with
 * `elementFromPoint` and the list is reordered live as you drag — so there is
 * no drag preview to keep in sync. `touch-action: none` on the handle stops the
 * page scrolling out from under a touch drag.
 *
 * The move/up listeners live on the window rather than on the handle. Lists
 * whose rows are keyed by position remount every handle on each reorder, which
 * drops pointer capture mid-drag; the release would then miss the handle and
 * strand the drag in a started state, leaving a later hover to move rows with
 * no button held.
 *
 * The same handle is a keyboard control: focus it and press ArrowUp/ArrowDown.
 */

/** Immutable array move. Out-of-range targets return the list untouched. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Attributes marking an element as a reorder target. Spread onto each row. */
export type ReorderItemProps = {
  "data-reorder-list": string;
  "data-reorder-index": number;
};

export type ReorderHandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  "data-reorder-handle": string;
};

export function useReorder({
  count,
  onMove,
  onCommit,
}: {
  count: number;
  /** Apply the move to your list. Called repeatedly while dragging. */
  onMove: (from: number, to: number) => void;
  /** Fired once the drag settles (or after a keyboard move) — persist here. */
  onCommit?: () => void;
}) {
  const listId = useId();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Live drag position; refs because pointer handlers must not close over
  // state that a re-render has already replaced.
  const active = useRef<number | null>(null);
  const moved = useRef(false);
  const focusIndex = useRef<number | null>(null);
  // Pointer handlers read these through a ref so a drag in progress always
  // sees the current list length and callbacks, never a captured render's.
  const latest = useRef({ count, onMove, onCommit });
  useEffect(() => {
    latest.current = { count, onMove, onCommit };
  });

  // A keyboard move re-renders the list before the browser can keep focus on
  // the handle that moved, so put it back by position after every move.
  useEffect(() => {
    const index = focusIndex.current;
    if (index === null) return;
    focusIndex.current = null;
    document
      .querySelector<HTMLElement>(
        `[data-reorder-list="${CSS.escape(listId)}"][data-reorder-index="${index}"] [data-reorder-handle]`,
      )
      ?.focus();
  });

  // Detaches the in-flight drag's window listeners; null when nothing is being
  // dragged. Also runs on unmount so a drag can never outlive the list.
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);

  const start = (index: number, pointerId: number) => {
    detach.current?.();
    active.current = index;
    moved.current = false;
    setDragIndex(index);

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const from = active.current;
      if (from === null) return;
      const row = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-reorder-list][data-reorder-index]");
      if (!row || row.dataset.reorderList !== listId) return;
      const to = Number(row.dataset.reorderIndex);
      if (!Number.isInteger(to) || to === from) return;
      if (to < 0 || to >= latest.current.count) return;
      latest.current.onMove(from, to);
      active.current = to;
      moved.current = true;
      setDragIndex(to);
    };

    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      detach.current?.();
      active.current = null;
      setDragIndex(null);
      if (moved.current) latest.current.onCommit?.();
      moved.current = false;
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    detach.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      detach.current = null;
    };
  };

  const handleProps = (index: number): ReorderHandleProps => ({
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      start(index, e.pointerId);
    },
    onKeyDown: (e) => {
      const delta = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
      if (delta === 0) return;
      const to = index + delta;
      if (to < 0 || to >= latest.current.count) return;
      e.preventDefault();
      latest.current.onMove(index, to);
      focusIndex.current = to;
      latest.current.onCommit?.();
    },
    "data-reorder-handle": "",
  });

  return {
    /** Index currently being dragged, for the lifted-row styling. */
    dragIndex,
    itemProps: (index: number): ReorderItemProps => ({
      "data-reorder-list": listId,
      "data-reorder-index": index,
    }),
    handleProps,
  };
}

/** Grip button that starts a drag. Pair with `useReorder().handleProps(i)`. */
export function DragHandle({
  label,
  className,
  ...props
}: ReorderHandleProps & { label: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:bg-foreground/[0.05] focus-visible:text-foreground active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

/** Styling for the row being dragged — same treatment everywhere. */
export const draggingRow = "relative z-10 bg-muted/60 opacity-80";
