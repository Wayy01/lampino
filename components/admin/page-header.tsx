import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Consistent page top: optional back link, display-serif title, optional
 * count, and a right-aligned actions slot. No kickers, no descriptions.
 */
export function PageHeader({
  title,
  count,
  backHref,
  backLabel,
  actions,
}: {
  title: React.ReactNode;
  count?: number;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 lg:mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight lg:text-4xl">
          {title}
          {count !== undefined && (
            <span className="ml-3 align-middle font-mono text-sm text-muted-foreground">
              {count}
            </span>
          )}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
