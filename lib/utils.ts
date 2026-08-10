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
