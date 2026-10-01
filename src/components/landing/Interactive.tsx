"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";

const MOODS: { mood: BlobMood; line: string; accessory?: BlobAccessory; gesture?: "wave" | "celebrate" }[] = [
  { mood: "happy", line: "Hi! I'm Blob.", gesture: "wave" },
  { mood: "thinking", line: "Exam on Friday? Noted.", accessory: "glasses" },
  { mood: "excited", line: "All homework done. Hooray!", accessory: "cap", gesture: "celebrate" },
  { mood: "love", line: "Press and hold me. I'm squishy." },
];

/** The big hero Blob: follows the cursor, cycles moods, jiggles when clicked. */
export function HeroBlob() {
  const ref = useRef<BlobHandle>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MOODS.length), 3800);
    return () => clearInterval(t);
  }, []);

  const current = MOODS[i];
  const { shown, typing } = useTypewriter(current.line);

  useEffect(() => {
    const gesture = MOODS[i].gesture;
    const t = setTimeout(() => {
      if (gesture === "wave") ref.current?.wave();
      if (gesture === "celebrate") ref.current?.celebrate();
    }, 250);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <div className="relative mx-auto grid h-[420px] w-full max-w-[520px] place-items-center lg:h-[520px]">
      <FloatCard className="left-0 top-[12%] -rotate-6" delay={0}>
        <div className="text-[11px] text-ink-3">Biology</div>
        <div className="font-display text-[15px] font-semibold">Cell structure</div>
        <div className="mt-2 h-1.5 w-32 rounded bg-line" />
      </FloatCard>
      <FloatCard className="right-0 top-[20%] rotate-6" delay={0.8}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-blob-ink">Exam · Fri</div>
        <div className="text-[13.5px] font-medium">Chemistry, chapter 4</div>
      </FloatCard>
      <FloatCard className="bottom-[10%] left-[6%] rotate-3" delay={1.6}>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="grid size-4 place-items-center rounded-[5px] bg-blob text-white">
            <svg viewBox="0 0 12 12" className="size-2.5">
              <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-ink-3 line-through">Math worksheet</span>
        </div>
      </FloatCard>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.line}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="absolute left-1/2 top-[10px] z-10 w-max -translate-x-1/2 rounded-2xl border border-line bg-raised px-4 py-2 text-[14px] shadow-pop"
          >
            <TypedText text={current.line} shown={shown} />
            <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised" />
          </motion.div>
        </AnimatePresence>
        <Blob
          ref={ref}
          size={360}
          mood={current.mood}
          accessory={current.accessory ?? null}
          talking={typing}
          title="Blob, the mascot"
          onClick={() => {
            ref.current?.jump(1.2);
            setI(3);
          }}
        />
      </div>
    </div>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      className={`absolute hidden rounded-xl border border-line bg-raised px-3.5 py-2.5 shadow-card sm:block ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{ opacity: { delay: 0.3 + delay / 4, duration: 0.5 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay } }}
    >
      {children}
    </motion.div>
  );
}

const DEMO = "Bio test fri #biology";

/** Types a quick-add phrase and shows what Blob understood. */
export function QuickAddDemo() {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(false);

  useEffect(() => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (i <= DEMO.length) {
        setText(DEMO.slice(0, i));
        setParsed(i >= DEMO.length);
        i++;
        timer = setTimeout(step, i === DEMO.length + 1 ? 2600 : 70 + Math.random() * 60);
      } else {
        i = 0;
        setParsed(false);
        timer = setTimeout(step, 400);
      }
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="rounded-xl border border-line bg-raised p-4 shadow-card">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[14px]">
        <span className="text-ink-3">+</span>
        <span>{text}</span>
        <span className="h-4 w-px animate-pulse bg-ink" />
      </div>
      <div className="mt-3 flex h-6 flex-wrap gap-1.5">
        <AnimatePresence>
          {parsed &&
            [
              { label: "Exam", tone: "bg-blob-soft text-blob-ink" },
              { label: "Friday", tone: "bg-hover text-ink-2" },
              { label: "Biology", tone: "bg-hover text-ink-2" },
            ].map((chip, i) => (
              <motion.span
                key={chip.label}
                initial={{ opacity: 0, scale: 0.6, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: i * 0.08, type: "spring", stiffness: 600, damping: 18 } }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`rounded-md px-2 py-0.5 text-[12px] font-medium ${chip.tone}`}
              >
                {chip.label}
              </motion.span>
            ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
