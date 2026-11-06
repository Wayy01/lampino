"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { RichText } from "@/components/site/rich-text";
import { useAdminT } from "@/lib/admin/i18n-provider";
import { autoFormat } from "@/lib/markdown";
import { cn } from "@/lib/utils";

const LINE_PREFIX = /^(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/;

/**
 * Markdown description field: a toolbar over a plain textarea plus a preview
 * rendered with the storefront's own `RichText`. Posts as a normal form field
 * under `name`, so server actions are unchanged.
 */
export function RichTextEditor({
  id,
  name,
  defaultValue = "",
}: {
  id: string;
  name: string;
  defaultValue?: string;
}) {
  const t = useAdminT().richText;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [beforeFormat, setBeforeFormat] = useState<string | null>(null);

  /**
   * Replace [start, end) with `text` through the browser's editing pipeline,
   * so Ctrl+Z still works; falls back to a direct state update.
   */
  function replace(start: number, end: number, text: string, select?: [number, number]) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = document.execCommand?.("insertText", false, text);
    if (!ok) {
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      setValue(next);
    }
    requestAnimationFrame(() => {
      const [a, b] = select ?? [start + text.length, start + text.length];
      el.setSelectionRange(a, b);
    });
  }

  function wrap(marker: string, placeholder: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const inner = v.slice(s, e);
    const m = marker.length;
    // Toggle off when the selection is already wrapped.
    if (v.slice(s - m, s) === marker && v.slice(e, e + m) === marker) {
      replace(s - m, e + m, inner, [s - m, e - m]);
      return;
    }
    const body = inner || placeholder;
    replace(s, e, `${marker}${body}${marker}`, [s + m, s + m + body.length]);
  }

  function prefixLines(make: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const v = el.value;
    const start = v.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const endNl = v.indexOf("\n", el.selectionEnd);
    const end = endNl === -1 ? v.length : endNl;
    const lines = v.slice(start, end).split("\n");
    // Toggle off when every line already carries this prefix.
    const allSet = lines.every((l, i) => l.startsWith(make(i)));
    const next = lines
      .map((l, i) => {
        const bare = l.replace(LINE_PREFIX, "");
        return allSet ? bare : `${make(i)}${bare}`;
      })
      .join("\n");
    replace(start, end, next, [start, start + next.length]);
  }

  function runAutoFormat() {
    const el = ref.current;
    if (!el) return;
    const formatted = autoFormat(el.value);
    if (formatted === el.value) return;
    setBeforeFormat(el.value);
    setMode("write");
    replace(0, el.value.length, formatted, [0, 0]);
  }

  function undoFormat() {
    if (beforeFormat === null) return;
    const el = ref.current;
    setMode("write");
    if (el) replace(0, el.value.length, beforeFormat, [0, 0]);
    else setValue(beforeFormat);
    setBeforeFormat(null);
  }

  const tools = [
    { key: "h1", label: t.heading1, icon: Heading1 },
    { key: "h2", label: t.heading2, icon: Heading2 },
    { key: "h3", label: t.heading3, icon: Heading3 },
    { key: "bold", label: t.bold, icon: Bold },
    { key: "italic", label: t.italic, icon: Italic },
    { key: "ul", label: t.bulletList, icon: List },
    { key: "ol", label: t.numberedList, icon: ListOrdered },
  ] as const;

  function runTool(key: (typeof tools)[number]["key"]) {
    if (key === "h1") prefixLines(() => "# ");
    else if (key === "h2") prefixLines(() => "## ");
    else if (key === "h3") prefixLines(() => "### ");
    else if (key === "bold") wrap("**", t.bold);
    else if (key === "italic") wrap("*", t.italic);
    else if (key === "ul") prefixLines(() => "- ");
    else prefixLines((i) => `${i + 1}. `);
  }

  const btn =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border bg-background focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-surface px-1.5 py-1">
        {tools.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            disabled={mode === "preview"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTool(key)}
            className={cn(btn, "w-8 px-0")}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          title={t.autoFormatHint}
          onMouseDown={(e) => e.preventDefault()}
          onClick={runAutoFormat}
          disabled={!value.trim()}
          className={cn(btn, "text-primary hover:text-primary")}
        >
          <WandSparkles className="h-4 w-4" strokeWidth={1.75} />
          {t.autoFormat}
        </button>
        {beforeFormat !== null && (
          <button type="button" onClick={undoFormat} className={btn}>
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
            {t.undo}
          </button>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(btn, mode === "write" && "bg-muted text-foreground")}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t.write}
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(btn, mode === "preview" && "bg-muted text-foreground")}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t.preview}
          </button>
        </div>
      </div>

      <textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={10}
        className={cn(
          "block min-h-[12rem] w-full resize-y bg-transparent px-3 py-2 font-mono text-[13px] leading-relaxed outline-none",
          mode === "preview" && "hidden",
        )}
      />
      {mode === "preview" && (
        <div className="min-h-[12rem] px-4 py-4">
          {value.trim() ? (
            <RichText source={value} className="text-sm md:text-base" />
          ) : (
            <p className="text-sm text-muted-foreground">{t.emptyPreview}</p>
          )}
        </div>
      )}

      <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">{t.syntaxHint}</p>
    </div>
  );
}
