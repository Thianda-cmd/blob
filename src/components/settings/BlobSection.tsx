"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { settingsText } from "@/i18n/messages/settings";
import { cn } from "@/lib/utils";
import { Card, Section, Switch } from "./primitives";

export function BlobSection() {
  const { profile, setProfile } = useWorkspace();
  const t = useMessages(settingsText).blob;
  const on = profile.blob_tips;
  const ref = useRef<BlobHandle>(null);
  const [flash, setFlash] = useState<BlobMood | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function react(mood: BlobMood, text: string, ms = 1800) {
    clearTimeout(timer.current);
    setFlash(mood);
    setLine(text);
    timer.current = setTimeout(() => {
      setFlash(null);
      setLine(null);
    }, ms);
  }

  async function toggle(value: boolean) {
    if (value) {
      react("excited", t.back);
      setTimeout(() => ref.current?.jump(1.1), 60);
    } else {
      react("worried", t.nap, 1400);
      ref.current?.squish(1.2);
    }
    const ok = await setProfile({ blob_tips: value });
    if (ok && value) blob.say(t.hiAgain, { mood: "happy" });
  }

  const mood: BlobMood = flash ?? (on ? "happy" : "sleepy");

  return (
    <Section id="blob" title={t.title} description={t.description}>
      <Card>
        <div className="grid sm:grid-cols-[1fr_240px]">
          <div className="p-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <label htmlFor="blob-tips" className="text-[13.5px] font-medium">
                  {t.show}
                </label>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t.showHint}</p>
              </div>
              <Switch id="blob-tips" checked={on} onChange={toggle} label={t.show} />
            </div>
            <ul className="mt-4 space-y-1.5">
              {t.perks.map((perk) => (
                <li key={perk} className={cn("flex items-center gap-2 text-[13px] transition-colors", on ? "text-ink-2" : "text-ink-3")}>
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full transition-colors",
                      on ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-3",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex min-h-[170px] flex-col items-center justify-end overflow-hidden border-t border-line bg-paper pb-3 sm:border-l sm:border-t-0">
            <div className="bg-dots absolute inset-0 opacity-50" />
            <AnimatePresence>
              {line && (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
                  transition={{ type: "spring", stiffness: 520, damping: 26 }}
                  className="absolute top-3 z-10 rounded-xl border border-line bg-raised px-2.5 py-1 text-[12px] text-ink shadow-card"
                >
                  {line}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div
              animate={{ opacity: on ? 1 : 0.6, filter: on ? "saturate(1)" : "saturate(0.5)" }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <Blob
                ref={ref}
                size={104}
                mood={mood}
                title={t.preview}
                onClick={() => (on ? react("love", t.tickles) : react("surprised", t.huh, 1400))}
              />
            </motion.div>
            <span className="relative text-[11.5px] text-ink-3">{on ? t.awake : t.napping}</span>
          </div>
        </div>
      </Card>
    </Section>
  );
}
