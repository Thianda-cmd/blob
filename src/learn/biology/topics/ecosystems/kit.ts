// Small helpers shared by the three ecosystem levels: bilingual pieces for frames, choice
// options with Blob's mistakes attached, typical-mistake lists that never contain the right
// answer, and numbers in both languages.

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** English with a capital letter (German nouns have one anyway). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));

/** A task picture: any of the Eco drawings with its props. */
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
    default:
      return null;
  }
}

/** Typical mistakes for an answer: skips any that would be accepted as right or duplicate an earlier one. */
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

export type Opt = { text: Text; title?: Text; say?: Text };

/** Options with the right one FIRST; shuffled when an rng is given. Wrong options with a `say` become mistakes. */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list, options };
}

/** A choice with a fixed option order (e.g. "increases / decreases / stays the same"). */
export function fixedChoice(options: Text[], correct: number, wrong: { at: number; title: Text; say: Text }[]) {
  const answer: AnswerSpec = { kind: "choice", options, correct };
  const list: Mistake[] = wrong.filter((w) => w.at !== correct).map((w) => ({ when: { kind: "choice", options, correct: w.at }, title: w.title, say: w.say }));
  return { answer, mistakes: list };
}

/** A quoted word for display-language frames: `"Feldhase"#k`. */
export const q = (t: Text, k: string): Text => tx(`"${en(t)}"#${k}`, `"${de(t)}"#${k}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));
/** "A → B → C" as a display-language chain with keys c0, c1, … */
export const chainMath = (names: Text[], prefix = "c"): Text => join(...names.flatMap((n, i) => (i ? ["\\to", q(n, `${prefix}${i}`)] : [q(n, `${prefix}${i}`)])));
/** "A → B → C" as plain text (for task texts). */
export const chainText = (names: Text[]): Text => tx(names.map(en).join(" → "), names.map(de).join(" → "));
/** "A, B and C" */
export const listText = (names: Text[]): Text => {
  const l = (lang: "en" | "de") => {
    const s = names.map((n) => resolveText(n, lang));
    return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "und"} ${s[s.length - 1]}`;
  };
  return tx(l("en"), l("de"));
};

const nf = (v: number, lang: "en" | "de", digits: number, group: boolean) =>
  new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: group }).format(v);

/** A number in prose: "12,000" / "12.000", "2.5" / "2,5" (groups only from 10 000 on). */
export const numText = (v: number, digits = 2): Text => txMap((_, l) => nf(v, l, digits, Math.abs(v) >= 10000));
/** A number for display-language maths: thin-space groups ("12\,000"), decimal comma in German. */
export const numMath = (v: number, digits = 2): Text =>
  txMap((_, l) => {
    const s = nf(v, l, digits, false);
    const [int, frac] = s.split(/[.,]/);
    const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, "\\,") : int;
    return frac ? `${grouped}${l === "de" ? "," : "."}${frac}` : grouped;
  });

/** Pick n distinct items. */
export const pickN = <T,>(rng: Rng, items: readonly T[], n: number): T[] => rng.shuffle(items).slice(0, n);
