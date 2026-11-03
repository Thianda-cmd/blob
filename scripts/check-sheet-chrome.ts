// Checks the spreadsheet editor's chrome logic: the formula typing helpers shared by the formula
// bar and the cell editor (src/components/sheet/chrome/formulaInput.ts) and the formatting and
// editing actions behind the toolbar and the grid's shortcuts (chrome/actions.ts), on a real store.
//
//   npx tsx --tsconfig tsconfig.json scripts/check-sheet-chrome.ts
//
// Problems make the script exit with 1.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "@/i18n/config";
import { cellKey, parsePos } from "@/sheet/a1";
import { createCalc, formatValue, FUNCTION_NAMES, isError, tokenizeFormula, type FormulaToken } from "@/sheet/engine";
import { getCell } from "@/sheet/ops";
import type { Cell, Sheet, Workbook } from "@/sheet/types";
import {
  autoSum,
  autoSumCells,
  changeDecimals,
  everyCell,
  formatAreas,
  freezePanes,
  insertFunction,
  setBorders,
  setNumberFormat,
  setStyle,
  setUnit,
  sortPlan,
  sortSelection,
  stepDecimals,
  toggleStyle,
} from "@/components/sheet/chrome/actions";
import { applySuggestion, argumentAt, insertFunctionCall, insertRef, matchFunctions, matchingParens, refColors, suggestFunctions, wantsRef } from "@/components/sheet/chrome/formulaInput";
import { nextMatch } from "@/components/sheet/chrome/FindReplace";
import { previewValue, resolveName, selectionName } from "@/components/sheet/chrome/FormulaBar";
import { errorHelp } from "@/components/sheet/chrome/errorHelp";
import { browseFunctions } from "@/components/sheet/chrome/FunctionBrowser";
import { functionsForWords, squeeze } from "@/components/sheet/chrome/functionWords";
import { formatFor, formatId, shownDecimals } from "@/components/sheet/chrome/NumberFormatMenu";
import { sheetHasContent, sheetNameProblem } from "@/components/sheet/chrome/SheetTabs";
import { fitFigures, selectionStats, type FigureKey } from "@/components/sheet/chrome/StatusBar";
import { barWidth, labelRoom, toolbarLayout, type GroupId } from "@/components/sheet/chrome/Toolbar";
import { makeChart } from "@/components/sheet/chrome/ToolbarPanels";
import { currentSheetNotice, hideSheetNotice, holdSheetNotice, noticeDuration, sheetNoticeCountsDown, showSheetNotice } from "@/components/sheet/notice";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { SHEET_EVENT, type SheetEventDetail } from "@/components/sheet/events";
import { fillFrom, fillSelectionWith, fillTo, menuKindFor, selectRegionOrAll } from "@/components/sheet/grid/actions";
import { copySelection, pasteData } from "@/components/sheet/grid/clipboard";
import { formulaArgument, formulaSuggestions } from "@/components/sheet/grid/FormulaHints";
import { handleGridKey, type GridKeyContext } from "@/components/sheet/grid/keys";
import { cycleReference, formulaTokens, insertSelectionRef, pointAt, pointing, refFrames } from "@/components/sheet/grid/point";
import { createSheetStore, type SheetStore } from "@/components/sheet/store";
import { makeTable, setTableFilter } from "@/sheet/table/model";
import { placeHelp } from "@/components/sheet/grid/CellEditor";
import { numberAsText, numberLike } from "@/components/sheet/grid/cellLook";
import { keypadContext, keypadFor } from "@/components/sheet/grid/keypad";
import { currentRegion } from "@/components/sheet/grid/navigation";
import { placeMenu } from "@/components/ui/ContextMenu";

// Helpers that wrap other modules report a failure on the console; in normal use nothing may be
// reported. Every console.error from here on is collected and checked at the end.
const reported: string[] = [];
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  reported.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
};

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

/** The same object with its keys in order (for comparing objects built in different orders). */
const sortedKeys = (o: object | undefined) => (o ? Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))) : o);

/** Text with a "|" marking the caret → [text, caret]. */
function at(marked: string): [string, number] {
  const i = marked.indexOf("|");
  return i < 0 ? [marked, marked.length] : [marked.slice(0, i) + marked.slice(i + 1), i];
}
const wants = (marked: string, locale: Locale = "de") => wantsRef(...at(marked), locale);
const suggest = (marked: string, locale: Locale = "de") => {
  const s = suggestFunctions(...at(marked), locale);
  return s ? { start: s.start, end: s.end, names: s.items.map((f) => (locale === "de" ? f.de : f.en)) } : null;
};
const arg = (marked: string, locale: Locale = "de") => argumentAt(...at(marked), locale);
/** Text with the caret marked by "|" again. */
const mark = (r: { text: string; caret: number }) => r.text.slice(0, r.caret) + "|" + r.text.slice(r.caret);

// ----------------------------------------------------------------------------------------------
// Workbooks and stores

type CellInput = number | string | boolean | Cell;
const toCell = (v: CellInput): Cell => (typeof v === "object" ? v : typeof v === "string" && v.startsWith("=") ? { f: v.slice(1) } : { v });

function mkSheet(id: string, name: string, cells: Record<string, CellInput> = {}): Sheet {
  const out: Record<string, Cell> = {};
  for (const [a1, v] of Object.entries(cells)) {
    const p = parsePos(a1)!;
    out[cellKey(p.row, p.col)] = toCell(v);
  }
  return { id, name, cells: out, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } };
}
const book = (cells: Record<string, CellInput> = {}): Workbook => ({ v: 1, sheets: [mkSheet("s1", "Blatt 1", cells)], charts: [], tables: [] });
const storeOf = (cells: Record<string, CellInput> = {}, locale: Locale = "de", readOnly = false) => createSheetStore({ pageId: "p1", workbook: book(cells), locale, readOnly });

const pos = (a1: string) => parsePos(a1)!;
function selectA1(store: SheetStore, range: string) {
  const [a, b] = range.split(":");
  const p = pos(a);
  const q = pos(b ?? a);
  store.select({ anchor: p, focus: q, extra: [] });
}
const cellOf = (store: SheetStore, a1: string) => {
  const p = pos(a1);
  return getCell(store.get().workbook, store.get().sheetId, p.row, p.col);
};
const valueOf = (store: SheetStore, a1: string) => {
  const p = pos(a1);
  return store.get().calc.value(store.get().sheetId, p.row, p.col);
};
const editOf = (store: SheetStore) => {
  const e = store.get().edit;
  return e ? e.text.slice(0, e.caret) + "|" + e.text.slice(e.caret) : null;
};

// ==============================================================================================
section("wantsRef");
{
  check("right after =", wants("=|"));
  check("after (", wants("=SUMME(|"));
  check("after ;", wants("=SUMME(A1;|"));
  check("after an operator", wants("=A1+|"));
  check("after : (the end of a range)", wants("=A1:|"));
  check("after a space after (", wants("=SUMME( |"));
  check("after a comparison", wants("=WENN(A1>=|"));
  check("a reference right before the caret is replaced by the next click", wants("=SUMME(A1|"));
  check("…also a range", wants("=SUMME(A1:B5|"));
  check("…and one on another sheet", wants("=SUMME('Blatt 2'!A1|"));
  check("not after a closing )", !wants("=SUMME(A1)|"));
  check("not after a number", !wants("=1,5|"));
  check("not after %", !wants("=A1%|"));
  check("not before an operand (would glue)", !wants("=SUMME(|A1)"));
  check("not in the middle of a reference", !wants("=A|1"));
  check("not inside a text", !wants('=WENN(A1>0;"ab|'));
  check("not inside a closed text", !wants('=WENN(A1>0;"a|b")'));
  check("not inside { }", !wants("=SUMME({1;|"));
  check("not plain text", !wants("Probe|"));
  check("not an empty cell", !wants("|"));
  check("before a closing ) is fine", wants("=SUMME(|)"));
  check("English separator", wants("=SUM(A1,|", "en"));
  check("English decimal number", !wants("=1.5|", "en"));
  check("German comma after a function's ( counts as a separator", wants("=SUMME(A1,|"));
  check("after the name of a function without (", !wants("=SUMME|"));
}

// ==============================================================================================
section("insertRef");
{
  eq("into an open call", mark(insertRef(...at("=SUMME(|"), "B2", "de")), "=SUMME(B2|");
  eq("replaces the reference before the caret", mark(insertRef(...at("=SUMME(B2|"), "C3:C5", "de")), "=SUMME(C3:C5|");
  eq("replaces only that reference", mark(insertRef(...at("=A1|+B2"), "D4", "de")), "=D4|+B2");
  eq("inside empty parentheses", mark(insertRef(...at("=SUMME(|)"), "B2:B9", "de")), "=SUMME(B2:B9|)");
  eq("after an operator", mark(insertRef(...at("=A1*|"), "$B$1", "de")), "=A1*$B$1|");
  eq("a typed sheet name isn't doubled", mark(insertRef(...at("='Blatt 2'!|"), "'Blatt 2'!A1", "de")), "='Blatt 2'!A1|");
  eq("a reference on another sheet replaces one there", mark(insertRef(...at("=Blatt3!A1|"), "Blatt3!B7", "de")), "=Blatt3!B7|");
  eq("caret beyond the end is clamped", insertRef("=", 9, "A1", "de"), { text: "=A1", caret: 3 });
}

// ==============================================================================================
section("suggestFunctions");
{
  const su = suggest("=SU|");
  check("SU suggests", !!su);
  eq("SU: SUMME first", su?.names[0], "SUMME");
  check("SU: SUMMEWENN among them", !!su?.names.includes("SUMMEWENN"));
  eq("SU: the word's place", [su?.start, su?.end], [1, 3]);
  eq("mi: MITTELWERT then MIN (popular first)", suggest("=mi|")?.names.slice(0, 2), ["MITTELWERT", "MIN"]);
  eq("MIN: exact name first", suggest("=MIN|")?.names[0], "MIN");
  eq("STABW.: STABW.S then STABW.N", suggest("=STABW.|")?.names.slice(0, 2), ["STABW.S", "STABW.N"]);
  eq("without umlauts: zahl → ZÄHLENWENN", suggest("=zahl|")?.names[0], "ZÄHLENWENN");
  eq("ae for ä: zaehl → ZÄHLENWENN", suggest("=zaehl|")?.names[0], "ZÄHLENWENN");
  eq("in German, English names work too (after the German ones): COUNT → ANZAHL", suggest("=COUNT|")?.names[0], "ANZAHL");
  eq("…AVERAGE → MITTELWERT", suggest("=AVERAGE|")?.names[0], "MITTELWERT");
  eq("bes → BESTIMMTHEITSMASS", suggest("=bes|")?.names[0], "BESTIMMTHEITSMASS");
  eq("ste → STEIGUNG first", suggest("=ste|")?.names[0], "STEIGUNG");
  eq("English: SUM first", suggest("=SUM|", "en")?.names[0], "SUM");
  eq("English: no German names", suggest("=SUMME|", "en"), null);
  eq("English: av → AVERAGE", suggest("=av|", "en")?.names[0], "AVERAGE");
  eq("inside a nested call", suggest("=WENN(A1>0;MIT|")?.names[0], "MITTELWERT");
  eq("the whole word is replaced when the caret is inside it", (({ start, end }) => [start, end])(suggest("=MITTE|LW")!), [1, 8]);
  eq("not after : (a range being typed)", suggest("=SUMME(A1:B|"), null);
  eq("not after $", suggest("=$A|"), null);
  eq("not after a sheet name", suggest("=Blatt1!A|"), null);
  eq("not in a text", suggest('="SU|'), null);
  eq("not when ( follows already", suggest("=SUMME|(A1)"), null);
  eq("not for numbers", suggest("=1E|"), null);
  eq("not for plain text", suggest("SU|"), null);
  eq("not right after (", suggest("=SUMME(|"), null);
  eq("nothing matches", suggest("=QQQ|"), null);
  eq("matchFunctions: empty", matchFunctions("", "de"), []);
}

// ==============================================================================================
section("applySuggestion and insertFunctionCall");
{
  eq("name and ( replace the word", mark(applySuggestion("=MIT", { start: 1, end: 4 }, "MITTELWERT")), "=MITTELWERT(|");
  eq("keeps what follows", mark(applySuggestion("=WENN(MIT;1)", { start: 6, end: 9 }, "MITTELWERT")), "=WENN(MITTELWERT(|;1)");
  eq("no arguments: () right away", mark(applySuggestion("=PI", { start: 1, end: 3 }, "PI")), "=PI()|");
  eq("HEUTE()", mark(applySuggestion("=HEU", { start: 1, end: 4 }, "HEUTE")), "=HEUTE()|");
  eq("an existing ( isn't doubled", mark(applySuggestion("=SUMM(A1)", { start: 1, end: 5 }, "SUMME")), "=SUMME(|A1)");
  eq("browser pick on plain text starts a formula", mark(insertFunctionCall("12", 2, "MITTELWERT", "de")), "=MITTELWERT(|");
  eq("browser pick at the caret", mark(insertFunctionCall(...at("=A1+|"), "WURZEL", "de")), "=A1+WURZEL(|");
  eq("browser pick replaces a half-typed name", mark(insertFunctionCall(...at("=1+MITT|"), "MITTELWERT", "de")), "=1+MITTELWERT(|");
  eq("browser pick never replaces a reference", mark(insertFunctionCall(...at("=A1|"), "SUMME", "de")), "=A1SUMME(|");
}

// ==============================================================================================
section("argumentAt");
{
  eq("second argument", arg("=MITTELWERT(B2;B3|"), { fn: "AVERAGE", index: 1 });
  eq("first argument right after (", arg("=MITTELWERT(|"), { fn: "AVERAGE", index: 0 });
  eq("after a finished inner call", arg("=WENN(A1>0;SUMME(1;2);|"), { fn: "IF", index: 2 });
  eq("inside the inner call", arg("=WENN(A1>0;SUMME(1;|"), { fn: "SUM", index: 1 });
  eq("separators in texts don't count", arg('=WENN(A1>0;"a;b";|'), { fn: "IF", index: 2 });
  eq("separators in { } don't count", arg("=SUMME({1;2;3};|"), { fn: "SUM", index: 1 });
  eq("a bracket for grouping keeps the function", arg("=SUMME((A1+B1);|"), { fn: "SUM", index: 1 });
  eq("inside the grouping bracket", arg("=SUMME((A1+B1|"), { fn: "SUM", index: 0 });
  eq("after the call is closed", arg("=SUMME(1;2)|"), null);
  eq("on the name before (", arg("=SUMME|"), null);
  eq("caret in the middle of an argument", arg("=SUMME(A|1;2)"), { fn: "SUM", index: 0 });
  eq("English", arg("=SUM(1.5,2,|", "en"), { fn: "SUM", index: 2 });
  eq("German comma between references", arg("=SUMME(A1,B1,|"), { fn: "SUM", index: 2 });
  eq("decimal comma isn't a separator", arg("=RUNDEN(1,5|"), { fn: "ROUND", index: 0 });
  eq("an unknown function by its name", arg("=foo(1;|"), { fn: "FOO", index: 1 });
  eq("English name in German", arg("=AVERAGE(1;|"), { fn: "AVERAGE", index: 1 });
  eq("not a formula", arg("SUMME(1;|"), null);
}

// ==============================================================================================
section("refColors");
{
  const tokens = tokenizeFormula("A1+B2+a1+$A$1+B2:C3+'Blatt 2'!A1+C3:B2", "de");
  const colors = refColors(tokens);
  const refs = tokens.filter((t) => t.kind === "ref");
  eq("a colour per distinct reference, in order", refs.map((t) => colors.get(t)), ["blue", "orange", "blue", "blue", "green", "purple", "green"]);
  const many = tokenizeFormula("A1+A2+A3+A4+A5+A6+A7+A8+A9", "de");
  const c2 = refColors(many);
  eq("colours cycle after eight", many.filter((t) => t.kind === "ref").map((t) => c2.get(t)), ["blue", "orange", "green", "purple", "red", "teal", "pink", "brown", "blue"]);
  eq("no references, no colours", refColors(tokenizeFormula("1+2", "de")).size, 0);
  const fake: FormulaToken = { kind: "ref", text: "X1", start: 0, end: 2 };
  eq("a reference without area keeps working", refColors([fake]).get(fake), "blue");
}

// ==============================================================================================
section("matchingParens");
{
  eq("the pair around the just-typed )", matchingParens(...at("=SUMME(A1;(B1+2)|)"), "de"), [10, 15]);
  eq("the outer pair", matchingParens(...at("=SUMME(A1;(B1+2))|"), "de"), [6, 16]);
  eq("from the (", matchingParens(...at("=SUMME(|A1)"), "de"), [6, 9]);
  eq("unclosed", matchingParens(...at("=SUMME(|A1"), "de"), null);
  eq("parentheses in texts don't count", matchingParens(...at('=LÄNGE("(")|'), "de"), [6, 10]);
}

// ==============================================================================================
section("toggleStyle and setStyle");
{
  const store = storeOf({ A1: 1, B1: 2, A2: 3 });
  selectA1(store, "A1:B2");
  toggleStyle(store, "bold");
  check("all four cells bold (empty B2 too)", ["A1", "B1", "A2", "B2"].every((a) => cellOf(store, a)?.s?.bold === true));
  eq("one undo step called Fett", store.get().undoLabel, "Fett");
  toggleStyle(store, "bold");
  check("again: none bold", ["A1", "B1", "A2", "B2"].every((a) => !cellOf(store, a)?.s?.bold));
  eq("values stay", valueOf(store, "A2"), 3);
  selectA1(store, "A1");
  toggleStyle(store, "italic");
  selectA1(store, "A1:B1");
  toggleStyle(store, "italic");
  check("some italic → all italic", !!cellOf(store, "A1")?.s?.italic && !!cellOf(store, "B1")?.s?.italic);
  setStyle(store, { color: "red", fill: "yellow" });
  eq("colour and fill", [cellOf(store, "B1")?.s?.color, cellOf(store, "B1")?.s?.fill], ["red", "yellow"]);
  setStyle(store, { fill: undefined });
  eq("undefined removes the fill", cellOf(store, "B1")?.s?.fill, undefined);
  eq("…and keeps the colour", cellOf(store, "B1")?.s?.color, "red");
  setStyle(store, { align: "center" });
  eq("undo label for alignment", store.get().undoLabel, "Ausrichtung");
  store.undo();
  eq("undo takes the alignment back", cellOf(store, "A1")?.s?.align, undefined);

  const ro = storeOf({ A1: 1 }, "de", true);
  toggleStyle(ro, "bold");
  setStyle(ro, { color: "red" });
  eq("read-only: nothing changes", cellOf(ro, "A1"), { v: 1 });
}

// ==============================================================================================
section("everyCell and formatAreas");
{
  const wb = book({ A1: { v: 1, s: { bold: true } }, A2: { v: 2, s: { bold: true } } });
  const sheet = wb.sheets[0];
  check("all bold", everyCell(sheet, [{ r0: 0, c0: 0, r1: 1, c1: 0 }], (c) => !!c?.s?.bold));
  check("an empty cell isn't bold", !everyCell(sheet, [{ r0: 0, c0: 0, r1: 2, c1: 0 }], (c) => !!c?.s?.bold));
  check("two areas", everyCell(sheet, [{ r0: 0, c0: 0, r1: 0, c1: 0 }, { r0: 1, c0: 0, r1: 1, c1: 0 }], (c) => !!c?.s?.bold));
  const big: Sheet = { ...sheet, size: { rows: 5000, cols: 26 } };
  eq("a whole column is cut to the default 200 rows", formatAreas(big, [{ r0: 0, c0: 1, r1: 4999, c1: 1 }]), [{ r0: 0, c0: 1, r1: 199, c1: 1 }]);
  const used: Sheet = { ...big, cells: { ...big.cells, [cellKey(899, 0)]: { v: 1 } } };
  eq("…or to the data", formatAreas(used, [{ r0: 0, c0: 1, r1: 4999, c1: 1 }]), [{ r0: 0, c0: 1, r1: 899, c1: 1 }]);
  eq("a normal range stays", formatAreas(big, [{ r0: 2, c0: 1, r1: 9, c1: 3 }]), [{ r0: 2, c0: 1, r1: 9, c1: 3 }]);
  eq("clipped to the sheet", formatAreas(sheet, [{ r0: 190, c0: 20, r1: 400, c1: 40 }]), [{ r0: 190, c0: 20, r1: 199, c1: 25 }]);
}

// ==============================================================================================
section("number formats and decimals");
{
  eq("General 3,14159 + 1 decimal", stepDecimals(undefined, 3.14159, 1, "de"), { kind: "number", decimals: 6 });
  eq("General 3,14159 − 1 decimal", stepDecimals(undefined, 3.14159, -1, "de"), { kind: "number", decimals: 4 });
  eq("General 12 + 1", stepDecimals({ kind: "general" }, 12, 1, "en"), { kind: "number", decimals: 1 });
  eq("General 12 − 1 stays at 0", stepDecimals(undefined, 12, -1, "de"), { kind: "number", decimals: 0 });
  eq("General scientific 1,23E-07 + 1", stepDecimals(undefined, 1.23e-7, 1, "de"), { kind: "scientific", decimals: 3 });
  eq("text cell: 0 → 1", stepDecimals(undefined, "abc", 1, "de"), { kind: "number", decimals: 1 });
  eq("number keeps unit and grouping", stepDecimals({ kind: "number", decimals: 2, group: true, unit: "mg/L" }, 1, 1, "de"), { kind: "number", decimals: 3, group: true, unit: "mg/L" });
  eq("percent", stepDecimals({ kind: "percent", decimals: 0 }, 0.5, 1, "de"), { kind: "percent", decimals: 1 });
  eq("currency − 1", stepDecimals({ kind: "currency", decimals: 2, symbol: "€" }, 1, -1, "de"), { kind: "currency", decimals: 1, symbol: "€" });
  eq("significant figures", stepDecimals({ kind: "significant", digits: 3 }, 1, 1, "de"), { kind: "significant", digits: 4 });
  eq("significant figures stop at 1", stepDecimals({ kind: "significant", digits: 1 }, 1, -1, "de"), { kind: "significant", digits: 1 });
  eq("decimals stop at 0", stepDecimals({ kind: "number", decimals: 0 }, 1, -1, "de"), { kind: "number", decimals: 0 });
  eq("dates: no decimals", stepDecimals({ kind: "date", style: "short" }, 46000, 1, "de"), null);

  const store = storeOf({ A1: 3.14159, A2: 2.5 });
  selectA1(store, "A1:A2");
  changeDecimals(store, -1);
  eq("from what the active cell shows, for the whole selection", [cellOf(store, "A1")?.s?.fmt, cellOf(store, "A2")?.s?.fmt], [
    { kind: "number", decimals: 4 },
    { kind: "number", decimals: 4 },
  ]);
  eq("shown", formatValue(valueOf(store, "A2"), cellOf(store, "A2")?.s?.fmt, "de"), "2,5000");
  eq("undo label", store.get().undoLabel, "Dezimalstellen");
  setNumberFormat(store, { kind: "percent", decimals: 1 });
  eq("percent", formatValue(valueOf(store, "A2"), cellOf(store, "A2")?.s?.fmt, "de"), "250,0%");
  setNumberFormat(store, null);
  eq("null → General (no format stored)", cellOf(store, "A1")?.s, undefined);

  // Units
  const u = storeOf({ A1: 12.5, A2: 0.0523, A3: { v: 0.5, s: { fmt: { kind: "percent", decimals: 0 } } }, A4: { v: 3, s: { fmt: { kind: "significant", digits: 3 } } } });
  selectA1(u, "A1:A4");
  setUnit(u, "mg/L");
  eq("General keeps what it shows and gets the unit", formatValue(valueOf(u, "A1"), cellOf(u, "A1")?.s?.fmt, "de"), "12,5\u202Fmg/L");
  eq("…every General cell its own decimals", formatValue(valueOf(u, "A2"), cellOf(u, "A2")?.s?.fmt, "de"), "0,0523\u202Fmg/L");
  eq("percent keeps its format", cellOf(u, "A3")?.s?.fmt, { kind: "percent", decimals: 0 });
  eq("significant figures take the unit", formatValue(valueOf(u, "A4"), cellOf(u, "A4")?.s?.fmt, "de"), "3,00\u202Fmg/L");
  selectA1(u, "B1:B2");
  setUnit(u, "µL");
  eq("empty cells get the active cell's look, so values typed later show the unit", cellOf(u, "B2")?.s?.fmt, { kind: "number", decimals: 0, unit: "µL" });
  selectA1(u, "A1:A4");
  eq("undo label", u.get().undoLabel, "Einheit");
  setUnit(u, null);
  eq("null removes the unit", cellOf(u, "A1")?.s?.fmt, { kind: "number", decimals: 1 });
  eq("…from significant figures too", cellOf(u, "A4")?.s?.fmt, { kind: "significant", digits: 3 });
}

// ==============================================================================================
section("switching formats keeps the precision");
{
  eq("Zahl 0,106 (3) → Prozent 10,6 % (1)", formatFor("percent", { kind: "number", decimals: 3 }, "de", 0.106), { kind: "percent", decimals: 1 });
  eq("Prozent (1) → Zahl (3)", formatFor("number", { kind: "percent", decimals: 1 }, "de", 0.106), { kind: "number", decimals: 3 });
  eq("General 0,0523 → Zahl 0,0523 (lab values keep their digits)", formatFor("number", undefined, "de", 0.0523), { kind: "number", decimals: 4 });
  eq("General 12,5 → Zahl 12,5", formatFor("number", undefined, "de", 12.5), { kind: "number", decimals: 1 });
  eq("General 3,14159265 → at most 4 decimals", formatFor("number", undefined, "de", 3.14159265), { kind: "number", decimals: 4 });
  eq("General 1,23E-07 → enough decimals for 3 digits", formatFor("number", undefined, "de", 1.23e-7), { kind: "number", decimals: 9 });
  eq("an empty cell → Zahl with 2", formatFor("number", undefined, "de", null), { kind: "number", decimals: 2 });
  eq("Wissenschaftlich 1,23E-05 → Zahl 0,0000123", formatFor("number", { kind: "scientific", decimals: 2 }, "de", 1.23e-5), { kind: "number", decimals: 7 });
  eq("the unit stays", formatFor("scientific", { kind: "number", decimals: 2, unit: "mg/L" }, "de", 1), { kind: "scientific", decimals: 2, unit: "mg/L" });
  eq("thousands separator stays on Zahl", formatFor("number", { kind: "number", decimals: 1, group: true }, "de", 1), { kind: "number", decimals: 1, group: true });
  eq("signifikante Stellen 3 → Wissenschaftlich 2", formatFor("scientific", { kind: "significant", digits: 3 }, "de", 1), { kind: "scientific", decimals: 2 });
  eq("Wissenschaftlich 2 → signifikante Stellen 3", formatFor("significant", { kind: "scientific", decimals: 2 }, "de", 1), { kind: "significant", digits: 3 });
  eq("Währung: € in German", formatFor("currency", undefined, "de", 1), { kind: "currency", decimals: 2, symbol: "€" });
  eq("Währung: $ in English", formatFor("currency", undefined, "en", 1), { kind: "currency", decimals: 2, symbol: "$" });
  eq("Standard → none", formatFor("general", { kind: "number", decimals: 2 }, "de", 1), null);
  eq("dates by style", [formatId({ kind: "date", style: "long" }), formatId({ kind: "date", style: "iso" }), formatId(undefined)], ["dateLong", "dateIso", "general"]);
}

// ==============================================================================================
section("borders");
{
  const store = storeOf({});
  selectA1(store, "B2:C3");
  setBorders(store, "outside");
  eq("top left", cellOf(store, "B2")?.s?.border, { top: "thin", left: "thin" });
  eq("top right", cellOf(store, "C2")?.s?.border, { top: "thin", right: "thin" });
  eq("bottom left", cellOf(store, "B3")?.s?.border, { bottom: "thin", left: "thin" });
  eq("bottom right", cellOf(store, "C3")?.s?.border, { bottom: "thin", right: "thin" });
  eq("one undo step", store.get().undoLabel, "Rahmen");
  setBorders(store, "doubleBottom");
  eq("double bottom keeps the sides", cellOf(store, "B3")?.s?.border, { bottom: "double", left: "thin" });
  setBorders(store, "all");
  eq("all", sortedKeys(cellOf(store, "B2")?.s?.border), { bottom: "thin", left: "thin", right: "thin", top: "thin" });
  selectA1(store, "B1");
  setBorders(store, "bottom");
  selectA1(store, "B2:C3");
  setBorders(store, "none");
  eq("none: gone", cellOf(store, "C3")?.s?.border, undefined);
  eq("none: the line above the selection (B1's bottom) goes too", cellOf(store, "B1")?.s, undefined);
  store.undo();
  eq("undo brings it back", cellOf(store, "B1")?.s?.border, { bottom: "thin" });
}

// ==============================================================================================
section("autoSum: one cell");
{
  const store = storeOf({ B1: "Extinktion", B2: 0.1, B3: 0.2, B4: 0.3, B5: 0.4 });
  selectA1(store, "B6");
  autoSum(store);
  eq("proposes the numbers above, without the header, caret after the range", editOf(store), "=SUMME(B2:B5|)");
  check("edits in the cell", store.get().edit?.via === "cell");
  store.commitEdit("down");
  eq("Enter takes it", cellOf(store, "B6")?.f, "SUM(B2:B5)");
  check("…and the value is right", Math.abs((valueOf(store, "B6") as number) - 1) < 1e-12);

  const gap = storeOf({ B2: 1, B3: 2, B4: 3 });
  selectA1(gap, "B6");
  autoSum(gap);
  eq("an empty row between counts in (like Excel)", editOf(gap), "=SUMME(B2:B5|)");
  gap.cancelEdit();

  const left = storeOf({ A1: "Probe", B1: 1, C1: 2, D1: 3 });
  selectA1(left, "E1");
  autoSum(left, "AVERAGE");
  eq("left of it, with the German name", editOf(left), "=MITTELWERT(B1:D1|)");
  left.cancelEdit();

  const none = storeOf({});
  selectA1(none, "C3");
  autoSum(none, "STDEV.S");
  eq("nothing to add: empty brackets, caret inside", editOf(none), "=STABW.S(|)");
  none.cancelEdit();

  const en = storeOf({ A1: 1, A2: 2 }, "en");
  selectA1(en, "A3");
  autoSum(en, "MAX");
  eq("English", editOf(en), "=MAX(A1:A2|)");
  en.cancelEdit();

  const typing = storeOf({});
  typing.startEdit({ via: "cell", replace: true, text: "=1+" });
  autoSum(typing);
  eq("while typing a formula it goes in at the caret", editOf(typing), "=1+SUMME(|");

  const plain = storeOf({ A1: 1, A2: 2 });
  selectA1(plain, "A3");
  plain.startEdit({ via: "cell", replace: true, text: "5" });
  autoSum(plain);
  eq("typed text is committed first", cellOf(plain, "A3")?.v, 5);
  eq("…then the proposal opens below… no: in the same cell", editOf(plain), "=SUMME(A1:A2|)");

  const ro = storeOf({ A1: 1 }, "de", true);
  selectA1(ro, "A2");
  autoSum(ro);
  eq("read-only: nothing", ro.get().edit, null);
}

// ==============================================================================================
section("autoSum: a range");
{
  const store = storeOf({ B1: "x", C1: "y", B2: 1, B3: 2, C2: 10, C3: 20 });
  selectA1(store, "B1:C3");
  autoSum(store);
  eq("below each column, headers left out", [cellOf(store, "B4")?.f, cellOf(store, "C4")?.f], ["SUM(B2:B3)", "SUM(C2:C3)"]);
  eq("values", [valueOf(store, "B4"), valueOf(store, "C4")], [3, 30]);
  eq("one undo step", store.get().undoLabel, "AutoSumme");

  const free = storeOf({ A2: "Probe 1", A3: "Probe 2", B2: 1, B3: 2, C2: 3, C3: 4 });
  selectA1(free, "A2:D4");
  autoSum(free);
  eq("empty last row and column: column sums", [cellOf(free, "B4")?.f, cellOf(free, "C4")?.f], ["SUM(B2:B3)", "SUM(C2:C3)"]);
  eq("…row sums without the labels", [cellOf(free, "D2")?.f, cellOf(free, "D3")?.f], ["SUM(B2:C2)", "SUM(B3:C3)"]);
  eq("…and the grand total", cellOf(free, "D4")?.f, "SUM(B2:C3)");
  eq("the label column gets no sum", cellOf(free, "A4"), undefined);

  const lastRow = storeOf({ B2: 1, B3: 2, C2: 3, C3: 4 });
  selectA1(lastRow, "B2:C4");
  autoSum(lastRow, "AVERAGE");
  eq("empty last row: into it", [cellOf(lastRow, "B4")?.f, cellOf(lastRow, "C4")?.f], ["AVERAGE(B2:B3)", "AVERAGE(C2:C3)"]);

  const lastCol = storeOf({ B2: 1, C2: 2, B3: 3, C3: 4 });
  selectA1(lastCol, "B2:D3");
  autoSum(lastCol);
  eq("empty last column: right of each row", [cellOf(lastCol, "D2")?.f, cellOf(lastCol, "D3")?.f], ["SUM(B2:C2)", "SUM(B3:C3)"]);

  const row = storeOf({ A1: 1, B1: 2, C1: 3 });
  selectA1(row, "A1:C1");
  autoSum(row);
  eq("one row: right of it", cellOf(row, "D1")?.f, "SUM(A1:C1)");

  const occupied = storeOf({ B2: 1, B3: 2, B4: "note" });
  selectA1(occupied, "B2:B3");
  autoSum(occupied);
  eq("the cell below is taken: the next free one", [cellOf(occupied, "B4")?.v, cellOf(occupied, "B5")?.f], ["note", "SUM(B2:B3)"]);

  const words = storeOf({ A1: "a", A2: "b" });
  selectA1(words, "A1:A2");
  autoSum(words);
  eq("no numbers: nothing written", words.get().workbook.sheets[0].cells, book({ A1: "a", A2: "b" }).sheets[0].cells);

  const styled = storeOf({ A1: 1, A2: 2, A3: { s: { bold: true }, note: "Summe" } });
  selectA1(styled, "A1:A3");
  autoSum(styled);
  eq("the result cell keeps its look and note", cellOf(styled, "A3"), { f: "SUM(A1:A2)", s: { bold: true }, note: "Summe" });

  const wb = book({ B1: 1, B2: 2 });
  const sheet = { ...wb.sheets[0], size: { rows: 5000, cols: 26 } };
  const calc = createCalc({ ...wb, sheets: [sheet] }, { locale: "de" });
  eq("a whole column: right under the data", autoSumCells(sheet, calc, "s1", { r0: 0, c0: 1, r1: 4999, c1: 1 }, "SUM"), [{ row: 2, col: 1, f: "SUM(B1:B2)" }]);
}

// ==============================================================================================
section("sortSelection");
{
  const store = storeOf({ A1: "Probe", B1: "Wert", A2: "c", B2: 3, A3: "a", B3: 1, A4: "b", B4: 2 });
  selectA1(store, "A3");
  sortSelection(store, "asc");
  eq("the block around the active cell, header kept on top", ["A1", "A2", "A3", "A4"].map((a) => valueOf(store, a)), ["Probe", "a", "b", "c"]);
  eq("rows stay together", ["B2", "B3", "B4"].map((a) => valueOf(store, a)), [1, 2, 3]);
  eq("undo label", store.get().undoLabel, "Sortieren");
  selectA1(store, "B2");
  sortSelection(store, "desc");
  eq("by the active cell's column, descending", ["B2", "B3", "B4"].map((a) => valueOf(store, a)), [3, 2, 1]);
  eq("…rows still together", ["A2", "A3", "A4"].map((a) => valueOf(store, a)), ["c", "b", "a"]);

  const sel = storeOf({ A1: 5, A2: 3, A3: 4, A4: 1 });
  selectA1(sel, "A2:A4");
  sortSelection(sel, "asc");
  eq("a selected range: only its rows", ["A1", "A2", "A3", "A4"].map((a) => valueOf(sel, a)), [5, 1, 3, 4]);

  const wide = storeOf({ A1: "x", B1: "y", A2: 3, B2: 30, A3: 1, B3: 10, A4: 2, B4: 20 });
  const plan = sortPlan(wide.get().workbook.sheets[0], wide.get().calc, "s1", { anchor: pos("B2"), focus: pos("B4"), extra: [] });
  eq("one column of a block takes the block along, without the header", plan && { area: plan.area, col: plan.col, widened: plan.widened }, { area: { r0: 1, c0: 0, r1: 3, c1: 1 }, col: 1, widened: true });
  selectA1(wide, "B2:B4");
  sortSelection(wide, "asc");
  eq("…so pairs stay pairs", ["A2", "A3", "A4"].map((a) => valueOf(wide, a)), [1, 2, 3]);

  const formulas = storeOf({ A1: 2, B1: "=A1*10", A2: 1, B2: "=A2*10" });
  selectA1(formulas, "A1:B2");
  sortSelection(formulas, "asc");
  eq("formulas move with their row", [cellOf(formulas, "B1")?.f, valueOf(formulas, "B1")], ["A1*10", 10]);

  const lone = storeOf({ C5: 1 });
  selectA1(lone, "C5");
  sortSelection(lone, "asc");
  eq("nothing to sort: nothing changes", lone.get().canUndo, false);

  const bold = storeOf({ A1: { v: "Name", s: { bold: true } }, A2: "Zoe", A3: "Anna" });
  selectA1(bold, "A2");
  sortSelection(bold, "asc");
  eq("a bold text header is found too", ["A1", "A2", "A3"].map((a) => valueOf(bold, a)), ["Name", "Anna", "Zoe"]);
}

// ==============================================================================================
section("freezePanes");
{
  const store = storeOf({});
  freezePanes(store, "row");
  eq("top row", store.get().workbook.sheets[0].freeze, { rows: 1, cols: 0 });
  freezePanes(store, "col");
  eq("first column", store.get().workbook.sheets[0].freeze, { rows: 0, cols: 1 });
  selectA1(store, "C4");
  freezePanes(store, "here");
  eq("up to the selection", store.get().workbook.sheets[0].freeze, { rows: 3, cols: 2 });
  freezePanes(store, "none");
  eq("unfreeze", store.get().workbook.sheets[0].freeze, { rows: 0, cols: 0 });
  selectA1(store, "A1");
  freezePanes(store, "here");
  eq("A1: nothing to freeze", store.get().workbook.sheets[0].freeze, { rows: 0, cols: 0 });
}

// ==============================================================================================
section("insertFunction");
{
  const store = storeOf({ A1: 5 });
  selectA1(store, "A2");
  insertFunction(store, "AVERAGE");
  eq("starts a formula in the formula bar", editOf(store), "=MITTELWERT(|");
  check("via the bar", store.get().edit?.via === "bar");
  insertFunction(store, "SQRT");
  eq("a second pick goes in at the caret", editOf(store), "=MITTELWERT(WURZEL(|");
  store.cancelEdit();
  const en = storeOf({}, "en");
  insertFunction(en, "PI", "cell");
  eq("English, no arguments", editOf(en), "=PI()|");
  check("in the cell when asked", en.get().edit?.via === "cell");
}

// ==============================================================================================
section("name box");
{
  const wb: Workbook = {
    ...book({ A1: "x" }),
    sheets: [mkSheet("s1", "Blatt 1"), mkSheet("s2", "Blatt 2"), mkSheet("s3", "It's")],
    tables: [{ id: "t1", sheetId: "s2", name: "Kalibrierung", area: { r0: 0, c0: 0, r1: 6, c1: 1 }, columns: [{ id: "a", total: "none" }, { id: "b", total: "none" }], totals: false, style: "purple", banded: true, filters: {}, sort: null }],
  };
  eq("a cell, any case", resolveName(wb, "s1", "d2"), { sheetId: "s1", area: { r0: 1, c0: 3, r1: 1, c1: 3 } });
  eq("a range, either way round", resolveName(wb, "s1", "C5:A1"), { sheetId: "s1", area: { r0: 0, c0: 0, r1: 4, c1: 2 } });
  eq("$ signs are fine", resolveName(wb, "s1", "$B$2"), { sheetId: "s1", area: { r0: 1, c0: 1, r1: 1, c1: 1 } });
  eq("a table's name (on its sheet)", resolveName(wb, "s1", "kalibrierung"), { sheetId: "s2", area: { r0: 0, c0: 0, r1: 6, c1: 1 } });
  eq("whole columns", resolveName(wb, "s1", "B:D"), { sheetId: "s1", area: { r0: 0, c0: 1, r1: 199, c1: 3 } });
  eq("whole rows", resolveName(wb, "s1", "3:5"), { sheetId: "s1", area: { r0: 2, c0: 0, r1: 4, c1: 25 } });
  eq("on another sheet", resolveName(wb, "s1", "'Blatt 2'!B3:C4"), { sheetId: "s2", area: { r0: 2, c0: 1, r1: 3, c1: 2 } });
  eq("a quoted name with a quote inside", resolveName(wb, "s1", "'It''s'!A1"), { sheetId: "s3", area: { r0: 0, c0: 0, r1: 0, c1: 0 } });
  eq("unknown sheet", resolveName(wb, "s1", "Blatt9!A1"), null);
  eq("nonsense", resolveName(wb, "s1", "Quatsch!!"), null);
  eq("empty", resolveName(wb, "s1", "  "), null);
  eq("beyond the limits", resolveName(wb, "s1", "A30000"), null);
  eq("shows a cell", selectionName(wb, "s1", { r0: 3, c0: 1, r1: 3, c1: 1 }), "B4");
  eq("shows a range", selectionName(wb, "s1", { r0: 1, c0: 1, r1: 8, c1: 3 }), "B2:D9");
  eq("shows a whole table by its name", selectionName(wb, "s2", { r0: 0, c0: 0, r1: 6, c1: 1 }), "Kalibrierung");
  eq("shows whole columns", selectionName(wb, "s1", { r0: 0, c0: 1, r1: 199, c1: 1 }), "B:B");
  eq("shows whole rows", selectionName(wb, "s1", { r0: 2, c0: 0, r1: 3, c1: 25 }), "3:4");
}

// ==============================================================================================
section("live result");
{
  const wb = book({ B2: 1, B3: 2, B4: 3 });
  const calc = createCalc(wb, { locale: "de" });
  const at = { sheetId: "s1", row: 9, col: 1 };
  eq("open brackets are closed", previewValue("=MITTELWERT(B2:B4", "de", calc, at), 2);
  eq("a trailing separator doesn't count as an empty 0", previewValue("=MITTELWERT(B2:B4;", "de", calc, at), 2);
  eq("a trailing operator neither", previewValue("=SUMME(B2:B4)*", "de", calc, at), 6);
  eq("English", previewValue("=SUM(B2:B4,", "en", calc, at), 6);
  eq("not a formula", previewValue("12", "de", calc, at), undefined);
  eq("just =", previewValue("=", "de", calc, at), undefined);
  eq("doesn't parse yet", previewValue("=SUMME(B2:B4))", "de", calc, at), undefined);
}

// ==============================================================================================
section("find order");
{
  const order = ["s1", "s2"];
  const m = [
    { sheetId: "s1", row: 0, col: 1 },
    { sheetId: "s1", row: 2, col: 0 },
    { sheetId: "s2", row: 1, col: 1 },
  ];
  eq("next after the active cell", nextMatch(m, order, { sheetId: "s1", row: 0, col: 1 }, 1), m[1]);
  eq("next goes on to the next sheet", nextMatch(m, order, { sheetId: "s1", row: 5, col: 5 }, 1), m[2]);
  eq("next wraps to the first", nextMatch(m, order, { sheetId: "s2", row: 9, col: 9 }, 1), m[0]);
  eq("previous", nextMatch(m, order, { sheetId: "s2", row: 1, col: 1 }, -1), m[1]);
  eq("previous wraps to the last", nextMatch(m, order, { sheetId: "s1", row: 0, col: 0 }, -1), m[2]);
  eq("nothing found", nextMatch([], order, { sheetId: "s1", row: 0, col: 0 }, 1), null);
}

// ==============================================================================================
section("status bar figures");
{
  const wb = book({ A1: "Wert", A2: 2, A3: 4, A4: "x", A5: 6, B2: "=A2*2", C9: 100 });
  const sheet = wb.sheets[0];
  const calc = createCalc(wb, { locale: "de" });
  const sel = (r0: number, c0: number, r1: number, c1: number, extra: { r0: number; c0: number; r1: number; c1: number }[] = []) => ({ anchor: { row: r0, col: c0 }, focus: { row: r1, col: c1 }, extra });
  const st = selectionStats(sheet, calc, "s1", sel(0, 0, 4, 1), () => false);
  eq("numbers, formulas included", [st.count, st.sum, st.min, st.max, st.filled], [4, 16, 2, 6, 6]);
  check("mean", Math.abs(st.mean - 4) < 1e-12);
  check("sample standard deviation (STABW.S)", st.stdev !== null && Math.abs(st.stdev - Math.sqrt(8 / 3)) < 1e-12, String(st.stdev));
  const hidden = selectionStats(sheet, calc, "s1", sel(0, 0, 4, 0), (r) => r === 2);
  eq("hidden rows are left out", [hidden.count, hidden.sum], [2, 8]);
  const one = selectionStats(sheet, calc, "s1", sel(1, 0, 1, 0), () => false);
  eq("one number: no standard deviation", [one.count, one.stdev], [1, null]);
  const whole = selectionStats({ ...sheet, size: { rows: 5000, cols: 26 } }, calc, "s1", sel(0, 0, 4999, 25), () => false);
  eq("a whole sheet: only cells that exist are read", [whole.count, whole.sum], [5, 116]);
  const twice = selectionStats(sheet, calc, "s1", sel(1, 0, 2, 0, [{ r0: 1, c0: 0, r1: 4, c1: 0 }]), () => false);
  eq("overlapping areas count each cell once", [twice.count, twice.sum], [3, 12]);
}

// ==============================================================================================
section("sheet names");
{
  const wb: Workbook = { ...book(), sheets: [mkSheet("s1", "Blatt 1"), mkSheet("s2", "Messung")] };
  eq("fine", sheetNameProblem(wb, "s1", "Kalibrierung"), null);
  eq("taken (any case)", sheetNameProblem(wb, "s1", "messung"), "taken");
  eq("its own name is fine", sheetNameProblem(wb, "s2", "Messung"), null);
  eq("forbidden characters", sheetNameProblem(wb, "s1", "a/b"), "invalid");
  eq("too long", sheetNameProblem(wb, "s1", "x".repeat(32)), "invalid");
  eq("empty", sheetNameProblem(wb, "s1", "   "), "invalid");
  check("an empty sheet has no content", !sheetHasContent(wb, wb.sheets[0]));
  check("a styled but empty cell isn't content", !sheetHasContent(wb, { ...wb.sheets[0], cells: { "0,0": { s: { bold: true } } } }));
  check("a value is", sheetHasContent(wb, { ...wb.sheets[0], cells: { "0,0": { v: 1 } } }));
  check("a chart on it is", sheetHasContent({ ...wb, charts: [{ sheetId: "s1" } as Workbook["charts"][number]] }, wb.sheets[0]));
}

// ==============================================================================================
section("toolbar layout");
{
  // Widths are the bar's inside, what the toolbar measures, with Blob's sidebar open: a 1280 px
  // window 988, 1366 px 1074, 1440 px 1148 (after the 6 px inset of the toolbar card on each side);
  // 1252 is a 1280 px window without the sidebar. The words "Als Tabelle" + "Diagramm" are about
  // 128 px in the app's font, "Table" + "Chart" 67.
  const de = labelRoom(128);
  const en = labelRoom(67);
  const GROUPS = 15;
  /** What students come for and use most: these stay before the words. */
  const MAIN: GroupId[] = ["history", "sum", "table", "chart", "format", "bold", "colors", "decimals", "align", "borders"];
  /** Seldom used: they move into "Mehr" before the words go. */
  const RARE: GroupId[] = ["sort", "find", "styles", "size", "freeze"];
  const all = toolbarLayout(1600, false, de);
  eq("wide: everything, with words on Als Tabelle and Diagramm", [all.shown.size, all.labels, all.compact], [GROUPS, true, false]);
  for (const [w, screen] of [
    [988, "1280"],
    [1074, "1366"],
    [1148, "1440"],
  ] as const) {
    const l = toolbarLayout(w, false, de);
    eq(`${screen} px laptop with the sidebar: the words and every main tool`, [l.labels, MAIN.filter((g) => !l.shown.has(g))], [true, []]);
  }
  eq("1440 px: only seldom used tools give way to the words", RARE.filter((g) => !toolbarLayout(1148, false, de).shown.has(g)), ["styles", "freeze"]);
  eq("…in English everything fits, with words", [toolbarLayout(1148, false, en).shown.size, toolbarLayout(1148, false, en).labels], [GROUPS, true]);
  const panel = toolbarLayout(796, false, de);
  eq("1440 px with a side panel: icons only, some in Mehr", [panel.labels, panel.shown.size < GROUPS], [false, true]);
  // 1600 px with the sidebar and a side panel open: no room for the words, but the seldom used tools
  // that fit stay on the bar (they once went into Mehr with the words, leaving 120 px empty).
  const wide = toolbarLayout(948, false, de);
  eq("1600 px with a side panel: no words, the seldom used tools that fit stay", [wide.labels, RARE.filter((g) => wide.shown.has(g))], [false, ["sort", "size"]]);
  check("the function library isn't on the bar (the formula bar's fx is right below)", !all.shown.has("fx" as never));
  const laptop = toolbarLayout(1252, false, de);
  eq("1280 px laptop without the sidebar: everything, with words", [laptop.shown.size, laptop.labels], [GROUPS, true]);
  const tablet = toolbarLayout(1252, true, de);
  eq("Galaxy Tab landscape (touch): the words and every main tool", [tablet.labels, MAIN.filter((g) => !tablet.shown.has(g))], [true, []]);
  // Every width, mouse and touch, German and English words: the bar is never too wide; nothing waits
  // in "Mehr" that would still fit; the words only next to every main tool, and before the seldom
  // used tools (they'd fit next to the main tools: they're on the bar).
  const ALL = [...MAIN, ...RARE];
  const layoutProblems: string[] = [];
  for (const touch of [false, true]) {
    for (const words of [de, en]) {
      for (let w = 300; w <= 1700; w++) {
        const l = toolbarLayout(w, touch, words);
        const at = `${w} px${touch ? " touch" : ""}`;
        const hidden = ALL.filter((g) => !l.shown.has(g));
        const extra = l.labels ? words : 0;
        if (barWidth(l.shown, touch, l.compact, extra, hidden.length > 0) > w) layoutProblems.push(`${at}: too wide`);
        for (const g of hidden) if (barWidth([...l.shown, g], touch, l.compact, extra, hidden.length > 1) <= w) layoutProblems.push(`${at}: ${g} would fit`);
        const main = MAIN.every((g) => l.shown.has(g));
        if (l.labels && !main) layoutProblems.push(`${at}: words without every main tool`);
        if (!l.compact && !l.labels && main && barWidth(MAIN, touch, false, words, true) <= w) layoutProblems.push(`${at}: the words gave way to seldom used tools`);
      }
    }
  }
  eq("no room left empty while tools wait in Mehr; the words only next to every main tool, before the seldom used ones", layoutProblems.slice(0, 6), []);
  check("unmeasured words: a safe guess", labelRoom(18 * 8) >= de);
  check("split buttons: a whole arrow (24 px) still leaves the main tools room at 1280 px", toolbarLayout(988, false, de).shown.has("chart"));
  const narrow = toolbarLayout(784, false);
  check("narrow: the most needed stay", ["history", "sum", "table", "chart", "format", "bold"].every((g) => narrow.shown.has(g as never)));
  check("narrow: some go into Mehr", narrow.shown.size < 16);
  const phone = toolbarLayout(374, true);
  eq("phone: undo, Σ, table, chart and the format icon", [...phone.shown].sort(), ["chart", "format", "history", "sum", "table"]);
  eq("phone: compact format button", phone.compact, true);
  eq("phone: no words (the icons need the room)", phone.labels, false);
  // A 390 px phone: 360 px inside (its 32 px split arrows for fingers included).
  eq("390 px phone: the same five", [...toolbarLayout(360, true).shown].sort(), ["chart", "format", "history", "sum", "table"]);
  // A wider bar never gives the main tools less room, nor loses the words once they're on (the
  // seldom used tools may give their place to the words). Not across the switch to the compact bar
  // with its small format button.
  const mainRoom = (l: ReturnType<typeof toolbarLayout>, touch: boolean) => barWidth(MAIN.filter((g) => l.shown.has(g)), touch, l.compact);
  let steady = true;
  for (const touch of [false, true]) {
    let before = toolbarLayout(300, touch, de);
    for (let w = 301; w <= 1700; w++) {
      const l = toolbarLayout(w, touch, de);
      if (l.compact === before.compact && ((before.labels && !l.labels) || mainRoom(l, touch) < mainRoom(before, touch))) steady = false;
      before = l;
    }
  }
  check("a wider bar never gives the main tools less room, nor loses the words", steady);
}

// ==============================================================================================
section("function browser search");
{
  const names = (q: string, locale: Locale = "de") => browseFunctions(q, "all", locale).map((f) => (locale === "de" ? f.de : f.en));
  eq("popular first, in order", browseFunctions("", "popular", "de").slice(0, 4).map((f) => f.de), ["SUMME", "MITTELWERT", "WENN", "ANZAHL"]);
  eq("a name", names("mittelwert")[0], "MITTELWERT");
  eq("without umlauts", names("zahlenwenn")[0], "ZÄHLENWENN");
  eq("English names in German", names("slope")[0], "STEIGUNG");
  eq("German names in English", names("steigung", "en")[0], "SLOPE");
  check("words of the help find functions (Standardabweichung)", names("standardabweichung").includes("STABW.S"));
  eq("a category", browseFunctions("", "regression", "de").length, 10);
  eq("all", browseFunctions("", "all", "de").length, FUNCTION_NAMES.length);
  // What students type (FT-9): everyday words, lab words, R² without the ² key.
  eq("Durchschnitt → MITTELWERT first", names("Durchschnitt")[0], "MITTELWERT");
  eq("Schnitt too", names("Schnitt")[0], "MITTELWERT");
  eq("Ø too", names("Ø")[0], "MITTELWERT");
  for (const q of ["R2", "R^2", "R²", "r 2", "R-Quadrat", "Bestimmtheitsmass"]) eq(`${q} → BESTIMMTHEITSMASS first`, names(q)[0], "BESTIMMTHEITSMASS");
  check("R2 no longer finds WENNS through the argument Wert_wenn_wahr2", !names("R2").includes("WENNS"));
  check("argument names don't count at all", names("wahr2").length === 0);
  eq("Standardabweichung → STABW.S first, before MITTELWERT (whose tip mentions it)", names("Standardabweichung").slice(0, 2), ["STABW.S", "STABW.N"]);
  eq("Kalibrier → STEIGUNG first (MAX only mentions a Kalibrierbereich)", names("Kalibrier")[0], "STEIGUNG");
  eq("Kalibriergerade: slope, intercept, R²", names("Kalibriergerade").slice(0, 3), ["STEIGUNG", "ACHSENABSCHNITT", "BESTIMMTHEITSMASS"]);
  eq("y-Achsenabschnitt", names("y-Achsenabschnitt")[0], "ACHSENABSCHNITT");
  eq("a word with an ending (Durchschnitte)", names("Durchschnitte")[0], "MITTELWERT");
  eq("…and a compound in the list (Durchschnittswert)", names("Durchschnittswert")[0], "MITTELWERT");
  // A word followed by another word is something else: error bars aren't IFERROR, extrapolating
  // isn't POWER, an intercept (Schnittpunkt) isn't an average (Schnitt).
  check("Fehlerbalken: no WENNFEHLER", !names("Fehlerbalken").includes("WENNFEHLER"));
  check("hochrechnen: no POTENZ", !names("hochrechnen").includes("POTENZ"));
  eq("Schnittpunkt: ACHSENABSCHNITT first, no MITTELWERT", [names("Schnittpunkt")[0], names("Schnittpunkt").includes("MITTELWERT")], ["ACHSENABSCHNITT", false]);
  eq("a name still beats a word (Steigung)", names("Steigung")[0], "STEIGUNG");
  eq("English: R2 → RSQ first", names("R2", "en")[0], "RSQ");
  check("English: R2 doesn't list SUM through number2", !names("R2", "en").includes("SUM"));
  eq("English: mean → AVERAGE first", names("mean", "en")[0], "AVERAGE");
  eq("English: standard deviation → STDEV.S first", names("standard deviation", "en")[0], "STDEV.S");
  eq("German words in the English app too", names("Durchschnitt", "en")[0], "AVERAGE");
  eq("one or two letters only find their own word", [...functionsForWords("sd").keys()], ["STDEV.S", "STDEV.P"]);
  eq("R² typed any way is one word", [squeeze("R²"), squeeze("R^2"), squeeze("r 2"), squeeze("R-2")], ["r2", "r2", "r2", "r2"]);
  eq("nothing", names("qqqqq"), []);
}

// ==============================================================================================
// Engine sanity for the previews the toolbar shows (in case the engine changes underneath).
section("format previews");
{
  eq("number", formatValue(1234.5678, { kind: "number", decimals: 2 }, "de"), "1234,57");
  eq("unit", formatValue(12.5, { kind: "number", decimals: 1, unit: "mg/L" }, "de"), "12,5\u202Fmg/L");
  check("an error stays an error", isError(createCalc(book({ A1: "=1/0" })).value("s1", 0, 0)));
}

// ==============================================================================================
// Lane F (fix round): messages that show whether or not Blob's tips are on, error help, the
// format menu's decimals, names.
section("sheet notices: answers to the student's own actions");
{
  const de = sheetChromeText.de;
  const notice = (store: SheetStore) => {
    const n = currentSheetNotice(store);
    return n && [n.tone, n.text];
  };
  const chart = storeOf({ A1: "x" });
  selectA1(chart, "D6");
  makeChart(chart);
  eq("Diagramm with nothing to chart says how to pick the data", notice(chart), ["info", de.chartNeedsData]);
  const sort = storeOf({ C5: 1 });
  selectA1(sort, "C5");
  sortSelection(sort, "asc");
  eq("nothing to sort", notice(sort), ["info", de.nothingToSort]);
  const wide = storeOf({ A1: "x", B1: "y", A2: 3, B2: 30, A3: 1, B3: 10 });
  selectA1(wide, "B2:B3");
  sortSelection(wide, "asc");
  eq("sorted together with the next column", notice(wide), ["info", de.sortedWithNeighbours]);
  const freeze = storeOf({});
  selectA1(freeze, "A1");
  freezePanes(freeze, "here");
  eq("freezing at A1", notice(freeze), ["info", de.freezeNothing]);
  const sum = storeOf({ A1: "a", B1: "b" });
  selectA1(sum, "A1:B1");
  autoSum(sum);
  eq("AutoSum without numbers", notice(sum), ["info", de.noNumbers]);
  const readOnly = storeOf({}, "de", true);
  makeChart(readOnly);
  eq("read-only: no hint about picking data", currentSheetNotice(readOnly), null);

  const store = storeOf({});
  const first = showSheetNotice(store, "eins");
  const second = showSheetNotice(store, "zwei", "error");
  check("one at a time: a new notice replaces the old one", currentSheetNotice(store)?.text === "zwei" && first !== second);
  hideSheetNotice(store, first);
  eq("hiding an old one leaves the newer one", currentSheetNotice(store)?.text, "zwei");
  hideSheetNotice(store, second);
  eq("…hidden by its own id", currentSheetNotice(store), null);
  check("each editor has its own notices", currentSheetNotice(storeOf({})) === null);
  check("problems stay longer than hints, hints longer than good news", noticeDuration("x", "error") > noticeDuration("x", "info") && noticeDuration("x", "info") > noticeDuration("x", "done"));
  check("long texts stay long enough to read slowly (about 14 characters a second)", noticeDuration("x".repeat(140), "info") >= 140 * 70);
  check("work in progress waits for its result", noticeDuration("…", "busy") >= 30_000);
  // The pointer resting on a notice holds that notice, not the place: a newer one shown meanwhile
  // (the card under the pointer goes without a pointerleave) still goes by itself.
  const held = storeOf({});
  const old = showSheetNotice(held, "Deine Datei wird gelesen …", "busy");
  holdSheetNotice(held, old, true);
  check("held: it doesn't count down", !sheetNoticeCountsDown(held));
  const fresh = showSheetNotice(held, "In der Auswahl stehen keine Zahlen.");
  check("a newer notice under the resting pointer counts down", sheetNoticeCountsDown(held));
  holdSheetNotice(held, old, false);
  check("…and the old card letting go on its way out changes nothing", sheetNoticeCountsDown(held) && currentSheetNotice(held)?.id === fresh);
  holdSheetNotice(held, fresh, true);
  check("the pointer on the new one holds it", !sheetNoticeCountsDown(held));
  holdSheetNotice(held, fresh, false);
  check("…until it leaves", sheetNoticeCountsDown(held));
  hideSheetNotice(held);
  check("hidden: nothing counts down", !sheetNoticeCountsDown(held) && currentSheetNotice(held) === null);
  // Blob's speech bubble shows nothing when a student switched its tips off: messages of the
  // spreadsheet editor go through its notices (src/components/sheet/notice.ts), never Blob alone.
  // (flushDrafts.ts sends drafts in the background while no editor is open: no notice to use.)
  const root = join(process.cwd(), "src/components/sheet");
  const said: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && /\bblob\.say\(/.test(readFileSync(path, "utf8"))) said.push(path.slice(root.length + 1));
    }
  };
  walk(root);
  eq("no editor message goes only through Blob's speech bubble", said.filter((f) => f !== "flushDrafts.ts"), []);
}

// ==============================================================================================
section("error help: the same words for tooltip, status bar and screen readers");
{
  // A6 can't be read (two ranges side by side, Excel's intersection, isn't supported): #NAME?
  // with nothing unknown in it, as a pasted or imported formula can be.
  const wb = book({ A1: 4, A2: "=A1/0", A3: "=SUMM(A1)", A4: "=Blatt9!A1", A5: '="a"+1', A6: "=A1:A3 C1:C3" });
  const calc = createCalc(wb);
  const help = (a1: string, locale: Locale = "de", withFormula = false) => {
    const p = pos(a1);
    const v = calc.value("s1", p.row, p.col);
    return isError(v) ? errorHelp(v, locale, withFormula ? getCell(wb, "s1", p.row, p.col)?.f : undefined) : null;
  };
  eq("#DIV/0!: its name and the advice what to do", help("A2"), { title: "Division durch null", text: "Hier wird durch 0 oder durch eine leere Zelle geteilt. Prüf den Nenner – oder fang den Fall mit WENNFEHLER ab." });
  eq("an unknown function: which one, and a suggestion", help("A3")?.text, "Die Funktion „SUMM“ gibt es nicht. Meintest du SUMME?");
  check("a missing sheet: which one", !!help("A4")?.text.includes("Blatt9"));
  check("English keeps the advice too", !!help("A2", "en")?.text.includes("IFERROR"));
  eq("…and suggests in English", help("A3", "en")?.text, 'There is no function called "SUMM". Did you mean SUM?');
  eq("a formula that can't be read: not an unknown name, and where it goes wrong", help("A6", "de", true), { title: "Fehler in der Formel", text: "Vor „C1:C3“ fehlt ein Rechenzeichen (+ - * /) oder ein „;“." });
  eq("…without the formula at hand: the engine's sentence", help("A6"), { title: "Fehler in der Formel", text: "Die Formel enthält einen Fehler." });
  eq("…in English", help("A6", "en", true)?.title, "Mistake in the formula");
}

// ==============================================================================================
section("format menu: the decimals a cell shows");
{
  eq("Standard 0,0523: 4, like the toolbar counts them", shownDecimals(undefined, 0.0523, "de"), 4);
  eq("Standard 12: 0", shownDecimals(undefined, 12, "de"), 0);
  eq("Standard in scientific notation: the mantissa's", shownDecimals(undefined, 1.25e-7, "de"), 2);
  eq("an empty or text cell: 0", shownDecimals(undefined, null, "de"), 0);
  eq("Zahl with 3 decimals: 3", shownDecimals({ kind: "number", decimals: 3 }, 1, "de"), 3);
  eq("a date: 0", shownDecimals({ kind: "date", style: "short" }, 46000, "de"), 0);
  // The menu's minus works on Standard like the toolbar's button.
  const store = storeOf({ A1: 0.0523 });
  selectA1(store, "A1");
  changeDecimals(store, -1);
  eq("…one fewer: 0,052", formatValue(0.0523, cellOf(store, "A1")?.s?.fmt, "de"), "0,052");
}

// ==============================================================================================
section("names: Tabelle is the spreadsheet, the smart table says what it is");
{
  const { de, en } = sheetChromeText;
  eq("the toolbar's word", [de.tableShort, en.tableShort], ["Als Tabelle", "Table"]);
  check("the word is part of the button's name (voice control, screen readers)", de.table.toLowerCase().includes(de.tableShort.toLowerCase()) && en.table.toLowerCase().includes(en.tableShort.toLowerCase()));
  eq("the name box's list", [de.nameBoxTables, en.nameBoxTables], ["Intelligente Tabellen", "Smart tables"]);
  check("British English throughout (Grey, not Gray)", !Object.values(en.colors).includes("Gray"));
}

// ==============================================================================================
section("status bar: which figures fit");
{
  const W = (key: FigureKey, full: number, short: number) => ({ key, full, short });
  // Widths like the real bar's at 12 px (Summe 31,565 · Mittelwert 2,630416667 · …).
  const six = [W("sum", 99, 62), W("average", 149, 100), W("count", 70, 40), W("min", 46, 46), W("max", 56, 56), W("stdev", 138, 100)];
  const fit = (room: number, widths = six) => {
    const f = fitFigures(widths, room);
    return { keys: [...f.keys].sort(), short: f.short };
  };
  const sorted = (...k: FigureKey[]) => [...k].sort();
  eq("room for all: all six, with words", fit(568), { keys: sorted("sum", "average", "count", "min", "max", "stdev"), short: false });
  eq("a pixel less: Min and Max step aside together", fit(567), { keys: sorted("sum", "average", "count", "stdev"), short: false });
  eq("no room for Stdabw.: Min and Max still fit", fit(461), { keys: sorted("sum", "average", "count", "min", "max"), short: false });
  eq("the main three with words", fit(330), { keys: sorted("sum", "average", "count"), short: false });
  eq("short of room: Σ Ø n keep all three", fit(300), { keys: sorted("sum", "average", "count"), short: true });
  eq("a phone: signs when they show more of the three", fit(170), { keys: sorted("sum", "average"), short: true });
  eq("words when signs show no more", fit(120), { keys: sorted("sum"), short: false });
  eq("no room at all: nothing (never a cut figure)", fit(40), { keys: [], short: false });
  eq("only a count (cells without numbers)", fit(50, [W("count", 70, 40)]), { keys: ["count"], short: true });
  eq("half a pixel of rounding still fits", fit(567.6), { keys: sorted("sum", "average", "count", "min", "max", "stdev"), short: false });
  // Over many rooms: never wider than the room, Anzahl never without Summe and Mittelwert, Min and Max together.
  let fits = true;
  let order = true;
  let pairs = true;
  for (let room = 0; room <= 700; room += 3) {
    const f = fitFigures(six, room);
    const used = [...f.keys].reduce((sum, k, i) => sum + (f.short ? six.find((x) => x.key === k)!.short : six.find((x) => x.key === k)!.full) + (i ? 2 : 0), 0);
    if (used > room + 0.5) fits = false;
    if ((f.keys.has("count") && !(f.keys.has("sum") && f.keys.has("average"))) || (f.keys.has("average") && !f.keys.has("sum"))) order = false;
    if (f.keys.has("min") !== f.keys.has("max")) pairs = false;
  }
  check("never wider than the room", fits);
  check("Summe, Mittelwert, Anzahl stay longest, in that order", order);
  check("Min and Max come and go together", pairs);
}

// ==============================================================================================
// A spreadsheet with a smart table over A1:B4: header "Konz" | "E", three rows of numbers.
function tableStore(locale: Locale = "de") {
  const store = storeOf({ A1: locale === "de" ? "Konz" : "Conc", B1: "E", A2: 0, B2: 0.002, A3: 2, B3: 0.105, A4: 4, B4: 0.209 }, locale);
  store.apply("table", (wb, calc) => {
    const made = makeTable(wb, calc, "s1", { r0: 0, c0: 0, r1: 3, c1: 1 }, locale);
    return "error" in made ? wb : made.wb;
  });
  return store;
}
const tableArea = (store: SheetStore) => {
  const a = store.get().workbook.tables[0]?.area;
  return a ? `${a.r0},${a.c0}:${a.r1},${a.c1}` : null;
};

section("pasting text: numbers in the language they are written in");
{
  const de = storeOf({}, "de");
  selectA1(de, "A1");
  pasteData(de, { text: "Zeit\tOD600\r\n0\t0.052\r\n30\t0.123\r\n" }, "all");
  eq("English lab values pasted by a German user keep their value", [valueOf(de, "A1"), valueOf(de, "B2"), valueOf(de, "A3"), valueOf(de, "B3")], ["Zeit", 0.052, 30, 0.123]);
  const one = storeOf({}, "de");
  selectA1(one, "C3");
  pasteData(one, { text: "0.123" }, "all");
  eq("…also a single value", valueOf(one, "C3"), 0.123);
  const own = storeOf({}, "de");
  selectA1(own, "A1");
  pasteData(own, { text: "1,5\t2,25\n3\t0,5" }, "all");
  eq("German numbers stay German", [valueOf(own, "A1"), valueOf(own, "B1"), valueOf(own, "A2"), valueOf(own, "B2")], [1.5, 2.25, 3, 0.5]);
  const thousands = storeOf({}, "de");
  selectA1(thousands, "A1");
  pasteData(thousands, { text: "1.234\t5" }, "all");
  eq("data that doesn't tell is read like typing (1.234 is a thousand in German)", valueOf(thousands, "A1"), 1234);
  const en = storeOf({}, "en");
  selectA1(en, "A1");
  pasteData(en, { text: "0,5\t1,25\n2,75\t3" }, "all");
  eq("German values pasted by an English user keep their value", [valueOf(en, "A1"), valueOf(en, "B1"), valueOf(en, "A2")], [0.5, 1.25, 2.75]);
  const html = storeOf({}, "de");
  selectA1(html, "A1");
  pasteData(html, { text: "", html: "<table><tr><td>Probe</td><td>Wert</td></tr><tr><td>1</td><td>0.25</td></tr><tr><td>2</td><td>0.75</td></tr></table>" }, "all");
  eq("an HTML table (Word, a web page) too", [valueOf(html, "A1"), valueOf(html, "B2"), valueOf(html, "B3")], ["Probe", 0.25, 0.75]);
}

section("smart tables grow when pasting and filling below them");
{
  const typed = tableStore();
  typed.input(pos("A5"), "6");
  eq("typing right below grows the table (as before)", tableArea(typed), "0,0:4,1");

  const text = tableStore();
  selectA1(text, "A5");
  pasteData(text, { text: "6\t0.311\n8\t0.418" }, "all");
  eq("text from another program pasted below: the table grows", tableArea(text), "0,0:5,1");
  eq("…with the values read right", [valueOf(text, "B5"), valueOf(text, "B6")], [0.311, 0.418]);
  eq("…in one undo step called Einfügen", text.get().undoLabel, "Einfügen");
  text.undo();
  eq("undo takes back the paste and the growing together", [tableArea(text), valueOf(text, "A5")], ["0,0:3,1", null]);

  const clip = tableStore();
  selectA1(clip, "A3:B4");
  const copied = copySelection(clip, false);
  selectA1(clip, "A5");
  pasteData(clip, { text: copied.text, html: copied.html }, "all");
  eq("Blob's own copy pasted below: the table grows", tableArea(clip), "0,0:5,1");
  eq("…with the copied values", [valueOf(clip, "A5"), valueOf(clip, "B6")], [2, 0.209]);

  const values = tableStore();
  selectA1(values, "A3:B4");
  const copiedValues = copySelection(values, false);
  selectA1(values, "A5");
  pasteData(values, { text: copiedValues.text }, "values");
  eq("…also pasting values only", tableArea(values), "0,0:5,1");

  const handle = tableStore();
  fillTo(handle, { r0: 2, c0: 0, r1: 3, c1: 0 }, { r0: 2, c0: 0, r1: 5, c1: 0 });
  eq("the fill handle continues the series below the table", [valueOf(handle, "A5"), valueOf(handle, "A6")], [6, 8]);
  eq("…and the table grows over it", tableArea(handle), "0,0:5,1");
  eq("…in one undo step", handle.get().undoLabel, "Ausfüllen");
  handle.undo();
  eq("…which undo takes back as one", [tableArea(handle), valueOf(handle, "A5")], ["0,0:3,1", null]);

  const down = tableStore();
  selectA1(down, "A4:B6");
  fillFrom(down, "down");
  eq("Ctrl+D below the table: it grows", [tableArea(down), valueOf(down, "B6")], ["0,0:5,1", 0.209]);

  const right = tableStore();
  right.input(pos("C2"), "1");
  eq("typing beside the table grows it by a column (German name)", [tableArea(right), valueOf(right, "C1")], ["0,0:3,2", "Spalte3"]);
  const rightEn = tableStore("en");
  rightEn.input(pos("C2"), "1");
  eq("…named in the user's language (English)", [tableArea(rightEn), valueOf(rightEn, "C1")], ["0,0:3,2", "Column3"]);

  const enter = tableStore();
  selectA1(enter, "A5:A6");
  enter.startEdit({ via: "cell", replace: true, text: "10" });
  fillSelectionWith(enter, "10");
  eq("Ctrl+Enter into cells below the table: it grows", [tableArea(enter), valueOf(enter, "A5"), valueOf(enter, "A6")], ["0,0:5,1", 10, 10]);

  const single = tableStore();
  selectA1(single, "A5");
  single.startEdit({ via: "cell", replace: true, text: "6" });
  fillSelectionWith(single, "6");
  eq("Ctrl+Enter in one cell is typing without moving on", [tableArea(single), valueOf(single, "A5"), single.get().selection.anchor], ["0,0:4,1", 6, { row: 4, col: 0 }]);

  const far = tableStore();
  selectA1(far, "A9");
  pasteData(far, { text: "6\t0.311" }, "all");
  eq("pasting far below leaves the table alone", tableArea(far), "0,0:3,1");
  const plain = storeOf({ A1: 1 });
  selectA1(plain, "A2");
  pasteData(plain, { text: "2\n3" }, "all");
  eq("no table: pasting is just pasting", [valueOf(plain, "A2"), valueOf(plain, "A3"), plain.get().workbook.tables.length], [2, 3, 0]);
}

section("Blob's own copy between two spreadsheets");
{
  const x = createSheetStore({ pageId: "page-x", workbook: book({ A1: { v: "Probe", s: { bold: true } }, A2: 2, B2: "=A2*10" }), locale: "de", readOnly: false });
  const y = createSheetStore({ pageId: "page-y", workbook: book({ A1: 7 }), locale: "de", readOnly: false });
  selectA1(x, "A1:B2");
  const copied = copySelection(x, false);
  selectA1(y, "C5");
  pasteData(y, { text: copied.text, html: copied.html }, "all");
  eq("formulas come along and move like within a sheet", [cellOf(y, "D6")?.f, valueOf(y, "D6")], ["C6*10", 20]);
  eq("looks come along", cellOf(y, "C5")?.s, { bold: true });
  const z = createSheetStore({ pageId: "page-z", workbook: book(), locale: "de", readOnly: false });
  selectA1(z, "A1");
  pasteData(z, { text: copied.text, html: copied.html }, "values");
  eq("as values: the shown values", [valueOf(z, "A2"), cellOf(z, "B2")], [2, { v: 20 }]);
  const cut = createSheetStore({ pageId: "page-c", workbook: book({ A1: 5 }), locale: "de", readOnly: false });
  selectA1(cut, "A1");
  const moved = copySelection(cut, true);
  const other = createSheetStore({ pageId: "page-o", workbook: book(), locale: "de", readOnly: false });
  selectA1(other, "B2");
  pasteData(other, { text: moved.text }, "all");
  eq("a cut pasted into another spreadsheet copies (the first one keeps its cells)", [valueOf(other, "B2"), valueOf(cut, "A1")], [5, 5]);
}

section("Ctrl+Enter fills the cells selected when typing began");
{
  const s = storeOf({ A2: 1, A3: 2, A4: 3 });
  selectA1(s, "B2:B4");
  s.startEdit({ via: "cell", replace: true, text: "=" });
  check("pointing", pointing(s));
  pointAt(s, pos("A2"), pos("A2"));
  eq("pointing put the reference in and moved the selection", [editOf(s), s.get().selection.anchor], ["=A2|", { row: 1, col: 0 }]);
  s.updateEdit("=A2*2", 5);
  eq("editSelection is still where typing began", s.editSelection(), { anchor: { row: 1, col: 1 }, focus: { row: 3, col: 1 }, extra: [] });
  fillSelectionWith(s, "=A2*2");
  eq("the selected cells get the formula, shifted per cell", [valueOf(s, "B2"), valueOf(s, "B3"), valueOf(s, "B4")], [2, 4, 6]);
  eq("the cell pointed at keeps its value (no formula pointing at itself)", cellOf(s, "A2"), { v: 1 });
  eq("not editing: no edit selection", s.editSelection(), null);
}

section("Ctrl+H opens find with the replace row");
{
  const g = globalThis as unknown as { window?: EventTarget };
  if (!g.window) g.window = new EventTarget();
  const seen: string[] = [];
  g.window.addEventListener(SHEET_EVENT, (e) => seen.push((e as CustomEvent<SheetEventDetail>).detail.open));
  const store = storeOf({ A1: 1 });
  const ctx = { store, layout: null, view: { w: 800, h: 600 }, typeInto() {}, prepareClipboard() {}, openMenu() {}, openChooser() {}, openDecor() {}, reveal() {} } as unknown as GridKeyContext;
  const press = (key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean; code?: string } = {}) => {
    let stopped = false;
    handleGridKey(
      {
        key,
        code: mods.code ?? `Key${key.toUpperCase()}`,
        keyCode: 0,
        ctrlKey: !!mods.ctrl,
        metaKey: !!mods.meta,
        altKey: !!mods.alt,
        shiftKey: !!mods.shift,
        preventDefault() {
          stopped = true;
        },
        stopPropagation() {},
      } as never,
      ctx,
    );
    return stopped;
  };
  check("Ctrl+F is used", press("f", { ctrl: true }));
  check("Ctrl+H is used", press("h", { ctrl: true }));
  check("⌘⌥F is used (⌥ makes the key ƒ)", press("ƒ", { meta: true, alt: true, code: "KeyF" }));
  eq("Ctrl+F finds, Ctrl+H and ⌘⌥F replace", seen, ["find", "replace", "replace"]);
}

section("formula helpers: nothing breaks or is reported while typing");
{
  const formulas = [
    "=MITTELWERT(B2:B7)",
    "=SUMME(A1;A2;$B$3)*2",
    "=WENN(A1>0;\"ja\";\"nein\")",
    "=STEIGUNG(B2:B7;A2:A7)",
    "=SVERWEIS(A1;'Blatt 2'!A:B;2;FALSCH)",
    "=(A1+B1)/C1^2%",
    "={1;2;3}",
    "=RUNDEN(MITTELWERT(B2:B4);3)&\" mg/L\"",
    "=A1:A3 B2",
    "=#BEZUG!+1",
    "=\"offen",
    "=SUMME((",
    "=))",
  ];
  const en = ["=AVERAGE(B2:B7)", "=SUM(A1,A2,$B$3)*2", "=IF(A1>0,\"yes\",\"no\")", "=VLOOKUP(A1,'Sheet 2'!A:B,2,FALSE)"];
  const wb = book({ A1: 1, B2: 2 });
  let thrown = 0;
  const tryIt = (fn: () => unknown) => {
    try {
      fn();
    } catch {
      thrown++;
    }
  };
  let calls = 0;
  for (const [list, locale] of [
    [formulas, "de"],
    [en, "en"],
  ] as const) {
    for (const full of list) {
      for (let n = 1; n <= full.length; n++) {
        const text = full.slice(0, n);
        for (let caret = 0; caret <= text.length; caret++) {
          calls++;
          tryIt(() => {
            const tok = formulaTokens(text, locale);
            refFrames(wb, "s1", "s1", tok);
            formulaSuggestions(text, caret, locale);
            formulaArgument(text, caret, locale);
            cycleReference(text, caret, locale);
            wantsRef(text, caret, locale);
            insertRef(text, caret, "B2", locale);
            if (tok) refColors(tokenizeFormula(text.slice(1), locale));
          });
        }
      }
    }
  }
  eq(`${calls} half-typed formulas and carets: nothing throws`, thrown, 0);
  // Pointing at cells on every prefix, through the store.
  const s = storeOf({ A1: 1, A2: 2, B1: 3 });
  let pointErrors = 0;
  for (const full of formulas) {
    for (let n = 1; n <= full.length; n++) {
      s.select(pos("C5"));
      s.startEdit({ via: "cell", replace: true, text: full.slice(0, n) });
      try {
        if (pointing(s)) pointAt(s, pos("A1"), pos("A2"));
        insertSelectionRef(s);
      } catch {
        pointErrors++;
      }
      s.cancelEdit();
    }
  }
  eq("pointing on every half-typed formula: nothing throws", pointErrors, 0);
}

section("smart table filters, undo after someone else's change, copying: nothing reported");
{
  const store = tableStore();
  const t = store.get().workbook.tables[0];
  store.apply("filter", (wb) => setTableFilter(wb, t.id, t.columns[0].id, { kind: "number", op: "gt", a: 1, b: null }));
  eq("a filter hides its rows in the grid's eyes", [store.isRowHidden("s1", 1), store.isRowHidden("s1", 2)], [true, false]);
  selectA1(store, "A1:B4");
  copySelection(store, false);
  // Someone else changes another cell; undoing mine keeps theirs.
  store.input(pos("D1"), "mine");
  const theirs = store.get().workbook;
  const sheet = theirs.sheets[0];
  store.replaceRemote({ ...theirs, sheets: [{ ...sheet, cells: { ...sheet.cells, "9,5": { v: "theirs" } } }] });
  store.undo();
  eq("undo after a remote change: mine goes, theirs stays", [valueOf(store, "D1"), valueOf(store, "F10")], [null, "theirs"]);
}

// ==============================================================================================
// The grid on touch screens and the keyboard, the cell editor and the menus.

/** "A1:C3" → an area. */
const areaOf = (range: string) => {
  const [a, b] = range.split(":");
  const p = pos(a);
  const q = pos(b ?? a);
  return { r0: Math.min(p.row, q.row), c0: Math.min(p.col, q.col), r1: Math.max(p.row, q.row), c1: Math.max(p.col, q.col) };
};

section("the block of data around a cell (Ctrl+A, sorting)");
{
  eq("a block", currentRegion(mkSheet("s1", "B", { A1: 1, B1: 2, A2: 3, B2: 4 }), pos("A1")), areaOf("A1:B2"));
  eq("touching corners join", currentRegion(mkSheet("s1", "B", { A1: 1, B2: 2, C3: 3 }), pos("A1")), areaOf("A1:C3"));
  eq("an empty cell next to data takes it in", currentRegion(mkSheet("s1", "B", { A1: 1, B2: 2 }), pos("C3")), areaOf("A1:C3"));
  eq("a lone empty cell is just itself", currentRegion(mkSheet("s1", "B", { A1: 1 }), pos("E9")), areaOf("E9"));
  // What counts as data is navigation's own: a value or a formula; "" and formatting alone don't.
  const gap = mkSheet("s1", "B", { A1: 1, A2: 2, A4: 4, B4: 5 });
  gap.cells[cellKey(2, 0)] = { v: "" };
  eq("an emptied cell (v: \"\") ends the block", currentRegion(gap, pos("A1")), areaOf("A1:A2"));
  gap.cells[cellKey(2, 0)] = { s: { bold: true } };
  eq("so does a cell with only formatting", currentRegion(gap, pos("A1")), areaOf("A1:A2"));
  gap.cells[cellKey(2, 0)] = { f: "A2*2" };
  eq("a formula joins the parts", currentRegion(gap, pos("A1")), areaOf("A1:B4"));
  const edge = mkSheet("s1", "B", { Y199: 1, Z200: 2 });
  eq("data at the sheet's last row and column", currentRegion(edge, pos("Z200")), areaOf("Y199:Z200"));

  // A data logger's export: 20,000 rows (as many as a sheet has) of time, OD600 and ln(OD).
  const rows = 20000;
  const big: Sheet = { id: "s1", name: "Blatt 1", cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows, cols: 26 } };
  big.cells[cellKey(0, 0)] = { v: "Zeit" };
  big.cells[cellKey(0, 1)] = { v: "OD600" };
  big.cells[cellKey(0, 2)] = { v: "ln(OD)" };
  for (let r = 1; r < rows; r++) {
    // Not in order, so sorting has something to do.
    const od = 0.05 + ((r * 7919) % 20011) / 10000;
    big.cells[cellKey(r, 0)] = { v: r };
    big.cells[cellKey(r, 1)] = { v: od };
    big.cells[cellKey(r, 2)] = { v: Math.log(od) };
  }
  let t0 = performance.now();
  const region = currentRegion(big, pos("A6"));
  const regionMs = performance.now() - t0;
  eq("20,000 rows: the whole block", region, { r0: 0, c0: 0, r1: rows - 1, c1: 2 });
  check("…found in well under a second", regionMs < 500, `${Math.round(regionMs)} ms`);
  const store = createSheetStore({ pageId: "p1", workbook: { v: 1, sheets: [big], charts: [], tables: [] }, locale: "de", readOnly: false });
  selectA1(store, "A6");
  t0 = performance.now();
  selectRegionOrAll(store);
  const selectMs = performance.now() - t0;
  eq("Ctrl+A in A6 selects all 20,000 rows", store.get().selection, { anchor: { row: 0, col: 0 }, focus: { row: rows - 1, col: 2 }, extra: [] });
  check("…in well under a second", selectMs < 500, `${Math.round(selectMs)} ms`);
  t0 = performance.now();
  const plan = sortPlan(big, store.get().calc, "s1", { anchor: pos("B2"), focus: pos("B2"), extra: [] });
  const planMs = performance.now() - t0;
  eq("sorting from B2 takes every row under the header", plan && plan.area, { r0: 1, c0: 0, r1: rows - 1, c1: 2 });
  check("…found in well under a second", planMs < 500, `${Math.round(planMs)} ms`);
  selectA1(store, "B2");
  sortSelection(store, "desc");
  const sorted = store.get().workbook.sheets[0];
  let falls = true;
  let together = true;
  for (let r = 2; r < rows; r++) {
    const b = sorted.cells[cellKey(r, 1)]?.v as number;
    if (b > (sorted.cells[cellKey(r - 1, 1)]?.v as number)) falls = false;
    if (Math.abs(Math.log(b) - (sorted.cells[cellKey(r, 2)]?.v as number)) > 1e-12) together = false;
  }
  check("Z → A sorts all 20,000 rows, the last ones too", falls);
  check("…and each row stays whole", together);
  eq("…under its header", valueOf(store, "B1"), "OD600");
}

section("the menu follows the selection (right-click, long press, the menu key)");
{
  const sheet = mkSheet("s1", "Blatt 1");
  const sel = (a: string, b: string, extra: string[] = []) => ({ anchor: pos(a), focus: pos(b), extra: extra.map(areaOf) });
  eq("a cell: the cells' menu", menuKindFor(sel("B3", "B3"), sheet), "cells");
  eq("a range", menuKindFor(sel("B3", "D9"), sheet), "cells");
  eq("a whole column (opened on any of its cells): the column menu", menuKindFor(sel("E1", "E200"), sheet), "cols");
  eq("whole columns B:D", menuKindFor(sel("B1", "D200"), sheet), "cols");
  eq("two whole columns apart", menuKindFor(sel("E1", "E200", ["B1:B200"]), sheet), "cols");
  eq("whole rows: the row menu", menuKindFor(sel("A3", "Z5"), sheet), "rows");
  eq("everything: the cells' menu, which then offers no rows or columns to delete", menuKindFor(sel("A1", "Z200"), sheet), "cells");
  eq("a column and a cell", menuKindFor(sel("E1", "E200", ["B3"]), sheet), "cells");
}

section("a long press opens the menu beside the finger, never under it");
{
  // The grid's menu: 267 px wide, 973 px of items, at most 520 px (or 70 % of the window) shown.
  const w = 267;
  const full = 973;
  let tries = 0;
  let under = 0;
  let out = 0;
  for (const [vw, vh] of [[390, 844], [360, 640], [820, 1180], [1180, 820], [1280, 800]]) {
    const cap = Math.min(vh * 0.7, 520);
    for (let x = 2; x < vw; x += 11) {
      for (let y = 2; y < vh; y += 13) {
        tries++;
        const p = placeMenu({ x, y, keyboard: false, finger: true }, w, Math.min(full, cap), full, cap, vw, vh);
        const h = p.maxHeight ?? Math.min(full, cap);
        // The finger's point and 16 px around it stay clear of the menu.
        if (x > p.left - 16 && x < p.left + w + 16 && y > p.top - 16 && y < p.top + h + 16) under++;
        if (p.left < 7.5 || p.left + w > vw - 7.5 || p.top < 7.5 || p.top + h > vh - 7.5 || h < 120) out++;
      }
    }
  }
  eq(`${tries} places for a finger on phones and tablets: none under the menu`, under, 0);
  eq("…the menu always inside the window, and at least 120 px tall (it scrolls)", out, 0);
  const tablet = placeMenu({ x: 300, y: 400, keyboard: false, finger: true }, w, 520, full, 520, 1280, 800);
  eq("a tablet: right beside the finger, as tall as it may be", [tablet.left, tablet.maxHeight], [328, 520]);
  const mouse = placeMenu({ x: 100, y: 100, keyboard: false }, 220, 300, 300, 520, 1280, 800);
  eq("a mouse: at the pointer, as before", [mouse.left, mouse.top, mouse.maxHeight], [100, 100, null]);
  const corner = placeMenu({ x: 1200, y: 700, keyboard: false }, 220, 300, 300, 520, 1280, 800);
  eq("…flipped near the window's edges", [corner.left, corner.top], [980, 400]);
}

section("formula help next to the cell editor stays where it can be seen");
{
  const box = (top: number, left: number, w = 100, h = 28) => ({ top, bottom: top + h, left, right: left + w });
  // A tablet with the keyboard up (it covers 360 px): what can be seen ends at 432.
  const tablet = { top: 8, bottom: 432, left: 8, right: 1272 };
  eq("room below: below", placeHelp(box(100, 100), 300, 120, tablet), { top: 134, left: 100, maxHeight: null });
  eq("just above the keyboard: beside, ending with the cell", placeHelp(box(400, 100), 300, 120, tablet), { top: 308, left: 206, maxHeight: null });
  const phone = { top: 8, bottom: 536, left: 8, right: 382 };
  eq("a phone near the keyboard: above, inside the screen", placeHelp(box(480, 150), 300, 120, phone), { top: 354, left: 82, maxHeight: null });
  eq("no room anywhere: the roomier side, scrolling", placeHelp(box(200, 150), 300, 400, { top: 8, bottom: 400, left: 8, right: 382 }), { top: 8, left: 82, maxHeight: 186 });
  let bad = 0;
  let tries = 0;
  for (const frame of [tablet, phone, { top: 8, bottom: 792, left: 8, right: 1272 }]) {
    for (let top = frame.top; top < frame.bottom - 28; top += 23) {
      for (let left = frame.left; left < frame.right - 60; left += 37) {
        for (const [w, h] of [[220, 60], [360, 150], [300, 290]]) {
          tries++;
          const cell = box(top, left, 90);
          const p = placeHelp(cell, w, h, frame);
          const shownH = Math.min(h, p.maxHeight ?? h);
          const overlaps = p.left < cell.right && p.left + w > cell.left && p.top < cell.bottom && p.top + shownH > cell.top;
          const outside = p.left < frame.left - 0.5 || p.left + w > frame.right + 0.5 || p.top < frame.top - 0.5 || p.top + shownH > frame.bottom + 0.5;
          if (overlaps || outside) bad++;
        }
      }
    }
  }
  eq(`${tries} cells and help sizes: never over the cell, never outside what can be seen`, bad, 0);
}

section("text that looks like a number gets a mark");
{
  const near = (above: number | string | null, below: number | string | null) => (d: -1 | 1) => (d < 0 ? above : below);
  eq("'0,1040,110' (typed after the old value) under 0,209", numberAsText({ v: "0,1040,110" }, near(0.209, null)), true);
  eq("'0, 5' above a number", numberAsText({ v: "0, 5" }, near(null, 0.5)), true);
  eq("'O,104' with the letter O", numberAsText({ v: "O,104" }, near(0.1, 0.2)), true);
  eq("'1,2,3' among words: no mark", numberAsText({ v: "1,2,3" }, near("Probe", "Name")), false);
  eq("a word: no mark", numberAsText({ v: "Probe" }, near(1, 2)), false);
  eq("a number: no mark", numberAsText({ v: 0.104 }, near(1, 2)), false);
  eq("a formula's text: no mark", numberAsText({ v: "1,5", f: "TEXT(A1;\"0,0\")" }, near(1, 2)), false);
  eq("a cell formatted as text on purpose: no mark", numberAsText({ v: "0,104", s: { fmt: { kind: "text" } } }, near(1, 2)), false);
  // A tap that opens such text (or a number) for editing selects it, so the new value replaces it.
  eq("number-like text: '12', '0,1040,110', '-0,003', '12 %'", ["12", "0,1040,110", "-0,003", "12 %"].map(numberLike), [true, true, true, true]);
  eq("…words are not: 'Probe 1', 'R²', 'Steigung'", ["Probe 1", "R²", "Steigung"].map(numberLike), [false, false, false]);
}

section("phones and tablets: digits where numbers are typed, letters elsewhere");
{
  const sheet = mkSheet("s1", "Blatt 1", {
    A1: "Konzentration",
    A2: 0,
    A3: 2,
    B1: "Probe",
    B2: "Wasser",
    C1: "Doppelt",
    C2: "=A2*2",
    D1: "Datum",
    D2: { v: 46143, s: { fmt: { kind: "date", style: "short" } } },
    E1: "Extinktion",
    F4: 7,
  });
  eq("under a typed number: digits", keypadContext(sheet, pos("A4")), "number");
  eq("on a number", keypadContext(sheet, pos("A3")), "number");
  eq("above a number (filling a gap)", keypadContext(sheet, pos("F3")), "number");
  eq("the first value under a heading: letters", keypadContext(sheet, pos("E2")), "other");
  eq("on a heading", keypadContext(sheet, pos("A1")), "other");
  eq("under text", keypadContext(sheet, pos("B3")), "other");
  eq("under a formula (a column of formulas)", keypadContext(sheet, pos("C3")), "other");
  eq("on a formula", keypadContext(sheet, pos("C2")), "other");
  eq("under a date (it needs the dots)", keypadContext(sheet, pos("D3")), "other");
  const none = { number: null, other: null } as const;
  eq("numbers get the digits keyboard", keypadFor("number", none), "decimal");
  eq("the rest the letters", keypadFor("other", none), "text");
  eq("a choice by hand sticks for that kind of cell", [keypadFor("number", { number: "text", other: null }), keypadFor("other", { number: "text", other: null })], ["text", "text"]);
}

console.error = consoleError;
section("nothing reported");
eq("no helper reported a failure in normal use", reported, []);

// ----------------------------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} of ${count} checks failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check-sheet-chrome: all ${count} checks passed.`);
// Done: the notices the checks showed would otherwise keep Node waiting for their timers.
process.exit(0);
