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
import {
  SearchInput,
  FilterSelect,
  Pagination,
  ClearFilters,
} from "@/components/admin/toolbar";
import { RentalsTable, type RentalRow } from "@/components/admin/rentals-table";

const PER_PAGE = 12;

/** `sort` query param → Prisma ordering. Unknown values fall back to newest. */
function rentalOrderBy(
  sort: string,
  lang: AdminLang,
): Prisma.RentalPackageOrderByWithRelationInput {
  switch (sort) {
    case "oldest":
      return { createdAt: "asc" };
    case "name":
      return lang === "ru" ? { title_ru: "asc" } : { title_ro: "asc" };
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export default async function AdminRentalsPage({
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
  const sort = typeof sp.sort === "string" ? sp.sort : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.RentalPackageWhereInput = {
    ...(q && {
      OR: [
        { title_ro: { contains: q, mode: "insensitive" } },
        { title_ru: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(category && { categoryId: category }),
    ...(status === "active" && { isActive: true }),
    ...(status === "inactive" && { isActive: false }),
  };

  const [total, rentals, categories] = await Promise.all([
    prisma.rentalPackage.count({ where }),
    prisma.rentalPackage.findMany({
      where,
      orderBy: rentalOrderBy(sort, lang),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        category: { select: { name_ro: true, name_ru: true } },
        images: { where: { isMain: true }, take: 1 },
        _count: { select: { variants: true, rentalApplications: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
  ]);

  const rows: RentalRow[] = rentals.map((r) => ({
    id: r.id,
    title: pick(lang, r.title_ro, r.title_ru),
    categoryName: r.category
      ? pick(lang, r.category.name_ro, r.category.name_ru)
      : null,
    price: num(r.price),
    reducedPrice: num(r.reducedPrice),
    variantCount: r._count.variants,
    applicationCount: r._count.rentalApplications,
    isActive: r.isActive,
    imageUrl: r.images[0]?.imageUrl ?? null,
  }));

  return (
    <>
      <PageHeader
        title={t.rentals.title}
        count={total}
        actions={
          <Link
            href={adminHref(lang, "/rentals/new")}
            className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.rentals.newRental}</span>
            <span className="sm:hidden">{t.common.add}</span>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput
          placeholder={t.rentals.searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            param="category"
            allLabel={t.rentals.allCategories}
            options={categories.map((c) => ({
              value: String(c.id),
              label: pick(lang, c.name_ro, c.name_ru),
            }))}
          />
          <FilterSelect
            param="status"
            allLabel={t.rentals.allStatuses}
            options={[
              { value: "active", label: t.statuses.active },
              { value: "inactive", label: t.statuses.inactive },
            ]}
          />
          <FilterSelect
            param="sort"
            allLabel={t.common.sortNewest}
            options={[
              { value: "oldest", label: t.common.sortOldest },
              { value: "name", label: t.common.sortName },
              { value: "price_asc", label: t.common.sortPriceAsc },
              { value: "price_desc", label: t.common.sortPriceDesc },
            ]}
            className="col-span-2"
          />
          <ClearFilters className="col-span-2 justify-center sm:justify-start" />
        </div>
      </div>

      <RentalsTable
        rows={rows}
        footer={
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
            total={total}
          />
        }
      />
    </>
  );
}
