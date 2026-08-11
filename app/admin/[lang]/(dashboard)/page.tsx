import Link from "next/link";
import {
  Banknote,
  CalendarClock,
  Clock,
  Package,
  PackageOpen,
  ShoppingCart,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { formatPrice, pick } from "@/lib/utils";
import { num, formatDate } from "@/lib/admin/serialize";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const [
    revenue,
    orderCount,
    pendingOrders,
    pendingApplications,
    activeProducts,
    lowStock,
    recentOrders,
    topSellers,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { status: { not: "cancelled" } },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.rentalApplication.count({ where: { status: "pending" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 6,
      select: { id: true, name_ro: true, name_ru: true, stock: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      include: { _count: { select: { items: true } } },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: { productId: { not: null }, order: { status: { not: "cancelled" } } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const topProductIds = topSellers
    .map((item) => item.productId)
    .filter((id): id is number => id !== null);
  const topProducts = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name_ro: true, name_ru: true },
  });
  const productName = (id: number | null) => {
    const p = topProducts.find((tp) => tp.id === id);
    return p ? pick(lang, p.name_ro, p.name_ru) : "—";
  };

  return (
    <>
      <PageHeader title={t.dashboard.title} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label={t.dashboard.revenue}
          value={formatPrice(num(revenue._sum.totalPrice) ?? 0)}
          hint={t.dashboard.excludingCancelled}
          icon={<Banknote className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={t.dashboard.orders}
          value={orderCount}
          hint={`${pendingOrders} ${t.dashboard.pendingHint}`}
          icon={<ShoppingCart className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={t.dashboard.products}
          value={activeProducts}
          hint={`${lowStock.length} ${t.dashboard.lowStockHint}`}
          icon={<Package className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={t.dashboard.rentalRequests}
          value={pendingApplications}
          hint={t.dashboard.awaitingReview}
          icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <SectionCard
          title={t.dashboard.recentOrders}
          icon={<Clock className="h-4 w-4" strokeWidth={1.75} />}
          className="lg:col-span-3"
          actions={
            <Link
              href={adminHref(lang, "/orders")}
              className="text-sm text-primary hover:underline"
            >
              {t.dashboard.allOrders}
            </Link>
          }
        >
          <ul className="divide-y">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={adminHref(lang, `/orders/${order.id}`)}
                  className="flex items-center gap-4 py-3 transition-colors hover:bg-foreground/[0.02] first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {order.customerName}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      #{order.id} · {order._count.items}{" "}
                      {order._count.items === 1
                        ? t.dashboard.item
                        : t.dashboard.items}{" "}
                      · {formatDate(order.createdAt, lang)}
                    </div>
                  </div>
                  <StatusBadge
                    status={order.status}
                    label={statusLabel(t, order.status)}
                    className="hidden sm:inline-flex"
                  />
                  <span className="shrink-0 text-sm font-medium">
                    {formatPrice(num(order.totalPrice))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.dashboard.lowStock}
            icon={<PackageOpen className="h-4 w-4" strokeWidth={1.75} />}
          >
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t.dashboard.allStocked}
              </p>
            ) : (
              <ul className="divide-y">
                {lowStock.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={adminHref(lang, `/products/${p.id}`)}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="truncate">
                        {pick(lang, p.name_ro, p.name_ru)}
                      </span>
                      <span
                        className={
                          p.stock === 0
                            ? "font-mono text-xs text-red-600"
                            : "font-mono text-xs text-amber-600"
                        }
                      >
                        {p.stock === 0
                          ? t.dashboard.out
                          : `${p.stock} ${t.dashboard.left}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={t.dashboard.topSellers}
            icon={<Package className="h-4 w-4" strokeWidth={1.75} />}
          >
            <ol className="divide-y">
              {topSellers.map((item, i) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <Link
                    href={adminHref(lang, `/products/${item.productId}`)}
                    className="min-w-0 flex-1 truncate hover:text-primary"
                  >
                    {productName(item.productId)}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    ×{item._sum.quantity}
                  </span>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
