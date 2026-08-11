import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { Prisma } from "@/lib/generated/prisma";
import { num } from "@/lib/admin/serialize";
import { pick } from "@/lib/utils";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput, FilterSelect, Pagination } from "@/components/admin/toolbar";
import { ProductsTable, type ProductRow } from "@/components/admin/products-table";

const PER_PAGE = 12;

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const category = typeof sp.category === "string" ? Number(sp.category) : null;
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q && {
      OR: [
        { name_ro: { contains: q, mode: "insensitive" } },
        { name_ru: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(category && { categoryId: category }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
    ...(status === "featured" && { featured: true }),
    ...(status === "low" && { stock: { lte: 5, gt: 0 } }),
    ...(status === "out" && { stock: 0 }),
  };

  const [total, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        category: { select: { name_ro: true, name_ru: true } },
        images: { where: { isMain: true }, take: 1 },
        _count: { select: { variants: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
  ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    name: pick(lang, p.name_ro, p.name_ru),
    categoryName: p.category
      ? pick(lang, p.category.name_ro, p.category.name_ru)
      : null,
    price: num(p.price),
    reducedPrice: num(p.reducedPrice),
    stock: p.stock,
    variantCount: p._count.variants,
    featured: p.featured,
    isActive: p.isActive,
    imageUrl: p.images[0]?.imageUrl ?? null,
  }));

  return (
    <>
      <PageHeader
        title={t.products.title}
        count={total}
        actions={
          <Link
            href={adminHref(lang, "/products/new")}
            className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.products.newProduct}</span>
            <span className="sm:hidden">{t.common.add}</span>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder={t.products.searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            param="category"
            allLabel={t.products.allCategories}
            options={categories.map((c) => ({
              value: String(c.id),
              label: pick(lang, c.name_ro, c.name_ru),
            }))}
          />
          <FilterSelect
            param="status"
            allLabel={t.products.allStatuses}
            options={[
              { value: "active", label: t.statuses.active },
              { value: "inactive", label: t.statuses.inactive },
              { value: "featured", label: t.products.featured },
              { value: "low", label: t.products.lowStockFilter },
              { value: "out", label: t.products.outOfStock },
            ]}
          />
        </div>
      </div>

      <ProductsTable
        rows={rows}
        footer={
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
          />
        }
      />
    </>
  );
}
