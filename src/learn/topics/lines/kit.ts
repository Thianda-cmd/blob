import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import type { AnswerSpec } from "@/learn/types";

// Small helpers shared by the levels of the lines topic: numbers in both languages
// (decimal comma in German, point in English) and rounded answers.

export const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** A number for maths in one language: "2.5" / "2,5", rounded to `digits` places when given. */
export function numIn(v: number, l: Locale, digits?: number): string {
  let s = digits === undefined ? String(r6(v)) : v.toFixed(digits);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return l === "de" ? s.replace(".", ",") : s;
}

/** Number helpers handed to `say`: n(v) for exact values, n(v, 2) rounded. */
export type Say = {
  t: (en: string, de: string) => string;
  n: (v: number, digits?: number) => string;
  l: Locale;
};

/** Builds a text in both languages from one template, with the right decimal mark. */
export const say = (build: (s: Say) => string): Text => txMap((t, l) => build({ t, l, n: (v, d) => numIn(v, l, d) }));

/** A rounded number answer: accepts the value rounded to `digits` places (and the exact value). */
export function rounded(v: number, digits: number, extra: Partial<Extract<AnswerSpec, { kind: "number" }>> = {}): Extract<AnswerSpec, { kind: "number" }> {
  const value = Number(v.toFixed(digits));
  const abs = 0.6 * 10 ** -digits;
  return { kind: "number", value, tolerance: abs / Math.max(1, Math.abs(value)), ...extra };
}

/** Degrees ↔ radians, and the angles students meet. */
export const DEG = 180 / Math.PI;
/** The slope angle in degrees (−90° < α < 90°), as tan⁻¹ on a calculator in DEG mode. */
export const atanDeg = (m: number) => Math.atan(m) * DEG;
