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
}: {
  name: string;
  /** Optional hidden field that stores the chosen entity's display name, so the
   *  config screen re-renders a human label instead of a bare id. */
  labelName?: string;
  type: "divisions" | "settlements";
  label: string;
  defaultValue?: string | null;
  defaultLabel?: string | null;
  keySet: boolean;
}) {
  const t = useAdminT();
  const s = t.settings.shipping;
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [selectedLabel, setSelectedLabel] = useState(
    defaultLabel || (defaultValue ? `#${defaultValue}` : ""),
  );
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
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
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/novapost/search?type=${type}&q=${encodeURIComponent(v.trim())}`,
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
        setOptions(j.options ?? []);
        setStatus("idle");
      } catch {
        setStatus("error");
        setOptions([]);
      }
    }, 300);
  }

  function select(o: Option) {
    setSelectedId(String(o.id));
    setSelectedLabel(optionLabel(o));
    setQuery("");
    setOptions([]);
    setOpen(false);
  }

  function clear() {
    setSelectedId("");
    setSelectedLabel("");
  }

  return (
    <Field label={label}>
      <input type="hidden" name={name} value={selectedId} />
      {labelName && <input type="hidden" name={labelName} value={selectedLabel} />}
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
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={keySet ? s.searchPlaceholder : s.searchNeedsKey}
          disabled={!keySet}
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
