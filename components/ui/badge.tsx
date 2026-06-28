import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  tone = "default",
}: {
  className?: string;
  children: React.ReactNode;
  tone?: "default" | "primary" | "ink";
}) {
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1.5 rounded-full px-3 py-1",
        tone === "default" && "bg-foreground/[0.04] text-muted-foreground",
        tone === "primary" && "bg-accent text-accent-foreground",
        tone === "ink" && "bg-foreground text-background",
        className,
      )}
    >
      {children}
    </span>
  );
}
