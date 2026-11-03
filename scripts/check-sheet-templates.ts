// Checks the spreadsheet's content before you commit: the function help (src/sheet/engine/docs.ts)
// and the lab templates (src/sheet/templates.ts).
//
//   npx tsx --tsconfig tsconfig.json scripts/check-sheet-templates.ts
//
// Function help, for every function in names.ts, in English and German:
//   - an entry exists (and none for unknown functions); summary, example and result are filled in
//   - the arguments match between the languages (count, optional, repeat) and are named like Excel's
//     (no spaces); once an argument is optional, the rest are too
//   - the example uses the function by its name in that language, with as many arguments as it takes,
//     ";" and decimal commas in German, "," and decimal points in English, plain ASCII operators
//   - the German and the English example are the same formula (names, separators and texts aside)
//   - with the engine: both examples parse, and turn into the same canonical formula
// Templates, each built in both languages:
//   - the workbook's structure: unique ids and names, cells, sizes, freeze, column widths
//   - charts and smart tables point at existing sheets and stay inside them, tables don't overlap,
//     header cells are unique texts, a totals row has formulas
//   - every formula: known functions with the right number of arguments, balanced brackets,
//     references inside the sheet (checked with a small tokenizer, so it works without the engine)
//   - both languages build the same layout (same cells, same formulas apart from texts)
//   - with the engine: every formula calculates without an error, the key numbers (slope, R²,
//     concentrations, means, µ, masses, volumes, grade averages) match an independent calculation,
//     and every formula survives the round trip into German and back
// Problems make the script exit with 1.

import { resolveText } from "@/i18n/text";
import { cellKey, parseKey, parsePos } from "@/sheet/a1";
import { FUNCTION_DOCS, type FnDoc } from "@/sheet/engine/docs";
import { FUNCTION_BY_DE, FUNCTION_BY_EN, FUNCTION_NAMES } from "@/sheet/engine/names";
import { SHEET_TEMPLATES } from "@/sheet/templates";
import { MAX_COLS, MAX_ROWS, type Area, type RangeRef, type Sheet, type Workbook } from "@/sheet/types";
import * as engine from "@/sheet/engine";

const LOCALES = ["en", "de"] as const;
type Lang = (typeof LOCALES)[number];

const problems: string[] = [];
const fail = (where: string, msg: string): undefined => {
  problems.push(`${where}: ${msg}`);
  return undefined;
};
const notes: string[] = [];

// ----------------------------------------------------------------------------------------------
// A small tokenizer for formulas (canonical, or as typed in a language), independent of the engine

type Tok = { k: "str" | "num" | "fn" | "ref" | "bool" | "op" | "open" | "close" | "sep" | "err" | "name"; t: string };

const REF_RE = /^(?:(?:'(?:[^']|'')+'|[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*)!)?(?:\$?[A-Z]{1,3}\$?[0-9]{1,6}(?::\$?[A-Z]{1,3}\$?[0-9]{1,6})?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?[0-9]{1,6}:\$?[0-9]{1,6})/;

function tokenize(src: string, lang: Lang | "canon"): Tok[] | string {
  const toks: Tok[] = [];
  const sep = lang === "de" ? ";" : ",";
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const ch = src[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      for (;;) {
        if (j >= src.length) return `unclosed text at ${i}`;
        if (src[j] === '"') {
          if (src[j + 1] === '"') j += 2;
          else break;
        } else j++;
      }
      toks.push({ k: "str", t: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    const fn = /^([A-ZÄÖÜ][A-ZÄÖÜ0-9.]*)\(/.exec(rest);
    if (fn) {
      toks.push({ k: "fn", t: fn[1] });
      toks.push({ k: "open", t: "(" });
      i += fn[0].length;
      continue;
    }
    const ref = REF_RE.exec(rest);
    if (ref && !/^[A-Za-z0-9_.(]/.test(rest.slice(ref[0].length))) {
      toks.push({ k: "ref", t: ref[0] });
      i += ref[0].length;
      continue;
    }
    const bool = /^(TRUE|FALSE|WAHR|FALSCH)(?![A-Za-z0-9_.(])/.exec(rest);
    if (bool) {
      toks.push({ k: "bool", t: bool[1] });
      i += bool[0].length;
      continue;
    }
    const num = lang === "de" ? /^[0-9]+(?:,[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(rest) : /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(rest);
    if (num) {
      toks.push({ k: "num", t: num[0] });
      i += num[0].length;
      continue;
    }
    const err = /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|VALUE!|NV|WERT!|BEZUG!|ZAHL!)/.exec(rest);
    if (err) {
      toks.push({ k: "err", t: err[0] });
      i += err[0].length;
      continue;
    }
    const op = /^(<=|>=|<>|[-+*/^&=<>%])/.exec(rest);
    if (op) {
      toks.push({ k: "op", t: op[1] });
      i += op[0].length;
      continue;
    }
    if (ch === "(") {
      toks.push({ k: "open", t: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      toks.push({ k: "close", t: ch });
      i++;
      continue;
    }
    if (ch === sep) {
      toks.push({ k: "sep", t: ch });
      i++;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (name) {
      toks.push({ k: "name", t: name[0] });
      i += name[0].length;
      continue;
    }
    return `unexpected "${ch}" at ${i} in ${src}`;
  }
  return toks;
}

type Call = { fn: string; args: number };

/** Function calls with their argument counts; a string when the brackets don't match. */
function calls(toks: Tok[]): Call[] | string {
  const out: Call[] = [];
  const stack: { call: Call | null; empty: boolean }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.k === "close") {
      const top = stack.pop();
      if (!top) return "a closing bracket too many";
      if (top.call && !top.empty) top.call.args++;
    } else if (tok.k === "sep") {
      const top = stack[stack.length - 1];
      if (!top?.call) return "a separator outside a function";
      top.call.args++;
      // What follows the separator is an argument too, even when it's left empty: f(a,)
      top.empty = false;
    } else {
      // Anything else (a nested call or bracket included) fills the argument it is in.
      if (stack.length) stack[stack.length - 1].empty = false;
      if (tok.k === "fn") {
        const call = { fn: tok.t, args: 0 };
        out.push(call);
        stack.push({ call, empty: true });
        i++; // the "(" that follows
      } else if (tok.k === "open") stack.push({ call: null, empty: true });
    }
  }
  if (stack.length) return "a bracket isn't closed";
  return out;
}

/** How many arguments a function takes, from its English help. */
function arity(fn: string): { min: number; max: number } | null {
  const doc = FUNCTION_DOCS[fn]?.en;
  if (!doc) return null;
  const min = doc.args.filter((a) => !a.optional).length;
  return { min, max: doc.args.some((a) => a.repeat) ? Infinity : doc.args.length };
}

function checkCalls(where: string, found: Call[], byName: (name: string) => string | undefined) {
  for (const c of found) {
    const en = byName(c.fn);
    if (!en) {
      fail(where, `unknown function ${c.fn}`);
      continue;
    }
    const a = arity(en);
    if (a && (c.args < a.min || c.args > a.max)) fail(where, `${c.fn} with ${c.args} argument(s), takes ${a.min}${a.max === Infinity ? "+" : a.max === a.min ? "" : `–${a.max}`}`);
  }
}

// ----------------------------------------------------------------------------------------------
// Function help

const DE_NAME = new Map(FUNCTION_NAMES.map((f) => [f.en, f.de]));

/** The same formula in a neutral form: English names, "," separators, "." decimals, texts and booleans blanked. */
function neutral(toks: Tok[], lang: Lang): string {
  return toks
    .map((tok) => {
      if (tok.k === "fn") return lang === "de" ? (FUNCTION_BY_DE.get(tok.t)?.en ?? `?${tok.t}`) : tok.t;
      if (tok.k === "num") return lang === "de" ? tok.t.replace(",", ".") : tok.t;
      if (tok.k === "str") return '"…"';
      if (tok.k === "bool") return tok.t === "WAHR" ? "TRUE" : tok.t === "FALSCH" ? "FALSE" : tok.t;
      if (tok.k === "sep") return ",";
      if (tok.k === "err") return "#ERR";
      return tok.t;
    })
    .join("");
}

function checkDoc(fn: string, lang: Lang, doc: FnDoc) {
  const where = `docs ${fn} (${lang})`;
  const local = lang === "de" ? DE_NAME.get(fn)! : fn;
  if (!doc.summary?.trim()) fail(where, "no summary");
  if (doc.summary.length > 260) fail(where, `summary is long (${doc.summary.length} characters)`);
  if (!doc.exampleResult?.trim()) fail(where, "no example result");
  if (doc.tip !== undefined && !doc.tip.trim()) fail(where, "empty tip");
  let optional = false;
  for (const a of doc.args) {
    if (!a.name.trim() || /\s/.test(a.name)) fail(where, `argument name "${a.name}"`);
    if (!a.desc.trim()) fail(where, `no description for ${a.name}`);
    if (a.repeat && !a.optional) fail(where, `${a.name} repeats but isn't optional`);
    if (optional && !a.optional) fail(where, `${a.name} is required after an optional argument`);
    optional ||= !!a.optional;
  }
  const text = [doc.summary, doc.example, doc.exampleResult, doc.tip ?? "", ...doc.args.flatMap((a) => [a.name, a.desc])].join(" ");
  if (/✨|✨/.test(text)) fail(where, "a sparkle");
  if (!doc.example.startsWith("=")) return fail(where, `example doesn't start with "=": ${doc.example}`);
  const body = doc.example.slice(1);
  const outside = body.replace(/"(?:[^"]|"")*"/g, '""');
  if (/[−×÷“”„‘’]/.test(outside)) fail(where, `typographic characters in the example formula: ${doc.example}`);
  if (lang === "en" && outside.includes(";")) fail(where, `";" in an English example: ${doc.example}`);
  if (lang === "de" && /,(?![0-9])|(?<![0-9]),/.test(outside)) fail(where, `"," that isn't a decimal comma in a German example: ${doc.example}`);
  const toks = tokenize(body, lang);
  if (typeof toks === "string") return fail(where, `example: ${toks}`);
  const found = calls(toks);
  if (typeof found === "string") return fail(where, `example: ${found}`);
  const own = found.find((c) => c.fn === local);
  if (!own) fail(where, `the example doesn't call ${local}: ${doc.example}`);
  checkCalls(`${where} example`, found, (name) => (lang === "de" ? FUNCTION_BY_DE.get(name)?.en : FUNCTION_BY_EN.has(name) ? name : undefined));
  return neutral(toks, lang);
}

function checkDocs() {
  const names = new Set(FUNCTION_NAMES.map((f) => f.en));
  for (const fn of names) if (!FUNCTION_DOCS[fn]) fail("docs", `no entry for ${fn}`);
  for (const fn of Object.keys(FUNCTION_DOCS)) if (!names.has(fn)) fail("docs", `entry for unknown function ${fn}`);
  for (const fn of names) {
    const pair = FUNCTION_DOCS[fn];
    if (!pair) continue;
    const en = checkDoc(fn, "en", pair.en);
    const de = checkDoc(fn, "de", pair.de);
    if (en && de && en !== de) fail(`docs ${fn}`, `the examples differ:\n      en ${en}\n      de ${de}`);
    if (pair.en.args.length !== pair.de.args.length) fail(`docs ${fn}`, `${pair.en.args.length} English arguments, ${pair.de.args.length} German`);
    else
      pair.en.args.forEach((a, i) => {
        const b = pair.de.args[i];
        if (!!a.optional !== !!b.optional || !!a.repeat !== !!b.repeat) fail(`docs ${fn}`, `argument ${i + 1} (${a.name} / ${b.name}) is optional or repeats in one language only`);
      });
    if (!!pair.en.tip !== !!pair.de.tip) fail(`docs ${fn}`, "a tip in one language only");
  }
  return names.size;
}

// ----------------------------------------------------------------------------------------------
// Function help: the examples calculate what the help says (with the engine)

/** What an example's result text claims, when it states one: "0,505 – …", "„mittel“", "WAHR", "#NV", "03.11.2026". */
type Claim = { num: number; decimals: number } | { date: number } | { text: string } | { bool: boolean } | { error: string };

function claimOf(result: string, lang: Lang): Claim | null {
  let s = result.trim();
  if (/^(z\. ?b\.|e\.g\.)/i.test(s)) return null; // "E.g. 0.012": an illustration, not a promise
  s = s.replace(/^(etwa|about)\s+/i, "");
  const quoted = /^[„“"]([^“”"]*)[“”"]/.exec(s);
  if (quoted) return { text: quoted[1] };
  const bool = /^(WAHR|FALSCH|TRUE|FALSE)\b/.exec(s);
  if (bool) return { bool: bool[1] === "WAHR" || bool[1] === "TRUE" };
  if (s.startsWith("#")) return { error: s.split(/[\s,.;]/)[0] };
  const date = lang === "de" ? /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s) : /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (date) {
    const [d, m] = lang === "de" ? [date[1], date[2]] : [date[2], date[1]];
    return { date: (Date.UTC(Number(date[3]), Number(m) - 1, Number(d)) - Date.UTC(1899, 11, 30)) / 86400000 };
  }
  if (/^\d+:\d/.test(s)) return null; // a time of day
  const n = (lang === "de" ? /^[−-]?\d+(?:\.\d{3})*(?:,\d+)?/ : /^[−-]?\d+(?:,\d{3})*(?:\.\d+)?/).exec(s);
  if (!n) return null;
  const plain = n[0].replace("−", "-");
  const norm = lang === "de" ? plain.replace(/\./g, "").replace(",", ".") : plain.replace(/,/g, "");
  return { num: Number(norm), decimals: (norm.split(".")[1] ?? "").length };
}

// Data for the examples that read cells, as the help describes it (cells in A1 notation; "=…" is a formula).
type Fixture = Record<string, number | string>;
const CAL_X = { B2: 0, B3: 2, B4: 4, B5: 6, B6: 8, B7: 10 };
const CAL_Y = { C2: 0.003, C3: 0.104, C4: 0.207, C5: 0.318, C6: 0.423, C7: 0.522 };
const CALIBRATION = { ...CAL_X, ...CAL_Y };
const TRIPLICATE = { B2: 0.512, B3: 0.498, B4: 0.505 };
const LOG_PHASE = { A5: 1.5, A6: 2, A7: 2.5, A8: 3, A9: 3.5, B5: 0.088, B6: 0.172, B7: 0.351, B8: 0.694, B9: 1.36 };
const FIXTURES: Record<string, (lang: Lang) => Fixture> = {
  ...Object.fromEntries(["AVERAGE", "STDEV.S", "STDEV.P", "STDEV", "STDEVP", "VAR.S", "VAR.P", "VAR", "VARP", "COUNT"].map((fn) => [fn, () => TRIPLICATE])),
  ...Object.fromEntries(["SLOPE", "INTERCEPT", "RSQ", "STEYX", "FORECAST", "FORECAST.LINEAR", "TREND", "LINEST", "CORREL", "PEARSON", "COVARIANCE.S", "COVARIANCE.P", "MIN", "MAX", "INDEX"].map((fn) => [fn, () => CALIBRATION])),
  ...Object.fromEntries(["LOGEST", "GROWTH"].map((fn) => [fn, () => LOG_PHASE])),
  MEDIAN: () => ({ B2: 0.501, B3: 0.498, B4: 0.505, B5: 0.512, B6: 0.731 }),
  AVERAGEA: (lang) => ({ B2: 2, B3: 4, B4: lang === "de" ? "n. b." : "n.d.", B5: 6 }),
  SUMPRODUCT: () => ({ B2: 2.3, B3: 1.7, B4: 2.7, B5: 1.3, C2: 2, C3: 1, C4: 2, C5: 1 }),
  "T.TEST": () => ({ ...TRIPLICATE, C2: 0.431, C3: 0.452, C4: 0.44 }),
  IF: () => ({ B2: 0.638, ...CAL_Y }),
  IFS: () => ({ D2: 0.034 }),
  AND: () => ({ B2: 0.5 }),
  OR: (lang) => ({ C2: lang === "de" ? "positiv" : "positive", D2: 50 }),
  NOT: () => ({ B2: 1 }),
  XOR: () => ({ B2: 1, C2: 0 }),
  ISNUMBER: () => ({ B2: 0.5 }),
  ISTEXT: (lang) => ({ A2: lang === "de" ? "Probe A" : "Sample A" }),
  ISFORMULA: () => ({ D5: "=1+1" }),
  MATCH: (lang) => (lang === "de" ? { A2: "Probe A", A3: "Probe B", A4: "Probe C" } : { A2: "Sample A", A3: "Sample B", A4: "Sample C" }),
  VLOOKUP: () => ({ A2: "NaCl", C2: 58.44 }),
  XLOOKUP: () => ({ A2: "NaCl", A3: "Tris", C2: 58.44, C3: 121.14 }),
  COUNTIFS: () => ({ B2: "E. coli", B3: "E. coli", B4: "S. aureus", D2: 350, D3: 120, D4: 400 }),
  TEXTJOIN: (lang) => (lang === "de" ? { A2: "Probe A", A4: "Probe C" } : { A2: "Sample A", A4: "Sample C" }),
};

function fixtureBook(fixture: Fixture): Workbook {
  const cells: Sheet["cells"] = {};
  for (const [a1, v] of Object.entries(fixture)) {
    const p = parsePos(a1)!;
    cells[cellKey(p.row, p.col)] = typeof v === "string" && v.startsWith("=") ? { f: v.slice(1) } : { v };
  }
  return { v: 1, sheets: [{ id: "fx", name: "Fixture", cells, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 200, cols: 26 } }], charts: [], tables: [] };
}

function checkExampleValues() {
  let compared = 0;
  for (const f of FUNCTION_NAMES) {
    const pair = FUNCTION_DOCS[f.en];
    if (!pair) continue;
    for (const lang of LOCALES) {
      const doc = pair[lang];
      const where = `docs ${f.en} (${lang}) example`;
      const parsed = engine.toCanonicalFormula(doc.example.slice(1), lang);
      if ("error" in parsed) continue; // reported by the parse check
      const fixture = FIXTURES[f.en]?.(lang);
      // Examples that read cells only calculate meaningfully with their data.
      if (!fixture && engine.formulaRefs(parsed.formula).length) continue;
      const calc = engine.createCalc(fixtureBook(fixture ?? {}), { now: () => new Date(2026, 10, 3, 14, 30), locale: lang });
      // Z2: an even row, for =ISEVEN(ROW()).
      const v = calc.evaluate(parsed.formula, { sheetId: "fx", row: 1, col: 25 });
      if (engine.isError(v)) {
        const claim = claimOf(doc.exampleResult, lang);
        if (!(claim && "error" in claim && engine.errorText(v.error, lang) === claim.error)) fail(where, `${doc.example} gives ${v.error}`);
        continue;
      }
      if (f.en === "RAND" || f.en === "RANDBETWEEN") continue;
      const claim = claimOf(doc.exampleResult, lang);
      if (!claim) continue;
      compared++;
      const bad = (want: string) => fail(where, `${doc.example} gives ${JSON.stringify(v)}, the help says ${want}`);
      if ("num" in claim) {
        if (typeof v !== "number" || Math.abs(Math.round(v * 10 ** claim.decimals) / 10 ** claim.decimals - claim.num) > 1e-9) bad(String(claim.num));
      } else if ("date" in claim) {
        if (v !== claim.date) bad(`date number ${claim.date}`);
      } else if ("text" in claim) {
        if (v !== claim.text) bad(JSON.stringify(claim.text));
      } else if ("bool" in claim) {
        if (v !== claim.bool) bad(String(claim.bool));
      } else bad(claim.error);
    }
  }
  return compared;
}

// ----------------------------------------------------------------------------------------------
// Templates: structure

const inSheet = (s: Sheet, a: Area) => a.r0 >= 0 && a.c0 >= 0 && a.r0 <= a.r1 && a.c0 <= a.c1 && a.r1 < s.size.rows && a.c1 < s.size.cols;
const overlaps = (a: Area, b: Area) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

function checkRange(where: string, wb: Workbook, r: RangeRef | null, opts: { single?: boolean; line?: boolean } = {}) {
  if (!r) return;
  const s = wb.sheets.find((x) => x.id === r.sheetId);
  if (!s) return fail(where, `points at a missing sheet ${r.sheetId}`);
  if (!inSheet(s, r)) fail(where, `range ${JSON.stringify(r)} outside the sheet`);
  if (opts.single && (r.r0 !== r.r1 || r.c0 !== r.c1)) fail(where, "should be one cell");
  if (opts.line && r.r0 !== r.r1 && r.c0 !== r.c1) fail(where, "should be one row or one column");
}

const cellsOf = (r: RangeRef) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);

function checkFormula(where: string, s: Sheet, f: string) {
  if (f.startsWith("=")) fail(where, "stored with a leading =");
  if (/[;−×÷“”„]/.test(f.replace(/"(?:[^"]|"")*"/g, '""'))) fail(where, `not canonical: ${f}`);
  const toks = tokenize(f, "canon");
  if (typeof toks === "string") return fail(where, toks);
  const found = calls(toks);
  if (typeof found === "string") return fail(where, `${found}: ${f}`);
  checkCalls(where, found, (name) => (FUNCTION_BY_EN.has(name) ? name : undefined));
  for (const tok of toks) {
    if (tok.k === "name") fail(where, `unknown name ${tok.t} in ${f}`);
    if (tok.k !== "ref") continue;
    const plain = tok.t.replace(/^.*!/, "").replace(/\$/g, "");
    for (const part of plain.split(":")) {
      const m = /^([A-Z]*)([0-9]*)$/.exec(part);
      if (!m) continue;
      if (m[2] && Number(m[2]) > s.size.rows) fail(where, `${tok.t} below the sheet`);
      if (m[1] && m[1].length > 2) fail(where, `${tok.t} far right`);
    }
  }
}

/** The layout of a workbook without its words: same in every language. */
function shape(wb: Workbook): string {
  const sheets = wb.sheets.map((s) => ({
    cells: Object.keys(s.cells)
      .sort()
      .map((k) => {
        const c = s.cells[k];
        const kind = c.f !== undefined ? `f:${c.f.replace(/"(?:[^"]|"")*"/g, '""')}` : typeof c.v === "string" ? "text" : `v:${String(c.v)}`;
        const st = c.s ? JSON.stringify({ ...c.s, fmt: c.s.fmt ? { ...c.s.fmt, unit: undefined } : undefined }) : "";
        return `${k}=${kind}${st}${c.note ? "+note" : ""}`;
      }),
    cols: s.cols,
    rows: s.rows,
    freeze: s.freeze,
    size: s.size,
  }));
  const charts = wb.charts.map((c) => ({ ...c, id: 0, sheetId: wb.sheets.findIndex((s) => s.id === c.sheetId), title: 0, xAxis: { ...c.xAxis, title: 0 }, yAxis: { ...c.yAxis, title: 0 }, series: c.series.map((x) => ({ ...x, id: 0, name: 0, y: { ...x.y, sheetId: 0 }, x: x.x && { ...x.x, sheetId: 0 }, nameRef: x.nameRef && { ...x.nameRef, sheetId: 0 }, errorBars: x.errorBars && { ...x.errorBars, plus: x.errorBars.plus && { ...x.errorBars.plus, sheetId: 0 }, minus: x.errorBars.minus && { ...x.errorBars.minus, sheetId: 0 } } })), x: c.x && { ...c.x, sheetId: 0 } }));
  const tables = wb.tables.map((t) => ({ area: t.area, n: t.columns.map((c) => c.total), totals: t.totals, style: t.style, sheet: wb.sheets.findIndex((s) => s.id === t.sheetId) }));
  return JSON.stringify({ sheets, charts, tables });
}

function checkWorkbook(where: string, wb: Workbook) {
  if (wb.v !== 1) fail(where, "v isn't 1");
  if (!wb.sheets.length) fail(where, "no sheets");
  const ids = new Set<string>();
  const unique = (id: string, what: string) => {
    if (!id) fail(where, `${what} without an id`);
    if (ids.has(id)) fail(where, `duplicate id ${id} (${what})`);
    ids.add(id);
  };
  const sheetNames = new Set<string>();
  for (const s of wb.sheets) {
    const w = `${where} sheet "${s.name}"`;
    unique(s.id, "sheet");
    if (!s.name || s.name.length > 31 || /[[\]:*?/\\]/.test(s.name) || /^'|'$/.test(s.name)) fail(w, "invalid name");
    if (sheetNames.has(s.name.toLowerCase())) fail(w, "duplicate name");
    sheetNames.add(s.name.toLowerCase());
    if (s.size.rows < 1 || s.size.rows > MAX_ROWS || s.size.cols < 1 || s.size.cols > MAX_COLS) fail(w, "bad size");
    if (s.freeze.rows < 0 || s.freeze.cols < 0 || s.freeze.rows >= s.size.rows || s.freeze.cols >= s.size.cols) fail(w, "bad freeze");
    for (const [k, v] of Object.entries(s.cols)) if (!(Number(k) >= 0 && Number(k) < s.size.cols) || (v.w !== undefined && (v.w < 16 || v.w > 600))) fail(w, `column ${k}: ${JSON.stringify(v)}`);
    for (const [k, v] of Object.entries(s.rows)) if (!(Number(k) >= 0 && Number(k) < s.size.rows) || (v.h !== undefined && (v.h < 16 || v.h > 200))) fail(w, `row ${k}: ${JSON.stringify(v)}`);
    for (const [key, c] of Object.entries(s.cells)) {
      const { row, col } = parseKey(key);
      const cw = `${w} ${key}`;
      if (cellKey(row, col) !== key || row >= s.size.rows || col >= s.size.cols) fail(cw, "key outside the sheet");
      if (c.v === undefined && c.f === undefined && !c.s && !c.note) fail(cw, "empty cell stored");
      if (c.v !== undefined && c.f !== undefined) fail(cw, "both a value and a formula");
      // A text starting with = + or - would turn into a formula when someone edits the cell and presses Enter.
      if (typeof c.v === "string" && (!c.v.trim() || /^[=+-]/.test(c.v))) fail(cw, `text "${c.v}"`);
      if (typeof c.v === "number" && !Number.isFinite(c.v)) fail(cw, "not a finite number");
      if (c.note !== undefined && !c.note.trim()) fail(cw, "empty note");
      if (c.f !== undefined) checkFormula(cw, s, c.f);
      const fmt = c.s?.fmt;
      if (fmt && "decimals" in fmt && (fmt.decimals < 0 || fmt.decimals > 10)) fail(cw, "bad decimals");
    }
  }
  for (const c of wb.charts) {
    const w = `${where} chart "${c.title}"`;
    unique(c.id, "chart");
    const s = wb.sheets.find((x) => x.id === c.sheetId);
    if (!s) fail(w, "on a missing sheet");
    else if (c.at.row >= s.size.rows || c.at.col >= s.size.cols) fail(w, "placed outside the sheet");
    if (c.size.w < 200 || c.size.h < 150 || c.size.w > 900 || c.size.h > 700) fail(w, `odd size ${c.size.w}×${c.size.h}`);
    if (!c.series.length) fail(w, "no series");
    checkRange(`${w} x`, wb, c.x, { line: true });
    for (const x of c.series) {
      unique(x.id, "series");
      checkRange(`${w} series y`, wb, x.y, { line: true });
      checkRange(`${w} series x`, wb, x.x, { line: true });
      checkRange(`${w} series name`, wb, x.nameRef, { single: true });
      if (!x.name && !x.nameRef) fail(w, "a series without a name");
      const xs = x.x ?? c.x;
      if (xs && cellsOf(xs) !== cellsOf(x.y)) fail(w, "x and y of a series differ in length");
      if (x.trendline) {
        const t = x.trendline;
        if (t.order < 2 || t.order > 6 || t.period < 2) fail(w, "trendline order or period");
        if (c.kind !== "scatter" && c.kind !== "line" && c.kind !== "column" && c.kind !== "bar") fail(w, "a trendline on a chart kind that has none");
      }
      if (x.errorBars?.kind === "custom") {
        checkRange(`${w} error bars`, wb, x.errorBars.plus, { line: true });
        checkRange(`${w} error bars`, wb, x.errorBars.minus, { line: true });
        if (!x.errorBars.plus || cellsOf(x.errorBars.plus) !== cellsOf(x.y)) fail(w, "custom error bars don't match the values");
      }
    }
    if (c.kind === "scatter" && !c.x && c.series.some((x) => !x.x)) fail(w, "a scatter without x values");
  }
  const tableNames = new Set<string>();
  for (const t of wb.tables) {
    const w = `${where} table "${t.name}"`;
    unique(t.id, "table");
    if (!/^[\p{L}_][\p{L}\p{N}_.]*$/u.test(t.name)) fail(w, "name isn't a valid table name (letters, digits, _ and . only)");
    if (tableNames.has(t.name.toLowerCase())) fail(w, "duplicate name");
    tableNames.add(t.name.toLowerCase());
    const s = wb.sheets.find((x) => x.id === t.sheetId);
    if (!s) {
      fail(w, "on a missing sheet");
      continue;
    }
    if (!inSheet(s, t.area)) fail(w, "outside the sheet");
    if (t.columns.length !== t.area.c1 - t.area.c0 + 1) fail(w, "column count doesn't match the area");
    t.columns.forEach((c) => unique(c.id, "table column"));
    if (t.area.r1 - t.area.r0 < (t.totals ? 2 : 1)) fail(w, "no data rows");
    const headers = new Set<string>();
    for (let col = t.area.c0; col <= t.area.c1; col++) {
      const v = s.cells[cellKey(t.area.r0, col)]?.v;
      if (typeof v !== "string" || !v.trim()) fail(w, `header ${col} isn't a text`);
      else if (headers.has(v.toLowerCase())) fail(w, `header "${v}" twice`);
      else headers.add(v.toLowerCase());
    }
    if (t.totals)
      t.columns.forEach((c, i) => {
        const cell = s.cells[cellKey(t.area.r1, t.area.c0 + i)];
        if (c.total !== "none" && !cell?.f?.startsWith("SUBTOTAL(")) fail(w, `totals cell of column ${i + 1} isn't a SUBTOTAL`);
      });
    for (const u of wb.tables) if (u !== t && u.sheetId === t.sheetId && overlaps(u.area, t.area)) fail(w, `overlaps table "${u.name}"`);
  }
}

// ----------------------------------------------------------------------------------------------
// Templates: values (with the engine)

function engineReady(): boolean {
  try {
    const wb: Workbook = { v: 1, sheets: [{ id: "s", name: "S", cells: { "0,0": { v: 2 }, "0,1": { f: "A1*3" } }, cols: {}, rows: {}, freeze: { rows: 0, cols: 0 }, size: { rows: 10, cols: 10 } }], charts: [], tables: [] };
    const calc = engine.createCalc(wb);
    return calc.value("s", 0, 1) === 6;
  } catch (e) {
    if (e instanceof Error && /not implemented/.test(e.message)) return false;
    notes.push(`engine: createCalc threw ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function lin(xs: number[], ys: number[]) {
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
  const m = sxy / sxx;
  return { m, b: my - m * mx, r2: (sxy * sxy) / (sxx * syy), m0: xs.reduce((a, x, i) => a + x * ys[i], 0) / xs.reduce((a, x) => a + x * x, 0) };
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]) => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1));

/** Find the first cell whose formula starts with `prefix` (so the checks don't depend on the exact layout). */
function formulaCell(s: Sheet, prefix: string): { row: number; col: number } {
  const hit = Object.entries(s.cells)
    .filter(([, c]) => c.f?.startsWith(prefix))
    .map(([k]) => parseKey(k))
    .sort((a, b) => a.row - b.row || a.col - b.col)[0];
  if (!hit) throw new Error(`no formula starting with ${prefix}`);
  return hit;
}

function checkValues(where: string, wb: Workbook, id: string, lang: Lang) {
  const calc = engine.createCalc(wb, { now: () => new Date(2026, 10, 3, 12), locale: lang });
  const s = wb.sheets[0];
  const num = (row: number, col: number) => {
    const v = calc.value(s.id, row, col);
    if (typeof v !== "number") throw new Error(`${cellKey(row, col)} is ${JSON.stringify(v)}, not a number`);
    return v;
  };
  const typed = (row: number, col: number) => s.cells[cellKey(row, col)]?.v as number;
  const near = (what: string, got: number, want: number, tol = 1e-9) => {
    if (!(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)))) fail(where, `${what} is ${got}, expected ${want}`);
  };

  // Every formula calculates (no error values anywhere), and survives German and back.
  for (const sheet of wb.sheets)
    for (const [key, c] of Object.entries(sheet.cells)) {
      if (c.f === undefined) continue;
      const { row, col } = parseKey(key);
      const v = calc.value(sheet.id, row, col);
      if (engine.isError(v)) fail(`${where} ${key}`, `=${c.f} gives ${v.error}${v.detail ? ` (${v.detail})` : ""}`);
      if (lang === "de") {
        const local = engine.toLocalFormula(c.f, "de");
        const back = engine.toCanonicalFormula(local, "de");
        if ("error" in back) fail(`${where} ${key}`, `German ${local} doesn't parse: ${back.error}`);
        else {
          const again = calc.evaluate(back.formula, { sheetId: sheet.id, row, col });
          if (JSON.stringify(again) !== JSON.stringify(v)) fail(`${where} ${key}`, `${c.f} → ${local} → ${back.formula} calculates ${JSON.stringify(again)}, not ${JSON.stringify(v)}`);
        }
      }
    }

  const col = (r0: number, r1: number, c: number) => Array.from({ length: r1 - r0 + 1 }, (_, i) => typed(r0 + i, c));
  if (id === "calibration") {
    const slope = formulaCell(s, "SLOPE(");
    const first = slope.row - 8; // standards start 8 rows above the slope (layout of the template)
    const fit = lin(col(first, first + 5, 1), col(first, first + 5, 2));
    near("slope", num(slope.row, slope.col), fit.m);
    near("intercept", num(slope.row + 1, slope.col), fit.b);
    near("R²", num(slope.row + 2, slope.col), fit.r2);
    near("slope through 0", num(slope.row + 3, slope.col), fit.m0);
    if (num(slope.row, slope.col).toFixed(4) !== "0.0523" || num(slope.row + 1, slope.col).toFixed(4) !== "0.0012") fail(where, "the example line isn't y = 0.0523x + 0.0012 any more");
    const conc = formulaCell(s, "IF(B");
    for (let r = conc.row; s.cells[cellKey(r, 1)]; r++) {
      const e = typed(r, 1);
      const c = (e - fit.b) / fit.m;
      near(`sample row ${r + 1}`, num(r, 2), c);
      near(`sample row ${r + 1} undiluted`, num(r, 4), c * typed(r, 3));
      const ys = col(first, first + 5, 2);
      const want = e > Math.max(...ys) ? (lang === "de" ? "zu hoch – verdünnen" : "too high – dilute") : lang === "de" ? "ja" : "yes";
      if (calc.value(s.id, r, 5) !== want) fail(where, `range check row ${r + 1}: ${JSON.stringify(calc.value(s.id, r, 5))}`);
    }
  } else if (id === "bradford") {
    const slope = formulaCell(s, "SLOPE(");
    const first = slope.row - 8;
    const means: number[] = [];
    for (let i = 0; i < 6; i++) {
      const reps = [typed(first + i, 1), typed(first + i, 2), typed(first + i, 3)];
      means.push(mean(reps));
      near(`mean row ${first + i + 1}`, num(first + i, 4), mean(reps));
      near(`SD row ${first + i + 1}`, num(first + i, 5), sd(reps));
      near(`net row ${first + i + 1}`, num(first + i, 6), mean(reps) - mean([typed(first, 1), typed(first, 2), typed(first, 3)]));
    }
    const net = means.map((m) => m - means[0]);
    const fit = lin(col(first, first + 5, 0), net);
    near("slope", num(slope.row, slope.col), fit.m);
    near("intercept", num(slope.row + 1, slope.col), fit.b);
    near("R²", num(slope.row + 2, slope.col), fit.r2);
    for (let r = slope.row + 7; s.cells[cellKey(r, 1)]; r++) {
      const m = mean([typed(r, 1), typed(r, 2), typed(r, 3)]);
      near(`protein row ${r + 1}`, num(r, 6), ((m - means[0] - fit.b) / fit.m) * typed(r, 5));
    }
  } else if (id === "replicates") {
    for (let r = 3; r <= 8; r++) {
      const reps = [typed(r, 1), typed(r, 2), typed(r, 3)];
      near(`mean row ${r + 1}`, num(r, 4), mean(reps));
      near(`SD row ${r + 1}`, num(r, 5), sd(reps));
      near(`CV row ${r + 1}`, num(r, 6), sd(reps) / mean(reps));
    }
  } else if (id === "growth") {
    const mu = formulaCell(s, "SLOPE(");
    const t = col(6, 10, 0);
    const fit = lin(t, col(6, 10, 1).map(Math.log));
    near("µ", num(mu.row, mu.col), fit.m);
    near("g (h)", num(mu.row + 1, mu.col), Math.LN2 / fit.m);
    near("g (min)", num(mu.row + 2, mu.col), (60 * Math.LN2) / fit.m);
    near("R²", num(mu.row + 3, mu.col), fit.r2);
    if (Math.abs((60 * Math.LN2) / fit.m - 30) > 1) fail(where, "the example generation time isn't about 30 min any more");
  } else if (id === "dilution") {
    const pw = formulaCell(s, "POWER(");
    const stock = typed(4, 1);
    const factor = typed(5, 1);
    const volume = typed(6, 1);
    for (let i = 0; i < 8; i++) {
      near(`dilution tube ${i + 1}`, num(pw.row + i, 1), factor ** (i + 1));
      near(`concentration tube ${i + 1}`, num(pw.row + i, 2), stock / factor ** (i + 1));
      near(`diluent tube ${i + 1}`, num(pw.row + i, 3), volume - volume / factor);
      near(`transfer tube ${i + 1}`, num(pw.row + i, 4), volume / factor);
    }
    const v1 = pw.row + 13; // V₁ sits 13 rows below the first tube (layout of the template)
    near("V1", num(v1, 1), (typed(v1 - 2, 1) * typed(v1 - 1, 1)) / typed(v1 - 3, 1));
    near("V1 value", num(v1, 1), 0.5);
    near("diluent for V2", num(v1 + 1, 1), 9.5);
  } else if (id === "solutions") {
    const want = [8.766, 12.114, 18.612, 4.504, 10.165, 4.0];
    want.forEach((g, i) => near(`mass row ${i + 6}`, num(5 + i, 4), g, 1e-9));
    [1, 4.5, 5].forEach((g, i) => near(`w/v mass row ${i + 15}`, num(14 + i, 3), g, 1e-9));
  } else if (id === "mastermix") {
    const water = formulaCell(s, "$B$7-$B$8-SUM(");
    near("water per reaction", num(water.row, water.col), 16.25);
    near("mix per reaction", num(water.row + 1, 2), 23);
    near("mix in total", num(water.row + 1, 3), 23 * 8.8);
    near("reaction volume", num(water.row + 6, 1), 25);
    if (calc.value(s.id, water.row + 7, 1) !== (lang === "de" ? "passt" : "fits")) fail(where, "the check doesn't say it fits");
  } else if (id === "grades") {
    const avg = formulaCell(s, "IFERROR(SUMIF(");
    [1.975, 2.675, 1.9, 4.4 / 3].forEach((g, i) => near(`average ${i + 1}`, num(avg.row + i, avg.col), g));
    near("overall", num(avg.row + 5, avg.col), 28.7 / 14);
  }
}

// ----------------------------------------------------------------------------------------------

function main() {
  const fns = checkDocs();

  const ready = engineReady();
  let examples = 0;
  if (!ready) notes.push("engine not ready (createCalc throws \"not implemented\"): formulas checked for syntax only, values not calculated");
  if (ready) {
    // Both examples of every function parse and mean the same formula.
    for (const f of FUNCTION_NAMES) {
      const pair = FUNCTION_DOCS[f.en];
      if (!pair) continue;
      const canon = LOCALES.map((lang) => {
        const r = engine.toCanonicalFormula(pair[lang].example.slice(1), lang);
        if ("error" in r) fail(`docs ${f.en} (${lang})`, `example doesn't parse: ${r.error}`);
        return "formula" in r ? r.formula.replace(/"(?:[^"]|"")*"/g, '""') : null;
      });
      if (canon[0] && canon[1] && canon[0] !== canon[1]) fail(`docs ${f.en}`, `examples differ once parsed: ${canon[0]} / ${canon[1]}`);
    }
    examples = checkExampleValues();
  }

  const ids = new Set<string>();
  for (const tpl of SHEET_TEMPLATES) {
    if (ids.has(tpl.id)) fail(tpl.id, "duplicate template id");
    ids.add(tpl.id);
    if (/sparkle|wand/i.test(tpl.icon)) fail(tpl.id, `icon "${tpl.icon}" is not allowed`);
    for (const lang of LOCALES) {
      if (!resolveText(tpl.title, lang).trim()) fail(tpl.id, `no ${lang} title`);
      if (!resolveText(tpl.description, lang).trim()) fail(tpl.id, `no ${lang} description`);
    }
    const built = LOCALES.map((lang) => {
      try {
        const wb = tpl.build(lang);
        checkWorkbook(`${tpl.id} (${lang})`, wb);
        if (tpl.preview) {
          const s = wb.sheets[0];
          const [r0, r1] = tpl.preview.rows;
          if (r0 > r1 || r1 >= s.size.rows || tpl.preview.cols.some((c) => c >= s.size.cols)) fail(tpl.id, "preview outside the sheet");
          for (const c of tpl.preview.cols) if (!s.cells[cellKey(r0, c)]) fail(tpl.id, `preview header ${cellKey(r0, c)} is empty`);
        }
        if (ready) {
          try {
            checkValues(`${tpl.id} (${lang})`, wb, tpl.id, lang);
          } catch (e) {
            fail(`${tpl.id} (${lang})`, `calculating: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        return wb;
      } catch (e) {
        fail(tpl.id, `build(${lang}) threw ${e instanceof Error ? e.stack : String(e)}`);
        return null;
      }
    });
    if (built[0] && built[1] && shape(built[0]) !== shape(built[1])) fail(tpl.id, "English and German layouts differ");
  }

  for (const n of notes) console.log(`note: ${n}`);
  if (problems.length) {
    console.log(`check:sheet-templates: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const p of problems) console.log(`  ${p}`);
    process.exit(1);
  }
  console.log(`check:sheet-templates: help for ${fns} functions (${examples} example results calculated), ${SHEET_TEMPLATES.length} templates in 2 languages${ready ? ", values calculated" : ""}, all fine`);
}

main();
