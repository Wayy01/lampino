import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Visible breadcrumb trail, the twin of `breadcrumbSchema`. The last item is
 * the current page: plain text, marked `aria-current`.
 */
export function Breadcrumbs({
  items,
  label,
  className,
}: {
  items: { name: string; href: string }[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="label-mono flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href} className="flex min-w-0 items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="truncate text-foreground">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.href} className="transition-colors hover:text-foreground">
                    {item.name}
                  </Link>
                  <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
