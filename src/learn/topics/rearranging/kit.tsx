"use client";

// Small helpers shared by the three levels of "rearranging": choice tasks with typical
// mistakes, numbers in both languages, number mistakes, and the big formula card.

import type { Locale } from "@/i18n/config";
import { resolveText, txMap, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import { MathView } from "@/learn/components/MathView";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Frame, Mistake } from "@/learn/types";

/** A choice option. The first option of a list is the right one; wrong ones with `say` become mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled with rng (kept in order without one), with the wrong ones as typical mistakes. */
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

/** A number in one language: decimal comma in German, at most `digits` decimals, no grouping. */
export const dec = (v: number, l: Locale, digits = 2) =>
  new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: false }).format(v);

/** Money with two decimals: 7,20 / 7.20. Whole amounts stay whole (5 €). */
export const money = (v: number, l: Locale) => {
  const r = Math.round(v * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2);
  return l === "de" ? s.replace(".", ",") : s;
};

/** The same number in both languages. */
export const decText = (v: number, digits = 2): Text => txMap((_, l) => dec(v, l, digits));

/** Rounds away floating-point noise: 3 · 1.2 = 3.6, not 3.5999999. */
export const clean = (v: number) => Math.round(v * 1e9) / 1e9;

function asAnswer(a: AnswerSpec): AnswerValue | null {
  if (a.kind === "number") return { kind: "text", text: String(a.value) };
  if (a.kind === "expr") return { kind: "text", text: a.value };
  return null;
}

/**
 * Typical wrong numbers for a number answer: keeps the finite ones that are not accepted as right and
 * differ from each other. `tolerance` lets a rounded slip (14,7 for 14,697…) still be recognised.
 */
export function numberMistakes(right: Extract<AnswerSpec, { kind: "number" }>, list: { value: number; title: Text; say: Text; close?: boolean; tolerance?: number }[]): Mistake[] {
  const out: Mistake[] = [];
  for (const m of list) {
    if (!Number.isFinite(m.value) || m.value <= 0) continue;
    const when: AnswerSpec = { kind: "number", value: clean(m.value), ...(m.tolerance ? { tolerance: m.tolerance } : {}), ...(right.unit ? { unit: right.unit } : {}) };
    const v = asAnswer(when)!;
    if (check(right, v).correct) continue;
    if (out.some((o) => check(o.when, v).correct)) continue;
    out.push(m.close ? { when, title: m.title, say: m.say, close: true } : { when, title: m.title, say: m.say });
  }
  return out;
}

/** Writes decimal commas between digits as points in the English version ("1,8C" → "1.8C"). */
export function enDecimals(t: Text): Text {
  const de = resolveText(t, "de");
  const en = resolveText(t, "en").replace(/(\d),(\d)/g, "$1.$2");
  return en === de ? t : { en, de };
}

/** The same for every frame of a worked solution. */
export const enDecimalFrames = (frames: Frame[]): Frame[] => frames.map((f) => ({ ...f, math: enDecimals(f.math), note: f.note === undefined ? undefined : enDecimals(f.note) }));

/** The formula, big, with the letter to solve for in purple. Shown as the task's picture. */
export function FormulaBoard(props: Record<string, unknown>) {
  return (
    <div className="relative -m-3 grid min-h-[150px] place-items-center overflow-hidden rounded-2xl px-6 py-9">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
      <MathView src={props.src as Text} size="xl" animate={false} className="relative" />
    </div>
  );
}
