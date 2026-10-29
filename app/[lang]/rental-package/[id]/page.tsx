import { notFound, permanentRedirect } from "next/navigation";
import { getRentalPackageById, isRetiredRental } from "@/lib/data/rentals";
import { isLocale, rentalHref, rentalsHref } from "@/lib/i18n/routing";
import { parseId } from "@/lib/utils";
import { DELETED_RENTALS } from "@/lib/legacy-redirects";

export const dynamic = "force-dynamic";

// Catches legacy lampino-md links (`/rental-package/<id>`, no slug segment) from
// before the cutover and moves them permanently to `/rental-package/<id>/<slug>`.
export default async function RentalPackageIdOnlyPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const pkg = await getRentalPackageById(parseId(id) ?? 0);
  if (pkg) permanentRedirect(rentalHref(lang, pkg));
  const numericId = parseId(id) ?? 0;
  if (DELETED_RENTALS[numericId] || (await isRetiredRental(numericId))) {
    permanentRedirect(rentalsHref(lang));
  }
  notFound();
}
