import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { isLocale, LOCALES } from "@/lib/i18n/routing";
import { AdminLanguageProvider } from "@/lib/admin/i18n-provider";
import { SITE_URL } from "@/lib/seo";
import "../../globals.css";

const fraunces = Fraunces({
  variable: "--font-display-app",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-body-app",
  subsets: ["latin", "cyrillic-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lampino Admin",
  description: "Administrare magazin Lampino",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        <AdminLanguageProvider lang={lang}>{children}</AdminLanguageProvider>
      </body>
    </html>
  );
}
