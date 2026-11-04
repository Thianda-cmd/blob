// Checks the spreadsheet engine (src/sheet/engine) and the workbook operations (src/sheet/ops.ts).
//
//   npm run check:sheet
//
// Formulas are checked against the values Excel gives (documentation examples, statistics tables,
// hand-worked lab examples), in German and English: localisation round trips, precedence, every
// function, criteria, dates, formats and typing, moving references, every operation on a workbook,
// long chains, circular references and timings. Problems make the script exit with 1.
import type { Locale } from "@/i18n/config";
import { cellKey, parsePos } from "@/sheet/a1";
import * as E from "@/sheet/engine";
import { FUNCTION_DOCS } from "@/sheet/engine/docs";
import * as O from "@/sheet/ops";
import { hiddenByFilters } from "@/sheet/table/filter";
import type { Cell, ChartSpec, NumberFormat, Sheet, TableSpec, Workbook } from "@/sheet/types";

// ----------------------------------------------------------------------------------------------
// Tiny test kit

let count = 0;
let current = "";
const failures: string[] = [];
const timings: string[] = [];
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
function err(name: string, actual: unknown, code: E.ErrorCode) {
  check(name, E.isError(actual) && actual.error === code, `got ${show(actual)}, expected ${code}`);
}

// ----------------------------------------------------------------------------------------------
// Building workbooks: cells in A1 notation, "=…" is a canonical formula

type CellInput = number | string | boolean | Cell;

function toCell(v: CellInput): Cell {
  if (typeof v === "object") return v;
  if (typeof v === "string" && v.startsWith("=")) return { f: v.slice(1) };
  return { v };
}

function mkSheet(id: string, name: string, cells: Record<string, CellInput> = {}, extra: Partial<Sheet> = {}): Sheet {
  const out: Record<string, Cell> = {};
  let rows = 200;
  let cols = 26;
  for (const [a1, v] of Object.entries(cells)) {
    const p = parsePos(a1);
    if (!p) throw new Error(`bad address ${a1}`);
    out[cellKey(p.row, p.col)] = toCell(v);
    rows = Math.max(rows, p.row + 1);
    cols = Math.max(cols, p.col + 1);
  }
  return { id, name, cells: out, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows, cols }, ...extra };
}

const book = (...sheets: Sheet[]): Workbook => ({ v: 1, sheets, charts: [], tables: [] });
const book1 = (cells: Record<string, CellInput> = {}) => book(mkSheet("s1", "Blatt 1", cells));

const NOW = new Date(2026, 10, 3, 14, 30, 0);
const calcOf = (wb: Workbook, locale: Locale = "de", opts: E.CalcOptions = {}) => E.createCalc(wb, { now: () => NOW, locale, ...opts });

/** The value of a canonical formula as if it were in Z100 of a sheet with these cells. */
function ev(formula: string, cells: Record<string, CellInput> = {}, locale: Locale = "de"): E.CellValue {
  const wb = book1({ ...cells, Z100: `=${formula}` });
  return calcOf(wb, locale).value("s1", 99, 25);
}
/** A formula typed in German / English. */
function de(local: string, cells: Record<string, CellInput> = {}): E.CellValue {
  const c = E.toCanonicalFormula(local, "de");
  if ("error" in c) return { error: "#NAME?", detail: `parse: ${c.error}` };
  return ev(c.formula, cells, "de");
}
function en(local: string, cells: Record<string, CellInput> = {}): E.CellValue {
  const c = E.toCanonicalFormula(local, "en");
  if ("error" in c) return { error: "#NAME?", detail: `parse: ${c.error}` };
  return ev(c.formula, cells, "en");
}
const val = (wb: Workbook, a1: string, sheetId = "s1", locale: Locale = "de") => {
  const p = parsePos(a1)!;
  return calcOf(wb, locale).value(sheetId, p.row, p.col);
};
const cellAt = (wb: Workbook, a1: string, sheetId = "s1") => {
  const p = parsePos(a1)!;
  return O.getCell(wb, sheetId, p.row, p.col);
};
const area = (text: string) => {
  const [a, b] = text.split(":");
  const p = parsePos(a)!;
  const q = parsePos(b ?? a)!;
  return { r0: p.row, c0: p.col, r1: q.row, c1: q.col };
};
const canon = (local: string, locale: Locale = "de") => {
  const r = E.toCanonicalFormula(local, locale);
  return "formula" in r ? r.formula : `ERROR@${r.at}: ${r.error}`;
};

// ==============================================================================================
section("function list");
{
  eq("every function in names.ts is implemented", E.missingFunctions(), []);
  for (const f of E.FUNCTION_NAMES) {
    const en = E.FUNCTION_BY_EN.get(f.de);
    // A German name that is also an English name must be the same function.
    if (en) check(`German ${f.de} doesn't clash with English ${en.en}`, en.en === f.en);
  }
}

// ==============================================================================================
section("localisation");
{
  eq("de → canonical", canon("SUMME(A1:B2;1,5)"), "SUM(A1:B2,1.5)");
  eq("canonical → de", E.toLocalFormula("SUM(A1:B2,1.5)", "de"), "SUMME(A1:B2;1,5)");
  eq("canonical → en", E.toLocalFormula("SUM(A1:B2,1.5)", "en"), "SUM(A1:B2,1.5)");
  eq("WENN round trip", canon('WENN(A1>0;"ja";"nein")'), 'IF(A1>0,"ja","nein")');
  eq("WENN back", E.toLocalFormula('IF(A1>0,"ja","nein")', "de"), 'WENN(A1>0;"ja";"nein")');
  eq("nested", canon("RUNDEN(MITTELWERT(B2:B6);2)"), "ROUND(AVERAGE(B2:B6),2)");
  eq("nested back", E.toLocalFormula("ROUND(AVERAGE(B2:B6),2)", "de"), "RUNDEN(MITTELWERT(B2:B6);2)");
  eq("umlaut names", canon("ZÄHLENWENN(A1:A9;\">5\")"), 'COUNTIF(A1:A9,">5")');
  eq("ß typed for SS", canon("kgrößte(A1:A9;2)"), "LARGE(A1:A9,2)");
  eq("dotted names", canon("STABW.S(A1:A3)+T.INV.2S(0,05;10)"), "STDEV.S(A1:A3)+T.INV.2T(0.05,10)");
  eq("dotted back", E.toLocalFormula("NORM.S.DIST(1.96,TRUE)", "de"), "NORM.S.VERT(1,96;WAHR)");
  eq("WAHR/FALSCH", canon("UND(WAHR;FALSCH)"), "AND(TRUE,FALSE)");
  eq("TRUE in German", canon("UND(TRUE;FALSE)"), "AND(TRUE,FALSE)");
  eq("WAHR() function", canon("WAHR()"), "TRUE()");
  eq("errors de → canonical", canon("WENNFEHLER(#NV;#WERT!)+#BEZUG!+#ZAHL!+#DIV/0!+#NAME?+#ZIRKEL!+#KALK!"), "IFERROR(#N/A,#VALUE!)+#REF!+#NUM!+#DIV/0!+#NAME?+#CIRC!+#CALC!");
  eq("errors back", E.toLocalFormula("#N/A+#VALUE!+#REF!+#NUM!+#CIRC!", "de"), "#NV+#WERT!+#BEZUG!+#ZAHL!+#ZIRKEL!");
  eq("English errors in German", canon("#N/A"), "#N/A");
  eq("English names in German", canon("SUM(A1;2)"), "SUM(A1,2)");
  eq("any case", canon("summe(a1:a3)"), "SUM(A1:A3)");
  eq("mixed case refs", canon("$a$1+b$2"), "$A$1+B$2");
  eq("German comma as separator after a ref", canon("SUMME(A1,A2)"), "SUM(A1,A2)");
  eq("German 1,5 is a number", canon("SUMME(1,5)"), "SUM(1.5)");
  eq("German forgiving 1.5", canon("1.5*2"), "1.5*2");
  eq("German ,5", canon("SUMME(,5;1)"), "SUM(.5,1)");
  eq("German comma after text", canon('WENN(A1>5,"a","b")'), 'IF(A1>5,"a","b")');
  eq("English semicolons", canon("SUM(A1;2)", "en"), "SUM(A1,2)");
  eq("English decimals", canon("ROUND(1.25,1)", "en"), "ROUND(1.25,1)");
  check("English rejects German names", canon("SUMME(A1)", "en").startsWith("ERROR"));
  eq("spaces kept", canon("SUMME( A1 ; 2 )"), "SUM( A1 , 2 )");
  eq("spaces kept back", E.toLocalFormula("SUM( A1 , 2 )", "de"), "SUMME( A1 ; 2 )");
  eq("sheet refs quoted", canon("'Blatt 2'!A1+Daten!B2:C3"), "'Blatt 2'!A1+Daten!B2:C3");
  eq("needless quotes dropped", canon("'Daten'!A1"), "Daten!A1");
  eq("quote in sheet name", canon("'It''s'!A1"), "'It''s'!A1");
  eq("sheet names keep their case", canon("'blatt 2'!a1"), "'blatt 2'!A1");
  eq("whole columns and rows", canon("SUMME(A:A;$B:$C;1:3)"), "SUM(A:A,$B:$C,1:3)");
  eq("reversed range normalised", canon("SUMME(B5:A1)"), "SUM(A1:B5)");
  eq("$ follows its part", canon("SUMME($B5:A$1)"), "SUM(A$1:$B5)");
  eq("array constant de", canon("SUMME({1.2;3.4})"), "SUM({1,2;3,4})");
  eq("array constant decimals de", canon("SUMME({1,5.2,5})"), "SUM({1.5,2.5})");
  eq("array constant back", E.toLocalFormula("SUM({1,2;3,4})", "de"), "SUMME({1.2;3.4})");
  eq("array constant en", canon("SUM({1,2;3,4})", "en"), "SUM({1,2;3,4})");
  eq("strings untouched", canon('"1,5;2"&"a""b"'), '"1,5;2"&"a""b"');
  eq("percent", canon("50%*2"), "50%*2");
  eq("exponent", canon("1,5E-3*2"), "1.5E-3*2");
  eq("exponent back", E.toLocalFormula("1.5E-3*2", "de"), "1,5E-3*2");
  eq("LOG10 is a function", canon("LOG10(100)"), "LOG10(100)");
  eq("Excel's _xlfn. prefix is understood", ev("_xlfn.STDEV.S(2,4,4,4,5,5,7,9)") as number > 2.13, true);
  eq("_xlfn. shown without it", E.toLocalFormula("_xlfn.STDEV.S(A1:A3)", "de"), "STABW.S(A1:A3)");
  eq("toFileFormula adds _xlfn.", E.toFileFormula("STDEV.S(A1:A3)+SUM(B1)+IFNA(XLOOKUP(1,A:A,B:B),0)"), "_xlfn.STDEV.S(A1:A3)+SUM(B1)+_xlfn.IFNA(_xlfn.XLOOKUP(1,A:A,B:B),0)");
  eq("fromFileFormula removes it", E.fromFileFormula("_xlfn.STDEV.S(A1:A3)+sum(B1)"), "STDEV.S(A1:A3)+SUM(B1)");
  eq("file round trip", E.fromFileFormula(E.toFileFormula("T.TEST(A1:A3,B1:B3,2,3)")), "T.TEST(A1:A3,B1:B3,2,3)");
  eq("ATAN2 is a function", canon("ARCTAN2(1;1)"), "ATAN2(1,1)");
  eq("empty arguments", canon("WENN(A1;;1)"), "IF(A1,,1)");
  eq("unicode minus? stays an error", canon("1+").startsWith("ERROR"), true);
  for (const f of ["SUMME(A1:A3)", 'WENN(UND(A1>1;B1<2);"x";"")', "SVERWEIS(A1;Daten!A:C;3;FALSCH)", "RGP(B2:B6;A2:A6;WAHR;WAHR)", "TEXT(A1;\"TT.MM.JJJJ\")", "MITTELWERT(A1:A5)*1,5%", "-A1^2", "{1.2;3.4}"]) {
    const c = canon(f);
    eq(`round trip ${f}`, E.toLocalFormula(c, "de"), f);
  }
  for (const c of ["SUM(.5,1)", "A1*.5", "{.5,1;2,.25}", "SUM(1,.5)", "-.5^2", "1.5E-3", ".5%"]) {
    const back = canon(E.toLocalFormula(c, "de"));
    eq(`canonical ${c} survives German`, ev(back), ev(c));
  }
  eq("German {1;,5}", canon("{1;,5}"), "{1;.5}");
  for (const f of ["SUM(A1:A3)", 'IF(AND(A1>1,B1<2),"x","")', "VLOOKUP(A1,Data!A:C,3,FALSE)", "LINEST(B2:B6,A2:A6,TRUE,TRUE)", "AVERAGE(A1:A5)*1.5%"]) {
    eq(`round trip en ${f}`, E.toLocalFormula(canon(f, "en"), "en"), f);
  }
}

// ==============================================================================================
section("formulas typed in each language");
{
  eq("German", de("SUMME(A1:A3;1,5)", { A1: 1, A2: 2, A3: 3 }), 7.5);
  eq("English", en("SUM(A1:A3,1.5)", { A1: 1, A2: 2, A3: 3 }), 7.5);
  eq("English with semicolons", en("SUM(A1:A3;1.5)", { A1: 1, A2: 2, A3: 3 }), 7.5);
  eq("German MITTELWERT", de("MITTELWERT(A1:A3)", { A1: 1, A2: 2, A3: 3 }), 2);
  eq("German WENN with text", de('WENN(A1>1;"groß";"klein")', { A1: 2 }), "groß");
  eq("English IF", en('IF(A1>1,"big","small")', { A1: 0 }), "small");
  eq("German RUNDEN", de("RUNDEN(2,675;2)"), 2.68);
  eq("English ROUND", en("ROUND(2.675,2)"), 2.68);
  eq("German STABW.S", de("RUNDEN(STABW.S(2;4;4;4;5;5;7;9);4)"), 2.1381);
  eq("English names work in German", de("ROUND(SUM(1,5;2,5);0)"), 4);
  eq("German percent", de("200*5%"), 10);
  eq("German array", de("SUMME({1.2;3.4})"), 10);
  eq("English array", en("SUM({1,2;3,4})"), 10);
  eq("German TEXT", de('TEXT(0,5;"0,0%")'), "50,0%");
  eq("English TEXT", en('TEXT(0.5,"0.0%")'), "50.0%");
}

// ==============================================================================================
section("random formulas survive translation");
{
  let seed = 20261103;
  const rnd = () => {
    // mulberry32: a small PRNG that stays exact in 32-bit integer arithmetic
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
  const atoms = ["1", "42", "1.25", "0.5", "1E-3", "2.5E+2", '"a,b;c"', '"x""y"', '""', "TRUE", "FALSE", "#N/A", "#DIV/0!", "#VALUE!", "B3", "$C$4", "A$1", "$D2", "A1:B5", "$A$1:C$9", "Daten!A1", "'Blatt 2'!C3:D4", "A:A", "$B:C", "2:3", "{1,2;3,4}", "{1.5,\"t\";TRUE,-2}"];
  const ops = ["+", "-", "*", "/", "^", "&", "=", "<>", "<", ">", "<=", ">="];
  const fns = E.FUNCTION_NAMES.map((f) => f.en);
  const gen = (depth: number): string => {
    const k = rnd();
    if (depth > 3 || k < 0.35) return pick(atoms);
    if (k < 0.55) return `${gen(depth + 1)}${pick(ops)}${gen(depth + 1)}`;
    if (k < 0.62) return `(${gen(depth + 1)})`;
    if (k < 0.67) return `-${pick(atoms)}`;
    if (k < 0.72) return `${pick(atoms)}%`;
    const name = pick(fns);
    const def = E.getFunction(name)!;
    const n = Math.min(def.max, def.min + Math.floor(rnd() * 3));
    return `${name}(${Array.from({ length: n }, () => gen(depth + 1)).join(",")})`;
  };
  let bad = 0;
  for (let i = 0; i < 400; i++) {
    const c = gen(0);
    for (const locale of ["de", "en"] as Locale[]) {
      const local = E.toLocalFormula(c, locale);
      const back = E.toCanonicalFormula(local, locale);
      const ok = "formula" in back && back.formula === c;
      if (!ok && bad++ < 5) check(`round trip ${locale}: ${c} → ${local}`, false, show(back));
      const joined = E.tokenizeFormula(local, locale).map((t) => t.text).join("");
      if (joined !== local && bad++ < 5) check(`tokens give back ${local}`, false, joined);
    }
    const shifted = E.shiftFormula(c, 3, 2);
    if (!shifted.includes("#REF!") && E.shiftFormula(shifted, -3, -2) !== c && bad++ < 5) check(`shift there and back: ${c}`, false, shifted);
    const once = calcOf(book1({ B3: 2, C4: 3, A1: 1 })).evaluate(c, { sheetId: "s1", row: 50, col: 10 });
    const internal = E.isError(once) && once.detail === "internal";
    if (internal && bad++ < 10) check(`no internal error: ${c}`, false);
    check(`evaluates: ${c.slice(0, 40)}`, once !== undefined);
  }
  check(`400 random formulas round-trip in German and English (${bad} problems)`, bad === 0);
}

// ==============================================================================================
section("syntax errors");
{
  const e1 = E.toCanonicalFormula("SUMME(A1;2", "de");
  check("unclosed parenthesis", "error" in e1 && e1.error.includes("schließende Klammer") && e1.at === 10, show(e1));
  const e2 = E.toCanonicalFormula("SUM(A1", "en");
  check("unclosed parenthesis (en)", "error" in e2 && e2.error.includes("closing bracket"), show(e2));
  const e3 = E.toCanonicalFormula("SUMM(A1)", "de");
  check("unknown function with suggestion", "error" in e3 && e3.error.includes("SUMM") && e3.error.includes("SUMME") && e3.at === 0, show(e3));
  const e4 = E.toCanonicalFormula("A1+", "de");
  check("trailing operator", "error" in e4 && e4.error.includes("„+“") && e4.at === 2, show(e4));
  const e5 = E.toCanonicalFormula("A1 B1", "de");
  check("missing operator", "error" in e5 && e5.at === 3, show(e5));
  const e6 = E.toCanonicalFormula("", "de");
  check("empty", "error" in e6, show(e6));
  const e7 = E.toCanonicalFormula('"abc', "de");
  check("unterminated string", "error" in e7 && e7.error.includes("Anführungszeichen"), show(e7));
  const e8 = E.toCanonicalFormula("WENN(1;2;3;4)", "de");
  check("too many arguments", "error" in e8 && e8.error.includes("höchstens 3"), show(e8));
  const e9 = E.toCanonicalFormula("RUNDEN(1)", "de");
  check("too few arguments", "error" in e9 && e9.error.includes("mindestens 2"), show(e9));
  const e10 = E.toCanonicalFormula("Preis*2", "de");
  check("unknown name", "error" in e10 && e10.error.includes("Preis") && e10.error.includes("Anführungszeichen"), show(e10));
  const e11 = E.toCanonicalFormula("A1)", "de");
  check("unexpected )", "error" in e11 && e11.at === 2, show(e11));
  const e12 = E.toCanonicalFormula("A1 § 2", "de");
  check("bad character", "error" in e12 && e12.error.includes("§"), show(e12));
  const e13 = E.toCanonicalFormula("Blatt2!", "de");
  check("sheet without cell", "error" in e13, show(e13));
  const e14 = E.toCanonicalFormula("{1;A1}", "de");
  check("reference in array constant", "error" in e14, show(e14));
  const e15 = E.toCanonicalFormula("(1+2", "de");
  check("unclosed bracket", "error" in e15 && e15.at === 4, show(e15));
  const e16 = E.toCanonicalFormula("*2", "de");
  check("leading operator", "error" in e16, show(e16));
  const e17 = E.toCanonicalFormula("1.000*2", "de");
  check("German thousands dot is refused, not misread", "error" in e17 && e17.error.includes("Tausender") && e17.at === 0, show(e17));
  const e18 = E.toCanonicalFormula("A1*1.234,5", "de");
  check("German 1.234,5 in a formula", "error" in e18 && e18.at === 3, show(e18));
  eq("German 1.25 still forgiven", canon("1.25*2"), "1.25*2");
  const e19 = E.toCanonicalFormula("Blatt 2!A1*2", "de");
  check("sheet name with spaces needs quotes", "error" in e19 && e19.error.includes("'Blatt 2'!") && e19.at === 0, show(e19));
  const e20 = E.toCanonicalFormula("SUMME(Meine Daten!A1:A3)", "de");
  check("…inside a function too", "error" in e20 && e20.error.includes("'Meine Daten'!") && e20.at === 6, show(e20));
  const deep = E.toCanonicalFormula("(".repeat(20000) + "1" + ")".repeat(20000), "de");
  check("absurd nesting is an error, not a crash", "error" in deep, show(deep).slice(0, 80));
  const many = Array.from({ length: 3000 }, (_, i) => `A${i + 1}`).join("+");
  eq("3,000 terms", ev(many, { A1: 1, A3000: 2 }), 3);
  const p = E.parseInput("=SUMME(A1;", "de");
  check("parseInput reports the error position after =", !!p.error && p.error.at === 10, show(p));
}

// ==============================================================================================
section("tokens for the editor");
{
  const t1 = E.tokenizeFormula("SUMME(A1:A", "de");
  eq("unfinished range", t1.map((t) => `${t.kind}:${t.text}`), ["function:SUMME", "paren:(", "ref:A1", "operator::", "name:A"]);
  eq("function canonical name", t1[0].fn, "SUM");
  eq("positions", t1.map((t) => [t.start, t.end]), [[0, 5], [5, 6], [6, 8], [8, 9], [9, 10]]);
  const t2 = E.tokenizeFormula("WENN(", "de");
  eq("open call", t2.map((t) => t.kind), ["function", "paren"]);
  const t3 = E.tokenizeFormula("MITTELWERT(B2:B6; 'Blatt 2'!C1)", "de");
  const refs = t3.filter((t) => t.kind === "ref");
  eq("refs found", refs.map((t) => t.text), ["B2:B6", "'Blatt 2'!C1"]);
  eq("ref area", refs[0].ref, { sheet: null, area: { r0: 1, c0: 1, r1: 5, c1: 1 } });
  eq("ref sheet", refs[1].ref?.sheet, "Blatt 2");
  eq("separator and space", t3.filter((t) => t.kind === "separator" || t.kind === "space").map((t) => t.text), [";", " "]);
  const t4 = E.tokenizeFormula('A1&"Text', "de");
  eq("unterminated string still a token", t4.map((t) => t.kind), ["ref", "operator", "string"]);
  const t5 = E.tokenizeFormula("SUMME(A:A)", "de");
  eq("whole column", t5[2].ref, { sheet: null, area: { r0: 0, c0: 0, r1: 19999, c1: 0 }, whole: "cols" });
  const joined = E.tokenizeFormula("WENN(A1>1,5;\"x\" ; 'B 2'!$C$3)", "de").map((t) => t.text).join("");
  eq("tokens give the text back", joined, "WENN(A1>1,5;\"x\" ; 'B 2'!$C$3)");
  eq("formulaRefs", E.formulaRefs("SUM(A1:B2)+Data!C3+SUM(D:D)"), [
    { sheet: null, area: { r0: 0, c0: 0, r1: 1, c1: 1 } },
    { sheet: "Data", area: { r0: 2, c0: 2, r1: 2, c1: 2 } },
    { sheet: null, area: { r0: 0, c0: 3, r1: 19999, c1: 3 }, whole: "cols" },
  ]);
  eq("unknown function token", E.tokenizeFormula("FOO(1)", "de")[0], { kind: "function", text: "FOO", start: 0, end: 3 });
  eq("bool token", E.tokenizeFormula("WAHR", "de")[0].kind, "bool");
  eq("error token", E.tokenizeFormula("#NV", "de")[0].kind, "error");
}

// ==============================================================================================
section("operators and precedence");
{
  eq("-2^2 = 4 (Excel)", ev("-2^2"), 4);
  eq("2^3^2 = 64 (left to right)", ev("2^3^2"), 64);
  eq("2+3*4", ev("2+3*4"), 14);
  eq("(2+3)*4", ev("(2+3)*4"), 20);
  eq("10/2/5", ev("10/2/5"), 1);
  eq("2^-1", ev("2^-1"), 0.5);
  eq("2*-3", ev("2*-3"), -6);
  eq("--3", ev("--3"), 3);
  eq("50%*2", ev("50%*2"), 1);
  eq("-50%", ev("-50%"), -0.5);
  eq("percent before power: 10%^2", ev("10%^2"), 0.010000000000000002);
  eq("& after +", ev('"a"&1+2'), "a3");
  eq("comparison last", ev("1+2=3"), true);
  eq("comparisons left to right", ev("1<2=TRUE"), true);
  eq("3-2-1", ev("3-2-1"), 0);
  eq("0.1+0.2=0.3", ev("0.1+0.2=0.3"), true);
  eq("0.3-0.2-0.1 = 0", ev("0.3-0.2-0.1"), 0);
  eq("unary plus keeps text", ev('+"abc"'), "abc");
  err("division by zero", ev("1/0"), "#DIV/0!");
  err("division by empty", ev("1/A1"), "#DIV/0!");
  err("0^0", ev("0^0"), "#NUM!");
  err("0^-1", ev("0^-1"), "#DIV/0!");
  err("(-8)^(1/3)", ev("(-8)^(1/3)"), "#NUM!");
  err("overflow", ev("10^400"), "#NUM!");
  eq("<>", ev("1<>2"), true);
  eq("<=", ev("2<=2"), true);
  eq(">=", ev("1>=2"), false);
  eq("text compare ignores case", ev('"abc"="ABC"'), true);
  eq("text order", ev('"apfel"<"Birne"'), true);
  eq("umlauts sort like German", ev('"Äpfel"<"Birne"'), true);
  eq("numbers before text", ev('5<"a"'), true);
  eq("text before booleans", ev('"z"<FALSE'), true);
  eq("FALSE < TRUE", ev("FALSE<TRUE"), true);
  eq("empty = 0", ev("A1=0"), true);
  eq('empty = ""', ev('A1=""'), true);
  eq("empty = FALSE", ev("A1=FALSE"), true);
  eq("number vs text never equal", ev('1="1"'), false);
  err("errors propagate left first", ev("NA()+1/0"), "#N/A");
  err("errors propagate through &", ev('"x"&1/0'), "#DIV/0!");
  err("errors in comparisons", ev("1/0=1"), "#DIV/0!");
  eq("formula of an empty cell shows 0", ev("A1"), 0);
  eq("range in a cell shows its top-left", ev("A1:A3", { A1: 7, A2: 8 }), 7);
  eq("array arithmetic top-left", ev("A1:A3*2", { A1: 7, A2: 8 }), 14);
  eq("array constant top-left", ev("{5,6;7,8}"), 5);
  eq("range operator with INDEX", ev("SUM(A1:INDEX(A1:A5,3))", { A1: 1, A2: 2, A3: 3, A4: 4 }), 6);
}

// ==============================================================================================
section("values and conversions");
{
  eq('"3"+1 = 4', ev('"3"+1'), 4);
  err('"abc"+1 = #VALUE!', ev('"abc"+1'), "#VALUE!");
  eq("TRUE+1 = 2", ev("TRUE+1"), 2);
  eq("German text number", ev('"1,5"+1', {}, "de"), 2.5);
  eq("English text number", ev('"1.5"+1', {}, "en"), 2.5);
  eq("text percent", ev('"50%"*2'), 1);
  eq("text date", ev('"1.11.2026"+0'), 46327);
  eq("text time", ev('"12:00"*2'), 1);
  err('"TRUE"+0 stays text', ev('"TRUE"+0'), "#VALUE!");
  eq("number to text de", ev('"Wert: "&1.5', {}, "de"), "Wert: 1,5");
  eq("number to text en", ev('"Value: "&1.5', {}, "en"), "Value: 1.5");
  eq("1/3 as text has 15 digits", ev('""&1/3', {}, "en"), "0.333333333333333");
  eq("big numbers as text", ev('""&1E+21', {}, "en"), "1E+21");
  eq("small numbers as text", ev('""&0.0000001', {}, "en"), "1E-07");
  eq("integers as text", ev('""&123456789', {}, "en"), "123456789");
  eq("TRUE as text de", ev('""&TRUE', {}, "de"), "WAHR");
  eq("TRUE as text en", ev('""&TRUE', {}, "en"), "TRUE");
  eq("empty as text", ev('"x"&A1'), "x");
  eq("cell text", ev("A1&B1", { A1: "Kalibrier", B1: "gerade" }), "Kalibriergerade");
}

// ==============================================================================================
section("math");
{
  const nums = { A1: 1, A2: 2, A3: 3, A4: "Text", A5: true, B1: 4, B2: 5, B3: 6 };
  eq("SUM skips text and TRUE in ranges", ev("SUM(A1:A5)", nums), 6);
  eq("SUM counts direct TRUE and text numbers", ev('SUM(1,TRUE,"2")'), 4);
  err("SUM direct text", ev('SUM(1,"abc")'), "#VALUE!");
  err("SUM propagates errors in ranges", ev("SUM(A1:A2)", { A1: 1, A2: "=1/0" }), "#DIV/0!");
  eq("SUM whole column", ev("SUM(A:A)", nums), 6);
  eq("SUM several ranges", ev("SUM(A1:A3,B1:B3,10)", nums), 31);
  eq("SUM single text cell is skipped", ev("SUM(A4)", nums), 0);
  eq("SUM missing argument", ev("SUM(1,,2)"), 3);
  eq("SUMSQ", ev("SUMSQ(3,4)"), 25);
  eq("PRODUCT", ev("PRODUCT(2,3,4)"), 24);
  eq("PRODUCT of nothing", ev("PRODUCT(A10:A12)"), 0);
  eq("SUMPRODUCT", ev("SUMPRODUCT({1,2,3},{4,5,6})"), 32);
  eq("SUMPRODUCT ranges", ev("SUMPRODUCT(A1:A3,B1:B3)", nums), 32);
  eq("SUMPRODUCT with conditions", ev("SUMPRODUCT((A1:A3>1)*(B1:B3))", nums), 11);
  eq("SUMPRODUCT text counts 0", ev("SUMPRODUCT(A3:A4,B2:B3)", nums), 15);
  err("SUMPRODUCT size mismatch", ev("SUMPRODUCT(A1:A3,B1:B2)", nums), "#VALUE!");
  eq("ROUND 2.675", ev("ROUND(2.675,2)"), 2.68);
  eq("ROUND 1.005", ev("ROUND(1.005,2)"), 1.01);
  eq("ROUND half away from zero", ev("ROUND(-2.5,0)"), -3);
  eq("ROUND negative digits", ev("ROUND(1234.5678,-2)"), 1200);
  eq("ROUND 0.5", ev("ROUND(0.5,0)"), 1);
  eq("ROUNDUP", ev("ROUNDUP(3.2,0)"), 4);
  eq("ROUNDUP negative", ev("ROUNDUP(-3.2,0)"), -4);
  eq("ROUNDUP 0.1+0.2", ev("ROUNDUP(0.1+0.2,1)"), 0.3);
  eq("ROUNDDOWN", ev("ROUNDDOWN(3.7,0)"), 3);
  eq("ROUNDDOWN negative", ev("ROUNDDOWN(-3.7,0)"), -3);
  eq("ROUNDDOWN digits", ev("ROUNDDOWN(3.14159,3)"), 3.141);
  eq("MROUND", ev("MROUND(10,3)"), 9);
  eq("MROUND negative", ev("MROUND(-10,-3)"), -9);
  eq("MROUND decimals", ev("MROUND(1.3,0.2)"), 1.4);
  err("MROUND signs", ev("MROUND(5,-2)"), "#NUM!");
  eq("INT", ev("INT(-8.9)"), -9);
  eq("TRUNC", ev("TRUNC(-8.9)"), -8);
  eq("TRUNC digits", ev("TRUNC(8.987,2)"), 8.98);
  eq("CEILING", ev("CEILING(2.5,1)"), 3);
  eq("CEILING negative both", ev("CEILING(-2.5,-2)"), -4);
  eq("CEILING negative number", ev("CEILING(-2.5,2)"), -2);
  eq("CEILING 0.234", ev("CEILING(0.234,0.01)"), 0.24);
  eq("CEILING exact multiple", ev("CEILING(1.5,0.1)"), 1.5);
  err("CEILING signs", ev("CEILING(2.5,-2)"), "#NUM!");
  eq("FLOOR", ev("FLOOR(3.7,2)"), 2);
  eq("FLOOR negative both", ev("FLOOR(-2.5,-2)"), -2);
  eq("FLOOR negative number", ev("FLOOR(-2.5,2)"), -4);
  eq("FLOOR 0.6/0.2", ev("FLOOR(0.6,0.2)"), 0.6);
  eq("FLOOR 1.58", ev("FLOOR(1.58,0.1)"), 1.5);
  err("FLOOR by 0", ev("FLOOR(2,0)"), "#DIV/0!");
  eq("EVEN", [ev("EVEN(1.5)"), ev("EVEN(3)"), ev("EVEN(-1)"), ev("EVEN(0)")], [2, 4, -2, 0]);
  eq("ODD", [ev("ODD(1.5)"), ev("ODD(3)"), ev("ODD(2)"), ev("ODD(-1)"), ev("ODD(0)")], [3, 3, 3, -1, 1]);
  eq("ABS", ev("ABS(-3)"), 3);
  eq("SIGN", [ev("SIGN(-0.5)"), ev("SIGN(0)"), ev("SIGN(7)")], [-1, 0, 1]);
  eq("SQRT", ev("SQRT(16)"), 4);
  err("SQRT negative", ev("SQRT(-1)"), "#NUM!");
  eq("POWER", ev("POWER(2,10)"), 1024);
  near("EXP", ev("EXP(1)"), Math.E);
  near("LN", ev("LN(EXP(2))"), 2);
  err("LN 0", ev("LN(0)"), "#NUM!");
  eq("LOG default 10", ev("LOG(100)"), 2);
  near("LOG base 2", ev("LOG(8,2)"), 3);
  err("LOG base 1", ev("LOG(10,1)"), "#DIV/0!");
  eq("LOG10", ev("LOG10(1000)"), 3);
  near("PI", ev("PI()"), Math.PI);
  eq("MOD", ev("MOD(10,3)"), 1);
  eq("MOD negative number", ev("MOD(-3,2)"), 1);
  eq("MOD negative divisor", ev("MOD(3,-2)"), -1);
  eq("MOD decimals", ev("MOD(0.3,0.1)"), 0);
  eq("MOD 5.5", ev("MOD(5.5,2)"), 1.5);
  err("MOD by 0", ev("MOD(5,0)"), "#DIV/0!");
  eq("QUOTIENT", ev("QUOTIENT(-10,3)"), -3);
  eq("GCD", ev("GCD(24,36)"), 12);
  eq("GCD range", ev("GCD(A1:A2)", { A1: 12, A2: 18 }), 6);
  eq("LCM", ev("LCM(4,6)"), 12);
  eq("FACT", [ev("FACT(5)"), ev("FACT(0)"), ev("FACT(5.9)")], [120, 1, 120]);
  err("FACT negative", ev("FACT(-1)"), "#NUM!");
  eq("COMBIN", ev("COMBIN(8,2)"), 28);
  eq("COMBIN big", ev("COMBIN(49,6)"), 13983816);
  err("COMBIN k > n", ev("COMBIN(2,3)"), "#NUM!");
  const r = ev("RAND()");
  check("RAND in [0,1)", typeof r === "number" && r >= 0 && r < 1, show(r));
  eq("RANDBETWEEN(1,1)", ev("RANDBETWEEN(1,1)"), 1);
  const rb = ev("RANDBETWEEN(1,6)");
  check("RANDBETWEEN whole number in range", typeof rb === "number" && Number.isInteger(rb) && rb >= 1 && rb <= 6, show(rb));
  err("RANDBETWEEN reversed", ev("RANDBETWEEN(5,1)"), "#NUM!");
  near("DEGREES", ev("DEGREES(PI())"), 180);
  near("RADIANS", ev("RADIANS(180)"), Math.PI);
  near("SIN", ev("SIN(PI()/2)"), 1);
  near("COS", ev("COS(0)"), 1);
  near("TAN", ev("TAN(PI()/4)"), 1);
  near("ASIN", ev("ASIN(1)"), Math.PI / 2);
  near("ACOS", ev("ACOS(0)"), Math.PI / 2);
  near("ATAN", ev("ATAN(1)"), Math.PI / 4);
  near("ATAN2 (x, y)", ev("ATAN2(1,1)"), Math.PI / 4);
  near("ATAN2 order", ev("ATAN2(-1,0)"), Math.PI);
  err("ATAN2 0,0", ev("ATAN2(0,0)"), "#DIV/0!");
  err("ASIN out of range", ev("ASIN(2)"), "#NUM!");
  eq("lifted over arrays", ev("SUM(ABS({-1,-2,3}))"), 6);
  eq("lifted ROUND in SUMPRODUCT", ev("SUMPRODUCT(ROUND(A1:A2,0))", { A1: 1.4, A2: 2.6 }), 4);
}

// ==============================================================================================
section("statistics");
{
  const data = { A1: 1345, A2: 1301, A3: 1368, A4: 1322, A5: 1310, A6: 1370, A7: 1318, A8: 1350, A9: 1303, A10: 1299 };
  near("STDEV.S (Excel example)", ev("STDEV.S(A1:A10)", data), 27.46391572, 1e-9);
  near("STDEV.P", ev("STDEV.P(A1:A10)", data), 26.05455814, 1e-9);
  near("STDEV", ev("STDEV(A1:A10)", data), 27.46391572, 1e-9);
  near("STDEVP", ev("STDEVP(A1:A10)", data), 26.05455814, 1e-9);
  near("VAR.S", ev("VAR.S(A1:A10)", data), 754.2666666666667);
  near("VAR.P", ev("VAR.P(A1:A10)", data), 678.84);
  near("VAR", ev("VAR(A1:A10)", data), 754.2666666666667);
  near("VARP", ev("VARP(A1:A10)", data), 678.84);
  err("STDEV.S of one value", ev("STDEV.S(5)"), "#DIV/0!");
  const mixed = { A1: 10, A2: 20, A3: "x", A4: true, B1: 4 };
  eq("AVERAGE ignores text, TRUE and empty", ev("AVERAGE(A1:A5)", mixed), 15);
  eq("AVERAGE direct values", ev("AVERAGE(1,2,TRUE)"), 4 / 3);
  err("AVERAGE of nothing", ev("AVERAGE(A10:A12)"), "#DIV/0!");
  eq("AVERAGEA counts text as 0 and TRUE as 1", ev("AVERAGEA(A1:A4)", mixed), 31 / 4);
  eq("MEDIAN even", ev("MEDIAN(1,2,3,4,5,6)"), 3.5);
  eq("MEDIAN odd", ev("MEDIAN(5,1,3)"), 3);
  eq("MODE.SNGL", ev("MODE.SNGL(5.6,4,4,3,2,4)"), 4);
  eq("MODE.SNGL first of equals", ev("MODE.SNGL(1,2,2,1)"), 1);
  err("MODE.SNGL no repeats", ev("MODE.SNGL(1,2,3)"), "#N/A");
  eq("MIN/MAX", [ev("MIN(A1:A5)", mixed), ev("MAX(A1:A5)", mixed)], [10, 20]);
  eq("MAX of nothing", ev("MAX(A10:A12)"), 0);
  eq("COUNT", ev("COUNT(A1:A5)", mixed), 2);
  eq("COUNT direct", ev('COUNT(1,"2","x",TRUE)'), 3);
  eq("COUNT errors don't count", ev("COUNT(A1:A2)", { A1: "=1/0", A2: 3 }), 1);
  eq("COUNTA", ev("COUNTA(A1:A5)", mixed), 4);
  eq('COUNTA counts ""', ev("COUNTA(A1:A2)", { A1: '=""' }), 1);
  eq("COUNTBLANK", ev("COUNTBLANK(A1:A5)", { ...mixed, A5: '=""' }), 1);
  near("AVEDEV", ev("AVEDEV(4,5,6,7,5,4,3)"), 1.020408163, 1e-9);
  eq("DEVSQ", ev("DEVSQ(4,5,8,7,11,4,3)"), 48);
  near("GEOMEAN", ev("GEOMEAN(4,5,8,7,11,4,3)"), 5.476986969, 1e-9);
  near("HARMEAN", ev("HARMEAN(4,5,8,7,11,4,3)"), 5.028375962, 1e-9);
  err("GEOMEAN non-positive", ev("GEOMEAN(1,0)"), "#NUM!");
  near("KURT", ev("KURT(3,4,5,2,3,4,5,6,4,7)"), -0.151799637, 1e-8);
  near("SKEW", ev("SKEW(3,4,5,2,3,4,5,6,4,7)"), 0.359543071, 1e-8);
  err("KURT too few", ev("KURT(1,2,3)"), "#DIV/0!");
  const lg = { A1: 3, A2: 5, A3: 3, A4: 5, A5: 4, B1: 4, B2: 2, B3: 4, B4: 6, B5: 7 };
  eq("LARGE 3rd", ev("LARGE(A1:B5,3)", lg), 5);
  eq("LARGE 7th", ev("LARGE(A1:B5,7)", lg), 4);
  eq("SMALL", ev("SMALL({3,4,5,2,3,4,6,4,7},4)"), 4);
  err("LARGE k too big", ev("LARGE(A1:B5,11)", lg), "#NUM!");
  near("PERCENTILE.INC", ev("PERCENTILE.INC({1,3,2,4},0.3)"), 1.9);
  err("PERCENTILE.INC k > 1", ev("PERCENTILE.INC({1,2},1.5)"), "#NUM!");
  eq("QUARTILE.INC", ev("QUARTILE.INC({1,2,4,7,8,9,10,12},1)"), 3.5);
  eq("QUARTILE.INC 0 and 4", [ev("QUARTILE.INC({3,1,2},0)"), ev("QUARTILE.INC({3,1,2},4)")], [1, 3]);
  const rk = { A1: 7, A2: 3.5, A3: 3.5, A4: 1, A5: 2 };
  eq("RANK.EQ ascending", ev("RANK.EQ(A1,A1:A5,1)", rk), 5);
  eq("RANK.EQ ties", ev("RANK.EQ(A2,A1:A5,1)", rk), 3);
  eq("RANK.EQ descending", ev("RANK.EQ(A5,A1:A5)", rk), 4);
  err("RANK.EQ missing", ev("RANK.EQ(9,A1:A5)", rk), "#N/A");
  near("STANDARDIZE", ev("STANDARDIZE(42,40,1.5)"), 1.333333333, 1e-9);
  near("CORREL", ev("CORREL({3,2,4,5,6},{9,7,12,15,17})"), 0.997054486, 1e-9);
  near("PEARSON", ev("PEARSON({9,7,5,3,1},{10,6,1,5,3})"), 0.699379, 1e-6);
  near("COVARIANCE.P", ev("COVARIANCE.P({3,2,4,5,6},{9,7,12,15,17})"), 5.2);
  near("COVARIANCE.S", ev("COVARIANCE.S({2,4,8},{5,11,12})"), 9.666666667, 1e-9);
  err("CORREL constant", ev("CORREL({1,1,1},{1,2,3})"), "#DIV/0!");
  err("CORREL sizes", ev("CORREL({1,2,3},{1,2})"), "#N/A");
  eq("CORREL skips text pairs", ev("CORREL(A1:A4,B1:B4)", { A1: 1, A2: 2, A3: "x", A4: 3, B1: 2, B2: 4, B3: 100, B4: 6 }), 1);
}

// ==============================================================================================
section("distributions");
{
  near("NORM.DIST cumulative (Excel example)", ev("NORM.DIST(42,40,1.5,TRUE)"), 0.9087887802741321, 1e-12);
  near("NORM.DIST density", ev("NORM.DIST(42,40,1.5,FALSE)"), 0.10934004978399577, 1e-12);
  near("NORM.INV", ev("NORM.INV(0.908789,40,1.5)"), 42.000002, 1e-7);
  near("NORM.S.DIST 1.96", ev("NORM.S.DIST(1.96,TRUE)"), 0.9750021048517795, 1e-13);
  near("NORM.S.DIST -3", ev("NORM.S.DIST(-3,TRUE)"), 0.0013498980316301, 1e-12);
  near("NORM.S.DIST far tail", ev("NORM.S.DIST(-8,TRUE)"), 6.22096057427178e-16, 1e-9);
  near("NORM.S.DIST density 0", ev("NORM.S.DIST(0,FALSE)"), 0.3989422804014327, 1e-14);
  near("NORM.S.DIST 1.333333", ev("NORM.S.DIST(1.333333,TRUE)"), 0.908788726, 1e-9);
  near("NORM.S.INV 0.975", ev("NORM.S.INV(0.975)"), 1.959963984540054, 1e-12);
  near("NORM.S.INV 0.05", ev("NORM.S.INV(0.05)"), -1.6448536269514729, 1e-12);
  near("NORM.S.INV tail", ev("NORM.S.INV(0.000000001)"), -5.997807015007686, 1e-10);
  eq("NORM.S.INV 0.5", ev("NORM.S.INV(0.5)"), 0);
  err("NORM.S.INV 0", ev("NORM.S.INV(0)"), "#NUM!");
  err("NORM.DIST sd 0", ev("NORM.DIST(1,0,0,TRUE)"), "#NUM!");
  near("T.DIST Cauchy", ev("T.DIST(1,1,TRUE)"), 0.75, 1e-13);
  near("T.DIST df 2", ev("T.DIST(1,2,TRUE)"), 0.7886751345948129, 1e-13);
  near("T.DIST df 8 (closed form)", ev("T.DIST(2,8,TRUE)"), 0.9597418810213687, 1e-12);
  near("T.DIST (Excel example)", ev("T.DIST(60,1,TRUE)"), 0.99469533, 1e-8);
  near("T.DIST density (Excel example)", ev("T.DIST(8,3,FALSE)"), 0.000736906, 1e-6);
  near("T.DIST density df 1", ev("T.DIST(1,1,FALSE)"), 0.15915494309189535, 1e-13);
  near("T.DIST density df 2", ev("T.DIST(1,2,FALSE)"), 0.19245008972987526, 1e-13);
  near("T.DIST.2T (Excel example)", ev("T.DIST.2T(1.959999998,60)"), 0.054645, 1e-5);
  near("T.DIST.2T df 8", ev("T.DIST.2T(2,8)"), 0.0805162379572626, 1e-12);
  err("T.DIST.2T negative", ev("T.DIST.2T(-1,5)"), "#NUM!");
  err("T.DIST df 0", ev("T.DIST(1,0,TRUE)"), "#NUM!");
  near("T.INV (Excel example)", ev("T.INV(0.75,2)"), 0.8164965809277261, 1e-12);
  near("T.INV 0.975 df 1", ev("T.INV(0.975,1)"), 12.706204736174698, 1e-11);
  near("T.INV 0.95 df 30 (checked by numerical integration)", ev("T.INV(0.95,30)"), 1.6972608865939618, 1e-11);
  near("T.INV lower tail", ev("T.INV(0.05,30)"), -1.6972608865939618, 1e-11);
  near("T.INV.2T 0.05 df 10", ev("T.INV.2T(0.05,10)"), 2.2281388519649385, 1e-11);
  near("T.INV.2T 0.05 df 5", ev("T.INV.2T(0.05,5)"), 2.5705818356363146, 1e-11);
  near("T.INV.2T 0.01 df 10", ev("T.INV.2T(0.01,10)"), 3.169272672616954, 1e-10);
  near("T.INV.2T (Excel example)", ev("T.INV.2T(0.546449,60)"), 0.606533, 1e-6);
  near("T.INV.2T huge df ≈ normal", ev("T.INV.2T(0.05,100000)"), 1.9600, 1e-4);
  near("T.INV inverts T.DIST", ev("T.INV(T.DIST(1.234,7,TRUE),7)"), 1.234, 1e-11);
  eq("T.INV.2T 1", ev("T.INV.2T(1,5)"), 0);
  err("T.INV 1", ev("T.INV(1,5)"), "#NUM!");
  near("CONFIDENCE.NORM (Excel example)", ev("CONFIDENCE.NORM(0.05,2.5,50)"), 0.6929519121748391, 1e-12);
  near("CONFIDENCE.T (Excel example)", ev("CONFIDENCE.T(0.05,1,50)"), 0.284196855, 1e-9);
  err("CONFIDENCE.T n=1", ev("CONFIDENCE.T(0.05,1,1)"), "#DIV/0!");
  const tt = { A1: 3, A2: 4, A3: 5, A4: 8, A5: 9, A6: 1, A7: 2, A8: 4, A9: 5, B1: 6, B2: 19, B3: 3, B4: 2, B5: 14, B6: 4, B7: 5, B8: 17, B9: 1 };
  near("T.TEST paired (Excel example)", ev("T.TEST(A1:A9,B1:B9,2,1)", tt), 0.196016, 1e-6);
  near("T.TEST equal variances", ev("T.TEST({1,2,3,4,5},{3,4,5,6,7},2,2)"), 0.0805162379572626, 1e-12);
  near("T.TEST Welch", ev("T.TEST({1,2,3,4,5},{3,4,5,6,7},2,3)"), 0.0805162379572626, 1e-12);
  near("T.TEST one tail is half", ev("T.TEST({1,2,3,4,5},{3,4,5,6,7},1,2)"), 0.0402581189786313, 1e-12);
  err("T.TEST paired without spread", ev("T.TEST({1,2,3},{3,4,5},2,1)"), "#DIV/0!");
  err("T.TEST bad tails", ev("T.TEST({1,2,3},{3,4,6},3,2)"), "#NUM!");
  err("T.TEST paired sizes", ev("T.TEST({1,2,3},{3,4},2,1)"), "#N/A");
  // Welch with unequal variances and a fractional df (3.19): checked by numerical integration.
  near("T.TEST Welch, fractional df", ev("T.TEST({10,12,14},{20,30,40,50},2,3)"), 0.03562525952511775, 1e-9);
}

// ==============================================================================================
section("regression");
{
  const s = { A1: 6, A2: 5, A3: 11, A4: 7, A5: 5, A6: 4, A7: 4, B1: 2, B2: 3, B3: 9, B4: 1, B5: 8, B6: 7, B7: 5 };
  near("SLOPE (Excel example)", ev("SLOPE(B1:B7,A1:A7)", s), 0.305555556, 1e-9);
  near("INTERCEPT (Excel example)", ev("INTERCEPT(B1:B5,A1:A5)", s), 0.0483871, 1e-6);
  near("RSQ (Excel example)", ev("RSQ(B1:B7,A1:A7)", s), 0.05795019, 1e-7);
  near("STEYX (Excel example)", ev("STEYX(B1:B7,A1:A7)", s), 3.305718950, 1e-9);
  near("FORECAST (Excel example)", ev("FORECAST(30,{6,7,9,15,21},{20,28,31,38,40})"), 10.607253, 1e-6);
  near("FORECAST.LINEAR", ev("FORECAST.LINEAR(30,{6,7,9,15,21},{20,28,31,38,40})"), 10.607253, 1e-6);
  err("SLOPE constant x", ev("SLOPE({1,2,3},{2,2,2})"), "#DIV/0!");
  err("SLOPE sizes", ev("SLOPE({1,2,3},{1,2})"), "#N/A");
  // A calibration line (Extinktion against Konzentration).
  const cal = { A1: 0, A2: 0.1, A3: 0.2, A4: 0.3, A5: 0.4, B1: 0.0012, B2: 0.0535, B3: 0.1058, B4: 0.1581, B5: 0.2104 };
  near("calibration slope", ev("SLOPE(B1:B5,A1:A5)", cal), 0.523, 1e-12);
  near("calibration intercept", ev("INTERCEPT(B1:B5,A1:A5)", cal), 0.0012, 1e-10);
  near("calibration R² is 1", ev("RSQ(B1:B5,A1:A5)", cal), 1, 1e-12);
  near("unknown sample: (y − b)/m", ev("(0.1320-INTERCEPT(B1:B5,A1:A5))/SLOPE(B1:B5,A1:A5)", cal), 0.1308 / 0.523, 1e-10);

  const ls = { A1: 1, A2: 2, A3: 3, A4: 4, B1: 1, B2: 2, B3: 3, B4: 5 };
  const L = (r: number, c: number) => ev(`INDEX(LINEST(B1:B4,A1:A4,TRUE,TRUE),${r},${c})`, ls);
  near("LINEST m", L(1, 1), 1.3, 1e-12);
  near("LINEST b", L(1, 2), -0.5, 1e-12);
  near("LINEST se m", L(2, 1), 0.17320508075688773, 1e-12);
  near("LINEST se b", L(2, 2), 0.4743416490252569, 1e-12);
  near("LINEST r²", L(3, 1), 0.9657142857142857, 1e-12);
  near("LINEST se y", L(3, 2), 0.3872983346207417, 1e-12);
  near("LINEST F", L(4, 1), 56.333333333333336, 1e-10);
  eq("LINEST df", L(4, 2), 2);
  near("LINEST ss reg", L(5, 1), 8.45, 1e-12);
  near("LINEST ss resid", L(5, 2), 0.3, 1e-12);
  near("LINEST shows m in its cell", ev("LINEST(B1:B4,A1:A4)", ls), 1.3, 1e-12);
  near("LINEST without x", ev("INDEX(LINEST(B1:B4),1,1)", ls), 1.3, 1e-12);
  const nc = { A1: 1, A2: 2, A3: 3, B1: 2, B2: 4, B3: 6.5 };
  const N = (r: number, c: number) => ev(`INDEX(LINEST(B1:B3,A1:A3,FALSE,TRUE),${r},${c})`, nc);
  near("LINEST through 0: m", N(1, 1), 29.5 / 14, 1e-12);
  eq("LINEST through 0: b", N(1, 2), 0);
  near("LINEST through 0: r² (uncentred)", N(3, 1), 1 - 1.25 / 14 / 62.25, 1e-12);
  eq("LINEST through 0: df", N(4, 2), 2);
  err("LINEST through 0: se b is #N/A", N(2, 2), "#N/A");
  near("LINEST through 0: se m", N(2, 1), Math.sqrt(1.25 / 14 / 2) / Math.sqrt(14), 1e-12);
  err("LINEST has 2 columns for one x", ev("INDEX(LINEST(B1:B3,A1:A3,TRUE,TRUE),3,3)", nc), "#REF!");
  const poly = { A1: 0, A2: 1, A3: 2, A4: 3, A5: 4, B1: 1, B2: 4, B3: 9, B4: 16, B5: 25 };
  near("polynomial LINEST x²", ev("INDEX(LINEST(B1:B5,A1:A5^{1,2}),1,1)", poly), 1, 1e-10);
  near("polynomial LINEST x", ev("INDEX(LINEST(B1:B5,A1:A5^{1,2}),1,2)", poly), 2, 1e-10);
  near("polynomial LINEST b", ev("INDEX(LINEST(B1:B5,A1:A5^{1,2}),1,3)", poly), 1, 1e-10);
  near("polynomial R² = 1", ev("INDEX(LINEST(B1:B5,A1:A5^{1,2},TRUE,TRUE),3,1)", poly), 1, 1e-12);
  // Two variables: y = 1 + 2·x1 + 1·x2 exactly.
  const mr = { A1: 1, A2: 2, A3: 3, A4: 4, A5: 5, B1: 2, B2: 1, B3: 4, B4: 3, B5: 6, C1: 5, C2: 6, C3: 11, C4: 12, C5: 17 };
  near("multiple regression x2", ev("INDEX(LINEST(C1:C5,A1:B5),1,1)", mr), 1, 1e-10);
  near("multiple regression x1", ev("INDEX(LINEST(C1:C5,A1:B5),1,2)", mr), 2, 1e-10);
  near("multiple regression b", ev("INDEX(LINEST(C1:C5,A1:B5),1,3)", mr), 1, 1e-10);
  eq("multiple regression df", ev("INDEX(LINEST(C1:C5,A1:B5,TRUE,TRUE),4,2)", mr), 2);
  err("statistics rows padded with #N/A", ev("INDEX(LINEST(C1:C5,A1:B5,TRUE,TRUE),3,3)", mr), "#N/A");
  const mr2 = { ...mr, C5: 18 };
  near("multiple regression TREND", ev("TREND(C1:C5,A1:B5,D1:E1)", { ...mr2, D1: 2, E1: 1 }), ev("INDEX(LINEST(C1:C5,A1:B5),1,3)+2*INDEX(LINEST(C1:C5,A1:B5),1,2)+INDEX(LINEST(C1:C5,A1:B5),1,1)", mr2) as number, 1e-12);
  // Collinear columns (x2 = 2·x1): Excel drops one and gives it 0.
  const col = { A1: 1, A2: 2, A3: 3, A4: 4, B1: 2, B2: 4, B3: 6, B4: 8, C1: 3, C2: 5, C3: 7, C4: 9 };
  near("collinear: fitted line still right", ev("TREND(C1:C4,A1:B4,D1:E1)", { ...col, D1: 5, E1: 10 }), 11, 1e-10);
  err("LINEST text in y", ev("LINEST({1,\"a\",3},{1,2,3})"), "#VALUE!");
  const lg = { A1: 11, A2: 12, A3: 13, A4: 14, A5: 15, A6: 16, B1: 33100, B2: 47300, B3: 69000, B4: 102000, B5: 150000, B6: 220000, C1: 17, C2: 18 };
  near("LOGEST m (Excel example)", ev("INDEX(LOGEST(B1:B6,A1:A6),1,1)", lg), 1.463275628, 1e-9);
  near("LOGEST b (Excel example)", ev("INDEX(LOGEST(B1:B6,A1:A6),1,2)", lg), 495.3047702, 1e-9);
  near("GROWTH (Excel example)", ev("GROWTH(B1:B6,A1:A6,C1:C2)", lg), 320196.7184, 1e-9);
  near("GROWTH second = first × m", ev("INDEX(GROWTH(B1:B6,A1:A6,C1:C2),2,1)", lg), 320196.7184 * 1.463275628, 1e-8);
  err("LOGEST needs positive y", ev("LOGEST({1,-2,3})"), "#NUM!");
  const tr: Record<string, CellInput> = {};
  [133890, 135000, 135790, 137300, 138130, 139100, 139900, 141120, 141890, 143230, 144000, 145290].forEach((y, i) => {
    tr[`A${i + 1}`] = i + 1;
    tr[`B${i + 1}`] = y;
  });
  near("TREND at known x (Excel example)", ev("TREND(B1:B12,A1:A12)", tr), 133953.3333, 1e-9);
  near("TREND forecast (Excel example)", ev("TREND(B1:B12,A1:A12,13)", tr), 146171.5152, 1e-9);
  near("TREND through 0", ev("TREND({2,4,6.5},{1,2,3},4,FALSE)"), (29.5 / 14) * 4, 1e-12);
  near("SUM of TREND (array)", ev("SUM(TREND({1,2,3,5},{1,2,3,4},{5,6}))"), 6 + 7.3, 1e-12);
}

// ==============================================================================================
section("criteria (…IF / …IFS)");
{
  const t = { A1: 5, A2: 10, A3: "apple", A4: "Banana", A6: 15, B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, B6: 6 };
  eq('COUNTIF ">5"', ev('COUNTIF(A1:A6,">5")', t), 2);
  eq("COUNTIF text", ev('COUNTIF(A1:A6,"apple")', t), 1);
  eq("COUNTIF any case", ev('COUNTIF(A1:A6,"APPLE")', t), 1);
  eq("COUNTIF a*", ev('COUNTIF(A1:A6,"a*")', t), 1);
  eq("COUNTIF *a*", ev('COUNTIF(A1:A6,"*a*")', t), 2);
  eq("COUNTIF ?anana", ev('COUNTIF(A1:A6,"?anana")', t), 1);
  eq('COUNTIF "" counts empty', ev('COUNTIF(A1:A6,"")', t), 1);
  eq('COUNTIF "<>" counts filled', ev('COUNTIF(A1:A6,"<>")', t), 5);
  eq('COUNTIF "=" only truly empty', ev('COUNTIF(A1:A3,"=")', { A1: '=""', A3: 1 }), 1);
  eq('COUNTIF "" also empty text', ev('COUNTIF(A1:A3,"")', { A1: '=""', A3: 1 }), 2);
  eq('COUNTIF "<>apple"', ev('COUNTIF(A1:A6,"<>apple")', t), 5);
  eq("COUNTIF number", ev("COUNTIF(A1:A6,10)", t), 1);
  eq('COUNTIF "10"', ev('COUNTIF(A1:A6,"10")', t), 1);
  eq('COUNTIF ">=10"', ev('COUNTIF(A1:A6,">=10")', t), 2);
  eq('COUNTIF "<b" (text)', ev('COUNTIF(A1:A6,"<b")', t), 1);
  eq('COUNTIF German ">7,5"', ev('COUNTIF(A1:A6,">7,5")', t, "de"), 2);
  eq('COUNTIF English ">7.5"', ev('COUNTIF(A1:A6,">7.5")', t, "en"), 2);
  eq("COUNTIF from a cell", ev('COUNTIF(A1:A6,">"&C1)', { ...t, C1: 9 }), 2);
  eq("COUNTIF ~*", ev('COUNTIF(A1:A2,"a~*b")', { A1: "a*b", A2: "axb" }), 1);
  eq("COUNTIF TRUE", ev("COUNTIF(A1:A3,TRUE)", { A1: true, A2: false, A3: "TRUE" }), 1);
  eq("COUNTIF errors by name", ev('COUNTIF(A1:A3,"#NV")', { A1: "=NA()", A2: 1, A3: "=1/0" }), 1);
  eq("COUNTIF dates", ev('COUNTIF(A1:A3,">1.1.2026")', { A1: 46000, A2: 46100, A3: 46300 }, "de"), 2);
  eq("COUNTIF number matches number text", ev("COUNTIF(A1:A2,5)", { A1: "5", A2: 5 }), 2);
  eq("COUNTIF array of criteria", ev('SUM(COUNTIF(A1:A6,{"apple","banana"}))', t), 2);
  eq("SUMIF with sum range", ev('SUMIF(A1:A6,">5",B1:B6)', t), 8);
  eq("SUMIF without sum range", ev('SUMIF(A1:A6,">5")', t), 25);
  eq("SUMIF sum range resized from its corner", ev('SUMIF(A1:A6,">5",B1)', t), 8);
  eq("AVERAGEIF", ev('AVERAGEIF(A1:A6,">5")', t), 12.5);
  err("AVERAGEIF no match", ev('AVERAGEIF(A1:A6,">100")', t), "#DIV/0!");
  eq("COUNTIFS", ev('COUNTIFS(A1:A6,">0",B1:B6,"<5")', t), 2);
  eq("SUMIFS", ev('SUMIFS(B1:B6,A1:A6,">0",B1:B6,">1")', t), 8);
  eq("AVERAGEIFS", ev('AVERAGEIFS(B1:B6,A1:A6,">0")', t), 3);
  eq("MINIFS", ev('MINIFS(B1:B6,A1:A6,">0")', t), 1);
  eq("MAXIFS", ev('MAXIFS(B1:B6,A1:A6,">0")', t), 6);
  eq("MAXIFS no match is 0", ev('MAXIFS(B1:B6,A1:A6,">99")', t), 0);
  err("SUMIFS sizes differ", ev('SUMIFS(B1:B6,A1:A5,">0")', t), "#VALUE!");
  eq("SUMIFS whole columns", ev('SUMIFS(B:B,A:A,">0")', t), 9);
  eq("COUNTIF whole column", ev('COUNTIF(A:A,"apple")', t), 1);
}

// ==============================================================================================
section("SUBTOTAL");
{
  const cells = { A1: 1, A2: 2, A3: 3, A4: 4, A5: 5, A6: "=SUBTOTAL(9,A1:A5)", A7: "=SUBTOTAL(9,A1:A6)", A8: "=SUM(A1:A6)" };
  const wb = book1(cells);
  eq("SUBTOTAL 9", val(wb, "A6"), 15);
  eq("nested SUBTOTAL is skipped", val(wb, "A7"), 15);
  eq("SUM counts it", val(wb, "A8"), 30);
  const filtered = E.createCalc(wb, { isRowHidden: (_s, row) => row === 1 });
  eq("1–11 skip filtered rows", filtered.value("s1", 5, 0), 13);
  const manual = book(mkSheet("s1", "Blatt 1", { ...cells, B1: "=SUBTOTAL(109,A1:A5)", B2: "=SUBTOTAL(9,A1:A5)" }, { rows: { "2": { hidden: true } } }));
  eq("109 skips rows hidden by hand", val(manual, "B1"), 12);
  eq("9 keeps rows hidden by hand", val(manual, "B2"), 15);
  const both = E.createCalc(manual, { isRowHidden: (_s, row) => row === 1 || row === 2 });
  eq("9 with a filter and a hidden row", both.value("s1", 1, 1), 13);
  eq("109 with a filter and a hidden row", both.value("s1", 0, 1), 10);
  const codes: [number, number][] = [
    [1, 3],
    [2, 5],
    [3, 5],
    [4, 5],
    [5, 1],
    [6, 120],
    [8, Math.sqrt(2)],
    [10, 2.5],
    [11, 2],
    [101, 3],
  ];
  for (const [code, expected] of codes) near(`SUBTOTAL ${code}`, ev(`SUBTOTAL(${code},A1:A5)`, cells), expected, 1e-12);
  near("SUBTOTAL 7", ev("SUBTOTAL(7,A1:A5)", cells), Math.sqrt(2.5), 1e-12);
  err("SUBTOTAL bad code", ev("SUBTOTAL(12,A1:A5)", cells), "#VALUE!");
}

// ==============================================================================================
section("logic");
{
  eq("IF false branch", ev('IF(1>2,"a","b")'), "b");
  eq("IF true branch", de('WENN(2>1;"ja";"nein")'), "ja");
  eq("IF empty branch is 0", ev("IF(TRUE,)"), 0);
  eq("IF without else is FALSE", ev("IF(FALSE,1)"), false);
  eq("IF only evaluates its branch", ev("IF(TRUE,1,1/0)"), 1);
  err("IF text condition", ev('IF("abc",1,2)'), "#VALUE!");
  eq("IF text TRUE condition", ev('IF("true",1,2)'), 1);
  eq("IF number condition", ev("IF(0.5,1,2)"), 1);
  eq("IF with arrays in SUM", ev("SUMPRODUCT(IF(A1:A3>1,A1:A3,0))", { A1: 1, A2: 2, A3: 3 }), 5);
  eq("IF returns a range", ev("SUM(IF(TRUE,A1:A3,B1:B3))", { A1: 1, A2: 2, A3: 3 }), 6);
  eq("IFS", ev('IFS(A1>5,"big",A1>2,"mid",TRUE,"small")', { A1: 3 }), "mid");
  err("IFS none true", ev("IFS(FALSE,1)"), "#N/A");
  eq("IFERROR catches", ev('IFERROR(1/0,"x")'), "x");
  eq("IFERROR passes values", ev('IFERROR(5,"x")'), 5);
  eq("IFERROR of empty cell", ev("IFERROR(A1,1)"), 0);
  eq("IFERROR on arrays", ev("SUM(IFERROR(1/{1,0,2},0))"), 1.5);
  eq("IFNA catches #N/A", ev("IFNA(NA(),0)"), 0);
  err("IFNA leaves other errors", ev("IFNA(1/0,0)"), "#DIV/0!");
  eq("AND", ev("AND(TRUE,1)"), true);
  eq("AND false", ev("AND(TRUE,0)"), false);
  eq("AND range ignores text", ev("AND(A1:A3)", { A1: true, A2: "x", A3: 1 }), true);
  err("AND only text", ev("AND(A1:A2)", { A1: "x" }), "#VALUE!");
  err("AND direct text", ev('AND("x")'), "#VALUE!");
  eq("OR", ev("OR(FALSE,0)"), false);
  eq("OR one true", ev("OR(FALSE,2)"), true);
  eq("XOR", [ev("XOR(TRUE,TRUE)"), ev("XOR(TRUE,FALSE,FALSE)")], [false, true]);
  eq("NOT", ev("NOT(0)"), true);
  eq("SWITCH", ev('SWITCH(2,1,"a",2,"b","c")'), "b");
  eq("SWITCH default", ev('SWITCH(9,1,"a","z")'), "z");
  err("SWITCH no match", ev('SWITCH(9,1,"a")'), "#N/A");
  eq("SWITCH text any case", ev('SWITCH("B","a",1,"b",2)'), 2);
  eq("TRUE()/FALSE()", [ev("TRUE()"), ev("FALSE()")], [true, false]);
  eq("German WAHR()", de("WAHR()"), true);
}

// ==============================================================================================
section("lookup");
{
  const t = { A1: 1, B1: "eins", A2: 2, B2: "zwei", A3: 3, B3: "drei", C1: "Apfel", C2: "Birne", C3: "Kirsche" };
  eq("VLOOKUP exact", ev("VLOOKUP(2,A1:B3,2,FALSE)", t), "zwei");
  eq("VLOOKUP approximate", ev("VLOOKUP(2.5,A1:B3,2,TRUE)", t), "zwei");
  eq("VLOOKUP approximate default", ev("VLOOKUP(9,A1:B3,2)", t), "drei");
  err("VLOOKUP below the first", ev("VLOOKUP(0.5,A1:B3,2)", t), "#N/A");
  err("VLOOKUP not found", ev("VLOOKUP(7,A1:B3,2,FALSE)", t), "#N/A");
  eq("VLOOKUP empty 4th argument = exact", ev("VLOOKUP(2,A1:B3,2,)", t), "zwei");
  eq("VLOOKUP text any case", ev('VLOOKUP("BIRNE",C1:D3,1,FALSE)', t), "Birne");
  eq("VLOOKUP wildcard", ev('VLOOKUP("Ki*",C1:C3,1,FALSE)', t), "Kirsche");
  err("VLOOKUP column 0", ev("VLOOKUP(2,A1:B3,0,FALSE)", t), "#VALUE!");
  err("VLOOKUP column too far", ev("VLOOKUP(2,A1:B3,3,FALSE)", t), "#REF!");
  eq("VLOOKUP array constant", ev('VLOOKUP(2,{1,"a";2,"b";3,"c"},2,FALSE)'), "b");
  eq("VLOOKUP whole columns", ev("VLOOKUP(3,A:B,2,FALSE)", t), "drei");
  eq("VLOOKUP lifted", ev("SUMPRODUCT(LEN(VLOOKUP(A1:A2,A1:B3,2,FALSE)))", t), 8);
  const h = { A1: 1, B1: 2, C1: 3, A2: "a", B2: "b", C2: "c" };
  eq("HLOOKUP", ev("HLOOKUP(2,A1:C2,2,FALSE)", h), "b");
  eq("HLOOKUP approximate", ev("HLOOKUP(2.7,A1:C2,2)", h), "b");
  eq("INDEX", ev("INDEX(A1:C3,2,3)", t), "Birne");
  eq("INDEX column", ev("INDEX(A1:A3,3)", t), 3);
  eq("INDEX row", ev("INDEX(A1:C1,3)", t), "Apfel");
  err("INDEX out of range", ev("INDEX(A1:A3,4)", t), "#REF!");
  eq("ROW(INDEX())", ev("ROW(INDEX(A1:A3,3))", t), 3);
  eq("INDEX whole column", ev("SUM(INDEX(A1:B3,0,1))", t), 6);
  eq("INDEX array", ev("INDEX({1,2;3,4},2,1)"), 3);
  eq("MATCH exact", ev("MATCH(5,{1,3,5,7},0)"), 3);
  eq("MATCH approximate", ev("MATCH(6,{1,3,5,7})"), 3);
  eq("MATCH descending", ev("MATCH(6,{7,5,3,1},-1)"), 1);
  eq("MATCH descending 2", ev("MATCH(4,{7,5,3,1},-1)"), 2);
  eq("MATCH wildcard", ev('MATCH("b*",{"apple","banana"},0)'), 2);
  err("MATCH not found", ev("MATCH(9,{1,3},0)"), "#N/A");
  eq("MATCH with range", ev('MATCH("Kirsche",C1:C3,0)', t), 3);
  eq("MATCH approximate in a range with text", ev("MATCH(2.5,A1:A3,1)", t), 2);
  eq("INDEX/MATCH", ev('INDEX(B1:B3,MATCH("Kirsche",C1:C3,0))', t), "drei");
  eq("XLOOKUP", ev('XLOOKUP("Birne",C1:C3,A1:A3)', t), 2);
  err("XLOOKUP not found", ev('XLOOKUP("Pflaume",C1:C3,A1:A3)', t), "#N/A");
  eq("XLOOKUP if_not_found", ev('XLOOKUP("Pflaume",C1:C3,A1:A3,"–")', t), "–");
  eq("XLOOKUP next smaller", ev("XLOOKUP(2.5,A1:A3,B1:B3,,-1)", t), "zwei");
  eq("XLOOKUP next larger", ev("XLOOKUP(2.5,A1:A3,B1:B3,,1)", t), "drei");
  eq("XLOOKUP wildcard", ev('XLOOKUP("K*",C1:C3,A1:A3,,2)', t), 3);
  eq("XLOOKUP exact treats * literally", ev('XLOOKUP("K*",C1:C3,A1:A3,"no")', t), "no");
  eq("XLOOKUP last to first", ev('XLOOKUP(1,{1;2;1},{"a";"b";"c"},,0,-1)'), "c");
  eq("XLOOKUP returns a row", ev('SUM(XLOOKUP(2,A1:A3,A1:B3))', { ...t, B2: 10 }), 12);
  eq("XLOOKUP left lookup", ev('XLOOKUP("drei",B1:B3,A1:A3)', t), 3);
  eq("CHOOSE", ev('CHOOSE(2,"a","b","c")'), "b");
  err("CHOOSE out of range", ev('CHOOSE(4,"a","b","c")'), "#VALUE!");
  eq("CHOOSE only evaluates its choice", ev("CHOOSE(1,5,1/0)"), 5);
  eq("CHOOSE array index", ev("SUM(CHOOSE({1,2},A1,A2))", t), 3);
  eq("ROW() of the cell", ev("ROW()"), 100);
  eq("COLUMN() of the cell", ev("COLUMN()"), 26);
  eq("ROW(range) as array", ev("SUM(ROW(A1:A3))"), 6);
  eq("COLUMN(C5)", ev("COLUMN(C5)"), 3);
  eq("ROWS", ev("ROWS(A1:A10)"), 10);
  eq("COLUMNS", ev("COLUMNS(A1:C1)"), 3);
  eq("ROWS of an array", ev("ROWS({1;2;3})"), 3);
  eq("ROWS whole column like Excel", ev("ROWS(A:A)"), 1048576);
  err("missing sheet", ev("'Nicht da'!A1"), "#REF!");
  const two = book(mkSheet("s1", "Blatt 1", { A1: "=Daten!A1*2", A2: "='Daten 2'!B2+1", A3: "=SUM(Daten!A1:A3)" }), mkSheet("s2", "Daten", { A1: 21, A2: 1, A3: 2 }), mkSheet("s3", "Daten 2", { B2: 41 }));
  eq("other sheet", val(two, "A1"), 42);
  eq("quoted sheet", val(two, "A2"), 42);
  eq("range on another sheet", val(two, "A3"), 24);
  const ci = book(mkSheet("s1", "Blatt 1", { A1: "=DATEN!A1+'daten 2'!A1" }), mkSheet("s2", "Daten", { A1: 1 }), mkSheet("s3", "Daten 2", { A1: 2 }));
  eq("sheet names ignore case", val(ci, "A1"), 3);
}

// ==============================================================================================
section("text");
{
  eq("LEFT", ev('LEFT("Kalibrierung",5)'), "Kalib");
  eq("LEFT default 1", ev('LEFT("Kalibrierung")'), "K");
  eq("RIGHT", ev('RIGHT("Probe 12",2)'), "12");
  eq("MID", ev('MID("Extinktion",3,4)'), "tink");
  eq("MID past the end", ev('MID("abc",3,10)'), "c");
  err("MID start 0", ev('MID("abc",0,1)'), "#VALUE!");
  eq("LEN", ev('LEN("Wasser")'), 6);
  eq("LEN of a number de", ev("LEN(1.5)", {}, "de"), 3);
  eq("UPPER keeps ß", ev('UPPER("straße")'), "STRAßE");
  eq("LOWER", ev('LOWER("ÄRGER")'), "ärger");
  eq("PROPER", ev('PROPER("hello world-foo")'), "Hello World-Foo");
  eq("PROPER after digits", ev('PROPER("2nd o\'neil")'), "2Nd O'Neil");
  eq("TRIM", ev('TRIM("  a   b  ")'), "a b");
  eq("CONCAT range", ev('CONCAT(A1:A3,"!")', { A1: "a", A2: 1.5, A3: true }, "en"), "a1.5TRUE!");
  eq("CONCATENATE", ev('CONCATENATE("a","b",1)'), "ab1");
  eq("TEXTJOIN skip empty", ev('TEXTJOIN(", ",TRUE,A1:A3)', { A1: "a", A3: "c" }), "a, c");
  eq("TEXTJOIN keep empty", ev('TEXTJOIN("-",FALSE,A1:A3)', { A1: "a", A3: "c" }), "a--c");
  eq("SUBSTITUTE", ev('SUBSTITUTE("a-b-c","-","+")'), "a+b+c");
  eq("SUBSTITUTE instance", ev('SUBSTITUTE("a-b-c","-","+",2)'), "a-b+c");
  eq("SUBSTITUTE missing instance", ev('SUBSTITUTE("a-b","-","+",5)'), "a-b");
  eq("REPLACE", ev('REPLACE("abcdef",2,3,"X")'), "aXef");
  eq("FIND", ev('FIND("b","abcb")'), 2);
  eq("FIND from", ev('FIND("b","abcb",3)'), 4);
  err("FIND is case-sensitive", ev('FIND("B","abc")'), "#VALUE!");
  eq("SEARCH ignores case", ev('SEARCH("B","abc")'), 2);
  eq("SEARCH wildcard *", ev('SEARCH("c*f","abcdef")'), 3);
  eq("SEARCH wildcard ?", ev('SEARCH("?d","abcd")'), 3);
  err("SEARCH not found", ev('SEARCH("z","abc")'), "#VALUE!");
  eq("REPT", ev('REPT("ab",3)'), "ababab");
  eq("EXACT", [ev('EXACT("a","A")'), ev('EXACT("a","a")')], [false, true]);
  eq("FIXED de", ev("FIXED(1234.567,1)", {}, "de"), "1.234,6");
  eq("FIXED en", ev("FIXED(1234.567,1)", {}, "en"), "1,234.6");
  eq("FIXED no commas", ev("FIXED(1234.567,1,TRUE)", {}, "en"), "1234.6");
  eq("FIXED negative decimals", ev("FIXED(1234.567,-1)", {}, "en"), "1,230");
  eq("FIXED default 2", ev("FIXED(2.5)", {}, "en"), "2.50");
  eq("CHAR", [ev("CHAR(65)"), ev("CHAR(128)"), ev("CHAR(228)")], ["A", "€", "ä"]);
  eq("CODE", [ev('CODE("A")'), ev('CODE("€")'), ev('CODE("ä")')], [65, 128, 228]);
  err("CODE of empty", ev('CODE("")'), "#VALUE!");
  eq("VALUE de", ev('VALUE("1,5")', {}, "de"), 1.5);
  eq("VALUE en", ev('VALUE("1,234.5")', {}, "en"), 1234.5);
  eq("VALUE percent", ev('VALUE("50%")'), 0.5);
  eq("VALUE date", ev('VALUE("01.11.2026")'), 46327);
  err("VALUE text", ev('VALUE("abc")'), "#VALUE!");
}

// ==============================================================================================
section("TEXT() format codes");
{
  const T = (v: string, f: string, locale: Locale = "de") => ev(`TEXT(${v},"${f.replace(/"/g, '""')}")`, {}, locale);
  eq("de #.##0,00", T("1234.567", "#.##0,00"), "1.234,57");
  eq("de 0,00", T("1.5", "0,00"), "1,50");
  eq("de 0", T("1.5", "0"), "2");
  eq("de 0,0%", T("0.285", "0,0%"), "28,5%");
  eq("de 0.0% (forgiving)", T("0.285", "0.0%"), "28,5%");
  eq("de TT.MM.JJJJ", T("46327", "TT.MM.JJJJ"), "01.11.2026");
  eq("de TTTT", T("46327", "TTTT"), "Sonntag");
  eq("de TTT", T("46327", "TTT"), "So");
  eq("de MMMM JJJJ", T("46327", "MMMM JJJJ"), "November 2026");
  eq("de dd.mm.yyyy", T("46327", "dd.mm.yyyy"), "01.11.2026");
  eq("de yyyy-mm-dd", T("46327", "yyyy-mm-dd"), "2026-11-01");
  eq("de hh:mm", T("0.6041666666666666", "hh:mm"), "14:30");
  eq("de hh:mm:ss", T("46327.75", "hh:mm:ss"), "18:00:00");
  eq("de negative", T("-1.5", "0,0"), "-1,5");
  eq("de scientific", T("1234", "0,00E+00"), "1,23E+03");
  eq("de literal text", T("5", '0 "Stück"'), "5 Stück");
  eq("de Standard", T("1.5", "Standard"), "1,5");
  eq("two sections", T("-5", "0;(0)"), "(5)");
  eq("zero section", T("0", '0;-0;"null"'), "null");
  eq("text stays text", T('"abc"', "0,00"), "abc");
  eq("text number becomes number", T('"1,5"', "0,00"), "1,50");
  eq("en #,##0.00", T("1234.567", "#,##0.00", "en"), "1,234.57");
  eq("en 0.0%", T("0.285", "0.0%", "en"), "28.5%");
  eq("en 0,00 (forgiving)", T("1.5", "0,00", "en"), "1.50");
  eq("en long date", T("46327", "dddd, mmmm d, yyyy", "en"), "Sunday, November 1, 2026");
  eq("en AM/PM", T("0.75", "h:mm AM/PM", "en"), "6:00 PM");
  eq("en elapsed hours", T("1.25", "[h]:mm", "en"), "30:00");
  eq("en mmm", T("46327", "d mmm yy", "en"), "1 Nov 26");
  eq("optional digits", T("1.5", "#,##", "de"), "1,5");
  eq("leading zeros", T("7", "000", "de"), "007");
  eq("thousands only", T("1234567", "#.##0", "de"), "1.234.567");
  eq("scaled by a trailing separator", T("1234567.891", "0.0,", "en"), "1234.6");
  eq("scaled thousands with grouping", T("123456789", "#,##0,", "en"), "123,457");
  eq("fraction", T("0.25", "# ?/?", "en"), "1/4");
  eq("mixed fraction", T("2.5", "# ?/?", "en"), "2 1/2");
  eq("fraction best fit", T("0.333", "# ??/??", "en"), "1/3");
  eq("fixed eighths", T("1.4", "# ?/8", "en"), "1 3/8");
  eq("improper fraction", T("1.75", "?/?", "en"), "7/4");
  eq("negative fraction", T("-0.5", "# ?/?", "en"), "-1/2");
  eq("rounds up to a whole", T("0.99", "# ?/?", "en"), "1");
}

// ==============================================================================================
section("dates");
{
  eq("DATE", ev("DATE(2026,11,1)"), 46327);
  eq("DATE 1 March 1900 like Excel", ev("DATE(1900,3,1)"), 61);
  eq("DATE 1 January 2025", ev("DATE(2025,1,1)"), 45658);
  eq("DATE month overflow", ev("DATE(2026,14,1)"), ev("DATE(2027,2,1)"));
  eq("DATE day 0", ev("DATE(2026,1,0)"), ev("DATE(2025,12,31)"));
  eq("DATE two-digit year adds 1900", ev("DATE(108,1,2)"), ev("DATE(2008,1,2)"));
  eq("DATE leap day", ev("DATE(2024,2,29)"), 45351);
  eq("DATE 29.2.2023 rolls over", ev("DATE(2023,2,29)"), ev("DATE(2023,3,1)"));
  err("DATE year -1", ev("DATE(-1,1,1)"), "#NUM!");
  err("DATE year 10000", ev("DATE(10000,1,1)"), "#NUM!");
  eq("YEAR/MONTH/DAY", [ev("YEAR(46327)"), ev("MONTH(46327)"), ev("DAY(46327)")], [2026, 11, 1]);
  eq("YEAR of text de", ev('YEAR("1.11.2026")', {}, "de"), 2026);
  eq("YEAR of text en", ev('YEAR("11/1/2026")', {}, "en"), 2026);
  err("YEAR negative", ev("YEAR(-1)"), "#NUM!");
  near("TIME", ev("TIME(14,30,0)"), 14.5 / 24, 1e-15);
  near("TIME wraps", ev("TIME(25,0,0)"), 1 / 24, 1e-15);
  err("TIME negative", ev("TIME(-1,0,0)"), "#NUM!");
  eq("HOUR/MINUTE/SECOND", [ev("HOUR(TIME(14,30,15))"), ev("MINUTE(TIME(14,30,15))"), ev("SECOND(TIME(14,30,15))")], [14, 30, 15]);
  eq("HOUR of a date with time", ev("HOUR(46327.75)"), 18);
  eq("WEEKDAY", [ev("WEEKDAY(DATE(2026,11,3))"), ev("WEEKDAY(DATE(2026,11,3),2)"), ev("WEEKDAY(DATE(2026,11,3),3)"), ev("WEEKDAY(DATE(2026,11,3),11)"), ev("WEEKDAY(DATE(2026,11,3),16)")], [3, 2, 1, 2, 4]);
  err("WEEKDAY bad type", ev("WEEKDAY(1,4)"), "#NUM!");
  eq("WEEKNUM", ev("WEEKNUM(DATE(2026,11,3))"), 45);
  eq("WEEKNUM 1 January", ev("WEEKNUM(DATE(2026,1,1))"), 1);
  eq("WEEKNUM Sunday start", ev("WEEKNUM(DATE(2026,1,4))"), 2);
  eq("WEEKNUM Monday start", ev("WEEKNUM(DATE(2026,1,4),2)"), 1);
  eq("WEEKNUM 21 = ISO", ev("WEEKNUM(DATE(2027,1,1),21)"), 53);
  eq("ISOWEEKNUM", ev("ISOWEEKNUM(DATE(2026,11,3))"), 45);
  eq("ISOWEEKNUM week 53", ev("ISOWEEKNUM(DATE(2027,1,1))"), 53);
  eq("ISOWEEKNUM 2021", ev("ISOWEEKNUM(DATE(2021,1,1))"), 53);
  eq("ISOWEEKNUM first week", ev("ISOWEEKNUM(DATE(2025,12,29))"), 1);
  const dd = (u: string) => ev(`DATEDIF(DATE(2000,3,15),DATE(2026,11,3),"${u}")`);
  eq("DATEDIF Y", dd("Y"), 26);
  eq("DATEDIF M", dd("M"), 319);
  eq("DATEDIF D", dd("D"), 46329 - 36600);
  eq("DATEDIF YM", dd("YM"), 7);
  eq("DATEDIF MD", dd("MD"), 19);
  eq("DATEDIF YD", dd("YD"), 233);
  eq("DATEDIF lower case", dd("y"), 26);
  err("DATEDIF reversed", ev('DATEDIF(DATE(2026,1,2),DATE(2026,1,1),"D")'), "#NUM!");
  eq("DAYS", ev("DAYS(DATE(2026,12,25),DATE(2026,11,3))"), 52);
  eq("EDATE end of month", ev("EDATE(DATE(2026,1,31),1)"), ev("DATE(2026,2,28)"));
  eq("EDATE back", ev("EDATE(DATE(2026,3,31),-1)"), ev("DATE(2026,2,28)"));
  eq("EOMONTH", ev("EOMONTH(DATE(2026,1,15),1)"), ev("DATE(2026,2,28)"));
  eq("EOMONTH leap", ev("EOMONTH(DATE(2024,1,15),1)"), ev("DATE(2024,2,29)"));
  eq("EOMONTH back", ev("EOMONTH(DATE(2026,1,15),-1)"), ev("DATE(2025,12,31)"));
  eq("EOMONTH 0", ev("EOMONTH(DATE(2026,11,3),0)"), ev("DATE(2026,11,30)"));
  eq("NETWORKDAYS", ev("NETWORKDAYS(DATE(2026,11,2),DATE(2026,11,13))"), 10);
  eq("NETWORKDAYS holiday", ev("NETWORKDAYS(DATE(2026,11,2),DATE(2026,11,13),A1)", { A1: 46337 }), 9);
  eq("NETWORKDAYS reversed", ev("NETWORKDAYS(DATE(2026,11,13),DATE(2026,11,2))"), -10);
  eq("NETWORKDAYS weekend", ev("NETWORKDAYS(DATE(2026,11,7),DATE(2026,11,8))"), 0);
  eq("NETWORKDAYS long span", ev("NETWORKDAYS(DATE(2026,1,1),DATE(2026,12,31))"), 261);
  eq("TODAY", ev("TODAY()"), 46329);
  near("NOW", ev("NOW()"), 46329 + 14.5 / 24, 1e-12);
  eq("days between dates", ev("DATE(2026,12,24)-DATE(2026,11,3)"), 51);
}

// ==============================================================================================
section("information");
{
  eq("ISBLANK empty", ev("ISBLANK(A1)"), true);
  eq('ISBLANK ""', ev("ISBLANK(A1)", { A1: '=""' }), false);
  eq("ISBLANK 0", ev("ISBLANK(A1)", { A1: 0 }), false);
  eq("ISNUMBER", [ev("ISNUMBER(1)"), ev('ISNUMBER("1")')], [true, false]);
  eq("ISTEXT", [ev('ISTEXT("a")'), ev("ISTEXT(1)")], [true, false]);
  eq("ISERROR", [ev("ISERROR(1/0)"), ev("ISERROR(1)")], [true, false]);
  eq("ISNA", [ev("ISNA(NA())"), ev("ISNA(1/0)")], [true, false]);
  eq("ISLOGICAL", [ev("ISLOGICAL(TRUE)"), ev("ISLOGICAL(1)")], [true, false]);
  eq("ISEVEN", [ev("ISEVEN(2.5)"), ev("ISEVEN(3)"), ev("ISEVEN(A1)")], [true, false, true]);
  eq("ISODD", [ev("ISODD(-3)"), ev("ISODD(4)")], [true, false]);
  err("ISEVEN text", ev('ISEVEN("a")'), "#VALUE!");
  eq("ISFORMULA", [ev("ISFORMULA(A1)", { A1: "=1" }), ev("ISFORMULA(A1)", { A1: 1 })], [true, false]);
  err("NA()", ev("NA()"), "#N/A");
  eq("ISBLANK lifted", ev("SUMPRODUCT(--ISBLANK(A1:A3))", { A2: 1 }), 2);
}

// ==============================================================================================
section("CONVERT");
{
  const C = (n: number, a: string, b: string) => ev(`CONVERT(${n},"${a}","${b}")`);
  eq("kg → g", C(1, "kg", "g"), 1000);
  eq("mg → g", C(500, "mg", "g"), 0.5);
  eq("ug → mg", C(1, "ug", "mg"), 0.001);
  eq("µg → mg", C(1, "µg", "mg"), 0.001);
  eq("µl → ml", C(1, "µl", "ml"), 0.001);
  eq("ul → l", C(250, "ul", "l"), 0.00025);
  eq("L → ml", C(1.5, "L", "ml"), 1500);
  eq("dl → ml", C(1, "dl", "ml"), 100);
  eq("m3 → l", C(1, "m3", "l"), 1000);
  eq("cm3 → ml", C(1, "cm3", "ml"), 1);
  eq("°C → °F", C(100, "C", "F"), 212);
  eq("cel → kel", C(0, "cel", "kel"), 273.15);
  eq("F → C", C(32, "fah", "C"), 0);
  eq("K → C", C(310.15, "K", "C"), 37);
  eq("atm → Pa", C(1, "atm", "Pa"), 101325);
  near("mmHg → atm", C(760, "mmHg", "atm"), 1, 1e-12);
  eq("bar → kPa", C(1, "bar", "kPa"), 100);
  eq("hPa → Pa", C(1013.25, "hPa", "Pa"), 101325);
  eq("in → cm", C(1, "in", "cm"), 2.54);
  eq("ft → m", C(1, "ft", "m"), 0.3048);
  eq("km → m", C(1.2, "km", "m"), 1200);
  eq("nm → m", C(500, "nm", "m"), 5e-7);
  eq("µm → mm", C(1, "um", "mm"), 0.001);
  eq("hr → mn", C(1, "hr", "mn"), 60);
  eq("h → min", C(1.5, "h", "min"), 90);
  eq("day → sec", C(1, "day", "sec"), 86400);
  eq("yr → day", C(1, "yr", "day"), 365.25);
  eq("ms → s", C(250, "ms", "s"), 0.25);
  eq("cal → J", C(1, "cal", "J"), 4.1868);
  eq("kcal → kJ", C(1, "kcal", "kJ"), 4.1868);
  eq("eV → J", C(1, "eV", "J"), 1.602176634e-19);
  eq("lbm → kg", C(1, "lbm", "kg"), 0.45359237);
  eq("ozm → g", C(1, "ozm", "g"), 28.349523125);
  eq("mmol → µmol", C(1, "mmol", "umol"), 1000);
  err("mass to length", C(1, "g", "m"), "#N/A");
  err("unknown unit", C(1, "xyz", "g"), "#N/A");
  err("case matters", C(1, "KG", "g"), "#N/A");
}

// ==============================================================================================
section("cell formats");
{
  const F = (v: E.CellValue, fmt: Parameters<typeof E.formatValue>[1], locale: Locale = "de") => E.formatValue(v, fmt, locale);
  eq("general 0.1+0.2", F(0.1 + 0.2, undefined), "0,3");
  eq("general 1/3", F(1 / 3, undefined), "0,333333333");
  eq("general 2/3", F(2 / 3, undefined), "0,666666667");
  eq("general big", F(123456789012, undefined), "1,23457E+11");
  eq("general 11 digits", F(12345678901, undefined), "12345678901");
  eq("general small", F(0.00001234, undefined), "1,234E-05");
  eq("general 1E-05", F(0.00001, undefined), "1E-05");
  eq("general 0.0001", F(0.0001, undefined), "0,0001");
  eq("general negative", F(-1.5, undefined), "-1,5");
  eq("general integer", F(100, undefined), "100");
  eq("general no grouping", F(1234567.891, undefined), "1234567,891");
  eq("general en", F(1234567.891, undefined, "en"), "1234567.891");
  eq("general 0", F(0, { kind: "general" }), "0");
  eq("general 1E+21", F(1e21, undefined, "en"), "1E+21");
  eq("number grouped de", F(1234.5, { kind: "number", decimals: 2, group: true }), "1.234,50");
  eq("number grouped en", F(1234.5, { kind: "number", decimals: 2, group: true }, "en"), "1,234.50");
  eq("number ungrouped", F(1234.5, { kind: "number", decimals: 2 }), "1234,50");
  eq("number no minus for -0,00", F(-0.004, { kind: "number", decimals: 2 }), "0,00");
  eq("number rounds 1,005", F(1.005, { kind: "number", decimals: 2 }), "1,01");
  eq("number with unit", F(12.5, { kind: "number", decimals: 2, unit: "mg/L" }), "12,50\u202Fmg/L");
  eq("number millions", F(1e6, { kind: "number", decimals: 0, group: true }), "1.000.000");
  eq("number negative grouped", F(-1234567.891, { kind: "number", decimals: 1, group: true }, "en"), "-1,234,567.9");
  eq("percent", F(0.125, { kind: "percent", decimals: 1 }), "12,5%");
  eq("percent 0", F(0.5, { kind: "percent", decimals: 0 }), "50%");
  eq("percent en", F(0.125, { kind: "percent", decimals: 1 }, "en"), "12.5%");
  eq("percent 7%", F(0.07, { kind: "percent", decimals: 0 }), "7%");
  eq("scientific", F(0.000123, { kind: "scientific", decimals: 2 }), "1,23E-04");
  eq("scientific big", F(123456, { kind: "scientific", decimals: 3 }), "1,235E+05");
  eq("scientific 0", F(0, { kind: "scientific", decimals: 2 }), "0,00E+00");
  eq("scientific rounding up", F(9.996, { kind: "scientific", decimals: 2 }), "1,00E+01");
  eq("scientific unit", F(6.022e23, { kind: "scientific", decimals: 3, unit: "1/mol" }, "en"), "6.022E+23\u202F1/mol");
  eq("significant 0.00123", F(0.0012345, { kind: "significant", digits: 3 }), "0,00123");
  eq("significant 12.3", F(12.34, { kind: "significant", digits: 3 }), "12,3");
  eq("significant 1230", F(1234, { kind: "significant", digits: 3 }), "1230");
  eq("significant keeps zeros", F(12, { kind: "significant", digits: 3 }), "12,0");
  eq("significant 9.996", F(9.996, { kind: "significant", digits: 3 }), "10,0");
  eq("significant large", F(1234567, { kind: "significant", digits: 3 }), "1,23E+06");
  eq("significant tiny", F(0.000012345, { kind: "significant", digits: 3 }), "1,23E-05");
  eq("significant negative", F(-0.5, { kind: "significant", digits: 2 }), "-0,50");
  eq("currency de", F(12.5, { kind: "currency", decimals: 2, symbol: "€" }), "12,50\u00A0€");
  eq("currency en", F(12.5, { kind: "currency", decimals: 2, symbol: "€" }, "en"), "€12.50");
  eq("currency $ grouped", F(1234.5, { kind: "currency", decimals: 2, symbol: "$" }, "en"), "$1,234.50");
  eq("currency CHF en", F(12.5, { kind: "currency", decimals: 2, symbol: "CHF" }, "en"), "CHF\u00A012.50");
  eq("currency CHF de", F(12.5, { kind: "currency", decimals: 2, symbol: "CHF" }), "12,50\u00A0CHF");
  eq("currency negative de", F(-12.5, { kind: "currency", decimals: 2, symbol: "€" }), "-12,50\u00A0€");
  eq("currency negative en", F(-12.5, { kind: "currency", decimals: 2, symbol: "£" }, "en"), "-£12.50");
  eq("currency no decimals", F(1234, { kind: "currency", decimals: 0, symbol: "€" }), "1.234\u00A0€");
  eq("date short de", F(46327, { kind: "date", style: "short" }), "01.11.2026");
  eq("date short en", F(46327, { kind: "date", style: "short" }, "en"), "11/1/2026");
  eq("date long de", F(46327, { kind: "date", style: "long" }), "1. November 2026");
  eq("date long en", F(46327, { kind: "date", style: "long" }, "en"), "November 1, 2026");
  eq("date iso", F(46327, { kind: "date", style: "iso" }), "2026-11-01");
  eq("date ignores the time", F(46327.75, { kind: "date", style: "short" }), "01.11.2026");
  eq("date of a negative number", F(-1, { kind: "date", style: "short" }), "-1");
  eq("time", F(14.5 / 24, { kind: "time", seconds: false }), "14:30");
  eq("time seconds", F(14.5 / 24, { kind: "time", seconds: true }), "14:30:00");
  eq("time rounding", F((14 * 3600 + 30 * 60 + 1) / 86400, { kind: "time", seconds: true }), "14:30:01");
  eq("datetime de", F(46327 + 14.5 / 24, { kind: "datetime" }), "01.11.2026 14:30");
  eq("datetime en", F(46327 + 14.5 / 24, { kind: "datetime" }, "en"), "11/1/2026 14:30");
  eq("datetime rounds to the next day", F(46327 + 0.99999999, { kind: "datetime" }), "02.11.2026 00:00");
  eq("text format shows numbers", F(1.5, { kind: "text" }), "1,5");
  eq("text stays text", F("abc", { kind: "number", decimals: 2 }), "abc");
  eq("booleans de", F(true, undefined), "WAHR");
  eq("booleans en", F(false, undefined, "en"), "FALSE");
  eq("errors de", [F({ error: "#VALUE!" }, undefined), F({ error: "#N/A" }, undefined), F({ error: "#CIRC!" }, undefined), F({ error: "#REF!" }, undefined), F({ error: "#NUM!" }, undefined)], ["#WERT!", "#NV", "#ZIRKEL!", "#BEZUG!", "#ZAHL!"]);
  eq("errors en", F({ error: "#VALUE!" }, undefined, "en"), "#VALUE!");
  eq("empty", F(null, undefined), "");
  eq("errorText", [E.errorText("#DIV/0!", "de"), E.errorText("#CALC!", "de"), E.errorText("#N/A", "en")], ["#DIV/0!", "#KALK!", "#N/A"]);
  eq("defaultAlign", [E.defaultAlign(1), E.defaultAlign("a"), E.defaultAlign(true), E.defaultAlign({ error: "#N/A" }), E.defaultAlign(null)], ["right", "left", "center", "center", "left"]);
  check("explainError de", E.explainError({ error: "#DIV/0!" }, "de").includes("null"));
  check("explainError unknown function", E.explainError({ error: "#NAME?", detail: "unknown-function:SUMM" }, "de").includes("SUMM"));
  check("explainError en", E.explainError({ error: "#CIRC!" }, "en").startsWith("Circular"));
}

// ==============================================================================================
section("typing into cells");
{
  const P = (t: string, locale: Locale = "de", current?: Cell) => E.parseInput(t, locale, current);
  eq("1,5", P("1,5"), { cell: { v: 1.5 } });
  eq("-1,5", P("-1,5"), { cell: { v: -1.5 } });
  eq("+5", P("+5"), { cell: { v: 5 } });
  eq("1.234,5", P("1.234,5"), { cell: { v: 1234.5 }, fmt: { kind: "number", decimals: 1, group: true } });
  // German "1.234" stays 1234 like in Excel, but shows as 1234 (not 1.234) and carries a hint (see "German 1.234").
  eq("1.234", P("1.234").cell, { v: 1234 });
  eq("50 %", P("50 %"), { cell: { v: 0.5 }, fmt: { kind: "percent", decimals: 0 } });
  eq("12,5%", P("12,5%"), { cell: { v: 0.125 }, fmt: { kind: "percent", decimals: 1 } });
  eq("1,5E-3", P("1,5E-3"), { cell: { v: 0.0015 }, fmt: { kind: "scientific", decimals: 2 } });
  eq("12,50 €", P("12,50 €"), { cell: { v: 12.5 }, fmt: { kind: "currency", decimals: 2, symbol: "€" } });
  eq("€ 12,50", P("€ 12,50"), { cell: { v: 12.5 }, fmt: { kind: "currency", decimals: 2, symbol: "€" } });
  eq("1.11.2026", P("1.11.2026"), { cell: { v: 46327 }, fmt: { kind: "date", style: "short" } });
  eq("01.11.2026", P("01.11.2026"), { cell: { v: 46327 }, fmt: { kind: "date", style: "short" } });
  eq("1.11.26", P("1.11.26"), { cell: { v: 46327 }, fmt: { kind: "date", style: "short" } });
  const year = new Date().getFullYear();
  eq("1.11. (this year)", P("1.11."), { cell: { v: E.serialFromYMD(year, 11, 1) }, fmt: { kind: "date", style: "short" } });
  eq("2026-11-01", P("2026-11-01"), { cell: { v: 46327 }, fmt: { kind: "date", style: "iso" } });
  eq("1. November 2026", P("1. November 2026"), { cell: { v: 46327 }, fmt: { kind: "date", style: "long" } });
  eq("14:30", P("14:30"), { cell: { v: 14.5 / 24 }, fmt: { kind: "time", seconds: false } });
  eq("14:30:15", P("14:30:15"), { cell: { v: (14 * 3600 + 30 * 60 + 15) / 86400 }, fmt: { kind: "time", seconds: true } });
  eq("1.11.2026 14:30", P("1.11.2026 14:30"), { cell: { v: 46327 + 14.5 / 24 }, fmt: { kind: "datetime" } });
  eq("WAHR", P("WAHR"), { cell: { v: true } });
  eq("falsch", P("falsch"), { cell: { v: false } });
  eq("TRUE in German is text", P("TRUE"), { cell: { v: "TRUE" } });
  eq("'007", P("'007"), { cell: { v: "007" } });
  eq("007", P("007"), { cell: { v: 7 } });
  eq("formula", P("=summe(a1:a3)"), { cell: { f: "SUM(A1:A3)" } });
  check("broken formula", !!P("=summe(").error);
  eq("empty clears", P(""), { cell: {} });
  eq("spaces clear", P("   "), { cell: {} });
  eq("text", P("Probe 1"), { cell: { v: "Probe 1" } });
  eq("1.13 is a number (no such date)", P("1.13"), { cell: { v: 1.13 } });
  eq("1.5 is a number, not 1 May (no final dot)", P("1.5"), { cell: { v: 1.5 } });
  eq("3.5 mg stays a number", P("3.5"), { cell: { v: 3.5 } });
  eq("-1.5 is a number", P("-1.5"), { cell: { v: -1.5 } });
  eq("1/2/2026 day first in German", P("1/2/2026"), { cell: { v: E.serialFromYMD(2026, 2, 1) }, fmt: { kind: "date", style: "short" } });
  eq("text format keeps formulas as text", P("=1+1", "de", { s: { fmt: { kind: "text" } } }), { cell: { v: "=1+1" } });
  eq("text format keeps 007", P("007", "de", { s: { fmt: { kind: "text" } } }), { cell: { v: "007" } });
  eq("percent cell: 50 means 50 %", P("50", "de", { s: { fmt: { kind: "percent", decimals: 0 } } }), { cell: { v: 0.5 } });
  eq("+A1*2 is a formula", P("+A1*2"), { cell: { f: "+A1*2" } });
  eq("-A1 is a formula", P("-A1"), { cell: { f: "-A1" } });
  eq("- Probe is text", P("- Probe"), { cell: { v: "- Probe" } });
  eq("=HEUTE() gets a date format", P("=HEUTE()"), { cell: { f: "TODAY()" }, fmt: { kind: "date", style: "short" } });
  eq("=JETZT() gets date and time", P("=JETZT()"), { cell: { f: "NOW()" }, fmt: { kind: "datetime" } });
  eq("en 1.5", P("1.5", "en"), { cell: { v: 1.5 } });
  eq("en 1,234.5", P("1,234.5", "en"), { cell: { v: 1234.5 }, fmt: { kind: "number", decimals: 1, group: true } });
  eq("en 50%", P("50%", "en"), { cell: { v: 0.5 }, fmt: { kind: "percent", decimals: 0 } });
  eq("en $12.50", P("$12.50", "en"), { cell: { v: 12.5 }, fmt: { kind: "currency", decimals: 2, symbol: "$" } });
  eq("en 11/1/2026", P("11/1/2026", "en"), { cell: { v: 46327 }, fmt: { kind: "date", style: "short" } });
  eq("en 2:30 PM", P("2:30 PM", "en"), { cell: { v: 14.5 / 24 }, fmt: { kind: "time", seconds: false } });
  eq("en TRUE", P("TRUE", "en"), { cell: { v: true } });
  eq("en WAHR is text", P("WAHR", "en"), { cell: { v: "WAHR" } });
  eq("en formula", P("=SUM(A1,1.5)", "en"), { cell: { f: "SUM(A1,1.5)" } });
  eq("en 1,5 forgiving", P("1,5", "en"), { cell: { v: 1.5 } });
  eq("lab unit", P("12,5 mg/L"), { cell: { v: 12.5 }, fmt: { kind: "number", decimals: 1, unit: "mg/L" } });
  eq("lab unit without space", P("100µl"), { cell: { v: 100 }, fmt: { kind: "number", decimals: 0, unit: "µl" } });
  eq("temperature", P("37 °C"), { cell: { v: 37 }, fmt: { kind: "number", decimals: 0, unit: "°C" } });
  eq("unit with exponent", P("1,5E-3 mol/L"), { cell: { v: 0.0015 }, fmt: { kind: "scientific", decimals: 2, unit: "mol/L" } });
  eq("unit en", P("0.25 mM", "en"), { cell: { v: 0.25 }, fmt: { kind: "number", decimals: 2, unit: "mM" } });
  eq("other words stay text", P("3 Proben"), { cell: { v: "3 Proben" } });
  err("units only when typing (VALUE stays strict)", ev('VALUE("12,5 mg/L")'), "#VALUE!");
  // A lone 0 before the dot can't be a thousands group: German "0.123" is 0,123 like "1.5" is 1,5.
  eq("0.123 is a decimal in German", P("0.123"), { cell: { v: 0.123 } });
  eq("0.5", P("0.5"), { cell: { v: 0.5 } });
  eq("-0.25", P("-0.25"), { cell: { v: -0.25 } });
  eq("-0.123", P("-0.123"), { cell: { v: -0.123 } });
  eq("+0.123", P("+0.123"), { cell: { v: 0.123 } });
  eq("0.000123", P("0.000123"), { cell: { v: 0.000123 } });
  eq("00.123", P("00.123"), { cell: { v: 0.123 } });
  eq("0.123 with a unit", P("0.123 mg/L"), { cell: { v: 0.123 }, fmt: { kind: "number", decimals: 3, unit: "mg/L" } });
  eq("1.5 with a unit is a number like 1.5", P("1.5 mg/L"), { cell: { v: 1.5 }, fmt: { kind: "number", decimals: 1, unit: "mg/L" } });
  eq("-1.5 with a unit", P("-1.5 °C"), { cell: { v: -1.5 }, fmt: { kind: "number", decimals: 1, unit: "°C" } });
  eq("0.123 %", P("0.123 %"), { cell: { v: 0.00123 }, fmt: { kind: "percent", decimals: 3 } });
  eq("0.123.456 is no number", P("0.123.456"), { cell: { v: "0.123.456" } });
  eq("1.234 still thousands", P("1.234").cell, { v: 1234 });
  eq("1.234,5 still thousands", P("1.234,5").cell, { v: 1234.5 });
  eq("1.234 mg/L still thousands", [P("1.234 mg/L").cell, P("1.234 mg/L").fmt], [{ v: 1234 }, { kind: "number", decimals: 0, unit: "mg/L" }]);
  eq("en 0.123 unchanged", P("0.123", "en"), { cell: { v: 0.123 } });
  eq("en 0,123 unchanged", P("0,123", "en"), { cell: { v: 123 }, fmt: { kind: "number", decimals: 0, group: true } });
  eq("VALUE keeps reading 0.123 as thousands", ev('VALUE("0.123")'), 123);
  eq("arithmetic too", ev('"0.123"+0'), 123);
  eq("text 0.123 edits with ' (typing it makes a number)", E.editText({ v: "0.123" }, "de"), "'0.123");
  eq("pasting 0.123 in German", O.getCell(O.pasteText(book1(), "s1", { row: 0, col: 0 }, [["0.123", "-0.5"]], "de"), "s1", 0, 0), { v: 0.123 });
  eq("shown with its unit", E.formatValue(12.5, P("12,5 mg/L").fmt, "de"), "12,5\u202Fmg/L");
}

// ==============================================================================================
section("editing cells");
{
  const X = (c: Cell | undefined, locale: Locale = "de") => E.editText(c, locale);
  eq("formula de", X({ f: "SUM(A1:A3)" }), "=SUMME(A1:A3)");
  eq("formula en", X({ f: "SUM(A1:A3)" }, "en"), "=SUM(A1:A3)");
  eq("number de", X({ v: 1.5 }), "1,5");
  eq("number en", X({ v: 1.5 }, "en"), "1.5");
  eq("all digits", X({ v: 1 / 3 }), "0,333333333333333");
  eq("no grouping", X({ v: 1234567.5, s: { fmt: { kind: "number", decimals: 2, group: true } } }), "1234567,5");
  eq("tiny", X({ v: 1e-10 }), "1E-10");
  eq("huge", X({ v: 6.022e23 }), "6,022E+23");
  eq("small but plain", X({ v: 0.0000015 }), "0,0000015");
  eq("negative", X({ v: -42 }), "-42");
  eq("percent", X({ v: 0.5, s: { fmt: { kind: "percent", decimals: 0 } } }), "50%");
  eq("percent decimals", X({ v: 0.125, s: { fmt: { kind: "percent", decimals: 1 } } }), "12,5%");
  eq("percent 7%", X({ v: 0.07, s: { fmt: { kind: "percent", decimals: 0 } } }), "7%");
  eq("date de", X({ v: 46327, s: { fmt: { kind: "date", style: "short" } } }), "01.11.2026");
  eq("date en", X({ v: 46327, s: { fmt: { kind: "date", style: "long" } } }, "en"), "11/1/2026");
  eq("date iso", X({ v: 46327, s: { fmt: { kind: "date", style: "iso" } } }), "2026-11-01");
  eq("datetime", X({ v: 46327 + 14.5 / 24, s: { fmt: { kind: "datetime" } } }), "01.11.2026 14:30");
  eq("time", X({ v: 14.5 / 24, s: { fmt: { kind: "time", seconds: false } } }), "14:30");
  eq("time with seconds", X({ v: 14.5 / 24, s: { fmt: { kind: "time", seconds: true } } }), "14:30:00");
  eq("bool", [X({ v: true }), X({ v: false }, "en")], ["WAHR", "FALSE"]);
  eq("text", X({ v: "Text" }), "Text");
  eq("text that looks like a number gets '", X({ v: "007" }), "'007");
  eq("text starting with = gets '", X({ v: "=x" }), "'=x");
  eq("text 1,5 gets '", X({ v: "1,5" }), "'1,5");
  eq("text WAHR gets '", X({ v: "WAHR" }), "'WAHR");
  eq("text starting with ' gets another", X({ v: "'x" }), "''x");
  eq("text format shows plain", X({ v: "007", s: { fmt: { kind: "text" } } }), "007");
  eq("nothing", [X(undefined), X({})], ["", ""]);
  // Round trips: what you edit is what you get back.
  const cells: Cell[] = [
    { v: 1.5 },
    { v: -0.000123 },
    { v: 1 / 3 },
    { v: 1234567.891 },
    { v: 0.5, s: { fmt: { kind: "percent", decimals: 0 } } },
    { v: 0.125, s: { fmt: { kind: "percent", decimals: 1 } } },
    { v: 46327, s: { fmt: { kind: "date", style: "short" } } },
    { v: 46327 + 14.5 / 24, s: { fmt: { kind: "datetime" } } },
    { v: 14.5 / 24, s: { fmt: { kind: "time", seconds: false } } },
    { v: true },
    { v: "007" },
    { v: "=x" },
    { v: "Probe 1" },
    { f: 'IF(A1>1.5,"ja",SUM(B1:B3))' },
    { v: 1e-10 },
    { v: 6.022e23 },
  ];
  for (const locale of ["de", "en"] as Locale[]) {
    for (const c of cells) {
      const text = E.editText(c, locale);
      const back = E.parseInput(text, locale, c);
      const same = c.f !== undefined ? back.cell.f === c.f : typeof c.v === "number" ? typeof back.cell.v === "number" && Math.abs(back.cell.v - c.v) <= 1e-9 * Math.max(1, Math.abs(c.v)) : back.cell.v === c.v;
      check(`round trip ${locale} ${show(c)} via ${text}`, same, show(back));
    }
  }
}

// ==============================================================================================
section("copying formulas (shift)");
{
  eq("relative and absolute", E.shiftFormula("A1+$A$1+A$1+$A1", 2, 3), "D3+$A$1+D$1+$A3");
  eq("range", E.shiftFormula("SUM(A1:B2)", 1, 1), "SUM(B2:C3)");
  eq("mixed range", E.shiftFormula("SUM($A1:B$2)", 3, 1), "SUM($A4:C$2)");
  eq("off the sheet", E.shiftFormula("A1*2", -1, 0), "#REF!*2");
  eq("range off the sheet", E.shiftFormula("SUM(A1:A3)", -1, 0), "SUM(#REF!)");
  eq("left edge", E.shiftFormula("B1", 0, -2), "#REF!");
  eq("whole column", E.shiftFormula("SUM(A:A)", 5, 1), "SUM(B:B)");
  eq("absolute whole column", E.shiftFormula("SUM($A:A)", 0, 2), "SUM($A:C)");
  eq("whole rows", E.shiftFormula("SUM(1:2)", 3, 5), "SUM(4:5)");
  eq("other sheet", E.shiftFormula("Daten!A1", 1, 0), "Daten!A2");
  eq("quoted sheet", E.shiftFormula("'Blatt 2'!A1", 0, 1), "'Blatt 2'!B1");
  eq("spaces kept", E.shiftFormula("A1 + 1", 1, 0), "A2 + 1");
  eq("text untouched", E.shiftFormula('"A1"&A1', 1, 0), '"A1"&A2');
  eq("function names untouched", E.shiftFormula("LOG10(A1)+ATAN2(A1,B1)", 1, 0), "LOG10(A2)+ATAN2(A2,B2)");
  eq("no move", E.shiftFormula("A1", 0, 0), "A1");
  eq("big columns", E.shiftFormula("Z1", 0, 1), "AA1");
}

// ==============================================================================================
section("structural changes (adjust)");
{
  const ins = (f: string, at: number, count: number, kind: E.StructuralChange["kind"] = "insertRows", host = "Blatt 1", sheet = "Blatt 1") =>
    E.adjustFormula(f, host, { kind, sheet, at, count } as E.StructuralChange);
  eq("row above moves the cell", ins("A3", 2, 2), "A5");
  eq("row below doesn't", ins("A1", 2, 2), "A1");
  eq("absolute moves too", ins("$A$5", 2, 2), "$A$7");
  eq("range grows inside", ins("SUM(A1:A10)", 2, 2), "SUM(A1:A12)");
  eq("insert at the first row moves the range", ins("SUM(A3:A5)", 2, 2), "SUM(A5:A7)");
  eq("insert right after doesn't grow", ins("SUM(A1:A2)", 2, 2), "SUM(A1:A2)");
  eq("whole column unchanged", ins("SUM(A:A)", 2, 2), "SUM(A:A)");
  eq("whole rows move", ins("SUM(3:3)", 2, 2), "SUM(5:5)");
  eq("whole rows grow", ins("SUM(2:4)", 2, 2), "SUM(2:6)");
  eq("deleted cell is #REF!", ins("A3+1", 2, 2, "deleteRows"), "#REF!+1");
  eq("cell below moves up", ins("A5", 2, 2, "deleteRows"), "A3");
  eq("range shrinks", ins("SUM(A1:A10)", 2, 2, "deleteRows"), "SUM(A1:A8)");
  eq("range wholly deleted", ins("SUM(A3:A4)", 2, 2, "deleteRows"), "SUM(#REF!)");
  eq("range losing its end", ins("SUM(A2:A3)", 2, 2, "deleteRows"), "SUM(A2:A2)");
  eq("range losing its start", ins("SUM(A4:A6)", 2, 2, "deleteRows"), "SUM(A3:A4)");
  eq("column insert", ins("A1+B1+C1", 1, 1, "insertCols"), "A1+C1+D1");
  eq("column range grows", ins("SUM(A1:C1)", 1, 1, "insertCols"), "SUM(A1:D1)");
  eq("whole column moves", ins("SUM(B:B)", 1, 1, "insertCols"), "SUM(C:C)");
  eq("whole row unchanged by columns", ins("SUM(1:1)", 1, 1, "insertCols"), "SUM(1:1)");
  eq("column delete", ins("B1+C1", 1, 1, "deleteCols"), "#REF!+B1");
  eq("column range shrinks", ins("SUM(A1:C1)", 1, 1, "deleteCols"), "SUM(A1:B1)");
  eq("other sheet named", ins("Daten!A5+A5", 0, 1, "insertRows", "Blatt 1", "Daten"), "Daten!A6+A5");
  eq("names compared without case", ins("daten!A5", 0, 1, "insertRows", "Blatt 1", "Daten"), "daten!A6");
  eq("own sheet named", ins("Daten!A5", 0, 1, "insertRows", "Daten", "Daten"), "Daten!A6");
  eq("implicit refs on another sheet stay", ins("A5", 0, 1, "insertRows", "Blatt 1", "Daten"), "A5");
  const ren = (f: string, from: string, to: string) => E.adjustFormula(f, "Blatt 1", { kind: "renameSheet", from, to });
  eq("rename quoted", ren("'Blatt 2'!A1+Daten!B2", "Blatt 2", "Messung 1"), "'Messung 1'!A1+Daten!B2");
  eq("rename plain", ren("'Blatt 2'!A1+Daten!B2", "Daten", "Werte"), "'Blatt 2'!A1+Werte!B2");
  eq("rename needs quotes now", ren("Daten!B2", "Daten", "Daten 2026"), "'Daten 2026'!B2");
  eq("rename leaves implicit refs", ren("A1+Daten!A1", "Blatt 1", "X"), "A1+Daten!A1");
  eq("delete sheet", E.adjustFormula("Daten!A1+A1", "Blatt 1", { kind: "deleteSheet", sheet: "Daten" }), "#REF!+A1");
  const mv = (f: string, host = "Blatt 1") => E.adjustFormula(f, host, { kind: "move", sheet: "Blatt 1", from: area("A1:A3"), toSheet: "Blatt 1", to: { row: 4, col: 2 } });
  eq("move: range inside follows", mv("SUM(A1:A3)"), "SUM(C5:C7)");
  eq("move: cell follows", mv("A2*2"), "C6*2");
  eq("move: outside stays", mv("A4"), "A4");
  eq("move: partly inside stays", mv("SUM(A1:A4)"), "SUM(A1:A4)");
  eq("move: overwritten cells are #REF!", mv("C5+D5"), "#REF!+D5");
  eq("move: from another sheet's formula", mv("'Blatt 1'!A1", "Daten"), "'Blatt 1'!C5");
  const cross = (f: string, host: string) => E.adjustFormula(f, host, { kind: "move", sheet: "Blatt 1", from: area("A1:A2"), toSheet: "Daten", to: { row: 0, col: 2 } });
  eq("move to another sheet", cross("A1+1", "Blatt 1"), "Daten!C1+1");
  eq("move to another sheet (formula there)", cross("'Blatt 1'!A2", "Daten"), "Daten!C2");
  const moved = E.adjustMovedFormula("A1*2+B1", "Blatt 1", "Daten", { kind: "move", sheet: "Blatt 1", from: area("A1:A2"), toSheet: "Daten", to: { row: 0, col: 2 } });
  eq("a moved formula keeps pointing home", moved, "C1*2+'Blatt 1'!B1");
}

// ==============================================================================================
section("smart tables growing: references follow (growTableRefs)");
{
  // A table on 'Blatt 1', columns B…D, header row 5, data rows 6…11, grows to row 12.
  const g: E.TableRows = { sheet: "Blatt 1", c0: 1, c1: 3, header: 4, from: { r0: 5, r1: 10 }, to: { r0: 5, r1: 11 } };
  const G = (f: string, host = "Blatt 1", at?: string, rows = g) => E.growTableRefs(f, host, rows, at ? parsePos(at)! : undefined);
  eq("relative", G("SLOPE(C6:C11,B6:B11)"), "SLOPE(C6:C12,B6:B12)");
  eq("absolute", G("SLOPE($C$6:$C$11,$B$6:$B$11)"), "SLOPE($C$6:$C$12,$B$6:$B$12)");
  eq("mixed", G("SUM(C$6:C$11)+SUM($C6:$C11)"), "SUM(C$6:C$12)+SUM($C6:$C12)");
  eq("several columns", G("INDEX(LINEST(C6:C11,B6:B11),1)+SUM(B6:D11)"), "INDEX(LINEST(C6:C12,B6:B12),1)+SUM(B6:D12)");
  eq("header row plus data", G("COUNTA(B5:B11)+COUNT(B5:D11)"), "COUNTA(B5:B12)+COUNT(B5:D12)");
  eq("from another sheet", G("SLOPE('Blatt 1'!C6:C11,'Blatt 1'!B6:B11)", "Auswertung"), "SLOPE('Blatt 1'!C6:C12,'Blatt 1'!B6:B12)");
  eq("sheet named in another case", G("SUM('BLATT 1'!C6:C11)", "Auswertung"), "SUM('BLATT 1'!C6:C12)");
  eq("own sheet named", G("SUM('Blatt 1'!$C$6:$C$11)"), "SUM('Blatt 1'!$C$6:$C$12)");
  const stays = ["SUM(C7:C11)", "SUM(C6:C10)", "SUM(A6:C11)", "SUM(C6:E11)", "C11*2", "SUM(C:C)", "SUM(6:11)", "SUM(C6:C12)", "SUM(B4:B11)", "SUM(Daten!C6:C11)", '"C6:C11"'];
  for (const f of stays) check(`stays: ${f}`, G(f) === f, G(f));
  check("same cells on another sheet stay", G("SUM(C6:C11)", "Auswertung") === "SUM(C6:C11)");
  eq("corners written backwards", G("SUM(C11:C6)"), "SUM(C6:C12)");
  eq("spacing kept", G("SUM( C6:C11 ) + 1"), "SUM( C6:C12 ) + 1");
  // A formula in the new row itself: never made circular
  eq("mean typed right below: keeps its range", G("AVERAGE(C6:C11)", "Blatt 1", "C12"), "AVERAGE(C6:C11)");
  eq("…another column of the new row grows", G("C12/SLOPE(C6:C11,B6:B11)", "Blatt 1", "D12"), "C12/SLOPE(C6:C12,B6:B12)");
  eq("…a cell outside the table grows", G("AVERAGE(C6:C11)", "Blatt 1", "F12"), "AVERAGE(C6:C12)");
  eq("…the same address on another sheet grows", G("AVERAGE('Blatt 1'!C6:C11)", "Auswertung", "C12"), "AVERAGE('Blatt 1'!C6:C12)");
  // Several rows at once (a paste)
  eq("several rows", G("SLOPE(C6:C11,B6:B11)", "Blatt 1", undefined, { ...g, to: { r0: 5, r1: 14 } }), "SLOPE(C6:C15,B6:B15)");
  // Rows inserted right under the header: references were pushed past them and come back
  const top: E.TableRows = { ...g, from: { r0: 6, r1: 11 }, to: { r0: 5, r1: 11 } };
  eq("rows under the header", G("SLOPE(C7:C12,$B$7:$B$12)", "Blatt 1", undefined, top), "SLOPE(C6:C12,$B$6:$B$12)");
  eq("…header and data already right", G("COUNTA(B5:B12)", "Blatt 1", undefined, top), "COUNTA(B5:B12)");
  // A table without data rows has nothing to follow
  check("no data rows", G("SUM(B5:B5)", "Blatt 1", undefined, { ...g, from: { r0: 5, r1: 4 } }) === "SUM(B5:B5)");
  // Stored areas (charts)
  eq("area grows", E.tableRowsArea({ r0: 5, c0: 2, r1: 10, c1: 2 }, g), { r0: 5, c0: 2, r1: 11, c1: 2 });
  eq("area: header and data", E.tableRowsArea({ r0: 4, c0: 1, r1: 10, c1: 3 }, g), { r0: 4, c0: 1, r1: 11, c1: 3 });
  eq("area: part of the data", E.tableRowsArea({ r0: 6, c0: 2, r1: 10, c1: 2 }, g), null);
  eq("area: beside the table", E.tableRowsArea({ r0: 5, c0: 4, r1: 10, c1: 4 }, g), null);
  eq("area: the header cell alone", E.tableRowsArea({ r0: 4, c0: 2, r1: 4, c1: 2 }, g), null);
  eq("area: already there", E.tableRowsArea({ r0: 5, c0: 2, r1: 11, c1: 2 }, { ...g, from: { r0: 5, r1: 11 } }), null);
}

// ==============================================================================================
section("long chains, cycles, speed");
{
  const cells: Record<string, CellInput> = { A1: 1 };
  for (let i = 2; i <= 10000; i++) cells[`A${i}`] = `=A${i - 1}+1`;
  const wb = book1(cells);
  let t0 = performance.now();
  eq("10,000-cell chain without stack overflow", val(wb, "A10000"), 10000);
  const chainMs = performance.now() - t0;
  check(`chain of 10,000 in ${chainMs.toFixed(0)} ms (< 1000)`, chainMs < 1000);
  timings.push(`10,000-cell chain ${chainMs.toFixed(0)} ms`);
  const c2 = calcOf(wb);
  t0 = performance.now();
  let ok = true;
  for (let r = 9999; r >= 0; r -= 1) if (c2.value("s1", r, 0) !== r + 1) ok = false;
  check("every cell of the chain, read bottom-up", ok);
  const cross: Record<string, CellInput> = { A1: 1 };
  for (let i = 2; i <= 3000; i++) cross[`A${i}`] = i % 2 ? `=Daten!A${i - 1}+1` : `=A${i - 1}+1`;
  const crossD: Record<string, CellInput> = {};
  for (let i = 1; i <= 3000; i++) crossD[`A${i}`] = `='Blatt 1'!A${i}`;
  const two = book(mkSheet("s1", "Blatt 1", cross), mkSheet("s2", "Daten", crossD));
  eq("chain across two sheets", val(two, "A3000"), 3000);
  const cyc = book1({ A1: "=B1+1", B1: "=A1+1", C1: "=A1*2", D1: "=D1+1", E5: "=SUM(E1:E5)", F1: "=IFERROR(A1,0)", G1: 5, G2: "=G1*2" });
  err("two cells in a cycle", val(cyc, "A1"), "#CIRC!");
  err("both of them", val(cyc, "B1"), "#CIRC!");
  err("a cell using a cycle", val(cyc, "C1"), "#CIRC!");
  err("a cell using itself", val(cyc, "D1"), "#CIRC!");
  err("a range including itself", val(cyc, "E5"), "#CIRC!");
  eq("IFERROR around a cycle", val(cyc, "F1"), 0);
  eq("the rest still works", val(cyc, "G2"), 10);
  const order = calcOf(cyc);
  err("cycle read from the other end first", order.value("s1", 0, 1), "#CIRC!");
  err("and then the first", order.value("s1", 0, 0), "#CIRC!");
  const ring: Record<string, CellInput> = { A1: "=A1000+1" };
  for (let i = 2; i <= 1000; i++) ring[`A${i}`] = `=A${i - 1}+1`;
  t0 = performance.now();
  err("a 1,000-cell ring", val(book1(ring), "A500"), "#CIRC!");
  check("rings don't hang", performance.now() - t0 < 1000);
  const indirect = book1({ A1: "=IF(B1>0,1,2)", B1: "=A1" });
  err("cycle through IF", val(indirect, "A1"), "#CIRC!");
  // A cycle only visible while evaluating: the range operator builds B1:D3, which holds C2 = A1.
  const dyn = book1({ A1: "=SUM(INDEX(B1:B3,1):INDEX(D1:D3,3))", B1: 1, C2: "=A1", D3: 2 });
  const dc = calcOf(dyn);
  err("dynamic cycle", dc.value("s1", 0, 0), "#CIRC!");
  err("dynamic cycle, other cell", dc.value("s1", 1, 2), "#CIRC!");
  err("dynamic cycle, read again", dc.value("s1", 0, 0), "#CIRC!");
  // A smart table's filter read back from the same Calc while SUBTOTAL runs (what the editor does):
  // values seen half-way must not stick.
  const reentrant = book1({ A1: 1, A2: 2, A3: 3, B1: "=SUBTOTAL(9,A1:A3)", C1: "=B1*10" });
  const rc: E.Calc = E.createCalc(reentrant, {
    isRowHidden: (sheetId, row) => {
      const v = rc.value(sheetId, 0, 2);
      return typeof v === "number" && v > 1000 && row === 1;
    },
  });
  eq("SUBTOTAL with a filter that reads the sheet", rc.value("s1", 0, 1), 6);
  eq("the cell read half-way is right afterwards", rc.value("s1", 0, 2), 60);
  eq("and stays right", [rc.value("s1", 0, 2), rc.value("s1", 0, 1)], [60, 6]);

  // A big sheet: 5,000 rows × 10 columns, 5,000 formulas.
  const big: Record<string, CellInput> = {};
  for (let r = 1; r <= 5000; r++) {
    big[`A${r}`] = r;
    big[`B${r}`] = r * 0.5;
    big[`C${r}`] = r % 7;
    big[`D${r}`] = r * 2;
    big[`E${r}`] = 1;
    big[`F${r}`] = 2;
    big[`G${r}`] = 3;
    big[`H${r}`] = 4;
    big[`I${r}`] = r % 3 ? "x" : 5;
    big[`J${r}`] = `=A${r}*B${r}+C${r}-D${r}/2+SUM(E${r}:I${r})`;
  }
  big.K1 = "=SUM(J1:J5000)";
  big.K2 = "=AVERAGE(A1:A5000)";
  big.K3 = '=COUNTIF(I1:I5000,"x")';
  big.K4 = "=VLOOKUP(4321,A1:J5000,10,FALSE)";
  const bwb = book(mkSheet("s1", "Blatt 1", big));
  calcOf(bwb).value("s1", 0, 10); // parse every formula once (the parse cache is shared)
  const times: number[] = [];
  for (let k = 0; k < 3; k++) {
    t0 = performance.now();
    const c = calcOf(bwb);
    for (let r = 0; r < 5000; r++) c.value("s1", r, 9);
    c.value("s1", 0, 10);
    times.push(performance.now() - t0);
  }
  const best = Math.min(...times);
  check(`5,000 formulas recalculated in ${best.toFixed(0)} ms (< 200)`, best < 200);
  timings.push(`5,000 × 10 sheet, 5,000 formulas, fresh Calc ${best.toFixed(0)} ms`);
  const c = calcOf(bwb);
  let total = 0;
  for (let r = 1; r <= 5000; r++) total += r * (r * 0.5) + (r % 7) - r + 10 + (r % 3 ? 0 : 5);
  near("their sum", c.value("s1", 0, 10), total, 1e-12);
  eq("AVERAGE over 5,000 rows", c.value("s1", 1, 10), 2500.5);
  eq("COUNTIF over 5,000 rows", c.value("s1", 2, 10), 3334);
  const r4321 = 4321;
  near("VLOOKUP in 5,000 rows", c.value("s1", 3, 10), r4321 * r4321 * 0.5 + (r4321 % 7) - r4321 + 10 + (r4321 % 3 ? 0 : 5), 1e-12);
  const sumOnly: Record<string, CellInput> = {};
  for (let r = 1; r <= 5000; r++) sumOnly[`A${r}`] = r;
  sumOnly.B1 = "=SUM(A1:A5000)";
  const swb = book1(sumOnly);
  t0 = performance.now();
  eq("SUM over 5,000 rows", val(swb, "B1"), 12502500);
  const sumMs = performance.now() - t0;
  check(`SUM over 5,000 rows is fast (${sumMs.toFixed(1)} ms < 20)`, sumMs < 20);
  timings.push(`SUM over 5,000 rows ${sumMs.toFixed(1)} ms`);
  const lookups: Record<string, CellInput> = {};
  for (let r = 1; r <= 3000; r++) {
    lookups[`A${r}`] = `id${r}`;
    lookups[`B${r}`] = r;
    lookups[`C${r}`] = `=VLOOKUP("id"&(3001-ROW()),$A$1:$B$3000,2,FALSE)`;
  }
  const lwb = book1(lookups);
  calcOf(lwb).value("s1", 0, 2);
  t0 = performance.now();
  const lc = calcOf(lwb);
  let lok = true;
  for (let r = 0; r < 3000; r++) if (lc.value("s1", r, 2) !== 3000 - r) lok = false;
  check("3,000 VLOOKUPs are right", lok);
  const lookMs = performance.now() - t0;
  check(`3,000 VLOOKUPs over 3,000 rows (${lookMs.toFixed(0)} ms < 300)`, lookMs < 300);
  timings.push(`3,000 exact VLOOKUPs ${lookMs.toFixed(0)} ms`);
  t0 = performance.now();
  for (let i = 0; i < 2000; i++) E.toCanonicalFormula(`SUMME(A${i}:B${i};MITTELWERT(C1:C9);WENN(D1>0;1;2))`, "de");
  check(`2,000 formulas translated (${(performance.now() - t0).toFixed(0)} ms < 300)`, performance.now() - t0 < 300);
}

// ==============================================================================================
section("Calc API");
{
  const wb = book(mkSheet("s1", "Blatt 1", { A1: 2, A2: 3, A3: "=A1*A2", B1: "=FOO(1)", B2: "=Daten!A1" }), mkSheet("s2", "Daten", { A1: "x" }));
  const c = calcOf(wb);
  eq("value", c.value("s1", 2, 0), 6);
  eq("empty", c.value("s1", 50, 5), null);
  eq("outside", c.value("s1", -1, 0), null);
  eq("unknown sheet", c.value("nope", 0, 0), null);
  eq("values", c.values({ sheetId: "s1", r0: 0, c0: 0, r1: 2, c1: 1 }), [
    [2, { error: "#NAME?", detail: "unknown-function:FOO" }],
    [3, "x"],
    [6, null],
  ]);
  eq("evaluate (live preview)", c.evaluate("SUM(A1:A3)", { sheetId: "s1", row: 9, col: 9 }), 11);
  eq("evaluate array result gives its top-left", c.evaluate("A1:A3*10", { sheetId: "s1", row: 9, col: 9 }), 20);
  eq("evaluate ROW() of the cell", c.evaluate("ROW()", { sheetId: "s1", row: 9, col: 9 }), 10);
  err("evaluate broken formula", c.evaluate("SUM(", { sheetId: "s1", row: 0, col: 0 }), "#NAME?");
  eq("workbook", c.workbook === wb, true);
  const stored = book1({ A1: { f: "SUM(" }, A2: { f: "1+" } });
  err("a stored formula that doesn't parse", val(stored, "A1"), "#NAME?");
  const en1 = calcOf(book1({ A1: 1.5, A2: '=A1&""' }), "en");
  eq("Calc locale en", en1.value("s1", 1, 0), "1.5");
  const de1 = calcOf(book1({ A1: 1.5, A2: '=A1&""' }), "de");
  eq("Calc locale de", de1.value("s1", 1, 0), "1,5");
  const dflt = E.createCalc(book1({ A1: 1.5, A2: '=A1&""' }));
  eq("Calc locale defaults to German", dflt.value("s1", 1, 0), "1,5");
  const nanWb = book1({ A1: { v: Number.NaN } });
  err("a broken number in a cell", val(nanWb, "A1"), "#NUM!");
}

// ==============================================================================================
// Workbook operations

const rr = (sheetId: string, a: string) => ({ sheetId, ...area(a) });
function chartOn(sheetId: string, id = "ch1"): ChartSpec {
  return {
    id,
    sheetId,
    at: { row: 8, col: 3, dx: 4, dy: 6 },
    size: { w: 480, h: 320 },
    kind: "scatter",
    title: "Kalibriergerade",
    x: rr(sheetId, "A2:A6"),
    series: [
      {
        id: "se1",
        name: "",
        nameRef: rr(sheetId, "B1"),
        y: rr(sheetId, "B2:B6"),
        x: null,
        color: null,
        marker: "circle",
        line: "none",
        labels: false,
        errorBars: { kind: "custom", value: 0, plus: rr(sheetId, "C2:C6"), minus: rr(sheetId, "C2:C6"), direction: "both" },
        trendline: null,
      },
    ],
    xAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    yAxis: { title: "", min: null, max: null, log: false, grid: true, decimals: null },
    legend: "none",
  };
}
function tableOn(sheetId: string, a = "A1:B6", id = "t1", name = "Tabelle1"): TableSpec {
  const ar = area(a);
  return {
    id,
    sheetId,
    name,
    area: ar,
    columns: Array.from({ length: ar.c1 - ar.c0 + 1 }, (_, i) => ({ id: `col${i + 1}`, total: "none" as const })),
    totals: false,
    style: "blue",
    banded: true,
    filters: { col2: { kind: "number", op: "gt", a: 0.15, b: null } },
    sort: { column: "col2", dir: "asc" },
  };
}
function lab(): Workbook {
  const s1 = mkSheet(
    "s1",
    "Blatt 1",
    { A1: "Konz", B1: "Ext", A2: 0, A3: 1, A4: 2, A5: 3, A6: 4, B2: 0.1, B3: 0.2, B4: 0.3, B5: 0.4, B6: 0.5, C2: "=A2*2", C3: "=A3*2", C4: "=A4*2", C5: "=A5*2", C6: "=A6*2", D1: "=SUM(B2:B6)", E1: "=B4" },
    { rows: { "3": { h: 40 } }, freeze: { rows: 1, cols: 0 } },
  );
  const s2 = mkSheet("s2", "Daten", { A1: "='Blatt 1'!B4", A2: "=SUM('Blatt 1'!B2:B6)", A3: "=A1" });
  return { v: 1, sheets: [s1, s2], charts: [chartOn("s1")], tables: [tableOn("s1")] };
}
const f = (wb: Workbook, a1: string, sheetId = "s1") => cellAt(wb, a1, sheetId)?.f;

section("ops: cells");
{
  const wb = book1({ A1: 1 });
  const w2 = O.setCells(wb, "s1", [{ row: 0, col: 1, cell: { v: "x" } }, { row: 249, col: 30, cell: { v: 2 } }]);
  eq("value set", cellAt(w2, "B1"), { v: "x" });
  eq("size grows", w2.sheets[0].size, { rows: 250, cols: 31 });
  eq("old workbook untouched", cellAt(wb, "B1"), undefined);
  const w3 = O.setCells(w2, "s1", [{ row: 0, col: 0, cell: null }, { row: 0, col: 1, cell: {} }, { row: 1, col: 1, cell: { v: undefined, s: { bold: true } } }]);
  eq("null removes", cellAt(w3, "A1"), undefined);
  eq("empty cell removed", cellAt(w3, "B1"), undefined);
  eq("undefined keys dropped", cellAt(w3, "B2"), { s: { bold: true } });
  eq("beyond the limits ignored", O.setCells(wb, "s1", [{ row: 20000, col: 0, cell: { v: 1 } }]).sheets[0].size, wb.sheets[0].size);
  eq("unknown sheet", O.setCells(wb, "nope", [{ row: 0, col: 0, cell: { v: 1 } }]), wb);
  const two = book(mkSheet("s1", "A"), mkSheet("s2", "B"));
  const two2 = O.setCells(two, "s1", [{ row: 0, col: 0, cell: { v: 1 } }]);
  check("other sheets are shared, not copied", two2.sheets[1] === two.sheets[1]);
  eq("getCell", O.getCell(two2, "s1", 0, 0), { v: 1 });

  const st = O.setStyle(book1({ A1: 1, B1: { v: 2, s: { italic: true } } }), "s1", [area("A1:B2")], { bold: true });
  eq("style merged", [cellAt(st, "A1"), cellAt(st, "B1"), cellAt(st, "A2")], [{ v: 1, s: { bold: true } }, { v: 2, s: { italic: true, bold: true } }, { s: { bold: true } }]);
  const st2 = O.setStyle(st, "s1", [area("A1:B2")], { bold: undefined });
  eq("undefined removes a setting", [cellAt(st2, "A1"), cellAt(st2, "B1"), cellAt(st2, "A2")], [{ v: 1 }, { v: 2, s: { italic: true } }, undefined]);
  const st3 = O.setStyle(st, "s1", [area("A1:A1")], () => ({ fill: "yellow" }));
  eq("function replaces", cellAt(st3, "A1"), { v: 1, s: { fill: "yellow" } });
  const st4 = O.setStyle(book1(), "s1", [{ r0: 0, c0: 0, r1: 99999, c1: 0 }], { fmt: { kind: "percent", decimals: 1 } });
  eq("whole column clipped to the grid", Object.keys(st4.sheets[0].cells).length, 200);
  const st5 = O.setStyle(book1({ A1: { v: 1, s: { border: { top: "thin" } } } }), "s1", [area("A1")], { border: { bottom: "thick" } });
  eq("border replaced as a whole", cellAt(st5, "A1")?.s, { border: { bottom: "thick" } });

  const cl = book1({ A1: { v: 1, s: { bold: true }, note: "n" }, A2: { f: "1+1", s: { italic: true } }, A3: 5 });
  eq("clear contents keeps look and note", cellAt(O.clearAreas(cl, "s1", [area("A1:A3")], "contents"), "A1"), { s: { bold: true }, note: "n" });
  eq("clear contents of formulas", cellAt(O.clearAreas(cl, "s1", [area("A1:A3")], "contents"), "A2"), { s: { italic: true } });
  eq("clear formats", cellAt(O.clearAreas(cl, "s1", [area("A1:A3")], "formats"), "A1"), { v: 1, note: "n" });
  eq("clear notes", cellAt(O.clearAreas(cl, "s1", [area("A1:A3")], "notes"), "A1"), { v: 1, s: { bold: true } });
  eq("clear all", Object.keys(O.clearAreas(cl, "s1", [area("A1:A3")], "all").sheets[0].cells).length, 0);
  eq("clear only the area", cellAt(O.clearAreas(cl, "s1", [area("A1:A2")], "all"), "A3"), { v: 5 });
}

section("ops: inserting and deleting rows");
{
  const wb = lab();
  const w = O.insertRows(wb, "s1", 3, 2);
  eq("cells move down", cellAt(w, "B6"), { v: 0.3 });
  eq("cells above stay", cellAt(w, "B3"), { v: 0.2 });
  eq("formula range grows", f(w, "D1"), "SUM(B2:B8)");
  eq("formula cell follows", f(w, "E1"), "B6");
  eq("moved formulas keep their rows", f(w, "C7"), "A7*2");
  eq("other sheet follows", f(w, "A1", "s2"), "'Blatt 1'!B6");
  eq("other sheet range grows", f(w, "A2", "s2"), "SUM('Blatt 1'!B2:B8)");
  eq("other sheet's own refs stay", f(w, "A3", "s2"), "A1");
  eq("same results", [val(w, "D1"), val(w, "E1"), val(w, "A1", "s2")], [1.5, 0.3, 0.3]);
  eq("row heights move", w.sheets[0].rows, { "5": { h: 40 } });
  eq("frozen rows stay above", w.sheets[0].freeze, { rows: 1, cols: 0 });
  eq("size grows", w.sheets[0].size.rows, 202);
  eq("chart ranges grow", [w.charts[0].x, w.charts[0].series[0].y], [rr("s1", "A2:A8"), rr("s1", "B2:B8")]);
  eq("chart name cell stays", w.charts[0].series[0].nameRef, rr("s1", "B1"));
  eq("chart error bar cells grow", w.charts[0].series[0].errorBars?.plus, rr("s1", "C2:C8"));
  eq("chart anchor moves", w.charts[0].at, { row: 10, col: 3, dx: 4, dy: 6 });
  eq("table grows", w.tables[0].area, area("A1:B8"));
  eq("original untouched", [cellAt(wb, "B6"), f(wb, "D1"), wb.tables[0].area], [{ v: 0.5 }, "SUM(B2:B6)", area("A1:B6")]);
  const top = O.insertRows(wb, "s1", 0, 1);
  eq("insert above everything: freeze grows", top.sheets[0].freeze.rows, 2);
  eq("table moves", top.tables[0].area, area("A2:B7"));
  eq("formula moves", f(top, "D2"), "SUM(B3:B7)");
  eq("chart name moves", top.charts[0].series[0].nameRef, rr("s1", "B2"));
  const full = { ...wb, sheets: [{ ...wb.sheets[0], cells: { ...wb.sheets[0].cells, [cellKey(19999, 0)]: { v: 1 } } }, wb.sheets[1]] };
  eq("refused when data would fall off", O.insertRows(full, "s1", 5, 1), full);

  const d = O.deleteRows(wb, "s1", 3, 1);
  eq("deleted reference is #REF!", f(d, "E1"), "#REF!");
  err("its value", val(d, "E1"), "#REF!");
  eq("range shrinks", f(d, "D1"), "SUM(B2:B5)");
  near("its value", val(d, "D1"), 1.2, 1e-12);
  eq("other sheet #REF!", f(d, "A1", "s2"), "#REF!");
  eq("other sheet range shrinks", f(d, "A2", "s2"), "SUM('Blatt 1'!B2:B5)");
  eq("cells move up", cellAt(d, "B4"), { v: 0.4 });
  eq("row height of the deleted row goes", d.sheets[0].rows, {});
  eq("table shrinks", d.tables[0].area, area("A1:B5"));
  eq("chart shrinks", d.charts[0].series[0].y, rr("s1", "B2:B5"));
  eq("size never below the default", d.sheets[0].size.rows, 200);
  // Every data row of the table: like Excel, it keeps one empty data row; ranges over the data
  // shrink to it (instead of #REF!), so the chart and the sum stay and can grow again.
  const allData = O.deleteRows(wb, "s1", 1, 5);
  eq("table keeps one empty data row", allData.tables[0].area, area("A1:B2"));
  eq("…emptied in every column", [cellAt(allData, "A2"), cellAt(allData, "B2"), cellAt(allData, "C2")], [undefined, undefined, undefined]);
  eq("…ranges over the data shrink to it", [f(allData, "D1"), f(allData, "A2", "s2")], ["SUM(B2:B2)", "SUM('Blatt 1'!B2:B2)"]);
  eq("…a deleted cell is still #REF!", f(allData, "E1"), "#REF!");
  eq("…the chart stays", [allData.charts.length, allData.charts[0].x, allData.charts[0].series[0].y, allData.charts[0].series[0].errorBars?.plus], [1, rr("s1", "A2:A2"), rr("s1", "B2:B2"), rr("s1", "C2:C2")]);
  eq("…its filters go (they could hide the row)", allData.tables[0].filters, {});
  eq("…the frozen row stays", allData.sheets[0].freeze.rows, 1);
  const noTable = O.deleteRows({ ...wb, tables: [] }, "s1", 1, 5);
  eq("without a table: chart without data goes", noTable.charts.length, 0);
  eq("…and the sum is #REF!", f(noTable, "D1"), "SUM(#REF!)");
  const header = O.deleteRows(wb, "s1", 0, 1);
  eq("table without header goes", header.tables.length, 0);
  eq("chart loses its name cell", header.charts[0].series[0].nameRef, null);
  eq("frozen rows shrink", header.sheets[0].freeze.rows, 0);
  const anchor = O.deleteRows(wb, "s1", 7, 3);
  eq("chart anchored in deleted rows moves up", anchor.charts[0].at, { row: 7, col: 3, dx: 4, dy: 0 });
  const totals = { ...wb, tables: [{ ...tableOn("s1"), totals: true }] };
  eq("deleting the totals row turns totals off", O.deleteRows(totals, "s1", 5, 1).tables[0].totals, false);
}

section("ops: inserting and deleting columns");
{
  const wb = lab();
  const w = O.insertCols(wb, "s1", 1, 1);
  eq("cells move right", cellAt(w, "C2"), { v: 0.1 });
  eq("formula moves and follows", f(w, "E1"), "SUM(C2:C6)");
  eq("formulas in moved cells", f(w, "D2"), "A2*2");
  eq("table grows", w.tables[0].area, area("A1:C6"));
  eq("table gets a column", w.tables[0].columns.map((c) => c.id.startsWith("col") ? c.id : "new"), ["col1", "new", "col2"]);
  eq("…with a header name (default German)", [cellAt(w, "A1")?.v, cellAt(w, "B1")?.v, cellAt(w, "C1")?.v], ["Konz", "Spalte2", "Ext"]);
  eq("…its data cells stay empty", cellAt(w, "B2"), undefined);
  eq("English name", cellAt(O.insertCols(wb, "s1", 1, 1, "en"), "B1")?.v, "Column2");
  const two = O.insertCols(wb, "s1", 1, 2, "de");
  eq("two new columns, two names", [cellAt(two, "B1")?.v, cellAt(two, "C1")?.v, cellAt(two, "D1")?.v], ["Spalte2", "Spalte3", "Ext"]);
  const taken = O.insertCols(O.setCells(wb, "s1", [{ row: 0, col: 1, cell: { v: "spalte2" } }]), "s1", 1, 1, "de");
  eq("unique in the table", [cellAt(taken, "B1")?.v, cellAt(taken, "C1")?.v], ["Spalte3", "spalte2"]);
  eq("no names outside tables", cellAt(O.insertCols(wb, "s1", 3, 1, "de"), "D1"), undefined);
  eq("chart follows", w.charts[0].series[0].y, rr("s1", "C2:C6"));
  eq("other sheet follows", f(w, "A2", "s2"), "SUM('Blatt 1'!C2:C6)");
  eq("size grows", w.sheets[0].size.cols, 27);
  const left = O.insertCols(wb, "s1", 0, 1);
  eq("insert left of a table moves it", left.tables[0].area, area("B1:C6"));
  eq("…without new columns", left.tables[0].columns.length, 2);
  const d = O.deleteCols(wb, "s1", 1, 1);
  eq("deleted column refs", f(d, "C1"), "SUM(#REF!)");
  eq("table loses the column", d.tables[0].columns.map((c) => c.id), ["col1"]);
  eq("its filter and sort go", [d.tables[0].filters, d.tables[0].sort], [{}, null]);
  eq("chart without its data goes", d.charts.length, 0);
  eq("widths move", O.insertCols(O.setColWidths(wb, "s1", [1], 150), "s1", 0, 2).sheets[0].cols, { "3": { w: 150 } });
  const gone = O.deleteCols(wb, "s1", 0, 2);
  eq("table wholly deleted goes", gone.tables.length, 0);
}

section("ops: smart tables keep their formulas, totals and references");
{
  // The lab table widened to A1:C6 so the doubled column C (=A2*2…) is a calculated column; B has 3 decimals.
  const fmt3 = { kind: "number" as const, decimals: 3 };
  const base = lab();
  const wb0: Workbook = { ...base, tables: [{ ...tableOn("s1", "A1:C6"), filters: {}, sort: null }] };
  const wb = O.setStyle(wb0, "s1", [area("B2:B6")], { fmt: fmt3 });
  const withTotals: Workbook = O.setCells({ ...wb, tables: [{ ...wb.tables[0], totals: true, area: area("A1:C7") }] }, "s1", [
    { row: 1, col: 0, cell: { v: 0 } },
    { row: 6, col: 0, cell: { v: "Ergebnis" } },
    { row: 6, col: 1, cell: { f: "SUBTOTAL(109,B2:B6)" } },
  ]);
  // (In withTotals the data rows are 2…6 and row 7 is the totals row; the old row 7 had nothing.)

  // Rows inserted between the data rows: calculated column and formats continue
  const mid = O.insertRows(wb, "s1", 3, 2);
  eq("calculated column continues", [f(mid, "C4"), f(mid, "C5"), f(mid, "C6")], ["A4*2", "A5*2", "A6*2"]);
  eq("number format continues", [cellAt(mid, "B4")?.s?.fmt, cellAt(mid, "B5")?.s?.fmt], [fmt3, fmt3]);
  eq("…no values", [cellAt(mid, "A4"), cellAt(mid, "B4")?.v], [undefined, undefined]);
  eq("ranges grow by themselves", [f(mid, "D1"), mid.charts[0].series[0].y], ["SUM(B2:B8)", rr("s1", "B2:B8")]);
  // Right under the header: ranges over the data take the new row in (Excel's structured references)
  const top = O.insertRows(wb, "s1", 1, 1);
  eq("under the header: table grows", top.tables[0].area, area("A1:C7"));
  eq("…calculated column (from the row below)", f(top, "C2"), "A2*2");
  eq("…format from the row below", cellAt(top, "B2")?.s?.fmt, fmt3);
  eq("…sum takes it in", f(top, "D1"), "SUM(B2:B7)");
  eq("…other sheet too", f(top, "A2", "s2"), "SUM('Blatt 1'!B2:B7)");
  eq("…chart x, y and error bars", [top.charts[0].x, top.charts[0].series[0].y, top.charts[0].series[0].errorBars?.plus], [rr("s1", "A2:A7"), rr("s1", "B2:B7"), rr("s1", "C2:C7")]);
  eq("…the legend name cell stays", top.charts[0].series[0].nameRef, rr("s1", "B1"));
  eq("…a single cell still moves", f(top, "E1"), "B5");
  // Right above the totals row
  const above = O.insertRows(withTotals, "s1", 6, 2);
  eq("above the totals row: table grows", above.tables[0].area, area("A1:C9"));
  eq("…totals cover every data row", f(above, "B9"), "SUBTOTAL(109,B2:B8)");
  eq("…sum and chart take them in", [f(above, "D1"), above.charts[0].series[0].y], ["SUM(B2:B8)", rr("s1", "B2:B8")]);
  eq("…calculated column", [f(above, "C7"), f(above, "C8")], ["A7*2", "A8*2"]);
  eq("…its value", val(O.setCells(above, "s1", [{ row: 6, col: 0, cell: { v: 7 } }]), "C7"), 14);
  const under = O.insertRows(withTotals, "s1", 1, 1);
  eq("under the header with totals", f(under, "B8"), "SUBTOTAL(109,B2:B7)");
  // Not the table's rows: nothing is filled
  const before = O.insertRows(wb, "s1", 0, 1);
  eq("above the table: no new row in it", [before.tables[0].area, cellAt(before, "C1")], [area("A2:C7"), undefined]);
  const after = O.insertRows(wb, "s1", 6, 1);
  eq("right below (no totals): not the table's", [after.tables[0].area, cellAt(after, "C7"), f(after, "D1")], [area("A1:C6"), undefined, "SUM(B2:B6)"]);
  // Two tables next to each other each fill their own columns
  const pair: Workbook = { ...wb, tables: [...wb.tables, { ...tableOn("s1", "E3:E5", "t2", "T2"), filters: {}, sort: null }] };
  const pairIns = O.insertRows(O.setCells(pair, "s1", [{ row: 2, col: 4, cell: { f: "A3+1" } }, { row: 3, col: 4, cell: { f: "A4+1" } }, { row: 4, col: 4, cell: { f: "A5+1" } }]), "s1", 4, 1);
  eq("two tables", [f(pairIns, "C5"), f(pairIns, "E5")], ["A5*2", "A5+1"]);

  // Deleting every data row: one empty row stays, with the calculated column's formula and the formats
  const all = O.deleteRows(wb, "s1", 1, 5);
  eq("one row stays", all.tables[0].area, area("A1:C2"));
  eq("…with the calculated column and the format", [cellAt(all, "A2"), cellAt(all, "B2"), cellAt(all, "C2")], [undefined, { s: { fmt: fmt3 } }, { f: "A2*2" }]);
  eq("…the kept row's height goes with what was in it", O.deleteRows(O.setRowHeights(wb, "s1", [1, 7], 50), "s1", 1, 5).sheets[0].rows, { "3": { h: 50 } });
  const allTot = O.deleteRows(withTotals, "s1", 1, 5);
  eq("with totals: header, one row, totals", [allTot.tables[0].area, allTot.tables[0].totals], [area("A1:C3"), true]);
  eq("…the totals still add up the data row", [f(allTot, "B3"), val(allTot, "B3"), cellAt(allTot, "A3")?.v], ["SUBTOTAL(109,B2:B2)", 0, "Ergebnis"]);
  const allAndTotals = O.deleteRows(withTotals, "s1", 1, 6);
  eq("data and totals rows deleted: one row, no totals", [allAndTotals.tables[0].area, allAndTotals.tables[0].totals], [area("A1:C2"), false]);
  const last = O.deleteRows(O.deleteRows(wb, "s1", 2, 4), "s1", 1, 1);
  eq("the last data row deleted: emptied instead", [last.tables[0].area, cellAt(last, "A2"), f(last, "C2")], [area("A1:C2"), undefined, "A2*2"]);
  const further = O.setCells(wb, "s1", [{ row: 9, col: 0, cell: { v: "unten" } }, { row: 7, col: 5, cell: { v: "daneben" } }]);
  const past = O.deleteRows(further, "s1", 1, 7);
  eq("deleting past the table: the rest moves up by one less", [cellAt(past, "A4")?.v, past.tables[0].area], ["unten", area("A1:C2")]);
  eq("…deleted cells beside the table are gone", Object.keys(past.sheets[0].cells).filter((k) => k.endsWith(",5")), []);
  const besideHeader: Workbook = { ...wb, tables: [...wb.tables, { ...tableOn("s1", "E2:E4", "t2", "T2"), filters: {}, sort: null }] };
  eq("a table whose header was deleted goes", O.deleteRows(besideHeader, "s1", 1, 5).tables.map((t) => t.id), ["t1"]);
  const anchored = O.deleteRows({ ...wb, charts: [{ ...chartOn("s1"), at: { row: 3, col: 3, dx: 4, dy: 6 } }] }, "s1", 1, 5);
  eq("a chart anchored in the deleted rows moves to the first", anchored.charts[0].at, { row: 1, col: 3, dx: 4, dy: 0 });

  // growTableReferences directly: formulas everywhere and chart ranges
  const t = wb.tables[0];
  const grown = O.growTableReferences(wb, t, { r0: 1, r1: 5 }, { r0: 1, r1: 6 });
  eq("formulas on both sheets", [f(grown, "D1"), f(grown, "A2", "s2"), f(grown, "E1")], ["SUM(B2:B7)", "SUM('Blatt 1'!B2:B7)", "B4"]);
  eq("chart ranges", [grown.charts[0].x, grown.charts[0].series[0].y, grown.charts[0].series[0].errorBars?.plus, grown.charts[0].series[0].nameRef], [rr("s1", "A2:A7"), rr("s1", "B2:B7"), rr("s1", "C2:C7"), rr("s1", "B1")]);
  check("unchanged workbook when nothing points there", O.growTableReferences(wb, t, { r0: 2, r1: 5 }, { r0: 2, r1: 6 }) === wb);
  check("…or nothing changes", O.growTableReferences(wb, t, { r0: 1, r1: 5 }, { r0: 1, r1: 5 }) === wb);
}

section("ops: speed on a big sheet");
{
  const big: Record<string, CellInput> = {};
  for (let r = 1; r <= 5000; r++) {
    for (const c of "ABCDEFGHI") big[`${c}${r}`] = (r * 7919 + c.charCodeAt(0)) % 1000;
    big[`J${r}`] = `=A${r}*B${r}+SUM(C${r}:I${r})`;
  }
  big.K1 = "=SUM(J1:J5000)";
  const wb = book(mkSheet("s1", "Blatt 1", big), mkSheet("s2", "Daten", { A1: "=SUM('Blatt 1'!J1:J5000)" }));
  const time = (name: string, limit: number, run: () => Workbook) => {
    const t0 = performance.now();
    const out = run();
    const ms = performance.now() - t0;
    check(`${name} in ${ms.toFixed(0)} ms (< ${limit})`, ms < limit);
    timings.push(`${name} ${ms.toFixed(0)} ms`);
    return out;
  };
  const ins = time("insert a row into 50,000 cells", 400, () => O.insertRows(wb, "s1", 10, 1));
  eq("…formulas followed", [f(ins, "K1"), f(ins, "A1", "s2")], ["SUM(J1:J5001)", "SUM('Blatt 1'!J1:J5001)"]);
  const c = calcOf(wb);
  const sorted = time("sort 5,000 rows", 600, () => O.sortArea(wb, c, "s1", area("A1:J5000"), [{ col: 0, dir: "asc" }], "de"));
  const sc = calcOf(sorted);
  let ascending = true;
  for (let r = 1; r < 5000; r++) if ((sc.value("s1", r, 0) as number) < (sc.value("s1", r - 1, 0) as number)) ascending = false;
  check("…sorted", ascending);
  near("…same total after sorting", sc.value("s1", 0, 10), c.value("s1", 0, 10) as number, 1e-12);
  const filled = time("fill a formula down 5,000 rows", 400, () => O.fillArea(wb, c, "s1", area("L1"), area("L1:L5000"), "de"));
  eq("…shifted", f(filled, "L5000"), undefined);
  const withL = O.setCells(wb, "s1", [{ row: 0, col: 11, cell: { f: "J1*2" } }]);
  const filled2 = time("fill a formula down 5,000 rows (again)", 400, () => O.fillArea(withL, calcOf(withL), "s1", area("L1"), area("L1:L5000"), "de"));
  eq("…shifted", f(filled2, "L5000"), "J5000*2");
  time("paste 5,000 × 10 cells", 600, () => O.pasteClip(wb, c, "s1", area("M1"), O.copyArea(wb, "s1", area("A1:J5000")), { mode: "all" }));
  time("rename a sheet used in formulas", 300, () => O.renameSheet(wb, "s1", "Messwerte"));
}

section("ops: insert then delete changes nothing");
{
  let seed = 4242;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(rnd() * n);
  const letter = (c: number) => String.fromCharCode(65 + c);
  const a1 = (r: number, c: number) => letter(c) + String(r + 1);
  let problems = 0;
  for (let round = 0; round < 40; round++) {
    const cells: Record<string, CellInput> = {};
    for (let r = 0; r < 12; r++) for (let c = 0; c < 6; c++) cells[a1(r, c)] = int(100);
    for (let k = 0; k < 15; k++) {
      const r = 12 + int(6);
      const c = int(6);
      const r0 = int(12);
      const c0 = int(5);
      const kind = int(4);
      const formulas = [
        "=" + a1(r0, c0) + "*2",
        "=SUM(" + a1(r0, c0) + ":" + a1(Math.min(11, r0 + int(5)), c0 + 1) + ")",
        "=" + "$" + letter(c0) + "$" + String(r0 + 1) + "+Daten!A1",
        "=AVERAGE(" + letter(c0) + ":" + letter(c0) + ")",
      ];
      cells[a1(r, c)] = formulas[kind];
    }
    const wb = book(mkSheet("s1", "Blatt 1", cells), mkSheet("s2", "Daten", { A1: 1, A2: "='Blatt 1'!B3+'Blatt 1'!C5" }));
    const rows = rnd() < 0.5;
    const at = int(20);
    const count = 1 + int(3);
    const ins = rows ? O.insertRows(wb, "s1", at, count) : O.insertCols(wb, "s1", at, count);
    const back = rows ? O.deleteRows(ins, "s1", at, count) : O.deleteCols(ins, "s1", at, count);
    // The sheet's log of row and column changes (Sheet.log) records both steps; everything else comes back.
    const content = (w: Workbook) => show(w.sheets.map(({ log, ...rest }) => (void log, rest)));
    if (content(back) !== content(wb) && problems++ < 3) check(`round ${round}: ${rows ? "rows" : "cols"} at ${at}×${count} comes back`, false);
    // Every value stays the same where its cell went.
    const c1 = calcOf(wb);
    const c2 = calcOf(ins);
    for (const key of Object.keys(wb.sheets[0].cells)) {
      const [r, c] = key.split(",").map(Number);
      const nr = rows && r >= at ? r + count : r;
      const nc = !rows && c >= at ? c + count : c;
      if (show(c1.value("s1", r, c)) !== show(c2.value("s1", nr, nc)) && problems++ < 3) check(`round ${round}: value of ${key} kept`, false, `${show(c1.value("s1", r, c))} vs ${show(c2.value("s1", nr, nc))}`);
    }
    if (show(c1.value("s2", 1, 0)) !== show(c2.value("s2", 1, 0)) && problems++ < 3) check(`round ${round}: other sheet kept`, false);
  }
  check(`40 random workbooks: insert/delete is lossless and values stay (${problems} problems)`, problems === 0);
}

section("ops: sizes, hiding, freezing");
{
  const wb = book1();
  const w = O.setColWidths(wb, "s1", [0, 1], 150);
  eq("widths", w.sheets[0].cols, { "0": { w: 150 }, "1": { w: 150 } });
  eq("back to default", O.setColWidths(w, "s1", [0], null).sheets[0].cols, { "1": { w: 150 } });
  eq("widths clamped", O.setColWidths(wb, "s1", [0], 5).sheets[0].cols, { "0": { w: 16 } });
  const h = O.setRowHeights(wb, "s1", [2], 40);
  eq("heights", h.sheets[0].rows, { "2": { h: 40 } });
  const hid = O.setHidden(h, "s1", "rows", [2, 3], true);
  eq("hidden rows", hid.sheets[0].rows, { "2": { h: 40, hidden: true }, "3": { hidden: true } });
  eq("shown again", O.setHidden(hid, "s1", "rows", [2, 3], false).sheets[0].rows, { "2": { h: 40 } });
  eq("hidden columns", O.setHidden(wb, "s1", "cols", [4], true).sheets[0].cols, { "4": { hidden: true } });
  eq("freeze", O.setFreeze(wb, "s1", 2, 1).sheets[0].freeze, { rows: 2, cols: 1 });
  eq("freeze negative", O.setFreeze(wb, "s1", -1, 0).sheets[0].freeze, { rows: 0, cols: 0 });
  eq("same freeze is the same workbook", O.setFreeze(wb, "s1", 0, 0), wb);
}

section("ops: copy and paste");
{
  const wb = lab();
  const c = calcOf(wb);
  const clip = O.copyArea(wb, "s1", area("A2:C3"));
  eq("clip", clip.cells, [
    [{ v: 0 }, { v: 0.1 }, { f: "A2*2" }],
    [{ v: 1 }, { v: 0.2 }, { f: "A3*2" }],
  ]);
  const all = O.pasteClip(wb, c, "s1", area("E10"), clip, { mode: "all" });
  eq("paste all shifts formulas", [cellAt(all, "E10"), f(all, "G10"), f(all, "G11")], [{ v: 0 }, "E10*2", "E11*2"]);
  eq("paste values", cellAt(O.pasteClip(wb, c, "s1", area("E10"), clip, { mode: "values" }), "G11"), { v: 2 });
  const styled = O.setStyle(wb, "s1", [area("A2")], { bold: true, fmt: { kind: "number", decimals: 2 } });
  const sclip = O.copyArea(styled, "s1", area("A2:A2"));
  const target = O.setCells(styled, "s1", [{ row: 9, col: 4, cell: { v: 7, s: { italic: true } } }]);
  eq("paste formats only", cellAt(O.pasteClip(target, calcOf(target), "s1", area("E10"), sclip, { mode: "formats" }), "E10"), { v: 7, s: { bold: true, fmt: { kind: "number", decimals: 2 } } });
  eq("paste values keeps the target look, takes the number format", cellAt(O.pasteClip(target, calcOf(target), "s1", area("E10"), sclip, { mode: "values" }), "E10"), { v: 0, s: { italic: true, fmt: { kind: "number", decimals: 2 } } });
  eq("paste formulas keeps the target look", cellAt(O.pasteClip(target, calcOf(target), "s1", area("E10"), O.copyArea(wb, "s1", area("C3")), { mode: "formulas" }), "E10"), { f: "C10*2", s: { italic: true } });
  const errClip = O.copyArea(book1({ A1: "=1/0" }), "s1", area("A1"));
  eq("paste values of an error keeps the error", cellAt(O.pasteClip(wb, calcOf(book1({ A1: "=1/0" })), "s1", area("H1"), errClip, { mode: "values" }), "H1"), { f: "#DIV/0!" });
  const tr = O.pasteClip(wb, c, "s1", area("E10"), clip, { mode: "all", transpose: true });
  eq("transpose", [cellAt(tr, "E10"), cellAt(tr, "F10"), cellAt(tr, "E11"), cellAt(tr, "F11")], [{ v: 0 }, { v: 1 }, { v: 0.1 }, { v: 0.2 }]);
  eq("transposed formulas point at the transposed data", [f(tr, "E12"), f(tr, "F12")], ["E10*2", "F10*2"]);
  eq("…and compute the same", [val(tr, "E12"), val(tr, "F12")], [0, 2]);
  eq("transposeFormula keeps absolute refs", E.transposeFormula("$A$1+B1", 0, 2, 5, 5), "$A$1+F5");
  const rep = O.pasteClip(wb, c, "s1", area("E10:G13"), clip, { mode: "all" });
  eq("repeats to fill a multiple", [cellAt(rep, "E12"), f(rep, "G13")], [{ v: 0 }, "E13*2"]);
  const once = O.pasteClip(wb, c, "s1", area("E10:G12"), clip, { mode: "all" });
  eq("pastes once otherwise", cellAt(once, "E12"), undefined);
  const empty = O.pasteClip(wb, c, "s1", area("A2"), O.copyArea(wb, "s1", area("H1")), { mode: "all" });
  eq("empty cells clear", cellAt(empty, "A2"), undefined);

  const cut = O.pasteClip(wb, c, "s1", area("F2"), O.copyArea(wb, "s1", area("B2:B6")), { mode: "all", cut: true });
  eq("cut: cells move", [cellAt(cut, "F2"), cellAt(cut, "B2")], [{ v: 0.1 }, undefined]);
  eq("cut: references follow", [f(cut, "D1"), f(cut, "E1")], ["SUM(F2:F6)", "F4"]);
  eq("cut: other sheets follow", f(cut, "A2", "s2"), "SUM('Blatt 1'!F2:F6)");
  eq("cut: chart follows", cut.charts[0].series[0].y, rr("s1", "F2:F6"));
  eq("cut: same values", [val(cut, "D1"), val(cut, "A1", "s2")], [1.5, 0.3]);
  const cutF = O.pasteClip(wb, c, "s1", area("H2"), O.copyArea(wb, "s1", area("A2:C2")), { mode: "all", cut: true });
  eq("cut formulas keep pointing at the moved cells", f(cutF, "J2"), "H2*2");
  eq("…and at cells that stayed", f(O.pasteClip(wb, c, "s1", area("H5"), O.copyArea(wb, "s1", area("C5")), { mode: "all", cut: true }), "H5"), "A5*2");
  const overlap = O.pasteClip(wb, c, "s1", area("A3"), O.copyArea(wb, "s1", area("A2:A3")), { mode: "all", cut: true });
  eq("cut onto itself, shifted by one", [cellAt(overlap, "A2"), cellAt(overlap, "A3"), cellAt(overlap, "A4")], [undefined, { v: 0 }, { v: 1 }]);
  const across = O.pasteClip(wb, c, "s2", area("D1"), O.copyArea(wb, "s1", area("B2:B6")), { mode: "all", cut: true });
  eq("cut to another sheet", [cellAt(across, "D1", "s2"), f(across, "D1")], [{ v: 0.1 }, "SUM(Daten!D1:D5)"]);
  eq("cut to another sheet: chart follows", across.charts[0].series[0].y, rr("s2", "D1:D5"));
  near("cut to another sheet: same sum", val(across, "D1"), 1.5, 1e-12);

  const orphan = O.pasteClip(book1(), calcOf(book1()), "s1", area("B2"), { sheetId: "gone", area: area("A1"), cells: [[{ v: 5 }]] }, { mode: "all", cut: true });
  eq("cut from a deleted sheet pastes instead", cellAt(orphan, "B2"), { v: 5 });
  const txt = O.pasteText(book1(), "s1", { row: 0, col: 0 }, [["1,5", "1.11.2026", "abc"], ["=SUMME(A1;1)", "50 %", "=SUMME("]], "de");
  eq("paste text: numbers", cellAt(txt, "A1"), { v: 1.5 });
  eq("paste text: dates get a format", cellAt(txt, "B1"), { v: 46327, s: { fmt: { kind: "date", style: "short" } } });
  eq("paste text: text", cellAt(txt, "C1"), { v: "abc" });
  eq("paste text: formulas", cellAt(txt, "A2"), { f: "SUM(A1,1)" });
  eq("paste text: percent", cellAt(txt, "B2"), { v: 0.5, s: { fmt: { kind: "percent", decimals: 0 } } });
  eq("paste text: broken formula stays text", cellAt(txt, "C2"), { v: "=SUMME(" });
  const keep = O.pasteText(book1({ A1: { v: 1, s: { bold: true, fmt: { kind: "number", decimals: 3 } } } }), "s1", { row: 0, col: 0 }, [["2,5"]], "de");
  eq("paste text keeps the look", cellAt(keep, "A1"), { v: 2.5, s: { bold: true, fmt: { kind: "number", decimals: 3 } } });
  eq("paste text en", cellAt(O.pasteText(book1(), "s1", { row: 0, col: 0 }, [["1,234.5"]], "en"), "A1")?.v, 1234.5);
}

section("ops: fill handle");
{
  const fill = (cells: Record<string, CellInput>, from: string, to: string, locale: Locale = "de") => {
    const wb = book1(cells);
    return O.fillArea(wb, calcOf(wb), "s1", area(from), area(to), locale);
  };
  const vals = (wb: Workbook, cells: string[]) => cells.map((a) => cellAt(wb, a)?.v ?? cellAt(wb, a)?.f ?? null);
  eq("1, 2 → 3, 4, 5", vals(fill({ A1: 1, A2: 2 }, "A1:A2", "A1:A5"), ["A3", "A4", "A5"]), [3, 4, 5]);
  eq("0,5; 1 → 1,5; 2", vals(fill({ A1: 0.5, A2: 1 }, "A1:A2", "A1:A4"), ["A3", "A4"]), [1.5, 2]);
  eq("0,1 steps stay clean", vals(fill({ A1: 0.1, A2: 0.2 }, "A1:A2", "A1:A4"), ["A3", "A4"]), [0.3, 0.4]);
  eq("one number copies", vals(fill({ A1: 5 }, "A1", "A1:A3"), ["A2", "A3"]), [5, 5]);
  const tr = vals(fill({ A1: 1, A2: 3, A3: 4 }, "A1:A3", "A1:A5"), ["A4", "A5"]);
  check("uneven steps follow the trend line", Math.abs((tr[0] as number) - 17 / 3) < 1e-12 && Math.abs((tr[1] as number) - 43 / 6) < 1e-12, show(tr));
  const day = { v: 46327, s: { fmt: { kind: "date" as const, style: "short" as const } } };
  eq("a date continues by day", vals(fill({ A1: day }, "A1", "A1:A3"), ["A2", "A3"]), [46328, 46329]);
  eq("dates keep their format", cellAt(fill({ A1: day }, "A1", "A1:A2"), "A2")?.s, day.s);
  const D = (y: number, m: number, d: number) => ({ v: E.serialFromYMD(y, m, d), s: day.s });
  eq("monthly", vals(fill({ A1: D(2026, 1, 15), A2: D(2026, 2, 15) }, "A1:A2", "A1:A4"), ["A3", "A4"]), [E.serialFromYMD(2026, 3, 15), E.serialFromYMD(2026, 4, 15)]);
  eq("yearly", vals(fill({ A1: D(2026, 3, 1), A2: D(2027, 3, 1) }, "A1:A2", "A1:A3"), ["A3"]), [E.serialFromYMD(2028, 3, 1)]);
  eq("month ends", vals(fill({ A1: D(2026, 1, 31), A2: D(2026, 2, 28) }, "A1:A2", "A1:A4"), ["A3", "A4"]), [E.serialFromYMD(2026, 3, 31), E.serialFromYMD(2026, 4, 30)]);
  eq("31st of each month clamps", vals(fill({ A1: D(2026, 1, 31), A2: D(2026, 3, 31) }, "A1:A2", "A1:A3"), ["A3"]), [E.serialFromYMD(2026, 5, 31)]);
  eq("weekly", vals(fill({ A1: D(2026, 11, 2), A2: D(2026, 11, 9) }, "A1:A2", "A1:A3"), ["A3"]), [E.serialFromYMD(2026, 11, 16)]);
  const time = { v: 14 / 24, s: { fmt: { kind: "time" as const, seconds: false } } };
  near("a time continues by hour", cellAt(fill({ A1: time }, "A1", "A1:A2"), "A2")?.v, 15 / 24, 1e-12);
  eq("Probe 1 → Probe 2", vals(fill({ A1: "Probe 1" }, "A1", "A1:A3"), ["A2", "A3"]), ["Probe 2", "Probe 3"]);
  eq("Probe 01 keeps zeros", vals(fill({ A1: "Probe 01" }, "A1", "A1:A2"), ["A2"]), ["Probe 02"]);
  eq("Probe 1, Probe 3 → Probe 5", vals(fill({ A1: "Probe 1", A2: "Probe 3" }, "A1:A2", "A1:A3"), ["A3"]), ["Probe 5"]);
  eq("1. Woche → 2. Woche", vals(fill({ A1: "1. Woche" }, "A1", "A1:A2"), ["A2"]), ["2. Woche"]);
  eq("Montag → Dienstag", vals(fill({ A1: "Montag" }, "A1", "A1:A3"), ["A2", "A3"]), ["Dienstag", "Mittwoch"]);
  eq("So → Mo (wraps)", vals(fill({ A1: "So" }, "A1", "A1:A2"), ["A2"]), ["Mo"]);
  eq("Januar → Februar", vals(fill({ A1: "Januar" }, "A1", "A1:A2"), ["A2"]), ["Februar"]);
  eq("Dez → Jan", vals(fill({ A1: "Dez" }, "A1", "A1:A2"), ["A2"]), ["Jan"]);
  eq("Feb → Mrz", vals(fill({ A1: "Feb", A2: "Mrz" }, "A1:A2", "A1:A3"), ["A3"]), ["Apr"]);
  eq("Monday → Tuesday", vals(fill({ A1: "Monday" }, "A1", "A1:A2"), ["A2"]), ["Tuesday"]);
  eq("Mon → Tue", vals(fill({ A1: "Mon" }, "A1", "A1:A2"), ["A2"]), ["Tue"]);
  eq("Mar → Apr (English)", vals(fill({ A1: "Mar" }, "A1", "A1:A2"), ["A2"]), ["Apr"]);
  eq("MONTAG → DIENSTAG", vals(fill({ A1: "MONTAG" }, "A1", "A1:A2"), ["A2"]), ["DIENSTAG"]);
  eq("Jan, Mrz → Mai (step 2)", vals(fill({ A1: "Jan", A2: "Mrz" }, "A1:A2", "A1:A3"), ["A3"]), ["Mai"]);
  eq("formulas shift down", vals(fill({ A1: 1, B1: "=A1*2" }, "B1", "B1:B3"), ["B2", "B3"]), ["A2*2", "A3*2"]);
  eq("formulas shift right", vals(fill({ A1: "=A2*2" }, "A1", "A1:C1"), ["B1", "C1"]), ["B2*2", "C2*2"]);
  eq("absolute parts stay", vals(fill({ A1: "=$A$5*B1" }, "A1", "A1:A2"), ["A2"]), ["$A$5*B2"]);
  eq("fill up runs backwards", vals(fill({ A5: 3, A6: 4 }, "A5:A6", "A3:A6"), ["A3", "A4"]), [1, 2]);
  eq("fill left runs backwards", vals(fill({ C1: "Probe 3" }, "C1", "A1:C1"), ["A1", "B1"]), ["Probe 1", "Probe 2"]);
  eq("formulas filled up", vals(fill({ A3: "=B3" }, "A3", "A1:A3"), ["A1", "A2"]), ["B1", "B2"]);
  const bold = fill({ A1: { v: 1, s: { bold: true } } }, "A1", "A1:A2");
  eq("styles copy", cellAt(bold, "A2"), { v: 1, s: { bold: true } });
  eq("mixed blocks repeat", vals(fill({ A1: "a", A2: 1 }, "A1:A2", "A1:A6"), ["A3", "A4", "A5", "A6"]), ["a", 1, "a", 1]);
  eq("mixed: text numbers count up per round", vals(fill({ A1: "Probe 1", A2: "x" }, "A1:A2", "A1:A4"), ["A3", "A4"]), ["Probe 2", "x"]);
  eq("plain text copies", vals(fill({ A1: "Wasser" }, "A1", "A1:A2"), ["A2"]), ["Wasser"]);
  eq("TRUE copies", vals(fill({ A1: true }, "A1", "A1:A2"), ["A2"]), [true]);
  eq("empty source clears", cellAt(fill({ A2: 5 }, "A1", "A1:A2"), "A2"), undefined);
  eq("several columns at once", vals(fill({ A1: 1, A2: 2, B1: "Mo", B2: "Di" }, "A1:B2", "A1:B3"), ["A3", "B3"]), [3, "Mi"]);
  eq("same area: nothing", fill({ A1: 1 }, "A1", "A1"), book1({ A1: 1 }));
  const noted = fill({ A1: { v: 1, note: "n" }, A2: { v: 9, note: "keep" } }, "A1", "A1:A3");
  eq("notes stay with their cell", [cellAt(noted, "A2"), cellAt(noted, "A3")], [{ v: 1, note: "keep" }, { v: 1 }]);
}

section("ops: sort");
{
  const data = book1({ A1: 3, A2: "b", A3: true, A5: 1, A6: "=NA()", A7: "a", B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, B6: 6, B7: 7 });
  const asc = O.sortArea(data, calcOf(data), "s1", area("A1:B7"), [{ col: 0, dir: "asc" }], "de");
  const col = (wb: Workbook, c: string, n = 7) => Array.from({ length: n }, (_, i) => cellAt(wb, `${c}${i + 1}`)?.v ?? cellAt(wb, `${c}${i + 1}`)?.f ?? null);
  eq("ascending: numbers, text, booleans, errors, empty", col(asc, "A"), [1, 3, "a", "b", true, "NA()", null]);
  eq("whole rows move", col(asc, "B"), [5, 1, 7, 2, 3, 6, 4]);
  const desc = O.sortArea(data, calcOf(data), "s1", area("A1:B7"), [{ col: 0, dir: "desc" }], "de");
  eq("descending: errors, booleans, text, numbers, empty last", col(desc, "A"), ["NA()", true, "b", "a", 3, 1, null]);
  const st = book1({ A1: 1, B1: "x", A2: 2, B2: "y", A3: 1, B3: "z" });
  eq("stable", col(O.sortArea(st, calcOf(st), "s1", area("A1:B3"), [{ col: 0, dir: "asc" }], "de"), "B", 3), ["x", "z", "y"]);
  const two = book1({ A1: 1, B1: "b", A2: 2, B2: "a", A3: 1, B3: "a" });
  eq("two keys", col(O.sortArea(two, calcOf(two), "s1", area("A1:B3"), [{ col: 0, dir: "asc" }, { col: 1, dir: "asc" }], "de"), "B", 3), ["a", "b", "a"]);
  const words = book1({ A1: "Zebra", A2: "Äpfel", A3: "Birne", A4: "apfel" });
  eq("German order", col(O.sortArea(words, calcOf(words), "s1", area("A1:A4"), [{ col: 0, dir: "asc" }], "de"), "A", 4), ["apfel", "Äpfel", "Birne", "Zebra"]);
  const nums = book1({ A1: "Probe 10", A2: "Probe 2" });
  eq("text compares like text (as Excel)", col(O.sortArea(nums, calcOf(nums), "s1", area("A1:A2"), [{ col: 0, dir: "asc" }], "de"), "A", 2), ["Probe 10", "Probe 2"]);
  const fx = book1({ A1: 3, B1: "=A1*2", A2: 1, B2: "=A2*2", C1: "=SUM(A1:A2)" });
  const fs = O.sortArea(fx, calcOf(fx), "s1", area("A1:B2"), [{ col: 0, dir: "asc" }], "de");
  eq("formulas move with their row", [f(fs, "B1"), f(fs, "B2")], ["A1*2", "A2*2"]);
  eq("and still compute", [val(fs, "B1"), val(fs, "B2")], [2, 6]);
  eq("formulas outside unchanged", f(fs, "C1"), "SUM(A1:A2)");
  eq("sort by a formula column", col(O.sortArea(fx, calcOf(fx), "s1", area("A1:B2"), [{ col: 1, dir: "desc" }], "de"), "A", 2), [3, 1]);
  eq("already sorted: same workbook", O.sortArea(st, calcOf(st), "s1", area("A1:A1"), [{ col: 0, dir: "asc" }], "de"), st);
  const styled = book1({ A1: { v: 2, s: { bold: true } }, A2: 1 });
  eq("look moves with the row", cellAt(O.sortArea(styled, calcOf(styled), "s1", area("A1:A2"), [{ col: 0, dir: "asc" }], "de"), "A2"), { v: 2, s: { bold: true } });
}

section("ops: find and replace");
{
  const wb = book(mkSheet("s1", "Blatt 1", { A1: "Probe 1", B1: 1.5, A2: "probe 2", B2: "=SUMME(B1)".replace("SUMME", "SUM"), A3: "Wasser" }), mkSheet("s2", "Daten", { A1: "Probe X" }));
  const c = calcOf(wb);
  eq("find any case, all sheets, in order", O.findCells(wb, c, "probe", {}, "de"), [
    { sheetId: "s1", row: 0, col: 0 },
    { sheetId: "s1", row: 1, col: 0 },
    { sheetId: "s2", row: 0, col: 0 },
  ]);
  eq("match case", O.findCells(wb, c, "Probe", { matchCase: true }, "de").length, 2);
  eq("one sheet", O.findCells(wb, c, "Probe", { sheetId: "s2" }, "de"), [{ sheetId: "s2", row: 0, col: 0 }]);
  eq("whole cell", O.findCells(wb, c, "wasser", { wholeCell: true }, "de"), [{ sheetId: "s1", row: 2, col: 0 }]);
  eq("whole cell no partial", O.findCells(wb, c, "Wass", { wholeCell: true }, "de"), []);
  eq("shown text (German number)", O.findCells(wb, c, "1,5", {}, "de"), [
    { sheetId: "s1", row: 0, col: 1 },
    { sheetId: "s1", row: 1, col: 1 },
  ]);
  eq("in formulas (German names)", O.findCells(wb, c, "SUMME", { inFormulas: true }, "de"), [{ sheetId: "s1", row: 1, col: 1 }]);
  eq("wildcards", O.findCells(wb, c, "P?obe*X", {}, "de"), [{ sheetId: "s2", row: 0, col: 0 }]);
  eq("nothing for empty query", O.findCells(wb, c, "", {}, "de"), []);
  const r = O.replaceCells(wb, c, "probe", "Sample", {}, "de");
  eq("replace count", r.count, 3);
  eq("replaced", [cellAt(r.wb, "A1")?.v, cellAt(r.wb, "A2")?.v, cellAt(r.wb, "A1", "s2")?.v], ["Sample 1", "Sample 2", "Sample X"]);
  eq("formulas untouched without inFormulas", f(r.wb, "B2"), "SUM(B1)");
  const rf = O.replaceCells(wb, c, "B1", "A3", { inFormulas: true }, "de");
  eq("replace in formulas", [f(rf.wb, "B2"), rf.count], ["SUM(A3)", 1]);
  const broken = O.replaceCells(wb, c, "(", "", { inFormulas: true }, "de");
  eq("a replacement that breaks a formula is skipped", f(broken.wb, "B2"), "SUM(B1)");
  const nr = O.replaceCells(book1({ A1: 1.5 }), calcOf(book1({ A1: 1.5 })), "5", "7", {}, "de");
  eq("replace in numbers", cellAt(nr.wb, "A1"), { v: 1.7 });
  const whole = O.replaceCells(wb, c, "Wasser", "H2O", { wholeCell: true }, "de");
  eq("replace whole cell", [cellAt(whole.wb, "A3")?.v, whole.count], ["H2O", 1]);
  eq("replace match case", O.replaceCells(wb, c, "probe", "x", { matchCase: true }, "de").count, 1);
}

section("ops: sheets");
{
  const wb = lab();
  const a = O.addSheet(wb, "de");
  eq("new sheet named", a.wb.sheets.map((s) => s.name), ["Blatt 1", "Daten", "Blatt 3"]);
  eq("new sheet is empty", a.wb.sheets[2], { id: a.sheetId, name: "Blatt 3", cells: {}, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } });
  eq("English name", O.addSheet(book1(), "en").wb.sheets[1].name, "Sheet 2");
  eq("German name", O.addSheet(book1(), "de").wb.sheets[1].name, "Blatt 2");
  eq("given name", O.addSheet(wb, "de", "Messung").wb.sheets[2].name, "Messung");
  eq("given name taken", O.addSheet(wb, "de", "daten").wb.sheets[2].name, "daten (2)");
  eq("at an index", O.addSheet(wb, "de", undefined, 0).wb.sheets[0].name, "Blatt 3");
  const r = O.renameSheet(wb, "s1", "Messung 1");
  eq("renamed", r.sheets[0].name, "Messung 1");
  eq("formulas follow the name", [f(r, "A1", "s2"), f(r, "A2", "s2")], ["'Messung 1'!B4", "SUM('Messung 1'!B2:B6)"]);
  eq("values still right", val(r, "A2", "s2"), 1.5);
  eq("invalid name refused", O.renameSheet(wb, "s1", "a/b"), wb);
  eq("taken name refused", O.renameSheet(wb, "s1", "DATEN"), wb);
  eq("only the case changes", O.renameSheet(wb, "s2", "DATEN").sheets[1].name, "DATEN");
  eq("same name: same workbook", O.renameSheet(wb, "s1", "Blatt 1"), wb);
  const d = O.deleteSheet(wb, "s1");
  eq("deleted", d.sheets.map((s) => s.id), ["s2"]);
  eq("references become #REF!", [f(d, "A1", "s2"), f(d, "A2", "s2")], ["#REF!", "SUM(#REF!)"]);
  eq("its charts and tables go", [d.charts.length, d.tables.length], [0, 0]);
  eq("the last sheet stays", O.deleteSheet(d, "s2"), d);
  // A ' in a sheet name is written twice in formulas ('Paul''s Daten'!A5): they still follow
  const apos = book(mkSheet("s1", "Paul's Daten", { A5: 5 }), mkSheet("s2", "Blatt 2", { A1: "='Paul''s Daten'!A5*2" }));
  eq("name with ': rows inserted", [f(O.insertRows(apos, "s1", 0, 1), "A1", "s2"), val(O.insertRows(apos, "s1", 0, 1), "A1", "s2")], ["'Paul''s Daten'!A6*2", 10]);
  eq("name with ': columns deleted", f(O.deleteCols(apos, "s1", 0, 1), "A1", "s2"), "#REF!*2");
  eq("name with ': renamed", f(O.renameSheet(apos, "s1", "Neu"), "A1", "s2"), "Neu!A5*2");
  eq("name with ': deleted", f(O.deleteSheet(apos, "s1"), "A1", "s2"), "#REF!*2");
  const other: Workbook = { ...wb, charts: [{ ...chartOn("s1"), sheetId: "s2" }] };
  eq("a chart elsewhere loses series from the deleted sheet", O.deleteSheet(other, "s1").charts.length, 0);
  eq("move sheet", O.moveSheet(wb, "s2", 0).sheets.map((s) => s.id), ["s2", "s1"]);
  eq("move clamps", O.moveSheet(wb, "s1", 9).sheets.map((s) => s.id), ["s2", "s1"]);
  const dup = O.duplicateSheet(wb, "s1");
  eq("copy placed after", dup.wb.sheets.map((s) => s.name), ["Blatt 1", "Blatt 1 (2)", "Daten"]);
  eq("copy has the cells", dup.wb.sheets[1].cells, wb.sheets[0].cells);
  check("copy has a new id", dup.sheetId !== "s1" && dup.wb.sheets[1].id === dup.sheetId);
  eq("charts copied", dup.wb.charts.length, 2);
  const cc = dup.wb.charts[1];
  check("copied chart has new ids", cc.id !== "ch1" && cc.series[0].id !== "se1");
  eq("copied chart points at the copy", [cc.sheetId, cc.x?.sheetId, cc.series[0].y.sheetId, cc.series[0].errorBars?.plus?.sheetId], [dup.sheetId, dup.sheetId, dup.sheetId, dup.sheetId]);
  eq("tables copied with a new name", dup.wb.tables.map((t) => t.name), ["Tabelle1", "Tabelle2"]);
  const ct = dup.wb.tables[1];
  check("copied table: new ids, filters and sort follow", ct.id !== "t1" && ct.columns.every((c) => !c.id.startsWith("col")) && Object.keys(ct.filters)[0] === ct.columns[1].id && ct.sort?.column === ct.columns[1].id, show(ct));
  eq("copy of a copy", O.duplicateSheet(dup.wb, dup.sheetId).wb.sheets[2].name, "Blatt 1 (3)");
  eq("uniqueSheetName free", O.uniqueSheetName(wb, "Neu"), "Neu");
  eq("uniqueSheetName taken", O.uniqueSheetName(wb, "blatt 1"), "blatt 1 (2)");
  eq("uniqueSheetName long", O.uniqueSheetName(book(mkSheet("x", "A".repeat(31))), "A".repeat(31)), `${"A".repeat(27)} (2)`);
  eq("valid names", ["a", "Blatt 1", "Ä-ö_ü 2026", "A".repeat(31)].map(O.validSheetName), [true, true, true, true]);
  eq("invalid names", ["", "  ", "A".repeat(32), "a/b", "a\\b", "a:b", "a*b", "a?b", "[a]", "'a", "a'"].map(O.validSheetName), Array(11).fill(false));
  const id = O.newId();
  check("newId", typeof id === "string" && id.length >= 8 && id !== O.newId());
  const pc = O.putChart(wb, { ...chartOn("s1"), title: "Neu" });
  eq("putChart replaces", [pc.charts.length, pc.charts[0].title], [1, "Neu"]);
  eq("removeChart", O.removeChart(wb, "ch1").charts.length, 0);
  eq("putTable adds", O.putTable(wb, tableOn("s2", "A1:A3", "t2", "T2")).tables.length, 2);
  eq("removeTable", O.removeTable(wb, "t1").tables.length, 0);
  eq("sheetById", O.sheetById(wb, "s2")?.name, "Daten");
}

// ==============================================================================================
section("durations of 24 hours and more");
{
  const P = (t: string, locale: Locale = "de") => E.parseInput(t, locale);
  const dur = (seconds: boolean): E.DurationFormat => ({ kind: "time", seconds, duration: true });
  const clock: NumberFormat = { kind: "time", seconds: false };
  // Excel stores a typed 36:00 as 1,5 days and gives it [h]:mm:ss, so it shows and edits as 36:00.
  eq("36:00 is a duration", P("36:00"), { cell: { v: 1.5 }, fmt: dur(false) });
  eq("24:00 and 48:00", [P("24:00"), P("48:00")], [{ cell: { v: 1 }, fmt: dur(false) }, { cell: { v: 2 }, fmt: dur(false) }]);
  eq("36:00:15 with seconds", P("36:00:15"), { cell: { v: 1.5 + 15 / 86400 }, fmt: dur(true) });
  eq("12:00 stays a clock time", P("12:00"), { cell: { v: 0.5 }, fmt: clock });
  check("isDuration", E.isDuration(dur(false)) && !E.isDuration(clock) && !E.isDuration(undefined));
  eq("shown as hours", [E.formatValue(1.5, dur(false), "de"), E.formatValue(2, dur(false), "de"), E.formatValue(0.5, dur(false), "de"), E.formatValue(100 / 24, dur(false), "en")], ["36:00", "48:00", "12:00", "100:00"]);
  eq("shown with seconds", E.formatValue(1.5 + 15 / 86400, dur(true), "de"), "36:00:15");
  eq("a clock time still shows the time of day", E.formatValue(1.5, clock, "de"), "12:00");
  eq("edited as typed", [E.editText({ v: 1.5, s: { fmt: dur(false) } }, "de"), E.editText({ v: 1.5, s: { fmt: clock } }, "de")], ["36:00", "36:00"]);
  // Re-committing what the editor shows never changes the value: 0–100 hours, both formats, both languages.
  let lost = 0;
  for (const locale of ["de", "en"] as const) {
    for (let h = 0; h <= 100; h++) {
      for (const mi of [0, 30, 59]) {
        for (const fmt of [dur(false), clock, dur(true)]) {
          const v = (h * 60 + mi) / 1440;
          const text = E.editText({ v, s: { fmt } }, locale);
          const back = E.parseInput(text, locale);
          if (typeof back.cell.v !== "number" || Math.abs(back.cell.v - v) > 1e-9) {
            if (lost++ < 3) check(`round trip ${h}:${mi} ${locale}`, false, `${text} → ${show(back)}`);
          }
        }
      }
    }
  }
  check(`0–100 hours keep their value when edited (${lost} lost)`, lost === 0);
  const stamp = 46329 + 14.4 / 24;
  const stampText = E.editText({ v: stamp, s: { fmt: clock } }, "de");
  eq("a timestamp shown as a clock time edits as date and time", stampText, "03.11.2026 14:24");
  near("…and keeps its value", E.parseInput(stampText, "de").cell.v, stamp, 1e-12);
  const huge = E.editText({ v: 500, s: { fmt: dur(false) } }, "de");
  near("a duration too long to type as hours edits as a number", E.parseInput(huge, "de").cell.v, 500);
  eq("dates 0 and 1 edit and read back", [E.parseInput(E.editText({ v: 1, s: { fmt: { kind: "date", style: "short" } } }, "de"), "de").cell.v, E.parseInput("30.12.1899", "de").cell.v], [1, 0]);
  eq("no other day of December 1899", [P("32.12.1899").cell, P("29.12.1899").cell], [{ v: "32.12.1899" }, { v: "29.12.1899" }]);
  const growth = book1({ A1: { v: 0, s: { fmt: clock } }, A2: { v: 1, s: { fmt: dur(false) } }, A3: { v: 1.5, s: { fmt: dur(false) } }, B1: "=SUM(A1:A3)*24" });
  eq("formulas over durations", val(growth, "B1"), 60);
}

// ==============================================================================================
section("German 1.234: thousands or a decimal?");
{
  const P = (t: string, locale: Locale = "de", current?: Cell) => E.parseInput(t, locale, current);
  const r = P("1.234");
  eq("read as 1234 like Excel", r.cell, { v: 1234 });
  eq("shown as 1234, visibly not what was typed", E.formatValue(1234, r.fmt, "de"), "1234");
  eq("one click reads it as 1,234", r.notice?.other, { cell: { v: 1.234 } });
  eq("the hint", [r.notice?.message, r.notice?.action], ["„1.234“ ist 1234: Der Punkt trennt Tausender. Für 1,234 tipp ein Komma.", "Als 1,234 lesen"]);
  const g = P("2.345 g");
  eq("with a unit", [g.cell, E.formatValue(2345, g.fmt, "de"), g.notice?.other.cell, E.formatValue(2.345, g.notice?.other.fmt, "de")], [{ v: 2345 }, "2345 g", { v: 2.345 }, "2,345 g"]);
  eq("lab notation keeps its value: 1.000 µL, 10.000 rpm, 5.000 xg", [P("1.000 µL").cell.v, P("10.000 rpm").cell.v, P("5.000 xg").cell.v], [1000, 10000, 5000]);
  eq("negative", [P("-1.234").cell.v, P("-1.234").notice?.other.cell.v], [-1234, -1.234]);
  eq("unambiguous thousands keep the dot and need no hint", [P("1.234,5"), P("1.234.567").fmt, P("1.234.567").notice], [{ cell: { v: 1234.5 }, fmt: { kind: "number", decimals: 1, group: true } }, { kind: "number", decimals: 0, group: true }, undefined]);
  eq("money has no hint", [P("1.234 €").cell.v, P("1.234 €").notice], [1234, undefined]);
  eq("0.512 and 1.5 stay decimals", [P("0.512").cell.v, P("1.5").cell.v, P("1.2345").cell.v], [0.512, 1.5, 1.2345]);
  eq("English is unchanged", [P("1,234", "en").cell.v, P("1,234", "en").notice], [1234, undefined]);
  eq("a percent cell", P("1.234", "de", { s: { fmt: { kind: "percent", decimals: 0 } } }).notice?.other.cell.v, 0.01234);
  // The hint says what the cell shows (not the typed digits without the dot), and the other
  // reading as it would be typed.
  eq("the hint for 001.234, 1.000, -1.234, 1.234 % and 2.345 g", ["001.234", "1.000", "-1.234", "1.234 %", "2.345 g"].map((t) => P(t).notice?.message), [
    "„001.234“ ist 1234: Der Punkt trennt Tausender. Für 001,234 tipp ein Komma.",
    "„1.000“ ist 1000: Der Punkt trennt Tausender. Für 1,000 tipp ein Komma.",
    "„-1.234“ ist -1234: Der Punkt trennt Tausender. Für -1,234 tipp ein Komma.",
    "„1.234 %“ ist 1234%: Der Punkt trennt Tausender. Für 1,234 % tipp ein Komma.",
    "„2.345 g“ ist 2345\u202fg: Der Punkt trennt Tausender. Für 2,345 g tipp ein Komma.",
  ]);
}

// ==============================================================================================
section("German formulas: comma or semicolon?");
{
  const meant = (local: string) => {
    const r = E.toCanonicalFormula(local, "de");
    return "error" in r ? (/Meintest du (=.*)\?$/.exec(r.error)?.[1] ?? `ERROR: ${r.error}`) : `OK ${r.formula}`;
  };
  // German Excel refuses these; a silent guess would look up approximately or average 1,2 and 3.
  eq("SVERWEIS with commas", meant("SVERWEIS(E2,B2:C6,2,0)"), "=SVERWEIS(E2;B2:C6;2;0)");
  eq("English names too", meant("VLOOKUP(E2,B2:C6,2,0)"), "=VLOOKUP(E2;B2:C6;2;0)");
  eq("MITTELWERT(1,2,3)", meant("MITTELWERT(1,2,3)"), "=MITTELWERT(1;2;3)");
  eq("SUMME(1,5,2)", meant("SUMME(1,5,2)"), "=SUMME(1;5;2)");
  // Every comma a ";" would be too many arguments: one of them is a decimal comma, but which?
  eq("WENN(A1>0,5,1,0): no guess", meant("WENN(A1>0,5,1,0)"), "ERROR: Komma oder Semikolon? In deutschen Formeln trennt ; die Argumente, und das Komma gehört in Dezimalzahlen (0,5). Trenn die Argumente von WENN mit ;.");
  eq("RUNDEN(2,345,1): no guess", meant("RUNDEN(2,345,1)"), "ERROR: Komma oder Semikolon? In deutschen Formeln trennt ; die Argumente, und das Komma gehört in Dezimalzahlen (0,5). Trenn die Argumente von RUNDEN mit ;.");
  eq("…nor for a function Blob doesn't know", meant("FOO(1,5,2)"), "ERROR: Komma oder Semikolon? In deutschen Formeln trennt ; die Argumente, und das Komma gehört in Dezimalzahlen (0,5). Trenn die Argumente mit ;.");
  eq("the guess fits the function", [meant("WENN(A1>0,1,0)"), meant("RUNDEN(A1,2,5)")], ["=WENN(A1>0;1;0)","ERROR: Komma oder Semikolon? In deutschen Formeln trennt ; die Argumente, und das Komma gehört in Dezimalzahlen (0,5). Trenn die Argumente von RUNDEN mit ;."]);
  eq("only the call that mixes", meant("SUMME(MITTELWERT(1,5;2);A1,2,5)"), "=SUMME(MITTELWERT(1,5;2);A1;2;5)");
  eq("unambiguous: RUNDEN(A1,2)", meant("RUNDEN(A1,2)"), "OK ROUND(A1,2)");
  eq("unambiguous: SUMME(1,5;2)", meant("SUMME(1,5;2)"), "OK SUM(1.5,2)");
  eq("unambiguous: MAX(1,2) is 1,2", meant("MAX(1,2)"), "OK MAX(1.2)");
  eq("unambiguous: SUMME(A1,5)", meant("SUMME(A1,5)"), "OK SUM(A1,5)");
  eq("unambiguous: ZÄHLENWENN(A1:A10,5)", meant("ZÄHLENWENN(A1:A10,5)"), "OK COUNTIF(A1:A10,5)");
  eq("arrays are left alone", meant("SUMME({1,5;2},3)"), "OK SUM({1.5;2},3)");
  eq("English formulas are unchanged", canon("=SUM(1,5,2)".slice(1), "en"), "SUM(1,5,2)");
  const typed = E.parseInput("=SVERWEIS(E2,B2:C6,2,0)", "de");
  check("typing it keeps the editor open with the hint", !!typed.error && typed.error.message.startsWith("Komma oder Semikolon?") && typed.error.at === 19, show(typed));
}

// ==============================================================================================
section("suggestions for unknown functions");
{
  const S = E.suggestFunction;
  // Only a function with the same maths: the old ones now exist (RANG, TVERT, TINV, KONFIDENZ, F.TEST, MODE…).
  eq("same name without the dot", [S("STABWS", "de"), S("STDEVS", "en"), S("VARS", "de"), S("TVERT2S", "de"), S("KONFIDENZNORM", "de")], ["STABW.S", "STDEV.S", "VAR.S", "T.VERT.2S", "KONFIDENZ.NORM"]);
  eq("umlauts spelled out", [S("ZAEHLENWENN", "de"), S("KGROESSTE", "de"), S("LAENGE", "de")], ["ZÄHLENWENN", "KGRÖSSTE", "LÄNGE"]);
  eq("a German name in English", [S("SUMME", "en"), S("MITTELWERT", "en"), S("SVERWEIS", "en")], ["SUM", "AVERAGE", "VLOOKUP"]);
  eq("known words", [S("MODUS", "de"), S("DURCHSCHNITT", "de"), S("AVG", "en")], ["MODUS.EINF", "MITTELWERT", "AVERAGE"]);
  eq("a letter more or less wins over a changed one", [S("MITTELWERTS", "de"), S("SUMM", "de"), S("SUME", "de"), S("QUANTILE", "de"), S("QUANTILE.INKL", "de")], ["MITTELWERT", "SUMME", "SUMME", "QUANTIL", "QUANTIL.INKL"]);
  eq("no guess for a short name with a letter changed", [S("RANX", "de"), S("CODX", "en")], [null, null]);
  eq("…but one with a letter more or less", [S("COSX", "en"), S("SINN", "de")], ["COS", "SIN"]);
  // Never a function with other maths (review: QUARTIL.INKL got QUANTIL.INKL, VAR.N got VAR.S).
  eq("the population's, not the sample's", [S("VAR.N", "de"), S("VARIANZ.N", "de"), S("STABW.P", "de"), S("KOVARIANZ.N", "de"), S("VARIANZ.S", "de")], ["VAR.P", "VAR.P", "STABW.N", "KOVARIANZ.P", "VAR.S"]);
  eq("…in English", [S("STDEV.N", "en"), S("VAR.N", "en"), S("COVARIANCE.N", "en")], ["STDEV.P", "VAR.P", "COVARIANCE.P"]);
  eq("quartiles, not quantiles", [S("QUARTIL", "de"), S("QUARTIL.INKL", "de"), S("QUARTIL.EXKL", "de"), S("QUARTILE.INK", "de"), S("QUARTIL", "en")], ["QUARTILE.INKL", "QUARTILE.INKL", "QUARTILE.EXKL", "QUARTILE.INKL", "QUARTILE.INC"]);
  eq("KONFIDENZ.N is the normal one, the one-tailed t is .RE", [S("KONFIDENZ.N", "de"), S("CONFIDENCE.N", "en"), S("T.VERT.1S", "de"), S("T.DIST.1T", "en")], ["KONFIDENZ.NORM", "CONFIDENCE.NORM", "T.VERT.RE", "T.DIST.RT"]);
  eq("no guess where the maths would change", ["T.INV.1S", "F.VERT.LS", "NORMVERT.S", "TVERT2", "F.TEST2", "FTEST2", "LOG2", "LD", "EXP10", "WURZEL3", "STABW.SN", "T.DIST.T", "KONFIDENZ.", "NORM..VERT"].map((t) => S(t, "de")), Array(14).fill(null));
  eq("…in English", ["LOG2", "T.INV.1T", "STDEV.", "SUMISF", "LVOOKUP"].map((t) => S(t, "en")), Array(5).fill(null));
  eq("slips that stay with their function", [S("RANG.GLEIH", "de"), S("MODALWER", "de"), S("HAEUFIGKEITEN", "de"), S("XVERGLEICHEN", "de"), S("VERWEISS", "de"), S("MITTLEWERT", "de"), S("EHUTE", "de"), S("TVERT.RE", "de")], ["RANG.GLEICH", "MODALWERT", "HÄUFIGKEIT", "XVERGLEICH", "VERWEIS", "MITTELWERT", "HEUTE", "T.VERT.RE"]);
  eq("names that differ only in dots and calculate differently: the exact one", [S("TVERT", "en"), S("T.VERT", "en"), S("TV.ERT", "de")], ["TDIST", "T.DIST", null]);
  // Every function's name with one slip (a letter dropped, doubled or swapped): its own function or no guess.
  {
    const own = (a: E.FunctionName, b: E.FunctionName | undefined) => !!b && (a === b || (a.newer?.length === 1 && a.newer[0] === b.en) || (b.newer?.length === 1 && b.newer[0] === a.en));
    let other = 0;
    let tried = 0;
    for (const f of E.FUNCTION_NAMES) {
      for (const locale of ["de", "en"] as const) {
        const name = locale === "de" ? f.de : f.en;
        const slips = new Set<string>();
        for (let i = 0; i < name.length; i++) {
          slips.add(name.slice(0, i) + name.slice(i + 1));
          slips.add(name.slice(0, i) + name[i] + name.slice(i));
          if (i + 1 < name.length) slips.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2));
        }
        for (const t of slips) {
          if (!t || E.FUNCTION_BY_DE.has(t) || E.FUNCTION_BY_EN.has(t)) continue;
          tried++;
          const s = S(t, locale);
          if (s !== null && !own(f, E.FUNCTION_NAMES.find((g) => (locale === "de" ? g.de : g.en) === s)) && other++ < 3) check(`${t} (${name})`, false, `got ${s}`);
        }
      }
    }
    check(`one slip never leads to another function (${tried} tried, ${other} did)`, other === 0 && tried > 8000);
  }
  eq("Excel functions Blob lacks get no guess", [S("BINOM.VERT", "de"), S("EINDEUTIG", "de"), S("POISSON", "en")], [null, null, null]);
  check("…and are named as such", E.explainError({ error: "#NAME?", detail: "unknown-function:BINOM.VERT" }, "de").includes("in Blob noch nicht"));
  const msg = E.toCanonicalFormula("BINOM.VERT(3;10;0,5;FALSCH)", "de");
  check("typed: \"gibt es in Blob noch nicht\"", "error" in msg && msg.error === "Die Funktion „BINOM.VERT“ gibt es in Blob noch nicht.", show(msg));
  const stabws = E.toCanonicalFormula("STABWS(A1:A3)", "de");
  check("typed STABWS: Meintest du STABW.S?", "error" in stabws && stabws.error.endsWith("Meintest du STABW.S?"), show(stabws));
  // Every function's own name without dots or umlauts leads back to it.
  let wrong = 0;
  for (const f of E.FUNCTION_NAMES) {
    for (const [name, locale] of [[f.de, "de"], [f.en, "en"]] as const) {
      const typed = name.replace(/\./g, "").replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE");
      if (typed === name || E.FUNCTION_BY_DE.has(typed) || E.FUNCTION_BY_EN.has(typed)) continue;
      if (S(typed, locale) !== name && wrong++ < 3) check(`${typed} → ${name}`, false, String(S(typed, locale)));
    }
  }
  check(`names without dots or umlauts lead back to their function (${wrong} wrong)`, wrong === 0);
}

// ==============================================================================================
section("Excel's older names, F- and chi-squared tests, XVERGLEICH, VERWEIS, HÄUFIGKEIT");
{
  // German names as German Excel spells them, and back.
  const pairs: [string, string][] = [
    ["RANG(B2;B2:B9)", "RANK(B2,B2:B9)"],
    ["RANG.MITTELW(B2;B2:B9;1)", "RANK.AVG(B2,B2:B9,1)"],
    ["QUANTIL(B2:B9;0,9)", "PERCENTILE(B2:B9,0.9)"],
    ["QUANTIL.EXKL(B2:B9;0,9)", "PERCENTILE.EXC(B2:B9,0.9)"],
    ["QUARTILE(B2:B9;1)", "QUARTILE(B2:B9,1)"],
    ["QUARTILE.EXKL(B2:B9;1)", "QUARTILE.EXC(B2:B9,1)"],
    ["MODALWERT(B2:B9)", "MODE(B2:B9)"],
    ["STABWA(B2:B9)", "STDEVA(B2:B9)"],
    ["STABWNA(B2:B9)", "STDEVPA(B2:B9)"],
    ["VARIANZA(B2:B9)", "VARA(B2:B9)"],
    ["VARIANZENA(B2:B9)", "VARPA(B2:B9)"],
    ["T.VERT.RE(2;5)", "T.DIST.RT(2,5)"],
    ["TVERT(2;5;2)", "TDIST(2,5,2)"],
    ["TINV(0,05;5)", "TINV(0.05,5)"],
    ["TTEST(A1:A3;B1:B3;2;3)", "TTEST(A1:A3,B1:B3,2,3)"],
    ["NORMVERT(1;0;1;WAHR)", "NORMDIST(1,0,1,TRUE)"],
    ["NORMINV(0,9;0;1)", "NORMINV(0.9,0,1)"],
    ["STANDNORMVERT(1)", "NORMSDIST(1)"],
    ["STANDNORMINV(0,9)", "NORMSINV(0.9)"],
    ["KONFIDENZ(0,05;1;10)", "CONFIDENCE(0.05,1,10)"],
    ["F.TEST(A1:A3;B1:B3)", "F.TEST(A1:A3,B1:B3)"],
    ["F.VERT(2;3;4;WAHR)", "F.DIST(2,3,4,TRUE)"],
    ["F.VERT.RE(2;3;4)", "F.DIST.RT(2,3,4)"],
    ["F.INV(0,9;3;4)", "F.INV(0.9,3,4)"],
    ["F.INV.RE(0,05;3;4)", "F.INV.RT(0.05,3,4)"],
    ["FTEST(A1:A3;B1:B3)", "FTEST(A1:A3,B1:B3)"],
    ["FVERT(2;3;4)", "FDIST(2,3,4)"],
    ["FINV(0,05;3;4)", "FINV(0.05,3,4)"],
    ["CHIQU.TEST(A1:A3;B1:B3)", "CHISQ.TEST(A1:A3,B1:B3)"],
    ["CHIQU.VERT(3;2;WAHR)", "CHISQ.DIST(3,2,TRUE)"],
    ["CHIQU.VERT.RE(3;2)", "CHISQ.DIST.RT(3,2)"],
    ["CHIQU.INV(0,9;2)", "CHISQ.INV(0.9,2)"],
    ["CHIQU.INV.RE(0,05;2)", "CHISQ.INV.RT(0.05,2)"],
    ["CHITEST(A1:A3;B1:B3)", "CHITEST(A1:A3,B1:B3)"],
    ["CHIVERT(3;2)", "CHIDIST(3,2)"],
    ["CHIINV(0,05;2)", "CHIINV(0.05,2)"],
    ["XVERGLEICH(4;A1:A5)", "XMATCH(4,A1:A5)"],
    ["VERWEIS(5;A1:A5;B1:B5)", "LOOKUP(5,A1:A5,B1:B5)"],
    ["HÄUFIGKEIT(A1:A9;B1:B3)", "FREQUENCY(A1:A9,B1:B3)"],
    ["OBERGRENZE.MATHEMATIK(-5,5;2;1)", "CEILING.MATH(-5.5,2,1)"],
    ["UNTERGRENZE.MATHEMATIK(-5,5;2;1)", "FLOOR.MATH(-5.5,2,1)"],
  ];
  for (const [deText, enText] of pairs) {
    eq(`${deText.split("(")[0]} typed in German`, canon(deText), enText);
    eq(`${deText.split("(")[0]} shown in German`, E.toLocalFormula(enText, "de"), deText);
  }
  eq("TVERT's newer names: T.VERT.RE (Seiten 1) and T.VERT.2S (Seiten 2)", E.FUNCTION_BY_EN.get("TDIST")?.newer, ["T.DIST.RT", "T.DIST.2T"]);
  eq("every newer name is a function", E.FUNCTION_NAMES.flatMap((f) => f.newer ?? []).filter((n) => !E.FUNCTION_BY_EN.has(n) || E.FUNCTION_BY_EN.get(n)!.newer), []);
  eq("newer functions get _xlfn. in files, older ones don't",E.toFileFormula("T.DIST.RT(2,5)+TDIST(2,5,2)+XMATCH(1,A1:A3)+CHISQ.TEST(A1:A2,B1:B2)+CHITEST(A1:A2,B1:B2)"), "_xlfn.T.DIST.RT(2,5)+TDIST(2,5,2)+_xlfn.XMATCH(1,A1:A3)+_xlfn.CHISQ.TEST(A1:A2,B1:B2)+CHITEST(A1:A2,B1:B2)");
  // Values from LibreOffice 24.2 (scratchpad fix/B/lo/new.lo.json), to 1e-9.
  const data = { A1: 0.512, A2: 0.498, A3: 0.505, A4: 0.52, A5: 0.49, A6: 0.505, A7: "x", A9: 0.531, A10: 0.487, B1: 0.431, B2: 0.452, B3: 0.44, B4: 0.47, B5: 0.433, B6: 0.461 };
  const lo: [string, number][] = [
    ["RANK(0.505,A1:A10)", 4],
    ["RANK.AVG(0.505,A1:A10)", 4.5],
    ["RANK.AVG(0.505,A1:A10,1)", 4.5],
    ["PERCENTILE(A1:A10,0.3)", 0.4987],
    ["PERCENTILE.EXC(A1:A10,0.3)", 0.4956],
    ["QUARTILE(A1:A10,1)", 0.496],
    ["QUARTILE.EXC(A1:A10,1)", 0.492],
    ["QUARTILE.EXC(A1:A10,3)", 0.518],
    ["MODE(A1:A10)", 0.505],
    ["T.DIST.RT(2.5,10)", 0.015723422118304412],
    ["T.DIST.RT(-1.2,5)", 0.8580544716469487],
    ["TDIST(2.5,10,1)", 0.015723422118304412],
    ["TDIST(2.5,10,2)", 0.031446844236608824],
    ["TINV(0.05,2)", 4.302652729749464],
    ["TTEST(A1:A6,B1:B6,2,3)", 0.00005011518432893945],
    ["NORMDIST(110,100,15,FALSE)", 0.02129653370149015],
    ["NORMSDIST(-3.5)", 0.00023262907903552504],
    ["NORMSINV(0.95)", 1.6448536269514715],
    ["CONFIDENCE(0.05,2.5,50)", 0.6929519121748386],
    ["F.TEST(A1:A6,B1:B6)", 0.3879472766440059],
    ["F.TEST(B1:B6,A1:A10)", 0.8473866532148154],
    ["F.DIST(2.5,3,10,TRUE)", 0.8809604373417219],
    ["F.DIST(2.5,3,10,FALSE)", 0.09254817169049528],
    ["F.DIST(0.5,1,1,FALSE)", 0.30010543871903544],
    ["F.DIST.RT(25,3,10)", 0.00005793944545394113],
    ["F.INV(0.95,3,10)", 3.708264819046842],
    ["F.INV(0.01,3,10)", 0.036725908576533385],
    ["F.INV.RT(0.001,1,1)", 405284.0679028477],
    ["FINV(0.05,3,10)", 3.708264819046844],
    ["CHISQ.DIST(3.84,1,FALSE)", 0.02984688748306056],
    ["CHISQ.DIST(2,2,FALSE)", 0.18393972058572117],
    ["CHISQ.DIST(5,4,TRUE)", 0.7127025048163542],
    ["CHIDIST(3.84,1)", 0.05004352124870519],
    ["CHISQ.DIST.RT(50,10)", 2.669083424904495e-7],
    ["CHISQ.DIST.RT(1000,900)", 0.010994608942131107],
    ["CHISQ.INV(0.05,10)", 3.9402991361190614],
    ["CHISQ.INV.RT(1E-10,2)", 46.05170185988092],
    ["CHISQ.INV(0.5,500)", 499.33349158887006],
    ["CHIINV(0.05,3)", 7.814727903251182],
    ["STDEVA(A1:A10)", 0.169236356745365],
    ["STDEVPA(A1:A10)", 0.15955756730393772],
    ["VARA(A1:A10)", 0.028640944444444445],
    ["VARPA(A1:A10)", 0.025458617283950616],
    ["CEILING.MATH(-8.1,2)", -8],
    ["CEILING.MATH(-5.5,2,-1)", -6],
    ["CEILING.MATH(4.3,-2)", 6],
    ["FLOOR.MATH(-8.1,2)", -10],
    ["FLOOR.MATH(-5.5,2,1)", -4],
    ["FLOOR.MATH(6.7)", 6],
  ];
  for (const [f, v] of lo) near(f, ev(f, data), v, 1e-9);
  eq("CEILING.MATH(0,3; 0,1) without binary noise", ev("CEILING.MATH(0.3,0.1)"), 0.3);
  err("RANK of a number not in the list", ev("RANK(0.6,A1:A10)", data), "#N/A");
  err("PERCENTILE.EXC outside 1/(n+1)…n/(n+1)", ev("PERCENTILE.EXC(A1:A10,0.1)", data), "#NUM!");
  err("QUARTILE.EXC needs 3 numbers for the 1st quartile", ev("QUARTILE.EXC(B1:B2,1)", data), "#NUM!");
  near("…1 for the median", ev("QUARTILE.EXC(B1:B2,2)", data), 0.4415);
  err("MODE without repeats (Excel: #N/A)", ev("MODE(B1:B6)", data), "#N/A");
  err("TDIST of a negative t", ev("TDIST(-1,10,2)"), "#NUM!");
  eq("inverse ends", [ev("CHISQ.INV(0,4)"), ev("CHISQ.INV.RT(1,4)"), ev("F.INV.RT(1,3,10)")], [0, 0, 0]);
  // Chi-squared test: Mendel's 315:108:101:32 against 9:3:3:1, and a contingency table.
  const chi = { A1: 315, A2: 108, A3: 101, A4: 32, B1: 312.75, B2: 104.25, B3: 104.25, B4: 34.75, C1: 10, C2: 20, D1: 15, D2: 15, E1: 12, E2: 18, F1: 13, F2: 17, G1: 5, G2: "x", H1: 4, H2: 3 };
  near("CHISQ.TEST 9:3:3:1", ev("CHISQ.TEST(A1:A4,B1:B4)", chi), 0.925425895103616, 1e-9);
  near("CHITEST", ev("CHITEST(A1:A4,B1:B4)", chi), 0.925425895103616, 1e-9);
  near("CHISQ.TEST 2×2 table, 1 degree of freedom", ev("CHISQ.TEST(C1:D2,E1:F2)", chi), 0.29458630132469876, 1e-9);
  err("CHISQ.TEST: text in the counts", ev("CHISQ.TEST(G1:G2,H1:H2)", chi), "#NUM!");
  err("CHISQ.TEST: sizes differ", ev("CHISQ.TEST(A1:A4,B1:B3)", chi), "#N/A");
  err("CHISQ.TEST: an expected 0", ev("CHISQ.TEST(A1:A2,{0;1})", chi), "#DIV/0!");
  // HÄUFIGKEIT: one count more than classes; classes in any order, like LibreOffice.
  const fr = { A1: 79, A2: 85, A3: 78, A4: 85, A5: 50, A6: 81, A7: 95, A8: 88, A9: 97, A10: "x", B1: 70, B2: 79, B3: 89, D1: 89, D2: 70, D3: 79, G1: 79, G2: 79 };
  eq("FREQUENCY", [1, 2, 3, 4].map((i) => ev(`INDEX(FREQUENCY(A1:A10,B1:B3),${i})`, fr)), [1, 2, 4, 2]);
  eq("FREQUENCY, classes unsorted", [1, 2, 3, 4].map((i) => ev(`INDEX(FREQUENCY(A1:A10,D1:D3),${i})`, fr)), [4, 1, 2, 2]);
  eq("FREQUENCY, a class twice", [1, 2, 3].map((i) => ev(`INDEX(FREQUENCY(A1:A10,G1:G2),${i})`, fr)), [3, 0, 6]);
  eq("FREQUENCY in one cell: the first count; SUM and ROWS of it", [ev("FREQUENCY(A1:A10,B1:B3)", fr), ev("SUM(FREQUENCY(A1:A10,B1:B3))", fr), ev("ROWS(FREQUENCY(A1:A10,B1:B3))", fr)], [1, 9, 4]);
  // VERWEIS and XVERGLEICH.
  const lk = { A1: 0, A2: 2, A3: 4, A4: 6, A5: 8, B1: "a", B2: "b", B3: "c", B4: "d", B5: "e", C1: 10, C2: 20, C3: 30, C4: 40 };
  eq("LOOKUP", [ev("LOOKUP(5,A1:A5,B1:B5)", lk), ev("LOOKUP(5,A1:A5)", lk), ev("LOOKUP(100,A1:A5,B1:B5)", lk), ev('LOOKUP("c",B1:B5,A1:A5)', lk)], ["c", 4, "e", 4]);
  eq("LOOKUP of a table: first column, last column", ev("LOOKUP(5,A1:B5)", lk), "c");
  eq("LOOKUP of arrays: wide ones by their first row, others by their first column", [ev("LOOKUP(1,{1,2,3;4,5,6})"), ev("LOOKUP(5,{1,2,3;4,5,6})"), ev("LOOKUP(4,{1,2;3,4;5,6})")], [4, 6, 4]);
  eq("LOOKUP: a result range goes on past its end", [ev("LOOKUP(4,A1:A5,C1:C3)", lk), ev("LOOKUP(5,A1:A5,C1:C2)", lk), ev("LOOKUP(5,A1:A5,C1)", lk)], [30, 30, 30]);
  eq("LOOKUP: the last filled cell (=LOOKUP(2;1/(B1:B5<>\"\");B1:B5))", ev('LOOKUP(2,1/(B1:B5<>""),B1:B5)', lk), "e");
  err("LOOKUP: smaller than everything", ev("LOOKUP(-1,A1:A5,B1:B5)", lk), "#N/A");
  eq("XMATCH", [ev("XMATCH(4,A1:A5)", lk), ev("XMATCH(5,A1:A5,-1)", lk), ev("XMATCH(5,A1:A5,1)", lk), ev('XMATCH("c",B1:B5)', lk), ev('XMATCH("?",B1:B5,2)', lk), ev("XMATCH(4,A1:A5,0,-1)", lk)], [3, 3, 4, 3, 1, 3]);
  err("XMATCH not found", ev("XMATCH(5,A1:A5)", lk), "#N/A");
  // The help's examples that read cells (the template check only calculates those without cells).
  const help = (fn: string, fixture: Record<string, CellInput>, expected: E.CellValue, tol = 0) => {
    for (const lang of ["de", "en"] as const) {
      const doc = FUNCTION_DOCS[fn][lang];
      const v = (lang === "de" ? de : en)(doc.example.slice(1), fixture);
      if (typeof expected === "number" && tol) near(`help of ${fn} (${lang}): ${doc.example}`, v, expected, tol);
      else eq(`help of ${fn} (${lang}): ${doc.example}`, v, expected);
    }
  };
  const nd = (lang: Locale) => (lang === "de" ? "n. b." : "n.d.");
  for (const [fn, want] of [["STDEVA", 2.581988897], ["STDEVPA", 2.236067977], ["VARA", 6.666666667], ["VARPA", 5]] as const) {
    for (const lang of ["de", "en"] as const) near(`help of ${fn} (${lang})`, (lang === "de" ? de : en)(FUNCTION_DOCS[fn][lang].example.slice(1), { B2: 2, B3: 4, B4: nd(lang), B5: 6 }), want, 1e-9);
  }
  const ranks = { B2: 5, B3: 3, B4: 5, B5: 1, B6: 4 };
  help("RANK", ranks, 1);
  help("RANK.AVG", ranks, 1.5);
  const hundred: Record<string, CellInput> = {};
  for (let i = 1; i <= 100; i++) hundred[`B${i + 1}`] = i;
  help("PERCENTILE", hundred, 95.05, 1e-12);
  help("PERCENTILE.EXC", hundred, 95.95, 1e-12);
  help("QUARTILE", hundred, 8, 1e-12);
  help("QUARTILE.EXC", hundred, 7.5, 1e-12);
  const groups = { B2: 0.512, B3: 0.498, B4: 0.505, C2: 0.431, C3: 0.452, C4: 0.44 };
  help("F.TEST", groups, 0.6125, 1e-9);
  help("FTEST", groups, 0.6125, 1e-9);
  help("TTEST", groups, 0.0017215503163646, 1e-6);
  const mendel = { B2: 787, B3: 277, C2: 798, C3: 266 };
  help("CHISQ.TEST", mendel, 0.4361025114842315, 1e-9);
  help("CHITEST", mendel, 0.4361025114842315, 1e-9);
  const counts: Record<string, CellInput> = { D2: 50, D3: 100, D4: 150 };
  [12, 35, 48, 51, 56, 63, 67, 70, 72, 75, 78, 81, 84, 88, 90, 93, 97, 102, 110, 118, 121, 125, 133, 140, 151, 160, 172, 180, 195, 210].forEach((x, i) => (counts[`B${i + 2}`] = x));
  help("FREQUENCY", counts, 14);
  for (const lang of ["de", "en"] as const) eq(`help of XMATCH (${lang})`, (lang === "de" ? de : en)(FUNCTION_DOCS.XMATCH[lang].example.slice(1), lang === "de" ? { A2: "Probe A", A3: "Probe B", A4: "Probe C" } : { A2: "Sample A", A3: "Sample B", A4: "Sample C" }), 3);
  help("LOOKUP", { A2: 0, A3: 0.5, A4: 0.6, A5: 0.7, A6: 0.8, A7: 0.9, B2: 6, B3: 5, B4: 4, B5: 3, B6: 2, B7: 1, D2: 0.74 }, 3);
}

// ==============================================================================================
section("error messages that say why");
{
  const why = (formula: string, cells: Record<string, CellInput> = {}, locale: Locale = "de") => {
    const v = (locale === "de" ? de : en)(formula, cells);
    return E.isError(v) ? `${E.errorText(v.error, locale)} ${E.explainError(v, locale)}` : `no error: ${show(v)}`;
  };
  const one = { A1: 0.512 };
  eq("STABW.S of one replicate", why("STABW.S(A1:A3)", one), "#DIV/0! STABW.S braucht mindestens 2 Zahlen – hier ist es nur eine. Leere Zellen und Text zählen nicht.");
  eq("…in English", why("STDEV.S(A1:A3)", one, "en"), "#DIV/0! STDEV.S needs at least 2 numbers – there is only one here. Empty cells and text don't count.");
  eq("MITTELWERT without numbers", why("MITTELWERT(B1:B5)", { B1: "n. b." }), "#DIV/0! MITTELWERT findet keine Zahl: Leere Zellen und Text zählen nicht. Prüf den Bereich.");
  eq("MITTELWERTWENN without a match", why('MITTELWERTWENN(A1:A3;"x";A1:A3)', one), "#DIV/0! Keine Zelle erfüllt die Bedingung, darum hat MITTELWERTWENN nichts zu mitteln.");
  eq("KORREL of constant data", why("KORREL(A1:A3;B1:B3)", { A1: 1, A2: 2, A3: 3, B1: 5, B2: 5, B3: 5 }), "#DIV/0! KORREL kann nicht rechnen, weil die Werte alle gleich sind (bei Wertepaaren: alle x- oder alle y-Werte). Ohne Streuung gibt es kein Ergebnis.");
  eq("STEIGUNG with all x the same", why("STEIGUNG(A1:A3;B1:B3)", { A1: 1, A2: 2, A3: 3, B1: 5, B2: 5, B3: 5 }).startsWith("#DIV/0! STEIGUNG kann nicht rechnen"), true);
  eq("STFEHLERYX of 2 points", why("STFEHLERYX(A1:A2;B1:B2)", { A1: 1, A2: 2, B1: 1, B2: 2 }), "#DIV/0! STFEHLERYX braucht mindestens 3 Wertepaare – hier sind es nur 2. Ein Paar zählt nur, wenn in beiden Bereichen an derselben Stelle eine Zahl steht.");
  // Pairs count, not numbers: 4 numbers, but only row 1 has both x and y.
  const gaps = { A1: 1, A2: 2, B1: 3, B3: 4 };
  for (const f of ["STEIGUNG", "ACHSENABSCHNITT", "BESTIMMTHEITSMASS", "KORREL", "PEARSON", "KOVARIANZ.S"]) eq(`${f} with one complete pair`, why(`${f}(A1:A3;B1:B3)`, gaps), `#DIV/0! ${f} braucht mindestens 2 Wertepaare – hier ist es nur eins. Ein Paar zählt nur, wenn in beiden Bereichen an derselben Stelle eine Zahl steht.`);
  eq("PROGNOSE.LINEAR too", why("PROGNOSE.LINEAR(5;A1:A3;B1:B3)", gaps).startsWith("#DIV/0! PROGNOSE.LINEAR braucht mindestens 2 Wertepaare"), true);
  eq("paired T.TEST", why("T.TEST(A1:A3;B1:B3;2;1)", gaps).startsWith("#DIV/0! T.TEST braucht mindestens 2 Wertepaare – hier ist es nur eins."), true);
  eq("KOVARIANZ.P without any pair", why("KOVARIANZ.P(A1:A2;B1:B2)", { A1: 1, B2: 2 }), "#DIV/0! KOVARIANZ.P findet kein Wertepaar. Ein Paar zählt nur, wenn in beiden Bereichen an derselben Stelle eine Zahl steht.");
  eq("…in English", why("SLOPE(A1:A3,B1:B3)", gaps, "en"), "#DIV/0! SLOPE needs at least 2 pairs of values – there is only one here. A pair only counts when both ranges hold a number in the same place.");
  // The A forms count text as 0.
  eq("STABWA of one value", why("STABWA(A1:A3)", one), "#DIV/0! STABWA braucht mindestens 2 Werte – hier ist es nur einer. Leere Zellen zählen nicht, Text zählt als 0.");
  check("…VARIANZA alike", why("VARIANZA(A1:A3)", { A1: "x" }).endsWith("hier ist es nur einer. Leere Zellen zählen nicht, Text zählt als 0."));
  eq("STABWNA and VARIANZENA of empty cells", [why("STABWNA(A1:A3)"), why("VARIANZENA(A1:A3)")].map((t) => t.slice(t.indexOf("findet"))), Array(2).fill("findet keinen Wert: Leere Zellen zählen nicht. Prüf den Bereich."));
  eq("MITTELWERTA of empty cells", why("MITTELWERTA(A1:A3)"), "#DIV/0! MITTELWERTA findet keinen Wert: Leere Zellen zählen nicht. Prüf den Bereich.");
  eq("…in English", why("STDEVA(A1:A3)", one, "en"), "#DIV/0! STDEVA needs at least 2 values – there is only one here. Empty cells don't count; text counts as 0.");
  // Whole bounds in full.
  const many: Record<string, CellInput> = {};
  for (let i = 1; i <= 12345; i++) many[`A${i}`] = i;
  eq("KGRÖSSTE over 12.345 numbers", why("KGRÖSSTE(A1:A12345;20000)", many), "#ZAHL! Bei KGRÖSSTE muss „k“ zwischen 1 und 12.345 liegen.");
  eq("…in English", why("LARGE(A1:A12345,20000)", many, "en"), '#NUM! In LARGE, "k" must be between 1 and 12,345.');
  // "@" in a detail that isn't the function's own (a sheet's name, a unit) stays.
  eq("a missing sheet with @ in its name", why("SUMME('Messung @ 37 °C'!A1:A3)"), "#BEZUG! Das Blatt „Messung @ 37 °C“ gibt es nicht (mehr).");
  eq("…the same without a function", why("'Messung @ 37 °C'!A1"), "#BEZUG! Das Blatt „Messung @ 37 °C“ gibt es nicht (mehr).");
  eq("a unit with @", why('UMWANDELN(1;"m@";"cm")'), "#NV Die Einheit „m@“ kenne ich nicht, oder die Einheiten passen nicht zusammen.");
  // The argument names of the messages are the help's (src/sheet/engine/docs.ts), in every function.
  {
    const differ: string[] = [];
    let named = 0;
    for (const [fn, doc] of Object.entries(FUNCTION_DOCS)) {
      for (const locale of ["de", "en"] as const) {
        doc[locale].args.forEach((arg, i) => {
          const text = E.explainError({ error: "#NUM!", detail: `arg:${fn}:${i + 1}:gt0` }, locale);
          if (text.startsWith(locale === "de" ? "Ein Argument von" : "An argument of")) return;
          named++;
          if (!text.includes(locale === "de" ? `„${arg.name}“` : `"${arg.name}"`)) differ.push(`${fn} ${i + 1} ${locale}: ${text}`);
        });
      }
    }
    eq(`argument names as in the help (${named} named)`, differ, []);
    const opts: [string, number][] = [["T.TEST", 3], ["T.TEST", 4], ["TTEST", 3], ["TTEST", 4], ["TDIST", 3]];
    for (const locale of ["de", "en"] as const) for (const [fn, i] of opts) check(`${fn} ${i} lists the help's choices (${locale})`, E.explainError({ error: "#NUM!", detail: `arg:${fn}:${i}:opt` }, locale).endsWith(FUNCTION_DOCS[fn][locale].args[i - 1].desc));
    // Each error that names an argument, by formula: never the general sentence.
    const general: string[] = [];
    const forms = [
      "QUANTIL.INKL(A1:A3;2)", "QUANTIL(A1:A3;2)", "QUANTIL.EXKL(A1:A3;0,01)", "QUARTILE.INKL(A1:A3;5)", "QUARTILE(A1:A3;5)", "QUARTILE.EXKL(A1:A3;4)",
      "KGRÖSSTE(A1:A3;9)", "KKLEINSTE(A1:A3;9)", "T.TEST(A1:A3;B1:B3;3;1)", "TTEST(A1:A3;B1:B3;2;7)", "KONFIDENZ.NORM(2;1;5)", "KONFIDENZ(0,05;0;5)",
      "KONFIDENZ.T(0,05;1;0)", "F.VERT(-1;2;3;WAHR)", "F.VERT.RE(1;0;3)", "FVERT(1;2;0)", "F.INV(1;2;3)", "F.INV.RE(0;2;3)", "FINV(0,5;0;3)",
      "CHIQU.VERT(-1;2;WAHR)", "CHIQU.VERT.RE(1;0)", "CHIVERT(-1;2)", "CHIQU.INV(1;2)", "CHIQU.INV.RE(0;2)", "CHIINV(0,5;0)", "GEOMITTEL(1;-2)",
      "HARMITTEL(0;2)", "STANDARDISIERUNG(1;2;0)", "NORM.VERT(1;2;0;WAHR)", "NORMVERT(1;2;-1;WAHR)", "NORM.INV(2;0;1)", "NORMINV(0,5;0;0)",
      "NORM.S.INV(0)", "STANDNORMINV(1)", "T.VERT(1;0;WAHR)", "T.VERT.2S(-1;5)", "T.VERT.RE(1;0)", "TVERT(1;5;3)", "TVERT(-1;5;1)", "T.INV(0;5)",
      "T.INV.2S(2;5)", "TINV(0,5;0)", "CHIQU.TEST(E1:E2;B1:B2)", "CHITEST(A1:A2;C1:C2)", "VARIATION(D1:D3)", "RKP(D1:D3)",
    ];
    const data = { A1: 1, A2: 2, A3: 3, B1: 1, B2: 2, B3: 4, C1: 1, C2: -1, D1: 1, D2: -2, D3: 3 };
    for (const f of forms) {
      const text = why(f, data);
      if (!/„.+“/.test(text)) general.push(`${f}: ${text}`);
    }
    eq(`every argument error names its argument (${forms.length} formulas)`, general, []);
  }
  eq("T.TEST with one value in a group", why("T.TEST(A1:A2;B1:B2;2;3)", { A1: 1, A2: 2, B1: 3 }), "#DIV/0! T.TEST braucht in jeder Gruppe mindestens 2 Zahlen – in einer ist es nur eine. Leere Zellen und Text zählen nicht.");
  eq("KONFIDENZ.T with n = 1", why("KONFIDENZ.T(0,05;0,1;1)"), "#DIV/0! Bei KONFIDENZ.T muss „Umfang“ mindestens 2 sein.");
  eq("QUANTIL.INKL with k = 1,5", why("QUANTIL.INKL(A1:A3;1,5)", one), "#ZAHL! Bei QUANTIL.INKL muss „k“ zwischen 0 und 1 liegen.");
  eq("KGRÖSSTE with k > n", why("KGRÖSSTE(A1:A3;5)", { A1: 1, A2: 2, A3: 3 }), "#ZAHL! Bei KGRÖSSTE muss „k“ zwischen 1 und 3 liegen.");
  eq("QUANTIL.EXKL names its bounds", why("QUANTIL.EXKL(A1:A3;0,1)", { A1: 1, A2: 2, A3: 3 }), "#ZAHL! Bei QUANTIL.EXKL muss „k“ zwischen 0,25 und 0,75 liegen.");
  eq("NORM.VERT with Standabwn 0", why("NORM.VERT(1;0;0;WAHR)"), "#ZAHL! Bei NORM.VERT muss „Standabwn“ größer als 0 sein.");
  eq("…in English", why("NORM.DIST(1,0,0,TRUE)", {}, "en"), '#NUM! In NORM.DIST, "standard_dev" must be greater than 0.');
  eq("T.TEST type 4", why("T.TEST(A1:A2;B1:B2;2;4)", { A1: 1, A2: 2, B1: 3, B2: 4 }), "#ZAHL! Bei T.TEST gibt es für „Typ“ nur diese Möglichkeiten: 1: gepaart; 2: zwei Stichproben, gleiche Varianz; 3: zwei Stichproben, ungleiche Varianz (Welch).");
  eq("RKP with a y of 0", why("RKP(A1:A3;B1:B3)", { A1: 1, A2: 0, A3: 3, B1: 1, B2: 2, B3: 3 }), "#ZAHL! Bei RKP darf „Y_Werte“ nur Zahlen größer als 0 enthalten.");
  eq("GEOMITTEL of a negative number", why("GEOMITTEL(2;-1)"), "#ZAHL! Bei GEOMITTEL darf „Zahl1“ nur Zahlen größer als 0 enthalten.");
  eq("an older name names itself", why("MODALWERT(1;2;3)"), "#NV Keine Zahl kommt mehr als einmal vor, darum hat MODALWERT keinen häufigsten Wert.");
  eq("…in English", why("MODE(1,2,3)", {}, "en"), "#N/A No number occurs more than once, so MODE has no most frequent value.");
  eq("passed on by a formula using it", why("STABW.S(A1:A3)*2", one), why("STABW.S(A1:A3)", one));
  eq("CHIQU.TEST with an empty count", why("CHIQU.TEST(A1:A2;B1:B2)", { A1: 5, B1: 4, B2: 3 }), "#ZAHL! Bei CHIQU.TEST darf „Beob_Messwerte“ nur Zahlen enthalten, keine leeren Zellen und keinen Text (für „keine“ trag 0 ein).");
  check("a real division by zero keeps its words", why("1/0").includes("Teiler ist 0"));
  eq("the error codes stay Excel's", [de("STABW.S(1)"), de("QUANTIL.INKL(A1:A3;2)", one)].map((v) => (E.isError(v) ? v.error : v)), ["#DIV/0!", "#NUM!"]);
}

// ==============================================================================================
section("criteria: an empty criteria cell, and <>");
{
  // LibreOffice 24.2 (Microsoft documents the empty criteria cell as 0 for COUNTIFS and AVERAGEIF).
  const cells = { A1: 0, A2: 5, A4: "x", A5: '=""', A6: 0, A8: 7, B1: 10, B2: 20, B3: 30, B4: 40, B5: 50, B6: 60, B7: 70, B8: 80 };
  eq("COUNTIF with an empty criteria cell counts zeros", [ev("COUNTIF(A1:A8,D1)", cells), ev("COUNTIFS(A1:A8,D1)", cells)], [2, 2]);
  eq("SUMIF and AVERAGEIF too", [ev("SUMIF(A1:A8,D1,B1:B8)", cells), ev("AVERAGEIF(A1:A8,D1,B1:B8)", cells)], [70, 35]);
  eq('"<>" counts a formula giving "" as filled (like COUNTA)', [ev('COUNTIF(A1:A8,"<>")', cells), ev("COUNTA(A1:A8)", cells), ev('SUMIF(A1:A8,"<>",B1:B8)', cells)], [6, 6, 260]);
  eq('"" and "=" unchanged', [ev('COUNTIF(A1:A8,"")', cells), ev('COUNTIF(A1:A8,"=")', cells), ev("COUNTBLANK(A1:A8)", cells)], [3, 2, 3]);
  eq("a summary row without its subject yet: 0, not every empty row", de("ZÄHLENWENN(B2:B100;E3)", { B2: "positiv", B3: "negativ", B4: "positiv" }), 0);
}

// ==============================================================================================
section("lookups with an empty lookup cell");
{
  // LibreOffice 24.2 (review/formulas/verify-1/lookup_blank.lo.json); Excel gives #N/A as well.
  const cells: Record<string, CellInput> = { A2: 0, A3: 2, A4: 4, A5: 6, A6: 8, A7: 10, A8: 12, B2: 0.002, B3: 0.105, B4: 0.209, B5: 0.311, B6: 0.418, B7: 0.52, B8: 0.63, C2: "Blank", C3: "S1", C4: "S2", C5: "S3", C6: "S4", C7: "S5", C8: "S6", G2: 0, H2: 2, G3: "Blank", H3: "S1", A10: '=""' };
  for (const f of ["VLOOKUP(A9,A2:C8,2,FALSE)", "VLOOKUP(A9,A2:C8,2,TRUE)", "VLOOKUP(A9,A2:C8,3)", "MATCH(A9,A2:A8,0)", "MATCH(A9,A2:A8)", "HLOOKUP(A9,G2:H3,2,FALSE)", "XLOOKUP(A9,A2:A8,B2:B8)", "XMATCH(A9,A2:A8)", "LOOKUP(A9,A2:A8,B2:B8)", "VLOOKUP(A10,A2:C8,2,FALSE)"]) err(`${f} finds nothing`, ev(f, cells), "#N/A");
  eq("WENNFEHLER shows the fallback, not the 0-key's value", ev('IFERROR(VLOOKUP(A9,A2:C8,2,FALSE),"-")', cells), "-");
  eq("a left-out lookup value still means 0", [ev("MATCH(,A2:A8,0)", cells), ev("VLOOKUP(,A2:C8,2,FALSE)", cells)], [1, 0.002]);
  eq("lifted over a range, element by element", [ev("INDEX(VLOOKUP(A8:A9,A2:C8,2,FALSE),1)", cells), (ev("INDEX(VLOOKUP(A8:A9,A2:C8,2,FALSE),2)", cells) as E.CellError).error], [0.63, "#N/A"]);
}

// ==============================================================================================
section("SUBTOTAL: rows filtered and hidden by hand");
{
  // A1:A5 = 10…50; row 2 filtered, row 3 hidden by hand, row 4 both (Excel: 1–11 never count filtered rows).
  const wb = book(mkSheet("s1", "Blatt 1", { A1: 10, A2: 20, A3: 30, A4: 40, A5: 50, B1: "=SUBTOTAL(9,A1:A5)", B2: "=SUBTOTAL(109,A1:A5)", B3: "=SUBTOTAL(2,A1:A5)", B4: "=SUBTOTAL(1,A1:A5)" }, { rows: { "2": { hidden: true }, "3": { hidden: true } } }));
  const filtered = (row: number) => row === 1 || row === 3;
  const c = E.createCalc(wb, { isRowHidden: (_s, row) => filtered(row) || row === 2 || row === 3, isRowFiltered: (_s, row) => filtered(row) });
  eq("9, 2 and 1 skip filtered rows, also those hidden by hand", [c.value("s1", 0, 1), c.value("s1", 2, 1), c.value("s1", 3, 1)], [90, 3, 30]);
  eq("109 skips every hidden row", c.value("s1", 1, 1), 60);
  const old = E.createCalc(wb, { isRowHidden: (_s, row) => filtered(row) || row === 2 || row === 3 });
  eq("without isRowFiltered: as before", old.value("s1", 0, 1), 130);
}

// ==============================================================================================
section("MOD and rounding to steps with big numbers");
{
  // LibreOffice 24.2 (review/formulas/verify-1/mod_cases.lo.json).
  eq("MOD(1E15;7)", ev("MOD(1E15,7)"), 6);
  eq("MOD(1E14+0,5;1)", ev("MOD(1E14+0.5,1)"), 0.5);
  near("MOD(46329,99999999;1)", ev("MOD(46329.99999999,1)"), 0.9999999900028342, 1e-12);
  near("MOD(999,9999999995;1)", ev("MOD(999.9999999995,1)"), 0.9999999995000053, 1e-12);
  eq("binary noise is still 0", [ev("MOD(0.3,0.1)"), ev("MOD(12.5,2.5)"), ev("MOD(12345.6,0.1)")], [0, 0, 0]);
  eq("the divisor's sign", [ev("MOD(-1,3)"), ev("MOD(5.5,-2)"), ev("MOD(-46329.99999999,1)") as number > 0], [2, -0.5, true]);
  eq("QUOTIENT(1E15;7)", ev("QUOTIENT(1E15,7)"), 142857142857142);
  eq("FLOOR, CEILING, MROUND of 1E15+3", [ev("FLOOR(1E15+3,7)"), ev("CEILING(1E15+3,7)"), ev("MROUND(1E15+3,7)")], [1000000000000001, 1000000000000008, 1000000000000001]);
  err("beyond 2^53 there is no remainder", ev("MOD(2^60,7)"), "#NUM!");
  // An hourly time series from 03.11.2026 18:00 (=A1+1/24 down a column) reaches midnight with binary noise.
  const cells: Record<string, CellInput> = { A1: 46329.75 };
  for (let i = 2; i <= 40; i++) {
    cells[`A${i}`] = `=A${i - 1}+1/24`;
    cells[`B${i}`] = `=MOD(A${i},1)`;
    cells[`C${i}`] = `=HOUR(MOD(A${i},1))`;
  }
  const ts = book1(cells);
  let negative = 0;
  for (let i = 2; i <= 40; i++) if ((val(ts, `B${i}`) as number) < 0) negative++;
  eq("never a negative time of day", negative, 0);
  eq("midnight is hour 0", [val(ts, "B7"), val(ts, "C7")], [0, 0]);
}

// ==============================================================================================
section("lab units");
{
  const P = (t: string) => E.parseInput(t, "de");
  const unit = (t: string) => {
    const r = P(t);
    return typeof r.cell.v === "number" && r.fmt && "unit" in r.fmt ? `${r.cell.v} ${r.fmt.unit}` : `text ${show(r.cell.v)}`;
  };
  eq("molar mass, ppm, density, conductivity, flow", ["58,44 g/mol", "5 ppm", "12 ppb", "1,02 g/cm³", "450 µS/cm", "2,5 mL/min", "1,5 l/min", "3 mg/kg", "5 U/µL", "0,5 OD", "45°"].map(unit), ["58.44 g/mol", "5 ppm", "12 ppb", "1.02 g/cm³", "450 µS/cm", "2.5 mL/min", "1.5 l/min", "3 mg/kg", "5 U/µL", "0.5 OD", "45 °"]);
  eq("a 3 or 2 after a unit is its power", [unit("1,02 g/cm3"), unit("1,2 kg/m3"), unit("25 cm2")], ["1.02 g/cm³", "1.2 kg/m³", "25 cm²"]);
  eq("…right after it: a digit on its own is no power", [unit("10 cm 3"), unit("3 g 2")], ['text "10 cm 3"', 'text "3 g 2"']);
  const shown = (t: string) => {
    const r = P(t);
    return E.formatValue(r.cell.v ?? null, r.fmt, "de");
  };
  eq("an angle's ° follows the number, °C keeps its (narrow) space", [shown("45°"), shown("45 °"), shown("37 °C"), shown("12,5 mg/L")], ["45°", "45°", "37\u202f°C", "12,5\u202fmg/L"]);
  eq("words stay text", ["3 Proben", "2 Kolben", "3 Tage", "5 g Zucker"].map(unit), ['text "3 Proben"', 'text "2 Kolben"', 'text "3 Tage"', 'text "5 g Zucker"']);
  eq("50 % is a percentage", P("50 %").fmt, { kind: "percent", decimals: 0 });
  eq("MITTELWERT counts them", val(book1({ A1: P("58,44 g/mol").cell.v as number, A2: P("40 g/mol").cell.v as number, A3: "=AVERAGE(A1:A2)" }), "A3"), 49.22);
}

// ==============================================================================================
section("wildcards in linear time");
{
  // A RegExp backtracks on many stars (7 stars on 60 characters took seconds); the glob matcher doesn't.
  const g = (p: string, opts?: E.GlobOptions) => E.compileGlob(p, opts);
  eq("whole text", [E.globTest(g("Probe*"), "Probe 12"), E.globTest(g("Probe*"), "Eine Probe"), E.globTest(g("?robe"), "probe"), E.globTest(g("a~*b"), "a*b"), E.globTest(g("a~*b"), "axb"), E.globTest(g("~~"), "~"), E.globTest(g("*"), "")], [true, false, true, true, false, true, true]);
  eq("begins, ends, contains", [E.globTest(g("pro"), "Probe", "begins"), E.globTest(g("be"), "Probe", "ends"), E.globTest(g("o?e"), "Probe", "contains"), E.globTest(g("x"), "Probe", "contains")], [true, true, true, false]);
  eq("match case", [E.globTest(g("probe", { matchCase: true }), "Probe"), E.globTest(g("Probe", { matchCase: true }), "Probe")], [false, true]);
  eq("? is one character; with unicode an emoji too", [E.globTest(g("a?b"), "a😀b"), E.globTest(g("a?b", { unicode: true }), "a😀b")], [false, true]);
  eq("find: leftmost start, greedy end", E.globFind(g("b*d"), "abcdbd"), { start: 1, end: 6 });
  eq("replace every match", E.globReplace(g("p?"), "pa pb pc", "X"), "X X X");
  const aaa = "a".repeat(32767);
  const stars = `${"*a".repeat(20)}*b`;
  let t0 = performance.now();
  const counted = ev(`COUNTIF(A1,"${stars}")`, { A1: aaa });
  const searched = ev(`SEARCH("${stars}",A1)`, { A1: aaa });
  const matched = ev(`MATCH("${stars}",A1:A2,0)`, { A1: aaa, A2: "x" });
  const ms = performance.now() - t0;
  eq("COUNTIF, SEARCH and MATCH with 21 stars on 32,767 characters", [counted, (searched as E.CellError).error, (matched as E.CellError).error], [0, "#VALUE!", "#N/A"]);
  check(`…well under a second (${ms.toFixed(1)} ms)`, ms < 300, `${ms.toFixed(1)} ms`);
  t0 = performance.now();
  check("the bare matcher: under 50 ms", !E.globTest(g(stars), aaa) && performance.now() - t0 < 50, `${(performance.now() - t0).toFixed(1)} ms`);
  t0 = performance.now();
  const many = Array.from({ length: 32767 }, (_, i) => String.fromCharCode(0x4e00 + (i % 20000))).join("");
  check("a long piece of many different characters stays quick", !E.globTest(g(`*${many}*`), aaa) && performance.now() - t0 < 500, `${(performance.now() - t0).toFixed(1)} ms`);
  eq("SEARCH finds the first place", [ev('SEARCH("b*d","abcdbd")'), ev('SEARCH("b?d","abcdbd")'), ev('SEARCH("*d","abcdbd",3)'), ev('SEARCH("~*","a*b")'), ev('SEARCH("d?d","abcdbd")')], [2, 2, 3, 2, 4]);
  eq("criteria with wildcards", [ev('COUNTIF(A1:A3,"Pro*")', { A1: "Probe 1", A2: "probe 2", A3: "Wasser" }), ev('COUNTIF(A1:A3,"*e ?")', { A1: "Probe 1", A2: "probe 2", A3: "Wasser" })], [2, 2]);
  // Smart table text filters and find & replace use the same matcher.
  const tb = book(mkSheet("s1", "Blatt 1", { A1: "Name", A2: aaa.slice(0, 60), A3: "Probe A", A4: "Wasser" }));
  const table: TableSpec = { ...tableOn("s1", "A1:A4"), filters: { col1: { kind: "text", op: "contains", text: "a*a*a*a*a*a*a*a*b" } }, sort: null };
  t0 = performance.now();
  eq("table filter with 8 stars", [...hiddenByFilters(calcOf(tb), tb.sheets[0], table, "de")].sort(), [1, 2, 3]);
  check(`…quick (${(performance.now() - t0).toFixed(1)} ms)`, performance.now() - t0 < 100);
  const notContains: TableSpec = { ...table, filters: { col1: { kind: "text", op: "notContains", text: "pro?e" } } };
  eq("table filter: does not contain", [...hiddenByFilters(calcOf(tb), tb.sheets[0], notContains, "de")], [2]);
  t0 = performance.now();
  eq("find with 8 stars", O.findCells(tb, calcOf(tb), "a*a*a*a*a*a*a*a*b", {}, "de"), []);
  eq("replace with 8 stars", O.replaceCells(tb, calcOf(tb), "a*a*a*a*a*a*a*a*b", "x", {}, "de").count, 0);
  check(`…quick (${(performance.now() - t0).toFixed(1)} ms)`, performance.now() - t0 < 100);

  // A text with wildcards longer than 255 characters is no pattern (#WERT!, as Excel gives for any
  // criterion or lookup value that long): a sheet under the 5 MB limit with 150 cells of 32,767
  // characters and one such criteria cell blocked the page for 8 seconds on every open.
  const crafted: Record<string, CellInput> = { B1: `*${"a".repeat(32764)}b*`, C1: "=COUNTIF(A1:A150,B1)", C2: "=MATCH(B1,A1:A150,0)", C3: "=VLOOKUP(B1,A1:A150,1,FALSE)", C4: "=XLOOKUP(B1,A1:A150,A1:A150,,2)", C5: "=SEARCH(B1,A1)", C6: "=SUMIF(A1:A150,B1)", C7: "=XMATCH(B1,A1:A150,2)" };
  for (let i = 1; i <= 150; i++) crafted[`A${i}`] = aaa;
  t0 = performance.now();
  const cw = book1(crafted);
  const codes = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"].map((a) => (val(cw, a) as E.CellError).error);
  const craftedMs = performance.now() - t0;
  eq("a pattern of 32,767 characters: #WERT! in COUNTIF, MATCH, VLOOKUP, XLOOKUP, SEARCH, SUMIF, XMATCH", codes, Array(7).fill("#VALUE!"));
  check(`…the crafted sheet calculates in under 200 ms (${craftedMs.toFixed(0)} ms)`, craftedMs < 200, `${craftedMs.toFixed(0)} ms`);
  eq("…and says why", E.explainError(val(cw, "C1") as E.CellError, "de"), "Das Suchmuster ist zu lang: höchstens 255 Zeichen, wie in Excel.");
  const p255 = `*${"a".repeat(253)}*`;
  const p256 = `*${"a".repeat(254)}*`;
  eq("255 characters still match, 256 don't", [ev(`COUNTIF(A1:A2,"${p255}")`, { A1: aaa, A2: "b" }), (ev(`COUNTIF(A1:A2,"${p256}")`, { A1: aaa }) as E.CellError).error], [1, "#VALUE!"]);
  // Without wildcards a long text is compared as it is (no pattern to match), as before.
  const longText = "Kolonie ".repeat(100);
  eq("long text without wildcards still counts and looks up", [ev("COUNTIF(A1:A3,A1)", { A1: longText, A2: longText, A3: "x" }), ev("MATCH(A1,A2:A3,0)", { A1: longText, A3: longText }), ev("SEARCH(A1,A2)", { A1: longText, A2: `x${longText}` })], [2, 2, 2]);
  eq("XLOOKUP's exact mode takes * and ? as they are, at any length", ev("XLOOKUP(A1,A2:A3,B2:B3)", { A1: `${longText}*?`, A2: "x", A3: `${longText}*?`, B3: 7 }), 7);
  eq("comparisons (<, >) take no wildcards", ev(`COUNTIF(A1:A2,">${"*".repeat(300)}")`, { A1: "b", A2: "a" }), 2);
  t0 = performance.now();
  const plainSearch = ev("SEARCH(A2,A1)", { A1: aaa, A2: `${"a".repeat(30000)}b` }) as E.CellError;
  const plainMs = performance.now() - t0;
  eq("SEARCH of a long text without wildcards in a long text", [plainSearch.error, plainSearch.detail], ["#VALUE!", "not-found"]);
  check(`…is quick (${plainMs.toFixed(0)} ms)`, plainMs < 100, `${plainMs.toFixed(0)} ms`);

  // The matcher against the RegExp it replaced, on short texts full of case-folding traps (ß, ẞ,
  // ı, İ, ſ, the Kelvin sign, σ/ς/Σ, emoji, Deseret letters, ǅ, ﬀ): the browser's own search
  // must find the same.
  const reSource = (p: string, lazy = false) => {
    let s = "";
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      if (ch === "~" && i + 1 < p.length && "*?~".includes(p[i + 1])) s += p[++i].replace(/[*?]/, "\\$&");
      else if (ch === "*") s += lazy ? "[\\s\\S]*?" : "[\\s\\S]*";
      else if (ch === "?") s += "[\\s\\S]";
      else s += ch.replace(/[\\^$.|+()[\]{}]/g, "\\$&");
    }
    return s;
  };
  let seed = 4711;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = ["a", "A", "b", "B", "ä", "Ä", "ß", "ẞ", "s", "S", "k", "K", "\u212a", "ı", "I", "i", "İ", "σ", "ς", "Σ", "😀", "\u{10428}", "\u{10400}", "\u01c5", "x", " ", ".", "ﬀ", "ſ", "µ", "μ"];
  const pick = (n: number, extra: string[] = []) => Array.from({ length: n }, () => [...alphabet, ...extra][Math.floor(rnd() * (alphabet.length + extra.length))]).join("");
  const mismatches: string[] = [];
  for (let k = 0; k < 4000; k++) {
    const p = pick(Math.floor(rnd() * 6), ["*", "*", "?", "~*", "~~"]);
    const t = pick(Math.floor(rnd() * 10));
    for (const [flags, opts] of [["i", {}], ["iu", { unicode: true }], ["", { matchCase: true }]] as const) {
      const gl = E.compileGlob(p, opts);
      if (new RegExp(`^${reSource(p)}$`, flags).test(t) !== E.globTest(gl, t)) mismatches.push(`whole/${flags} ${p} ${t}`);
      if (new RegExp(reSource(p), flags).test(t) !== E.globTest(gl, t, "contains")) mismatches.push(`contains/${flags} ${p} ${t}`);
      if (flags === "iu") continue;
      const m = new RegExp(reSource(p), flags).exec(t);
      if (show(m && { start: m.index, end: m.index + m[0].length }) !== show(E.globFind(gl, t))) mismatches.push(`find/${flags} ${p} ${t}`);
      const from = Math.floor(rnd() * (t.length + 1));
      const lazy = new RegExp(reSource(p, true), flags).exec(t.slice(from));
      if ((lazy ? lazy.index + from : -1) !== E.globIndex(gl, t, from)) mismatches.push(`index/${flags} ${p} ${t} @${from}`);
    }
  }
  eq("the same results as a RegExp (4,000 patterns × 3 case rules)", mismatches.slice(0, 5), []);
}

// ==============================================================================================
section("long input is read in linear time");
{
  const N = 32767;
  const slow: string[] = [];
  const inputs: [string, string][] = [
    ["number, spaces, x", "1" + " ".repeat(N - 2) + "x"],
    ["number, spaces, %", "1" + " ".repeat(N - 2) + "%"],
    ["number, no-break spaces, €", "1" + " ".repeat(N - 2) + "€"],
    ["€, spaces, text", "€" + " ".repeat(N - 3) + "1x"],
    ["digits, x", "1".repeat(N - 1) + "x"],
    ["time with long fraction", "1:1:1." + "9".repeat(N - 7) + "x"],
    ["number, spaces, time", "1" + " ".repeat(N - 4) + "1:1"],
    ["unit-like letters", "1 " + "g".repeat(N - 2)],
    ["exponent", "1e" + "1".repeat(N - 2) + "x"],
  ];
  for (const [name, text] of inputs) {
    for (const locale of ["de", "en"] as const) {
      const t0 = performance.now();
      E.parseInput(text, locale);
      const ms = performance.now() - t0;
      if (ms > 50) slow.push(`${name} (${locale}): ${ms.toFixed(0)} ms`);
    }
  }
  const t0 = performance.now();
  ev("VALUE(A1)", { A1: "1" + " ".repeat(N - 2) + "%x" });
  if (performance.now() - t0 > 50) slow.push(`VALUE: ${(performance.now() - t0).toFixed(0)} ms`);
  eq("32,767 characters each under 50 ms", slow, []);
  eq("long numbers still read", [E.parseInput("0," + "0".repeat(40) + "1", "de").cell.v, E.parseInput("1.000.000.000.000.000", "de").cell.v, E.parseInput("5" + " ".repeat(200) + "%", "de").cell.v], [1e-41, 1e15, 0.05]);
}

// ==============================================================================================
section("formula length");
{
  // Excel takes formulas of up to 8,192 characters; longer ones would vanish when the sheet is saved.
  const sum = (n: number) => `=${Array.from({ length: n }, () => "1").join("+")}`;
  const fits = E.parseInput(sum(4096), "de");
  eq("8,191 characters fit", [fits.error, fits.cell.f?.length], [undefined, 8191]);
  const long = E.parseInput(sum(4097), "de");
  eq("8,193 don't", [long.cell, long.error?.message], [{}, "Die Formel ist zu lang: höchstens 8.192 Zeichen, wie in Excel. Verteil die Rechnung auf mehrere Zellen."]);
  eq("in English too", E.parseInput(sum(4097), "en").error?.message, "The formula is too long: 8,192 characters at most, as in Excel. Spread the calculation over several cells.");
  // What counts is what is stored: German names are longer than the English ones.
  const german = `=${Array.from({ length: 700 }, () => "MITTELWERT(1)").join("+")}`;
  eq("a German formula is measured as stored", [german.length > 8192 + 1, E.parseInput(german, "de").error, E.parseInput(german, "de").cell.f?.length], [true, undefined, 700 * 10 + 699]);
  const huge = E.parseInput(`=${"1+".repeat(50000)}1`, "de");
  check("far too long: refused without reading it", !!huge.error?.message.startsWith("Die Formel ist zu lang"));
  check("+A1 without = as well", !!E.parseInput(`+A1${"+1".repeat(4100)}`, "de").error);
}

// ==============================================================================================
if (failures.length) {
  console.error(`check:sheet — ${failures.length} of ${count} checks failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:sheet — all ${count} checks passed.`);
console.log(`  timings: ${timings.join("; ")}`);
