"use client";

// The spreadsheet editor's state: the workbook and its values, the sheet on screen, the selection,
// the cell being edited, undo and redo. One store per open spreadsheet; every part of the editor
// (grid, formula bar, toolbar, tabs, charts, tables) reads it with useSheet and changes it through
// its actions.
//
// CONTRACT: the types and the SheetStore interface are what the other parts are written against.
// Keep them; add members if needed. createSheetStore is implemented by the grid.

import { createContext, useContext, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";
import { sheetCollabText, type TakeBackRefusal } from "@/i18n/messages/sheetCollab";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { areaOf, inArea, parseKey, posName, quoteSheetName, sameArea } from "@/sheet/a1";
import { keptAsTheirs, sameJson, takeBack, type Kept, type MergeReport } from "@/sheet/collab";
import { storable, storableWork } from "@/sheet/doc";
import { createCalc, editText, parseInput, typedFormat, type Calc, type ParsedInput } from "@/sheet/engine";
import { formulaFormat, inSheet, type TypingPlace } from "@/sheet/engine/input";
import { colonNotice } from "@/sheet/engine/messages";
import { getCell, setCells, sheetById } from "@/sheet/ops";
import { followArea, followCell, opsSince } from "@/sheet/sheetLog";
import { afterInput, afterPaste, filteredRows } from "@/sheet/table/model";
import { MAX_COLS, MAX_ROWS, type Area, type Cell, type CellStyle, type NumberFormat, type Pos, type Sheet, type SheetOp, type Workbook } from "@/sheet/types";
import { currentSheetNotice, hideSheetNotice, noticeDuration, showSheetNotice } from "./notice";

export type Selection = {
  /** Where the selection started; the active cell (the one you type into). */
  anchor: Pos;
  /** The opposite corner (Shift+arrows, dragging). anchor = focus: one cell. */
  focus: Pos;
  /**
   * More areas added with Ctrl/⌘ (a chart of two columns that aren't side by side).
   * Enter and Tab inside a selected range keep the range here as the last area while the active
   * cell (anchor = focus) walks through it; selectionAreas() and activeArea() read that right.
   */
  extra: Area[];
};

export type EditState = {
  sheetId: string;
  row: number;
  col: number;
  /** What is typed, in the user's language ("=MITTELWERT(B2;B3)", "1,5"). */
  text: string;
  /** Caret position in `text`. */
  caret: number;
  /** In the cell itself or in the formula bar. */
  via: "cell" | "bar";
  /**
   * true: typing replaced the cell's content (Excel's "Eingeben"): arrow keys commit and move.
   * false: editing what was there (F2, double-click, the formula bar): arrow keys move the caret.
   */
  replace: boolean;
  /** Why the last commit failed (a formula that doesn't parse); the editor stays open and shows it. */
  error: { message: string; at: number } | null;
} | null;

export type SheetState = {
  /** The spreadsheet page (pages.id). */
  pageId: string;
  workbook: Workbook;
  /** Values of `workbook`; a new one after every change. */
  calc: Calc;
  /** The sheet on screen. */
  sheetId: string;
  selection: Selection;
  edit: EditState;
  /** Marching ants around what was copied or cut. */
  clip: { sheetId: string; area: Area; cut: boolean } | null;
  /**
   * A cut that someone else's change of rows or columns cancelled (replaceRemote): pasting it does
   * nothing but say so again (grid/clipboard.ts), until something else is copied or cut.
   */
  stoppedCut?: { sheetId: string; area: Area } | null;
  /** The chart or smart table whose settings are open (side panel, or a bottom sheet on phones). */
  focus: { kind: "chart" | "table"; id: string } | null;
  readOnly: boolean;
  locale: Locale;
  canUndo: boolean;
  canRedo: boolean;
  /** Counts document changes (local and remote); saving watches it. */
  version: number;
  /** Grid zoom, 0.75–2 (pinch, Ctrl+wheel, the status bar). */
  zoom: number;
  /** What Undo and Redo would undo or redo ("Eingabe", "Einfügen"…), for the buttons' tooltips. */
  undoLabel?: string;
  redoLabel?: string;
};

export interface SheetStore {
  get(): SheetState;
  subscribe(listener: () => void): () => void;

  /**
   * Change the document with a pure function (src/sheet/ops.ts, src/sheet/table/model.ts…).
   * One undo step called `label`. Nothing happens when read-only or when the function returns
   * the same workbook.
   */
  apply(label: string, change: (wb: Workbook, calc: Calc) => Workbook): void;
  /**
   * Typing `text` into a cell (parsed like Excel, see parseInput); keeps the cell's look and adds
   * a format the input implies. Also grows a smart table typed right below or beside it, and
   * fills a smart table's column when a formula is typed into it (src/sheet/table/model.ts afterInput).
   * Returns false when a formula doesn't parse (nothing changes).
   */
  input(at: Pos, text: string): boolean;

  setSheet(sheetId: string): void;
  /** One cell, an area (anchor top-left) or a full selection. Commits a running edit unless keepEdit (formula reference picking). */
  select(sel: Selection | Pos | Area, opts?: { keepEdit?: boolean }): void;
  /** Start editing the active cell (or `at`): F2/double-click (replace false), typing a character (replace true, text = it). */
  startEdit(opts: { via: "cell" | "bar"; replace: boolean; text?: string; at?: Pos }): void;
  updateEdit(text: string, caret: number): void;
  /** Commit the running edit and move the selection (Enter: down, Tab: right, Shift: back). false: the formula didn't parse. */
  commitEdit(move?: "down" | "up" | "right" | "left" | null): boolean;
  cancelEdit(): void;
  /**
   * The selection the running edit started from (what Ctrl+Enter fills): pointing at cells for a
   * formula moves the selection, not this. null when nothing is being edited.
   */
  editSelection(): Selection | null;

  setClip(clip: SheetState["clip"]): void;
  setFocus(focus: SheetState["focus"]): void;
  setZoom(zoom: number): void;

  /**
   * Undo and redo only take back what that step did: other people's changes since stay, on the
   * rows they made them on (src/sheet/collab.ts takeBack), also where they changed what the step
   * changed (a notice says which cells). A step whose rows or columns others have moved since
   * can't be taken back without guessing: it is dropped with a message instead.
   */
  undo(): void;
  redo(): void;

  /** A row hidden by hand or by a smart table's filter (what the grid hides and SUBTOTAL skips). */
  isRowHidden(sheetId: string, row: number): boolean;

  /**
   * Someone else's save, already merged with ours: replaces the document without an undo step.
   * The selection, a running edit and what was copied or cut stay on their cells where the other
   * person inserted, deleted, sorted or moved rows or columns (a running edit whose cell is gone
   * ends, with a notice; a cut whose cells moved is cancelled). `conflicts`: the merge's report
   * (collab.ts MergeReport), when it kept a sheet as theirs and put mine on a copy: a running edit
   * on that sheet goes on in the copy, which has my rows, and undo and redo no longer take back
   * steps made on that sheet before (they say where my version is now).
   */
  replaceRemote(wb: Workbook, conflicts?: MergeReport["conflicts"]): void;

  /**
   * The workbook with text the database can't store repaired (src/sheet/doc.ts storable: half an
   * emoji pasted becomes U+FFFD), as saving sent it (saver.ts): replaces the document without an
   * undo step, and the undo and redo steps get the same repair, so undo still takes back the step
   * that brought that text (and says nothing about anyone else). On a huge spreadsheet, with many
   * steps since that text came (offline for long), only the newest steps: the older ones go.
   */
  repair(wb: Workbook): void;

  /**
   * A new start (a template picked for an empty spreadsheet): replaces the document and clears
   * undo and redo, so undoing can't go back to the empty sheet before it.
   */
  reset(wb: Workbook): void;
}

// ----------------------------------------------------------------------------------------------
// Selection helpers (also for the toolbar, status bar, charts and tables)

/** A selection of one cell. */
export const singleCell = (p: Pos): Selection => ({ anchor: { row: p.row, col: p.col }, focus: { row: p.row, col: p.col }, extra: [] });

/** The area between anchor and focus (the one the active cell is in, unless Enter walks through a range: see activeArea). */
export const mainArea = (sel: Selection): Area => areaOf(sel.anchor, sel.focus);

/**
 * Every selected area, each once: the Ctrl/⌘ areas and the main one. While Enter or Tab walk
 * through a selected range, the range is the last extra area and the active cell is inside it;
 * then the active cell isn't listed again (sums and formats count each cell once).
 */
export function selectionAreas(sel: Selection): Area[] {
  const main = mainArea(sel);
  const one = main.r0 === main.r1 && main.c0 === main.c1;
  if (one && sel.extra.some((a) => inArea(a, main.r0, main.c0))) return sel.extra;
  return [...sel.extra, main];
}

/** The range the selection is about: the main area, or the range Enter and Tab are walking through. */
export function activeArea(sel: Selection): Area {
  return walkRange(sel) ?? mainArea(sel);
}

/** The range Enter/Tab cycle through: a main area of more than one cell, or the last extra area the active cell walks in. */
function walkRange(sel: Selection): Area | null {
  const main = mainArea(sel);
  if (main.r0 !== main.r1 || main.c0 !== main.c1) return main;
  const last = sel.extra[sel.extra.length - 1];
  if (last && (last.r0 !== last.r1 || last.c0 !== last.c1) && inArea(last, sel.anchor.row, sel.anchor.col)) return last;
  return null;
}

const samePos = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a === b) return true;
  return samePos(a.anchor, b.anchor) && samePos(a.focus, b.focus) && a.extra.length === b.extra.length && a.extra.every((x, i) => sameArea(x, b.extra[i]));
}

function toSelection(sel: Selection | Pos | Area): Selection {
  if ("anchor" in sel) return sel;
  if ("r0" in sel) return { anchor: { row: sel.r0, col: sel.c0 }, focus: { row: sel.r1, col: sel.c1 }, extra: [] };
  return singleCell(sel);
}

const clampN = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(n)));

/** The selection inside the sheet; the same object when it already was. */
function clampSelection(sel: Selection, sheet: Sheet): Selection {
  const R = sheet.size.rows - 1;
  const C = sheet.size.cols - 1;
  const inside = (p: Pos) => p.row >= 0 && p.col >= 0 && p.row <= R && p.col <= C;
  const areaInside = (a: Area) => a.r0 >= 0 && a.c0 >= 0 && a.r1 <= R && a.c1 <= C;
  if (inside(sel.anchor) && inside(sel.focus) && sel.extra.every(areaInside)) return sel;
  const pos = (p: Pos) => ({ row: clampN(p.row, R), col: clampN(p.col, C) });
  const extra = sel.extra
    .filter((a) => a.r0 <= R && a.c0 <= C)
    .map((a) => ({ r0: clampN(a.r0, R), c0: clampN(a.c0, C), r1: clampN(a.r1, R), c1: clampN(a.c1, C) }));
  return { anchor: pos(sel.anchor), focus: pos(sel.focus), extra };
}

/**
 * What happened to the rows and columns of each sheet from one version to a newer one, where
 * anything did: the entries its log has since, or null when that can't be told.
 */
function rowChanges(was: Workbook, now: Workbook): Map<string, SheetOp[] | null> {
  const out = new Map<string, SheetOp[] | null>();
  for (const s of now.sheets) {
    const old = sheetById(was, s.id);
    if (!old || old.log === s.log) continue;
    const ops = opsSince(old.log, s.log);
    if (!ops || ops.length) out.set(s.id, ops);
  }
  return out;
}

/**
 * The marching ants after a change of my own: on the copied or cut cells, wherever inserted,
 * deleted or sorted rows or columns took them; gone when those cells are gone, sorted apart, or
 * that can't be told, as Excel ends copy mode. (Whether a cut still moves is decided from the
 * sheet's log when it is pasted: grid/clipboard.ts.)
 */
function clipAfter(clip: SheetState["clip"], was: Workbook, now: Workbook): SheetState["clip"] {
  if (!clip) return clip;
  const before = sheetById(was, clip.sheetId);
  const after = sheetById(now, clip.sheetId);
  if (!after) return null;
  if (!before || before.log === after.log) return clip;
  const ops = opsSince(before.log, after.log);
  const area = ops ? followArea(ops, clip.sheetId, clip.area) : null;
  return area ? (sameArea(area, clip.area) ? clip : { ...clip, area }) : null;
}

/**
 * A selection of sheet `sheetId` after `ops` changed its rows or columns: on the same cells (an
 * area with the active cell in the same corner), or where it was when they're gone.
 */
function followSelection(sel: Selection, ops: readonly SheetOp[], sheetId: string): Selection {
  let { anchor, focus } = sel;
  if (samePos(anchor, focus)) anchor = focus = followCell(ops, sheetId, anchor) ?? anchor;
  else {
    const a = followArea(ops, sheetId, mainArea(sel));
    if (a) {
      const down = anchor.row <= focus.row;
      const right = anchor.col <= focus.col;
      anchor = { row: down ? a.r0 : a.r1, col: right ? a.c0 : a.c1 };
      focus = { row: down ? a.r1 : a.r0, col: right ? a.c1 : a.c0 };
    }
  }
  return { anchor, focus, extra: sel.extra.map((x) => followArea(ops, sheetId, x) ?? x) };
}

/** Did a cut and paste among `ops` paste cells over part of `area` of sheet `sheetId`? */
function pastedInto(ops: readonly SheetOp[], sheetId: string, area: Area): boolean {
  return ops.some((op) => {
    if (op.kind !== "move" || op.dst !== sheetId) return false;
    const r1 = op.to.row + op.from.r1 - op.from.r0;
    const c1 = op.to.col + op.from.c1 - op.from.c0;
    return op.to.row <= area.r1 && r1 >= area.r0 && op.to.col <= area.c1 && c1 >= area.c0;
  });
}

// ----------------------------------------------------------------------------------------------
// Small pure helpers on the workbook

/** The sheet with room for at least `rows` × `cols` (never smaller, never beyond the limits). */
export function growSheet(wb: Workbook, sheetId: string, rows: number, cols: number): Workbook {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return wb;
  const r = Math.min(MAX_ROWS, Math.max(sheet.size.rows, rows));
  const c = Math.min(MAX_COLS, Math.max(sheet.size.cols, cols));
  if (r === sheet.size.rows && c === sheet.size.cols) return wb;
  return { ...wb, sheets: wb.sheets.map((s) => (s.id === sheetId ? { ...s, size: { rows: r, cols: c } } : s)) };
}

type Changed = { sheetId: string; row: number; col: number };

/**
 * The cells whose typed value or formula differs between two versions of a workbook: the hint
 * that lets the engine keep unchanged results. undefined when the change is more than cell
 * contents (sheets, row visibility, tables and their filters): then everything is recalculated.
 */
function cellChanges(a: Workbook, b: Workbook): Changed[] | undefined {
  if (a === b) return [];
  if (a.tables !== b.tables || a.sheets.length !== b.sheets.length) return undefined;
  const out: Changed[] = [];
  for (let i = 0; i < b.sheets.length; i++) {
    const s = a.sheets[i];
    const t = b.sheets[i];
    if (s === t) continue;
    if (s.id !== t.id || s.name !== t.name || s.rows !== t.rows) return undefined;
    if (s.cells === t.cells) continue;
    // A filter reads values: a changed value can hide or show rows, and SUBTOTALs anywhere follow.
    if (b.tables.some((x) => x.sheetId === t.id && Object.keys(x.filters).length > 0)) return undefined;
    for (const k in t.cells) {
      const x = s.cells[k];
      const y = t.cells[k];
      if (x !== y && (x?.v !== y.v || x?.f !== y.f)) out.push({ sheetId: t.id, ...parseKey(k) });
    }
    for (const k in s.cells) {
      const x = s.cells[k];
      if (!(k in t.cells) && (x.v !== undefined || x.f !== undefined)) out.push({ sheetId: t.id, ...parseKey(k) });
    }
  }
  return out;
}

// What smart tables and merging do is wrapped: a bug there must never cost what was just typed
// or pasted. It is reported once per kind (filters are worked out for every row on screen).
const reported = new Set<string>();
function reportOnce(what: string, err: unknown) {
  if (reported.has(what)) return;
  reported.add(what);
  console.error(`sheet: ${what} failed`, err);
}

// Rows hidden by smart table filters, worked out once per calculation and sheet.
const NONE: ReadonlySet<number> = new Set<number>();
const filterMemo = new WeakMap<Calc, Map<string, ReadonlySet<number>>>();

function filterHidden(calc: Calc, sheetId: string, locale: Locale): ReadonlySet<number> {
  const wb = calc.workbook;
  if (!wb.tables.some((t) => t.sheetId === sheetId && Object.keys(t.filters).length > 0)) return NONE;
  let bySheet = filterMemo.get(calc);
  if (!bySheet) filterMemo.set(calc, (bySheet = new Map()));
  const known = bySheet.get(sheetId);
  if (known) return known;
  // The filters read values, and a value may be a SUBTOTAL that asks which rows are hidden: while
  // this sheet's filters are being worked out, only the rows hidden by hand count.
  bySheet.set(sheetId, NONE);
  let rows: ReadonlySet<number> = NONE;
  try {
    rows = filteredRows(wb, calc, sheetId, locale);
  } catch (e) {
    reportOnce("smart table filters", e);
  }
  bySheet.set(sheetId, rows);
  return rows;
}

function rowHidden(wb: Workbook, calc: Calc | null, sheetId: string, row: number, locale: Locale): boolean {
  const sheet = sheetById(wb, sheetId);
  if (!sheet) return false;
  if (sheet.rows[row]?.hidden) return true;
  return calc ? filterHidden(calc, sheetId, locale).has(row) : false;
}

/** Is a row hidden (by hand or by a smart table's filter) in the workbook this Calc belongs to? What the store's isRowHidden answers for its current Calc. */
export const rowHiddenIn = (calc: Calc, sheetId: string, row: number, locale: Locale) => rowHidden(calc.workbook, calc, sheetId, row, locale);

/**
 * A Calc for `wb` whose SUBTOTALs skip hidden rows, including the rows its own values hide
 * through smart table filters (read lazily from this very Calc, so creating it costs nothing).
 */
export function calcFor(wb: Workbook, locale: Locale, previous?: Calc, changed?: Changed[]): Calc {
  let self: Calc | null = null;
  const calc = createCalc(wb, {
    locale,
    isRowHidden: (sheetId, row) => rowHidden(wb, self, sheetId, row, locale),
    // SUBTOTAL(1–11) skips what a filter leaves out, also when the row is hidden by hand too.
    isRowFiltered: (sheetId, row) => (self ? filterHidden(self, sheetId, locale).has(row) : false),
    ...(previous && changed ? { previous, changed } : {}),
  });
  self = calc;
  return calc;
}

/**
 * After pasting or filling into `areas` (Blob's own copy, text from other programs, the fill
 * handle, Ctrl+D/R, Ctrl+Enter): a smart table right above or left of the new cells grows over
 * them like typing there does (src/sheet/table/model.ts afterPaste), worked out on a Calc of the
 * pasted workbook. Call it inside the same apply() so it is one undo step. The same workbook when
 * no table is concerned (or when that goes wrong: what was pasted stays either way).
 */
export function tablesAfterPaste(wb: Workbook, sheetId: string, areas: Area | Area[], locale: Locale): Workbook {
  if (!wb.tables.some((t) => t.sheetId === sheetId)) return wb;
  let next = wb;
  try {
    for (const area of Array.isArray(areas) ? areas : [areas]) next = afterPaste(next, calcFor(next, locale), sheetId, area, locale);
  } catch (e) {
    reportOnce("smart table update after pasting", e);
    return wb;
  }
  return next;
}

/**
 * takeBack, where a bug means the step can't be taken back (never that someone's changes are
 * lost): the workbook (and what it left as it is now), or why not and the sheet that is about.
 */
function takeBackSafely(from: Workbook, to: Workbook, now: Workbook, sheetId: string): { wb: Workbook; kept?: Kept } | { refused: TakeBackRefusal; sheetId: string } {
  try {
    return takeBack(from, to, now);
  } catch (e) {
    reportOnce("merging for undo", e);
    return { refused: "error", sheetId };
  }
}

/** Did a step change sheet `id`: its cells, rows, columns or log, or a chart or table on it? */
function stepTouches(step: { before: Workbook; after: Workbook }, id: string): boolean {
  const { before, after } = step;
  if (sheetById(before, id) !== sheetById(after, id)) return true;
  const on = <T extends { sheetId: string }>(list: T[]) => list.filter((x) => x.sheetId === id);
  return (before.charts !== after.charts && !sameJson(on(before.charts), on(after.charts))) || (before.tables !== after.tables && !sameJson(on(before.tables), on(after.tables)));
}

/** The cells an undo or redo left as they are now, for its notice: "C5", "Auswertung!B2" off the sheet on screen; at most 3, and how many more. */
function keptCells(kept: Kept, wb: Workbook, shown: string): { cells: string[]; more: number } {
  const names = kept.cells.map((k) => {
    const sheet = sheetById(wb, k.sheetId);
    const at = posName(k);
    return sheet && k.sheetId !== shown ? `${quoteSheetName(sheet.name)}!${at}` : at;
  });
  return { cells: names.slice(0, 3), more: Math.max(0, names.length - 3) };
}

/** What was typed, short enough for a notice. */
const shortText = (text: string) => (text.length > 40 ? `${text.slice(0, 39)}…` : text);

/** How many "(" of a formula are still open (outside "text" and 'sheet names'). */
export function openParens(text: string): number {
  let open = 0;
  let quote: string | null = null;
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") open++;
    else if (ch === ")") open = Math.max(0, open - 1);
  }
  return open;
}

/**
 * parseInput, but forgiving like Excel: a formula whose closing parentheses are missing gets them
 * ("=MITTELWERT(B2:B7" → "=MITTELWERT(B2:B7)"). Any other error stays. `at`: where it is typed,
 * for what the sheet there tells (inSheet): =B2-A2 of two times shows a duration, =H2+7 a date,
 * and a "1:2" read as a time under "Verdünnung" gets a notice. `current`: the cell as typing sees
 * it (typingBase).
 */
export function parseTyped(text: string, locale: Locale, current: Cell | undefined, at?: TypingPlace): ParsedInput {
  let parsed = parseInput(text, locale, current);
  if (parsed.error && text.startsWith("=")) {
    const open = openParens(text);
    const closed = open > 0 ? parseInput(text + ")".repeat(open), locale, current) : parsed;
    if (!closed.error) parsed = closed;
  }
  return at ? inSheet(parsed, text, locale, at, current?.s?.fmt) : parsed;
}

/** A ratio typed into a cell and read as a time (see offerOtherReading): where, the time it became, the cell's format before, and what to keep instead. */
type TypedRatio = { pos: Pos; typed: Cell["v"]; before: NumberFormat | undefined; other: NonNullable<ParsedInput["notice"]>["other"] };

/**
 * What was typed, read the other way (the one-click correction the notice offers, see
 * ParsedInput.notice): a German "1.234" as 1,234, or a "1:2" as the text 1:2. Its format: the one
 * that reading comes with ("2,345 g"), else the one the cell had before the typing: for a number with
 * room for the three decimals typed (roomForThree); for the text as it was (a time format typing
 * implied goes).
 */
export function otherReading(cell: Cell, before: NumberFormat | undefined, other: NonNullable<ParsedInput["notice"]>["other"]): Cell {
  const fmt = other.fmt ?? (before && typeof other.cell.v === "number" ? roomForThree(before, other.cell.v) : before);
  const s: CellStyle = { ...cell.s };
  if (fmt) s.fmt = fmt;
  else delete s.fmt;
  const out: Cell = { ...cell, v: other.cell.v };
  if (Object.keys(s).length) out.s = s;
  else delete out.s;
  return out;
}

/**
 * A cell's format with room for the three decimals of a typed "1,234" (`v`, the value the cell
 * gets): otherwise a thousands format would show 1, a currency 1,23 €, three significant digits
 * 1,23, and the click would look as if it read something else again. A date or time format goes
 * (1,234 would show as 31.12.1899 or 05:36).
 */
function roomForThree(fmt: NumberFormat, v: Cell["v"]): NumberFormat | undefined {
  // Where the first digit is (1,234 → 0, 12,345 → 1): scientific and significant formats count from there.
  const e = typeof v === "number" && v !== 0 ? Math.floor(Math.log10(Math.abs(v))) : 0;
  switch (fmt.kind) {
    case "number":
    case "percent":
    case "currency":
      return fmt.decimals < 3 ? { ...fmt, decimals: 3 } : fmt;
    case "scientific":
      return fmt.decimals < 3 + e ? { ...fmt, decimals: 3 + e } : fmt;
    case "significant":
      return fmt.digits < 4 + e ? { ...fmt, digits: 4 + e } : fmt;
    case "date":
    case "time":
    case "datetime":
      return undefined;
    default:
      return fmt;
  }
}

/** Where typing into a cell of `s` goes, with the cells around it and their values: what parseTyped reads the sheet with. */
export function typingPlace(s: Pick<SheetState, "workbook" | "calc">, sheetId: string, pos: Pos): TypingPlace {
  const calc = s.calc;
  return { wb: s.workbook, sheetId, row: pos.row, col: pos.col, value: (id, row, col) => calc.value(id, row, col) };
}

/**
 * A cell as typing into it sees it: a formula's cell without the format its formula implies
 * (formulaFormat), which was only ever about that formula. So typing anew gives what typing into an
 * empty cell gives: =B2-A2 (06:30) edited to =(B2-A2)*24 shows 6,5, and 5 typed over =H2+7 (a
 * date) shows 5, not 05.01.1900. A format picked by hand (any other) stays.
 */
export function typingBase(current: Cell | undefined, at: TypingPlace): Cell | undefined {
  const fmt = current?.s?.fmt;
  if (!current || current.f === undefined || !fmt || !sameJson(fmt, formulaFormat(current.f, at))) return current;
  const s: CellStyle = { ...current.s };
  delete s.fmt;
  const out: Cell = { ...current };
  if (Object.keys(s).length) out.s = s;
  else delete out.s;
  return out;
}

/**
 * The format a formula typed into the cell at `pos` shows its result in once it is entered
 * (`canonical`: the formula without "="), as parseTyped and typedCell give it: the cell's own, or the
 * one the formula implies. For the result shown while it is typed: =B2-A2 of two times shows 06:30
 * there too, not 0,270833333.
 */
export function typingFormat(s: Pick<SheetState, "workbook" | "calc">, sheetId: string, pos: Pos, canonical: string): NumberFormat | undefined {
  const { current, place } = typingAt(s, sheetId, pos);
  return typedFormat(current?.s?.fmt, formulaFormat(canonical, place));
}

/**
 * Typing into the cell at `pos`: the cell as typing sees it (typingBase) and where it is
 * (typingPlace), what parseTyped and typedCell take. For Enter, Ctrl+Enter, AutoSum, a draft of the
 * running edit: all give the cell what typing there gives.
 */
export function typingAt(s: Pick<SheetState, "workbook" | "calc">, sheetId: string, pos: Pos): { current: Cell | undefined; place: TypingPlace } {
  const place = typingPlace(s, sheetId, pos);
  return { current: typingBase(getCell(s.workbook, sheetId, pos.row, pos.col), place), place };
}

/** A cell after typing: the parsed value or formula, its look kept (plus an implied format, and wrapping for line breaks), its note kept. */
export function typedCell(current: Cell | undefined, parsed: ParsedInput): Cell {
  let s: CellStyle | undefined = current?.s;
  const fmt = typedFormat(s?.fmt, parsed.fmt);
  if (fmt !== s?.fmt) s = { ...s, fmt };
  const v = parsed.cell.v;
  if (typeof v === "string" && v.includes("\n") && !s?.wrap) s = { ...s, wrap: true };
  const cell: Cell = {};
  if (v !== undefined && v !== "") cell.v = v;
  if (parsed.cell.f !== undefined) cell.f = parsed.cell.f;
  if (s && Object.keys(s).length) cell.s = s;
  if (current?.note) cell.note = current.note;
  return cell;
}

/**
 * `memo` (for storable) learns which part of `to`, the repaired copy of `from`, each part of `from`
 * became: where they differ, the part at the same place (where they don't, nothing needed repair).
 */
function repairedAs(memo: WeakMap<object, unknown>, from: unknown, to: unknown) {
  if (from === to || typeof from !== "object" || from === null || typeof to !== "object" || to === null) return;
  memo.set(from, to);
  for (const key in from) repairedAs(memo, (from as Record<string, unknown>)[key], (to as Record<string, unknown>)[key]);
}

type Step = {
  label: string;
  /** The workbook before and after the change. */
  before: Workbook;
  after: Workbook;
  /** Where to look after undoing it (the sheet and selection from before the change)… */
  sheetId: string;
  selection: Selection;
  /** …and after redoing it (the sheet and selection from when it was undone). */
  redoView?: { sheetId: string; selection: Selection };
  /**
   * A sheet it changed whose two versions couldn't be combined since (replaceRemote): theirs is
   * that sheet now and mine is on the copy `copyId` ("" when there was no room for one), so the
   * step can't be taken back there.
   */
  conflict?: { sheetId: string; copyId: string };
};

const UNDO_LIMIT = 200;
/**
 * How much repairing text in the undo and redo steps may go through (values, src/sheet/doc.ts
 * storableWork): all the steps of most spreadsheets, a few of a huge one (about half a second).
 */
const REPAIR_WORK = 1_000_000;
export const ZOOM_MIN = 0.75;
export const ZOOM_MAX = 2;

type Move = "down" | "up" | "right" | "left";

// ----------------------------------------------------------------------------------------------

export function createSheetStore(init: { pageId: string; workbook: Workbook; locale: Locale; readOnly: boolean }): SheetStore {
  const locale = init.locale;
  const labels = sheetGridText[locale].labels;
  const listeners = new Set<() => void>();
  const undoStack: Step[] = [];
  const redoStack: Step[] = [];
  /** The selection each sheet had when you left it, to come back to. */
  const remembered = new Map<string, Selection>();
  /** Where the running edit started: the sheet and selection to return to, and the text it began with. */
  let editStart: { sheetId: string; selection: Selection; original: string } | null = null;
  /** Tab moves right along a row; Enter then goes down to the column the tabbing started in (like Excel). */
  let tabStart: Pos | null = null;
  /**
   * The notice showing that offers another reading of what was just typed ("1.234 ist 1234", "1:2 ist
   * jetzt die Uhrzeit 01:02", see offerOtherReading), with the cell it is about and the value typed
   * there; for a ratio, the ratios typed down that column while it showed (its button keeps them all).
   */
  let hint: { id: number; sheetId: string; pos: Pos; typed: Cell["v"]; ratios: TypedRatio[] | null } | null = null;

  const makeCalc = (wb: Workbook, previous?: Calc, changed?: Changed[]): Calc => calcFor(wb, locale, previous, changed);

  const first = init.workbook.sheets[0];
  let state: SheetState = {
    pageId: init.pageId,
    workbook: init.workbook,
    calc: makeCalc(init.workbook),
    sheetId: first?.id ?? "",
    selection: singleCell({ row: 0, col: 0 }),
    edit: null,
    clip: null,
    focus: null,
    readOnly: init.readOnly,
    locale,
    canUndo: false,
    canRedo: false,
    version: 0,
    zoom: 1,
  };

  function emit() {
    // The hint ("1.234 ist 1234") is about what was just typed. Typing a column goes value, Enter,
    // next value with the eyes on the notebook: it stays while the next values are typed and other
    // cells are selected, and goes once its cell holds something else (corrected, undone, cleared,
    // changed by someone else) or another sheet is shown. Its notice also goes by itself after a
    // while (12 s or more), with its close button, or when a newer notice replaces it.
    if (hint) {
      const { sheetId, pos, typed } = hint;
      if (getCell(state.workbook, sheetId, pos.row, pos.col)?.v !== typed || state.sheetId !== sheetId) {
        hideSheetNotice(store, hint.id);
        hint = null;
      }
    }
    for (const listener of [...listeners]) listener();
  }

  const sheetOf = (s: SheetState): Sheet | undefined => sheetById(s.workbook, s.sheetId);

  /** The state made consistent with its workbook: an existing sheet, a selection inside it, no edit, clip or panel of something gone. */
  function settle(s: SheetState): SheetState {
    const wb = s.workbook;
    let { sheetId, selection, edit, clip, focus } = s;
    let sheet = sheetById(wb, sheetId);
    if (!sheet) {
      sheet = wb.sheets[0];
      sheetId = sheet.id;
      selection = remembered.get(sheetId) ?? singleCell({ row: 0, col: 0 });
    }
    selection = clampSelection(selection, sheet);
    if (edit) {
      const es = sheetById(wb, edit.sheetId);
      if (!es || edit.row >= es.size.rows || edit.col >= es.size.cols) {
        edit = null;
        editStart = null;
      }
    }
    if (clip && !sheetById(wb, clip.sheetId)) clip = null;
    if (focus) {
      const id = focus.id;
      const exists = focus.kind === "chart" ? wb.charts.some((c) => c.id === id) : wb.tables.some((t) => t.id === id);
      if (!exists) focus = null;
    }
    if (sheetId === s.sheetId && selection === s.selection && edit === s.edit && clip === s.clip && focus === s.focus) return s;
    return { ...s, sheetId, selection, edit, clip, focus };
  }

  function historyState() {
    return {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoLabel: undoStack[undoStack.length - 1]?.label,
      redoLabel: redoStack[redoStack.length - 1]?.label,
    };
  }

  /** Put a new document in place (with its Calc), optionally looking at another sheet and selection. */
  function setDocument(wb: Workbook, calc: Calc, view?: { sheetId: string; selection: Selection }) {
    if (view && view.sheetId !== state.sheetId) remembered.set(state.sheetId, state.selection);
    state = settle({ ...state, ...view, workbook: wb, calc, version: state.version + 1, ...historyState() });
    emit();
  }

  /**
   * A step that can't be taken back any more (for example, someone moved rows or columns of its
   * sheet since): it is gone from the history, the document stays as it is, and a notice at the
   * bottom of the editor says why, naming the sheet that is about (notice.ts). The next undo goes
   * on with the step before it.
   */
  function refuse(step: Step, what: "undo" | "redo", why: TakeBackRefusal, sheetId: string, copy = "") {
    const sheet = sheetById(state.workbook, sheetId) ?? sheetById(step.before, sheetId) ?? sheetById(step.after, sheetId);
    state = { ...state, ...historyState() };
    emit();
    showSheetNotice(store, sheetCollabText[locale].refused(what, why, sheet?.name ?? "", copy));
  }

  /**
   * A step on a sheet whose two versions couldn't be combined since (replaceRemote): mine is on its
   * copy now. The steps right before it on that sheet can't be taken back either, so they go with
   * it, with one notice: the next undo (or redo) goes on with a step that can.
   */
  function refuseConflict(stack: Step[], step: Step, conflict: NonNullable<Step["conflict"]>, what: "undo" | "redo") {
    while (stack[stack.length - 1]?.conflict?.sheetId === conflict.sheetId) stack.pop();
    refuse(step, what, "conflict", conflict.sheetId, sheetById(state.workbook, conflict.copyId)?.name);
  }

  /**
   * Undone or redone, except what someone changed after the step (src/sheet/collab.ts takeBack):
   * that stays as they left it, and a notice says which cells and sheets (`shown`: the sheet on
   * screen now, whose cells go without its name).
   */
  function tellKept(what: "undo" | "redo", kept: Kept, wb: Workbook, shown: string) {
    const { cells, more } = keptCells(kept, wb, shown);
    const sheets = kept.sheets.map((id) => sheetById(wb, id)?.name).filter((n): n is string => !!n);
    showSheetNotice(store, sheetCollabText[locale].kept(what, cells, more, sheets));
  }

  /** One undo step: `next` replaces the workbook. */
  function commit(label: string, next: Workbook, calc?: Calc) {
    const prev = state.workbook;
    if (next === prev) return;
    undoStack.push({ label, before: prev, after: next, sheetId: state.sheetId, selection: state.selection });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
    state = { ...state, clip: clipAfter(state.clip, prev, next) };
    setDocument(next, calc ?? makeCalc(next, state.calc, cellChanges(prev, next)));
  }

  /** Write parsed input into a cell, in one undo step with what a smart table does after it. */
  function writeParsed(sheetId: string, pos: Pos, current: Cell | undefined, parsed: ParsedInput) {
    const wb0 = state.workbook;
    let wb1 = setCells(wb0, sheetId, [{ row: pos.row, col: pos.col, cell: typedCell(current, parsed) }]);
    // Typing in the last row or column leaves one more to go on with (the sheet grows as you type).
    wb1 = growSheet(wb1, sheetId, pos.row + 2, pos.col + 2);
    if (wb1 === wb0) return;
    // Only this cell changed (growing the sheet changes no values): no need to compare all cells.
    const filtered = wb1.tables.some((x) => x.sheetId === sheetId && Object.keys(x.filters).length > 0);
    const calc1 = makeCalc(wb1, state.calc, filtered ? undefined : [{ sheetId, row: pos.row, col: pos.col }]);
    let wb2 = wb1;
    try {
      wb2 = afterInput(wb1, calc1, sheetId, pos.row, pos.col, locale);
    } catch (e) {
      reportOnce("smart table update after typing", e);
    }
    commit(labels.input, wb2, wb2 === wb1 ? calc1 : undefined);
  }

  /**
   * What was just typed was read one way though another may have been meant (a German "1.234" is
   * 1234, as in Excel; a "1:2" under "Verdünnung" the time 01:02): a notice says so and offers the
   * other reading in one click (one undo step). It stays while the next values are typed and goes
   * once the cell holds something else or another sheet is shown (emit); a click that comes too late
   * for that changes nothing. Typing only: pasted values have no hint.
   *
   * Ratios are typed down a column (Verdünnung: 1:1, 1:2, 1:4 …), each with its notice taking the
   * place of the one before: the newest one's button keeps all the ratios typed down that column
   * while their notices showed as text ("Als Text „1:1 … 1:16“"), each cell that still holds what
   * was typed there, in one undo step.
   */
  function offerOtherReading(sheetId: string, pos: Pos, before: Cell | undefined, parsed: ParsedInput) {
    const n = parsed.notice;
    const typed = parsed.cell.v;
    if (!n || getCell(state.workbook, sheetId, pos.row, pos.col)?.v !== typed) return;
    const own: TypedRatio = { pos, typed, before: before?.s?.fmt, other: n.other };
    // A ratio read as a time goes back to the text typed; the thousands hint ("1.234") to a number.
    let ratios: TypedRatio[] | null = null;
    if (typeof n.other.cell.v === "string") {
      const prev = hint?.ratios && hint.sheetId === sheetId && hint.pos.col === pos.col && currentSheetNotice(store)?.id === hint.id ? hint.ratios : [];
      // Top to bottom, however they were typed: the label names the column's first and last.
      ratios = [...prev.filter((r) => r.pos.row !== pos.row && getCell(state.workbook, sheetId, r.pos.row, r.pos.col)?.v === r.typed), own].sort((a, b) => a.pos.row - b.pos.row);
    }
    const label = ratios && ratios.length > 1 ? ratiosLabel(ratios.map((r) => String(r.other.cell.v))) : n.action;
    const id = showSheetNotice(store, n.message, "info", {
      ms: Math.max(12_000, noticeDuration(n.message, "info")),
      action: {
        label,
        run: () => {
          hideSheetNotice(store, id);
          if (hint?.id === id) hint = null;
          if (state.readOnly) return;
          const cells = (ratios ?? [own]).flatMap((r) => {
            const cell = getCell(state.workbook, sheetId, r.pos.row, r.pos.col);
            return cell && cell.f === undefined && cell.v === r.typed ? [{ row: r.pos.row, col: r.pos.col, cell: otherReading(cell, r.before, r.other) }] : [];
          });
          if (cells.length) store.apply(label, (wb) => setCells(wb, sheetId, cells));
        },
      },
    });
    hint = { id, sheetId, pos, typed, ratios };
  }

  /** The button's label for several ratios kept as text, the one a single ratio's notice has ("Als Text „1:2“") with the first and the last of them: „1:1 … 1:16“ (two: „1:1, 1:2“). */
  const ratiosLabel = (texts: string[]) => colonNotice(texts.length > 2 ? `${texts[0]} … ${texts[texts.length - 1]}` : texts.join(", "), "", false, locale).action;

  /** Back to the sheet and selection the edit started from (pointing at cells for a formula moves them). */
  function restoreEditView(e: NonNullable<EditState>) {
    const start = editStart;
    const selection = start && start.sheetId === e.sheetId ? start.selection : singleCell({ row: e.row, col: e.col });
    if (state.sheetId !== e.sheetId) remembered.set(state.sheetId, state.selection);
    state = { ...state, sheetId: e.sheetId, selection, edit: null };
    editStart = null;
    state = settle(state);
  }

  const hiddenRow = (row: number) => rowHidden(state.workbook, state.calc, state.sheetId, row, locale);
  const hiddenCol = (sheet: Sheet, col: number) => !!sheet.cols[col]?.hidden;

  /** The next row (or column) that isn't hidden, `d` steps away; the same one when there is none. */
  function nextVisible(from: number, d: 1 | -1, max: number, hidden: (i: number) => boolean): number {
    let i = from + d;
    while (i >= 0 && i <= max && hidden(i)) i += d;
    return i < 0 || i > max ? from : i;
  }

  /** Enter, Tab and their Shift versions after a commit: one cell on, or round a selected range. */
  function moveActive(dir: Move) {
    const sheet = sheetOf(state);
    if (!sheet) return;
    const sel = state.selection;
    const R = sheet.size.rows - 1;
    const C = sheet.size.cols - 1;
    const range = walkRange(sel);
    if (range) {
      tabStart = null;
      const size = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
      let { row, col } = sel.anchor;
      for (let i = 0; i < size; i++) {
        if (dir === "down" || dir === "up") {
          const d = dir === "down" ? 1 : -1;
          row += d;
          if (row > range.r1 || row < range.r0) {
            row = d > 0 ? range.r0 : range.r1;
            col += d;
            if (col > range.c1 || col < range.c0) col = d > 0 ? range.c0 : range.c1;
          }
        } else {
          const d = dir === "right" ? 1 : -1;
          col += d;
          if (col > range.c1 || col < range.c0) {
            col = d > 0 ? range.c0 : range.c1;
            row += d;
            if (row > range.r1 || row < range.r0) row = d > 0 ? range.r0 : range.r1;
          }
        }
        if (!hiddenRow(row) && !hiddenCol(sheet, col)) break;
      }
      const main = mainArea(sel);
      const extra = sameArea(main, range) ? [...sel.extra, range] : sel.extra;
      state = { ...state, selection: { anchor: { row, col }, focus: { row, col }, extra } };
      return;
    }
    let { row, col } = sel.anchor;
    if (dir === "right") {
      if (!tabStart || tabStart.row !== row) tabStart = { row, col };
      col = nextVisible(col, 1, C, (c) => hiddenCol(sheet, c));
    } else if (dir === "left") {
      col = nextVisible(col, -1, C, (c) => hiddenCol(sheet, c));
    } else if (dir === "down") {
      if (tabStart && tabStart.row === row) col = tabStart.col;
      tabStart = null;
      row = nextVisible(row, 1, R, hiddenRow);
    } else {
      tabStart = null;
      row = nextVisible(row, -1, R, hiddenRow);
    }
    state = { ...state, selection: singleCell({ row, col }) };
  }

  /** Commit the running edit (if any) and move. false: the formula didn't parse; the editor stays open with the reason. */
  function commitEditInternal(move: Move | null): boolean {
    const e = state.edit;
    let typed: { sheetId: string; pos: Pos; current: Cell | undefined; parsed: ParsedInput } | null = null;
    if (e) {
      const unchanged = editStart !== null && e.text === editStart.original;
      if (unchanged || state.readOnly) restoreEditView(e);
      else {
        const pos = { row: e.row, col: e.col };
        const { current, place } = typingAt(state, e.sheetId, pos);
        const parsed = parseTyped(e.text, locale, current, place);
        if (parsed.error) {
          const at = Math.max(0, Math.min(e.text.length, parsed.error.at));
          state = { ...state, edit: { ...e, error: parsed.error, caret: at } };
          emit();
          return false;
        }
        // The undo step remembers the edited cell as the selection, not the cells pointed at.
        restoreEditView(e);
        writeParsed(e.sheetId, pos, current, parsed);
        typed = { sheetId: e.sheetId, pos, current, parsed };
      }
    }
    if (move) moveActive(move);
    if (typed) offerOtherReading(typed.sheetId, typed.pos, typed.current, typed.parsed);
    emit();
    return true;
  }

  function setSelection(sel: Selection) {
    const sheet = sheetOf(state);
    if (!sheet) return;
    const next = clampSelection(sel, sheet);
    if (sameSelection(next, state.selection)) return;
    state = { ...state, selection: next };
    emit();
  }

  const store: SheetStore = {
    get: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    apply(label, change) {
      if (state.readOnly) return;
      const next = change(state.workbook, state.calc);
      if (next === state.workbook) return;
      commit(label, next);
    },

    input(at, text) {
      if (state.readOnly) return true;
      const sheetId = state.sheetId;
      const { current, place } = typingAt(state, sheetId, at);
      const parsed = parseTyped(text, locale, current, place);
      if (parsed.error) return false;
      writeParsed(sheetId, at, current, parsed);
      offerOtherReading(sheetId, at, current, parsed);
      return true;
    },

    setSheet(sheetId) {
      if (sheetId === state.sheetId || !sheetById(state.workbook, sheetId)) return;
      // A formula being typed stays open: clicking cells on the other sheet inserts 'Blatt 2'!A1.
      const pointing = !!state.edit && state.edit.text.startsWith("=");
      if (state.edit && !pointing && !commitEditInternal(null)) return;
      tabStart = null;
      remembered.set(state.sheetId, state.selection);
      const sheet = sheetById(state.workbook, sheetId)!;
      const selection = clampSelection(remembered.get(sheetId) ?? singleCell({ row: 0, col: 0 }), sheet);
      let focus = state.focus;
      if (focus) {
        const id = focus.id;
        const item = focus.kind === "chart" ? state.workbook.charts.find((c) => c.id === id) : state.workbook.tables.find((t) => t.id === id);
        if (item?.sheetId !== sheetId) focus = null;
      }
      state = { ...state, sheetId, selection, focus };
      emit();
    },

    select(sel, opts) {
      if (state.edit && !opts?.keepEdit && !commitEditInternal(null)) return;
      if (!opts?.keepEdit) tabStart = null;
      setSelection(toSelection(sel));
    },

    startEdit(opts) {
      if (state.readOnly) return;
      const running = state.edit;
      if (running) {
        const same = !opts.at || (running.sheetId === state.sheetId && running.row === opts.at.row && running.col === opts.at.col);
        if (same) {
          // The same edit, now in the cell or in the formula bar: what was typed stays.
          const text = opts.text ?? running.text;
          const caret = opts.text !== undefined ? text.length : running.caret;
          state = { ...state, edit: { ...running, via: opts.via, replace: opts.replace, text, caret } };
          emit();
          return;
        }
        if (!commitEditInternal(null)) return;
      }
      if (opts.at && !samePos(opts.at, state.selection.anchor)) {
        tabStart = null;
        setSelection(singleCell(opts.at));
      }
      const sheet = sheetOf(state);
      if (!sheet) return;
      const pos = state.selection.anchor;
      const original = editText(getCell(state.workbook, state.sheetId, pos.row, pos.col), locale);
      const text = opts.replace ? (opts.text ?? "") : (opts.text ?? original);
      editStart = { sheetId: state.sheetId, selection: state.selection, original };
      // Typing ends the copy mode (the marching ants), like Excel; pasting still works from the clipboard.
      state = {
        ...state,
        clip: null,
        edit: { sheetId: state.sheetId, row: pos.row, col: pos.col, text, caret: text.length, via: opts.via, replace: opts.replace, error: null },
      };
      emit();
    },

    updateEdit(text, caret) {
      const e = state.edit;
      if (!e) return;
      const c = Math.max(0, Math.min(text.length, caret));
      if (text === e.text && c === e.caret) return;
      state = { ...state, edit: { ...e, text, caret: c, error: text === e.text ? e.error : null } };
      emit();
    },

    commitEdit(move) {
      return commitEditInternal(move ?? null);
    },

    cancelEdit() {
      const e = state.edit;
      if (!e) return;
      restoreEditView(e);
      emit();
    },

    editSelection() {
      const e = state.edit;
      if (!e) return null;
      return editStart && editStart.sheetId === e.sheetId ? editStart.selection : singleCell({ row: e.row, col: e.col });
    },

    setClip(clip) {
      if (clip === state.clip || (clip && state.clip && clip.sheetId === state.clip.sheetId && clip.cut === state.clip.cut && sameArea(clip.area, state.clip.area))) return;
      // Something copied or cut anew: a cut cancelled before is forgotten.
      state = { ...state, clip, stoppedCut: clip ? null : state.stoppedCut };
      emit();
    },

    setFocus(focus) {
      if (focus === state.focus || (focus && state.focus && focus.kind === state.focus.kind && focus.id === state.focus.id)) return;
      state = { ...state, focus };
      emit();
    },

    setZoom(zoom) {
      if (!Number.isFinite(zoom)) return;
      const z = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100;
      if (z === state.zoom) return;
      state = { ...state, zoom: z };
      emit();
    },

    undo() {
      if (state.edit) {
        // Undo while typing drops the typing first (Excel's undo button does the same).
        restoreEditView(state.edit);
        emit();
      }
      const step = undoStack.pop();
      if (!step) return;
      tabStart = null;
      // A step on a sheet whose two versions couldn't be combined since: mine is on its copy now.
      if (step.conflict) return refuseConflict(undoStack, step, step.conflict, "undo");
      const now = state.workbook;
      // Someone else's changes since then stay: only what this step changed goes back.
      const back = takeBackSafely(step.after, step.before, now, step.sheetId);
      if ("refused" in back) return refuse(step, "undo", back.refused, back.sheetId);
      const wb = back.wb;
      redoStack.push({ ...step, before: wb, after: now, redoView: { sheetId: state.sheetId, selection: state.selection } });
      state = { ...state, clip: clipAfter(state.clip, now, wb) };
      setDocument(wb, makeCalc(wb, state.calc, cellChanges(now, wb)), { sheetId: step.sheetId, selection: step.selection });
      if (back.kept) tellKept("undo", back.kept, wb, state.sheetId);
    },

    redo() {
      if (state.edit) {
        restoreEditView(state.edit);
        emit();
      }
      const step = redoStack.pop();
      if (!step) return;
      tabStart = null;
      if (step.conflict) return refuseConflict(redoStack, step, step.conflict, "redo");
      const now = state.workbook;
      const again = takeBackSafely(step.before, step.after, now, step.sheetId);
      if ("refused" in again) return refuse(step, "redo", again.refused, again.sheetId);
      const wb = again.wb;
      undoStack.push({ label: step.label, before: now, after: wb, sheetId: state.sheetId, selection: state.selection });
      state = { ...state, clip: clipAfter(state.clip, now, wb) };
      setDocument(wb, makeCalc(wb, state.calc, cellChanges(now, wb)), step.redoView ?? { sheetId: step.sheetId, selection: step.selection });
      if (again.kept) tellKept("redo", again.kept, wb, state.sheetId);
    },

    isRowHidden(sheetId, row) {
      return rowHidden(state.workbook, state.calc, sheetId, row, locale);
    },

    replaceRemote(wb, report) {
      if (wb === state.workbook || !wb.sheets.length) return;
      // No undo step, and the undo history stays: undoing later takes back only what that step
      // changed and keeps the other person's changes, lined up through the sheets' logs where
      // rows or columns moved (see undo()). A sheet kept as theirs with my version on a copy is
      // no longer the one my steps were made on: those steps can't be taken back there (and taken
      // back on the copy, a step's cells could land on other rows: the copy has no history).
      const conflicts = report?.filter(keptAsTheirs);
      for (const c of conflicts ?? []) {
        for (const stack of [undoStack, redoStack]) {
          for (let i = 0; i < stack.length; i++) if (!stack[i].conflict && stepTouches(stack[i], c.sheetId)) stack[i] = { ...stack[i], conflict: { sheetId: c.sheetId, copyId: c.copyId } };
        }
      }
      const was = state.workbook;
      // Where the other person moved rows or columns, what points at cells here moves along
      // (else typing would land in another row than the one it was meant for).
      const moved = rowChanges(was, wb);
      const follow = (sel: Selection, id: string) => {
        const ops = moved.get(id);
        return ops ? followSelection(sel, ops, id) : sel;
      };
      for (const [id, sel] of remembered) remembered.set(id, follow(sel, id));
      if (moved.has(state.sheetId)) tabStart = null;
      let { sheetId, edit, clip } = state;
      let selection = follow(state.selection, sheetId);
      const start = editStart && { ...editStart, selection: follow(editStart.selection, editStart.sheetId) };
      editStart = start;
      let lost: string | null = null;
      if (edit) {
        const e = edit;
        const copy = conflicts?.find((c) => c.sheetId === e.sheetId)?.copyId;
        if (copy) {
          // That sheet is theirs now, and my version of it (with my rows) is on the copy: typing goes on there.
          edit = { ...e, sheetId: copy };
          if (start?.sheetId === e.sheetId) editStart = { ...start, sheetId: copy };
          if (sheetId === e.sheetId) {
            remembered.set(sheetId, selection);
            sheetId = copy;
            selection = state.selection;
          }
        } else {
          const ops = moved.get(e.sheetId);
          // (No copy of a sheet kept as theirs: there is nowhere left to type it into.)
          const at = copy === "" ? null : ops ? followCell(ops, e.sheetId, e) : e;
          if (!at) {
            // Its row or column is gone, or the cell is on another sheet now.
            if (!start || e.text !== start.original) lost = e.text;
            edit = null;
            editStart = null;
          } else if (at.row !== e.row || at.col !== e.col) edit = { ...e, row: at.row, col: at.col };
        }
      }
      // The same for the sheet on screen between two edits: what I type next goes on in my version,
      // on its copy, where my selection's rows are. (Left on their version, it would land in their
      // rows, over their values.)
      const shownCopy = conflicts?.find((c) => c.sheetId === sheetId)?.copyId;
      if (shownCopy) {
        remembered.set(sheetId, selection);
        sheetId = shownCopy;
        selection = state.selection;
        tabStart = null;
      }
      let { stoppedCut } = state;
      if (clip) {
        const c = clip;
        const ops = moved.get(c.sheetId);
        const copy = conflicts?.find((x) => x.sheetId === c.sheetId)?.copyId;
        const area = ops ? followArea(ops, c.sheetId, c.area) : ops === null ? null : c.area;
        if (c.cut) {
          // Pasting a cut moves the cells at its address: when others may be there now, it is
          // cancelled (a sheet kept as theirs, rows that moved, or what happened can't be told),
          // and pasting it does nothing (grid/clipboard.ts): pasted as a copy, the cells would
          // be there twice, with their values from before.
          if (copy !== undefined || ops === null || (ops && (!area || !sameArea(area, c.area) || pastedInto(ops, c.sheetId, c.area)))) {
            clip = null;
            stoppedCut = { sheetId: c.sheetId, area: c.area };
          }
        } else if (copy !== undefined) clip = copy ? { ...c, sheetId: copy } : null;
        else clip = area ? { ...c, area } : null;
      }
      const cutStopped = stoppedCut !== state.stoppedCut;
      // A sheet one of my steps deleted that comes back: someone wrote into it meanwhile, so merging
      // kept it (src/sheet/collab.ts). Said (unless the merge's report says it already), or it would
      // look as if the deletion hadn't worked.
      const back = wb.sheets.find((s) => !sheetById(was, s.id) && !report?.some((c) => c.sheetId === s.id) && undoStack.some((step) => sheetById(step.before, s.id) && !sheetById(step.after, s.id)));
      state = { ...state, sheetId, selection, edit, clip, stoppedCut };
      setDocument(wb, makeCalc(wb, state.calc, cellChanges(was, wb)));
      const text = sheetCollabText[locale];
      if (lost !== null) showSheetNotice(store, text.editGone(shortText(lost)));
      else if (cutStopped) showSheetNotice(store, text.cutStopped);
      else if (back) showSheetNotice(store, text.sheetBack(back.name));
    },

    repair(wb) {
      const was = state.workbook;
      if (wb === was || !wb.sheets.length) return;
      // The steps share parts (one step's result is the next one's start, the newest result is the
      // workbook on screen, sheets nobody changed are the same objects): each part is repaired
      // once, into the very part the repaired workbook has where they are the same, so undo still
      // sees that nothing else changed since a step (collab.ts takeBack). From the steps nearest to
      // the workbook on screen on, by the side a step is taken back from (undo: its result, redo:
      // its start), which the newer step shares: where that needed no repair, what was repaired
      // came in after the step, so it and the older ones stay as they are (taking one back may
      // bring such text back, and the next save repairs it the same way).
      const memo = new WeakMap<object, unknown>();
      repairedAs(memo, was, wb);
      const start = storableWork();
      for (const stack of [undoStack, redoStack]) {
        const from = stack === undoStack ? "after" : "before";
        for (let i = stack.length - 1; i >= 0; i--) {
          const step = stack[i];
          if (storable(step[from], memo) === step[from]) break;
          // Each step's other side is gone through anew (each changed a sheet's cells): next to
          // nothing on most spreadsheets, a tenth of a second on a huge one. Past REPAIR_WORK the
          // older steps go instead of the page freezing for seconds: undo goes back less far, but
          // never says that someone else changed something.
          if (storableWork() - start > REPAIR_WORK) {
            stack.splice(0, i + 1);
            break;
          }
          stack[i] = { ...step, before: storable(step.before, memo), after: storable(step.after, memo) };
        }
      }
      setDocument(wb, makeCalc(wb, state.calc, cellChanges(was, wb)));
    },

    reset(wb) {
      if (state.readOnly || !wb.sheets.length) return;
      undoStack.length = 0;
      redoStack.length = 0;
      tabStart = null;
      editStart = null;
      state = { ...state, edit: null };
      setDocument(wb, makeCalc(wb));
    },
  };

  return store;
}

export const SheetStoreContext = createContext<SheetStore | null>(null);

export function useSheetStore(): SheetStore {
  const store = useContext(SheetStoreContext);
  if (!store) throw new Error("useSheetStore: no SheetStoreContext.Provider");
  return store;
}

/**
 * Re-render when the selected part of the state changes. `select` must return something already
 * in the state (the same object while nothing changed) or a primitive, never a new object.
 */
export function useSheet<T>(store: SheetStore, select: (s: SheetState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}
