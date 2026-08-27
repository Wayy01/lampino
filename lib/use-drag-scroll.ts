"use client";

import { useEffect, useRef } from "react";

/**
 * Click-and-drag horizontal scrolling for an overflowing strip.
 *
 * Touch already scrolls the strip natively, so only mouse/pen pointers are
 * handled. A drag that actually moved swallows the click that follows it —
 * otherwise letting go on top of a button inside the strip would activate it.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let down = false;
    let dragged = false;
    let startX = 0;
    let startLeft = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      down = true;
      dragged = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      // A few pixels of slop, so a slightly shaky click still selects.
      if (!dragged) {
        if (Math.abs(dx) < 4) return;
        dragged = true;
        el.setPointerCapture(e.pointerId);
      }
      el.scrollLeft = startLeft - dx;
    };

    const onPointerUp = (e: PointerEvent) => {
      down = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };

    // Capture phase: the click has to die before it reaches the button under it.
    const onClick = (e: MouseEvent) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClick, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClick, true);
    };
  }, []);

  return ref;
}
