import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Mail,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  Sparkles,
  User,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { decryptSecret } from "@/lib/admin/crypto";
import { formatPrice, parseId, pick } from "@/lib/utils";
import { num, formatDate, formatDateTime } from "@/lib/admin/serialize";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { resolveItemDims } from "@/lib/courier/parcel";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { ShipmentDialog } from "@/components/admin/shipment-dialog";
import { ShipmentPanel } from "@/components/admin/shipment-panel";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const orderId = parseId(id);
  if (orderId === null) notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { where: { isMain: true }, take: 1 },
              category: { select: { name_ro: true, name_ru: true } },
            },
          },
          productVariant: true,
          rentalPackage: {
            include: { images: { where: { isMain: true }, take: 1 } },
          },
          rentalPackageVariant: true,
        },
      },
      shipments: {
        select: { id: true, carrier: true, carrierTitle: true, trackingNumber: true, status: true },
      },
    },
  });
  if (!order) notFound();

  const settings = await prisma.shippingSettings.findFirst({ where: { isActive: true } });

  const itemsTotal = order.items.reduce(
    (sum, item) => sum + num(item.priceEach) * item.quantity,
    0,
  );

  // Shipment state + the parcel the drawer pre-fills (assembled from the order's
  // product item dimensions, variant → product → store fallback).
  const shipment = order.shipments[0] ?? null;
  // Mirror the create-shipment action's gate exactly: a *decryptable* key, not
  // merely a stored ciphertext — otherwise a rotated secret would show the
  // carrier as ready here while the action refuses with `courierNotConfigured`.
  const novapostConfigured = Boolean(
    settings?.novapostEnabled &&
      decryptSecret(settings.novapostApiKey) &&
      settings.novapostSenderDivisionId,
  );
  const fancourierConfigured = Boolean(
    settings?.fancourierEnabled && decryptSecret(settings.fancourierApiKey),
  );
  const parcelFallback = {
    weightG: settings?.novapostParcelWeightG ?? 2000,
    lengthMm: settings?.novapostParcelLengthMm ?? 240,
    widthMm: settings?.novapostParcelWidthMm ?? 160,
    heightMm: settings?.novapostParcelHeightMm ?? 200,
  };
  // Fan Courier stores its default parcel in kg/cm; the parcel distributor works
  // in canonical g/mm, so convert the store fallback up front.
  const fancourierFallback = {
    weightG: Math.round(((settings ? num(settings.fancourierParcelWeightKg) : 1) || 1) * 1000),
    lengthMm: (settings?.fancourierParcelLengthCm ?? 24) * 10,
    widthMm: (settings?.fancourierParcelWidthCm ?? 16) * 10,
    heightMm: (settings?.fancourierParcelHeightCm ?? 20) * 10,
  };
  const productItems = order.items.filter((i) => i.productId && i.product);
  // Declared value / COD default is the value of the *shippable* goods only —
  // `itemsTotal` also includes rental lines, which never go in the parcel, so
  // using it would over-declare insurance and over-collect on delivery.
  const shippableValue = productItems.reduce(
    (sum, i) => sum + num(i.priceEach) * i.quantity,
    0,
  );
  // Item lines the drawer distributes across parcels (variant → product → store
  // dimensions), with per-unit value for proportional declared-value splitting.
  const shipmentItems = productItems.map((i) => ({
    name: pick(lang, i.product!.name_ro, i.product!.name_ru),
    category: i.product!.category
      ? pick(lang, i.product!.category.name_ro, i.product!.category.name_ru)
      : settings?.novapostDefaultCategory || "",
    qty: i.quantity,
    unitValue: num(i.priceEach),
    ...resolveItemDims(i.productVariant, i.product!, parcelFallback),
  }));

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

          <SectionCard
            title={t.orders.shipment.title}
            icon={<Package className="h-4 w-4" strokeWidth={1.75} />}
          >
            {shipment ? (
              <ShipmentPanel
                orderId={order.id}
                carrierTitle={shipment.carrierTitle ?? shipment.carrier}
                trackingNumber={shipment.trackingNumber}
              />
            ) : (
              <ShipmentDialog
                orderId={order.id}
                recipient={{
                  name: order.customerName,
                  phone: order.customerPhone ?? "",
                  email: order.customerEmail,
                }}
                address={{
                  city: order.city,
                  street: order.address,
                  postCode: order.postalCode,
                }}
                items={shipmentItems}
                fallback={parcelFallback}
                fancourierFallback={fancourierFallback}
                insuranceTotal={Math.round(shippableValue)}
                novapostConfigured={novapostConfigured}
                fancourierConfigured={fancourierConfigured}
              />
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
