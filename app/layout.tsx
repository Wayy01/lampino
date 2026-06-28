import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
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
  title: "Atelier — Premium car rental, brokered for the best price",
  description:
    "We compare our partner fleets across Italy and hand you the best price on premium and performance cars. From €500/day.",
  openGraph: {
    title: "Atelier — Premium car rental",
    description:
      "The middle-man that works for you. Best price across vetted rental partners in Italy.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <LanguageProvider>
          <Grain />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
