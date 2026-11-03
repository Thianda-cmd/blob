// Parsing tokens into a tree, with Excel's operator precedence (highest first):
//   ":" (range)  →  unary − +  →  %  →  ^  →  * /  →  + −  →  &  →  = <> < > <= >=
// Excel's quirks are kept: −2^2 = 4 (the minus binds tighter than ^) and 2^3^2 = 64 (left to right).
//
// The parser never throws. A formula that can't be understood gives a ParseError with the position
// and a code; messages.ts turns that into words for the person typing.

import { getFunction, type FnDef } from "./functions";
import { functionFromName, lex, type LexMode, type RefInfo, type Tok } from "./lexer";
import type { ErrorCode, Scalar } from "./values";

export type BinOp = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "err"; v: ErrorCode }
  | { t: "ref"; ref: RefInfo }
  | { t: "neg"; a: Node }
  | { t: "pos"; a: Node }
  | { t: "pct"; a: Node }
  | { t: "bin"; op: BinOp; a: Node; b: Node }
  | { t: "range"; a: Node; b: Node }
  | { t: "call"; name: string; fn: FnDef | null; args: Node[]; at: number }
  | { t: "arr"; v: Scalar[][] }
  | { t: "name"; name: string; at: number }
  | { t: "miss" };

export type ParseErrorCode =
  | "empty"
  | "unclosed-paren"
  | "unclosed-brace"
  | "unexpected-close"
  | "missing-operand"
  | "missing-operator"
  | "unterminated-string"
  | "bad-char"
  | "bad-ref"
  | "bad-array"
  | "unknown-function"
  | "unknown-name"
  | "too-few-args"
  | "too-many-args"
  | "thousands"
  | "too-deep";

export type ParseError = { code: ParseErrorCode; at: number; end: number; text?: string; fn?: string; count?: number };

export type Parsed = {
  ast: Node;
  /** Every reference written in the formula (for dependencies). */
  refs: RefInfo[];
  /** Problems the formula can still be stored with (unknown names, wrong argument counts), first one first. */
  warnings: ParseError[];
  /** Calls a volatile function (TODAY, NOW, RAND…). */
  volatile: boolean;
};

const BIN: Record<string, { l: number; r: number } | undefined> = {
  "=": { l: 1, r: 2 },
  "<>": { l: 1, r: 2 },
  "<": { l: 1, r: 2 },
  ">": { l: 1, r: 2 },
  "<=": { l: 1, r: 2 },
  ">=": { l: 1, r: 2 },
  "&": { l: 3, r: 4 },
  "+": { l: 5, r: 6 },
  "-": { l: 5, r: 6 },
  "*": { l: 7, r: 8 },
  "/": { l: 7, r: 8 },
  "^": { l: 9, r: 10 },
  ":": { l: 15, r: 16 },
};
const UNARY_BP = 11;
const PCT_BP = 13;

class Failure {
  constructor(readonly err: ParseError) {}
}

/** A Pratt parser over the formula's significant tokens (whitespace dropped). */
class Parser {
  private p = 0;
  readonly refs: RefInfo[] = [];
  readonly warnings: ParseError[] = [];
  volatile = false;

  constructor(
    private readonly toks: Tok[],
    private readonly textEnd: number,
    private readonly mode: LexMode,
  ) {}

  fail(code: ParseErrorCode, tok: Tok | undefined, extra?: Partial<ParseError>): never {
    throw new Failure({ code, at: tok ? tok.start : this.textEnd, end: tok ? tok.end : this.textEnd, ...extra });
  }

  peek(): Tok | undefined {
    return this.toks[this.p];
  }

  get done() {
    return this.p >= this.toks.length;
  }

  /** What "," / ";" means here: an argument separator outside { }, a column or row separator inside. */
  sepRole(t: Tok): "arg" | "col" | "row" {
    if (!t.inBrace) return "arg";
    return t.text === ";" ? "row" : "col";
  }

  parseExpr(minBp: number): Node {
    let lhs = this.parsePrefix();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.k === "op" && t.text === "%") {
        if (PCT_BP < minBp) break;
        this.p++;
        lhs = { t: "pct", a: lhs };
        continue;
      }
      if (t.k === "op") {
        const bp = BIN[t.text];
        if (!bp || bp.l < minBp) break;
        this.p++;
        if (!this.peek()) this.fail("missing-operand", t, { text: t.text });
        const rhs = this.parseExpr(bp.r);
        lhs = t.text === ":" ? { t: "range", a: lhs, b: rhs } : { t: "bin", op: t.text as BinOp, a: lhs, b: rhs };
        continue;
      }
      if (t.k === "rp" || t.k === "sep" || t.k === "rb") break;
      // Two operands in a row: "A1 B1", "2 3", "SUMME(A1)B2".
      if (t.ambiguous) this.fail("thousands", t, { text: t.text });
      this.fail(t.k === "bad" ? "bad-char" : "missing-operator", t, { text: t.text });
    }
    return lhs;
  }

  parsePrefix(): Node {
    const t = this.peek();
    const prev = this.toks[this.p - 1];
    if (!t) return this.fail("missing-operand", prev, { text: prev?.text });
    switch (t.k) {
      case "num":
        this.p++;
        return { t: "num", v: t.num ?? 0 };
      case "str":
        if (!t.closed) this.fail("unterminated-string", t);
        this.p++;
        return { t: "str", v: t.str ?? "" };
      case "bool":
        this.p++;
        return { t: "bool", v: !!t.bool };
      case "err":
        this.p++;
        return { t: "err", v: t.err ?? "#REF!" };
      case "ref":
        this.p++;
        this.refs.push(t.ref!);
        return { t: "ref", ref: t.ref! };
      case "op":
        if (t.text === "-" || t.text === "+") {
          this.p++;
          if (!this.peek()) this.fail("missing-operand", t, { text: t.text });
          const a = this.parseExpr(UNARY_BP);
          return t.text === "-" ? { t: "neg", a } : { t: "pos", a };
        }
        return this.fail("missing-operand", prev ?? t, { text: prev?.text ?? t.text });
      case "lp": {
        this.p++;
        if (!this.peek()) this.fail("unclosed-paren", undefined);
        const e = this.parseExpr(0);
        const c = this.peek();
        if (!c) this.fail("unclosed-paren", undefined);
        if (c.k !== "rp") this.fail("missing-operator", c, { text: c.text });
        this.p++;
        return e;
      }
      case "fn":
        return this.parseCall();
      case "lb":
        return this.parseArray();
      case "name":
        this.p++;
        this.warnings.push({ code: "unknown-name", at: t.start, end: t.end, text: t.text });
        return { t: "name", name: t.text, at: t.start };
      case "rp":
        return this.fail(this.p === 0 ? "unexpected-close" : "missing-operand", t, { text: prev?.text });
      case "rb":
        return this.fail("unexpected-close", t, { text: t.text });
      case "sep":
        return this.fail("missing-operand", t, { text: t.text });
      case "bad":
        if (t.ambiguous) return this.fail("thousands", t, { text: t.text });
        if (t.text.startsWith("'") || t.text.endsWith("!")) return this.fail("bad-ref", t, { text: t.text });
        return this.fail("bad-char", t, { text: t.text });
      default:
        return this.fail("bad-char", t, { text: t.text });
    }
  }

  parseCall(): Node {
    const t = this.toks[this.p];
    this.p += 2; // name and "("
    const canonical = t.fn ?? functionFromName(t.upper ?? "", this.mode);
    const def = canonical ? getFunction(canonical) : null;
    if (!def) this.warnings.push({ code: "unknown-function", at: t.start, end: t.end, text: t.text, fn: t.upper });
    if (def?.volatile) this.volatile = true;
    const fnName = canonical ?? t.text;
    const args: Node[] = [];
    if (!this.peek()) this.fail("unclosed-paren", undefined, { fn: fnName });
    if (this.peek()!.k === "rp") {
      this.p++;
    } else {
      for (;;) {
        const c = this.peek();
        if (!c) this.fail("unclosed-paren", undefined, { fn: fnName });
        if ((c.k === "sep" && this.sepRole(c) === "arg") || c.k === "rp") args.push({ t: "miss" });
        else args.push(this.parseExpr(0));
        const d = this.peek();
        if (!d) this.fail("unclosed-paren", undefined, { fn: fnName });
        if (d.k === "sep") {
          this.p++;
          const e = this.peek();
          if (!e) this.fail("unclosed-paren", undefined, { fn: fnName });
          if (e.k === "rp") {
            args.push({ t: "miss" });
            this.p++;
            break;
          }
          continue;
        }
        if (d.k === "rp") {
          this.p++;
          break;
        }
        this.fail("missing-operator", d, { text: d.text });
      }
    }
    if (def) {
      if (args.length < def.min) this.warnings.push({ code: "too-few-args", at: t.start, end: t.end, fn: def.name, count: def.min });
      else if (args.length > def.max) this.warnings.push({ code: "too-many-args", at: t.start, end: t.end, fn: def.name, count: def.max });
    }
    return { t: "call", name: canonical ?? (t.upper ?? t.text.toUpperCase()), fn: def, args, at: t.start };
  }

  parseArray(): Node {
    const open = this.toks[this.p];
    this.p++;
    const rows: Scalar[][] = [[]];
    for (;;) {
      let cur = this.peek();
      if (!cur) this.fail("unclosed-brace", undefined);
      let sign = 1;
      if (cur.k === "op" && (cur.text === "-" || cur.text === "+")) {
        sign = cur.text === "-" ? -1 : 1;
        this.p++;
        cur = this.peek();
        if (!cur) this.fail("unclosed-brace", undefined);
      }
      let v: Scalar;
      if (cur.k === "num") v = sign * (cur.num ?? 0);
      else if (cur.k === "str" && sign === 1) {
        if (!cur.closed) this.fail("unterminated-string", cur);
        v = cur.str ?? "";
      } else if (cur.k === "bool" && sign === 1) v = !!cur.bool;
      else if (cur.k === "err" && sign === 1) v = { error: cur.err ?? "#N/A" };
      else return this.fail("bad-array", cur.k === "rb" ? open : cur, { text: cur.text });
      this.p++;
      rows[rows.length - 1].push(v);
      const s = this.peek();
      if (!s) this.fail("unclosed-brace", undefined);
      if (s.k === "rb") {
        this.p++;
        break;
      }
      if (s.k === "sep") {
        this.p++;
        if (this.sepRole(s) === "row") rows.push([]);
        continue;
      }
      this.fail("bad-array", s, { text: s.text });
    }
    const w = rows[0].length;
    if (rows.some((r) => r.length !== w)) this.fail("bad-array", open, { text: "{" });
    return { t: "arr", v: rows };
  }
}

/** Parse a formula's tokens. `mode` decides what "," ";" "." mean inside { }. */
export function parseTokens(all: Tok[], mode: LexMode): { ok: true; parsed: Parsed } | { ok: false; error: ParseError } {
  const toks: Tok[] = [];
  for (const t of all) if (t.k !== "ws") toks.push(t);
  const textEnd = all.length ? all[all.length - 1].end : 0;
  if (!toks.length) return { ok: false, error: { code: "empty", at: 0, end: 0 } };
  const ps = new Parser(toks, textEnd, mode);
  try {
    const ast = ps.parseExpr(0);
    if (!ps.done) {
      const t = ps.peek()!;
      if (t.k === "rp" || t.k === "rb") ps.fail("unexpected-close", t, { text: t.text });
      ps.fail("missing-operator", t, { text: t.text });
    }
    return { ok: true, parsed: { ast, refs: ps.refs, warnings: ps.warnings, volatile: ps.volatile } };
  } catch (e) {
    if (e instanceof Failure) return { ok: false, error: e.err };
    // Nested beyond what the stack allows (thousands of brackets): a plain error, never a crash.
    return { ok: false, error: { code: "too-deep", at: 0, end: textEnd } };
  }
}

// ----------------------------------------------------------------------------------------------
// Canonical formulas are parsed once and remembered (a sheet often repeats the same formula text).

export type CachedParse = { ok: true; tokens: Tok[]; parsed: Parsed } | { ok: false; tokens: Tok[]; error: ParseError };

const cache = new Map<string, CachedParse>();
const CACHE_LIMIT = 50000;

/** Tokens and tree of a canonical formula (without "="), cached by its text. */
export function parseCanonical(formula: string): CachedParse {
  let c = cache.get(formula);
  if (c) return c;
  const tokens = lex(formula, "canonical");
  const r = parseTokens(tokens, "canonical");
  c = r.ok ? { ok: true, tokens, parsed: r.parsed } : { ok: false, tokens, error: r.error };
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(formula, c);
  return c;
}

const tokCache = new Map<string, Tok[]>();

/** Just the tokens of a canonical formula (cached): for rewriting references. */
export function lexCanonical(formula: string): Tok[] {
  const hit = cache.get(formula);
  if (hit) return hit.tokens;
  let t = tokCache.get(formula);
  if (!t) {
    t = lex(formula, "canonical");
    if (tokCache.size >= CACHE_LIMIT) tokCache.clear();
    tokCache.set(formula, t);
  }
  return t;
}
