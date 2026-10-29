import type { Metadata } from "next";
import { ContactContent } from "@/components/site/contact-content";
import { JsonLd } from "@/components/site/json-ld";
import { breadcrumbSchema } from "@/lib/schema";
import { getContactSettings } from "@/lib/data/settings";
import { fill, localeAlternates, metaDescription, openGraphFor } from "@/lib/seo";
import { pick } from "@/lib/utils";
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
  // Phone and hours are what people search the contact page for, so they go in
  // the snippet itself — straight from the admin settings, never hardcoded.
  const contact = await getContactSettings();
  const vars = contact && {
    phone: contact.phone,
    hours: pick(l, contact.businessHours_ro, contact.businessHours_ru),
  };
  const title = vars ? fill(d.contactTitle, vars) : d.contactTitleFallback;
  const description = vars
    ? metaDescription(fill(d.contactDescription, vars))
    : d.contactDescriptionFallback;
  return {
    title,
    description,
    alternates: localeAlternates(l, "/contact"),
    openGraph: openGraphFor(l, { title, description, path: "/contact" }),
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
