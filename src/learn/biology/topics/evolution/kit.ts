// Small helpers shared by the three evolution levels: bilingual text pieces, choice and
// multi-select answers with typical mistakes, and pictures for tasks.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import { dec } from "@/learn/chemistry/format";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Capital first letter in both languages (German nouns already have one). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));

/** A task picture: a drawing component with its props. */
export function visual<P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Fossil"#k`. */
export const q = (t: Text, k?: string): Text => tx(`"${en(t)}"${k ? `#${k}` : ""}`, `"${de(t)}"${k ? `#${k}` : ""}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

/** A number in both languages ("0.32" / "0,32"). */
export const num = (v: number, digits = 4): Text => tx(dec(v, "en", digits), dec(v, "de", digits));
/** The number as a display-language token with a key. */
export const numK = (v: number, k: string, digits = 4): Text => tx(`${dec(v, "en", digits)}#${k}`, `${dec(v, "de", digits)}#${k}`);

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

/**
 * Collects typical mistakes for an answer: a mistake is only kept when it really is wrong and
 * differs from the mistakes already collected.
 */
export function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => m.when.kind === when.kind && check(m.when, v).correct)) return;
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

/**
 * A list of categories (e.g. "Lamarck", "Darwin", "both", "neither"); the right one is `right`.
 * Wrong categories with a note become mistakes. With an rng the order is shuffled.
 */
export function category(options: Text[], right: number, wrong: Partial<Record<number, { title: Text; say: Text }>>, rng?: Rng) {
  const order = rng ? rng.shuffle(options.map((_, i) => i)) : options.map((_, i) => i);
  const shown = order.map((i) => options[i]);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const w = wrong[i];
    if (i !== right && w) list.push({ when: { kind: "choice", options: shown, correct: at }, title: w.title, say: w.say });
  });
  return { answer: { kind: "choice", options: shown, correct: order.indexOf(right) } as AnswerSpec, mistakes: list };
}

/** Indices of the options that pass a test. */
export const indicesOf = <T>(items: T[], ok: (x: T, i: number) => boolean) => items.map((x, i) => (ok(x, i) ? i : -1)).filter((i) => i >= 0);

/** "a, b and c" / "a, b und c" */
export function listText(items: Text[]): Text {
  const l = (lang: "en" | "de") => {
    const xs = items.map((x) => resolveText(x, lang));
    return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "und"} ${xs[xs.length - 1]}`;
  };
  return tx(l("en"), l("de"));
}

/** Rounds to a few significant decimals for display. */
export const round = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits;
