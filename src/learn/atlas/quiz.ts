import { resolveText, type Text } from "@/i18n/text";
import type { AtlasView, EventInfo, PartInfo, Question } from "./types";

/**
 * Quiz questions for a view. Parts: find a structure by name or by what it does, or name the
 * marked one. Steps: which step is shown, and the whole order. Timeline: who, when, and which
 * came first. Every view can add multiple-choice questions from the textbook.
 */
export type QuizQuestion =
  | { kind: "find"; part: string }
  | { kind: "clue"; part: string }
  | { kind: "name"; part: string; options: string[] }
  | { kind: "mc"; question: Question; index: number; order: number[] }
  | { kind: "which"; step: number; options: number[] }
  | { kind: "order"; items: number[] }
  | { kind: "who"; event: string; options: string[] }
  | { kind: "when"; event: string; options: string[] }
  | { kind: "chrono"; events: string[] };

/** What a question was about, to look at again after a mistake ("<view>/<item>", or null for textbook questions). */
export function itemOf(q: QuizQuestion): string | null {
  switch (q.kind) {
    case "find":
    case "clue":
    case "name":
      return q.part;
    case "which":
      return String(q.step);
    case "who":
    case "when":
      return q.event;
    default:
      return null;
  }
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickOthers = <T>(all: T[], not: T, n: number) => shuffle(all.filter((x) => x !== not)).slice(0, n);

/** The ids a question is "about", so one round doesn't ask the same thing twice. */
const aboutOf = (q: QuizQuestion) => (q.kind === "mc" ? `mc${q.index}` : (itemOf(q) ?? q.kind));

/** A step's title as a quiz answer: without a leading "1. ", which would give the order away (Koch's postulates). */
export const stepLabel = (title: Text): Text => {
  const strip = (s: string) => s.replace(/^\d+\.\s+/, "");
  return typeof title === "string" ? strip(title) : { en: strip(title.en), de: strip(title.de) };
};

/** The people behind a milestone: "Robert Koch, Fanny Hesse" is Robert Koch and Fanny Hesse. */
export function peopleOf(e: Pick<EventInfo, "who">): string[] {
  return resolveText(e.who, "en")
    .split(/,\s*|\s+and\s+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Every year a milestone's label shows: "1884/1890" is 1884 and 1890, "1881/82" is 1881 and 1882. */
export function yearsOf(e: Pick<EventInfo, "year" | "when">): number[] {
  const years = [e.year];
  let century = Math.floor(e.year / 100) * 100;
  for (const [digits] of resolveText(e.when, "en").matchAll(/\d{2,4}/g)) {
    const y = digits.length === 2 ? century + Number(digits) : Number(digits);
    if (digits.length === 4) century = Math.floor(y / 100) * 100;
    if (!years.includes(y)) years.push(y);
  }
  return years;
}

/** Could two labels be mistaken for each other? (A shown year within 2 years of one in the other.) */
const yearsClash = (a: number[], b: number[]) => a.some((x) => b.some((y) => Math.abs(x - y) < 3));

/**
 * A round of questions. `focus`: only these items (practising mistakes), plus the textbook questions
 * missed; `order`: the ordering question was missed too, so ask a fresh one.
 */
export function makeRound(view: AtlasView, opts: { focus?: string[]; missedMc?: number[]; order?: boolean } = {}): QuizQuestion[] {
  const mc = (view.questions ?? []).map((question, index) => ({ kind: "mc" as const, question, index, order: shuffle(question.options.map((_, i) => i)) }));
  const focus = opts.focus?.length || opts.missedMc?.length || opts.order ? new Set(opts.focus ?? []) : null;
  const mcPool = focus ? mc.filter((q) => opts.missedMc?.includes(q.index)) : mc;
  const withOrder = !focus || !!opts.order;
  const out: QuizQuestion[] = [];

  if (view.kind === "parts") {
    const ids = view.parts.map((p) => p.id);
    const parts = shuffle(focus ? view.parts.filter((p) => focus.has(p.id)) : view.parts);
    const size = focus ? Math.max(parts.length + mcPool.length, 1) : Math.min(8, ids.length + mcPool.length);
    const textbook = shuffle(mcPool).slice(0, focus ? mcPool.length : Math.min(mcPool.length, Math.max(1, Math.round(size / 4))));
    // A question of this kind if the part allows it, else find it by name.
    const ask = (p: { id: string; info: PartInfo }, kind: "find" | "clue" | "name"): QuizQuestion => {
      if (kind === "clue" && p.info.clue) return { kind: "clue", part: p.id };
      if (kind === "name" && ids.length >= 4) return { kind: "name", part: p.id, options: shuffle([p.id, ...pickOthers(ids, p.id, 3)]) };
      return { kind: "find", part: p.id };
    };
    // Turn by turn: find by name, then by what it does, then name it.
    const kinds = ["find", "clue", "name"] as const;
    const first = new Map<string, QuizQuestion["kind"]>();
    parts.forEach((p, i) => {
      if (out.length >= size - textbook.length) return;
      const q = ask(p, kinds[i % 3]);
      first.set(p.id, q.kind);
      out.push(q);
    });
    // Practising few mistakes: ask each of them a second, different way too.
    if (focus && parts.length < 4)
      parts.forEach((p) => {
        const again = (["clue", "name", "find"] as const).map((k) => ask(p, k)).find((q) => q.kind !== first.get(p.id));
        if (again) out.push(again);
      });
    return interleave(out, textbook);
  }

  if (view.kind === "steps") {
    const n = view.steps.length;
    const all = view.steps.map((_, i) => i);
    const steps = shuffle(focus ? all.filter((i) => focus.has(String(i))) : all);
    if (withOrder && n >= 3) out.push({ kind: "order", items: shuffle(n <= 6 ? all : contiguous(all, 5)) });
    const which = steps.slice(0, focus ? steps.length : 3);
    which.forEach((s) => out.push({ kind: "which", step: s, options: shuffle([s, ...pickOthers(all, s, Math.min(3, n - 1))]) }));
    const textbook = shuffle(mcPool).slice(0, focus ? mcPool.length : Math.max(0, 7 - out.length));
    return interleave(out, textbook);
  }

  // Timeline
  const events = view.events;
  const pool = shuffle(focus ? events.filter((e) => focus.has(e.id)) : events);
  pool.slice(0, focus ? pool.length : 6).forEach((e, i) => {
    if (i % 2 === 0) {
      // Nobody twice: "Robert Koch" next to "Robert Koch, Fanny Hesse" would make two right answers.
      const taken = new Set(peopleOf(e));
      const others: string[] = [];
      for (const o of shuffle(events)) {
        if (others.length === 3) break;
        const people = peopleOf(o);
        if (people.some((p) => taken.has(p))) continue;
        people.forEach((p) => taken.add(p));
        others.push(o.id);
      }
      out.push({ kind: "who", event: e.id, options: shuffle([e.id, ...others]) });
    } else {
      // No year that could also be right: "1890" next to "1884/1890" (Koch's postulates) would be.
      const shown = [yearsOf(e)];
      const others: typeof events = [];
      for (const o of shuffle(events)) {
        if (others.length === 3) break;
        const ys = yearsOf(o);
        if (shown.some((s) => yearsClash(s, ys))) continue;
        shown.push(ys);
        others.push(o);
      }
      out.push({ kind: "when", event: e.id, options: [e, ...others].sort((a, b) => a.year - b.year).map((o) => o.id) });
    }
  });
  if (withOrder) {
    // Only milestones with one year: a label like "1977/1990" has no single place in the order.
    const four: typeof events = [];
    for (const e of shuffle(events.filter((x) => yearsOf(x).length === 1))) {
      if (four.length === 4) break;
      if (four.some((x) => x.year === e.year)) continue;
      four.push(e);
    }
    out.push({ kind: "chrono", events: shuffle(four.map((e) => e.id)) });
  }
  const textbook = shuffle(mcPool).slice(0, focus ? mcPool.length : 2);
  return interleave(out, textbook);
}

/** A run of `n` neighbours from a list (for long processes: order five steps in a row). */
function contiguous<T>(list: T[], n: number) {
  const start = Math.floor(Math.random() * (list.length - n + 1));
  return list.slice(start, start + n);
}

/** Spread the textbook questions through the round instead of bunching them at the end. */
function interleave(main: QuizQuestion[], extra: QuizQuestion[]) {
  const out = [...main];
  extra.forEach((q, i) => {
    const at = Math.round(((i + 1) * (out.length + 1)) / (extra.length + 1));
    out.splice(Math.min(at, out.length), 0, q);
  });
  // No two questions about the same thing back to back.
  for (let i = 1; i < out.length; i++) {
    if (aboutOf(out[i]) === aboutOf(out[i - 1]) && i + 1 < out.length) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  }
  return out;
}

/** XP per right answer (practice tasks give 10 to 18). */
export const QUIZ_XP = 4;
/** XP once for opening every structure, step and milestone of a model. */
export const EXPLORE_XP = 15;
