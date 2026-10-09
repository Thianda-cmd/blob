"use client";

import { Undo2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import type { CvChange } from "../types";

/** Something removed or replaced: what the toast says, and how to put it back into the current CV. */
type Undoable = { message: string; restore: (cv: Cv) => Cv };
type Pending = Undoable & { key: number };

const UndoContext = createContext<(u: Undoable) => void>(() => {});

/** Offer to undo a removal: `offerUndo({ message: t.removed(title), restore: (cv) => … })`. */
export const useOfferUndo = () => useContext(UndoContext);

/**
 * Holds the last removal and shows "„Praktikum“ entfernt · Rückgängig" at the bottom of the form
 * column for a few seconds. Restoring puts the item back into the CV as it is now, so edits made in
 * the meantime are kept.
 */
export function UndoProvider({ change, children }: { change: CvChange; children: ReactNode }) {
  const t = useMessages(cvFormText);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), 7000);
    return () => clearTimeout(timer);
  }, [pending]);

  // Stable, so offering undo never re-renders the (memoised) cards.
  const offer = useCallback((u: Undoable) => setPending({ ...u, key: Date.now() }), []);
  const undo = () => {
    if (!pending) return;
    change(pending.restore);
    setPending(null);
  };

  return (
    <UndoContext.Provider value={offer}>
      {children}
      {/* Sticks to the bottom of the form column while it scrolls. */}
      {/* On phones Blob sits in the bottom-right corner: the toast keeps to the left of it. */}
      <div className="pointer-events-none sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-2 pt-3 max-sm:justify-start max-sm:pr-20">
        <AnimatePresence>
          {pending && (
            <motion.div
              key={pending.key}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              className="pointer-events-auto flex max-w-full items-center gap-1 rounded-xl border border-line bg-raised py-1 pl-3.5 pr-1 text-[13px] text-ink shadow-pop"
              role="status"
            >
              {/* Two lines on a phone, so "„Nebenjobs & Erfahrung“ entfernt" keeps its last word. */}
              <span className="line-clamp-2 min-w-0 py-1 leading-snug">{pending.message}</span>
              <button
                type="button"
                onClick={undo}
                className="ml-1 flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-medium text-blob-ink transition-colors hover:bg-blob-soft"
              >
                <Undo2 className="size-3.5" /> {t.undo}
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                // Phones: the toast goes by itself, and the message needs the room.
                className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink max-sm:hidden"
                aria-label={t.dismiss}
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </UndoContext.Provider>
  );
}
