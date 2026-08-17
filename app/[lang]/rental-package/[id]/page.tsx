import { notFound, redirect } from "next/navigation";
import { getRentalPackageById } from "@/lib/data/rentals";
import { isLocale, rentalHref } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

// Catches legacy lampino-md links (`/rental-package/<id>`, no slug segment)
// from before the cutover and sends them to the canonical `/rental-package/<id>/<slug>`.
export default async function RentalPackageIdOnlyPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const pkg = await getRentalPackageById(Number(id));
  if (!pkg) notFound();

  redirect(rentalHref(lang, pkg.id, pkg.title_ro));
}
