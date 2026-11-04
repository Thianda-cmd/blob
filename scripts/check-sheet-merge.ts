// Checks merging and undo when rows or columns move (src/sheet/collab.ts, src/sheet/sheetLog.ts,
// the logged changes in src/sheet/ops.ts, undo and redo in src/components/sheet/store.ts): every
// insert, delete, sort and cut and paste is written into the sheet's log; a partner's edit made at
// the same time lands on the row it was made on, whoever saves second; both sides moving rows of
// the same sheet gives a copy of mine instead of a guess (with a report); history that can't be
// told (old content, a capped log) never lines up by guessing; cuts into or out of a sheet only
// one side has (a new one) line up without a copy, a cut into a sheet the other side deleted gives
// one; a copy never pushes a sheet out of a full workbook; normalizeWorkbook keeps and checks the
// log; undo and redo of every kind of step keep a partner's later edits, and a refused one says
// why; the selection, the cell being typed into and what was cut follow a partner's change of
// rows as it arrives; a template picked can't be undone into an empty sheet; a duplicated sheet's
// tables get names that aren't cells. And what someone saved is never lost, nor does a number
// silently read someone else's rows (the sweep's COL findings): a sheet, or rows that were empty for
// whoever deleted them, deleted on a stale view stay when the other side wrote into them; undo and
// redo keep a partner's later edits and say so; formulas and charts written for my version follow
// it to its copy; sorts of any size line up; undo alone goes back as far as the history; formulas
// follow renames; undo after a conflict says where my version is, once; the copy is marked and the
// other person told, with wording for the reason; a cancelled cut pastes nothing; the saver says
// when a copy makes the spreadsheet too big, and my version can become a spreadsheet of its own.
//
//   npm run check:sheet-merge
//
// Problems make the script exit with 1.
import { deleteAtSelection, insertAtSelection } from "@/components/sheet/grid/actions";
import { copySelection, pasteData } from "@/components/sheet/grid/clipboard";
import { currentSheetNotice, hideSheetNotice } from "@/components/sheet/notice";
import { MAX_BYTES, SheetSaver, type SaveArgs, type SaverApi, type SheetConflict } from "@/components/sheet/saver";
import { createSheetStore, mainArea, type SheetStore } from "@/components/sheet/store";
import type { Locale } from "@/i18n/config";
import { sheetText } from "@/i18n/messages/sheet";
import { cellKey, parsePos, posName } from "@/sheet/a1";
import { arrivedCopies, copyTies, mergeWorkbooks, ownVersion, takeBack, tiedCopy, type MergeReport } from "@/sheet/collab";
import { normalizeWorkbook } from "@/sheet/doc";
import { createCalc } from "@/sheet/engine";
import * as O from "@/sheet/ops";
import { capLog, inverseOp, LOG_ENTRIES, LOG_SORT_ROWS, netOps, opsSince } from "@/sheet/sheetLog";
import * as T from "@/sheet/table/model";
import { freeTableName } from "@/sheet/table/names";
import { SHEET_TEMPLATES } from "@/sheet/templates";
import { MAX_ROWS, type Cell, type Sheet, type SheetOp, type Workbook } from "@/sheet/types";

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
  const many = Array.from({ length: LOG_ENTRIES + 10 }, (_, i) => ins(`e${i}`, i));
  const capped = capLog(many);
  eq("capped to the newest", [capped.length, capped[0].kind, capped[0].id, capped[1].id, capped[capped.length - 1].id], [LOG_ENTRIES, "barrier", "e10", "e11", `e${LOG_ENTRIES + 9}`]);
  check("more than twice the undo history (200 steps)", LOG_ENTRIES >= 2 * 200);
  const short = many.slice(0, 5);
  check("short logs stay the same", capLog(short) === short);
  const sort = (id: string, n: number): SheetOp => ({ id, kind: "sort", r0: 0, c0: 0, c1: 0, order: Array.from({ length: n }, (_, i) => n - 1 - i) });
  const full = [ins("a"), sort("big", MAX_ROWS)];
  check("a sort of every row a sheet holds is kept (COL-4)", capLog(full) === full && LOG_SORT_ROWS === MAX_ROWS);
  check("…and its undo too", capLog([...full, sort("back", MAX_ROWS)]).every((op) => op.kind !== "barrier"));
  eq("three of them: the oldest goes", capLog([ins("a"), sort("s1", MAX_ROWS), sort("s2", MAX_ROWS), sort("s3", MAX_ROWS)]).map((op) => op.kind), ["barrier", "sort"]);
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
  raw.sheets[0].log = Array.from({ length: LOG_ENTRIES + 20 }, (_, i) => ({ id: `e${i}`, kind: "insertRows", at: 1, count: 1 }));
  const long = normalizeWorkbook(raw, "de").sheets[0].log!;
  eq("at most the newest entries", [long.length, long[0].kind, long[long.length - 1].id], [LOG_ENTRIES, "barrier", `e${LOG_ENTRIES + 19}`]);
  raw.sheets[0].log = [{ id: "s", kind: "sort", r0: 0, c0: 0, c1: 0, order: Array.from({ length: MAX_ROWS }, (_, i) => MAX_ROWS - 1 - i) }];
  eq("a sort of every row read back as a sort", normalizeWorkbook(raw, "de").sheets[0].log!.map((op) => op.kind), ["sort"]);
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
  // The other way round, their cut into the sheet I deleted is work they saved: that sheet stays (COL-1).
  const back = reported(b0, gone, into);
  eq("…the other way round: the cells in the copy, and the sheet they cut into stays", [names(back.m), column(back.m, "B", 2, 4, back.report.conflicts[0]?.copyId), column(back.m, "C", 2, 4, "s2")], [["Blatt 1", "Blatt 1 (Konflikt)", "Notizen"], [0.1, 0.2, 0.3], [0.1, 0.2, 0.3]]);
  eq("…reported", back.report.conflicts.map((c) => c.why), ["gone", "keptTheirs"]);
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
  eq("reported without a copy", report.conflicts, [{ sheetId: "s1", name: "Blatt 1", copyId: "", copyName: "", why: "moved" }]);
  const one = mk(...sheets.slice(0, 249));
  const room = reported(one, O.insertRows(one, "s1", 3, 1), O.deleteRows(one, "s1", 5, 1));
  eq("room for one copy", [room.m.sheets.length, room.m.sheets[1].name, room.report.conflicts[0]?.copyName], [250, "Blatt 1 (Konflikt)", "Blatt 1 (Konflikt)"]);
  // What the editor says (useSheetSave.ts, flushDrafts.ts): no empty „“ for a copy that wasn't made.
  const start = "Du und jemand anderes (oder du auf einem anderen Gerät) habt gleichzeitig in „Blatt 1“ Zeilen oder Spalten eingefügt, gelöscht, sortiert oder verschoben.";
  eq("said without a copy", sheetText.de.conflict(report.conflicts), `${start} Weil eine Tabelle höchstens 250 Blätter haben kann, konnte deine Version kein eigenes Blatt bekommen: Es gibt nur noch die andere Version.`);
  eq("said with a copy, and what to do next (COL-9)", sheetText.de.conflict(room.report.conflicts), `${start} Damit nichts verloren geht, steht deine Version jetzt auf „Blatt 1 (Konflikt)“. Kopier, was du aus „Blatt 1 (Konflikt)“ brauchst, nach „Blatt 1“ und lösch dann die Konflikt-Kopie.`);
  const both = [...room.report.conflicts, { sheetId: "s2", name: "Blatt 2", copyId: "", copyName: "", why: "unknown" as const }];
  const said = sheetText.en.conflictElsewhere("Messung", both);
  check("one copy made, one without room: both said", said.startsWith("Spreadsheet “Messung”: ") && said.includes("your version is now on “Blatt 1 (Konflikt)”") && said.includes("Your changes to “Blatt 2” couldn't be combined") && said.includes("only the other version is left") && !said.includes("“”"), show(said));
  eq("in English, two without room", sheetText.en.conflict([report.conflicts[0], both[1]]), "You and someone else (or you on another device) inserted, deleted, sorted or moved rows or columns in “Blatt 1” at the same time. A spreadsheet holds at most 250 sheets, so your version couldn't get a sheet of its own: only the other version is left. Your changes to “Blatt 2” couldn't be combined with someone else's (or yours from another device). A spreadsheet holds at most 250 sheets, so your version couldn't get a sheet of its own: only the other version is left.");
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
  eq("reported", report.conflicts, [{ sheetId: "s1", name: "Blatt 1", copyId: m.sheets[1].id, copyName: "Blatt 1 (Konflikt)", why: "moved" }]);
  eq("the copy is marked as one (COL-9)", [m.sheets[1].copyOf, m.sheets[0].copyOf], ["s1", undefined]);
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
  // Taken back in one go: the new sheet, the cut into it, a row inserted and a sort there.
  const b0 = mk(lab());
  const added2 = O.addSheet(b0, "de", "Rohdaten");
  let mine = CUT(added2.wb, P_ROWS, { row: 1, col: 0 }, added2.sheetId);
  mine = O.insertRows(mine, added2.sheetId, 3, 1);
  mine = O.sortArea(mine, calc0(mine), added2.sheetId, { r0: 1, c0: 0, r1: 9, c1: 1 }, [{ col: 1, dir: "desc" }], "de");
  const back = takeBack(mine, b0, mergeWorkbooks(b0, mine, set(set(b0, "B7", 0.66), "B3", 0.22)));
  eq("all in one go: the new sheet gone, their corrections back on Blatt 1", "wb" in back ? [names(back.wb), column(back.wb, "B", 2, 9)] : back, [["Blatt 1"], [0.1, 0.22, 0.3, 0.4, 0.5, 0.66, 0.7, 0.8]]);
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
  // A sheet kept as theirs in a merge (both moved its rows): a cut there is cancelled, copied
  // cells go with my version (the copy); without the report it can't be told, so a cut is cancelled.
  const mine = O.insertRows(b0, "s1", 2, 1);
  const { m, report } = reported(b0, mine, O.deleteRows(b0, "s1", 1, 1));
  const area2 = { r0: 4, c0: 0, r1: 6, c1: 1 };
  const cutThere = storeOf(mine);
  cutThere.setClip({ sheetId: "s1", area: area2, cut: true });
  cutThere.replaceRemote(m, report.conflicts);
  eq("a cut on a sheet kept as theirs: cancelled", cutThere.get().clip, null);
  hideSheetNotice(cutThere);
  const copiedThere = storeOf(mine);
  copiedThere.setClip({ sheetId: "s1", area: area2, cut: false });
  copiedThere.replaceRemote(m, report.conflicts);
  eq("copied cells there: with my version", [copiedThere.get().clip?.sheetId, copiedThere.get().clip?.area], [report.conflicts[0]?.copyId, area2]);
  const unsure = storeOf(mine);
  unsure.setClip({ sheetId: "s1", area: area2, cut: true });
  unsure.replaceRemote(m);
  eq("a cut where what happened can't be told: cancelled", unsure.get().clip, null);
  hideSheetNotice(unsure);
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
// Work someone saved is never lost, and a number never silently reads someone else's rows
// (the sweep's COL findings)

/** The notice on screen, then gone. */
const noticeOf = (s: SheetStore) => {
  const text = currentSheetNotice(s)?.text ?? "";
  hideSheetNotice(s);
  return text;
};
/** A chart over column B of sheet `sheetId`, rows r0…r1, floating on sheet `on`. */
const chartOver = (id: string, on: string, sheetId: string, r0: number, r1: number) => {
  const c = template("calibration").charts[0];
  return { ...c, id, sheetId: on, x: null, series: [{ ...c.series[0], id: `${id}-y`, x: null, nameRef: null, errorBars: null, y: { sheetId, r0, c0: 1, r1, c1: 1 } }] };
};

run("COL-1: a sheet deleted on a stale view stays when the other side wrote into it (both orders)", () => {
  const b0 = mk(lab(), mkSheet({ A1: "Summe", B1: "=SUM('Messung 2'!B2:B3)" }, "s2", "Auswertung"), mkSheet({}, "s3", "Messung 2"));
  const del = O.deleteSheet(b0, "s3");
  const filled = set(set(set(b0, "A1", "Probe", "s3"), "A2", "M1", "s3"), "B2", 0.512, "s3");
  const cases = [
    ["the one who deleted it saves second", del, filled, "keptTheirs"],
    ["the one who wrote into it saves second", filled, del, "keptMine"],
  ] as const;
  for (const [who, mine, theirs, why] of cases) {
    const { m, report } = reported(b0, mine, theirs);
    eq(`${who}: the sheet stays with what was written`, [names(m), at(m, "A2", "s3")?.v, at(m, "B2", "s3")?.v], [["Blatt 1", "Auswertung", "Messung 2"], "M1", 0.512]);
    eq(`${who}: the formula reading it still does`, [at(m, "B1", "s2")?.f, column(m, "B", 1, 1, "s2")], ["SUM('Messung 2'!B2:B3)", [0.512]]);
    eq(`${who}: reported`, report.conflicts.map((c) => [c.why, c.name, c.copyName]), [[why, "Messung 2", ""]]);
  }
  // A chart over it on another sheet and a table on it come back with it.
  const withChart = O.putChart(b0, chartOver("c1", "s2", "s3", 1, 3));
  const tb = T.makeTable(set(set(withChart, "A1", "M", "s3"), "A2", 1, "s3"), calc0(withChart), "s3", { r0: 0, c0: 0, r1: 1, c1: 0 }, "de");
  if (!("wb" in tb)) throw new Error("no table");
  const filled2 = set(tb.wb, "A3", 2, "s3");
  for (const m of bothOrders(tb.wb, O.deleteSheet(tb.wb, "s3"), filled2)) eq("its chart and table stay too", [m.charts.map((c) => c.series[0].y.sheetId), m.tables.map((t) => t.sheetId)], [["s3"], ["s3"]]);
  // Left as it was by the other side (renamed only, or edited elsewhere): deleted.
  for (const m of bothOrders(b0, del, O.renameSheet(set(b0, "A5", "x", "s2"), "s3", "Messung B"))) eq("only renamed by the other side: deleted", names(m), ["Blatt 1", "Auswertung"]);
  // Its cells cut and pasted to another sheet by the other side: nothing is left on it, so it stays
  // deleted (and isn't said to be back), whoever saves second.
  const full = mk(lab(), mkSheet({ A1: "M1", A2: 0.5, A3: 0.6 }, "s3", "Messung 2"));
  const cutOut = CUT(full, { r0: 0, c0: 0, r1: 2, c1: 0 }, { row: 0, col: 4 }, "s1", "s3");
  for (const [i, { m, report }] of [reported(full, O.deleteSheet(full, "s3"), cutOut), reported(full, cutOut, O.deleteSheet(full, "s3"))].entries()) {
    eq(`emptied by a cut on the other side (${i ? "the cutter" : "the deleter"} saves second): stays deleted`, [names(m).includes("Messung 2"), report.conflicts.some((c) => c.why === "keptMine" || c.why === "keptTheirs")], [false, false]);
  }
  eq("said to the one who deleted it", sheetText.de.conflict([{ name: "Messung 2", copyName: "", why: "keptTheirs" }]), "Du hattest „Messung 2“ gelöscht, aber inzwischen hat jemand (oder du auf einem anderen Gerät) darin etwas eingetragen. Damit nichts verloren geht, ist das Blatt wieder da.");
  // The one who deleted it saved first: told when it comes back with the other's save.
  const deleter = storeOf(b0);
  deleter.apply("Blatt löschen", (wb) => O.deleteSheet(wb, "s3"));
  deleter.replaceRemote(mergeWorkbooks(b0, filled, deleter.get().workbook));
  eq("…the one who deleted it first, on the next sync", [names(deleter.get().workbook), noticeOf(deleter)], [["Blatt 1", "Auswertung", "Messung 2"], "„Messung 2“ ist wieder da: Du hattest das Blatt gelöscht, aber inzwischen hatte jemand (oder du auf einem anderen Gerät) darin etwas eingetragen."]);
  const told = storeOf(b0);
  told.apply("Blatt löschen", (wb) => O.deleteSheet(wb, "s3"));
  const r = reported(b0, told.get().workbook, filled);
  told.replaceRemote(r.m, r.report.conflicts);
  eq("…not twice when the merge's report says it", noticeOf(told), "");
  eq("said to the one who wrote into it", sheetText.en.conflict([{ name: "Messung 2", copyName: "", why: "keptMine" }]), "Someone (or you on another device) deleted “Messung 2” while you were working in it. So nothing gets lost, the sheet is still there.");
});

run("COL-1: rows deleted on a stale view that the other side wrote into: both versions kept (both orders)", () => {
  const b0 = mk(lab());
  const del = O.deleteRows(b0, "s1", 11, 3);
  const filled = set(set(set(b0, "A13", "S7"), "B13", 0.61), "A14", "S8");
  const cases = [
    ["the one who deleted them saves second", del, filled, "s1"],
    ["the one who wrote into them saves second", filled, del, "copy"],
  ] as const;
  for (const [who, mine, theirs, where] of cases) {
    const { m, report } = reported(b0, mine, theirs);
    const id = where === "copy" ? report.conflicts[0]?.copyId : "s1";
    eq(`${who}: a copy, reported`, [names(m), report.conflicts.map((c) => c.why)], [["Blatt 1", "Blatt 1 (Konflikt)"], ["deleted"]]);
    eq(`${who}: what was written is there`, [at(m, "A13", id)?.v, at(m, "B13", id)?.v, at(m, "A14", id)?.v], ["S7", 0.61, "S8"]);
    eq(`${who}: and the rows deleted on the other version`, [at(m, "A11", id === "s1" ? report.conflicts[0]?.copyId : "s1")?.v, at(m, "A12", id === "s1" ? report.conflicts[0]?.copyId : "s1")?.v], ["Summe", undefined]);
  }
  // Cells cut and pasted over what the other side just typed there: kept too.
  const cut = CUT(b0, { r0: 1, c0: 0, r1: 2, c1: 1 }, { row: 13, col: 0 });
  const typed = set(b0, "B15", 0.99);
  for (const { m, report } of [reported(b0, cut, typed), reported(b0, typed, cut)]) check("cut pasted over what was just typed: kept", report.conflicts[0]?.why === "deleted" && m.sheets.some((s) => s.cells["14,1"]?.v === 0.99), show(report));
  // A value that was there goes with its deleted row (checked above); inserted rows destroy nothing.
  eq("rows inserted vs rows written below them: no copy", bothOrders(b0, O.insertRows(b0, "s1", 11, 2), filled).map((m) => m.sheets.length), [1, 1]);
  // Only rows (or columns) that were empty for whoever deleted them: one with something in it they
  // deleted on purpose, and what was added to it goes with it, like an edit there.
  const typedOff = set(b0, "D3", "Notiz");
  eq("a note typed into a data row deleted meanwhile: goes with its row, no copy", bothOrders(b0, O.deleteRows(b0, "s1", 2, 1), typedOff).map((m) => [m.sheets.length, column(m, "A", 3, 3), column(m, "D", 1, 12).filter((v) => v !== null)]), [[1, ["P3"], []], [1, ["P3"], []]]);
  const newColumn = O.setCells(b0, "s1", Array.from({ length: 8 }, (_, i) => ({ row: i + 1, col: 2, cell: { v: (i + 1) * 10 } })));
  for (const [i, { m, report }] of [reported(b0, O.deleteRows(b0, "s1", 5, 1), newColumn), reported(b0, newColumn, O.deleteRows(b0, "s1", 5, 1))].entries()) {
    eq(`a new column filled while P5's row is deleted (${i ? "the filler" : "the deleter"} saves second): no copy, each value on its sample's row`, [m.sheets.length, report.conflicts.length, column(m, "A", 2, 8), column(m, "C", 2, 8)], [1, 0, ["P1", "P2", "P3", "P4", "P6", "P7", "P8"], [10, 20, 30, 40, 60, 70, 80]]);
  }
  const emptyCol = set(set(b0, "E2", 1), "E3", 2);
  eq("an empty column deleted while the other side fills it: kept on a copy", bothOrders(b0, O.deleteCols(b0, "s1", 4, 1), emptyCol).map((m) => m.sheets.length), [2, 2]);
  eq("a column with data deleted, a value typed below its data: goes with it", bothOrders(b0, O.deleteCols(b0, "s1", 1, 1), set(b0, "B12", 0.9)).map((m) => [m.sheets.length, column(m, "B", 1, 12).filter((v) => v !== null).length]), [[1, 0], [1, 0]]);
  // The rows as they were right before the deletion: after an insert or a sort before it too.
  const s7 = set(b0, "A12", "S7");
  eq("a row inserted, then the empty row it moved down deleted: kept on a copy", bothOrders(b0, O.deleteRows(O.insertRows(b0, "s1", 0, 1), "s1", 12, 1), s7).map((m) => m.sheets.length), [2, 2]);
  const sortedThenDeleted = O.deleteRows(SORT_DESC(b0), "s1", 11, 1);
  eq("a sort, then an empty row below deleted: kept on a copy", bothOrders(b0, sortedThenDeleted, s7).map((m) => m.sheets.length), [2, 2]);
  // Undo deletes nothing someone wrote since, whatever is next to it: an insert typed into in the
  // same step (a row with something in it), with the partner's value beside it since.
  const stepped = set(O.insertRows(b0, "s1", 2, 1), "A3", "neu");
  const back = takeBack(stepped, b0, set(stepped, "B3", 0.5));
  eq("undo of an insert someone wrote into since, next to what the step wrote: refused", "refused" in back ? back.refused : "taken back", "deleted");
  // …nor does it put a cell back into a row deleted since, quietly losing it: refused.
  const cleared = set(b0, "B5", null);
  const undoClear = takeBack(cleared, b0, O.deleteRows(cleared, "s1", 4, 1));
  eq("undo of a cleared cell whose row was deleted since: refused", "refused" in undoClear ? undoClear.refused : "taken back", "deleted");
  eq("said", sheetText.de.conflict([{ name: "Blatt 1", copyName: "Blatt 1 (Konflikt)", why: "deleted" }]), "In „Blatt 1“ wurden Zeilen oder Spalten gelöscht, in die gleichzeitig etwas eingetragen wurde. Damit nichts verloren geht, steht deine Version jetzt auf „Blatt 1 (Konflikt)“. Kopier, was du aus „Blatt 1 (Konflikt)“ brauchst, nach „Blatt 1“ und lösch dann die Konflikt-Kopie.");
});

run("COL-2: undo and redo keep what someone changed after the step", () => {
  const b0 = mk(lab());
  const take = (from: Workbook, to: Workbook, now: Workbook) => {
    const r = takeBack(from, to, now);
    if (!("wb" in r)) throw new Error(`refused: ${r.refused}`);
    return r;
  };
  const after = set(b0, "B5", 0.315);
  const r1 = take(after, b0, set(after, "B5", 0.318));
  eq("their newer value stays, and is named", [at(r1.wb, "B5")?.v, r1.kept?.cells], [0.318, [{ sheetId: "s1", row: 4, col: 1 }]]);
  eq("their newer formula too", at(take(after, b0, set(after, "B5", "=AVERAGE(0.312,0.318)")).wb, "B5")?.f, "AVERAGE(0.312,0.318)");
  const bold = O.setStyle(after, "s1", [{ r0: 4, c0: 1, r1: 4, c1: 1 }], { bold: true });
  const r2 = take(after, b0, bold);
  eq("only their look: my value goes back, their look stays, nothing to say", [at(r2.wb, "B5"), r2.kept], [{ v: 0.4, s: { bold: true } }, undefined]);
  const r3 = take(after, b0, set(after, "B6", 0.55));
  eq("their edit of another cell: plain undo", [at(r3.wb, "B5")?.v, at(r3.wb, "B6")?.v, r3.kept], [0.4, 0.55, undefined]);
  // Through the store, as in the browser (c10, c10b).
  const store = storeOf(b0);
  store.input({ row: 4, col: 1 }, "0,315");
  store.input({ row: 29, col: 5 }, "x");
  store.replaceRemote(set(store.get().workbook, "B5", 0.318));
  store.undo();
  store.undo();
  eq("undo: their 0,318 stays, and the notice says so", [at(store.get().workbook, "B5")?.v, at(store.get().workbook, "F30"), noticeOf(store)], [0.318, undefined, "Rückgängig gemacht, bis auf B5: Das hat inzwischen jemand anderes (oder du auf einem anderen Gerät) geändert, darum bleibt es so."]);
  const redo = storeOf(b0);
  redo.input({ row: 4, col: 1 }, "0,315");
  redo.undo();
  redo.replaceRemote(set(redo.get().workbook, "B5", 0.318));
  redo.redo();
  eq("redo: the same", [at(redo.get().workbook, "B5")?.v, noticeOf(redo)], [0.318, "Wiederholt, bis auf B5: Das hat inzwischen jemand anderes (oder du auf einem anderen Gerät) geändert, darum bleibt es so."]);
  // A step on two sheets (the undo shows the first): the other sheet's cell is named with it.
  const en = storeOf(mk(lab("Sheet 1"), mkSheet({}, "s2", "Sheet 2")), "en");
  en.apply("Paste", (wb) => set(set(wb, "B5", 0.315), "A1", "x", "s2"));
  en.replaceRemote(set(set(en.get().workbook, "A1", "y", "s2"), "B5", 0.318));
  en.undo();
  eq("in English, a cell on another sheet named with it", noticeOf(en), "Undone, except B5 and 'Sheet 2'!A1: someone else (or you on another device) changed that in the meantime, so it stays as it is.");
  // A new sheet they wrote into stays (c: undo_addsheet); an empty one goes.
  const s = storeOf(mk(lab()));
  let added = "";
  s.apply("Blatt", (wb) => {
    const a = O.addSheet(wb, "de");
    added = a.sheetId;
    return a.wb;
  });
  s.replaceRemote(set(set(s.get().workbook, "A1", "Messung", added), "A2", 0.512, added));
  s.undo();
  eq("undo of a new sheet they wrote into: it stays, said", [names(s.get().workbook), at(s.get().workbook, "A2", added)?.v, noticeOf(s)], [["Blatt 1", "Blatt 2"], 0.512, "Rückgängig gemacht, bis auf das Blatt „Blatt 2“: Das hat inzwischen jemand anderes (oder du auf einem anderen Gerät) geändert, darum bleibt es so."]);
  const e = storeOf(mk(lab()));
  e.apply("Blatt", (wb) => O.addSheet(wb, "de").wb);
  e.replaceRemote(set(e.get().workbook, "D1", "x"));
  e.undo();
  eq("an empty new sheet goes, without a word", [names(e.get().workbook), noticeOf(e)], [["Blatt 1"], ""]);
  // A chart I added that they changed since stays.
  const c = storeOf(mk(lab()));
  c.apply("Diagramm", (wb) => O.putChart(wb, chartOver("c1", "s1", "s1", 1, 8)));
  c.replaceRemote(O.putChart(c.get().workbook, { ...c.get().workbook.charts[0], title: "Nitrat" }));
  c.undo();
  eq("a chart they changed since stays, said", [c.get().workbook.charts.map((x) => x.title), noticeOf(c).startsWith("Rückgängig gemacht, bis auf das, was inzwischen")], [["Nitrat"], true]);
  // Taking back rows I inserted that they wrote into would delete it: refused, nothing lost.
  const ins = storeOf(mk(lab()));
  ins.select({ row: 2, col: 0 });
  insertAtSelection(ins, "rows");
  ins.replaceRemote(set(ins.get().workbook, "B3", 0.15));
  ins.undo();
  eq("undo of an insert they wrote into: refused, nothing lost", [at(ins.get().workbook, "B3")?.v, noticeOf(ins)], [0.15, "Das lässt sich nicht mehr rückgängig machen: Inzwischen hat jemand (oder du auf einem anderen Gerät) in „Blatt 1“ etwas eingetragen oder Zeilen oder Spalten gelöscht, und dabei ginge etwas verloren."]);
  // A sheet's name, or the order of the tabs, someone changed again since: theirs stays, and that is said.
  const two = mk(lab(), mkSheet({}, "s2", "Blatt 2"));
  const renamedBack = takeBack(O.renameSheet(two, "s2", "Messung"), two, O.renameSheet(two, "s2", "Messung B"));
  eq("undo of a rename they renamed again: their name stays, noted", "wb" in renamedBack ? [names(renamedBack.wb), renamedBack.kept?.other] : renamedBack, [["Blatt 1", "Messung B"], true]);
  const tabs = storeOf(mk(lab(), mkSheet({}, "s2", "Blatt 2"), mkSheet({}, "s3", "Blatt 3")));
  tabs.apply("Verschieben", (wb) => O.moveSheet(wb, "s3", 0));
  tabs.replaceRemote(O.moveSheet(tabs.get().workbook, "s2", 0));
  tabs.undo();
  eq("undo of a tab move they reordered again: their order stays, said", [names(tabs.get().workbook), noticeOf(tabs).startsWith("Rückgängig gemacht, bis auf das, was inzwischen")], [["Blatt 2", "Blatt 3", "Blatt 1"], true]);
  const alone = storeOf(mk(lab(), mkSheet({}, "s2", "Blatt 2"), mkSheet({}, "s3", "Blatt 3")));
  alone.apply("Verschieben", (wb) => O.moveSheet(wb, "s3", 0));
  alone.replaceRemote(set(alone.get().workbook, "A1", "x", "s2"));
  alone.undo();
  eq("…a tab move nobody else reordered: undone, nothing said", [names(alone.get().workbook), noticeOf(alone)], [["Blatt 1", "Blatt 2", "Blatt 3"], ""]);
});

run("COL-3: what I wrote elsewhere for my version of a sheet kept as theirs reads my copy (both orders)", () => {
  const b0 = mk(lab(), mkSheet({ A1: "Summe", B1: "=SUM('Blatt 1'!B2:B9)" }, "s2", "Auswertung"));
  // B deletes P2's row and then writes formulas meaning P4 (row 4 for B); A inserts a row above P2.
  let b = O.deleteRows(b0, "s1", 2, 1);
  b = O.putChart(set(set(b, "B5", "='Blatt 1'!B4*2", "s2"), "B6", "='Blatt 1'!A4", "s2"), chartOver("cb", "s2", "s1", 1, 7));
  const a = O.putChart(O.insertRows(b0, "s1", 2, 1), chartOver("ca", "s2", "s1", 1, 9));
  const { m, report } = reported(b0, b, a);
  const copy = report.conflicts[0]?.copyId;
  eq("B saves second: B's formulas read B's version on the copy", [at(m, "B5", "s2")?.f, column(m, "B", 5, 6, "s2")], ["'Blatt 1 (Konflikt)'!B4*2", [0.8, "P4"]]);
  eq("…B's chart too, A's chart stays on A's sheet", [m.charts.find((x) => x.id === "cb")?.series[0].y.sheetId, m.charts.find((x) => x.id === "ca")?.series[0].y.sheetId], [copy, "s1"]);
  eq("…the sum that was there fits the sheet that stays", at(m, "B1", "s2")?.f, "SUM('Blatt 1'!B2:B10)");
  const other = mergeWorkbooks(b0, a, b);
  eq("A saves second: B's version is the sheet, B's formulas read it", [at(other, "B5", "s2")?.f, column(other, "B", 5, 6, "s2"), other.charts.find((x) => x.id === "cb")?.series[0].y.sheetId], ["'Blatt 1'!B4*2", [0.8, "P4"], "s1"]);
  // A formula on the copy naming its own sheet reads the copy (a duplicated sheet too, as in Excel).
  const self = mk(mkSheet({ A1: 1, A2: "='Blatt 1'!A1*2", A3: "=A1" }));
  const dup = O.duplicateSheet(self, "s1");
  eq("duplicated: its formulas naming itself name the copy", [at(dup.wb, "A2", dup.sheetId)?.f, at(dup.wb, "A3", dup.sheetId)?.f, at(dup.wb, "A2")?.f], ["'Blatt 1 (2)'!A1*2", "A1", "'Blatt 1'!A1*2"]);
  const sb = set(O.deleteRows(self, "s1", 3, 1), "A1", 5);
  const sm = reported(self, sb, O.insertRows(self, "s1", 0, 1));
  eq("the conflict copy too", column(sm.m, "A", 2, 2, sm.report.conflicts[0]?.copyId), [10]);
  // No room for a copy: the report names my formulas that were written for my version.
  const full = mk(lab(), mkSheet({}, "s2", "Auswertung"), ...Array.from({ length: 248 }, (_, i) => mkSheet({}, `x${i}`, `Blatt ${i + 3}`)));
  const nb = set(O.deleteRows(full, "s1", 2, 1), "B5", "='Blatt 1'!B4*2", "s2");
  const nr = reported(full, nb, O.insertRows(full, "s1", 2, 1));
  eq("no room: the formulas named", nr.report.conflicts.map((x) => [x.copyName, x.formulas]), [["", ["Auswertung!B5"]]]);
  check("…and said", sheetText.de.conflict(nr.report.conflicts).endsWith("Prüf diese Formeln, du hast sie für deine Version geschrieben: Auswertung!B5."), show(sheetText.de.conflict(nr.report.conflicts)));
  // I renamed the sheet too: the copy with my version keeps my name for it (theirs keeps theirs), and my formulas follow.
  const renamer = set(O.renameSheet(O.deleteRows(b0, "s1", 2, 1), "s1", "Messwerte"), "B5", "=Messwerte!B4*2", "s2");
  const rn = reported(b0, renamer, a);
  eq("my rename stays on the copy's name, my formula reads it", [names(rn.m), at(rn.m, "B5", "s2")?.f, column(rn.m, "B", 5, 5, "s2")], [["Blatt 1", "Messwerte (Konflikt)", "Auswertung"], "'Messwerte (Konflikt)'!B4*2", [0.8]]);
});

run("COL-4: a sort of every row a sheet holds is replayed like a small one (both orders)", () => {
  const n = MAX_ROWS - 1;
  const cells: Record<string, Cell> = { "0,0": { v: "Probe" }, "0,1": { v: "Wert" } };
  for (let i = 1; i <= n; i++) Object.assign(cells, { [cellKey(i, 0)]: { v: `P${i}` }, [cellKey(i, 1)]: { v: ((i * 7919) % 20011) / 10 } });
  const b0 = mk({ ...mkSheet({}), cells, size: { rows: MAX_ROWS, cols: 26 } });
  const sorted = O.sortArea(b0, calc0(b0), "s1", { r0: 1, c0: 0, r1: n, c1: 1 }, [{ col: 1, dir: "desc" }], "de");
  eq("logged as a sort, not a barrier", kinds(sorted), ["sort"]);
  const fix = O.setCells(b0, "s1", [{ row: 15000, col: 1, cell: { v: -15.5 } }]);
  for (const [i, { m, report }] of [reported(b0, sorted, fix), reported(b0, fix, sorted)].entries()) {
    const r = rowOf(m, "P15000");
    eq(`no copy, the correction on P15000's row (${i ? "the sorter" : "the corrector"} saves second)`, [m.sheets.length, report.conflicts.length, O.getCell(m, "s1", r, 1)?.v], [1, 0, -15.5]);
  }
  eq("said when it is too big with both versions", sheetText.de.conflict([{ name: "Platte", copyName: "Platte (Konflikt)", why: "moved", tooBig: true }]).endsWith("Bis dahin ist die Tabelle mit beiden Versionen zu groß zum Speichern (mehr als 5 MB): Deine Änderungen bleiben so lange auf diesem Gerät."), true);
  // The way out: my version of that sheet as a spreadsheet of its own (collab.ts ownVersion), so
  // the copy can go and the spreadsheet is saved again with everything else.
  const lab2 = mk(lab(), mkSheet({ A1: "Summe", B1: "=SUM('Blatt 1'!B2:B9)" }, "s2", "Auswertung"));
  let mine = set(set(set(O.deleteRows(lab2, "s1", 2, 1), "B4", 0.45), "C2", "='Blatt 1'!B2*2"), "C3", "=Auswertung!B1");
  mine = O.putChart(mine, chartOver("cm", "s1", "s1", 1, 7));
  const conflict = reported(lab2, mine, O.insertRows(lab2, "s1", 2, 1));
  const copyId = conflict.report.conflicts[0]?.copyId ?? "";
  const own = ownVersion(conflict.m, copyId, "de");
  eq("my version alone, under the original's name, unmarked", own && [names(own), own.sheets[0].copyOf, column(own, "A", 2, 4, own.sheets[0].id), column(own, "B", 4, 4, own.sheets[0].id)], [["Blatt 1"], undefined, ["P1", "P3", "P4"], [0.45]]);
  eq("…its formulas naming it read it, its chart is on it", own && [at(own, "C2", own.sheets[0].id)?.f, column(own, "C", 2, 2, own.sheets[0].id), own.charts.map((x) => x.series[0].y.sheetId)], ["'Blatt 1'!B2*2", [0.2], [own?.sheets[0].id]]);
  eq("…one naming another sheet stays as written (that sheet isn't in it)", own && at(own, "C3", own.sheets[0].id)?.f, "Auswertung!B1");
  eq("not for a sheet that isn't such a copy, nor once its original is gone", [ownVersion(conflict.m, "s2", "de"), ownVersion(O.deleteSheet(conflict.m, "s1"), copyId, "de")], [null, null]);
});

run("COL2-1: what ties a conflict copy to the other sheets (copyTies): my version as a spreadsheet of its own breaks nothing", () => {
  // B deletes P4's row, then writes its own analysis on Auswertung: P8 times a factor beside it, a
  // mean, a chart over the rows; A inserts a row. Whoever saves second has their version on the copy.
  const b0 = mk(lab(), mkSheet({ A1: "Faktor", B1: 2 }, "s2", "Auswertung"));
  let mineB = set(set(O.deleteRows(b0, "s1", 4, 1), "B3", "='Blatt 1'!B8*$B$1", "s2"), "B4", "=AVERAGE('Blatt 1'!B2:B8)", "s2");
  mineB = O.putChart(mineB, chartOver("ch", "s2", "s1", 1, 7));
  const theirsA = O.insertRows(b0, "s1", 2, 1);
  const where = (wb: Workbook, ps: { sheetId: string; row: number; col: number }[]) => ps.map((p) => `${O.sheetById(wb, p.sheetId)?.name}!${posName(p)}`);
  const second = reported(b0, mineB, theirsA);
  const copyId = second.report.conflicts[0]?.copyId ?? "";
  const ties = copyTies(second.m, copyId);
  eq("B saves second: B's formulas and chart read B's copy", [where(second.m, ties.cells), ties.charts, ties.readsOthers, tiedCopy(ties)], [["Auswertung!B3", "Auswertung!B4"], ["ch"], false, true]);
  eq("…with the values B had (the factor beside it too)", column(second.m, "B", 3, 4, "s2"), column(mineB, "B", 3, 4, "s2"));
  const first = reported(b0, theirsA, mineB);
  eq("A saves second: A's copy, which nothing of A's elsewhere reads", tiedCopy(copyTies(first.m, first.report.conflicts[0]?.copyId ?? "")), false);
  // Pointed at the original (or deleted), nothing ties it: kept as my own, the copy goes, and
  // nothing elsewhere breaks.
  const moved = set(set({ ...second.m, charts: second.m.charts.filter((c) => c.id !== "ch") }, "B3", "='Blatt 1'!B10*$B$1", "s2"), "B4", null, "s2");
  eq("pointed at the original: untied", tiedCopy(copyTies(moved, copyId)), false);
  const after = O.deleteSheet(moved, copyId);
  eq("…the copy deleted, B3 still reads (no #REF!)", [at(after, "B3", "s2")?.f, column(after, "B", 3, 3, "s2")], ["'Blatt 1'!B10*$B$1", [1.6]]);
  // Every range of a chart elsewhere counts: its x, a series' x, name and error bar cells.
  const range = { sheetId: copyId, r0: 1, c0: 0, r1: 3, c1: 0 };
  const plain = chartOver("c2", "s2", "s2", 0, 0);
  const s0 = plain.series[0];
  const variants = [
    { ...plain, x: range },
    { ...plain, series: [{ ...s0, x: range }] },
    { ...plain, series: [{ ...s0, nameRef: { ...range, r1: 1 } }] },
    { ...plain, series: [{ ...s0, errorBars: { kind: "custom" as const, value: 1, plus: null, minus: range, direction: "both" as const } }] },
  ];
  eq("a chart's x, a series' x, name or error bar cells on the copy tie it", variants.map((c) => copyTies(O.putChart(moved, c), copyId).charts), [["c2"], ["c2"], ["c2"], ["c2"]]);
  // The copy reading another sheet ties it too: kept on its own, that would read nothing, and a
  // formula naming its original would read my own rows there (its name is the original's).
  const reads = (f: string) => copyTies(set(moved, "E2", f, copyId), copyId).readsOthers;
  eq("the copy reads another sheet, its original too; naming itself doesn't count", [reads("=B2*Auswertung!$B$1"), reads("=B2-'Blatt 1'!B2"), reads(`='${O.sheetById(moved, copyId)?.name}'!B2*2`), reads("=B2*2")], [true, true, false, false]);
  eq("a chart on the copy over another sheet ties it", copyTies(O.putChart(moved, chartOver("c3", copyId, "s2", 0, 0)), copyId).readsOthers, true);
  eq("a sheet's name in text is no reference", tiedCopy(copyTies(set(moved, "A9", '="siehe Blatt 1 (Konflikt)"', "s2"), copyId)), false);
  eq("not a sheet of the workbook: nothing", copyTies(moved, "nope"), { cells: [], charts: [], readsOthers: false });
});

run("COL-6: working alone, undo goes as far back as the history (no capped log stops it)", () => {
  const start = mk(lab());
  const store = storeOf(start);
  for (let i = 0; i < 60; i++) store.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 1, 1));
  let refused = "";
  while (store.get().canUndo && !refused) {
    store.undo();
    refused = noticeOf(store);
  }
  eq("60 inserts all undone, back to the start", [refused, store.get().workbook.sheets[0].cells], ["", start.sheets[0].cells]);
  // Big sorts: their undos count against the log's sort rows too.
  const cells: Record<string, Cell> = {};
  for (let i = 1; i <= 2000; i++) Object.assign(cells, { [cellKey(i, 0)]: { v: `P${i}` }, [cellKey(i, 1)]: { v: (i * 7919) % 1009 }, [cellKey(i, 2)]: { v: (i * 104729) % 997 } });
  const big = mk({ ...mkSheet({}), cells, size: { rows: 2010, cols: 26 } });
  const sorts = storeOf(big);
  for (let i = 0; i < 8; i++) sorts.apply("Sortieren", (wb, calc) => O.sortArea(wb, calc, "s1", { r0: 1, c0: 0, r1: 2000, c1: 2 }, [{ col: [1, 2, 0][i % 3], dir: i % 2 ? "asc" : "desc" }], "de"));
  let said = "";
  while (sorts.get().canUndo && !said) {
    sorts.undo();
    said = noticeOf(sorts);
  }
  eq("8 sorts of 2,000 rows all undone", [said, sorts.get().workbook.sheets[0].cells], ["", big.sheets[0].cells]);
  // Undo and redo again and again, then everything back.
  const toggle = storeOf(start);
  toggle.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 5, 1));
  toggle.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 1, 1));
  for (let i = 0; i < 30; i++) {
    toggle.undo();
    toggle.redo();
  }
  toggle.undo();
  toggle.undo();
  eq("30 times undo and redo, then both undone", [noticeOf(toggle), toggle.get().workbook.sheets[0].cells], ["", start.sheets[0].cells]);
  // A cell step undone doesn't shorten the log (it only grows).
  const typed = storeOf(start);
  typed.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 1, 1));
  typed.input({ row: 0, col: 5 }, "x");
  const before = typed.get().workbook.sheets[0].log!.length;
  typed.undo();
  typed.undo();
  typed.redo();
  typed.redo();
  typed.undo();
  check("the log only grows", typed.get().workbook.sheets[0].log!.length >= before + 2, show(typed.get().workbook.sheets[0].log?.length));
  // With someone else in between, undo goes on past the old 25-step limit too.
  const shared = storeOf(mk(lab(), mkSheet({}, "s2", "Blatt 2")));
  for (let i = 0; i < 40; i++) shared.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 1, 1));
  shared.replaceRemote(set(shared.get().workbook, "A1", "fremd", "s2"));
  let refused2 = "";
  while (shared.get().canUndo && !refused2) {
    shared.undo();
    refused2 = noticeOf(shared);
  }
  eq("40 inserts undone with a partner's edit in between", [refused2, column(shared.get().workbook, "A", 1, 3), at(shared.get().workbook, "A1", "s2")?.v], ["", ["Probe", "P1", "P2"], "fremd"]);
});

run("COL-7: a formula typed with a sheet's old name follows the rename (both orders)", () => {
  const b0 = mk(lab(), mkSheet({ A1: "Summe", B1: "=SUM('Blatt 1'!B2:B9)" }, "s2", "Auswertung"));
  const typed = set(b0, "B4", "=AVERAGE('Blatt 1'!B2:B9)", "s2");
  const renamed = O.renameSheet(b0, "s1", "Messwerte");
  for (const m of bothOrders(b0, typed, renamed)) {
    eq("the new formula names the new name", [names(m), at(m, "B4", "s2")?.f, column(m, "B", 4, 4, "s2")], [["Messwerte", "Auswertung"], "AVERAGE(Messwerte!B2:B9)", [0.45]]);
    eq("the old one too", at(m, "B1", "s2")?.f, "SUM(Messwerte!B2:B9)");
  }
  // Both renamed it: mine wins, their formulas follow mine.
  const theirs = set(O.renameSheet(b0, "s1", "Werte"), "B5", "=Werte!B2", "s2");
  const m2 = mergeWorkbooks(b0, O.renameSheet(b0, "s1", "Messwerte"), theirs);
  eq("both renamed it: their new formula follows my name", [names(m2), at(m2, "B5", "s2")?.f, column(m2, "B", 5, 5, "s2")], [["Messwerte", "Auswertung"], "Messwerte!B2", [0.1]]);
  // Two sheets that swap names: every formula still reads the sheet it meant.
  const two = mk(lab(), mkSheet({ A1: 7 }, "s2", "Blatt 2"), mkSheet({}, "s3", "Auswertung"));
  const swapped = O.renameSheet(O.renameSheet(O.renameSheet(two, "s1", "tmp"), "s2", "Blatt 1"), "s1", "Blatt 2");
  const reads = set(set(two, "A1", "='Blatt 1'!B2", "s3"), "A2", "='Blatt 2'!A1", "s3");
  for (const m of bothOrders(two, swapped, reads)) eq("swapped names: each formula reads what it meant", [names(m), column(m, "A", 1, 2, "s3")], [["Blatt 2", "Blatt 1", "Auswertung"], [0.1, 7]]);
  // Both add a sheet with the same name: the second gets a number, and my formulas follow mine.
  const mine = O.addSheet(b0, "de", "Rohdaten");
  const their = O.addSheet(b0, "de", "Rohdaten");
  const myRef = set(set(mine.wb, "A1", 1, mine.sheetId), "C1", "=Rohdaten!A1", "s2");
  const theirRef = set(set(their.wb, "A1", 2, their.sheetId), "D1", "=Rohdaten!A1", "s2");
  for (const [i, m] of bothOrders(b0, myRef, theirRef).entries()) {
    eq(`same name added on both sides (${i ? "they" : "I"} save second): each formula reads its own`, [names(m).filter((n) => n.startsWith("Rohdaten")).length, column(m, "C", 1, 1, "s2"), column(m, "D", 1, 1, "s2")], [2, [1], [2]]);
  }
  // A sheet deleted on one side whose name another sheet took there: what named the deleted one
  // doesn't read the other one (#REF!, as when it is deleted), and what named the other one follows it.
  const three = mk(lab(), mkSheet({}, "s2", "Auswertung"), mkSheet({ B2: 99 }, "s3", "Daten"));
  const takenOver = O.renameSheet(O.deleteSheet(three, "s1"), "s3", "Blatt 1");
  const refs = set(set(three, "A1", "='Blatt 1'!B2", "s2"), "A2", "=Daten!B2", "s2");
  for (const m of bothOrders(three, refs, takenOver)) eq("a name taken over: no formula reads the wrong sheet", [names(m), at(m, "A1", "s2")?.f, at(m, "A2", "s2")?.f, column(m, "A", 2, 2, "s2")], [["Auswertung", "Blatt 1"], "#REF!", "'Blatt 1'!B2", [99]]);
});

run("COL-8: undo right after a conflict copy says where my version is, and changes nothing", () => {
  const b0 = mk(lab());
  const b = storeOf(b0);
  b.input({ row: 4, col: 1 }, "0,315");
  b.select({ row: 2, col: 0 });
  deleteAtSelection(b, "rows");
  const a = O.setCells(O.insertRows(b0, "s1", 2, 1), "s1", [{ row: 5, col: 1, cell: { v: 0.316 } }]);
  const { m, report } = reported(b0, b.get().workbook, a);
  b.replaceRemote(m, report.conflicts);
  const merged = b.get().workbook;
  b.undo();
  eq("refused, naming the copy", noticeOf(b), "Das lässt sich nicht mehr rückgängig machen: Deine Version von „Blatt 1“ steht jetzt auf „Blatt 1 (Konflikt)“ – ändere sie dort.");
  eq("the step before it on that sheet went with it: their 0,316 stays, nothing changed", [b.get().workbook === merged, at(merged, "B6")?.v, b.get().canUndo], [true, 0.316, false]);
  // Steps on that sheet in a row, an older one elsewhere (e3 G1): one refusal for all of them, and
  // the next undo takes back the one elsewhere. One between them on another sheet stops it.
  const g0 = mk(lab(), mkSheet({}, "s2", "Auswertung"));
  const g = storeOf(g0);
  g.apply("Auswertung", (wb) => set(wb, "A1", "auf Auswertung", "s2"));
  for (let i = 0; i < 5; i++) g.input({ row: 20 + i, col: 0 }, `x${i}`);
  g.apply("Auswertung", (wb) => set(wb, "A2", "dazwischen", "s2"));
  g.select({ row: 2, col: 0 });
  deleteAtSelection(g, "rows");
  g.input({ row: 25, col: 0 }, "y");
  const gm = reported(g0, g.get().workbook, O.insertRows(g0, "s1", 2, 1));
  g.replaceRemote(gm.m, gm.report.conflicts);
  const presses: string[] = [];
  for (let k = 0; k < 5 && g.get().canUndo; k++) {
    g.undo();
    presses.push(noticeOf(g).startsWith("Das lässt sich nicht mehr") ? "refused" : `${at(g.get().workbook, "A1", "s2")?.v ?? "-"}/${at(g.get().workbook, "A2", "s2")?.v ?? "-"}`);
  }
  eq("one refusal for the steps on that sheet in a row, then the step elsewhere", presses, ["refused", "auf Auswertung/-", "refused", "-/-"]);
  // Redo the same way: two values typed after my row deletion, undone, then the conflict.
  const rd = storeOf(b0);
  rd.select({ row: 2, col: 0 });
  deleteAtSelection(rd, "rows");
  rd.input({ row: 4, col: 1 }, "0,315");
  rd.input({ row: 5, col: 1 }, "0,415");
  rd.undo();
  rd.undo();
  const rm = reported(b0, rd.get().workbook, O.insertRows(b0, "s1", 2, 1));
  rd.replaceRemote(rm.m, rm.report.conflicts);
  rd.redo();
  eq("redo: one refusal for both, naming the copy", [noticeOf(rd), rd.get().canRedo], ["Das lässt sich nicht mehr wiederholen: Deine Version von „Blatt 1“ steht jetzt auf „Blatt 1 (Konflikt)“ – ändere sie dort.", false]);
  // A step made after the conflict is undone as usual.
  b.input({ row: 0, col: 3 }, "neu");
  b.undo();
  eq("a later step: undone", [at(b.get().workbook, "D1"), noticeOf(b)], [undefined, ""]);
  // No edit running when the conflict arrives (between two values typed): the screen goes on in my
  // version too, so the next value lands on my rows, not over theirs.
  const between = storeOf(b0);
  between.select({ row: 2, col: 0 });
  insertAtSelection(between, "rows");
  const r1 = reported(b0, between.get().workbook, O.deleteRows(b0, "s1", 1, 1));
  between.select({ row: 2, col: 0 });
  between.replaceRemote(r1.m, r1.report.conflicts);
  const copyId = r1.report.conflicts[0]?.copyId;
  eq("the screen on my copy, the selection kept", [between.get().sheetId, between.get().selection.anchor], [copyId, { row: 2, col: 0 }]);
  between.input(between.get().selection.anchor, "S1b");
  eq("typed into my version, their sheet untouched", [at(between.get().workbook, "A3", copyId)?.v, column(between.get().workbook, "A", 1, 4)], ["S1b", ["Probe", "P2", "P3", "P4"]]);
  noticeOf(between);
  // The copy deleted meanwhile: said too.
  const c = storeOf(b0);
  c.select({ row: 2, col: 0 });
  deleteAtSelection(c, "rows");
  const r2 = reported(b0, c.get().workbook, O.insertRows(b0, "s1", 2, 1));
  c.replaceRemote(r2.m, r2.report.conflicts);
  c.replaceRemote(O.deleteSheet(c.get().workbook, r2.report.conflicts[0].copyId));
  c.undo();
  eq("its copy deleted since", noticeOf(c), "Das lässt sich nicht mehr rückgängig machen: Von „Blatt 1“ gibt es nur noch die andere Version.");
});

run("COL-9: the copy is marked, kept as such, and the other person is told; the notice fits the reason", () => {
  const b0 = mk(lab());
  const { m, report } = reported(b0, O.insertRows(b0, "s1", 3, 1), O.deleteRows(b0, "s1", 5, 1));
  const copyId = report.conflicts[0].copyId;
  eq("marked", O.sheetById(m, copyId)?.copyOf, "s1");
  eq("kept when read again", normalizeWorkbook(JSON.parse(JSON.stringify(m)), "de").sheets.find((s) => s.id === copyId)?.copyOf, "s1");
  const raw = JSON.parse(JSON.stringify(m));
  raw.sheets[1].copyOf = "<bad>";
  eq("a bad mark dropped", normalizeWorkbook(raw, "de").sheets[1].copyOf, undefined);
  const renamedCopy = O.renameSheet(m, copyId, "Meine Messung");
  eq("kept through a merge and a rename", O.sheetById(mergeWorkbooks(m, renamedCopy, set(m, "A1", "x", copyId)), copyId)?.copyOf, "s1");
  eq("a duplicate isn't one", O.sheetById(O.duplicateSheet(m, copyId).wb, O.duplicateSheet(m, copyId).sheetId)?.copyOf, undefined);
  // The first saver: it arrives with the other's save.
  eq("arrived, for the one who saved first", arrivedCopies(b0, O.insertRows(b0, "s1", 3, 1), m), [{ sheetId: "s1", name: "Blatt 1", copyId, copyName: "Blatt 1 (Konflikt)", why: "arrived" }]);
  eq("not again once seen", arrivedCopies(m, m, set(m, "A1", "x")), []);
  // The copy holds the other person's only version: the one who saved first is told to leave it until that is moved over.
  eq("said to the one who saved first", sheetText.de.conflict(arrivedCopies(b0, b0, m)), "Jemand (oder du auf einem anderen Gerät) hat gleichzeitig mit dir an „Blatt 1“ gearbeitet, und die beiden Versionen ließen sich nicht zusammenführen. Damit nichts verloren geht, steht die andere Version jetzt auf „Blatt 1 (Konflikt)“. Lösch diese Kopie erst, wenn alles, was davon nach „Blatt 1“ gehört, dort steht.");
  eq("…in English", sheetText.en.conflict(arrivedCopies(b0, b0, m)).split(". ").at(-1), "Only delete that copy once everything from it that belongs in “Blatt 1” is there.");
  // Only a value typed against a big sort or 60 inserts: no copy any more (c7, v9_barrier); a log that can't be told says so.
  const many = storeOf(b0);
  for (let i = 0; i < 60; i++) many.apply("Zeile einfügen", (wb) => O.insertRows(wb, "s1", 1, 1));
  eq("60 inserts vs one value: merged, no copy", mergeWorkbooks(b0, set(b0, "B6", 15.5), many.get().workbook).sheets.length, 1);
  const logged = O.insertRows(b0, "s1", 12, 1);
  const unknown = reported(logged, set(logged, "B6", 15.5), stripLogs(O.insertRows(logged, "s1", 1, 1)));
  eq("what can't be told: reported as such", unknown.report.conflicts.map((c) => c.why), ["unknown"]);
  eq("…and said so", sheetText.de.conflict(unknown.report.conflicts).split(".")[0], "Deine Änderungen an „Blatt 1“ ließen sich nicht mit denen von jemand anderem (oder von dir auf einem anderen Gerät) zusammenführen");
  const de = sheetText.de.conflict(report.conflicts);
  check("never advises deleting the original, only the copy", !de.includes("an zwei Stellen") && de.endsWith("und lösch dann die Konflikt-Kopie.") && sheetText.en.conflict(report.conflicts).endsWith("then delete the conflict copy."), de);
});

run("COL-11: a cut a partner's change cancelled pastes nothing, and says so again", () => {
  const b0 = mk(lab());
  const store = storeOf(b0);
  store.select({ r0: 4, c0: 0, r1: 4, c1: 1 });
  const copied = copySelection(store, true);
  store.replaceRemote(O.insertRows(b0, "s1", 2, 1));
  const cancelled = noticeOf(store);
  check("the cut is cancelled, with a notice", store.get().clip === null && cancelled.startsWith("Ausschneiden abgebrochen"), cancelled);
  const before = store.get().workbook;
  store.select({ row: 13, col: 0 });
  check("Ctrl+V: handled", pasteData(store, { text: copied.text, html: copied.html }, "all"));
  eq("…nothing pasted, the notice again", [store.get().workbook === before, noticeOf(store)], [true, cancelled]);
  check("the menu's paste (no clipboard text) neither", pasteData(store, null, "all") && store.get().workbook === before);
  hideSheetNotice(store);
  // Cut again: pasting moves the cells, as usual.
  store.select({ r0: 5, c0: 0, r1: 5, c1: 1 });
  const again = copySelection(store, true);
  store.select({ row: 13, col: 0 });
  pasteData(store, { text: again.text, html: again.html }, "all");
  eq("cut again: moved", [column(store.get().workbook, "A", 14, 14), column(store.get().workbook, "A", 6, 6)], [["P4"], [null]]);
  // A copy (not a cut) followed the partner's rows and still pastes.
  const copyStore = storeOf(b0);
  copyStore.select({ r0: 4, c0: 0, r1: 4, c1: 1 });
  const c2 = copySelection(copyStore, false);
  copyStore.replaceRemote(O.insertRows(b0, "s1", 2, 1));
  copyStore.select({ row: 13, col: 0 });
  pasteData(copyStore, { text: c2.text, html: c2.html }, "all");
  eq("a copy still pastes", column(copyStore.get().workbook, "A", 14, 14), ["P4"]);
});

// ==============================================================================================
// The saver (saver.ts absorb): the one who saved first hears about the copy; a copy that makes
// the spreadsheet too big to save says so, and keeps both versions on the device.

/** localStorage and Web Locks for Node, as the saver's drafts use them (drafts.ts). */
const memory = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
};
Object.defineProperty(globalThis.navigator, "locks", {
  configurable: true,
  value: {
    request: async (_name: string, a: unknown, b?: unknown) => ((typeof a === "function" ? a : b) as (lock: unknown) => unknown)({}),
    query: async () => ({ held: [], pending: [] }),
  },
});

/** One page on the "server", saved as save_sheet does (a save that is behind gets the newer content back). */
class Server implements SaverApi {
  rev = 0;
  content: unknown;
  constructor(wb: Workbook) {
    this.content = JSON.parse(JSON.stringify(wb));
  }
  async saveSheet(a: SaveArgs) {
    const json = JSON.stringify(a.p_content);
    if (json.length > MAX_BYTES) return { data: { ok: false, reason: "too_big" }, error: null };
    if (a.p_rev !== this.rev) return { data: { ok: false, reason: "behind", rev: this.rev, content: JSON.parse(JSON.stringify(this.content)), title: "" }, error: null };
    this.content = JSON.parse(json);
    this.rev++;
    return { data: { ok: true, rev: this.rev, title: "" }, error: null };
  }
  async loadRow() {
    return { rev: this.rev, content: JSON.parse(JSON.stringify(this.content)), title: "" };
  }
  async landed() {
    return false;
  }
}

function editorOn(server: Server, pageId: string) {
  const wb = normalizeWorkbook(JSON.parse(JSON.stringify(server.content)), "de");
  const store = storeOf(wb);
  const told: SheetConflict[][] = [];
  const states: string[] = [];
  const noop = () => {};
  const saver = new SheetSaver({ store, pageId, userId: "u1", locale: "de", rev: server.rev, base: wb, title: "", readOnly: false, api: server, on: { state: (s) => states.push(s), notice: noop, title: noop, saved: noop, restored: noop, trouble: noop, conflict: (c) => told.push(c) } });
  return { store, saver, told, states };
}

async function saverChecks() {
  section("COL-9: the one who saved first is told about the copy (saver)");
  {
    const server = new Server(mk(lab()));
    const a = editorOn(server, "p-a");
    const b = editorOn(server, "p-b");
    a.store.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 3, 1));
    await a.saver.flush();
    b.store.apply("Zeilen löschen", (wb) => O.deleteRows(wb, "s1", 5, 1));
    await b.saver.flush();
    eq("the second saver: their sheet and my copy, said", [names(b.store.get().workbook), b.told.flat().map((c) => c.why)], [["Blatt 1", "Blatt 1 (Konflikt)"], ["moved"]]);
    await a.saver.remote(server.rev);
    eq("the first saver gets the copy, with a notice", [names(a.store.get().workbook), a.told.flat().map((c) => [c.why, c.name, c.copyName])], [["Blatt 1", "Blatt 1 (Konflikt)"], [["arrived", "Blatt 1", "Blatt 1 (Konflikt)"]]]);
    a.store.input({ row: 0, col: 4 }, "x");
    await a.saver.flush();
    await a.saver.remote(server.rev + 1);
    eq("told once", a.told.length, 1);
    await a.saver.close();
    await b.saver.close();
  }
  section("COL-1: a sheet deleted on a stale view stays, and the one merging is told (saver, c12)");
  for (const deleterSecond of [false, true]) {
    const server = new Server(mk(lab(), mkSheet({}, "s2", "Auswertung"), mkSheet({}, "s3", "Messung 2")));
    const filler = editorOn(server, `p-f${deleterSecond}`);
    const deleter = editorOn(server, `p-d${deleterSecond}`);
    const fill = () => {
      filler.store.setSheet("s3");
      filler.store.input({ row: 0, col: 0 }, "Probe");
      filler.store.input({ row: 1, col: 1 }, "0,512");
    };
    const del = () => deleter.store.apply("Blatt löschen", (wb) => O.deleteSheet(wb, "s3"));
    const [first, second] = deleterSecond ? [filler, deleter] : [deleter, filler];
    if (deleterSecond) fill();
    else del();
    await first.saver.flush();
    if (deleterSecond) del();
    else fill();
    await second.saver.flush();
    const stored = normalizeWorkbook(server.content, "de");
    eq(`${deleterSecond ? "the deleter" : "the filler"} saves second: the sheet and what was typed stay, the second saver is told`, [names(stored), O.getCell(stored, "s3", 1, 1)?.v, second.told.flat().map((c) => c.why)], [["Blatt 1", "Auswertung", "Messung 2"], 0.512, [deleterSecond ? "keptTheirs" : "keptMine"]]);
    await filler.saver.close();
    await deleter.saver.close();
  }
  section("COL-4: a copy that makes the spreadsheet too big to save says so, and nothing is lost (saver)");
  {
    // About 2.6 MB: two versions of it are more than save_sheet takes.
    const cells: Record<string, Cell> = {};
    for (let i = 0; i < 19000; i++) for (let c = 0; c < 6; c++) cells[cellKey(i, c)] = { v: Math.round(i * 1000 + c * 7.123456789 * 1e6) / 1e6 };
    const bigWb = mk({ ...mkSheet({}, "s1", "Platte"), cells, size: { rows: 20000, cols: 26 } });
    const server = new Server(bigWb);
    const a = editorOn(server, "p-c");
    const b = editorOn(server, "p-d");
    a.store.apply("Zeilen einfügen", (wb) => O.insertRows(wb, "s1", 3, 1));
    await a.saver.flush();
    b.store.apply("Zeilen löschen", (wb) => O.deleteRows(wb, "s1", 5, 1));
    b.store.input({ row: 10, col: 7 }, "15,5");
    await b.saver.flush();
    const said = b.told.flat();
    eq("the copy made and marked too big", said.map((c) => [c.why, c.copyName, c.tooBig]), [["moved", "Platte (Konflikt)", true]]);
    check("…the notice says what to do", sheetText.de.conflict(said).includes("Kopier, was du aus „Platte (Konflikt)“ brauchst, nach „Platte“ und lösch dann die Konflikt-Kopie. Bis dahin ist die Tabelle mit beiden Versionen zu groß zum Speichern"), sheetText.de.conflict(said));
    const copy = b.store.get().workbook.sheets.find((s) => s.id === said[0]?.copyId);
    eq("both versions in the editor, my correction on my copy", [names(b.store.get().workbook), copy?.cells["10,7"]?.v], [["Platte", "Platte (Konflikt)"], 15.5]);
    eq("not saved, waiting on this device", [server.rev, b.states.at(-1), b.saver.dirty()], [1, "tooBig", true]);
    // The way out with one click (SheetEditor): my version as a spreadsheet of its own, small enough
    // to save, with my correction; then the copy goes here.
    const own = ownVersion(b.store.get().workbook, said[0].copyId, "de");
    check("my version as its own spreadsheet: small enough to save, my correction in it", !!own && JSON.stringify(own).length < MAX_BYTES && names(own).join() === "Platte" && own.sheets[0].cells["10,7"]?.v === 15.5, own ? `${JSON.stringify(own).length} bytes, ${names(own)}` : "null");
    // The copy deleted (after taking over what is needed): saved again.
    b.store.apply("Blatt löschen", (wb) => O.deleteSheet(wb, said[0].copyId));
    await b.saver.flush();
    eq("saved once the copy is gone", [server.rev, b.states.at(-1)], [2, "saved"]);
    await a.saver.close();
    await b.saver.close();
  }
}

// ==============================================================================================
void (async () => {
  try {
    await saverChecks();
  } catch (e) {
    count++;
    failures.push(`saver › threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  }
  if (failures.length) {
    console.error(`check:sheet-merge — ${failures.length} of ${count} checks failed:`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`check:sheet-merge — all ${count} checks passed.`);
  // (A notice's timer would keep Node waiting.)
  process.exit(0);
})();
