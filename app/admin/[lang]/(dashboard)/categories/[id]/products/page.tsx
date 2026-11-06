import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { num } from "@/lib/admin/serialize";
import { categoryHref, isLocale } from "@/lib/i18n/routing";
import { parseId, pick } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  CategoryProductsOrder,
  type CategoryProductRow,
} from "@/components/admin/category-products-order";

export default async function AdminCategoryProductsPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const id = parseId(rawId);
  if (id === null) notFound();
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      products: {
        where: { deletedAt: null },
        orderBy: [{ categoryOrder: "asc" }, { createdAt: "desc" }],
        include: {
          images: { orderBy: [{ isMain: "desc" }, { id: "asc" }], take: 1 },
        },
      },
    },
  });
  if (!category) notFound();

  const rows: CategoryProductRow[] = category.products.map((p) => ({
    id: p.id,
    name_ro: p.name_ro,
    name_ru: p.name_ru,
    imageUrl: p.images[0]?.imageUrl ?? null,
    price: num(p.price),
    reducedPrice: num(p.reducedPrice),
    isActive: p.isActive,
  }));

  return (
    <>
      <PageHeader
        title={`${t.categories.productOrder.title}: ${pick(lang, category.name_ro, category.name_ru)}`}
        count={rows.length}
        backHref={`/admin/${lang}/categories`}
        backLabel={t.categories.title}
        actions={
          <a
            href={categoryHref(lang, category)}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border px-4 text-sm transition-colors hover:bg-foreground/[0.04]"
          >
            <ExternalLink className="h-4 w-4" />
            {t.categories.seo.viewPage}
          </a>
        }
      />
      <CategoryProductsOrder categoryId={category.id} rows={rows} />
    </>
  );
}
