"use client";

// What filling by touch says ("Zieh das Quadrat …"): a card over the grid's cells that can be seen,
// right under the column letters or, when the selection is up there, at the bottom of what can be
// seen, so it never covers the fill square it talks about (placeFillHint); with too few rows in
// sight, over the column letters and the bar above them. Touches pass through it. It is not one of
// the sheet's notices: those sit at the bottom of what can be seen, which on a phone with docked
// settings is just where the square often is. It keeps clear of one showing there ("„1.234“ ist
// 1234 … Als 1,234 lesen" stays readable), and goes when one comes up later. A layer of its own
// (like the cell tip), so the grid's edges don't cut it; screen readers hear the words from the
// grid's live region.

import { SquareArrowDownRight } from "lucide-react";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeFillHint } from "./shown";

/**
 * Where the hint goes, in viewport coordinates: the cells that can be seen, and what it must not
 * cover (the selection down to the fill square and a finger's room around it, and the notice at
 * the bottom of the editor from `floor` down, null when none shows over the cells).
 */
export type FillHintPlace = { top: number; bottom: number; left: number; right: number; keep: { top: number; bottom: number }; floor: number | null };

export function FillHint({ text, place }: { text: string; place: FillHintPlace }): ReactNode {
  const box = useRef<HTMLDivElement>(null);
  // Placed before the first paint, once its height (two or three lines on a phone) is known.
  useLayoutEffect(() => {
    const el = box.current;
    if (el) el.style.top = `${placeFillHint(place, place.keep, el.offsetHeight)}px`;
  }, [place]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={box}
      aria-hidden
      data-sheet-fill-hint=""
      className="pointer-events-none fixed z-[45] flex justify-center px-3"
      style={{ top: -9999, left: place.left, width: Math.max(0, place.right - place.left) }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 34 }}
        className="flex w-max max-w-[min(28rem,100%)] items-start gap-2.5 rounded-xl border border-line bg-raised px-3 py-2 text-[13px] leading-snug text-ink shadow-pop [@media(hover:none)]:text-[14px]"
      >
        <SquareArrowDownRight className="mt-[3px] size-4 shrink-0 text-blob-ink" />
        <p>{text}</p>
      </motion.div>
    </div>,
    document.body,
  );
}
