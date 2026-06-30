export type CarCategory =
  | "luxury"
  | "suv"
  | "sport"
  | "sedan"
  | "convertible"
  | "electric";

export type Partner = {
  id: string;
  name: string;
  pricePerDay: number; // EUR / day
};

export type Car = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CarCategory;
  images: string[];
  year: number;
  seats: number;
  doors: number;
  transmission: "automatic" | "manual";
  fuel: "petrol" | "diesel" | "electric" | "hybrid";
  power: number; // hp
  description: { en: string; it: string };
  partners: Partner[];
};

const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const cars: Car[] = [
  {
    id: "1",
    slug: "mercedes-benz-classe-s",
    name: "Mercedes-Benz Classe S",
    brand: "Mercedes-Benz",
    category: "luxury",
    images: [
      img("1605559424843-9e4c228bf1c2"),
      img("1618843479313-40f8afb4b4d8"),
      img("1563720223185-11003d516935"),
    ],
    year: 2024,
    seats: 5,
    doors: 4,
    transmission: "automatic",
    fuel: "hybrid",
    power: 503,
    description: {
      en: "The benchmark of the executive class. Chauffeur-grade comfort, whisper-quiet cabin and effortless presence for arrivals that matter.",
      it: "Il riferimento della classe executive. Comfort da chauffeur, abitacolo silenzioso e presenza assoluta per arrivi che contano.",
    },
    partners: [
      { id: "sixt", name: "Sixt", pricePerDay: 540 },
      { id: "hertz", name: "Hertz", pricePerDay: 575 },
      { id: "leasys", name: "Leasys", pricePerDay: 599 },
    ],
  },
  {
    id: "2",
    slug: "porsche-911-carrera",
    name: "Porsche 911 Carrera",
    brand: "Porsche",
    category: "sport",
    images: [
      img("1503376780353-7e6692767b70"),
      img("1611821064430-0d40291d0f0b"),
      img("1614162692292-7ac56d7f7f1e"),
    ],
    year: 2023,
    seats: 2,
    doors: 2,
    transmission: "automatic",
    fuel: "petrol",
    power: 385,
    description: {
      en: "Six decades of obsession in one silhouette. Rear-engine balance, surgical steering and a soundtrack you feel in your chest.",
      it: "Sei decenni di ossessione in una sola silhouette. Bilanciamento posteriore, sterzo chirurgico e un sound che senti nel petto.",
    },
    partners: [
      { id: "sixt", name: "Sixt", pricePerDay: 720 },
      { id: "luxedrive", name: "LuxeDrive", pricePerDay: 760 },
    ],
  },
  {
    id: "3",
    slug: "range-rover-autobiography",
    name: "Range Rover Autobiography",
    brand: "Land Rover",
    category: "suv",
    images: [
      img("1549399542-7e3f8b79c341"),
      img("1606016159991-8b5d5f0a2b3a"),
      img("1606220588913-b3aacb4d2f37"),
    ],
    year: 2024,
    seats: 5,
    doors: 5,
    transmission: "automatic",
    fuel: "diesel",
    power: 350,
    description: {
      en: "Commanding, serene and unstoppable. A first-class lounge that happens to cross any terrain without raising its voice.",
      it: "Imponente, serena e inarrestabile. Una lounge di prima classe che attraversa ogni terreno senza alzare la voce.",
    },
    partners: [
      { id: "europcar", name: "Europcar", pricePerDay: 610 },
      { id: "hertz", name: "Hertz", pricePerDay: 645 },
    ],
  },
  {
    id: "4",
    slug: "bmw-m4-competition",
    name: "BMW M4 Competition",
    brand: "BMW",
    category: "sport",
    images: [
      img("1555215695-3004980ad54e"),
      img("1552519507-da3b142c6e3d"),
      img("1617814076367-b759c7d7e738"),
    ],
    year: 2023,
    seats: 4,
    doors: 2,
    transmission: "automatic",
    fuel: "petrol",
    power: 510,
    description: {
      en: "A track weapon dressed for the city. Twin-turbo straight-six, razor reflexes and unmistakable presence.",
      it: "Un'arma da pista vestita per la città. Sei cilindri biturbo, riflessi affilati e una presenza inconfondibile.",
    },
    partners: [{ id: "sixt", name: "Sixt", pricePerDay: 560 }],
  },
  {
    id: "5",
    slug: "tesla-model-s-plaid",
    name: "Tesla Model S Plaid",
    brand: "Tesla",
    category: "electric",
    images: [
      img("1560958089-b8a1929cea89"),
      img("1617704548623-340376564e68"),
      img("1536700503339-1e4b06520771"),
    ],
    year: 2024,
    seats: 5,
    doors: 4,
    transmission: "automatic",
    fuel: "electric",
    power: 1020,
    description: {
      en: "Silent violence. Sub-two-second launches, a glass cabin and the longest range in its class. The future, already here.",
      it: "Violenza silenziosa. Scatti sotto i due secondi, abitacolo in vetro e la maggiore autonomia della categoria. Il futuro, già qui.",
    },
    partners: [
      { id: "leasys", name: "Leasys", pricePerDay: 500 },
      { id: "europcar", name: "Europcar", pricePerDay: 529 },
      { id: "sixt", name: "Sixt", pricePerDay: 545 },
    ],
  },
  {
    id: "6",
    slug: "audi-rs6-avant",
    name: "Audi RS6 Avant",
    brand: "Audi",
    category: "sport",
    images: [
      img("1511919884226-fd3cad34687c"),
      img("1606152421802-db97b9c7a11b"),
      img("1542362567-b07e54358753"),
    ],
    year: 2023,
    seats: 5,
    doors: 5,
    transmission: "automatic",
    fuel: "petrol",
    power: 600,
    description: {
      en: "The wagon that humbles supercars. Quattro grip, twin-turbo V8 and room for the whole weekend.",
      it: "La familiare che umilia le supercar. Trazione quattro, V8 biturbo e spazio per tutto il weekend.",
    },
    partners: [
      { id: "sixt", name: "Sixt", pricePerDay: 580 },
      { id: "hertz", name: "Hertz", pricePerDay: 615 },
    ],
  },
  {
    id: "7",
    slug: "mercedes-amg-gt-cabrio",
    name: "Mercedes-AMG GT Cabrio",
    brand: "Mercedes-AMG",
    category: "convertible",
    images: [
      img("1618843479313-40f8afb4b4d8"),
      img("1503376780353-7e6692767b70"),
      img("1605559424843-9e4c228bf1c2"),
    ],
    year: 2023,
    seats: 2,
    doors: 2,
    transmission: "automatic",
    fuel: "petrol",
    power: 530,
    description: {
      en: "Open-top theatre. Hand-built AMG V8, a folding roof and coastlines made for it.",
      it: "Teatro a cielo aperto. V8 AMG costruito a mano, capote ripiegabile e litorali fatti apposta.",
    },
    partners: [{ id: "luxedrive", name: "LuxeDrive", pricePerDay: 690 }],
  },
  {
    id: "8",
    slug: "bentley-continental-gt",
    name: "Bentley Continental GT",
    brand: "Bentley",
    category: "luxury",
    images: [
      img("1563720223185-11003d516935"),
      img("1614162692292-7ac56d7f7f1e"),
      img("1618843479313-40f8afb4b4d8"),
    ],
    year: 2024,
    seats: 4,
    doors: 2,
    transmission: "automatic",
    fuel: "petrol",
    power: 650,
    description: {
      en: "Grand touring without compromise. Hand-stitched leather, a velvet W12 and continents shrunk to an afternoon.",
      it: "Gran turismo senza compromessi. Pelle cucita a mano, un W12 vellutato e continenti ridotti a un pomeriggio.",
    },
    partners: [
      { id: "luxedrive", name: "LuxeDrive", pricePerDay: 980 },
      { id: "sixt", name: "Sixt", pricePerDay: 1040 },
    ],
  },
  {
    id: "9",
    slug: "porsche-cayenne-coupe",
    name: "Porsche Cayenne Coupé",
    brand: "Porsche",
    category: "suv",
    images: [
      img("1606016159991-8b5d5f0a2b3a"),
      img("1549399542-7e3f8b79c341"),
      img("1617814076367-b759c7d7e738"),
    ],
    year: 2024,
    seats: 5,
    doors: 5,
    transmission: "automatic",
    fuel: "hybrid",
    power: 470,
    description: {
      en: "A sports car that carries the family. Coupé lines, hybrid punch and Porsche poise in any season.",
      it: "Una sportiva che porta la famiglia. Linee coupé, spinta ibrida e l'equilibrio Porsche in ogni stagione.",
    },
    partners: [
      { id: "europcar", name: "Europcar", pricePerDay: 555 },
      { id: "hertz", name: "Hertz", pricePerDay: 580 },
    ],
  },
  {
    id: "10",
    slug: "maserati-quattroporte",
    name: "Maserati Quattroporte",
    brand: "Maserati",
    category: "sedan",
    images: [
      img("1606152421802-db97b9c7a11b"),
      img("1563720223185-11003d516935"),
      img("1605559424843-9e4c228bf1c2"),
    ],
    year: 2023,
    seats: 5,
    doors: 4,
    transmission: "automatic",
    fuel: "petrol",
    power: 430,
    description: {
      en: "An Italian aria on four doors. A Nettuno-bred soundtrack, tailored leather and unmistakable trident drama.",
      it: "Un'aria italiana su quattro porte. Un sound di scuola Nettuno, pelle sartoriale e l'inconfondibile teatralità del tridente.",
    },
    partners: [{ id: "luxedrive", name: "LuxeDrive", pricePerDay: 640 }],
  },
  {
    id: "11",
    slug: "tesla-model-x",
    name: "Tesla Model X",
    brand: "Tesla",
    category: "suv",
    images: [
      img("1617704548623-340376564e68"),
      img("1560958089-b8a1929cea89"),
      img("1536700503339-1e4b06520771"),
    ],
    year: 2024,
    seats: 7,
    doors: 5,
    transmission: "automatic",
    fuel: "electric",
    power: 670,
    description: {
      en: "Falcon doors, seven seats and ludicrous pace. The electric SUV that turns every school run into an event.",
      it: "Porte ad ali di falco, sette posti e accelerazione folle. Il SUV elettrico che trasforma ogni tragitto in un evento.",
    },
    partners: [
      { id: "leasys", name: "Leasys", pricePerDay: 520 },
      { id: "europcar", name: "Europcar", pricePerDay: 549 },
    ],
  },
  {
    id: "12",
    slug: "ferrari-roma",
    name: "Ferrari Roma",
    brand: "Ferrari",
    category: "convertible",
    images: [
      img("1614162692292-7ac56d7f7f1e"),
      img("1503376780353-7e6692767b70"),
      img("1611821064430-0d40291d0f0b"),
    ],
    year: 2024,
    seats: 2,
    doors: 2,
    transmission: "automatic",
    fuel: "petrol",
    power: 620,
    description: {
      en: "La nuova dolce vita. A front-mid V8, timeless GT proportions and Maranello's most elegant statement in years.",
      it: "La nuova dolce vita. V8 anteriore-centrale, proporzioni GT senza tempo e la dichiarazione più elegante di Maranello da anni.",
    },
    partners: [
      { id: "luxedrive", name: "LuxeDrive", pricePerDay: 1180 },
      { id: "sixt", name: "Sixt", pricePerDay: 1250 },
    ],
  },
];

export const categories: CarCategory[] = [
  "luxury",
  "suv",
  "sport",
  "sedan",
  "convertible",
  "electric",
];

export type City = { slug: string; name: string };

export const cities: City[] = [
  { slug: "milano", name: "Milano" },
  { slug: "roma", name: "Roma" },
  { slug: "firenze", name: "Firenze" },
  { slug: "venezia", name: "Venezia" },
  { slug: "torino", name: "Torino" },
  { slug: "napoli", name: "Napoli" },
  { slug: "bologna", name: "Bologna" },
  { slug: "genova", name: "Genova" },
  { slug: "verona", name: "Verona" },
  { slug: "bari", name: "Bari" },
  { slug: "palermo", name: "Palermo" },
  { slug: "catania", name: "Catania" },
  { slug: "como", name: "Como" },
  { slug: "rimini", name: "Rimini" },
];

export function getCarBySlug(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug);
}
