import { resolveText } from "@/i18n/text";
import type { AtlasView, Question } from "./types";

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

/** A round of questions. `focus`: only these items (practising mistakes), plus the textbook questions missed. */
export function makeRound(view: AtlasView, opts: { focus?: string[]; missedMc?: number[] } = {}): QuizQuestion[] {
  const mc = (view.questions ?? []).map((question, index) => ({ kind: "mc" as const, question, index, order: shuffle(question.options.map((_, i) => i)) }));
  const focus = opts.focus?.length || opts.missedMc?.length ? new Set(opts.focus ?? []) : null;
  const mcPool = focus ? mc.filter((q) => opts.missedMc?.includes(q.index)) : mc;
  const out: QuizQuestion[] = [];

  if (view.kind === "parts") {
    const ids = view.parts.map((p) => p.id);
    const parts = shuffle(focus ? view.parts.filter((p) => focus.has(p.id)) : view.parts);
    const size = focus ? Math.max(parts.length + mcPool.length, 1) : Math.min(8, ids.length + mcPool.length);
    const textbook = shuffle(mcPool).slice(0, focus ? mcPool.length : Math.min(mcPool.length, Math.max(1, Math.round(size / 4))));
    // Turn by turn: find by name, then by what it does, then name it; parts without a clue get found by name.
    const kinds = ["find", "clue", "name"] as const;
    parts.forEach((p, i) => {
      if (out.length >= size - textbook.length) return;
      const kind = kinds[i % 3];
      if (kind === "clue" && p.info.clue) out.push({ kind: "clue", part: p.id });
      else if (kind === "name" && ids.length >= 4) out.push({ kind: "name", part: p.id, options: shuffle([p.id, ...pickOthers(ids, p.id, 3)]) });
      else out.push({ kind: "find", part: p.id });
    });
    // Practising few mistakes: ask each of them a second way too.
    if (focus && parts.length < 4)
      parts.forEach((p) => out.push(p.info.clue ? { kind: "clue", part: p.id } : { kind: "name", part: p.id, options: shuffle([p.id, ...pickOthers(ids, p.id, Math.min(3, ids.length - 1))]) }));
    return interleave(out, textbook);
  }

  if (view.kind === "steps") {
    const n = view.steps.length;
    const all = view.steps.map((_, i) => i);
    const steps = shuffle(focus ? all.filter((i) => focus.has(String(i))) : all);
    if (!focus && n >= 3) out.push({ kind: "order", items: shuffle(n <= 6 ? all : contiguous(all, 5)) });
    const which = steps.slice(0, focus ? steps.length : 3);
    which.forEach((s) => out.push({ kind: "which", step: s, options: shuffle([s, ...pickOthers(all, s, Math.min(3, n - 1))]) }));
    const textbook = shuffle(mcPool).slice(0, focus ? mcPool.length : Math.max(0, 7 - out.length));
    return interleave(out, textbook);
  }

  // Timeline
  const events = view.events;
  const pool = shuffle(focus ? events.filter((e) => focus.has(e.id)) : events);
  const whoOf = (id: string) => resolveText(events.find((e) => e.id === id)!.who, "en");
  pool.slice(0, focus ? pool.length : 6).forEach((e, i) => {
    if (i % 2 === 0) {
      // Other people only: two milestones of the same person would make two right answers.
      const others = shuffle(events.filter((o) => whoOf(o.id) !== whoOf(e.id)))
        .filter((o, k, list) => list.findIndex((x) => whoOf(x.id) === whoOf(o.id)) === k)
        .slice(0, 3);
      out.push({ kind: "who", event: e.id, options: shuffle([e.id, ...others.map((o) => o.id)]) });
    } else {
      const others = shuffle(events.filter((o) => Math.abs(o.year - e.year) >= 3))
        .filter((o, k, list) => list.findIndex((x) => x.year === o.year) === k)
        .slice(0, 3);
      out.push({ kind: "when", event: e.id, options: [e, ...others].sort((a, b) => a.year - b.year).map((o) => o.id) });
    }
  });
  if (!focus) {
    const four = shuffle(events)
      .filter((e, k, list) => list.findIndex((x) => x.year === e.year) === k)
      .slice(0, 4);
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
