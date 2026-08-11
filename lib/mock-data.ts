// Static catalog data shaped like the Prisma view models in lib/types.ts.
// The lib/data/* layer returns these same shapes today from this mock data and
// will return them from real `prisma.*` queries later — so pages/components
// never change. Prices are plain numbers (not Decimal) and relations are
// pre-included, exactly as the serialized query results will be.
import type { Category, Product } from "./types";

// The mock catalog keeps the *legacy flat* spec shape (`{ [key]: "value" }`) —
// it exists solely to seed the database (prisma/seed.ts upgrades these to the
// bilingual shape on the way in). The live app reads from Prisma, not here.
type MockProduct = Omit<Product, "specifications"> & {
  specifications: Record<string, string>;
};

const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const categories: Category[] = [
  {
    id: 1,
    name_ro: "Becuri LED",
    name_ru: "LED-лампы",
    slug: "led",
    position: 0,
    imageUrl: null,
  },
  {
    id: 2,
    name_ro: "Becuri smart",
    name_ru: "Умные лампы",
    slug: "smart",
    position: 1,
    imageUrl: null,
  },
  {
    id: 3,
    name_ro: "Lumini de Crăciun",
    name_ru: "Новогодние гирлянды",
    slug: "christmas",
    position: 2,
    imageUrl: null,
  },
  {
    id: 4,
    name_ro: "Vintage / filament",
    name_ru: "Винтажные / филамент",
    slug: "vintage",
    position: 3,
    imageUrl: null,
  },
  {
    id: 5,
    name_ro: "Benzi LED",
    name_ru: "LED-ленты",
    slug: "strip",
    position: 4,
    imageUrl: null,
  },
  {
    id: 6,
    name_ro: "Iluminat exterior",
    name_ru: "Уличное освещение",
    slug: "outdoor",
    position: 5,
    imageUrl: null,
  },
  {
    id: 7,
    name_ro: "Plafoniere",
    name_ru: "Потолочные",
    slug: "ceiling",
    position: 6,
    imageUrl: null,
  },
  {
    id: 8,
    name_ro: "Suspendate",
    name_ru: "Подвесные",
    slug: "pendant",
    position: 7,
    imageUrl: null,
  },
  {
    id: 9,
    name_ro: "Veioze",
    name_ru: "Настольные лампы",
    slug: "table",
    position: 8,
    imageUrl: null,
  },
  {
    id: 10,
    name_ro: "Lampadare",
    name_ru: "Торшеры",
    slug: "floor",
    position: 9,
    imageUrl: null,
  },
  {
    id: 11,
    name_ro: "Spoturi",
    name_ru: "Споты",
    slug: "spot",
    position: 10,
    imageUrl: null,
  },
  {
    id: 12,
    name_ro: "Accesorii",
    name_ru: "Аксессуары",
    slug: "accessories",
    position: 11,
    imageUrl: null,
  },
];

const bySlug = (slug: string): Category =>
  categories.find((c) => c.slug === slug)!;

type SeedVariant = {
  name_ro: string;
  name_ru: string;
  size?: string | null;
  price: number;
  stock: number;
  isDefault?: boolean;
};

type SeedVideo = { videoUrl: string; thumbnailUrl?: string | null };

type Seed = {
  id: number;
  name_ro: string;
  name_ru: string;
  categorySlug: string;
  images: string[];
  videos?: SeedVideo[];
  variants?: SeedVariant[];
  specifications: Record<string, string>;
  price: number;
  featured?: number; // featuredOrder when set
  description_ro: string;
  description_ru: string;
};

const seeds: Seed[] = [
  {
    id: 1,
    name_ro: "Bec LED Aura E27",
    name_ru: "LED-лампа Aura E27",
    categorySlug: "led",
    images: [
      img("1550985616-10810253b84d"),
      img("1513506003901-1e6a229e2d15"),
      img("1524678606370-a47ad25cb82a"),
    ],
    specifications: {
      wattage: "9",
      lumens: "806",
      colorTemp: "2700K",
      base: "E27",
      lifespan: "25000",
      energyClass: "A+",
    },
    price: 79,
    featured: 0,
    description_ro:
      "Lumina caldă de fiecare zi. Un alb blând de 2700K care face orice cameră să pară primitoare, cu un consum minim și 25.000 de ore de folosință.",
    description_ru:
      "Тёплый свет на каждый день. Мягкий белый оттенок 2700K делает любую комнату уютной при минимальном потреблении и ресурсе 25 000 часов.",
  },
  {
    id: 2,
    name_ro: "Bec Smart RGB Lumia",
    name_ru: "Умная RGB-лампа Lumia",
    categorySlug: "smart",
    images: [
      img("1524634126442-357e0eac3c14"),
      img("1519710164239-da123dc03ef4"),
      img("1516156008625-3a9d6067fab5"),
    ],
    videos: [
      {
        videoUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        thumbnailUrl: img("1524634126442-357e0eac3c14", 600),
      },
    ],
    variants: [
      { name_ro: "1 bec", name_ru: "1 лампа", price: 349, stock: 8, isDefault: true },
      { name_ro: "Set 3 becuri", name_ru: "Набор 3 лампы", price: 949, stock: 5 },
      { name_ro: "Set 5 becuri", name_ru: "Набор 5 ламп", price: 1499, stock: 0 },
    ],
    specifications: {
      wattage: "9",
      lumens: "806",
      colorTemp: "2700–6500K",
      base: "E27",
      lifespan: "25000",
      energyClass: "A",
    },
    price: 349,
    featured: 1,
    description_ro:
      "16 milioane de culori, controlate din telefon sau prin voce. Setează scene, programează dimineți blânde și treci de la alb cald la alb rece dintr-o atingere.",
    description_ru:
      "16 миллионов цветов под управлением со смартфона или голосом. Создавайте сцены, настраивайте мягкие пробуждения и переключайтесь между тёплым и холодным белым одним касанием.",
  },
  {
    id: 3,
    name_ro: "Ghirlandă Stelara 10m",
    name_ru: "Гирлянда Stelara 10м",
    categorySlug: "christmas",
    images: [
      img("1493666438817-866a91353ca9"),
      img("1608501078713-8e445a709b39"),
      img("1607923432780-7a9c30adcb72"),
    ],
    specifications: {
      wattage: "4",
      lumens: "400",
      colorTemp: "3000K",
      base: "—",
      lifespan: "20000",
      energyClass: "A",
    },
    price: 299,
    featured: 2,
    description_ro:
      "Zece metri de lumină caldă cu 100 de LED-uri și opt moduri de iluminare. Rezistentă la stropi, perfectă pentru brad, fereastră sau terasă.",
    description_ru:
      "Десять метров тёплого света: 100 светодиодов и восемь режимов свечения. Брызгозащищённая — идеальна для ёлки, окна или террасы.",
  },
  {
    id: 4,
    name_ro: "Bec Edison Filament ST64",
    name_ru: "Филаментная лампа Edison ST64",
    categorySlug: "vintage",
    images: [
      img("1543872084-c7bd3822856f"),
      img("1517991104123-1d56a6e81ed9"),
      img("1481277542470-605612bd2d61"),
    ],
    specifications: {
      wattage: "6",
      lumens: "550",
      colorTemp: "2200K",
      base: "E27",
      lifespan: "15000",
      energyClass: "A",
    },
    price: 129,
    featured: 3,
    description_ro:
      "Filament vizibil în chihlimbar cald, în silueta clasică ST64. Nostalgia becului cu incandescență, cu eficiența LED-ului de azi.",
    description_ru:
      "Видимая нить накала в тёплом янтарном свете и классический силуэт ST64. Ностальгия лампы накаливания с эффективностью современного LED.",
  },
  {
    id: 5,
    name_ro: "Bandă LED RGB 5m",
    name_ru: "LED-лента RGB 5м",
    categorySlug: "strip",
    images: [
      img("1558882224-dda166733046"),
      img("1606946184955-a8cb11e66336"),
      img("1601931935821-5fbe71157695"),
    ],
    specifications: {
      wattage: "24",
      lumens: "1200",
      colorTemp: "RGB",
      base: "—",
      lifespan: "30000",
      energyClass: "A+",
    },
    price: 219,
    description_ro:
      "Cinci metri autoadezivi cu telecomandă și milioane de culori. Se taie la lungimea dorită pentru rafturi, birou sau gaming.",
    description_ru:
      "Пять метров на самоклеящейся основе с пультом и миллионами оттенков. Режется по нужной длине для полок, стола или гейминга.",
  },
  {
    id: 6,
    name_ro: "Șirag Festoon Exterior 15m",
    name_ru: "Гирлянда Festoon для улицы 15м",
    categorySlug: "outdoor",
    images: [
      img("1573148195900-7845dcb9b127"),
      img("1513694203232-719a280e022f"),
      img("1526318472351-c75fcf070305"),
    ],
    specifications: {
      wattage: "15",
      lumens: "900",
      colorTemp: "2700K",
      base: "E27",
      lifespan: "20000",
      energyClass: "A",
    },
    price: 459,
    description_ro:
      "Cincisprezece metri cu becuri rezistente la intemperii (IP65) pentru grădină, terasă sau curte. Lumină caldă care transformă serile de vară.",
    description_ru:
      "Пятнадцать метров с погодостойкими лампами (IP65) для сада, террасы или двора. Тёплый свет, преображающий летние вечера.",
  },
  {
    id: 7,
    name_ro: "Spot Smart GU10 Nova",
    name_ru: "Умный спот GU10 Nova",
    categorySlug: "smart",
    images: [
      img("1519710164239-da123dc03ef4"),
      img("1516156008625-3a9d6067fab5"),
      img("1524634126442-357e0eac3c14"),
    ],
    specifications: {
      wattage: "5",
      lumens: "400",
      colorTemp: "2700–6500K",
      base: "GU10",
      lifespan: "25000",
      energyClass: "A",
    },
    price: 259,
    description_ro:
      "Spot inteligent pentru tavan și șine, cu alb reglabil și culori. Perfect pentru accente în bucătărie sau living, controlat din aplicație.",
    description_ru:
      "Умный спот для потолка и шинных систем с регулируемым белым и цветами. Идеален для акцентов на кухне или в гостиной, управление из приложения.",
  },
  {
    id: 8,
    name_ro: "Panou LED Plafon 24W",
    name_ru: "LED-панель потолочная 24Вт",
    categorySlug: "led",
    images: [
      img("1467269204594-9661b134dd2b"),
      img("1502005229762-cf1b2da7c5d6"),
      img("1550985616-10810253b84d"),
    ],
    specifications: {
      wattage: "24",
      lumens: "2400",
      colorTemp: "4000K",
      base: "—",
      lifespan: "30000",
      energyClass: "A+",
    },
    price: 549,
    description_ro:
      "Panou slim cu lumină uniformă, fără pâlpâire, pentru bucătărie, baie sau birou. Alb neutru de 4000K, clar și odihnitor pentru ochi.",
    description_ru:
      "Тонкая панель с равномерным светом без мерцания для кухни, ванной или офиса. Нейтральный белый 4000K — чёткий и комфортный для глаз.",
  },
  {
    id: 9,
    name_ro: "Perdea Luminoasă 3m",
    name_ru: "Световая штора 3м",
    categorySlug: "christmas",
    images: [
      img("1607923432780-7a9c30adcb72"),
      img("1493666438817-866a91353ca9"),
      img("1608501078713-8e445a709b39"),
    ],
    specifications: {
      wattage: "8",
      lumens: "600",
      colorTemp: "3000K",
      base: "—",
      lifespan: "20000",
      energyClass: "A",
    },
    price: 389,
    description_ro:
      "Perdea de lumini de 3×3 metri cu 300 de LED-uri, ideală pentru ferestre și fundaluri festive. Opt moduri și cronometru integrat.",
    description_ru:
      "Световая штора 3×3 метра с 300 светодиодами — идеальна для окон и праздничного фона. Восемь режимов и встроенный таймер.",
  },
  {
    id: 10,
    name_ro: "Glob Filament G95 Ambra",
    name_ru: "Филаментный шар G95 Ambra",
    categorySlug: "vintage",
    images: [
      img("1517991104123-1d56a6e81ed9"),
      img("1543872084-c7bd3822856f"),
      img("1481277542470-605612bd2d61"),
    ],
    specifications: {
      wattage: "8",
      lumens: "640",
      colorTemp: "2200K",
      base: "E27",
      lifespan: "15000",
      energyClass: "A",
    },
    price: 159,
    description_ro:
      "Un glob mare de sticlă chihlimbarie cu filament decorativ, gândit să fie văzut. Superb suspendat singur deasupra mesei.",
    description_ru:
      "Крупный шар из янтарного стекла с декоративной нитью, созданный, чтобы быть на виду. Великолепен подвешенным в одиночку над столом.",
  },
  {
    id: 11,
    name_ro: "Lampă Solară Alee (set 4)",
    name_ru: "Солнечный светильник для дорожек (набор 4)",
    categorySlug: "outdoor",
    images: [
      img("1513694203232-719a280e022f"),
      img("1573148195900-7845dcb9b127"),
      img("1526318472351-c75fcf070305"),
    ],
    specifications: {
      wattage: "2",
      lumens: "120",
      colorTemp: "3000K",
      base: "—",
      lifespan: "15000",
      energyClass: "A",
    },
    price: 399,
    description_ro:
      "Set de patru lămpi solare cu senzor de întuneric, fără cabluri și fără cost la curent. Se încarcă ziua și luminează aleea toată noaptea.",
    description_ru:
      "Набор из четырёх солнечных светильников с датчиком темноты — без проводов и без счетов за электричество. Заряжаются днём и освещают дорожку всю ночь.",
  },
  {
    id: 12,
    name_ro: "Bandă LED Alb Cald 10m",
    name_ru: "LED-лента тёплый белый 10м",
    categorySlug: "strip",
    images: [
      img("1606946184955-a8cb11e66336"),
      img("1558882224-dda166733046"),
      img("1601931935821-5fbe71157695"),
    ],
    specifications: {
      wattage: "40",
      lumens: "2000",
      colorTemp: "2700K",
      base: "—",
      lifespan: "30000",
      energyClass: "A+",
    },
    price: 349,
    description_ro:
      "Zece metri de lumină caldă continuă pentru iluminat ascuns sub dulapuri, trepte sau tavane. Adeziv puternic și alimentator inclus.",
    description_ru:
      "Десять метров непрерывного тёплого света для скрытой подсветки под шкафами, ступенями или потолками. Прочный клей и блок питания в комплекте.",
  },
];

export const products: MockProduct[] = seeds.map((s) => {
  const category = bySlug(s.categorySlug);
  return {
    id: s.id,
    name_ro: s.name_ro,
    name_ru: s.name_ru,
    description_ro: s.description_ro,
    description_ru: s.description_ru,
    price: s.price,
    reducedPrice: null,
    stock: 2,
    hasVariants: (s.variants?.length ?? 0) > 0,
    specifications: s.specifications,
    categoryId: category.id,
    category,
    featured: s.featured !== undefined,
    featuredOrder: s.featured ?? 0,
    isActive: true,
    images: s.images.map((imageUrl, i) => ({
      id: s.id * 100 + i,
      imageUrl,
      isMain: i === 0,
    })),
    videos: (s.videos ?? []).map((v, i) => ({
      id: s.id * 1000 + i,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl ?? null,
    })),
    variants: (s.variants ?? []).map((v, i) => ({
      id: s.id * 10 + i,
      name_ro: v.name_ro,
      name_ru: v.name_ru,
      size: v.size ?? null,
      price: v.price,
      reducedPrice: null,
      stock: v.stock,
      isDefault: v.isDefault ?? i === 0,
      sortOrder: i,
    })),
  };
});
