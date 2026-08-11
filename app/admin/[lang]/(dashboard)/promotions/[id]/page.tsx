import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { pick } from "@/lib/utils";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { promotionState, toDateInput } from "@/lib/admin/promotion-status";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  PromotionForm,
  type PromotionFormData,
} from "@/components/admin/promotion-form";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const promotionId = Number(id);
  if (!Number.isInteger(promotionId)) notFound();

  const [promotion, products, rentals] = await Promise.all([
    prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        products: { select: { id: true } },
        rentals: { select: { id: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: { name_ro: "asc" },
      select: { id: true, name_ro: true, name_ru: true },
    }),
    prisma.rentalPackage.findMany({
      orderBy: { title_ro: "asc" },
      select: { id: true, title_ro: true, title_ru: true },
    }),
  ]);
  if (!promotion) notFound();

  const state = promotionState(promotion.startDate, promotion.endDate);

  const formData: PromotionFormData = {
    id: promotion.id,
    name_ro: promotion.name_ro,
    name_ru: promotion.name_ru,
    description_ro: promotion.description_ro ?? "",
    description_ru: promotion.description_ru ?? "",
    startDate: toDateInput(promotion.startDate),
    endDate: toDateInput(promotion.endDate),
    discountPercent: promotion.discountPercent,
    featured: promotion.featured,
    productIds: promotion.products.map((p) => p.id),
    rentalIds: promotion.rentals.map((r) => r.id),
  };

  return (
    <>
      <PageHeader
        title={pick(lang, promotion.name_ro, promotion.name_ru)}
        backHref={adminHref(lang, "/promotions")}
        backLabel={t.promotions.title}
        actions={<StatusBadge status={state} label={statusLabel(t, state)} />}
      />
      <PromotionForm
        promotion={formData}
        products={products.map((p) => ({
          id: p.id,
          name: pick(lang, p.name_ro, p.name_ru),
        }))}
        rentals={rentals.map((r) => ({
          id: r.id,
          name: pick(lang, r.title_ro, r.title_ru),
        }))}
      />
    </>
  );
}
