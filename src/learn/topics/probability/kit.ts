// Shared helpers for the probability topic: bilingual number formatting, exact fractions,
// answer specs with tolerances and typical-mistake lists that never contain the right answer.

import type { ComponentType } from "react";
import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import { frac, type Frac } from "@/learn/engine/frac";
import type { AnswerSpec, Mistake } from "@/learn/types";

export const visual = (component: unknown, props: Record<string, unknown>) => ({
  component: component as ComponentType<Record<string, unknown>>,
  props,
});

/** Rounds to `d` decimal places and drops trailing zeros: 0.3750 → "0.375". */
export const round = (v: number, d = 6) => Number((Math.round(v * 10 ** d) / 10 ** d).toFixed(d));
const plainNum = (v: number, d = 6) => String(round(v, d));

/** Number formatting and wording for one language: decimal comma in German. */
export type Fmt = {
  /** Picks the English or the German wording. */
  t: (en: string, de: string) => string;
  l: Locale;
  /** A decimal number: 0.36 → "0,36" (de). */
  n: (v: number, digits?: number) => string;
  /** A probability as a percentage number without the sign: 0.375 → "37,5". */
  pc: (v: number, digits?: number) => string;
  /** Euros: always two decimals when not whole: 1.5 → "1,50". */
  eur: (v: number) => string;
};

export function fmt(t: Fmt["t"], l: Locale): Fmt {
  const comma = (s: string) => (l === "de" ? s.replace(".", ",") : s);
  return {
    t,
    l,
    n: (v, d = 6) => comma(plainNum(v, d)),
    pc: (v, d = 1) => comma(plainNum(v * 100, d)),
    eur: (v) => {
      const r = round(v, 2);
      return comma(Number.isInteger(r) ? String(r) : r.toFixed(2));
    },
  };
}

/** Builds a text in both languages from one template: say((f) => f.t(`${f.n(0.5)} …`, `${f.n(0.5)} …`)). */
export const say = (build: (f: Fmt) => string): Text => txMap((t, l) => build(fmt(t, l)));

/** Display-language fraction, reduced or not: "\frac{3}{6}". */
export const fr = (n: number, d: number) => `\\frac{${n}}{${d}}`;
/** A reduced fraction as display language: 1 → "1", 0 → "0", 2/6 → "\frac{1}{3}". */
export const frS = (q: Frac) => (q.d === 1 ? String(q.n) : fr(q.n, q.d));
/** "\frac{2}{6} = \frac{1}{3}" or just "\frac{3}{7}" when nothing reduces. */
export const frChain = (n: number, d: number) => {
  const q = frac(n, d);
  return q.n === n && q.d === d ? fr(n, d) : `${fr(n, d)} = ${frS(q)}`;
};

export const C = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};

// ---------------------------------------------------------------------------
// Answers

/** A fraction answer (any equivalent fraction counts). */
export const fracAnswer = (q: Frac): AnswerSpec => ({ kind: "fraction", n: q.n, d: q.d });

/** A number answer that accepts anything within `abs` of the value. */
export function numAnswer(value: number, abs = 1e-6, unit?: Text): AnswerSpec {
  return { kind: "number", value: round(value, 8), tolerance: abs / Math.max(1, Math.abs(value)), ...(unit !== undefined ? { unit } : {}) };
}

type Candidate<V> = { v: V | null | undefined; title: Text; say: Text; close?: boolean };

/** Fraction mistakes: drops the right value, repeats, invalid fractions and values outside 0 … 2. */
export function fracMistakes(right: Frac, list: Candidate<Frac>[]): Mistake[] {
  const out: Mistake[] = [];
  const seen: number[] = [right.n / right.d];
  for (const c of list) {
    if (!c.v || c.v.d <= 0 || c.v.n < 0) continue;
    const q = frac(c.v.n, c.v.d);
    const v = q.n / q.d;
    if (v > 2 || seen.some((s) => Math.abs(s - v) < 1e-9)) continue;
    seen.push(v);
    out.push({ when: { kind: "fraction", n: q.n, d: q.d }, title: c.title, say: c.say, ...(c.close ? { close: true } : {}) });
  }
  return out;
}

/**
 * Number mistakes: each matches within `abs` (like the answer), and is dropped when it is
 * too close to the right value or to an earlier mistake.
 */
export function numMistakes(right: number, abs: number, list: Candidate<number>[], unit?: Text): Mistake[] {
  const out: Mistake[] = [];
  const seen: number[] = [right];
  for (const c of list) {
    if (c.v == null || !Number.isFinite(c.v)) continue;
    const v = round(c.v, 8);
    if (seen.some((s) => Math.abs(s - v) <= 2.5 * abs + 1e-9)) continue;
    seen.push(v);
    out.push({ when: numAnswer(v, abs, unit), title: c.title, say: c.say, ...(c.close ? { close: true } : {}) });
  }
  return out;
}

/** Choice mistakes: the tempting wrong options, each with Blob's message. */
export function choiceMistakes(options: Text[], correct: number, list: { i: number; title: Text; say: Text }[]): Mistake[] {
  return list.filter((c) => c.i >= 0 && c.i !== correct).map((c) => ({ when: { kind: "choice", options, correct: c.i }, title: c.title, say: c.say }));
}

/** Shuffles options with the rng and returns them with the new index of the right one. */
export function shuffled<T>(shuffle: <U>(items: readonly U[]) => U[], items: T[], correct: number) {
  const order = shuffle(items.map((_, i) => i));
  return { options: order.map((i) => items[i]), correct: order.indexOf(correct), at: (i: number) => order.indexOf(i) };
}
