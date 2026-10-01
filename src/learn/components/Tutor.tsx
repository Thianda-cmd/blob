"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type RefObject } from "react";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";
import { cn } from "@/lib/utils";
import { Inline } from "./Rich";

/**
 * Blob as a tutor: sits next to the work, talks in a typing speech bubble
 * (with inline maths), reacts with moods and gestures.
 */
export function Tutor({
  say,
  mood = "happy",
  accessory = "glasses",
  size = 150,
  side = "left",
  blobRef,
  className,
}: {
  say: string | null;
  mood?: BlobMood;
  accessory?: BlobAccessory | null;
  size?: number;
  side?: "left" | "top";
  blobRef?: RefObject<BlobHandle | null>;
  className?: string;
}) {
  const own = useRef<BlobHandle>(null);
  const handle = blobRef ?? own;
  const plain = say ? toPlain(say) : null;
  const { typing } = useTypewriter(plain, 48);

  // Point at the board whenever Blob starts explaining something new.
  useEffect(() => {
    if (!say) return;
    const t = setTimeout(() => handle.current?.point(), 120);
    return () => clearTimeout(t);
  }, [say, handle]);

  return (
    <div className={cn("relative flex", side === "left" ? "flex-col items-center" : "items-end gap-3", className)}>
      <AnimatePresence mode="wait">
        {say && (
          <motion.div
            key={say}
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 480, damping: 28 }}
            style={{ transformOrigin: side === "left" ? "bottom center" : "bottom left" }}
            className={cn(
              "relative z-10 rounded-2xl border border-line bg-raised px-4 py-3 text-[14.5px] leading-snug text-ink shadow-pop",
              side === "left" ? "mb-2 w-full max-w-[260px]" : "order-2 mb-8 max-w-[320px] rounded-bl-md",
            )}
            role="status"
            aria-live="polite"
          >
            <SpeechWithMath text={say} />
            {side === "left" && <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised" />}
          </motion.div>
        )}
      </AnimatePresence>
      <div className={side === "top" ? "order-1 shrink-0" : undefined}>
        <Blob
          ref={handle}
          size={size}
          mood={mood}
          talking={typing}
          accessory={accessory}
        />
      </div>
    </div>
  );
}

/** Rich text without its markup: maths and bold become plain characters for the typewriter. */
const toPlain = (text: string) => text.replace(/\$([^$]+)\$/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");

/** Speech that types out plain text first, then swaps in rendered maths and bold when done. */
function SpeechWithMath({ text }: { text: string }) {
  const rich = /\$|\*\*/.test(text);
  const plain = toPlain(text);
  const { shown, typing } = useTypewriter(plain, 48);
  if (rich && !typing) return <Inline text={text} />;
  return <TypedText text={plain} shown={shown} />;
}
