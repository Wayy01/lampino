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

// Async combobox over the Fan Courier city list (via the admin proxy). Unlike
// the Nova Post field, a city has no id — it's a (name, province) pair — so the
// pick fills two hidden fields: the city name and its county/province. Searches
// once an API key is saved; falls back to plain text otherwise.
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
  /** Seed the box (e.g. the order's city) and pre-run the search so a match is
   *  ready to pick the moment the form opens. */
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
  const [query, setQuery] = useState(isDisabled ? "" : seed);
  const [options, setOptions] = useState<City[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch matches for `v`; auto-select the first option when it's the only match
  // or when the field had no prior pick (a pre-filled value / first search).
  async function performSearch(v: string, autoSelectIfEmpty: boolean) {
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
      // Auto-committing the first option keeps the typed text in the box (the
      // operator didn't click it); a manual pick clears it.
      if (opts.length === 1 || (autoSelectIfEmpty && opts.length > 0)) select(opts[0], true);
    } catch {
      setStatus("error");
      setOptions([]);
    }
  }

  function runQuery(v: string) {
    setQuery(v);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setOptions([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const wasEmpty = !city;
    timer.current = setTimeout(() => performSearch(v.trim(), wasEmpty), 300);
  }

  function select(c: City, keepQuery = false) {
    setCity(c.name);
    setCounty(c.province ?? "");
    setSelectedLabel(cityLabel(c));
    if (!keepQuery) setQuery("");
    setOptions([]);
    setOpen(false);
    onSelect?.(c.name, c.province ?? "");
  }

  function clear() {
    setCity("");
    setCounty("");
    setSelectedLabel("");
    onSelect?.("", "");
  }

  // A pre-filled city triggers its own search (auto-selecting the first match
  // when nothing is chosen yet). Scheduled, never a synchronous setState.
  useEffect(() => {
    if (isDisabled || city) return;
    const q = seed.trim();
    if (q.length < 2) return;
    const h = setTimeout(() => performSearch(q, true), 0);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisabled]);

  return (
    <Field label={label}>
      <input type="hidden" name={cityName} value={city} />
      <input type="hidden" name={countyName} value={county} />
      <div ref={boxRef} className="relative">
        {selectedLabel && (
          <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-sm)] border bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            <button
              type="button"
              onClick={clear}
              aria-label={t.common.remove}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
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
      </div>
    </Field>
  );
}
