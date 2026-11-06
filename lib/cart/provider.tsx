"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Product, ProductVariant } from "@/lib/types";

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

/** Effective unit price for a cart line: the variant overrides the product,
 * and a reduced price (when set) overrides the base price. */
export function unitPrice(item: CartItem): number {
  if (item.variant) return item.variant.reducedPrice ?? item.variant.price;
  return item.product.reducedPrice ?? item.product.price;
}

/** Units the shop can sell for this product/variant pair. */
function stockOf(product: Product, variant: ProductVariant | null): number {
  return variant ? variant.stock : product.stock;
}

/** Clamp a requested quantity to stock. Out-of-stock lines keep their count so
 * checkout can say exactly what ran out instead of the line silently vanishing. */
function capQuantity(quantity: number, stock: number): number {
  const q = Math.max(1, Math.floor(quantity));
  return stock > 0 ? Math.min(q, stock) : q;
}

const isPositiveInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

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
    // localStorage is user-editable and survives deploys: drop anything that
    // isn't a well-formed line instead of rendering "NaN" totals.
    snapshot = Array.isArray(parsed)
      ? parsed
          .filter(
            (entry) =>
              entry &&
              isPositiveInt(entry.id) &&
              (entry.variantId == null || isPositiveInt(entry.variantId)) &&
              typeof entry.quantity === "number" &&
              Number.isFinite(entry.quantity) &&
              entry.quantity >= 1,
          )
          .map((entry) => ({
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

export function CartProvider({
  children,
  products,
}: {
  children: ReactNode;
  products: Product[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const stored = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);

  const items = useMemo<CartItem[]>(() => {
    return stored
      .map((entry) => {
        const product = productById.get(entry.id);
        if (!product) return null;
        let variant: ProductVariant | null = null;
        if (entry.variantId != null) {
          // The chosen size/colour was deleted: drop the line rather than
          // quietly turning it into the base product at a different price.
          variant = product.variants.find((v) => v.id === entry.variantId) ?? null;
          if (!variant) return null;
        } else if (product.hasVariants && product.variants.length > 0) {
          return null;
        }
        const quantity = capQuantity(entry.quantity, stockOf(product, variant));
        return { product, variant, quantity };
      })
      .filter((item): item is CartItem => item !== null);
  }, [stored, productById]);

  const addItem = (product: Product, options?: AddItemOptions) => {
    const variantId = options?.variant?.id ?? null;
    const quantity = options?.quantity ?? 1;
    const stock = stockOf(product, options?.variant ?? null);
    const key = lineKey(product.id, variantId);
    const current = readSnapshot();
    const existing = current.find(
      (entry) => lineKey(entry.id, entry.variantId) === key,
    );
    const next = existing
      ? current.map((entry) =>
          lineKey(entry.id, entry.variantId) === key
            ? { ...entry, quantity: capQuantity(entry.quantity + quantity, stock) }
            : entry,
        )
      : [...current, { id: product.id, variantId, quantity: capQuantity(quantity, stock) }];
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
    const product = productById.get(id);
    const variant =
      product && variantId != null
        ? (product.variants.find((v) => v.id === variantId) ?? null)
        : null;
    const capped = product
      ? capQuantity(quantity, stockOf(product, variant))
      : Math.max(1, Math.floor(quantity));
    writeStored(
      readSnapshot().map((entry) =>
        lineKey(entry.id, entry.variantId) === key
          ? { ...entry, quantity: capped }
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
