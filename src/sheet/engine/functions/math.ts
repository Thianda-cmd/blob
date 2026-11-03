// Mathematik: SUMME, RUNDEN, REST, WURZEL… with Excel's rules (ROUND rounds half away from zero
// on the decimal value, so RUNDEN(2,675; 2) = 2,68 like in Excel).

import { ERR, isErr, isMatrix, isRef, type CellError, type Matrix, type Scalar, type Value } from "../values";
import { factorial } from "./distributions";
import type { Ctx, FnDef } from "./types";
import { asMatrix, collectNumbers, first, numFn, numResult, sum, toInt, toNum } from "./util";

/** x rounded to 15 significant digits: drops binary noise (0.1 × 3 = 0.30000000000000004 → 0.3). */
export const clean15 = (x: number) => (Number.isFinite(x) && x !== 0 ? Number(x.toPrecision(15)) : x);

/** x × 10^k exactly in decimal (via the 15-digit text, so 2.675 × 100 = 267.5, not 267.49999999999997). */
function scale10(x: number, k: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const s = x.toPrecision(15);
  const e = s.indexOf("e");
  const mant = e < 0 ? s : s.slice(0, e);
  const exp = e < 0 ? 0 : Number(s.slice(e + 1));
  return Number(`${mant}e${exp + k}`);
}

/** Excel's ROUND / ROUNDUP / ROUNDDOWN on the decimal value. */
export function roundExcel(x: number, digits: number, mode: "half" | "up" | "down"): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  const d = Math.trunc(digits);
  if (d > 15) return x;
  const sign = x < 0 ? -1 : 1;
  const shifted = scale10(Math.abs(x), d);
  const r = mode === "half" ? Math.floor(shifted + 0.5) : mode === "up" ? Math.ceil(shifted) : Math.floor(shifted);
  const out = sign * scale10(r, -d);
  return out === 0 ? 0 : out;
}

/** n / step rounded to a whole number when it is one within binary noise (0.6 / 0.2 = 2.9999999999999996 → 3). */
function quotient(n: number, step: number): number {
  const q = n / step;
  const r = Math.round(q);
  return Math.abs(q - r) <= 1e-12 * Math.max(1, Math.abs(q)) ? r : q;
}

function gcd2(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

function sumProduct(args: Value[], ctx: Ctx): number | CellError {
  const mats: Matrix[] = [];
  for (const a of args) {
    const m = asMatrix(isRef(a) ? ctx.deref(a) : (a as Scalar | Matrix));
    if (mats.length && (m.length !== mats[0].length || m[0].length !== mats[0][0].length)) return ERR.value;
    mats.push(m);
  }
  if (!mats.length) return ERR.value;
  const rows = mats[0].length;
  const cols = mats[0][0].length;
  const terms: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let p = 1;
      for (const m of mats) {
        const v = m[i][j];
        if (isErr(v)) return v;
        p *= typeof v === "number" ? v : 0;
      }
      terms.push(p);
    }
  }
  return sum(terms);
}

export const MATH: FnDef[] = [
  {
    name: "SUM",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      return isErr(xs) ? xs : numResult(sum(xs));
    },
  },
  {
    name: "SUMSQ",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      return isErr(xs) ? xs : numResult(sum(xs.map((x) => x * x)));
    },
  },
  {
    name: "PRODUCT",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      if (isErr(xs)) return xs;
      if (!xs.length) return 0;
      return numResult(xs.reduce((p, x) => p * x, 1));
    },
  },
  { name: "SUMPRODUCT", min: 1, max: 255, args: "v", impl: (args, ctx) => sumProduct(args, ctx) },
  numFn("ROUND", 2, 2, ([x, d]) => roundExcel(x, d, "half")),
  numFn("ROUNDUP", 2, 2, ([x, d]) => roundExcel(x, d, "up")),
  numFn("ROUNDDOWN", 2, 2, ([x, d]) => roundExcel(x, d, "down")),
  numFn("TRUNC", 1, 2, ([x, d]) => roundExcel(x, d ?? 0, "down")),
  numFn("INT", 1, 1, ([x]) => Math.floor(x)),
  numFn("MROUND", 2, 2, ([n, m]) => {
    if (m === 0 || n === 0) return 0;
    if (Math.sign(n) !== Math.sign(m)) return ERR.num;
    const q = quotient(n, m);
    return clean15(Math.sign(q) * Math.floor(Math.abs(clean15(q)) + 0.5) * m);
  }),
  numFn("CEILING", 2, 2, ([n, s]) => {
    if (n === 0 || s === 0) return 0;
    if (n > 0 && s < 0) return ERR.num;
    if (s < 0) return clean15(-Math.ceil(quotient(-n, -s)) * -s);
    return clean15(Math.ceil(quotient(n, s)) * s);
  }),
  numFn("FLOOR", 2, 2, ([n, s]) => {
    if (n === 0) return 0;
    if (s === 0) return ERR.div0;
    if (n > 0 && s < 0) return ERR.num;
    if (s < 0) return clean15(-Math.floor(quotient(-n, -s)) * -s);
    return clean15(Math.floor(quotient(n, s)) * s);
  }),
  numFn("EVEN", 1, 1, ([x]) => {
    const v = Math.ceil(clean15(Math.abs(x)) / 2) * 2;
    return x < 0 ? -v : v;
  }),
  numFn("ODD", 1, 1, ([x]) => {
    let v = Math.ceil(clean15(Math.abs(x)));
    if (v % 2 === 0) v += 1;
    return x < 0 ? -v : v;
  }),
  numFn("ABS", 1, 1, ([x]) => Math.abs(x)),
  numFn("SIGN", 1, 1, ([x]) => (x > 0 ? 1 : x < 0 ? -1 : 0)),
  numFn("SQRT", 1, 1, ([x]) => (x < 0 ? ERR.num : Math.sqrt(x))),
  numFn("POWER", 2, 2, ([b, e]) => power(b, e)),
  numFn("EXP", 1, 1, ([x]) => Math.exp(x)),
  numFn("LN", 1, 1, ([x]) => (x <= 0 ? ERR.num : Math.log(x))),
  numFn("LOG10", 1, 1, ([x]) => (x <= 0 ? ERR.num : Math.log10(x))),
  numFn("LOG", 1, 2, ([x, base]) => {
    const b = base ?? 10;
    if (x <= 0 || b <= 0) return ERR.num;
    if (b === 1) return ERR.div0;
    return b === 10 ? Math.log10(x) : Math.log(x) / Math.log(b);
  }),
  numFn("PI", 0, 0, () => Math.PI),
  numFn("MOD", 2, 2, ([n, d]) => {
    if (d === 0) return ERR.div0;
    const q = quotient(n, d);
    const r = n - d * Math.floor(clean15(q));
    // Within rounding noise of 0 (or of d) is 0: MOD(0,3; 0,1) = 0.
    if (Math.abs(r) <= 1e-12 * Math.abs(d) || Math.abs(r - d) <= 1e-12 * Math.abs(d)) return 0;
    return clean15(r);
  }),
  numFn("QUOTIENT", 2, 2, ([n, d]) => (d === 0 ? ERR.div0 : Math.trunc(quotient(n, d)))),
  {
    name: "GCD",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      if (isErr(xs)) return xs;
      let g = 0;
      for (const x of xs) {
        if (x < 0) return ERR.num;
        g = gcd2(g, Math.trunc(x));
      }
      return g;
    },
  },
  {
    name: "LCM",
    min: 1,
    max: 255,
    args: "r",
    impl: (args, ctx) => {
      const xs = collectNumbers(args, ctx);
      if (isErr(xs)) return xs;
      let l = 1;
      for (const x0 of xs) {
        const x = Math.trunc(x0);
        if (x < 0) return ERR.num;
        if (x === 0) return 0;
        l = (l / gcd2(l, x)) * x;
      }
      return numResult(l);
    },
  },
  numFn("FACT", 1, 1, ([x]) => (x < 0 ? ERR.num : factorial(Math.trunc(x)))),
  numFn("COMBIN", 2, 2, ([n0, k0]) => {
    const n = Math.trunc(n0);
    const k = Math.trunc(k0);
    if (n < 0 || k < 0 || n < k) return ERR.num;
    let r = 1;
    const kk = Math.min(k, n - k);
    for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
    return r > 1e15 ? r : Math.round(r);
  }),
  { name: "RAND", min: 0, max: 0, args: "s", volatile: true, impl: () => Math.random() },
  {
    name: "RANDBETWEEN",
    min: 2,
    max: 2,
    args: "s",
    volatile: true,
    impl: ([a, b], ctx) => {
      const lo = toNum(a as Scalar, ctx);
      if (typeof lo !== "number") return lo;
      const hi = toNum(b as Scalar, ctx);
      if (typeof hi !== "number") return hi;
      const l = Math.ceil(lo);
      const h = Math.floor(hi);
      if (l > h) return ERR.num;
      return l + Math.floor(Math.random() * (h - l + 1));
    },
  },
  numFn("DEGREES", 1, 1, ([x]) => (x * 180) / Math.PI),
  numFn("RADIANS", 1, 1, ([x]) => (x * Math.PI) / 180),
  numFn("SIN", 1, 1, ([x]) => Math.sin(x)),
  numFn("COS", 1, 1, ([x]) => Math.cos(x)),
  numFn("TAN", 1, 1, ([x]) => Math.tan(x)),
  numFn("ASIN", 1, 1, ([x]) => (Math.abs(x) > 1 ? ERR.num : Math.asin(x))),
  numFn("ACOS", 1, 1, ([x]) => (Math.abs(x) > 1 ? ERR.num : Math.acos(x))),
  numFn("ATAN", 1, 1, ([x]) => Math.atan(x)),
  numFn("ATAN2", 2, 2, ([x, y]) => (x === 0 && y === 0 ? ERR.div0 : Math.atan2(y, x))),
];

/** base^exp with Excel's errors: 0^0 #NUM!, 0^−1 #DIV/0!, (−8)^(1/3) #NUM!. */
export function power(b: number, e: number): number | CellError {
  if (b === 0 && e === 0) return ERR.num;
  if (b === 0 && e < 0) return ERR.div0;
  const r = Math.pow(b, e);
  if (Number.isNaN(r)) return ERR.num;
  if (!Number.isFinite(r)) return ERR.num;
  return r;
}

/** Shared by SUBTOTAL and the totals row: Excel's numbered functions (1 AVERAGE … 11 VARP). */
export function subtotalOf(code: number, values: Scalar[]): number | CellError {
  const nums: number[] = [];
  let counta = 0;
  for (const v of values) {
    if (isErr(v)) {
      if (code !== 2 && code !== 3) return v;
      counta++;
      continue;
    }
    if (v !== null) counta++;
    if (typeof v === "number") nums.push(v);
  }
  const n = nums.length;
  switch (code) {
    case 1:
      return n ? numResult(sum(nums) / n) : ERR.div0;
    case 2:
      return n;
    case 3:
      return counta;
    case 4:
      return n ? Math.max(...nums) : 0;
    case 5:
      return n ? Math.min(...nums) : 0;
    case 6:
      return n ? numResult(nums.reduce((p, x) => p * x, 1)) : 0;
    case 7:
    case 8:
    case 10:
    case 11: {
      const sample = code === 7 || code === 10;
      if (n < (sample ? 2 : 1)) return ERR.div0;
      const m = sum(nums) / n;
      let ss = 0;
      for (const x of nums) ss += (x - m) * (x - m);
      const variance = ss / (sample ? n - 1 : n);
      return numResult(code === 7 || code === 8 ? Math.sqrt(variance) : variance);
    }
    case 9:
      return numResult(sum(nums));
  }
  return ERR.value;
}

/** SUBTOTAL(function_num; ref1; …): 1–11 skip rows hidden by a filter, 101–111 skip every hidden row; other SUBTOTALs inside are skipped. */
export const SUBTOTAL: FnDef = {
  name: "SUBTOTAL",
  min: 2,
  max: 255,
  args: "r",
  impl: (args, ctx) => {
    const codeV = args[0];
    const c = toInt(first(isRef(codeV) ? ctx.deref(codeV) : codeV), ctx);
    if (typeof c !== "number") return c;
    const base = c > 100 ? c - 100 : c;
    if (base < 1 || base > 11 || (c > 11 && c < 101) || c > 111) return ERR.value;
    const skipManual = c > 100;
    const values: Scalar[] = [];
    for (const a of args.slice(1)) {
      if (isRef(a)) {
        const r = ctx.clip(a);
        for (let row = r.r0; row <= r.r1; row++) {
          const h = ctx.rowHidden(r.sheet, row);
          if (h.filtered || (skipManual && h.manual)) continue;
          for (let col = r.c0; col <= r.c1; col++) {
            const f = ctx.formula(r.sheet, row, col);
            if (f && /SUBTOTAL\s*\(/i.test(f)) continue;
            values.push(ctx.cell(r.sheet, row, col));
          }
        }
      } else if (isMatrix(a)) {
        for (const row of a) for (const v of row) values.push(v);
      } else {
        if (isErr(a)) return a;
        const n = toNum(a, ctx);
        if (typeof n !== "number") return n;
        values.push(n);
      }
    }
    return subtotalOf(base, values);
  },
};

MATH.push(SUBTOTAL);
