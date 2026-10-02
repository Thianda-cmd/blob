"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import Link from "next/link";

type AuthBlob = {
  setMood: (mood: BlobMood) => void;
  say: (text: string | null) => void;
  look: (gaze: { x: number; y: number } | null) => void;
  jump: () => void;
  shake: () => void;
};

const Ctx = createContext<AuthBlob | null>(null);

export function useAuthBlob() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthBlob must be used inside <AuthShell>");
  return ctx;
}

/** Split-screen frame for every auth page: the form on the left, Blob on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useMessages(authText).stage;
  const blobRef = useRef<BlobHandle>(null);
  const [mood, setMood] = useState<BlobMood>("happy");
  const [speech, setSpeech] = useState<string | null>(t.hello);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);

  const say = useCallback((text: string | null) => setSpeech(text), []);
  const jump = useCallback(() => blobRef.current?.jump(1), []);
  const shake = useCallback(() => blobRef.current?.shake(), []);
  const api = useMemo(() => ({ setMood, say, look: setGaze, jump, shake }), [say, jump, shake]);
  const { shown, typing } = useTypewriter(speech);

  // Say hi with a wave when the page opens.
  useEffect(() => {
    const t = setTimeout(() => blobRef.current?.wave(), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Ctx.Provider value={api}>
      <div className="grid min-h-dvh lg:grid-cols-[minmax(440px,560px)_1fr]">
        <div className="relative flex flex-col bg-surface px-6 py-6 sm:px-12 lg:border-r lg:border-line">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex w-fit items-center gap-2 rounded-lg">
              <BlobMark size={26} />
              <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
            </Link>
            <LanguageSwitch compact />
          </div>
          <div className="flex flex-1 items-center py-10">
            <div className="mx-auto w-full max-w-[360px]">{children}</div>
          </div>
          <p className="text-[12px] text-ink-3">{t.privacy}</p>
        </div>

        <div className="relative hidden overflow-hidden bg-paper lg:block">
          <div className="bg-dots absolute inset-0 opacity-60" />
          <FloatingCards />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative" style={{ marginTop: "4vh" }}>
              <AnimatePresence mode="wait">
                {speech && (
                  <motion.div
                    key={speech}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96, transition: { duration: 0.12 } }}
                    transition={{ type: "spring", stiffness: 500, damping: 26 }}
                    className="absolute top-[22px] left-1/2 z-10 w-max max-w-[300px] -translate-x-1/2 rounded-2xl border border-line bg-raised px-4 py-2.5 text-center text-[14px] leading-snug text-ink shadow-pop"
                    role="status"
                  >
                    <TypedText text={speech} shown={shown} />
                    <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised" />
                  </motion.div>
                )}
              </AnimatePresence>
              <Blob ref={blobRef} size={300} mood={mood} look={gaze} talking={typing} />
            </div>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

const CARDS = [
  { className: "left-[9%] top-[13%] rotate-[-6deg]", delay: 0, kind: "note" as const },
  { className: "right-[10%] top-[18%] rotate-[5deg]", delay: 0.8, kind: "task" as const },
  { className: "left-[14%] bottom-[14%] rotate-[4deg]", delay: 1.6, kind: "slide" as const },
  { className: "right-[13%] bottom-[16%] rotate-[-4deg]", delay: 2.2, kind: "exam" as const },
];

function FloatingCards() {
  const cards = useMessages(authText).stage.cards;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {CARDS.map((card, i) => (
        <motion.div
          key={i}
          className={`absolute ${card.className}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -10, 0] }}
          transition={{
            opacity: { delay: 0.2 + i * 0.12, duration: 0.5 },
            y: { duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: card.delay },
          }}
        >
          <MiniCard kind={card.kind} text={cards} />
        </motion.div>
      ))}
    </div>
  );
}

function MiniCard({ kind, text }: { kind: "note" | "task" | "slide" | "exam"; text: (typeof authText)["en"]["stage"]["cards"] }) {
  if (kind === "note") {
    return (
      <div className="w-[220px] rounded-xl border border-line bg-raised p-3.5 shadow-card">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className="size-1.5 rounded-full" style={{ background: "var(--subject-moss)" }} /> {text.subject}
        </div>
        <div className="font-display text-[15px] font-semibold">{text.note}</div>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-[92%] rounded bg-line" />
          <div className="h-1.5 w-[78%] rounded bg-line" />
          <div className="h-1.5 w-[85%] rounded bg-blob-soft" />
        </div>
      </div>
    );
  }
  if (kind === "task") {
    return (
      <div className="flex w-[210px] items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5 shadow-card">
        <span className="grid size-4 place-items-center rounded-[5px] bg-blob">
          <svg viewBox="0 0 12 12" className="size-2.5 text-white">
            <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[13px] text-ink-3 line-through">{text.task}</span>
      </div>
    );
  }
  if (kind === "slide") {
    return (
      <div className="w-[230px] rounded-xl border border-line bg-raised p-2 shadow-card">
        <div className="grid aspect-video place-items-center rounded-lg bg-ink px-4 text-center">
          <div>
            <div className="font-display text-[15px] font-bold text-paper">{text.slide}</div>
            <div className="mt-1 text-[10px] text-paper/60">{text.slideKind}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-[190px] rounded-xl border border-line bg-raised px-3 py-2.5 shadow-card">
      <div className="text-[11px] font-medium uppercase tracking-wide text-blob-ink">{text.exam}</div>
      <div className="mt-0.5 text-[13.5px] font-medium">{text.examTitle}</div>
    </div>
  );
}

/** Small animated heading block shared by the auth pages. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-7">
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-balance">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[14px] text-ink-2">{subtitle}</p>}
    </motion.div>
  );
}
