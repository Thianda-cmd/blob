// Typing a formula with the grid: references get colours (the same colour frames their cells on
// the grid), clicking, dragging or arrow-keying to cells after "=", "(", ";" or an operator
// inserts their reference (point mode, also onto other sheets), and F4 cycles the $ signs of the
// reference at the caret.

import type { Locale } from "@/i18n/config";
import { areaName, colName, quoteSheetName } from "@/sheet/a1";
import { tokenizeFormula, type FormulaToken } from "@/sheet/engine";
import { sheetById } from "@/sheet/ops";
import type { Area, Pos, SheetColor, Workbook } from "@/sheet/types";
import { insertRef, REF_COLORS, refColors, wantsRef } from "../chrome/formulaInput";
import { mainArea, type SheetStore } from "../store";
import { dataEdge } from "./navigation";
import type { RefFrame } from "./Selection";

// The formula bar's helpers (chrome/formulaInput.ts) decide colours and pointing, so cell and bar
// behave the same. They are wrapped: half-typed formulas are their daily bread, but should one
// ever throw, simple rules below keep typing and pointing working, and it is reported once.
const warned = new Set<string>();
function warnOnce(what: string, err: unknown) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`sheet: ${what} failed`, err);
}

/** Tokens of a formula being typed (text with "="), positions in that text, with each reference's colour. null for plain text. */
export function formulaTokens(text: string, locale: Locale): { tokens: FormulaToken[]; colors: Map<FormulaToken, SheetColor> } | null {
  if (!text.startsWith("=")) return null;
  let raw: FormulaToken[];
  try {
    raw = tokenizeFormula(text.slice(1), locale);
  } catch {
    return null;
  }
  // The formula bar colours references the same way (refColors); should that fail, each distinct
  // reference still gets the next of the same colours.
  let colors: Map<FormulaToken, SheetColor>;
  try {
    colors = refColors(raw);
  } catch (err) {
    warnOnce("refColors", err);
    colors = new Map();
    const byText = new Map<string, SheetColor>();
    for (const t of raw) {
      if (t.kind !== "ref") continue;
      const key = t.text.replace(/\$/g, "").toUpperCase();
      if (!byText.has(key)) byText.set(key, REF_COLORS[byText.size % REF_COLORS.length]);
      colors.set(t, byText.get(key)!);
    }
  }
  // Shift positions by the "=" so they index `text`; colours stay with the shifted tokens.
  const tokens: FormulaToken[] = [];
  const shifted = new Map<FormulaToken, SheetColor>();
  for (const t of raw) {
    const s = { ...t, start: t.start + 1, end: t.end + 1 };
    tokens.push(s);
    const c = colors.get(t);
    if (c) shifted.set(s, c);
  }
  return { tokens, colors: shifted };
}

/** The coloured frames of a formula's references that lie on `sheetId`. */
export function refFrames(wb: Workbook, editSheetId: string, sheetId: string, tok: ReturnType<typeof formulaTokens>): RefFrame[] {
  if (!tok) return [];
  const out: RefFrame[] = [];
  for (const t of tok.tokens) {
    if (t.kind !== "ref" || !t.ref) continue;
    const color = tok.colors.get(t);
    if (!color) continue;
    const name = t.ref.sheet;
    const target = name === null ? sheetById(wb, editSheetId) : wb.sheets.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!target || target.id !== sheetId) continue;
    let area: Area = t.ref.area;
    if (t.ref.whole === "cols") area = { ...area, r0: 0, r1: target.size.rows - 1 };
    if (t.ref.whole === "rows") area = { ...area, c0: 0, c1: target.size.cols - 1 };
    out.push({ area, color });
  }
  return out;
}

/** Is the caret right after a reference (one just inserted by pointing, which the next point replaces)? */
function refEndsAtCaret(text: string, caret: number, locale: Locale): boolean {
  const tok = formulaTokens(text, locale);
  return !!tok?.tokens.some((t) => t.kind === "ref" && t.end === caret);
}

// Should the formula bar's pointing helpers ever fail, these simple rules keep pointing working.

function wantsRefFallback(text: string, caret: number, locale: Locale): boolean {
  if (!text.startsWith("=")) return false;
  const before = text.slice(0, caret).replace(/\s+$/, "");
  return /[=(;,+\-*/^&<>:]$/.test(before) || refEndsAtCaret(text, caret, locale);
}

function insertRefFallback(text: string, caret: number, ref: string, locale: Locale): { text: string; caret: number } {
  const tok = formulaTokens(text, locale);
  const last = tok?.tokens.find((t) => t.kind === "ref" && t.end === caret);
  const start = last ? last.start : caret;
  return { text: text.slice(0, start) + ref + text.slice(caret), caret: start + ref.length };
}

/**
 * The reference pointing inserted last (in the text it produced): the next point replaces exactly
 * it, whatever follows it in the formula. Forgotten as soon as the text or caret moves on.
 */
let pointed: { text: string; start: number; end: number } | null = null;

const stillPointed = (text: string, caret: number) => !!pointed && pointed.text === text && pointed.end === caret;

/** Should a click on a cell (or an arrow key) insert a reference now? */
export function pointing(store: SheetStore): boolean {
  const s = store.get();
  const e = s.edit;
  if (!e || !e.text.startsWith("=")) return false;
  if (stillPointed(e.text, e.caret)) return true;
  try {
    return wantsRef(e.text, e.caret, s.locale);
  } catch (err) {
    warnOnce("wantsRef", err);
    return wantsRefFallback(e.text, e.caret, s.locale);
  }
}

/** The selection as a reference for the formula being typed ("B3", "B3:B9", "B:B", "'Blatt 2'!A1" when it is on another sheet). */
function selectionRef(store: SheetStore): string {
  const s = store.get();
  const area = mainArea(s.selection);
  const sheet = sheetById(s.workbook, s.sheetId);
  let name = areaName(area);
  if (sheet && area.r0 === 0 && area.r1 >= sheet.size.rows - 1 && sheet.size.rows > 1) name = `${colName(area.c0)}:${colName(area.c1)}`;
  else if (sheet && area.c0 === 0 && area.c1 >= sheet.size.cols - 1 && sheet.size.cols > 1) name = `${area.r0 + 1}:${area.r1 + 1}`;
  if (!s.edit || s.edit.sheetId === s.sheetId || !sheet) return name;
  return `${quoteSheetName(sheet.name)}!${name}`;
}

/** Put the selection's reference into the formula at the caret (replacing the one just pointed at). */
export function insertSelectionRef(store: SheetStore) {
  const s = store.get();
  const e = s.edit;
  if (!e) return;
  const ref = selectionRef(store);
  let next: { text: string; caret: number };
  if (pointed && stillPointed(e.text, e.caret)) next = { text: e.text.slice(0, pointed.start) + ref + e.text.slice(pointed.end), caret: pointed.start + ref.length };
  else {
    try {
      next = insertRef(e.text, e.caret, ref, s.locale);
    } catch (err) {
      warnOnce("insertRef", err);
      next = insertRefFallback(e.text, e.caret, ref, s.locale);
    }
  }
  pointed = { text: next.text, start: next.caret - ref.length, end: next.caret };
  store.updateEdit(next.text, next.caret);
}

/** Point with the mouse, pen or a finger: the cell (or the area dragged over) becomes the reference. */
export function pointAt(store: SheetStore, anchor: Pos, focus: Pos) {
  store.select({ anchor, focus, extra: [] }, { keepEdit: true });
  insertSelectionRef(store);
}

/**
 * Point with the arrow keys: a new reference starts at the cell being edited (like Excel), a
 * reference just inserted moves on from where it points; Shift grows it, Ctrl/⌘ jumps to the
 * edge of the data.
 */
export function pointByKey(store: SheetStore, dRow: number, dCol: number, extend: boolean, jump: boolean) {
  const s = store.get();
  const e = s.edit;
  if (!e) return;
  if (!stillPointed(e.text, e.caret) && !refEndsAtCaret(e.text, e.caret, s.locale) && s.sheetId === e.sheetId) store.select({ row: e.row, col: e.col }, { keepEdit: true });
  moveSelection(store, dRow, dCol, { extend, jump, keepEdit: true });
  insertSelectionRef(store);
}

/** Arrow keys on the grid: one cell (skipping hidden rows and columns) or to the edge of the data; Shift extends. */
export function moveSelection(store: SheetStore, dRow: number, dCol: number, opts: { extend: boolean; jump: boolean; keepEdit?: boolean }) {
  const s = store.get();
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return;
  const hidden = (r: number) => store.isRowHidden(s.sheetId, r);
  const from = opts.extend ? s.selection.focus : s.selection.anchor;
  let to: Pos;
  if (opts.jump) to = dataEdge(sheet, from, dRow, dCol, hidden);
  else {
    let r = from.row + dRow;
    let c = from.col + dCol;
    while (r >= 0 && r < sheet.size.rows && dRow && hidden(r)) r += dRow;
    while (c >= 0 && c < sheet.size.cols && dCol && sheet.cols[c]?.hidden) c += dCol;
    if (r < 0 || r >= sheet.size.rows) r = from.row;
    if (c < 0 || c >= sheet.size.cols) c = from.col;
    to = { row: r, col: c };
  }
  if (opts.extend) store.select({ anchor: s.selection.anchor, focus: to, extra: s.selection.extra }, { keepEdit: opts.keepEdit });
  else store.select(to, { keepEdit: opts.keepEdit });
}

const REF_PART = /^(\$?)([A-Za-z]{1,3})?(\$?)([0-9]{1,7})?$/;

/** F4: the reference at the caret goes A1 → $A$1 → A$1 → $A1 → A1 (every part of a range together). */
export function cycleReference(text: string, caret: number, locale: Locale): { text: string; caret: number } | null {
  const tok = formulaTokens(text, locale);
  const t = tok?.tokens.find((k) => k.kind === "ref" && k.start <= caret && caret <= k.end);
  if (!t) return null;
  const src = text.slice(t.start, t.end);
  const bang = src.lastIndexOf("!");
  const prefix = bang >= 0 ? src.slice(0, bang + 1) : "";
  const parts = src.slice(prefix.length).split(":");
  const first = REF_PART.exec(parts[0]);
  if (!first) return null;
  // Which of the four the first part is: 0 A1, 1 $A$1, 2 A$1, 3 $A1 (a whole column or row counts its one part).
  const colAbs = !!first[1] && !!first[2];
  const rowAbs = first[2] ? !!first[3] && !!first[4] : !!first[1] && !!first[4];
  const mode = colAbs && rowAbs ? 1 : rowAbs ? 2 : colAbs ? 3 : 0;
  const next = (mode + 1) % 4;
  const wantCol = next === 1 || next === 3;
  const wantRow = next === 1 || next === 2;
  const rebuilt: string[] = [];
  for (const part of parts) {
    const m = REF_PART.exec(part);
    if (!m) return null;
    const col = m[2] ?? "";
    const row = m[4] ?? "";
    rebuilt.push(`${col && wantCol ? "$" : ""}${col}${row && wantRow ? "$" : ""}${row}`);
  }
  const replaced = prefix + rebuilt.join(":");
  return { text: text.slice(0, t.start) + replaced + text.slice(t.end), caret: t.start + replaced.length };
}
