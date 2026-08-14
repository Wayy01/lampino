// Pure formatting shared by the analytics server page (stat card) and the
// client tables. Kept out of `analytics.ts` (which imports prisma) so the
// client bundle never pulls in the database client, and out of any "use
// client" module so the server can actually execute it rather than receive a
// client reference.

/** "1m 23s" / "45s" / "—" from an average millisecond count. */
export function formatDwell(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}
