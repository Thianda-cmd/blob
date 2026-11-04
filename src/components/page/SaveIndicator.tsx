"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, CloudAlert, CloudOff, TriangleAlert } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { cn } from "@/lib/utils";
import type { SaveState } from "./useAutosave";

/** Not saved, and the person should know: in red, with its words on phones too. */
const PROBLEM = new Set<SaveState>(["error", "failed", "refused", "tooBig"]);

export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useMessages(pageText);
  const label = {
    saved: t.saved,
    pending: t.saving,
    saving: t.saving,
    error: t.offline,
    device: t.onDevice,
    failed: t.notSavedRetrying,
    refused: t.notSaved,
    tooBig: t.tooBigToSave,
  }[state];
  const problem = PROBLEM.has(state);
  // Phones show a problem in fewer words where it is long, so the page's buttons beside it stay on
  // screen (the icon tells "trying again" from "can't save", the editor says below the bar what to
  // do; the full words are in the tooltip and for screen readers).
  const short = state === "failed" ? t.notSaved : state === "tooBig" ? t.tooBigShort : label;
  return (
    <div className="flex h-7 items-center gap-1.5 px-1.5 text-[12px] text-ink-3" aria-live="polite" title={label}>
      <AnimatePresence mode="wait" initial={false}>
        {state === "saved" ? (
          <motion.span key="saved" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }}>
            <Check className="size-3.5 text-ok" strokeWidth={2.5} />
          </motion.span>
        ) : state === "error" || state === "device" ? (
          // The connection (most likely): a cloud that can't be reached.
          <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CloudOff className={state === "error" ? "size-3.5 text-danger" : "size-3.5 text-ink-3"} />
          </motion.span>
        ) : state === "failed" ? (
          // The server had a problem with it (and it is tried again).
          <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CloudAlert className="size-3.5 text-danger" />
          </motion.span>
        ) : problem ? (
          // Saving can't work until something changes (access, size): what to do is said below the bar.
          <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TriangleAlert className="size-3.5 text-danger" />
          </motion.span>
        ) : (
          <motion.span key="saving" className="flex gap-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1 rounded-full bg-blob"
                animate={{ y: [0, -3, 0], scaleY: [1, 1.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
      {/* Phones keep just the icon (the label stays for screen readers); a failed save always says so. */}
      <span className={cn("whitespace-nowrap", problem ? "text-danger" : "max-sm:sr-only", short !== label && "max-sm:sr-only")}>{label}</span>
      {short !== label && (
        <span className="whitespace-nowrap text-danger sm:hidden" aria-hidden>
          {short}
        </span>
      )}
    </div>
  );
}
