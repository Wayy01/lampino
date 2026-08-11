import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { isLocale } from "@/lib/i18n/routing";
import { AdminShell } from "@/components/admin/shell";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const session = await requireAdmin(lang);
  return <AdminShell username={session.username}>{children}</AdminShell>;
}
