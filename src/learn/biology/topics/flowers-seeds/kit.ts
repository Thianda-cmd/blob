import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";

// Small helpers for the flowers-seeds task generators (all three levels).

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Capitalise the English side (answer options start with a capital letter). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));
/** Same text in both languages, lower-case first letter on the English side ("the ovary"). */
export const low = (t: Text): Text => tx(en(t).charAt(0).toLowerCase() + en(t).slice(1), de(t));

export function visual<P extends object>(component: ComponentType<P>, props: P) {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames: `"Narbe"#k`. */
export const q = (t: Text, k?: string): Text => {
  const clean = (s: string) => s.replace(/["#$\\]/g, "");
  const key = k ? `#${k}` : "";
  return tx(`"${clean(en(t))}"${key}`, `"${clean(de(t))}"${key}`);
};
/** Join display-language pieces with spaces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));

export type Opt = { text: Text; title?: Text; say?: Text; close?: boolean };

/**
 * A choice: the first option is the right one. Options are shuffled when an rng is given.
 * Wrong options with a `say` become typical mistakes.
 */
export function choice(rng: Rng | null, opts: Opt[]): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say, ...(o.close ? { close: true } : {}) });
  });
  return { answer: { kind: "choice", options, correct }, mistakes };
}

export type MultiOpt = { text: Text; ok: boolean };
/** A typical wrong selection: the indices (in the given opts) a student with this idea would tick. */
export type MultiSlip = { pick: number[]; title: Text; say: Text };

/** Select all that apply. Options are shuffled; slips become mistakes when they differ from the answer. */
export function multi(rng: Rng, opts: MultiOpt[], slips: MultiSlip[] = []): { answer: AnswerSpec; mistakes: Mistake[] } {
  const order = rng.shuffle(opts.map((_, i) => i));
  const options = order.map((i) => opts[i].text);
  const pos = (i: number) => order.indexOf(i);
  const correct = opts.map((o, i) => (o.ok ? pos(i) : -1)).filter((i) => i >= 0).sort((a, b) => a - b);
  const key = (xs: number[]) => [...xs].sort((a, b) => a - b).join(",");
  const seen = new Set([key(correct)]);
  const mistakes: Mistake[] = [];
  for (const s of slips) {
    const sel = [...new Set(s.pick.map(pos))].sort((a, b) => a - b);
    if (!sel.length || seen.has(key(sel))) continue;
    seen.add(key(sel));
    mistakes.push({ when: { kind: "multi", options, correct: sel }, title: s.title, say: s.say });
  }
  return { answer: { kind: "multi", options, correct }, mistakes };
}

/** A number mistake, only when it differs from the right value and from earlier mistakes. */
export function numberMistakes(right: number, list: { value: number; title: Text; say: Text; close?: boolean }[], unit?: Text): Mistake[] {
  const out: Mistake[] = [];
  const used = new Set([right]);
  for (const m of list) {
    if (!Number.isFinite(m.value) || used.has(m.value) || Math.abs(m.value - right) < 1e-9) continue;
    used.add(m.value);
    out.push({ when: { kind: "number", value: m.value, ...(unit ? { unit } : {}) }, title: m.title, say: m.say, ...(m.close ? { close: true } : {}) });
  }
  return out;
}

/** Pick `n` different items. */
export const some = <T>(rng: Rng, list: readonly T[], n: number): T[] => rng.shuffle(list).slice(0, n);

// ---------------------------------------------------------------------------
// Long quoted words in display frames can't wrap (a quoted text is one token), so they get
// split into one token per word. Highlights on such a token follow all of its words.

const LONG = 20;

function splitMath(src: string, map: Map<string, string[]>): string {
  return src.replace(/"([^"]*)"(?:#([A-Za-z0-9_-]+))?/g, (m: string, body: string, key?: string) => {
    if (body.length <= LONG || !body.includes(" ")) return m;
    const words = body.split(/\s+/).filter(Boolean);
    const keys = words.map((_, i) => (key ? (i ? `${key}-w${i}` : key) : ""));
    if (key) map.set(key, [...new Set([...(map.get(key) ?? []), ...keys])]);
    return words.map((w, i) => `"${w}"${keys[i] ? `#${keys[i]}` : ""}`).join(" \\; ");
  });
}

const splitText = (t: Text, map: Map<string, string[]>): Text => (typeof t === "string" ? splitMath(t, map) : tx(splitMath(t.en, map), splitMath(t.de, map)));

export function fitText(t: Text): Text {
  return splitText(t, new Map());
}

export function fitFrames(frames: Frame[]): Frame[] {
  return frames.map((f) => {
    const map = new Map<string, string[]>();
    const math = splitText(f.math, map);
    const highlight = f.highlight?.flatMap((k) => map.get(k) ?? [k]);
    return { ...f, math, ...(highlight ? { highlight } : {}) };
  });
}

export const fitEx = (ex: Exercise): Exercise => ({ ...ex, solution: fitFrames(ex.solution) });

/** Applies the word wrapping to a whole level: lesson frames, checks and cheat sheet examples. */
export function fitLevel(level: LevelLesson): LevelLesson {
  return {
    lesson: level.lesson.map((s) => (s.type === "explain" && s.frames ? { ...s, frames: fitFrames(s.frames) } : s.type === "check" ? { ...s, exercise: fitEx(s.exercise) } : s)),
    summary: level.summary.map((b) => (b.examples ? { ...b, examples: b.examples.map(fitText) } : b)),
  };
}
