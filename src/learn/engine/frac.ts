import { gcd } from "./rng";

/** Exact rational numbers for generating clean exercises and solutions. */
export type Frac = { n: number; d: number };

export function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error("Division by zero");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

export const add = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
export const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n);
export const neg = (a: Frac) => frac(-a.n, a.d);
export const value = (a: Frac) => a.n / a.d;
export const isInt = (a: Frac) => a.d === 1;
export const eq = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;

/** Display-language string: "3", "-2" or "\frac{3}{4}" (sign in front). */
export function show(a: Frac): string {
  if (a.d === 1) return String(a.n);
  const body = `\\frac{${Math.abs(a.n)}}{${a.d}}`;
  return a.n < 0 ? `-${body}` : body;
}

/** Plain text for answers and comparisons: "3/4". */
export function plain(a: Frac): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`;
}
