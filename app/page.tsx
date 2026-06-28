import { cars } from "@/lib/data/cars";
import { fleetStartingPrice } from "@/lib/pricing";
import { Hero } from "@/components/site/hero";
// import { HowItWorks } from "@/components/site/how-it-works";
import { StatsBand } from "@/components/site/stats-band";
import { FeaturedCars } from "@/components/site/featured-cars";
// import { WhyUs } from "@/components/site/why-us";
import { BrandMarquee } from "@/components/site/brand-marquee";
import { Faq } from "@/components/site/faq";
import { CtaBand } from "@/components/site/cta-band";

export default function Home() {
  const startingPrice = fleetStartingPrice(cars);

  return (
    <>
      <Hero startingPrice={startingPrice} />
      {/* <HowItWorks /> */}
      <StatsBand />
      <FeaturedCars />
      {/* <WhyUs /> */}
      <BrandMarquee />
      <Faq />
      <CtaBand />
    </>
  );
}
