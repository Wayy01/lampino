import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { formatDateTime } from "@/lib/admin/serialize";
import { PageHeader } from "@/components/admin/page-header";
import {
  WebhookEndpoints,
  type WebhookEndpointView,
  type WebhookDeliveryView,
} from "@/components/admin/webhook-endpoints";

export default async function WebhooksIntegrationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const [endpointRows, deliveryRows] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        url: true,
        enabled: true,
        event: true,
        headers: true,
        requiresListenerId: true,
        createdAt: true,
      },
    }),
    prisma.webhookDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        httpStatus: true,
        error: true,
        createdAt: true,
        endpoint: { select: { name: true } },
      },
    }),
  ]);

  const endpoints: WebhookEndpointView[] = endpointRows.map((e) => ({
    id: e.id,
    name: e.name,
    url: e.url,
    enabled: e.enabled,
    event: e.event,
    headers: e.headers ?? "",
    requiresListenerId: e.requiresListenerId,
    created: e.createdAt.toLocaleDateString(lang === "ru" ? "ru-RU" : "ro-MD"),
  }));

  const deliveries: WebhookDeliveryView[] = deliveryRows.map((d) => ({
    id: d.id,
    endpoint: d.endpoint?.name ?? "—",
    event: d.event,
    status: d.status,
    attempts: d.attempts,
    httpStatus: d.httpStatus,
    error: d.error,
    time: formatDateTime(d.createdAt, lang),
  }));

  return (
    <>
      <PageHeader
        title={t.settings.shipping.webhooks}
        backHref={adminHref(lang, "/integrations")}
        backLabel={t.nav.integrations}
      />
      <div className="flex flex-col gap-4">
        <WebhookEndpoints endpoints={endpoints} deliveries={deliveries} />
      </div>
    </>
  );
}
