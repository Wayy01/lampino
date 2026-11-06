"use client";

import { useEffect, useRef, useState } from "react";

// Shared search state machine for the courier autocomplete comboboxes (Nova Post
// settlements/divisions/streets, Fan Courier cities). It owns the debounce, the
// outside-click close, and — crucially — a request-sequence + abort guard so a
// slow earlier response can never clobber a newer query's results (or auto-
// commit a stale first match). Each field supplies only how to build the request
// URL and what to do with an auto-committed first match.

export type ComboStatus = "idle" | "loading" | "error" | "nokey";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

export function useComboboxSearch<T>({
  buildUrl,
  onCommitFirst,
  initialQuery = "",
}: {
  /** Build the proxy request URL for a (trimmed) query. */
  buildUrl: (query: string) => string;
  /** Auto-commit path (seed/drop): called with the first match, or not at all
   *  when the search returned nothing (a miss is recorded instead). */
  onCommitFirst: (first: T) => void;
  /** Initial box text (only read on first render) — a free-text field seeds its
   *  box so the typed value is visible while its seed search runs. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [options, setOptions] = useState<T[]>([]);
  const [status, setStatus] = useState<ComboStatus>("idle");
  const [open, setOpen] = useState(false);
  const [seedMiss, setSeedMiss] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Monotonic request id + the in-flight controller: only the newest request is
  // allowed to write state, and starting a new one aborts the previous.
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  // Keep the latest commit callback reachable from async closures. Seeded by
  // useRef on mount, refreshed after each render (never written during render).
  const commitRef = useRef(onCommitFirst);
  useEffect(() => {
    commitRef.current = onCommitFirst;
  });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Cancel any pending debounce + in-flight request on unmount so a resolved
  // fetch can't setState after the drawer closes.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  // Fetch matches for `v`. `commitFirst` (seed/drop path) auto-commits the first
  // match or records a miss; manual searches never commit. Stale responses (a
  // newer search started, or this one was aborted) write nothing.
  async function performSearch(v: string, commitFirst: boolean) {
    const id = ++seq.current;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setStatus("loading");
    try {
      const r = await fetch(buildUrl(v), { signal: ac.signal });
      if (id !== seq.current) return;
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
      const j = (await r.json()) as { options?: T[] };
      if (id !== seq.current) return;
      const opts = j.options ?? [];
      setOptions(opts);
      setStatus("idle");
      if (commitFirst) {
        if (opts.length > 0) commitRef.current(opts[0]);
        else setSeedMiss(v);
      }
    } catch {
      // Superseded or aborted — leave the newer request to own the state.
      if (id !== seq.current || ac.signal.aborted) return;
      setStatus("error");
      setOptions([]);
    }
  }

  function runQuery(v: string) {
    setQuery(v);
    setOpen(true);
    setSeedMiss(null);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < MIN_CHARS) {
      abort.current?.abort();
      seq.current += 1; // ignore any in-flight response for the now-too-short query
      setOptions([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(() => performSearch(v.trim(), false), DEBOUNCE_MS);
  }

  // Clear transient search state after a pick/clear, ignoring any late response.
  // `keepQuery` preserves the typed text (a free-text street keeps what the
  // operator typed even after it commits); otherwise the box is emptied.
  function resetSearch(keepQuery = false) {
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
    seq.current += 1;
    if (!keepQuery) setQuery("");
    setOptions([]);
    setOpen(false);
    setSeedMiss(null);
    setStatus("idle");
  }

  return {
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
    minChars: MIN_CHARS,
  };
}
