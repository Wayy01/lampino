import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { Prisma } from "@/lib/generated/prisma";
import { num, formatDate } from "@/lib/admin/serialize";
import {
  getAdminDict,
  statusLabel,
  eventLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput, FilterSelect, Pagination } from "@/components/admin/toolbar";
import {
  ApplicationsTable,
  type ApplicationRow,
} from "@/components/admin/applications-table";
import {
  APPLICATION_STATUSES,
  EVENT_TYPES,
} from "@/lib/admin/application-status";

const PER_PAGE = 12;

export default async function AdminApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const event = typeof sp.event === "string" ? sp.event : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const idQuery = /^#?\d+$/.test(q.trim())
    ? Number(q.trim().replace("#", ""))
    : null;
  const where: Prisma.RentalApplicationWhereInput = {
    ...(q && {
      OR: [
        { customerName: { contains: q, mode: "insensitive" as const } },
        { customerEmail: { contains: q, mode: "insensitive" as const } },
        { customerPhone: { contains: q, mode: "insensitive" as const } },
        ...(idQuery !== null ? [{ id: idQuery }] : []),
      ],
    }),
    ...(status && { status }),
    ...(event && { eventType: event }),
  };

  const [total, applications] = await Promise.all([
    prisma.rentalApplication.count({ where }),
    prisma.rentalApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const rows: ApplicationRow[] = applications.map((a) => ({
    id: a.id,
    customerName: a.customerName,
    eventType: a.eventType,
    eventLocation: a.eventLocation,
    eventDate: formatDate(a.eventDate, lang),
    guestCount: a.guestCount,
    status: a.status,
    total: num(a.totalPrice),
    date: formatDate(a.createdAt, lang),
  }));

  return (
    <>
      <PageHeader title={t.applications.title} count={total} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder={t.applications.searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            param="status"
            allLabel={t.applications.allStatuses}
            options={APPLICATION_STATUSES.map((s) => ({
              value: s,
              label: statusLabel(t, s),
            }))}
          />
          <FilterSelect
            param="event"
            allLabel={t.applications.allEvents}
            options={EVENT_TYPES.map((e) => ({
              value: e,
              label: eventLabel(t, e),
            }))}
          />
        </div>
      </div>

      <ApplicationsTable
        rows={rows}
        footer={
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          />
        }
      />
    </>
  );
}
