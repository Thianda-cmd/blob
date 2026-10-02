"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { subjectColor } from "@/lib/subjects";
import type { SubjectColor } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A subject to create. `preset` is the English name of a suggestion (its name then follows the language). */
export type Picked = { name: string; emoji: string | null; color: SubjectColor; preset?: string };

/** A squishy, toggleable subject chip. */
export function SubjectChip({ subject, selected, onToggle }: { subject: Picked; selected: boolean; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      aria-pressed={selected}
      data-enter="submit"
      onClick={onToggle}
      whileTap={{ scaleX: 1.12, scaleY: 0.82 }}
      transition={{ type: "spring", stiffness: 520, damping: 13, mass: 0.7 }}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border pl-2.5 pr-3.5 text-[13.5px] font-medium outline-offset-2 transition-colors duration-150",
        selected
          ? "border-blob bg-blob-soft text-blob-ink shadow-[0_1px_0_color-mix(in_oklab,var(--blob)_30%,transparent)]"
          : "border-line bg-raised text-ink-2 shadow-card hover:border-line-2 hover:text-ink",
      )}
    >
      <motion.span layout="position" className="grid size-[18px] place-items-center text-[15px] leading-none">
        {subject.emoji ?? <span className="size-2.5 rounded-full" style={{ background: subjectColor(subject.color) }} />}
      </motion.span>
      <motion.span layout="position">{subject.name}</motion.span>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.span
            key="check"
            initial={{ width: 0, opacity: 0, scale: 0 }}
            animate={{ width: 14, opacity: 1, scale: 1 }}
            exit={{ width: 0, opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
            className="-mr-1 inline-grid place-items-center overflow-hidden"
          >
            <Check className="size-3.5 shrink-0" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
