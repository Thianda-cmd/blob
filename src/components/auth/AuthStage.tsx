"use client";

import { AnimatePresence, motion } from "motion/react";
import { Sheet as SheetIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText, useTypewriter } from "@/components/blob/speech";
import { BlobMark } from "@/components/blob/BlobMark";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { buttonClass } from "@/components/ui/Button";
import { midTone } from "@/components/ui/surfaces";
import { useMessages } from "@/i18n/client";
import { authText } from "@/i18n/messages/auth";
import { cn } from "@/lib/utils";
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

/**
 * Split-screen frame for every auth page: the form on the left, Blob on the right. Below lg the
 * stage is hidden and a small Blob above the form says the same things, so phones keep the reactions.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useMessages(authText).stage;
  const blobRef = useRef<BlobHandle>(null);
  const miniRef = useRef<BlobHandle>(null);
  const [mood, setMood] = useState<BlobMood>("happy");
  const [speech, setSpeech] = useState<string | null>(t.hello);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);

  const say = useCallback((text: string | null) => setSpeech(text), []);
  // Only one of the two Blobs is on screen (the other is display: none), so both get every gesture.
  const jump = useCallback(() => {
    blobRef.current?.jump(1);
    miniRef.current?.jump(1);
  }, []);
  const shake = useCallback(() => {
    blobRef.current?.shake();
    miniRef.current?.shake();
  }, []);
  const api = useMemo(() => ({ setMood, say, look: setGaze, jump, shake }), [say, jump, shake]);
  const { shown, typing } = useTypewriter(speech);

  // Say hi with a wave when the page opens.
  useEffect(() => {
    const t = setTimeout(() => {
      blobRef.current?.wave();
      miniRef.current?.wave();
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Ctx.Provider value={api}>
      <div className="safe-top safe-x safe-bottom grid min-h-dvh lg:grid-cols-[minmax(440px,560px)_1fr]">
        <div className="relative flex flex-col bg-surface px-6 py-6 sm:px-12 lg:border-r lg:border-line">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex h-9 w-fit items-center gap-2 rounded-lg">
              <BlobMark size={26} />
              <span className="font-display text-[19px] font-bold tracking-[-0.03em]">Blob</span>
            </Link>
            <LanguageSwitch compact />
          </div>
          <div className="flex flex-1 items-center py-10">
            <div className="mx-auto w-full max-w-[360px]">
              <div className="relative mb-5 h-[72px] lg:hidden">
                <Blob ref={miniRef} size={72} mood={mood} look={gaze} talking={typing} className="-ml-1.5" />
                {/* Anchored at the bottom, so a longer line grows up into the free space, never pushing the form down. */}
                <AnimatePresence mode="wait">
                  {speech && (
                    <motion.div
                      key={speech}
                      initial={{ opacity: 0, x: -6, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      style={{ transformOrigin: "bottom left" }}
                      className="absolute bottom-3 left-[76px] right-0 w-fit rounded-2xl rounded-bl-md border border-line bg-raised px-3.5 py-2 text-[13.5px] leading-snug text-ink shadow-card"
                      role="status"
                    >
                      <TypedText text={speech} shown={shown} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {children}
            </div>
          </div>
          <p className={cn("text-[12px]", midTone)}>{t.privacy}</p>
        </div>

        {/* Exactly one window tall and pinned while a long form scrolls (short windows, the invite
            banner), so the cards in the corners and Blob always stay in view. */}
        <div className="relative hidden overflow-hidden bg-paper lg:sticky lg:top-0 lg:block lg:h-dvh lg:self-start">
          <div className="bg-dots absolute inset-0 opacity-60" />
          <FloatingCards />
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative mt-[4vh] [@media(max-height:660px)]:mt-0">
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
              {/* A little smaller on narrow or short stages, so the cards in the corners never touch it
                  (the height steps exclude each other, so the smallest one applies). */}
              <div className="lg:max-xl:scale-[0.88] [@media(min-height:661px)_and_(max-height:780px)]:scale-[0.85] [@media(max-height:660px)]:scale-[0.78]">
                <Blob ref={blobRef} size={300} mood={mood} look={gaze} talking={typing} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Ctx.Provider>
  );
}

// Around Blob, in the corners: a note, a spreadsheet's chart (Blobxcel), a ticked-off task and an
// exam, tilted a little (at most 3°). On narrower stages (lg, 1024–1279 px) and short ones (a window
// up to 660 px tall; the stage is exactly as tall as the window) only the note and the chart fit
// around Blob and its speech bubble without touching them or each other: the chart then sits bottom
// right. On wide, tall stages it moves to the top right and the task and the exam join.
const CARDS = [
  { className: "left-[6%] top-[7%] rotate-[-3deg]", delay: 0, kind: "note" as const },
  {
    className:
      "right-[5%] bottom-[4%] rotate-[2deg] [@media(min-width:80rem)_and_(min-height:661px)]:right-[6%] [@media(min-width:80rem)_and_(min-height:661px)]:top-[6%] [@media(min-width:80rem)_and_(min-height:661px)]:bottom-auto [@media(min-width:80rem)_and_(min-height:661px)]:rotate-[3deg]",
    delay: 0.8,
    kind: "chart" as const,
  },
  { className: "left-[8%] bottom-[8%] rotate-[2deg] hidden [@media(min-width:80rem)_and_(min-height:661px)]:block", delay: 1.6, kind: "task" as const },
  { className: "right-[8%] bottom-[11%] rotate-[-2deg] hidden [@media(min-width:80rem)_and_(min-height:661px)]:block", delay: 2.2, kind: "exam" as const },
];

function FloatingCards() {
  const cards = useMessages(authText).stage.cards;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {CARDS.map((card, i) => (
        <motion.div
          key={card.kind}
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

// The chart card: the lab template "Kalibriergerade" (six standards, absorbance against
// concentration) with its trendline, drawn in the spreadsheet's own colours. The numbers are the
// template's: y = 0.05233x + 0.00119, R² = 0.9998. Drawn here, so the sign-in pages load nothing
// of the spreadsheet itself.
const POINTS: [number, number][] = [
  [0, 0.003],
  [2, 0.104],
  [4, 0.207],
  [6, 0.318],
  [8, 0.423],
  [10, 0.522],
];
const chartX = (v: number) => 10 + (v / 10) * 182;
const chartY = (v: number) => 70 - (v / 0.53) * 62;
const TREND = "color-mix(in oklab, var(--sheet-blue) 68%, var(--ink))";

function ChartCard({ title, r2 }: { title: string; r2: string }) {
  return (
    <div className="w-[230px] rounded-xl border border-line bg-raised p-3.5 shadow-card">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <SheetIcon className="size-3.5" />
        {title}
      </div>
      <svg viewBox="0 0 200 76" className="mt-2 block h-[76px] w-full overflow-visible">
        {[24, 47].map((y) => (
          <line key={y} x1="4" x2="198" y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
        ))}
        <path d="M4 72H198M4 2V72" fill="none" stroke="var(--line-2)" strokeWidth="1.2" />
        <line
          x1={chartX(0)}
          y1={chartY(0.00119)}
          x2={chartX(10)}
          y2={chartY(0.52449)}
          stroke={TREND}
          strokeWidth="1.5"
          strokeDasharray="4 2.6"
          strokeLinecap="round"
        />
        {POINTS.map(([x, y]) => (
          <circle key={x} cx={chartX(x)} cy={chartY(y)} r="3" fill="var(--sheet-blue)" stroke="var(--raised)" strokeWidth="1" />
        ))}
      </svg>
      <div className="mt-2 w-fit rounded-md bg-blob-soft px-1.5 py-px text-[11px] font-semibold tabular-nums text-blob-ink">{r2}</div>
    </div>
  );
}

function MiniCard({ kind, text }: { kind: "note" | "task" | "chart" | "exam"; text: (typeof authText)["en"]["stage"]["cards"] }) {
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
        <span className="grid size-4 place-items-center rounded-[5px] bg-blob dark:bg-blob-deep">
          <svg viewBox="0 0 12 12" className="size-2.5 text-white">
            <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[13px] text-ink-3 line-through">{text.task}</span>
      </div>
    );
  }
  if (kind === "chart") return <ChartCard title={text.sheet} r2={text.r2} />;
  return (
    <div className="w-[190px] rounded-xl border border-line bg-raised px-3 py-2.5 shadow-card">
      <div className="text-[11.5px] font-medium text-blob-ink">{text.exam}</div>
      <div className="mt-0.5 text-[13.5px] font-medium">{text.examTitle}</div>
    </div>
  );
}

/** A link that looks like the forms' violet large button (a button inside a link is not valid HTML). */
export const authLinkButton = buttonClass("blob", "lg", "w-full");

/** Small animated heading block shared by the auth pages. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-7">
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-balance">{title}</h1>
      {/* Long email addresses break anywhere instead of running out of the column. */}
      {subtitle && <p className="mt-1.5 text-pretty text-[14px] text-ink-2 [overflow-wrap:anywhere]">{subtitle}</p>}
    </motion.div>
  );
}
