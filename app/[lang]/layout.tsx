import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import { CartProvider } from "@/lib/cart/provider";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { CartDrawer } from "@/components/site/cart-drawer";
import { Grain } from "@/components/site/grain";
import { LOCALES, isLocale } from "@/lib/i18n/routing";
import { getProducts } from "@/lib/data/products";
import { getContactSettings } from "@/lib/data/settings";
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

export const metadata: Metadata = {
  title: "Lampino — Iluminat pentru casă, livrat rapid",
  description:
    "Becuri LED, becuri smart, lumini de Crăciun, benzi LED și iluminat exterior — alese cu grijă și livrate în 24 de ore. De la 79 lei.",
  openGraph: {
    title: "Lampino — Iluminat pentru casă",
    description:
      "Lumină bună, preț corect, livrare rapidă. Magazinul tău de iluminat.",
    type: "website",
  },
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
  const [products, contact] = await Promise.all([
    getProducts(),
    getContactSettings(),
  ]);

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen" suppressHydrationWarning>
        <LanguageProvider lang={lang}>
          <CartProvider products={products}>
            <Grain />
            <Navbar />
            <main>{children}</main>
            <Footer />
            <CartDrawer whatsapp={contact?.whatsapp ?? null} />
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
