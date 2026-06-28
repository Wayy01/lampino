import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cars, getCarBySlug } from "@/lib/data/cars";
import { getCarPricing } from "@/lib/pricing";
import { CarDetail } from "@/components/site/car-detail";

export function generateStaticParams() {
  return cars.map((car) => ({ slug: car.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const car = getCarBySlug(slug);
  if (!car) return { title: "Atelier" };
  const pricing = getCarPricing(car);
  return {
    title: `${car.name} — Atelier`,
    description: `${car.name} from €${pricing.fromPrice}/day. ${car.description.en}`,
  };
}

export default async function CarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const car = getCarBySlug(slug);
  if (!car) notFound();
  return <CarDetail car={car} />;
}
