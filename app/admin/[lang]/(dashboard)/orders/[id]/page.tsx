import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
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
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderStatusForm } from "@/components/admin/order-status-form";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { include: { images: { where: { isMain: true }, take: 1 } } },
          productVariant: true,
          rentalPackage: {
            include: { images: { where: { isMain: true }, take: 1 } },
          },
          rentalPackageVariant: true,
        },
      },
    },
  });
  if (!order) notFound();

  const itemsTotal = order.items.reduce(
    (sum, item) => sum + num(item.priceEach) * item.quantity,
    0,
  );

  return (
    <>
      <PageHeader
        title={`${t.orders.orderTitle} #${order.id}`}
        backHref={adminHref(lang, "/orders")}
        backLabel={t.orders.title}
        actions={
          <StatusBadge
            status={order.status}
            label={statusLabel(t, order.status)}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <SectionCard
            title={t.orders.itemsTitle}
            icon={<ReceiptText className="h-4 w-4" strokeWidth={1.75} />}
          >
            <ul className="divide-y">
              {order.items.map((item) => {
                const isRental = item.rentalPackageId !== null;
                const title = isRental
                  ? item.rentalPackage
                    ? pick(lang, item.rentalPackage.title_ro, item.rentalPackage.title_ru)
                    : t.orders.deletedRental
                  : item.product
                    ? pick(lang, item.product.name_ro, item.product.name_ru)
                    : t.orders.deletedProduct;
                const variantName = isRental
                  ? item.rentalPackageVariant &&
                    pick(lang, item.rentalPackageVariant.name_ro, item.rentalPackageVariant.name_ru)
                  : item.productVariant &&
                    pick(lang, item.productVariant.name_ro, item.productVariant.name_ru);
                const image = isRental
                  ? item.rentalPackage?.images[0]?.imageUrl
                  : item.product?.images[0]?.imageUrl;
                const itemHref =
                  !isRental && item.productId
                    ? adminHref(lang, `/products/${item.productId}`)
                    : null;

                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted">
                      {image && (
                        <Image
                          src={image}
                          alt=""
                          fill
                          sizes="48px"
                          unoptimized
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {itemHref ? (
                          <Link
                            href={itemHref}
                            className="truncate text-sm font-medium hover:text-primary"
                          >
                            {title}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-medium">
                            {title}
                          </span>
                        )}
                        {isRental && (
                          <Sparkles
                            className="h-3.5 w-3.5 shrink-0 text-primary"
                            strokeWidth={1.75}
                          />
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {variantName && <span>{variantName} · </span>}
                        {item.quantity} × {formatPrice(num(item.priceEach))}
                        {item.rentalStart && item.rentalEnd && (
                          <span>
                            {" "}
                            · {formatDate(item.rentalStart, lang)} →{" "}
                            {formatDate(item.rentalEnd, lang)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-medium">
                      {formatPrice(num(item.priceEach) * item.quantity)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="label-mono text-muted-foreground">
                {t.common.total}
              </span>
              <div className="text-right">
                <div className="font-display text-2xl tracking-tight">
                  {formatPrice(num(order.totalPrice))}
                </div>
                {itemsTotal !== num(order.totalPrice) && (
                  <div className="text-xs text-muted-foreground">
                    {t.orders.itemsSubtotal} {formatPrice(itemsTotal)}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {order.specialInstructions && (
            <SectionCard title={t.orders.specialInstructions}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {order.specialInstructions}
              </p>
            </SectionCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title={t.orders.statusTitle}>
            <OrderStatusForm orderId={order.id} status={order.status} />
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
              {t.orders.placed} {formatDateTime(order.createdAt, lang)}
            </p>
          </SectionCard>

          <SectionCard
            title={t.orders.customer}
            icon={<User className="h-4 w-4" strokeWidth={1.75} />}
          >
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="font-medium">{order.customerName}</div>
              <a
                href={`mailto:${order.customerEmail}`}
                className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{order.customerEmail}</span>
              </a>
              {order.customerPhone && (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  {order.customerPhone}
                </a>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={t.orders.delivery}
            icon={<MapPin className="h-4 w-4" strokeWidth={1.75} />}
          >
            {order.address || order.city ? (
              <address className="text-sm not-italic leading-relaxed text-muted-foreground">
                {order.address && <div>{order.address}</div>}
                <div>
                  {[order.city, order.postalCode].filter(Boolean).join(", ")}
                </div>
                {order.country && <div>{order.country}</div>}
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.orders.noAddress}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
