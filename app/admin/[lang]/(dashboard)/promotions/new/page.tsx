import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { pick } from "@/lib/utils";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { PromotionForm } from "@/components/admin/promotion-form";

export default async function NewPromotionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const [products, rentals] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name_ro: "asc" },
      select: { id: true, name_ro: true, name_ru: true },
    }),
    prisma.rentalPackage.findMany({
      orderBy: { title_ro: "asc" },
      select: { id: true, title_ro: true, title_ru: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={t.promotions.newPromotion}
        backHref={adminHref(lang, "/promotions")}
        backLabel={t.promotions.title}
      />
      <PromotionForm
        promotion={null}
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
