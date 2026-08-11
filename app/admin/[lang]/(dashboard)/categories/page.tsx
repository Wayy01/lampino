import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  CategoriesManager,
  type CategoryRow,
} from "@/components/admin/categories-manager";

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const categories = await prisma.category.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    include: { _count: { select: { products: true, rentalPackages: true } } },
  });

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: pick(lang, c.name_ro, c.name_ru),
    name_ro: c.name_ro,
    name_ru: c.name_ru,
    slug: c.slug,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
    rentalCount: c._count.rentalPackages,
  }));

  return (
    <>
      <PageHeader title={t.categories.title} count={rows.length} />
      <CategoriesManager rows={rows} />
    </>
  );
}
