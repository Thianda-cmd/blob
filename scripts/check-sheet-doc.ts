// Checks the stored spreadsheet document (src/sheet/doc.ts) and the merge for saving together
// (src/sheet/collab.ts).
//
//   npm run check:sheet-doc
//
// - newWorkbook / normalizeWorkbook: empty and foreign content, repairs of every part, identity for
//   valid workbooks (the same object back), the preview dropped, JSON round trips, determinism.
// - Fuzz: random JSON and randomly damaged workbooks never make normalizeWorkbook throw, and what
//   comes out always passes an independent validity check (written here, not shared with doc.ts).
// - workbookPlainText, workbookPreview and readSheetPreview.
// - mergeWorkbooks: edits of different cells, the same cell (ours wins), parts of one cell, sheets,
//   charts and tables added, deleted, renamed and moved on either side, sizes growing, undo-style
//   merges, and random edits on both sides (valid result; one side's changes survive).
// - Saving (src/components/sheet/saver.ts) against a stand-in for save_sheet: one editor, two at
//   once (different cells, the same cell, the title, typing during a save), offline with the draft
//   kept and put back, refused saves (no access, server error, too big) and their save states,
//   viewers, and the background save of drafts whose editor was closed.
// - Data safety: a save whose answer was lost (it landed, or it didn't) and a partner's correction
//   afterwards, through the open editor, a reopened one and the background save; two editors (tabs)
//   offline at once, an open editor's draft left alone (here and, through Web Locks, in another
//   tab), one taker at a time; what signing out counts, flushes and stops (in other tabs too); a
//   pull that misses a save announced meanwhile; the longest waits for a save and a draft while
//   typing goes on (longer for big spreadsheets); a rename made elsewhere; the size limit as
//   save_sheet measures it, the warning near it and the import check; the notice when rows were
//   moved on both sides at once; and a change that couldn't be saved, undone.
// Problems make the script exit with 1.

import {
  clearDraft,
  discardOpenSheets,
  draftPages,
  flushOpenSheets,
  flushedRev,
  forgetOtherAccounts,
  readDrafts,
  unsavedSheets,
  waitingDrafts,
  writeDraft,
  type SheetDraft,
} from "@/components/sheet/drafts";
import { flushSheetDrafts } from "@/components/sheet/flushDrafts";
import { appendWorkbook, freshIds, importedBytes, MAX_SHEET_BYTES, sheetPageContent } from "@/components/sheet/importFile";
import { newPageFor } from "@/components/shell/paletteNew";
import { jsonBytes, LARGE_BYTES, MAX_BYTES, SheetSaver, storedContent, type SaveArgs, type SaverApi, type SheetConflict } from "@/components/sheet/saver";
import { createSheetStore } from "@/components/sheet/store";
import { reportOk } from "@/lib/offline/net";
import { mergeWorkbooks, sameJson } from "@/sheet/collab";
import { isBlankWorkbook, isUnreadableWorkbook, newWorkbook, normalizeWorkbook, previewLook, readSheetPreview, workbookPlainText, workbookPreview } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import { insertRows, setCells } from "@/sheet/ops";
import { MAX_COLS, MAX_ROWS, type Cell, type ChartSpec, type SeriesSpec, type Sheet, type TableSpec, type Workbook } from "@/sheet/types";

let passed = 0;
const problems: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else problems.push(`${name}${detail === undefined ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)}`}`);
}
function section(name: string, run: () => void) {
  try {
    run();
  } catch (e) {
    problems.push(`${name}: threw ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }
}

// ----------------------------------------------------------------------------------------------
// A seeded random generator (the same run every time).

let seed = 20261103;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
const ri = (n: number) => Math.floor(rand() * n);
const pickOne = <T>(list: readonly T[]): T => list[ri(list.length)];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ----------------------------------------------------------------------------------------------
// An independent validity check: everything the editor relies on.

const COLORS = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown"];
const isInt = (x: unknown, min: number, max: number) => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const keysIn = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).every((k) => allowed.includes(k));

function styleProblems(s: unknown): string | null {
  if (!isObj(s)) return "style not an object";
  if (!keysIn(s, ["bold", "italic", "underline", "strike", "wrap", "color", "fill", "align", "valign", "size", "fmt", "border"])) return "style key";
  for (const k of ["bold", "italic", "underline", "strike", "wrap"]) if (s[k] !== undefined && typeof s[k] !== "boolean") return `style ${k}`;
  for (const k of ["color", "fill"]) if (s[k] !== undefined && !COLORS.includes(s[k] as string)) return `style ${k}`;
  if (s.align !== undefined && !["left", "center", "right"].includes(s.align as string)) return "align";
  if (s.valign !== undefined && !["top", "middle", "bottom"].includes(s.valign as string)) return "valign";
  if (s.size !== undefined && !(typeof s.size === "number" && s.size >= 6 && s.size <= 96)) return "size";
  if (s.fmt !== undefined) {
    const f = s.fmt;
    if (!isObj(f)) return "fmt";
    const kinds = ["general", "number", "percent", "scientific", "significant", "currency", "date", "time", "datetime", "text"];
    if (!kinds.includes(f.kind as string)) return "fmt kind";
    if (["number", "percent", "scientific", "currency"].includes(f.kind as string) && !isInt(f.decimals, 0, 30)) return "fmt decimals";
    if (f.kind === "significant" && !isInt(f.digits, 1, 15)) return "fmt digits";
    if (f.kind === "currency" && !["€", "$", "£", "CHF"].includes(f.symbol as string)) return "fmt symbol";
    if (f.kind === "date" && !["short", "long", "iso"].includes(f.style as string)) return "fmt style";
    if (f.kind === "time" && typeof f.seconds !== "boolean") return "fmt seconds";
    if (f.unit !== undefined && typeof f.unit !== "string") return "fmt unit";
  }
  if (s.border !== undefined) {
    if (!isObj(s.border) || !keysIn(s.border, ["top", "right", "bottom", "left"])) return "border";
    for (const v of Object.values(s.border)) if (!["thin", "thick", "double", "dashed"].includes(v as string)) return "border line";
  }
  return null;
}

function rangeOk(r: unknown, sheets: Set<string>): boolean {
  if (!isObj(r) || !sheets.has(r.sheetId as string)) return false;
  return isInt(r.r0, 0, MAX_ROWS - 1) && isInt(r.r1, 0, MAX_ROWS - 1) && isInt(r.c0, 0, MAX_COLS - 1) && isInt(r.c1, 0, MAX_COLS - 1) && (r.r0 as number) <= (r.r1 as number) && (r.c0 as number) <= (r.c1 as number);
}

function validate(wb: unknown): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(m);
  if (!isObj(wb)) return ["not an object"];
  if (wb.v !== 1) bad("v");
  if (!keysIn(wb, ["v", "sheets", "charts", "tables"])) bad(`top keys ${Object.keys(wb)}`);
  if (!Array.isArray(wb.sheets) || !wb.sheets.length) return [...out, "sheets"];
  if (!Array.isArray(wb.charts)) bad("charts");
  if (!Array.isArray(wb.tables)) bad("tables");
  const ids = new Set<string>();
  const names = new Set<string>();
  const sizes = new Map<string, { rows: number; cols: number }>();
  for (const s of wb.sheets as unknown[]) {
    if (!isObj(s)) {
      bad("sheet not an object");
      continue;
    }
    if (typeof s.id !== "string" || !s.id || ids.has(s.id)) bad(`sheet id ${String(s.id)}`);
    ids.add(s.id as string);
    const name = s.name as string;
    if (typeof name !== "string" || name.length < 1 || name.length > 31 || !name.trim() || /[[\]:*?/\\]/.test(name) || name.startsWith("'") || name.endsWith("'")) bad(`sheet name ${JSON.stringify(name)}`);
    else if (names.has(name.toLowerCase())) bad(`duplicate sheet name ${name}`);
    else names.add(name.toLowerCase());
    if (!keysIn(s, ["id", "name", "cells", "cols", "rows", "freeze", "size"])) bad("sheet keys");
    const size = s.size as { rows: number; cols: number };
    if (!isObj(size) || !isInt(size.rows, 1, MAX_ROWS) || !isInt(size.cols, 1, MAX_COLS)) {
      bad("size");
      continue;
    }
    sizes.set(s.id as string, size);
    if (!isObj(s.freeze) || !isInt(s.freeze.rows, 0, size.rows - 1) || !isInt(s.freeze.cols, 0, size.cols - 1)) bad("freeze");
    if (!isObj(s.cells)) bad("cells");
    else
      for (const [key, cell] of Object.entries(s.cells)) {
        const m = /^(\d+),(\d+)$/.exec(key);
        if (!m || String(Number(m[1])) !== m[1] || String(Number(m[2])) !== m[2]) {
          bad(`cell key ${key}`);
          continue;
        }
        if (Number(m[1]) >= size.rows || Number(m[2]) >= size.cols) bad(`cell ${key} outside size ${size.rows}x${size.cols}`);
        if (!isObj(cell) || !keysIn(cell, ["v", "f", "s", "note"])) {
          bad(`cell ${key} shape`);
          continue;
        }
        if (cell.v !== undefined && !((typeof cell.v === "number" && Number.isFinite(cell.v)) || typeof cell.v === "boolean" || (typeof cell.v === "string" && cell.v !== ""))) bad(`cell ${key} v`);
        if (cell.f !== undefined && !(typeof cell.f === "string" && cell.f.trim() && !cell.f.startsWith("="))) bad(`cell ${key} f`);
        if (cell.note !== undefined && typeof cell.note !== "string") bad(`cell ${key} note`);
        if (cell.s !== undefined) {
          const p = styleProblems(cell.s);
          if (p) bad(`cell ${key} ${p}`);
        }
        if (cell.v === undefined && cell.f === undefined && cell.s === undefined && cell.note === undefined) bad(`cell ${key} empty`);
      }
    for (const [what, prop] of [
      ["cols", "w"],
      ["rows", "h"],
    ] as const) {
      const rec = s[what];
      if (!isObj(rec)) {
        bad(what);
        continue;
      }
      for (const [k, e] of Object.entries(rec)) {
        if (String(Number(k)) !== k || Number(k) >= (what === "cols" ? MAX_COLS : MAX_ROWS)) bad(`${what} key ${k}`);
        if (!isObj(e) || !keysIn(e, [prop, "hidden"])) bad(`${what} entry ${k}`);
        else if ((e[prop] !== undefined && !(typeof e[prop] === "number" && (e[prop] as number) > 0)) || (e.hidden !== undefined && typeof e.hidden !== "boolean")) bad(`${what} entry ${k} values`);
      }
    }
  }
  const chartIds = new Set<string>();
  for (const c of (Array.isArray(wb.charts) ? wb.charts : []) as unknown[]) {
    if (!isObj(c)) {
      bad("chart shape");
      continue;
    }
    if (typeof c.id !== "string" || chartIds.has(c.id)) bad("chart id");
    chartIds.add(c.id as string);
    if (!ids.has(c.sheetId as string)) bad("chart sheet");
    const size = sizes.get(c.sheetId as string);
    const at = c.at as Record<string, unknown>;
    if (!isObj(at) || !isInt(at.row, 0, MAX_ROWS - 1) || !isInt(at.col, 0, MAX_COLS - 1) || typeof at.dx !== "number" || typeof at.dy !== "number") bad("chart at");
    else if (size && ((at.row as number) >= size.rows || (at.col as number) >= size.cols)) bad("chart outside sheet");
    if (!isObj(c.size) || !(typeof c.size.w === "number" && c.size.w > 0) || !(typeof c.size.h === "number" && c.size.h > 0)) bad("chart size");
    if (!["scatter", "line", "column", "bar", "area", "pie"].includes(c.kind as string)) bad("chart kind");
    if (typeof c.title !== "string") bad("chart title");
    if (c.x !== null && !rangeOk(c.x, ids)) bad("chart x");
    if (!["top", "right", "bottom", "none"].includes(c.legend as string)) bad("legend");
    for (const axis of [c.xAxis, c.yAxis]) {
      if (!isObj(axis) || typeof axis.title !== "string" || typeof axis.log !== "boolean" || typeof axis.grid !== "boolean") bad("axis");
      else if ((axis.min !== null && typeof axis.min !== "number") || (axis.max !== null && typeof axis.max !== "number") || (axis.decimals !== null && !isInt(axis.decimals, 0, 30))) bad("axis numbers");
    }
    if (!Array.isArray(c.series)) {
      bad("series");
      continue;
    }
    const sids = new Set<string>();
    for (const s of c.series as unknown[]) {
      if (!isObj(s)) {
        bad("series shape");
        continue;
      }
      if (typeof s.id !== "string" || sids.has(s.id)) bad("series id");
      sids.add(s.id as string);
      if (!rangeOk(s.y, ids)) bad("series y");
      if (s.x !== null && !rangeOk(s.x, ids)) bad("series x");
      if (s.nameRef !== null && !rangeOk(s.nameRef, ids)) bad("series nameRef");
      if (typeof s.name !== "string" || typeof s.labels !== "boolean") bad("series fields");
      if (s.color !== null && !COLORS.includes(s.color as string)) bad("series color");
      if (!["circle", "square", "triangle", "diamond", "none"].includes(s.marker as string)) bad("marker");
      if (!["none", "straight", "smooth"].includes(s.line as string)) bad("line");
      if (s.trendline !== null) {
        const t = s.trendline as Record<string, unknown>;
        if (!isObj(t) || !["linear", "polynomial", "exponential", "logarithmic", "power", "movingAverage"].includes(t.type as string) || !isInt(t.order, 2, 6) || !isInt(t.period, 2, 100000)) bad("trendline");
        else if ((t.intercept !== null && typeof t.intercept !== "number") || typeof t.showEquation !== "boolean" || typeof t.showR2 !== "boolean" || typeof t.forward !== "number" || typeof t.backward !== "number" || typeof t.name !== "string") bad("trendline fields");
      }
      if (s.errorBars !== null) {
        const e = s.errorBars as Record<string, unknown>;
        if (!isObj(e) || !["fixed", "percent", "stdev", "stderr", "custom"].includes(e.kind as string) || typeof e.value !== "number" || !["both", "plus", "minus"].includes(e.direction as string)) bad("error bars");
        else if ((e.plus !== null && !rangeOk(e.plus, ids)) || (e.minus !== null && !rangeOk(e.minus, ids))) bad("error bar ranges");
      }
    }
  }
  const tableIds = new Set<string>();
  const tableNames = new Set<string>();
  const placed: { sheetId: string; r0: number; c0: number; r1: number; c1: number }[] = [];
  for (const t of (Array.isArray(wb.tables) ? wb.tables : []) as unknown[]) {
    if (!isObj(t)) {
      bad("table shape");
      continue;
    }
    if (typeof t.id !== "string" || tableIds.has(t.id)) bad("table id");
    tableIds.add(t.id as string);
    if (!ids.has(t.sheetId as string)) bad("table sheet");
    const name = t.name as string;
    if (typeof name !== "string" || !/^[A-Za-z_\\À-ÖØ-öø-ɏ][A-Za-z0-9_.À-ÖØ-öø-ɏ]*$/.test(name) || /^[A-Za-z]{1,3}[0-9]+$/.test(name) || tableNames.has(name.toLowerCase())) bad(`table name ${name}`);
    tableNames.add(String(name).toLowerCase());
    const a = t.area as Record<string, number>;
    if (!isObj(a) || !isInt(a.r0, 0, MAX_ROWS - 1) || !isInt(a.r1, a.r0, MAX_ROWS - 1) || !isInt(a.c0, 0, MAX_COLS - 1) || !isInt(a.c1, a.c0, MAX_COLS - 1)) {
      bad("table area");
      continue;
    }
    const size = sizes.get(t.sheetId as string);
    if (size && (a.r1 >= size.rows || a.c1 >= size.cols)) bad("table outside sheet");
    if (placed.some((p) => p.sheetId === t.sheetId && p.r0 <= a.r1 && a.r0 <= p.r1 && p.c0 <= a.c1 && a.c0 <= p.c1)) bad("tables overlap");
    placed.push({ sheetId: t.sheetId as string, r0: a.r0, c0: a.c0, r1: a.r1, c1: a.c1 });
    const cols = t.columns as { id: string; total: string }[];
    if (!Array.isArray(cols) || cols.length !== a.c1 - a.c0 + 1) bad("table columns length");
    const colIds = new Set<string>();
    for (const c of Array.isArray(cols) ? cols : []) {
      if (!isObj(c) || typeof c.id !== "string" || colIds.has(c.id) || !["none", "sum", "average", "count", "countNumbers", "min", "max", "stdev", "var"].includes(c.total)) bad("table column");
      colIds.add(c.id);
    }
    if (typeof t.totals !== "boolean" || (t.totals && a.r1 === a.r0)) bad("totals");
    if (!["purple", "blue", "green", "orange", "teal", "gray"].includes(t.style as string)) bad("table style");
    if (typeof t.banded !== "boolean") bad("banded");
    if (!isObj(t.filters)) bad("filters");
    else for (const k of Object.keys(t.filters)) if (!colIds.has(k)) bad("filter column");
    if (t.sort !== null && (!isObj(t.sort) || !colIds.has(t.sort.column as string) || !["asc", "desc"].includes(t.sort.dir as string))) bad("sort");
  }
  return out;
}

// ----------------------------------------------------------------------------------------------
// Workbooks to test with

const range = (sheetId: string, r0: number, c0: number, r1: number, c1: number) => ({ sheetId, r0, c0, r1, c1 });

function series(id: string, y: ReturnType<typeof range>, extra: Partial<SeriesSpec> = {}): SeriesSpec {
  return { id, name: "", nameRef: null, y, x: null, color: null, marker: "circle", line: "none", labels: false, errorBars: null, trendline: null, ...extra };
}

/** A calibration workbook: concentrations, absorbances, a smart table, a scatter chart with a linear trendline. */
function labWorkbook(): Workbook {
  const s1 = "lab1";
  const s2 = "lab2";
  const cells: Record<string, Cell> = {
    "0,0": { v: "Kalibrierung", s: { bold: true, size: 18 } },
    "1,0": { v: "Konzentration", s: { bold: true } },
    "1,1": { v: "Extinktion", s: { bold: true }, note: "bei 595 nm" },
  };
  const conc = [0, 2, 4, 6, 8, 10];
  const abs = [0.002, 0.106, 0.211, 0.313, 0.42, 0.523];
  conc.forEach((c, i) => {
    cells[`${i + 2},0`] = { v: c, s: { fmt: { kind: "number", decimals: 1, unit: "mg/L" } } };
    cells[`${i + 2},1`] = { v: abs[i], s: { fmt: { kind: "number", decimals: 3 } } };
  });
  cells["9,0"] = { v: "Steigung" };
  cells["9,1"] = { f: "SLOPE(B3:B8,A3:A8)", s: { fill: "green", bold: true } };
  cells["10,0"] = { v: "Ergebnis" };
  cells["10,1"] = { f: 'IF(B10>0.05,"steil","flach")' };
  const sheet1: Sheet = { id: s1, name: "Kalibrierung", cells, cols: { "0": { w: 130 }, "1": { w: 110 } }, rows: { "0": { h: 34 } }, freeze: { rows: 2, cols: 0 }, size: { rows: 200, cols: 26 } };
  const sheet2: Sheet = { id: s2, name: "Proben", cells: { "0,0": { v: "Probe" }, "1,0": { v: "P1" }, "1,1": { v: 0.25 } }, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } };
  const chart: ChartSpec = {
    id: "ch1",
    sheetId: s1,
    at: { row: 1, col: 3, dx: 8, dy: 4 },
    size: { w: 480, h: 300 },
    kind: "scatter",
    title: "Kalibriergerade",
    x: range(s1, 2, 0, 7, 0),
    series: [
      series("se1", range(s1, 2, 1, 7, 1), {
        nameRef: range(s1, 1, 1, 1, 1),
        trendline: { type: "linear", order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "" },
        errorBars: { kind: "percent", value: 5, plus: null, minus: null, direction: "both" },
      }),
    ],
    xAxis: { title: "Konzentration (mg/L)", min: null, max: null, log: false, grid: false, decimals: null },
    yAxis: { title: "Extinktion", min: null, max: null, log: false, grid: true, decimals: null },
    legend: "bottom",
  };
  const table: TableSpec = {
    id: "tb1",
    sheetId: s1,
    name: "Kalibrierung",
    area: { r0: 1, c0: 0, r1: 7, c1: 1 },
    columns: [
      { id: "k1", total: "none" },
      { id: "k2", total: "average" },
    ],
    totals: false,
    style: "blue",
    banded: true,
    filters: { k2: { kind: "number", op: "gt", a: 0, b: null } },
    sort: { column: "k1", dir: "asc" },
  };
  return { v: 1, sheets: [sheet1, sheet2], charts: [chart], tables: [table] };
}

// ----------------------------------------------------------------------------------------------
// New and blank workbooks

section("newWorkbook", () => {
  const de = newWorkbook("de");
  const en = newWorkbook("en");
  check("new: German name", de.sheets.length === 1 && de.sheets[0].name === "Blatt 1", de.sheets);
  check("new: English name", en.sheets[0].name === "Sheet 1", en.sheets[0].name);
  check("new: valid", validate(de).length === 0, validate(de));
  check("new: blank", isBlankWorkbook(de) && isBlankWorkbook(en));
  check("new: ids differ between workbooks", newWorkbook("de").sheets[0].id !== newWorkbook("de").sheets[0].id);
  check("new: normalize keeps it as it is", normalizeWorkbook(de, "de") === de);
  check("new: survives JSON", sameJson(normalizeWorkbook(clone(de), "de"), de));
});

section("empty and foreign content", () => {
  for (const raw of [null, undefined, {}, [], "", "x", 42, true, { v: 1 }, { sheets: [] }, { sheets: "nope" }, { sheets: [null, 5, "x"] }, { type: "doc", content: [] }, { slides: [] }]) {
    const wb = normalizeWorkbook(raw, "de");
    check(`foreign ${JSON.stringify(raw)}: valid`, validate(wb).length === 0, validate(wb));
    check(`foreign ${JSON.stringify(raw)}: blank`, isBlankWorkbook(wb));
    check(`foreign ${JSON.stringify(raw)}: fixed sheet id`, wb.sheets[0].id === "s1" && wb.sheets[0].name === "Blatt 1", wb.sheets[0]);
    check(`foreign ${JSON.stringify(raw)}: readable`, !isUnreadableWorkbook(wb));
  }
  const en = normalizeWorkbook({}, "en");
  check("foreign: English name", en.sheets[0].name === "Sheet 1");
  const fromString = normalizeWorkbook(JSON.stringify(labWorkbook()), "de");
  check("content saved as a JSON string is read", fromString.sheets.length === 2 && fromString.charts.length === 1, fromString.sheets.length);
});

section("isBlankWorkbook", () => {
  const wb = newWorkbook("de");
  const typed: Workbook = { ...wb, sheets: [{ ...wb.sheets[0], cells: { "0,0": { v: 1 } } }] };
  check("blank: a typed cell is not blank", !isBlankWorkbook(typed));
  const two: Workbook = { ...wb, sheets: [...wb.sheets, { ...wb.sheets[0], id: "x", name: "Blatt 2" }] };
  check("blank: two sheets are not blank", !isBlankWorkbook(two));
  check("blank: a chart is not blank", !isBlankWorkbook({ ...wb, charts: labWorkbook().charts.map((c) => ({ ...c, sheetId: wb.sheets[0].id })) }));
  check("blank: a resized column is not blank", !isBlankWorkbook({ ...wb, sheets: [{ ...wb.sheets[0], cols: { "0": { w: 200 } } }] }));
  check("blank: the lab workbook is not blank", !isBlankWorkbook(labWorkbook()));
});

// ----------------------------------------------------------------------------------------------
// Normalizing valid and damaged workbooks

section("valid workbooks stay the same object", () => {
  const wb = labWorkbook();
  check("lab workbook is valid", validate(wb).length === 0, validate(wb));
  const n = normalizeWorkbook(wb, "de");
  check("identity for a valid workbook", n === wb);
  const withPreview = { ...wb, preview: { rows: [["a"]], charts: 1, tables: 1 } };
  const n2 = normalizeWorkbook(withPreview, "de");
  check("preview dropped", !("preview" in n2) && validate(n2).length === 0, Object.keys(n2));
  check("preview dropped: sheets, charts and tables kept as they were", n2.sheets === wb.sheets && n2.charts === wb.charts && n2.tables === wb.tables);
  const roundTrip = normalizeWorkbook(clone(wb), "de");
  check("JSON round trip", sameJson(roundTrip, wb));
  check("idempotent", normalizeWorkbook(n2, "de") === n2);
});

section("repairs", () => {
  const base = labWorkbook();
  const damaged = clone(base) as unknown as Record<string, unknown>;
  const sheets = damaged.sheets as Record<string, unknown>[];
  const cells = sheets[0].cells as Record<string, unknown>;
  cells["abc"] = { v: 1 };
  cells["-1,2"] = { v: 1 };
  cells["30000,1"] = { v: 1 };
  cells["5,300"] = { v: 1 };
  cells["03,04"] = { v: "leading zeros" };
  cells["12,0"] = { f: "=SUM(B3:B8)" };
  cells["12,1"] = { v: null };
  cells["12,2"] = { v: "x", s: { bold: "yes", color: "chartreuse", fill: "green", fmt: { kind: "nope" }, size: 500, border: { top: "wavy", left: "thin" } }, extra: 1 };
  cells["12,3"] = { v: "" };
  cells["12,4"] = 7;
  cells["12,5"] = { v: { nested: true }, note: 5 };
  cells["250,40"] = { v: "far away" };
  sheets[0].cols = { "0": { w: 130 }, x: { w: 5 }, "3": { w: -4 }, "4": { hidden: true, junk: 1 }, "999": { w: 50 } };
  sheets[0].freeze = { rows: 999999, cols: -3 };
  sheets[1].name = "Kalibrierung";
  sheets.push({ id: "lab1", name: "Bad/Name*", cells: {}, cols: {}, rows: {}, freeze: {}, size: { rows: 0, cols: 1e9 } });
  sheets.push({ name: "   ", cells: null });
  damaged.charts = [
    ...(damaged.charts as unknown[]),
    { id: "ch2", sheetId: "missing", kind: "scatter", series: [] },
    { id: "ch1", sheetId: "lab1", kind: "pie", at: { row: 500, col: 3, dx: -5, dy: 9 }, size: { w: 1e9, h: "x" }, series: [{ id: "s", y: null }, { y: range("lab1", 5, 1, 2, 1), marker: "star" }] },
  ];
  damaged.tables = [
    ...(damaged.tables as unknown[]),
    { id: "tb2", sheetId: "lab1", name: "Kalibrierung", area: { r0: 3, c0: 1, r1: 9, c1: 2 }, columns: [], totals: true },
    { id: "tb3", sheetId: "lab2", name: "A1", area: { r0: 5, c0: 5, r1: 5, c1: 7 }, columns: [{ id: "q" }], totals: true, filters: { nope: { kind: "text", op: "contains", text: "x" }, q: { kind: "number", op: "huge" } }, sort: { column: "gone", dir: "asc" } },
  ];
  damaged.preview = { rows: [] };
  damaged.junk = { a: 1 };
  const wb = normalizeWorkbook(damaged, "de");
  const problemsFound = validate(wb);
  check("damaged: repaired into a valid workbook", problemsFound.length === 0, problemsFound);
  const s0 = wb.sheets[0];
  check("bad cell keys dropped", !("abc" in s0.cells) && !("-1,2" in s0.cells) && !("30000,1" in s0.cells) && !("5,300" in s0.cells));
  check("leading zeros: the cell moves to its proper key", s0.cells["3,4"]?.v === "leading zeros", s0.cells["3,4"]);
  check("formula without =", s0.cells["12,0"]?.f === "SUM(B3:B8)", s0.cells["12,0"]);
  check("null value: cell dropped", !("12,1" in s0.cells));
  check("style repaired", sameJson(s0.cells["12,2"], { v: "x", s: { fill: "green", size: 96, border: { left: "thin" } } }), s0.cells["12,2"]);
  check("empty text: cell dropped", !("12,3" in s0.cells));
  check("bare number becomes a cell", s0.cells["12,4"]?.v === 7);
  check("object value and number note dropped", !("12,5" in s0.cells));
  check("size grows to the cells", s0.size.rows >= 251 && s0.size.cols >= 41, s0.size);
  check("cols repaired", sameJson(s0.cols, { "0": { w: 130 }, "3": { w: 12 }, "4": { hidden: true } }), s0.cols);
  check("freeze clamped", s0.freeze.rows > 0 && s0.freeze.rows < s0.size.rows && s0.freeze.cols === 0, s0.freeze);
  check("duplicate sheet name numbered", wb.sheets[1].name === "Kalibrierung (2)", wb.sheets.map((s) => s.name));
  check("duplicate sheet id replaced", wb.sheets[2].id !== "lab1" && wb.sheets[2].name === "BadName", wb.sheets[2]);
  check("unusable size repaired", wb.sheets[2].size.rows === 1 && wb.sheets[2].size.cols === MAX_COLS, wb.sheets[2].size);
  check("nameless sheet gets a name", wb.sheets[3].name === "Blatt 4" && sameJson(wb.sheets[3].cells, {}), wb.sheets[3]);
  check("chart on a missing sheet dropped", !wb.charts.some((c) => c.id === "ch2"));
  const dup = wb.charts[1];
  check("duplicate chart id replaced", wb.charts.length === 2 && dup.id !== "ch1" && dup.kind === "pie", wb.charts.map((c) => c.id));
  check("chart anchor and size clamped", dup.at.dx === 0 && dup.size.w === 4000 && dup.size.h === 300, dup);
  check("series without values dropped; the other repaired", dup.series.length === 1 && dup.series[0].marker === "none" && dup.series[0].y.r0 === 2 && dup.series[0].y.r1 === 5, dup.series);
  check("sheet grows to the chart", s0.size.rows >= 501, s0.size);
  check("overlapping table dropped", !wb.tables.some((t) => t.id === "tb2"), wb.tables.map((t) => t.id));
  const t3 = wb.tables.find((t) => t.id === "tb3");
  check("table name repaired", t3?.name === "Tabelle1", t3?.name);
  check("table columns fitted to the area", t3?.columns.length === 3 && t3.columns[0].id === "q", t3?.columns);
  check("one-row table has no totals", t3?.totals === false);
  check("filters of unknown columns and bad filters dropped", sameJson(t3?.filters, {}), t3?.filters);
  check("sort of a missing column dropped", t3?.sort === null);
  check("deterministic", sameJson(normalizeWorkbook(clone(damaged), "de"), wb));
  check("normalized result is stable", normalizeWorkbook(wb, "de") === wb);
  // A duration (36:00, FORM-1) stays one when the spreadsheet is opened again; a stray flag goes.
  const times = clone(base) as unknown as { sheets: { cells: Record<string, unknown> }[] };
  times.sheets[0].cells["20,0"] = { v: 1.5, s: { fmt: { kind: "time", seconds: false, duration: true } } };
  times.sheets[0].cells["21,0"] = { v: 1.5, s: { fmt: { kind: "time", seconds: true, duration: "yes" } } };
  const read = normalizeWorkbook(clone(times), "de").sheets[0].cells;
  check("duration kept when read again", sameJson([read["20,0"]?.s?.fmt, read["21,0"]?.s?.fmt], [{ kind: "time", seconds: false, duration: true }, { kind: "time", seconds: true }]), [read["20,0"], read["21,0"]]);
});

section("fuzz: random JSON never throws, always valid", () => {
  const atoms = [null, 0, -1, 1.5, 1e308, -0, "", "x", "Blatt 1", "__proto__", "s1", true, false, [], {}, "0,0", "=SUM(A1)", NaN, Infinity];
  const keys = ["v", "sheets", "charts", "tables", "id", "name", "cells", "cols", "rows", "freeze", "size", "f", "s", "note", "0,0", "1,1", "x", "y", "series", "area", "columns", "sheetId", "kind", "__proto__", "fmt", "at"];
  function garbage(depth: number): unknown {
    const r = rand();
    if (depth <= 0 || r < 0.35) return pickOne(atoms);
    if (r < 0.65) return Array.from({ length: ri(4) }, () => garbage(depth - 1));
    const o: Record<string, unknown> = {};
    for (let i = ri(5); i > 0; i--) o[pickOne(keys)] = garbage(depth - 1);
    return o;
  }
  let bad = 0;
  for (let i = 0; i < 3000; i++) {
    const raw = garbage(5);
    let wb: Workbook;
    try {
      wb = normalizeWorkbook(raw, i % 2 ? "de" : "en");
    } catch (e) {
      bad++;
      if (bad < 4) check("fuzz: no throw", false, String(e));
      continue;
    }
    const p = validate(wb);
    if (p.length) {
      bad++;
      if (bad < 4) check("fuzz: valid", false, { raw, p });
    }
    if (isUnreadableWorkbook(wb)) {
      bad++;
      if (bad < 4) check("fuzz: never needs the unreadable fallback", false, raw);
    }
  }
  check("fuzz: 3000 random values", bad === 0, `${bad} bad`);
});

section("fuzz: damaged workbooks never throw, always valid", () => {
  const replacements = [null, undefined, -5, 3.7, 1e12, "", "x", "Kalibrierung", "lab2", [], {}, { v: 1 }, [1, 2], true, "=A1", "1,1"];
  /** Replace one random value somewhere inside `x` (a deep copy). */
  function damage(x: unknown, depth = 0): unknown {
    if (typeof x !== "object" || x === null) return pickOne(replacements);
    const copy: Record<string, unknown> | unknown[] = Array.isArray(x) ? [...x] : { ...(x as Record<string, unknown>) };
    const ks = Object.keys(copy);
    if (!ks.length || rand() < 0.15 || depth > 8) return pickOne(replacements);
    const k = pickOne(ks);
    (copy as Record<string, unknown>)[k] = rand() < 0.1 ? undefined : damage((copy as Record<string, unknown>)[k], depth + 1);
    // An extra key; "__proto__" as JSON.parse makes it (an own property, not the prototype).
    if (rand() < 0.1) Object.defineProperty(copy, pickOne(["extra", "0,0", "id", "__proto__"]), { value: pickOne(replacements), enumerable: true, writable: true, configurable: true });
    return copy;
  }
  let bad = 0;
  let changed = 0;
  for (let i = 0; i < 3000; i++) {
    let raw: unknown = labWorkbook();
    for (let n = 1 + ri(4); n > 0; n--) raw = damage(raw);
    let wb: Workbook;
    try {
      wb = normalizeWorkbook(raw, "de");
    } catch (e) {
      bad++;
      if (bad < 4) check("damage fuzz: no throw", false, String(e));
      continue;
    }
    const p = validate(wb);
    if (p.length) {
      bad++;
      if (bad < 4) check("damage fuzz: valid", false, { p, raw: JSON.stringify(raw).slice(0, 300) });
      continue;
    }
    if (normalizeWorkbook(wb, "de") !== wb) {
      bad++;
      if (bad < 4) check("damage fuzz: normalizing again changes nothing", false);
    }
    if (wb.sheets.length > 1) changed++;
  }
  check("damage fuzz: 3000 damaged workbooks", bad === 0, `${bad} bad`);
  check("damage fuzz: many keep their sheets", changed > 1200, changed);
});

// ----------------------------------------------------------------------------------------------
// Search text and previews

section("workbookPlainText", () => {
  const wb = labWorkbook();
  const calc = createCalc(wb, { locale: "de" });
  const text = workbookPlainText(wb, calc, "de");
  for (const word of ["Kalibrierung", "Konzentration", "Extinktion", "bei 595 nm", "Proben", "P1", "Kalibriergerade", "Konzentration (mg/L)", "steil"]) check(`plain text has ${word}`, text.includes(word), text);
  check("plain text: no numbers", !/0[.,]106/.test(text), text);
  check("plain text: each phrase once", text.split("\n").filter((l) => l === "Kalibrierung").length === 1, text);
  const big = newWorkbook("de");
  const cells: Record<string, Cell> = {};
  for (let r = 0; r < 5000; r++) cells[`${r},0`] = { v: `Probe Nummer ${r} mit einem längeren Text` };
  const bigWb: Workbook = { ...big, sheets: [{ ...big.sheets[0], cells, size: { rows: 5000, cols: 26 } }] };
  const t0 = performance.now();
  const bigText = workbookPlainText(bigWb, createCalc(bigWb), "de");
  check("plain text: capped at 20000 characters", bigText.length <= 20000 && bigText.length > 15000, bigText.length);
  check("plain text: quick for 5000 rows", performance.now() - t0 < 1000, performance.now() - t0);
});

section("workbookPreview", () => {
  const wb = labWorkbook();
  const calc = createCalc(wb, { locale: "de" });
  const p = workbookPreview(wb, calc, "de");
  check("preview: counts", p.charts === 1 && p.tables === 1, p);
  check("preview: starts at A1 with the title", p.rows[0]?.[0] === "Kalibrierung", p.rows);
  // (The engine puts a narrow no-break space before units.)
  check("preview: German number format with unit", p.rows[2]?.[0]?.replace(/\s/g, " ") === "0,0 mg/L" && p.rows[3]?.[1] === "0,106", p.rows);
  check("preview: at most 10 rows and 6 columns", p.rows.length <= 10 && p.rows.every((r) => r.length <= 6));
  check("preview: empty columns at the end trimmed", p.rows[0].length === 2, p.rows[0]);
  const look = p.look ?? [];
  check("preview: title bold", previewLook(look[0]?.[0]).bold);
  check("preview: numbers right", previewLook(look[3]?.[1]).align === "right" && previewLook(look[1]?.[0]).align === "left");
  check("preview: table header", previewLook(look[1]?.[0]).part === "header" && previewLook(look[1]?.[0]).tableColor === "blue", previewLook(look[1]?.[0]));
  check("preview: banded rows", previewLook(look[2]?.[0]).part === "row" && previewLook(look[3]?.[0]).part === "band", [previewLook(look[2]?.[0]), previewLook(look[3]?.[0])]);
  check("preview: fill colour", previewLook(look[9]?.[1]).fill === "green", previewLook(look[9]?.[1]));
  check("preview: widths", sameJson(p.widths, [130, 110]), p.widths);
  check("preview: chart points", p.chart?.kind === "scatter" && p.chart.pts.length === 12 && p.chart.pts[0] === 0 && p.chart.pts[10] === 100, p.chart);
  check("preview: linear trendline", p.chart?.fit?.length === 4 && p.chart.fit[0] === 0 && p.chart.fit[2] === 100 && Math.abs(p.chart.fit[3] - 100) <= 1, p.chart?.fit);
  check("preview: small", JSON.stringify(p).length < 3000, JSON.stringify(p).length);
  const english = workbookPreview(wb, calc, "en");
  check("preview: English number format", english.rows[3]?.[1] === "0.106", english.rows[3]);
  const blank = newWorkbook("de");
  const bp = workbookPreview(blank, createCalc(blank), "de");
  check("preview: blank workbook", bp.rows.length === 0 && bp.charts === 0 && !bp.look && !bp.chart, bp);
  // Data starting further down and right.
  const off = newWorkbook("de");
  const offWb: Workbook = { ...off, sheets: [{ ...off.sheets[0], cells: { "4,2": { v: "Start" }, "5,3": { v: 2 } } }] };
  const op = workbookPreview(offWb, createCalc(offWb), "de");
  check("preview: from the first used cell", op.rows[0]?.[0] === "Start" && op.rows[1]?.[1] === "2", op.rows);
  // Hidden rows and columns are skipped.
  const hid: Workbook = { ...offWb, sheets: [{ ...offWb.sheets[0], rows: { "5": { hidden: true } } }] };
  check("preview: hidden rows skipped", workbookPreview(hid, createCalc(hid), "de").rows.length === 1);
});

section("readSheetPreview", () => {
  const wb = labWorkbook();
  const p = workbookPreview(wb, createCalc(wb), "de");
  check("read: round trip", sameJson(readSheetPreview(clone(p)), p), readSheetPreview(clone(p)));
  check("read: nothing", readSheetPreview(null) === null && readSheetPreview({}) === null && readSheetPreview("x") === null);
  const weird = readSheetPreview({ rows: [["a", 5, null], "x", [["deep"]]], charts: -3, tables: "2", look: [[1e9, "x"]], widths: [5, 900, "w"], chart: { kind: "bogus", pts: [1, 2, 3], fit: [1, 2] } });
  check(
    "read: odd values made safe",
    !!weird &&
      sameJson(weird.rows, [["a", "", ""], [], [""]]) &&
      weird.charts === 0 &&
      weird.tables === 0 &&
      sameJson(weird.widths, [20, 400, 100]) &&
      weird.chart?.kind === "column" &&
      weird.chart.pts.length === 2 &&
      weird.chart.fit === undefined,
    weird,
  );
  const tooMany = readSheetPreview({ rows: Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => "x".repeat(500))), charts: 1, tables: 0 });
  check("read: capped", tooMany!.rows.length === 10 && tooMany!.rows[0].length === 6 && tooMany!.rows[0][0].length <= 40);
});

// ----------------------------------------------------------------------------------------------
// Merging

section("command palette: new pages from the query", () => {
  const sheet = (q: string) => newPageFor("sheet", q, "Neue Tabelle", "kalibrierung diagramm chart");
  const same = (a: { rank: number; title: string }, rank: number, title: string) => a.rank === rank && a.title === title;
  check("palette: 'Tabelle' makes a spreadsheet without a name, first", same(sheet("Tabelle"), 2, ""), sheet("Tabelle"));
  check("palette: 'neue Tabelle' too", same(sheet("neue Tabelle"), 2, ""), sheet("neue Tabelle"));
  check("palette: 'excel' and 'Tabellen' too", same(sheet("excel"), 2, "") && same(sheet("Tabellen"), 2, ""));
  check("palette: 'Tabelle Titration' names it Titration", same(sheet("Tabelle Titration"), 2, "Titration"), sheet("Tabelle Titration"));
  check("palette: 'neue Tabelle Titration' too", same(sheet("neue Tabelle Titration"), 2, "Titration"), sheet("neue Tabelle Titration"));
  check("palette: 'tab' on its way: no name, first among new pages", same(sheet("tab"), 1, ""), sheet("tab"));
  check("palette: a related word keeps the name", same(sheet("Kalibrierung"), 1, "Kalibrierung"), sheet("Kalibrierung"));
  check("palette: anything else is the plain fallback", same(sheet("Mitochondrien"), 0, "Mitochondrien") && same(sheet("Tabellenbuch"), 0, "Tabellenbuch"));
  check("palette: one letter is no kind", same(sheet("t"), 0, "t"));
  check("palette: empty query", same(sheet(""), 0, ""));
  check("palette: notes", same(newPageFor("note", "Notiz", "Neue Notiz"), 2, "") && same(newPageFor("note", "Mitochondrien", "Neue Notiz"), 0, "Mitochondrien"));
  check("palette: presentations", same(newPageFor("deck", "Präsentation Zellbiologie", "Neue Präsentation"), 2, "Zellbiologie"));
  check("palette: English", same(newPageFor("sheet", "New spreadsheet", "New spreadsheet"), 2, "") && same(newPageFor("sheet", "spreadsheet Lab 3", "New spreadsheet"), 2, "Lab 3"));
  check("palette: 'Tabelle' doesn't make a note", newPageFor("note", "Tabelle", "Neue Notiz").rank === 0);
});

const setCell = (wb: Workbook, sheetId: string, key: string, cell: Cell | undefined): Workbook => ({
  ...wb,
  sheets: wb.sheets.map((s) => {
    if (s.id !== sheetId) return s;
    const cells = { ...s.cells };
    if (cell) cells[key] = cell;
    else delete cells[key];
    return { ...s, cells };
  }),
});
const cellOf = (wb: Workbook, sheetId: string, key: string) => wb.sheets.find((s) => s.id === sheetId)?.cells[key];
const updateSheet = (wb: Workbook, id: string, f: (s: Sheet) => Sheet): Workbook => ({ ...wb, sheets: wb.sheets.map((s) => (s.id === id ? f(s) : s)) });

section("merge: cells", () => {
  const base = labWorkbook();
  const mine = setCell(base, "lab1", "2,1", { v: 0.003, s: base.sheets[0].cells["2,1"].s });
  const theirs = clone(setCell(base, "lab1", "3,1", { v: 0.107, s: base.sheets[0].cells["3,1"].s }));
  const m = mergeWorkbooks(base, mine, theirs);
  check("different cells: both kept", cellOf(m, "lab1", "2,1")?.v === 0.003 && cellOf(m, "lab1", "3,1")?.v === 0.107);
  check("different cells: valid", validate(m).length === 0, validate(m));

  const theirs2 = clone(setCell(base, "lab1", "2,1", { v: 9 }));
  const m2 = mergeWorkbooks(base, mine, theirs2);
  check("same cell: ours wins", cellOf(m2, "lab1", "2,1")?.v === 0.003, cellOf(m2, "lab1", "2,1"));

  // I type a value, they colour the same cell: both.
  const theirs3 = clone(setCell(base, "lab1", "2,1", { v: 0.002, s: { ...base.sheets[0].cells["2,1"].s, fill: "yellow" } }));
  const m3 = mergeWorkbooks(base, mine, theirs3);
  check("same cell, different parts: value mine, look theirs", cellOf(m3, "lab1", "2,1")?.v === 0.003 && cellOf(m3, "lab1", "2,1")?.s?.fill === "yellow", cellOf(m3, "lab1", "2,1"));
  // Notes too.
  const theirs4 = clone(setCell(base, "lab1", "1,1", { ...base.sheets[0].cells["1,1"], note: "bei 600 nm" }));
  const mine4 = setCell(base, "lab1", "1,1", { ...base.sheets[0].cells["1,1"], v: "Absorbance" });
  const m4 = mergeWorkbooks(base, mine4, theirs4);
  check("same cell: my value, their note", cellOf(m4, "lab1", "1,1")?.v === "Absorbance" && cellOf(m4, "lab1", "1,1")?.note === "bei 600 nm", cellOf(m4, "lab1", "1,1"));

  // Deleting.
  const theirsDel = clone(setCell(base, "lab1", "4,1", undefined));
  check("they cleared a cell I didn't touch: gone", cellOf(mergeWorkbooks(base, mine, theirsDel), "lab1", "4,1") === undefined);
  const mineEdit = setCell(base, "lab1", "4,1", { v: 1 });
  check("they cleared a cell I changed: mine stays", cellOf(mergeWorkbooks(base, mineEdit, theirsDel), "lab1", "4,1")?.v === 1);
  const mineDel = setCell(base, "lab1", "4,1", undefined);
  const theirsEdit = clone(setCell(base, "lab1", "4,1", { v: 2 }));
  check("I cleared a cell they changed: cleared (ours wins)", cellOf(mergeWorkbooks(base, mineDel, theirsEdit), "lab1", "4,1") === undefined);
  // New cells on both sides.
  const m5 = mergeWorkbooks(base, setCell(base, "lab2", "5,5", { v: "mine" }), clone(setCell(base, "lab2", "6,6", { v: "theirs" })));
  check("new cells on both sides", cellOf(m5, "lab2", "5,5")?.v === "mine" && cellOf(m5, "lab2", "6,6")?.v === "theirs");
  // Shortcuts.
  check("nothing changed by me: theirs", mergeWorkbooks(base, base, theirs) === theirs);
  check("nothing changed by them: mine", mergeWorkbooks(base, mine, base) === mine);
  check("theirs equals mine", sameJson(mergeWorkbooks(base, mine, clone(mine)), mine));
  // Formulas count as content.
  const mineF = setCell(base, "lab1", "9,1", { f: "INTERCEPT(B3:B8,A3:A8)", s: base.sheets[0].cells["9,1"].s });
  const m6 = mergeWorkbooks(base, mineF, theirs);
  check("formula kept", cellOf(m6, "lab1", "9,1")?.f === "INTERCEPT(B3:B8,A3:A8)" && cellOf(m6, "lab1", "3,1")?.v === 0.107);
});

section("merge: sheets", () => {
  const base = labWorkbook();
  const blank = (id: string, name: string): Sheet => ({ id, name, cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } });
  const mine: Workbook = { ...base, sheets: [...base.sheets, blank("m3", "Meins")] };
  const theirs: Workbook = clone({ ...base, sheets: [...base.sheets, blank("t3", "Deins")] });
  const m = mergeWorkbooks(base, mine, theirs);
  check("sheets added on both sides: both kept", m.sheets.map((s) => s.id).join() === "lab1,lab2,t3,m3" || m.sheets.map((s) => s.id).join() === "lab1,lab2,m3,t3", m.sheets.map((s) => s.id));
  // Same name added on both sides.
  const theirsSame: Workbook = clone({ ...base, sheets: [...base.sheets, blank("t3", "Meins")] });
  const ms = mergeWorkbooks(base, mine, theirsSame);
  check("same new name on both sides: numbered", ms.sheets.filter((s) => /^Meins/.test(s.name)).length === 2 && validate(ms).length === 0, ms.sheets.map((s) => s.name));
  // Delete.
  const theirsDel: Workbook = clone({ ...base, sheets: [base.sheets[0]], charts: base.charts, tables: base.tables });
  const mineEdits = setCell(base, "lab2", "3,3", { v: "lost?" });
  const md = mergeWorkbooks(base, mineEdits, theirsDel);
  check("sheet deleted by them stays deleted (even though I edited it)", md.sheets.length === 1 && md.sheets[0].id === "lab1", md.sheets.map((s) => s.id));
  const mineDel: Workbook = { ...base, sheets: [base.sheets[0]] };
  const md2 = mergeWorkbooks(base, mineDel, clone(setCell(base, "lab2", "1,1", { v: 5 })));
  check("sheet deleted by me stays deleted", md2.sheets.length === 1);
  // Chart on a sheet they deleted goes too.
  const mineChart: Workbook = { ...base, charts: [...base.charts, { ...base.charts[0], id: "ch9", sheetId: "lab2", x: null, series: [series("z", range("lab2", 1, 1, 3, 1))] }] };
  const theirsDel2: Workbook = clone({ ...base, sheets: [base.sheets[0]] });
  const mc = mergeWorkbooks(base, mineChart, theirsDel2);
  check("my chart on their deleted sheet: dropped, workbook valid", !mc.charts.some((c) => c.id === "ch9") && validate(mc).length === 0, validate(mc));
  // Both delete each other's sheets: one is left.
  const both = mergeWorkbooks(base, { ...base, sheets: [base.sheets[1]], charts: [], tables: [] }, clone({ ...base, sheets: [base.sheets[0]] }));
  check("both deleted the other's sheet: one left, valid", both.sheets.length >= 1 && validate(both).length === 0, validate(both));
  // Renames.
  const mineRen = updateSheet(base, "lab2", (s) => ({ ...s, name: "Messwerte" }));
  const theirsCells = clone(setCell(base, "lab2", "2,0", { v: "P2" }));
  const mr = mergeWorkbooks(base, mineRen, theirsCells);
  check("I rename, they type: both", mr.sheets[1].name === "Messwerte" && cellOf(mr, "lab2", "2,0")?.v === "P2", mr.sheets[1]);
  const theirsRen = clone(updateSheet(base, "lab2", (s) => ({ ...s, name: "Daten" })));
  check("both rename: mine", mergeWorkbooks(base, mineRen, theirsRen).sheets[1].name === "Messwerte");
  check("they rename: theirs", mergeWorkbooks(base, setCell(base, "lab1", "0,5", { v: 1 }), theirsRen).sheets[1].name === "Daten");
  // My rename clashes with their rename of the other sheet.
  const theirsClash = clone(updateSheet(base, "lab1", (s) => ({ ...s, name: "Messwerte" })));
  const mClash = mergeWorkbooks(base, mineRen, theirsClash);
  check("rename clash: unique names", validate(mClash).length === 0 && new Set(mClash.sheets.map((s) => s.name.toLowerCase())).size === 2, mClash.sheets.map((s) => s.name));
  // Reorder.
  const mineOrder: Workbook = { ...base, sheets: [base.sheets[1], base.sheets[0]] };
  const mo = mergeWorkbooks(base, mineOrder, theirs);
  const ids = mo.sheets.map((s) => s.id);
  // Their new sheet follows the sheet it followed on their side (lab2).
  check("I reorder, they add: my order, their sheet kept", ids.join() === "lab2,t3,lab1", ids);
  // Freeze, widths.
  const mineFreeze = updateSheet(base, "lab1", (s) => ({ ...s, freeze: { rows: 0, cols: 1 }, cols: { ...s.cols, "0": { w: 200 } } }));
  const theirsWidth = clone(updateSheet(base, "lab1", (s) => ({ ...s, cols: { ...s.cols, "1": { w: 50 }, "5": { hidden: true } } })));
  const mf = mergeWorkbooks(base, mineFreeze, theirsWidth);
  const s0 = mf.sheets[0];
  check("freeze mine, widths per column", sameJson(s0.freeze, { rows: 0, cols: 1 }) && s0.cols["0"]?.w === 200 && s0.cols["1"]?.w === 50 && s0.cols["5"]?.hidden === true, s0);
});

section("merge: size growth", () => {
  const base = labWorkbook();
  const mine = updateSheet(setCell(base, "lab1", "250,2", { v: "unten" }), "lab1", (s) => ({ ...s, size: { rows: 252, cols: 26 } }));
  const theirs = clone(updateSheet(setCell(base, "lab1", "3,40", { v: "rechts" }), "lab1", (s) => ({ ...s, size: { rows: 200, cols: 42 } })));
  const m = mergeWorkbooks(base, mine, theirs);
  const s0 = m.sheets[0];
  check("both grew: the larger in each direction", s0.size.rows === 252 && s0.size.cols === 42, s0.size);
  check("both far cells kept", s0.cells["250,2"]?.v === "unten" && s0.cells["3,40"]?.v === "rechts");
  // Both grew rows differently.
  const theirs2 = clone(updateSheet(setCell(base, "lab1", "300,0", { v: 1 }), "lab1", (s) => ({ ...s, size: { rows: 302, cols: 26 } })));
  check("rows: the larger", mergeWorkbooks(base, mine, theirs2).sheets[0].size.rows === 302);
  // Only they shrank (deleted rows), I typed in a row they removed: the sheet still covers my cell.
  const theirsShrink = clone(updateSheet(base, "lab1", (s) => ({ ...s, size: { rows: 20, cols: 26 } })));
  const mineFar = setCell(base, "lab1", "150,0", { v: "da" });
  const ms = mergeWorkbooks(base, mineFar, theirsShrink);
  check("size covers every cell", ms.sheets[0].size.rows >= 151 && validate(ms).length === 0, ms.sheets[0].size);
});

section("merge: charts", () => {
  const base = labWorkbook();
  const c0 = base.charts[0];
  const moved: Workbook = { ...base, charts: [{ ...c0, at: { row: 12, col: 4, dx: 0, dy: 0 } }] };
  const retitled: Workbook = clone({ ...base, charts: [{ ...c0, title: "Bradford" }] });
  const m = mergeWorkbooks(base, moved, retitled);
  check("I move, they retitle: both", m.charts[0].at.row === 12 && m.charts[0].title === "Bradford", m.charts[0]);
  const retitled2: Workbook = { ...base, charts: [{ ...c0, title: "Mein Titel" }] };
  check("both retitle: mine", mergeWorkbooks(base, retitled2, retitled).charts[0].title === "Mein Titel");
  // Series: they add a trendline intercept, I change the colour.
  const s = c0.series[0];
  const mineColor: Workbook = { ...base, charts: [{ ...c0, series: [{ ...s, color: "red" }] }] };
  const theirsTrend: Workbook = clone({ ...base, charts: [{ ...c0, series: [{ ...s, trendline: { ...s.trendline!, intercept: 0 } }] }] });
  const ms = mergeWorkbooks(base, mineColor, theirsTrend);
  check("series fields from both", ms.charts[0].series[0].color === "red" && ms.charts[0].series[0].trendline?.intercept === 0, ms.charts[0].series[0]);
  // Axes per field.
  const mineAxis: Workbook = { ...base, charts: [{ ...c0, yAxis: { ...c0.yAxis, log: true } }] };
  const theirsAxis: Workbook = clone({ ...base, charts: [{ ...c0, yAxis: { ...c0.yAxis, title: "OD600" } }] });
  const ma = mergeWorkbooks(base, mineAxis, theirsAxis);
  check("axis fields from both", ma.charts[0].yAxis.log && ma.charts[0].yAxis.title === "OD600", ma.charts[0].yAxis);
  // Add and delete.
  const added: Workbook = { ...base, charts: [...base.charts, { ...c0, id: "new1" }] };
  const theirsAdded: Workbook = clone({ ...base, charts: [...base.charts, { ...c0, id: "new2", title: "Ihrs" }] });
  const md = mergeWorkbooks(base, added, theirsAdded);
  check("charts added on both sides", md.charts.length === 3 && md.charts.some((c) => c.id === "new1") && md.charts.some((c) => c.id === "new2"), md.charts.map((c) => c.id));
  const deleted: Workbook = clone({ ...base, charts: [] });
  check("chart deleted by them, moved by me: gone", mergeWorkbooks(base, moved, deleted).charts.length === 0);
  check("chart deleted by me, retitled by them: gone", mergeWorkbooks(base, { ...base, charts: [] }, retitled).charts.length === 0);
});

section("merge: smart tables", () => {
  const base = labWorkbook();
  const t0 = base.tables[0];
  const mineGrow: Workbook = { ...base, tables: [{ ...t0, area: { ...t0.area, r1: 8 } }] };
  const theirsStyle: Workbook = clone({ ...base, tables: [{ ...t0, style: "green", name: "Bradford" }] });
  const m = mergeWorkbooks(base, mineGrow, theirsStyle);
  check("I grow, they restyle: both", m.tables[0].area.r1 === 8 && m.tables[0].style === "green" && m.tables[0].name === "Bradford", m.tables[0]);
  // I add rows (area), they add a column (area + columns): the shape stays one piece.
  const theirsCol: Workbook = clone({ ...base, tables: [{ ...t0, area: { ...t0.area, c1: 2 }, columns: [...t0.columns, { id: "k3", total: "none" }] }] });
  const mc = mergeWorkbooks(base, mineGrow, theirsCol);
  check("shape: mine as a whole, columns fit the area", mc.tables[0].area.r1 === 8 && mc.tables[0].area.c1 === 1 && mc.tables[0].columns.length === 2 && validate(mc).length === 0, mc.tables[0]);
  check("shape: theirs when I didn't change it", mergeWorkbooks(base, setCell(base, "lab2", "9,9", { v: 1 }), theirsCol).tables[0].columns.length === 3);
  // Filter of a column that is gone after the merge.
  const mineFilter: Workbook = { ...base, tables: [{ ...t0, filters: { ...t0.filters, k1: { kind: "values", values: ["2"] } } }] };
  const theirsCols: Workbook = clone({ ...base, tables: [{ ...t0, columns: [{ id: "n1", total: "none" }, { id: "n2", total: "sum" }], filters: {}, sort: null }] });
  const mf = mergeWorkbooks(base, mineFilter, theirsCols);
  check("filters of columns that are gone dropped", validate(mf).length === 0 && sameJson(mf.tables[0].filters, {}), mf.tables[0]);
  // Two tables made at the same place at once: mine kept.
  const mk = (id: string, name: string): TableSpec => ({ ...t0, id, name, sheetId: "lab2", area: { r0: 0, c0: 0, r1: 1, c1: 1 }, columns: [{ id: `${id}a`, total: "none" }, { id: `${id}b`, total: "none" }], filters: {}, sort: null });
  const mineT: Workbook = { ...base, tables: [...base.tables, mk("mt", "Proben")] };
  const theirsT: Workbook = clone({ ...base, tables: [...base.tables, mk("tt", "Proben")] });
  const mt = mergeWorkbooks(base, mineT, theirsT);
  check("overlapping new tables: mine kept", mt.tables.some((t) => t.id === "mt") && !mt.tables.some((t) => t.id === "tt") && validate(mt).length === 0, mt.tables.map((t) => t.id));
  // Same new name on different places: unique names.
  const theirsT2: Workbook = clone({ ...base, tables: [...base.tables, { ...mk("tt", "Proben"), area: { r0: 10, c0: 0, r1: 11, c1: 1 } }] });
  const mt2 = mergeWorkbooks(base, mineT, theirsT2);
  check("same new table name: unique", mt2.tables.length === 3 && validate(mt2).length === 0, mt2.tables.map((t) => t.name));
  // Deleted on one side.
  check("table deleted by them stays deleted", mergeWorkbooks(base, mineGrow, clone({ ...base, tables: [] })).tables.length === 0);
});

section("merge: undo while others edit", () => {
  // The store undoes a step with mergeWorkbooks(after, before, now).
  const before = labWorkbook();
  const after = setCell(before, "lab1", "2,1", { v: 99 });
  const now = clone(setCell(after, "lab1", "3,1", { v: 0.5 }));
  const undone = mergeWorkbooks(after, before, now);
  check("undo puts back my cell, keeps theirs", cellOf(undone, "lab1", "2,1")?.v === 0.002 && cellOf(undone, "lab1", "3,1")?.v === 0.5);
  // Undo of adding a sheet that someone has since typed into: the sheet goes.
  const added: Workbook = { ...before, sheets: [...before.sheets, { ...before.sheets[1], id: "x", name: "Neu" }] };
  const typed = clone(setCell(added, "x", "0,0", { v: "da" }));
  check("undo of an added sheet", mergeWorkbooks(added, before, typed).sheets.length === 2);
  // Undo of deleting a sheet brings it back, their other edits stay.
  const deleted: Workbook = { ...before, sheets: [before.sheets[0]] };
  const theirs = clone(setCell(deleted, "lab1", "5,5", { v: 1 }));
  const back = mergeWorkbooks(deleted, before, theirs);
  check("undo of a deleted sheet", back.sheets.length === 2 && cellOf(back, "lab1", "5,5")?.v === 1, back.sheets.map((s) => s.id));
});

section("merge: two devices on the same empty page", () => {
  const empty = normalizeWorkbook({}, "de");
  const a = normalizeWorkbook({}, "de");
  const b = normalizeWorkbook({}, "de");
  const mine = setCell(a, "s1", "0,0", { v: "A" });
  const theirs = setCell(b, "s1", "1,0", { v: "B" });
  const m = mergeWorkbooks(empty, mine, clone(theirs));
  check("same empty page: both first edits kept", m.sheets.length === 1 && cellOf(m, "s1", "0,0")?.v === "A" && cellOf(m, "s1", "1,0")?.v === "B", m.sheets);
});

section("merge: random edits on both sides", () => {
  const COLORS2 = ["red", "green", "blue", "yellow"] as const;
  function edit(wb: Workbook, tag: string): Workbook {
    let next = wb;
    for (let n = 1 + ri(6); n > 0; n--) {
      const r = rand();
      const sheet = pickOne(next.sheets);
      if (r < 0.45) {
        const key = `${ri(12)},${ri(5)}`;
        const old = sheet.cells[key];
        const choice = rand();
        const cell: Cell | undefined = choice < 0.2 ? undefined : choice < 0.6 ? { ...old, v: `${tag}${ri(100)}`, f: undefined } : { ...old, s: { ...old?.s, fill: pickOne(COLORS2) } };
        if (cell && cell.f === undefined) delete cell.f;
        next = setCell(next, sheet.id, key, cell);
      } else if (r < 0.55 && next.sheets.length < 6) {
        const id = `${tag}${ri(1e6)}`;
        next = { ...next, sheets: [...next.sheets, { id, name: `${tag} ${ri(1000)}`, cells: { "0,0": { v: tag } }, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 50, cols: 10 } }] };
      } else if (r < 0.6 && next.sheets.length > 1) {
        const id = sheet.id;
        next = { ...next, sheets: next.sheets.filter((s) => s.id !== id), charts: next.charts.filter((c) => c.sheetId !== id), tables: next.tables.filter((t) => t.sheetId !== id) };
      } else if (r < 0.68) {
        const name = `${tag}-${ri(1000)}`;
        if (!next.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase())) next = updateSheet(next, sheet.id, (s) => ({ ...s, name }));
      } else if (r < 0.76) {
        next = updateSheet(next, sheet.id, (s) => ({ ...s, size: { rows: Math.min(MAX_ROWS, s.size.rows + ri(100)), cols: s.size.cols } }));
      } else if (r < 0.84 && next.charts.length) {
        const c = pickOne(next.charts);
        next = { ...next, charts: next.charts.map((x) => (x.id === c.id ? { ...x, title: `${tag} chart`, at: { ...x.at, row: ri(20) } } : x)) };
      } else if (r < 0.9) {
        next = { ...next, charts: [...next.charts, { ...labWorkbook().charts[0], id: `${tag}c${ri(1e6)}`, sheetId: sheet.id, x: null, series: [series(`${tag}s`, range(sheet.id, 0, 0, 5, 0))] }] };
      } else if (r < 0.95 && next.charts.length) {
        const c = pickOne(next.charts);
        next = { ...next, charts: next.charts.filter((x) => x.id !== c.id) };
      } else {
        const r0 = 20 + ri(30);
        const t: TableSpec = { ...labWorkbook().tables[0], id: `${tag}t${ri(1e6)}`, name: `${tag}T${ri(1e6)}`, sheetId: sheet.id, area: { r0, c0: 0, r1: r0 + 2, c1: 1 }, filters: {}, sort: null };
        next = { ...next, tables: [...next.tables, t] };
      }
    }
    return next;
  }
  let bad = 0;
  let checkedCells = 0;
  for (let i = 0; i < 1500; i++) {
    const base = edit(labWorkbook(), "b");
    const mine = edit(base, "m");
    const theirs = clone(edit(base, "t"));
    let merged: Workbook;
    try {
      merged = mergeWorkbooks(base, mine, theirs);
    } catch (e) {
      bad++;
      if (bad < 4) check("random merge: no throw", false, String(e));
      continue;
    }
    const p = validate(merged);
    if (p.length) {
      bad++;
      if (bad < 4) check("random merge: valid", false, p);
      continue;
    }
    // Every cell only one side changed (on a sheet that survived) has that side's content.
    for (const s of merged.sheets) {
      const b = base.sheets.find((x) => x.id === s.id);
      const m = mine.sheets.find((x) => x.id === s.id);
      const t = theirs.sheets.find((x) => x.id === s.id);
      if (!b || !m || !t) continue;
      for (const key of new Set([...Object.keys(m.cells), ...Object.keys(t.cells), ...Object.keys(b.cells)])) {
        const bc = b.cells[key];
        const mc = m.cells[key];
        const tc = t.cells[key];
        const got = s.cells[key];
        const mineChanged = !sameJson(mc, bc);
        const theirsChanged = !sameJson(tc, bc);
        let want: Cell | undefined;
        if (mineChanged && !theirsChanged) want = mc;
        else if (!mineChanged && theirsChanged) want = tc;
        else if (!mineChanged) want = bc;
        else continue;
        checkedCells++;
        if (!sameJson(got, want)) {
          bad++;
          if (bad < 4) check("random merge: one side's change survives", false, { key, got, want });
        }
      }
    }
    // Sheets added on one side survive (unless the other deleted... nothing: it is new).
    for (const s of [...mine.sheets, ...theirs.sheets]) {
      if (base.sheets.some((x) => x.id === s.id)) continue;
      if (!merged.sheets.some((x) => x.id === s.id)) {
        bad++;
        if (bad < 4) check("random merge: new sheets kept", false, s.id);
      }
    }
    // Sheets deleted on one side stay deleted.
    for (const s of base.sheets) {
      const gone = !mine.sheets.some((x) => x.id === s.id) || !theirs.sheets.some((x) => x.id === s.id);
      if (gone && merged.sheets.some((x) => x.id === s.id) && merged.sheets.length > 1) {
        bad++;
        if (bad < 4) check("random merge: deleted sheets stay deleted", false, s.id);
      }
    }
  }
  check("random merges: 1500 pairs", bad === 0, `${bad} bad`);
  check("random merges: cells were compared", checkedCells > 10000, checkedCells);
});

section("merge: speed", () => {
  const wb = newWorkbook("de");
  const cells: Record<string, Cell> = {};
  for (let r = 0; r < 5000; r++) for (let c = 0; c < 10; c++) cells[`${r},${c}`] = { v: r * c };
  const base: Workbook = { ...wb, sheets: [{ ...wb.sheets[0], cells, size: { rows: 5000, cols: 26 } }] };
  const mine = setCell(base, wb.sheets[0].id, "10,1", { v: -1 });
  const theirs = clone(setCell(base, wb.sheets[0].id, "20,1", { v: -2 }));
  const t0 = performance.now();
  const m = mergeWorkbooks(base, mine, theirs);
  const ms = performance.now() - t0;
  check("merge of 50,000 cells: correct", cellOf(m, wb.sheets[0].id, "10,1")?.v === -1 && cellOf(m, wb.sheets[0].id, "20,1")?.v === -2);
  check("merge of 50,000 cells: quick", ms < 1500, `${Math.round(ms)} ms`);
  const t1 = performance.now();
  normalizeWorkbook(clone(base), "de");
  check("normalize 50,000 cells: quick", performance.now() - t1 < 1500, `${Math.round(performance.now() - t1)} ms`);
});

// ----------------------------------------------------------------------------------------------
// Saving (src/components/sheet/saver.ts) against a stand-in server that behaves like save_sheet:
// two editors at once, offline with the draft on the device, refused saves, the background save.

/** localStorage for Node (drafts live there). */
const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
};

/**
 * Web Locks for Node, as browsers have them (navigator.locks): exclusive locks by name, held
 * while their callback runs, and query() listing them. A lock held here stands for an editor open
 * in another tab.
 */
class FakeLocks {
  held = new Set<string>();
  private waiting = new Map<string, (() => void)[]>();
  async request(name: string, a: unknown, b?: unknown): Promise<unknown> {
    const fn = (typeof a === "function" ? a : b) as (lock: unknown) => unknown;
    while (this.held.has(name)) await new Promise<void>((r) => this.waiting.set(name, [...(this.waiting.get(name) ?? []), r]));
    this.held.add(name);
    try {
      return await fn({ name, mode: "exclusive" });
    } finally {
      this.held.delete(name);
      const next = this.waiting.get(name)?.shift();
      next?.();
    }
  }
  async query() {
    return { held: [...this.held].map((name) => ({ name, mode: "exclusive", clientId: "tab" })), pending: [] };
  }
  /** Another tab's editor `writer` is open until the returned function is called. */
  holdFor(writer: string): () => void {
    let release = () => {};
    void this.request(`blob-sheet-editor:${writer}`, () => new Promise<void>((r) => (release = r)));
    return () => release();
  }
}
const fakeLocks = new FakeLocks();
Object.defineProperty(globalThis.navigator, "locks", { value: fakeLocks, configurable: true });

/** One page on the "server", saved like save_sheet (migration 0024) does. */
class FakeServer implements SaverApi {
  rev = 0;
  content: unknown;
  title: string;
  plain = "";
  saves = 0;
  calls = 0;
  loads = 0;
  /** save_sheet's pages.save_ids: each editor's newest save. */
  saveIds: string[] = [];
  /**
   * offline: nothing gets through. lost: the save lands but its answer doesn't come back (the
   * connection dropped on the way, the tab closed), once. error, denied: what the server says.
   */
  mode: "ok" | "offline" | "lost" | "error" | "denied" = "ok";
  /** Make each save take this long (ms), to type while one is on its way. */
  delay = 0;
  /** Make loading the page take this long (ms): the row is read after `loadAt` ms. */
  loadDelay = 0;
  loadAt = 0;
  constructor(wb: Workbook, title = "") {
    this.content = clone(wb);
    this.title = title;
  }
  async saveSheet(a: SaveArgs) {
    this.calls++;
    if (this.delay) await new Promise((r) => setTimeout(r, this.delay));
    if (this.mode === "offline") throw new TypeError("Failed to fetch");
    if (this.mode === "error") return { data: null, error: { message: "boom" }, status: 400 };
    if (this.mode === "denied") return { data: { ok: false, reason: "denied" }, error: null, status: 200 };
    // Measured as sent, UTF-8 (save_sheet's p_content is json).
    const json = JSON.stringify(a.p_content);
    if (new TextEncoder().encode(json).length > 5_000_000) return { data: { ok: false, reason: "too_big" }, error: null, status: 200 };
    if (a.p_rev !== this.rev) return { data: { ok: false, reason: "behind", rev: this.rev, content: clone(this.content), title: this.title }, error: null, status: 200 };
    this.content = JSON.parse(json);
    // The title only when this editor renamed it (p_base_title).
    if (a.p_title !== a.p_base_title) this.title = a.p_title.slice(0, 200);
    this.plain = a.p_plain;
    this.rev++;
    this.saves++;
    this.saveIds = [...this.saveIds.filter((x) => x !== a.p_last_save && x !== a.p_save_id), a.p_save_id].slice(-50);
    if (this.mode === "lost") {
      this.mode = "ok";
      throw new TypeError("Failed to fetch");
    }
    return { data: { ok: true, rev: this.rev, title: this.title }, error: null, status: 200 };
  }
  async loadRow() {
    this.loads++;
    if (this.mode === "offline") return null;
    if (!this.loadDelay) return { rev: this.rev, content: clone(this.content), title: this.title };
    await new Promise((r) => setTimeout(r, this.loadAt));
    const row = { rev: this.rev, content: clone(this.content), title: this.title };
    await new Promise((r) => setTimeout(r, this.loadDelay - this.loadAt));
    return row;
  }
  async landed(_pageId: string, saveId: string) {
    return this.mode === "offline" ? null : this.saveIds.includes(saveId);
  }
  cell(key: string, sheet = 0) {
    return (this.content as Workbook).sheets[sheet]?.cells[key];
  }
}

/** Every draft of a page in localStorage (the IndexedDB copies don't exist in Node). */
const localDrafts = (userId: string, pageId: string): SheetDraft[] =>
  [...memory.keys()]
    .filter((k) => k.startsWith(`blob-sheet-draft:${userId}:${pageId}:`))
    .map((k) => JSON.parse(memory.get(k)!) as SheetDraft)
    .sort((a, b) => a.at - b.at);
const draftOf = (userId: string, pageId: string) => localDrafts(userId, pageId).at(-1) ?? null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Log = { states: string[]; notices: (string | null)[]; titles: string[]; saved: number[]; restored: number; trouble: string[]; sizes: number[]; conflicts: SheetConflict[][] };

let pageCounter = 0;
function openEditor(server: FakeServer, pageId: string, opts: { userId?: string; readOnly?: boolean; opened?: { rev: number; content: unknown; title: string } } = {}) {
  // `opened`: what the page came with, when that isn't what the server has by now.
  const opened = opts.opened ?? { rev: server.rev, content: server.content, title: server.title };
  const wb = normalizeWorkbook(clone(opened.content), "de");
  const store = createSheetStore({ pageId, workbook: wb, locale: "de", readOnly: !!opts.readOnly });
  const log: Log = { states: [], notices: [], titles: [], saved: [], restored: 0, trouble: [], sizes: [], conflicts: [] };
  const saver = new SheetSaver({
    store,
    pageId,
    userId: opts.userId ?? "u1",
    locale: "de",
    rev: opened.rev,
    base: wb,
    title: opened.title,
    readOnly: !!opts.readOnly,
    api: server,
    on: {
      state: (x) => log.states.push(x),
      notice: (x) => log.notices.push(x),
      size: (x) => log.sizes.push(x),
      title: (x) => log.titles.push(x),
      saved: (x) => log.saved.push(x),
      restored: () => log.restored++,
      trouble: (x) => log.trouble.push(x),
      conflict: (x) => log.conflicts.push(x),
    },
  });
  let version = store.get().version;
  const off = store.subscribe(() => {
    const v = store.get().version;
    if (v === version) return;
    version = v;
    saver.changed();
  });
  return {
    store,
    saver,
    log,
    sheetId: store.get().sheetId,
    type: (row: number, col: number, text: string) => store.input({ row, col }, text),
    cell: (key: string) => store.get().workbook.sheets[0].cells[key],
    close: async () => {
      off();
      await saver.close();
    },
    /** The tab is gone at once (closed, crashed): no more saving, what is on the device stays. */
    kill: () => {
      off();
      saver.discard();
    },
  };
}

async function savingTests() {
  const page = () => `00000000-0000-4000-8000-${String(++pageCounter).padStart(12, "0")}`;

  // 1. One editor: typed cells reach the server with a preview and search text.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const a = openEditor(server, id);
    a.type(0, 0, "Konzentration");
    a.type(1, 0, "1,5");
    check("save: dirty after typing", a.saver.dirty() && a.saver.state === "pending", a.saver.state);
    await a.saver.flush();
    check("save: on the server", server.rev === 1 && server.cell("1,0")?.v === 1.5 && server.cell("0,0")?.v === "Konzentration", server.content);
    const stored = server.content as Workbook & { preview?: unknown };
    check("save: preview stored beside the workbook", !!readSheetPreview(stored.preview) && readSheetPreview(stored.preview)!.rows[0][0] === "Konzentration", stored.preview);
    check("save: preview dropped when read again", !("preview" in normalizeWorkbook(server.content, "de")));
    check("save: search text", server.plain.includes("Konzentration"), server.plain);
    check("save: saved and clean", a.saver.state === "saved" && !a.saver.dirty() && a.log.saved.join() === "1", a.log);
    check("save: no draft left behind", draftOf("u1", id) === null);
    // Two saves asked for at once: one request.
    a.type(2, 0, "2");
    const calls = server.calls;
    await Promise.all([a.saver.flush(), a.saver.flush()]);
    check("save: two flushes, one request", server.calls === calls + 1 && server.rev === 2, server.calls - calls);
    await a.close();
  }

  // 2. Two editors, different cells: both kept, everywhere.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const a = openEditor(server, id);
    const b = openEditor(server, id);
    a.type(0, 0, "von A");
    b.type(5, 1, "von B");
    await a.saver.flush();
    await b.saver.flush();
    check("together: B merged A's cell and saved", server.rev === 2 && server.cell("0,0")?.v === "von A" && server.cell("5,1")?.v === "von B", server.content);
    check("together: B shows A's cell", b.cell("0,0")?.v === "von A" && !b.saver.dirty());
    await a.saver.remote(2);
    check("together: A pulled B's cell", a.cell("5,1")?.v === "von B" && !a.saver.dirty(), a.store.get().workbook.sheets[0].cells);
    const loads = server.loads;
    await a.saver.remote(2);
    await a.saver.remote(1);
    check("together: an old announcement does nothing", server.loads === loads);
    // The same cell: whoever saves later wins (their change is "ours" when they merge).
    a.type(3, 3, "A sagt");
    b.type(3, 3, "B sagt");
    await a.saver.flush();
    await b.saver.flush();
    await a.saver.remote(server.rev);
    check("together: same cell, the later one wins everywhere", server.cell("3,3")?.v === "B sagt" && a.cell("3,3")?.v === "B sagt" && b.cell("3,3")?.v === "B sagt");
    // Title: renamed on A, cells on B.
    a.saver.setTitle("Kalibrierung");
    b.type(7, 0, "x");
    await a.saver.flush();
    await b.saver.flush();
    check("together: A's title survives B's save", server.title === "Kalibrierung" && b.log.titles.includes("Kalibrierung"), { title: server.title, titles: b.log.titles });
    // Typing while A's save is on its way: saved after it, nothing lost. (A catches up first, so its
    // save goes through at once instead of merging B's last save.)
    await a.saver.remote(server.rev);
    server.delay = 30;
    a.type(8, 0, "eins");
    const first = a.saver.flush();
    await new Promise((r) => setTimeout(r, 5));
    a.type(9, 0, "zwei");
    await first;
    check("together: typed during a save is still waiting", a.saver.dirty() && a.saver.state === "pending", a.saver.state);
    await a.saver.flush();
    server.delay = 0;
    check("together: both saved", server.cell("8,0")?.v === "eins" && server.cell("9,0")?.v === "zwei" && !a.saver.dirty());
    await a.close();
    await b.close();
  }

  // 3. Offline: kept on the device, put back on the next visit and merged with what changed meanwhile.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const a = openEditor(server, id);
    server.mode = "offline";
    a.type(0, 0, "offline getippt");
    await a.saver.flush();
    check("offline: state 'device'", a.saver.state === "device", a.log.states);
    const draft = draftOf("u1", id);
    check("offline: draft on the device", !!draft && draft.mine.sheets[0].cells["0,0"]?.v === "offline getippt" && draft.rev === 0, draft);
    // Typing in a cell when the app goes away: the draft has it, though it isn't entered yet.
    a.store.startEdit({ via: "cell", replace: true, text: "noch nicht bestätigt", at: { row: 6, col: 0 } });
    a.saver.keepDraft();
    check("offline: a cell being typed is in the draft", draftOf("u1", id)?.mine.sheets[0].cells["6,0"]?.v === "noch nicht bestätigt", draftOf("u1", id)?.mine.sheets[0].cells);
    a.store.cancelEdit();
    await a.close();
    check("offline: closing keeps the draft", draftOf("u1", id) !== null);
    reportOk();
    server.mode = "ok";
    // Someone else saved in the meantime.
    const b = openEditor(server, id, { userId: "u2" });
    b.type(4, 4, "von B");
    await b.saver.flush();
    await b.close();
    // Open again: the draft comes back on top of B's version.
    const a2 = openEditor(server, id);
    await a2.saver.restore();
    check("offline: restored", a2.log.restored === 1 && a2.cell("0,0")?.v === "offline getippt" && a2.cell("4,4")?.v === "von B", a2.store.get().workbook.sheets[0].cells);
    // (The cancelled edit is gone from the draft written when the editor closed.)
    check("offline: a cancelled edit isn't restored", a2.cell("6,0") === undefined, a2.cell("6,0"));
    await a2.saver.flush();
    check("offline: saved after restoring", server.cell("0,0")?.v === "offline getippt" && server.cell("4,4")?.v === "von B" && draftOf("u1", id) === null, server.content);
    // A draft that was saved already (it outlived its save) changes nothing.
    await a2.close();
    writeDraft("u1", { v: 1, pageId: id, rev: 0, base: newWorkbook("de"), mine: normalizeWorkbook(server.content, "de"), baseTitle: "", title: "", at: Date.now(), writer: "x" });
    const a3 = openEditor(server, id);
    await a3.saver.restore();
    check("offline: a stale draft is just cleared", a3.log.restored === 0 && draftOf("u1", id) === null && !a3.saver.dirty());
    await a3.close();
  }

  // 4. Refused saves.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const a = openEditor(server, id);
    server.mode = "denied";
    a.type(0, 0, "x");
    await a.saver.flush();
    // (Its own state: "Nicht gespeichert", not "Offline, versuche erneut".)
    check("denied: notice and the state 'refused'", a.log.notices.includes("denied") && a.saver.state === "refused", a.log);
    check("denied: draft kept", draftOf("u1", id) !== null);
    const calls = server.calls;
    a.type(0, 1, "y");
    await a.saver.flush();
    check("denied: no more tries", server.calls === calls);
    await a.close();
    check("denied: closing keeps what was typed since", draftOf("u1", id)?.mine.sheets[0].cells["0,1"]?.v === "y");
    for (const d of localDrafts("u1", id)) clearDraft("u1", id, d.writer);

    const id2 = page();
    const server2 = new FakeServer(newWorkbook("de"));
    const e = openEditor(server2, id2);
    server2.mode = "error";
    e.type(0, 0, "x");
    // (The failed save is logged; not here.)
    const logError = console.error;
    console.error = () => {};
    await e.saver.flush();
    console.error = logError;
    check("error: the state 'failed' (not offline), said once", e.saver.state === "failed" && e.log.trouble.join() === "failed", e.log);
    server2.mode = "ok";
    await e.saver.flush();
    check("error: works again", e.saver.state === "saved" && e.log.trouble.join() === "failed,recovered" && server2.cell("0,0")?.v === "x", e.log);
    await e.close();

    const id3 = page();
    const server3 = new FakeServer(newWorkbook("de"));
    const big = openEditor(server3, id3);
    const sheetId = big.store.get().sheetId;
    big.store.apply("big", (wb) => setCells(wb, sheetId, Array.from({ length: 170 }, (_, i) => ({ row: i, col: 0, cell: { v: "x".repeat(32000) } }))));
    await big.saver.flush();
    check("too big: refused before sending, the state 'tooBig'", big.log.notices.includes("tooBig") && server3.calls === 0 && big.saver.state === "tooBig", big.log);
    big.store.apply("smaller", (wb) => setCells(wb, sheetId, Array.from({ length: 160 }, (_, i) => ({ row: i, col: 0, cell: null }))));
    await big.saver.flush();
    check("too big: saves again once it fits", server3.rev === 1 && big.log.notices[big.log.notices.length - 1] === null && big.saver.state === "saved", big.log);
    await big.close();
  }

  // 5. Viewers never save.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const v = openEditor(server, id, { readOnly: true });
    v.saver.changed();
    await v.saver.flush();
    check("viewer: nothing sent", server.calls === 0 && v.saver.state === "saved");
    await v.close();
  }

  // 6. The background save of drafts whose editor is closed.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    const sheetId = base.sheets[0].id;
    // Typed offline in an editor that has closed since…
    writeDraft("u1", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, sheetId, "0,0", { v: "offline" }), baseTitle: "Messung", title: "Messung 2", at: Date.now(), writer: "closed" });
    // …while someone else saved.
    const other = openEditor(server, id, { userId: "u2" });
    other.type(2, 2, "online");
    await other.saver.flush();
    await other.close();
    // An editor open here, with a draft of its own (typed offline): that draft is left to it.
    const open = openEditor(server, id);
    server.mode = "offline";
    open.type(4, 4, "offen");
    await open.saver.flush();
    server.mode = "ok";
    const waiting = await waitingDrafts("u1", id);
    check("background: an open editor's draft isn't waiting to be taken", localDrafts("u1", id).length === 2 && waiting.length === 1 && waiting[0].writer === "closed", waiting.map((d) => d.writer));
    const n = await flushSheetDrafts("u1", "de", server);
    check("background: saved and merged", n === 1 && server.cell("0,0")?.v === "offline" && server.cell("2,2")?.v === "online" && server.title === "Messung 2", server.content);
    // Back online (the background save's answer said so), the open editor saves its own and catches up.
    reportOk();
    await sleep(10);
    await open.saver.flush();
    check("background: the open editor caught up and saved its own", open.cell("0,0")?.v === "offline" && server.cell("4,4")?.v === "offen" && server.cell("0,0")?.v === "offline" && !open.saver.dirty(), open.store.get().workbook.sheets[0].cells);
    await open.close();
    check("background: drafts gone", draftOf("u1", id) === null && (await draftPages("u1")).length === 0);
  }

  // Another tab's draft (or one of a tab that was closed offline): restored here, and gone once saved.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    writeDraft("u1", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, base.sheets[0].id, "1,1", { v: 2.5 }), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "closed-tab" });
    const e = openEditor(server, id);
    await e.saver.restore();
    await e.saver.flush();
    check("other tab's draft: restored and saved", e.log.restored === 1 && server.cell("1,1")?.v === 2.5 && server.rev === 1, server.content);
    check("other tab's draft: gone once saved", draftOf("u1", id) === null, draftOf("u1", id)?.writer);
    await e.close();
  }

  // 7. Blob opened right at a spreadsheet with a draft waiting (back online, or the app reopened there).
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    const sheetId = base.sheets[0].id;
    writeDraft("u1", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, sheetId, "2,0", { v: "offline" }), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "t" });
    // Saved in the background, while the spreadsheet's page was already on its way with the version
    // before (rev 0). Its editor catches up instead of showing the old copy.
    const opened = { rev: server.rev, content: clone(server.content), title: server.title };
    const n = await flushSheetDrafts("u1", "de", server);
    check("background: saved while the page was on its way", n === 1 && server.rev === 1 && server.cell("2,0")?.v === "offline" && flushedRev(id) === 1);
    const late = openEditor(server, id, { opened });
    check("background: the late editor opened with the old copy", late.cell("2,0") === undefined);
    await late.saver.restore();
    await new Promise((r) => setTimeout(r, 0));
    await late.saver.flush();
    check("background: …and catches up with the saved draft", late.cell("2,0")?.v === "offline" && server.loads >= 1 && !late.saver.dirty() && server.rev === 1, late.store.get().workbook.sheets[0].cells);
    await late.close();
    // An editor that opened with that version already doesn't fetch it again.
    const loads = server.loads;
    const fresh = openEditor(server, id);
    await fresh.saver.restore();
    check("background: an up-to-date editor doesn't fetch again", server.loads === loads && fresh.cell("2,0")?.v === "offline");
    await fresh.close();
  }

  // 8. DS-3: a save that landed but whose answer was lost (the tab closed on the way), then the value
  //    corrected on another device. Opened again, the draft's own changes start where that save left
  //    off: the correction stays, and what was typed after the save is put back.
  const lostSave = async (user: string, typeAfter: boolean) => {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const laptop = openEditor(server, id, { userId: user });
    laptop.type(3, 1, "0,333");
    server.mode = "lost";
    server.delay = 30;
    void laptop.saver.flush();
    await sleep(5);
    if (typeAfter) laptop.type(4, 2, "später getippt");
    // The tab closes while the save is on its way: pagehide writes the draft, then the tab is gone.
    laptop.saver.keepDraft();
    laptop.kill();
    await sleep(60);
    server.delay = 0;
    reportOk();
    const sending = draftOf(user, id)?.sending;
    check(`lost answer${typeAfter ? " (typed after)" : ""}: the draft knows the save on its way, which landed`, !!sending && server.saveIds.includes(sending.id) && server.rev === 1 && server.cell("3,1")?.v === 0.333, { sending, rev: server.rev });
    // The phone corrects the value.
    const phone = openEditor(server, id, { userId: "u2" });
    phone.type(3, 1, "0,209");
    await phone.saver.flush();
    await phone.close();
    return { id, server };
  };
  {
    const { id, server } = await lostSave("ds3", false);
    const again = openEditor(server, id, { userId: "ds3" });
    await again.saver.restore();
    await again.saver.flush();
    check("lost answer: the correction made elsewhere stays", server.cell("3,1")?.v === 0.209 && again.cell("3,1")?.v === 0.209 && server.rev === 2, { server: server.cell("3,1"), rev: server.rev });
    check("lost answer: nothing put back, no draft left", again.log.restored === 0 && localDrafts("ds3", id).length === 0);
    await again.close();
  }
  {
    const { id, server } = await lostSave("ds3", true);
    const again = openEditor(server, id, { userId: "ds3" });
    await again.saver.restore();
    await again.saver.flush();
    check("lost answer (typed after): the correction stays, the later typing is back", server.cell("3,1")?.v === 0.209 && server.cell("4,2")?.v === "später getippt" && again.log.restored === 1, server.content);
    check("lost answer (typed after): no draft left", localDrafts("ds3", id).length === 0);
    await again.close();
  }
  // …and through the background save (the laptop only opens the start page).
  {
    const { id, server } = await lostSave("ds3bg", false);
    const n = await flushSheetDrafts("ds3bg", "de", server);
    check("lost answer, background: the correction stays", n === 1 && server.cell("3,1")?.v === 0.209 && server.rev === 2 && localDrafts("ds3bg", id).length === 0, { n, v: server.cell("3,1"), rev: server.rev });
  }
  // An editor closed while its last save is on its way (navigating away; the tab may be closed
  // next, and the page's own "leaving" events no longer reach it): the draft is there at once,
  // naming that save, and gone once the save went through.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const e = openEditor(server, id, { userId: "closing" });
    e.type(0, 0, "zuletzt");
    server.delay = 30;
    const closed = e.close();
    await sleep(5);
    const d = draftOf("closing", id);
    check("closing: a draft while the last save is on its way, naming it", !!d?.sending && d.mine.sheets[0].cells["0,0"]?.v === "zuletzt", d?.sending);
    await closed;
    server.delay = 0;
    check("closing: saved, and no draft left", server.cell("0,0")?.v === "zuletzt" && localDrafts("closing", id).length === 0);
  }
  // A save that didn't get through at all: its changes are put back (nothing typed is lost).
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const laptop = openEditor(server, id, { userId: "ds3no" });
    laptop.type(3, 1, "0,333");
    server.mode = "offline";
    await laptop.saver.flush();
    laptop.kill();
    server.mode = "ok";
    reportOk();
    const phone = openEditor(server, id, { userId: "u2" });
    phone.type(0, 4, "Phone");
    await phone.saver.flush();
    await phone.close();
    const again = openEditor(server, id, { userId: "ds3no" });
    await again.saver.restore();
    await again.saver.flush();
    check("didn't land: put back and saved with the other change", server.cell("3,1")?.v === 0.333 && server.cell("0,4")?.v === "Phone" && again.log.restored === 1, server.content);
    await again.close();
  }
  // In the open editor: the answer is lost (the connection dropped), the value is corrected elsewhere,
  // and the next try starts from what that save sent.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const a = openEditor(server, id, { userId: "ds3open" });
    a.type(3, 1, "0,333");
    server.mode = "lost";
    await a.saver.flush();
    check("lost answer, open: kept on the device for now", a.saver.state === "device" && server.rev === 1);
    // (The phone's save gets through: the connection is back, and the open editor tries again then.)
    const phone = openEditor(server, id, { userId: "u2" });
    phone.type(3, 1, "0,209");
    await phone.saver.flush();
    await phone.close();
    a.type(5, 0, "weiter");
    await a.saver.flush();
    check("lost answer, open: the correction stays, later typing saved", server.cell("3,1")?.v === 0.209 && server.cell("5,0")?.v === "weiter" && a.cell("3,1")?.v === 0.209 && !a.saver.dirty(), server.content);
    await a.close();
  }
  // The background save's own answer lost: the draft says so, and the next try finds it landed.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    writeDraft("bglost", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, base.sheets[0].id, "3,1", { v: 0.333 }), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "gone" });
    server.mode = "lost";
    const first = await flushSheetDrafts("bglost", "de", server);
    reportOk();
    check("background, lost answer: the draft says the save may have landed", first === 0 && server.cell("3,1")?.v === 0.333 && !!draftOf("bglost", id)?.sending);
    const phone = openEditor(server, id, { userId: "u2" });
    phone.type(3, 1, "0,209");
    await phone.saver.flush();
    await phone.close();
    const n = await flushSheetDrafts("bglost", "de", server);
    check("background, lost answer: the correction stays", n === 1 && server.cell("3,1")?.v === 0.209 && server.rev === 2 && localDrafts("bglost", id).length === 0, { n, rev: server.rev });
  }

  // 9. DS-5: two tabs of the same spreadsheet offline at once: neither overwrites the other's work.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const tabA = openEditor(server, id, { userId: "ds5" });
    const tabB = openEditor(server, id, { userId: "ds5" });
    server.mode = "offline";
    tabA.type(1, 3, "Wert aus Tab A");
    await tabA.saver.flush();
    tabB.type(1, 4, "Wert aus Tab B");
    await tabB.saver.flush();
    const both = localDrafts("ds5", id);
    check("two tabs: each keeps a draft of its own", both.length === 2 && both.some((d) => d.mine.sheets[0].cells["1,3"]?.v === "Wert aus Tab A") && both.some((d) => d.mine.sheets[0].cells["1,4"]?.v === "Wert aus Tab B"), both.length);
    // Another editor opening now leaves them alone: their editors are still open.
    const peek = openEditor(server, id, { userId: "ds5" });
    await peek.saver.restore();
    check("two tabs: an open editor's draft isn't taken", peek.log.restored === 0 && localDrafts("ds5", id).length === 2);
    await peek.close();
    await tabB.close();
    await tabA.close();
    server.mode = "ok";
    reportOk();
    const later = openEditor(server, id, { userId: "ds5" });
    await later.saver.restore();
    await later.saver.flush();
    check("two tabs: both values saved", server.cell("1,3")?.v === "Wert aus Tab A" && server.cell("1,4")?.v === "Wert aus Tab B" && later.log.restored === 1, server.content);
    check("two tabs: the drafts were taken over and are gone", localDrafts("ds5", id).length === 0);
    await later.close();
  }
  // An editor open in another tab (its Web Lock is held): its draft stays its own, until that tab is gone.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    writeDraft("ds5x", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, base.sheets[0].id, "0,0", { v: "dort" }), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "tab-elsewhere" });
    const release = fakeLocks.holdFor("tab-elsewhere");
    await sleep(0);
    const e = openEditor(server, id, { userId: "ds5x" });
    await e.saver.restore();
    check("other tab open: its draft stays its own", e.log.restored === 0 && localDrafts("ds5x", id).length === 1);
    check("other tab open: the background save leaves it too", (await flushSheetDrafts("ds5x", "de", server)) === 0 && server.rev === 0);
    await e.close();
    release();
    await sleep(0);
    const f = openEditor(server, id, { userId: "ds5x" });
    await f.saver.restore();
    await f.saver.flush();
    check("other tab closed: its draft is taken over", f.log.restored === 1 && server.cell("0,0")?.v === "dort" && localDrafts("ds5x", id).length === 0);
    await f.close();
  }
  // One taker at a time: an editor opening and the background save at once put a draft back once.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server.content, "de");
    writeDraft("take", { v: 1, pageId: id, rev: 0, base, mine: setCell(base, base.sheets[0].id, "0,0", { v: "einmal" }), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "gone" });
    const e = openEditor(server, id, { userId: "take" });
    await Promise.all([e.saver.restore(), flushSheetDrafts("take", "de", server)]);
    await sleep(0);
    await e.saver.flush();
    check("one taker: the draft is saved once", server.saves === 1 && server.cell("0,0")?.v === "einmal" && e.cell("0,0")?.v === "einmal" && localDrafts("take", id).length === 0, { saves: server.saves });
    await e.close();
  }

  // 10. DS-4: signing out. Open editors save what they hold; what can't be saved is counted (a
  //     draft that changes nothing isn't); then the editors stop without writing a draft again.
  {
    const user = "signout";
    const [id, id2, id3] = [page(), page(), page()];
    const server = new FakeServer(newWorkbook("de"));
    const base = normalizeWorkbook(newWorkbook("de"), "de");
    writeDraft(user, { v: 1, pageId: id2, rev: 0, base, mine: setCell(base, base.sheets[0].id, "0,0", { v: "offline" }), baseTitle: "", title: "", at: Date.now(), writer: "closed" });
    writeDraft(user, { v: 1, pageId: id3, rev: 0, base, mine: clone(base), baseTitle: "", title: "", at: Date.now(), writer: "stale" });
    const open = openEditor(server, id, { userId: user });
    open.type(0, 0, "noch nicht gespeichert");
    check("sign-out: counts the open editor and a closed one's draft, not a draft that changes nothing", (await unsavedSheets(user)) === 2, await unsavedSheets(user));
    await flushOpenSheets();
    check("sign-out: the open editor saved what it held", server.cell("0,0")?.v === "noch nicht gespeichert" && !open.saver.dirty() && (await unsavedSheets(user)) === 1);
    server.mode = "offline";
    open.type(1, 0, "offline");
    await flushOpenSheets();
    check("sign-out: work that can't be sent is counted", (await unsavedSheets(user)) === 2);
    // "Trotzdem abmelden": the editors stop, the device is wiped; nothing is written again.
    discardOpenSheets();
    for (const k of [...memory.keys()]) if (k.startsWith(`blob-sheet-draft:${user}:`)) memory.delete(k);
    open.type(2, 0, "nach dem Abmelden");
    await open.close();
    await sleep(10);
    check("sign-out: no draft written after the wipe", (await draftPages(user)).length === 0 && (await unsavedSheets(user)) === 0, await draftPages(user));
    server.mode = "ok";
    reportOk();
  }

  // 11. DS-11: a save announced while a pull is on its way (which read the page just before it):
  //     the viewer looks again and shows the newest values.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"));
    const partner = openEditor(server, id, { userId: "u2" });
    const viewer = openEditor(server, id, { userId: "pull" });
    partner.type(2, 1, "0,2");
    await partner.saver.flush();
    server.loadDelay = 60;
    server.loadAt = 10;
    const pulled = viewer.saver.remote(1);
    await sleep(25);
    partner.type(2, 1, "2");
    await partner.saver.flush();
    await viewer.saver.remote(2);
    await pulled;
    await sleep(150);
    check("pull race: the viewer catches up with the save announced meanwhile", viewer.cell("2,1")?.v === 2 && !viewer.saver.dirty(), viewer.cell("2,1"));
    // A revision announced that the page doesn't have (a wrong message): fetched once, not after every save.
    server.loadDelay = 0;
    const loads = server.loads;
    await viewer.saver.remote(999999);
    viewer.type(7, 0, "x");
    await viewer.saver.flush();
    viewer.type(8, 0, "y");
    await viewer.saver.flush();
    await sleep(0);
    check("pull race: no pulling in circles for a revision that isn't there", server.loads === loads + 1, server.loads - loads);
    await viewer.close();
    await partner.close();
  }

  // 12. DS-12: steady typing (a value every 400 ms) puts the save off by about 3 s at most, and the
  //     draft on the device by about 5 s (here the saves hang, so only the draft keeps the work).
  {
    const server = new FakeServer(newWorkbook("de"));
    const typing = openEditor(server, page(), { userId: "wait" });
    const slow = new FakeServer(newWorkbook("de"));
    slow.delay = 8000;
    const slowPage = page();
    const stuck = openEditor(slow, slowPage, { userId: "wait" });
    const start = Date.now();
    let savedAt = 0;
    let draftAt = 0;
    for (let i = 0; i < 15; i++) {
      typing.type(i, 0, String(i));
      stuck.type(i, 0, String(i));
      await sleep(400);
      if (!savedAt && server.saves > 0) savedAt = Date.now() - start;
      if (!draftAt && localDrafts("wait", slowPage).length) draftAt = Date.now() - start;
    }
    check("max wait: saved while the typing goes on (after about 3 s)", savedAt > 0 && savedAt <= 3600, savedAt);
    check("max wait: the draft written while the typing goes on (after about 5 s)", draftAt > 0 && draftAt <= 5600, draftAt);
    await typing.close();
    stuck.kill();
    for (const d of localDrafts("wait", slowPage)) clearDraft("wait", slowPage, d.writer);
  }
  // …stretched for a big spreadsheet (about 2.5 MB here: two and a half times as long), where each
  // save and draft takes a moment of its own: none during 6 s of steady typing, a save once it stops.
  {
    const server = new FakeServer(newWorkbook("de"));
    const bigPage = page();
    const e = openEditor(server, bigPage, { userId: "wait" });
    e.store.apply("big", (wb) => setCells(wb, e.sheetId, Array.from({ length: 80 }, (_, i) => ({ row: 100 + i, col: 0, cell: { v: "y".repeat(31_000) } }))));
    await e.saver.flush();
    const saves = server.saves;
    for (let i = 0; i < 15; i++) {
      e.type(i, 1, String(i));
      await sleep(400);
    }
    const during = { saves: server.saves - saves, drafts: localDrafts("wait", bigPage).length };
    for (let t = 0; t < 30 && server.saves === saves; t++) await sleep(100);
    check("max wait, big spreadsheet: no save or draft during 6 s of steady typing", e.log.sizes.at(-1)! > 2_400_000 && during.saves === 0 && during.drafts === 0, { size: e.log.sizes.at(-1), ...during });
    check("max wait, big spreadsheet: saved once the typing stops", server.saves === saves + 1 && server.cell("14,1")?.v === 14 && !e.saver.dirty(), server.saves - saves);
    await e.close();
  }

  // 13. DS-13: renamed elsewhere (a rename alone leaves the revision as it is): the open editor's
  //     next save keeps that title and shows it; a rename here still wins.
  {
    const server = new FakeServer(newWorkbook("de"), "Messung 1");
    const e = openEditor(server, page(), { userId: "title" });
    server.title = "Kalibrierung Nitrat 03.11.";
    e.type(5, 5, "5");
    await e.saver.flush();
    check("rename elsewhere: kept by the next save, and shown", server.title === "Kalibrierung Nitrat 03.11." && e.log.titles.at(-1) === "Kalibrierung Nitrat 03.11.", { server: server.title, titles: e.log.titles });
    // Realtime brings the row of a rename (the same revision): shown at once.
    server.title = "Nitrat";
    await e.saver.remoteRow(server.rev, "Nitrat");
    check("rename elsewhere: shown at once from the row", e.log.titles.at(-1) === "Nitrat" && !e.saver.dirty());
    // Renamed here and elsewhere at once: here wins (like a cell).
    e.saver.setTitle("Meine Messung");
    server.title = "Deren";
    await e.saver.remoteRow(server.rev, "Deren");
    await e.saver.flush();
    check("rename here and elsewhere: here wins", server.title === "Meine Messung", server.title);
    await e.close();
  }

  // 14. DS-10/SEC-5: the size as save_sheet measures it (UTF-8 bytes of the JSON as sent, preview
  //     included): exactly the limit is saved, one byte more is refused before sending; a warning
  //     from LARGE_BYTES on; the import checks measure the same way.
  {
    const server = new FakeServer(newWorkbook("de"));
    const e = openEditor(server, page(), { userId: "size" });
    const sid = e.sheetId;
    e.type(0, 0, "Messwerte");
    const start = e.store.get().workbook;
    const padded = (k: number, rest: string) =>
      setCells(start, sid, [...Array.from({ length: k }, (_, i) => ({ row: 100 + i, col: 0, cell: { v: "y".repeat(30_000) } })), { row: 100 + k, col: 0, cell: { v: rest } }]);
    const bytesOf = (wb: Workbook) => jsonBytes(storedContent(wb, createCalc(wb, { locale: "de" }), "de").content);
    let k = Math.floor((MAX_BYTES - bytesOf(start)) / 30_100);
    let r = 1 + MAX_BYTES - bytesOf(padded(k, "y"));
    while (r > 30_000) r = 1 + MAX_BYTES - bytesOf(padded(++k, "y"));
    check("size: (a rest cell fits)", r > 1 && r <= 30_000, r);
    e.store.apply("pad", () => padded(k, "y".repeat(r)));
    await e.saver.flush();
    check("size: exactly 5,000,000 bytes is saved (the server measures the same)", server.rev === 1 && e.saver.state === "saved" && e.log.sizes.at(-1) === MAX_BYTES, e.log.sizes.at(-1));
    check("size: close to the limit, the editor says so", e.log.notices.at(-1) === "large" && MAX_BYTES > LARGE_BYTES);
    const saved = e.store.get().workbook;
    const calls = server.calls;
    e.store.apply("pad", () => padded(k, "y".repeat(r + 1)));
    await e.saver.flush();
    check("size: one byte more is refused before sending", server.calls === calls && e.saver.state === "tooBig" && e.log.sizes.at(-1) === MAX_BYTES + 1, e.log.sizes.at(-1));
    // Back to what is saved (undone): nothing too big is left, so "Gespeichert" and the warning
    // near the limit again, with the saved size.
    e.store.undo();
    check("size: too big, undone: saved again, the warning with the saved size", !e.saver.dirty() && e.store.get().workbook === saved && e.saver.state === "saved" && e.log.notices.at(-1) === "large" && e.log.sizes.at(-1) === MAX_BYTES && server.calls === calls, { state: e.saver.state, notice: e.log.notices.at(-1), size: e.log.sizes.at(-1) });
    // Characters beyond ASCII count the bytes they take: "µ" is two.
    e.store.apply("pad", () => padded(k, "µ".repeat(Math.ceil(r / 2) + 1)));
    await e.saver.flush();
    check("size: counted in UTF-8 bytes", server.calls === calls && e.saver.state === "tooBig");
    e.store.apply("smaller", () => start);
    await e.saver.flush();
    check("size: small again, saved, no warning", e.saver.state === "saved" && e.log.notices.at(-1) === null && server.rev === 2);
    await e.close();

    const lab = labWorkbook();
    const page1 = sheetPageContent(lab, "de");
    check("import: a new page's size, measured as saving does", page1.bytes === jsonBytes(page1.content) && MAX_SHEET_BYTES === MAX_BYTES);
    const next = appendWorkbook(lab, freshIds(labWorkbook()), "de");
    const calc = createCalc(lab, { locale: "de" });
    check("import: the open spreadsheet's size with a file added, without recalculating", importedBytes(next, calc, "de") === jsonBytes(storedContent(next, createCalc(next, { locale: "de" }), "de").content));
  }

  // 15. Rows inserted on both sides at once: the merge keeps theirs and mine as a copy sheet
  //     (src/sheet/collab.ts), and the editor is told (useSheetSave shows it).
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const a = openEditor(server, id, { userId: "conflict" });
    const b = openEditor(server, id, { userId: "u2" });
    a.store.apply("insert", (wb) => insertRows(wb, a.sheetId, 1, 1));
    a.type(0, 0, "von A");
    b.store.apply("insert", (wb) => insertRows(wb, b.sheetId, 3, 1));
    b.type(0, 1, "von B");
    await b.saver.flush();
    await a.saver.flush();
    const c = a.log.conflicts.at(-1)?.[0];
    check("conflict: reported with the copy's name", !!c && c.name === "Blatt 1" && c.copyName.includes("Konflikt"), a.log.conflicts);
    check("conflict: the copy is saved too", !!c && (server.content as Workbook).sheets.some((s) => s.name === c.copyName));
    await a.close();
    await b.close();
  }

  // 15b. …while A is typing on that sheet: the merge report reaches the store, so the edit goes on
  //      in A's copy, which has A's rows. A draft put back works the other way round: the screen's
  //      version is kept, the draft's goes on the copy, and a running edit stays where it is.
  {
    const id = page();
    const server = new FakeServer(newWorkbook("de"), "Messung");
    const a = openEditor(server, id, { userId: "conflict-typing" });
    const b = openEditor(server, id, { userId: "u2" });
    a.store.apply("insert", (wb) => insertRows(wb, a.sheetId, 1, 1));
    b.store.apply("insert", (wb) => insertRows(wb, b.sheetId, 3, 1));
    await b.saver.flush();
    a.store.select({ row: 4, col: 2 });
    a.store.startEdit({ via: "cell", replace: true, text: "0,66" });
    await a.saver.flush();
    const c = a.log.conflicts.at(-1)?.[0];
    const s = a.store.get();
    check("conflict while typing: the edit and the screen go on in my copy", !!c && !!c.copyId && s.edit?.sheetId === c.copyId && s.sheetId === c.copyId && s.edit?.row === 4 && s.edit?.col === 2, { c, edit: s.edit, sheetId: s.sheetId });
    a.store.commitEdit();
    await a.saver.flush();
    const saved = server.content as Workbook;
    check("conflict while typing: entered in my copy, their sheet untouched", saved.sheets.find((x) => x.id === c?.copyId)?.cells["4,2"]?.v === 0.66 && saved.sheets[0].cells["4,2"] === undefined, saved.sheets.map((x) => [x.name, x.cells["4,2"]]));
    await a.close();
    await b.close();

    const id2 = page();
    const server2 = new FakeServer(newWorkbook("de"), "Messung");
    const base = normalizeWorkbook(server2.content, "de");
    const sheetId = base.sheets[0].id;
    writeDraft("u1", { v: 1, pageId: id2, rev: 0, base, mine: insertRows(base, sheetId, 3, 1), baseTitle: "Messung", title: "Messung", at: Date.now(), writer: "closed-tab" });
    const e = openEditor(server2, id2);
    e.store.apply("insert", (wb) => insertRows(wb, sheetId, 1, 1));
    e.store.select({ row: 4, col: 2 });
    e.store.startEdit({ via: "cell", replace: true, text: "0,66" });
    await e.saver.restore();
    const r = e.store.get();
    const copy = e.log.conflicts.at(-1)?.[0];
    check("draft put back while typing: the draft's version is the copy, the edit stays", !!copy?.copyId && r.workbook.sheets.length === 2 && r.edit?.sheetId === sheetId && r.sheetId === sheetId && r.edit?.row === 4, { copy, edit: r.edit, sheetId: r.sheetId });
    e.store.commitEdit();
    await e.saver.flush();
    check("draft put back while typing: entered on the screen's sheet", (server2.content as Workbook).sheets[0].cells["4,2"]?.v === 0.66, (server2.content as Workbook).sheets.map((x) => x.cells["4,2"]));
    await e.close();
  }

  // 16. SEC-7: another account signing in on this device removes every other account's drafts.
  {
    const base = newWorkbook("de");
    const draft = (pageId: string, writer: string): SheetDraft => ({ v: 1, pageId, writer, rev: 0, base, mine: setCell(base, base.sheets[0].id, "0,0", { v: "Patientin 4711: 0,523" }), baseTitle: "", title: "", at: Date.now() });
    writeDraft("old-account", draft("p-old", "w1"));
    writeDraft("new-account", draft("p-new", "w2"));
    forgetOtherAccounts("new-account");
    check("sign-in: another account's drafts removed, this one's kept", (await draftPages("old-account")).length === 0 && (await draftPages("new-account")).length === 1);
    const kept = await readDrafts("new-account", "p-new");
    check("sign-in: this account's draft still readable", kept.length === 1 && kept[0].writer === "w2");
    clearDraft("new-account", "p-new", "w2");
  }

  // 17. A change that couldn't be saved (a server error, too big, no network) undone back to what is
  //     saved: nothing is left to save, so the problem is over: "Gespeichert", no more tries, and the
  //     draft goes. Not when access is gone, nor while a save that got no answer may have landed
  //     (that is found out first).
  {
    const quiet = console.error;
    console.error = () => {};
    const user = "undone";
    // A server error: tried again after 4 s.
    const errId = page();
    const errServer = new FakeServer(newWorkbook("de"));
    const err = openEditor(errServer, errId, { userId: user });
    errServer.mode = "error";
    err.type(0, 0, "x");
    await err.saver.flush();
    // Too big.
    const bigId = page();
    const bigServer = new FakeServer(newWorkbook("de"));
    const big = openEditor(bigServer, bigId, { userId: user });
    big.store.apply("big", (wb) => setCells(wb, big.sheetId, Array.from({ length: 170 }, (_, i) => ({ row: i, col: 0, cell: { v: "x".repeat(32000) } }))));
    await big.saver.flush();
    // No network at all: the save never left.
    const offId = page();
    const offServer = new FakeServer(newWorkbook("de"));
    const off = openEditor(offServer, offId, { userId: user });
    Object.defineProperty(globalThis.navigator, "onLine", { value: false, configurable: true });
    off.type(0, 0, "x");
    await off.saver.flush();
    Reflect.deleteProperty(globalThis.navigator, "onLine");
    // No access any more.
    const deniedServer = new FakeServer(newWorkbook("de"));
    const denied = openEditor(deniedServer, page(), { userId: user });
    deniedServer.mode = "denied";
    denied.type(0, 0, "x");
    await denied.saver.flush();
    const before = [err.saver.state, big.saver.state, off.saver.state, denied.saver.state].join();
    const drafted = [errId, bigId, offId].every((id) => localDrafts(user, id).length === 1);
    for (const e of [err, big, off, denied]) e.store.undo();
    errServer.mode = "ok";
    const errCalls = errServer.calls;
    await sleep(4500);
    check("undone: (first the problem states, each with a draft)", before === "failed,tooBig,device,refused" && drafted, before);
    check("undone after a server error: 'Gespeichert', no more tries", err.saver.state === "saved" && errServer.calls === errCalls && !err.saver.dirty(), { state: err.saver.state, calls: errServer.calls - errCalls });
    check("undone when too big: 'Gespeichert', the notice gone, nothing sent", big.saver.state === "saved" && big.log.notices.at(-1) === null && bigServer.calls === 0, { state: big.saver.state, notice: big.log.notices.at(-1) });
    check("undone without a network: 'Gespeichert'", off.saver.state === "saved" && offServer.calls === 0, off.saver.state);
    check("undone: their drafts go too", [errId, bigId, offId].every((id) => localDrafts(user, id).length === 0), [errId, bigId, offId].map((id) => localDrafts(user, id).length));
    check("undone with no access: still 'Nicht gespeichert'", denied.saver.state === "refused", denied.saver.state);
    for (const e of [err, big, off, denied]) await e.close();
    // A save whose answer was lost, then undone: it may have landed, so that is found out first. It
    // had: the undo is saved on top of it.
    const lostServer = new FakeServer(newWorkbook("de"));
    const lost = openEditor(lostServer, page(), { userId: user });
    lostServer.mode = "lost";
    lost.type(0, 0, "zurückgenommen");
    await lost.saver.flush();
    lost.store.undo();
    const unsure = lost.saver.state;
    reportOk();
    await lost.saver.flush();
    console.error = quiet;
    check("undone after a lost answer: not 'Gespeichert' before it is known whether that save landed", unsure === "device", unsure);
    check("undone after a lost answer: it had landed, so the undo is saved on top", lostServer.rev === 2 && lostServer.cell("0,0") === undefined && lost.saver.state === "saved" && !lost.saver.dirty(), { rev: lostServer.rev, cell: lostServer.cell("0,0") });
    await lost.close();
    for (const id of [errId, bigId, offId]) for (const d of localDrafts(user, id)) clearDraft(user, id, d.writer);
  }

  // 18. Signed out in another tab (forgetDevice there): the editors open here stop too, since they
  //     would save into a session that is gone and write their drafts again after the device was
  //     wiped; the bar doesn't say "Gespeichert" for what was typed.
  {
    const user = "elsewhere";
    const server = new FakeServer(newWorkbook("de"));
    const id = page();
    const e = openEditor(server, id, { userId: user });
    e.type(0, 0, "getippt");
    // What the other tab's discardOpenSheets() sends (on the channel drafts.ts listens on).
    const otherTab = new BroadcastChannel("blob-sheet-sign-out");
    otherTab.postMessage("discard");
    otherTab.close();
    await sleep(20);
    check("signed out in another tab: the editor here stopped, 'Nicht gespeichert'", e.saver.state === "refused", e.log.states);
    e.type(1, 0, "danach");
    await sleep(2200);
    await e.saver.flush();
    await e.close();
    check("signed out in another tab: nothing sent or kept here afterwards", server.calls === 0 && localDrafts(user, id).length === 0, { calls: server.calls, drafts: localDrafts(user, id).length });
    // An editor opened afterwards listens again.
    const later = openEditor(server, page(), { userId: user });
    later.type(0, 0, "neu");
    const again = new BroadcastChannel("blob-sheet-sign-out");
    again.postMessage("discard");
    again.close();
    await sleep(20);
    check("signed out in another tab: an editor opened later hears it too", later.saver.state === "refused", later.log.states);
    await later.close();
    // …and signing out here (forgetDevice) tells the other tabs.
    const heard: unknown[] = [];
    const otherTabs = new BroadcastChannel("blob-sheet-sign-out");
    otherTabs.onmessage = (m) => heard.push(m.data);
    discardOpenSheets();
    await sleep(20);
    otherTabs.close();
    check("signing out here tells the other tabs", heard.length === 1, heard);
  }
}

// ----------------------------------------------------------------------------------------------

void (async () => {
  try {
    await savingTests();
  } catch (e) {
    problems.push(`saving: threw ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }
  if (problems.length) {
    console.log(`check-sheet-doc: ${passed} passed, ${problems.length} FAILED`);
    for (const p of problems) console.log("  ✗ " + p);
    process.exit(1);
  }
  console.log(`check-sheet-doc: all ${passed} checks passed`);
  // (Timers of the connection check would keep Node waiting.)
  process.exit(0);
})();
