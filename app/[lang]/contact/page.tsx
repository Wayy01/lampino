import type { Metadata } from "next";
import { ContactContent } from "@/components/site/contact-content";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { getContactSettings } from "@/lib/data/settings";
import { localeAlternates, openGraphFor } from "@/lib/seo";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { isLocale, localePath } from "@/lib/i18n/routing";

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
    title: d.contactTitle,
    description: d.contactDescription,
    alternates: localeAlternates(l, "/contact"),
    openGraph: openGraphFor(l, {
      title: d.contactTitle,
      description: d.contactDescription,
      path: "/contact",
    }),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const contact = await getContactSettings();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: dictionaries[l].nav.home, path: localePath(l) },
          { name: dictionaries[l].nav.contact, path: localePath(l, "/contact") },
        ])}
      />
      <ContactContent contact={contact} />
    </>
  );
}
