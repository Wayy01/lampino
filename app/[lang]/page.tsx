import { HeroVideo } from "@/components/site/hero-video";
import { FeaturedCategories } from "@/components/site/featured-categories";
import { FeaturedProducts } from "@/components/site/featured-products";
import { Faq } from "@/components/site/faq";
import { getHeroMedia } from "@/lib/data/settings";
import { getFeaturedProducts } from "@/lib/data/products";
import { getFeaturedCategories } from "@/lib/data/categories";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [hero, categories, featured] = await Promise.all([
    getHeroMedia(),
    getFeaturedCategories(),
    getFeaturedProducts(9),
  ]);

  return (
    <>
      <HeroVideo videoUrl={hero.videoUrl} posterUrl={hero.posterUrl} />
      <FeaturedCategories categories={categories} />
      <FeaturedProducts products={featured} />
      <Faq />
    </>
  );
}
