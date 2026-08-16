// Shown for `notFound()` inside the storefront — a product id that no longer
// resolves, an unpublished offers page, an unknown route under `/<lang>/`.
//
// Must stay a Server Component: a client `not-found.tsx` is ignored and Next
// renders its own bare 404 instead. It also gets no `params`, so the locale
// comes from the header `proxy.ts` sets rather than the route segment.
import { headers } from "next/headers";
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

export default async function StorefrontNotFound() {
  const requested = (await headers()).get(LOCALE_HEADER) ?? undefined;
  const lang = isLocale(requested) ? requested : "ro";
  const t = dictionaries[lang].errors;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
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
  );
}
