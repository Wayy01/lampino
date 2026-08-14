import { Eye, MousePointerClick, Sparkles, Timer } from "lucide-react";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { getAnalytics, type AnalyticsSort } from "@/lib/admin/analytics";
import { formatDwell } from "@/lib/admin/analytics-format";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { FilterSelect } from "@/components/admin/toolbar";
import {
  ProductAnalyticsTable,
  RentalAnalyticsTable,
} from "@/components/admin/analytics-tables";

// Reads cookies via requireAdmin, so it's dynamic anyway — keep the numbers
// live rather than cached.
export const dynamic = "force-dynamic";

/** `period` query param → window in days, or null for all time. Default 30. */
function periodDays(param: string): number | null {
  switch (param) {
    case "7":
      return 7;
    case "90":
      return 90;
    case "all":
      return null;
    default:
      return 30;
  }
}

const SORTS: Record<string, AnalyticsSort> = {
  views_asc: "views_asc",
  dwell: "dwell",
  intent: "intent",
};

export default async function AdminAnalyticsPage({
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
  const a = t.analytics;

  const sp = await searchParams;
  const periodParam = typeof sp.period === "string" ? sp.period : "";
  const sortParam = typeof sp.sort === "string" ? sp.sort : "";
  const sort: AnalyticsSort = SORTS[sortParam] ?? "views";

  const { overview, products, rentals } = await getAnalytics(
    periodDays(periodParam),
    sort,
  );

  return (
    <>
      <PageHeader
        title={a.title}
        actions={
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect
              param="sort"
              allLabel={a.sortViews}
              options={[
                { value: "views_asc", label: a.sortLeastViews },
                { value: "dwell", label: a.sortDwell },
                { value: "intent", label: a.sortIntent },
              ]}
            />
            <FilterSelect
              param="period"
              allLabel={a.last30}
              options={[
                { value: "7", label: a.last7 },
                { value: "90", label: a.last90 },
                { value: "all", label: a.allTime },
              ]}
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label={a.productViews}
          value={overview.productViews}
          hint={a.detailPages}
          icon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={a.rentalViews}
          value={overview.rentalViews}
          hint={a.detailPages}
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={a.addedToCart}
          value={overview.addToCart}
          icon={<MousePointerClick className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label={a.avgTime}
          value={formatDwell(overview.avgDwellMs)}
          hint={a.perView}
          icon={<Timer className="h-4 w-4" strokeWidth={1.75} />}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2 lg:gap-5">
        <section>
          <h2 className="mb-3 flex items-center gap-2.5 font-medium">
            <Eye
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.75}
            />
            {a.productsTitle}
          </h2>
          <ProductAnalyticsTable rows={products} />
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2.5 font-medium">
            <Sparkles
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.75}
            />
            {a.rentalsTitle}
          </h2>
          <RentalAnalyticsTable rows={rentals} />
        </section>
      </div>
    </>
  );
}
