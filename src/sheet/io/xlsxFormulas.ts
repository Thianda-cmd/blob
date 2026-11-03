// Formulas between Blob and .xlsx files. Blob stores formulas the way Excel's files do (English
// names, "," between arguments, A1 references, 'quoted sheets'), so most go through unchanged.
// What differs:
// - Functions newer than Excel 2007 are written "_xlfn.STDEV.S(…)" in the file, else Excel shows
//   #NAME? until the cell is typed again. Blob adds the prefix on export and drops it on import.
// - Excel's formulas may use smart table references (Tabelle1[Extinktion], [@Konzentration]) and
//   defined names (Konz). Blob has neither, so on import they become the A1 references they mean.
// - References to other files ([1]Blatt1!A1) can't work in Blob: such formulas keep their value.

import { quoteSheetName } from "../a1";
import type { Area } from "../types";

/** Functions the file format writes with the "_xlfn." prefix (added in Excel 2010 and later). */
const FUTURE = new Set(
  (
    "ACOT ACOTH AGGREGATE ARABIC ARRAYTOTEXT BASE BETA.DIST BETA.INV BINOM.DIST BINOM.DIST.RANGE BINOM.INV BITAND BITLSHIFT BITOR BITRSHIFT BITXOR " +
    "BYCOL BYROW CEILING.MATH CEILING.PRECISE CHISQ.DIST CHISQ.DIST.RT CHISQ.INV CHISQ.INV.RT CHISQ.TEST CHOOSECOLS CHOOSEROWS COMBINA CONCAT " +
    "CONFIDENCE.NORM CONFIDENCE.T COT COTH COVARIANCE.P COVARIANCE.S CSC CSCH DAYS DECIMAL DROP ECMA.CEILING ERF.PRECISE ERFC.PRECISE EXPAND " +
    "EXPON.DIST F.DIST F.DIST.RT F.INV F.INV.RT F.TEST FILTERXML FLOOR.MATH FLOOR.PRECISE FORECAST.ETS FORECAST.ETS.CONFINT FORECAST.ETS.SEASONALITY " +
    "FORECAST.ETS.STAT FORECAST.LINEAR FORMULATEXT GAMMA GAMMA.DIST GAMMA.INV GAMMALN.PRECISE GAUSS HSTACK HYPGEOM.DIST IFNA IFS IMCOSH IMCOT IMCSC " +
    "IMCSCH IMSEC IMSECH IMSINH IMTAN ISFORMULA ISO.CEILING ISOMITTED ISOWEEKNUM LAMBDA LET LOGNORM.DIST LOGNORM.INV MAKEARRAY MAP MAXIFS MINIFS " +
    "MODE.MULT MODE.SNGL MUNIT NEGBINOM.DIST NETWORKDAYS.INTL NORM.DIST NORM.INV NORM.S.DIST NORM.S.INV NUMBERVALUE PDURATION PERCENTILE.EXC " +
    "PERCENTILE.INC PERCENTRANK.EXC PERCENTRANK.INC PERMUTATIONA PHI POISSON.DIST QUARTILE.EXC QUARTILE.INC RANDARRAY RANK.AVG RANK.EQ REDUCE RRI " +
    "SCAN SEC SECH SEQUENCE SHEET SHEETS SKEW.P SORTBY STDEV.P STDEV.S SWITCH T.DIST T.DIST.2T T.DIST.RT T.INV T.INV.2T T.TEST TAKE TEXTAFTER " +
    "TEXTBEFORE TEXTJOIN TEXTSPLIT TOCOL TOROW UNICHAR UNICODE UNIQUE VALUETOTEXT VAR.P VAR.S VSTACK WEBSERVICE WEIBULL.DIST WORKDAY.INTL WRAPCOLS " +
    "WRAPROWS XLOOKUP XMATCH XOR Z.TEST"
  ).split(" "),
);
/** Worksheet functions that also need "_xlws." after "_xlfn.". */
const WORKSHEET_FN = new Set(["FILTER", "SORT"]);

// Scanning ----------------------------------------------------------------------------------------

export type Tok = { k: "str" | "sheet" | "bracket" | "ident" | "num" | "err" | "ws" | "op"; text: string };

const IDENT_START = /[\p{L}_\\$]/u;
const IDENT_PART = /[\p{L}\p{N}_.$?\\]/u;

/**
 * The pieces of a formula as Excel's files write it: "text", 'sheet names', [bracketed] parts
 * (smart table references and other files), names, numbers, error values, spaces and operators.
 */
export function scanFormula(f: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = f.length;
  while (i < n) {
    const c = f[i];
    if (c === '"') {
      let j = i + 1;
      for (;;) {
        const q = f.indexOf('"', j);
        if (q < 0) {
          j = n;
          break;
        }
        if (f[q + 1] === '"') {
          j = q + 2;
          continue;
        }
        j = q + 1;
        break;
      }
      out.push({ k: "str", text: f.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        const q = f.indexOf("'", j);
        if (q < 0) {
          j = n;
          break;
        }
        if (f[q + 1] === "'") {
          j = q + 2;
          continue;
        }
        j = q + 1;
        break;
      }
      out.push({ k: "sheet", text: f.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "[") {
      // Nested brackets; inside them ' escapes the next character (Tabelle1['[Probe']]).
      let depth = 0;
      let j = i;
      while (j < n) {
        const d = f[j];
        if (d === "'" && depth > 0) {
          j += 2;
          continue;
        }
        if (d === "[") depth++;
        else if (d === "]") {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
        }
        j++;
      }
      out.push({ k: "bracket", text: f.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "#") {
      const m = /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CALC!|CIRC!)/i.exec(f.slice(i));
      if (m) {
        out.push({ k: "err", text: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(f[i + 1] ?? ""))) {
      const m = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(f.slice(i))!;
      // "1:3" (whole rows) and "A1" never start here; a number glued to letters is a name part.
      out.push({ k: "num", text: m[0] });
      i += m[0].length;
      continue;
    }
    if (IDENT_START.test(c)) {
      let j = i + 1;
      while (j < n && IDENT_PART.test(f[j])) j++;
      out.push({ k: "ident", text: f.slice(i, j) });
      i = j;
      continue;
    }
    if (/\s/.test(c)) {
      let j = i + 1;
      while (j < n && /\s/.test(f[j])) j++;
      out.push({ k: "ws", text: f.slice(i, j) });
      i = j;
      continue;
    }
    out.push({ k: "op", text: c });
    i++;
  }
  return out;
}

const join = (toks: Tok[]) => toks.map((t) => t.text).join("");

/** The next token that isn't a space. */
function nextSolid(toks: Tok[], i: number): Tok | undefined {
  for (let j = i + 1; j < toks.length; j++) if (toks[j].k !== "ws") return toks[j];
  return undefined;
}
function prevSolid(toks: Tok[], i: number): Tok | undefined {
  for (let j = i - 1; j >= 0; j--) if (toks[j].k !== "ws") return toks[j];
  return undefined;
}

const CELL = /^\$?[A-Za-z]{1,3}\$?[0-9]{1,7}$/;
const COLUMN = /^\$?[A-Za-z]{1,3}$/;

/** A name that is a cell, a column of a range (A:C), TRUE/FALSE: not a defined name. */
function isRefLike(toks: Tok[], i: number): boolean {
  const t = toks[i].text;
  if (CELL.test(t) || /^(TRUE|FALSE)$/i.test(t)) return true;
  if (COLUMN.test(t)) {
    const before = toks[i - 1];
    const after = toks[i + 1];
    return before?.text === ":" || after?.text === ":";
  }
  return false;
}

// Export ------------------------------------------------------------------------------------------

/** A Blob formula as the file writes it: newer functions get their "_xlfn." prefix. */
export function toFileFormula(canonical: string): string {
  const toks = scanFormula(canonical);
  let changed = false;
  toks.forEach((t, i) => {
    if (t.k !== "ident" || nextSolid(toks, i)?.text !== "(") return;
    const upper = t.text.toUpperCase();
    if (upper.startsWith("_XL")) return;
    if (WORKSHEET_FN.has(upper)) {
      t.text = `_xlfn._xlws.${upper}`;
      changed = true;
    } else if (FUTURE.has(upper)) {
      t.text = `_xlfn.${upper}`;
      changed = true;
    }
  });
  return changed ? join(toks) : canonical;
}

// Import ------------------------------------------------------------------------------------------

/** A smart table of the file, for reading references to it. */
export type FileTable = {
  name: string;
  /** Name of the sheet it is on. */
  sheet: string;
  /** The whole table: header row, data rows, totals row. */
  area: Area;
  header: boolean;
  totals: boolean;
  columns: string[];
};

export type FormulaContext = {
  /** Smart tables by upper-case name. */
  tables: Map<string, FileTable>;
  /** Defined names (upper-case) → their formula; `local` names apply on their sheet only. */
  names: Map<string, { global?: string; local: Map<string, string> }>;
  /** The sheet (by name) and cell the formula is in. */
  sheet: string;
  row: number;
  col: number;
  /** The smart table the cell is in, for references without a table name ([@Extinktion]). */
  tableAt: (sheet: string, row: number, col: number) => FileTable | null;
};

export type ImportedFormula = { formula: string } | { problem: "external" | "table-ref" };

/** Drop the file format's prefixes: _xlfn.STDEV.S → STDEV.S, _xlfn._xlws.SORT → SORT, _xlpm.x → x. */
export function stripPrefixes(f: string): string {
  if (!/_xl/i.test(f)) return f;
  const toks = scanFormula(f);
  for (const t of toks) if (t.k === "ident") t.text = t.text.replace(/^(?:_xlfn\.)?(?:_xlws\.)?(?:_xlpm\.)?/i, "");
  return join(toks);
}

/** Unescape a column name of a structured reference ('[ → [, '' → '). */
const unescapeColumn = (s: string) => s.replace(/'(.)/g, "$1").trim();

type Special = "#all" | "#data" | "#headers" | "#totals" | "#this row";

/** "[[#This Row],[Konz]]", "[Konz]", "[@Konz]", "[#Totals]" → which rows and columns. */
function parseStructured(inner: string): { specials: Special[]; from: string | null; to: string | null } | null {
  const body = inner.trim();
  if (body === "") return { specials: [], from: null, to: null };
  if (body.startsWith("@")) {
    let rest = body.slice(1).trim();
    if (rest.startsWith("[") && rest.endsWith("]")) rest = rest.slice(1, -1);
    return { specials: ["#this row"], from: rest ? unescapeColumn(rest) : null, to: null };
  }
  if (body.startsWith("#")) {
    const s = body.toLowerCase().replace(/\s+/g, " ") as Special;
    return ["#all", "#data", "#headers", "#totals", "#this row"].includes(s) ? { specials: [s], from: null, to: null } : null;
  }
  if (!body.startsWith("[")) return { specials: [], from: unescapeColumn(body), to: null };
  // A list: [#Headers],[#Data],[Col1]:[Col2]
  const items: string[] = [];
  let i = 0;
  const seps: string[] = [];
  while (i < body.length) {
    while (body[i] === " ") i++;
    if (body[i] !== "[") return null;
    let j = i + 1;
    while (j < body.length && body[j] !== "]") j += body[j] === "'" ? 2 : 1;
    items.push(body.slice(i + 1, j));
    i = j + 1;
    while (body[i] === " ") i++;
    if (i < body.length) {
      seps.push(body[i]);
      i++;
    }
  }
  const specials: Special[] = [];
  const cols: string[] = [];
  items.forEach((it) => {
    const t = it.trim();
    if (t.startsWith("#")) specials.push(t.toLowerCase().replace(/\s+/g, " ") as Special);
    else cols.push(unescapeColumn(t));
  });
  if (cols.length > 2 || seps.filter((s) => s === ":").length > 1) return null;
  return { specials, from: cols[0] ?? null, to: cols[1] ?? null };
}

const cellA1 = (row: number, col: number, absRow: boolean) => {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `$${s}${absRow ? "$" : ""}${row + 1}`;
};

/** A smart table reference → an A1 reference ("" when it can't be read). */
function structuredToA1(table: FileTable, inner: string, ctx: FormulaContext): string | null {
  const spec = parseStructured(inner);
  if (!spec) return null;
  const { area } = table;
  const headerRow = table.header ? area.r0 : -1;
  const dataR0 = table.header ? area.r0 + 1 : area.r0;
  const dataR1 = table.totals ? area.r1 - 1 : area.r1;
  const totalsRow = table.totals ? area.r1 : -1;
  const specials = spec.specials.length ? spec.specials : (["#data"] as Special[]);
  let r0 = Infinity;
  let r1 = -Infinity;
  let thisRow = false;
  for (const s of specials) {
    if (s === "#all") {
      r0 = Math.min(r0, area.r0);
      r1 = Math.max(r1, area.r1);
    } else if (s === "#data") {
      r0 = Math.min(r0, dataR0);
      r1 = Math.max(r1, dataR1);
    } else if (s === "#headers") {
      if (headerRow < 0) return "#REF!";
      r0 = Math.min(r0, headerRow);
      r1 = Math.max(r1, headerRow);
    } else if (s === "#totals") {
      if (totalsRow < 0) return "#REF!";
      r0 = Math.min(r0, totalsRow);
      r1 = Math.max(r1, totalsRow);
    } else if (s === "#this row") {
      thisRow = true;
      r0 = r1 = ctx.row;
    }
  }
  if (r0 > r1) return "#REF!";
  let c0 = area.c0;
  let c1 = area.c1;
  if (spec.from !== null) {
    const find = (name: string) => table.columns.findIndex((c) => c.trim().toLowerCase() === name.toLowerCase());
    const a = find(spec.from);
    const b = spec.to !== null ? find(spec.to) : a;
    if (a < 0 || b < 0) return null;
    c0 = area.c0 + Math.min(a, b);
    c1 = area.c0 + Math.max(a, b);
  }
  // Whole columns don't move when the formula is filled (absolute); "this row" follows its row.
  const start = cellA1(r0, c0, !thisRow);
  const end = cellA1(r1, c1, !thisRow);
  const ref = start === end ? start : `${start}:${end}`;
  return table.sheet.toLowerCase() === ctx.sheet.toLowerCase() ? ref : `${quoteSheetName(table.sheet)}!${ref}`;
}

/** A defined name's formula, wrapped in parentheses unless it is a single value or reference. */
function nameText(def: string): string {
  const t = def.trim();
  if (/^-?[0-9.]+(?:[eE][+-]?[0-9]+)?$/.test(t) || /^"(?:[^"]|"")*"$/.test(t)) return t;
  const toks = scanFormula(t).filter((x) => x.k !== "ws");
  const simple = toks.every((x) => x.k === "sheet" || x.k === "ident" || x.text === "!" || x.text === ":" || x.text === "$");
  return simple ? t : `(${t})`;
}

/**
 * A formula from a file → a Blob formula (still to be checked by the engine): prefixes dropped,
 * smart table references and defined names replaced by the A1 references they stand for.
 */
export function importFormula(raw: string, ctx: FormulaContext, depth = 0): ImportedFormula {
  const f = stripPrefixes(raw.replace(/^=/, ""));
  const toks = scanFormula(f);
  // References into other files: [1]Blatt1!A1, '[1]Blatt 1'!A1, 'C:\…\[Mappe.xlsx]Blatt1'!A1.
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === "sheet" && /^'[^']*\[/.test(t.text)) return { problem: "external" };
    if (t.k === "bracket" && /^\[\d+\]$/.test(t.text)) return { problem: "external" };
  }
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === "ident" && toks[i + 1]?.k === "bracket") {
      const table = ctx.tables.get(t.text.toUpperCase());
      if (table) {
        const a1 = structuredToA1(table, toks[i + 1].text.slice(1, -1), ctx);
        if (a1 === null) return { problem: "table-ref" };
        out.push({ k: "ident", text: a1 });
        i++;
        continue;
      }
    }
    if (t.k === "bracket") {
      // A reference without the table's name: the table the cell is in.
      const prev = out[out.length - 1];
      const glued = prev && (prev.k === "ident" || prev.k === "sheet" || prev.text === "]" || prev.text === ")" || prev.text === "!");
      if (!glued) {
        const table = ctx.tableAt(ctx.sheet, ctx.row, ctx.col);
        if (!table) return { problem: "table-ref" };
        const a1 = structuredToA1(table, t.text.slice(1, -1), ctx);
        if (a1 === null) return { problem: "table-ref" };
        out.push({ k: "ident", text: a1 });
        continue;
      }
    }
    if (t.k === "ident" && depth < 5) {
      const next = nextSolid(toks, i);
      const prev = prevSolid(toks, i);
      const isFunction = next?.text === "(";
      const isSheet = next?.text === "!";
      const qualified = prev?.text === "!";
      if (!isFunction && !isSheet && !qualified && !isRefLike(toks, i)) {
        const upper = t.text.toUpperCase();
        // A smart table's name alone means its data.
        const table = ctx.tables.get(upper);
        if (table) {
          const a1 = structuredToA1(table, "", ctx);
          if (a1 === null) return { problem: "table-ref" };
          out.push({ k: "ident", text: a1 });
          continue;
        }
        const name = ctx.names.get(upper);
        const def = name ? (name.local.get(ctx.sheet.toLowerCase()) ?? name.global) : undefined;
        if (def !== undefined) {
          const inner = importFormula(def, ctx, depth + 1);
          if ("problem" in inner) return inner;
          out.push({ k: "ident", text: nameText(inner.formula) });
          continue;
        }
      }
    }
    out.push(t);
  }
  return { formula: join(out).trim() };
}

/** Upper-case names of the functions a formula calls (to say which ones Blob doesn't know). */
export function calledFunctions(f: string): string[] {
  const toks = scanFormula(f);
  const out = new Set<string>();
  toks.forEach((t, i) => {
    if (t.k === "ident" && nextSolid(toks, i)?.text === "(") out.add(t.text.toUpperCase());
  });
  return [...out];
}
