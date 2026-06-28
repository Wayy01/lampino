"use client";

const BRANDS = [
  "Mercedes-Benz",
  "Porsche",
  "BMW",
  "Audi",
  "Tesla",
  "Ferrari",
  "Bentley",
  "Maserati",
  "Land Rover",
];

export function BrandMarquee() {
  const row = [...BRANDS, ...BRANDS];
  return (
    <section className="overflow-hidden border-b border-border py-10">
      <div className="relative flex">
        <div className="flex shrink-0 animate-marquee items-center gap-16 pr-16">
          {row.map((brand, i) => (
            <span
              key={i}
              className="font-display whitespace-nowrap text-2xl font-light tracking-tight text-foreground/35 md:text-3xl"
            >
              {brand}
            </span>
          ))}
        </div>
        <div
          className="flex shrink-0 animate-marquee items-center gap-16 pr-16"
          aria-hidden
        >
          {row.map((brand, i) => (
            <span
              key={i}
              className="font-display whitespace-nowrap text-2xl font-light tracking-tight text-foreground/35 md:text-3xl"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
