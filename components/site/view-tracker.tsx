"use client";

// Measures how long a visitor actually spends on a product or rental detail
// page and reports it once, when they leave. "Actually spends" means visible
// time: the timer pauses while the tab is hidden, so a backgrounded tab doesn't
// inflate the dwell. The event is sent exactly once — on the first of
// tab-hide, page-unload, or React unmount (client-side navigation away).

import { useEffect } from "react";
import { track, type TrackPayload } from "@/lib/analytics/track";

type Props =
  | { kind: "product"; id: number }
  | { kind: "rental"; id: number };

export function ViewTracker({ kind, id }: Props) {
  // Keyed on `id` (and `kind`): a client-side navigation to a different item
  // re-runs the effect, so the cleanup below reports the page just left before
  // the next page's timer starts.
  useEffect(() => {
    let accumulated = 0; // visible ms banked from earlier foreground spans
    let since = document.visibilityState === "visible" ? Date.now() : null;
    let sent = false;

    const bank = () => {
      if (since !== null) {
        accumulated += Date.now() - since;
        since = null;
      }
    };

    const send = () => {
      if (sent) return;
      sent = true;
      bank();
      const dwellMs = accumulated;
      const payload: TrackPayload =
        kind === "rental"
          ? { type: "rental_view", rentalPackageId: id, dwellMs }
          : { type: "product_view", productId: id, dwellMs };
      track(payload);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // The tab going hidden is the most reliable "leaving" signal on mobile,
        // where `pagehide`/`beforeunload` often don't fire — report here.
        send();
      } else if (since === null && !sent) {
        since = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      send(); // report on unmount / client-side navigation away
    };
  }, [kind, id]);

  return null;
}
