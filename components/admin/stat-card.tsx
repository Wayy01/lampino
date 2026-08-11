import Link from "next/link";
import { cn } from "@/lib/utils";

/** Dashboard metric: mono label, display-serif value, small icon. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
  /** Turns the card into a link to the section it summarizes. */
  href?: string;
}) {
  const className = cn(
    "block rounded-[var(--radius)] border bg-surface p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]",
    href && "transition-colors hover:bg-foreground/[0.02]",
  );

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="font-display mt-3 text-3xl tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
    </>
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
