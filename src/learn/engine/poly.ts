// Polynomials in several variables, read from a parsed expression. Used to compare a
// student's answer with the right one term by term ("the x-term is missing", "one sign
// is off"), which plain numeric equivalence can't tell.

import type { Ast } from "./expr";

/** A monomial: coefficient and variable powers ({ x: 2, y: 1 } = x²y). */
export type Mono = { c: number; vars: Record<string, number> };
/** Terms by their variable part ("" for the constant, "x^2·y"…). */
export type Poly = Map<string, Mono>;

const EPS = 1e-9;
export const nearly = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

export function monoKey(vars: Record<string, number>): string {
  return Object.keys(vars)
    .filter((v) => vars[v] !== 0)
    .sort()
    .map((v) => (vars[v] === 1 ? v : `${v}^${vars[v]}`))
    .join("·");
}

function add(into: Poly, m: Mono, sign = 1) {
  const key = monoKey(m.vars);
  const prev = into.get(key);
  const c = (prev?.c ?? 0) + sign * m.c;
  if (nearly(c, 0)) into.delete(key);
  else into.set(key, { c, vars: { ...m.vars } });
}

const constant = (c: number): Poly => {
  const p: Poly = new Map();
  if (!nearly(c, 0)) p.set("", { c, vars: {} });
  return p;
};

function sum(a: Poly, b: Poly, sign = 1): Poly {
  const out: Poly = new Map();
  for (const m of a.values()) add(out, m);
  for (const m of b.values()) add(out, m, sign);
  return out;
}

function product(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const x of a.values())
    for (const y of b.values()) {
      const vars = { ...x.vars };
      for (const [v, e] of Object.entries(y.vars)) vars[v] = (vars[v] ?? 0) + e;
      add(out, { c: x.c * y.c, vars });
    }
  return out;
}

const constantOf = (p: Poly): number | null => {
  if (p.size === 0) return 0;
  if (p.size === 1 && p.has("")) return p.get("")!.c;
  return null;
};

/** The expression as a polynomial, or null when it isn't one (letters under roots, in denominators…). */
export function toPoly(ast: Ast): Poly | null {
  switch (ast.t) {
    case "num":
      return constant(ast.v);
    case "var":
      return new Map([[ast.name, { c: 1, vars: { [ast.name]: 1 } }]]);
    case "neg": {
      const e = toPoly(ast.e);
      return e && sum(new Map(), e, -1);
    }
    case "add":
    case "sub": {
      const l = toPoly(ast.l);
      const r = toPoly(ast.r);
      return l && r && sum(l, r, ast.t === "add" ? 1 : -1);
    }
    case "mul": {
      const l = toPoly(ast.l);
      const r = toPoly(ast.r);
      return l && r && product(l, r);
    }
    case "div": {
      const l = toPoly(ast.l);
      const r = toPoly(ast.r);
      const k = r && constantOf(r);
      if (!l || k === null || k === undefined || nearly(k, 0)) return null;
      const out: Poly = new Map();
      for (const m of l.values()) add(out, { c: m.c / k, vars: m.vars });
      return out;
    }
    case "pow": {
      const b = toPoly(ast.b);
      const e = toPoly(ast.e);
      const n = e && constantOf(e);
      if (!b || n === null || n === undefined || !Number.isInteger(n) || n < 0 || n > 8) return null;
      let out = constant(1);
      for (let i = 0; i < n; i++) out = product(out, b);
      return out;
    }
    case "sqrt": {
      const e = toPoly(ast.e);
      const k = e && constantOf(e);
      return k === null || k === undefined || k < 0 ? null : constant(Math.sqrt(k));
    }
  }
}

/** a − b. */
export const difference = (a: Poly, b: Poly) => sum(a, b, -1);

/** Display-language source for a monomial: "3x^2y", "-5", "x". */
export function monoSrc(m: Mono, opts: { signed?: boolean } = {}): string {
  const vars = Object.keys(m.vars)
    .filter((v) => m.vars[v] !== 0)
    .sort()
    .map((v) => (m.vars[v] === 1 ? v : `${v}^${m.vars[v]}`))
    .join("");
  const abs = Math.abs(m.c);
  const num = Math.round(abs * 1e6) / 1e6;
  const coef = vars && nearly(abs, 1) ? "" : String(num).replace(".", ",");
  const sign = m.c < 0 ? "-" : opts.signed ? "+" : "";
  return `${sign}${coef}${vars}`;
}

/** "the x-term" style name for a variable part ("" → the number on its own). */
export function varPart(key: string): string {
  return key.replace(/·/g, "");
}
