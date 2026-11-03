// A spreadsheet page's stored content: making new ones, reading stored JSON safely, and the text
// and preview other parts of Blob need (search, tiles, public pages).
//
// CONTRACT: keep names and signatures.
//
// What pages.content holds: the Workbook (types.ts) plus `preview`, a SheetPreview written next to
// it on every save, so lists (home, notes, subjects, folders) can draw a tile from
// content->preview without loading the engine, like handwritten notes do. normalizeWorkbook drops
// the preview when reading: the editor works on the workbook alone and the next save writes a
// fresh preview.
//
// This module stays light on purpose (no formula engine, no ops): the workspace makes new
// spreadsheets with newWorkbook and lists read previews with readSheetPreview, and neither should
// pull the engine into every page. Values are formatted with the engine's formatter only.
//
// normalizeWorkbook is deterministic: the same stored JSON gives the same workbook on every
// device, made-up ids included, so two people who open the same damaged content can still merge
// their changes. It also keeps every part that is already valid as the very same object, so it is
// cheap to run on a workbook that is fine (after merging, say) and unchanged sheets stay unchanged.

import type { Locale } from "@/i18n/config";
import { SHEET_COLORS } from "./colors";
import type { Calc } from "./engine";
import { formatValue } from "./engine/format";
import { isError, type CellValue } from "./engine/values";
import {
  DEFAULT_COL_W,
  DEFAULT_SIZE,
  MAX_COLS,
  MAX_ROWS,
  type Area,
  type AxisSpec,
  type BorderLine,
  type Cell,
  type CellStyle,
  type ChartKind,
  type ChartSpec,
  type ErrorBarSpec,
  type FilterSpec,
  type NumberFormat,
  type RangeRef,
  type SeriesSpec,
  type Sheet,
  type SheetColor,
  type TableColumn,
  type TableSpec,
  type TableStyle,
  type TotalFn,
  type TrendlineSpec,
  type Workbook,
} from "./types";

// ----------------------------------------------------------------------------------------------
// Limits (Excel's where it has one)

/** Characters of text in one cell (Excel: 32,767). */
const MAX_TEXT = 32767;
/** Characters of a formula (Excel: 8,192). */
const MAX_FORMULA = 8192;
const MAX_NOTE = 32767;
const MAX_SHEETS = 250;
const MAX_CHARTS = 250;
const MAX_SERIES = 64;
const MAX_TABLES = 250;
const MAX_TITLE = 500;
const MAX_NAME = 255;
const MAX_UNIT = 24;
const MAX_SIZE_PX = 4000;

const CHART_KINDS: ChartKind[] = ["scatter", "line", "column", "bar", "area", "pie"];
const MARKERS: SeriesSpec["marker"][] = ["circle", "square", "triangle", "diamond", "none"];
const LINES: SeriesSpec["line"][] = ["none", "straight", "smooth"];
const LEGENDS: ChartSpec["legend"][] = ["top", "right", "bottom", "none"];
const TREND_TYPES: TrendlineSpec["type"][] = ["linear", "polynomial", "exponential", "logarithmic", "power", "movingAverage"];
const ERROR_KINDS: ErrorBarSpec["kind"][] = ["fixed", "percent", "stdev", "stderr", "custom"];
const DIRECTIONS: ErrorBarSpec["direction"][] = ["both", "plus", "minus"];
const TABLE_STYLES: TableStyle[] = ["purple", "blue", "green", "orange", "teal", "gray"];
const TOTAL_FNS: TotalFn[] = ["none", "sum", "average", "count", "countNumbers", "min", "max", "stdev", "var"];
const BORDER_LINES: BorderLine[] = ["thin", "thick", "double", "dashed"];
const NUMBER_OPS = ["gt", "gte", "lt", "lte", "eq", "neq", "between", "top", "bottom", "aboveAverage", "belowAverage"] as const;
const TEXT_OPS = ["contains", "notContains", "begins", "ends", "equals"] as const;
const SYMBOLS = ["€", "$", "£", "CHF"] as const;

// ----------------------------------------------------------------------------------------------
// New workbooks

/**
 * A short random id, like ops.newId (repeated here so this module doesn't load the engine).
 * Only new workbooks use it: normalizing never makes up random ids (see the top of the file).
 */
function freshId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}

const sheetBase = (locale: Locale) => (locale === "de" ? "Blatt" : "Sheet");

const blankSheet = (id: string, name: string): Sheet => ({
  id,
  name,
  cells: {},
  cols: {},
  rows: {},
  freeze: { rows: 0, cols: 0 },
  size: { rows: DEFAULT_SIZE.rows, cols: DEFAULT_SIZE.cols },
});

/** An empty workbook with one sheet ("Blatt 1" / "Sheet 1"). */
export function newWorkbook(locale: Locale): Workbook {
  return { v: 1, sheets: [blankSheet(freshId(), `${sheetBase(locale)} 1`)], charts: [], tables: [] };
}

/**
 * The sheet id of a workbook made from empty or foreign content. Fixed, so two devices that open
 * the same empty page make the same sheet and their first edits merge instead of replacing each other.
 */
const BLANK_SHEET_ID = "s1";
const blankWorkbook = (locale: Locale): Workbook => ({ v: 1, sheets: [blankSheet(BLANK_SHEET_ID, `${sheetBase(locale)} 1`)], charts: [], tables: [] });

// ----------------------------------------------------------------------------------------------
// Reading stored JSON

const unreadable = new WeakSet<Workbook>();

/**
 * True for the stand-in workbook normalizeWorkbook returns when reading failed outright (a bug, not
 * bad data): the editor then shows it read-only, so a save can't replace the stored content.
 */
export const isUnreadableWorkbook = (wb: Workbook) => unreadable.has(wb);

/**
 * Stored JSON → a valid Workbook. Never throws: anything malformed is repaired or dropped (bad
 * cells, unknown keys, charts and tables pointing at missing sheets, out-of-range sizes), and
 * empty or foreign content gives a new workbook.
 */
export function normalizeWorkbook(raw: unknown, locale: Locale): Workbook {
  try {
    return normalize(raw, locale);
  } catch (e) {
    console.error("sheet: reading the workbook failed", e);
    const wb = blankWorkbook(locale);
    unreadable.add(wb);
    return wb;
  }
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Only these keys (an object with others is rebuilt without them). */
function onlyKeys(x: Obj, keys: readonly string[]): boolean {
  for (const k in x) if (!keys.includes(k)) return false;
  return true;
}

/** An integer in [min, max]; `fallback` for anything that isn't a number. */
function int(x: unknown, min: number, max: number, fallback: number): number {
  if (!finite(x)) return fallback;
  return Math.min(max, Math.max(min, Math.round(x)));
}

function oneOf<T>(x: unknown, list: readonly T[], fallback: T): T {
  return list.includes(x as T) ? (x as T) : fallback;
}

/** A string cut to `max` characters, or `fallback` when it isn't one. */
const text = (x: unknown, max: number, fallback = ""): string => (typeof x === "string" ? (x.length > max ? x.slice(0, max) : x) : fallback);

const isColor = (x: unknown): x is SheetColor => SHEET_COLORS.includes(x as SheetColor);

/** Ids made by Blob are short letters and digits; anything else (or "__proto__") gets a made-up one. */
const goodId = (x: unknown): x is string => typeof x === "string" && /^[\w.:-]{1,64}$/.test(x) && x !== "__proto__" && x !== "constructor" && x !== "prototype";

/** A unique id: the stored one when it is good and free, else `fallback` (made unique with a suffix). */
function claimId(x: unknown, fallback: string, taken: Set<string>): string {
  if (goodId(x) && !taken.has(x)) {
    taken.add(x);
    return x;
  }
  let id = fallback;
  for (let n = 2; taken.has(id); n++) id = `${fallback}_${n}`;
  taken.add(id);
  return id;
}

/** A row or column index inside the limits; null when it isn't a number. */
function index(x: unknown, limit: number): number | null {
  if (!finite(x)) return null;
  return Math.min(limit - 1, Math.max(0, Math.round(x)));
}

function normalize(raw: unknown, locale: Locale): Workbook {
  let src = raw;
  // Content saved as a JSON string by mistake.
  if (typeof src === "string") {
    try {
      src = JSON.parse(src);
    } catch {
      src = null;
    }
  }
  if (!isObj(src) || !Array.isArray(src.sheets)) return blankWorkbook(locale);

  // Sheets: ids and names unique, the stored id → the id it has now (for charts and tables).
  const sheetIds = new Map<string, string>();
  const takenIds = new Set<string>();
  const takenNames = new Set<string>();
  const sheets: Sheet[] = [];
  let sameSheets = src.sheets.length <= MAX_SHEETS;
  for (let i = 0; i < src.sheets.length && sheets.length < MAX_SHEETS; i++) {
    const s = src.sheets[i];
    if (!isObj(s)) {
      sameSheets = false;
      continue;
    }
    const id = claimId(s.id, `s${i + 1}`, takenIds);
    if (typeof s.id === "string" && !sheetIds.has(s.id)) sheetIds.set(s.id, id);
    const name = sheetName(s.name, locale, i, takenNames);
    const sheet = normSheet(s, id, name);
    if (sheet !== s) sameSheets = false;
    sheets.push(sheet);
  }
  if (!sheets.length) return blankWorkbook(locale);

  const charts = normList(src.charts, MAX_CHARTS, (c, i, taken) => normChart(c, i, taken, sheetIds));
  const tables = normTables(src.tables, sheetIds, sheets, locale);

  // Every sheet big enough for its cells, charts and tables.
  const need = new Map<string, { rows: number; cols: number }>();
  const grow = (sheetId: string, rows: number, cols: number) => {
    const n = need.get(sheetId) ?? { rows: 0, cols: 0 };
    need.set(sheetId, { rows: Math.max(n.rows, rows), cols: Math.max(n.cols, cols) });
  };
  for (const c of charts.list) grow(c.sheetId, c.at.row + 1, c.at.col + 1);
  for (const t of tables.list) grow(t.sheetId, t.area.r1 + 1, t.area.c1 + 1);
  for (let i = 0; i < sheets.length; i++) {
    const n = need.get(sheets[i].id);
    if (!n) continue;
    const s = sheets[i];
    const rows = Math.min(MAX_ROWS, Math.max(s.size.rows, n.rows));
    const cols = Math.min(MAX_COLS, Math.max(s.size.cols, n.cols));
    if (rows !== s.size.rows || cols !== s.size.cols) {
      sheets[i] = { ...s, size: { rows, cols } };
      sameSheets = false;
    }
  }

  const sheetList = sameSheets && sheets.length === src.sheets.length ? (src.sheets as Sheet[]) : sheets;
  if (src.v === 1 && onlyKeys(src, ["v", "sheets", "charts", "tables"]) && sheetList === src.sheets && charts.same && tables.same) return src as Workbook;
  return { v: 1, sheets: sheetList, charts: charts.same ? (src.charts as ChartSpec[]) : charts.list, tables: tables.same ? (src.tables as TableSpec[]) : tables.list };
}

/** A list of items normalized one by one (null drops one); `same` when nothing changed. */
function normList<T>(raw: unknown, max: number, norm: (x: unknown, i: number, taken: Set<string>) => T | null): { list: T[]; same: boolean } {
  if (!Array.isArray(raw)) return { list: [], same: false };
  const taken = new Set<string>();
  const list: T[] = [];
  let same = raw.length <= max;
  for (let i = 0; i < raw.length && list.length < max; i++) {
    const item = norm(raw[i], i, taken);
    if (item === null || item !== raw[i]) same = false;
    if (item !== null) list.push(item);
  }
  return { list, same };
}

// Sheets ---------------------------------------------------------------------------------------

/** A valid, unique sheet name (1–31 characters, none of []:*?/\, not starting or ending with '). */
function sheetName(x: unknown, locale: Locale, i: number, taken: Set<string>): string {
  let name = typeof x === "string" ? x : "";
  if (!(name.length >= 1 && name.length <= 31 && name.trim() && !/[[\]:*?/\\]/.test(name) && !name.startsWith("'") && !name.endsWith("'"))) {
    name = name
      .replace(/[[\]:*?/\\\u0000-\u001f]/g, "")
      .trim()
      .replace(/^'+|'+$/g, "")
      .trim()
      .slice(0, 31)
      .trim();
  }
  if (!name) name = `${sheetBase(locale)} ${i + 1}`;
  if (taken.has(name.toLowerCase())) {
    const m = /^(.*) \((\d+)\)$/.exec(name);
    const root = m ? m[1] : name;
    for (let n = m ? Number(m[2]) + 1 : 2; ; n++) {
      const suffix = ` (${n})`;
      const candidate = root.slice(0, 31 - suffix.length) + suffix;
      if (!taken.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }
  }
  taken.add(name.toLowerCase());
  return name;
}

function normSheet(s: Obj, id: string, name: string): Sheet {
  const cells = normCells(s.cells);
  const size0 = isObj(s.size) ? s.size : {};
  const rows = Math.min(MAX_ROWS, Math.max(int(size0.rows, 1, MAX_ROWS, DEFAULT_SIZE.rows), cells.rows));
  const colsN = Math.min(MAX_COLS, Math.max(int(size0.cols, 1, MAX_COLS, DEFAULT_SIZE.cols), cells.cols));
  const sizeSame = isObj(s.size) && onlyKeys(s.size, ["rows", "cols"]) && s.size.rows === rows && s.size.cols === colsN;
  const size = sizeSame ? (s.size as Sheet["size"]) : { rows, cols: colsN };
  const cols = normLines(s.cols, MAX_COLS, "w", 12);
  const rowsMap = normLines(s.rows, MAX_ROWS, "h", 10);
  const f = isObj(s.freeze) ? s.freeze : {};
  const fr = int(f.rows, 0, Math.max(0, rows - 1), 0);
  const fc = int(f.cols, 0, Math.max(0, colsN - 1), 0);
  const freezeSame = isObj(s.freeze) && onlyKeys(s.freeze, ["rows", "cols"]) && s.freeze.rows === fr && s.freeze.cols === fc;
  const freeze = freezeSame ? (s.freeze as Sheet["freeze"]) : { rows: fr, cols: fc };
  const same =
    id === s.id && name === s.name && cells.same && sizeSame && cols.same && rowsMap.same && freezeSame && onlyKeys(s, ["id", "name", "cells", "cols", "rows", "freeze", "size"]);
  if (same) return s as Sheet;
  return { id, name, cells: cells.map, cols: cols.map, rows: rowsMap.map, freeze, size };
}

const KEY = /^(\d{1,5}),(\d{1,3})$/;

/** Cells by "row,col": bad keys and cells dropped; the rows and columns the cells need. */
function normCells(raw: unknown): { map: Record<string, Cell>; same: boolean; rows: number; cols: number } {
  if (!isObj(raw)) return { map: {}, same: false, rows: 0, cols: 0 };
  let same = true;
  let rows = 0;
  let cols = 0;
  let map: Record<string, Cell> | null = null;
  const put = (key: string, cell: Cell) => {
    map ??= {};
    if (!(key in map)) map[key] = cell;
  };
  const keys = Object.keys(raw);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const m = KEY.exec(key);
    const row = m ? Number(m[1]) : -1;
    const col = m ? Number(m[2]) : -1;
    if (!m || row >= MAX_ROWS || col >= MAX_COLS) {
      // Not a cell this app can show: dropped.
      if (same) {
        same = false;
        map = {};
        for (let j = 0; j < i; j++) map[keys[j]] = raw[keys[j]] as Cell;
      }
      continue;
    }
    const cell = normCell(raw[key]);
    const canonical = `${row},${col}`;
    if (cell === null || cell !== raw[key] || canonical !== key) {
      if (same) {
        same = false;
        map = {};
        for (let j = 0; j < i; j++) map[keys[j]] = raw[keys[j]] as Cell;
      }
      if (cell) put(canonical, cell);
    } else if (!same) put(key, cell);
    if (cell) {
      if (row + 1 > rows) rows = row + 1;
      if (col + 1 > cols) cols = col + 1;
    }
  }
  return { map: same ? (raw as Record<string, Cell>) : (map ?? {}), same, rows, cols };
}

/** One cell; null when nothing is left of it. A bare value (5, "x") becomes a cell with that value. */
function normCell(x: unknown): Cell | null {
  if (!isObj(x)) {
    if (finite(x) || typeof x === "boolean") return { v: x };
    if (typeof x === "string" && x !== "") return { v: text(x, MAX_TEXT) };
    return null;
  }
  let same = onlyKeys(x, ["v", "f", "s", "note"]);
  const out: Cell = {};
  if (x.v !== undefined) {
    if (finite(x.v) || typeof x.v === "boolean") out.v = x.v;
    else if (typeof x.v === "string" && x.v !== "") {
      out.v = text(x.v, MAX_TEXT);
      if (out.v !== x.v) same = false;
    } else same = false;
  }
  if (x.f !== undefined) {
    let f = typeof x.f === "string" ? x.f : "";
    if (f.startsWith("=")) f = f.slice(1);
    if (f.trim() && f.length <= MAX_FORMULA) out.f = f;
    if (out.f !== x.f) same = false;
  }
  if (x.s !== undefined) {
    const s = normStyle(x.s);
    if (s) out.s = s;
    if (s !== x.s) same = false;
  }
  if (x.note !== undefined) {
    const note = text(x.note, MAX_NOTE);
    if (note.trim()) out.note = note;
    if (out.note !== x.note) same = false;
  }
  if (out.v === undefined && out.f === undefined && out.s === undefined && out.note === undefined) return null;
  return same ? (x as Cell) : out;
}

const STYLE_KEYS = ["bold", "italic", "underline", "strike", "wrap", "color", "fill", "align", "valign", "size", "fmt", "border"] as const;

function normStyle(x: unknown): CellStyle | undefined {
  if (!isObj(x)) return undefined;
  let same = onlyKeys(x, STYLE_KEYS);
  const out: CellStyle = {};
  for (const k of ["bold", "italic", "underline", "strike", "wrap"] as const) {
    if (x[k] === undefined) continue;
    if (typeof x[k] === "boolean") out[k] = x[k];
    else same = false;
  }
  for (const k of ["color", "fill"] as const) {
    if (x[k] === undefined) continue;
    if (isColor(x[k])) out[k] = x[k];
    else same = false;
  }
  if (x.align !== undefined) {
    if (x.align === "left" || x.align === "center" || x.align === "right") out.align = x.align;
    else same = false;
  }
  if (x.valign !== undefined) {
    if (x.valign === "top" || x.valign === "middle" || x.valign === "bottom") out.valign = x.valign;
    else same = false;
  }
  if (x.size !== undefined) {
    if (finite(x.size)) {
      out.size = Math.min(96, Math.max(6, x.size));
      if (out.size !== x.size) same = false;
    } else same = false;
  }
  if (x.fmt !== undefined) {
    const fmt = normFormat(x.fmt);
    if (fmt) out.fmt = fmt;
    if (fmt !== x.fmt) same = false;
  }
  if (x.border !== undefined) {
    const b = isObj(x.border) ? x.border : {};
    const border: NonNullable<CellStyle["border"]> = {};
    let bSame = isObj(x.border) && onlyKeys(b, ["top", "right", "bottom", "left"]);
    for (const side of ["top", "right", "bottom", "left"] as const) {
      if (b[side] === undefined) continue;
      if (BORDER_LINES.includes(b[side] as BorderLine)) border[side] = b[side] as BorderLine;
      else bSame = false;
    }
    if (Object.keys(border).length) out.border = bSame ? (x.border as CellStyle["border"]) : border;
    if (!bSame || !Object.keys(border).length) same = false;
  }
  if (!Object.keys(out).length) return undefined;
  return same ? (x as CellStyle) : out;
}

function normFormat(x: unknown): NumberFormat | undefined {
  if (!isObj(x)) return undefined;
  const decimals = () => int(x.decimals, 0, 20, 2);
  const unit = (): { unit?: string } => {
    const u = typeof x.unit === "string" ? x.unit.trim().slice(0, MAX_UNIT) : "";
    return u ? { unit: u } : {};
  };
  let out: NumberFormat;
  switch (x.kind) {
    case "general":
      out = { kind: "general" };
      break;
    case "number":
      out = { kind: "number", decimals: decimals(), ...(typeof x.group === "boolean" ? { group: x.group } : {}), ...unit() };
      break;
    case "percent":
      out = { kind: "percent", decimals: decimals() };
      break;
    case "scientific":
      out = { kind: "scientific", decimals: decimals(), ...unit() };
      break;
    case "significant":
      out = { kind: "significant", digits: int(x.digits, 1, 15, 3), ...unit() };
      break;
    case "currency":
      out = { kind: "currency", decimals: decimals(), symbol: oneOf(x.symbol, SYMBOLS, "€") };
      break;
    case "date":
      out = { kind: "date", style: oneOf(x.style, ["short", "long", "iso"] as const, "short") };
      break;
    case "time":
      out = { kind: "time", seconds: x.seconds === true };
      break;
    case "datetime":
      out = { kind: "datetime" };
      break;
    case "text":
      out = { kind: "text" };
      break;
    default:
      return undefined;
  }
  return sameShallow(x, out as Obj) ? (x as NumberFormat) : out;
}

/** The same keys with the same (primitive) values. */
function sameShallow(a: Obj, b: Obj): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/** Column widths or row heights by index (`size` is "w" or "h"); hidden flags. */
function normLines(raw: unknown, limit: number, size: "w" | "h", min: number): { map: Record<string, { w?: number; h?: number; hidden?: boolean }>; same: boolean } {
  if (!isObj(raw)) return { map: {}, same: false };
  let same = true;
  const map: Record<string, { w?: number; h?: number; hidden?: boolean }> = {};
  for (const key of Object.keys(raw)) {
    const n = /^\d{1,5}$/.test(key) ? Number(key) : -1;
    const e = raw[key];
    if (n < 0 || n >= limit || !isObj(e)) {
      same = false;
      continue;
    }
    const out: { w?: number; h?: number; hidden?: boolean } = {};
    if (finite(e[size])) out[size] = Math.min(MAX_SIZE_PX, Math.max(min, e[size] as number));
    if (typeof e.hidden === "boolean") out.hidden = e.hidden;
    const canonical = String(n);
    if (out[size] === undefined && out.hidden === undefined) {
      same = false;
      continue;
    }
    const entrySame = canonical === key && onlyKeys(e, [size, "hidden"]) && out[size] === e[size] && out.hidden === e.hidden;
    if (!entrySame) same = false;
    if (!(canonical in map)) map[canonical] = entrySame ? (e as { w?: number; h?: number; hidden?: boolean }) : out;
  }
  return same ? { map: raw as Record<string, { w?: number }>, same } : { map, same };
}

// Charts ---------------------------------------------------------------------------------------

function normRange(x: unknown, sheetIds: Map<string, string>): RangeRef | null {
  if (!isObj(x) || typeof x.sheetId !== "string") return null;
  const sheetId = sheetIds.get(x.sheetId);
  if (!sheetId) return null;
  const a = index(x.r0, MAX_ROWS);
  const b = index(x.r1, MAX_ROWS);
  const c = index(x.c0, MAX_COLS);
  const d = index(x.c1, MAX_COLS);
  if (a === null || b === null || c === null || d === null) return null;
  const out: RangeRef = { sheetId, r0: Math.min(a, b), c0: Math.min(c, d), r1: Math.max(a, b), c1: Math.max(c, d) };
  const same = sheetId === x.sheetId && out.r0 === x.r0 && out.r1 === x.r1 && out.c0 === x.c0 && out.c1 === x.c1 && onlyKeys(x, ["sheetId", "r0", "c0", "r1", "c1"]);
  return same ? (x as RangeRef) : out;
}

/** An optional range: null stays null; a broken one becomes null. */
function optRange(x: unknown, sheetIds: Map<string, string>): RangeRef | null {
  return x === null || x === undefined ? null : normRange(x, sheetIds);
}

function normAxis(x: unknown, grid: boolean): AxisSpec {
  const a = isObj(x) ? x : {};
  const num = (v: unknown) => (finite(v) ? v : null);
  const out: AxisSpec = {
    title: text(a.title, MAX_TITLE),
    min: num(a.min),
    max: num(a.max),
    log: a.log === true,
    grid: typeof a.grid === "boolean" ? a.grid : grid,
    decimals: finite(a.decimals) ? int(a.decimals, 0, 15, 0) : null,
  };
  return isObj(x) && sameShallow(x, out as Obj) ? (x as AxisSpec) : out;
}

function normTrend(x: unknown): TrendlineSpec | null {
  if (!isObj(x)) return null;
  const out: TrendlineSpec = {
    type: oneOf(x.type, TREND_TYPES, "linear"),
    order: int(x.order, 2, 6, 2),
    period: int(x.period, 2, 1000, 2),
    intercept: finite(x.intercept) ? x.intercept : null,
    showEquation: x.showEquation === true,
    showR2: x.showR2 === true,
    forward: finite(x.forward) ? Math.max(0, x.forward) : 0,
    backward: finite(x.backward) ? Math.max(0, x.backward) : 0,
    name: text(x.name, MAX_NAME),
  };
  return sameShallow(x, out as Obj) ? (x as TrendlineSpec) : out;
}

function normErrorBars(x: unknown, sheetIds: Map<string, string>): ErrorBarSpec | null {
  if (!isObj(x)) return null;
  const plus = optRange(x.plus, sheetIds);
  const minus = optRange(x.minus, sheetIds);
  const out: ErrorBarSpec = {
    kind: oneOf(x.kind, ERROR_KINDS, "fixed"),
    value: finite(x.value) ? Math.abs(x.value) : 1,
    plus,
    minus,
    direction: oneOf(x.direction, DIRECTIONS, "both"),
  };
  const same = onlyKeys(x, ["kind", "value", "plus", "minus", "direction"]) && x.kind === out.kind && x.value === out.value && x.plus === plus && x.minus === minus && x.direction === out.direction;
  return same ? (x as ErrorBarSpec) : out;
}

function normSeries(x: unknown, i: number, taken: Set<string>, chartId: string, kind: ChartKind, sheetIds: Map<string, string>): SeriesSpec | null {
  if (!isObj(x)) return null;
  const y = normRange(x.y, sheetIds);
  // A series without values is no series.
  if (!y) return null;
  const id = claimId(x.id, `${chartId}-${i + 1}`, taken);
  const out: SeriesSpec = {
    id,
    name: text(x.name, MAX_NAME),
    nameRef: optRange(x.nameRef, sheetIds),
    y,
    x: optRange(x.x, sheetIds),
    color: isColor(x.color) ? x.color : null,
    marker: oneOf(x.marker, MARKERS, kind === "scatter" || kind === "line" ? "circle" : "none"),
    line: oneOf(x.line, LINES, kind === "line" ? "straight" : "none"),
    labels: x.labels === true,
    errorBars: x.errorBars === null || x.errorBars === undefined ? null : normErrorBars(x.errorBars, sheetIds),
    trendline: x.trendline === null || x.trendline === undefined ? null : normTrend(x.trendline),
  };
  return sameShallow(x, out as Obj) ? (x as SeriesSpec) : out;
}

function normChart(x: unknown, i: number, taken: Set<string>, sheetIds: Map<string, string>): ChartSpec | null {
  if (!isObj(x) || typeof x.sheetId !== "string") return null;
  const sheetId = sheetIds.get(x.sheetId);
  if (!sheetId) return null;
  const id = claimId(x.id, `chart${i + 1}`, taken);
  const kind = oneOf(x.kind, CHART_KINDS, "column");
  const at0 = isObj(x.at) ? x.at : {};
  const at = { row: index(at0.row, MAX_ROWS) ?? 0, col: index(at0.col, MAX_COLS) ?? 0, dx: int(at0.dx, 0, MAX_SIZE_PX, 0), dy: int(at0.dy, 0, MAX_SIZE_PX, 0) };
  const atSame = isObj(x.at) && sameShallow(x.at, at);
  const size0 = isObj(x.size) ? x.size : {};
  const size = { w: int(size0.w, 40, MAX_SIZE_PX, 480), h: int(size0.h, 40, MAX_SIZE_PX, 300) };
  const sizeSame = isObj(x.size) && sameShallow(x.size, size);
  const series = normList(x.series, MAX_SERIES, (s, j, ids) => normSeries(s, j, ids, id, kind, sheetIds));
  const out: ChartSpec = {
    id,
    sheetId,
    at: atSame ? (x.at as ChartSpec["at"]) : at,
    size: sizeSame ? (x.size as ChartSpec["size"]) : size,
    kind,
    title: text(x.title, MAX_TITLE),
    x: optRange(x.x, sheetIds),
    series: series.same ? (x.series as SeriesSpec[]) : series.list,
    xAxis: normAxis(x.xAxis, false),
    yAxis: normAxis(x.yAxis, true),
    legend: oneOf(x.legend, LEGENDS, "bottom"),
  };
  return sameShallow(x, out as Obj) ? (x as ChartSpec) : out;
}

// Smart tables ---------------------------------------------------------------------------------

/** Excel's rules for table names (as src/sheet/table/model.ts validTableName, repeated to stay light). */
function validTableName(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (!/^[A-Za-z_\\À-ÖØ-öø-ɏ][A-Za-z0-9_.À-ÖØ-öø-ɏ]*$/.test(name)) return false;
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(name)) return false;
  if (/^[RrCc]$/.test(name) || /^[Rr][0-9]*[Cc][0-9]*$/.test(name)) return false;
  return true;
}

function tableName(x: unknown, locale: Locale, taken: Set<string>): string {
  const name = typeof x === "string" ? x.trim().replace(/\s+/g, "_") : "";
  if (validTableName(name) && !taken.has(name.toLowerCase())) {
    taken.add(name.toLowerCase());
    return name;
  }
  let root = validTableName(name) ? name.replace(/\d+$/, "") : locale === "de" ? "Tabelle" : "Table";
  if (!root || /^[A-Za-z]{1,3}$/.test(root)) root += "_";
  let n = 1;
  while (taken.has(`${root}${n}`.toLowerCase()) || !validTableName(`${root}${n}`)) n++;
  taken.add(`${root}${n}`.toLowerCase());
  return `${root}${n}`;
}

function normFilter(x: unknown): FilterSpec | null {
  if (!isObj(x)) return null;
  let out: FilterSpec;
  if (x.kind === "values") {
    const raw = Array.isArray(x.values) ? x.values : [];
    const values = raw
      .filter((v): v is string => typeof v === "string")
      .slice(0, 10000)
      .map((v) => v.slice(0, MAX_NAME));
    out = { kind: "values", values };
    const same = Array.isArray(x.values) && raw.length === values.length && values.every((v, i) => v === raw[i]) && onlyKeys(x, ["kind", "values"]);
    return same ? (x as FilterSpec) : out;
  }
  if (x.kind === "number") {
    if (!NUMBER_OPS.includes(x.op as (typeof NUMBER_OPS)[number])) return null;
    out = { kind: "number", op: x.op as (typeof NUMBER_OPS)[number], a: finite(x.a) ? x.a : null, b: finite(x.b) ? x.b : null };
    return sameShallow(x, out as Obj) ? (x as FilterSpec) : out;
  }
  if (x.kind === "text") {
    if (!TEXT_OPS.includes(x.op as (typeof TEXT_OPS)[number])) return null;
    out = { kind: "text", op: x.op as (typeof TEXT_OPS)[number], text: text(x.text, MAX_NAME) };
    return sameShallow(x, out as Obj) ? (x as FilterSpec) : out;
  }
  return null;
}

function normTable(x: unknown, i: number, taken: Set<string>, sheetIds: Map<string, string>, names: Set<string>, locale: Locale): TableSpec | null {
  if (!isObj(x) || typeof x.sheetId !== "string") return null;
  const sheetId = sheetIds.get(x.sheetId);
  if (!sheetId) return null;
  const a0 = isObj(x.area) ? x.area : null;
  if (!a0) return null;
  const r0 = index(a0.r0, MAX_ROWS);
  const r1 = index(a0.r1, MAX_ROWS);
  const c0 = index(a0.c0, MAX_COLS);
  const c1 = index(a0.c1, MAX_COLS);
  if (r0 === null || r1 === null || c0 === null || c1 === null) return null;
  const area: Area = { r0: Math.min(r0, r1), c0: Math.min(c0, c1), r1: Math.max(r0, r1), c1: Math.max(c0, c1) };
  const areaSame = sameShallow(a0, area);
  const id = claimId(x.id, `table${i + 1}`, taken);
  const width = area.c1 - area.c0 + 1;
  // One column entry per column of the area, each with a unique id.
  const rawCols = Array.isArray(x.columns) ? x.columns : [];
  const colIds = new Set<string>();
  let colsSame = rawCols.length === width;
  const columns: TableColumn[] = [];
  for (let j = 0; j < width; j++) {
    const c = isObj(rawCols[j]) ? (rawCols[j] as Obj) : {};
    const cid = claimId(c.id, `${id}c${j + 1}`, colIds);
    const col: TableColumn = { id: cid, total: oneOf(c.total, TOTAL_FNS, "none") };
    const same = isObj(rawCols[j]) && sameShallow(c, col as Obj);
    if (!same) colsSame = false;
    columns.push(same ? (c as TableColumn) : col);
  }
  // A totals row needs a header row above it.
  const totals = x.totals === true && area.r1 > area.r0;
  const filters: Record<string, FilterSpec> = {};
  let filtersSame = isObj(x.filters);
  if (isObj(x.filters)) {
    for (const key of Object.keys(x.filters)) {
      const f = colIds.has(key) ? normFilter(x.filters[key]) : null;
      if (f) filters[key] = f;
      if (f !== x.filters[key]) filtersSame = false;
    }
  }
  let sort: TableSpec["sort"] = null;
  if (isObj(x.sort) && typeof x.sort.column === "string" && colIds.has(x.sort.column) && (x.sort.dir === "asc" || x.sort.dir === "desc")) {
    sort = onlyKeys(x.sort, ["column", "dir"]) ? (x.sort as TableSpec["sort"]) : { column: x.sort.column, dir: x.sort.dir };
  }
  const out: TableSpec = {
    id,
    sheetId,
    name: tableName(x.name, locale, names),
    area: areaSame ? (a0 as Area) : area,
    columns: colsSame ? (rawCols as TableColumn[]) : columns,
    totals,
    style: oneOf(x.style, TABLE_STYLES, "purple"),
    banded: typeof x.banded === "boolean" ? x.banded : true,
    filters: filtersSame ? (x.filters as Record<string, FilterSpec>) : filters,
    sort,
  };
  return sameShallow(x, out as Obj) ? (x as TableSpec) : out;
}

/** Tables, without the ones that overlap a table before them on the same sheet. */
function normTables(raw: unknown, sheetIds: Map<string, string>, sheets: Sheet[], locale: Locale): { list: TableSpec[]; same: boolean } {
  const names = new Set<string>();
  const res = normList(raw, MAX_TABLES, (x, i, taken) => normTable(x, i, taken, sheetIds, names, locale));
  const kept: TableSpec[] = [];
  let same = res.same;
  for (const t of res.list) {
    const clash = kept.some((k) => k.sheetId === t.sheetId && k.area.r0 <= t.area.r1 && t.area.r0 <= k.area.r1 && k.area.c0 <= t.area.c1 && t.area.c0 <= k.area.c1);
    if (clash || !sheets.some((s) => s.id === t.sheetId)) same = false;
    else kept.push(t);
  }
  return { list: kept, same };
}

// ----------------------------------------------------------------------------------------------
// Questions about a workbook

/** Is it still the untouched new workbook (one empty sheet, no charts or tables)? */
export function isBlankWorkbook(wb: Workbook): boolean {
  if (wb.sheets.length !== 1 || wb.charts.length || wb.tables.length) return false;
  const s = wb.sheets[0];
  for (const _ in s.cells) return false;
  for (const _ in s.cols) return false;
  for (const _ in s.rows) return false;
  return s.freeze.rows === 0 && s.freeze.cols === 0;
}

/** Rows and columns of the cells, in reading order (row by row). */
function cellOrder(cells: Record<string, Cell>, keep: (cell: Cell) => boolean): { row: number; col: number; cell: Cell }[] {
  const out: { row: number; col: number; cell: Cell }[] = [];
  for (const key in cells) {
    const cell = cells[key];
    if (!keep(cell)) continue;
    const i = key.indexOf(",");
    out.push({ row: Number(key.slice(0, i)), col: Number(key.slice(i + 1)), cell });
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** At most this many formulas are worked out for the search text (a save must stay quick). */
const PLAIN_FORMULA_BUDGET = 3000;
const PLAIN_MAX = 20000;

/** Words of the workbook for search (pages.plain_text): sheet names, text cells, table and chart titles. */
export function workbookPlainText(wb: Workbook, calc: Calc, locale: Locale): string {
  void locale;
  const lines: string[] = [];
  let length = 0;
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (!t || seen.has(t) || length > PLAIN_MAX) return;
    seen.add(t);
    lines.push(t);
    length += t.length + 1;
  };
  let budget = PLAIN_FORMULA_BUDGET;
  for (const sheet of wb.sheets) {
    add(sheet.name);
    let row = -1;
    let words: string[] = [];
    const flush = () => {
      if (words.length) add(words.join(" "));
      words = [];
    };
    for (const { row: r, col, cell } of cellOrder(sheet.cells, (c) => typeof c.v === "string" || c.f !== undefined || !!c.note)) {
      if (r !== row) {
        flush();
        row = r;
      }
      if (cell.f !== undefined) {
        // Text a formula shows (=WENN(…; "positiv"; "negativ")) is findable too, within a budget.
        if (budget-- > 0) {
          let v: CellValue = null;
          try {
            v = calc.value(sheet.id, r, col);
          } catch {
            v = null;
          }
          if (typeof v === "string" && !seen.has(v.trim())) words.push(v);
        }
      } else if (typeof cell.v === "string" && !seen.has(cell.v.trim())) words.push(cell.v);
      if (cell.note) words.push(cell.note);
      if (length > PLAIN_MAX) break;
    }
    flush();
  }
  for (const t of wb.tables) add(t.name.replace(/_/g, " "));
  for (const c of wb.charts) {
    add(c.title);
    add(c.xAxis.title);
    add(c.yAxis.title);
    for (const s of c.series) {
      add(s.name);
      if (s.trendline?.name) add(s.trendline.name);
    }
  }
  return lines.join("\n").slice(0, PLAIN_MAX);
}

// ----------------------------------------------------------------------------------------------
// Previews for tiles

/** A small preview for tiles and cards: the first rows and columns of the first sheet, as shown. */
export type SheetPreview = {
  rows: string[][];
  charts: number;
  tables: number;
  /**
   * How each shown cell looks, row by row like `rows` (older previews have none): see previewLook.
   * Bits: 0–1 alignment (0 left, 1 right, 2 centre), 2 bold, 3 italic, 4–7 fill colour, 8–11 text
   * colour (colours: 1 + index in SHEET_COLORS, 0 none), 12–14 smart table part (1 header,
   * 2 row, 3 banded row, 4 totals row), 15–18 the smart table's colour.
   */
  look?: number[][];
  /** Widths of the shown columns in px (for a mini grid in proportion). */
  widths?: number[];
  /** The first chart of the first sheet, tiny. */
  chart?: PreviewChart;
};

/**
 * A chart, tiny: its kind, its first series' colour and points as x, y pairs scaled to 0–100 (y up;
 * columns and bars: one value per category), and its linear trendline as two points.
 */
export type PreviewChart = { kind: ChartKind; color: SheetColor; pts: number[]; fit?: number[] };

export const PREVIEW_ROWS = 10;
export const PREVIEW_COLS = 6;
const PREVIEW_TEXT = 40;
const PREVIEW_POINTS = 40;

export type PreviewCellLook = {
  align: "left" | "right" | "center";
  bold: boolean;
  italic: boolean;
  fill: SheetColor | null;
  color: SheetColor | null;
  /** The cell's part of a smart table. */
  part: "header" | "row" | "band" | "totals" | null;
  tableColor: SheetColor | null;
};

const colorBits = (c: SheetColor | null | undefined) => (c ? SHEET_COLORS.indexOf(c) + 1 : 0);
const bitsColor = (n: number): SheetColor | null => SHEET_COLORS[n - 1] ?? null;
const PARTS = [null, "header", "row", "band", "totals"] as const;

/** A preview cell's look from its bits (see SheetPreview.look). */
export function previewLook(bits: number | undefined): PreviewCellLook {
  const b = bits ?? 0;
  return {
    align: (b & 3) === 1 ? "right" : (b & 3) === 2 ? "center" : "left",
    bold: !!(b & 4),
    italic: !!(b & 8),
    fill: bitsColor((b >> 4) & 15),
    color: bitsColor((b >> 8) & 15),
    part: PARTS[(b >> 12) & 7] ?? null,
    tableColor: bitsColor((b >> 15) & 15),
  };
}

/** Is there something to see in the cell (a value, a formula or a fill)? */
const visible = (c: Cell | undefined) => !!c && (c.v !== undefined || c.f !== undefined || !!c.s?.fill);

export function workbookPreview(wb: Workbook, calc: Calc, locale: Locale): SheetPreview {
  const sheet = wb.sheets[0];
  const preview: SheetPreview = { rows: [], charts: wb.charts.length, tables: wb.tables.length };
  if (!sheet) return preview;
  // From the top-left of what is there (a sheet starting at C5 shows C5 first).
  let r0 = Infinity;
  let c0 = Infinity;
  for (const key in sheet.cells) {
    if (!visible(sheet.cells[key])) continue;
    const i = key.indexOf(",");
    r0 = Math.min(r0, Number(key.slice(0, i)));
    c0 = Math.min(c0, Number(key.slice(i + 1)));
  }
  for (const t of wb.tables) {
    if (t.sheetId !== sheet.id) continue;
    r0 = Math.min(r0, t.area.r0);
    c0 = Math.min(c0, t.area.c0);
  }
  if (r0 === Infinity) r0 = c0 = 0;
  const rows: number[] = [];
  for (let r = r0; r < sheet.size.rows && rows.length < PREVIEW_ROWS; r++) if (!sheet.rows[r]?.hidden) rows.push(r);
  const cols: number[] = [];
  for (let c = c0; c < sheet.size.cols && cols.length < PREVIEW_COLS; c++) if (!sheet.cols[c]?.hidden) cols.push(c);
  const tables = wb.tables.filter((t) => t.sheetId === sheet.id);

  const texts: string[][] = [];
  const looks: number[][] = [];
  for (const r of rows) {
    const line: string[] = [];
    const lookLine: number[] = [];
    for (const c of cols) {
      const cell = sheet.cells[`${r},${c}`];
      let value: CellValue = null;
      if (cell && (cell.v !== undefined || cell.f !== undefined)) {
        try {
          value = calc.value(sheet.id, r, c);
        } catch {
          value = null;
        }
      }
      let shown = formatValue(value, cell?.s?.fmt, locale);
      if (shown.length > PREVIEW_TEXT) shown = `${shown.slice(0, PREVIEW_TEXT - 1)}…`;
      line.push(shown.replace(/\s*\n\s*/g, " "));
      const s = cell?.s;
      const align = s?.align ?? (typeof value === "number" ? "right" : typeof value === "boolean" || isError(value) ? "center" : "left");
      let bits = (align === "right" ? 1 : align === "center" ? 2 : 0) | (s?.bold ? 4 : 0) | (s?.italic ? 8 : 0) | (colorBits(s?.fill) << 4) | (colorBits(s?.color) << 8);
      const t = tables.find((x) => r >= x.area.r0 && r <= x.area.r1 && c >= x.area.c0 && c <= x.area.c1);
      if (t) {
        const part = r === t.area.r0 ? 1 : t.totals && r === t.area.r1 ? 4 : t.banded && (r - t.area.r0) % 2 === 0 ? 3 : 2;
        bits |= (part << 12) | (colorBits(t.style) << 15);
      }
      lookLine.push(bits);
    }
    texts.push(line);
    looks.push(lookLine);
  }
  // Empty rows and columns at the end aren't worth the room (a fill or a smart table is something to see).
  const seen = (b: number) => ((b >> 4) & 15) !== 0 || ((b >> 12) & 7) !== 0;
  const emptyRow = (i: number) => texts[i].every((x, j) => !x && !seen(looks[i][j]));
  while (texts.length && emptyRow(texts.length - 1)) {
    texts.pop();
    looks.pop();
  }
  let width = cols.length;
  const emptyCol = (j: number) => texts.every((line, i) => !line[j] && !seen(looks[i][j]));
  while (width > 1 && texts.length && emptyCol(width - 1)) width--;
  preview.rows = texts.map((line) => line.slice(0, width));
  if (looks.some((line) => line.some((b) => b !== 0))) preview.look = looks.map((line) => line.slice(0, width));
  if (texts.length) preview.widths = cols.slice(0, width).map((c) => Math.round(Math.min(400, Math.max(20, sheet.cols[c]?.w ?? DEFAULT_COL_W))));
  const chart = wb.charts.find((c) => c.sheetId === sheet.id) ?? wb.charts[0];
  if (chart) {
    try {
      const mini = previewChart(chart, calc);
      if (mini) preview.chart = mini;
    } catch {
      // No picture of the chart, just the count.
    }
  }
  return preview;
}

/** Numbers of a range, row by row (a column or a row of cells). */
function rangeNumbers(calc: Calc, ref: RangeRef | null): (number | null)[] {
  if (!ref) return [];
  const out: (number | null)[] = [];
  const values = calc.values(ref);
  for (const line of values) for (const v of line) out.push(typeof v === "number" && Number.isFinite(v) ? v : null);
  return out;
}

const scale = (v: number, min: number, max: number) => (max > min ? Math.round(((v - min) / (max - min)) * 100) : 50);

/** The first series of a chart as a few points (and its linear trendline), for a tile. */
function previewChart(chart: ChartSpec, calc: Calc): PreviewChart | undefined {
  const s = chart.series[0];
  const color = s?.color ?? "blue";
  if (!s) return { kind: chart.kind, color, pts: [] };
  const ys = rangeNumbers(calc, s.y);
  const xsRaw = chart.kind === "scatter" ? rangeNumbers(calc, s.x ?? chart.x) : [];
  const pairs: [number, number][] = [];
  ys.forEach((y, i) => {
    if (y === null) return;
    const x = chart.kind === "scatter" ? (xsRaw.length ? xsRaw[i] : i + 1) : i;
    if (x === null || x === undefined) return;
    pairs.push([x, y]);
  });
  const used = pairs.slice(0, PREVIEW_POINTS);
  if (!used.length) return { kind: chart.kind, color, pts: [] };
  const logY = chart.yAxis.log;
  const yv = (y: number) => (logY ? (y > 0 ? Math.log10(y) : NaN) : y);
  const fx = used.map((p) => p[0]);
  const fy = used.map((p) => yv(p[1])).filter((y) => Number.isFinite(y));
  let xMin = Math.min(...fx);
  let xMax = Math.max(...fx);
  // Columns and bars grow from zero.
  let yMin = chart.kind === "column" || chart.kind === "bar" || chart.kind === "area" ? Math.min(0, ...fy) : Math.min(...fy);
  let yMax = Math.max(...fy);
  if (chart.yAxis.min !== null && !logY) yMin = chart.yAxis.min;
  if (chart.yAxis.max !== null && !logY) yMax = chart.yAxis.max;
  if (chart.kind === "scatter") {
    if (chart.xAxis.min !== null) xMin = chart.xAxis.min;
    if (chart.xAxis.max !== null) xMax = chart.xAxis.max;
  }
  const pts: number[] = [];
  for (const [x, y] of used) {
    const v = yv(y);
    if (!Number.isFinite(v)) continue;
    pts.push(scale(x, xMin, xMax), scale(v, yMin, yMax));
  }
  const out: PreviewChart = { kind: chart.kind, color, pts };
  // A linear trendline (the calibration line): least squares, or through the fixed intercept.
  const t = s.trendline;
  if (t?.type === "linear" && chart.kind === "scatter" && !logY && used.length >= 2) {
    const n = used.length;
    let m: number;
    let b: number;
    if (t.intercept !== null) {
      b = t.intercept;
      let sxy = 0;
      let sxx = 0;
      for (const [x, y] of used) {
        sxy += x * (y - b);
        sxx += x * x;
      }
      m = sxx ? sxy / sxx : 0;
    } else {
      const mx = fx.reduce((a, x) => a + x, 0) / n;
      const my = used.reduce((a, p) => a + p[1], 0) / n;
      let sxy = 0;
      let sxx = 0;
      for (const [x, y] of used) {
        sxy += (x - mx) * (y - my);
        sxx += (x - mx) * (x - mx);
      }
      m = sxx ? sxy / sxx : 0;
      b = my - m * mx;
    }
    if (Number.isFinite(m) && Number.isFinite(b)) {
      const clampY = (v: number) => Math.max(-20, Math.min(120, v));
      out.fit = [scale(xMin, xMin, xMax), clampY(scale(m * xMin + b, yMin, yMax)), scale(xMax, xMin, xMax), clampY(scale(m * xMax + b, yMin, yMax))];
    }
  }
  return out;
}

/**
 * A stored preview (content->preview) as this app can draw it, or null. Lists read it straight
 * from the database, so nothing about it is trusted.
 */
export function readSheetPreview(raw: unknown): SheetPreview | null {
  if (!isObj(raw) || !Array.isArray(raw.rows)) return null;
  const rows = raw.rows
    .slice(0, PREVIEW_ROWS)
    .map((line) => (Array.isArray(line) ? line.slice(0, PREVIEW_COLS).map((x) => (typeof x === "string" ? x.slice(0, PREVIEW_TEXT) : "")) : []));
  const count = (x: unknown) => (finite(x) ? Math.max(0, Math.min(100000, Math.round(x))) : 0);
  const out: SheetPreview = { rows, charts: count(raw.charts), tables: count(raw.tables) };
  if (Array.isArray(raw.look)) {
    out.look = rows.map((line, i) => {
      const l = Array.isArray((raw.look as unknown[])[i]) ? ((raw.look as unknown[])[i] as unknown[]) : [];
      return line.map((_, j) => (finite(l[j]) ? (l[j] as number) & 0x7ffff : 0));
    });
  }
  if (Array.isArray(raw.widths)) out.widths = raw.widths.slice(0, PREVIEW_COLS).map((w) => (finite(w) ? Math.min(400, Math.max(20, w)) : DEFAULT_COL_W));
  if (isObj(raw.chart)) {
    const c = raw.chart;
    const nums = (x: unknown, max: number) => (Array.isArray(x) ? x.slice(0, max).map((v) => (finite(v) ? Math.max(-50, Math.min(150, v)) : 0)) : []);
    const pts = nums(c.pts, PREVIEW_POINTS * 2);
    if (pts.length % 2) pts.pop();
    out.chart = { kind: oneOf(c.kind, CHART_KINDS, "column"), color: isColor(c.color) ? c.color : "blue", pts };
    const fit = nums(c.fit, 4);
    if (fit.length === 4) out.chart.fit = fit;
  }
  return out;
}
