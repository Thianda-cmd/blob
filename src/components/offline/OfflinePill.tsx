"use client";

import { AnimatePresence, motion } from "motion/react";
import { CloudOff, CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { useOnline } from "@/lib/offline/net";
import { usePending } from "@/lib/offline/useSync";

/**
 * "Offline" (and how many changes wait on this device) in the top bar. Online with changes still
 * going out for a moment: a quiet "Saving…". Nothing otherwise.
 */
export function OfflinePill() {
  const t = useMessages(offlineText);
  const online = useOnline();
  const pending = usePending();
  // Changes on their way show only when they take a while (no flicker for every quick save).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!online || pending === 0) {
      queueMicrotask(() => setSlow(false));
      return;
    }
    const timer = setTimeout(() => setSlow(true), 1500);
    return () => clearTimeout(timer);
  }, [online, pending]);

  const show = !online || slow;
  const label = !online ? (pending ? `${t.offline} · ${t.waiting(pending)}` : t.offline) : t.sending;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key={online ? "sending" : "offline"}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-hover px-2.5 text-[11.5px] font-medium text-ink-2"
          title={online ? t.waitingHint : t.offlineHint}
          role="status"
        >
          {online ? <CloudUpload className="size-3.5 text-blob-ink" /> : <CloudOff className="size-3.5 text-ink-3" />}
          <span className="max-sm:hidden">{label}</span>
          {!online && pending > 0 && <span className="sm:hidden tabular-nums">{pending}</span>}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
