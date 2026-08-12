import { notFound } from "next/navigation";
import { getSpecialOffers } from "@/lib/data/offers";
import { OffersContent } from "@/components/site/offers-content";
import { isLocale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

export default async function SpecialOffersPage({
  params,
}: PageProps<"/[lang]/oferte-speciale">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // The page only exists while the admin has it published.
  const offers = await getSpecialOffers();
  if (!offers) notFound();

  return <OffersContent offers={offers} />;
}
