// Helpers for the "nervous-system" exercises: answer specs with their typical mistakes, and small
// builders for the display-language frames of the worked solutions.

import { resolveText, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

/** A choice option. The first option of a list is the right one; wrong ones with `say` become mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** Options shuffled (rng) or in the given order (null); the right one is opts[0]. */
export function choice(rng: Rng | null, opts: Opt[]) {
  const order = rng ? rng.shuffle(opts.map((_, i) => i)) : opts.map((_, i) => i);
  const options = order.map((i) => opts[i].text);
  const correct = order.indexOf(0);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct } as AnswerSpec, mistakes };
}

/** A choice with the right answer placed at `at` (for hand-written lesson checks). */
export function choiceAt(at: number, opts: Opt[]) {
  const order = opts.map((_, i) => i);
  order.splice(0, 1);
  order.splice(Math.min(at, order.length), 0, 0);
  const options = order.map((i) => opts[i].text);
  const mistakes: Mistake[] = [];
  order.forEach((i, pos) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: pos }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct: at } as AnswerSpec, mistakes };
}

/** Select all that apply. `wrong` lists typical wrong selections as indices into `items`. */
export function multi(rng: Rng | null, items: { text: Text; ok: boolean }[], wrong: { pick: number[]; title: Text; say: Text }[] = []) {
  const order = rng ? rng.shuffle(items.map((_, i) => i)) : items.map((_, i) => i);
  const options = order.map((i) => items[i].text);
  const correct = order.map((i, at) => (items[i].ok ? at : -1)).filter((x) => x >= 0);
  const key = (xs: number[]) => [...xs].sort((a, b) => a - b).join(",");
  const mistakes: Mistake[] = [];
  for (const w of wrong) {
    const picked = w.pick.map((i) => order.indexOf(i)).filter((x) => x >= 0);
    if (!picked.length || key(picked) === key(correct) || mistakes.some((m) => m.when.kind === "multi" && key(m.when.correct) === key(picked))) continue;
    mistakes.push({ when: { kind: "multi", options, correct: picked }, title: w.title, say: w.say });
  }
  return { answer: { kind: "multi", options, correct } as AnswerSpec, mistakes };
}

/** Put in order: `items` in the right order; a mistake names items in the wrong order the student chose. */
export function order(items: Text[], wrong: { items: Text[]; title: Text; say: Text }[] = [], label?: Text) {
  const has = (t: Text) => items.some((i) => resolveText(i, "en") === resolveText(t, "en"));
  const answer: AnswerSpec = label ? { kind: "order", items, label } : { kind: "order", items };
  const mistakes: Mistake[] = wrong.filter((w) => w.items.length >= 2 && w.items.every(has)).map((w) => ({ when: { kind: "order", items: w.items }, title: w.title, say: w.say }));
  return { answer, mistakes };
}

/** Match left to right. A mistake names the wrong pairs it makes. */
export function match(pairs: [Text, Text][], distractors: Text[] = [], wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [], label?: Text) {
  const en = (t: Text) => resolveText(t, "en");
  const rights = [...pairs.map((p) => en(p[1])), ...distractors.map(en)];
  const lefts = pairs.map((p) => en(p[0]));
  const answer: AnswerSpec = { kind: "match", pairs, ...(distractors.length ? { distractors } : {}), ...(label ? { label } : {}) };
  const mistakes: Mistake[] = wrong
    .filter((w) => w.pairs.every(([l, r]) => lefts.includes(en(l)) && rights.includes(en(r)) && pairs.every((p) => en(p[0]) !== en(l) || en(p[1]) !== en(r))))
    .map((w) => ({ when: { kind: "match", pairs: w.pairs }, title: w.title, say: w.say }));
  return { answer, mistakes };
}

/** A term to type. Wrong terms become mistakes. */
export function word(accept: Text[], wrong: { accept: Text[]; title: Text; say: Text }[] = [], placeholder?: Text) {
  const answer: AnswerSpec = placeholder ? { kind: "word", accept, placeholder } : { kind: "word", accept };
  const mistakes: Mistake[] = wrong.map((w) => ({ when: { kind: "word", accept: w.accept }, title: w.title, say: w.say }));
  return { answer, mistakes };
}

/** A number, with typical wrong values (only kept when they differ from the right one and each other). */
export function num(value: number, unit: Text | undefined, tolerance: number, wrong: { value: number; title: Text; say: Text; close?: boolean }[] = []) {
  const answer: AnswerSpec = { kind: "number", value, tolerance, ...(unit ? { unit } : {}) };
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(tolerance * Math.abs(b), 1e-9) * 1.01 || Math.abs(a - b) <= Math.max(tolerance * Math.abs(a), 1e-9) * 1.01;
  const mistakes: Mistake[] = [];
  for (const w of wrong) {
    if (!Number.isFinite(w.value) || near(w.value, value)) continue;
    if (mistakes.some((m) => m.when.kind === "number" && near(m.when.value, w.value))) continue;
    mistakes.push({ when: { kind: "number", value: w.value, tolerance, ...(unit ? { unit } : {}) }, title: w.title, say: w.say, ...(w.close ? { close: true } : {}) });
  }
  return { answer, mistakes };
}

// ---------------------------------------------------------------------------
// Display-language helpers for frames

const map = (t: Text, f: (s: string) => string): Text => (typeof t === "string" ? f(t) : { en: f(t.en), de: f(t.de) });

/** A word or phrase as display text: "Linse"#k. */
export const q = (t: Text, key?: string): Text => map(t, (s) => `"${s}"${key ? `#${key} ` : ""}`);

/** Join display pieces with spaces (pieces may be bilingual). */
export function cat(...parts: Text[]): Text {
  const en = parts.map((p) => resolveText(p, "en")).join(" ");
  const de = parts.map((p) => resolveText(p, "de")).join(" ");
  return en === de ? en : { en, de };
}

/** A chain a → b → c, broken onto a new line every `per` items; `hl` highlights some of them. */
export function flow(items: Text[], opts: { per?: number; hl?: number[]; keys?: string } = {}): Text {
  const per = opts.per ?? 3;
  const pieces: Text[] = [];
  items.forEach((it, i) => {
    if (i > 0) pieces.push(i % per === 0 ? "\\\\ \\to" : "\\to");
    const one = q(it, opts.keys ? `${opts.keys}${i}` : undefined);
    pieces.push(opts.hl?.includes(i) ? map(one, (s) => `\\hl{${s.trim()}}`) : one);
  });
  return cat(...pieces);
}

/** A one-frame solution: the answer, big, with a note why. */
export const answerFrame = (answer: Text, note: Text): Frame => ({ math: map(answer, (s) => `\\hl{"${s}"}`), note });

/** The picture of a task. */
export const pic = (component: unknown, props: Record<string, unknown>): Exercise["visual"] => ({ component: component as never, props });

/** Pick n different items. */
export const some = <T,>(rng: Rng, xs: readonly T[], n: number): T[] => rng.shuffle(xs).slice(0, n);

/** Weighted choice between task makers. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) if ((r -= w) < 0) return f();
  return items[items.length - 1][1]();
}

/** German decimal comma / English point. */
export const decimal = (v: number, digits = 2): Text => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  const s = String(r);
  return s.includes(".") ? { en: s, de: s.replace(".", ",") } : s;
};
