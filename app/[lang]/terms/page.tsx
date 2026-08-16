import type { Metadata } from "next";
import { LegalContent } from "@/components/site/legal-content";
import { getContactSettings } from "@/lib/data/settings";
import { localeAlternates, openGraphFor } from "@/lib/seo";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const d = dictionaries[l].seo;
  return {
    title: d.termsTitle,
    description: d.termsDescription,
    alternates: localeAlternates(l, "/terms"),
    openGraph: openGraphFor(l, {
      title: d.termsTitle,
      description: d.termsDescription,
      path: "/terms",
    }),
  };
}

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const contact = await getContactSettings();
  return <LegalContent section="terms" email={contact?.email ?? null} />;
}
