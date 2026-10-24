import type { Locale } from "@/i18n/config";
import { noteBlocksText } from "@/i18n/messages/noteBlocks";

// Diagrams made in the builder: a small model of rows (a mind map's outline, a process's steps, a
// timeline's dates…) that becomes Mermaid code. The model is stored on the diagram node next to the
// code (`model`, `src`), so the builder can open it again; everything else (the server, the study
// tools, older editors) only ever reads `src`. Nothing here needs a browser.

export const DIAGRAM_KINDS = ["mindmap", "flow", "cycle", "timeline", "pie", "sequence"] as const;
export type DiagramKind = (typeof DIAGRAM_KINDS)[number];

/** Shapes of a process step ("auto": a question mark at the end makes it a question). */
export const FLOW_SHAPES = ["auto", "box", "round", "diamond", "circle"] as const;
export type FlowShape = (typeof FLOW_SHAPES)[number];

/**
 * One row. `text` is the node (mind map, process, cycle), the event (timeline), the slice's label
 * (pie) or the message (sequence); the other fields belong to one kind each.
 */
export type DiagramRow = {
  text: string;
  /** Mind map and process: how far the row is indented (0 = the centre / a main step). */
  depth?: number;
  shape?: FlowShape;
  /** Timeline: the date or period. */
  when?: string;
  /** Pie chart: the number, as typed ("3,5" works too). */
  value?: string;
  /** Sequence: who sends the message, and to whom. */
  from?: string;
  to?: string;
  /** Sequence: an answer (dashed arrow). */
  reply?: boolean;
};

export type DiagramModel = {
  kind: DiagramKind;
  /** Timeline and pie chart. */
  title?: string;
  /** Process and cycle: top to bottom or left to right. */
  dir?: "down" | "right";
  /** Pie chart: the numbers in the legend too. */
  showData?: boolean;
  rows: DiagramRow[];
};

const MAX_ROWS = 200;
const MAX_TEXT = 300;
const MAX_DEPTH = 12;

/** Kinds whose rows are an outline (Tab indents). */
export const OUTLINE_KINDS: readonly DiagramKind[] = ["mindmap", "flow"];
export const isOutline = (kind: DiagramKind) => OUTLINE_KINDS.includes(kind);

/** Colours of a mind map's branches (Diagram.tsx draws them, the builder's dots match). */
export const SECTION_VARS = ["--blob", "--subject-sky", "--subject-moss", "--subject-sand", "--subject-clay", "--subject-rose", "--subject-teal", "--subject-plum"];

// Reading a stored model ----------------------------------------------------------------------------

const str = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.slice(0, max) : "");

/** A model from the node (whatever was stored: another editor may have written it), or null. */
export function readModel(raw: unknown): DiagramModel | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (!DIAGRAM_KINDS.includes(m.kind as DiagramKind)) return null;
  const kind = m.kind as DiagramKind;
  const rows = (Array.isArray(m.rows) ? m.rows : []).slice(0, MAX_ROWS).flatMap((r): DiagramRow[] => {
    if (!r || typeof r !== "object") return [];
    const row = r as Record<string, unknown>;
    const out: DiagramRow = { text: str(row.text) };
    if (typeof row.depth === "number" && Number.isFinite(row.depth)) out.depth = Math.max(0, Math.min(MAX_DEPTH, Math.round(row.depth)));
    if (FLOW_SHAPES.includes(row.shape as FlowShape) && row.shape !== "auto") out.shape = row.shape as FlowShape;
    if (typeof row.when === "string") out.when = str(row.when, 80);
    if (typeof row.value === "string") out.value = str(row.value, 24);
    if (typeof row.from === "string") out.from = str(row.from, 80);
    if (typeof row.to === "string") out.to = str(row.to, 80);
    if (row.reply === true) out.reply = true;
    return [out];
  });
  const model: DiagramModel = { kind, rows };
  if (typeof m.title === "string" && m.title) model.title = str(m.title, 200);
  if (m.dir === "down" || m.dir === "right") model.dir = m.dir;
  if (m.showData === true) model.showData = true;
  return model;
}

/** The model as stored: no empty extras, so two equal models are equal JSON. */
export function cleanModel(model: DiagramModel): DiagramModel {
  return readModel(JSON.parse(JSON.stringify(model))) ?? { kind: model.kind, rows: [] };
}

// Rows --------------------------------------------------------------------------------------------

const oneLine = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Indentation as it may be: the centre alone at 0, every row at most one deeper than the one above. */
export function normalizeDepths(kind: DiagramKind, rows: DiagramRow[]): DiagramRow[] {
  if (!isOutline(kind))
    return rows.map((r) => {
      const flat = { ...r };
      delete flat.depth;
      return flat;
    });
  let prev = -1;
  return rows.map((r, i) => {
    const min = kind === "mindmap" && i > 0 ? 1 : 0;
    const max = i === 0 ? 0 : prev + 1;
    const depth = Math.max(min, Math.min(max, r.depth ?? min));
    prev = depth;
    return { ...r, depth };
  });
}

/** The indentation row `i` may have (Tab and Shift+Tab stay inside it). */
export function depthRange(kind: DiagramKind, rows: DiagramRow[], i: number): { min: number; max: number } {
  if (!isOutline(kind) || i === 0) return { min: 0, max: 0 };
  return { min: kind === "mindmap" ? 1 : 0, max: Math.min(MAX_DEPTH, (rows[i - 1]?.depth ?? 0) + 1) };
}

/** The row with everything indented under it: [first, end). */
export function subtree(rows: DiagramRow[], i: number): [number, number] {
  const depth = rows[i]?.depth ?? 0;
  let end = i + 1;
  while (end < rows.length && (rows[end].depth ?? 0) > depth) end++;
  return [i, end];
}

/** A "3,5" or "3.5" or "1 200" as a number (null when it isn't one, or isn't above zero). */
export function parseNumber(raw: string | undefined): number | null {
  let s = (raw ?? "").replace(/[\s'’]/g, "");
  if (!s) return null;
  if (s.includes(",") && !s.includes(".")) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Each pie row's share of the whole (0 to 1), null for rows that don't count. */
export function pieShares(rows: DiagramRow[]): (number | null)[] {
  const values = rows.map((r) => parseNumber(r.value));
  const total = values.reduce<number>((n, v) => n + (v ?? 0), 0);
  return values.map((v) => (v === null || total <= 0 ? null : v / total));
}

/** A process branch's "Yes: Plan it" as the arrow's label and the step. */
export function branchLabel(text: string): { label: string | null; text: string } {
  const m = oneLine(text).match(/^([^:]{1,30}):\s+(\S.*)$/);
  return m ? { label: m[1].trim(), text: m[2] } : { label: null, text: oneLine(text) };
}

const filled = (r: DiagramRow) => oneLine(r.text) !== "";

/** Whether the model draws anything. */
export function hasContent(model: DiagramModel): boolean {
  switch (model.kind) {
    case "timeline":
      return model.rows.some((r) => filled(r) || oneLine(r.when) !== "");
    case "pie":
      return model.rows.some((r) => parseNumber(r.value) !== null);
    case "sequence":
      return model.rows.some((r) => oneLine(r.from) !== "" && oneLine(r.to) !== "");
    default:
      return model.rows.some(filled);
  }
}

// Mermaid -----------------------------------------------------------------------------------------

const ZWSP = "​";

/**
 * User text as Mermaid shows it as typed: "#12;" would be read as a character code, "<b>" as
 * markup and a backtick at the start as Markdown (an invisible space keeps them apart).
 */
function plain(s: string | undefined): string {
  return oneLine(s)
    .replace(/`/g, "'")
    .replace(/#(?=\w+;)/g, `#${ZWSP}`)
    .replace(/<(?=[A-Za-z/!?])/g, `<${ZWSP}`);
}

/** Text inside a quoted label: a straight quote would end it, so it becomes a curly one. */
function label(s: string | undefined): string {
  return plain(s).replace(/"/g, (_q, i: number, all: string) => (i === 0 || /[\s([{\-–—/]/.test(all[i - 1]) ? "“" : "”"));
}

/** Timeline text: unquoted, so ":" (which separates events) becomes its character code. */
function timelineText(s: string | undefined, start = false): string {
  const t = plain(s).replace(/:/g, "#58;");
  if (!start) return t;
  // A line starting with a keyword would mean something else, and one starting with "%%" is a comment.
  return /^(title|section)/i.test(t) ? ZWSP + t : t.replace(/^%%/, "％%");
}

/** A timeline's title: Mermaid shows "<", ">" and "&" there as their HTML codes. */
const timelineTitle = (s: string | undefined) => timelineText(s).replace(/</g, "＜").replace(/>/g, "＞").replace(/&/g, "＆");

/** Sequence text: "#" starts a comment there and ";" a new line, so both become character codes. */
function sequenceText(s: string | undefined): string {
  return oneLine(s)
    .replace(/[#;]/g, (c) => (c === "#" ? "#35;" : "#59;"))
    .replace(/<(?=[A-Za-z/!?])/g, `<${ZWSP}`);
}

const SHAPES: Record<Exclude<FlowShape, "auto"> | "stadium", [string, string]> = {
  box: ["[", "]"],
  round: ["(", ")"],
  diamond: ["{", "}"],
  circle: ["((", "))"],
  stadium: ["([", "])"],
};

function flowNode(id: string, text: string, shape: FlowShape | "stadium" = "auto") {
  const s = shape === "auto" ? (/[?？]\s*$/.test(text) ? "diamond" : "box") : shape;
  const [open, close] = SHAPES[s];
  return `${id}${open}"${label(text)}"${close}`;
}

function flowToMermaid(model: DiagramModel): string {
  const rows = normalizeDepths("flow", model.rows.filter(filled));
  if (!rows.length) return "";
  const lines = [`flowchart ${model.dir === "right" ? "LR" : "TD"}`];
  const nodes: string[] = [];
  const edges: string[] = [];
  /** Where the next main step continues from (several after branches), and the arrow's label. */
  let ends: { id: string; label: string | null }[] = [];
  const edge = (from: string, to: string, text: string | null) => edges.push(`  ${from} -->${text ? `|"${label(text)}"|` : ""} ${to}`);
  let i = 0;
  while (i < rows.length) {
    const id = `n${i}`;
    nodes.push(`  ${flowNode(id, rows[i].text, rows[i].shape)}`);
    for (const e of ends) edge(e.id, id, e.label);
    const [, end] = subtree(rows, i);
    const next: typeof ends = [];
    // The rows under a main step: each row one deeper starts a branch, deeper rows go on with it.
    let j = i + 1;
    while (j < end) {
      const [, branchEnd] = subtree(rows, j);
      let prev = id;
      for (let k = j; k < branchEnd; k++) {
        const { label: arrow, text } = k === j ? branchLabel(rows[k].text) : { label: null, text: rows[k].text };
        const bid = `n${k}`;
        nodes.push(`  ${flowNode(bid, text, rows[k].shape)}`);
        edge(prev, bid, arrow);
        prev = bid;
      }
      next.push({ id: prev, label: null });
      j = branchEnd;
    }
    ends = next.length ? next : [{ id, label: null }];
    i = end;
  }
  return [...lines, ...nodes, ...edges].join("\n");
}

function cycleToMermaid(model: DiagramModel): string {
  const rows = model.rows.filter(filled);
  if (!rows.length) return "";
  const lines = [`flowchart ${model.dir === "down" ? "TD" : "LR"}`, ...rows.map((r, i) => `  ${flowNode(`n${i}`, r.text, "round")}`)];
  for (let i = 0; i < rows.length - 1; i++) lines.push(`  n${i} --> n${i + 1}`);
  if (rows.length > 1) lines.push(`  n${rows.length - 1} --> n0`);
  return lines.join("\n");
}

function mindmapToMermaid(model: DiagramModel): string {
  const [first, ...rest] = model.rows;
  if (!model.rows.some(filled)) return "";
  const rows = normalizeDepths("mindmap", [first, ...rest.filter(filled)]);
  return [
    "mindmap",
    ...rows.map((r, i) => {
      const pad = "  ".repeat((r.depth ?? 0) + 1);
      const text = label(r.text) || "…";
      return i === 0 ? `${pad}n0(("${text}"))` : `${pad}n${i}("${text}")`;
    }),
  ].join("\n");
}

function timelineToMermaid(model: DiagramModel): string {
  const lines = ["timeline"];
  const title = oneLine(model.title);
  if (title) lines.push(`  title ${timelineTitle(title)}`);
  // Rows of the same date (or without one) are events of one period.
  const periods: { when: string; events: string[] }[] = [];
  for (const r of model.rows) {
    const when = oneLine(r.when);
    const what = oneLine(r.text);
    if (!when && !what) continue;
    const last = periods[periods.length - 1];
    if (last && (!when || when === last.when)) {
      if (what) last.events.push(what);
    } else periods.push({ when: when || "…", events: what ? [what] : [] });
  }
  if (!periods.length) return "";
  for (const p of periods) lines.push(`  ${[timelineText(p.when, true), ...p.events.map((e) => timelineText(e))].join(" : ")}`);
  return lines.join("\n");
}

function pieToMermaid(model: DiagramModel): string {
  const slices = model.rows.flatMap((r) => {
    const value = parseNumber(r.value);
    return value === null ? [] : [`  "${label(r.text) || "–"}" : ${value}`];
  });
  if (!slices.length) return "";
  const title = oneLine(model.title);
  return [model.showData ? "pie showData" : "pie", ...(title ? [`  title ${label(title)}`] : []), ...slices].join("\n");
}

function sequenceToMermaid(model: DiagramModel): string {
  const people = new Map<string, { id: string; name: string }>();
  const person = (name: string) => {
    const key = name.toLowerCase();
    let p = people.get(key);
    if (!p) {
      p = { id: `p${people.size}`, name };
      people.set(key, p);
    }
    return p.id;
  };
  const messages: string[] = [];
  for (const r of model.rows) {
    const from = oneLine(r.from);
    const to = oneLine(r.to);
    if (!from || !to) continue;
    const a = person(from);
    const b = person(to);
    const text = sequenceText(r.text);
    messages.push(`  ${a}${r.reply ? "-->>" : "->>"}${b}:${text ? ` ${text}` : ""}`);
  }
  if (!messages.length) return "";
  return ["sequenceDiagram", ...[...people.values()].map((p) => `  participant ${p.id} as ${sequenceText(p.name)}`), ...messages].join("\n");
}

/** The model as Mermaid code ("" when there is nothing to draw yet). */
export function toMermaid(model: DiagramModel): string {
  switch (model.kind) {
    case "mindmap":
      return mindmapToMermaid(model);
    case "flow":
      return flowToMermaid(model);
    case "cycle":
      return cycleToMermaid(model);
    case "timeline":
      return timelineToMermaid(model);
    case "pie":
      return pieToMermaid(model);
    case "sequence":
      return sequenceToMermaid(model);
  }
}

// Starting points ---------------------------------------------------------------------------------

/**
 * Rows from a simple outline: one row per line, two spaces (or a tab) indent, "- " bullets and
 * "1." numbers are dropped. Timeline, pie and sequence lines have their fields split by " | ", and a
 * first line "# …" is the title. Used for the starters and for pasting a list into the builder.
 */
export function rowsFromText(kind: DiagramKind, text: string): { rows: DiagramRow[]; title?: string } {
  let title: string | undefined;
  const rows: DiagramRow[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  // The smallest indentation counts as none (a list copied from the middle of a page).
  const indents = lines.filter((l) => l.trim()).map((l) => l.replace(/\t/g, "  ").match(/^ */)![0].length);
  const base = indents.length ? Math.min(...indents) : 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.replace(/\t/g, "  ").match(/^ */)![0].length - base;
    const content = line.trim().replace(/^(?:[-*•–]\s+|\d{1,3}[.)]\s+|\[[ xX]\]\s+)/, "");
    if (kind === "timeline" || kind === "pie") {
      if (!rows.length && title === undefined && content.startsWith("# ")) {
        title = content.slice(2).trim();
        continue;
      }
    }
    if (kind === "timeline") {
      const m = content.match(/^(.*?)(?:\s+\|\s+|\t|\s+[-–—]\s+|:\s+)(.*)$/);
      rows.push(m ? { when: m[1], text: m[2] } : { when: "", text: content });
    } else if (kind === "pie") {
      const m = content.match(/^(.*?)(?:\s*[|:\t]\s*|\s+)([\d.,' ]*\d)\s*%?$/);
      rows.push(m ? { text: m[1].trim(), value: m[2].trim() } : { text: content, value: "" });
    } else if (kind === "sequence") {
      const [from = "", to = "", message = "", flag] = content.split(/\s*\|\s*/);
      rows.push({ from, to, text: message, ...(flag === "reply" && { reply: true }) });
    } else {
      rows.push({ text: content, ...(isOutline(kind) && { depth: Math.floor(indent / 2) }) });
    }
  }
  // Indented as a plain outline (a pasted list may go under any row, even in a mind map).
  return { rows: normalizeDepths(isOutline(kind) ? "flow" : kind, rows), title };
}

/** A new diagram of `kind`, with the example rows in the reader's language. */
export function starterModel(kind: DiagramKind, locale: Locale): DiagramModel {
  const { rows, title } = rowsFromText(kind, noteBlocksText[locale].diagram.outlines[kind]);
  return { kind, rows: normalizeDepths(kind, rows), ...(title && { title }), ...(kind === "flow" && { dir: "down" as const }), ...(kind === "cycle" && { dir: "right" as const }) };
}

/** The attributes of a new diagram node made in the builder. */
export function newDiagramAttrs(kind: DiagramKind, locale: Locale) {
  const model = starterModel(kind, locale);
  return { model, src: toMermaid(model) };
}

/** One row of `kind` with nothing in it. */
export function emptyRow(kind: DiagramKind, depth = 0): DiagramRow {
  switch (kind) {
    case "timeline":
      return { when: "", text: "" };
    case "pie":
      return { text: "", value: "" };
    case "sequence":
      return { from: "", to: "", text: "" };
    default:
      return { text: "", ...(isOutline(kind) && { depth }) };
  }
}

/**
 * The same rows as another kind (switching kinds in the builder keeps what was written). A model
 * still exactly the example of its kind becomes the example of the new one.
 */
export function convertModel(model: DiagramModel, kind: DiagramKind, locale: Locale): DiagramModel {
  if (kind === model.kind) return model;
  const untouched = JSON.stringify(cleanModel(model)) === JSON.stringify(cleanModel(starterModel(model.kind, locale)));
  if (untouched || !hasContent(model)) return starterModel(kind, locale);
  const texts = model.rows.map((r) => ({ text: r.text, depth: r.depth ?? 0 }));
  let rows: DiagramRow[];
  if (kind === "timeline") rows = model.rows.map((r) => ({ when: r.when ?? "", text: r.text }));
  else if (kind === "pie") rows = model.rows.map((r) => ({ text: r.text, value: r.value ?? "" }));
  else if (kind === "sequence") rows = model.rows.map((r) => ({ from: r.from ?? "", to: r.to ?? "", text: r.text, ...(r.reply && { reply: true }) }));
  else rows = texts.map((r) => (isOutline(kind) ? r : { text: r.text }));
  const next: DiagramModel = { kind, rows: normalizeDepths(kind, rows) };
  if (model.title && (kind === "timeline" || kind === "pie")) next.title = model.title;
  if (kind === "flow") next.dir = model.dir ?? "down";
  if (kind === "cycle") next.dir = model.dir ?? "right";
  return next;
}

// Reading simple Mermaid code back -----------------------------------------------------------------

/** Mermaid's character codes ("#58;", "#quot;") as the characters. */
function decode(s: string) {
  const named: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " " };
  return s.replace(/#(\d+|[a-z]+);/gi, (m, code: string) => (/^\d+$/.test(code) ? String.fromCodePoint(Number(code)) : (named[code.toLowerCase()] ?? m))).replace(/​/g, "");
}

/** A mind map node's text without its shape ("root((Topic))", 'n1("Idea")', "Idea"). */
function mindmapText(raw: string): string | null {
  const s = raw.trim().replace(/\s*::icon\(.*\)$/, "").replace(/\s*:::.*$/, "");
  const m = s.match(/^[\w-]*\s*(\(\(|\)\)|\{\{|\(|\)|\[)\s*(.*?)\s*(\)\)|\(\(|\}\}|\)|\(|\])$/);
  const inner = m ? m[2] : s;
  const q = inner.match(/^"(.*)"$/);
  const text = decode((q ? q[1] : inner).replace(/^`(.*)`$/, "$1"));
  return text || null;
}

const FLOW_NODE = /^([A-Za-z][\w-]*)(?:\s*(\(\[|\(\(|\[|\(|\{)\s*(.*?)\s*(\]\)|\)\)|\]|\)|\}))?$/;
const FLOW_SHAPE_OF: Record<string, FlowShape> = { "[": "box", "(": "round", "{": "diamond", "((": "circle", "([": "round" };

/**
 * A flowchart that is one loop (a cycle) or one line of steps (a process without branches), as
 * the builder's model; anything else is null.
 */
function flowFromMermaid(lines: string[], dir: "down" | "right"): DiagramModel | null {
  const nodes = new Map<string, { text: string; shape: FlowShape }>();
  const order: string[] = [];
  const node = (raw: string): string | null => {
    const m = raw.trim().match(FLOW_NODE);
    if (!m) return null;
    const [, id, open, inner] = m;
    if (!nodes.has(id)) {
      nodes.set(id, { text: id, shape: "auto" });
      order.push(id);
    }
    if (open) {
      const q = inner.match(/^"(.*)"$/);
      nodes.set(id, { text: decode(q ? q[1] : inner), shape: FLOW_SHAPE_OF[open] ?? "auto" });
    }
    return id;
  };
  const edges: [string, string][] = [];
  for (const raw of lines) {
    const parts = raw.trim().split(/\s*-->\s*/);
    const ids = parts.map(node);
    if (ids.some((id) => id === null)) return null;
    for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i]!, ids[i + 1]!]);
  }
  if (!order.length) return null;
  const next = new Map<string, string>();
  for (const [a, b] of edges) {
    if (next.has(a)) return null;
    next.set(a, b);
  }
  // Follow the arrows from the first node: every node once, in one line or one loop.
  const seen: string[] = [];
  let at: string | undefined = order[0];
  while (at && !seen.includes(at)) {
    seen.push(at);
    at = next.get(at);
  }
  if (seen.length !== order.length) return null;
  const loop = at === order[0] && edges.length === order.length;
  if (!loop && edges.length !== order.length - 1) return null;
  const shape = (id: string) => nodes.get(id)!.shape;
  if (loop) return { kind: "cycle", dir, rows: seen.map((id) => ({ text: nodes.get(id)!.text })) };
  return {
    kind: "flow",
    dir,
    rows: seen.map((id) => {
      const text = nodes.get(id)!.text;
      const s = shape(id);
      // The shape the builder would pick anyway stays automatic.
      const auto = s === (/[?？]\s*$/.test(text) ? "diamond" : "box");
      return { text, depth: 0, ...(!auto && s !== "auto" && { shape: s }) };
    }),
  };
}

/**
 * The builder's model for simple Mermaid code (a mind map, timeline, pie chart, plain sequence,
 * cycle or straight process: what the old starters and the builder itself make), or null when the
 * code does more than the builder can show. Then switching to the builder starts over.
 */
export function modelFromMermaid(src: string): DiagramModel | null {
  const lines = src.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim() && !l.trim().startsWith("%%"));
  if (!lines.length) return null;
  const head = lines[0].trim();
  if (/^mindmap$/.test(head)) {
    const body = lines.slice(1);
    const indents = body.map((l) => l.match(/^ */)![0].length);
    // Indentation levels as they appear (Mermaid only compares them).
    const levels = [...new Set(indents)].sort((a, b) => a - b);
    const rows: DiagramRow[] = [];
    for (let i = 0; i < body.length; i++) {
      const text = mindmapText(body[i]);
      if (text === null) return null;
      rows.push({ text, depth: levels.indexOf(indents[i]) });
    }
    if (!rows.length || rows.filter((r) => r.depth === 0).length !== 1 || rows[0].depth !== 0) return null;
    return { kind: "mindmap", rows: normalizeDepths("mindmap", rows) };
  }
  if (/^timeline$/.test(head)) {
    let title: string | undefined;
    const rows: DiagramRow[] = [];
    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (line.startsWith("title ")) {
        title = decode(line.slice(6).trim());
        continue;
      }
      if (/^section\s/.test(line)) return null;
      const [when, ...events] = line.split(/\s*:\s*/);
      if (!events.length) rows.push({ when: decode(when), text: "" });
      events.forEach((e, i) => rows.push({ when: i === 0 ? decode(when) : "", text: decode(e) }));
    }
    return rows.length ? { kind: "timeline", rows, ...(title && { title }) } : null;
  }
  const pie = head.match(/^pie(\s+showData)?(?:\s+title\s+(.*))?$/);
  if (pie) {
    let title = pie[2] ? decode(pie[2].trim()) : undefined;
    const rows: DiagramRow[] = [];
    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      if (line.startsWith("title ")) {
        title = decode(line.slice(6).trim());
        continue;
      }
      const m = line.match(/^"(.*)"\s*:\s*([\d.]+)$/);
      if (!m) return null;
      rows.push({ text: decode(m[1]), value: m[2] });
    }
    return rows.length ? { kind: "pie", rows, ...(title && { title }), ...(pie[1] && { showData: true }) } : null;
  }
  const flow = head.match(/^(?:flowchart|graph)\s+(TD|TB|LR|BT|RL)$/);
  if (flow) return flowFromMermaid(lines.slice(1), flow[1] === "LR" || flow[1] === "RL" ? "right" : "down");
  if (/^sequenceDiagram$/.test(head)) {
    const names = new Map<string, string>();
    const rows: DiagramRow[] = [];
    for (const raw of lines.slice(1)) {
      const line = raw.trim();
      const p = line.match(/^(?:participant|actor)\s+([^\s]+)(?:\s+as\s+(.+))?$/);
      if (p) {
        names.set(p[1], decode(p[2] ?? p[1]));
        continue;
      }
      const m = line.match(/^([^-\s>]+)\s*(->>|-->>)\s*([^:\s]+)\s*:\s?(.*)$/);
      if (!m) return null;
      rows.push({ from: names.get(m[1]) ?? decode(m[1]), to: names.get(m[3]) ?? decode(m[3]), text: decode(m[4]), ...(m[2] === "-->>" && { reply: true }) });
    }
    return rows.length ? { kind: "sequence", rows } : null;
  }
  return null;
}
