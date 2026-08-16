import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRentalPackages } from "@/lib/data/rentals";
import { getHomepageSettings } from "@/lib/data/settings";
import { isLocale, localePath, rentalPath, rentalsHref } from "@/lib/i18n/routing";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/utils";
import { localeAlternates, openGraphFor } from "@/lib/seo";
import { breadcrumbSchema, itemListSchema } from "@/lib/schema";
import { JsonLd } from "@/components/site/json-ld";
import { RentalCard } from "@/components/site/rental-card";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const d = dictionaries[l].seo;
  return {
    title: d.rentalTitle,
    description: d.rentalDescription,
    alternates: localeAlternates(l, "/arenda"),
    openGraph: openGraphFor(l, {
      title: d.rentalTitle,
      description: d.rentalDescription,
      path: "/arenda",
    }),
  };
}

export default async function ArendaPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const d = dictionaries[lang].arenda;
  const [packages, settings] = await Promise.all([
    getRentalPackages(),
    getHomepageSettings(),
  ]);
  const heading = settings
    ? pick(lang, settings.rentalHeading_ro, settings.rentalHeading_ru)
    : "";
  const countLabel =
    packages.length === 1 ? d.resultsOne : d.resultsMany;

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-28 pt-28 sm:px-8 md:pt-36">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: dictionaries[lang].nav.home, path: localePath(lang) },
            { name: dictionaries[lang].nav.rental, path: rentalsHref(lang) },
          ]),
          itemListSchema(
            packages.map((p) => ({
              name: pick(lang, p.title_ro, p.title_ru),
              path: localePath(lang, rentalPath(p.id, p.title_ro)),
            })),
          ),
        ]}
      />
      {/* Editorial header */}
      <div className="max-w-2xl">
        <div className="label-mono flex items-center gap-3 text-muted-foreground">
          <span className="h-px w-8 bg-border" />
          <span>{d.kicker}</span>
        </div>
        <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,5rem)] font-light leading-[0.95] tracking-[-0.03em]">
          {heading || d.title}
        </h1>
      </div>

      {packages.length === 0 ? (
        <p className="font-display py-24 text-center text-2xl text-muted-foreground">
          {d.empty}
        </p>
      ) : (
        <>
          <div className="mt-12 flex items-center justify-between border-b border-border pb-6">
            <span className="label-mono text-muted-foreground">
              {packages.length} {countLabel}
            </span>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg, i) => (
              <RentalCard key={pkg.id} pkg={pkg} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
