import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  CalendarClock,
  Mail,
  Phone,
  Sparkles,
  User,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { formatPrice, pick } from "@/lib/utils";
import { num, formatDate, formatDateTime } from "@/lib/admin/serialize";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  eventLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { ApplicationStatusForm } from "@/components/admin/application-status-form";

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const applicationId = Number(id);
  if (!Number.isInteger(applicationId)) notFound();

  const application = await prisma.rentalApplication.findUnique({
    where: { id: applicationId },
    include: {
      rentalPackage: {
        include: { images: { where: { isMain: true }, take: 1 } },
      },
      rentalPackageVariant: true,
    },
  });
  if (!application) notFound();

  const pkg = application.rentalPackage;
  const packageTitle = pkg
    ? pick(lang, pkg.title_ro, pkg.title_ru)
    : t.applications.deletedRental;
  const packageImage = pkg?.images[0]?.imageUrl ?? null;
  const variant = application.rentalPackageVariant;
  const variantName = variant && pick(lang, variant.name_ro, variant.name_ru);

  return (
    <>
      <PageHeader
        title={`${t.applications.applicationTitle} #${application.id}`}
        backHref={adminHref(lang, "/applications")}
        backLabel={t.applications.title}
        actions={
          <StatusBadge
            status={application.status}
            label={statusLabel(t, application.status)}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.applications.eventDetails}
            icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="label-mono text-muted-foreground">
                  {t.applications.eventType}
                </div>
                <div className="mt-1 text-sm">
                  {eventLabel(t, application.eventType)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="label-mono text-muted-foreground">
                  {t.applications.eventDate}
                </div>
                <div className="mt-1 text-sm">
                  {formatDate(application.eventDate, lang)}
                  {application.eventEndDate && (
                    <span>
                      {" "}
                      → {formatDate(application.eventEndDate, lang)}
                    </span>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <div className="label-mono text-muted-foreground">
                  {t.applications.eventLocation}
                </div>
                <div className="mt-1 break-words text-sm">
                  {application.eventLocation}
                </div>
              </div>
              <div className="min-w-0">
                <div className="label-mono text-muted-foreground">
                  {t.applications.guestCount}
                </div>
                <div className="mt-1 font-mono text-sm">
                  {application.guestCount}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={t.applications.package}
            icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
                {packageImage && (
                  <Image
                    src={packageImage}
                    alt=""
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {pkg ? (
                  <Link
                    href={adminHref(lang, `/rentals/${pkg.id}`)}
                    className="block truncate text-sm font-medium hover:text-primary"
                  >
                    {packageTitle}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-muted-foreground">
                    {packageTitle}
                  </span>
                )}
                {variantName && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {variantName}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <span className="label-mono text-muted-foreground">
                {t.applications.estimatedTotal}
              </span>
              <div className="font-display text-2xl tracking-tight">
                {formatPrice(num(application.totalPrice))}
              </div>
            </div>
          </SectionCard>

          {application.additionalInfo && (
            <SectionCard title={t.applications.additionalInfo}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {application.additionalInfo}
              </p>
            </SectionCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title={t.orders.statusTitle}>
            <ApplicationStatusForm
              applicationId={application.id}
              status={application.status}
            />
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
              {t.applications.submitted}{" "}
              {formatDateTime(application.createdAt, lang)}
            </p>
          </SectionCard>

          <SectionCard
            title={t.orders.customer}
            icon={<User className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="font-medium">{application.customerName}</div>
              <a
                href={`mailto:${application.customerEmail}`}
                className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{application.customerEmail}</span>
              </a>
              {application.customerPhone && (
                <a
                  href={`tel:${application.customerPhone}`}
                  className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{application.customerPhone}</span>
                </a>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
