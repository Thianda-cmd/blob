// Notes as Markdown and back: the "Markdown" export and import. Pure: runs on the server and in the
// browser, no dependencies beyond the note schema's names (src/components/editor/schema.ts).
//
// Blob's own blocks become Markdown everyone can read, and come back where Markdown can say it:
//   callout     > **Key rule**  (a quote with its kind as a bold first line)
//   flashcard   > **Q:** question … > **A:** answer
//   toggle      <details><summary>…</summary> … </details>
//   formulas    $…$ and $$ … $$ (the learning center's display language, as stored)
//   diagram     ```mermaid
//   plot        *Function plot: f(x) = x^2; g(x) = 2x*
// Sketches, files, presentations and lessons become a line saying what was there.

import type { JSONContent } from "@tiptap/core";
import { PLOT_NAMES } from "@/components/editor/blocks/schema";
import type { Locale } from "@/i18n/config";
import { resolveText } from "@/i18n/text";
import { findTopicMeta, topicHref } from "@/learn/catalog";

export type MarkdownOptions = {
  locale: Locale;
  /** Title written as "# Title" first (omit to leave out). The note's headings then start at "##". */
  title?: string;
  /** Turn a page id into a link (default `/p/<id>`). */
  pageHref?: (id: string) => string;
};

type CalloutKind = "idea" | "definition" | "rule" | "example" | "warning";

const WORDS = {
  en: {
    callout: { idea: "Note", definition: "Definition", rule: "Key rule", example: "Example", warning: "Watch out" } as Record<CalloutKind, string>,
    question: "Q:",
    answer: "A:",
    sketch: "Sketch",
    plot: "Function plot",
    file: "File",
    deck: "Presentation",
    lesson: "Lesson",
    untitled: "Untitled",
  },
  de: {
    callout: { idea: "Notiz", definition: "Definition", rule: "Merksatz", example: "Beispiel", warning: "Achtung" } as Record<CalloutKind, string>,
    question: "F:",
    answer: "A:",
    sketch: "Skizze",
    plot: "Funktionsgraph",
    file: "Datei",
    deck: "Präsentation",
    lesson: "Lektion",
    untitled: "Ohne Titel",
  },
};

/** Callout labels in both languages (and GitHub's alerts), for reading them back. */
const CALLOUT_LABELS = new Map<string, CalloutKind>([
  ...(["en", "de"] as const).flatMap((l) => Object.entries(WORDS[l].callout).map(([kind, label]) => [label.toLowerCase(), kind as CalloutKind] as [string, CalloutKind])),
  ["callout", "idea"],
  ["tip", "idea"],
  ["tipp", "idea"],
  ["important", "rule"],
  ["wichtig", "rule"],
  ["caution", "warning"],
  ["warning", "warning"],
  ["warnung", "warning"],
]);
const ALERTS: Record<string, CalloutKind> = { note: "idea", tip: "idea", important: "rule", warning: "warning", caution: "warning" };
const QUESTION = /^(q|f|question|frage):?$/i;
const ANSWER = /^(a|answer|antwort):?$/i;

// Writing -----------------------------------------------------------------------------------------

type Ctx = { opts: MarkdownOptions; words: (typeof WORDS)["en"]; shift: number };

const UUID_HREF = /^\/p\/([0-9a-f-]{36})(?:[?#].*)?$/i;

/** Plain text with everything Markdown would read as formatting escaped. */
function escapeText(s: string) {
  return s
    .replace(/[\\`*[\]<$]/g, "\\$&")
    .replace(/(^|[^A-Za-z0-9])_|_(?=[^A-Za-z0-9]|$)/g, (m) => m.replace("_", "\\_"))
    .replace(/~(?=~)/g, "\\~")
    .replace(/=(?==)/g, "\\=")
    .replace(/&(?=#?\w+;)/g, "\\&");
}

/** Lines of a paragraph that would start a heading, quote or list are escaped at their start. */
function escapeLineStarts(md: string) {
  return md
    .split("\n")
    .map((line) =>
      line
        .replace(/^(\s*)([#>+-])(?=\s|$)/, "$1\\$2")
        .replace(/^(\s*\d+)([.)])(?=\s|$)/, "$1\\$2")
        .replace(/^(\s*)([-=])(?=\2*\s*$)/, "$1\\$2"),
    )
    .join("\n");
}

function codeSpan(text: string) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") || /^ .* $/.test(text) ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function linkTarget(href: string, ctx: Ctx) {
  const page = href.match(UUID_HREF);
  const url = page ? (ctx.opts.pageHref ?? ((id: string) => `/p/${id}`))(page[1]) : href;
  return /[\s()<>]/.test(url) ? `<${url.replace(/[<>]/g, encodeURIComponent)}>` : url;
}

type JMark = { type: string; attrs?: Record<string, unknown> };

const PUNCT = /[!-/:-@[-`{-~\p{P}\p{S}]/u;
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isPunct = (c: string | undefined) => c !== undefined && PUNCT.test(c);
const isWord = (c: string | undefined) => !isSpace(c) && !isPunct(c);

/** The marks Markdown can say, outermost first. Code is written as a span of its own. */
const MARK_ORDER = ["link", "bold", "italic", "strike", "highlight", "underline"];
const DELIM: Record<string, string> = { bold: "**", italic: "*", strike: "~~", highlight: "==" };
/** The same marks as HTML tags: underline always, the others where their Markdown would be misread. */
const TAG: Record<string, string> = { bold: "strong", italic: "em", strike: "s", highlight: "mark", underline: "u" };

/** The marks Markdown can say, in the order they nest. */
const sorted = (marks: JSONContent["marks"]) => ((marks ?? []) as JMark[]).filter((m) => MARK_ORDER.includes(m.type)).sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));

const sameMark = (a: JMark, b: JMark) => a.type === b.type && (a.type !== "link" || a.attrs?.href === b.attrs?.href);

/** Inline content as Markdown. `breaks: "html"`: line breaks as <br> (headings, table cells). */
function inline(nodes: JSONContent[] | undefined, ctx: Ctx, opts: { breaks?: "html" } = {}): string {
  let out = "";
  const open: { mark: JMark; html: boolean }[] = [];
  const closeTo = (keep: number) => {
    while (open.length > keep) {
      const { mark: m, html } = open.pop()!;
      out += m.type === "link" ? `](${linkTarget(String(m.attrs?.href ?? ""), ctx)})` : html ? `</${TAG[m.type]}>` : DELIM[m.type];
    }
  };
  const list = (nodes ?? []).filter((n) => !(n.type === "text" && !n.text));
  list.forEach((node, i) => {
    const marks = sorted(node.marks);
    let keep = 0;
    while (keep < open.length && keep < marks.length && sameMark(open[keep].mark, marks[keep])) keep++;
    closeTo(keep);
    let text = node.type === "text" ? (node.text ?? "") : "";
    // Spaces at the edges of a marked run go outside it ("**bold** text", never "**bold **text").
    const code = node.marks?.some((m) => m.type === "code");
    if (node.type === "text" && !code && marks.length > keep) {
      const lead = text.match(/^\s+/)?.[0] ?? "";
      out += lead.replace(/\n/g, " ");
      text = text.slice(lead.length);
      // Only spaces: nothing to mark.
      if (!text) return;
    }
    let trail = "";
    let keepNext = 0;
    if (node.type === "text" && !code) {
      const nextMarks = sorted(list[i + 1]?.marks);
      while (keepNext < marks.length && keepNext < nextMarks.length && sameMark(marks[keepNext], nextMarks[keepNext])) keepNext++;
      if (keepNext < marks.length) {
        trail = text.match(/\s+$/)?.[0] ?? "";
        text = text.slice(0, text.length - trail.length);
      }
    }
    const content =
      node.type === "text"
        ? code
          ? codeSpan(text)
          : escapeText(text).replace(/\n/g, " ")
        : node.type === "hardBreak"
          ? opts.breaks === "html"
            ? "<br>"
            : "\\\n"
          : node.type === "mathInline"
            ? `$${String(node.attrs?.src ?? "").trim()}$`
            : escapeText(textOf(node));
    const next = list[i + 1];
    const after = next?.type === "text" ? (next.marks?.some((m) => m.type === "code") ? "`" : next.text?.[0]) : next?.type === "mathInline" ? "$" : undefined;
    const endsHere = keepNext < marks.length && !trail;
    for (const m of marks.slice(keep)) {
      if (m.type === "link") {
        out += "[";
        open.push({ mark: m, html: false });
        continue;
      }
      // Markdown's delimiters only work where they touch the words they mark: not right after another
      // one ("**a*b****c*"), and not between a letter and a bracket ("a**(b)**c"). Tags work anywhere.
      const delim = DELIM[m.type];
      const html =
        !delim ||
        out.endsWith(delim[0]) ||
        (isWord(out[out.length - 1]) && isPunct(content[0])) ||
        (endsHere && isWord(after) && isPunct(content[content.length - 1]));
      out += html ? `<${TAG[m.type]}>` : delim;
      open.push({ mark: m, html });
    }
    out += content;
    if (trail) {
      closeTo(keepNext);
      out += trail.replace(/\n/g, " ");
    }
  });
  closeTo(0);
  return out;
}

/** All the text inside a node (for blocks Markdown has nothing for). */
function textOf(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mathInline" || node.type === "mathBlock") return String(node.attrs?.src ?? "");
  return (node.content ?? []).map(textOf).join(node.content?.some((c) => c.type === "paragraph") ? "\n" : "");
}

const indent = (md: string, by: string, first = by) =>
  md
    .split("\n")
    .map((line, i) => (line ? (i === 0 ? first : by) + line : line))
    .join("\n");

const quote = (md: string) =>
  md
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");

function paragraph(node: JSONContent, ctx: Ctx) {
  // (Spaces at its start would make it code.)
  return escapeLineStarts(inline(node.content, ctx).replace(/^[ \t]+/, ""));
}

function list(node: JSONContent, ctx: Ctx): string {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  let n = Number(node.attrs?.start ?? 1);
  if (!Number.isFinite(n)) n = 1;
  const items = node.content ?? [];
  // Tight unless an item holds more than its line (and a list under it).
  const loose = items.some((it) => (it.content ?? []).length > 2 || (it.content?.[1] && !/List$/.test(it.content[1].type ?? "")));
  const parts = items.map((item) => {
    const marker = ordered ? `${n++}. ` : "- ";
    const children = item.content ?? [];
    const box = task ? (item.attrs?.checked ? "[x] " : "[ ] ") : "";
    const [first, ...rest] = children;
    const head = first?.type === "paragraph" ? paragraph(first, ctx) : "";
    const body = [first?.type === "paragraph" ? null : first, ...rest].filter((b): b is JSONContent => !!b);
    const pad = " ".repeat(marker.length);
    const line = (box + head).trimEnd();
    let md = line ? indent(line, pad, marker) : marker.trimEnd();
    for (const b of body) md += (loose ? "\n\n" : "\n") + indent(block(b, ctx), pad);
    return md;
  });
  return parts.join(loose ? "\n\n" : "\n");
}

/** A table: the first row is the header (Markdown tables always have one). */
function table(node: JSONContent, ctx: Ctx): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? [])
        .map((b) =>
          b.type === "paragraph" || b.type === "heading"
            ? inline(b.content, ctx, { breaks: "html" })
            : /List$/.test(b.type ?? "")
              ? (b.content ?? []).map((it) => `• ${escapeText(textOf(it).replace(/\n/g, " "))}`).join("<br>")
              : escapeText(textOf(b).replace(/\n/g, " ")),
        )
        .join("<br>")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " "),
    ),
  );
  if (!rows.length) return "";
  const width = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  return [line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}

function fenced(text: string, lang: string) {
  const longest = Math.max(2, ...(text.match(/`{3,}/g) ?? []).map((r) => r.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}${lang}\n${text}\n${fence}`;
}

function block(node: JSONContent, ctx: Ctx): string {
  const w = ctx.words;
  switch (node.type) {
    case "paragraph":
      return paragraph(node, ctx);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)) + ctx.shift);
      return `${"#".repeat(level)} ${inline(node.content, ctx, { breaks: "html" })}`.trimEnd();
    }
    case "bulletList":
    case "orderedList":
    case "taskList":
      return list(node, ctx);
    case "blockquote":
      return quote(blocks(node.content, ctx));
    case "codeBlock":
      return fenced(textOf(node), String(node.attrs?.language ?? ""));
    case "horizontalRule":
      return "---";
    case "image":
      return `![${escapeText(String(node.attrs?.alt ?? ""))}](${linkTarget(String(node.attrs?.src ?? ""), ctx)})`;
    case "table":
      return table(node, ctx);
    case "mathBlock":
      return `$$\n${String(node.attrs?.src ?? "").trim()}\n$$`;
    case "callout": {
      const kind = (Object.hasOwn(w.callout, String(node.attrs?.kind)) ? node.attrs?.kind : "idea") as CalloutKind;
      return quote(`**${w.callout[kind]}**\n\n${blocks(node.content, ctx)}`);
    }
    case "toggle": {
      const [summary, content] = node.content ?? [];
      const body = blocks(content?.content, ctx);
      return `<details>\n<summary>${inline(summary?.content, ctx, { breaks: "html" })}</summary>\n\n${body}${body ? "\n\n" : ""}</details>`;
    }
    case "flashcard": {
      const [front, back] = node.content ?? [];
      const label = (text: string, md: string) => `**${text}** ${md}`.trimEnd();
      const frontMd = (front?.content ?? []).map((b, i) => (i === 0 ? label(w.question, block(b, ctx)) : block(b, ctx)));
      const backBlocks = back?.content ?? [];
      const backMd = backBlocks.map((b, i) => (i === 0 && b.type === "paragraph" ? label(w.answer, block(b, ctx)) : block(b, ctx)));
      if (backBlocks[0]?.type !== "paragraph") backMd.unshift(`**${w.answer}**`);
      return quote([...(frontMd.length ? frontMd : [`**${w.question}**`]), ...backMd].join("\n\n"));
    }
    case "diagram":
      return fenced(String(node.attrs?.src ?? "").trim(), "mermaid");
    case "sketch":
      return `*(${w.sketch})*`;
    case "plot": {
      const fns = (Array.isArray(node.attrs?.fns) ? (node.attrs.fns as unknown[]) : []).map(String).filter(Boolean);
      return fns.length ? `*${w.plot}: ${escapeText(fns.map((f, i) => `${PLOT_NAMES[i] ?? "f"}(x) = ${f}`).join("; "))}*` : `*(${w.plot})*`;
    }
    case "file":
      return `*${w.file}: ${escapeText(String(node.attrs?.name ?? ""))}*`;
    case "deckEmbed":
      return node.attrs?.id ? `[${w.deck}](${linkTarget(`/p/${node.attrs.id}`, ctx)})` : `*(${w.deck})*`;
    case "lessonLink": {
      const meta = typeof node.attrs?.slug === "string" ? findTopicMeta(node.attrs.slug) : undefined;
      return meta ? `[${w.lesson}: ${escapeText(resolveText(meta.title, ctx.opts.locale))}](${topicHref(meta)})` : `*(${w.lesson})*`;
    }
    case "pageLink":
      return `[${escapeText(String(node.attrs?.title || w.untitled))}](${linkTarget(`/p/${node.attrs?.id}`, ctx)})`;
    default: {
      if (node.content?.some((c) => c.type === "text" || c.type === "hardBreak")) return paragraph(node, ctx);
      if (node.content?.length) return blocks(node.content, ctx);
      return escapeLineStarts(escapeText(textOf(node)));
    }
  }
}

function blocks(nodes: JSONContent[] | undefined, ctx: Ctx): string {
  return (nodes ?? [])
    .map((b) => block(b, ctx))
    .filter((md, i, all) => md !== "" || (i > 0 && i < all.length - 1))
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** The note as Markdown (CommonMark with GitHub's tables, task lists and strikethrough). */
export function noteToMarkdown(doc: JSONContent, opts: MarkdownOptions): string {
  const ctx: Ctx = { opts, words: WORDS[opts.locale] ?? WORDS.en, shift: opts.title !== undefined ? 1 : 0 };
  const body = blocks(doc.content, ctx).trim();
  const title = opts.title !== undefined ? `# ${escapeText(opts.title.trim() || ctx.words.untitled)}` : "";
  return [title, body].filter(Boolean).join("\n\n") + "\n";
}

// Reading -----------------------------------------------------------------------------------------

/** An id for a new toggle or flashcard (the editor gives them one too, as uuids). */
function newId() {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", "#39": "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[name.toLowerCase()] ?? m;
  });

// Inline ------------------------------------------------------------------------------------------

type Item =
  | { kind: "text"; text: string; marks: JMark[] }
  | { kind: "node"; node: JSONContent; marks: JMark[] }
  /** A run of *, _, ~, = (or an HTML tag): `both` when it could open and close, `length` as written. */
  | { kind: "delim"; char: string; count: number; open: boolean; close: boolean; both: boolean; marks: JMark[]; length: number };


/** The text of "[text](href)" from `at` (the "["): where it ends, its text and its target. */
function scanLink(src: string, at: number): { end: number; text: string; href: string } | null {
  let depth = 0;
  let i = at;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") {
      const run = src.slice(i).match(/^`+/)![0];
      const close = src.indexOf(run, i + run.length);
      if (close > 0) i = close + run.length - 1;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]" && --depth === 0) break;
  }
  if (depth !== 0 || src[i + 1] !== "(") return null;
  const text = src.slice(at + 1, i);
  const rest = src.slice(i + 2);
  const m = rest.match(/^\s*(?:<([^<>\n]*)>|((?:[^\s()\\]|\\.|\((?:[^\s()\\]|\\.)*\))*))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/);
  if (!m) return null;
  const href = (m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1");
  return { end: i + 2 + m[0].length, text, href };
}

/** HTML tags people (and noteToMarkdown) write for marks. */
const TAG_MARKS: Record<string, string> = { strong: "bold", b: "bold", em: "italic", i: "italic", s: "strike", del: "strike", strike: "strike", mark: "highlight", u: "underline" };

function addMark(marks: JMark[], mark: JMark) {
  if (marks.some((m) => m.type === "code")) return marks;
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark];
}

/** Inline Markdown as note content: text with marks, formulas, links and line breaks. */
function parseInline(src: string, linkDepth = 0): JSONContent[] {
  const items: Item[] = [];
  let text = "";
  const flush = () => {
    if (text) items.push({ kind: "text", text: decodeEntities(text), marks: [] });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    if (c === "\\") {
      if (src[i + 1] === "\n") {
        flush();
        items.push({ kind: "node", node: { type: "hardBreak" }, marks: [] });
        i += 2;
        continue;
      }
      if (src[i + 1] !== undefined && isPunct(src[i + 1])) {
        // Taken as it is (an escaped "&amp;" stays those five characters).
        flush();
        items.push({ kind: "text", text: src[i + 1], marks: [] });
        i += 2;
        continue;
      }
    }
    if (c === "\n") {
      // Two spaces before a line end: a line break; otherwise just a space.
      if (/ {2,}$/.test(text)) {
        text = text.replace(/ +$/, "");
        flush();
        items.push({ kind: "node", node: { type: "hardBreak" }, marks: [] });
      } else text = text.replace(/ +$/, "") + " ";
      i++;
      while (src[i] === " ") i++;
      continue;
    }
    if (c === "`") {
      const run = rest.match(/^`+/)![0];
      const close = src.indexOf(run, i + run.length);
      // The same number of backticks, not part of a longer run.
      let end = close;
      while (end >= 0 && (src[end + run.length] === "`" || src[end - 1] === "`")) end = src.indexOf(run, end + run.length + 1);
      if (end > 0) {
        flush();
        let code = src.slice(i + run.length, end).replace(/\n/g, " ");
        if (/^ .*[^ ].* $/.test(code)) code = code.slice(1, -1);
        if (code) items.push({ kind: "text", text: code, marks: [{ type: "code" }] });
        i = end + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    if (c === "$" && src[i + 1] !== "$") {
      // $x^2$: a formula. Not for prices ("5 $", "$5 and $10"): no space inside the edges, no digit after.
      const m = rest.match(/^\$([^\s$](?:[^$\n]*[^\s$\\])?)\$(?![0-9])/);
      if (m && !(/^\d/.test(m[1]) && /\s/.test(m[1]))) {
        flush();
        items.push({ kind: "node", node: { type: "mathInline", attrs: { src: m[1] } }, marks: [] });
        i += m[0].length;
        continue;
      }
    }
    if (c === "<") {
      const auto = rest.match(/^<((?:https?|mailto|tel):[^\s<>]+)>/i);
      if (auto && !linkDepth) {
        flush();
        items.push({ kind: "text", text: auto[1].replace(/^mailto:/i, ""), marks: [{ type: "link", attrs: { href: auto[1] } }] });
        i += auto[0].length;
        continue;
      }
      const br = rest.match(/^<br\s*\/?>/i);
      if (br) {
        flush();
        items.push({ kind: "node", node: { type: "hardBreak" }, marks: [] });
        i += br[0].length;
        continue;
      }
      const tag = rest.match(/^<(\/?)(strong|b|em|i|s|del|strike|mark|u)>/i);
      if (tag) {
        flush();
        items.push({ kind: "delim", char: `<${TAG_MARKS[tag[2].toLowerCase()]}>`, count: 1, open: !tag[1], close: !!tag[1], both: false, marks: [], length: 1 });
        i += tag[0].length;
        continue;
      }
    }
    if ((c === "[" || (c === "!" && src[i + 1] === "[")) && !linkDepth) {
      const image = c === "!";
      const link = scanLink(src, image ? i + 1 : i);
      if (link) {
        flush();
        if (image) {
          // A picture inside a sentence can't be one here: its words, linked to it.
          const alt = link.text.replace(/\\(.)/g, "$1");
          items.push({ kind: "text", text: alt || link.href, marks: [{ type: "link", attrs: { href: link.href } }] });
        } else {
          for (const n of parseInline(link.text, linkDepth + 1)) {
            const mark = { type: "link", attrs: { href: link.href } };
            items.push(n.type === "text" ? { kind: "text", text: n.text!, marks: addMark((n.marks ?? []) as JMark[], mark) } : { kind: "node", node: n, marks: [mark] });
          }
        }
        i = link.end;
        continue;
      }
    }
    if (c === "*" || c === "_" || c === "~" || c === "=") {
      const run = rest.match(c === "*" ? /^\*+/ : c === "_" ? /^_+/ : c === "~" ? /^~+/ : /^=+/)![0];
      const before = i > 0 ? src[i - 1] : undefined;
      const after = src[i + run.length];
      const left = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
      const right = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
      const pair = c === "~" || c === "=";
      if (!pair || run.length >= 2) {
        flush();
        const open = c === "_" ? left && (!right || isPunct(before)) : left;
        const close = c === "_" ? right && (!left || isPunct(after)) : right;
        items.push({ kind: "delim", char: c, count: run.length, open, close, both: open && close, marks: [], length: run.length });
        i += run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    }
    text += c;
    i++;
  }
  flush();

  // Pair the delimiters (CommonMark's "process emphasis", simplified): each closer takes the
  // nearest opener of its kind, and everything between gets the mark.
  for (let ci = 0; ci < items.length; ci++) {
    const closer = items[ci];
    if (closer.kind !== "delim" || !closer.close) continue;
    let matched = true;
    while (closer.count > 0 && matched) {
      matched = false;
      for (let oi = ci - 1; oi >= 0; oi--) {
        const opener = items[oi];
        if (opener.kind !== "delim" || !opener.open || opener.char !== closer.char || opener.count === 0) continue;
        const pair = opener.char === "~" || opener.char === "=";
        if (pair && (opener.count < 2 || closer.count < 2)) continue;
        // CommonMark's rule of 3: "**a*b***" pairs the single * with the end, not with the start.
        const sum = opener.length + closer.length;
        if (!pair && (opener.both || closer.both) && sum % 3 === 0 && !(opener.length % 3 === 0 && closer.length % 3 === 0)) continue;
        const tag = opener.char.startsWith("<");
        const use = tag ? 1 : pair ? 2 : opener.count >= 2 && closer.count >= 2 ? 2 : 1;
        const type = tag ? opener.char.slice(1, -1) : opener.char === "~" ? "strike" : opener.char === "=" ? "highlight" : use === 2 ? "bold" : "italic";
        for (let k = oi + 1; k < ci; k++) {
          const it = items[k];
          it.marks = addMark(it.marks, { type });
          // Delimiters in between can't pair across this one any more.
          if (it.kind === "delim") it.open = it.close = false;
        }
        opener.count -= use;
        closer.count -= use;
        matched = true;
        break;
      }
    }
  }

  // What's left: text nodes (unpaired delimiters are just their characters).
  const out: JSONContent[] = [];
  for (const it of items) {
    const marks = it.marks.length ? it.marks.map((m) => (m.attrs ? { type: m.type, attrs: m.attrs } : { type: m.type })) : undefined;
    if (it.kind === "node") {
      out.push(marks && it.node.type !== "hardBreak" ? { ...it.node, marks } : it.node);
      continue;
    }
    // (A tag left without its partner just goes.)
    const t = it.kind === "text" ? it.text : it.char.startsWith("<") ? "" : it.char.repeat(it.count);
    if (!t) continue;
    const prev = out[out.length - 1];
    if (prev?.type === "text" && JSON.stringify(prev.marks ?? null) === JSON.stringify(marks ?? null)) prev.text += t;
    else out.push({ type: "text", text: t, ...(marks && { marks }) });
  }
  // No spaces left hanging at the edges.
  const first = out[0];
  if (first?.type === "text") first.text = first.text!.replace(/^\s+/, "");
  const last = out[out.length - 1];
  if (last?.type === "text") last.text = last.text!.replace(/\s+$/, "");
  return out.filter((n) => n.type !== "text" || n.text);
}

// Blocks ------------------------------------------------------------------------------------------

const RE = {
  fence: /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/,
  heading: /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/,
  hr: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
  quote: /^ {0,3}>/,
  item: /^( {0,3})([-+*]|\d{1,9}[.)])(?:([ \t]+)(.*)|$)/,
  setext: /^ {0,3}(=+|-+)[ \t]*$/,
  tableSep: /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
  details: /^ {0,3}<details(?:\s[^>]*)?>/i,
  math: /^ {0,3}\$\$/,
};

const blank = (line: string) => !line.trim();
const expandTabs = (line: string) => line.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length));

function para(content: JSONContent[]): JSONContent {
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** Cells of a table row, split at pipes that aren't escaped or in code. */
function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const out: string[] = [];
  let cell = "";
  let code = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") {
      cell += "\\|";
      i++;
    } else if (c === "`") {
      code = code ? 0 : 1;
      cell += c;
    } else if (c === "|" && !code) {
      out.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  out.push(cell.trim());
  return out;
}

/** A header row with pipes, then a row of dashes with as many columns. */
const startsTable = (lines: string[], i: number) =>
  !!lines[i]?.includes("|") && RE.tableSep.test(lines[i + 1] ?? "") && cells(lines[i + 1]).length === cells(lines[i]).length;

/** Whether a line starts a block of its own (so it ends a paragraph). */
function interrupts(lines: string[], i: number) {
  const line = lines[i];
  const item = line.match(RE.item);
  return (
    RE.fence.test(line) ||
    RE.heading.test(line) ||
    RE.hr.test(line) ||
    RE.quote.test(line) ||
    RE.details.test(line) ||
    RE.math.test(line) ||
    startsTable(lines, i) ||
    (!!item && item[4] !== undefined && item[4].trim() !== "" && (!/\d/.test(item[2]) || /^1[.)]/.test(item[2])))
  );
}

/** A callout or flashcard written as a quote: "> **Key rule**", "> [!TIP]", "> **Q:** … **A:** …". */
function fromQuote(content: JSONContent[]): JSONContent {
  const leadText = (b: JSONContent | undefined) => {
    const first = b?.type === "paragraph" ? b.content?.[0] : undefined;
    return first?.type === "text" && first.marks?.some((m) => m.type === "bold") ? first.text!.trim() : null;
  };
  /** The paragraph without its bold label (and the space after it). */
  const strip = (b: JSONContent): JSONContent => {
    const rest = (b.content ?? []).slice(1);
    if (rest[0]?.type === "text") rest[0] = { ...rest[0], text: rest[0].text!.replace(/^[\s:]+/, "") };
    return para(rest.filter((n) => n.type !== "text" || n.text));
  };

  // > [!NOTE]: GitHub's alerts.
  const firstPara = content[0]?.type === "paragraph" ? content[0] : null;
  const head = firstPara?.content?.[0];
  const alert = head?.type === "text" && !head.marks ? head.text!.match(/^\[!(\w+)\]\s*/) : null;
  if (alert && ALERTS[alert[1].toLowerCase()]) {
    const rest = [{ ...head!, text: head!.text!.slice(alert[0].length) }, ...firstPara!.content!.slice(1)].filter((n) => n.type !== "text" || n.text);
    if (rest[0]?.type === "hardBreak") rest.shift();
    const body = [...(rest.length ? [para(rest)] : []), ...content.slice(1)];
    return { type: "callout", attrs: { kind: ALERTS[alert[1].toLowerCase()] }, content: body.length ? body : [para([])] };
  }

  const label = leadText(content[0]);
  if (label && QUESTION.test(label)) {
    const answerAt = content.findIndex((b, k) => k > 0 && ANSWER.test(leadText(b) ?? ""));
    if (answerAt > 0 || (content[0].content ?? []).length > 1) {
      const front = (answerAt > 0 ? content.slice(0, answerAt) : content).map((b, k) => (k === 0 ? strip(b) : b.type === "paragraph" ? b : para(textNodes(b))));
      const backSrc = answerAt > 0 ? content.slice(answerAt) : [];
      const back = backSrc
        .map((b, k) => (k === 0 ? strip(b) : b))
        .filter((b, k, all) => !(k === 0 && b.type === "paragraph" && !b.content?.length && all.length > 1))
        .map((b) => (b.type === "paragraph" || b.type === "bulletList" || b.type === "orderedList" ? b : b.type === "taskList" ? untask(b) : para(textNodes(b))));
      return {
        type: "flashcard",
        attrs: { id: newId() },
        content: [
          { type: "flashcardFront", content: front.length ? front : [para([])] },
          { type: "flashcardBack", content: back.length ? back : [para([])] },
        ],
      };
    }
  }
  if (label && content[0].content?.length === 1) {
    const kind = CALLOUT_LABELS.get(label.replace(/:$/, "").toLowerCase());
    if (kind) {
      const body = content.slice(1);
      return { type: "callout", attrs: { kind }, content: body.length ? body : [para([])] };
    }
  }
  return { type: "blockquote", content: content.length ? content : [para([])] };
}

/** A to-do list as a plain list (where to-dos can't go). */
function untask(list: JSONContent): JSONContent {
  return { type: "bulletList", content: (list.content ?? []).map((it) => ({ type: "listItem", content: it.content })) };
}

/** A block's words as inline text (for places that only take paragraphs). */
function textNodes(b: JSONContent): JSONContent[] {
  const t = textOf(b).replace(/\n+/g, " ").trim();
  return t ? [{ type: "text", text: t }] : [];
}

/** Turns "*Function plot: f(x) = x^2; g(x) = 2x*" back into a plot. */
function plotFrom(src: string): JSONContent | null {
  const m = src.trim().match(/^\*(?:Function plot|Funktionsgraph): (.+)\*$/);
  if (!m) return null;
  const fns = m[1]
    .replace(/\\(.)/g, "$1")
    .split(/;\s*/)
    .map((part) => part.replace(/^[a-z]\(x\)\s*=\s*/, "").trim())
    .filter(Boolean);
  return fns.length ? { type: "plot", attrs: { fns: fns.slice(0, PLOT_NAMES.length) } } : null;
}

/** A paragraph's source, as a block: a picture on its own, a plot, or text. */
function paragraphBlock(src: string): JSONContent {
  const image = src.trim().match(/^!\[((?:[^\]\\]|\\.)*)\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+"[^"]*")?\s*\)$/);
  if (image) {
    const href = image[2].replace(/^<|>$/g, "");
    return { type: "image", attrs: { src: href, alt: image[1].replace(/\\(.)/g, "$1") || null } };
  }
  return plotFrom(src) ?? para(parseInline(src));
}

/** Blocks from lines of Markdown (containers call it again on their own lines). */
function parseBlocks(lines: string[]): JSONContent[] {
  const out: JSONContent[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }

    // ``` code ```, and ```mermaid diagrams.
    const fence = line.match(RE.fence);
    if (fence && !(fence[2][0] === "`" && fence[3].includes("`"))) {
      const [, pad, marker, lang] = fence;
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i].replace(new RegExp(`^ {0,${pad.length}}`), ""));
        i++;
      }
      i++;
      const text = body.join("\n");
      if (lang.toLowerCase() === "mermaid") out.push({ type: "diagram", attrs: { src: text } });
      else out.push({ type: "codeBlock", attrs: { language: lang || null }, ...(text && { content: [{ type: "text", text }] }) });
      continue;
    }

    // $$ formula $$
    if (RE.math.test(line)) {
      const first = line.trim().slice(2);
      const oneLine = first.match(/^(.*?)\$\$\s*$/);
      if (oneLine) {
        out.push({ type: "mathBlock", attrs: { src: oneLine[1].trim() } });
        i++;
        continue;
      }
      const body = first.trim() ? [first] : [];
      i++;
      while (i < lines.length && !/\$\$\s*$/.test(lines[i])) body.push(lines[i++].trim());
      if (i < lines.length) {
        const end = lines[i].trim().replace(/\$\$\s*$/, "").trim();
        if (end) body.push(end);
        i++;
      }
      out.push({ type: "mathBlock", attrs: { src: body.join("\n").trim() } });
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      const content = parseInline(heading[2] ?? "");
      // The level as written (1-6); markdownToNote brings it to the note's three.
      out.push({ type: "heading", attrs: { level: heading[1].length }, ...(content.length && { content }) });
      i++;
      continue;
    }

    if (RE.hr.test(line)) {
      out.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // > quotes (and callouts, flashcards)
    if (RE.quote.test(line)) {
      const body: string[] = [];
      while (i < lines.length && !blank(lines[i]) && (RE.quote.test(lines[i]) || !interrupts(lines, i))) {
        body.push(lines[i].replace(/^ {0,3}> ?/, ""));
        i++;
        // A blank ">" line keeps the quote going; a truly blank line ends it.
      }
      out.push(fromQuote(parseBlocks(body)));
      continue;
    }

    // <details><summary>…</summary> … </details>
    if (RE.details.test(line)) {
      const body: string[] = [];
      let depth = 0;
      for (; i < lines.length; i++) {
        depth += (lines[i].match(/<details(?:\s[^>]*)?>/gi) ?? []).length;
        depth -= (lines[i].match(/<\/details>/gi) ?? []).length;
        body.push(lines[i]);
        if (depth <= 0) {
          i++;
          break;
        }
      }
      let src = body.join("\n").replace(/^\s*<details(?:\s[^>]*)?>/i, "").replace(/<\/details>\s*$/i, "");
      const summary = src.match(/^\s*<summary>([\s\S]*?)<\/summary>/i);
      if (summary) src = src.slice(summary[0].length);
      const inner = parseBlocks(src.split("\n"));
      const head = summary ? parseInline(summary[1].trim()) : [];
      out.push({
        type: "toggle",
        attrs: { id: newId() },
        content: [
          { type: "toggleSummary", ...(head.length && { content: head }) },
          { type: "toggleContent", content: inner.length ? inner : [para([])] },
        ],
      });
      continue;
    }

    // | tables |
    if (startsTable(lines, i)) {
      const head = cells(lines[i]);
      const rows: string[][] = [head];
      i += 2;
      while (i < lines.length && !blank(lines[i]) && lines[i].includes("|")) rows.push(cells(lines[i++]));
      const width = Math.max(...rows.map((r) => r.length));
      out.push({
        type: "table",
        content: rows.map((r, ri) => ({
          type: "tableRow",
          content: Array.from({ length: width }, (_, ci) => ({
            type: ri === 0 ? "tableHeader" : "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [para(parseInline(r[ci] ?? ""))],
          })),
        })),
      });
      continue;
    }

    // - lists, 1. lists, - [ ] to-do lists
    const item = line.match(RE.item);
    if (item) {
      const ordered = /\d/.test(item[2]);
      const firstTask = !ordered && /^\[[ xX]\](?:\s|$)/.test(item[4] ?? "");
      const items: { lines: string[]; checked: boolean | null }[] = [];
      const base = item[1].length;
      let start = ordered ? parseInt(item[2], 10) : 1;
      if (!Number.isFinite(start)) start = 1;
      while (i < lines.length) {
        const m = lines[i].match(RE.item);
        if (!m || m[1].length > base + 3 || /\d/.test(m[2]) !== ordered || RE.hr.test(lines[i])) break;
        const spaces = m[3] ?? " ";
        // Where the item's text starts: after the marker and its spaces (one, if there are more than four).
        const col = m[1].length + m[2].length + (spaces.length > 4 ? 1 : spaces.length);
        let first = m[4] ?? "";
        if (spaces.length > 4) first = spaces.slice(1) + first;
        let checked: boolean | null = null;
        const box = first.match(/^\[([ xX])\](?:\s+|$)/);
        if (firstTask && box) {
          checked = box[1] !== " ";
          first = first.slice(box[0].length);
        } else if (firstTask) checked = false;
        const body = [first];
        i++;
        let prevBlank = false;
        while (i < lines.length) {
          const l = expandTabs(lines[i]);
          if (blank(l)) {
            prevBlank = true;
            body.push("");
            i++;
            continue;
          }
          const lead = l.match(/^ */)![0].length;
          if (lead >= col) {
            body.push(l.slice(col));
            prevBlank = false;
            i++;
            continue;
          }
          // Lazy continuation: a paragraph line that just goes on.
          if (!prevBlank && !interrupts(lines, i) && !RE.item.test(l) && body[body.length - 1]?.trim()) {
            body.push(l.trim());
            i++;
            continue;
          }
          break;
        }
        while (body.length && blank(body[body.length - 1])) body.pop();
        items.push({ lines: body, checked });
        // A blank line, then something that isn't the next item: the list is over.
        if (i < lines.length && !RE.item.test(lines[i])) break;
      }
      const type = ordered ? "orderedList" : firstTask ? "taskList" : "bulletList";
      out.push({
        type,
        ...(ordered && { attrs: { start } }),
        content: items.map((it) => {
          let content = parseBlocks(it.lines);
          if (content[0]?.type !== "paragraph") content = [para([]), ...content];
          return firstTask ? { type: "taskItem", attrs: { checked: !!it.checked }, content } : { type: "listItem", content };
        }),
      });
      continue;
    }

    // Indented code (four spaces), where a paragraph isn't going on.
    if (/^( {4}|\t)/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && (/^( {4}|\t)/.test(lines[i]) || (blank(lines[i]) && /^( {4}|\t)/.test(lines[i + 1] ?? "")))) {
        body.push(expandTabs(lines[i]).slice(4));
        i++;
      }
      out.push({ type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: body.join("\n") }] });
      continue;
    }

    // A paragraph: lines until a blank one or another block. "Title\n===" is a heading.
    const body = [line.replace(/^\s+/, "")];
    i++;
    let setext = 0;
    while (i < lines.length && !blank(lines[i])) {
      const st = lines[i].match(RE.setext);
      if (st) {
        setext = st[1][0] === "=" ? 1 : 2;
        i++;
        break;
      }
      if (interrupts(lines, i)) break;
      body.push(lines[i].replace(/^\s+/, ""));
      i++;
    }
    const src = body.join("\n");
    if (setext) {
      const content = parseInline(src);
      out.push({ type: "heading", attrs: { level: setext }, ...(content.length && { content }) });
    } else out.push(paragraphBlock(src));
  }
  return out;
}

/** Plain text of inline content (the note's title). */
const plain = (nodes: JSONContent[]) => nodes.map((n) => (n.type === "text" ? n.text : n.type === "mathInline" ? n.attrs?.src : n.type === "hardBreak" ? " " : "")).join("").trim();

/**
 * Markdown as a note. A first line "# Title" becomes the title (not part of the text); when no other
 * "#" heading follows, the headings under it move up a level ("##" becomes the note's first level).
 */
export function markdownToNote(md: string): { title: string | null; doc: JSONContent } {
  const lines = md.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  let title: string | null = null;
  const firstLine = lines.findIndex((l) => !blank(l));
  const top = firstLine >= 0 ? lines[firstLine].match(/^ {0,3}#[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/) : null;
  let rest = lines;
  if (top) {
    title = plain(parseInline(top[1])) || null;
    rest = lines.slice(firstLine + 1);
  }
  const blocks = parseBlocks(rest);
  // Under a title, "##" is the note's first heading level (as noteToMarkdown writes it).
  const headings: JSONContent[] = [];
  const walk = (nodes: JSONContent[]) =>
    nodes.forEach((n) => {
      if (n.type === "heading") headings.push(n);
      if (n.content) walk(n.content);
    });
  walk(blocks);
  const shift = top && !headings.some((h) => h.attrs?.level === 1) ? 1 : 0;
  for (const h of headings) h.attrs = { ...h.attrs, level: Math.min(3, Math.max(1, Number(h.attrs?.level ?? 1) - shift)) };
  return { title, doc: { type: "doc", content: blocks.length ? blocks : [para([])] } };
}
