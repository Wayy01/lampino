import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { num } from "@/lib/admin/serialize";
import { PageHeader } from "@/components/admin/page-header";
import {
  ContactForm,
  DeliveryForm,
  ThemeForm,
  SpecialOffersForm,
  type ContactData,
  type DeliveryData,
  type ThemeData,
  type SpecialOffersData,
} from "@/components/admin/settings-forms";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const offers = await prisma.specialOffersPage.findFirst({
    orderBy: { id: "asc" },
  });

  // Already-selected rows must stay in the picker even after they're
  // deactivated — an option that isn't rendered posts nothing, and the save
  // would drop it from the selection without saying so.
  const selectedIds = (json: unknown): number[] =>
    Array.isArray(json) ? json.filter((n): n is number => typeof n === "number") : [];

  const label = (name: string, isActive: boolean) =>
    isActive ? name : `${name} (${t.statuses.inactive.toLowerCase()})`;

  const [contact, delivery, theme, categories, products, rentals] =
    await Promise.all([
      prisma.contactSettings.findFirst({ orderBy: { id: "asc" } }),
      prisma.deliverySettings.findFirst({ orderBy: { id: "asc" } }),
      prisma.themeSettings.findFirst({ orderBy: { id: "asc" } }),
      prisma.category.findMany({ orderBy: { position: "asc" } }),
      prisma.product.findMany({
        where: {
          OR: [
            { isActive: true },
            { id: { in: selectedIds(offers?.selectedProductIds) } },
          ],
        },
        orderBy: { name_ro: "asc" },
        select: { id: true, name_ro: true, name_ru: true, isActive: true },
      }),
      prisma.rentalPackage.findMany({
        where: {
          OR: [
            { isActive: true },
            { id: { in: selectedIds(offers?.selectedRentalPackageIds) } },
          ],
        },
        orderBy: { title_ro: "asc" },
        select: { id: true, title_ro: true, title_ru: true, isActive: true },
      }),
    ]);

  const contactData: ContactData | null = contact && {
    phone: contact.phone,
    email: contact.email,
    whatsapp: contact.whatsapp,
    address_ro: contact.address_ro,
    address_ru: contact.address_ru,
    city_ro: contact.city_ro,
    city_ru: contact.city_ru,
    country_ro: contact.country_ro,
    country_ru: contact.country_ru,
    businessHours_ro: contact.businessHours_ro,
    businessHours_ru: contact.businessHours_ru,
    facebookUrl: contact.facebookUrl,
    instagramUrl: contact.instagramUrl,
    tiktokUrl: contact.tiktokUrl,
    isActive: contact.isActive,
  };

  const deliveryData: DeliveryData | null = delivery && {
    freeDeliveryThreshold: num(delivery.freeDeliveryThreshold),
    deliveryCostChisinau: num(delivery.deliveryCostChisinau),
    deliveryCostOutside: num(delivery.deliveryCostOutside),
    isActive: delivery.isActive,
  };

  const themeData: ThemeData | null = theme && {
    colorPrimary: theme.colorPrimary,
    colorSecondary: theme.colorSecondary,
    colorTertiary: theme.colorTertiary,
    colorAccent: theme.colorAccent,
    colorSuccess: theme.colorSuccess,
    colorWarning: theme.colorWarning,
    colorError: theme.colorError,
    colorInfo: theme.colorInfo,
    isActive: theme.isActive,
  };

  const offersData: SpecialOffersData | null = offers && {
    title_ro: offers.title_ro,
    title_ru: offers.title_ru,
    description_ro: offers.description_ro,
    description_ru: offers.description_ru,
    mediaUrl: offers.mediaUrl,
    mediaType: offers.mediaType,
    selectionMethod: offers.selectionMethod,
    selectedProductIds: (offers.selectedProductIds as number[]) ?? [],
    selectedRentalPackageIds:
      (offers.selectedRentalPackageIds as number[]) ?? [],
    filterByCategoryId: offers.filterByCategoryId,
    isActive: offers.isActive,
  };

  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="flex flex-col gap-4">
        <ContactForm contact={contactData} />
        <DeliveryForm delivery={deliveryData} />
        <ThemeForm theme={themeData} />
        <SpecialOffersForm
          offers={offersData}
          categories={categories.map((c) => ({
            id: c.id,
            name: pick(lang, c.name_ro, c.name_ru),
          }))}
          products={products.map((p) => ({
            id: p.id,
            name: label(pick(lang, p.name_ro, p.name_ru), p.isActive),
          }))}
          rentals={rentals.map((r) => ({
            id: r.id,
            name: label(pick(lang, r.title_ro, r.title_ru), r.isActive),
          }))}
        />
      </div>
    </>
  );
}
