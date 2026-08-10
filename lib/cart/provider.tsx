"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { products, type Product } from "@/lib/data/products";
import type { ProductVariant } from "@/lib/types";

export type CartItem = {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
};

export type AddItemOptions = {
  variant?: ProductVariant | null;
  quantity?: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, options?: AddItemOptions) => void;
  setQuantity: (id: number, variantId: number | null, quantity: number) => void;
  removeItem: (id: number, variantId: number | null) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "lampino-cart";

type StoredItem = { id: number; variantId: number | null; quantity: number };

/** Stable identity for a cart line — product plus the chosen variant (if any). */
function lineKey(id: number, variantId: number | null): string {
  return `${id}:${variantId ?? ""}`;
}

/** Effective unit price for a cart line: the variant overrides the product. */
export function unitPrice(item: CartItem): number {
  return item.variant?.price ?? item.product.price;
}

// localStorage is the source of truth for the cart. It's read via
// useSyncExternalStore (SSR-safe, no setState-in-effect). getSnapshot must
// return a stable reference while unchanged, so the parsed array is cached
// and only recomputed when the raw stored string actually changes.
const EMPTY: StoredItem[] = [];
const listeners = new Set<() => void>();
let snapshot: StoredItem[] = EMPTY;
let snapshotRaw: string | null = null;

function readSnapshot(): StoredItem[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === snapshotRaw) return snapshot;
  snapshotRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as StoredItem[]) : [];
    snapshot = Array.isArray(parsed)
      ? parsed.map((entry) => ({
          id: entry.id,
          variantId: entry.variantId ?? null,
          quantity: entry.quantity,
        }))
      : [];
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeStored(next: StoredItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const stored = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);

  const items = useMemo<CartItem[]>(() => {
    return stored
      .map((entry) => {
        const product = products.find((p) => p.id === entry.id);
        if (!product) return null;
        const variant =
          entry.variantId != null
            ? (product.variants.find((v) => v.id === entry.variantId) ?? null)
            : null;
        const quantity = Math.max(1, Math.floor(entry.quantity));
        return { product, variant, quantity };
      })
      .filter((item): item is CartItem => item !== null);
  }, [stored]);

  const addItem = (product: Product, options?: AddItemOptions) => {
    const variantId = options?.variant?.id ?? null;
    const quantity = options?.quantity ?? 1;
    const key = lineKey(product.id, variantId);
    const current = readSnapshot();
    const existing = current.find(
      (entry) => lineKey(entry.id, entry.variantId) === key,
    );
    const next = existing
      ? current.map((entry) =>
          lineKey(entry.id, entry.variantId) === key
            ? { ...entry, quantity: entry.quantity + quantity }
            : entry,
        )
      : [...current, { id: product.id, variantId, quantity }];
    writeStored(next);
  };

  const setQuantity = (
    id: number,
    variantId: number | null,
    quantity: number,
  ) => {
    if (quantity < 1) {
      removeItem(id, variantId);
      return;
    }
    const key = lineKey(id, variantId);
    writeStored(
      readSnapshot().map((entry) =>
        lineKey(entry.id, entry.variantId) === key
          ? { ...entry, quantity }
          : entry,
      ),
    );
  };

  const removeItem = (id: number, variantId: number | null) => {
    const key = lineKey(id, variantId);
    writeStored(
      readSnapshot().filter(
        (entry) => lineKey(entry.id, entry.variantId) !== key,
      ),
    );
  };

  const clear = () => writeStored([]);

  const { count, subtotal } = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.count += item.quantity;
        acc.subtotal += unitPrice(item) * item.quantity;
        return acc;
      },
      { count: 0, subtotal: 0 },
    );
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotal,
        addItem,
        setQuantity,
        removeItem,
        clear,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
