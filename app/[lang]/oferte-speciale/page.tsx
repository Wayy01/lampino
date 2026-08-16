import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSpecialOffers, getSpecialOffersMeta } from "@/lib/data/offers";
import { OffersContent } from "@/components/site/offers-content";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { localeAlternates, metaDescription, openGraphFor } from "@/lib/seo";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { isLocale, localePath } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const d = dictionaries[l].seo;
  // The admin owns this page's headline; the dictionary covers the window
  // before it's published, when the route 404s anyway.
  const page = await getSpecialOffersMeta();
  if (!page) return { title: d.offersTitle, robots: { index: false, follow: false } };

  const title = pick(l, page.title_ro, page.title_ru) || d.offersTitle;
  const description =
    metaDescription(pick(l, page.description_ro, page.description_ru)) ||
    d.offersDescription;

  return {
    title,
    description,
    alternates: localeAlternates(l, "/oferte-speciale"),
    openGraph: openGraphFor(l, {
      title,
      description,
      path: "/oferte-speciale",
    }),
  };
}

export default async function SpecialOffersPage({
  params,
}: PageProps<"/[lang]/oferte-speciale">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // The page only exists while the admin has it published.
  const offers = await getSpecialOffers();
  if (!offers) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: dictionaries[lang].nav.home, path: localePath(lang) },
          {
            name: pick(lang, offers.title_ro, offers.title_ru),
            path: localePath(lang, "/oferte-speciale"),
          },
        ])}
      />
      <OffersContent offers={offers} />
    </>
  );
}
