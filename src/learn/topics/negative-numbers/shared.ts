"use client";

import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake, RichText } from "@/learn/types";

// ---------------------------------------------------------------------------
// Numbers in the display language and in sentences.

/** Rounded to hide floating point noise (0.1 + 0.2). */
export const r9 = (v: number) => Math.round(v * 1e9) / 1e9;

/** A number for the display language: "-3", "2.5" in English, "2,5" in German. */
export function num(v: number, l: Locale = "en"): string {
  const s = String(r9(v));
  return l === "de" ? s.replace(".", ",") : s;
}

/** A negative number in brackets, as it stands after an operation sign: "(-3)". */
export const par = (v: number, l: Locale = "en") => (v < 0 ? `(${num(v, l)})` : num(v, l));

/** A number with animation keys: sign `<key>s`, digits `<key>`. */
export function kn(v: number, key: string, l: Locale = "en"): string {
  const abs = num(Math.abs(v), l);
  return v < 0 ? `-#${key}s ${abs}#${key}` : `${abs}#${key}`;
}

/** Like `kn`, but kept together, so the minus stays a sign in a row of numbers ("3 \\quad -5"). */
export function gn(v: number, key: string, l: Locale = "en"): string {
  return v < 0 ? `\\group{${kn(v, key, l)}}` : kn(v, key, l);
}

/** Like `kn`, but a negative number gets brackets keyed `<key>b`. */
export function kp(v: number, key: string, l: Locale = "en"): string {
  return v < 0 ? `(${kn(v, key, l)})#${key}b` : kn(v, key, l);
}

/** Text in both languages from one template: `say((t, l) => t("Add", "Addiere") + num(2.5, l))`. */
export const say = (build: (t: (en: string, de: string) => string, l: Locale) => string): Text => txMap(build);

/** Maths that contains decimals: built once per language (decimal comma in German). */
export const dmath = (build: (l: Locale) => string): Text => txMap((_, l) => build(l));

/** "1 step" / "3 steps", "1 Schritt" / "3 Schritte". */
export function stepsOf(v: number, l: Locale): string {
  const one = Math.abs(v) === 1;
  return l === "de" ? `${num(v, l)} ${one ? "Schritt" : "Schritte"}` : `${num(v, l)} ${one ? "step" : "steps"}`;
}

// ---------------------------------------------------------------------------
// Task helpers

/** Picks one of several task makers, each with a weight. */
export function weighted<T>(rng: Rng, list: [number, () => T][]): T {
  const total = list.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, make] of list) {
    r -= w;
    if (r < 0) return make();
  }
  return list[list.length - 1][1]();
}

/** A number answer (exact unless a tolerance is given). */
export function numberAnswer(value: number, unit?: Text): AnswerSpec {
  return { kind: "number", value: r9(value), ...(unit ? { unit } : {}) };
}

/** A typical wrong value and what Blob says about it. Falsy entries are skipped. */
export type Slip = { v: number; title: Text; say: Text; close?: boolean } | null | false | undefined;

/**
 * Typical wrong numbers as mistakes: only values that differ from the right answer and
 * from each other (the first one wins), and only finite ones.
 */
export function numberMistakes(right: number, slips: Slip[], unit?: Text): Mistake[] {
  const seen = [r9(right)];
  const out: Mistake[] = [];
  for (const s of slips) {
    if (!s || !Number.isFinite(s.v)) continue;
    const v = r9(s.v);
    if (seen.some((x) => Math.abs(x - v) < 1e-9)) continue;
    seen.push(v);
    out.push({ when: { kind: "number", value: v, ...(unit ? { unit } : {}) }, title: s.title, say: s.say, ...(s.close ? { close: true } : {}) });
  }
  return out;
}

/** One option of a multiple-choice task; wrong options may carry Blob's feedback. */
export type Opt = { text: RichText; ok?: boolean; title?: Text; say?: Text };

/** A choice answer with its mistakes. Shuffled with `rng`, or in the given order without it. */
export function choiceOf(opts: Opt[], rng?: Rng): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng ? rng.shuffle(opts) : opts;
  const options = order.map((o) => o.text);
  const correct = order.findIndex((o) => o.ok);
  const mistakes: Mistake[] = [];
  order.forEach((o, i) => {
    if (!o.ok && o.say) mistakes.push({ when: { kind: "choice", options, correct: i }, ...(o.title ? { title: o.title } : {}), say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

/** Distinct values from a generator (retries until `n` different ones are found). */
export function distinct(rng: Rng, n: number, make: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; out.length < n && i < 200; i++) {
    const v = make();
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
