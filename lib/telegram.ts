// Fire-and-forget Telegram alerts for new orders/rental applications. No-ops
// when TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID aren't set.
import type { Prisma } from "@/lib/generated/prisma";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

type OrderForTelegram = {
  id: number;
  customerName: string;
  customerPhone: string | null;
  totalPrice: Prisma.Decimal | number;
  address?: string | null;
  city?: string | null;
  items: {
    quantity: number;
    priceEach: Prisma.Decimal | number;
    product?: { name_ro: string } | null;
    productVariant?: { name_ro: string } | null;
    rentalPackage?: { title_ro: string } | null;
  }[];
};

type RentalAppForTelegram = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventType: string;
  eventDate: Date;
  eventLocation: string;
  guestCount: number;
  totalPrice: Prisma.Decimal | number;
  rentalPackage: { title_ro: string };
  rentalPackageVariant?: { name_ro: string } | null;
};

function toNum(val: Prisma.Decimal | number): number {
  return typeof val === "number" ? val : Number(val);
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function itemName(item: OrderForTelegram["items"][number]): string {
  if (item.rentalPackage) return item.rentalPackage.title_ro;
  if (item.productVariant) return item.productVariant.name_ro;
  if (item.product) return item.product.name_ro;
  return "Produs necunoscut";
}

async function sendMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHANNEL_ID) return;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[telegram] Failed to send message", res.status, body);
  }
}

export async function sendNewOrderAlert(order: OrderForTelegram): Promise<void> {
  const total = toNum(order.totalPrice);
  const lines: string[] = [];

  lines.push(`<b>Comandă nouă #${order.id}</b>`);
  lines.push(`<b>Client:</b> ${escape(order.customerName)}`);
  if (order.customerPhone) lines.push(`<b>Telefon:</b> ${escape(order.customerPhone)}`);
  if (order.address) {
    const addr = order.city ? `${order.address}, ${order.city}` : order.address;
    lines.push(`<b>Adresa:</b> ${escape(addr)}`);
  }
  lines.push("");
  lines.push("<b>Produse:</b>");
  for (const item of order.items) {
    const price = toNum(item.priceEach);
    lines.push(
      `— ${escape(itemName(item))} x${item.quantity} — ${(price * item.quantity).toFixed(2)} MDL`,
    );
  }
  lines.push("");
  lines.push(`<b>Total: ${total.toFixed(2)} MDL</b>`);

  await sendMessage(lines.join("\n"));
}

export async function sendNewRentalApplicationAlert(app: RentalAppForTelegram): Promise<void> {
  const total = toNum(app.totalPrice);
  const packageName = app.rentalPackageVariant
    ? `${app.rentalPackage.title_ro} — ${app.rentalPackageVariant.name_ro}`
    : app.rentalPackage.title_ro;
  const eventDate = app.eventDate.toLocaleDateString("ro-MD");

  const lines: string[] = [];
  lines.push(`<b>Cerere închiriere #${app.id}</b>`);
  lines.push(`<b>Client:</b> ${escape(app.customerName)}`);
  lines.push(`<b>Telefon:</b> ${escape(app.customerPhone)}`);
  lines.push(`<b>Email:</b> ${escape(app.customerEmail)}`);
  lines.push(`<b>Pachet:</b> ${escape(packageName)}`);
  lines.push(`<b>Eveniment:</b> ${escape(app.eventType)} — ${eventDate}`);
  lines.push(`<b>Locație:</b> ${escape(app.eventLocation)}`);
  lines.push(`<b>Invitați:</b> ${app.guestCount}`);
  lines.push(`<b>Total: ${total.toFixed(2)} MDL</b>`);

  await sendMessage(lines.join("\n"));
}
