// Remembers the catalog's filter query (`category=13&sort=…`) for the tab, so
// "Back to store" on a product page returns to the same filtered view
// instead of an unfiltered /magazin. sessionStorage: per tab, gone on close.
import { useSyncExternalStore } from "react";

const KEY = "lampino-shop-query";

export function rememberShopQuery(query: string): void {
  try {
    sessionStorage.setItem(KEY, query);
  } catch {
    // Storage blocked (private mode etc.) — the link just falls back to /magazin.
  }
}

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

const noop = () => () => {};

/** The last catalog query in this tab; "" on the server and on first visit. */
export function useShopQuery(): string {
  return useSyncExternalStore(noop, read, () => "");
}
