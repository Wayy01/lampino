import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import { CartProvider } from "@/lib/cart/provider";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { CartDrawer } from "@/components/site/cart-drawer";
import { Grain } from "@/components/site/grain";
import { PromoBanner } from "@/components/site/promo-banner";
import { JsonLd } from "@/components/site/json-ld";
import { LOCALES, isLocale } from "@/lib/i18n/routing";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { storeSchema, websiteSchema } from "@/lib/schema";
import { SITE_NAME, SITE_URL, localeAlternates, openGraphFor } from "@/lib/seo";
import { getProducts } from "@/lib/data/products";
import {
  getContactSettings,
  getDeliverySettings,
  getPromoBanner,
  getThemeSettings,
} from "@/lib/data/settings";
import "../globals.css";

const fraunces = Fraunces({
  variable: "--font-display-app",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-body-app",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "ro";
  const meta = dictionaries[locale].meta;
  return {
    // Every relative URL below (canonicals, hreflang, OG images) resolves
    // against this, so the whole storefront needs it set exactly once here.
    metadataBase: new URL(SITE_URL),
    // Child pages set a bare title; the suffix is appended for them.
    title: { default: meta.title, template: `%s — ${SITE_NAME}` },
    description: meta.description,
    applicationName: SITE_NAME,
    alternates: localeAlternates(locale),
    openGraph: openGraphFor(locale, {
      title: meta.ogTitle,
      description: meta.ogDescription,
    }),
    // Card type only: Next fills the Twitter title/description/image from each
    // page's own `openGraph`, and setting them here would be inherited by every
    // child page and shadow that.
    twitter: { card: "summary_large_image" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    // Set once the property is claimed in Search Console; unset renders nothing.
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#d0713e",
  colorScheme: "light",
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // The cart persists product ids in localStorage; the provider needs the
  // catalog to rehydrate those lines with live price/variant data. The contact
  // number powers the cart's WhatsApp checkout.
  //
  // A throw here would escape every `error.tsx` — a boundary cannot catch the
  // layout of its own segment — and drop the visitor on Next's bare error page
  // with no navigation and no message. So the shell degrades instead: an empty
  // catalog still renders the navbar and footer, and the page inside is left to
  // fail into `app/[lang]/error.tsx`, which can explain itself and offer a
  // retry. The settings loaders already resolve to `null` on failure.
  const [products, contact, delivery, banner, theme] = await Promise.all([
    getProducts().catch(() => []),
    getContactSettings(),
    getDeliverySettings(),
    getPromoBanner(),
    getThemeSettings(),
  ]);

  // The palette lives in globals.css; an active ThemeSettings row overrides the
  // accent slots inline. `--promo-h` offsets the fixed navbar and is only set
  // when a banner is actually rendered.
  const rootStyle: React.CSSProperties = {
    ...(theme && {
      ["--primary" as string]: theme.colorPrimary,
      ["--primary-hover" as string]: `color-mix(in srgb, ${theme.colorPrimary} 85%, #000)`,
      ["--primary-deep" as string]: `color-mix(in srgb, ${theme.colorPrimary} 60%, #000)`,
      ["--ring" as string]: theme.colorPrimary,
      ["--accent-foreground" as string]: theme.colorAccent,
    }),
    ...(banner && { ["--promo-h" as string]: "2.5rem" }),
  };

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
      style={rootStyle}
    >
      <body className="min-h-screen" suppressHydrationWarning>
        {/* Site-wide entities, referenced by @id from the per-page schema. */}
        <JsonLd
          data={[
            storeSchema(lang, contact),
            websiteSchema(lang, dictionaries[lang].meta.description),
          ]}
        />
        <LanguageProvider lang={lang}>
          <CartProvider products={products}>
            <Grain />
            {banner && <PromoBanner banner={banner} />}
            <Navbar phone={contact?.phone ?? null} />
            <main>{children}</main>
            <Footer contact={contact} />
            <CartDrawer delivery={delivery} />
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
