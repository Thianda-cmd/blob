// Checks the spreadsheet editor's chrome logic: the formula typing helpers shared by the formula
// bar and the cell editor (src/components/sheet/chrome/formulaInput.ts) and the formatting and
// editing actions behind the toolbar and the grid's shortcuts (chrome/actions.ts), on a real store.
//
//   npx tsx --tsconfig tsconfig.json scripts/check-sheet-chrome.ts
//
// Problems make the script exit with 1.
import type { Locale } from "@/i18n/config";
import { cellKey, parsePos } from "@/sheet/a1";
import { createCalc, formatValue, isError, tokenizeFormula, type FormulaToken } from "@/sheet/engine";
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
import { browseFunctions } from "@/components/sheet/chrome/FunctionBrowser";
import { formatFor, formatId } from "@/components/sheet/chrome/NumberFormatMenu";
import { sheetHasContent, sheetNameProblem } from "@/components/sheet/chrome/SheetTabs";
import { selectionStats } from "@/components/sheet/chrome/StatusBar";
import { toolbarLayout } from "@/components/sheet/chrome/Toolbar";
import { createSheetStore, type SheetStore } from "@/components/sheet/store";

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
  const all = toolbarLayout(1600, false);
  eq("wide: everything, with words on Tabelle and Diagramm", [all.shown.size, all.labels, all.compact], [16, true, false]);
  const laptop = toolbarLayout(1264, false);
  eq("1280 px laptop: everything", laptop.shown.size, 16);
  const tablet = toolbarLayout(1264, true);
  eq("Galaxy Tab landscape (touch): everything", tablet.shown.size, 16);
  const narrow = toolbarLayout(784, false);
  check("narrow: the most needed stay", ["history", "sum", "table", "chart", "format", "bold"].every((g) => narrow.shown.has(g as never)));
  check("narrow: some go into Mehr", narrow.shown.size < 16);
  const phone = toolbarLayout(374, true);
  eq("phone: undo, Σ, table, chart and the format icon", [...phone.shown].sort(), ["chart", "format", "history", "sum", "table"]);
  eq("phone: compact format button", phone.compact, true);
  let previous = 0;
  let grows = true;
  for (let w = 300; w <= 1700; w += 40) {
    const n = toolbarLayout(w, false).shown.size;
    if (n < previous) grows = false;
    previous = n;
  }
  check("never fewer tools on a wider bar", grows);
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
  eq("all", browseFunctions("", "all", "de").length, 175);
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

// ----------------------------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n${failures.length} of ${count} checks failed:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check-sheet-chrome: all ${count} checks passed.`);
