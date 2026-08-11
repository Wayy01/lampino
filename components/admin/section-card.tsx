import { cn } from "@/lib/utils";

/** White surface panel used for every block of content in the admin. */
export function SectionCard({
  title,
  icon,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius)] border bg-surface shadow-[0_1px_0_0_rgba(0,0,0,0.03)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="flex items-center gap-2.5 font-medium">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
