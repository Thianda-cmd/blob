// Smart table filters: which data rows a filter keeps, and what a column offers to filter by (its
// values with counts, whether it holds numbers, dates or text).
//
// Values are matched by the text a cell shows (12,5 with one decimal shows "12,5" in German), like
// Excel's value list; conditions on numbers use the numbers themselves; text conditions ignore case
// and know Excel's wildcards (? one character, * any number, ~ before them for the sign itself).

import type { Locale } from "@/i18n/config";
import { cellKey } from "../a1";
import { compileGlob, errorText, formatValue, globTest, isError, type Calc, type CellValue } from "../engine";
import type { FilterSpec, NumberFormat, Sheet, TableSpec } from "../types";
import { dataRows } from "./totals";

/** The text a value shows with its format: "" when empty, errors in the user's language (#WERT!). */
export function shownText(value: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  if (value === null) return "";
  if (isError(value)) return errorText(value.error, locale);
  return formatValue(value, fmt, locale);
}

/** Values are compared without case ("Probe" and "probe" are one entry, like Excel). */
export const valueKey = (text: string, locale: Locale) => text.toLocaleLowerCase(locale);

/** Reads one column of a table lazily: values and shown texts, each worked out once. */
class ColumnReader {
  private values = new Map<number, CellValue>();
  private texts = new Map<number, string>();
  constructor(
    private calc: Calc,
    private sheet: Sheet,
    readonly col: number,
    private locale: Locale,
  ) {}
  value(row: number): CellValue {
    let v = this.values.get(row);
    if (v === undefined) {
      const cell = this.sheet.cells[cellKey(row, this.col)];
      v = cell && (cell.v !== undefined || cell.f !== undefined) ? this.calc.value(this.sheet.id, row, this.col) : null;
      this.values.set(row, v);
    }
    return v;
  }
  text(row: number): string {
    let s = this.texts.get(row);
    if (s === undefined) {
      s = shownText(this.value(row), this.sheet.cells[cellKey(row, this.col)]?.s?.fmt, this.locale);
      this.texts.set(row, s);
    }
    return s;
  }
}

const closeTo = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-12 * Math.max(1, Math.abs(x), Math.abs(y));

/** The numbers of a column's data rows (not true/false, not text that looks like a number). */
function numbersOf(read: ColumnReader, r0: number, r1: number): number[] {
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const v = read.value(r);
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** A test for one row of a column. Conditions that need the whole column (top 10, average) are worked out once. */
function rowTest(read: ColumnReader, r0: number, r1: number, spec: FilterSpec, locale: Locale): (row: number) => boolean {
  switch (spec.kind) {
    case "values": {
      const allowed = new Set(spec.values.map((v) => valueKey(v, locale)));
      return (row) => allowed.has(valueKey(read.text(row), locale));
    }
    case "text": {
      const text = spec.text ?? "";
      // Wildcards without a RegExp, so no pattern can freeze the table (src/sheet/engine/glob.ts);
      // ? stands for one character, an emoji included.
      const glob = compileGlob(text, { unicode: true });
      if (spec.op === "equals") return (row) => globTest(glob, read.text(row));
      // An empty pattern asks nothing (rather than hiding every row).
      if (!text) return () => true;
      if (spec.op === "notContains") return (row) => !globTest(glob, read.text(row), "contains");
      const within = spec.op === "begins" ? "begins" : spec.op === "ends" ? "ends" : "contains";
      return (row) => globTest(glob, read.text(row), within);
    }
    case "number": {
      const num = (row: number) => {
        const v = read.value(row);
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      };
      const a = spec.a;
      const b = spec.b;
      // Compared with a little tolerance, so 0,1 + 0,2 counts as equal to 0,3 (as it shows).
      const cmp = (row: number, f: (v: number, same: boolean) => boolean) => {
        const v = num(row);
        return v !== null && a !== null && f(v, closeTo(v, a));
      };
      switch (spec.op) {
        case "gt":
          return a === null ? () => true : (row) => cmp(row, (v, same) => v > a && !same);
        case "gte":
          return a === null ? () => true : (row) => cmp(row, (v, same) => v >= a || same);
        case "lt":
          return a === null ? () => true : (row) => cmp(row, (v, same) => v < a && !same);
        case "lte":
          return a === null ? () => true : (row) => cmp(row, (v, same) => v <= a || same);
        case "eq":
          return a === null ? () => true : (row) => cmp(row, (_v, same) => same);
        case "neq":
          // Like Excel's "does not equal": text and empty cells stay too.
          return a === null ? () => true : (row) => !cmp(row, (_v, same) => same);
        case "between": {
          if (a === null && b === null) return () => true;
          const lo = a === null ? -Infinity : b === null ? a : Math.min(a, b);
          const hi = b === null ? Infinity : a === null ? b : Math.max(a, b);
          return (row) => {
            const v = num(row);
            return v !== null && ((v >= lo && v <= hi) || closeTo(v, lo) || closeTo(v, hi));
          };
        }
        case "top":
        case "bottom": {
          const nums = numbersOf(read, r0, r1).sort((x, y) => (spec.op === "top" ? y - x : x - y));
          if (!nums.length) return () => false;
          const n = Math.max(1, Math.floor(a ?? 10));
          // Ties with the last one in stay too: "the 3 largest" of 5, 4, 4, 4 keeps all four.
          const edge = nums[Math.min(n, nums.length) - 1];
          return (row) => {
            const v = num(row);
            return v !== null && (spec.op === "top" ? v >= edge : v <= edge);
          };
        }
        case "aboveAverage":
        case "belowAverage": {
          const nums = numbersOf(read, r0, r1);
          if (!nums.length) return () => false;
          const avg = nums.reduce((s, x) => s + x, 0) / nums.length;
          return (row) => {
            const v = num(row);
            return v !== null && (spec.op === "aboveAverage" ? v > avg && !closeTo(v, avg) : v < avg && !closeTo(v, avg));
          };
        }
      }
    }
  }
  return () => true;
}

/**
 * The tests of a table's filters, one per filtered column (columns that are gone are skipped).
 * `except`: leave this column's filter out (its menu lists the values the other filters leave).
 */
export function tableFilterTests(calc: Calc, sheet: Sheet, t: TableSpec, locale: Locale, except?: string): ((row: number) => boolean)[] {
  const d = dataRows(t);
  const tests: ((row: number) => boolean)[] = [];
  for (const [columnId, spec] of Object.entries(t.filters)) {
    if (columnId === except) continue;
    const i = t.columns.findIndex((c) => c.id === columnId);
    if (i < 0) continue;
    tests.push(rowTest(new ColumnReader(calc, sheet, t.area.c0 + i, locale), d.r0, d.r1, spec, locale));
  }
  return tests;
}

/** The data rows a table's filters hide (all filters must pass: they combine with AND). */
export function hiddenByFilters(calc: Calc, sheet: Sheet, t: TableSpec, locale: Locale, into: Set<number> = new Set()): Set<number> {
  const tests = tableFilterTests(calc, sheet, t, locale);
  if (!tests.length) return into;
  const d = dataRows(t);
  for (let r = d.r0; r <= d.r1; r++) {
    for (const test of tests) {
      if (!test(r)) {
        into.add(r);
        break;
      }
    }
  }
  return into;
}

// ----------------------------------------------------------------------------------------------
// What a column offers (the column menu)

export type ColumnKind = "number" | "date" | "text";

export type ColumnValue = {
  /** As shown; "" for empty cells. */
  text: string;
  /** For matching (lower case). */
  key: string;
  count: number;
  /** For sorting the list: numbers by value, then text, true/false, errors, empty last. */
  rank: number;
  num: number | null;
};

const isDateFmt = (fmt: NumberFormat | undefined) => fmt?.kind === "date" || fmt?.kind === "datetime";

/** What a column mostly holds: numbers, dates (numbers with a date format) or text. Empty columns count as text. */
export function columnKind(calc: Calc, sheet: Sheet, t: TableSpec, index: number, locale: Locale): ColumnKind {
  const d = dataRows(t);
  const read = new ColumnReader(calc, sheet, t.area.c0 + index, locale);
  let numbers = 0;
  let dates = 0;
  let texts = 0;
  // A sample is enough to tell (big tables: the first 2000 rows).
  const last = Math.min(d.r1, d.r0 + 2000);
  for (let r = d.r0; r <= last; r++) {
    const v = read.value(r);
    if (typeof v === "number") {
      numbers++;
      if (isDateFmt(sheet.cells[cellKey(r, read.col)]?.s?.fmt)) dates++;
    } else if (typeof v === "string" && v !== "") texts++;
  }
  if (!numbers || texts > numbers) return "text";
  return dates * 2 > numbers ? "date" : "number";
}

/**
 * The values of a column with how often each occurs, in a sensible order (numbers by size, then
 * text alphabetically, empty last). Rows the other columns' filters hide are left out, like Excel.
 */
export function columnValues(calc: Calc, sheet: Sheet, t: TableSpec, index: number, locale: Locale): ColumnValue[] {
  const d = dataRows(t);
  const col = t.area.c0 + index;
  const read = new ColumnReader(calc, sheet, col, locale);
  const others = tableFilterTests(calc, sheet, t, locale, t.columns[index]?.id);
  const byKey = new Map<string, ColumnValue>();
  for (let r = d.r0; r <= d.r1; r++) {
    if (others.some((test) => !test(r))) continue;
    const text = read.text(r);
    const key = valueKey(text, locale);
    const known = byKey.get(key);
    if (known) {
      known.count++;
      continue;
    }
    const v = read.value(r);
    const rank = v === null || text === "" ? 4 : typeof v === "number" ? 0 : typeof v === "string" ? 1 : typeof v === "boolean" ? 2 : 3;
    byKey.set(key, { text, key, count: 1, rank, num: typeof v === "number" ? v : null });
  }
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return [...byKey.values()].sort((x, y) => x.rank - y.rank || (x.num !== null && y.num !== null ? x.num - y.num : collator.compare(x.text, y.text)));
}

/** The average of a column's numbers in the data rows (for the "above average" hint); null without numbers. */
export function columnAverage(calc: Calc, sheet: Sheet, t: TableSpec, index: number, locale: Locale): number | null {
  const d = dataRows(t);
  const nums = numbersOf(new ColumnReader(calc, sheet, t.area.c0 + index, locale), d.r0, d.r1);
  return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : null;
}
