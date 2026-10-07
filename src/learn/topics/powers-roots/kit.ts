// Shared helpers for the three powers-and-roots levels: numbers with stable animation keys, bilingual
// number formatting and the typical-mistake collector.

import type { Locale } from "@/i18n/config";
import { resolveText, txMap, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Frame, Mistake } from "@/learn/types";

// ---------------------------------------------------------------------------
// Numbers and keyed tokens

/** The language `dec` writes numbers for (see `bilingual`); German by default. */
let current: Locale = "de";

/** "3,6", "-0,5", "12": decimal comma in German, point in English (inside `bilingual`). */
export function dec(v: number): string {
  const s = String(Math.round(v * 1e9) / 1e9);
  return current === "de" ? s.replace(".", ",") : s;
}

/** The decimal separator of the language `dec` writes for. */
export const sep = () => (current === "de" ? "," : ".");

/** Merges the English run and the German run of a builder: differing strings become bilingual. */
function mergeRuns(en: unknown, de: unknown): unknown {
  if (typeof en === "string" && typeof de === "string") return en === de ? en : { en, de };
  if (Array.isArray(en) && Array.isArray(de)) return en.map((v, i) => mergeRuns(v, de[i]));
  if (en && de && typeof en === "object" && typeof de === "object") {
    const a = en as Record<string, unknown>;
    const b = de as Record<string, unknown>;
    const keys = Object.keys(a);
    if (keys.length === 2 && "en" in a && "de" in a && typeof a.en === "string") return { en: a.en, de: b.de };
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = mergeRuns(a[k], b[k]);
    return out;
  }
  return en;
}

/**
 * Runs a deterministic builder (no rng inside!) once per language, so every number written with
 * `dec` gets a decimal point in English and a decimal comma in German, and merges both results.
 */
export function bilingual<T>(build: () => T): T {
  const prev = current;
  try {
    current = "en";
    const en = build();
    current = "de";
    const de = build();
    return mergeRuns(en, de) as T;
  } finally {
    current = prev;
  }
}

/** A number on its own, keyed: "5#k" or "-#ks 2#k". */
export function num(n: number, k: string): string {
  return n < 0 ? `-#${k}s ${dec(-n)}#${k}` : `${dec(n)}#${k}`;
}

/** A number inside a sum or product, keyed; negative ones get brackets. */
export function inner(n: number, k: string): string {
  return n < 0 ? `(-#${k}s ${dec(-n)}#${k})#${k}b` : `${dec(n)}#${k}`;
}

/** Plain number for notes, in brackets when negative: "(-2)". */
export const par = (n: number) => (n < 0 ? `(${dec(n)})` : dec(n));

/** Plain power: "x", "x^{5}", "x^{-2}". */
export const pp = (base: string | number, e: number) => (e === 1 ? `${base}` : `${base}^{${e}}`);

/** Keyed power with base key `b` and exponent key `ek`. A lone base hides its 1 unless `showOne`. */
export function kp(base: string | number, b: string, e: number, ek: string, showOne = false): string {
  return e === 1 && !showOne ? `${base}#${b}` : `${base}#${b}^{${num(e, ek)}}`;
}

/** Digits grouped in threes with thin spaces: "36\,000\,000". The first group gets key `k`. */
export function grouped(digits: string, k?: string): string {
  if (digits.length < 5) return k ? `${digits}#${k}` : digits;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
  return groups.map((g, i) => (i === 0 && k ? `${g}#${k}` : g)).join(" \\,");
}

export function largestSquareRoot(n: number): number {
  for (let k = Math.floor(Math.sqrt(n)); k >= 1; k--) if (n % (k * k) === 0) return k;
  return 1;
}

export const gcdInt = (a: number, b: number): number => (b ? gcdInt(b, a % b) : Math.abs(a));

/** Rounds away floating-point noise: 0.1 + 0.2 → 0.3. */
export const clean = (v: number) => Math.round(v * 1e9) / 1e9;

// ---------------------------------------------------------------------------
// Bilingual pieces

/** Joins bilingual pieces, language by language. */
export const cat = (...parts: (Text | undefined)[]): Text => txMap((_, locale) => parts.map((part) => resolveText(part, locale)).join(""));

/** A number for one language: decimal point in English, decimal comma in German. */
export const decL = (v: number, l: Locale) => (l === "de" ? dec(v) : String(clean(v)));

/** Number formatting and wording for one language. */
export type Lang = {
  /** Picks the English or the German wording. */
  t: (en: string, de: string) => string;
  l: Locale;
  /** A number with the decimal separator of this language. */
  n: (v: number) => string;
  /** Separator between listed numbers: "," in English, ";" in German (the comma is the decimal comma). */
  sep: string;
};

const LANGS: Record<Locale, Lang> = {
  en: { t: (en) => en, l: "en", n: (v) => decL(v, "en"), sep: "," },
  de: { t: (_, de) => de, l: "de", n: (v) => decL(v, "de"), sep: ";" },
};

/** Builds a text in both languages from one template (numbers get the right decimal separator). */
export const say = (build: (L: Lang) => string): Text => ({ en: build(LANGS.en), de: build(LANGS.de) });

/** The same text in both languages unless it differs: plain maths stays a plain string. */
export function maths(build: (L: Lang) => string): Text {
  const en = build(LANGS.en);
  const de = build(LANGS.de);
  return en === de ? en : { en, de };
}

/** Frames built once per language and zipped together (decimal point in English, comma in German). */
export function framesIn(build: (L: Lang) => Frame[]): Frame[] {
  const en = build(LANGS.en);
  const de = build(LANGS.de);
  return en.map((f, i) => {
    const g = de[i];
    const m = resolveText(f.math, "en");
    const mde = resolveText(g.math, "de");
    const frame: Frame = { math: m === mde ? m : { en: m, de: mde } };
    if (f.note !== undefined) frame.note = { en: resolveText(f.note, "en"), de: resolveText(g.note, "de") };
    if (f.highlight) frame.highlight = f.highlight;
    if (f.arrows) frame.arrows = f.arrows;
    return frame;
  });
}

/** A whole number with thin-space groups for the display language: 4\,000\,000. */
export const big = (v: number) => grouped(String(v));

// ---------------------------------------------------------------------------
// Typical mistakes, simulated from the task's numbers: each wrong answer is
// exactly what a student with that misconception gets. A mistake is only kept
// when it differs from the right answer and from the ones before it.

const sameValue = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function sameAnswer(a: AnswerSpec, b: AnswerSpec): boolean {
  if (a.kind === "number" && b.kind === "number") {
    const tol = Math.max(1e-6, a.tolerance ?? 0, b.tolerance ?? 0);
    return Math.abs(a.value - b.value) <= tol * Math.max(1, Math.abs(a.value), Math.abs(b.value)) * 2 || sameValue(a.value, b.value, 1e-6);
  }
  if (a.kind === "fraction" && b.kind === "fraction") return sameValue(a.n / a.d, b.n / b.d, 1e-9);
  if (a.kind === "pair" && b.kind === "pair") return a.values.every((v, i) => sameValue(v, b.values[i], 1e-4));
  if (a.kind === "choice" && b.kind === "choice") return a.correct === b.correct;
  return false;
}

/** A value a student could actually type: finite, not absurdly big or tiny. */
const typeable = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e7 && (v === 0 || Math.abs(v) >= 1e-6);

function usable(s: AnswerSpec): boolean {
  if (s.kind === "number") return typeable(s.value);
  if (s.kind === "fraction") return Number.isInteger(s.n) && Number.isInteger(s.d) && s.d !== 0 && Math.abs(s.n) < 1e7 && Math.abs(s.d) < 1e7;
  if (s.kind === "pair") return s.values.every(typeable);
  if (s.kind === "choice") return s.correct >= 0 && s.correct < s.options.length;
  return false;
}

/** `close`: a near miss (a sign, a count, not finished yet): Blob looks thoughtful instead of worried. */
export type AddMistake = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => void;

/** The typical mistakes for one answer, in the order given (first match wins). */
export function collect(right: AnswerSpec, fill: (add: AddMistake) => void): Mistake[] {
  const list: Mistake[] = [];
  fill((when, title, say, close) => {
    if (list.length >= 5 || !usable(when) || sameAnswer(when, right) || list.some((m) => sameAnswer(m.when, when))) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  });
  return list;
}

export const asNum = (value: number): AnswerSpec => ({ kind: "number", value });
export const asFrac = (n: number, d: number): AnswerSpec => ({ kind: "fraction", n, d });
export const pairOf =
  (names: [string, string]) =>
  (a: number, b: number): AnswerSpec => ({ kind: "pair", names, values: [a, b] });

/** A choice task: the first option is right; the others are shuffled in and can carry a typical mistake. */
export type Opt = { text: Text; title?: Text; say?: Text };

export function choice(rng: Rng | null, opts: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

/** Picks one of several task builders by weight; a builder may return null (retried). */
export function weighted<T>(rng: Rng, items: [number, () => T | null][], fallback: () => T): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  for (let tries = 0; tries < 60; tries++) {
    let r = rng.next() * total;
    const f = items.find(([w]) => (r -= w) < 0)?.[1] ?? items[items.length - 1][1];
    const out = f();
    if (out) return out;
  }
  return fallback();
}

