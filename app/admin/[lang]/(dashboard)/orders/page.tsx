import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { Prisma } from "@/lib/generated/prisma";
import { num, formatDate } from "@/lib/admin/serialize";
import { getAdminDict, statusLabel, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput, FilterSelect, Pagination } from "@/components/admin/toolbar";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";
import { ORDER_STATUSES } from "@/lib/admin/order-status";

const PER_PAGE = 12;

export default async function AdminOrdersPage({
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
  const page = Math.max(1, Number(sp.page) || 1);

  const idQuery = /^#?\d+$/.test(q.trim())
    ? Number(q.trim().replace("#", ""))
    : null;
  const where: Prisma.OrderWhereInput = {
    ...(q && {
      OR: [
        { customerName: { contains: q, mode: "insensitive" as const } },
        { customerEmail: { contains: q, mode: "insensitive" as const } },
        ...(idQuery !== null ? [{ id: idQuery }] : []),
      ],
    }),
    ...(status && { status }),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    city: o.city,
    status: o.status,
    total: num(o.totalPrice),
    itemCount: o._count.items,
    date: formatDate(o.createdAt, lang),
  }));

  return (
    <>
      <PageHeader title={t.orders.title} count={total} />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder={t.orders.searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        <FilterSelect
          param="status"
          allLabel={t.orders.allStatuses}
          options={ORDER_STATUSES.map((s) => ({
            value: s,
            label: statusLabel(t, s),
          }))}
        />
      </div>

      <OrdersTable
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
