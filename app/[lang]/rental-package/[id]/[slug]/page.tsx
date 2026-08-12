import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getRentalPackageById,
  getRelatedRentals,
} from "@/lib/data/rentals";
import { getContactSettings } from "@/lib/data/settings";
import { slugify } from "@/lib/slug";
import { isLocale, rentalHref } from "@/lib/i18n/routing";
import { dictionaries, type Lang } from "@/lib/i18n/dictionaries";
import { pick } from "@/lib/utils";
import { RentalDetail } from "@/components/site/rental-detail";
import { RentalCard } from "@/components/site/rental-card";
import { ViewTracker } from "@/components/site/view-tracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const l: Lang = isLocale(lang) ? lang : "ro";
  const pkg = await getRentalPackageById(Number(id));
  if (!pkg) return { title: "Lampino" };
  const title = pick(l, pkg.title_ro, pkg.title_ru);
  const description = pick(l, pkg.description_ro, pkg.description_ru);
  return {
    title: `${title} — Lampino`,
    description: `${title} — ${pick(l, "De la", "От")} ${pkg.price} lei. ${description}`,
  };
}

export default async function RentalPackagePage({
  params,
}: {
  params: Promise<{ lang: string; id: string; slug: string }>;
}) {
  const { lang, id, slug } = await params;
  if (!isLocale(lang)) notFound();

  const pkg = await getRentalPackageById(Number(id));
  if (!pkg) notFound();

  // Redirect to the canonical title slug — the id is the source of truth.
  const canonical = slugify(pkg.title_ro) || "pachet";
  if (slug !== canonical) redirect(rentalHref(lang, pkg.id, pkg.title_ro));

  const [contact, related] = await Promise.all([
    getContactSettings(),
    getRelatedRentals(pkg, 3),
  ]);

  const d = dictionaries[lang].rental;

  return (
    <>
      <ViewTracker kind="rental" id={pkg.id} />
      <RentalDetail pkg={pkg} contact={contact} />

      {related.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">
          <div className="border-t border-border pt-14">
            <div className="label-mono text-primary">{d.relatedKicker}</div>
            <h2 className="font-display mt-3 text-[clamp(1.75rem,4vw,2.75rem)] font-light tracking-[-0.02em]">
              {d.relatedTitle}
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r, i) => (
                <RentalCard key={r.id} pkg={r} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
