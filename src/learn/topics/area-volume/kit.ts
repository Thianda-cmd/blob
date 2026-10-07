// Small helpers for the area-volume levels: numbers in both languages, number answers with
// rounding, typical-mistake lists, choice and match tasks.

import type { Locale } from "@/i18n/config";
import { txMap, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake } from "@/learn/types";

export const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
export const roundTo = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Plain digits with a decimal comma in German: "2,5" / "2.5". */
export const plainNum = (v: number, l: Locale) => {
  const s = String(r6(v));
  return l === "de" ? s.replace(".", ",") : s;
};

/** Number formatting for one language. */
export type Fmt = {
  /** Picks the English or the German wording. */
  t: (en: string, de: string) => string;
  l: Locale;
  /** A number in maths ($…$ and frames): "2,5", big numbers with thin spaces "35\,000". */
  n: (v: number) => string;
  /** A number in a sentence: "2,5", "35.000" (German) / "35,000" (English). */
  w: (v: number) => string;
  /** A number rounded to `d` decimals, trailing zeros kept: "78,54". */
  d: (v: number, d: number) => string;
};

function group(s: string, sep: string) {
  const [int, frac] = s.split(".");
  if (int.replace("-", "").length < 5) return s;
  const g = int.replace(/\B(?=(\d{3})+$)/g, sep);
  return frac ? `${g}.${frac}` : g;
}

export function fmt(t: Fmt["t"], l: Locale): Fmt {
  const comma = (s: string) => (l === "de" ? s.replace(".", ",") : s);
  return {
    t,
    l,
    n: (v) => comma(group(String(r6(v)), "\\,")),
    w: (v) => {
      const s = String(r6(v));
      const [int] = s.split(".");
      if (int.replace("-", "").length < 5) return comma(s);
      return l === "de" ? group(s, ".").replace(/\.(\d+)$/, (m, f) => (m.length <= 3 ? `,${f}` : m)) : group(s, ",");
    },
    d: (v, d) => comma(v.toFixed(d)),
  };
}

/** Builds a text in both languages from one template function. */
export const say = (build: (f: Fmt) => string): Text => txMap((t, l) => build(fmt(t, l)));

/** An exact number answer. */
export function exact(value: number, unit?: string, label?: string): AnswerSpec {
  return { kind: "number", value: r6(value), ...(unit ? { unit } : {}), ...(label ? { label } : {}) };
}

/**
 * A number answer rounded to `digits` decimals. Also accepts answers computed with π ≈ 3,14 or
 * rounded a little differently (0,2 % or half a unit in the last place, whichever is bigger).
 */
export function rounded(value: number, digits: number, unit?: string, label?: string): AnswerSpec {
  const v = roundTo(value, digits);
  const abs = Math.max(0.6 * 10 ** -digits, 0.002 * Math.abs(value));
  return { kind: "number", value: v, tolerance: abs / Math.max(1, Math.abs(v)), ...(unit ? { unit } : {}), ...(label ? { label } : {}) };
}

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "choice":
      return { kind: "choice", index: a.correct };
    default:
      return null;
  }
}

/**
 * Typical mistakes for number answers: `add(value, title, say)` keeps a mistake only when it
 * differs from the right answer and from the mistakes already in the list. Pass `digits` when
 * the task asks to round: the mistake then accepts the same rounding slack.
 */
export function mistakeList(right: AnswerSpec, digits?: number) {
  const list: Mistake[] = [];
  /** `ownDigits`: this mistake gives a value that has to be rounded (e.g. a wrong square root). */
  const add = (value: number, title: Text, sayText: Text, close?: boolean, ownDigits?: number) => {
    if (!Number.isFinite(value) || right.kind !== "number") return;
    const unit = typeof right.unit === "string" ? right.unit : undefined;
    const label = typeof right.label === "string" ? right.label : undefined;
    // A wrong value with many decimals (a third, a wrong root) is matched to 2 decimals.
    const nice = Math.abs(value * 1e4 - Math.round(value * 1e4)) < 1e-6;
    const d = ownDigits ?? digits ?? (nice ? undefined : 2);
    const when: AnswerSpec = d === undefined ? exact(value, unit, label) : rounded(value, d, unit, label);
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => check(m.when, v).correct)) return;
    list.push(close ? { when, title, say: sayText, close } : { when, title, say: sayText });
  };
  return { list, add };
}

/** A choice option. The first option of a list is the right one; wrong ones with `say` become mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled with rng. */
export function choice(rng: Rng, opts: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

/** A matching task. `wrong` lists typical wrong pairs [left, wrong right]; each right side must be an option. */
export function matchTask(pairs: [Text, Text][], distractors: Text[], wrong: { pairs: [Text, Text][]; title: Text; say: Text }[]) {
  const answer: AnswerSpec = distractors.length ? { kind: "match", pairs, distractors } : { kind: "match", pairs };
  const en = (t: Text) => (typeof t === "string" ? t : t.en);
  const rights = [...pairs.map((p) => en(p[1])), ...distractors.map(en)];
  const lefts = pairs.map((p) => en(p[0]));
  const mistakes: Mistake[] = wrong
    .filter((w) => w.pairs.every(([l, r]) => lefts.includes(en(l)) && rights.includes(en(r)) && pairs.every((p) => !(en(p[0]) === en(l) && en(p[1]) === en(r)))))
    .map((w) => ({ when: { kind: "match", pairs: w.pairs }, title: w.title, say: w.say }));
  return { answer, mistakes };
}

/** A weighted pick of task builders. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) if ((r -= w) < 0) return f();
  return items[items.length - 1][1]();
}
