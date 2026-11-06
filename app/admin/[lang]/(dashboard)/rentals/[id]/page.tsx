import { notFound } from "next/navigation";
import { toPromotionOption } from "@/lib/admin/promotion-status";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { num } from "@/lib/admin/serialize";
import { parseId, pick } from "@/lib/utils";
import {
  getAdminDict,
  adminHref,
  statusLabel,
  type AdminLang,
} from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { specsFromJson } from "@/lib/admin/specs";
import { includesFromJson } from "@/lib/admin/includes";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { RentalForm, type RentalFormData } from "@/components/admin/rental-form";

export default async function EditRentalPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const rentalId = parseId(id);
  if (rentalId === null) notFound();

  const [rental, categories, promotions] = await Promise.all([
    prisma.rentalPackage.findUnique({
      where: { id: rentalId },
      include: {
        images: { orderBy: { id: "asc" } },
        videos: { orderBy: { id: "asc" } },
        variants: { orderBy: { sortOrder: "asc" } },
        promotions: { select: { id: true } },
        _count: { select: { rentalApplications: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.promotion.findMany({ orderBy: { startDate: "desc" } }),
  ]);
  if (!rental || rental.deletedAt) notFound();

  const formData: RentalFormData = {
    id: rental.id,
    title_ro: rental.title_ro,
    title_ru: rental.title_ru,
    description_ro: rental.description_ro,
    description_ru: rental.description_ru,
    price: num(rental.price),
    reducedPrice: num(rental.reducedPrice),
    categoryId: rental.categoryId,
    promotionIds: rental.promotions.map((p) => p.id),
    isActive: rental.isActive,
    specifications: specsFromJson(rental.specifications),
    includes_ro: includesFromJson(rental.includes_ro),
    includes_ru: includesFromJson(rental.includes_ru),
    images: rental.images
      .slice()
      .sort((a, b) => Number(b.isMain) - Number(a.isMain))
      .map((i) => ({ imageUrl: i.imageUrl, isMain: i.isMain })),
    videos: rental.videos.map((v) => ({
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
    })),
    variants: rental.variants.map((v) => ({
      id: v.id,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size,
      price: num(v.price),
      reducedPrice: num(v.reducedPrice),
      isDefault: v.isDefault,
      sortOrder: v.sortOrder,
    })),
    applicationCount: rental._count.rentalApplications,
  };

  return (
    <>
      <PageHeader
        title={pick(lang, rental.title_ro, rental.title_ru)}
        backHref={adminHref(lang, "/rentals")}
        backLabel={t.rentals.title}
        actions={
          <StatusBadge
            status={rental.isActive ? "active" : "inactive"}
            label={statusLabel(t, rental.isActive ? "active" : "inactive")}
          />
        }
      />
      <RentalForm
        rental={formData}
        categories={categories.map((c) => ({
          id: c.id,
          name: pick(lang, c.name_ro, c.name_ru),
        }))}
        promotions={promotions.map((p) => toPromotionOption(p, pick(lang, p.name_ro, p.name_ru)))}
      />
    </>
  );
}
