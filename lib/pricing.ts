import type { Car, Partner } from "@/lib/data/cars";

export type CarPricing = {
  fromPrice: number; // lowest partner price / day
  isFrom: boolean; // true when 2+ partners compete on this car
  partnerCount: number;
  partners: Partner[]; // sorted ascending by price (best first)
};

export function getCarPricing(car: Car): CarPricing {
  const partners = [...car.partners].sort(
    (a, b) => a.pricePerDay - b.pricePerDay,
  );
  return {
    fromPrice: partners[0]?.pricePerDay ?? 0,
    isFrom: partners.length >= 2,
    partnerCount: partners.length,
    partners,
  };
}

/** Lowest entry price across the whole fleet — used for hero copy. */
export function fleetStartingPrice(cars: Car[]): number {
  return cars.reduce(
    (min, c) => Math.min(min, getCarPricing(c).fromPrice),
    Infinity,
  );
}
