// The 404 for any URL that matches no route at all.
//
// It has to bring its own <html>/<body>: both root layouts live behind a
// dynamic segment (`app/[lang]`, `app/admin/[lang]`), so Next has no layout it
// can compose a 404 document from and otherwise serves an unstyled error page.
// `global-not-found` bypasses layouts entirely, which is why the fonts and
// global stylesheet are imported here rather than inherited.
//
// It gets no `params`, so the locale comes from the header `proxy.ts` sets.
//
// Note this does not cover `notFound()` thrown inside a route — that path is
// still served by Next's built-in 404 (see the note in `app/[lang]/not-found.tsx`).
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import { Compass } from "lucide-react";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  isLocale,
  localePath,
  shopHref,
  LOCALE_HEADER,
} from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import "./globals.css";

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

async function resolveLang() {
  const requested = (await headers()).get(LOCALE_HEADER) ?? undefined;
  return isLocale(requested) ? requested : "ro";
}

export async function generateMetadata(): Promise<Metadata> {
  const t = dictionaries[await resolveLang()].errors;
  return { title: t.notFoundTitle, description: t.notFoundText };
}

export default async function GlobalNotFound() {
  const lang = await resolveLang();
  const t = dictionaries[lang].errors;

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${hanken.variable} antialiased`}
    >
      <body className="min-h-screen">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Compass className="h-7 w-7" />
          </div>
          <h1 className="font-display mt-6 text-3xl tracking-tight">
            {t.notFoundTitle}
          </h1>
          <p className="mt-3 text-muted-foreground">{t.notFoundText}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href={shopHref(lang)}>{t.shop}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={localePath(lang)}>{t.home}</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
