import Link from "next/link";
import { Package, Truck, Webhook } from "lucide-react";
import { LigattoMark } from "@/components/admin/ligatto-mark";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/admin/crypto";
import { requireAdmin } from "@/lib/admin/session";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);
  const s = t.settings.shipping;

  const row = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });
  const ligattoAgents = await prisma.ligattoAgent.findMany({ select: { enabled: true } });
  const webhookEndpoints = await prisma.webhookEndpoint.findMany({ select: { enabled: true } });

  const cards = [
    {
      href: "/integrations/nova-post",
      icon: Package,
      title: s.novapost,
      desc: s.novaPostDesc,
      enabled: row?.novapostEnabled ?? false,
      // Decryptability, not mere ciphertext presence: after a key-material
      // rotation the stored key is dead and shipping treats it as absent — the
      // badge must agree, not show a green "configured" over a broken key.
      keySet: Boolean(decryptSecret(row?.novapostApiKey)),
    },
    {
      href: "/integrations/fan-courier",
      icon: Truck,
      title: s.fancourier,
      desc: s.fanCourierDesc,
      enabled: row?.fancourierEnabled ?? false,
      keySet: Boolean(decryptSecret(row?.fancourierApiKey)),
    },
    {
      href: "/integrations/ligatto",
      icon: LigattoMark,
      title: s.ligatto,
      desc: s.ligattoDesc,
      enabled: ligattoAgents.some((a) => a.enabled),
      keySet: ligattoAgents.length > 0,
    },
    {
      href: "/integrations/webhooks",
      icon: Webhook,
      title: s.webhooks,
      desc: s.webhooksDesc,
      enabled: webhookEndpoints.some((e) => e.enabled),
      keySet: webhookEndpoints.length > 0,
    },
  ];

  return (
    <>
      <PageHeader title={t.nav.integrations} />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          const flag = c.enabled ? "active" : "inactive";
          return (
            <Link
              key={c.href}
              href={adminHref(lang, c.href)}
              className="group flex flex-col rounded-[var(--radius-md)] border bg-surface p-5 transition-colors hover:border-foreground/30"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border bg-background">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.desc}</p>
                </div>
                <StatusBadge
                  status={flag}
                  label={statusLabel(t, flag)}
                  className="ml-auto shrink-0"
                />
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs">
                <span className={c.keySet ? "font-medium text-[var(--success,#22C55E)]" : "text-muted-foreground"}>
                  {c.keySet ? s.configured : s.missing}
                </span>
                <span className="font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {s.configure} →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
