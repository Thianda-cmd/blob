// Small helpers shared by the three photosynthesis levels: bilingual text, choice and multi
// tasks with typical mistakes, and display-language snippets for solution frames.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A task picture: any drawing component with its props. */
export function visual<P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
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
      return { kind: "text", text: de(a.accept[0]) };
    case "balance":
      return { kind: "list", values: a.coefficients.map(String) };
    default:
      return null;
  }
}

/** Collects typical mistakes, keeping only those that differ from the right answer and from each other. */
export function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (v) {
      if (check(right, v).correct) return;
      if (list.some((m) => m.when.kind === when.kind && check(m.when, v).correct)) return;
    }
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** An answer option; a wrong one with `say` becomes a typical mistake. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** One right option (first) and wrong ones; shuffled when an rng is given. */
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

/** A right option for "select all that apply"; `miss` is what Blob says when exactly this one is left out. */
export type MultiOpt = { text: Text; title?: Text; say?: Text; miss?: Text; missTitle?: Text };

/**
 * Select all that apply. Mistakes: all right ones plus one tempting wrong one (its `say`), or all
 * right ones but one (its `miss`).
 */
export function multi(rng: Rng, right: MultiOpt[], wrong: MultiOpt[]) {
  const all = rng.shuffle([...right.map((o) => ({ o, ok: true })), ...wrong.map((o) => ({ o, ok: false }))]);
  const options = all.map((a) => a.o.text);
  const correct = all.flatMap((a, i) => (a.ok ? [i] : []));
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  all.forEach((a, i) => {
    if (!a.ok && a.o.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((x, y) => x - y) }, a.o.title ?? tx("One doesn't belong", "Eine gehört nicht dazu"), a.o.say);
  });
  all.forEach((a, i) => {
    if (a.ok && a.o.miss && correct.length > 1) m.add({ kind: "multi", options, correct: correct.filter((c) => c !== i) }, a.o.missTitle ?? tx("One is missing", "Eine fehlt"), a.o.miss);
  });
  return { answer, mistakes: m.list.slice(0, 4) };
}

/**
 * A quoted word for display-language frames, optionally keyed: `"Wasser"#w`. Text that reads the
 * same in both languages (symbols, abbreviations like DCMU) becomes `\text{…}`.
 */
export const q = (t: Text, k?: string): Text => {
  const key = k ? `#${k}` : "";
  return en(t) === de(t) ? `\\text{${en(t)}}${key}` : tx(`"${en(t)}"${key}`, `"${de(t)}"${key}`);
};
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

/**
 * The usual two-frame solution for a concept task: a short cue with the reason, then the cue
 * leading to a short form of the answer. `lead` and `answer` are short (they are shown big).
 */
export function reasonFrames(lead: Text, why: Text, answer: Text, note: Text): Frame[] {
  return [
    { math: q(lead, "r"), note: why },
    { math: join(q(lead, "r"), "\\Rightarrow#to", q(answer, "a")), note, highlight: ["a"] },
  ];
}

/** n distinct items from a list (in random order). */
export const some = <T>(rng: Rng, list: readonly T[], n: number): T[] => rng.shuffle(list).slice(0, n);
