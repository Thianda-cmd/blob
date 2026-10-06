// Small helpers shared by the three levels of "cell-division".

import type { ComponentType } from "react";
import { resolveText, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";

/** A task picture: `visual(DivisionPhase, { stage: "ana" })`. */
export function visual<P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** Pick one of several task makers by weight. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) if ((r -= w) < 0) return f();
  return items[items.length - 1][1]();
}

/** One option of a choice task; wrong options with `say` become typical mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Choice task: `opts[0]` is right. Shuffled with `rng` (or kept in order with null). */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes };
}

function asAnswer(a: AnswerSpec): AnswerValue | null {
  switch (a.kind) {
    case "number":
      return { kind: "text", text: String(a.value) };
    case "multi":
      return { kind: "multi", indices: a.correct };
    case "word":
      return { kind: "text", text: resolveText(a.accept[0], "de") };
    default:
      return null;
  }
}

/** Collects typical mistakes, keeping only those that differ from the right answer and from each other. */
export function mistakesFor(right: AnswerSpec) {
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

export const num = (value: number, unit?: Text, tolerance?: number): AnswerSpec => ({ kind: "number", value, ...(unit ? { unit } : {}), ...(tolerance ? { tolerance } : {}) });

/** `n` items of a list in random order. */
export const some = <T>(rng: Rng, list: readonly T[], n: number) => rng.shuffle(list).slice(0, n);

/** Keep the items of `all` (in their order) that are in `picked`. */
export const inOrder = <T>(all: readonly T[], picked: readonly T[]) => all.filter((x) => picked.includes(x));
