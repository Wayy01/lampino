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
    title: d.privacyTitle,
    description: d.privacyDescription,
    alternates: localeAlternates(l, "/privacy"),
    openGraph: openGraphFor(l, {
      title: d.privacyTitle,
      description: d.privacyDescription,
      path: "/privacy",
    }),
  };
}

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const contact = await getContactSettings();
  return <LegalContent section="privacy" email={contact?.email ?? null} />;
}
