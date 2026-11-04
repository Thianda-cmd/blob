// Typing into a cell and editing it again: "=…" is a formula, "'…" always text, numbers, dates,
// times and percentages in the user's style become numbers (with the format the typing implies),
// and editText gives back what the editor should show so that committing it again changes nothing.
// With the sheet around the cell (inSheet), a formula takes the format of the cells it works on
// (=Ende−Start of two times shows 06:30), and a ratio read as a time (1:2 → 01:02) gets a notice.

import type { Locale } from "@/i18n/config";
import { cellKey, parseKey } from "../a1";
import type { Cell, NumberFormat, Pos, Sheet, Workbook } from "../types";
import { clockTime, durationText, isoDate, shortDate, timeOfSerial } from "./dates";
import { digitsOf, formatValue, isDuration, typedFormat } from "./format";
import type { ParsedInput } from "./index";
import { lex, type RefInfo } from "./lexer";
import { colonNotice, formulaTooLongMessage, thousandsNotice } from "./messages";
import { MAX_TYPED_HOURS, parseValueText } from "./parse";
import { parseCanonical, type Node } from "./parser";
import { toCanonicalFormula, toLocalFormula } from "./translate";
import { boolText, isError, type CellValue } from "./values";

type InputOptions = { now?: () => Date };

/**
 * The longest formula a cell takes, as in Excel: 8,192 characters (stored, without "="). Longer
 * ones are refused when typed: the saved sheet would drop them.
 */
export const MAX_FORMULA_LENGTH = 8192;

type TypedFormula = { formula: string } | { error: { message: string; at: number }; tooLong?: boolean };

/** A formula as typed (without "=") → canonical, or why not, with the caret position for the editor (`shift`: where the formula starts in the typed text). */
function typedFormula(local: string, locale: Locale, shift: number): TypedFormula {
  const tooLong = (at: number): TypedFormula => ({ error: { message: formulaTooLongMessage(locale), at: shift + at }, tooLong: true });
  // What counts is the stored formula (German names can be longer or shorter than the English
  // ones); text far beyond that can't fit and isn't worth reading.
  if (local.length > 4 * MAX_FORMULA_LENGTH) return tooLong(MAX_FORMULA_LENGTH);
  const r = toCanonicalFormula(local, locale);
  if ("error" in r) return { error: { message: r.error, at: r.at + shift } };
  if (r.formula.length > MAX_FORMULA_LENGTH) return tooLong(local.length);
  return r;
}

/**
 * A value in a time format that reads as hours and minutes the way typing takes them (up to
 * 9999:59): a time of day or a duration. Beyond that it is a date with its time shown as the clock
 * time only (a timestamp from an instrument's log imported with "hh:mm"), which no duration means.
 */
export const inTypedHours = (v: number): boolean => Math.round(v * 86400) < (MAX_TYPED_HOURS + 1) * 3600;

// ----------------------------------------------------------------------------------------------
// The format a typed formula shows its result in

/**
 * What a part of a formula gives, as far as showing it goes: a date, a date with its time (`fmt`:
 * how its cell shows it, when that is the clock time only), a time of day, a duration, a percentage
 * or money (with the format to show it in), a plain number (a cell whose number shows as one, a
 * product, a count, a rounded number), or null: anything that says nothing about it (a text, a
 * number written into the formula, what a lookup finds).
 */
type Kind =
  | { k: "date"; fmt: NumberFormat }
  | { k: "datetime"; fmt?: NumberFormat }
  | { k: "time" | "duration"; seconds: boolean }
  | { k: "percent" | "currency"; fmt: NumberFormat }
  | { k: "number" }
  | null;

const timeLike = (a: Kind): a is { k: "time" | "duration"; seconds: boolean } => a?.k === "time" || a?.k === "duration";
const dayLike = (a: Kind) => a?.k === "date" || a?.k === "datetime";

/** A plain number, made once (like the time kinds below). */
const NUMBER: Kind = { k: "number" };
/** A plain number, or nothing known: what plus() lets the other side decide. */
const plain = (a: Kind): a is { k: "number" } | null => !a || a.k === "number";

/** The four time kinds, made once: a column of 10,000 times is looked through without making one for each cell. */
const TIME_KINDS: Kind[] = [
  { k: "time", seconds: false },
  { k: "time", seconds: true },
  { k: "duration", seconds: false },
  { k: "duration", seconds: true },
];
const timeKind = (duration: boolean, seconds: boolean): Kind => TIME_KINDS[(duration ? 2 : 0) + (seconds ? 1 : 0)];

/**
 * a + b or a − b, worked out like LibreOffice (Excel takes the first cell's format, whatever the
 * result means): with a plain number the other one's format (date + 7 is a date, 1 − 25 % a
 * percentage); two clock times or durations a duration (Ende − Start: how long it took); two dates
 * a number of days (Tage seit Ansatz), two timestamps a duration; a date and a time or duration a
 * timestamp (Ansatz + 36:00); money and percentages their own format.
 */
function plus(a: Kind, b: Kind): Kind {
  if (plain(a)) return b ?? a;
  if (plain(b)) return a;
  if (timeLike(a) && timeLike(b)) return timeKind(true, a.seconds || b.seconds);
  if (dayLike(a) && dayLike(b)) return a.k === "datetime" && b.k === "datetime" ? timeKind(true, false) : null;
  if ((timeLike(a) || dayLike(a)) && (timeLike(b) || dayLike(b))) return { k: "datetime" };
  // A percentage next to a date, a time or money is just a number; money and a date make no sense.
  if (b.k === "percent") return a;
  if (a.k === "percent") return b;
  return a.k === b.k ? a : null;
}

/**
 * The values of a list side by side (in SUMME, MITTELWERT, MIN, MAX, MEDIAN, and what WENN or
 * WENNFEHLER may give back): their format when they are alike (the first one's), and one duration
 * among times makes them all durations (0:00 … 20:00 and 24:00 … 48:00 typed down a column), one
 * timestamp among dates all timestamps. Values that aren't alike make a plain number, as the status
 * bar shows them (LibreOffice isn't consistent here: it takes a date or time format when that value
 * comes last): 12, 50 % and 7 sum up to 19,5, not 1950 %; 0, 0:30 and 1:00 are numbers, not times;
 * a date next to a time is no date; hours (×24) next to a duration are no duration. A text or a
 * number written into the formula says nothing (=WENN(B2="";"";B2-A2) shows 06:30).
 */
function join(a: Kind, b: Kind): Kind {
  if (!a) return b;
  if (!b) return a;
  if (timeLike(a) && timeLike(b)) return timeKind(a.k === "duration" || b.k === "duration", a.seconds || b.seconds);
  if (dayLike(a) && dayLike(b)) return a.k === b.k ? a : { k: "datetime" };
  return a.k === b.k ? a : NUMBER;
}

/** A sum or mean of clock times is how long, not when: a duration (49:15, not the time 01:15). */
const elapsed = (a: Kind): Kind => (a?.k === "time" ? timeKind(true, a.seconds) : a);

/** A cell's format as a Kind; `value`: what the cell holds, when known. */
function kindOf(fmt: NumberFormat | undefined, value: CellValue | undefined): Kind {
  switch (fmt?.kind) {
    case "date":
      return { k: "date", fmt };
    case "datetime":
      return { k: "datetime" };
    case "time":
      // A timestamp shown as its clock time: a moment, shown as its cell shows it (its mean is a
      // moment too, not 1111911:00 hours; the time between two of them is a duration).
      if (!isDuration(fmt) && typeof value === "number" && !inTypedHours(value)) return { k: "datetime", fmt };
      // A clock time of a day or more is a duration (a 36:00 typed before durations had their own format).
      return timeKind(isDuration(fmt) || (typeof value === "number" && value >= 1), fmt.seconds);
    case "percent":
    case "currency":
      return { k: fmt.kind, fmt };
  }
  // A number shown as one (no format, decimals, a unit): a plain number. A formula's text, or its
  // result when not known, says nothing.
  return typeof value === "number" ? NUMBER : null;
}

/** Where a typed formula's references point: the workbook, the sheet it is typed on, and the cells' values (formulas' results) when known. */
export type FormulaSources = {
  wb: Workbook;
  sheetId: string;
  value?: (sheetId: string, row: number, col: number) => CellValue;
};

/**
 * Ranges up to this many cells (cut to the part the sheet has: A:A is a million rows) are looked
 * through cell by cell. Bigger ones go through the sheet's cells instead when it has fewer: listing
 * 100,000 cells costs about what looking up 80,000 one by one does, so a formula of single cells
 * never lists them.
 */
const LOOK_EACH = 50_000;

/** What formulaFormat looks through: where the references point, and the sheets' cells in reading order, listed at most once per formula and only for big ranges. */
type Look = { src: FormulaSources; listed: Map<Sheet, Pos[]> };

function cellsInOrder(look: Look, sheet: Sheet): Pos[] {
  let list = look.listed.get(sheet);
  if (!list) {
    list = Object.keys(sheet.cells).map(parseKey);
    list.sort((p, q) => p.row - q.row || p.col - q.col);
    look.listed.set(sheet, list);
  }
  return list;
}

/**
 * What a reference holds: a cell's kind; a range's from all the numbers in it, in reading order
 * (formulas count whatever they give; text, true/false and empty cells don't).
 */
function refKind(ref: RefInfo, look: Look | undefined): Kind {
  if (!look) return null;
  const { src } = look;
  const name = ref.sheet?.toLowerCase();
  const sheet = src.wb.sheets.find((s) => (name === undefined ? s.id === src.sheetId : s.name.toLowerCase() === name));
  if (!sheet) return null;
  const { value } = src;
  const at = (row: number, col: number): Kind => {
    const cell = sheet.cells[cellKey(row, col)];
    if (!cell || (cell.f === undefined && typeof cell.v !== "number")) return null;
    return kindOf(cell.s?.fmt, cell.f === undefined ? cell.v : value?.(sheet.id, row, col));
  };
  // No cell lies outside the sheet's size (setCells grows it).
  const r0 = Math.min(ref.r0, ref.r1);
  const r1 = Math.min(Math.max(ref.r0, ref.r1), sheet.size.rows - 1);
  const c0 = Math.min(ref.c0, ref.c1);
  const c1 = Math.min(Math.max(ref.c0, ref.c1), sheet.size.cols - 1);
  if (r1 < r0 || c1 < c0) return null;
  const area = (r1 - r0 + 1) * (c1 - c0 + 1);
  // A plain number among them decides it (see join): no need to look further.
  let kind: Kind = null;
  if (area > LOOK_EACH) {
    const cells = cellsInOrder(look, sheet);
    if (area > cells.length) {
      for (const p of cells) {
        if (p.row >= r0 && p.row <= r1 && p.col >= c0 && p.col <= c1) kind = join(kind, at(p.row, p.col));
        if (kind === NUMBER) break;
      }
      return kind;
    }
  }
  for (let r = r0; r <= r1 && kind !== NUMBER; r++) for (let c = c0; c <= c1 && kind !== NUMBER; c++) kind = join(kind, at(r, c));
  return kind;
}

/**
 * What a function gives: the date functions a date or time; SUMME, MITTELWERT, MIN, MAX, MEDIAN and
 * TEILERGEBNIS what they work on; WENN, WENNFEHLER, WAHL, INDEX and the like what they give back;
 * counting and rounding a plain number.
 */
function callKind(name: string, args: Node[], look: Look | undefined): Kind {
  const all = (list: Node[]) => list.reduce<Kind>((k, a) => join(k, nodeKind(a, look)), null);
  switch (name) {
    // One of their results, so what those results are alike in: =WENN(B2="";"";B2-A2) and
    // =WENNFEHLER(B2-A2;"") show 06:30 like =B2-A2 (LibreOffice too). The conditions don't count,
    // nor the values ERSTERWERT compares with.
    case "IF":
      return all(args.slice(1));
    case "IFS":
      // WENNS(Bedingung1; Wert1; Bedingung2; Wert2; …)
      return all(args.filter((_, i) => i % 2 === 1));
    case "SWITCH":
      // ERSTERWERT(Ausdruck; Wert1; Ergebnis1; Wert2; Ergebnis2; …; Standard): the results, and the
      // default (the last argument, when it has no partner).
      return all(args.filter((_, i) => i > 0 && (i % 2 === 0 || i === args.length - 1)));
    case "IFERROR":
    case "IFNA":
      return all(args);
    case "CHOOSE":
      return all(args.slice(1));
    case "INDEX":
      return indexKind(args, look);
    case "TODAY":
    case "DATE":
    case "EDATE":
    case "EOMONTH":
      return { k: "date", fmt: { kind: "date", style: "short" } };
    case "NOW":
      return { k: "datetime" };
    case "TIME":
      return timeKind(false, false);
    case "SUM":
    case "AVERAGE":
      return elapsed(all(args));
    case "MIN":
    case "MAX":
    case "MEDIAN":
      return all(args);
    case "SUBTOTAL": {
      // Its first argument says what it works out: 1 (101) the mean, 4 the maximum, 5 the minimum,
      // 9 the sum, 2 and 3 a count.
      const first = args[0];
      const what = first?.t === "num" ? first.v % 100 : 0;
      if (what === 1 || what === 9) return elapsed(all(args.slice(1)));
      if (what === 4 || what === 5) return all(args.slice(1));
      return what === 2 || what === 3 ? NUMBER : null;
    }
    // A count or a rounded number is a plain number, also next to a duration in WENN
    // (=WENN(…;RUNDEN((B2-A2)*24;2);B2-A2) shows 8,5 hours as 8,5, not 204:00).
    case "COUNT":
    case "COUNTA":
    case "COUNTBLANK":
    case "COUNTIF":
    case "COUNTIFS":
    case "ROWS":
    case "COLUMNS":
    case "ROUND":
    case "ROUNDUP":
    case "ROUNDDOWN":
    case "INT":
    case "TRUNC":
      return NUMBER;
  }
  // Everything else says nothing: a lookup gives what it finds, a text function text.
  return null;
}

/**
 * What INDEX gives: a value of the range it picks from (=INDEX(B2:B20;VERGLEICH(…)) of a column of
 * times a time), of the row and column it picks when they are written as numbers (=INDEX(A2:C20;5;3)
 * the value of C6; in a single row the number after the range picks the column: =INDEX(A1:D1;2)).
 */
function indexKind(args: Node[], look: Look | undefined): Kind {
  const [range, rowArg, colArg] = args;
  if (!range) return null;
  if (range.t !== "ref") return nodeKind(range, look);
  const ref = range.ref;
  // A position written as a number from 1 to the range's size; 0 or anything else picks them all.
  const at = (arg: Node | undefined, from: number, to: number) => (arg?.t === "num" && arg.v >= 1 && arg.v < Math.abs(to - from) + 2 ? Math.min(from, to) + Math.floor(arg.v) - 1 : null);
  const oneRow = ref.r0 === ref.r1 && args.length === 2;
  const row = oneRow ? null : at(rowArg, ref.r0, ref.r1);
  const col = at(oneRow ? rowArg : colArg, ref.c0, ref.c1);
  return refKind({ ...ref, ...(row === null ? {} : { r0: row, r1: row }), ...(col === null ? {} : { c0: col, c1: col }) }, look);
}

function nodeKind(n: Node, look: Look | undefined): Kind {
  switch (n.t) {
    case "ref":
      return refKind(n.ref, look);
    case "neg":
    case "pos":
      return nodeKind(n.a, look);
    case "bin":
      // × and ÷ make a plain number (=SUMME(A2:A14)*24 is hours, =B2/2 half of it); & a text and a
      // comparison WAHR or FALSCH, which say nothing.
      if (n.op === "+" || n.op === "-") return plus(nodeKind(n.a, look), nodeKind(n.b, look));
      return n.op === "*" || n.op === "/" || n.op === "^" ? NUMBER : null;
    case "call":
      return callKind(n.name, n.args, look);
  }
  return null;
}

function formatOf(kind: Kind): NumberFormat | undefined {
  if (!kind) return undefined;
  switch (kind.k) {
    case "date":
    case "percent":
    case "currency":
      return kind.fmt;
    case "datetime":
      return kind.fmt ?? { kind: "datetime" };
    case "time":
      return { kind: "time", seconds: kind.seconds };
    case "duration":
      return { kind: "time", seconds: kind.seconds, duration: true };
    case "number":
      return undefined;
  }
}

/**
 * The format a typed formula's result shows in, from what it works on, as in Excel and
 * LibreOffice: =HEUTE() a date; a single reference its cell's date, time, percent or money format;
 * =B2-A2 of two times the duration 06:30, =SUMME and =MITTELWERT of run times 49:15 and 16:25, =H2+7
 * a date, =HEUTE()-H2 the number of days, =WENN(B2="";"";B2-A2) what it gives back (06:30). × and ÷,
 * counting, rounding and values that aren't alike stay plain numbers (=SUMME(A2:A14)*24 is 312 hours;
 * 12, 50 % and 7 sum up to 19,5). `src`: where the references point; without it only the date and time functions
 * count. Worked out once, when typed into a cell without a format of its own (as in Excel): the
 * format stays when the cells it came from change later.
 */
export function formulaFormat(canonical: string, src?: FormulaSources): NumberFormat | undefined {
  const p = parseCanonical(canonical);
  if (!p.ok) return undefined;
  try {
    return formatOf(nodeKind(p.parsed.ast, src && { src, listed: new Map() }));
  } catch {
    // Nested too deeply to look through: no format, as for any other formula.
    return undefined;
  }
}

/**
 * Whether a formula works on a range (A2:A20, $B$2:B2, B:B) and not on single cells only. Then
 * formulaFormat looks through the range cell by cell: worked out again for each of 5,000 rows a
 * smart table's calculated column fills, that would take seconds.
 */
export const worksOnRanges = (canonical: string): boolean => lex(canonical, "canonical").some((t) => t.ref !== undefined && t.ref.kind !== "cell");

// ----------------------------------------------------------------------------------------------
// What the sheet around the cell tells

/** A header that names a ratio: Verdünnung, Mischungsverhältnis, Dilution, Ratio. */
const RATIO_WORDS = /verd(?:ü|ue)nn|verh(?:ä|ae)ltnis|dilution|\bratios?\b/i;
/** A header like 1:x, or a ratio kept as text before that no clock reads: 1:100, 1:2, 1 : 10. */
const RATIO_TEXT = /^\d+\s*:\s*(?:\d+|[a-z])$/i;
/** A clock time or duration kept as text (12:30 imported, '8:00 typed with an apostrophe, a '1:10): it doesn't say what the column holds. */
const CLOCK_TEXT = /^\d{1,4}:[0-5]\d(?::[0-5]\d)?$/;
export const namesRatio = (header: string) => RATIO_WORDS.test(header) || RATIO_TEXT.test(header.trim());

/**
 * A ratio typed as "1:2" is the clock time 01:02, as in Excel and LibreOffice. When it was surely
 * meant as a ratio (a dilution), a notice says so and offers it as text, like the "1.234" one: when
 * the minutes have one digit (nobody writes 01:02 as 1:2), or when the column's header names a
 * ratio (then 1:10 and 1:50 too). Times typed under any other header (1:00, 1:15, 1:30) never get
 * it, nor does a cell that shows the number some other way (formatted as a number or percentage, it
 * shows 0,04 or 4 %). `header`: what the column says above the cell (its header, usually), asked
 * for only when needed; `own`: the cell's own format.
 */
export function ratioNotice(text: string, parsed: ParsedInput, header: () => string | null, locale: Locale, own?: NumberFormat): ParsedInput["notice"] {
  const typed = text.trim();
  const m = /^\d{1,4}:(\d{1,2})$/.exec(typed);
  const v = parsed.cell.v;
  const shown = typedFormat(own, parsed.fmt);
  if (!m || typeof v !== "number" || parsed.fmt?.kind !== "time" || shown?.kind !== "time") return undefined;
  if (m[1].length > 1) {
    const h = header();
    if (h === null || !namesRatio(h)) return undefined;
  }
  const { message, action } = colonNotice(typed, formatValue(v, shown, locale), isDuration(shown), locale);
  return { message, action, other: { cell: { v: typed } } };
}

/** What the column says above a cell: the first text there (its header, usually), passing clock times kept as text. */
function textAbove(sheet: Sheet, row: number, col: number): string | null {
  for (let r = row - 1; r >= 0; r--) {
    const v = sheet.cells[cellKey(r, col)]?.v;
    if (typeof v === "string" && v.trim() !== "" && !CLOCK_TEXT.test(v.trim())) return v;
  }
  return null;
}

/** Where something is typed: the workbook, the sheet and the cell, and the cells' values (formulas' results) when known. */
export type TypingPlace = FormulaSources & { row: number; col: number };

/**
 * parseInput's result, finished with what only the sheet around the cell can tell: a formula takes
 * the format of the cells it works on (formulaFormat), and a ratio read as a clock time gets its
 * notice (ratioNotice). For typing; pasted values stay as parseInput reads them. `own`: the format
 * of the cell typed into, as typing sees it.
 */
export function inSheet(parsed: ParsedInput, text: string, locale: Locale, at: TypingPlace, own?: NumberFormat): ParsedInput {
  if (parsed.error) return parsed;
  if (parsed.cell.f !== undefined) {
    const fmt = formulaFormat(parsed.cell.f, at);
    const out: ParsedInput = { ...parsed };
    if (fmt) out.fmt = fmt;
    else delete out.fmt;
    return out;
  }
  if (parsed.notice) return parsed;
  const sheet = at.wb.sheets.find((s) => s.id === at.sheetId);
  const notice = ratioNotice(text, parsed, () => (sheet ? textAbove(sheet, at.row, at.col) : null), locale, own);
  return notice ? { ...parsed, notice } : parsed;
}

/**
 * Text typed into a cell → what to store. "=…" is a formula (canonicalised); "'…" is always text;
 * numbers in the locale's format ("1,5" in German, "1.5" in English; "1.234,5" with thousands),
 * percentages, dates ("1.11.2026", "2026-11-01", "11/1/2026" in English), times ("14:30"),
 * TRUE/FALSE (WAHR/FALSCH in German). A cell formatted as text keeps everything as text.
 */
export function parseInput(text: string, locale: Locale, current?: Cell, opts?: InputOptions): ParsedInput {
  if (current?.s?.fmt?.kind === "text") return { cell: text === "" ? {} : { v: text } };
  if (text.trim() === "") return { cell: {} };
  if (text.startsWith("'")) return { cell: { v: text.slice(1) } };
  if (text.startsWith("=")) {
    const r = typedFormula(text.slice(1), locale, 1);
    if ("error" in r) return { cell: {}, error: r.error };
    const fmt = formulaFormat(r.formula);
    return fmt ? { cell: { f: r.formula }, fmt } : { cell: { f: r.formula } };
  }
  const parsed = parseValueText(text, locale, { bools: true, units: true, zeroDecimal: true, thousandsHint: true, foreignExponent: true, now: opts?.now });
  if (parsed) {
    if (parsed.kind === "bool") return { cell: { v: parsed.value } };
    // Excel: a number typed into a percent cell means percent (50 → 50 %).
    const inPercentCell = (fmt: NumberFormat | undefined, v: number) => (!fmt && current?.s?.fmt?.kind === "percent" ? v / 100 : v);
    const value = inPercentCell(parsed.fmt, parsed.value);
    const out: ParsedInput = parsed.fmt ? { cell: { v: value }, fmt: parsed.fmt } : { cell: { v: value } };
    if (parsed.orDecimal) {
      // "1.234" stays 1234 (Excel's reading), but the person may have meant 1,234: say so, and
      // offer it. The reading as the cell shows it ("„001.234“ ist 1234"), the other as typed
      // with a comma ("Als 1,000 lesen").
      const alt = parsed.orDecimal;
      const typed = text.trim();
      const { message, action } = thousandsNotice(typed, formatValue(parsed.value, parsed.fmt, locale), typed.replace(/(\d+)\.(\d+)/, "$1,$2"), locale);
      out.notice = { message, action, other: alt.fmt ? { cell: { v: alt.value }, fmt: alt.fmt } : { cell: { v: inPercentCell(undefined, alt.value) } } };
    }
    return out;
  }
  // "+A1*2" or "-A1": a formula without "=" (an old habit from other programs), when it is clearly one.
  if (/^[+-]/.test(text)) {
    const toks = lex(text, locale);
    if (toks.some((t) => t.k === "ref" || t.k === "fn")) {
      const r = typedFormula(text, locale, 0);
      if ("formula" in r) {
        const fmt = formulaFormat(r.formula);
        return fmt ? { cell: { f: r.formula }, fmt } : { cell: { f: r.formula } };
      }
      if (r.tooLong) return { cell: {}, error: r.error };
    }
  }
  return { cell: { v: text } };
}

/** A number for editing: all its digits (up to 15 significant), no thousands separators. */
export function editNumber(n: number, locale: Locale): string {
  if (n === 0 || !Number.isFinite(n)) return "0";
  const { d, e } = digitsOf(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  const dec = locale === "de" ? "," : ".";
  if (e > 21 || e < -6) {
    // 1,5E-10 / 6,022E+23
    const mant = d.length > 1 ? `${d[0]}${dec}${d.slice(1)}` : d;
    const exp = e - 1;
    return `${sign}${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  if (e <= 0) return `${sign}0${dec}${"0".repeat(-e)}${d}`;
  if (d.length <= e) return sign + d + "0".repeat(e - d.length);
  return `${sign}${d.slice(0, e)}${dec}${d.slice(e)}`;
}

/** Would typing this text back make something other than text (a number, date, formula…)? */
function wouldParse(text: string, locale: Locale): boolean {
  if (text === "" || text.startsWith("'") || text.startsWith("=")) return true;
  if (text.trim() === "") return true;
  const p = parseInput(text, locale);
  return p.cell.v === undefined || typeof p.cell.v !== "string" || p.cell.f !== undefined;
}

/** What the editor shows when you edit a cell: "=SUMME(A1:A3)" in German, "1,5" for 1.5, a date as typed. */
export function editText(cell: Cell | undefined, locale: Locale): string {
  if (!cell) return "";
  if (cell.f !== undefined) return `=${toLocalFormula(cell.f, locale)}`;
  const v = cell.v;
  if (v === undefined || v === null) return "";
  if (typeof v === "boolean") return boolText(v, locale);
  const fmt = cell.s?.fmt;
  if (typeof v === "string") {
    if (fmt?.kind === "text") return v;
    return wouldParse(v, locale) ? `'${v}` : v;
  }
  if (!Number.isFinite(v)) return "";
  switch (fmt?.kind) {
    case "percent":
      return `${editNumber(Number((v * 100).toPrecision(15)), locale)}%`;
    case "date":
    case "datetime": {
      if (v < 0) break;
      const t = timeOfSerial(v);
      const day = Math.floor(v) + t.carry;
      const date = fmt.kind === "date" && fmt.style === "iso" ? isoDate(day) : shortDate(day, locale);
      if (t.h === 0 && t.mi === 0 && t.s === 0) return date;
      return `${date} ${clockTime(day + (t.h * 3600 + t.mi * 60 + t.s) / 86400, t.s !== 0)}`;
    }
    case "time": {
      if (v < 0) break;
      const t = timeOfSerial(v);
      const seconds = t.s !== 0 || fmt.seconds;
      // A duration edits as one ("36:00"), and so does a time of a day or more with hours typing
      // takes back (a 36:00 typed before durations had their own format): never an 1899 date,
      // which wouldn't read back as a number. Too long for that: a duration as a plain number, a
      // date with its time (a timestamp shown as a clock time) as the date and the time.
      if (isDuration(fmt) || v >= 1) {
        if (inTypedHours(v)) return durationText(v, seconds);
        if (isDuration(fmt)) return editNumber(v, locale);
        return `${shortDate(Math.floor(v) + t.carry, locale)} ${clockTime(v, t.s !== 0)}`;
      }
      return clockTime(v, seconds);
    }
  }
  return editNumber(v, locale);
}

/** Default alignment of a value: numbers right, text left, booleans and errors centred. */
export function defaultAlign(value: CellValue): "left" | "center" | "right" {
  if (typeof value === "number") return "right";
  if (typeof value === "boolean" || isError(value)) return "center";
  return "left";
}
