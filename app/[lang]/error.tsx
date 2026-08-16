"use client";

// Catches anything thrown while rendering a storefront page — most often a
// `lib/data/*` query against a database that is down or slow. Without it the
// customer got Next's unstyled "Application error" screen with no way back.
import Link from "next/link";
import { useParams } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { isLocale, localePath, shopHref } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export default function StorefrontError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // The boundary sits inside `[lang]`, so the segment is always there — but it
  // arrives as a raw string, and an unknown value must not crash the fallback.
  const params = useParams<{ lang: string }>();
  const lang = isLocale(params?.lang) ? params.lang : "ro";
  const t = dictionaries[lang].errors;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <h1 className="font-display mt-6 text-3xl tracking-tight">
        {t.pageTitle}
      </h1>
      <p className="mt-3 text-muted-foreground">{t.pageText}</p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()} size="lg" className="group">
          <RotateCw className="h-4 w-4 transition-transform group-hover:rotate-90" />
          {t.retry}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={localePath(lang)}>{t.home}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={shopHref(lang)}>{t.shop}</Link>
        </Button>
      </div>

      {/* The digest is the only handle support has for finding this in the
          server logs — production strips the message itself. */}
      {error.digest && (
        <p className="label-mono mt-8 text-muted-foreground">
          {t.errorCode}: {error.digest}
        </p>
      )}
    </main>
  );
}
