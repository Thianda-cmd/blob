// What a note can show from a spreadsheet (the "sheetEmbed" note block), the light part: the
// block's attributes, checked when they come from a document or an address, and the addresses
// that open a note or a spreadsheet with one. Notes load this; the heavier part that reads the
// workbook (src/sheet/embed.ts) loads only with a block that shows something.

import { MAX_COLS, MAX_ROWS, type Area } from "./types";

export type SheetEmbedItem =
  | { kind: "chart"; chartId: string }
  | { kind: "table"; tableId: string }
  | { kind: "range"; sheetId: string; area: Area };

/** The note block's attributes. */
export type SheetEmbedAttrs = { pageId: string | null; item: SheetEmbedItem | null };

/** How wide the block is in the note: small, medium, large or the text's full width. */
export type SheetEmbedSize = "s" | "m" | "l" | "full";
export const EMBED_SIZES: SheetEmbedSize[] = ["s", "m", "l", "full"];

/** Width of a chart at each size, in px (full: the text column's width). */
export const CHART_WIDTH: Record<Exclude<SheetEmbedSize, "full">, number> = { s: 360, m: 520, l: 680 };

/** Rows a note shows of a table or range; the rest is in the spreadsheet. */
export const EMBED_MAX_ROWS = 200;
export const EMBED_MAX_COLS = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[\w.:-]{1,64}$/;

/** A page id that is a uuid (pages.id), or null. */
export const embedPageId = (x: unknown): string | null => (typeof x === "string" && UUID.test(x) ? x.toLowerCase() : null);

/** An item from stored or sent JSON, checked (null when it isn't one). */
export function readEmbedItem(x: unknown): SheetEmbedItem | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (o.kind === "chart" && typeof o.chartId === "string" && ID.test(o.chartId)) return { kind: "chart", chartId: o.chartId };
  if (o.kind === "table" && typeof o.tableId === "string" && ID.test(o.tableId)) return { kind: "table", tableId: o.tableId };
  if (o.kind === "range" && typeof o.sheetId === "string" && ID.test(o.sheetId) && o.area && typeof o.area === "object") {
    const a = o.area as Record<string, unknown>;
    const n = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : null);
    const r0 = n(a.r0, MAX_ROWS);
    const r1 = n(a.r1, MAX_ROWS);
    const c0 = n(a.c0, MAX_COLS);
    const c1 = n(a.c1, MAX_COLS);
    if (r0 === null || r1 === null || c0 === null || c1 === null) return null;
    return { kind: "range", sheetId: o.sheetId, area: { r0: Math.min(r0, r1), c0: Math.min(c0, c1), r1: Math.max(r0, r1), c1: Math.max(c0, c1) } };
  }
  return null;
}

/** Attributes from stored or sent JSON, checked; null when there is no page or item to show. */
export function readEmbedAttrs(x: unknown): SheetEmbedAttrs | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const pageId = embedPageId(o.pageId);
  const item = readEmbedItem(o.item);
  return pageId && item ? { pageId, item } : null;
}

// Adding to a note -----------------------------------------------------------------------------------
//
// "Add to note" (src/components/sheet/embed/AddToNote.tsx) opens the note at
// /p/<note>?sheetEmbed=<request>, and the note adds the block (src/components/editor/useSheetEmbedParam.ts).
// The request is a one-time token for what this tab's sessionStorage keeps: only Blob's own dialog,
// in this tab, adds a block without asking. Anything else in the parameter (an address someone
// sent, or a tab that couldn't keep the token) is only offered, never added unasked.

const TOKEN = /^[0-9a-f]{24}$/;
const tokenKey = (token: string) => `blob-embed:${token}`;

/** A one-time token of this tab for `attrs` (null when the tab can't keep one: no sessionStorage). */
function rememberEmbed(attrs: SheetEmbedAttrs): string | null {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(tokenKey(token), JSON.stringify({ pageId: attrs.pageId, item: attrs.item }));
    return token;
  } catch {
    return null;
  }
}

/**
 * The note's address that adds an embed when the note opens. The request is kept in this tab
 * under a one-time token (see above); where it can't be, the address carries the attributes, and
 * the note asks before adding them.
 */
export function addToNoteHref(noteId: string, attrs: SheetEmbedAttrs): string {
  const token = rememberEmbed(attrs);
  return `/p/${noteId}?sheetEmbed=${token ?? encodeURIComponent(JSON.stringify({ pageId: attrs.pageId, item: attrs.item }))}`;
}

/** A ?sheetEmbed= value that is a one-time token (not attributes). */
export const isEmbedToken = (param: string | null): param is string => !!param && TOKEN.test(param);

/** What this tab's one-time token stands for, without using it up (null: not this tab's, or used already). */
export function embedFromToken(token: string): SheetEmbedAttrs | null {
  if (!isEmbedToken(token)) return null;
  try {
    return readEmbedAttrs(JSON.parse(sessionStorage.getItem(tokenKey(token)) ?? "null"));
  } catch {
    return null;
  }
}

/** Use a one-time token up (after its block was added). */
export function forgetEmbedToken(token: string) {
  try {
    sessionStorage.removeItem(tokenKey(token));
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/** A ?sheetEmbed= value with attributes (not a token) → the attributes (null when they aren't valid). */
export function embedFromParam(param: string | null): SheetEmbedAttrs | null {
  if (!param || isEmbedToken(param)) return null;
  try {
    return readEmbedAttrs(JSON.parse(param));
  } catch {
    return null;
  }
}

/** The address parameter that opens a spreadsheet with an embed's chart, table or cells selected. */
export const SHEET_ITEM_PARAM = "sheetItem";

/** The spreadsheet's address with what a block shows selected (the block's "Öffnen"). */
export function sheetItemHref(pageId: string, item: SheetEmbedItem): string {
  return `/p/${pageId}?${SHEET_ITEM_PARAM}=${encodeURIComponent(JSON.stringify(item))}`;
}

/** The ?sheetItem= value of a spreadsheet's address → the item (null when it isn't valid). */
export function itemFromParam(param: string | null): SheetEmbedItem | null {
  if (!param) return null;
  try {
    return readEmbedItem(JSON.parse(param));
  } catch {
    return null;
  }
}

/** Two items show the same thing. */
export function sameItem(a: SheetEmbedItem | null, b: SheetEmbedItem | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "chart") return a.chartId === (b as typeof a).chartId;
  if (a.kind === "table") return a.tableId === (b as typeof a).tableId;
  const r = b as typeof a;
  return a.sheetId === r.sheetId && a.area.r0 === r.area.r0 && a.area.c0 === r.area.c0 && a.area.r1 === r.area.r1 && a.area.c1 === r.area.c1;
}
