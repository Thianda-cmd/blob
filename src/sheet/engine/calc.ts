// Calculating a workbook. Values are worked out when someone asks for them (the grid asks for the
// cells on screen) and remembered for the life of the Calc; any edit makes a new Calc.
//
// Long chains (A2 = A1 + 1 … A10000) must not overflow the stack, so a formula's precedents are
// calculated first with an explicit stack (depth-first, post-order): by the time a formula is
// evaluated, every formula cell it refers to already has its value. The same walk finds circular
// references: a precedent that is still on the walk's path closes a cycle, and every cell of the
// cycle gets #CIRC! (#ZIRKEL!), without hanging.

import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import type { RangeRef, Sheet, Workbook } from "../types";
import type { Calc, CalcOptions } from "./index";
import { argKind, getFunction, type Ctx, type FnDef } from "./functions";
import { power } from "./functions/math";
import { broadcast, toNum, toStr } from "./functions/util";
import { EXCEL_MAX_COLS, EXCEL_MAX_ROWS, type RefInfo } from "./lexer";
import { parseCanonical, type BinOp, type CachedParse, type Node } from "./parser";
import { compareValues, ERR, isErr, isMatrix, isRef, mkErr, numResult, Ref, type CellError, type CellValue, type ErrorCode, type Matrix, type Scalar, type Value } from "./values";


const COLS = EXCEL_MAX_COLS;
/** Global cell key: sheet × STRIDE + row × COLS + col (row < 2^20, col < 2^14). */
const STRIDE = 2 ** 35;
const RANGE_CACHE_CELLS = 4_000_000;

type SheetRec = {
  idx: number;
  id: string;
  name: string;
  sheet: Sheet;
};

/** Where a sheet's formulas are, and how far its cells reach. */
type SheetIndex = {
  /** Formula cells: rows (sorted) by column. */
  formulas: Map<number, number[]>;
  /** The last row and column holding a formula. */
  maxFormulaRow: number;
  maxFormulaCol: number;
  /** The last row and column holding anything (computed when first needed). */
  used: { maxRow: number; maxCol: number } | null;
};

// Cells objects never change (every edit makes a new one), so an index built for one stays right
// for every Calc of a workbook that still holds that same sheet: editing one sheet doesn't rebuild
// the others'.
const indexCache = new WeakMap<object, SheetIndex>();

function sheetIndex(cells: Sheet["cells"]): SheetIndex {
  let idx = indexCache.get(cells);
  if (idx) return idx;
  const formulas = new Map<number, number[]>();
  let maxFormulaRow = -1;
  let maxFormulaCol = -1;
  for (const key in cells) {
    if (cells[key].f === undefined) continue;
    const comma = key.indexOf(",");
    const r = +key.slice(0, comma);
    const c = +key.slice(comma + 1);
    if (r > maxFormulaRow) maxFormulaRow = r;
    if (c > maxFormulaCol) maxFormulaCol = c;
    let a = formulas.get(c);
    if (!a) formulas.set(c, (a = []));
    a.push(r);
  }
  for (const a of formulas.values()) a.sort((x, y) => x - y);
  idx = { formulas, maxFormulaRow, maxFormulaCol, used: null };
  indexCache.set(cells, idx);
  return idx;
}

function usedOf(cells: Sheet["cells"]): { maxRow: number; maxCol: number } {
  const idx = sheetIndex(cells);
  if (idx.used) return idx.used;
  let maxRow = -1;
  let maxCol = -1;
  for (const key in cells) {
    const comma = key.indexOf(",");
    const r = +key.slice(0, comma);
    const c = +key.slice(comma + 1);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  }
  idx.used = { maxRow, maxCol };
  return idx.used;
}

const ERR_BY_CODE = new Map<ErrorCode, CellError>([
  ["#DIV/0!", ERR.div0],
  ["#N/A", ERR.na],
  ["#NAME?", ERR.name],
  ["#NULL!", ERR.null],
  ["#NUM!", ERR.num],
  ["#REF!", Object.freeze({ error: "#REF!", detail: "deleted-ref" }) as CellError],
  ["#VALUE!", ERR.value],
  ["#CALC!", ERR.calc],
  ["#CIRC!", ERR.circ],
]);

export class CalcImpl implements Calc {
  readonly workbook: Workbook;
  readonly locale: Locale;
  private readonly recs: SheetRec[] = [];
  private readonly byId = new Map<string, SheetRec>();
  private readonly byName = new Map<string, SheetRec>();
  private readonly memo = new Map<number, Scalar>();
  private readonly cyc = new Set<number>();
  /** Formula cells being evaluated right now, with the order they started in (outer ones lower). */
  private readonly active = new Map<number, number>();
  private readonly activeBySeq = new Map<number, number>();
  private seq = 0;
  private readonly rangeCache = new Map<string, Matrix>();
  private rangeCacheCells = 0;
  private readonly fnCache = new Map<string, unknown>();
  private readonly nowFn: () => Date;
  private nowValue: Date | null = null;
  private readonly hiddenFn?: (sheetId: string, row: number) => boolean;
  private readonly filteredFn?: (sheetId: string, row: number) => boolean;
  private extent: { rows: number; cols: number } | null = null;
  /**
   * Values that read a cell still being calculated (re-entrant reads, e.g. a smart table's filter
   * asked while SUBTOTAL runs, or a reference made up during evaluation). Each is anchored to the
   * outermost such cell and only holds while that one is still being calculated; afterwards it is
   * worked out again with the finished value, so nothing provisional is ever kept.
   */
  private readonly temp = new Map<number, { v: Scalar; anchor: number }>();
  /** The outermost in-progress cell (by start order) the current evaluation has read; Infinity: none. */
  private readAnchor = Infinity;

  constructor(wb: Workbook, opts: CalcOptions = {}) {
    this.workbook = wb;
    this.locale = opts.locale ?? DEFAULT_LOCALE;
    this.nowFn = opts.now ?? (() => new Date());
    this.hiddenFn = opts.isRowHidden;
    this.filteredFn = opts.isRowFiltered;
    wb.sheets.forEach((sheet, idx) => {
      const rec: SheetRec = { idx, id: sheet.id, name: sheet.name, sheet };
      this.recs.push(rec);
      this.byId.set(sheet.id, rec);
      const lower = sheet.name.toLowerCase();
      if (!this.byName.has(lower)) this.byName.set(lower, rec);
    });
  }

  // --------------------------------------------------------------------------------------------
  // Public API

  /** A new request from outside (not a re-entrant one): provisional values of the last one go. */
  private begin(): void {
    if (this.active.size === 0) {
      if (this.temp.size) this.temp.clear();
      this.readAnchor = Infinity;
    }
  }

  value(sheetId: string, row: number, col: number): CellValue {
    const rec = this.byId.get(sheetId);
    if (!rec || row < 0 || col < 0 || row >= EXCEL_MAX_ROWS || col >= COLS) return null;
    this.begin();
    return this.cellValue(rec.idx, row, col);
  }

  values(ref: RangeRef): CellValue[][] {
    const rec = this.byId.get(ref.sheetId);
    const r0 = Math.min(ref.r0, ref.r1);
    const r1 = Math.max(ref.r0, ref.r1);
    const c0 = Math.min(ref.c0, ref.c1);
    const c1 = Math.max(ref.c0, ref.c1);
    this.begin();
    const out: CellValue[][] = [];
    for (let r = r0; r <= r1; r++) {
      const line: CellValue[] = [];
      for (let c = c0; c <= c1; c++) line.push(rec && r >= 0 && c >= 0 ? this.cellValue(rec.idx, r, c) : null);
      out.push(line);
    }
    return out;
  }

  evaluate(formula: string, at: { sheetId: string; row: number; col: number }): CellValue {
    const p = parseCanonical(formula);
    if (!p.ok) return ERR.syntax;
    const rec = this.byId.get(at.sheetId);
    if (!rec) return mkErr("#REF!", "sheet-missing");
    this.begin();
    const deps: number[] = [];
    this.collectDeps(p.parsed.refs, rec, deps);
    for (const d of deps) if (!this.known(d)) this.ensure(d);
    const ctx = new EvalCtx(this, rec.idx, at.row, at.col);
    try {
      return this.finish(ev(p.parsed.ast, ctx), ctx);
    } catch {
      return mkErr("#VALUE!", "internal");
    }
  }

  // --------------------------------------------------------------------------------------------
  // Cells

  now(): Date {
    if (!this.nowValue) this.nowValue = this.nowFn();
    return this.nowValue;
  }

  /** Has this formula cell a value for now (final, or provisional for this request)? */
  private known(gk: number): boolean {
    return this.memo.has(gk) || this.tempValue(gk, false) !== undefined;
  }

  /** A provisional value that still holds (its anchor cell is still being calculated); stale ones go. */
  private tempValue(gk: number, read: boolean): Scalar | undefined {
    const t = this.temp.get(gk);
    if (t === undefined) return undefined;
    if (!this.activeBySeq.has(t.anchor)) {
      this.temp.delete(gk);
      return undefined;
    }
    if (read && t.anchor < this.readAnchor) this.readAnchor = t.anchor;
    return t.v;
  }

  cellValue(sheet: number, row: number, col: number): Scalar {
    const gk = sheet * STRIDE + row * COLS + col;
    const m = this.memo.get(gk);
    if (m !== undefined) return m;
    const t = this.tempValue(gk, true);
    if (t !== undefined) return t;
    const rec = this.recs[sheet];
    if (!rec) return null;
    const cell = rec.sheet.cells[`${row},${col}`];
    if (!cell) return null;
    if (cell.f === undefined) {
      const v = cell.v;
      if (v === undefined) return null;
      if (typeof v === "number" && !Number.isFinite(v)) return ERR.num;
      return v;
    }
    const running = this.active.get(gk);
    if (running !== undefined) {
      if (running < this.readAnchor) this.readAnchor = running;
      return ERR.circ;
    }
    return this.ensure(gk);
  }

  formulaAt(sheet: number, row: number, col: number): string | undefined {
    return this.recs[sheet]?.sheet.cells[`${row},${col}`]?.f;
  }

  hasCell(sheet: number, row: number, col: number): boolean {
    const c = this.recs[sheet]?.sheet.cells[`${row},${col}`];
    return !!c && (c.f !== undefined || c.v !== undefined);
  }

  rowHidden(sheet: number, row: number): { filtered: boolean; manual: boolean } {
    const rec = this.recs[sheet];
    if (!rec) return { filtered: false, manual: false };
    const manual = !!rec.sheet.rows[String(row)]?.hidden;
    // A filtered row never counts, hidden by hand as well or not (Excel's SUBTOTAL 1–11 too).
    if (this.filteredFn) return { filtered: this.filteredFn(rec.id, row), manual };
    const any = this.hiddenFn ? this.hiddenFn(rec.id, row) : manual;
    return { filtered: any && !manual, manual };
  }

  memoFn<T>(key: string, make: () => T): T {
    if (this.fnCache.has(key)) return this.fnCache.get(key) as T;
    const outer = this.readAnchor;
    this.readAnchor = Infinity;
    const v = make();
    const anchor = this.readAnchor;
    this.readAnchor = Math.min(outer, anchor);
    // Built from provisional values: good for now, not for later.
    if (anchor === Infinity) this.fnCache.set(key, v);
    return v;
  }

  // --------------------------------------------------------------------------------------------
  // References

  refValue(ref: RefInfo, host: number): Ref | CellError {
    let rec: SheetRec | undefined;
    if (ref.sheet === null) rec = this.recs[host];
    else rec = this.byName.get(ref.sheet.toLowerCase());
    if (!rec) return mkErr("#REF!", `sheet-missing:${ref.sheet}`);
    return new Ref(rec.idx, Math.min(ref.r0, ref.r1), Math.min(ref.c0, ref.c1), Math.max(ref.r0, ref.r1), Math.max(ref.c0, ref.c1));
  }

  /** The used part of every sheet (rows and columns), so A:A doesn't mean a million rows. */
  private usedExtent(): { rows: number; cols: number } {
    if (this.extent) return this.extent;
    let rows = 1;
    let cols = 1;
    for (const rec of this.recs) {
      const used = usedOf(rec.sheet.cells);
      rows = Math.max(rows, rec.sheet.size?.rows ?? 0, used.maxRow + 1);
      cols = Math.max(cols, rec.sheet.size?.cols ?? 0, used.maxCol + 1);
    }
    this.extent = { rows: Math.min(rows, EXCEL_MAX_ROWS), cols: Math.min(cols, COLS) };
    return this.extent;
  }

  clip(ref: Ref): Ref {
    const wholeCols = ref.r0 === 0 && ref.r1 >= EXCEL_MAX_ROWS - 1;
    const wholeRows = ref.c0 === 0 && ref.c1 >= COLS - 1;
    if (!wholeCols && !wholeRows) return ref;
    const ext = this.usedExtent();
    return new Ref(ref.sheet, ref.r0, ref.c0, wholeCols ? Math.max(0, ext.rows - 1) : ref.r1, wholeRows ? Math.max(0, ext.cols - 1) : ref.c1);
  }

  deref(v: Value): Scalar | Matrix {
    if (!isRef(v)) return v;
    if (v.single) return this.cellValue(v.sheet, v.r0, v.c0);
    return this.matrix(v);
  }

  matrix(ref0: Ref): Matrix {
    const ref = this.clip(ref0);
    const n = ref.rows * ref.cols;
    const key = n >= 32 ? `${ref.sheet}:${ref.r0}:${ref.c0}:${ref.r1}:${ref.c1}` : null;
    if (key) {
      const hit = this.rangeCache.get(key);
      if (hit) return hit;
    }
    const outer = this.readAnchor;
    this.readAnchor = Infinity;
    const out: Matrix = new Array(ref.rows);
    for (let r = ref.r0, i = 0; r <= ref.r1; r++, i++) {
      const line: Scalar[] = new Array(ref.cols);
      for (let c = ref.c0, j = 0; c <= ref.c1; c++, j++) line[j] = this.cellValue(ref.sheet, r, c);
      out[i] = line;
    }
    const anchor = this.readAnchor;
    this.readAnchor = Math.min(outer, anchor);
    if (key && anchor === Infinity && this.rangeCacheCells + n <= RANGE_CACHE_CELLS) {
      this.rangeCache.set(key, out);
      this.rangeCacheCells += n;
    }
    return out;
  }

  // --------------------------------------------------------------------------------------------
  // Dependencies and the evaluation walk

  /** Formula cells (global keys) the references point at that aren't calculated yet. */
  private collectDeps(refs: RefInfo[], host: SheetRec, out: number[]): void {
    for (const ref of refs) {
      const rec = ref.sheet === null ? host : this.byName.get(ref.sheet.toLowerCase());
      if (!rec) continue;
      const r0 = ref.r0 < ref.r1 ? ref.r0 : ref.r1;
      const c0 = ref.c0 < ref.c1 ? ref.c0 : ref.c1;
      const base = rec.idx * STRIDE;
      if (ref.kind === "cell") {
        const cell = rec.sheet.cells[`${r0},${c0}`];
        if (cell !== undefined && cell.f !== undefined) {
          const gk = base + r0 * COLS + c0;
          if (!this.known(gk)) out.push(gk);
        }
        continue;
      }
      const idx = sheetIndex(rec.sheet.cells);
      if (!idx.formulas.size) continue;
      let r1 = ref.r0 < ref.r1 ? ref.r1 : ref.r0;
      let c1 = ref.c0 < ref.c1 ? ref.c1 : ref.c0;
      if (r1 > idx.maxFormulaRow) r1 = idx.maxFormulaRow;
      if (c1 > idx.maxFormulaCol) c1 = idx.maxFormulaCol;
      if (r0 > r1 || c0 > c1) continue;
      if (c1 - c0 + 1 > idx.formulas.size) {
        for (const [c, rows] of idx.formulas) if (c >= c0 && c <= c1) this.depsInColumn(rows, base + c, r0, r1, out);
      } else {
        for (let c = c0; c <= c1; c++) {
          const rows = idx.formulas.get(c);
          if (rows !== undefined) this.depsInColumn(rows, base + c, r0, r1, out);
        }
      }
    }
  }

  /** Formula rows r0…r1 of one column (rows sorted) not calculated yet. */
  private depsInColumn(rows: number[], baseCol: number, r0: number, r1: number, out: number[]): void {
    let lo = 0;
    let hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid] < r0) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < rows.length && rows[k] <= r1; k++) {
      const gk = baseCol + rows[k] * COLS;
      if (!this.known(gk)) out.push(gk);
    }
  }

  /** The parsed formula of a cell (null when it has none or it doesn't parse). */
  private parsedAt(gk: number): { rec: SheetRec; row: number; col: number; parsed: CachedParse | null } {
    const sheet = Math.floor(gk / STRIDE);
    const key = gk - sheet * STRIDE;
    const row = Math.floor(key / COLS);
    const col = key - row * COLS;
    const rec = this.recs[sheet];
    const f = rec.sheet.cells[`${row},${col}`]?.f;
    return { rec, row, col, parsed: f === undefined ? null : parseCanonical(f) };
  }

  /** Calculate a formula cell and everything it needs first, without recursion; its value. */
  private ensure(start: number): Scalar {
    const done = this.memo.get(start) ?? this.tempValue(start, true);
    if (done !== undefined) return done;
    // Most formulas need nothing that isn't calculated yet: no walk needed.
    const first = this.parsedAt(start);
    const firstDeps: number[] = [];
    if (first.parsed?.ok) this.collectDeps(first.parsed.parsed.refs, first.rec, firstDeps);
    if (!firstDeps.length) return this.store(start, first);
    let result: Scalar | undefined;
    const stack: number[] = [start];
    const deps: (number[] | null)[] = [firstDeps];
    const pos: number[] = [0];
    const onPath = new Map<number, number>([[start, 0]]);
    while (stack.length) {
      const top = stack.length - 1;
      const g = stack[top];
      let ds = deps[top];
      if (ds === null) {
        if (this.known(g)) {
          stack.pop();
          deps.pop();
          pos.pop();
          onPath.delete(g);
          continue;
        }
        const pa = this.parsedAt(g);
        ds = [];
        if (pa.parsed?.ok) this.collectDeps(pa.parsed.parsed.refs, pa.rec, ds);
        deps[top] = ds;
        pos[top] = 0;
      }
      if (pos[top] < ds.length) {
        const d = ds[pos[top]++];
        if (this.known(d)) continue;
        const at = onPath.get(d);
        if (at !== undefined) {
          // A cycle: every cell on the path from d to here is part of it.
          for (let k = at; k <= top; k++) this.cyc.add(stack[k]);
          continue;
        }
        if (this.active.has(d)) continue; // being evaluated further out: it will read as #CIRC!
        stack.push(d);
        deps.push(null);
        pos.push(0);
        onPath.set(d, stack.length - 1);
        continue;
      }
      stack.pop();
      deps.pop();
      pos.pop();
      onPath.delete(g);
      const have = this.memo.get(g) ?? this.tempValue(g, true);
      const v = have !== undefined ? have : this.store(g, this.parsedAt(g));
      if (g === start) result = v;
    }
    return result ?? this.memo.get(start) ?? this.tempValue(start, true) ?? null;
  }

  /** Evaluate a formula cell and keep its value: for good, or (when it read something still being calculated) for this request. */
  private store(gk: number, pa: { rec: SheetRec; row: number; col: number; parsed: CachedParse | null }): Scalar {
    if (this.cyc.has(gk)) {
      this.memo.set(gk, ERR.circ);
      return ERR.circ;
    }
    const outer = this.readAnchor;
    this.readAnchor = Infinity;
    const mine = this.seq + 1; // the start number evalParsed gives this cell
    const v = this.evalParsed(gk, pa.rec, pa.row, pa.col, pa.parsed);
    const anchor = this.readAnchor;
    // Read only itself while running (a loop back to it): evaluating again would go the same way, so
    // the value is final. Read an outer cell still running: provisional until that one finishes.
    const final = anchor === Infinity || anchor >= mine;
    if (final) this.memo.set(gk, v);
    else this.temp.set(gk, { v, anchor });
    this.readAnchor = Math.min(outer, final ? Infinity : anchor);
    return v;
  }

  private evalParsed(gk: number, rec: SheetRec, row: number, col: number, p: CachedParse | null): Scalar {
    if (p === null) {
      const v = rec.sheet.cells[`${row},${col}`]?.v;
      return v === undefined ? null : v;
    }
    if (!p.ok) return ERR.syntax;
    const seq = ++this.seq;
    this.active.set(gk, seq);
    this.activeBySeq.set(seq, gk);
    const ctx = new EvalCtx(this, rec.idx, row, col);
    try {
      return this.finish(ev(p.parsed.ast, ctx), ctx);
    } catch {
      // A bug or a formula nested too deeply must never break the whole sheet.
      return mkErr("#VALUE!", "internal");
    } finally {
      this.active.delete(gk);
      this.activeBySeq.delete(seq);
    }
  }

  /** A formula's result as one cell value: references give their (top-left) value, empty gives 0. */
  finish(v: Value, ctx: EvalCtx): Scalar {
    let s: Scalar;
    if (isRef(v)) s = this.cellValue(v.sheet, v.r0, v.c0);
    else if (isMatrix(v)) s = v[0]?.[0] ?? null;
    else s = v;
    void ctx;
    if (s === null) return 0;
    if (typeof s === "number") return numResult(s);
    return s;
  }
}

// ----------------------------------------------------------------------------------------------
// The context a formula is evaluated in

class EvalCtx implements Ctx {
  constructor(
    readonly calc: CalcImpl,
    readonly sheet: number,
    readonly row: number,
    readonly col: number,
  ) {}
  get locale() {
    return this.calc.locale;
  }
  now() {
    return this.calc.now();
  }
  cell(sheet: number, row: number, col: number) {
    if (row < 0 || col < 0 || row >= EXCEL_MAX_ROWS || col >= COLS) return null;
    return this.calc.cellValue(sheet, row, col);
  }
  deref(v: Value) {
    return this.calc.deref(v);
  }
  matrix(ref: Ref) {
    return this.calc.matrix(ref);
  }
  clip(ref: Ref) {
    return this.calc.clip(ref);
  }
  formula(sheet: number, row: number, col: number) {
    return this.calc.formulaAt(sheet, row, col);
  }
  rowHidden(sheet: number, row: number) {
    return this.calc.rowHidden(sheet, row);
  }
  ev(node: Node): Value {
    return ev(node, this);
  }
  hasCell(sheet: number, row: number, col: number) {
    return this.calc.hasCell(sheet, row, col);
  }
  memo<T>(key: string, make: () => T): T {
    return this.calc.memoFn(key, make);
  }
}

// ----------------------------------------------------------------------------------------------
// The interpreter

function ev(node: Node, ctx: EvalCtx): Value {
  switch (node.t) {
    case "num":
      return node.v;
    case "str":
      return node.v;
    case "bool":
      return node.v;
    case "err":
      return ERR_BY_CODE.get(node.v) ?? mkErr(node.v);
    case "miss":
      return null;
    case "arr":
      return node.v;
    case "name":
      return mkErr("#NAME?", `unknown-name:${node.name}`);
    case "ref":
      return ctx.calc.refValue(node.ref, ctx.sheet);
    case "range": {
      const a = ev(node.a, ctx);
      const b = ev(node.b, ctx);
      if (isErr(a)) return a;
      if (isErr(b)) return b;
      if (!isRef(a) || !isRef(b) || a.sheet !== b.sheet) return ERR.value;
      return new Ref(a.sheet, Math.min(a.r0, b.r0), Math.min(a.c0, b.c0), Math.max(a.r1, b.r1), Math.max(a.c1, b.c1));
    }
    case "neg":
      return unary(ev(node.a, ctx), ctx, (n) => -n);
    case "pos": {
      const v = ev(node.a, ctx);
      return isRef(v) ? ctx.deref(v) : v;
    }
    case "pct":
      return unary(ev(node.a, ctx), ctx, (n) => n / 100);
    case "bin":
      return binary(node.op, ev(node.a, ctx), ev(node.b, ctx), ctx);
    case "call":
      return call(node, ctx);
  }
}

function unaryScalar(x: Scalar, ctx: EvalCtx, f: (n: number) => number): Scalar {
  if (isErr(x)) return x;
  const n = toNum(x, ctx);
  if (typeof n !== "number") return n;
  return numResult(f(n));
}

function unary(v: Value, ctx: EvalCtx, f: (n: number) => number): Value {
  const x = isRef(v) ? ctx.deref(v) : v;
  if (isMatrix(x)) return x.map((row) => row.map((e) => unaryScalar(e, ctx, f)));
  return unaryScalar(x, ctx, f);
}

/** Sums that cancel out within rounding noise are 0, like Excel (0,3 − 0,2 − 0,1 = 0). */
function snap(r: number, a: number, b: number): number {
  if (r !== 0 && Math.abs(r) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-15) return 0;
  return r;
}

function binaryScalar(op: BinOp, x: Scalar, y: Scalar, ctx: EvalCtx): Scalar {
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  switch (op) {
    case "+":
    case "-":
    case "*":
    case "/":
    case "^": {
      const a = toNum(x, ctx);
      if (typeof a !== "number") return a;
      const b = toNum(y, ctx);
      if (typeof b !== "number") return b;
      switch (op) {
        case "+":
          return numResult(snap(a + b, a, b));
        case "-":
          return numResult(snap(a - b, a, b));
        case "*":
          return numResult(a * b);
        case "/":
          return b === 0 ? ERR.div0 : numResult(a / b);
        case "^":
          return power(a, b);
      }
      return ERR.value;
    }
    case "&": {
      const a = toStr(x, ctx);
      if (typeof a !== "string") return a;
      const b = toStr(y, ctx);
      if (typeof b !== "string") return b;
      const s = a + b;
      return s.length > 32767 ? mkErr("#VALUE!", "too-long") : s;
    }
    default: {
      const c = compareValues(x, y);
      switch (op) {
        case "=":
          return c === 0;
        case "<>":
          return c !== 0;
        case "<":
          return c < 0;
        case ">":
          return c > 0;
        case "<=":
          return c <= 0;
        case ">=":
          return c >= 0;
      }
      return ERR.value;
    }
  }
}

function binary(op: BinOp, av: Value, bv: Value, ctx: EvalCtx): Value {
  const a = isRef(av) ? ctx.deref(av) : av;
  const b = isRef(bv) ? ctx.deref(bv) : bv;
  if (!isMatrix(a) && !isMatrix(b)) return binaryScalar(op, a, b, ctx);
  return broadcast([a, b], ([x, y]) => binaryScalar(op, x, y, ctx));
}

function call(node: Extract<Node, { t: "call" }>, ctx: EvalCtx): Value {
  const def: FnDef | null = node.fn ?? getFunction(node.name);
  if (!def) return mkErr("#NAME?", `unknown-function:${node.name}`);
  const n = node.args.length;
  if (n < def.min || n > def.max) return mkErr("#VALUE!", `args:${def.name}`);
  if (def.lazy) return def.lazy(node.args, ctx);
  const vals: Value[] = new Array(n);
  let lift = false;
  for (let i = 0; i < n; i++) {
    const kind = argKind(def.args, i);
    let v = i === 0 && def.lookupValue && node.args[0].t === "miss" ? 0 : ev(node.args[i], ctx);
    if (kind !== "r") {
      if (isRef(v)) v = ctx.deref(v);
      if (kind === "s" && isMatrix(v)) {
        if (v.length === 1 && v[0].length === 1) v = v[0][0];
        else lift = true;
      }
      if (kind === "s" && !def.takesErrors && isErr(v) && !lift) return v;
    }
    vals[i] = v;
  }
  if (!lift) return named(def.impl!(vals, ctx), def);
  // Excel 365: a function of one value given arrays runs once per element.
  const lifted: (Scalar | Matrix)[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (argKind(def.args, i) === "s") {
      lifted.push(vals[i] as Scalar | Matrix);
      idx.push(i);
    }
  }
  return broadcast(lifted, (xs) => {
    const args = vals.slice();
    for (let k = 0; k < idx.length; k++) {
      const x = xs[k];
      if (!def.takesErrors && isErr(x)) return x;
      args[idx[k]] = x;
    }
    const r = named(def.impl!(args, ctx), def);
    if (isRef(r)) return ctx.calc.cellValue(r.sheet, r.r0, r.c0);
    if (isMatrix(r)) return r[0]?.[0] ?? null;
    return r;
  });
}

/** The details `why` writes, with "@" for the function (functions/util.ts). */
const WHY_DETAIL = /^(few|same|nomatch|norepeat|arg):@(?=:|$)/;

/**
 * An error the function made itself says which function it was ("few:@:2:1" → "few:STDEV.S:2:1",
 * see `why`). Only those: an error passed on from an argument keeps its detail, even when an "@"
 * is part of it (the sheet „Messung @ 37 °C“ that is gone).
 */
function named(r: Value, def: FnDef): Value {
  if (!isErr(r) || !r.detail) return r;
  const m = WHY_DETAIL.exec(r.detail);
  return m ? mkErr(r.error, `${m[1]}:${def.name}${r.detail.slice(m[0].length)}`) : r;
}

export function createCalcImpl(wb: Workbook, opts?: CalcOptions): Calc {
  return new CalcImpl(wb, opts);
}
