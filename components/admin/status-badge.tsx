import { cn } from "@/lib/utils";

// One dot-plus-word vocabulary for every status in the schema (orders and
// rental applications) and for the active/inactive flags.
const DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-600",
  approved: "bg-sky-600",
  shipped: "bg-violet-500",
  delivered: "bg-emerald-600",
  completed: "bg-emerald-600",
  cancelled: "bg-red-500",
  rejected: "bg-red-500",
  active: "bg-emerald-600",
  inactive: "bg-muted-foreground/50",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Translated label; falls back to the raw status string. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        !label && "capitalize",
        status === "inactive" && "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          DOT[status] ?? "bg-muted-foreground/50",
        )}
      />
      {label ?? status}
    </span>
  );
}
