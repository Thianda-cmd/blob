"use client";

// The spreadsheet's notices (notice.ts) as a card at the bottom of the editor, just above the sheet
// tabs and the status bar (so Summe and Mittelwert stay readable), over the grid and the templates;
// with settings docked at the bottom (phones, tablets held upright), just above them, so their
// buttons stay free. It goes by itself after a while, stays while the pointer rests on it or the
// keyboard is in it, and closes with its button or Escape.
//
// Screen readers hear each notice once, from the two live regions (polite, or at once for
// problems); the card repeats the words for the eyes only, next to its close button. A notice with
// a button also says that F6 gets there (the grid keeps Tab; SheetEditor makes it one of its parts).

import { CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useMessages } from "@/i18n/client";
import { sheetText } from "@/i18n/messages/sheet";
import { cn } from "@/lib/utils";
import { focusGrid } from "./chrome/parts";
import { hideSheetNotice, holdSheetNotice, useSheetNotice, type SheetNotice, type SheetNoticeTone } from "./notice";
import type { SheetStore } from "./store";

const ICONS: Record<SheetNoticeTone, ReactNode> = {
  info: <Info className="text-blob-ink" />,
  done: <CircleCheck className="text-ok" />,
  busy: <LoaderCircle className="text-ink-3 motion-safe:animate-spin" />,
  error: <TriangleAlert className="text-danger" />,
};

/**
 * Above the tabs row, or above the docked settings when they reach higher (--sheet-foot and
 * --sheet-dock, set by SheetEditor); with tall settings, at most up to the top of the editor.
 */
const BOTTOM = "min(calc(max(var(--sheet-foot, 0px), var(--sheet-dock, 0px)) + 12px), calc(100% - 7rem))";

export function SheetNotices({ store }: { store: SheetStore }): ReactNode {
  const notice = useSheetNotice(store);
  const t = useMessages(sheetText);
  const polite = notice && notice.tone !== "error" ? notice : null;
  const urgent = notice?.tone === "error" ? notice : null;
  const spoken = (n: SheetNotice) => (n.action ? `${n.text} ${t.noticeActionKey(n.action.label)}` : n.text);

  // The card with the keyboard in it goes (closed, or replaced by a newer one): the keyboard goes
  // back to the cells, not to the top of the page.
  const root = useRef<HTMLDivElement>(null);
  const shownId = notice?.id;
  useEffect(() => {
    const at = document.activeElement;
    const card = at instanceof HTMLElement ? at.closest<HTMLElement>("[data-sheet-notice-id]") : null;
    if (card && root.current?.contains(card) && card.dataset.sheetNoticeId !== String(shownId)) focusGrid();
  }, [shownId]);

  return (
    <div ref={root} className="pointer-events-none absolute inset-x-0 z-[45] grid grid-cols-[minmax(0,1fr)] justify-items-center px-3" style={{ bottom: BOTTOM }}>
      {/* A new element for each notice, so the same words twice in a row are said twice. */}
      <div role="status" className="sr-only">
        {polite && <span key={polite.id}>{spoken(polite)}</span>}
      </div>
      <div role="alert" className="sr-only">
        {urgent && <span key={urgent.id}>{spoken(urgent)}</span>}
      </div>
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            data-sheet-notice={notice.tone}
            data-sheet-notice-id={notice.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            // Pointer and keyboard each hold it; it counts down again once both have left.
            onPointerEnter={() => holdSheetNotice(store, notice.id, true)}
            onPointerLeave={(e) => {
              if (!e.currentTarget.contains(document.activeElement)) holdSheetNotice(store, notice.id, false);
            }}
            onFocus={() => holdSheetNotice(store, notice.id, true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !e.currentTarget.matches(":hover")) holdSheetNotice(store, notice.id, false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              hideSheetNotice(store, notice.id);
            }}
            // One cell for all cards: a new one takes the old one's place while that fades out.
            className={cn(
              "pointer-events-auto flex w-max max-w-[min(30rem,100%)] items-start gap-2.5 rounded-xl border bg-raised py-2 pl-3 pr-1.5 text-[13px] leading-snug text-ink shadow-pop [grid-area:1/1] [@media(hover:none)]:text-[14px] [&_svg]:size-4 [&_svg]:shrink-0",
              notice.tone === "error" ? "border-danger/35" : "border-line",
            )}
          >
            <span aria-hidden className="mt-[3px] flex">
              {ICONS[notice.tone]}
            </span>
            <div className="min-w-0 flex-1 py-px">
              <p aria-hidden>{notice.text}</p>
              {/* A one-click correction ("Als 1,234 lesen"), under the words so they keep their width on phones. */}
              {notice.action && (
                <button
                  type="button"
                  data-sheet-notice-action=""
                  onClick={notice.action.run}
                  className="-ml-1.5 mt-1 h-7 rounded-md px-1.5 text-[13px] font-medium text-blob-ink outline-none transition-colors hover:bg-blob-soft focus-visible:ring-2 focus-visible:ring-blob [@media(hover:none)]:h-9 [@media(hover:none)]:text-[14px]"
                >
                  {notice.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => hideSheetNotice(store, notice.id)}
              aria-label={t.noticeClose}
              className="-my-0.5 grid size-7 shrink-0 place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-blob [@media(hover:none)]:size-9 [&_svg]:!size-3.5"
            >
              <X />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
