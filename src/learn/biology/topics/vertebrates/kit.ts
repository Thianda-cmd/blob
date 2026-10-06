// Small helpers shared by the three vertebrate levels: bilingual text pieces, shuffled choices
// whose wrong options carry Blob's notes, and a mistake list that never contains a right answer.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Capitalise both languages (for options and sentence starts). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));

export function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Wal"#k`. */
export const q = (t: Text, k: string): Text => tx(`"${en(t).replace(/"/g, "'")}"#${k}`, `"${de(t).replace(/"/g, "'")}"#${k}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

export type Opt = { text: Text; title?: Text; say?: Text; close?: boolean };

/** Options with the right one first; shuffled with `rng`. Wrong options with a `say` become mistakes. */
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

/** Collects mistakes for `right`, skipping any that would be accepted as correct or repeat an earlier one. */
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

/** Indices (in `items`) for which `f` holds. */
export const where = <T>(items: T[], f: (x: T) => boolean) => items.map((x, i) => (f(x) ? i : -1)).filter((i) => i >= 0);

/** "a, b and c" in both languages. */
export function listText(items: Text[]): Text {
  const l = (lang: "en" | "de") => {
    const s = items.map((t) => resolveText(t, lang));
    return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "und"} ${s[s.length - 1]}`;
  };
  return tx(l("en"), l("de"));
}
