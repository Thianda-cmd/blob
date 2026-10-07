import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import { decStr } from "./decimals";

// Polynomials in x for algebraic fractions (level 3): coefficient lists, lowest power first.

export type Poly = number[];

const trim = (p: Poly): Poly => {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
};

export const poly = (...c: number[]): Poly => trim(c);
export const addP = (a: Poly, b: Poly): Poly => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0)));
export const scaleP = (a: Poly, k: number): Poly => trim(a.map((c) => c * k));
export const subP = (a: Poly, b: Poly): Poly => addP(a, scaleP(b, -1));
export function mulP(a: Poly, b: Poly): Poly {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  return trim(out);
}
/** (x + a) */
export const linP = (a: number): Poly => [a, 1];
export const evalP = (p: Poly, x: number) => p.reduce((s, c, i) => s + c * x ** i, 0);
export const sameP = (a: Poly, b: Poly) => trim(a).length === trim(b).length && trim(a).every((c, i) => Math.abs(c - (trim(b)[i] ?? 0)) < 1e-9);

/** Display language: "x^2 - 4x + 4", "-x + 5", "6". */
export function pSrc(p: Poly): string {
  const t = trim(p);
  const items: { c: number; body: string }[] = [];
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i];
    if (c === 0 && !(i === 0 && items.length === 0)) continue;
    const a = Math.abs(c);
    items.push({ c, body: i === 0 ? String(a) : `${a === 1 ? "" : a}${i === 1 ? "x" : `x^${i}`}` });
  }
  // Start with a positive term when there is one: "5 - x" rather than "-x + 5".
  const firstPos = items.findIndex((it) => it.c > 0);
  if (items.length > 1 && items[0].c < 0 && firstPos > 0) items.unshift(...items.splice(firstPos, 1));
  return items.map((it, k) => (k === 0 ? (it.c < 0 ? `-${it.body}` : it.body) : it.c < 0 ? `- ${it.body}` : `+ ${it.body}`)).join(" ");
}

/** For expr answers: "x^2-4x+4". */
export const pExpr = (p: Poly) => pSrc(p).replace(/\s+/g, "");

/** "x + 3", "x - 3" or "x" (a = 0). */
export const lin = (a: number) => (a === 0 ? "x" : a > 0 ? `x + ${a}` : `x - ${-a}`);
/** "(x + 3)", or "x" for a = 0. */
export const par = (a: number) => (a === 0 ? "x" : `(${lin(a)})`);

/** A number with the decimal comma in German. */
export const numL = (v: number, l: Locale) => decStr(v, l);

/** A set of numbers: \{ -3; 3 \} in German, \{ -3, 3 \} in English. Empty: \{ \}. */
export const setSrc = (vals: number[], l: Locale) => (vals.length ? `\\{ ${[...vals].sort((a, b) => a - b).map((v) => numL(v, l)).join(l === "de" ? "; " : ", ")} \\}` : "\\{ \\}");

/** The domain: D = ℚ ∖ \{ … \} (or D = ℚ). */
export const domainSrc = (gaps: number[]): Text => txMap((_, l) => (gaps.length ? `D = ℚ ∖ ${setSrc(gaps, l)}` : "D = ℚ"));

/** The solution set: L = \{ … \}. */
export const solSrc = (vals: number[]): Text => txMap((_, l) => `L = ${setSrc(vals, l)}`);
