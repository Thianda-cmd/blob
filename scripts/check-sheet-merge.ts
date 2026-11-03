// Checks merging and undo when rows or columns move (src/sheet/collab.ts, src/sheet/sheetLog.ts,
// the logged changes in src/sheet/ops.ts, undo and redo in src/components/sheet/store.ts): every
// insert, delete, sort and cut and paste is written into the sheet's log; a partner's edit made at
// the same time lands on the row it was made on, whoever saves second; both sides moving rows of
// the same sheet gives a copy of mine instead of a guess (with a report); history that can't be
// told (old content, a capped log) never lines up by guessing; normalizeWorkbook keeps and checks
// the log; undo and redo of every kind of step keep a partner's later edits; a template picked
// can't be undone into an empty sheet; a duplicated sheet's tables get names that aren't cells.
//
//   npm run check:sheet-merge
//
// Problems make the script exit with 1.
import { deleteAtSelection, insertAtSelection } from "@/components/sheet/grid/actions";
import { currentSheetNotice, hideSheetNotice } from "@/components/sheet/notice";
import { createSheetStore, mainArea, type SheetStore } from "@/components/sheet/store";
import type { Locale } from "@/i18n/config";
import { cellKey, parsePos } from "@/sheet/a1";
import { mergeWorkbooks, takeBack, type MergeReport } from "@/sheet/collab";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import * as O from "@/sheet/ops";
import { capLog, inverseOp, LOG_ENTRIES, netOps, opsSince } from "@/sheet/sheetLog";
import * as T from "@/sheet/table/model";
import { freeTableName } from "@/sheet/table/names";
import { SHEET_TEMPLATES } from "@/sheet/templates";
import type { Cell, Sheet, SheetOp, Workbook } from "@/sheet/types";

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
function run(name: string, f: () => void) {
  section(name);
  try {
    f();
  } catch (e) {
    count++;
    failures.push(`${name} › threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }
}

// ----------------------------------------------------------------------------------------------
// Workbooks

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
const mk = (...sheets: Sheet[]): Workbook => ({ v: 1, sheets, charts: [], tables: [] });

/** Probe | Extinktion, P1…P8 with 0,1…0,8 in rows 2–9, their sum in row 11. */
function lab(name = "Blatt 1"): Sheet {
  const cells: Record<string, CellInput> = { A1: "Probe", B1: "Extinktion", A11: "Summe", B11: "=SUM(B2:B9)" };
  for (let i = 1; i <= 8; i++) {
    cells[`A${i + 1}`] = `P${i}`;
    cells[`B${i + 1}`] = i / 10;
  }
  return mkSheet(cells, "s1", name);
}

const at = (wb: Workbook, a1: string, sheetId = "s1"): Cell | undefined => {
  const p = parsePos(a1)!;
  return O.getCell(wb, sheetId, p.row, p.col);
};
const set = (wb: Workbook, a1: string, v: CellInput | null, sheetId = "s1") => {
  const p = parsePos(a1)!;
  return O.setCells(wb, sheetId, [{ row: p.row, col: p.col, cell: v === null ? null : toCell(v) }]);
};
/** The values of a column, rows from…to (1-based, as on screen). */
function column(wb: Workbook, col: string, from = 1, to = 12, sheetId = "s1"): unknown[] {
  const calc = createCalc(wb, { locale: "de" });
  const c = col.charCodeAt(0) - 65;
  const out: unknown[] = [];
  for (let r = from - 1; r <= to - 1; r++) out.push(calc.value(sheetId, r, c));
  return out;
}
const rowOf = (wb: Workbook, label: string, sheetId = "s1", col = 0): number => {
  const s = O.sheetById(wb, sheetId)!;
  for (const key in s.cells) if (s.cells[key].v === label && Number(key.split(",")[1]) === col) return Number(key.split(",")[0]);
  return -1;
};
const kinds = (wb: Workbook, sheetId = "s1") => (O.sheetById(wb, sheetId)?.log ?? []).map((op) => op.kind);
const stripLogs = (wb: Workbook): Workbook => ({
  ...wb,
  sheets: wb.sheets.map((s) => {
    const out = { ...s };
    delete out.log;
    return out;
  }),
});
const template = (id: string, locale: Locale = "de") => SHEET_TEMPLATES.find((t) => t.id === id)!.build(locale);
const storeOf = (wb: Workbook, locale: Locale = "de"): SheetStore => createSheetStore({ pageId: "p", workbook: wb, locale, readOnly: false });
/** Merge in both save orders: [I save second, they save second]. */
const bothOrders = (base: Workbook, a: Workbook, b: Workbook) => [mergeWorkbooks(base, a, b), mergeWorkbooks(base, b, a)];

const calc0 = (wb: Workbook) => createCalc(wb, { locale: "de" });
const SORT_DESC = (wb: Workbook) => O.sortArea(wb, calc0(wb), "s1", { r0: 1, c0: 0, r1: 8, c1: 1 }, [{ col: 1, dir: "desc" }], "de");
const CUT = (wb: Workbook, area: { r0: number; c0: number; r1: number; c1: number }, to: { row: number; col: number }, toSheet = "s1", fromSheet = "s1") =>
  O.pasteClip(wb, calc0(wb), toSheet, { r0: to.row, c0: to.col, r1: to.row, c1: to.col }, O.copyArea(wb, fromSheet, area), { mode: "all", cut: true });
/** A merge and its report. */
function reported(base: Workbook, a: Workbook, b: Workbook): { m: Workbook; report: MergeReport } {
  const report: MergeReport = { conflicts: [] };
  return { m: mergeWorkbooks(base, a, b, report), report };
}
const names = (wb: Workbook) => wb.sheets.map((s) => s.name);
const P_ROWS = { r0: 1, c0: 0, r1: 8, c1: 1 };

// ==============================================================================================
run("the log: every change of rows and columns is written down", () => {
  const b0 = mk(lab());
  const ins = O.insertRows(b0, "s1", 3, 2);
  const log = O.sheetById(ins, "s1")!.log!;
  eq("insert rows", log.map((op) => (op.kind === "insertRows" ? { kind: op.kind, at: op.at, count: op.count } : op.kind)), [{ kind: "insertRows", at: 3, count: 2 }]);
  check("with an id", typeof log[0].id === "string" && /^[\w.:-]{1,64}$/.test(log[0].id), show(log[0].id));
  const two = O.insertRows(ins, "s1", 0, 1);
  check("each change its own id", O.sheetById(two, "s1")!.log![1].id !== log[0].id);
  eq("delete rows", kinds(O.deleteRows(b0, "s1", 2, 1)), ["deleteRows"]);
  eq("insert columns", kinds(O.insertCols(b0, "s1", 1, 1)), ["insertCols"]);
  eq("delete columns", kinds(O.deleteCols(b0, "s1", 1, 1)), ["deleteCols"]);
  const sorted = SORT_DESC(b0);
  eq("a sort: the new order of the rows", O.sheetById(sorted, "s1")!.log!.map((op) => (op.kind === "sort" ? [op.r0, op.c0, op.c1, op.order] : null)), [[1, 0, 1, [7, 6, 5, 4, 3, 2, 1, 0]]]);
  const asc = O.sortArea(b0, calc0(b0), "s1", { r0: 1, c0: 0, r1: 8, c1: 1 }, [{ col: 1, dir: "asc" }], "de");
  check("a sort that changes nothing: nothing logged", asc === b0);
  const cut = CUT(b0, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 1, col: 3 });
  eq("cut and paste", O.sheetById(cut, "s1")!.log!.map((op) => (op.kind === "move" ? [op.src, op.from, op.dst, op.to] : null)), [["s1", { r0: 1, c0: 0, r1: 8, c1: 1 }, "s1", { row: 1, col: 3 }]]);
  const two2 = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const across = CUT(two2, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 0, col: 0 }, "s2");
  eq("cut to another sheet: in both logs", [kinds(across, "s1"), kinds(across, "s2"), O.sheetById(across, "s1")!.log![0].id === O.sheetById(across, "s2")!.log![0].id], [["move"], ["move"], true]);
  eq("cells only: no log", O.sheetById(set(b0, "B2", 5), "s1")!.log, undefined);
  // A smart table whose every data row goes keeps one, emptied: only the rows really gone are logged.
  const tb = T.makeTable(mk(mkSheet({ A1: "x", A2: 1, A3: 2, A4: 3 })), calc0(mk(mkSheet({ A1: "x", A2: 1, A3: 2, A4: 3 }))), "s1", { r0: 0, c0: 0, r1: 3, c1: 0 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  const emptied = O.deleteRows(tb.wb, "s1", 1, 3);
  eq("deleting a table's rows: the kept row isn't logged", O.sheetById(emptied, "s1")!.log!.map((op) => (op.kind === "deleteRows" ? [op.at, op.count] : null)), [[2, 2]]);
  eq("one of several data rows: logged as a delete", O.sheetById(O.deleteRows(tb.wb, "s1", 1, 1), "s1")!.log!.map((op) => (op.kind === "deleteRows" ? [op.at, op.count] : op.kind)), [[1, 1]]);
  const single = T.makeTable(mk(mkSheet({ A1: "x", A2: 1 })), calc0(mk(mkSheet({ A1: "x", A2: 1 }))), "s1", { r0: 0, c0: 0, r1: 1, c1: 0 }, "de");
  if (!("wb" in single)) throw new Error("no table");
  eq("a table's only data row: emptied, nothing logged", O.sheetById(O.deleteRows(single.wb, "s1", 1, 1), "s1")?.log, undefined);
  const lastRow = O.deleteRows(O.deleteRows(tb.wb, "s1", 2, 2), "s1", 1, 1);
  eq("the last data row: emptied, no new entry", O.sheetById(lastRow, "s1")!.log!.length, 1);
  // Smart tables: sorting is logged as a sort of the data rows, and the room made for a header row as an insert.
  const t = tb.wb.tables[0];
  const ts = T.sortTable(tb.wb, calc0(tb.wb), t.id, t.columns[0].id, "desc", "de");
  eq("table sort", O.sheetById(ts, "s1")!.log!.map((op) => (op.kind === "sort" ? [op.r0, op.order] : null)), [[1, [2, 1, 0]]]);
  const plain = mk(mkSheet({ A1: 1, A2: 2, B1: 3, B2: 4 }));
  const made = T.makeTableWith(plain, calc0(plain), "s1", { r0: 0, c0: 0, r1: 1, c1: 1 }, "de", { header: "no" });
  if ("wb" in made) eq("a header row made room for", kinds(made.wb), made.moved ? ["insertRows"] : []);
  // A duplicated sheet starts without the original's history.
  const dup = O.duplicateSheet(ins, "s1");
  eq("duplicate: no log on the copy", [kinds(dup.wb, "s1"), O.sheetById(dup.wb, dup.sheetId)!.log], [["insertRows"], undefined]);
});

run("the log: columns inserted into a table get the same ids on every version", () => {
  const src = mk(mkSheet({ A1: "a", B1: "b", C1: "c", A2: 1, B2: 2, C2: 3 }));
  const tb = T.makeTable(src, calc0(src), "s1", { r0: 0, c0: 0, r1: 1, c1: 2 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  const mine = O.insertCols(tb.wb, "s1", 1, 1);
  const op = O.sheetById(mine, "s1")!.log![0];
  const other = O.replayOp(set(tb.wb, "C2", 30), "s1", op)!;
  eq("same new column ids", other.tables[0].columns.map((c) => c.id), mine.tables[0].columns.map((c) => c.id));
  eq("and the same entry in the log", O.sheetById(other, "s1")!.log, O.sheetById(mine, "s1")!.log);
  check("an id of the change", mine.tables[0].columns[1].id.startsWith(op.id));
});

run("the log: helpers", () => {
  const ins = (id: string, at = 0): SheetOp => ({ id, kind: "insertRows", at, count: 1 });
  const many = Array.from({ length: 60 }, (_, i) => ins(`e${i}`, i));
  const capped = capLog(many);
  eq("capped to the newest", [capped.length, capped[0].kind, capped[0].id, capped[1].id, capped[capped.length - 1].id], [LOG_ENTRIES, "barrier", "e10", "e11", "e59"]);
  const short = many.slice(0, 5);
  check("short logs stay the same", capLog(short) === short);
  const sort = (id: string, n: number): SheetOp => ({ id, kind: "sort", r0: 0, c0: 0, c1: 0, order: Array.from({ length: n }, (_, i) => n - 1 - i) });
  eq("a very long sort is only a barrier", capLog([ins("a"), sort("big", 12000)]), [{ id: "big", kind: "barrier" }]);
  eq("two long sorts: the older goes", capLog([ins("a"), sort("s1", 6000), sort("s2", 6000)]).map((op) => op.kind), ["barrier"]);
  eq("since: the newer entries", opsSince([ins("a"), ins("b")], [ins("a"), ins("b"), ins("c")])?.map((op) => op.id), ["c"]);
  eq("since: nothing new", opsSince([ins("a")], [ins("a")]), []);
  eq("since: no base log, everything", opsSince(undefined, [ins("a")])?.map((op) => op.id), ["a"]);
  eq("since: base's newest gone", opsSince([ins("x")], [ins("a"), ins("b")]), null);
  eq("since: a barrier on the way", opsSince([ins("a")], [ins("a"), { id: "b", kind: "barrier" }, ins("c")]), null);
  eq("since: no log at all", opsSince(undefined, undefined), []);
  const undo = (op: SheetOp, id: string) => inverseOp(op, id)!;
  const a = ins("a", 3);
  eq("an insert taken back is nothing", netOps([a, undo(a, "u")]), []);
  const b = ins("b", 5);
  eq("only the one right before", netOps([a, b, undo(b, "u")]).map((op) => op.id), ["a"]);
  eq("not across another change", netOps([a, b, undo(a, "u")]).map((op) => op.id), ["a", "b", "u"]);
  eq("inverse of an insert", undo(a, "u"), { id: "u", inv: "a", kind: "deleteRows", at: 3, count: 1 });
  const s = { id: "s", kind: "sort", r0: 2, c0: 0, c1: 1, order: [2, 0, 1] } as SheetOp;
  const back = undo(s, "t");
  // Row r0 + i holds what was in r0 + order[i]: both one after the other leave every row where it was.
  const apply = (order: number[], rows: string[]) => order.map((from) => rows[from]);
  if (back.kind === "sort") eq("inverse of a sort", apply(back.order, apply([2, 0, 1], ["x", "y", "z"])), ["x", "y", "z"]);
  const mv: SheetOp = { id: "m", kind: "move", src: "s1", from: { r0: 1, c0: 0, r1: 3, c1: 1 }, dst: "s2", to: { row: 5, col: 2 } };
  eq("inverse of a move", undo(mv, "n"), { id: "n", inv: "m", kind: "move", src: "s2", from: { r0: 5, c0: 2, r1: 7, c1: 3 }, dst: "s1", to: { row: 1, col: 0 } });
});

// ==============================================================================================
run("normalizeWorkbook keeps and checks the log", () => {
  const wb = O.insertRows(SORT_DESC(mk(lab())), "s1", 2, 1);
  const n = normalizeWorkbook(wb, "de");
  check("a valid log: the same sheet", n.sheets[0] === wb.sheets[0]);
  const back = normalizeWorkbook(JSON.parse(JSON.stringify(wb)), "de");
  eq("saved and read again", back.sheets[0].log, wb.sheets[0].log);
  eq("old content without a log stays without", "log" in normalizeWorkbook(mk(lab()), "de").sheets[0], false);
  const raw = JSON.parse(JSON.stringify(mk(lab())));
  raw.sheets[0].log = [
    { id: "a", kind: "insertRows", at: 2, count: 1 },
    { id: "b", kind: "explode", at: 1 },
    { id: "c", kind: "sort", r0: 0, c0: 0, c1: 0, order: [0, 0] },
    { id: "a", kind: "deleteRows", at: 1, count: 1 },
    { id: "d", kind: "deleteCols", at: -1, count: 1 },
    { id: "e", inv: "<bad>", kind: "insertCols", at: 1, count: 1 },
    { id: "f", kind: "insertRows", at: 1, count: 1, extra: true },
    { id: "g", kind: "deleteRows", at: 4, count: 2 },
  ];
  const fixed = normalizeWorkbook(raw, "de").sheets[0].log!;
  eq("bad entries become barriers, in place", fixed.map((op) => op.kind), ["insertRows", "barrier", "barrier", "barrier", "barrier", "barrier", "barrier", "deleteRows"]);
  eq("ids stay unique", new Set(fixed.map((op) => op.id)).size, fixed.length);
  eq("the same on every device", normalizeWorkbook(JSON.parse(JSON.stringify(raw)), "de").sheets[0].log, fixed);
  raw.sheets[0].log = [];
  eq("an empty log is no log", "log" in normalizeWorkbook(raw, "de").sheets[0], false);
  raw.sheets[0].log = Array.from({ length: 70 }, (_, i) => ({ id: `e${i}`, kind: "insertRows", at: 1, count: 1 }));
  const long = normalizeWorkbook(raw, "de").sheets[0].log!;
  eq("at most the newest entries", [long.length, long[0].kind, long[long.length - 1].id], [LOG_ENTRIES, "barrier", "e69"]);
  raw.sheets[0].log = "nonsense";
  eq("not a list: no log", "log" in normalizeWorkbook(raw, "de").sheets[0], false);
  // A move naming a sheet whose id normalizing had to change (two sheets with one id).
  const two = JSON.parse(JSON.stringify(mk(lab(), mkSheet({}, "s1", "Blatt 2"))));
  two.sheets[0].log = [{ id: "m", kind: "move", src: "s1", from: { r0: 0, c0: 0, r1: 1, c1: 1 }, dst: "s1", to: { row: 5, col: 5 } }];
  const nn = normalizeWorkbook(two, "de");
  eq("a move keeps naming its sheet", nn.sheets[0].log!.map((op) => (op.kind === "move" ? [op.src, op.dst] : op.kind)), [["s1", "s1"]]);
  check("the second sheet got its own id", nn.sheets[1].id !== "s1");
});

// ==============================================================================================
// Merging: one side moved rows or columns, the other corrected a value (both save orders)

run("merge: a row inserted vs a value corrected below it", () => {
  const b0 = mk(lab());
  const mine = O.insertRows(b0, "s1", 3, 1);
  const theirs = set(b0, "B7", 0.66);
  for (const [i, m] of bothOrders(b0, mine, theirs).entries()) {
    const who = i ? "they save second" : "I save second";
    eq(`${who}: labels`, column(m, "A"), ["Probe", "P1", "P2", null, "P3", "P4", "P5", "P6", "P7", "P8", null, "Summe"]);
    eq(`${who}: P6 corrected, P5 untouched`, column(m, "B", 7, 8), [0.5, 0.66]);
    eq(`${who}: the sum`, [at(m, "B12")?.f, column(m, "B", 12, 12)], ["SUM(B2:B10)", [3.66]]);
    eq(`${who}: no copy`, m.sheets.length, 1);
  }
});

run("merge: a row deleted vs a value corrected below it", () => {
  const b0 = mk(lab());
  const mine = O.deleteRows(b0, "s1", 2, 1);
  const theirs = set(b0, "B7", 0.66);
  for (const [i, m] of bothOrders(b0, mine, theirs).entries()) {
    const who = i ? "they save second" : "I save second";
    eq(`${who}: labels`, column(m, "A", 1, 10), ["Probe", "P1", "P3", "P4", "P5", "P6", "P7", "P8", null, "Summe"]);
    eq(`${who}: P6 corrected on its row`, column(m, "B", 6, 7), [0.66, 0.7]);
    eq(`${who}: the sum`, column(m, "B", 10, 10), [3.46]);
  }
});

run("merge: an edit in rows the other side deleted goes with them", () => {
  const b0 = mk(lab());
  const mine = O.deleteRows(b0, "s1", 2, 2);
  const theirs = set(b0, "B3", 0.22);
  for (const m of bothOrders(b0, mine, theirs)) {
    eq("P2 and P3 gone, nothing else changed", column(m, "B", 1, 8), ["Extinktion", 0.1, 0.4, 0.5, 0.6, 0.7, 0.8, null]);
    check("0,22 nowhere", !Object.values(m.sheets[0].cells).some((c) => c.v === 0.22));
  }
});

run("merge: an edit above an inserted row stays where it is", () => {
  const b0 = mk(lab());
  const [m1, m2] = bothOrders(b0, O.insertRows(b0, "s1", 5, 1), set(b0, "B1", "E (540 nm)"));
  eq("header", [at(m1, "B1")?.v, at(m2, "B1")?.v], ["E (540 nm)", "E (540 nm)"]);
  eq("P5 moved down", [rowOf(m1, "P5"), rowOf(m2, "P5")], [6, 6]);
});

run("merge: a column inserted vs a formula typed next to the data", () => {
  const b0 = mk(lab());
  const mine = O.insertCols(b0, "s1", 1, 1);
  const theirs = set(set(b0, "C2", "=B2*2"), "B7", 0.66);
  for (const m of bothOrders(b0, mine, theirs)) {
    eq("the formula moved with its column and still points at the values", [at(m, "D2")?.f, column(m, "D", 2, 2)], ["C2*2", [0.2]]);
    eq("the correction in the moved column", column(m, "C", 7, 7), [0.66]);
    eq("the new column is empty", column(m, "B", 1, 9).every((v) => v === null), true);
  }
});

run("merge: a column deleted vs a value corrected right of it", () => {
  const cells: Record<string, CellInput> = { A1: "Probe", B1: "Notiz", C1: "Faktor" };
  for (let i = 2; i <= 9; i++) Object.assign(cells, { [`A${i}`]: `P${i - 1}`, [`B${i}`]: "ok", [`C${i}`]: 2 });
  const b0 = mk(mkSheet(cells));
  for (const m of bothOrders(b0, O.deleteCols(b0, "s1", 1, 1), set(b0, "C7", 3))) {
    eq("the factor column moved left, with the correction", column(m, "B", 1, 9), ["Faktor", 2, 2, 2, 2, 2, 3, 2, 2]);
    check("Notiz gone", !Object.values(m.sheets[0].cells).some((c) => c.v === "Notiz"));
  }
});

run("merge: rows sorted vs a value corrected", () => {
  const b0 = mk(lab());
  for (const m of bothOrders(b0, SORT_DESC(b0), set(b0, "B7", 0.66))) {
    eq("sorted", column(m, "A", 2, 9), ["P8", "P7", "P6", "P5", "P4", "P3", "P2", "P1"]);
    eq("P6's correction on P6's row", column(m, "B", 2, 9), [0.8, 0.7, 0.66, 0.5, 0.4, 0.3, 0.2, 0.1]);
  }
});

run("merge: a smart table sorted vs a value corrected", () => {
  const src = mk(lab());
  const tb = T.makeTable(src, calc0(src), "s1", { r0: 0, c0: 0, r1: 8, c1: 1 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  const t = tb.wb.tables[0];
  const mine = T.sortTable(tb.wb, calc0(tb.wb), t.id, t.columns[1].id, "desc", "de");
  for (const m of bothOrders(tb.wb, mine, set(tb.wb, "B7", 0.66))) {
    eq("P6's correction on P6's row", [column(m, "A", 4, 4), column(m, "B", 4, 4)], [["P6"], [0.66]]);
    eq("the table remembers the sort", m.tables[0].sort?.dir, "desc");
  }
});

run("merge: cut and paste vs a value corrected in the moved cells", () => {
  const b0 = mk(lab());
  const mine = CUT(b0, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 1, col: 3 });
  for (const m of bothOrders(b0, mine, set(b0, "B7", 0.66))) {
    eq("moved, with the correction", column(m, "E", 2, 9), [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]);
    eq("the old place is empty", column(m, "B", 2, 9).every((v) => v === null), true);
    eq("the sum follows", [at(m, "B11")?.f, column(m, "B", 11, 11)], ["SUM(E2:E9)", [3.66]]);
  }
  const two = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const across = CUT(two, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 0, col: 0 }, "s2");
  for (const m of bothOrders(two, across, set(two, "B7", 0.66))) {
    eq("to another sheet: the correction went along", column(m, "B", 1, 8, "s2"), [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]);
    eq("the sum follows to the other sheet", column(m, "B", 11, 11), [3.66]);
  }
});

run("merge: charts and tables follow, their own edits stay", () => {
  const wb0 = template("calibration");
  const s = wb0.sheets[0];
  const chart = wb0.charts[0];
  const std = wb0.tables.find((t) => t.name === "Standards")!;
  const mine = O.insertRows(wb0, s.id, 0, 2);
  const firstData = std.area.r0 + 1;
  const theirs = O.setCells(O.putChart(wb0, { ...chart, title: "Nitrat" }), s.id, [{ row: firstData + 2, col: 2, cell: { v: 0.111 } }]);
  for (const m of bothOrders(wb0, mine, theirs)) {
    const c = m.charts.find((x) => x.id === chart.id)!;
    eq("chart title from them, ranges and place from me", [c.title, c.series.map((x) => [x.y.r0, x.y.r1]), c.at.row], ["Nitrat", chart.series.map((x) => [x.y.r0 + 2, x.y.r1 + 2]), chart.at.row + 2]);
    eq("table moved", m.tables.find((t) => t.id === std.id)!.area, { ...std.area, r0: std.area.r0 + 2, r1: std.area.r1 + 2 });
    eq("their value on its standard", O.getCell(m, s.id, firstData + 4, 2)?.v, 0.111);
  }
});

run("merge: a standard deleted vs a standard added (the Kalibriergerade)", () => {
  const wb0 = template("calibration");
  const s = wb0.sheets[0];
  const std = wb0.tables.find((t) => t.name === "Standards")!;
  const slopeRow = Number(Object.entries(s.cells).find(([, c]) => c.f?.startsWith("SLOPE"))![0].split(",")[0]);
  const mine = O.deleteRows(wb0, s.id, std.area.r0 + 3, 1);
  let theirs = O.setCells(wb0, s.id, [0, 1, 2].map((k) => ({ row: std.area.r1 + 1, col: k, cell: { v: ["S6", 12, 0.627][k] } })));
  for (let c = 0; c <= 2; c++) theirs = T.afterInput(theirs, calc0(theirs), s.id, std.area.r1 + 1, c, "de");
  for (const [i, m] of bothOrders(wb0, mine, theirs).entries()) {
    const who = i ? "they save second" : "I save second";
    const t = m.tables.find((x) => x.id === std.id)!;
    const names: unknown[] = [];
    for (let r = t.area.r0 + 1; r <= t.area.r1; r++) names.push(O.getCell(m, s.id, r, 0)?.v);
    eq(`${who}: the standards, no empty row`, names, ["S0 (Blindwert)", "S1", "S3", "S4", "S5", "S6"]);
    const label = (r: number) => O.getCell(m, s.id, r, 0)?.v;
    const formula = (r: number) => O.getCell(m, s.id, r, 1)?.f?.split("(")[0];
    // One standard less, and S6 typed into the empty row under the table: the results one row up.
    const row = slopeRow - 1;
    eq(`${who}: every result under its label`, [label(row), formula(row), label(row + 1), formula(row + 1), label(row + 2), formula(row + 2)], ["Steigung m", "SLOPE", "Achsenabschnitt b", "INTERCEPT", "Bestimmtheitsmaß R²", "RSQ"]);
    eq(`${who}: the slope over all standards`, O.getCell(m, s.id, row, 1)?.f, `SLOPE(C${t.area.r0 + 2}:C${t.area.r1 + 1},B${t.area.r0 + 2}:B${t.area.r1 + 1})`);
  }
});

run("merge: offline phone inserts a row, laptop corrects a value further down", () => {
  // As in the browser: A3:Z3 selected, Ctrl++ and 1 / 0,055 typed into the new row; the laptop
  // corrects 6 mg/L from 0,311 to 0,315.
  const cells: Record<string, CellInput> = { A1: "c (mg/L)", B1: "E" };
  [0, 2, 4, 6, 8, 10].forEach((c, i) => Object.assign(cells, { [`A${i + 2}`]: c, [`B${i + 2}`]: [0.002, 0.105, 0.209, 0.311, 0.418, 0.52][i] }));
  const b0 = mk(mkSheet(cells));
  const phone = set(set(O.insertRows(b0, "s1", 2, 1), "A3", 1), "B3", 0.055);
  const laptop = set(b0, "B5", 0.315);
  for (const m of bothOrders(b0, phone, laptop)) {
    eq("both values on their rows", [column(m, "A", 2, 8), column(m, "B", 2, 8)], [
      [0, 1, 2, 4, 6, 8, 10],
      [0.002, 0.055, 0.105, 0.209, 0.315, 0.418, 0.52],
    ]);
  }
});

run("merge: every data row of a smart table deleted vs an edit below it", () => {
  const src = mk(mkSheet({ A1: "Probe", B1: "Wert", A2: "P1", B2: 1, A3: "P2", B3: 2, A4: "P3", B4: 3, A6: "Notiz" }));
  const tb = T.makeTable(src, calc0(src), "s1", { r0: 0, c0: 0, r1: 3, c1: 1 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  // The table keeps one emptied row (only two rows are really deleted); the partner edits the note below.
  const mine = O.deleteRows(tb.wb, "s1", 1, 3);
  const theirs = set(tb.wb, "A6", "Notiz (korrigiert)");
  for (const m of bothOrders(tb.wb, mine, theirs)) {
    eq("one empty data row left, the note two rows up with its correction", [column(m, "A", 1, 4), m.tables[0].area], [["Probe", null, null, "Notiz (korrigiert)"], { r0: 0, c0: 0, r1: 1, c1: 1 }]);
  }
});

run("merge: what the partner added is lined up too", () => {
  const b0 = mk(lab(), mkSheet({ A1: "='Blatt 1'!B7" }, "s2", "Auswertung"));
  const mine = O.insertRows(b0, "s1", 3, 1);
  // A chart and a smart table over the data, a formula below the inserted row, a new name for the sheet.
  const chart = { ...template("calibration").charts[0], id: "c1", sheetId: "s1" };
  const ref = (r0: number, r1: number) => ({ sheetId: "s1", r0, c0: 1, r1, c1: 1 });
  let theirs = O.putChart(b0, { ...chart, x: null, series: [{ ...chart.series[0], id: "y1", x: null, nameRef: null, errorBars: null, y: ref(1, 8) }] });
  const tb = T.makeTable(theirs, calc0(theirs), "s1", { r0: 0, c0: 0, r1: 8, c1: 1 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  theirs = O.renameSheet(set(tb.wb, "C1", "=B7*2"), "s1", "Messung");
  const report: MergeReport = { conflicts: [] };
  for (const m of [mergeWorkbooks(b0, mine, theirs, report), mergeWorkbooks(b0, theirs, mine, report)]) {
    eq("their chart grew with the inserted row", m.charts[0].series[0].y, ref(1, 9));
    eq("their table too", m.tables[0].area, { r0: 0, c0: 0, r1: 9, c1: 1 });
    eq("their formula points at P6 still", [at(m, "C1")?.f, column(m, "C", 1, 1)], ["B8*2", [1.2]]);
    eq("the sheet's new name, in formulas elsewhere too", [m.sheets[0].name, at(m, "A1", "s2")?.f, column(m, "A", 1, 1, "s2")], ["Messung", "Messung!B8", [0.6]]);
  }
  eq("nothing to report", report.conflicts, []);
});

run("merge: a change that can't be done on the other version gives a copy", () => {
  // Mine inserts rows; theirs has data in the sheet's very last row, which the insert would push off.
  const b0 = mk({ ...lab(), size: { rows: 20000, cols: 26 } });
  const mine = O.insertRows(b0, "s1", 3, 1);
  const theirs = set(b0, "A20000", "letzte Zeile");
  const report: MergeReport = { conflicts: [] };
  const m = mergeWorkbooks(b0, mine, theirs, report);
  eq("their sheet with its last row, mine as a copy", [m.sheets.map((s) => s.name), at(m, "A20000")?.v, report.conflicts.length], [["Blatt 1", "Blatt 1 (Konflikt)"], "letzte Zeile", 1]);
  eq("mine in the copy", rowOf(m, "P3", m.sheets[1].id), 4);
});

run("merge: a cut between two sheets lines both up, or both get a copy", () => {
  const two = mk(lab(), mkSheet({ A1: "Ziel" }, "s2", "Blatt 2"));
  const across = CUT(two, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 1, col: 0 }, "s2");
  // They inserted rows on the sheet the cells went to: that sheet can't be lined up, so neither can the other.
  const theirs = O.insertRows(set(two, "B7", 0.66), "s2", 0, 1);
  const report: MergeReport = { conflicts: [] };
  const m = mergeWorkbooks(two, across, theirs, report);
  eq("both sheets kept as theirs, both copied", [m.sheets.map((s) => s.name), report.conflicts.map((c) => c.name)], [["Blatt 1", "Blatt 1 (Konflikt)", "Blatt 2", "Blatt 2 (Konflikt)"], ["Blatt 1", "Blatt 2"]]);
  eq("their correction where they made it", column(m, "B", 7, 7), [0.66]);
  eq("my cut in the copies", [column(m, "B", 7, 7, m.sheets[1].id), column(m, "B", 7, 7, m.sheets[3].id)], [[null], [0.6]]);
  // Undo of a cut between two sheets while the partner corrects a value in the moved cells.
  const store = storeOf(two);
  store.apply("Verschieben", (wb) => CUT(wb, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 1, col: 0 }, "s2"));
  store.replaceRemote(set(store.get().workbook, "B7", 0.66, "s2"));
  store.undo();
  eq("undone: back on the first sheet, with the correction", [column(store.get().workbook, "B", 2, 9), column(store.get().workbook, "B", 2, 9, "s2").every((v) => v === null)], [[0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8], true]);
  store.redo();
  eq("redone", column(store.get().workbook, "B", 2, 9, "s2"), [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]);
});

run("merge: a cut into a new sheet (only one side has it)", () => {
  const b0 = mk(lab(), mkSheet({ A1: "Notizen" }, "s2", "Notizen"));
  const added = O.addSheet(b0, "de", "Rohdaten");
  const r = added.sheetId;
  const mine = CUT(added.wb, P_ROWS, { row: 1, col: 0 }, r);
  const moved = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  const cases: [string, Workbook, unknown[], number, [string, string, unknown]][] = [
    ["an edit on another sheet", set(b0, "A2", "neue Notiz", "s2"), moved, 3.6, ["A2", "s2", "neue Notiz"]],
    ["an edit next to the cut cells", set(b0, "D1", "Notiz"), moved, 3.6, ["D1", "s1", "Notiz"]],
    ["a correction in the cut cells", set(b0, "B7", 0.66), [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8], 3.66, ["B7", r, 0.66]],
  ];
  for (const [what, theirs, values, sum, [addr, sheet, value]] of cases) {
    for (const [i, { m, report }] of [reported(b0, mine, theirs), reported(b0, theirs, mine)].entries()) {
      const who = `${what}, ${i ? "they save second" : "I save second"}`;
      eq(`${who}: no copy`, [names(m), report.conflicts], [["Blatt 1", "Notizen", "Rohdaten"], []]);
      eq(`${who}: the cells on the new sheet, the old place empty`, [column(m, "B", 2, 9, r), column(m, "B", 2, 9).every((v) => v === null)], [values, true]);
      eq(`${who}: the sum follows`, [at(m, "B11")?.f, column(m, "B", 11, 11)], ["SUM(Rohdaten!B2:B9)", [sum]]);
      eq(`${who}: their edit`, at(m, addr, sheet)?.v, value);
    }
  }
  // Cells cut from a new sheet into Blatt 1 while the partner corrects P6 there.
  const n = O.addSheet(b0, "de", "Neu");
  const fromNew = CUT(O.setCells(n.wb, n.sheetId, [0, 1, 2].map((row) => ({ row, col: 0, cell: { v: `neu${row}` } }))), { r0: 0, c0: 0, r1: 2, c1: 0 }, { row: 14, col: 0 }, "s1", n.sheetId);
  for (const { m, report } of [reported(b0, fromNew, set(b0, "B7", 0.66)), reported(b0, set(b0, "B7", 0.66), fromNew)]) {
    eq("from a new sheet: pasted, their correction kept, no copy", [column(m, "A", 15, 17), column(m, "B", 7, 7), report.conflicts.length], [["neu0", "neu1", "neu2"], [0.66], 0]);
  }
  // A new sheet cut into and deleted again: what was moved there went with it.
  const deleted = O.deleteSheet(mine, r);
  for (const { m, report } of [reported(b0, deleted, set(b0, "A2", "neue Notiz", "s2")), reported(b0, set(b0, "A2", "neue Notiz", "s2"), deleted)]) {
    eq("cut into a new sheet that was deleted again: no copy", [names(m), column(m, "B", 2, 9).every((v) => v === null), at(m, "A2", "s2")?.v, report.conflicts.length], [["Blatt 1", "Notizen"], true, "neue Notiz", 0]);
  }
  // A cut into a sheet the partner deleted can't be lined up: their sheet keeps the cells, mine is a copy.
  const into = CUT(b0, P_ROWS, { row: 1, col: 1 }, "s2");
  const gone = O.deleteSheet(set(b0, "D1", "Notiz"), "s2");
  const { m, report } = reported(b0, into, gone);
  eq("cut into a sheet they deleted: theirs keeps the cells, mine is a copy", [names(m), column(m, "B", 2, 4), report.conflicts.map((c) => c.copyName)], [["Blatt 1", "Blatt 1 (Konflikt)"], [0.1, 0.2, 0.3], ["Blatt 1 (Konflikt)"]]);
  const back = reported(b0, gone, into);
  eq("…the other way round: the cells in the copy", [names(back.m), column(back.m, "B", 2, 4, back.report.conflicts[0]?.copyId)], [["Blatt 1", "Blatt 1 (Konflikt)"], [0.1, 0.2, 0.3]]);
});

run("merge: a cut both sides have already, then more changes of rows", () => {
  // A draft that was saved after all: the server has my cut to Blatt 2 and the partner's note
  // there; my draft has one more inserted row on Blatt 1.
  const b0 = mk(lab(), mkSheet({ A1: "Ziel" }, "s2", "Blatt 2"));
  const cut = CUT(b0, P_ROWS, { row: 1, col: 0 }, "s2");
  const mine = O.insertRows(cut, "s1", 0, 1);
  const server = set(cut, "D1", "Notiz", "s2");
  for (const { m, report } of [reported(b0, mine, server), reported(b0, server, mine)]) {
    eq("no copy, my insert, their note", [names(m), report.conflicts.length, column(m, "A", 1, 3), column(m, "D", 1, 1, "s2"), column(m, "B", 2, 4, "s2")], [["Blatt 1", "Blatt 2"], 0, [null, "Probe", null], ["Notiz"], [0.1, 0.2, 0.3]]);
  }
  // The sheet the cells went to was new in that shared history: the base doesn't have it.
  const added = O.addSheet(b0, "de", "Neu");
  const cut2 = CUT(added.wb, P_ROWS, { row: 0, col: 0 }, added.sheetId);
  const mine2 = O.insertRows(cut2, "s1", 0, 1);
  const server2 = set(cut2, "B6", 0.55, added.sheetId);
  for (const { m, report } of [reported(b0, mine2, server2), reported(b0, server2, mine2)]) {
    eq("…into a sheet the base doesn't have", [names(m), report.conflicts.length, column(m, "B", 1, 8, added.sheetId), column(m, "A", 1, 2)], [["Blatt 1", "Blatt 2", "Neu"], 0, [0.1, 0.2, 0.3, 0.4, 0.5, 0.55, 0.7, 0.8], [null, "Probe"]]);
  }
});

run("merge: a copy never pushes another sheet out of a full workbook", () => {
  const sheets = [lab()];
  for (let i = 2; i <= 250; i++) sheets.push(mkSheet({ A1: `Daten ${i}` }, `s${i}`, `Blatt ${i}`));
  const full = mk(...sheets);
  const { m, report } = reported(full, O.insertRows(full, "s1", 3, 1), O.deleteRows(full, "s1", 5, 1));
  eq("every sheet still there, theirs kept, no copy", [m.sheets.length, m.sheets[249].name, at(m, "A1", "s250")?.v, rowOf(m, "P6")], [250, "Blatt 250", "Daten 250", 5]);
  eq("reported without a copy", report.conflicts, [{ sheetId: "s1", name: "Blatt 1", copyId: "", copyName: "" }]);
  const one = mk(...sheets.slice(0, 249));
  const room = reported(one, O.insertRows(one, "s1", 3, 1), O.deleteRows(one, "s1", 5, 1));
  eq("room for one copy", [room.m.sheets.length, room.m.sheets[1].name, room.report.conflicts[0]?.copyName], [250, "Blatt 1 (Konflikt)", "Blatt 1 (Konflikt)"]);
});

run("merge: a big sheet stays quick", () => {
  const cells: Record<string, Cell> = {};
  for (let r = 0; r < 5000; r++) for (let c = 0; c < 8; c++) cells[cellKey(r, c)] = { v: r * 8 + c };
  for (let r = 0; r < 200; r++) cells[cellKey(r, 8)] = { f: `SUM(A${r + 1}:H${r + 1})` };
  const b0 = mk({ ...mkSheet({}), cells, size: { rows: 5000, cols: 26 } });
  const mine = O.insertRows(b0, "s1", 10, 1);
  const theirs = O.setCells(b0, "s1", [{ row: 4000, col: 3, cell: { v: -1 } }]);
  const t0 = performance.now();
  const m = mergeWorkbooks(b0, mine, theirs);
  const ms = performance.now() - t0;
  eq("the correction one row down", O.getCell(m, "s1", 4001, 3)?.v, -1);
  check("5 000 rows merged in well under a second", ms < 1000, `${ms.toFixed(0)} ms`);
});

// ==============================================================================================
run("both moved rows of the same sheet: their sheet stays, mine is a copy", () => {
  const b0 = mk(lab());
  const mine = O.insertRows(set(b0, "C2", "mein"), "s1", 3, 1);
  const theirs = O.deleteRows(b0, "s1", 5, 1);
  const report: MergeReport = { conflicts: [] };
  const m = mergeWorkbooks(b0, mine, theirs, report);
  eq("two sheets", m.sheets.map((s) => s.name), ["Blatt 1", "Blatt 1 (Konflikt)"]);
  eq("theirs kept as it was", m.sheets[0].cells, theirs.sheets[0].cells);
  eq("their log kept", m.sheets[0].log, theirs.sheets[0].log);
  eq("mine in the copy", m.sheets[1].cells, mine.sheets[0].cells);
  eq("the copy starts without a log", m.sheets[1].log, undefined);
  eq("reported", report.conflicts, [{ sheetId: "s1", name: "Blatt 1", copyId: m.sheets[1].id, copyName: "Blatt 1 (Konflikt)" }]);
  const other = mergeWorkbooks(b0, theirs, mine);
  eq("the other way round", [other.sheets[0].cells, other.sheets[1].cells], [mine.sheets[0].cells, theirs.sheets[0].cells]);
  // Without a report object the copy is still made.
  eq("no report asked for", mergeWorkbooks(b0, mine, theirs).sheets.length, 2);
  // English names, taken names, long names.
  const en = mk(lab("Sheet 1"));
  eq("in English", mergeWorkbooks(en, O.insertRows(en, "s1", 3, 1), O.deleteRows(en, "s1", 5, 1)).sheets.map((s) => s.name), ["Sheet 1", "Sheet 1 (conflict)"]);
  eq("the language given", mergeWorkbooks(b0, mine, theirs, undefined, "en").sheets[1].name, "Blatt 1 (conflict)");
  const taken = O.addSheet(b0, "de", "Blatt 1 (Konflikt)").wb;
  eq("a free name", mergeWorkbooks(taken, O.insertRows(taken, "s1", 3, 1), O.deleteRows(taken, "s1", 5, 1)).sheets.map((s) => s.name), ["Blatt 1", "Blatt 1 (Konflikt 2)", "Blatt 1 (Konflikt)"]);
  const long = mk(lab("Kalibriergerade Nitrat Messung1"));
  const ln = mergeWorkbooks(long, O.insertRows(long, "s1", 3, 1), O.deleteRows(long, "s1", 5, 1)).sheets[1].name;
  eq("a long name fits", [ln, ln.length <= 31], ["Kalibriergerade Nitr (Konflikt)", true]);
  // Other sheets' cells and a sheet only one side changed merge as usual.
  const two = mk(lab(), mkSheet({ A1: "notiz" }, "s2", "Blatt 2"));
  const m2 = mergeWorkbooks(two, set(O.insertRows(two, "s1", 3, 1), "A2", "meins", "s2"), set(O.deleteRows(two, "s1", 5, 1), "A3", "deins", "s2"));
  eq("the other sheet merged cell by cell", [at(m2, "A1", "s2")?.v, at(m2, "A2", "s2")?.v, at(m2, "A3", "s2")?.v], ["notiz", "meins", "deins"]);
});

run("both moved rows: formulas and charts elsewhere fit the sheet that stays", () => {
  const b0 = mk(lab(), mkSheet({ A1: "='Blatt 1'!B7" }, "s2", "Auswertung"));
  const mine = O.insertRows(b0, "s1", 3, 1);
  const theirs = O.deleteRows(b0, "s1", 2, 1);
  const m = mergeWorkbooks(b0, mine, theirs);
  eq("their reference to P6 (the sheet is theirs)", [at(m, "A1", "s2")?.f, column(m, "A", 1, 1, "s2")], ["'Blatt 1'!B6", [0.6]]);
  const back = mergeWorkbooks(b0, theirs, mine);
  eq("the other way round", [at(back, "A1", "s2")?.f, column(back, "A", 1, 1, "s2")], ["'Blatt 1'!B8", [0.6]]);
  // My own edit of a formula elsewhere still wins.
  const edited = set(mine, "A2", "=1+1", "s2");
  eq("my real edit elsewhere stays", at(mergeWorkbooks(b0, edited, theirs), "A2", "s2")?.f, "1+1");
  // Charts and tables on the sheet: theirs stay on it, mine go to the copy.
  const wb0 = template("calibration");
  const s = wb0.sheets[0];
  const std = wb0.tables.find((t) => t.name === "Standards")!;
  const ins = O.insertRows(wb0, s.id, std.area.r0 + 2, 1);
  const sorted = T.sortTable(wb0, calc0(wb0), std.id, std.columns[2].id, "desc", "de");
  const report: MergeReport = { conflicts: [] };
  const mc = mergeWorkbooks(wb0, ins, sorted, report);
  const copyId = report.conflicts[0]?.copyId;
  eq("theirs on the sheet", [mc.tables.filter((t) => t.sheetId === s.id).map((t) => t.name), mc.tables.find((t) => t.id === std.id)?.area, mc.tables.find((t) => t.id === std.id)?.sort?.dir], [["Standards", "Proben"], std.area, "desc"]);
  eq("mine on the copy, with names of their own", mc.tables.filter((t) => t.sheetId === copyId).map((t) => [t.name, t.area.r1]), [
    ["Standards2", std.area.r1 + 1],
    ["Proben2", wb0.tables.find((t) => t.name === "Proben")!.area.r1 + 1],
  ]);
  const copied = mc.charts.filter((c) => c.sheetId === copyId);
  eq("the chart copied, pointing at the copy", [copied.length, copied[0]?.series.every((x) => x.y.sheetId === copyId)], [1, true]);
  eq("the chart on the sheet is theirs", mc.charts.filter((c) => c.sheetId === s.id).map((c) => c.series.map((x) => [x.y.r0, x.y.r1])), [sorted.charts[0].series.map((x) => [x.y.r0, x.y.r1])]);
});

// ==============================================================================================
run("history that can't be told: never a guess", () => {
  const base = O.insertRows(mk(lab(), mkSheet({ A1: "x" }, "s2", "Blatt 2")), "s1", 12, 1);
  const mine = O.insertRows(base, "s1", 3, 1);
  // Saved by an editor from before the log (it dropped it), with a correction.
  const old = stripLogs(set(base, "B7", 0.66));
  const report: MergeReport = { conflicts: [] };
  const m = mergeWorkbooks(base, mine, old, report);
  eq("their sheet with their correction, mine as a copy", [m.sheets.map((s) => s.name), column(m, "B", 7, 7), report.conflicts.length], [["Blatt 1", "Blatt 1 (Konflikt)", "Blatt 2"], [0.66], 1]);
  // They didn't touch that sheet: nothing to line up, mine stays.
  const elsewhere = stripLogs(set(base, "A2", "y", "s2"));
  const m2 = mergeWorkbooks(base, mine, elsewhere);
  eq("only the other sheet changed: no copy", [m2.sheets.length, rowOf(m2, "P3"), at(m2, "A2", "s2")?.v], [2, 4, "y"]);
  // More changes than the log keeps (a long time offline): base's newest entry is gone from mine.
  let offline = base;
  for (let i = 0; i < LOG_ENTRIES + 5; i++) offline = O.insertRows(offline, "s1", 20, 1);
  offline = O.insertRows(offline, "s1", 3, 1);
  const m3 = mergeWorkbooks(base, offline, set(base, "B7", 0.66));
  eq("capped log vs an edit: a copy", m3.sheets.map((s) => s.name), ["Blatt 1", "Blatt 1 (Konflikt)", "Blatt 2"]);
  const m4 = mergeWorkbooks(base, offline, set(base, "A2", "z", "s2"));
  eq("capped log, the other sheet edited: no copy", [m4.sheets.length, rowOf(m4, "P3"), at(m4, "A2", "s2")?.v], [2, 4, "z"]);
  // Content from before the log on every side merges cell by cell, as before.
  const b0 = mk(lab());
  const plain = mergeWorkbooks(b0, set(b0, "B2", 9), set(b0, "B7", 0.66));
  eq("old content: both edits, no copy, no log", [column(plain, "B", 2, 2), column(plain, "B", 7, 7), plain.sheets.length, plain.sheets[0].log], [[9], [0.66], 1, undefined]);
});

run("history both sides share", () => {
  const b0 = mk(lab());
  // A draft that was saved after all: the server already has my insert, plus their correction.
  const mine = O.insertRows(b0, "s1", 3, 1);
  const server = set(mine, "B8", 0.66);
  const m = mergeWorkbooks(b0, mine, server);
  eq("no copy, one inserted row, their correction", [m.sheets.length, column(m, "A", 2, 9), column(m, "B", 8, 8)], [1, ["P1", "P2", null, "P3", "P4", "P5", "P6", "P7"], [0.66]]);
  // An insert taken back again on my side changes no rows: their edit merges, no copy.
  const store = storeOf(b0);
  store.select({ row: 2, col: 0 });
  insertAtSelection(store, "rows");
  store.undo();
  const back = store.get().workbook;
  const m2 = mergeWorkbooks(b0, back, set(b0, "B7", 0.66));
  eq("insert and undo vs an edit", [m2.sheets.length, column(m2, "B", 2, 9)], [1, [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]]);
  eq("its log keeps both entries", kinds(m2), ["insertRows", "deleteRows"]);
  // Merging again later: the partner's next save lines up with the merged version on the server.
  const partner = set(b0, "B7", 0.66);
  const merged = mergeWorkbooks(b0, mine, partner);
  const partnerNext = set(partner, "B8", 0.77);
  const again = mergeWorkbooks(partner, partnerNext, merged);
  eq("the next merge lines up too", [again.sheets.length, column(again, "B", 2, 10)], [1, [0.1, 0.2, null, 0.3, 0.4, 0.5, 0.66, 0.77, 0.8]]);
  // …which the partner saved: my next save (base: what I saved) lines up with it as well.
  const mineAgain = mergeWorkbooks(merged, set(merged, "B2", 0.11), again);
  eq("and from my side", [mineAgain.sheets.length, column(mineAgain, "B", 2, 10)], [1, [0.11, 0.2, null, 0.3, 0.4, 0.5, 0.66, 0.77, 0.8]]);
});

// ==============================================================================================
// Undo and redo while a partner edits

type StepCase = { name: string; start: () => Workbook; step: (s: SheetStore) => void };

const tableLab = () => {
  const src = mk(lab());
  const tb = T.makeTable(src, calc0(src), "s1", { r0: 0, c0: 0, r1: 8, c1: 1 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  return tb.wb;
};
const notes = () => {
  const cells: Record<string, CellInput> = { A1: "Probe", B1: "Notiz", C1: "Extinktion" };
  for (let i = 1; i <= 8; i++) Object.assign(cells, { [`A${i + 1}`]: `P${i}`, [`B${i + 1}`]: "ok", [`C${i + 1}`]: i / 10 });
  return mk(mkSheet(cells));
};
const STEPS: StepCase[] = [
  { name: "rows inserted", start: () => mk(lab()), step: (s) => (s.select({ row: 2, col: 0 }), insertAtSelection(s, "rows")) },
  { name: "rows deleted", start: () => mk(lab()), step: (s) => (s.select({ row: 2, col: 0 }), deleteAtSelection(s, "rows")) },
  { name: "a column inserted", start: () => mk(lab()), step: (s) => (s.select({ row: 0, col: 1 }), insertAtSelection(s, "cols")) },
  { name: "a column deleted", start: notes, step: (s) => (s.select({ row: 0, col: 1 }), deleteAtSelection(s, "cols")) },
  { name: "rows sorted", start: () => mk(lab()), step: (s) => s.apply("Sortieren", (wb) => SORT_DESC(wb)) },
  {
    name: "a smart table sorted",
    start: tableLab,
    step: (s) => {
      const t = s.get().workbook.tables[0];
      s.apply("Sortieren", (wb, calc) => T.sortTable(wb, calc, t.id, t.columns[1].id, "desc", "de"));
    },
  },
  { name: "a row inserted into a smart table", start: tableLab, step: (s) => (s.select({ row: 3, col: 0 }), insertAtSelection(s, "rows")) },
  { name: "a row of a smart table deleted", start: tableLab, step: (s) => (s.select({ row: 3, col: 1 }), deleteAtSelection(s, "rows")) },
  { name: "cut and paste", start: () => mk(lab()), step: (s) => s.apply("Verschieben", (wb) => CUT(wb, { r0: 1, c0: 0, r1: 8, c1: 1 }, { row: 1, col: 3 })) },
];

/** Where P6's value is in a workbook: its label's row, the first number right of the label. */
function p6(wb: Workbook): { row: number; col: number } {
  const cells = wb.sheets[0].cells;
  for (const key in cells) {
    if (cells[key].v !== "P6") continue;
    const [r, c] = key.split(",").map(Number);
    for (let col = c + 1; col < 26; col++) if (typeof cells[cellKey(r, col)]?.v === "number") return { row: r, col };
  }
  return { row: -1, col: -1 };
}

for (const c of STEPS) {
  run(`undo while a partner edits: ${c.name}`, () => {
    const start = c.start();
    const valueOf = (wb: Workbook) => {
      const p = p6(wb);
      return O.getCell(wb, "s1", p.row, p.col)?.v;
    };
    const store = storeOf(start);
    c.step(store);
    const after = store.get().workbook;
    check("the step changed something", after !== start);
    // The partner sees my step and corrects P6 where it is now; that arrives like the saver brings it.
    const p = p6(after);
    store.replaceRemote(O.setCells(after, "s1", [{ row: p.row, col: p.col, cell: { v: 0.66 } }]));
    store.undo();
    const undone = store.get().workbook;
    eq("undone: P6 back on its row, with the partner's correction", [rowOf(undone, "P6"), valueOf(undone)], [rowOf(start, "P6"), 0.66]);
    eq("undone: every other value as before", column(undone, "A", 1, 12), column(start, "A", 1, 12));
    eq("undone: the tables as before", undone.tables.map((t) => t.area), start.tables.map((t) => t.area));
    store.redo();
    const redone = store.get().workbook;
    eq("redone: the step again, the correction still there", [rowOf(redone, "P6"), valueOf(redone)], [rowOf(after, "P6"), 0.66]);
    store.undo();
    eq("undone again", [rowOf(store.get().workbook, "P6"), valueOf(store.get().workbook)], [rowOf(start, "P6"), 0.66]);
    // Without a partner, undo and redo give exactly the versions from before.
    const alone = storeOf(start);
    c.step(alone);
    const done = alone.get().workbook;
    alone.undo();
    eq("alone: undo gives the cells from before", alone.get().workbook.sheets[0].cells, start.sheets[0].cells);
    alone.redo();
    eq("alone: redo gives the step's cells", alone.get().workbook.sheets[0].cells, done.sheets[0].cells);
  });
}

run("undo while a partner edits: their edit made before they saw my step", () => {
  const b0 = mk(lab());
  const store = storeOf(b0);
  store.select({ row: 2, col: 0 });
  insertAtSelection(store, "rows");
  // Merged by my saver: base = b0, mine = with my insert, theirs = their correction of P6.
  store.replaceRemote(mergeWorkbooks(b0, store.get().workbook, set(b0, "B7", 0.66)));
  eq("merged onto the moved row", column(store.get().workbook, "B", 8, 8), [0.66]);
  store.undo();
  eq("undone: kept", column(store.get().workbook, "B", 2, 9), [0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]);
});

run("undo: my undo saved after the partner's edit (the saver's order)", () => {
  const b0 = mk(lab());
  const after = O.insertRows(b0, "s1", 2, 1);
  // I undo before anything arrives; meanwhile the partner corrected P6 on its new row and saved.
  const back = takeBack(after, b0, after);
  if (!("wb" in back)) throw new Error(`refused: ${back.refused}`);
  const undone = back.wb;
  eq("the undo is logged as a delete", kinds(undone), ["insertRows", "deleteRows"]);
  const server = set(after, "B8", 0.66);
  const m = mergeWorkbooks(after, undone, server);
  eq("their correction stays, my row is gone", [column(m, "A", 2, 9), column(m, "B", 7, 7)], [["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"], [0.66]]);
});

run("undo: several steps back past an older insert", () => {
  const b0 = mk(lab());
  const store = storeOf(b0);
  store.select({ row: 2, col: 0 });
  insertAtSelection(store, "rows");
  store.input({ row: 9, col: 1 }, "0,88");
  const w = store.get().workbook;
  // P6 and P2 where the partner sees them: one row further down.
  store.replaceRemote(set(set(w, "B8", 0.66), "B4", 0.22));
  store.undo();
  store.undo();
  eq("both partner edits stay, both of my steps are gone", column(store.get().workbook, "B", 2, 9), [0.1, 0.22, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]);
  eq("nothing left to undo", store.get().canUndo, false);
});

run("undo: a partner moved rows of the same sheet since → no guess", () => {
  const b0 = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const store = storeOf(b0);
  store.input({ row: 1, col: 1 }, "0,11");
  store.select({ row: 4, col: 0 });
  insertAtSelection(store, "rows");
  const theirs = O.insertRows(store.get().workbook, "s1", 0, 1);
  store.replaceRemote(theirs);
  store.undo();
  check("the document stays as it is", store.get().workbook === theirs);
  const notice = currentSheetNotice(store)?.text ?? "";
  check("a notice says why", notice.startsWith("Das lässt sich nicht mehr rückgängig machen") && notice.includes("„Blatt 1“"), show(notice));
  hideSheetNotice(store);
  eq("the step is gone, the one before is next", [store.get().canUndo, store.get().undoLabel], [true, "Eingabe"]);
  store.undo();
  eq("the older edit is undone, both inserted rows stay", column(store.get().workbook, "B", 1, 4), [null, "Extinktion", 0.1, 0.2]);
  eq("…and the inserts are still there", column(store.get().workbook, "A", 1, 8), [null, "Probe", "P1", "P2", "P3", null, "P4", "P5"]);
  // A partner's insert on another sheet doesn't stop the undo.
  const other = storeOf(b0);
  other.select({ row: 2, col: 0 });
  insertAtSelection(other, "rows");
  other.replaceRemote(set(O.insertRows(other.get().workbook, "s2", 0, 3), "A1", "fremd", "s2"));
  other.undo();
  eq("other sheet: undone", [column(other.get().workbook, "A", 2, 4), at(other.get().workbook, "A1", "s2")?.v], [["P1", "P2", "P3"], "fremd"]);
  // An undone partner insert in between is no move.
  const third = storeOf(mk(lab()));
  third.select({ row: 2, col: 0 });
  insertAtSelection(third, "rows");
  const theirs3 = O.insertRows(third.get().workbook, "s1", 0, 1);
  const op = theirs3.sheets[0].log![theirs3.sheets[0].log!.length - 1];
  third.replaceRemote(O.replayOp(theirs3, "s1", inverseOp(op, O.newId())!)!);
  third.undo();
  eq("their insert and its undo: mine can still be undone", column(third.get().workbook, "A", 2, 9), ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
});

run("undo: a redo is refused the same way", () => {
  const store = storeOf(mk(lab()));
  store.select({ row: 2, col: 0 });
  insertAtSelection(store, "rows");
  store.undo();
  const theirs = O.deleteRows(store.get().workbook, "s1", 7, 1);
  store.replaceRemote(theirs);
  store.redo();
  check("nothing redone", store.get().workbook === theirs);
  check("a notice says why", (currentSheetNotice(store)?.text ?? "").startsWith("Das lässt sich nicht mehr wiederholen"), show(currentSheetNotice(store)));
  hideSheetNotice(store);
  eq("no redo left", store.get().canRedo, false);
});

run("undo: the notice says why and names the sheet that is about", () => {
  const noticeOf = (s: SheetStore) => {
    const text = currentSheetNotice(s)?.text ?? "";
    hideSheetNotice(s);
    return text;
  };
  // A cut to another sheet, which the partner deleted since.
  const two = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const gone = storeOf(two);
  gone.apply("Verschieben", (wb) => CUT(wb, P_ROWS, { row: 1, col: 0 }, "s2"));
  const without = O.deleteSheet(gone.get().workbook, "s2");
  gone.replaceRemote(without);
  gone.undo();
  eq("a sheet it needs is gone", [gone.get().workbook === without, noticeOf(gone)], [true, "Das lässt sich nicht mehr rückgängig machen: Das Blatt „Blatt 2“ gibt es nicht mehr."]);
  // Saved by an editor from before the log (it dropped it): what happened to the rows can't be told.
  const old = storeOf(mk(lab()));
  old.select({ row: 2, col: 0 });
  insertAtSelection(old, "rows");
  old.replaceRemote(stripLogs(set(old.get().workbook, "B8", 0.66)));
  old.undo();
  check("history that can't be told", noticeOf(old).includes("kann ich nicht genau nachverfolgen"));
  // Taking back a deleted row would push the partner's last row off the sheet.
  const full = storeOf(mk({ ...lab(), size: { rows: 20000, cols: 26 } }));
  full.select({ row: 2, col: 0 });
  deleteAtSelection(full, "rows");
  full.replaceRemote(set(full.get().workbook, "A20000", "letzte Zeile"));
  full.undo();
  check("no room left", noticeOf(full).includes("kein Platz mehr"));
  // In English.
  const en = storeOf(mk(lab("Sheet 1"), mkSheet({}, "s2", "Sheet 2")), "en");
  en.apply("Move", (wb) => CUT(wb, P_ROWS, { row: 1, col: 0 }, "s2"));
  en.replaceRemote(O.deleteSheet(en.get().workbook, "s2"));
  en.undo();
  eq("in English", noticeOf(en), "This can't be undone any more: the sheet “Sheet 2” isn't there any more.");
});

run("undo: a cut into a new sheet, with the partner's correction in between", () => {
  const store = storeOf(mk(lab()));
  let added = "";
  store.apply("Blatt", (wb) => {
    const a = O.addSheet(wb, "de", "Rohdaten");
    added = a.sheetId;
    return a.wb;
  });
  store.apply("Verschieben", (wb) => CUT(wb, P_ROWS, { row: 1, col: 0 }, added));
  store.replaceRemote(set(store.get().workbook, "B7", 0.66, added));
  store.undo();
  eq("back on Blatt 1, with the correction", [column(store.get().workbook, "B", 2, 9), column(store.get().workbook, "B", 2, 9, added).every((v) => v === null)], [[0.1, 0.2, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8], true]);
  store.undo();
  eq("and the new sheet gone again", names(store.get().workbook), ["Blatt 1"]);
});

// ==============================================================================================
// Live: someone else's change of rows arrives while I work (store.replaceRemote)

run("live: the cell being typed into and the selection stay on their cells", () => {
  const b0 = mk(lab());
  // Typing the corrected P6 into B7 when the partner's row insert above it arrives.
  const typing = storeOf(b0);
  typing.select({ row: 6, col: 1 });
  typing.startEdit({ via: "cell", replace: true, text: "0" });
  typing.updateEdit("0,66", 4);
  typing.replaceRemote(O.insertRows(b0, "s1", 2, 1));
  const e = typing.get().edit;
  eq("the edit moved down with P6, what was typed kept", [e?.row, e?.col, e?.text], [7, 1, "0,66"]);
  typing.commitEdit("down");
  eq("entered on P6's row, P5 untouched", [column(typing.get().workbook, "A", 7, 8), column(typing.get().workbook, "B", 7, 8)], [["P5", "P6"], [0.5, 0.66]]);
  // B7 selected, then the insert arrives, then typing.
  const selected = storeOf(b0);
  selected.select({ row: 6, col: 1 });
  selected.replaceRemote(O.insertRows(b0, "s1", 2, 1));
  eq("the selection moved down", selected.get().selection.anchor, { row: 7, col: 1 });
  selected.input(selected.get().selection.anchor, "0,66");
  eq("typed onto P6", column(selected.get().workbook, "B", 8, 8), [0.66]);
  // An area, a row deleted above it; a sort; a selected row that was deleted.
  const area = storeOf(b0);
  area.select({ r0: 4, c0: 0, r1: 6, c1: 1 });
  area.replaceRemote(O.deleteRows(b0, "s1", 1, 1));
  eq("an area moved up", mainArea(area.get().selection), { r0: 3, c0: 0, r1: 5, c1: 1 });
  const sorted = storeOf(b0);
  sorted.select({ row: 2, col: 1 });
  sorted.replaceRemote(SORT_DESC(b0));
  eq("a sort: the selection goes with its row", sorted.get().selection.anchor, { row: 7, col: 1 });
  const deleted = storeOf(b0);
  deleted.select({ row: 6, col: 1 });
  deleted.replaceRemote(O.deleteRows(b0, "s1", 6, 1));
  eq("its row deleted: the selection stays where it was", deleted.get().selection.anchor, { row: 6, col: 1 });
  // The other sheets' selections, remembered for coming back, move too.
  const away = storeOf(mk(lab(), mkSheet({}, "s2", "Blatt 2")));
  away.select({ row: 6, col: 1 });
  away.setSheet("s2");
  away.replaceRemote(O.insertRows(away.get().workbook, "s1", 0, 2));
  away.setSheet("s1");
  eq("a remembered selection too", away.get().selection.anchor, { row: 8, col: 1 });
});

run("live: a running edit whose cell is gone ends, with a notice", () => {
  const b0 = mk(lab());
  const store = storeOf(b0);
  store.select({ row: 6, col: 1 });
  store.startEdit({ via: "cell", replace: true, text: "0,66" });
  store.replaceRemote(O.deleteRows(b0, "s1", 6, 1));
  check("the edit ends", store.get().edit === null);
  eq("the notice says what wasn't entered", currentSheetNotice(store)?.text, "„0,66“ wurde nicht eingetragen: Jemand (oder du auf einem anderen Gerät) hat gerade die Zeile oder Spalte dieser Zelle gelöscht oder die Zelle verschoben.");
  hideSheetNotice(store);
  eq("nothing entered anywhere", column(store.get().workbook, "B", 2, 9), [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, null]);
  // Cut to another sheet by the partner: the same.
  const two = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const away = storeOf(two);
  away.select({ row: 6, col: 1 });
  away.startEdit({ via: "cell", replace: true, text: "0,66" });
  away.replaceRemote(CUT(two, P_ROWS, { row: 1, col: 0 }, "s2"));
  check("moved to another sheet: the edit ends", away.get().edit === null && (currentSheetNotice(away)?.text ?? "").startsWith("„0,66“ wurde nicht eingetragen"));
  hideSheetNotice(away);
  // Nothing typed yet: it just ends.
  const quiet = storeOf(b0);
  quiet.select({ row: 6, col: 1 });
  quiet.startEdit({ via: "cell", replace: false });
  quiet.replaceRemote(O.deleteRows(b0, "s1", 6, 1));
  eq("an edit with nothing typed ends without a notice", [quiet.get().edit, currentSheetNotice(quiet)], [null, null]);
});

run("live: copied cells are followed, a cut whose cells moved is cancelled", () => {
  const b0 = mk(lab());
  const copy = storeOf(b0);
  copy.setClip({ sheetId: "s1", area: { r0: 4, c0: 0, r1: 6, c1: 1 }, cut: false });
  copy.replaceRemote(O.insertRows(b0, "s1", 1, 2));
  eq("copied: the marching ants follow", copy.get().clip?.area, { r0: 6, c0: 0, r1: 8, c1: 1 });
  const cut = storeOf(b0);
  cut.setClip({ sheetId: "s1", area: { r0: 4, c0: 0, r1: 6, c1: 1 }, cut: true });
  cut.replaceRemote(O.insertRows(b0, "s1", 12, 2));
  eq("cut, nothing moved there: kept", cut.get().clip?.area, { r0: 4, c0: 0, r1: 6, c1: 1 });
  cut.replaceRemote(O.insertRows(cut.get().workbook, "s1", 1, 1));
  eq("cut, its cells moved: cancelled", cut.get().clip, null);
  check("with a notice", (currentSheetNotice(cut)?.text ?? "").startsWith("Ausschneiden abgebrochen"), show(currentSheetNotice(cut)));
  hideSheetNotice(cut);
  const over = storeOf(b0);
  over.setClip({ sheetId: "s1", area: { r0: 1, c0: 0, r1: 2, c1: 1 }, cut: true });
  over.replaceRemote(CUT(b0, { r0: 5, c0: 0, r1: 6, c1: 1 }, { row: 1, col: 0 }));
  eq("cut, other cells pasted over it: cancelled", over.get().clip, null);
  hideSheetNotice(over);
});

run("live: both moved rows of a sheet, my edit goes on in my copy", () => {
  const b0 = mk(lab());
  const store = storeOf(b0);
  store.select({ row: 2, col: 0 });
  insertAtSelection(store, "rows");
  store.select({ row: 7, col: 1 });
  store.startEdit({ via: "cell", replace: true, text: "0,66" });
  const { m, report } = reported(b0, store.get().workbook, O.deleteRows(b0, "s1", 1, 1));
  store.replaceRemote(m, report.conflicts);
  const copyId = report.conflicts[0]?.copyId;
  eq("the edit and the screen on the copy", [store.get().edit?.sheetId, store.get().sheetId, store.get().edit?.row], [copyId, copyId, 7]);
  store.commitEdit();
  eq("entered on P6's row of my version", [column(store.get().workbook, "A", 8, 8, copyId), column(store.get().workbook, "B", 8, 8, copyId)], [["P6"], [0.66]]);
  eq("their sheet untouched", column(store.get().workbook, "B", 1, 9), column(m, "B", 1, 9));
});

// ==============================================================================================
run("duplicating a sheet: table names that aren't cells (DS-14)", () => {
  const wb = template("bradford");
  const dup = O.duplicateSheet(wb, wb.sheets[0].id).wb;
  eq("names", dup.tables.map((t) => t.name), ["BSA", "Proben", "BSA_2", "Proben2"]);
  eq("stable when read again", normalizeWorkbook(JSON.parse(JSON.stringify(dup)), "de").tables.map((t) => t.name), ["BSA", "Proben", "BSA_2", "Proben2"]);
  eq("again", O.duplicateSheet(dup, dup.sheets[0].id).wb.tables.map((t) => t.name), ["BSA", "Proben", "BSA_2", "Proben2", "BSA_3", "Proben3"]);
  const cal = template("calibration");
  eq("calibration", O.duplicateSheet(cal, cal.sheets[0].id).wb.tables.map((t) => t.name), ["Standards", "Proben", "Standards2", "Proben2"]);
  eq("the rules", [T.validTableName("BSA2"), T.validTableName("BSA_2"), freeTableName(["OD"], "de", "OD"), freeTableName(["pH", "pH_2"], "de", "pH"), T.uniqueTableName(cal, "en")], [false, true, "OD_2", "pH_3", "Table1"]);
});

run("picking a template can't be undone into an empty sheet (UXD-2)", () => {
  const store = storeOf(normalizeWorkbook(null, "de"));
  const tpl = template("calibration");
  store.reset(tpl);
  eq("the template, nothing to undo", [store.get().workbook === tpl, store.get().canUndo, store.get().sheetId], [true, false, tpl.sheets[0].id]);
  store.undo();
  check("undo right after: still the template", store.get().workbook === tpl);
  store.input({ row: 7, col: 2 }, "0,110");
  store.undo();
  check("undo of an edit: back to the template", store.get().workbook === tpl);
  store.undo();
  check("and no further", store.get().workbook === tpl && !store.get().canUndo);
  // Edits before the template are gone from the history too.
  const s2 = storeOf(normalizeWorkbook(null, "de"));
  s2.input({ row: 0, col: 0 }, "x");
  s2.reset(tpl);
  s2.undo();
  check("history from before is cleared", s2.get().workbook === tpl && !s2.get().canRedo);
});

// ==============================================================================================
if (failures.length) {
  console.error(`check:sheet-merge — ${failures.length} of ${count} checks failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:sheet-merge — all ${count} checks passed.`);
// (A notice's timer would keep Node waiting.)
process.exit(0);
