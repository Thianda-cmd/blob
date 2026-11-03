// Checks smart tables (src/sheet/table): making a table (header detection, growing from one cell,
// overlaps), filters of every kind, sorting with the header and totals row left alone, the totals
// row's formulas and values (with the real engine, filtered rows left out), growing by typing,
// calculated columns, converting back, structural changes through ops.ts and the grid's decoration.
//
//   npm run check:sheet-table
//
// Problems make the script exit with 1.
import type { Locale } from "@/i18n/config";
import { cellKey, parsePos } from "@/sheet/a1";
import * as E from "@/sheet/engine";
import * as O from "@/sheet/ops";
import * as T from "@/sheet/table/model";
import { buildDecorate } from "@/components/sheet/table/decor";
import { createSheetStore } from "@/components/sheet/store";
import { currentSheetNotice } from "@/components/sheet/notice";
import { chartFromTable, makeTableFromSelection } from "@/components/sheet/table/actions";
import { describeFilter } from "@/components/sheet/table/describe";
import { sheetTableText } from "@/i18n/messages/sheetTable";
import type { Area, Cell, ChartSpec, FilterSpec, RangeRef, Sheet, TableSpec, Workbook } from "@/sheet/types";

// ----------------------------------------------------------------------------------------------
// Tiny test kit

let count = 0;
let current = "";
const failures: string[] = [];
const section = (name: string) => {
  current = name;
};
function check(name: string, ok: boolean, detail = "") {
  count++;
  if (!ok) failures.push(`${current} › ${name}${detail ? ` — ${detail}` : ""}`);
}
const show = (v: unknown) => JSON.stringify(v);
function eq(name: string, actual: unknown, expected: unknown) {
  check(name, show(actual) === show(expected), `got ${show(actual)}, expected ${show(expected)}`);
}
function near(name: string, actual: unknown, expected: number, tol = 1e-9) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
  check(name, ok, `got ${show(actual)}, expected ${expected}`);
}
function run(name: string, f: () => void) {
  try {
    f();
  } catch (e) {
    count++;
    failures.push(`${name} › threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }
}

// ----------------------------------------------------------------------------------------------
// Building workbooks: cells in A1 notation, "=…" is a canonical formula

type CellInput = number | string | boolean | Cell;
const toCell = (v: CellInput): Cell => (typeof v === "object" ? v : typeof v === "string" && v.startsWith("=") ? { f: v.slice(1) } : { v });

function mkSheet(cells: Record<string, CellInput>, id = "s1", name = "Blatt 1"): Sheet {
  const out: Record<string, Cell> = {};
  for (const [a1, v] of Object.entries(cells)) {
    const p = parsePos(a1);
    if (!p) throw new Error(`bad address ${a1}`);
    out[cellKey(p.row, p.col)] = toCell(v);
  }
  return { id, name, cells: out, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } };
}
const book = (cells: Record<string, CellInput>, extra: Sheet[] = []): Workbook => ({ v: 1, sheets: [mkSheet(cells), ...extra], charts: [], tables: [] });
const A = (text: string): Area => {
  const [a, b] = text.split(":");
  const p = parsePos(a)!;
  const q = parsePos(b ?? a)!;
  return { r0: Math.min(p.row, q.row), c0: Math.min(p.col, q.col), r1: Math.max(p.row, q.row), c1: Math.max(p.col, q.col) };
};
const at = (a1: string) => parsePos(a1)!;
const cell = (wb: Workbook, a1: string, sheetId = "s1") => O.getCell(wb, sheetId, at(a1).row, at(a1).col);

/** A Calc like the editor's: SUBTOTAL skips rows hidden by hand or by a table's filter. */
function calcOf(wb: Workbook, locale: Locale = "de"): E.Calc {
  let self: E.Calc | null = null;
  const memo = new Map<string, Set<number> | "busy">();
  const calc = E.createCalc(wb, {
    locale,
    now: () => new Date(2026, 10, 3),
    isRowHidden: (sheetId, row) => {
      const sheet = O.sheetById(wb, sheetId);
      if (sheet?.rows[String(row)]?.hidden) return true;
      if (!self || !wb.tables.some((t) => t.sheetId === sheetId && Object.keys(t.filters).length)) return false;
      const known = memo.get(sheetId);
      if (known === "busy") return false;
      if (known) return known.has(row);
      memo.set(sheetId, "busy");
      const rows = T.filteredRows(wb, self, sheetId, locale);
      memo.set(sheetId, rows);
      return rows.has(row);
    },
  });
  self = calc;
  return calc;
}
const val = (wb: Workbook, a1: string, locale: Locale = "de") => calcOf(wb, locale).value("s1", at(a1).row, at(a1).col);

function make(wb: Workbook, area: string, locale: Locale = "de", opts: T.MakeTableOptions = {}): T.MadeTable {
  const r = T.makeTableWith(wb, calcOf(wb, locale), "s1", A(area), locale, opts);
  if ("error" in r) throw new Error(`makeTable ${area}: ${r.error}`);
  return r;
}
const only = (wb: Workbook): TableSpec => {
  if (wb.tables.length !== 1) throw new Error(`expected one table, got ${wb.tables.length}`);
  return wb.tables[0];
};
const areaText = (a: Area) => `${String.fromCharCode(65 + a.c0)}${a.r0 + 1}:${String.fromCharCode(65 + a.c1)}${a.r1 + 1}`;
const hidden = (wb: Workbook, locale: Locale = "de") => [...T.filteredRows(wb, calcOf(wb, locale), "s1", locale)].sort((a, b) => a - b).map((r) => r + 1);
const withFilter = (wb: Workbook, colIndex: number, f: FilterSpec | null) => {
  const t = only(wb);
  return T.setTableFilter(wb, t.id, t.columns[colIndex].id, f);
};

// A calibration table: concentration, absorbance, sample name
const LAB: Record<string, CellInput> = {
  A1: "Konzentration",
  B1: "Extinktion",
  C1: "Probe",
  A2: 0,
  B2: 0.002,
  C2: "Blank",
  A3: 0.25,
  B3: 0.135,
  C3: "Standard A",
  A4: 0.5,
  B4: 0.262,
  C4: "standard b",
  A5: 1,
  B5: 0.521,
  C5: "Probe 1",
  A6: 2,
  B6: 1.043,
  C6: "",
  A7: 2,
  B7: 0.98,
  C7: "Probe 2",
};

// ==============================================================================================
section("makeTable: header detection");
run(current, () => {
  const wb = book(LAB);
  const r = make(wb, "A1:C7");
  const t = only(r.wb);
  eq("area", areaText(t.area), "A1:C7");
  eq("header found", r.header, "found");
  eq("nothing moved", r.moved, false);
  eq("name", t.name, "Tabelle1");
  eq("style", t.style, "purple");
  eq("banded", t.banded, true);
  eq("no totals", t.totals, false);
  eq("columns", t.columns.length, 3);
  check("column ids unique", new Set(t.columns.map((c) => c.id)).size === 3);
  check("totals none", t.columns.every((c) => c.total === "none"));
  eq("no filters", t.filters, {});
  eq("no sort", t.sort, null);
  eq("names", T.columnNames(r.wb, calcOf(r.wb), t, "de"), ["Konzentration", "Extinktion", "Probe"]);
  // The contract's makeTable gives the same
  const plain = T.makeTable(wb, calcOf(wb), "s1", A("A1:C7"), "de", "blue");
  check("makeTable ok", !("error" in plain));
  if (!("error" in plain)) eq("makeTable style", only(plain.wb).style, "blue");
});

run("makeTable: no header → header row added", () => {
  section("makeTable: header row added");
  const wb = book({ A1: 1, B1: 10, A2: 2, B2: 20, A3: 3, B3: 30, D1: "=SUM(A1:A3)" });
  const r = make(wb, "A1:B3");
  const t = only(r.wb);
  eq("header added", r.header, "added");
  eq("moved", r.moved, true);
  eq("area", areaText(t.area), "A1:B4");
  eq("A1", cell(r.wb, "A1")?.v, "Spalte1");
  eq("B1", cell(r.wb, "B1")?.v, "Spalte2");
  eq("data moved", [cell(r.wb, "A2")?.v, cell(r.wb, "B4")?.v], [1, 30]);
  eq("formula followed the data", cell(r.wb, "D2")?.f, "SUM(A2:A4)");
  eq("value", val(r.wb, "D2"), 6);
  // English
  const en = make(wb, "A1:B3", "en");
  eq("English names", [cell(en.wb, "A1")?.v, cell(en.wb, "B1")?.v], ["Column1", "Column2"]);
  eq("English table name", only(en.wb).name, "Table1");
});

run("makeTable: empty row above takes the header", () => {
  section("makeTable: empty row above");
  const wb = book({ A1: "Messung vom Montag", A3: 1, B3: 2, A4: 3, B4: 4 });
  const r = make(wb, "A3:B4");
  eq("area", areaText(only(r.wb).area), "A2:B4");
  eq("not moved", r.moved, false);
  eq("header in row 2", [cell(r.wb, "A2")?.v, cell(r.wb, "B2")?.v], ["Spalte1", "Spalte2"]);
  eq("title untouched", cell(r.wb, "A1")?.v, "Messung vom Montag");
  eq("data untouched", cell(r.wb, "A3")?.v, 1);
});

run("makeTable: title right above → a row is inserted", () => {
  section("makeTable: title above");
  const wb = book({ A1: "Titel", A2: 1, B2: 2, A3: 3, B3: 4 });
  const r = make(wb, "A2:B3");
  eq("area", areaText(only(r.wb).area), "A2:B4");
  eq("title stays", cell(r.wb, "A1")?.v, "Titel");
  eq("header", cell(r.wb, "A2")?.v, "Spalte1");
  eq("data moved", cell(r.wb, "A3")?.v, 1);
});

run("makeTable: empty first row of the selection becomes the header", () => {
  section("makeTable: empty first row");
  const wb = book({ A2: 1, B2: 2, A3: 3, B3: 4 });
  const r = make(wb, "A1:B3");
  eq("area", areaText(only(r.wb).area), "A1:B3");
  eq("names", [cell(r.wb, "A1")?.v, cell(r.wb, "B1")?.v], ["Spalte1", "Spalte2"]);
  eq("data stays", cell(r.wb, "A2")?.v, 1);
});

run("makeTable: one cell grows to the block", () => {
  section("makeTable: current region");
  const wb = book({ ...LAB, E10: "far away" });
  const r = make(wb, "B3");
  eq("area", areaText(only(r.wb).area), "A1:C7");
  // Diagonal neighbours belong to the block too (Excel's current region)
  const diag = book({ A1: "x", B2: 1, C3: 2, F9: 9 });
  eq("diagonal", T.currentRegion(diag.sheets[0], 0, 0), A("A1:C3"));
  eq("lone cell", T.currentRegion(diag.sheets[0], 8, 5), A("F9"));
  // An empty cell touching data takes the block too, like Excel
  eq("empty cell next to data", T.currentRegion(diag.sheets[0], 3, 3), A("A1:D4"));
  // Big blocks are quick
  const big: Record<string, CellInput> = { A1: "x", B1: "y" };
  for (let r = 2; r <= 5000; r++) {
    big[`A${r}`] = r;
    big[`B${r}`] = r * 2;
  }
  const t0 = performance.now();
  const region = T.currentRegion(book(big).sheets[0], 2500, 1);
  const ms = performance.now() - t0;
  eq("5000 rows", region, A("A1:B5000"));
  check("5000 rows quickly", ms < 400, `${ms.toFixed(0)} ms`);
});

run("makeTable: overlap and empty", () => {
  section("makeTable: overlap, empty");
  const wb = make(book(LAB), "A1:C7").wb;
  const c = calcOf(wb);
  eq("overlapping area", T.makeTableWith(wb, c, "s1", A("C5:E9"), "de"), { error: "overlap" });
  eq("cell inside a table", T.makeTableWith(wb, c, "s1", A("B4"), "de"), { error: "overlap" });
  eq("empty area", T.makeTableWith(wb, c, "s1", A("H1:J5"), "de"), { error: "empty" });
  eq("empty lone cell", T.makeTableWith(wb, c, "s1", A("H20"), "de"), { error: "empty" });
  eq("unknown sheet", T.makeTableWith(wb, c, "nope", A("A1"), "de"), { error: "empty" });
  // A second table gets the next name
  const w2 = O.setCells(wb, "s1", [
    { row: 0, col: 5, cell: { v: "x" } },
    { row: 1, col: 5, cell: { v: 1 } },
  ]);
  const r2 = make(w2, "F1:F2");
  eq("second name", r2.wb.tables.map((t) => t.name), ["Tabelle1", "Tabelle2"]);
});

run("makeTable: blocks next to tables", () => {
  section("makeTable: next to a table");
  // Data typed right under a table (no gap) is its own block, not part of the table's region.
  const base = make(book({ A1: "a", B1: "b", A2: 1, B2: 2, A3: 3, B3: 4 }), "A1:B3").wb;
  const w = O.setCells(base, "s1", [
    { row: 3, col: 0, cell: { v: "x" } },
    { row: 3, col: 1, cell: { v: "y" } },
    { row: 4, col: 0, cell: { v: 5 } },
    { row: 4, col: 1, cell: { v: 6 } },
  ]);
  const r = T.makeTableWith(w, calcOf(w), "s1", A("A5"), "de");
  check("made", !("error" in r), show(r));
  if (!("error" in r)) eq("its own block", areaText(r.area), "A4:B5");
});

run("makeTable: header row inserted beside another table", () => {
  section("makeTable: no full row through a neighbour");
  // A table in D1:E5; numbers in A3:B4 without a header: a whole sheet row inserted at row 3
  // would cut through it, so only columns A:B move down.
  let wb = book({ D1: "n", E1: "m", D2: 1, E2: 1, D3: 2, E3: 2, D4: 3, E4: 3, D5: 4, E5: 4, A1: "Titel", A2: "Untertitel", A3: 7, B3: 8, A4: 9, B4: 10, A8: "unten" });
  wb = make(wb, "D1:E5").wb;
  const neighbour = wb.tables[0];
  const r = make(wb, "A3:B4");
  eq("new table", areaText(r.area), "A3:B5");
  eq("header", cell(r.wb, "A3")?.v, "Spalte1");
  eq("data moved", [cell(r.wb, "A4")?.v, cell(r.wb, "B5")?.v], [7, 10]);
  eq("below in the same columns moved too", cell(r.wb, "A9")?.v, "unten");
  eq("neighbour untouched", r.wb.tables.find((t) => t.id === neighbour.id)?.area, neighbour.area);
  eq("neighbour cells untouched", cell(r.wb, "D3")?.v, 2);
});

run("makeTable: more header cases", () => {
  section("makeTable: header cases");
  // Only names: a table to fill in, with one empty row
  const names = make(book({ A1: "Name", B1: "Alter" }), "A1:B1");
  eq("names only → header", names.header, "found");
  eq("names only → one empty row", areaText(names.area), "A1:B2");
  const lone = make(book({ C3: "Name" }), "C3");
  eq("one name", areaText(lone.area), "C3:C4");
  // All text: data, like Excel …
  const words = make(book({ A1: "Name", A2: "Anna", A3: "Ben" }), "A1:A3");
  eq("all text → header added", words.header, "added");
  // … unless the first row looks like a header
  const bold = make(book({ A1: { v: "Name", s: { bold: true } }, A2: "Anna", A3: "Ben" }), "A1:A3");
  eq("bold first row → header", bold.header, "found");
  // Dates and true/false under text count as a different kind
  const dates = make(book({ A1: "Datum", A2: { v: 46000, s: { fmt: { kind: "date", style: "short" } } } }), "A1:A2");
  eq("dates under text", dates.header, "found");
  // A number in the first row: no header
  const num = make(book({ A1: "Name", B1: 5, A2: "x", B2: 6 }), "A1:B2");
  eq("number in first row", num.header, "added");
  // An empty header cell gets a name
  const gap = make(book({ A1: "Probe", C1: "Wert", A2: "a", B2: 1, C2: 2 }), "A1:C2");
  eq("gap filled", cell(gap.wb, "B1")?.v, "Spalte2");
  // Forced either way
  eq("forced yes", make(book({ A1: "Name", A2: "Anna" }), "A1:A2", "de", { header: "yes" }).header, "found");
  eq("forced no", make(book(LAB), "A1:C7", "de", { header: "no" }).header, "added");
  // A wished name
  eq("own name", only(make(book(LAB), "A1:C7", "de", { name: "Kalibrierung" }).wb).name, "Kalibrierung");
  eq("invalid own name falls back", only(make(book(LAB), "A1:C7", "de", { name: "1 Messung" }).wb).name, "Tabelle1");
  eq("spaces become _", only(make(book(LAB), "A1:C7", "de", { name: "Meine Werte" }).wb).name, "Meine_Werte");
  // Whole columns: only the rows with data
  const cols = make(book(LAB), "A1:C200");
  eq("whole columns trimmed", areaText(cols.area), "A1:C7");
});

// ==============================================================================================
section("filteredRows");
run(current, () => {
  const wb = make(book(LAB), "A1:C7").wb;
  eq("no filters", hidden(wb), []);
  // Values: by the text shown; "" = empty cells; any case
  eq("values", hidden(withFilter(wb, 0, { kind: "values", values: ["0,5", "2"] })), [2, 3, 5]);
  eq("values empty", hidden(withFilter(wb, 2, { kind: "values", values: [""] })), [2, 3, 4, 5, 7]);
  eq("values any case", hidden(withFilter(wb, 2, { kind: "values", values: ["STANDARD A", "Standard B"] })), [2, 5, 6, 7]);
  eq("values English text", hidden(withFilter(wb, 0, { kind: "values", values: ["0.5"] }), "en"), [2, 3, 5, 6, 7]);
  // Numbers
  const num = (op: Extract<FilterSpec, { kind: "number" }>["op"], a: number | null, b: number | null = null) => hidden(withFilter(wb, 1, { kind: "number", op, a, b }));
  eq("gt", num("gt", 0.262), [2, 3, 4]);
  eq("gte", num("gte", 0.262), [2, 3]);
  eq("lt", num("lt", 0.262), [4, 5, 6, 7]);
  eq("lte", num("lte", 0.262), [5, 6, 7]);
  eq("eq", num("eq", 0.521), [2, 3, 4, 6, 7]);
  eq("neq", num("neq", 0.521), [5]);
  eq("between inclusive", num("between", 0.135, 0.521), [2, 6, 7]);
  eq("between reversed", num("between", 0.521, 0.135), [2, 6, 7]);
  eq("between open end", num("between", 0.9, null), [2, 3, 4, 5]);
  eq("top 2", num("top", 2), [2, 3, 4, 5]);
  eq("bottom 2", num("bottom", 2), [4, 5, 6, 7]);
  eq("top default 10 = all", num("top", null), []);
  eq("above average", num("aboveAverage", null), [2, 3, 4]);
  eq("below average", num("belowAverage", null), [5, 6, 7]);
  eq("no value: no condition", num("gt", null), []);
  // Ties stay: the two largest of 0, 0.25, 0.5, 1, 2, 2 are both 2s; the 3 largest keep the 1 too
  const conc = (op: "top" | "bottom", n: number) => hidden(withFilter(wb, 0, { kind: "number", op, a: n, b: null }));
  eq("top 1 with a tie", conc("top", 1), [2, 3, 4, 5]);
  eq("top 3", conc("top", 3), [2, 3, 4]);
  // Text conditions ignore case; ? and * are wildcards
  const text = (op: Extract<FilterSpec, { kind: "text" }>["op"], s: string) => hidden(withFilter(wb, 2, { kind: "text", op, text: s }));
  eq("contains", text("contains", "STANDARD"), [2, 5, 6, 7]);
  eq("not contains", text("notContains", "probe"), [5, 7]);
  eq("begins", text("begins", "pro"), [2, 3, 4, 6]);
  eq("ends", text("ends", "a"), [2, 4, 5, 6, 7]);
  eq("equals", text("equals", "blank"), [3, 4, 5, 6, 7]);
  eq("equals wildcard", text("equals", "probe ?"), [2, 3, 4, 6]);
  eq("contains star", text("contains", "st*b"), [2, 3, 5, 6, 7]);
  eq("equals empty", text("equals", ""), [2, 3, 4, 5, 7]);
  eq("contains nothing: no condition", text("contains", ""), []);
  // Text filters read what a number shows
  eq("text on numbers", hidden(withFilter(wb, 1, { kind: "text", op: "begins", text: "0,2" })), [2, 3, 5, 6, 7]);
  // Several filters: all must pass
  let both = withFilter(wb, 0, { kind: "number", op: "gte", a: 0.5, b: null });
  both = withFilter(both, 2, { kind: "text", op: "contains", text: "probe" });
  eq("AND", hidden(both), [2, 3, 4, 6]);
  // A filter of a column that is gone does nothing
  const t = only(wb);
  eq("unknown column", hidden(O.putTable(wb, { ...t, filters: { nope: { kind: "values", values: [] } } })), []);
  // Number formats decide what a value shows
  const fmt = O.setStyle(wb, "s1", [A("B2:B7")], { fmt: { kind: "number", decimals: 1 } });
  eq("values by shown text", hidden(withFilter(fmt, 1, { kind: "values", values: ["0,5"] })), [2, 3, 4, 6, 7]);
  eq("values by shown text (two show alike)", hidden(withFilter(fmt, 1, { kind: "values", values: ["1,0"] })), [2, 3, 4, 5]);
  // Errors show in the user's language
  const err = O.setCells(wb, "s1", [{ row: 2, col: 1, cell: { f: "1/0" } }]);
  eq("error value", hidden(withFilter(err, 1, { kind: "values", values: ["#DIV/0!"] })), [2, 4, 5, 6, 7]);
  const bad = O.setCells(wb, "s1", [{ row: 2, col: 1, cell: { f: "\"a\"+1" } }]);
  eq("German error text", hidden(withFilter(bad, 1, { kind: "values", values: ["#WERT!"] })), [2, 4, 5, 6, 7]);
});

run("filteredRows: 5000 rows", () => {
  section("filteredRows: speed");
  const big: Record<string, CellInput> = { A1: "Probe", B1: "Wert" };
  for (let r = 2; r <= 5001; r++) {
    big[`A${r}`] = `Probe ${r % 40}`;
    big[`B${r}`] = (r * 37) % 1000;
  }
  let wb = make(book(big), "A1:B5001").wb;
  const t = only(wb);
  wb = T.setTableFilter(wb, t.id, t.columns[0].id, { kind: "values", values: ["Probe 1", "Probe 2", "Probe 3"] });
  wb = T.setTableFilter(wb, t.id, t.columns[1].id, { kind: "number", op: "top", a: 2000, b: null });
  const calc = calcOf(wb);
  const t0 = performance.now();
  const rows = T.filteredRows(wb, calc, "s1", "de");
  const ms = performance.now() - t0;
  check("5000 rows, two filters quickly", ms < 600, `${ms.toFixed(0)} ms`);
  check("plausible", rows.size > 4500 && rows.size < 5000, String(rows.size));
  const t1 = performance.now();
  const values = T.columnValues(calc, O.sheetById(wb, "s1")!, only(wb), 0, "de");
  check("values of 5000 rows quickly", performance.now() - t1 < 600);
  eq("distinct values (other filter applied)", values.length <= 40, true);
});

run("filteredRows: header and totals never hidden", () => {
  section("filteredRows: header and totals");
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  wb = withFilter(wb, 0, { kind: "values", values: ["nothing"] });
  const rows = hidden(wb);
  eq("only data rows", rows, [2, 3, 4, 5, 6, 7]);
  // Another sheet's tables don't count
  eq("other sheet", [...T.filteredRows(wb, calcOf(wb), "s2", "de")], []);
});

// ==============================================================================================
section("setTableFilter");
run(current, () => {
  const wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  const f: FilterSpec = { kind: "values", values: ["0"] };
  const w1 = T.setTableFilter(wb, t.id, t.columns[0].id, f);
  eq("set", only(w1).filters, { [t.columns[0].id]: f });
  check("same filter → same workbook", T.setTableFilter(w1, t.id, t.columns[0].id, { kind: "values", values: ["0"] }) === w1);
  const w2 = T.setTableFilter(w1, t.id, t.columns[0].id, null);
  eq("removed", only(w2).filters, {});
  check("removing nothing → same workbook", T.setTableFilter(w2, t.id, t.columns[0].id, null) === w2);
  check("unknown column → same", T.setTableFilter(wb, t.id, "nope", f) === wb);
  check("unknown table → same", T.setTableFilter(wb, "nope", t.columns[0].id, f) === wb);
  const w3 = T.setTableFilter(T.setTableFilter(wb, t.id, t.columns[0].id, f), t.id, t.columns[1].id, f);
  eq("two filters", Object.keys(only(w3).filters).length, 2);
  eq("clear all", only(T.clearTableFilters(w3, t.id)).filters, {});
});

// ==============================================================================================
section("sortTable");
run(current, () => {
  let wb = book({ ...LAB, D1: "Doppelt", D2: "=B2*2", D3: "=B3*2", D4: "=B4*2", D5: "=B5*2", D6: "=B6*2", D7: "=B7*2" });
  wb = make(wb, "A1:D7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const desc = T.sortTable(wb, calcOf(wb), t.id, t.columns[1].id, "desc", "de");
  const col = (w: Workbook, c: string) => [2, 3, 4, 5, 6, 7].map((r) => cell(w, `${c}${r}`)?.v ?? null);
  eq("sorted desc", col(desc, "B"), [1.043, 0.98, 0.521, 0.262, 0.135, 0.002]);
  eq("rows moved together", col(desc, "C"), ["", "Probe 2", "Probe 1", "standard b", "Standard A", "Blank"]);
  eq("header untouched", cell(desc, "B1")?.v, "Extinktion");
  eq("totals row untouched", cell(desc, "A8")?.v, "Ergebnis");
  eq("formulas move with their row", [cell(desc, "D2")?.f, cell(desc, "D7")?.f], ["B2*2", "B7*2"]);
  eq("formula values", val(desc, "D2"), 2.086);
  eq("sort remembered", only(desc).sort, { column: t.columns[1].id, dir: "desc" });
  const asc = T.sortTable(desc, calcOf(desc), t.id, t.columns[2].id, "asc", "de");
  // Text in the user's language, any case; empty cells last
  eq("text asc", col(asc, "C"), ["Blank", "Probe 1", "Probe 2", "Standard A", "standard b", ""]);
  eq("sort switched", only(asc).sort, { column: t.columns[2].id, dir: "asc" });
  check("unknown column → same", T.sortTable(wb, calcOf(wb), t.id, "nope", "asc", "de") === wb);
  check("sorting sorted data again → same", T.sortTable(asc, calcOf(asc), t.id, t.columns[2].id, "asc", "de") === asc);
});

// ==============================================================================================
section("setTotals");
run(current, () => {
  let wb = make(book({ ...LAB, A10: "darunter" }), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const t1 = only(wb);
  eq("totals on", t1.totals, true);
  eq("area grows", areaText(t1.area), "A1:C8");
  eq("label", cell(wb, "A8")?.v, "Ergebnis");
  eq("sum under the last numeric column", cell(wb, "B8")?.f, "SUBTOTAL(109,B2:B7)");
  eq("text column: nothing", cell(wb, "C8"), undefined);
  eq("remembered", t1.columns.map((c) => c.total), ["none", "sum", "none"]);
  near("value", val(wb, "B8"), 2.943);
  eq("nothing below moved (free row)", cell(wb, "A10")?.v, "darunter");
  // Rows a filter hides don't count
  const filtered = withFilter(wb, 2, { kind: "text", op: "contains", text: "probe" });
  near("filtered total", val(filtered, "B8"), 1.501);
  // Off: the row goes, the functions stay remembered
  const off = T.setTotals(wb, calcOf(wb), t.id, false, "de");
  eq("off", only(off).totals, false);
  eq("area shrinks", areaText(only(off).area), "A1:C7");
  eq("cells cleared", [cell(off, "A8"), cell(off, "B8")], [undefined, undefined]);
  eq("functions remembered", only(off).columns.map((c) => c.total), ["none", "sum", "none"]);
  const average = T.setColumnTotal(off, t.id, t.columns[1].id, "average");
  const on = T.setTotals(average, calcOf(average), t.id, true, "de");
  eq("on again with the remembered function", cell(on, "B8")?.f, "SUBTOTAL(101,B2:B7)");
  check("same state → same workbook", T.setTotals(wb, calcOf(wb), t.id, true, "de") === wb);
  // English label
  const en = make(book(LAB), "A1:C7", "en").wb;
  const enOn = T.setTotals(en, calcOf(en, "en"), only(en).id, true, "en");
  eq("English label", cell(enOn, "A8")?.v, "Total");
  // A text-only table counts under its last column
  const words = make(book({ A1: { v: "Name", s: { bold: true } }, B1: { v: "Ort", s: { bold: true } }, A2: "Anna", B2: "Kiel", A3: "Ben" }), "A1:B3").wb;
  const wordsOn = T.setTotals(words, calcOf(words), only(words).id, true, "de");
  eq("count under the last column", cell(wordsOn, "B4")?.f, "SUBTOTAL(103,B2:B3)");
  eq("count value", val(wordsOn, "B4"), 1);
  // Numbers only in the first column: label stays, the last column counts
  const first = make(book({ A1: "Zeit", B1: "Notiz", A2: 1, B2: "a", A3: 2 }), "A1:B3").wb;
  const firstOn = T.setTotals(first, calcOf(first), only(first).id, true, "de");
  eq("label kept", cell(firstOn, "A4")?.v, "Ergebnis");
  eq("count in the last column", cell(firstOn, "B4")?.f, "SUBTOTAL(103,B2:B3)");
  // A one-column table shows its sum
  const one = make(book({ A1: "Wert", A2: 1, A3: 2 }), "A1:A3").wb;
  const oneOn = T.setTotals(one, calcOf(one), only(one).id, true, "de");
  eq("one column: sum", cell(oneOn, "A4")?.f, "SUBTOTAL(109,A2:A3)");
});

run("setTotals: content below moves down", () => {
  section("setTotals: room below");
  let wb = make(book({ ...LAB, A8: "direkt darunter", B9: "=B8" }), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  eq("totals in row 8", cell(wb, "A8")?.v, "Ergebnis");
  eq("content moved down", cell(wb, "A9")?.v, "direkt darunter");
  eq("its references followed", cell(wb, "B10")?.f, "B9");
  // A table beside: only the table's columns move
  let side = book({ ...LAB, A8: "unter A", E1: "n", E2: 1, E3: 2, E4: 3, E5: 4, E6: 5, E7: 6, E8: 7, E9: 8 });
  side = make(side, "E1:E9").wb;
  const neighbour = side.tables[0];
  side = make(side, "A1:C7").wb;
  const lab = side.tables[1];
  side = T.setTotals(side, calcOf(side), lab.id, true, "de");
  eq("label", cell(side, "A8")?.v, "Ergebnis");
  eq("moved within the columns", cell(side, "A9")?.v, "unter A");
  eq("neighbour untouched", side.tables.find((x) => x.id === neighbour.id)?.area, neighbour.area);
  eq("neighbour cells untouched", cell(side, "E9")?.v, 8);
});

// ==============================================================================================
section("setColumnTotal");
run(current, () => {
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const b = t.columns[1].id;
  const cases: [Parameters<typeof T.setColumnTotal>[3], string, number][] = [
    ["sum", "SUBTOTAL(109,B2:B7)", 2.943],
    ["average", "SUBTOTAL(101,B2:B7)", 2.943 / 6],
    ["count", "SUBTOTAL(103,B2:B7)", 6],
    ["countNumbers", "SUBTOTAL(102,B2:B7)", 6],
    ["min", "SUBTOTAL(105,B2:B7)", 0.002],
    ["max", "SUBTOTAL(104,B2:B7)", 1.043],
  ];
  for (const [fn, f, v] of cases) {
    const w = T.setColumnTotal(wb, t.id, b, fn);
    eq(`${fn} formula`, cell(w, "B8")?.f, f);
    near(`${fn} value`, val(w, "B8"), v);
    eq(`${fn} remembered`, only(w).columns[1].total, fn);
  }
  const nums = [0.002, 0.135, 0.262, 0.521, 1.043, 0.98];
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  const variance = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1);
  const sd = T.setColumnTotal(wb, t.id, b, "stdev");
  eq("stdev formula", cell(sd, "B8")?.f, "SUBTOTAL(107,B2:B7)");
  near("stdev value", val(sd, "B8"), Math.sqrt(variance));
  const vr = T.setColumnTotal(wb, t.id, b, "var");
  eq("var formula", cell(vr, "B8")?.f, "SUBTOTAL(110,B2:B7)");
  near("var value", val(vr, "B8"), variance);
  const none = T.setColumnTotal(wb, t.id, b, "none");
  eq("none clears", cell(none, "B8"), undefined);
  // The first column: a function replaces the label, "none" with a language brings it back
  const a = t.columns[0].id;
  const aSum = T.setColumnTotal(wb, t.id, a, "max");
  eq("first column function", cell(aSum, "A8")?.f, "SUBTOTAL(104,A2:A7)");
  eq("first column back to label", cell(T.setColumnTotal(aSum, t.id, a, "none", "de"), "A8")?.v, "Ergebnis");
  check("same function → same workbook", T.setColumnTotal(wb, t.id, b, "sum") === wb);
  // Without a totals row only the remembered function changes
  const plain = make(book(LAB), "A1:C7").wb;
  const pt = only(plain);
  const remembered = T.setColumnTotal(plain, pt.id, pt.columns[1].id, "max");
  eq("remembered only", only(remembered).columns[1].total, "max");
  eq("no cell written", cell(remembered, "B8"), undefined);
  // The column's number format carries over to sums, not to counts
  const fmt = O.setStyle(wb, "s1", [A("B2:B7")], { fmt: { kind: "number", decimals: 3, unit: "AU" } });
  const fmtSum = T.setColumnTotal(T.setColumnTotal(fmt, t.id, b, "none"), t.id, b, "sum");
  eq("sum takes the format", cell(fmtSum, "B8")?.s?.fmt, { kind: "number", decimals: 3, unit: "AU" });
  eq("count drops it", cell(T.setColumnTotal(fmtSum, t.id, b, "count"), "B8")?.s?.fmt, undefined);
  // Reading a totals cell back
  eq("totalOfCell sum", T.totalOfCell(cell(wb, "B8"), 1), "sum");
  eq("totalOfCell label", T.totalOfCell(cell(wb, "A8"), 0), "none");
  eq("totalOfCell custom", T.totalOfCell({ f: "SUM(B2:B7)*2" }, 1), "custom");
  eq("totalOfCell other column", T.totalOfCell({ f: "SUBTOTAL(109,C2:C7)" }, 1), "custom");
  eq("parse 9 = sum", T.parseTotalFormula("SUBTOTAL(9,$B$2:$B$7)")?.fn, "sum");
});

// ==============================================================================================
section("look and names");
run(current, () => {
  const wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  eq("rename", only(T.setTableLook(wb, t.id, { name: "Kalibrierung" })).name, "Kalibrierung");
  eq("rename spaces", only(T.setTableLook(wb, t.id, { name: " Meine Werte " })).name, "Meine_Werte");
  check("invalid name ignored", T.setTableLook(wb, t.id, { name: "A1" }) === wb);
  check("empty name ignored", T.setTableLook(wb, t.id, { name: "  " }) === wb);
  eq("style", only(T.setTableLook(wb, t.id, { style: "teal" })).style, "teal");
  eq("banded", only(T.setTableLook(wb, t.id, { banded: false })).banded, false);
  check("no change → same", T.setTableLook(wb, t.id, { style: "purple", banded: true, name: "Tabelle1" }) === wb);
  // Names
  eq("unique 1", T.uniqueTableName({ ...wb, tables: [] }, "de"), "Tabelle1");
  eq("unique 2", T.uniqueTableName(wb, "de"), "Tabelle2");
  eq("unique en", T.uniqueTableName(wb, "en"), "Table1");
  eq("base free", T.uniqueTableName(wb, "de", "Kalibrierung"), "Kalibrierung");
  eq("base taken", T.uniqueTableName(wb, "de", "tabelle1"), "tabelle2");
  const k = T.setTableLook(wb, t.id, { name: "Kalibrierung" });
  eq("base taken without number", T.uniqueTableName(k, "de", "Kalibrierung"), "Kalibrierung2");
  eq("short letters stay apart from cells", T.uniqueTableName(T.setTableLook(wb, t.id, { name: "AB" }), "de", "AB"), "AB_2");
  for (const [name, ok] of [
    ["Tabelle1", true],
    ["Kalibrierung_2026", true],
    ["Größe", true],
    ["_x", true],
    ["a.b", true],
    ["A1", false],
    ["XFD100", false],
    ["R1C1", false],
    ["r", false],
    ["1abc", false],
    ["mit Leerzeichen", false],
    ["", false],
  ] as const) {
    eq(`valid ${name}`, T.validTableName(name), ok);
  }
  const two = O.putTable(wb, { ...t, id: "t2", name: "Andere", area: A("H1:H2") });
  eq("problem taken", T.tableNameProblem(two, t.id, "andere"), "taken");
  eq("problem invalid", T.tableNameProblem(two, t.id, "1x"), "invalid");
  eq("problem empty", T.tableNameProblem(two, t.id, " "), "empty");
  eq("no problem (own name)", T.tableNameProblem(two, t.id, "TABELLE1"), null);
});

// ==============================================================================================
section("afterInput");
run(current, () => {
  const base = make(book(LAB), "A1:C7").wb;
  const t = only(base);
  const type = (wb: Workbook, a1: string, input: string, locale: Locale = "de") => {
    const p = at(a1);
    const parsed = E.parseInput(input, locale, O.getCell(wb, "s1", p.row, p.col));
    const w1 = O.setCells(wb, "s1", [{ row: p.row, col: p.col, cell: { ...O.getCell(wb, "s1", p.row, p.col), ...parsed.cell } }]);
    return T.afterInput(w1, calcOf(w1, locale), "s1", p.row, p.col);
  };
  // Below: the table grows
  const below = type(base, "B8", "0,7");
  eq("grows a row", areaText(only(below).area), "A1:C8");
  // Beside: a new column with a name
  const beside = type(base, "D3", "x");
  eq("grows a column", areaText(only(beside).area), "A1:D7");
  eq("new column", only(beside).columns.length, 4);
  eq("new column total", only(beside).columns[3].total, "none");
  eq("new column header", cell(beside, "D1")?.v, "Spalte4");
  const named = type(base, "D1", "Verdünnung");
  eq("typed into the header beside", [areaText(only(named).area), cell(named, "D1")?.v], ["A1:D7", "Verdünnung"]);
  // Not diagonally, not two rows below, not when empty
  check("diagonal → nothing", type(base, "D8", "1").tables[0].area.r1 === 6 && type(base, "D8", "1").tables[0].area.c1 === 2);
  eq("two rows below", areaText(only(type(base, "A9", "1")).area), "A1:C7");
  // With a totals row, typing below the totals doesn't grow it
  const withTotals = T.setTotals(base, calcOf(base), t.id, true, "de");
  eq("below totals", areaText(only(type(withTotals, "A9", "1")).area), "A1:C8");
  // Nothing to do → the same workbook
  const p = at("B3");
  const w1 = O.setCells(base, "s1", [{ row: p.row, col: p.col, cell: { v: 0.2 } }]);
  check("plain edit → same", T.afterInput(w1, calcOf(w1), "s1", p.row, p.col) === w1);
  check("outside → same", T.afterInput(base, calcOf(base), "s1", 20, 10) === base);
  // English name for a new column, from the locale
  const en = make(book(LAB), "A1:C7", "en").wb;
  eq("English new column", cell(type(en, "D2", "1", "en"), "D1")?.v, "Column4");
  // A header emptied gets a name back
  const emptied = O.setCells(base, "s1", [{ row: 0, col: 1, cell: null }]);
  eq("header back", cell(T.afterInput(emptied, calcOf(emptied), "s1", 0, 1), "B1")?.v, "Spalte2");
});

run("afterInput: calculated columns", () => {
  section("afterInput: calculated columns");
  const base = make(book({ ...LAB, D1: "Doppelt" }), "A1:D7").wb;
  const type = (wb: Workbook, a1: string, formula: string) => {
    const p = at(a1);
    const w1 = O.setCells(wb, "s1", [{ row: p.row, col: p.col, cell: { ...O.getCell(wb, "s1", p.row, p.col), v: undefined, f: formula } }]);
    return T.afterInput(w1, calcOf(w1), "s1", p.row, p.col);
  };
  // A formula in an empty column fills the whole column
  const filled = type(base, "D3", "B3*2");
  eq("filled down and up", [2, 3, 4, 5, 6, 7].map((r) => cell(filled, `D${r}`)?.f), ["B2*2", "B3*2", "B4*2", "B5*2", "B6*2", "B7*2"]);
  eq("values", val(filled, "D7"), 1.96);
  eq("header untouched", cell(filled, "D1")?.v, "Doppelt");
  // A new formula in a calculated column replaces it
  const replaced = type(filled, "D5", "B5*3+$A$2");
  eq("replaced", [cell(replaced, "D2")?.f, cell(replaced, "D7")?.f], ["B2*3+$A$2", "B7*3+$A$2"]);
  // Values typed by hand are never overwritten
  const manual = O.setCells(base, "s1", [{ row: 2, col: 3, cell: { v: 5 } }]);
  const kept = type(manual, "D4", "B4*2");
  eq("values block it", [cell(kept, "D3")?.v, cell(kept, "D5")], [5, undefined]);
  // Different formulas block it too
  const mixed = O.setCells(base, "s1", [
    { row: 1, col: 3, cell: { f: "B2*2" } },
    { row: 2, col: 3, cell: { f: "B3+1" } },
  ]);
  const notFilled = type(mixed, "D5", "B5*2");
  eq("mixed formulas block it", cell(notFilled, "D6"), undefined);
  // Not into the totals row or the header
  const totals = T.setTotals(base, calcOf(base), only(base).id, true, "de");
  const withTotals = type(totals, "D3", "B3*2");
  eq("not into the totals row", cell(withTotals, "D8")?.f ?? null, null);
  eq("but all data rows", cell(withTotals, "D7")?.f, "B7*2");
  // A formula typed beside the table makes a calculated column of a new column
  const beside = type(base, "E2", "A2+B2");
  eq("new calculated column", [areaText(only(beside).area), cell(beside, "E1")?.v, cell(beside, "E7")?.f], ["A1:E7", "Spalte5", "A7+B7"]);
  // Growing a row continues calculated columns and number formats
  const fmt = O.setStyle(filled, "s1", [A("B2:B7")], { fmt: { kind: "number", decimals: 3 } });
  const p = at("B8");
  const typed = O.setCells(fmt, "s1", [{ row: p.row, col: p.col, cell: { v: 1.5 } }]);
  const grown = T.afterInput(typed, calcOf(typed), "s1", p.row, p.col);
  eq("grown", areaText(only(grown).area), "A1:D8");
  eq("calculated column continues", cell(grown, "D8")?.f, "B8*2");
  eq("its value", val(grown, "D8"), 3);
  eq("format carries on", cell(grown, "B8")?.s?.fmt, { kind: "number", decimals: 3 });
  eq("plain columns stay empty", cell(grown, "C8")?.v, undefined);
  // 5000 rows: quick
  const big: Record<string, CellInput> = { A1: "x", B1: "y" };
  for (let r = 2; r <= 5000; r++) big[`A${r}`] = r;
  const bigWb = make(book(big), "A1:B5000").wb;
  const t0 = performance.now();
  const bigFilled = type(bigWb, "B2", "A2*2");
  const ms = performance.now() - t0;
  eq("5000 rows filled", cell(bigFilled, "B5000")?.f, "A5000*2");
  check("5000 rows quickly", ms < 2500, `${ms.toFixed(0)} ms`);
});

run("afterPaste", () => {
  section("afterPaste");
  // A table with a calculated column and a number format
  let base = make(book({ ...LAB, D1: "Doppelt" }), "A1:D7").wb;
  base = O.setCells(base, "s1", [{ row: 1, col: 3, cell: { f: "B2*2" } }]);
  base = T.afterInput(base, calcOf(base), "s1", 1, 3);
  base = O.setStyle(base, "s1", [A("B2:B7")], { fmt: { kind: "number", decimals: 3 } });
  const paste = (wb: Workbook, a1: string, rows: string[][]) => {
    const p = at(a1);
    const w1 = O.pasteText(wb, "s1", p, rows, "de");
    return T.afterPaste(w1, calcOf(w1), "s1", { r0: p.row, c0: p.col, r1: p.row + rows.length - 1, c1: p.col + Math.max(...rows.map((r) => r.length)) - 1 });
  };
  // Rows pasted right below: the table grows, the calculated column and the format continue
  const below = paste(base, "A8", [
    ["4", "1,9", "Probe 3"],
    ["8", "3,7", "Probe 4"],
  ]);
  eq("grows over the pasted rows", areaText(only(below).area), "A1:D9");
  eq("calculated column continues", [cell(below, "D8")?.f, cell(below, "D9")?.f], ["B8*2", "B9*2"]);
  near("its value", val(below, "D9"), 7.4);
  eq("format carries on", cell(below, "B9")?.s?.fmt, { kind: "number", decimals: 3 });
  // Trailing empty rows of the paste don't count
  const trailing = paste(base, "A8", [["5", "2"], ["", ""], ["", ""]]);
  eq("only rows with data", areaText(only(trailing).area), "A1:D8");
  // A paste that starts in the table and runs past its end
  const over = paste(base, "A6", [["1"], ["2"], ["3"]]);
  eq("from inside past the end", areaText(only(over).area), "A1:D8");
  // Far below, or with a totals row: nothing
  check("far below → same", (() => {
    const w1 = O.pasteText(base, "s1", at("A12"), [["1"]], "de");
    return T.afterPaste(w1, calcOf(w1), "s1", A("A12")) === w1;
  })());
  const totals = T.setTotals(base, calcOf(base), only(base).id, true, "de");
  eq("not past a totals row", areaText(only(paste(totals, "A9", [["1"]])).area), "A1:D8");
  // Columns pasted beside: new columns with names (pasted names kept)
  const beside = paste(base, "E1", [
    ["Verdünnung", ""],
    ["1", "2"],
  ]);
  eq("grows right", [areaText(only(beside).area), only(beside).columns.length], ["A1:F7", 6]);
  eq("names", [cell(beside, "E1")?.v, cell(beside, "F1")?.v], ["Verdünnung", "Spalte6"]);
  check("other sheet → same", T.afterPaste(base, calcOf(base), "s2", A("A8")) === base);
});

run("afterInput: totals follow inserted rows", () => {
  section("afterInput: totals ranges");
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  // A row inserted right above the totals row: ops.insertRows puts the range right at once
  const ins = O.insertRows(wb, "s1", 7, 1);
  eq("table grew", areaText(only(ins).area), "A1:C9");
  eq("range covers the new row right after inserting", cell(ins, "B9")?.f, "SUBTOTAL(109,B2:B8)");
  eq("…also when it is pasted into, before anything is typed", cell(T.afterPaste(O.pasteText(ins, "s1", at("B8"), [["10"]], "de"), calcOf(ins), "s1", A("B8")), "B9")?.f, "SUBTOTAL(109,B2:B8)");
  const typed = O.setCells(ins, "s1", [{ row: 7, col: 1, cell: { v: 10 } }]);
  const fixed = T.afterInput(typed, calcOf(typed), "s1", 7, 1);
  eq("range covers the new row", cell(fixed, "B9")?.f, "SUBTOTAL(109,B2:B8)");
  near("total includes it", val(fixed, "B9"), 12.943);
  // A row inserted right under the header
  const top = O.insertRows(wb, "s1", 1, 1);
  eq("under the header: right after inserting", cell(top, "B9")?.f, "SUBTOTAL(109,B2:B8)");
  eq("refresh alone", cell(T.refreshTotals(top, "s1"), "B9")?.f, "SUBTOTAL(109,B2:B8)");
  near("the total includes a value typed there", val(O.setCells(top, "s1", [{ row: 1, col: 1, cell: { v: 1 } }]), "B9"), 3.943);
  // Deleting rows keeps them right too
  const delTop = O.deleteRows(top, "s1", 1, 1);
  eq("deleting the row again", cell(delTop, "B8")?.f, "SUBTOTAL(109,B2:B7)");
  // Formulas typed by hand into the totals row are left alone
  const own = O.setCells(wb, "s1", [{ row: 7, col: 2, cell: { f: "COUNTA(C2:C5)" } }]);
  check("own formula kept", T.refreshTotals(own, "s1") === own);
});

// ==============================================================================================
// A calibration as in the templates: a title, the table B5:D11 (header row 5, six standards with
// their standard deviations), slope, intercept, R² and more below it, a second sheet that uses
// them, and a scatter chart with custom error bars.
const CAL: Record<string, CellInput> = {
  B2: "Kalibriergerade",
  B5: "Konzentration (mg/L)",
  C5: "Extinktion",
  D5: "SD",
  ...Object.fromEntries([0, 2, 4, 6, 8, 10].map((x, i) => [`B${6 + i}`, x])),
  ...Object.fromEntries([0.002, 0.105, 0.208, 0.312, 0.418, 0.521].map((y, i) => [`C${6 + i}`, y])),
  ...Object.fromEntries([0.001, 0.003, 0.002, 0.004, 0.003, 0.005].map((y, i) => [`D${6 + i}`, y])),
  B14: "Steigung",
  C14: "=SLOPE(C6:C11,B6:B11)",
  B15: "Achsenabschnitt",
  C15: "=INTERCEPT($C$6:$C$11,$B$6:$B$11)",
  B16: "R²",
  C16: "=RSQ(C6:C11,B6:B11)",
  B17: "Messwerte",
  C17: "=COUNT(C5:C11)",
  B18: "Ohne Blank",
  C18: "=AVERAGE(C7:C11)",
};
const rr = (a1: string, sheetId = "s1"): RangeRef => ({ sheetId, ...A(a1) });
function calChart(): ChartSpec {
  return {
    id: "ch1",
    sheetId: "s1",
    at: { row: 1, col: 6, dx: 0, dy: 0 },
    size: { w: 480, h: 320 },
    kind: "scatter",
    title: "",
    x: rr("B6:B11"),
    series: [
      {
        id: "se1",
        name: "",
        nameRef: rr("C5"),
        y: rr("C6:C11"),
        x: null,
        color: null,
        marker: "circle",
        line: "none",
        labels: false,
        errorBars: { kind: "custom", value: 0, plus: rr("D6:D11"), minus: rr("D6:D11"), direction: "both" },
        trendline: { type: "linear", order: 2, period: 2, intercept: null, showEquation: true, showR2: true, forward: 0, backward: 0, name: "" },
      },
    ],
    xAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    yAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    legend: "none",
  };
}
function calibration(extra: Record<string, CellInput> = {}, area = "B5:D11"): Workbook {
  const other = mkSheet({ A1: "=SLOPE('Blatt 1'!C6:C11,'Blatt 1'!B6:B11)", A2: "=SUM('Blatt 1'!C6:D11)", A3: "=SUM(C6:C11)", A4: "='Blatt 1'!C14" }, "s2", "Auswertung");
  return O.putChart(make(book({ ...CAL, ...extra }, [other]), area).wb, calChart());
}
/** Typed like the store does it: parsed, then the table's afterInput. */
function typeIn(wb: Workbook, a1: string, input: string, locale: Locale = "de"): Workbook {
  const p = at(a1);
  const cur = O.getCell(wb, "s1", p.row, p.col);
  const parsed = E.parseInput(input, locale, cur);
  const s = parsed.fmt && !cur?.s?.fmt ? { ...cur?.s, fmt: parsed.fmt } : cur?.s;
  const w1 = O.setCells(wb, "s1", [{ row: p.row, col: p.col, cell: { ...cur, v: parsed.cell.v, f: parsed.cell.f, s } }]);
  return T.afterInput(w1, calcOf(w1, locale), "s1", p.row, p.col, locale);
}
function pasteIn(wb: Workbook, a1: string, rows: string[][]): Workbook {
  const p = at(a1);
  const w1 = O.pasteText(wb, "s1", p, rows, "de");
  return T.afterPaste(w1, calcOf(w1), "s1", { r0: p.row, c0: p.col, r1: p.row + rows.length - 1, c1: p.col + Math.max(...rows.map((r) => r.length)) - 1 }, "de");
}
const fOf = (wb: Workbook, a1: string, sheetId = "s1") => cell(wb, a1, sheetId)?.f;
/** Least squares by hand, to check the engine's SLOPE and RSQ independently. */
function fit(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { slope: sxy / sxx, rsq: (sxy * sxy) / (sxx * syy) };
}
const XS = [0, 2, 4, 6, 8, 10];
const YS = [0.002, 0.105, 0.208, 0.312, 0.418, 0.521];

section("growing: formulas and charts follow the table");
run(current, () => {
  const wb = calibration();
  // A seventh standard typed right below the table
  let w = typeIn(wb, "B12", "12");
  eq("the table grew", areaText(only(w).area), "B5:D12");
  eq("slope", fOf(w, "C14"), "SLOPE(C6:C12,B6:B12)");
  eq("intercept ($ ranges)", fOf(w, "C15"), "INTERCEPT($C$6:$C$12,$B$6:$B$12)");
  eq("R²", fOf(w, "C16"), "RSQ(C6:C12,B6:B12)");
  eq("header row plus data", fOf(w, "C17"), "COUNT(C5:C12)");
  eq("part of the data stays", fOf(w, "C18"), "AVERAGE(C7:C11)");
  eq("the other sheet", [fOf(w, "A1", "s2"), fOf(w, "A2", "s2"), fOf(w, "A3", "s2"), fOf(w, "A4", "s2")], ["SLOPE('Blatt 1'!C6:C12,'Blatt 1'!B6:B12)", "SUM('Blatt 1'!C6:D12)", "SUM(C6:C11)", "'Blatt 1'!C14"]);
  const ch = w.charts[0];
  eq("chart x and y", [ch.x, ch.series[0].y], [rr("B6:B12"), rr("C6:C12")]);
  eq("chart error bars", [ch.series[0].errorBars?.plus, ch.series[0].errorBars?.minus], [rr("D6:D12"), rr("D6:D12")]);
  eq("chart legend name stays the header cell", ch.series[0].nameRef, rr("C5"));
  w = typeIn(w, "C12", "0,623");
  w = typeIn(w, "D12", "0,004");
  eq("typing the rest of the row changes nothing more", [areaText(only(w).area), fOf(w, "C14")], ["B5:D12", "SLOPE(C6:C12,B6:B12)"]);
  const f7 = fit([...XS, 12], [...YS, 0.623]);
  near("slope with seven standards", val(w, "C14"), f7.slope, 1e-12);
  near("R² with seven standards", val(w, "C16"), f7.rsq, 1e-12);
  near("…on the other sheet too", calcOf(w).value("s2", 0, 0), f7.slope, 1e-12);
  eq("count", val(w, "C17"), 7);
  // The chart now reads seven points
  const ys = calcOf(w).values(w.charts[0].series[0].y).map((r) => r[0]);
  eq("the chart's values", ys, [...YS, 0.623]);

  // Several standards pasted at once
  const pasted = pasteIn(wb, "B12", [
    ["12", "0,623", "0,004"],
    ["14", "0,727", "0,002"],
  ]);
  eq("paste: table grew by two", areaText(only(pasted).area), "B5:D13");
  eq("paste: slope and chart", [fOf(pasted, "C14"), pasted.charts[0].series[0].y], ["SLOPE(C6:C13,B6:B13)", rr("C6:C13")]);
  near("paste: slope value", val(pasted, "C14"), fit([...XS, 12, 14], [...YS, 0.623, 0.727]).slope, 1e-12);

  // A mean typed right below a column: the table takes the row (as in Excel), but the formula
  // never comes to include itself
  const mean = typeIn(wb, "C12", "=MITTELWERT(C6:C11)");
  eq("mean: kept as typed", fOf(mean, "C12"), "AVERAGE(C6:C11)");
  near("mean: no circle", val(mean, "C12"), YS.reduce((a, b) => a + b, 0) / 6, 1e-12);
  // A formula in the new row that uses other columns follows the table
  const sample = typeIn(wb, "D12", "=C12/STEIGUNG(C6:C11;B6:B11)");
  eq("new-row formula on other columns grows", fOf(sample, "D12"), "C12/SLOPE(C6:C12,B6:B12)");

  // A table on another sheet with the same addresses doesn't touch this one
  const twoTables = O.putTable(wb, { ...only(wb), id: "t2", name: "Andere", sheetId: "s2", columns: only(wb).columns.map((c, i) => ({ ...c, id: `o${i}` })) });
  const otherGrows = O.growTableReferences(twoTables, twoTables.tables[1], { r0: 5, r1: 10 }, { r0: 5, r1: 11 });
  eq("a table on another sheet: only references to that sheet", [fOf(otherGrows, "C14"), fOf(otherGrows, "A3", "s2"), fOf(otherGrows, "A1", "s2")], ["SLOPE(C6:C11,B6:B11)", "SUM(C6:C12)", "SLOPE('Blatt 1'!C6:C11,'Blatt 1'!B6:B11)"]);

  // With a totals row the table doesn't grow by typing below, so nothing follows
  const tot = T.setTotals(wb, calcOf(wb), only(wb).id, true, "de");
  const belowTot = typeIn(tot, "B13", "12");
  eq("totals row: nothing grows", [areaText(only(belowTot).area), fOf(belowTot, "C15")], ["B5:D12", fOf(tot, "C15")]);

  // Typed below a column that isn't the table's (diagonal): nothing
  eq("diagonal: nothing", fOf(typeIn(wb, "E12", "1"), "C14"), "SLOPE(C6:C11,B6:B11)");
});

run("growing: calculated columns stay one formula", () => {
  section("growing: calculated columns");
  // E: each standard's share of all absorbances, a calculated column over the whole column
  const extra: Record<string, CellInput> = { E5: "Anteil" };
  for (let r = 6; r <= 11; r++) extra[`E${r}`] = `=C${r}/SUM(C$6:C$11)`;
  const wb = calibration(extra, "B5:E11");
  const w = typeIn(wb, "B12", "12");
  eq("every row grows its range", [fOf(w, "E6"), fOf(w, "E11")], ["C6/SUM(C$6:C$12)", "C11/SUM(C$6:C$12)"]);
  eq("the new row continues the same formula", fOf(w, "E12"), "C12/SUM(C$6:C$12)");
  const p = pasteIn(wb, "B12", [["12", "0,623"], ["14", "0,727"]]);
  eq("pasted rows too", [fOf(p, "E6"), fOf(p, "E12"), fOf(p, "E13")], ["C6/SUM(C$6:C$13)", "C12/SUM(C$6:C$13)", "C13/SUM(C$6:C$13)"]);
  near("shares add up to 1", [6, 7, 8, 9, 10, 11, 12, 13].reduce((s, r) => s + (val(p, `E${r}`) as number), 0), 1, 1e-12);
  // 5000 standards, a calculated column over all of them: typing below stays quick
  const big: Record<string, CellInput> = { A1: "x", B1: "y", C1: "Anteil", F2: "=SLOPE(B2:B5001,A2:A5001)" };
  for (let r = 2; r <= 5001; r++) {
    big[`A${r}`] = r;
    big[`B${r}`] = r * 2;
    big[`C${r}`] = `=B${r}/SUM($B$2:$B$5001)`;
  }
  const bigWb = make(book(big), "A1:C5001").wb;
  const typed = O.setCells(bigWb, "s1", [{ row: 5001, col: 0, cell: { v: 5002 } }]);
  const calcBig = calcOf(typed);
  const t0 = performance.now();
  const grownBig = T.afterInput(typed, calcBig, "s1", 5001, 0, "de");
  const ms = performance.now() - t0;
  eq("5000 rows: slope and calculated column follow", [fOf(grownBig, "F2"), fOf(grownBig, "C2"), fOf(grownBig, "C5002")], ["SLOPE(B2:B5002,A2:A5002)", "B2/SUM($B$2:$B$5002)", "B5002/SUM($B$2:$B$5002)"]);
  check("5000 rows: typing below quickly", ms < 1500, `${ms.toFixed(0)} ms`);
});

run("growing: undo is one step (store)", () => {
  section("growing: undo");
  const store = createSheetStore({ pageId: "p1", workbook: calibration(), locale: "de", readOnly: false });
  store.input(at("B12"), "12");
  const s1 = store.get();
  eq("typed through the store: slope grows", [fOf(s1.workbook, "C14"), areaText(only(s1.workbook).area), s1.workbook.charts[0].series[0].y], ["SLOPE(C6:C12,B6:B12)", "B5:D12", rr("C6:C12")]);
  store.undo();
  const s2 = store.get();
  eq("one undo puts it all back", [fOf(s2.workbook, "C14"), cell(s2.workbook, "B12"), areaText(only(s2.workbook).area), s2.workbook.charts[0].series[0].y], ["SLOPE(C6:C11,B6:B11)", undefined, "B5:D11", rr("C6:C11")]);
  store.redo();
  eq("redo", fOf(store.get().workbook, "C14"), "SLOPE(C6:C12,B6:B12)");
});

run("rows inserted into a table (ops.ts)", () => {
  section("insertRows: calculated columns, formats, references");
  const extra: Record<string, CellInput> = { E5: "Berechnet" };
  for (let r = 6; r <= 11; r++) extra[`E${r}`] = `=(C${r}-$C$15)/$C$14`;
  let wb = calibration(extra, "B5:E11");
  wb = O.setStyle(wb, "s1", [A("C6:C11")], { fmt: { kind: "number", decimals: 3 } });
  // Between two standards
  const mid = O.insertRows(wb, "s1", 7, 1);
  eq("calculated column continues", fOf(mid, "E8"), "(C8-$C$16)/$C$15");
  eq("format continues", cell(mid, "C8")?.s?.fmt, { kind: "number", decimals: 3 });
  eq("ranges grow by themselves", [fOf(mid, "C15"), mid.charts[0].series[0].y], ["SLOPE(C6:C12,B6:B12)", rr("C6:C12")]);
  // Right under the header (the standards' formulas sit below the table and move down)
  const top = O.insertRows(wb, "s1", 5, 2);
  eq("under the header: table", areaText(only(top).area), "B5:E13");
  eq("…calculated column", [fOf(top, "E6"), fOf(top, "E7")], ["(C6-$C$17)/$C$16", "(C7-$C$17)/$C$16"]);
  eq("…format from the row below", cell(top, "C6")?.s?.fmt, { kind: "number", decimals: 3 });
  eq("…slope, chart and other sheet take the rows in", [fOf(top, "C16"), top.charts[0].x, top.charts[0].series[0].errorBars?.plus, fOf(top, "A1", "s2")], ["SLOPE(C6:C13,B6:B13)", rr("B6:B13"), rr("D6:D13"), "SLOPE('Blatt 1'!C6:C13,'Blatt 1'!B6:B13)"]);
  eq("…the header row plus data", fOf(top, "C19"), "COUNT(C5:C13)");
  const typed = typeIn(typeIn(top, "B6", "1"), "C6", "0,05");
  near("…values typed there count", val(typed, "C16"), fit([1, ...XS], [0.05, ...YS]).slope, 1e-12);
  // Right above the totals row
  const tot = T.setTotals(wb, calcOf(wb), only(wb).id, true, "de");
  const totArea = areaText(only(tot).area);
  const above = O.insertRows(tot, "s1", 11, 1);
  eq("above the totals row: table", [totArea, areaText(only(above).area)], ["B5:E12", "B5:E13"]);
  eq("…slope takes it in", fOf(above, "C15"), "SLOPE(C6:C12,B6:B12)");
  eq("…totals take it in", fOf(above, "E13"), "SUBTOTAL(109,E6:E12)");
  eq("…calculated column (the slope cells below moved down a row)", fOf(above, "E12"), "(C12-$C$16)/$C$15");
});

run("every data row deleted (ops.ts)", () => {
  section("deleteRows: one empty row stays");
  const extra: Record<string, CellInput> = { E5: "Anteil" };
  for (let r = 6; r <= 11; r++) extra[`E${r}`] = `=C${r}/SUM(C$6:C$11)`;
  let wb = calibration(extra, "B5:E11");
  wb = O.setStyle(wb, "s1", [A("C6:C11")], { fmt: { kind: "number", decimals: 3 } });
  wb = T.setTableFilter(wb, only(wb).id, only(wb).columns[0].id, { kind: "number", op: "gt", a: 3, b: null });
  const del = O.deleteRows(wb, "s1", 5, 6);
  eq("header and one row", areaText(only(del).area), "B5:E6");
  eq("the row is empty, keeping the calculated column and formats", [cell(del, "B6"), cell(del, "C6"), cell(del, "D6"), fOf(del, "E6")], [undefined, { s: { fmt: { kind: "number", decimals: 3 } } }, undefined, "C6/SUM(C$6:C$6)"]);
  eq("filters cleared", only(del).filters, {});
  eq("formulas below moved up and point at the row", [fOf(del, "C9"), fOf(del, "C10"), fOf(del, "C11")], ["SLOPE(C6:C6,B6:B6)", "INTERCEPT($C$6:$C$6,$B$6:$B$6)", "RSQ(C6:C6,B6:B6)"]);
  eq("the chart stays", [del.charts.length, del.charts[0].series[0].y], [1, rr("C6:C6")]);
  eq("other sheet", fOf(del, "A1", "s2"), "SLOPE('Blatt 1'!C6:C6,'Blatt 1'!B6:B6)");
  // New standards typed in: the table, the formulas and the chart grow again
  let w = typeIn(del, "B6", "0");
  w = typeIn(w, "C6", "0,002");
  w = typeIn(w, "B7", "2");
  w = typeIn(w, "C7", "0,105");
  w = typeIn(w, "B8", "4");
  w = typeIn(w, "C8", "0,208");
  eq("grew again", areaText(only(w).area), "B5:E8");
  eq("formulas follow again", [fOf(w, "C9"), fOf(w, "C11"), fOf(w, "E8")], ["SLOPE(C6:C8,B6:B8)", "RSQ(C6:C8,B6:B8)", "C8/SUM(C$6:C$8)"]);
  near("slope of the new standards", val(w, "C9"), fit([0, 2, 4], [0.002, 0.105, 0.208]).slope, 1e-12);
  eq("chart follows", [w.charts[0].x, w.charts[0].series[0].y], [rr("B6:B8"), rr("C6:C8")]);
  eq("format carried into the new rows", cell(w, "C8")?.s?.fmt, { kind: "number", decimals: 3 });
  // With a totals row: header, one row, totals; the total still works
  const tot0 = T.setTotals(wb, calcOf(wb), only(wb).id, true, "de");
  const tot = T.setColumnTotal(tot0, only(tot0).id, only(tot0).columns[1].id, "sum", "de");
  const delTot = O.deleteRows(tot, "s1", 5, 6);
  eq("with totals", [areaText(only(delTot).area), only(delTot).totals, fOf(delTot, "C7"), fOf(delTot, "E7")], ["B5:E7", true, "SUBTOTAL(109,C6:C6)", "SUBTOTAL(109,E6:E6)"]);
  eq("…a sum of the empty row is 0", val(delTot, "C7"), 0);
  // Undo through the store
  const store = createSheetStore({ pageId: "p1", workbook: wb, locale: "de", readOnly: false });
  store.apply("Zeilen löschen", (x) => O.deleteRows(x, "s1", 5, 6));
  eq("store: deleted", areaText(only(store.get().workbook).area), "B5:E6");
  store.undo();
  eq("store: undo brings the rows back", [areaText(only(store.get().workbook).area), fOf(store.get().workbook, "C14")], ["B5:E11", "SLOPE(C6:C11,B6:B11)"]);
});

run("columns inserted into a table (ops.ts)", () => {
  section("insertCols: header names");
  const wb = calibration();
  const de = O.insertCols(wb, "s1", 3, 1, "de");
  eq("German name", [cell(de, "D5")?.v, cell(de, "E5")?.v], ["Spalte3", "SD"]);
  eq("column names", T.columnNames(de, calcOf(de), only(de), "de"), ["Konzentration (mg/L)", "Extinktion", "Spalte3", "SD"]);
  eq("English name", cell(O.insertCols(wb, "s1", 3, 1, "en"), "D5")?.v, "Column3");
  eq("default German", cell(O.insertCols(wb, "s1", 3, 1), "D5")?.v, "Spalte3");
  const twice = O.insertCols(de, "s1", 3, 1, "de");
  eq("unique in the table", [cell(twice, "D5")?.v, cell(twice, "E5")?.v], ["Spalte4", "Spalte3"]);
  eq("left of the table: no name", cell(O.insertCols(wb, "s1", 1, 1, "de"), "B5"), undefined);
});

// ==============================================================================================
section("unmakeTable / deleteTable");
run(current, () => {
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const plain = T.unmakeTable(wb, t.id);
  eq("table gone", plain.tables.length, 0);
  eq("values stay", [cell(plain, "A1")?.v, cell(plain, "B5")?.v, cell(plain, "B8")?.f], ["Konzentration", 0.521, "SUBTOTAL(109,B2:B7)"]);
  eq("header keeps its look", cell(plain, "B1")?.s, { bold: true, fill: "purple" });
  eq("totals stay bold", cell(plain, "B8")?.s?.bold, true);
  eq("data look untouched", cell(plain, "B3")?.s, undefined);
  const own = O.setStyle(wb, "s1", [A("A1")], { fill: "yellow", bold: false });
  eq("own look wins", cell(T.unmakeTable(own, t.id), "A1")?.s, { fill: "yellow", bold: false });
  check("unknown → same", T.unmakeTable(wb, "nope") === wb);
  const gone = T.deleteTable(wb, t.id);
  eq("deleted", gone.tables.length, 0);
  eq("cells cleared", [cell(gone, "A1"), cell(gone, "C7"), cell(gone, "B8")], [undefined, undefined, undefined]);
});

// ==============================================================================================
section("columnNames / tableCellRole");
run(current, () => {
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const t1 = only(wb);
  const none = () => false;
  eq("header", T.tableCellRole(wb, "s1", 0, 1, none), { table: t1, part: "header", columnIndex: 1, band: 0 });
  eq("first data row", T.tableCellRole(wb, "s1", 1, 0, none)?.band, 0);
  eq("second data row", T.tableCellRole(wb, "s1", 2, 0, none)?.band, 1);
  eq("totals", T.tableCellRole(wb, "s1", 7, 2, none)?.part, "totals");
  eq("outside", T.tableCellRole(wb, "s1", 8, 0, none), null);
  eq("other sheet", T.tableCellRole(wb, "s2", 1, 0, none), null);
  // Banding counts the rows you see
  const hide = (r: number) => r === 2;
  eq("after a hidden row", T.tableCellRole(wb, "s1", 3, 0, hide)?.band, 1);
  eq("bands", [...T.tableBands(t1, hide)], [0, 0, 1, 0, 1, 0]);
  eq("bands all shown", [...T.tableBands(t1, none)], [0, 1, 0, 1, 0, 1]);
  // Names: the header text; an empty header shows the generic name
  const emptyHeader = O.setCells(wb, "s1", [{ row: 0, col: 2, cell: null }]);
  eq("names", T.columnNames(emptyHeader, calcOf(emptyHeader), t1, "de"), ["Konzentration", "Extinktion", "Spalte3"]);
  eq("tableAt", T.tableAt(wb, "s1", 5, 2)?.id, t.id);
  eq("tableAt outside", T.tableAt(wb, "s1", 5, 3), undefined);
});

// ==============================================================================================
section("structural changes (ops.ts)");
run(current, () => {
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTableFilter(wb, t.id, t.columns[2].id, { kind: "text", op: "contains", text: "probe" });
  eq("insert rows inside", areaText(only(O.insertRows(wb, "s1", 3, 2)).area), "A1:C9");
  eq("insert rows above", areaText(only(O.insertRows(wb, "s1", 0, 1)).area), "A2:C8");
  eq("insert rows below", areaText(only(O.insertRows(wb, "s1", 7, 1)).area), "A1:C7");
  const cols = O.insertCols(wb, "s1", 1, 1);
  eq("insert column inside", [areaText(only(cols).area), only(cols).columns.length], ["A1:D7", 4]);
  eq("column ids kept", [only(cols).columns[0].id, only(cols).columns[2].id], [t.columns[0].id, t.columns[1].id]);
  eq("filter kept on its column", Object.keys(only(cols).filters), [t.columns[2].id]);
  const del = O.deleteCols(wb, "s1", 2, 1);
  eq("delete filtered column", [areaText(only(del).area), only(del).filters], ["A1:B7", {}]);
  eq("delete header row → table gone", O.deleteRows(wb, "s1", 0, 1).tables.length, 0);
  const tot = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  const noTot = O.deleteRows(tot, "s1", 7, 1);
  eq("delete totals row", [only(noTot).totals, areaText(only(noTot).area)], [false, "A1:C7"]);
  // Cut and paste of the whole table moves it
  const clip = O.copyArea(wb, "s1", A("A1:C7"));
  const movedWb = O.pasteClip(wb, calcOf(wb), "s1", A("E3:G9"), clip, { mode: "all", cut: true });
  eq("moved with cut", areaText(only(movedWb).area), "E3:G9");
  // Filters still work after inserting rows
  eq("filter after insert", hidden(O.insertRows(wb, "s1", 1, 1)), [2, 3, 4, 5, 7]);

  // Every data row deleted: one empty data row stays (Excel), and the filters go with the data
  const emptied = O.deleteRows(wb, "s1", 1, 6);
  eq("one empty data row stays", [areaText(only(emptied).area), cell(emptied, "A2"), cell(emptied, "B2"), cell(emptied, "C2")], ["A1:C2", undefined, undefined, undefined]);
  eq("its filter goes (it would hide the row)", [only(emptied).filters, hidden(emptied)], [{}, []]);
  const typedIn = O.setCells(emptied, "s1", [{ row: 1, col: 1, cell: { v: 3 } }]);
  check("typing into it needs no growing", T.afterInput(typedIn, calcOf(typedIn), "s1", 1, 1) === typedIn);
  // A table with only its header (from older files, or totals switched off on an empty table) still behaves
  const bare = O.putTable(O.clearAreas(wb, "s1", [A("A2:C7")], "all"), { ...only(wb), area: A("A1:C1") });
  const tb = only(bare);
  eq("header only", areaText(tb.area), "A1:C1");
  eq("no rows hidden", hidden(bare), []);
  eq("sort does nothing to cells", T.sortTable(bare, calcOf(bare), tb.id, tb.columns[0].id, "asc", "de").sheets, bare.sheets);
  const bareTotals = T.setTotals(bare, calcOf(bare), tb.id, true, "de");
  eq("totals on a bare table", [areaText(only(bareTotals).area), cell(bareTotals, "A2")?.v], ["A1:C2", "Ergebnis"]);
  const typed = O.setCells(bare, "s1", [{ row: 1, col: 1, cell: { v: 3 } }]);
  eq("typing under the header grows it", areaText(only(T.afterInput(typed, calcOf(typed), "s1", 1, 1)).area), "A1:C2");
  const dec = buildDecorate(bare, calcOf(bare), "de", () => false, () => {});
  eq("bare decoration", [dec("s1", 0, 0)?.bold, dec("s1", 1, 0)], [true, null]);
  eq("bare bands", [...T.tableBands(tb, () => false)], []);
});

// ==============================================================================================
section("decoration");
run(current, () => {
  let wb = make(book(LAB), "A1:C7").wb;
  const t = only(wb);
  wb = T.setTotals(wb, calcOf(wb), t.id, true, "de");
  wb = T.setTableFilter(wb, t.id, t.columns[0].id, { kind: "number", op: "gt", a: 0, b: null });
  wb = T.sortTable(wb, calcOf(wb), t.id, t.columns[1].id, "asc", "de");
  const calc = calcOf(wb);
  const hiddenRows = T.filteredRows(wb, calc, "s1", "de");
  const opened: string[] = [];
  const decorate = buildDecorate(wb, calc, "de", (sheetId, row) => hiddenRows.has(row), (m) => opened.push(`${m.tableId}:${m.columnId}`));
  const h0 = decorate("s1", 0, 0);
  const h1 = decorate("s1", 0, 1);
  const h2 = decorate("s1", 0, 2);
  check("header: fill", !!h0?.fill && h0.fill.includes("--sheet-purple"));
  eq("header: bold, line", [h0?.bold, h0?.lineBelow], [true, "strong"]);
  eq("header buttons", [h0?.button?.state, h1?.button?.state, h2?.button?.state], ["filtered", "sortedAsc", "plain"]);
  eq("button label", h2?.button?.label, "Sortieren und filtern: Probe");
  h1?.button?.onClick({} as HTMLElement);
  eq("button opens the column's menu", opened, [`${t.id}:${t.columns[1].id}`]);
  const tot = decorate("s1", 7, 1);
  eq("totals: bold, line above", [tot?.bold, tot?.lineAbove], [true, "strong"]);
  // Row 2 (index 1) is hidden by the filter (concentration 0): the shown rows band 0, 1, 0…
  const bands = [2, 3, 4, 5, 6].map((r) => (decorate("s1", r, 0)?.fill ? 1 : 0));
  eq("bands follow shown rows", bands, [0, 1, 0, 1, 0]);
  eq("outside", decorate("s1", 9, 0), null);
  eq("other sheet", decorate("s2", 0, 0), null);
  const plain = buildDecorate(T.setTableLook(wb, t.id, { banded: false }), calc, "de", () => false, () => {});
  eq("no banding", plain("s1", 3, 0), null);
  // Fast: a screen of cells many times over
  const t0 = performance.now();
  for (let k = 0; k < 200; k++) for (let r = 0; r < 40; r++) for (let c = 0; c < 15; c++) decorate("s1", r, c);
  const ms = performance.now() - t0;
  check("120 000 calls quickly", ms < 300, `${ms.toFixed(0)} ms`);
});

// ==============================================================================================
// Lane F (fix round): what the table UI says. Its messages are the editor's notices (they show
// with Blob's tips switched off too), the panel's sentences end cleanly, the names don't mix up
// the smart table with the spreadsheet.
section("the table UI's messages and words");
run("the table UI's messages and words", () => {
  const { de, en } = sheetTableText;
  const storeOf = (cells: Record<string, CellInput>) => createSheetStore({ pageId: "p1", workbook: book(cells), locale: "de", readOnly: false });
  const notice = (store: ReturnType<typeof storeOf>) => {
    const n = currentSheetNotice(store);
    return n && [n.tone, n.text];
  };
  const empty = storeOf({ A1: "x" });
  empty.select({ anchor: at("D6"), focus: at("D6"), extra: [] });
  check("no table from empty cells", !makeTableFromSelection(empty));
  eq("…a hint how, not an alarm", notice(empty), ["info", de.errors.empty]);
  const lab = storeOf(LAB);
  lab.select({ anchor: at("A1"), focus: at("C7"), extra: [] });
  check("a table from the lab data", makeTableFromSelection(lab));
  lab.select({ anchor: at("C5"), focus: at("D9"), extra: [] });
  check("no second table over the first", !makeTableFromSelection(lab));
  eq("…that is a clash to sort out (role=alert)", notice(lab), ["error", de.errors.overlap]);
  const words = storeOf({ A1: "Name", B1: "Ort", A2: "Anna", B2: "Labor", A3: "Ben", B3: "Büro" });
  words.select({ anchor: at("A1"), focus: at("B3"), extra: [] });
  makeTableFromSelection(words);
  check("no chart from a table without numbers", !chartFromTable(words, words.get().workbook.tables[0].id));
  eq("…and the editor says why", notice(words), ["info", de.noChart]);

  // The sentence about a header that was found: names, then how many more, one full stop.
  eq("four names", de.headerFound(["A", "B", "C", "D"], 0), "Die erste Zeile ist die Überschrift: A, B, C, D.");
  eq("one more", de.headerFound(["A", "B", "C", "D"], 1), "Die erste Zeile ist die Überschrift: A, B, C, D und eine weitere.");
  eq("two more", de.headerFound(["A", "B", "C", "D"], 2), "Die erste Zeile ist die Überschrift: A, B, C, D und 2 weitere.");
  eq("English, one more", en.headerFound(["A", "B", "C", "D"], 1), "The first row is the header: A, B, C, D and 1 more.");
  check("never an ellipsis before the full stop", ![de, en].some((t) => t.headerFound(["A"], 3).includes("…")));

  // A "Top 10" filter in the panel, in words (not "Untersten 3").
  const top = (op: "top" | "bottom", n: number, kind: "number" | "date", t: typeof de, locale: Locale) => describeFilter({ kind: "number", op, a: n, b: null }, kind, locale, t);
  eq("the smallest", top("bottom", 3, "number", de, "de"), "die 3 kleinsten");
  eq("the largest", top("top", 10, "number", de, "de"), "die 10 größten");
  eq("dates", [top("top", 2, "date", de, "de"), top("bottom", 2, "date", de, "de")], ["die 2 neuesten", "die 2 ältesten"]);
  eq("English", top("bottom", 3, "number", en, "en"), "the 3 smallest");

  // Names: "Tabelle" is the spreadsheet; the smart table's own actions say what they act on.
  eq("convert (Excel: In Bereich konvertieren)", [de.unmake, en.unmake], ["In Bereich umwandeln", "Convert to range"]);
  eq("delete", [de.remove, en.remove], ["Intelligente Tabelle löschen", "Delete smart table"]);
  check("the confirm says what goes and what stays", de.removeConfirm.includes("intelligente Tabelle") && de.removeConfirm.includes("Rest des Blatts") && en.removeConfirm.includes("rest of the sheet"));
  eq("making one: the same words as the toolbar's button and Excel", [de.makeTable, en.makeTable], ["Als Tabelle formatieren", "Format as table"]);
  eq("the panel's group", [de.table, en.table], ["Intelligente Tabelle", "Smart table"]);
});

// ==============================================================================================
if (failures.length) {
  console.error(`check:sheet-table — ${failures.length} of ${count} checks failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:sheet-table — all ${count} checks passed.`);
// Done: the notices the checks showed would otherwise keep Node waiting for their timers.
process.exit(0);
