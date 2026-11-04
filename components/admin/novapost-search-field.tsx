"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { Field, TextInput } from "@/components/admin/form-controls";

type Option = {
  id: number;
  name: string;
  number?: string | null;
  address?: string | null;
  region?: string | null;
  postCode?: string | null;
};

type Status = "idle" | "loading" | "error" | "nokey";

function optionLabel(o: Option): string {
  const parts = [o.name];
  if (o.number) parts[0] = `${o.name} №${o.number}`;
  const extra = o.address || [o.region, o.postCode].filter(Boolean).join(" · ");
  return extra ? `${parts[0]} — ${extra}` : parts[0];
}

// Async combobox that searches the Nova Post API (via the admin proxy) and
// stores the chosen entity's id in a hidden field the form submits. The search
// only works once an API key is saved; otherwise it falls back to plain text so
// an existing id is still editable.
export function NovaPostSearchField({
  name,
  labelName,
  type,
  label,
  defaultValue,
  defaultLabel,
  keySet,
  initialQuery,
  settlementId,
  disabled,
  placeholder,
  onSelect,
  submit = "id",
  acceptDrop = false,
}: {
  name: string;
  /** Optional hidden field that stores the chosen entity's display name, so the
   *  config screen re-renders a human label instead of a bare id. */
  labelName?: string;
  type: "divisions" | "settlements" | "streets";
  label: string;
  defaultValue?: string | null;
  defaultLabel?: string | null;
  keySet: boolean;
  /** Seed the search box (e.g. the order's city) and pre-run the search so a
   *  match is ready to pick the moment the drawer opens. */
  initialQuery?: string | null;
  /** When set (divisions/streets), scope results to this settlement; changing it
   *  clears any prior pick, so a branch/street can't outlive the city it belonged
   *  to. */
  settlementId?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Notifies the parent of the chosen id/label (and "" on clear). */
  onSelect?: (id: string, label: string) => void;
  /** What the hidden field submits: the entity `id` (default) or its `label` —
   *  streets have no useful id downstream, so they submit the chosen name (and
   *  the raw query as a free-text fallback when nothing is picked). */
  submit?: "id" | "label";
  /** Accept a dragged address part: dropping runs a search for its text. */
  acceptDrop?: boolean;
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const isDisabled = !keySet || Boolean(disabled);
  // Seed the box from the order (e.g. its city) so the admin just focuses and
  // picks a match instead of retyping. Branch addresses carry the city name, so
  // the same seed scopes the branch list to that city. Never seed over an
  // already-chosen value or while the field is still disabled.
  const seedQuery =
    !(defaultValue ?? "") && (initialQuery ?? "").trim().length >= 2
      ? (initialQuery ?? "").trim()
      : "";
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [selectedLabel, setSelectedLabel] = useState(
    defaultLabel || (defaultValue ? `#${defaultValue}` : ""),
  );
  const [query, setQuery] = useState(isDisabled ? "" : seedQuery);
  const [options, setOptions] = useState<Option[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
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

  // Fetch matches for `v`. Per the search rules, auto-select the first option
  // when it's the only match, or when `autoSelectIfEmpty` (the field had no
  // prior pick — a pre-filled value, or the first manual search).
  async function performSearch(v: string, autoSelectIfEmpty: boolean) {
    setStatus("loading");
    try {
      const filter =
        (type === "divisions" || type === "streets") && settlementId
          ? `&settlementId=${settlementId}`
          : "";
      const r = await fetch(
        `/api/admin/novapost/search?type=${type}&q=${encodeURIComponent(v)}${filter}`,
      );
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
      const j = (await r.json()) as { options?: Option[] };
      const opts = j.options ?? [];
      setOptions(opts);
      setStatus("idle");
      // Auto-committing the first option keeps the typed text in the box (the
      // operator didn't click it); a manual pick clears it.
      if (opts.length === 1 || (autoSelectIfEmpty && opts.length > 0)) {
        select(opts[0], true);
      }
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
    const wasEmpty = !selectedId;
    timer.current = setTimeout(() => performSearch(v.trim(), wasEmpty), 300);
  }

  function select(o: Option, keepQuery = false) {
    setSelectedId(String(o.id));
    setSelectedLabel(optionLabel(o));
    if (!keepQuery) setQuery("");
    setOptions([]);
    setOpen(false);
    onSelect?.(String(o.id), optionLabel(o));
  }

  function clear() {
    setSelectedId("");
    setSelectedLabel("");
    onSelect?.("", "");
  }

  // A branch belongs to a settlement; if the settlement changes, drop the stale
  // pick (and any query) so it can't be submitted against the wrong city. This
  // is the render-phase "adjust state when a prop changes" pattern.
  const [prevSettlement, setPrevSettlement] = useState(settlementId);
  if (prevSettlement !== settlementId) {
    setPrevSettlement(settlementId);
    setSelectedId("");
    setSelectedLabel("");
    // Re-seed with the city (now that the field is enabled) rather than blanking.
    setQuery(settlementId ? seedQuery : "");
    setOptions([]);
    setOpen(false);
  }

  // A pre-filled value triggers its own search (and, with nothing chosen yet,
  // auto-selects the first match). Re-runs when the field becomes enabled or its
  // settlement scope changes, so a re-seeded branch/street searches too.
  useEffect(() => {
    if (isDisabled || selectedId) return;
    const q = (seedQuery || "").trim();
    if (q.length < 2) return;
    const h = setTimeout(() => performSearch(q, true), 0);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId, isDisabled]);

  // Streets submit the chosen name; with none picked, the raw query is the
  // free-text fallback (Nova Post accepts an unmatched street).
  const submittedValue = submit === "label" ? selectedLabel || query : selectedId;

  return (
    <Field label={label}>
      <input type="hidden" name={name} value={submittedValue} />
      {labelName && <input type="hidden" name={labelName} value={selectedLabel} />}
      <div
        ref={boxRef}
        className={`relative rounded-[var(--radius-md)] ${
          dragOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
        onDragOver={
          acceptDrop && !isDisabled
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDragOver(true);
              }
            : undefined
        }
        onDragLeave={acceptDrop ? () => setDragOver(false) : undefined}
        onDrop={
          acceptDrop && !isDisabled
            ? (e) => {
                e.preventDefault();
                setDragOver(false);
                const text = e.dataTransfer.getData("text/plain").trim();
                if (text) runQuery(text);
              }
            : undefined
        }
      >
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
            // Pre-seeded (e.g. the order's city) but not yet searched — fetch now.
            if (options.length === 0 && status === "idle") runQuery(query);
          }}
          placeholder={
            !keySet ? s.searchNeedsKey : disabled && placeholder ? placeholder : s.searchPlaceholder
          }
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
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o)}
                className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-foreground/[0.05]"
              >
                <span className="truncate">{o.number ? `${o.name} №${o.number}` : o.name}</span>
                {(o.address || o.region) && (
                  <span className="truncate text-xs text-muted-foreground">
                    {o.address || [o.region, o.postCode].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
