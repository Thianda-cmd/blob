// Small helpers to build exercises with typical mistakes (choice, multi, match, number, fraction).

import { tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

/** A choice option. The first option of a list is the right one; wrong ones with `say` become mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled with rng (or kept in order without one). */
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

/** Options for "select all that apply": `ok` marks the right ones. `wrong` lists typical wrong selections (by original index). */
export function multi(rng: Rng | null, opts: { text: Text; ok: boolean }[], wrong: { pick: number[]; title: Text; say: Text }[] = []) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const at = (list: number[]) => list.map((i) => order.indexOf(i)).sort((a, b) => a - b);
  const correct = at(opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0));
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const mistakes: Mistake[] = [];
  const seen = new Set([correct.join(",")]);
  for (const w of wrong) {
    const set = at(w.pick);
    const key = set.join(",");
    if (!set.length || seen.has(key)) continue;
    seen.add(key);
    mistakes.push({ when: { kind: "multi", options, correct: set }, title: w.title, say: w.say });
  }
  return { answer, mistakes };
}

/** A matching task. `wrong` lists typical wrong pairs [left, wrong right], each right side must be an option. */
export function matchTask(pairs: [Text, Text][], distractors: Text[] = [], wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = []) {
  const answer: AnswerSpec = distractors.length ? { kind: "match", pairs, distractors } : { kind: "match", pairs };
  const en = (t: Text) => (typeof t === "string" ? t : t.en);
  const rights = [...pairs.map((p) => en(p[1])), ...distractors.map(en)];
  const lefts = pairs.map((p) => en(p[0]));
  const mistakes: Mistake[] = wrong
    .filter((w) => w.pairs.every(([l, r]) => lefts.includes(en(l)) && rights.includes(en(r)) && pairs.every((p) => !(en(p[0]) === en(l) && en(p[1]) === en(r)))))
    .map((w) => ({ when: { kind: "match", pairs: w.pairs }, title: w.title, say: w.say }));
  return { answer, mistakes };
}

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "fraction":
      return { kind: "fraction", n: String(a.n), d: String(a.d) };
    case "choice":
      return { kind: "choice", index: a.correct };
    case "multi":
      return { kind: "multi", indices: a.correct };
    case "word":
      return { kind: "text", text: typeof a.accept[0] === "string" ? a.accept[0] : a.accept[0].de };
    default:
      return null;
  }
}

/** Collects mistakes for number, fraction and word answers: keeps only those that differ from the right answer and each other. */
export function mistakeList(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => check(m.when, v).correct)) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** A percentage answer, e.g. 25 %. */
export const percent = (value: number, tolerance = 0.015): AnswerSpec => ({ kind: "number", value: Math.round(value * 1e6) / 1e6, tolerance, unit: "%" });
/** A whole number of individuals. */
export const count = (value: number): AnswerSpec => ({ kind: "number", value });

/** Reduced fraction. */
export function frac(n: number, d: number): { n: number; d: number } {
  const g = gcdInt(n, d);
  return { n: n / g, d: d / g };
}
export function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
export const fraction = (n: number, d: number): AnswerSpec => ({ kind: "fraction", ...frac(n, d) });

/** Percent with a decimal comma in German: "12,5 %" / "12.5%". */
export function pct(v: number, digits = 1): Text {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = String(r);
  return tx(`${s}%`, `${s.replace(".", ",")} %`);
}
/** Number with a decimal comma in German. */
export function dec(v: number, digits = 2): Text {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = String(r);
  return tx(s, s.replace(".", ","));
}
/** Display-language number (decimal comma in German). */
export const decMath = (v: number, digits = 2): Text => {
  const r = String(Math.round(v * 10 ** digits) / 10 ** digits);
  return tx(r, r.replace(".", ","));
};

/** A weighted pick of task builders. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) if ((r -= w) < 0) return f();
  return items[items.length - 1][1]();
}

/** A one-frame solution with a short line and a note. */
export const oneFrame = (math: Text, note: Text): Frame[] => [{ math, note }];

export type { Exercise };
