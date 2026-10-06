// Small helpers for the plant-diversity tasks: pictures, shuffled choices whose wrong options carry
// Blob's notes, select-all-that-apply with typical traps, orders, matchings and solution frames.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** English with a capital first letter, German as it is (nouns are capitalised anyway). */
export const capT = (t: Text): Text => (typeof t === "string" ? cap(t) : tx(cap(t.en), cap(t.de)));

export function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Linde"#k`. */
export const q = (t: Text, k?: string): Text => tx(`"${en(t)}"${k ? `#${k}` : ""}`, `"${de(t)}"${k ? `#${k}` : ""}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));
/** "A → B" as a frame line. */
export const arrow = (a: Text, b: Text, ka = "a", kb = "b"): Text => join(q(a, ka), "\\Rightarrow#r", q(b, kb));

/** A one- or two-frame solution: the reason, then the answer. */
export function solution(answer: Text, why: Text, step?: { math: Text; note: Text }): Frame[] {
  const out: Frame[] = [];
  if (step) out.push({ math: step.math, note: step.note });
  out.push({ math: q(answer, "ans"), note: why, highlight: ["ans"] });
  return out;
}

export type Opt = { text: Text; title?: Text; say?: Text };

/** Options with the right one first; shuffled by rng. Wrong options with a `say` become mistakes. */
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

export type MultiOpt = { text: Text; right: boolean; title?: Text; say?: Text };

/**
 * Select all that apply. A wrong option with a `say` is a trap: picking it together with all the
 * right ones gives Blob's note. A right option with a `say` is easy to forget: leaving it out gives the note.
 */
export function multi(rng: Rng, opts: MultiOpt[]) {
  const order = rng.shuffle(opts.map((_, i) => i));
  const options = order.map((i) => opts[i].text);
  const correct = order.map((i, at) => (opts[i].right ? at : -1)).filter((x) => x >= 0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (!o.say) return;
    const when = o.right ? correct.filter((c) => c !== at) : [...correct, at].sort((a, b) => a - b);
    if (!when.length) return;
    list.push({ when: { kind: "multi", options, correct: when }, title: o.title, say: o.say });
  });
  return { answer: { kind: "multi", options, correct } as AnswerSpec, mistakes: list.slice(0, 4) };
}

/** "Linde, Birke und Eiche" */
export function listText(items: Text[]): Text {
  const e = items.map(en);
  const d = items.map(de);
  const f = (xs: string[], and: string) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${and} ${xs[xs.length - 1]}`);
  return tx(f(e, "and"), f(d, "und"));
}

/** Pick k different items. */
export const pickSome = <T>(rng: Rng, list: readonly T[], k: number) => rng.shuffle(list).slice(0, k);
