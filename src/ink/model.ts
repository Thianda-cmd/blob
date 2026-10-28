// Handwritten notes (pages of kind "ink"): what is on them and how it is stored.
//
// A note is a column of sheets (A4 paper with lines, a grid, dots…) and on each sheet strokes,
// pictures and text boxes. Every one of these is an item with an id made up on the device, stored
// as one row of ink_items (migration 0022) and sent as a WireItem. Coordinates are sheet units: a
// sheet is SHEET_W wide and SHEET_H tall (A4 portrait, one unit is about 0.21 mm), the origin is
// its top left corner.

import { decodePoints, encodePoints } from "./codec";
import { strokeBox } from "./geometry";

export const SHEET_W = 1000;
export const SHEET_H = 1414;
/** Space between sheets in the column (units). */
export const SHEET_GAP = 36;

/** One unit in millimetres (A4 is 210 mm wide). */
export const MM = SHEET_W / 210;

export type PenTool = "pen" | "fountain" | "pencil" | "calligraphy" | "highlighter";
export const PEN_TOOLS: PenTool[] = ["pen", "fountain", "pencil", "calligraphy", "highlighter"];

/** Strokes recognised as a shape (drawn and held still) are kept as exact polylines, never smoothed. */
export type ShapeKind = "line" | "ellipse" | "rect" | "triangle" | "polygon" | "arrow";
const SHAPES: ShapeKind[] = ["line", "ellipse", "rect", "triangle", "polygon", "arrow"];

export type Template = "blank" | "lined" | "narrow" | "grid" | "dots" | "mm" | "cornell" | "music";
export const TEMPLATES: Template[] = ["blank", "lined", "narrow", "grid", "dots", "mm", "cornell", "music"];

/** "auto" follows the app's light or dark look. */
export type Paper = "auto" | "white" | "cream" | "gray" | "dark";
export const PAPERS: Paper[] = ["auto", "white", "cream", "gray", "dark"];

/** "ink" is the default colour: black on light paper, white on dark paper. Otherwise #rrggbb. */
export type InkColor = string;
export const INK = "ink";

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type Sheet = { kind: "sheet"; id: string; seq: number; tpl: Template; paper: Paper };

export type Stroke = {
  kind: "stroke";
  id: string;
  sheet: string;
  seq: number;
  tool: PenTool;
  color: InkColor;
  /** The pen's size when it was drawn (units); the widths below already include pressure. */
  size: number;
  /** 0–1 (pencils: how hard they were pressed). */
  opacity: number;
  shape: ShapeKind | null;
  /** The points (units) and the line's width at each (units). */
  xs: Float32Array;
  ys: Float32Array;
  ws: Float32Array;
  box: Box;
};

export type Picture = {
  kind: "image";
  id: string;
  sheet: string;
  seq: number;
  /** In the files bucket (page/<page id>/<name>). */
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Turned by this many radians around its centre. */
  rot: number;
  box: Box;
};

export type TextBox = {
  kind: "text";
  id: string;
  sheet: string;
  seq: number;
  text: string;
  x: number;
  y: number;
  /** Width of the box (units); the height follows the text. */
  w: number;
  /** Font size (units). */
  fs: number;
  color: InkColor;
  box: Box;
};

export type Thing = Stroke | Picture | TextBox;
export type Item = Sheet | Thing;
export type ItemKind = Item["kind"];

/** An ink_items row as the database keeps it and as it is sent (ink_push / ink_pull). */
export type WireItem = {
  id: string;
  kind: ItemKind;
  sheet: string | null;
  seq: number;
  data: Record<string, unknown>;
  deleted?: boolean;
  /** From the server only (its timestamptz text, kept as is: it has microseconds). */
  updated_at?: string;
  updated_by?: string | null;
};

/** What pages.content holds for a handwritten note: a small preview for lists (src/ink/preview.ts). */
export type InkContent = { v: 1; preview?: InkPreview | null };

/** The first sheet, small: its paper and what is on it, in preview units (PREVIEW_K of sheet units: 250 × 353.5). */
export type InkPreview = {
  tpl: Template;
  paper: Paper;
  /** How many sheets the note has. */
  sheets: number;
  /** Strokes: [colour, width, SVG path data, opacity][] in drawing order (highlighters first). */
  lines: [string, number, string, number][];
  /** Text boxes: [colour, font size, x, y, the lines as wrapped, joined by "\n"][]. */
  texts?: [string, number, number, number, string][];
  /** Pictures, as where they are: [x, y, w, h, turn (radians)][]. */
  pics?: [number, number, number, number, number][];
};

/** Preview units: a quarter of a sheet unit, whole numbers. */
export const PREVIEW_K = 0.25;

/** Whether a stored preview is one this app can show. */
export function readPreview(content: unknown): InkPreview | null {
  const p = (content as { preview?: unknown } | null)?.preview as InkPreview | undefined;
  if (!p || typeof p !== "object" || !Array.isArray(p.lines)) return null;
  return { ...p, texts: Array.isArray(p.texts) ? p.texts : undefined, pics: Array.isArray(p.pics) ? p.pics : undefined };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{6}$/i;

export const isColor = (c: unknown): c is InkColor => c === INK || (typeof c === "string" && HEX.test(c));
export const isTemplate = (t: unknown): t is Template => TEMPLATES.includes(t as Template);
export const isPaper = (p: unknown): p is Paper => PAPERS.includes(p as Paper);
export const isPenTool = (t: unknown): t is PenTool => PEN_TOOLS.includes(t as PenTool);
export const isShape = (s: unknown): s is ShapeKind => SHAPES.includes(s as ShapeKind);

const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);

/** Highlighters are drawn under everything else on the sheet, pictures under the ink. */
export function layerOf(item: Thing): number {
  if (item.kind === "image") return 0;
  if (item.kind === "text") return 1;
  return item.tool === "highlighter" ? 2 : 3;
}

/** Back to front: layer, then seq, then id (the same order on every device). */
export function compareThings(a: Thing, b: Thing): number {
  return layerOf(a) - layerOf(b) || a.seq - b.seq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function compareSheets(a: Sheet, b: Sheet): number {
  return a.seq - b.seq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export const emptyBox = (): Box => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export const boxesTouch = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
export function unionBox(a: Box, b: Box): Box {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** A box around a turned rectangle. */
export function rotatedBox(x: number, y: number, w: number, h: number, rot: number): Box {
  if (!rot) return { x0: x, y0: y, x1: x + w, y1: y + h };
  const cx = x + w / 2;
  const cy = y + h / 2;
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hw = (w * c + h * s) / 2;
  const hh = (w * s + h * c) / 2;
  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
}

/** Rough height of a text box (lines × line height); the editor measures the real one. */
export function textBoxHeight(text: string, w: number, fs: number): number {
  const perLine = Math.max(4, Math.floor(w / (fs * 0.52)));
  let lines = 0;
  for (const para of text.split("\n")) lines += Math.max(1, Math.ceil(para.length / perLine));
  return lines * fs * 1.35;
}

// Ids and order ----------------------------------------------------------------------------------

export const newId = () => crypto.randomUUID();

let lastSeq = 0;
/** A seq after every one this device made before: new things go on top. */
export function nextSeq(): number {
  const t = Date.now();
  lastSeq = t > lastSeq ? t : lastSeq + 0.001;
  return lastSeq;
}

/** A seq between two sheets (a new sheet inserted there). */
export function seqBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return (after as number) - 1;
  if (after === null) return before + 1;
  const mid = (before + after) / 2;
  return mid > before && mid < after ? mid : before + (after - before) / 2;
}

// Reading items --------------------------------------------------------------------------------

/** A stored item as the editor uses it; null when it can't be read (a newer app's, or damaged). */
export function decodeItem(w: WireItem): Item | null {
  if (!w || typeof w.id !== "string" || !UUID.test(w.id) || w.deleted) return null;
  const d = w.data && typeof w.data === "object" ? w.data : {};
  const seq = num(w.seq, -1e15, 1e15, 0);
  if (w.kind === "sheet") {
    return { kind: "sheet", id: w.id, seq, tpl: isTemplate(d.tpl) ? d.tpl : "blank", paper: isPaper(d.paper) ? d.paper : "auto" };
  }
  const sheet = typeof w.sheet === "string" && UUID.test(w.sheet) ? w.sheet : null;
  if (!sheet) return null;
  if (w.kind === "stroke") {
    if (!isPenTool(d.t) || typeof d.p !== "string") return null;
    const pts = decodePoints(d.p);
    if (!pts || !pts.xs.length) return null;
    return {
      kind: "stroke",
      id: w.id,
      sheet,
      seq,
      tool: d.t,
      color: isColor(d.c) ? d.c : INK,
      size: num(d.w, 0.1, 400, 3),
      opacity: num(d.o, 0.05, 1, 1),
      shape: isShape(d.s) ? d.s : null,
      ...pts,
      box: strokeBox(pts.xs, pts.ys, pts.ws),
    };
  }
  if (w.kind === "image") {
    if (typeof d.path !== "string" || !d.path.startsWith("page/") || d.path.length > 300) return null;
    const x = num(d.x, -5000, 5000, 0);
    const y = num(d.y, -5000, 5000, 0);
    const wd = num(d.w, 1, 20000, 100);
    const h = num(d.h, 1, 20000, 100);
    const rot = num(d.r, -100, 100, 0);
    return { kind: "image", id: w.id, sheet, seq, path: d.path, x, y, w: wd, h, rot, box: rotatedBox(x, y, wd, h, rot) };
  }
  if (w.kind === "text") {
    const text = typeof d.txt === "string" ? d.txt.slice(0, 5000) : "";
    const x = num(d.x, -5000, 5000, 0);
    const y = num(d.y, -5000, 5000, 0);
    const wd = num(d.w, 20, 5000, 400);
    const fs = num(d.fs, 6, 200, 28);
    return { kind: "text", id: w.id, sheet, seq, text, x, y, w: wd, fs, color: isColor(d.c) ? d.c : INK, box: { x0: x, y0: y, x1: x + wd, y1: y + textBoxHeight(text, wd, fs) } };
  }
  return null;
}

/** An item as it is stored and sent. */
export function encodeItem(item: Item): WireItem {
  switch (item.kind) {
    case "sheet":
      return { id: item.id, kind: "sheet", sheet: null, seq: item.seq, data: { tpl: item.tpl, paper: item.paper } };
    case "stroke": {
      const data: Record<string, unknown> = { t: item.tool, c: item.color, w: round2(item.size), p: encodePoints(item.xs, item.ys, item.ws) };
      if (item.opacity < 1) data.o = round2(item.opacity);
      if (item.shape) data.s = item.shape;
      return { id: item.id, kind: "stroke", sheet: item.sheet, seq: item.seq, data };
    }
    case "image":
      return { id: item.id, kind: "image", sheet: item.sheet, seq: item.seq, data: { path: item.path, x: round2(item.x), y: round2(item.y), w: round2(item.w), h: round2(item.h), ...(item.rot ? { r: round4(item.rot) } : {}) } };
    case "text":
      return { id: item.id, kind: "text", sheet: item.sheet, seq: item.seq, data: { txt: item.text, x: round2(item.x), y: round2(item.y), w: round2(item.w), fs: round2(item.fs), c: item.color } };
  }
}

/** Removing an item: a tombstone with the same id. */
export function tombstone(item: Item): WireItem {
  return { id: item.id, kind: item.kind, sheet: item.kind === "sheet" ? null : item.sheet, seq: item.seq, data: {}, deleted: true };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
