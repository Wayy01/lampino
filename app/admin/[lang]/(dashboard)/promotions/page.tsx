import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { Prisma } from "@/lib/generated/prisma";
import { formatDate } from "@/lib/admin/serialize";
import { promotionState } from "@/lib/admin/promotion-status";
import { pick } from "@/lib/utils";
import { getAdminDict, adminHref, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { PageHeader } from "@/components/admin/page-header";
import { SearchInput, FilterSelect, Pagination } from "@/components/admin/toolbar";
import {
  PromotionsTable,
  type PromotionRow,
} from "@/components/admin/promotions-table";

const PER_PAGE = 12;
const SNIPPET = 90;

export default async function AdminPromotionsPage({
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
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);

  // A promotion has no status column, so the status filter becomes a
  // comparison against the date window.
  const now = new Date();
  const where: Prisma.PromotionWhereInput = {
    ...(q && {
      OR: [
        { name_ro: { contains: q, mode: "insensitive" } },
        { name_ru: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(status === "active" && {
      startDate: { lte: now },
      endDate: { gte: now },
    }),
    ...(status === "scheduled" && { startDate: { gt: now } }),
    ...(status === "expired" && { endDate: { lt: now } }),
    ...(status === "featured" && { featured: true }),
  };

  const [total, promotions] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      orderBy: { startDate: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { _count: { select: { products: true, rentals: true } } },
    }),
  ]);

  const rows: PromotionRow[] = promotions.map((p) => {
    const description = pick(lang, p.description_ro, p.description_ru)?.trim();
    return {
      id: p.id,
      name: pick(lang, p.name_ro, p.name_ru),
      description: description
        ? description.length > SNIPPET
          ? `${description.slice(0, SNIPPET)}…`
          : description
        : null,
      period: `${formatDate(p.startDate, lang)} → ${formatDate(p.endDate, lang)}`,
      discountPercent: p.discountPercent,
      productCount: p._count.products,
      rentalCount: p._count.rentals,
      featured: p.featured,
      state: promotionState(p.startDate, p.endDate, now),
    };
  });

  return (
    <>
      <PageHeader
        title={t.promotions.title}
        count={total}
        actions={
          <Link
            href={adminHref(lang, "/promotions/new")}
            className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.promotions.newPromotion}</span>
            <span className="sm:hidden">{t.common.add}</span>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          placeholder={t.promotions.searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        <FilterSelect
          param="status"
          allLabel={t.promotions.allStatuses}
          options={[
            { value: "active", label: t.statuses.active },
            { value: "scheduled", label: t.statuses.scheduled },
            { value: "expired", label: t.statuses.expired },
            { value: "featured", label: t.products.featured },
          ]}
        />
      </div>

      <PromotionsTable
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
