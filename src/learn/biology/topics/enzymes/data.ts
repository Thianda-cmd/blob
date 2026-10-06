// Enzymes: shared models (activity curves, Michaelis-Menten), units, enzyme facts and small
// helpers for building exercises with typical mistakes. Used by all three levels and the visuals.

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { dec } from "@/learn/chemistry/format";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Mistake } from "@/learn/types";

// ---------------------------------------------------------------------------
// Models

/** Width (°C) of the denaturation step and where it sits relative to the optimum. */
const DENAT_W = 3;
const DENAT_SHIFT = (() => {
  const s = (DENAT_W * Math.LN2) / 10;
  return -DENAT_W * Math.log(s / (1 - s));
})();
const rawTemp = (t: number, opt: number) => 2 ** (t / 10) / (1 + Math.exp((t - opt - DENAT_SHIFT) / DENAT_W));

/**
 * Relative activity (0..1) of a fresh enzyme at temperature `t` with its optimum at `opt`:
 * RGT rule (×2 per 10 °C) below the optimum, steep drop by denaturation above it. The maximum
 * is exactly at `opt`.
 */
export const tempActivity = (t: number, opt: number) => rawTemp(t, opt) / rawTemp(opt, opt);

/**
 * Share of enzyme molecules that survive being heated to `tMax` (denaturation is irreversible):
 * about all of them up to a few degrees above the optimum, half at opt + 12 °C, almost none at opt + 20 °C.
 */
export const survivors = (tMax: number, opt: number) => Math.min(1, (1 + Math.exp(-12 / 2.5)) / (1 + Math.exp((tMax - opt - 12) / 2.5)));

/** Relative activity (0..1) at a pH value, bell-shaped around the optimum. */
export const phActivity = (ph: number, opt: number, width = 1.1) => Math.exp(-((ph - opt) ** 2) / (2 * width * width));

/** Michaelis-Menten: rate at substrate concentration `s`. */
export const mm = (s: number, vmax: number, km: number) => (vmax * s) / (km + s);

// ---------------------------------------------------------------------------
// Units and numbers

/** Substrate concentration. */
export const MMOL: Text = tx("mmol/L", "mmol/l");
/** Reaction rate. */
export const RATE: Text = tx("µmol/(L·min)", "µmol/(l·min)");
/** The same units for display-language maths (quoted). */
export const MMOL_Q: Text = tx('"mmol/L"', '"mmol/l"');
export const RATE_Q: Text = tx('"µmol/(L·min)"', '"µmol/(l·min)"');

/** A number in both languages: 2.5 / 2,5. */
export const n = (v: number, digits = 2): Text => txMap((_, l) => dec(v, l, digits));
/** A display-language line built from a template that gets the number formatter and the locale. */
export const both = (build: (f: (v: number, digits?: number) => string, de: boolean) => string): Text =>
  txMap((_, l) => build((v, d = 2) => dec(v, l, d), l === "de"));

// ---------------------------------------------------------------------------
// Enzyme facts

export type PhEnzyme = { id: string; name: Text; opt: number; width: number; place: Text };

export const PH_ENZYMES: PhEnzyme[] = [
  { id: "pepsin", name: tx("pepsin", "Pepsin"), opt: 2, width: 0.85, place: tx("in the stomach", "im Magen") },
  { id: "acid", name: tx("acid phosphatase", "saure Phosphatase"), opt: 5, width: 0.95, place: tx("in the lysosomes", "in den Lysosomen") },
  { id: "amylase", name: tx("salivary amylase", "Speichel-Amylase"), opt: 7, width: 1.05, place: tx("in the mouth", "in der Mundhöhle") },
  { id: "trypsin", name: tx("trypsin", "Trypsin"), opt: 8, width: 1.05, place: tx("in the small intestine", "im Dünndarm") },
  { id: "alkaline", name: tx("alkaline phosphatase", "alkalische Phosphatase"), opt: 10, width: 1.0, place: tx("in bone and intestine", "in Knochen und Darm") },
];
export const phEnzyme = (id: string) => PH_ENZYMES.find((e) => e.id === id)!;

/** Where enzymes with a given temperature optimum come from (for graph tasks). */
export const TEMP_SOURCES: { opt: number; who: Text }[] = [
  { opt: 15, who: tx("a fish from the Arctic Sea", "einem Fisch aus dem Nordpolarmeer") },
  { opt: 20, who: tx("a fish from a cold mountain lake", "einem Fisch aus einem kalten Bergsee") },
  { opt: 35, who: tx("a human", "einem Menschen") },
  { opt: 40, who: tx("a human", "einem Menschen") },
  { opt: 50, who: tx("a bacterium, used in washing powder", "einem Bakterium, eingesetzt in Waschmittel") },
  { opt: 55, who: tx("a bacterium, used in washing powder", "einem Bakterium, eingesetzt in Waschmittel") },
  { opt: 70, who: tx("a bacterium from a hot spring", "einem Bakterium aus einer heißen Quelle") },
  { opt: 75, who: tx("a bacterium from a hot spring", "einem Bakterium aus einer heißen Quelle") },
];

// ---------------------------------------------------------------------------
// Exercise helpers

export const visual = <P extends object>(component: ComponentType<P>, props: P) => ({
  component: component as unknown as ComponentType<Record<string, unknown>>,
  props: props as Record<string, unknown>,
});

export const PICK: Text = tx("Pick the right answer", "Wähle die richtige Antwort");
export const PICK_ALL: Text = tx("Select all true statements", "Wähle alle richtigen Aussagen");

/** The answer a student with this (wrong) spec would give, for de-duplicating mistakes. */
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

/** Collects typical mistakes; a mistake is only kept when it differs from the right answer and the others. */
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

/** One option of a choice task; wrong options with a `say` become typical mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** A choice task from options with the right one FIRST; shuffled with `rng` (or kept in order). */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const list: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) list.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes: list, options, correct };
}

/** A statement for "select all that apply"; false ones may carry the misconception they test. */
export type Stmt = { text: Text; ok: boolean; title?: Text; say?: Text };

/**
 * Select-all task: `nTrue` true and `nFalse` false statements, shuffled. Picking all true ones plus one
 * false statement with a `say` gives that misconception; leaving out a true one with a `say` too.
 */
export function multi(rng: Rng, pool: Stmt[], nTrue: number, nFalse: number) {
  const trues = rng.shuffle(pool.filter((s) => s.ok)).slice(0, nTrue);
  const falses = rng.shuffle(pool.filter((s) => !s.ok)).slice(0, nFalse);
  const all = rng.shuffle([...trues, ...falses]);
  const options = all.map((s) => s.text);
  const correct = all.map((s, i) => (s.ok ? i : -1)).filter((i) => i >= 0);
  const right: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(right);
  all.forEach((s, i) => {
    if (!s.say || !s.title) return;
    const set = s.ok ? correct.filter((c) => c !== i) : [...correct, i].sort((a, b) => a - b);
    if (set.length) m.add({ kind: "multi", options, correct: set }, s.title, s.say);
  });
  return { answer: right, mistakes: m.list, trues, falses, all };
}

/** Pick a task builder by weight. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) {
    if ((r -= w) < 0) return f();
  }
  return items[items.length - 1][1]();
}

/** "A", "B", "C" … */
export const letter = (i: number) => "ABCDEF"[i];
