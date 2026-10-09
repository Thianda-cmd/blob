// A quiz from a note's cards: multiple choice (wrong answers come from other terms of the note, or
// of the student's other notes in the same language), fill-in-the-gap, dates and "true or false".
// Shuffled with a seed, so one round stays the same while it is played.

import { plain, type Line } from "../doc";
import { answerKey, seeded, shuffle, type Lang } from "../text";
import type { Card } from "./cards";

/** What a question asks; the screen says it in the reader's language. */
export type QuizAsk = "term" | "meaning" | "column" | "cloze" | "date" | "formula" | "truefalse";

type Base = { id: string; ask: QuizAsk; prompt: Line[]; column?: string; card: Card };
export type Question =
  | (Base & { kind: "choice"; options: Line[]; correct: number })
  | (Base & { kind: "type"; answer: string })
  | (Base & { kind: "truefalse"; statement: Line[]; truth: boolean });

/** Answers from the student's other notes ("def", "date", "col:funktion"…), with their note's language. */
export type Pool = { term: string; meaning: string; group: string; lang: Lang }[];

/** A possible wrong answer: from this note (best), with its section. */
type Option = { text: string; local: boolean; context?: string };

const MIN_WRONG = 2;

/** Plausible wrong years near the right one ("1918" → 1915, 1919, 1923…). */
function nearbyDates(date: string, rand: () => number): string[] {
  const y = date.match(/\b(\d{3,4})\b/)?.[1];
  if (!y) return [];
  return shuffle([-6, -4, -3, -2, -1, 1, 2, 3, 5, 7], rand).map((d) => date.replace(y, String(Number(y) + d)));
}

/**
 * Wrong answers that look like the right one: from the same note and section first, of a similar
 * length, never the same answer twice.
 */
function wrongAnswers(right: string, options: Option[], context: string, rand: () => number, n = 3): string[] {
  const rightKey = answerKey(right);
  const len = right.length;
  const seen = new Set([rightKey]);
  return options
    .map((o) => {
      const ratio = o.text.length / Math.max(1, len);
      const score = (o.local ? 4 : 0) + (o.context && o.context === context ? 1 : 0) + (ratio > 0.4 && ratio < 2.5 ? 1.5 : 0) + rand();
      return { o, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ o }) => o.text)
    .filter((t) => {
      const k = answerKey(t);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, n);
}

/**
 * Up to `count` questions, one per card. `lang` is the note's language: answers from other notes
 * only count when they are in the same language.
 */
export function makeQuiz(cards: Card[], pool: Pool = [], opts: { seed?: number; count?: number; lang?: Lang } = {}): Question[] {
  const rand = seeded(opts.seed ?? 1);
  const count = opts.count ?? 10;
  const foreign = pool.filter((p) => !opts.lang || p.lang === opts.lang);

  const peers = (c: Card) => cards.filter((o) => o !== c && o.group && o.group === c.group && o.term && o.meaning);
  const termOptions = (c: Card): Option[] => [
    ...peers(c).map((o) => ({ text: o.term!, local: true, context: o.context })),
    ...foreign.filter((p) => p.group === c.group).map((p) => ({ text: p.term, local: false })),
  ];
  const meaningOptions = (c: Card): Option[] => [
    ...peers(c).map((o) => ({ text: o.meaning!, local: true, context: o.context })),
    ...foreign.filter((p) => p.group === c.group).map((p) => ({ text: p.meaning, local: false })),
  ];

  const choice = (c: Card, ask: QuizAsk, prompt: Line[], right: string, options: Option[], math = false, column?: string): Question | null => {
    const wrong = wrongAnswers(right, options, c.context, rand);
    if (wrong.length < MIN_WRONG) return null;
    const all = shuffle([right, ...wrong], rand);
    return { id: `${ask}-${c.id}`, kind: "choice", ask, prompt, card: c, column, options: all.map((t) => [{ text: t, ...(math && { math: true }) }]), correct: all.indexOf(right) };
  };

  const perCard: { main: Question[]; tf: Question[] }[] = [];
  for (const c of cards) {
    const main: Question[] = [];
    const tf: Question[] = [];
    if (c.source === "cloze" && c.answer) {
      // Short answers are typed (real recall); every gap can also be picked from the note's other terms.
      if (c.answer.split(/\s+/).length <= 2 && c.answer.length <= 24) main.push({ id: `type-${c.id}`, kind: "type", ask: "cloze", prompt: c.front, card: c, answer: c.answer });
      const others: Option[] = [
        ...cards.filter((o) => o !== c && (o.answer || (o.term && o.group === "def"))).map((o) => ({ text: o.answer ?? o.term!, local: true, context: o.context })),
        ...foreign.filter((p) => p.group === "def").map((p) => ({ text: p.term, local: false })),
      ];
      const mc = choice(c, "cloze", c.front, c.answer, others);
      if (mc) main.push(mc);
    } else if (c.term && c.meaning && c.group === "date") {
      const options = [...meaningOptions(c), ...nearbyDates(c.meaning, rand).map((text) => ({ text, local: false }))];
      const q = choice(c, "date", c.front, c.meaning, options);
      if (q) main.push(q);
    } else if (c.term && c.meaning && c.group?.startsWith("col:") && c.prompt) {
      const q = choice(c, "column", c.front, c.meaning, meaningOptions(c), false, c.prompt);
      if (q) main.push(q);
    } else if (c.group === "formula" && c.term) {
      const src = c.back[0]?.[0]?.text ?? "";
      const others = cards.filter((o) => o !== c && o.group === "formula").map((o) => ({ text: o.back[0]?.[0]?.text ?? "", local: true }));
      const q = choice(c, "formula", c.front, src, others, true);
      if (q) main.push(q);
    } else if (c.term && c.meaning) {
      const byTerm = choice(c, "term", c.back, c.term, termOptions(c));
      if (byTerm) main.push(byTerm);
      if (c.meaning.length <= 110) {
        const byMeaning = choice(c, "meaning", c.front, c.meaning, meaningOptions(c).filter((o) => o.text.length <= 110));
        if (byMeaning) main.push(byMeaning);
      }
      // True or false: the right meaning, or the meaning of another term of this note.
      const wrong = wrongAnswers(c.meaning, peers(c).map((o) => ({ text: o.meaning!, local: true, context: o.context })), c.context, rand, 1)[0];
      if (wrong) {
        const truth = rand() < 0.5;
        tf.push({ id: `tf-${c.id}`, kind: "truefalse", ask: "truefalse", prompt: c.front, card: c, statement: [[{ text: truth ? c.meaning : wrong }]], truth });
      }
    } else if (c.source === "question" || c.source === "toggle" || c.source === "flashcard" || c.source === "list") {
      // Open questions: "true or false" with the answer of another open question of this note.
      const others = cards.filter((o) => o !== c && ["question", "toggle", "flashcard", "list"].includes(o.source));
      const other = others.length ? others[Math.floor(rand() * others.length)] : null;
      if (other && c.back.map(plain).join(" ").length < 300 && other.back.map(plain).join(" ").length < 300) {
        const truth = rand() < 0.5;
        tf.push({ id: `tf-${c.id}`, kind: "truefalse", ask: "truefalse", prompt: c.front, card: c, statement: truth ? c.back : other.back, truth });
      }
    }
    if (main.length || tf.length) perCard.push({ main, tf });
  }

  // One question per card, in a random order; at most a third "true or false" while there are others.
  const maxTf = Math.max(1, Math.round(count / 3));
  const picked: Question[] = [];
  const later: Question[] = [];
  let tfCount = 0;
  for (const c of shuffle(perCard, rand)) {
    if (picked.length >= count) break;
    const main = c.main.length ? c.main[Math.floor(rand() * c.main.length)] : null;
    const alt = c.tf[0] ?? null;
    if (main && (!alt || tfCount >= maxTf || rand() < 0.75)) {
      picked.push(main);
      if (alt) later.push(alt);
    } else if (alt && tfCount < maxTf) {
      picked.push(alt);
      tfCount++;
    } else if (alt) later.push(alt);
  }
  // Few cards: fill up with "true or false" questions held back (each card still asked once).
  const asked = new Set(picked.map((q) => q.card.id));
  picked.push(...later.filter((q) => !asked.has(q.card.id)).slice(0, Math.max(0, count - picked.length)));
  return picked;
}
