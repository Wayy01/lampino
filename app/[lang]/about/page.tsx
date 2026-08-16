import type { Metadata } from "next";
import { AboutContent } from "@/components/site/about-content";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { localeAlternates, openGraphFor } from "@/lib/seo";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { isLocale, localePath } from "@/lib/i18n/routing";

// The shared storefront layout queries the catalog, so this route can't be
// prerendered either, even though the page itself is pure dictionary copy.
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
    title: d.aboutTitle,
    description: d.aboutDescription,
    alternates: localeAlternates(l, "/about"),
    openGraph: openGraphFor(l, {
      title: d.aboutTitle,
      description: d.aboutDescription,
      path: "/about",
    }),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: dictionaries[l].nav.home, path: localePath(l) },
          { name: dictionaries[l].nav.about, path: localePath(l, "/about") },
        ])}
      />
      <AboutContent />
    </>
  );
}
