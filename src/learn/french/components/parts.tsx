"use client";

import { AnimatePresence, motion } from "motion/react";
import { Snail, Volume2 } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { useLocale, useMessages } from "@/i18n/client";
import { frenchText } from "@/i18n/messages/french";
import type { Verdict } from "@/learn/french/text";
import type { Text } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { glossSegments } from "../glossary";
import { prefs, say } from "../speech";

/** What an exercise reports once it's answered. */
export type Outcome = {
  correct: boolean;
  verdict?: Verdict;
  /** The right answer, shown under "Correct solution" (and on a near miss). */
  solution?: string;
  /** Words of `solution` to highlight. */
  marks?: boolean[];
  /** What the solution means (after listening exercises). */
  meaning?: string;
  /** Blob's explanation of the mistake. */
  explain?: Text | null;
  /** Spelling or typo note on an answer that still counts. */
  note?: string;
  /** Skipped ("can't speak now"): neither right nor wrong. */
  skipped?: boolean;
};

/** Blob with his béret, and a speech bubble for what he says. */
export function BlobSays({
  children,
  mood = "happy",
  size = 92,
  blobRef,
  talking,
  className,
}: {
  children?: ReactNode;
  mood?: BlobMood;
  size?: number;
  blobRef?: RefObject<BlobHandle | null>;
  talking?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <div className="shrink-0">
        <Blob ref={blobRef} size={size} mood={mood} accessory="beret" talking={talking} className="max-sm:size-[76px]" />
      </div>
      {children && (
        <div className="relative mb-6 min-w-0 flex-1 rounded-2xl rounded-bl-md border-2 border-line bg-raised px-4 py-3 shadow-card">
          <span className="absolute -left-[9px] bottom-3 size-4 rotate-45 border-b-2 border-l-2 border-line bg-raised" />
          <div className="relative">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Listen buttons: normal speed and slow. `auto` plays once when it appears. */
export function PlayButtons({ text, auto, big, voice }: { text: string; auto?: boolean; big?: boolean; voice: boolean }) {
  const t = useMessages(frenchText).player;
  const [playing, setPlaying] = useState<"fast" | "slow" | null>(null);
  const once = useRef(false);

  async function play(slow: boolean) {
    setPlaying(slow ? "slow" : "fast");
    await say(text, { slow });
    setPlaying(null);
  }

  useEffect(() => {
    if (!auto || once.current || !voice || !prefs.soundOn()) return;
    once.current = true;
    const id = setTimeout(() => void play(false), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when it first shows
  }, [auto, voice]);

  if (!voice) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => void play(false)}
        aria-label={t.play}
        title={t.play}
        className={cn(
          "grid place-items-center rounded-xl bg-blob text-white shadow-[0_3px_0_var(--blob-deep)] transition-transform active:translate-y-[2px] active:shadow-none",
          big ? "size-16 rounded-2xl" : "size-10",
          playing === "fast" && "animate-pulse",
        )}
      >
        <Volume2 className={big ? "size-7" : "size-5"} />
      </button>
      <button
        type="button"
        onClick={() => void play(true)}
        aria-label={t.slow}
        title={t.slow}
        className={cn(
          "grid place-items-center rounded-xl border-2 border-line bg-raised text-blob-ink transition-colors hover:bg-hover",
          big ? "size-12" : "size-9",
          playing === "slow" && "animate-pulse",
        )}
      >
        <Snail className={big ? "size-5" : "size-4"} />
      </button>
    </span>
  );
}

/** A French sentence whose words show their meaning when tapped. */
export function Tappable({ text, className }: { text: string; className?: string }) {
  const locale = useLocale();
  const t = useMessages(frenchText).player;
  const [open, setOpen] = useState<number | null>(null);
  const segments = glossSegments(text);

  useEffect(() => {
    if (open === null) return;
    const close = () => setOpen(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <span className={cn("inline", className)} lang="fr">
      {segments.map((s, i) => (
        <Fragment key={i}>
          <span className="relative inline-block">
            {s.gloss ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(open === i ? null : i)}
                className="rounded-[4px] underline decoration-ink-3/50 decoration-dotted decoration-2 underline-offset-[6px] transition-colors hover:bg-blob-soft hover:decoration-blob"
                title={t.wordHint}
              >
                {s.text}
              </button>
            ) : (
              <span>{s.text}</span>
            )}
            <AnimatePresence>
              {open === i && s.gloss && (
                <motion.span
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[13.5px] font-medium text-ink shadow-pop"
                  role="tooltip"
                  lang={locale}
                >
                  {s.gloss[locale]}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          {/* The space between words sits outside the inline-block, where it can't collapse; before ! ? : ; » and after « it doesn't break. */}
          {i < segments.length - 1 && (/^[!?:;»]+$/.test(segments[i + 1].text) || s.text === "«" ? "\u00a0" : " ")}
        </Fragment>
      ))}
    </span>
  );
}

/** Text with **bold** parts (Blob's explanations). */
export function Bold({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-ink">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** A solution with some words highlighted. */
export function Marked({ text, marks }: { text: string; marks?: boolean[] }) {
  const words = text.split(/\s+/);
  return (
    <span lang="fr">
      {words.map((w, i) => (
        <span key={i}>
          <span className={cn(marks?.[i] && "rounded bg-danger/15 px-0.5 font-semibold underline decoration-danger/60 decoration-2 underline-offset-4")}>{w}</span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </span>
  );
}

/** The big title of an exercise ("Translate this sentence"). */
export function Prompt({ children, badge }: { children: ReactNode; badge?: ReactNode }) {
  return (
    <div className="mb-5 sm:mb-7">
      {badge}
      <h2 className="text-balance font-display text-[22px] font-bold leading-tight tracking-[-0.015em] sm:text-[27px]">{children}</h2>
    </div>
  );
}
