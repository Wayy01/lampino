import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { categoryHref, categorySlug, isLocale } from "@/lib/i18n/routing";
import { slugify } from "@/lib/slug";
import { parseId, pick } from "@/lib/utils";
import { getCategoryLanding } from "@/lib/data/categories";
import { PageHeader } from "@/components/admin/page-header";
import { CategorySeoForm } from "@/components/admin/category-seo-form";

export default async function AdminCategorySeoPage({
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
  const [category, landing] = await Promise.all([
    prisma.category.findUnique({ where: { id } }),
    getCategoryLanding(id),
  ]);
  if (!category || !landing) notFound();

  return (
    <>
      <PageHeader
        title={`${t.categories.seo.title}: ${pick(lang, category.name_ro, category.name_ru)}`}
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
      <CategorySeoForm
        data={{
          id,
          urlSlug_ro: category.urlSlug_ro,
          urlSlug_ru: category.urlSlug_ru,
          defaultSlug_ro: slugify(category.name_ro) || categorySlug("ro", { ...category, urlSlug_ro: "" }),
          defaultSlug_ru: slugify(category.name_ru) || categorySlug("ru", { ...category, urlSlug_ru: "" }),
          ro: landing.ro,
          ru: landing.ru,
          ogImageUrl: landing.ogImageUrl ?? "",
        }}
      />
    </>
  );
}
