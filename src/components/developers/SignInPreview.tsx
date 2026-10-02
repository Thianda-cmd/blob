"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle } from "@/components/blob/Blob";
import { BlobMark } from "@/components/blob/BlobMark";
import { useMessages } from "@/i18n/client";
import { developersText } from "@/i18n/messages/developers";

/** The "Sign in with Blob" button as the SDK draws it, with a pretend sign-in to show the flow. */
export function SignInPreview() {
  const t = useMessages(developersText).hero;
  const blob = useRef<BlobHandle>(null);
  const [phase, setPhase] = useState<"out" | "busy" | "in">("out");

  useEffect(() => {
    if (phase === "out") return;
    // "busy" pretends to be the popup; once "in", Blob cheers (after the swap animation).
    const timer = setTimeout(() => (phase === "busy" ? setPhase("in") : blob.current?.celebrate()), phase === "busy" ? 900 : 450);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-line bg-raised p-5 shadow-pop sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t.preview}</span>
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-line-2" />
          <span className="size-2 rounded-full bg-line-2" />
          <span className="size-2 rounded-full bg-line-2" />
        </span>
      </div>

      <div className="mt-4 grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-line-2 bg-surface px-4 py-6">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "in" ? (
            <motion.div
              key="in"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="flex flex-col items-center text-center"
            >
              <Blob ref={blob} size={76} mood="excited" track={false} interactive={false} />
              <div className="mt-1 text-[12px] text-ink-3">{t.signedIn}</div>
              <div className="text-[15px] font-semibold">{t.demoName}</div>
              <button type="button" onClick={() => setPhase("out")} className="mt-2 rounded-lg px-2 py-1 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                {t.signOut}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="out"
              type="button"
              onClick={() => setPhase("busy")}
              disabled={phase === "busy"}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="relative inline-flex h-11 items-center justify-center gap-2.5 rounded-xl bg-blob pl-3.5 pr-4.5 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.12)] transition-colors hover:bg-blob-deep"
            >
              <span className={phase === "busy" ? "invisible inline-flex items-center gap-2.5" : "inline-flex items-center gap-2.5"}>
                <BlobMark size={20} className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.15)]" />
                {t.button}
              </span>
              {phase === "busy" && (
                <span className="absolute inset-0 grid place-items-center" aria-hidden>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="size-1.5 animate-bounce rounded-full bg-white" style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.8s" }} />
                    ))}
                  </span>
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-ink-3">{t.previewNote}</p>
    </div>
  );
}
