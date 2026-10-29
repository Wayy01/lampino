// A deliberately tiny Markdown subset for product / rental descriptions:
// `#`–`###` headings, paragraphs, `-` and `1.` lists, `**bold**`, `*italic*`.
// Plain text (every legacy description) is valid input and renders as
// paragraphs, so no data migration is needed. Shared by the admin preview
// and the storefront renderer — pure functions, no DOM.

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  | { type: "italic"; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", children: parseInline(m[1]) });
    else out.push({ type: "italic", children: parseInline(m[2]) });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", level: h[1].length as 1 | 2 | 3, content: parseInline(h[2]) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    if (b || o) {
      flushPara();
      const ordered = !!o;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((b ?? o)![1]);
      continue;
    }
    // A plain line right after a list item continues that item.
    if (list) {
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Markdown → plain text, for meta descriptions and JSON-LD. */
export function stripMarkdown(source: string): string {
  return source
    .replace(/^\s*#{1,3}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(?!\s)(.+?)(?<!\s)\*/g, "$1");
}

// ---------------------------------------------------------------------------
// Auto-format: a best-effort first pass that turns a wall of plain text into
// structured Markdown. It is only a starting point — the result lands in the
// editor and stays fully editable.

const SENTENCE_SPLIT = /(?<=[.!?…])\s+(?=["„«(]?[A-ZĂÂÎȘŞȚŢА-ЯЁ0-9])/u;
const UNIT =
  "(?:%|W|kW|V|mA|A|Ah|mAh|K|lm|lx|Hz|m|cm|mm|km|kg|g|h|ore|ani|zile|metri|metru|leduri|LED-uri|LED|becuri|м|см|мм|кг|лм|Вт|В|ч|часов|лет|метр(?:а|ов)?|светодиод(?:а|ов)?)";
const HIGHLIGHT = new RegExp(
  [
    `\\b\\d+(?:[.,]\\d+)?(?:\\s?[x×]\\s?\\d+(?:[.,]\\d+)?)*\\s?(?:de\\s)?${UNIT}(?![\\p{L}\\d])`,
    "\\bIP\\s?\\d{2}\\b",
  ].join("|"),
  "gu",
);

const isMarkdownLine = (l: string) => HEADING.test(l) || BULLET.test(l) || ORDERED.test(l);

/** Bold technical figures (IP65, 3 metri, 3000 de leduri, 10%) outside existing emphasis. */
function highlight(text: string): string {
  return text
    .split(/(\*\*.+?\*\*)/g)
    .map((part, i) => (i % 2 ? part : part.replace(HIGHLIGHT, (m) => `**${m.trim()}**`)))
    .join("");
}

/** Group sentences into paragraphs of roughly `target` characters. */
function chunkSentences(text: string, target = 380): string[] {
  const sentences = text.split(SENTENCE_SPLIT).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > target) {
      out.push(cur);
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function looksLikeHeading(line: string, next: string | undefined): boolean {
  if (!next || line.length > 70) return false;
  if (/[.,;!?]$/.test(line)) return false;
  if (line.endsWith(":")) return true;
  return line.split(/\s+/).length <= 8 && /^\p{Lu}/u.test(line);
}

export function autoFormat(source: string): string {
  const text = source
    .replace(/\r\n?/g, "\n")
    // `//`, `|`-separated runs and `;;` are common "new section" markers in pasted copy.
    .replace(/\s*(?:\/\/|\|\||;;)\s*/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!text) return "";

  const sections = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (isMarkdownLine(line)) {
        // Already structured — normalize bullets, keep the rest.
        out.push(line.replace(/^[*•]\s+/, "- "));
        continue;
      }

      // Bullets typed with other glyphs.
      const glyph = /^[–—✓✔►▪●·]\s*(.+)$/u.exec(line);
      if (glyph) {
        out.push(`- ${highlight(glyph[1])}`);
        continue;
      }

      // Runs of `Key: value` lines become a bulleted spec list.
      const kv = /^([^:]{2,32}):\s+(.+)$/.exec(line);
      const nextKv = lines[i + 1] && /^[^:]{2,32}:\s+.+$/.test(lines[i + 1]);
      const prevKv = i > 0 && /^[^:]{2,32}:\s+.+$/.test(lines[i - 1]);
      if (kv && (nextKv || prevKv)) {
        out.push(`- **${kv[1].trim()}:** ${kv[2]}`);
        continue;
      }

      if (looksLikeHeading(line, lines[i + 1] ?? sections[sections.indexOf(section) + 1])) {
        line = line.replace(/:$/, "");
        out.push("", `## ${line}`, "");
        continue;
      }

      // Long prose: split into readable paragraphs and bold key figures.
      for (const p of chunkSentences(line)) out.push("", highlight(p), "");
    }
    out.push("");
  }

  // Lists need a blank line before following prose, but not between items.
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
