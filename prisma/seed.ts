// Full mock-data seed: wipes and repopulates every table in the schema.
// The catalog (categories + first 12 products) mirrors lib/mock-data.ts so the
// public site and the database tell the same story; everything else (orders,
// rentals, settings, admin user) is layered on top.
//
// Run with: bun prisma/seed.ts
import { PrismaClient, Prisma } from "../lib/generated/prisma";
import { hashPassword } from "../lib/admin/password";
import { specsFromJson, specsToJson } from "../lib/admin/specs";
import { categories as mockCategories, products as mockProducts } from "../lib/mock-data";

// The DB stores specifications in the bilingual admin shape
// (`{ [id]: { label_ro, label_ru, value_ro, value_ru } }`); the mock catalog
// keeps the flat shape, so convert on the way in (known keys pick up their
// dictionary labels).
const bilingualSpecs = (flat: Record<string, string>) =>
  specsToJson(specsFromJson(flat));

const prisma = new PrismaClient();

const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const daysAgo = (n: number, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
};
const daysAhead = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Deterministic-ish stock spread: healthy, low, and out-of-stock cases.
const stockById: Record<number, number> = {
  1: 42, 2: 8, 3: 0, 4: 17, 5: 26, 6: 4,
  7: 31, 8: 2, 9: 12, 10: 55, 11: 3, 12: 20,
};

const reducedById: Record<number, number> = { 3: 249, 5: 179, 10: 129 };

async function wipe() {
  // Children before parents.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.rentalApplication.deleteMany();
  await prisma.rentalPackageVariant.deleteMany();
  await prisma.rentalPackageImage.deleteMany();
  await prisma.rentalPackageVideo.deleteMany();
  await prisma.rentalPackage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVideo.deleteMany();
  await prisma.product.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.category.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.themeSettings.deleteMany();
  await prisma.heroContent.deleteMany();
  await prisma.homepageSettings.deleteMany();
  await prisma.deliverySettings.deleteMany();
  await prisma.contactSettings.deleteMany();
  await prisma.promoBanner.deleteMany();
  await prisma.specialOffersPage.deleteMany();
}

async function seedCategories() {
  const covers: Record<string, string> = {
    led: img("1550985616-10810253b84d", 900),
    smart: img("1524634126442-357e0eac3c14", 900),
    christmas: img("1493666438817-866a91353ca9", 900),
    vintage: img("1543872084-c7bd3822856f", 900),
    strip: img("1558882224-dda166733046", 900),
    outdoor: img("1513694203232-719a280e022f", 900),
    ceiling: img("1467269204594-9661b134dd2b", 900),
    pendant: img("1513506003901-1e6a229e2d15", 900),
    table: img("1507473885765-e6ed057f782c", 900),
    floor: img("1513475382585-d06e58bcb0e0", 900),
    spot: img("1519710164239-da123dc03ef4", 900),
    accessories: img("1581092160562-40aa08e78837", 900),
  };
  for (const c of mockCategories) {
    await prisma.category.create({
      data: {
        id: c.id,
        name_ro: c.name_ro,
        name_ru: c.name_ru,
        slug: c.slug,
        position: c.position,
        imageUrl: covers[c.slug] ?? null,
      },
    });
  }
}

async function seedPromotions() {
  await prisma.promotion.create({
    data: {
      id: 1,
      name_ro: "Reduceri de sezon",
      name_ru: "Сезонные скидки",
      description_ro: "Până la 30% la iluminatul festiv și benzile LED.",
      description_ru: "До 30% на праздничное освещение и LED-ленты.",
      startDate: daysAgo(14),
      endDate: daysAhead(21),
      discountPercent: 20,
      featured: true,
    },
  });
  await prisma.promotion.create({
    data: {
      id: 2,
      name_ro: "Weekend smart",
      name_ru: "Умные выходные",
      description_ro: "Becuri și spoturi smart la preț special în weekend.",
      description_ru: "Умные лампы и споты по специальной цене в выходные.",
      startDate: daysAgo(2),
      endDate: daysAhead(5),
      discountPercent: 15,
      featured: false,
    },
  });
}

// Products 1–12 come straight from lib/mock-data.ts; 13–16 are extra rows that
// exercise the rest of the schema (reduced prices, promotions, inactive).
async function seedProducts() {
  const promoByProduct: Record<number, number> = { 3: 1, 5: 1, 9: 1, 2: 2, 7: 2 };

  for (const p of mockProducts) {
    await prisma.product.create({
      data: {
        id: p.id,
        name_ro: p.name_ro,
        name_ru: p.name_ru,
        description_ro: p.description_ro,
        description_ru: p.description_ru,
        price: new Prisma.Decimal(p.price),
        reducedPrice: reducedById[p.id] != null ? new Prisma.Decimal(reducedById[p.id]) : null,
        stock: stockById[p.id] ?? 10,
        hasVariants: p.hasVariants,
        specifications: bilingualSpecs(p.specifications),
        categoryId: p.categoryId,
        promotionId: promoByProduct[p.id] ?? null,
        featured: p.featured,
        featuredOrder: p.featuredOrder,
        isActive: p.isActive,
        createdAt: daysAgo(90 - p.id * 5),
        images: {
          create: p.images.map((i, idx) => ({ imageUrl: i.imageUrl, isMain: idx === 0 })),
        },
        videos: { create: p.videos.map((v) => ({ videoUrl: v.videoUrl, thumbnailUrl: v.thumbnailUrl })) },
        variants: {
          // Deterministic ids (productId * 10 + sortOrder) so order items can
          // reference variants without lookups.
          create: p.variants.map((v) => ({
            id: p.id * 10 + v.sortOrder,
            name_ro: v.name_ro,
            name_ru: v.name_ru,
            size: v.size,
            price: new Prisma.Decimal(v.price),
            reducedPrice: v.reducedPrice != null ? new Prisma.Decimal(v.reducedPrice) : null,
            stock: v.stock,
            isDefault: v.isDefault,
            sortOrder: v.sortOrder,
          })),
        },
      },
    });
  }

  const extras = [
    {
      id: 13,
      name_ro: "Veioză Arc Nordic",
      name_ru: "Настольная лампа Arc Nordic",
      categorySlug: "table",
      price: 649,
      reducedPrice: 549,
      stock: 9,
      featured: true,
      featuredOrder: 4,
      isActive: true,
      specifications: { wattage: "12", lumens: "800", colorTemp: "3000K", base: "E14", lifespan: "25000", energyClass: "A+" },
      images: [img("1507473885765-e6ed057f782c"), img("1540932239986-30128078f3c5"), img("1513475382585-d06e58bcb0e0")],
      variants: [
        { id: 130, name_ro: "Stejar", name_ru: "Дуб", size: null, price: 649, reducedPrice: 549, stock: 5, isDefault: true, sortOrder: 0 },
        { id: 131, name_ro: "Nuc", name_ru: "Орех", size: null, price: 699, reducedPrice: null, stock: 4, isDefault: false, sortOrder: 1 },
      ],
      description_ro:
        "Veioză cu braț arcuit și abajur textil, lumină caldă difuză pentru colțul de lectură. Întrerupător tactil cu trei trepte de intensitate.",
      description_ru:
        "Настольная лампа с изогнутым плафоном и тканевым абажуром — мягкий тёплый свет для уголка чтения. Сенсорный выключатель с тремя уровнями яркости.",
    },
    {
      id: 14,
      name_ro: "Lustră Suspendată Halo 60cm",
      name_ru: "Подвесной светильник Halo 60см",
      categorySlug: "pendant",
      price: 1890,
      reducedPrice: null,
      stock: 6,
      featured: true,
      featuredOrder: 5,
      isActive: true,
      specifications: { wattage: "36", lumens: "3200", colorTemp: "2700–5000K", base: "—", lifespan: "35000", energyClass: "A+" },
      images: [img("1513506003901-1e6a229e2d15"), img("1565814329452-e1efa11c5b89"), img("1502005229762-cf1b2da7c5d6")],
      variants: [],
      description_ro:
        "Inel de lumină suspendat, cu temperatură reglabilă din telecomandă. O piesă centrală discretă pentru dining sau living.",
      description_ru:
        "Подвесное световое кольцо с регулируемой температурой с пульта. Сдержанный центральный акцент для столовой или гостиной.",
    },
    {
      id: 15,
      name_ro: "Lampadar Tripod Studio",
      name_ru: "Торшер Tripod Studio",
      categorySlug: "floor",
      price: 1190,
      reducedPrice: 990,
      stock: 0,
      featured: false,
      featuredOrder: 0,
      isActive: true,
      specifications: { wattage: "15", lumens: "1100", colorTemp: "3000K", base: "E27", lifespan: "25000", energyClass: "A" },
      images: [img("1513475382585-d06e58bcb0e0"), img("1540932239986-30128078f3c5"), img("1507473885765-e6ed057f782c")],
      variants: [],
      description_ro:
        "Trepied din lemn masiv cu abajur din in, inspirat de reflectoarele de studio. Lumină caldă, prezență sculpturală.",
      description_ru:
        "Тренога из массива дерева с льняным абажуром, вдохновлённая студийными прожекторами. Тёплый свет и скульптурное присутствие.",
    },
    {
      id: 16,
      name_ro: "Dimmer Smart WiFi (arhivat)",
      name_ru: "Умный диммер WiFi (архив)",
      categorySlug: "accessories",
      price: 189,
      reducedPrice: null,
      stock: 14,
      featured: false,
      featuredOrder: 0,
      isActive: false,
      specifications: { wattage: "—", lumens: "—", colorTemp: "—", base: "—", lifespan: "—", energyClass: "—" },
      images: [img("1581092160562-40aa08e78837"), img("1558002038-1055907df827")],
      variants: [],
      description_ro:
        "Modul de dimare WiFi montat în doză, compatibil cu becurile LED dimabile. Program de înlocuit — păstrat pentru istoricul comenzilor.",
      description_ru:
        "Встраиваемый WiFi-диммер, совместимый с диммируемыми LED-лампами. Снят с продажи — сохранён для истории заказов.",
    },
  ];

  for (const e of extras) {
    const category = mockCategories.find((c) => c.slug === e.categorySlug)!;
    await prisma.product.create({
      data: {
        id: e.id,
        name_ro: e.name_ro,
        name_ru: e.name_ru,
        description_ro: e.description_ro,
        description_ru: e.description_ru,
        price: new Prisma.Decimal(e.price),
        reducedPrice: e.reducedPrice != null ? new Prisma.Decimal(e.reducedPrice) : null,
        stock: e.stock,
        hasVariants: e.variants.length > 0,
        specifications: bilingualSpecs(e.specifications),
        categoryId: category.id,
        featured: e.featured,
        featuredOrder: e.featuredOrder,
        isActive: e.isActive,
        createdAt: daysAgo(30 - (e.id - 13) * 6),
        images: { create: e.images.map((url, idx) => ({ imageUrl: url, isMain: idx === 0 })) },
        variants: {
          create: e.variants.map((v) => ({
            ...v,
            price: new Prisma.Decimal(v.price),
            reducedPrice: v.reducedPrice != null ? new Prisma.Decimal(v.reducedPrice) : null,
          })),
        },
      },
    });
  }
}

async function seedRentalPackages() {
  const packages = [
    {
      id: 1,
      title_ro: "Pachet Nuntă Lumini Festive",
      title_ru: "Свадебный пакет праздничного света",
      price: 4500,
      reducedPrice: 3900,
      categorySlug: "outdoor",
      promotionId: 1,
      specifications: { coverage: "300 mp", setup: "4 ore", crew: "2 tehnicieni", power: "3.2 kW" },
      includes_ro: ["60m ghirlande festoon", "8 reflectoare arhitecturale", "Montaj și demontaj", "Tehnician la eveniment"],
      includes_ru: ["60м гирлянд festoon", "8 архитектурных прожекторов", "Монтаж и демонтаж", "Техник на мероприятии"],
      images: [img("1519741497674-611481863552"), img("1573148195900-7845dcb9b127"), img("1526318472351-c75fcf070305")],
      videos: [{ videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", thumbnailUrl: img("1519741497674-611481863552", 600) }],
      variants: [
        { id: 11, name_ro: "Standard (până la 100 invitați)", name_ru: "Стандарт (до 100 гостей)", size: "100", price: 4500, reducedPrice: 3900, isDefault: true, sortOrder: 0 },
        { id: 12, name_ro: "Extins (până la 200 invitați)", name_ru: "Расширенный (до 200 гостей)", size: "200", price: 6900, reducedPrice: null, isDefault: false, sortOrder: 1 },
      ],
      description_ro:
        "Iluminat complet pentru nuntă: ghirlande calde deasupra ringului, accente arhitecturale pe fațadă și lumină ambientală pentru fotografii memorabile.",
      description_ru:
        "Полное свадебное освещение: тёплые гирлянды над танцполом, архитектурные акценты на фасаде и амбиентный свет для памятных фотографий.",
    },
    {
      id: 2,
      title_ro: "Pachet Corporate / Conferință",
      title_ru: "Корпоративный пакет / конференция",
      price: 2900,
      reducedPrice: null,
      categorySlug: "spot",
      promotionId: null,
      specifications: { coverage: "200 mp", setup: "2 ore", crew: "1 tehnician", power: "1.8 kW" },
      includes_ro: ["Iluminat scenă și prezidiu", "12 spoturi LED direcționale", "Lumină de ambianță brandată", "Suport tehnic"],
      includes_ru: ["Освещение сцены и президиума", "12 направленных LED-спотов", "Брендированный амбиентный свет", "Техподдержка"],
      images: [img("1540575467063-178a50c2df87"), img("1519710164239-da123dc03ef4"), img("1516156008625-3a9d6067fab5")],
      videos: [],
      variants: [],
      description_ro:
        "Scenă bine luminată, logo proiectat în culoarea brandului și sală cu ambianță profesională — totul instalat înainte de sosirea invitaților.",
      description_ru:
        "Хорошо освещённая сцена, логотип в фирменном цвете и профессиональная атмосфера зала — всё установлено до прихода гостей.",
    },
    {
      id: 3,
      title_ro: "Pachet Petrecere Privată",
      title_ru: "Пакет для частной вечеринки",
      price: 1600,
      reducedPrice: 1400,
      categorySlug: "strip",
      promotionId: null,
      specifications: { coverage: "120 mp", setup: "1.5 ore", crew: "1 tehnician", power: "1.1 kW" },
      includes_ro: ["30m benzi LED RGB", "4 proiectoare de culoare", "Controler cu scene predefinite", "Livrare și montaj"],
      includes_ru: ["30м RGB LED-лент", "4 цветных прожектора", "Контроллер с готовыми сценами", "Доставка и монтаж"],
      images: [img("1558882224-dda166733046"), img("1601931935821-5fbe71157695"), img("1606946184955-a8cb11e66336")],
      videos: [],
      variants: [
        { id: 31, name_ro: "Interior", name_ru: "В помещении", size: null, price: 1600, reducedPrice: 1400, isDefault: true, sortOrder: 0 },
        { id: 32, name_ro: "Interior + terasă", name_ru: "Помещение + терраса", size: null, price: 2100, reducedPrice: null, isDefault: false, sortOrder: 1 },
      ],
      description_ro:
        "Transformă livingul sau curtea într-un ring de dans: culori dinamice sincronizate, accente pe bar și lumină de petrecere fără efort.",
      description_ru:
        "Превратите гостиную или двор в танцпол: динамичные синхронизированные цвета, акценты на баре и праздничный свет без усилий.",
    },
    {
      id: 4,
      title_ro: "Pachet Crăciun Fațadă",
      title_ru: "Новогодний пакет для фасада",
      price: 3200,
      reducedPrice: null,
      categorySlug: "christmas",
      promotionId: 1,
      specifications: { coverage: "fațadă 2 niveluri", setup: "3 ore", crew: "2 tehnicieni", power: "0.9 kW" },
      includes_ro: ["120m instalații exterioare IP65", "Perdele luminoase ferestre", "Programator zi/noapte", "Demontare în ianuarie"],
      includes_ru: ["120м уличных гирлянд IP65", "Световые шторы на окна", "Таймер день/ночь", "Демонтаж в январе"],
      images: [img("1482517967863-00e15c9b44be"), img("1493666438817-866a91353ca9"), img("1607923432780-7a9c30adcb72")],
      videos: [],
      variants: [],
      description_ro:
        "Casa ta, gata de sărbători fără scări și cabluri încurcate: montăm, programăm și demontăm noi instalația completă a fațadei.",
      description_ru:
        "Ваш дом готов к праздникам без лестниц и спутанных проводов: мы монтируем, программируем и демонтируем всю иллюминацию фасада.",
    },
  ];

  for (const p of packages) {
    const category = mockCategories.find((c) => c.slug === p.categorySlug)!;
    await prisma.rentalPackage.create({
      data: {
        id: p.id,
        title_ro: p.title_ro,
        title_ru: p.title_ru,
        description_ro: p.description_ro,
        description_ru: p.description_ru,
        price: new Prisma.Decimal(p.price),
        reducedPrice: p.reducedPrice != null ? new Prisma.Decimal(p.reducedPrice) : null,
        hasVariants: p.variants.length > 0,
        specifications: bilingualSpecs(p.specifications),
        includes_ro: p.includes_ro,
        includes_ru: p.includes_ru,
        categoryId: category.id,
        promotionId: p.promotionId,
        isActive: true,
        createdAt: daysAgo(120 - p.id * 10),
        images: { create: p.images.map((url, idx) => ({ imageUrl: url, isMain: idx === 0 })) },
        videos: { create: p.videos },
        variants: {
          create: p.variants.map((v) => ({
            ...v,
            price: new Prisma.Decimal(v.price),
            reducedPrice: v.reducedPrice != null ? new Prisma.Decimal(v.reducedPrice) : null,
          })),
        },
      },
    });
  }
}

async function seedRentalApplications() {
  const apps = [
    { customerName: "Elena Rusu", customerEmail: "elena.rusu@gmail.com", customerPhone: "+373 690 12 345", eventType: "wedding", eventDate: daysAhead(45), eventEndDate: daysAhead(46), eventLocation: "Vila Verde, Chișinău", guestCount: 140, rentalPackageId: 1, rentalPackageVariantId: 12, status: "approved", totalPrice: 6900, additionalInfo: "Ceremonia începe la 16:00, avem nevoie de lumină și în foișor." },
    { customerName: "Andrei Munteanu", customerEmail: "a.munteanu@mail.md", customerPhone: "+373 688 55 210", eventType: "corporate", eventDate: daysAhead(12), eventEndDate: null, eventLocation: "Radisson Blu, Chișinău", guestCount: 80, rentalPackageId: 2, rentalPackageVariantId: null, status: "pending", totalPrice: 2900, additionalInfo: "Logo-ul companiei proiectat pe peretele din spate." },
    { customerName: "Cristina Popescu", customerEmail: "cristina.pp@gmail.com", customerPhone: "+373 691 44 782", eventType: "birthday", eventDate: daysAhead(8), eventEndDate: null, eventLocation: "str. Albișoara 42, Chișinău", guestCount: 35, rentalPackageId: 3, rentalPackageVariantId: 32, status: "confirmed", totalPrice: 2100, additionalInfo: null },
    { customerName: "Ion Ceban", customerEmail: "ion.ceban@yahoo.com", customerPhone: "+373 679 33 190", eventType: "wedding", eventDate: daysAhead(90), eventEndDate: daysAhead(91), eventLocation: "Château Vartely, Orhei", guestCount: 220, rentalPackageId: 1, rentalPackageVariantId: 12, status: "pending", totalPrice: 6900, additionalInfo: "Vrem și iluminat pentru alee, ~40m." },
    { customerName: "Natalia Sîrbu", customerEmail: "nsirbu@bizmail.md", customerPhone: "+373 692 78 003", eventType: "corporate", eventDate: daysAgo(20), eventEndDate: null, eventLocation: "Tekwill, Chișinău", guestCount: 150, rentalPackageId: 2, rentalPackageVariantId: null, status: "completed", totalPrice: 2900, additionalInfo: null },
    { customerName: "Dumitru Lupu", customerEmail: "d.lupu@gmail.com", customerPhone: "+373 685 90 447", eventType: "private", eventDate: daysAgo(5), eventEndDate: null, eventLocation: "Stăuceni", guestCount: 25, rentalPackageId: 3, rentalPackageVariantId: 31, status: "cancelled", totalPrice: 1400, additionalInfo: "Anulat din cauza vremii, va reveni în primăvară." },
  ];
  for (const a of apps) {
    await prisma.rentalApplication.create({
      data: { ...a, totalPrice: new Prisma.Decimal(a.totalPrice), createdAt: a.eventDate < new Date() ? daysAgo(40) : daysAgo(Math.floor(Math.random() * 10) + 1) },
    });
  }
}

async function seedOrders() {
  // [productId, variantId?, qty] tuples per order keep FKs honest.
  type ItemSpec = { productId?: number; variantId?: number; rentalPackageId?: number; rentalVariantId?: number; qty: number; price: number; rentalStart?: Date; rentalEnd?: Date };
  const orders: Array<{
    name: string; email: string; phone: string; address: string; city: string; postal: string;
    status: string; ago: number; items: ItemSpec[]; note?: string;
  }> = [
    { name: "Maria Cojocaru", email: "maria.cj@gmail.com", phone: "+373 690 11 223", address: "str. Ștefan cel Mare 128, ap. 14", city: "Chișinău", postal: "MD-2001", status: "pending", ago: 0, items: [{ productId: 2, variantId: 21, qty: 1, price: 949 }, { productId: 1, qty: 4, price: 79 }] },
    { name: "Vasile Ungureanu", email: "vasile.u@mail.md", phone: "+373 688 44 556", address: "str. Alba Iulia 75", city: "Chișinău", postal: "MD-2071", status: "pending", ago: 1, items: [{ productId: 14, qty: 1, price: 1890 }], note: "Sunați înainte de livrare, vă rog." },
    { name: "Olga Cebotari", email: "olga.ceb@gmail.com", phone: "+373 691 77 889", address: "bd. Mircea cel Bătrân 24", city: "Chișinău", postal: "MD-2044", status: "confirmed", ago: 2, items: [{ productId: 5, qty: 2, price: 179 }, { productId: 12, qty: 1, price: 349 }] },
    { name: "Igor Botnari", email: "igor.botnari@yahoo.com", phone: "+373 679 22 334", address: "str. Păcii 8", city: "Bălți", postal: "MD-3100", status: "confirmed", ago: 3, items: [{ productId: 13, variantId: 130, qty: 1, price: 549 }, { productId: 4, qty: 6, price: 129 }] },
    { name: "Ana Guțu", email: "ana.gutu@gmail.com", phone: "+373 692 55 667", address: "str. Trandafirilor 31/2", city: "Chișinău", postal: "MD-2038", status: "shipped", ago: 5, items: [{ productId: 8, qty: 2, price: 549 }], note: "Livrare după ora 18:00." },
    { name: "Sergiu Railean", email: "s.railean@mail.md", phone: "+373 685 88 990", address: "str. Independenței 12", city: "Cahul", postal: "MD-3900", status: "shipped", ago: 7, items: [{ productId: 6, qty: 1, price: 459 }, { productId: 11, qty: 1, price: 399 }] },
    { name: "Diana Moraru", email: "diana.moraru@gmail.com", phone: "+373 690 33 445", address: "str. Sarmizegetusa 5", city: "Chișinău", postal: "MD-2032", status: "delivered", ago: 12, items: [{ productId: 10, qty: 3, price: 129 }, { productId: 4, qty: 3, price: 129 }] },
    { name: "Pavel Stratan", email: "pavel.s@gmail.com", phone: "+373 688 66 778", address: "str. Columna 104", city: "Chișinău", postal: "MD-2012", status: "delivered", ago: 18, items: [{ productId: 2, variantId: 20, qty: 2, price: 349 }, { productId: 7, qty: 4, price: 259 }] },
    { name: "Tatiana Ciobanu", email: "t.ciobanu@bizmail.md", phone: "+373 691 99 001", address: "str. Livezilor 3", city: "Ialoveni", postal: "MD-6801", status: "delivered", ago: 25, items: [{ rentalPackageId: 3, rentalVariantId: 31, qty: 1, price: 1400, rentalStart: daysAgo(24), rentalEnd: daysAgo(22) }] },
    { name: "Nicolae Vieru", email: "n.vieru@gmail.com", phone: "+373 679 11 335", address: "str. Doina 140", city: "Chișinău", postal: "MD-2062", status: "delivered", ago: 33, items: [{ productId: 15, qty: 1, price: 990 }] },
    { name: "Victoria Roșca", email: "v.rosca@gmail.com", phone: "+373 692 44 556", address: "bd. Dacia 60", city: "Chișinău", postal: "MD-2062", status: "cancelled", ago: 9, items: [{ productId: 3, qty: 2, price: 249 }], note: "Client a anulat — a găsit alt model." },
    { name: "Alexandru Prisacari", email: "a.prisacari@mail.md", phone: "+373 685 22 448", address: "str. Mihai Eminescu 47", city: "Orhei", postal: "MD-3500", status: "delivered", ago: 47, items: [{ productId: 16, qty: 2, price: 189 }, { productId: 1, qty: 10, price: 79 }] },
  ];

  for (const o of orders) {
    const total = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    await prisma.order.create({
      data: {
        customerName: o.name,
        customerEmail: o.email,
        customerPhone: o.phone,
        address: o.address,
        city: o.city,
        postalCode: o.postal,
        country: "Moldova",
        specialInstructions: o.note ?? null,
        status: o.status,
        totalPrice: new Prisma.Decimal(total),
        createdAt: daysAgo(o.ago, 10 + (o.ago % 9)),
        items: {
          create: o.items.map((i) => ({
            productId: i.productId ?? null,
            productVariantId: i.variantId ?? null,
            rentalPackageId: i.rentalPackageId ?? null,
            rentalPackageVariantId: i.rentalVariantId ?? null,
            quantity: i.qty,
            priceEach: new Prisma.Decimal(i.price),
            rentalStart: i.rentalStart ?? null,
            rentalEnd: i.rentalEnd ?? null,
          })),
        },
      },
    });
  }
}

async function seedAdminAndSettings() {
  await prisma.adminUser.create({
    data: {
      username: "admin",
      email: "admin@lampino.md",
      password: hashPassword("admin123"),
      role: "admin",
    },
  });

  await prisma.themeSettings.create({
    data: {
      colorPrimary: "#d0713e",
      colorSecondary: "#7a3d1f",
      colorTertiary: "#f7ece4",
      colorAccent: "#8a4a24",
      colorSuccess: "#22C55E",
      colorWarning: "#F97316",
      colorError: "#EF4444",
      colorInfo: "#06B6D4",
      isActive: true,
    },
  });

  await prisma.heroContent.create({
    data: {
      leftHeading_ro: "Lumină bună pentru fiecare cameră",
      leftHeading_ru: "Хороший свет для каждой комнаты",
      leftButtonText_ro: "Vezi catalogul",
      leftButtonText_ru: "Смотреть каталог",
      leftButtonUrl: "/magazin",
      leftImageUrl: img("1513506003901-1e6a229e2d15"),
      rightImageUrl: img("1524634126442-357e0eac3c14"),
      leftMediaUrl: null,
      leftMediaType: "image",
      rightMediaUrl: "/hero.mp4",
      rightMediaType: "video",
      isActive: true,
    },
  });

  await prisma.homepageSettings.create({
    data: {
      featuredCategoryIds: [1, 2, 3],
      maxCategories: 3,
      featuredProductsCategoryId: null,
      featuredRentalsCategoryId: null,
      isActive: true,
      welcomeHeading_ro: "Bine ați venit la Lampino",
      welcomeHeading_ru: "Добро пожаловать в Lampino",
      welcomeDescription_ro: "Becuri, benzi LED și corpuri de iluminat alese cu grijă, livrate în 24 de ore oriunde în Moldova.",
      welcomeDescription_ru: "Лампы, LED-ленты и светильники, отобранные с заботой, с доставкой за 24 часа по всей Молдове.",
      welcomeButtonText_ro: "Explorează magazinul",
      welcomeButtonText_ru: "Перейти в магазин",
      welcomeButtonUrl: "/magazin",
      categoryHeading_ro: "Categorii populare",
      categoryHeading_ru: "Популярные категории",
      productHeading_ro: "Produse recomandate",
      productHeading_ru: "Рекомендуемые товары",
      rentalHeading_ro: "Închiriere pentru evenimente",
      rentalHeading_ru: "Аренда для мероприятий",
    },
  });

  await prisma.deliverySettings.create({
    data: {
      freeDeliveryThreshold: new Prisma.Decimal(1500),
      deliveryCostChisinau: new Prisma.Decimal(50),
      deliveryCostOutside: new Prisma.Decimal(90),
      isActive: true,
    },
  });

  await prisma.contactSettings.create({
    data: {
      phone: "+373 675 24 111",
      email: "contact@lampino.md",
      whatsapp: "+373 675 24 111",
      address_ro: "str. Armenească 44",
      address_ru: "ул. Армянская 44",
      city_ro: "Chișinău",
      city_ru: "Кишинев",
      country_ro: "Moldova",
      country_ru: "Молдова",
      businessHours_ro: "Lun–Vin: 9:00 – 18:00, Sâm: 10:00 – 14:00",
      businessHours_ru: "Пн–Пт: 9:00 – 18:00, Сб: 10:00 – 14:00",
      facebookUrl: "https://www.facebook.com/lampino.md",
      instagramUrl: "https://www.instagram.com/lampino.md",
      tiktokUrl: "https://www.tiktok.com/@lampino.md",
      isActive: true,
    },
  });

  await prisma.promoBanner.create({
    data: {
      message_ro: "Reduceri de sezon: până la −30% la iluminatul festiv",
      message_ru: "Сезонные скидки: до −30% на праздничное освещение",
      ctaText_ro: "Vezi ofertele",
      ctaText_ru: "Смотреть предложения",
      ctaLink: "/oferte-speciale",
      isActive: true,
      showOnDesktop: true,
      showOnMobile: true,
      backgroundColor: "#14110f",
      textColor: "#f6f4ef",
    },
  });

  await prisma.specialOffersPage.create({
    data: {
      title_ro: "Oferte Speciale",
      title_ru: "Специальные предложения",
      description_ro: "Produse cu preț redus, disponibile în stoc limitat.",
      description_ru: "Товары со скидкой, доступные в ограниченном количестве.",
      mediaUrl: img("1493666438817-866a91353ca9"),
      mediaType: "image",
      selectionMethod: "manual",
      selectedProductIds: [3, 5, 10, 13, 15],
      selectedRentalPackageIds: [1, 3],
      filterByCategoryId: null,
      isActive: true,
    },
  });
}

async function resetSequences() {
  // Explicit ids were used for cross-referenced tables; bump their sequences.
  const tables = ["categories", "products", "product_variants", "promotions", "rental_packages", "rental_package_variants"];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1))`,
    );
  }
}

async function main() {
  await wipe();
  await seedCategories();
  await seedPromotions();
  await seedProducts();
  await seedRentalPackages();
  await seedRentalApplications();
  await seedOrders();
  await seedAdminAndSettings();
  await resetSequences();

  const counts = {
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    productImages: await prisma.productImage.count(),
    productVideos: await prisma.productVideo.count(),
    productVariants: await prisma.productVariant.count(),
    promotions: await prisma.promotion.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    rentalPackages: await prisma.rentalPackage.count(),
    rentalVariants: await prisma.rentalPackageVariant.count(),
    rentalApplications: await prisma.rentalApplication.count(),
    adminUsers: await prisma.adminUser.count(),
  };
  console.table(counts);
  console.log("Admin login → username: admin  password: admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
