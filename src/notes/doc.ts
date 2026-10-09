// Reading a note's Tiptap JSON as simple blocks of text, for the study tools (cards, quiz, summary),
// the notes home and the knowledge graph. Pure: runs on the server and in the browser.
//
// The blocks the note editor writes (src/components/editor/blocks/schema.ts):
//   flashcard {id} > [flashcardFront > paragraph+, flashcardBack > (paragraph | bulletList | orderedList)+]
//   callout {kind: idea | definition | rule | example | warning} > block+
//   toggle {id} > [toggleSummary (inline*), toggleContent > block+]
//   mathInline {src}, mathBlock {src}: maths in the learning center's display language
//   table > tableRow > (tableHeader | tableCell) > paragraph+
//   [[links]]: a link mark with href "/p/<id>"; pageLink {id, title} blocks for sub-pages
// Atoms without study text (diagram, sketch, plot, file, deckEmbed, lessonLink, image) are skipped.

import { plainMath } from "@/learn/engine/display";

/** A Tiptap JSON node (the parts we read). */
export type JNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

/** A run of text. `math` holds display-language source; `blank` is a cloze gap. */
export type Seg = { text: string; bold?: boolean; italic?: boolean; mark?: boolean; math?: boolean; blank?: boolean };
export type Line = Seg[];

export type CalloutKind = "idea" | "definition" | "rule" | "example" | "warning";

/** Where a block sits: inside a callout, a list, a quote… */
export type Ctx = { callout?: CalloutKind; quote?: boolean; toggle?: boolean; depth: number };

export type Block =
  | { type: "heading"; level: number; line: Line }
  | { type: "para"; line: Line; ctx: Ctx }
  | { type: "item"; line: Line; ordered: boolean; task?: boolean; ctx: Ctx }
  | { type: "math"; src: string; ctx: Ctx }
  | { type: "code"; text: string }
  | { type: "table"; rows: Line[][]; header: boolean }
  | { type: "flashcard"; id: string | null; front: Line[]; back: Line[] }
  | { type: "toggle"; summary: Line; body: Block[] }
  | { type: "callout"; kind: CalloutKind; body: Block[] };

const CALLOUTS: CalloutKind[] = ["idea", "definition", "rule", "example", "warning"];

export function isDoc(content: unknown): content is JNode {
  return Boolean(content) && typeof content === "object" && (content as JNode).type === "doc";
}

/** Inline content of a textblock as segments. Hard breaks become "\n". */
export function inlineLine(nodes: JNode[] | undefined): Line {
  const out: Line = [];
  for (const n of nodes ?? []) {
    if (n.type === "text" && n.text) {
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      out.push({
        text: n.text,
        ...(marks.has("bold") && { bold: true }),
        ...(marks.has("italic") && { italic: true }),
        ...(marks.has("highlight") && { mark: true }),
      });
    } else if (n.type === "mathInline") {
      const src = String(n.attrs?.src ?? "").trim();
      if (src) out.push({ text: src, math: true });
    } else if (n.type === "hardBreak") {
      out.push({ text: "\n" });
    } else if (n.content) {
      // Unknown inline wrappers: keep their text.
      out.push(...inlineLine(n.content));
    }
  }
  return mergeSegs(out);
}

/** Joins neighbouring segments with the same style. */
export function mergeSegs(line: Line): Line {
  const out: Line = [];
  for (const s of line) {
    const prev = out[out.length - 1];
    if (prev && !prev.math && !s.math && !prev.blank && !s.blank && !!prev.bold === !!s.bold && !!prev.italic === !!s.italic && !!prev.mark === !!s.mark) {
      prev.text += s.text;
    } else out.push({ ...s });
  }
  return out;
}

/** The line as plain text (maths as readable text: "a² + b² = c²"). */
export function plain(line: Line): string {
  return line
    .map((s) => (s.blank ? "___" : s.math ? plainMath(s.text) : s.text))
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const plainAll = (lines: Line[]) => lines.map(plain).filter(Boolean).join("\n");

/** Splits a line at hard breaks. */
export function splitLines(line: Line): Line[] {
  const lines: Line[] = [[]];
  for (const s of line) {
    if (s.math || !s.text.includes("\n")) {
      lines[lines.length - 1].push(s);
      continue;
    }
    s.text.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...s, text: part });
    });
  }
  return lines.map(trimLine).filter((l) => l.length > 0);
}

/** Without leading and trailing whitespace (and without empty segments). */
export function trimLine(line: Line): Line {
  const out = line.filter((s) => s.math || s.text.length > 0).map((s) => ({ ...s }));
  while (out.length && !out[0].math && !out[0].text.trim()) out.shift();
  while (out.length && !out[out.length - 1].math && !out[out.length - 1].text.trim()) out.pop();
  if (out.length && !out[0].math) out[0].text = out[0].text.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last && !last.math) last.text = last.text.replace(/\s+$/, "");
  return out;
}

/** Cuts a line at character offsets of its plain (non-math) text: [from, to). Maths counts as one character. */
export function sliceLine(line: Line, from: number, to = Infinity): Line {
  const out: Line = [];
  let pos = 0;
  for (const s of line) {
    const len = s.math ? 1 : s.text.length;
    const a = Math.max(from, pos);
    const b = Math.min(to, pos + len);
    if (b > a) out.push(s.math ? { ...s } : { ...s, text: s.text.slice(a - pos, b - pos) });
    pos += len;
  }
  return out;
}

/** The text used for offsets in sliceLine: maths as one placeholder character. */
export function offsetText(line: Line): string {
  return line.map((s) => (s.math ? "￼" : s.text)).join("");
}

function calloutKind(value: unknown): CalloutKind {
  return CALLOUTS.includes(value as CalloutKind) ? (value as CalloutKind) : "idea";
}

/** All textblocks inside a node as lines (for flashcard sides and table cells). */
function linesOf(node: JNode | undefined): Line[] {
  if (!node) return [];
  const out: Line[] = [];
  const walk = (n: JNode, depth: number) => {
    if (n.type === "paragraph" || n.type === "heading" || n.type === "toggleSummary") {
      const line = trimLine(inlineLine(n.content));
      if (line.length) out.push(...splitLines(line));
      return;
    }
    if (n.type === "mathBlock") {
      const src = String(n.attrs?.src ?? "").trim();
      if (src) out.push([{ text: src, math: true }]);
      return;
    }
    for (const c of n.content ?? []) walk(c, n.type === "listItem" || n.type === "taskItem" ? depth + 1 : depth);
  };
  walk(node, 0);
  return out;
}

/** The note as a flat list of blocks (containers like callouts and toggles keep their children). */
export function toBlocks(doc: unknown): Block[] {
  if (!isDoc(doc)) return [];
  const walk = (nodes: JNode[] | undefined, ctx: Ctx): Block[] => {
    const out: Block[] = [];
    for (const n of nodes ?? []) {
      switch (n.type) {
        case "heading": {
          const line = trimLine(inlineLine(n.content));
          if (line.length) out.push({ type: "heading", level: Number(n.attrs?.level ?? 2), line });
          break;
        }
        case "paragraph": {
          const line = trimLine(inlineLine(n.content));
          if (line.length) out.push({ type: "para", line, ctx });
          break;
        }
        case "bulletList":
        case "orderedList":
        case "taskList": {
          for (const item of n.content ?? []) {
            const [first, ...rest] = item.content ?? [];
            const line = first?.type === "paragraph" ? trimLine(inlineLine(first.content)) : [];
            if (line.length) out.push({ type: "item", line, ordered: n.type === "orderedList", task: n.type === "taskList", ctx });
            out.push(...walk(first?.type === "paragraph" ? rest : item.content, { ...ctx, depth: ctx.depth + 1 }));
          }
          break;
        }
        case "blockquote":
          out.push(...walk(n.content, { ...ctx, quote: true }));
          break;
        case "callout": {
          const kind = calloutKind(n.attrs?.kind);
          out.push({ type: "callout", kind, body: walk(n.content, { ...ctx, callout: kind }) });
          break;
        }
        case "toggle": {
          const summary = n.content?.find((c) => c.type === "toggleSummary");
          const body = n.content?.find((c) => c.type === "toggleContent");
          out.push({ type: "toggle", summary: trimLine(inlineLine(summary?.content)), body: walk(body?.content, { ...ctx, toggle: true }) });
          break;
        }
        case "flashcard": {
          const front = n.content?.find((c) => c.type === "flashcardFront");
          const back = n.content?.find((c) => c.type === "flashcardBack");
          const id = typeof n.attrs?.id === "string" && n.attrs.id ? (n.attrs.id as string) : null;
          out.push({ type: "flashcard", id, front: linesOf(front), back: linesOf(back) });
          break;
        }
        case "mathBlock": {
          const src = String(n.attrs?.src ?? "").trim();
          if (src) out.push({ type: "math", src, ctx });
          break;
        }
        case "codeBlock": {
          const text = (n.content ?? []).map((c) => c.text ?? "").join("");
          if (text.trim()) out.push({ type: "code", text });
          break;
        }
        case "table": {
          const rows: Line[][] = [];
          let header = false;
          (n.content ?? []).forEach((row, i) => {
            const cells = (row.content ?? []).map((cell) => {
              if (i === 0 && cell.type === "tableHeader") header = true;
              return linesOf(cell).reduce<Line>((acc, l, j) => (j ? [...acc, { text: " " }, ...l] : l), []);
            });
            if (cells.some((c) => c.length)) rows.push(cells);
          });
          if (rows.length) out.push({ type: "table", rows, header });
          break;
        }
        default:
          // Wrappers we don't know (and future containers): read what's inside.
          if (n.content && !n.type?.startsWith("table")) out.push(...walk(n.content, ctx));
      }
    }
    return out;
  };
  return walk((doc as JNode).content, { depth: 0 });
}

/** Every block, with containers opened up (callout and toggle children follow their container). */
export function flatBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.type === "callout" || b.type === "toggle") out.push(...flatBlocks(b.body));
  }
  return out;
}

/** The note's text as plain lines (headings, paragraphs, list items, cells). */
export function docText(doc: unknown): string {
  const lines: string[] = [];
  for (const b of flatBlocks(toBlocks(doc))) {
    if (b.type === "heading" || b.type === "para" || b.type === "item") lines.push(plain(b.line));
    else if (b.type === "math") lines.push(plainMath(b.src));
    else if (b.type === "toggle") lines.push(plain(b.summary));
    else if (b.type === "flashcard") lines.push(plainAll(b.front), plainAll(b.back));
    else if (b.type === "table") b.rows.forEach((r) => lines.push(r.map(plain).join(" · ")));
  }
  return lines.filter(Boolean).join("\n");
}

/** Ids of pages a note links to ([[links]] and sub-page links). */
export function linkedPageIds(doc: unknown): string[] {
  const ids = new Set<string>();
  const walk = (n: JNode) => {
    if (n.type === "pageLink" && typeof n.attrs?.id === "string") ids.add(n.attrs.id);
    for (const m of n.marks ?? []) {
      const href = m.type === "link" ? String(m.attrs?.href ?? "") : "";
      const match = href.match(/^\/p\/([0-9a-f-]{36})/i);
      if (match) ids.add(match[1]);
    }
    n.content?.forEach(walk);
  };
  if (isDoc(doc)) walk(doc as JNode);
  return [...ids];
}
