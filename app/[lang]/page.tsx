import { notFound } from "next/navigation";
import { Hero } from "@/components/site/hero";
import { FeaturedCategories } from "@/components/site/featured-categories";
import { FeaturedProducts } from "@/components/site/featured-products";
import { FeaturedRentals } from "@/components/site/featured-rentals";
import { Faq } from "@/components/site/faq";
import { getHeroMedia, getHomepageSettings } from "@/lib/data/settings";
import { getFeaturedProducts } from "@/lib/data/products";
import { getFeaturedCategories } from "@/lib/data/categories";
import { getFeaturedRentals } from "@/lib/data/rentals";
import { isLocale } from "@/lib/i18n/routing";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { JsonLd } from "@/components/site/json-ld";
import { faqSchema } from "@/lib/schema";
import { pick } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const [hero, categories, featured, settings, rentals] = await Promise.all([
    getHeroMedia(),
    getFeaturedCategories(),
    getFeaturedProducts(9),
    getHomepageSettings(),
    getFeaturedRentals(3),
  ]);

  const categoryHeading = settings
    ? pick(lang, settings.categoryHeading_ro, settings.categoryHeading_ru)
    : "";
  const productHeading = settings
    ? pick(lang, settings.productHeading_ro, settings.productHeading_ru)
    : "";
  const rentalHeading = settings
    ? pick(lang, settings.rentalHeading_ro, settings.rentalHeading_ru)
    : "";

  return (
    <>
      {/* The homepage FAQ is the site's one shot at an FAQ rich result. */}
      <JsonLd data={faqSchema(dictionaries[lang].faq.items)} />
      <Hero
        buttonText_ro={hero.buttonText_ro}
        buttonText_ru={hero.buttonText_ru}
        buttonUrl={hero.buttonUrl}
      />
      <FeaturedProducts products={featured} heading={productHeading} />
      <FeaturedCategories categories={categories} heading={categoryHeading} />
      <FeaturedRentals packages={rentals} heading={rentalHeading} />
      <Faq />
    </>
  );
}
