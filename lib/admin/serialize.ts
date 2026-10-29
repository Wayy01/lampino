// Decimal → number helpers so admin components only ever see plain JSON.
import type { Prisma } from "@/lib/generated/prisma";
import { SHOP_TIME_ZONE } from "@/lib/promotions";

export function num(value: Prisma.Decimal): number;
export function num(value: Prisma.Decimal | null): number | null;
export function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

const dateLocale = (lang?: string) => (lang === "ru" ? "ru-RU" : "ro-RO");

export function formatDate(date: Date, lang?: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(date: Date, lang?: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
