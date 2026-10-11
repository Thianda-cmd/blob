import type { Transition } from "motion/react";

/**
 * How the calendar got to what it shows, for the way the grid comes in: null on the first paint
 * (it's just there), a step through time (it slides in from that side) or another view (it zooms:
 * in towards a day, out towards the month).
 */
export type Move = { dir: number; zoom: number } | null;

/** Day → month: further out. (The agenda sits between the week and the month.) */
export const ZOOM = { day: 0, three: 1, week: 2, agenda: 2.5, month: 3 } as const;

const slide: Transition = { type: "spring", stiffness: 420, damping: 38 };
const zoom: Transition = { type: "spring", stiffness: 360, damping: 34 };
const still = { x: 0, opacity: 1, scale: 1 };

/** Props for the motion element that holds a period's grid (keyed by the period). */
export function enter(move: Move) {
  if (!move) return { initial: false as const, animate: still };
  if (move.zoom) return { initial: { x: 0, opacity: 0, scale: move.zoom > 0 ? 1.035 : 0.965 }, animate: still, transition: zoom };
  return { initial: { x: move.dir * 28, opacity: 0.4, scale: 1 }, animate: still, transition: slide };
}

/** A label that changes with the period: the new one rolls in from the side the calendar went. */
export const ticker = {
  enter: (dir: number) => ({ y: dir * 10, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: -dir * 10, opacity: 0 }),
};
