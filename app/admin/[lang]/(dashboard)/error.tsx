"use client";

// Catches anything thrown while rendering a dashboard page. Every admin page
// queries Prisma directly at the top level, so a database that is down took the
// whole CMS to Next's default error screen — no locale, no retry, no clue.
import Link from "next/link";
import { useParams } from "next/navigation";
import { RotateCw, TriangleAlert } from "lucide-react";
import { adminDictionaries, adminHref } from "@/lib/admin/i18n";
import { isLocale } from "@/lib/i18n/routing";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const params = useParams<{ lang: string }>();
  const lang = isLocale(params?.lang) ? params.lang : "ro";
  const t = adminDictionaries[lang].errors;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="font-display mt-5 text-2xl tracking-tight">
        {t.loadFailed}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t.loadFailedHint}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="group flex h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <RotateCw className="h-4 w-4 transition-transform group-hover:rotate-90" />
          {t.retry}
        </button>
        <Link
          href={adminHref(lang)}
          className="flex h-10 items-center rounded-[var(--radius-md)] border px-5 text-sm transition-colors hover:bg-foreground/[0.03]"
        >
          {t.backToDashboard}
        </Link>
      </div>

      {error.digest && (
        <p className="label-mono mt-7 text-muted-foreground">
          {t.errorCode}: {error.digest}
        </p>
      )}
    </div>
  );
}
