// Spaced repetition with Leitner boxes (card_reviews, migration 0010). Box 0 is new or forgotten;
// each card you know moves one box up and waits longer; a card you didn't know starts over.

/** Days until a card in each box is due again (box 0: today, box 6: a month). */
export const INTERVALS = [0, 1, 2, 4, 7, 14, 30] as const;
export const MAX_BOX = 6;

/** A switched-off card waits until this day (it never comes up). */
export const SUSPENDED = "9999-12-31";

/** A card_reviews row. */
export type Review = { card_id: string; box: number; due_on: string; reviews: number; lapses: number; last_reviewed: string | null };

/** Today in the student's own time zone as yyyy-mm-dd. */
export function today(now = new Date()): string {
  return dayString(now);
}

export function dayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayString(new Date(y, m - 1, d + n));
}

export type CardState = "new" | "due" | "later" | "off";

/** Where a card stands for the student today. */
export function cardState(review: Review | undefined, day: string): CardState {
  if (!review) return "new";
  if (review.due_on >= SUSPENDED) return "off";
  if (review.reviews === 0) return "new";
  return review.due_on <= day ? "due" : "later";
}

/** The row after an answer. */
export function answer(review: Review | undefined, cardId: string, knew: boolean, day: string, now = new Date()): Review {
  const box = review && review.due_on < SUSPENDED ? review.box : 0;
  const reviews = (review?.reviews ?? 0) + 1;
  const lapses = (review?.lapses ?? 0) + (!knew && box > 0 ? 1 : 0);
  const next = knew ? Math.min(MAX_BOX, box + 1) : 0;
  return { card_id: cardId, box: next, due_on: addDays(day, INTERVALS[next]), reviews, lapses, last_reviewed: now.toISOString() };
}

/** Switch a card off (or on again: it is due today, keeping its box). */
export function setSuspended(review: Review | undefined, cardId: string, off: boolean, day: string): Review {
  const base: Review = review ?? { card_id: cardId, box: 0, due_on: day, reviews: 0, lapses: 0, last_reviewed: null };
  return { ...base, card_id: cardId, due_on: off ? SUSPENDED : day };
}

/** "Sicher" once a card sits in box 4 or higher (a week or more). */
export const known = (review: Review | undefined) => Boolean(review && review.due_on < SUSPENDED && review.box >= 4);
