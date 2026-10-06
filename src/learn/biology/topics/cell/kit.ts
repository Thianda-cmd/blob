// Small helpers for building the cell topic's tasks: bilingual text, choice/multi/match/order
// answers with typical mistakes, and frames for worked solutions.

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A label with a capital first letter in both languages (for options, cards and list items). */
export const capT = (t: Text): Text => (typeof t === "string" ? cap(t) : cap(t.en) === cap(t.de) ? tx(t.en, cap(t.de)) : tx(cap(t.en), cap(t.de)));

export function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Zellkern"#k`. */
export const q = (t: Text, k?: string): Text => {
  const key = k ? `#${k}` : "";
  return tx(`"${en(t).replace(/"/g, "'")}"${key}`, `"${de(t).replace(/"/g, "'")}"${key}`);
};
/** Join display-language pieces (each may be bilingual) with spaces. */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));
/** A frame. */
export const frame = (math: Text, note: Text, highlight?: string[]): Frame => (highlight ? { math, note, highlight } : { math, note });

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

/** Collects typical mistakes, dropping any that would count as right or repeat an earlier one. */
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

export type Opt = { text: Text; title?: Text; say?: Text; close?: boolean };

/** Choice options with the right one first; shuffled. Wrong options with a `say` become mistakes. */
export function choice(rng: Rng, opts: Opt[]) {
  const order = rng.shuffle(opts.map((_, i) => i));
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say, ...(o.close ? { close: true } : {}) });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list };
}

/** Options for "select all": each with whether it's right; shuffled. */
export function multi(rng: Rng, items: { text: Text; right: boolean; id?: string }[]) {
  const shuffled = rng.shuffle(items);
  const options = shuffled.map((x) => x.text);
  const correct = shuffled.map((x, i) => (x.right ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  /** Indices of the options whose id is in `ids`. */
  const idx = (ids: string[]) => shuffled.map((x, i) => (x.id && ids.includes(x.id) ? i : -1)).filter((i) => i >= 0);
  return { answer, shuffled, options, correct, idx };
}

/** A mistake for an order task: the student put `items` in this (wrong) order. */
export const orderMistake = (items: Text[], title: Text, say: Text): Mistake => ({ when: { kind: "order", items }, title, say });
/** A mistake for a match task: the student made these wrong pairs. */
export const matchMistake = (pairs: [Text, Text][], title: Text, say: Text): Mistake => ({ when: { kind: "match", pairs }, title, say });

/** "A, B and C" in both languages. */
export function listText(items: Text[]): Text {
  const l = (lang: "en" | "de") => {
    const xs = items.map((t) => resolveText(t, lang));
    return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "und"} ${xs[xs.length - 1]}`;
  };
  return tx(l("en"), l("de"));
}

/** Numbers for text: "0.05" / "0,05". */
export const num = (v: number, digits = 4): Text => {
  const f = (l: "en" | "de") => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: false }).format(v);
  return tx(f("en"), f("de"));
};
/** Big numbers for prose: "18,000" / "18.000". */
export const big = (v: number): Text => tx(v.toLocaleString("en-GB"), v.toLocaleString("de-DE"));
