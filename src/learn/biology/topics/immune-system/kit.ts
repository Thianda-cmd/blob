// Small helpers shared by the three levels of the immune-system topic: bilingual text pieces,
// task pictures, choice tasks with typical mistakes, and the solution frames.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The same text with a capital first letter in both languages. */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));

/** A task picture. */
export function visual<P extends object>(component: ComponentType<P>, props: P): Exercise["visual"] {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Grippe"#k`. */
export const q = (t: Text, k: string): Text => tx(`"${en(t)}"#${k}`, `"${de(t)}"#${k}`);
/** Join display-language pieces (each may be bilingual) with spaces. */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));
/** A two-frame solution: what we look at, then the answer (highlighted) with Blob's reason. */
export function solve(premise: Text, premiseNote: Text, answer: Text, answerNote: Text): Frame[] {
  return [
    { math: q(premise, "p"), note: premiseNote },
    { math: join(q(premise, "p"), "\\Rightarrow#r", q(answer, "a")), note: answerNote, highlight: ["a"] },
  ];
}
/** A list of items as one frame, each keyed, e.g. the right order or the right pairs. */
export const listFrame = (items: Text[], sep = " \\to "): Text =>
  tx(items.map((it, i) => `"${en(it)}"#i${i}`).join(sep), items.map((it, i) => `"${de(it)}"#i${i}`).join(sep));

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "choice":
      return { kind: "choice", index: a.correct };
    case "multi":
      return { kind: "multi", indices: a.correct };
    case "word":
      return { kind: "text", text: resolveText(a.accept[0], "de") };
    default:
      return null;
  }
}

/** Collects typical mistakes, skipping any that the checker would accept or that repeat an earlier one. */
export function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (v) {
      if (check(right, v).correct) return;
      if (list.some((m) => check(m.when, v).correct)) return;
    }
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

export type Opt = { text: Text; title?: Text; say?: Text };

/** Options with the right one first; shuffled when an rng is given. Wrong options with a `say` become mistakes. */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

/** A wrong order: the student put `items` in this (wrong) sequence. */
export const orderSlip = (items: Text[], title: Text, say: Text): Mistake => ({ when: { kind: "order", items }, title, say });
/** A wrong matching: the student paired these. */
export const matchSlip = (pairs: [Text, Text][], title: Text, say: Text): Mistake => ({ when: { kind: "match", pairs }, title, say });

/** Picks `n` different items. */
export const some = <T>(rng: Rng, list: readonly T[], n: number): T[] => rng.shuffle(list).slice(0, n);

/** Select-all task: `items` with a flag; the right ones are the flagged ones. */
export function multiOf<T extends { text: Text }>(rng: Rng, items: T[], isRight: (x: T) => boolean) {
  const picked = rng.shuffle(items);
  const options = picked.map((x) => x.text);
  const correct = picked.map((x, i) => (isRight(x) ? i : -1)).filter((i) => i >= 0);
  return { picked, options, correct, answer: { kind: "multi", options, correct } as AnswerSpec };
}
