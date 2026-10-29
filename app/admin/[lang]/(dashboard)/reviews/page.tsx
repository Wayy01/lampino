import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { formatDate } from "@/lib/admin/serialize";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale, productHref } from "@/lib/i18n/routing";
import { parsePage, pick } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { ClearFilters, FilterSelect, Pagination } from "@/components/admin/toolbar";
import { ReviewsTable, type ReviewRow } from "@/components/admin/reviews-table";

const PER_PAGE = 20;
const STATUSES = ["pending", "approved", "rejected"] as const;

export default async function AdminReviewsPage({
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
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = parsePage(sp.page);
  const where = STATUSES.includes(status as (typeof STATUSES)[number]) ? { status } : {};

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        product: { select: { id: true, name_ro: true, name_ru: true, isActive: true } },
      },
    }),
  ]);

  const rows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    productName: pick(lang, r.product.name_ro, r.product.name_ru),
    productHref: r.product.isActive ? productHref(lang, r.product) : null,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    status: r.status,
    date: formatDate(r.createdAt, lang),
  }));

  return (
    <>
      <PageHeader title={t.reviews.title} count={total} />
      <div className="mb-4 flex gap-2">
        <FilterSelect
          param="status"
          allLabel={t.reviews.allStatuses}
          options={STATUSES.map((s) => ({ value: s, label: t.reviews.statuses[s] }))}
        />
        <ClearFilters />
      </div>
      <ReviewsTable
        rows={rows}
        footer={
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER_PAGE))} total={total} />
        }
      />
    </>
  );
}
