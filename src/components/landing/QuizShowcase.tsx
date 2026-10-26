"use client";

import { ArrowUp, BarChart3, Check, Flame, ListChecks, NotebookText, SpellCheck, Smartphone, Tv } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { MiniBlob } from "@/components/quiz/MiniBlob";
import { QR } from "@/components/quiz/QR";
import { Shape, styleAt } from "@/components/quiz/Shape";
import { useLocale, useMessages } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import { landingText } from "@/i18n/messages/landing";
import type { Look } from "@/quiz/views";
import { cn } from "@/lib/utils";
import { PointList } from "./Points";
import { useReducedAfterMount } from "./useTyping";

type T = (typeof landingText)["en"]["quiz"]["demo"];

const PIN = "482913";
const RIGHT = 1;
const TIME = 20;
/** Mia is the one holding the phone. */
const LOOKS: Look[] = [
  { skin: "mint", hat: "crown" },
  { skin: "sunset", hat: "wizard" },
  { skin: "bubblegum", hat: "party" },
  { skin: "sky", hat: null },
  { skin: "gold", hat: "propeller" },
];
/** How many picked each answer, and the scores before and after. */
const VOTES = [1, 3, 1, 0];
const BEFORE = [1610, 1890, 1240, 980, 720];
const GAINED = [912, 0, 788, 640, 0];

type Scene = "lobby" | "question" | "reveal" | "board";
type Frame = { scene: Scene; joined: number; left: number; answered: number; tapped: boolean; moved: boolean; ms: number };

const base = { joined: 5, left: TIME, answered: 0, tapped: false, moved: false };
/** Five players join, answer a question (Mia on the phone among the first), see the answer, and Mia takes the lead. */
const FRAMES: Frame[] = [
  { ...base, scene: "lobby", joined: 1, ms: 900 },
  { ...base, scene: "lobby", joined: 2, ms: 450 },
  { ...base, scene: "lobby", joined: 3, ms: 450 },
  { ...base, scene: "lobby", joined: 4, ms: 450 },
  { ...base, scene: "lobby", joined: 5, ms: 1300 },
  { ...base, scene: "question", left: 20, ms: 1000 },
  { ...base, scene: "question", left: 19, answered: 1, ms: 700 },
  { ...base, scene: "question", left: 18, answered: 2, tapped: true, ms: 900 },
  { ...base, scene: "question", left: 17, answered: 3, tapped: true, ms: 700 },
  { ...base, scene: "question", left: 16, answered: 4, tapped: true, ms: 700 },
  { ...base, scene: "question", left: 15, answered: 5, tapped: true, ms: 800 },
  { ...base, scene: "reveal", tapped: true, ms: 3000 },
  { ...base, scene: "board", tapped: true, ms: 1000 },
  { ...base, scene: "board", tapped: true, moved: true, ms: 2800 },
];
/** With reduced motion: the answer, revealed. */
const STILL = 11;

const spring = { type: "spring", stiffness: 380, damping: 28 } as const;

/** A live quiz on the landing page: the big screen and a phone, playing one question by themselves. */
export function QuizShowcase({ className }: { className?: string }) {
  const t = useMessages(landingText).quiz.demo;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const reduce = useReducedAfterMount();
  const [i, setI] = useState(0);
  const frame = FRAMES[reduce ? STILL : i];

  useEffect(() => {
    if (!visible || reduce) return;
    const timer = setTimeout(() => setI((n) => (n + 1) % FRAMES.length), FRAMES[i].ms);
    return () => clearTimeout(timer);
  }, [visible, reduce, i]);

  return (
    <div ref={ref} role="img" aria-label={t.label} className={cn("relative pb-12 pr-[90px] sm:pb-10 sm:pr-[140px]", className)}>
      {/* The big screen. */}
      <div className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
        <div className="flex h-10 items-center gap-2 border-b border-line px-3 sm:px-4">
          <BlobMark size={18} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-2">{t.title}</span>
          {frame.scene !== "lobby" && (
            <span className="rounded-full bg-hover px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-ink-2">
              {t.pin} {PIN}
            </span>
          )}
        </div>
        <div className="relative aspect-[16/10] overflow-hidden bg-[radial-gradient(110%_90%_at_50%_0%,color-mix(in_oklab,var(--blob)_12%,var(--paper)),var(--paper))]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={frame.scene} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }} transition={spring} className="absolute inset-0 flex flex-col p-[3.5%]">
              {frame.scene === "lobby" && <Lobby t={t} joined={frame.joined} />}
              {frame.scene === "question" && <Question t={t} frame={frame} />}
              {frame.scene === "reveal" && <Reveal t={t} />}
              {frame.scene === "board" && <Board t={t} moved={frame.moved} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mia's phone. */}
      <div className="absolute bottom-0 right-0 w-[104px] rounded-[22px] border border-black/10 bg-[#14121c] p-[4px] shadow-pop dark:border-white/15 sm:w-[176px] sm:rounded-[26px] sm:p-[5px]">
        <div className="relative aspect-[9/18] overflow-hidden rounded-[18px] sm:rounded-[21px]">
          <Phone t={t} frame={frame} />
        </div>
      </div>
    </div>
  );
}

function Lobby({ t, joined }: { t: T; joined: number }) {
  return (
    <div className="flex h-full flex-col items-center gap-[5%]">
      <div className="flex items-stretch gap-[3%] rounded-2xl bg-raised p-[2%] shadow-card">
        <div className="flex flex-col justify-center px-[2%]">
          <span className="text-[clamp(8px,1.4vw,12px)] font-semibold text-ink-3">{t.joinAt}</span>
          <span className="whitespace-nowrap font-display text-[clamp(11px,2.2vw,19px)] font-bold text-ink">
            blob.bojes.org/<span className="text-blob-ink">play</span>
          </span>
        </div>
        <div className="flex flex-col justify-center rounded-xl bg-blob px-[4%] py-[1%] text-white">
          <span className="text-[clamp(7px,1.2vw,11px)] font-semibold text-white/80">{t.pin}</span>
          <span className="whitespace-nowrap font-display text-[clamp(16px,3.6vw,32px)] font-bold leading-none tabular-nums tracking-[0.04em]">
            {PIN.slice(0, 3)} {PIN.slice(3)}
          </span>
        </div>
        <QR text={`https://blob.bojes.org/play?pin=${PIN}`} size={64} className="hidden size-[clamp(40px,7vw,64px)] self-center rounded-md sm:block" />
      </div>
      <ul className="flex w-full flex-1 flex-wrap content-center items-center justify-center gap-x-[4%] gap-y-2">
        <AnimatePresence>
          {LOOKS.slice(0, joined).map((look, k) => (
            <motion.li key={k} initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 16 }} className="flex flex-col items-center gap-1">
              <MiniBlob look={look} size={52} delay={k * 300} className="size-[clamp(30px,6.4vw,56px)]" />
              <span className="rounded-full bg-raised px-2 py-0.5 text-[clamp(8px,1.3vw,12px)] font-bold text-ink shadow-card">{t.names[k]}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function Ring({ left }: { left: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[clamp(34px,7vw,64px)] shrink-0 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="var(--raised)" stroke="var(--line)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--blob)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / TIME)} style={{ transition: "stroke-dashoffset 0.6s linear" }} />
      </svg>
      <span className="relative font-display text-[clamp(12px,2.4vw,22px)] font-bold tabular-nums text-ink">{left}</span>
    </div>
  );
}

function QuestionText({ t, small = false }: { t: T; small?: boolean }) {
  return (
    <p className={cn("mx-auto w-fit max-w-full rounded-xl bg-raised px-[3%] py-[1.2%] text-center font-display font-bold leading-tight text-ink shadow-card", small ? "text-[clamp(10px,1.8vw,16px)]" : "text-[clamp(11px,2.2vw,20px)]")}>
      {t.question}
    </p>
  );
}

function Tiles({ t, revealed = false }: { t: T; revealed?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-[2%]">
      {t.choices.map((text, k) => {
        const style = styleAt(k);
        const ok = k === RIGHT;
        return (
          <motion.div
            key={k}
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: revealed && !ok ? 0.35 : 1 }}
            transition={{ ...spring, delay: revealed ? 0 : k * 0.06 }}
            className="flex min-h-[clamp(22px,4.6vw,42px)] items-center gap-[4%] rounded-lg px-[4%] text-white"
            style={{ background: style.color, boxShadow: `0 3px 0 ${style.deep}` }}
          >
            <Shape shape={style.shape} className="size-[clamp(9px,1.8vw,16px)]" />
            <span className="min-w-0 flex-1 truncate text-[clamp(8px,1.6vw,14px)] font-bold">{text}</span>
            {revealed && ok && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14 }} className="grid size-[clamp(12px,2.2vw,20px)] place-items-center rounded-full bg-white">
                <Check className="size-[70%]" strokeWidth={3.4} style={{ color: style.deep }} />
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function Question({ t, frame }: { t: T; frame: Frame }) {
  return (
    <div className="flex h-full flex-col gap-[3%]">
      <QuestionText t={t} />
      <div className="flex flex-1 items-center justify-between gap-[3%]">
        <Ring left={frame.left} />
        <MiniBlob look={{ skin: null, hat: null }} size={64} mood="wow" className="size-[clamp(36px,8vw,72px)]" />
        <div className="flex w-[22%] flex-col items-center gap-1 text-center">
          <ul className="flex min-h-[clamp(14px,2.6vw,24px)] flex-wrap justify-center">
            <AnimatePresence>
              {LOOKS.slice(0, frame.answered).map((look, k) => (
                <motion.li key={k} initial={{ scale: 0, y: 8 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 600, damping: 15 }} className="-mx-[3px]">
                  <MiniBlob look={look} size={24} bounce={false} className="size-[clamp(14px,2.6vw,24px)]" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <span className="text-[clamp(7px,1.2vw,11px)] font-semibold leading-tight text-ink-3">{t.answered(frame.answered, LOOKS.length)}</span>
        </div>
      </div>
      <Tiles t={t} />
    </div>
  );
}

function Reveal({ t }: { t: T }) {
  const max = Math.max(...VOTES);
  return (
    <div className="flex h-full flex-col gap-[3%]">
      <QuestionText t={t} small />
      <div className="flex flex-1 items-end justify-center gap-[3%]">
        {VOTES.map((n, k) => {
          const style = styleAt(k);
          const ok = k === RIGHT;
          return (
            <div key={k} className="flex h-full w-[11%] flex-col items-center justify-end gap-1">
              <span className="flex items-center gap-0.5 font-display text-[clamp(9px,1.8vw,16px)] font-bold tabular-nums text-ink">
                {ok && <Check className="size-[0.9em] text-ok" strokeWidth={3.4} />}
                {n}
              </span>
              <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, (n / max) * 72)}%` }} transition={{ delay: 0.1 + k * 0.08, type: "spring", stiffness: 140, damping: 18 }} className="w-full rounded-t-md" style={{ background: style.color, opacity: ok ? 1 : 0.4 }} />
            </div>
          );
        })}
      </div>
      <Tiles t={t} revealed />
    </div>
  );
}

function Board({ t, moved }: { t: T; moved: boolean }) {
  const locale = intlLocale(useLocale());
  const rows = LOOKS.map((look, k) => ({ k, look, before: BEFORE[k], score: BEFORE[k] + GAINED[k] }))
    .sort((a, b) => (moved ? b.score - a.score : b.before - a.before))
    .slice(0, 4);
  return (
    <div className="flex h-full flex-col items-center gap-[3%]">
      <span className="font-display text-[clamp(13px,2.6vw,24px)] font-bold tracking-[-0.02em] text-ink">{t.scoreboard}</span>
      <LayoutGroup>
        <ol className="flex w-[86%] flex-col gap-[3%]">
          {rows.map((r, place) => {
            const first = moved && place === 0;
            return (
              <motion.li layout key={r.k} transition={{ type: "spring", stiffness: 260, damping: 28 }} className={cn("flex items-center gap-[3%] rounded-lg px-[3%] py-[1.2%] shadow-card transition-colors duration-500", first ? "bg-blob text-white" : "bg-raised text-ink")}>
                <span className="w-[1.5ch] font-display text-[clamp(9px,1.8vw,16px)] font-bold tabular-nums">{place + 1}</span>
                <MiniBlob look={r.look} size={26} bounce={false} className="size-[clamp(14px,2.8vw,26px)]" />
                <span className="min-w-0 flex-1 truncate text-[clamp(9px,1.8vw,16px)] font-bold">{t.names[r.k]}</span>
                {moved && r.k === 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.3 }} className="flex items-center rounded-full bg-white/20 px-1.5 text-[clamp(7px,1.3vw,12px)] font-bold">
                    <ArrowUp className="size-[1.1em]" strokeWidth={3} /> 1
                  </motion.span>
                )}
                <span className="font-display text-[clamp(9px,1.8vw,16px)] font-bold tabular-nums">{(moved ? r.score : r.before).toLocaleString(locale)}</span>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </div>
  );
}

function Phone({ t, frame }: { t: T; frame: Frame }) {
  const locale = intlLocale(useLocale());
  const me = LOOKS[0];
  const score = BEFORE[0] + (frame.scene === "reveal" || frame.scene === "board" ? GAINED[0] : 0);
  const answering = frame.scene === "question" && !frame.tapped;
  const tone = frame.scene === "reveal" || frame.scene === "board" ? "bg-[linear-gradient(160deg,#2fbf7a,#1b7a4e)]" : answering ? "bg-paper" : "bg-[linear-gradient(160deg,#7c4dff,#5326d6)]";
  const key = frame.scene === "board" ? "reveal" : frame.scene === "question" ? (frame.tapped ? "locked" : "answer") : frame.scene;
  return (
    <div className={cn("flex size-full flex-col transition-colors duration-500", tone)}>
      <div className={cn("flex items-center gap-1 px-2 pb-1 pt-2.5", answering ? "text-ink" : "text-white")}>
        <MiniBlob look={me} size={16} bounce={false} />
        <span className="flex-1 truncate text-[9px] font-bold">{t.names[0]}</span>
        <span className={cn("rounded-full px-1.5 text-[8px] font-bold tabular-nums", answering ? "bg-raised shadow-card" : "bg-white/20")}>{score.toLocaleString(locale)}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.12 } }} transition={{ type: "spring", stiffness: 420, damping: 30 }} className="flex min-h-0 flex-1 flex-col px-2 pb-2.5">
          {key === "lobby" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-white">
              <MiniBlob look={me} size={58} />
              <span className="font-display text-[13px] font-bold leading-tight">{t.youreIn}</span>
            </div>
          )}
          {key === "answer" && (
            <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-1.5">
              {t.choices.map((_, k) => (
                <motion.span key={k} animate={frame.left <= 19 && k === RIGHT ? { scale: [1, 0.9, 1] } : {}} transition={{ duration: 0.3 }} className="grid place-items-center rounded-lg" style={{ background: styleAt(k).color, boxShadow: `0 3px 0 ${styleAt(k).deep}` }}>
                  <Shape shape={styleAt(k).shape} className="size-[38%]" />
                </motion.span>
              ))}
            </div>
          )}
          {key === "locked" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-white">
              <MiniBlob look={me} size={46} mood="wow" />
              <span className="font-display text-[12px] font-bold leading-tight">{t.locked}</span>
              <span className="grid size-6 place-items-center rounded-md" style={{ background: styleAt(RIGHT).color }}>
                <Shape shape={styleAt(RIGHT).shape} className="size-3.5" />
              </span>
            </div>
          )}
          {key === "reveal" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-white">
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 14 }} className="grid size-9 place-items-center rounded-full bg-white/20">
                <Check className="size-5" strokeWidth={3} />
              </motion.span>
              <span className="font-display text-[14px] font-bold leading-none">{t.right}</span>
              <span className="rounded-lg bg-white/20 px-2 py-0.5 font-display text-[12px] font-bold tabular-nums">+{GAINED[0]}</span>
              <span className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-bold text-[#c2410c]">
                <Flame className="size-2.5" /> {t.streak(3)}
              </span>
              <span className="mt-0.5 rounded-lg bg-black/15 px-2 py-1 text-[9px] font-bold leading-tight">
                {frame.moved && (
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mb-0.5 flex items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-white px-1.5 py-0.5 text-[8px] text-ok">
                    <ArrowUp className="size-2.5" strokeWidth={3} /> {t.up}
                  </motion.span>
                )}
                {t.place}
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function QuizPoints({ className }: { className?: string }) {
  const t = useMessages(landingText).quiz.points;
  return (
    <PointList
      className={className}
      points={[
        { key: "join", Icon: Smartphone, ...t.join },
        { key: "types", Icon: ListChecks, ...t.types },
        { key: "notes", Icon: NotebookText, ...t.notes },
        { key: "fair", Icon: SpellCheck, ...t.fair },
        { key: "show", Icon: Tv, ...t.show },
        { key: "results", Icon: BarChart3, ...t.results },
      ]}
    />
  );
}
