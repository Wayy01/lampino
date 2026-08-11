import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { pick } from "@/lib/utils";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { RentalForm } from "@/components/admin/rental-form";

export default async function NewRentalPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const [categories, promotions] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.promotion.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        title={t.rentals.newRental}
        backHref={adminHref(lang, "/rentals")}
        backLabel={t.rentals.title}
      />
      <RentalForm
        rental={null}
        categories={categories.map((c) => ({
          id: c.id,
          name: pick(lang, c.name_ro, c.name_ru),
        }))}
        promotions={promotions.map((p) => ({
          id: p.id,
          name: pick(lang, p.name_ro, p.name_ru),
        }))}
      />
    </>
  );
}
