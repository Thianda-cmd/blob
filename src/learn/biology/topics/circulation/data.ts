// Shared helpers and vocabulary for the circulation topic (all three levels).

import type { ComponentType } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { check, type AnswerValue } from "@/learn/engine/answers";
import type { Rng } from "@/learn/engine/rng";
import { decText } from "@/learn/chemistry/format";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

export const en = (t: Text) => resolveText(t, "en");
export const de = (t: Text) => resolveText(t, "de");
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** English with a capital first letter (German nouns already have one). */
export const capT = (t: Text): Text => tx(cap(en(t)), cap(de(t)));
/** A number in both languages ("4.9" / "4,9"). */
export const num = (v: number, digits = 2) => decText(v, digits);

/** A task picture: any drawing component with its props. */
export function visual<P extends object>(component: ComponentType<P>, props: P): NonNullable<Exercise["visual"]> {
  return { component: component as unknown as ComponentType<Record<string, unknown>>, props: props as Record<string, unknown> };
}

/** A quoted word for display-language frames, with an animation key: "Aorta"#k. */
export const q = (t: Text, k: string): Text => tx(`"${en(t)}"#${k}`, `"${de(t)}"#${k}`);
/** Join display-language pieces (each may be bilingual). */
export const join = (...parts: Text[]): Text => tx(parts.map(en).join(" "), parts.map(de).join(" "));
/** One or two frames that show the answer and say why. */
export const answerFrames = (answer: Text, why: Text, first?: { math: Text; note: Text }): Frame[] => [
  ...(first ? [first] : []),
  { math: q(answer, "a"), note: why, highlight: ["a"] },
];

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
 * Collects typical mistakes for a task. A mistake is only kept when the checker would not
 * accept it as right and no earlier mistake already catches the same answer.
 */
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

/** Two options in a fixed order (e.g. oxygen-rich / oxygen-poor); `right` is the index of the right one. */
export function pairChoice(options: [Text, Text], right: 0 | 1, wrong?: { title: Text; say: Text }) {
  const answer: AnswerSpec = { kind: "choice", options, correct: right };
  const list: Mistake[] = wrong ? [{ when: { kind: "choice", options, correct: 1 - right }, title: wrong.title, say: wrong.say }] : [];
  return { answer, mistakes: list };
}

export type MultiItem = { text: Text; ok: boolean };
/** Shuffled options for "select all that apply"; `pick` turns a predicate into the indices it selects. */
export function multi(rng: Rng, items: MultiItem[]) {
  const shown = rng.shuffle(items);
  const options = shown.map((x) => x.text);
  const correct = shown.map((x, i) => (x.ok ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const pick = (f: (x: MultiItem) => boolean) => shown.map((x, i) => (f(x) ? i : -1)).filter((i) => i >= 0);
  return { answer, options, shown, correct, pick };
}

/** Rich-text list "a, b and c" in both languages. */
export function listText(items: Text[]): Text {
  const l = (lang: "en" | "de") => {
    const xs = items.map((t) => resolveText(t, lang));
    return xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${lang === "en" ? "and" : "und"} ${xs[xs.length - 1]}`;
  };
  return tx(l("en"), l("de"));
}

/** Frames listing the right items of a multi task, one quoted phrase each. */
export function multiFrames(head: Text, items: Text[], note: Text): Frame[] {
  return [
    { math: q(head, "h"), note },
    { math: tx(items.map((t, i) => `"${en(t)}"#c${i}`).join(" , "), items.map((t, i) => `"${de(t)}"#c${i}`).join(" , ")), note: tx("These are the right ones.", "Das sind die richtigen.") },
  ];
}

/** Frames for an order task: the items appear one after another, joined by arrows. */
export function orderFrames(items: Text[], notes: Text[]): Frame[] {
  return items.map((_, i) => ({
    math: tx(items.slice(0, i + 1).map((t, j) => `"${en(t)}"#s${j}`).join(" \\to "), items.slice(0, i + 1).map((t, j) => `"${de(t)}"#s${j}`).join(" \\to ")),
    note: notes[i],
    highlight: [`s${i}`],
  }));
}

/** Frames for the whole chain at once (for long chains): two frames, the chain split after `split` items. */
export function chainFrames(items: Text[], noteA: Text, noteB: Text, split = Math.ceil(items.length / 2)): Frame[] {
  const chain = (xs: Text[], from: number) => tx(xs.map((t, j) => `"${en(t)}"#s${from + j}`).join(" \\to "), xs.map((t, j) => `"${de(t)}"#s${from + j}`).join(" \\to "));
  return [
    { math: chain(items.slice(0, split), 0), note: noteA },
    { math: tx(`${en(chain(items.slice(0, split), 0))} \\to \\\\ ${en(chain(items.slice(split), split))}`, `${de(chain(items.slice(0, split), 0))} \\to \\\\ ${de(chain(items.slice(split), split))}`), note: noteB },
  ];
}

// ---------------------------------------------------------------------------
// Vocabulary used by more than one level

/** The way of the blood, once round, starting in the venae cavae. */
export const PATH: { id: string; name: Text; note: Text }[] = [
  { id: "vc", name: tx("Venae cavae", "Hohlvenen"), note: tx("Oxygen-poor blood from the body arrives through the venae cavae.", "Sauerstoffarmes Blut aus dem Körper kommt über die Hohlvenen an.") },
  { id: "ra", name: tx("Right atrium", "Rechter Vorhof"), note: tx("It collects in the right atrium.", "Es sammelt sich im rechten Vorhof.") },
  { id: "rv", name: tx("Right ventricle", "Rechte Herzkammer"), note: tx("Through the AV valve into the right ventricle.", "Durch die Segelklappe in die rechte Herzkammer.") },
  { id: "pa", name: tx("Pulmonary artery", "Lungenarterie"), note: tx("The right ventricle pumps it into the pulmonary artery: still oxygen-poor.", "Die rechte Kammer pumpt es in die Lungenarterie: noch sauerstoffarm.") },
  { id: "lc", name: tx("Lung capillaries", "Lungenkapillaren"), note: tx("In the lung capillaries it takes up oxygen and gives off carbon dioxide.", "In den Lungenkapillaren nimmt es Sauerstoff auf und gibt Kohlenstoffdioxid ab.") },
  { id: "pv", name: tx("Pulmonary veins", "Lungenvenen"), note: tx("Now oxygen-rich, it flows back to the heart in the pulmonary veins.", "Jetzt sauerstoffreich, fließt es in den Lungenvenen zurück zum Herzen.") },
  { id: "la", name: tx("Left atrium", "Linker Vorhof"), note: tx("Into the left atrium: the pulmonary circulation is done.", "In den linken Vorhof: Der Lungenkreislauf ist geschafft.") },
  { id: "lv", name: tx("Left ventricle", "Linke Herzkammer"), note: tx("Through the AV valve into the left ventricle, the strongest chamber.", "Durch die Segelklappe in die linke Herzkammer, die kräftigste Kammer.") },
  { id: "ao", name: tx("Aorta (main artery)", "Aorta (Hauptschlagader)"), note: tx("It pumps the blood into the aorta, the main artery.", "Sie pumpt das Blut in die Aorta, die Hauptschlagader.") },
  { id: "bc", name: tx("Body capillaries", "Körperkapillaren"), note: tx("In the body capillaries the blood gives oxygen to the cells and takes up carbon dioxide.", "In den Körperkapillaren gibt das Blut Sauerstoff an die Zellen ab und nimmt Kohlenstoffdioxid auf.") },
];
export const pathName = (id: string) => PATH.find((p) => p.id === id)!.name;
