import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { toShippingData } from "@/lib/admin/shipping";
import { PageHeader } from "@/components/admin/page-header";
import { NovaPostForm } from "@/components/admin/integration-forms";

export default async function NovaPostIntegrationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const shipping = await prisma.shippingSettings.findFirst({ orderBy: { id: "asc" } });

  return (
    <>
      <PageHeader
        title={t.nav.novaPost}
        backHref={adminHref(lang, "/integrations")}
        backLabel={t.nav.integrations}
      />
      <div className="flex flex-col gap-4">
        <NovaPostForm
          shipping={toShippingData(shipping)}
          keySet={Boolean(shipping?.novapostApiKey)}
        />
      </div>
    </>
  );
}
