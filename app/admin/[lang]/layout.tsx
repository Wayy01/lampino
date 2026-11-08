import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { isLocale, LOCALES } from "@/lib/i18n/routing";
import { AdminLanguageProvider } from "@/lib/admin/i18n-provider";
import { SITE_URL } from "@/lib/seo";
import { TRANSLATE_GUARD_SCRIPT } from "@/lib/translate-guard";
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
      translate="no"
      className={`${fraunces.variable} ${hanken.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen">
        {/* Guards against browser page-translators crashing React. Inline via
            dangerouslySetInnerHTML: it executes synchronously while the initial
            HTML parses (before hydration — async src gave no such guarantee),
            and React 19 does not warn for it (it does for both sync and plain
            <script> children rendered in the tree). */}
        <script dangerouslySetInnerHTML={{ __html: TRANSLATE_GUARD_SCRIPT }} />
        <AdminLanguageProvider lang={lang}>{children}</AdminLanguageProvider>
      </body>
    </html>
  );
}
