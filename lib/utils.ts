import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pick the value for the active locale from a `_ro` / `_ru` pair. */
export function pick<T>(lang: Locale, ro: T, ru: T): T {
  return lang === "ru" ? ru : ro;
}

export function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits: 0,
  }).format(value)} lei`;
}

/** Largest value a Postgres `integer` (Prisma `Int`) column can hold. */
export const MAX_INT = 2_147_483_647;

/** A positive Int4 id from a URL/query value, or null — so a typo'd or
 * oversized id is a 404, never a database error. */
export function parseId(raw: string | number | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : /^\d{1,10}$/.test(raw ?? "") ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 && n <= MAX_INT ? n : null;
}

/** A 1-based page number from a query value; garbage, fractions and absurd
 * values fall back to something Prisma's `skip` accepts. */
export function parsePage(raw: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1;
}
