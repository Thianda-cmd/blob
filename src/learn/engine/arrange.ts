import { resolveText, tx, type Text } from "@/i18n/text";
import type { AnswerSpec, Feedback } from "@/learn/types";

type OrderSpec = Extract<AnswerSpec, { kind: "order" }>;
type MatchSpec = Extract<AnswerSpec, { kind: "match" }>;

/** Two texts are the same item when they read the same in English (the spec's own wording). */
export const sameText = (a: Text, b: Text) => resolveText(a, "en").trim() === resolveText(b, "en").trim();

/** A small, stable hash, so server and browser shuffle the same way. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A fixed shuffle of 0..n-1 for these items: the same on every render, never the solved order
 * (for two or more items).
 */
export function shuffled(n: number, key: string): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  let h = hash(key) || 1;
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (n > 1 && out.every((v, i) => v === i)) out.push(out.shift()!);
  return out;
}

const keyOf = (items: Text[]) => items.map((t) => resolveText(t, "en")).join("\u0001");

/** The order the student first sees for an "order" task. */
export const orderStart = (spec: OrderSpec) => shuffled(spec.items.length, keyOf(spec.items));

/** The right-hand options of a "match" task: the partners first, then the extra wrong ones. */
export const matchOptions = (spec: MatchSpec): Text[] => [...spec.pairs.map((p) => p[1]), ...(spec.distractors ?? [])];

/** The order the right-hand options are shown in. */
export const matchShown = (spec: MatchSpec) => {
  const options = matchOptions(spec);
  return shuffled(options.length, keyOf(options));
};

/** Checks an order: `order` lists the items' indices (in spec.items) as the student arranged them. */
export function checkOrder(spec: OrderSpec, order: number[]): Feedback {
  const n = spec.items.length;
  if (order.length !== n) return { correct: false };
  const right = order.filter((v, i) => v === i).length;
  if (right === n) return { correct: true };
  const wrong = order.map((v, i) => (v === i ? -1 : i)).filter((i) => i >= 0);
  const swapped = wrong.length === 2 && order[wrong[0]] === wrong[1] && order[wrong[1]] === wrong[0];
  if (swapped) {
    return {
      correct: false,
      partial: true,
      title: tx("Two swapped", "Zwei vertauscht"),
      message: tx("Almost! Only two of them are swapped. Which two?", "Fast! Nur zwei sind vertauscht. Welche zwei?"),
    };
  }
  return {
    correct: false,
    message: tx(
      `${right} of ${n} are in the right place. Think about what has to happen first.`,
      `${right} von ${n} stehen an der richtigen Stelle. Überleg, was zuerst passieren muss.`,
    ),
  };
}

/** Checks a matching: `picks[i]` is the index (in matchOptions) chosen for the i-th left item. */
export function checkMatch(spec: MatchSpec, picks: (number | null)[]): Feedback {
  const n = spec.pairs.length;
  if (picks.length !== n || picks.some((p) => p === null)) return { correct: false, message: tx("Give every card a partner.", "Gib jeder Karte einen Partner.") };
  const wrong = picks.map((p, i) => (p === i ? -1 : i)).filter((i) => i >= 0);
  if (!wrong.length) return { correct: true };
  const swapped = wrong.length === 2 && picks[wrong[0]] === wrong[1] && picks[wrong[1]] === wrong[0];
  return {
    correct: false,
    partial: wrong.length === 1 || swapped,
    title: wrong.length === 1 || swapped ? tx("Nearly all right", "Fast alles richtig") : undefined,
    message: swapped
      ? tx("Almost! Two partners are swapped.", "Fast! Zwei Partner sind vertauscht.")
      : tx(`${n - wrong.length} of ${n} pairs are right.`, `${n - wrong.length} von ${n} Paaren stimmen.`),
  };
}

/**
 * Does an order match a typical mistake? `when.items` is a sequence the mistake puts in this
 * order (e.g. [anaphase, metaphase]): it matches when the student's order has them in that order.
 */
export function orderShowsMistake(spec: OrderSpec, order: number[], when: OrderSpec): boolean {
  const idx = when.items.map((w) => spec.items.findIndex((it) => sameText(it, w)));
  if (idx.length < 2 || idx.some((i) => i < 0)) return false;
  const pos = idx.map((i) => order.indexOf(i));
  return pos.every((p, k) => p >= 0 && (k === 0 || p > pos[k - 1]));
}

/** Does a matching contain all the wrong pairs of a typical mistake (`when.pairs`)? */
export function matchShowsMistake(spec: MatchSpec, picks: (number | null)[], when: MatchSpec): boolean {
  const options = matchOptions(spec);
  if (!when.pairs.length) return false;
  return when.pairs.every(([left, right]) => {
    const i = spec.pairs.findIndex((p) => sameText(p[0], left));
    const j = options.findIndex((o) => sameText(o, right));
    return i >= 0 && j >= 0 && picks[i] === j;
  });
}
