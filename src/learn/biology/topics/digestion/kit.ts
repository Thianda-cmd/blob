// Small helpers shared by the three digestion levels: choice/multi/order/match builders with
// typical mistakes, a mistake collector for numbers and words, and weighted picking.

import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

export type { Text };

/** An option: the first one in a list is the right one; wrong ones with `say` become mistakes. */
export type Opt = { text: Text; title?: Text; say?: Text };

/** One right option (the first) and wrong ones, shuffled (or in the given order without rng). */
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

/** A fixed-order choice where `correct` is the index of the right option (for lesson checks). */
export function fixedChoice(opts: Opt[], correctAt: number) {
  const order = opts.map((_, i) => i);
  // move the right option (index 0 in opts) to position correctAt
  order.splice(0, 1);
  order.splice(correctAt, 0, 0);
  const options = order.map((i) => opts[i].text);
  const mistakes: Mistake[] = [];
  order.forEach((i, at) => {
    const o = opts[i];
    if (i !== 0 && o.say) mistakes.push({ when: { kind: "choice", options, correct: at }, title: o.title, say: o.say });
  });
  return { answer: { kind: "choice", options, correct: correctAt } as AnswerSpec, mistakes };
}

/** A statement for "select all that apply"; false ones may carry the misconception they show. */
export type Stmt = { text: Text; title?: Text; say?: Text };

/** Select-all from true and false statements; each tempting false one picked along gives its mistake. */
export function multi(rng: Rng, trues: Stmt[], falses: Stmt[]) {
  const all = rng.shuffle([...trues.map((s) => ({ s, ok: true })), ...falses.map((s) => ({ s, ok: false }))]);
  const options = all.map((a) => a.s.text);
  const correct = all.map((a, i) => (a.ok ? i : -1)).filter((i) => i >= 0);
  const mistakes: Mistake[] = [];
  all.forEach((a, i) => {
    if (a.ok || !a.s.say) return;
    // the right ones plus this tempting wrong one
    mistakes.push({ when: { kind: "multi", options, correct: [...correct, i].sort((x, y) => x - y) }, title: a.s.title, say: a.s.say });
  });
  return { answer: { kind: "multi", options, correct } as AnswerSpec, mistakes };
}

/** The answer a student would give for a spec (to test mistakes against the right answer). */
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

/** Collects mistakes; each is kept only when it differs from the right answer and the others. */
export function mistakes(right: AnswerSpec) {
  const list: Mistake[] = [];
  const add = (when: AnswerSpec, title: Text, say: Text, close?: boolean) => {
    const v = asAnswer(when);
    if (!v || check(right, v).correct) return;
    if (list.some((m) => check(m.when, v).correct)) return;
    list.push(close ? { when, title, say, close } : { when, title, say });
  };
  return { list, add };
}

/** A number answer with a relative tolerance (and the same tolerance for its mistakes). */
export const num = (value: number, tolerance = 0.01, unit?: Text): AnswerSpec => (unit ? { kind: "number", value, tolerance, unit } : { kind: "number", value, tolerance });

/** A word answer: the English/German name plus extra spellings. */
export const word = (accept: Text[], placeholder?: Text): AnswerSpec => (placeholder ? { kind: "word", accept, placeholder } : { kind: "word", accept });

/** Pick n different items. */
export const pickN = <T>(rng: Rng, items: readonly T[], n: number): T[] => rng.shuffle(items).slice(0, n);

/** Pick by weight. */
export function weighted<T>(rng: Rng, items: [number, () => T][]): T {
  const total = items.reduce((s, [w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [w, f] of items) {
    if ((r -= w) < 0) return f();
  }
  return items[items.length - 1][1]();
}

/** An "order" task: items given in the right order; mistakes as wrongly ordered subsequences. */
export function orderTask(o: {
  instruction: Text;
  text: Text;
  items: Text[];
  hint: Text;
  solution: Frame[];
  wrong?: { items: Text[]; title: Text; say: Text }[];
  label?: Text;
}): Exercise {
  const has = (t: Text) => o.items.some((x) => resolveText(x, "en") === resolveText(t, "en"));
  const mistakesList: Mistake[] = (o.wrong ?? [])
    .filter((w) => w.items.length >= 2 && w.items.every(has))
    .filter((w) => {
      // the subsequence must really be out of order
      const idx = w.items.map((t) => o.items.findIndex((x) => resolveText(x, "en") === resolveText(t, "en")));
      return idx.some((v, k) => k > 0 && v < idx[k - 1]);
    })
    .map((w) => ({ when: { kind: "order", items: w.items }, title: w.title, say: w.say }));
  return {
    instruction: o.instruction,
    text: o.text,
    answer: o.label ? { kind: "order", items: o.items, label: o.label } : { kind: "order", items: o.items },
    hint: o.hint,
    solution: o.solution,
    mistakes: mistakesList,
  };
}

/** A "match" task: right pairs plus extra options; mistakes as wrong pairs. */
export function matchTask(o: {
  instruction: Text;
  text: Text;
  pairs: [Text, Text][];
  distractors?: Text[];
  hint: Text;
  solution: Frame[];
  wrong?: { pairs: [Text, Text][]; title: Text; say: Text }[];
  label?: Text;
}): Exercise {
  const en = (t: Text) => resolveText(t, "en");
  const lefts = o.pairs.map((p) => en(p[0]));
  const rights = [...o.pairs.map((p) => en(p[1])), ...(o.distractors ?? []).map(en)];
  const mistakesList: Mistake[] = (o.wrong ?? [])
    .filter((w) => w.pairs.every(([l, r]) => lefts.includes(en(l)) && rights.includes(en(r))))
    .filter((w) => w.pairs.some(([l, r]) => en(o.pairs.find((p) => en(p[0]) === en(l))![1]) !== en(r)))
    .map((w) => ({ when: { kind: "match", pairs: w.pairs }, title: w.title, say: w.say }));
  const answer: AnswerSpec = { kind: "match", pairs: o.pairs, ...(o.distractors?.length ? { distractors: o.distractors } : {}), ...(o.label ? { label: o.label } : {}) };
  return { instruction: o.instruction, text: o.text, answer, hint: o.hint, solution: o.solution, mistakes: mistakesList };
}

/** A frame that shows a short answer in words: '"Dünndarm"'. */
export const sayFrame = (answer: Text, note: Text): Frame => ({ math: quote(answer), note });

/** Wraps words in quotes for the display language (both languages). */
export function quote(t: Text): Text {
  if (typeof t === "string") return `"${t}"`;
  return { en: `"${t.en}"`, de: `"${t.de}"` };
}

/** "a → b → c" in the display language, both languages. */
export function chain(items: Text[], arrow = "\\to"): Text {
  const en = items.map((t) => `"${resolveText(t, "en")}"`).join(` ${arrow} `);
  const de = items.map((t) => `"${resolveText(t, "de")}"`).join(` ${arrow} `);
  return en === de ? en : { en, de };
}

/** Plain bilingual text join helper. */
export const both = (en: string, de: string) => tx(en, de);
