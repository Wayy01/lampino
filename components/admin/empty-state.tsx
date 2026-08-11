/** Quiet placeholder for empty lists and filter dead-ends. */
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="text-muted-foreground/60">{icon}</span>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
