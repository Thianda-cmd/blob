import { basePoints, type Margin, type Question, type SliderSpec } from "./model";

// Grading an answer and turning it into points. Points are Kahoot-like: a right answer is worth
// between half and all of the question's points, more the faster it came (worked out from when
// the server got it). Partly right answers (some of several right choices, a puzzle partly in
// order, a slider close by) get their share.

/** What a phone sends: chosen choice ids, typed text, an order of item ids or a number. */
export type PlayerAnswer = { kind: "choice"; ids: string[] } | { kind: "text"; text: string } | { kind: "order"; ids: string[] } | { kind: "value"; value: number };

/** The answer in a shape the question takes, or null when it doesn't fit (another type, unknown ids). */
export function parseAnswer(q: Question, raw: unknown): PlayerAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ids = new Set(q.choices.map((c) => c.id));
  const idList = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === "string" && ids.has(x)) ? [...new Set(v as string[])] : null);
  if (q.type === "quiz" || q.type === "truefalse" || q.type === "poll") {
    const list = idList(o.ids);
    if (o.kind !== "choice" || !list || !list.length) return null;
    if (!(q.type === "quiz" && q.multi) && list.length !== 1) return null;
    return { kind: "choice", ids: list };
  }
  if (q.type === "puzzle") {
    const list = idList(o.ids);
    if (o.kind !== "order" || !list || list.length !== q.choices.length) return null;
    return { kind: "order", ids: list };
  }
  if (q.type === "type") {
    if (o.kind !== "text" || typeof o.text !== "string") return null;
    const text = o.text.trim().slice(0, 60);
    return text ? { kind: "text", text } : null;
  }
  if (q.type === "slider" && q.slider) {
    if (o.kind !== "value" || typeof o.value !== "number" || !Number.isFinite(o.value)) return null;
    return { kind: "value", value: Math.min(q.slider.max, Math.max(q.slider.min, o.value)) };
  }
  return null;
}

/** For comparing typed answers: lower case, no accents, no punctuation, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Edits between two strings, giving up past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Whether typed text matches one of the accepted answers (one typo allowed from 5 letters, two from 10). */
export function textMatches(text: string, accepted: string[]): boolean {
  const t = normalizeText(text);
  if (!t) return false;
  return accepted.some((a) => {
    const n = normalizeText(a);
    if (!n) return false;
    if (n === t) return true;
    // Numbers must be exact.
    if (/^\d+$/.test(n)) return false;
    const allowed = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
    return allowed > 0 && distance(n, t, allowed) <= allowed;
  });
}

/** How far off a slider answer may be. */
export function sliderTolerance(s: Pick<SliderSpec, "min" | "max" | "margin">): number {
  const share: Record<Margin, number> = { none: 0, low: 0.05, medium: 0.1, high: 0.2, max: 1 };
  return (s.max - s.min) * share[s.margin];
}

/** How right an answer is, 0..1; null for questions that aren't graded (polls). */
export function grade(q: Question, a: PlayerAnswer): number | null {
  if (q.type === "poll") return null;
  if (a.kind === "choice") {
    const right = new Set(q.choices.filter((c) => c.correct).map((c) => c.id));
    if (!right.size) return 0;
    if (!(q.type === "quiz" && q.multi)) return right.has(a.ids[0]) ? 1 : 0;
    const hits = a.ids.filter((id) => right.has(id)).length;
    const misses = a.ids.length - hits;
    return Math.max(0, (hits - misses) / right.size);
  }
  if (a.kind === "order") {
    const n = q.choices.length;
    if (!n) return 0;
    const inPlace = a.ids.filter((id, i) => q.choices[i]?.id === id).length;
    return inPlace === n ? 1 : (inPlace / n) * 0.5;
  }
  if (a.kind === "text") return textMatches(a.text, q.accepted) ? 1 : 0;
  if (a.kind === "value" && q.slider) {
    const tol = sliderTolerance(q.slider);
    const off = Math.abs(a.value - q.slider.value);
    if (off <= q.slider.step / 2) return 1;
    if (!tol || off > tol) return 0;
    // Inside the margin: from 1 right on it down to half at its edge.
    return 1 - (off / tol) * 0.5;
  }
  return 0;
}

/** Points for an answer that is `fraction` right and came `ms` after the answers opened. */
export function speedPoints(q: Pick<Question, "points" | "type" | "time">, fraction: number | null, ms: number): number {
  const base = basePoints(q);
  if (!base || !fraction) return 0;
  const limit = q.time * 1000;
  const late = Math.min(1, Math.max(0, ms / limit));
  return Math.round(base * fraction * (1 - late / 2));
}

/** Whether the answer counts as right (for streaks and the green screen). */
export const isRight = (fraction: number | null) => fraction !== null && fraction >= 0.999;
