"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { Field, TextInput } from "@/components/admin/form-controls";

type City = { name: string; province: string | null };
type Status = "idle" | "loading" | "error" | "nokey";

function cityLabel(c: City): string {
  return c.province ? `${c.name} (${c.province})` : c.name;
}

// Async combobox over the Fan Courier city list (via the admin proxy). A normal
// combobox: the box is either empty or shows an erasable chip for the committed
// city — a pick only happens when the operator clicks a result. The exception
// is the seed/drop path, which auto-commits the first match so a prefilled city
// becomes an honest chip (not loose text); if the seed matches nothing, a
// warning appears instead. A city has no id — it's a (name, province) pair — so
// the pick fills two hidden fields: the city name and its county/province.
export function FanCourierCityField({
  cityName,
  countyName,
  label,
  keySet,
  initialCity,
  onSelect,
}: {
  /** Hidden field that submits the chosen city name (e.g. "recipientCity"). */
  cityName: string;
  /** Hidden field that submits the chosen county/province (e.g. "recipientCounty"). */
  countyName: string;
  label: string;
  keySet: boolean;
  /** Seed the field (e.g. the order's city): searched on mount and auto-committed. */
  initialCity?: string | null;
  onSelect?: (city: string, county: string) => void;
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const isDisabled = !keySet;
  const seed = (initialCity ?? "").trim();

  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<City[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [seedMiss, setSeedMiss] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch matches for `v`. `commitFirst` (the seed/drop path) auto-commits the
  // first match — or records a miss when nothing comes back — so a prefilled
  // value never lingers in the box uncommitted. Manual searches never commit.
  async function performSearch(v: string, commitFirst: boolean) {
    setStatus("loading");
    try {
      const r = await fetch(`/api/admin/fancourier/cities?q=${encodeURIComponent(v)}`);
      if (r.status === 400) {
        const j = await r.json().catch(() => ({}));
        setStatus(j.error === "no_key" ? "nokey" : "error");
        setOptions([]);
        return;
      }
      if (!r.ok) {
        setStatus("error");
        setOptions([]);
        return;
      }
      const j = (await r.json()) as { options?: City[] };
      const opts = j.options ?? [];
      setOptions(opts);
      setStatus("idle");
      if (commitFirst) {
        if (opts.length > 0) select(opts[0]);
        else setSeedMiss(v);
      }
    } catch {
      setStatus("error");
      setOptions([]);
    }
  }

  function runQuery(v: string) {
    setQuery(v);
    setOpen(true);
    setSeedMiss(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setOptions([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(() => performSearch(v.trim(), false), 300);
  }

  function select(c: City) {
    setCity(c.name);
    setCounty(c.province ?? "");
    setSelectedLabel(cityLabel(c));
    setQuery("");
    setOptions([]);
    setOpen(false);
    setSeedMiss(null);
    onSelect?.(c.name, c.province ?? "");
  }

  function clear() {
    setCity("");
    setCounty("");
    setSelectedLabel("");
    setSeedMiss(null);
    onSelect?.("", "");
  }

  // Seed on mount: search and auto-commit the first match (or warn). Scheduled,
  // never a synchronous setState.
  useEffect(() => {
    if (isDisabled || city) return;
    if (seed.length < 2) return;
    const h = setTimeout(() => performSearch(seed, true), 0);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled]);

  // A dropped original-city reference re-runs the seed path: search + commit.
  function handleDrop(text: string) {
    if (!text) return;
    setSeedMiss(null);
    performSearch(text, true);
  }

  return (
    <Field label={label}>
      <input type="hidden" name={cityName} value={city} />
      <input type="hidden" name={countyName} value={county} />
      <div
        ref={boxRef}
        className={`relative rounded-[var(--radius-md)] ${
          dragOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
        onDragOver={
          isDisabled
            ? undefined
            : (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDragOver(true);
              }
        }
        onDragLeave={isDisabled ? undefined : () => setDragOver(false)}
        onDrop={
          isDisabled
            ? undefined
            : (e) => {
                e.preventDefault();
                setDragOver(false);
                handleDrop(e.dataTransfer.getData("text/plain").trim());
              }
        }
      >
        {selectedLabel ? (
          <div className="flex h-10 w-full items-center gap-2 rounded-[var(--radius-md)] border bg-background px-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            <button
              type="button"
              onClick={clear}
              aria-label={t.common.remove}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <TextInput
              value={query}
              onChange={(e) => runQuery(e.target.value)}
              onFocus={() => {
                if (query.trim().length < 2) return;
                setOpen(true);
                if (options.length === 0 && status === "idle") runQuery(query);
              }}
              placeholder={!keySet ? s.searchNeedsKey : s.searchCityPlaceholder}
              disabled={isDisabled}
              autoComplete="off"
            />
            {open && query.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius-md)] border bg-background shadow-lg">
                {status === "loading" && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">{s.searching}</div>
                )}
                {status === "nokey" && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">{s.searchNeedsKey}</div>
                )}
                {status === "error" && (
                  <div className="px-3 py-2 text-xs text-[var(--error,#EF4444)]">{s.searchError}</div>
                )}
                {status === "idle" && options.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">{s.searchNoResults}</div>
                )}
                {options.map((c, i) => (
                  <button
                    key={`${c.name}-${c.province ?? ""}-${i}`}
                    type="button"
                    onClick={() => select(c)}
                    className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/[0.05]"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.province && (
                      <span className="truncate text-xs text-muted-foreground">{c.province}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {seedMiss && !selectedLabel && (
        <p className="mt-1.5 text-xs text-[var(--warning,#F97316)]">
          {s.seedNoMatch} «{seedMiss}»
        </p>
      )}
    </Field>
  );
}
