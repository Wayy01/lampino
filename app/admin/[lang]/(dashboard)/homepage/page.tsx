import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/session";
import { getAdminDict, type AdminLang } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";
import { pick } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import {
  HeroForm,
  HomepageSettingsForm,
  BannerForm,
  type HeroData,
  type HomepageData,
  type BannerData,
} from "@/components/admin/homepage-forms";

export default async function AdminHomepagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang: AdminLang = isLocale(rawLang) ? rawLang : "ro";
  await requireAdmin(lang);
  const t = getAdminDict(lang);

  const [hero, settings, banner, categories] = await Promise.all([
    prisma.heroContent.findFirst({ orderBy: { id: "asc" } }),
    prisma.homepageSettings.findFirst({ orderBy: { id: "asc" } }),
    prisma.promoBanner.findFirst({ orderBy: { id: "asc" } }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
  ]);

  const heroData: HeroData | null = hero && {
    leftHeading_ro: hero.leftHeading_ro,
    leftHeading_ru: hero.leftHeading_ru,
    leftButtonText_ro: hero.leftButtonText_ro,
    leftButtonText_ru: hero.leftButtonText_ru,
    leftButtonUrl: hero.leftButtonUrl,
    leftImageUrl: hero.leftImageUrl,
    rightImageUrl: hero.rightImageUrl,
    leftMediaUrl: hero.leftMediaUrl,
    leftMediaType: hero.leftMediaType,
    rightMediaUrl: hero.rightMediaUrl,
    rightMediaType: hero.rightMediaType,
    isActive: hero.isActive,
  };

  const settingsData: HomepageData | null = settings && {
    featuredCategoryIds: (settings.featuredCategoryIds as number[]) ?? [],
    maxCategories: settings.maxCategories,
    featuredProductsCategoryId: settings.featuredProductsCategoryId,
    featuredRentalsCategoryId: settings.featuredRentalsCategoryId,
    isActive: settings.isActive,
    welcomeHeading_ro: settings.welcomeHeading_ro,
    welcomeHeading_ru: settings.welcomeHeading_ru,
    welcomeDescription_ro: settings.welcomeDescription_ro,
    welcomeDescription_ru: settings.welcomeDescription_ru,
    welcomeButtonText_ro: settings.welcomeButtonText_ro,
    welcomeButtonText_ru: settings.welcomeButtonText_ru,
    welcomeButtonUrl: settings.welcomeButtonUrl,
    categoryHeading_ro: settings.categoryHeading_ro,
    categoryHeading_ru: settings.categoryHeading_ru,
    productHeading_ro: settings.productHeading_ro,
    productHeading_ru: settings.productHeading_ru,
    rentalHeading_ro: settings.rentalHeading_ro,
    rentalHeading_ru: settings.rentalHeading_ru,
  };

  const bannerData: BannerData | null = banner && {
    message_ro: banner.message_ro,
    message_ru: banner.message_ru,
    ctaText_ro: banner.ctaText_ro,
    ctaText_ru: banner.ctaText_ru,
    ctaLink: banner.ctaLink,
    isActive: banner.isActive,
    showOnDesktop: banner.showOnDesktop,
    showOnMobile: banner.showOnMobile,
    backgroundColor: banner.backgroundColor,
    textColor: banner.textColor,
  };

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: pick(lang, c.name_ro, c.name_ru),
  }));

  return (
    <>
      <PageHeader title={t.homepage.title} />
      <div className="flex flex-col gap-4">
        <HeroForm hero={heroData} />
        <HomepageSettingsForm
          settings={settingsData}
          categories={categoryOptions}
        />
        <BannerForm banner={bannerData} />
      </div>
    </>
  );
}
