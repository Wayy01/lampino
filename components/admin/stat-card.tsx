/** Dashboard metric: mono label, display-serif value, small icon. */
export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius)] border bg-surface p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className="font-display mt-3 text-3xl tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
