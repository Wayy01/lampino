import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import { CartProvider } from "@/lib/cart/provider";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { CartDrawer } from "@/components/site/cart-drawer";
import { Grain } from "@/components/site/grain";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ro"
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen" suppressHydrationWarning>
        <LanguageProvider>
          <CartProvider>
            <Grain />
            <Navbar />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
