"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, CloudOff } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import type { SaveState } from "./useAutosave";

export function SaveIndicator({ state }: { state: SaveState }) {
  const t = useMessages(pageText);
  const label = state === "error" ? t.offline : state === "saved" ? t.saved : t.saving;
  return (
    <div className="flex h-7 items-center gap-1.5 px-1.5 text-[12px] text-ink-3" aria-live="polite" title={label}>
      <AnimatePresence mode="wait" initial={false}>
        {state === "saved" ? (
          <motion.span key="saved" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 600, damping: 18 }}>
            <Check className="size-3.5 text-ok" strokeWidth={2.5} />
          </motion.span>
        ) : state === "error" ? (
          <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CloudOff className="size-3.5 text-danger" />
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
      <span className={state === "error" ? "text-danger" : "max-sm:sr-only"}>{label}</span>
    </div>
  );
}
