import { HeroVideo } from "@/components/site/hero-video";
import { FeaturedProducts } from "@/components/site/featured-products";
import { Faq } from "@/components/site/faq";
import { getHeroVideoUrl } from "@/lib/data/settings";

export default async function Home() {
  const heroVideoUrl = await getHeroVideoUrl();
  return (
    <>
      <HeroVideo videoUrl={heroVideoUrl} />
      <FeaturedProducts />
      <Faq />
    </>
  );
}
