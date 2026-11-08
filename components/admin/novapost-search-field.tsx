"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { Field, TextInput } from "@/components/admin/form-controls";
import { useComboboxSearch } from "@/components/admin/use-combobox-search";

type Option = {
  id: number;
  name: string;
  number?: string | null;
  address?: string | null;
  region?: string | null;
  postCode?: string | null;
};

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
  // Streets submit the chosen *name* and accept an unmatched street as free
  // text, so their box legitimately holds text. Id-based fields (settlements,
  // divisions) are a strict combobox: empty box or committed chip, nothing in
  // between — their seed auto-commits to a chip, or warns if it matched nothing.
  const isFreeText = submit === "label";
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
  // The entity's bare name, submitted via `labelName` (and as the street value):
  // the decorated label ("Name — Region · PostCode") is display-only — it must
  // never reach the waybill, where settlementName becomes the printed city.
  const [selectedName, setSelectedName] = useState(defaultLabel || "");
  const [dragOver, setDragOver] = useState(false);

  const {
    query,
    setQuery,
    options,
    status,
    open,
    setOpen,
    seedMiss,
    setSeedMiss,
    boxRef,
    runQuery,
    performSearch,
    resetSearch,
    minChars,
  } = useComboboxSearch<Option>({
    initialQuery: isDisabled ? "" : isFreeText ? seedQuery : "",
    buildUrl: (v) => {
      const filter =
        (type === "divisions" || type === "streets") && settlementId
          ? `&settlementId=${settlementId}`
          : "";
      return `/api/admin/novapost/search?type=${type}&q=${encodeURIComponent(v)}${filter}`;
    },
    onCommitFirst: (o) => select(o, isFreeText),
  });

  function select(o: Option, keepQuery = false) {
    setSelectedId(String(o.id));
    setSelectedLabel(optionLabel(o));
    setSelectedName(o.name);
    resetSearch(keepQuery);
    onSelect?.(String(o.id), optionLabel(o));
  }

  function clear() {
    setSelectedId("");
    setSelectedLabel("");
    setSelectedName("");
    setSeedMiss(null);
    onSelect?.("", "");
  }

  // A dropped reference (e.g. the order's original city) re-runs the seed path
  // for id fields (search + commit), or just fills a free-text street box.
  function handleDrop(text: string) {
    if (!text) return;
    if (isFreeText) {
      runQuery(text);
    } else {
      setSeedMiss(null);
      performSearch(text, true);
    }
  }

  // A branch belongs to a settlement; if the settlement changes, drop the stale
  // pick (and any query) so it can't be submitted against the wrong city. This
  // is the render-phase "adjust state when a prop changes" pattern.
  const [prevSettlement, setPrevSettlement] = useState(settlementId);
  if (prevSettlement !== settlementId) {
    setPrevSettlement(settlementId);
    setSelectedId("");
    setSelectedLabel("");
    setSelectedName("");
    // Clears query/options/open/seedMiss and cancels any in-flight request; id
    // fields re-seed into a chip via the effect below, only a free-text street
    // puts the city back in the box.
    resetSearch();
    if (isFreeText && settlementId) setQuery(seedQuery);
  }

  // A pre-filled value triggers its own search. Only the settlement auto-commits
  // its first match (the order's city has one obvious hit); a branch or street
  // must be picked deliberately — a city has dozens of branches, and silently
  // committing an arbitrary one shipped parcels to pickup points the customer
  // never chose. Re-runs when the field becomes enabled or its settlement scope
  // changes, so a re-seeded branch/street searches too.
  useEffect(() => {
    if (isDisabled || selectedId) return;
    const q = (seedQuery || "").trim();
    if (q.length < 2) return;
    const h = setTimeout(() => {
      if (type === "settlements") {
        performSearch(q, true);
      } else {
        // Pre-run the search and show the list, but leave the pick to the
        // operator: the seed text goes into the box so the dropdown renders.
        setQuery(q);
        setOpen(true);
        performSearch(q, false);
      }
    }, 0);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId, isDisabled]);

  // Streets submit the chosen bare name; with none picked, the raw query is the
  // free-text fallback (Nova Post accepts an unmatched street).
  const submittedValue = submit === "label" ? selectedName || query : selectedId;

  return (
    <Field label={label}>
      <input type="hidden" name={name} value={submittedValue} />
      {labelName && <input type="hidden" name={labelName} value={selectedName} />}
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
                handleDrop(e.dataTransfer.getData("text/plain").trim());
              }
            : undefined
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
                if (query.trim().length < minChars) return;
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
            {open && query.trim().length >= minChars && (
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
          </>
        )}
      </div>
      {seedMiss && !selectedLabel && (
        <p className="mt-1.5 text-xs text-[var(--warning,#F97316)]">
          {/* Id fields have no committed pick, so warn plainly. Free-text streets
              keep the typed text in the box (and submit it), so say it's being
              sent as typed — otherwise the filled-looking box reads as a verified
              selection when nothing matched. */}
          {isFreeText ? s.seedUsingTyped : s.seedNoMatch} «{seedMiss}»
        </p>
      )}
    </Field>
  );
}
