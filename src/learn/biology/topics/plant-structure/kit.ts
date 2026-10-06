// Small helpers for the plant-structure tasks: bilingual pieces, choice options that turn
// tempting wrong answers into Blob's typical-mistake notes, and display-language frames.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** The English side starts with a capital letter (German nouns already do). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));

export function visual<P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A choice option; wrong ones with `say` become typical mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text; close?: boolean };

/** Options with the right one FIRST in `opts`; shuffled when an rng is given. */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say, ...(o.close ? { close: true } : {}) });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

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

/** Collects mistakes that are really wrong and not already covered by an earlier one. */
export function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    if (when.kind === "multi" && when.correct.length === 0) return;
    const v = asAnswer(when);
    if (v) {
      if (check(right, v).correct) return;
      if (list.some((m) => check(m.when, v).correct)) return;
    }
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** A quoted word for frames: `"Wurzel"#k`. */
export const q = (t: Text, k: string): Text => tx(`"${en(t)}"#${k}`, `"${de(t)}"#${k}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

/** Two-frame worked solution for a choice: the key fact, then the answer. */
export function factFrames(fact: Text, factNote: Text, answer: Text, answerNote: Text): Frame[] {
  return [
    { math: q(fact, "f"), note: factNote },
    { math: join(q(fact, "f"), "\\Rightarrow#r", q(answer, "a")), note: answerNote, highlight: ["a"] },
  ];
}

/** Indices of `items` that pass the test. */
export const where = <T>(items: T[], f: (x: T) => boolean) => items.map((x, i) => (f(x) ? i : -1)).filter((i) => i >= 0);

/** "A and C", "A, B and D" */
export function letters(idx: number[], l: "en" | "de") {
  const ls = idx.map((i) => "ABCDEF"[i]);
  if (ls.length <= 1) return ls.join("");
  return `${ls.slice(0, -1).join(", ")} ${l === "en" ? "and" : "und"} ${ls[ls.length - 1]}`;
}

/** Pick a task builder by weight; builders may return null (then another one is tried). */
export function pickTask(rng: Rng, table: [number, (rng: Rng) => Exercise | null][], fallback: (rng: Rng) => Exercise): Exercise {
  const total = table.reduce((a, [w]) => a + w, 0);
  for (let tries = 0; tries < 30; tries++) {
    let r = rng.next() * total;
    for (const [w, build] of table) {
      r -= w;
      if (r < 0) {
        const ex = build(rng);
        if (ex) return ex;
        break;
      }
    }
  }
  return fallback(rng);
}
