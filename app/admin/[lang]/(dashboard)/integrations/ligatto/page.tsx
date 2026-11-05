import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import {
  LigattoAgents,
  type LigattoAgentView,
} from "@/components/admin/ligatto-agents";

export default async function LigattoIntegrationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const rows = await prisma.ligattoAgent.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, enabled: true, createdAt: true },
  });
  const agents: LigattoAgentView[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    enabled: a.enabled,
    created: a.createdAt.toLocaleDateString(lang === "ru" ? "ru-RU" : "ro-MD"),
  }));

  return (
    <>
      <PageHeader
        title={t.settings.shipping.ligatto}
        backHref={adminHref(lang, "/integrations")}
        backLabel={t.nav.integrations}
      />
      <div className="flex flex-col gap-4">
        <LigattoAgents agents={agents} />
      </div>
    </>
  );
}
