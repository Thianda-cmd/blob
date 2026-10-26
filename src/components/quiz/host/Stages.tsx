"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUp, Check, Flame, Keyboard, ListOrdered, Medal, SlidersHorizontal, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { useLocale } from "@/i18n/client";
import { intlLocale } from "@/i18n/format";
import type { QuizText } from "@/i18n/messages/quiz";
import type { HostView, Standing } from "@/quiz/views";
import { cn } from "@/lib/utils";
import { Confetti } from "../Confetti";
import { Countdown } from "../Countdown";
import { MiniBlob } from "../MiniBlob";
import { formatValue } from "../play/AnswerPad";
import { Shape, styleAt } from "../Shape";
import { quizSound } from "../sound";

// What the big screen shows while a game runs: the question (first on its own, then with the
// answers and the clock), the answer with how everyone voted, the scoreboard and the podium.

type T = QuizText;

/** The question on its own for a moment, a bar filling up until the answers open. */
export function Intro({ view, left, total, t }: { view: HostView; left: number; total: number; t: T }) {
  const q = view.question!;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] px-[6vw] text-center">
      <motion.span initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-full bg-blob-soft px-4 py-1.5 text-[clamp(13px,1.4vw,20px)] font-bold uppercase tracking-wide text-blob-ink">
        {t.host.question(view.game.q + 1, view.game.total)} · {t.types[q.type]}
      </motion.span>
      <motion.h1 initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="max-w-[80vw] font-display text-[clamp(28px,4.6vw,76px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink hyphens-auto [overflow-wrap:break-word]">
        {q.text}
      </motion.h1>
      {q.points === "double" && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 12 }} className="rounded-full bg-[#d99000] px-4 py-1.5 text-[clamp(14px,1.5vw,22px)] font-bold text-white">
          {t.points.double}
        </motion.span>
      )}
      <div className="mt-[2vh] h-3 w-[min(640px,60vw)] overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-blob transition-[width] duration-100 ease-linear" style={{ width: `${(1 - left / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** The question with its answers and the clock. */
export function Asking({ view, left, t }: { view: HostView; left: number; t: T }) {
  const q = view.question!;
  const shown = view.shown!;
  const live = view.players.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh] px-[3vw] pb-[2vh]">
      <h1 className="mx-auto max-w-[86vw] rounded-3xl bg-raised px-[3vw] py-[2vh] text-center font-display text-[clamp(22px,3.1vw,52px)] font-bold leading-[1.15] tracking-[-0.015em] text-ink shadow-card hyphens-auto [overflow-wrap:break-word]">{q.text}</h1>
      <div className="flex min-h-0 flex-1 items-center justify-between gap-[3vw]">
        <Countdown left={left} total={q.time} size={128} />
        <div className="flex min-h-0 flex-1 items-center justify-center self-stretch">
          {q.image ? (
            <motion.img initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={q.image} alt="" className="max-h-full max-w-full rounded-3xl object-contain shadow-pop" />
          ) : (
            <TypeHint view={view} t={t} />
          )}
        </div>
        <Answered view={view} live={live} t={t} />
      </div>
      {(q.type === "quiz" || q.type === "truefalse" || q.type === "poll") && <Tiles view={view} />}
      {q.type === "puzzle" && (
        <div className="grid grid-cols-2 gap-[1.2vw] lg:grid-cols-4">
          {shown.choices.map((c, i) => (
            <motion.div key={c.id} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 380, damping: 24 }} className="flex min-h-[9vh] items-center gap-3 rounded-2xl px-4 text-[clamp(16px,1.8vw,30px)] font-bold text-white shadow-card" style={{ background: styleAt(c.style).color }}>
              <Shape shape={styleAt(c.style).shape} className="size-[clamp(20px,2.2vw,36px)]" />
              <span className="min-w-0 hyphens-auto [overflow-wrap:break-word]">{c.text}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/** How many have answered, with the Blobs of those who did popping in (never what they picked). */
function Answered({ view, live, t }: { view: HostView; live: number; t: T }) {
  const done = view.players.filter((p) => p.answered);
  const shown = done.slice(-9);
  return (
    <div className="flex w-[clamp(128px,15vw,240px)] flex-col items-center gap-1.5 text-center">
      <motion.span key={view.answered} initial={{ scale: 1.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }} className="font-display text-[clamp(40px,5vw,84px)] font-bold tabular-nums leading-none text-ink">
        {view.answered}
      </motion.span>
      <span className="text-[clamp(12px,1.2vw,18px)] font-semibold leading-tight text-ink-3">{t.host.answeredOf(live)}</span>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-blob" animate={{ width: `${live ? (view.answered / live) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
      </div>
      <ul className="mt-2 flex min-h-[44px] flex-wrap justify-center gap-0.5">
        <AnimatePresence initial={false}>
          {shown.map((p) => (
            <motion.li key={p.id} initial={{ scale: 0, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 600, damping: 15 }} title={p.nickname}>
              <MiniBlob look={p.look} size={40} bounce={false} />
            </motion.li>
          ))}
        </AnimatePresence>
        {done.length > shown.length && <li className="grid h-10 place-items-center px-1 text-[13px] font-bold text-ink-3">+{done.length - shown.length}</li>}
      </ul>
    </div>
  );
}

function TypeHint({ view, t }: { view: HostView; t: T }) {
  const q = view.question!;
  const Icon = q.type === "type" ? Keyboard : q.type === "slider" ? SlidersHorizontal : q.type === "puzzle" ? ListOrdered : Users;
  // A plain quiz question needs no explaining; one with several right answers does.
  const hint = q.type === "quiz" ? (q.multi ? t.editor.multiHint : null) : q.type === "truefalse" ? null : t.typeHints[q.type];
  return (
    <div className="flex flex-col items-center gap-3 text-ink-3">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}>
        <Blob size={150} mood="thinking" plain />
      </motion.div>
      {hint && (
        <span className={cn("flex items-center gap-2 text-[clamp(14px,1.5vw,24px)] font-semibold", q.multi && "rounded-full bg-blob-soft px-4 py-1.5 text-blob-ink")}>
          <Icon className="size-[1.2em]" /> {hint}
        </span>
      )}
      {q.type === "slider" && q.slider && (
        <span className="rounded-full bg-raised px-4 py-1.5 text-[clamp(14px,1.5vw,24px)] font-bold tabular-nums text-ink shadow-card">
          {formatValue(q.slider.min, q.slider.step, q.slider.unit)} – {formatValue(q.slider.max, q.slider.step, q.slider.unit)}
        </span>
      )}
    </div>
  );
}

/** The coloured answer tiles; after the reveal the wrong ones fade and the right ones get a tick. */
function Tiles({ view, revealed = false }: { view: HostView; revealed?: boolean }) {
  const shown = view.shown!;
  const right = new Set(view.reveal?.right ?? []);
  const poll = view.question?.type === "poll";
  return (
    <div className={cn("grid gap-[1.2vw]", shown.choices.length === 2 ? "grid-cols-2" : shown.choices.length <= 4 ? "grid-cols-2" : "grid-cols-3")}>
      {shown.choices.map((c, i) => {
        const style = styleAt(c.style);
        const ok = right.has(c.id);
        return (
          <motion.div
            key={c.id}
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: revealed && !ok && !poll ? 0.32 : 1, scale: revealed && ok ? 1.02 : 1 }}
            transition={{ delay: revealed ? 0 : i * 0.07, type: "spring", stiffness: 360, damping: 22 }}
            className="relative flex min-h-[10vh] items-center gap-[1vw] rounded-2xl px-[1.4vw] py-[1.4vh] text-white shadow-card"
            style={{ background: style.color, boxShadow: `0 6px 0 ${style.deep}` }}
          >
            <Shape shape={style.shape} className="size-[clamp(24px,2.6vw,44px)]" />
            <span className="min-w-0 flex-1 text-[clamp(16px,2vw,34px)] font-bold leading-tight hyphens-auto [overflow-wrap:break-word]">{c.text}</span>
            {revealed && ok && !poll && (
              <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }} className="grid size-[clamp(28px,3vw,50px)] place-items-center rounded-full bg-white">
                <Check className="size-[65%]" strokeWidth={3.4} style={{ color: style.deep }} />
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** The right answer, how everyone answered, and why. */
export function Revealed({ view, t }: { view: HostView; t: T }) {
  const q = view.question!;
  const r = view.reveal!;
  const shown = view.shown!;
  const choiceType = q.type === "quiz" || q.type === "truefalse" || q.type === "poll";
  const max = Math.max(1, ...Object.values(r.counts));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh] px-[3vw] pb-[2vh]">
      <h1 className="mx-auto max-w-[86vw] rounded-3xl bg-raised px-[3vw] py-[1.6vh] text-center font-display text-[clamp(20px,2.6vw,44px)] font-bold leading-[1.15] tracking-[-0.015em] text-ink shadow-card hyphens-auto [overflow-wrap:break-word]">{q.text}</h1>
      <div className="flex min-h-0 flex-1 items-end justify-center gap-[3vw]">
        {choiceType && (
          <div className="flex h-full max-h-[34vh] items-end gap-[2vw]">
            {shown.choices.map((c, i) => {
              const style = styleAt(c.style);
              const n = r.counts[c.id] ?? 0;
              const ok = r.right.includes(c.id);
              return (
                <div key={c.id} className="flex h-full w-[clamp(56px,8vw,130px)] flex-col items-center justify-end gap-2">
                  <span className="flex items-center gap-1 font-display text-[clamp(18px,2.2vw,36px)] font-bold tabular-nums text-ink">
                    {ok && q.type !== "poll" && <Check className="size-[0.9em] text-ok" strokeWidth={3.4} />}
                    {n}
                  </span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, (n / max) * 100)}%` }} transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 140, damping: 18 }} className="w-full rounded-t-2xl" style={{ background: style.color, opacity: ok || q.type === "poll" ? 1 : 0.4 }} />
                  <span className="grid h-[clamp(34px,4vw,60px)] w-full place-items-center rounded-b-2xl" style={{ background: style.deep, opacity: ok || q.type === "poll" ? 1 : 0.4 }}>
                    <Shape shape={style.shape} className="size-[50%]" />
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {q.type === "type" && (
          <div className="flex w-full max-w-[min(900px,80vw)] flex-col gap-[1.2vh] self-center">
            <span className="text-[clamp(13px,1.3vw,20px)] font-semibold uppercase tracking-wide text-ink-3">{t.host.typed}</span>
            {r.texts.length === 0 && <p className="text-[clamp(16px,1.8vw,28px)] text-ink-3">{t.host.noAnswers}</p>}
            {r.texts.map((x, i) => (
              <motion.div key={x.text} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.07 }} className={cn("flex items-center gap-3 rounded-2xl px-5 py-[1.2vh] text-[clamp(16px,1.9vw,32px)] font-bold", x.right ? "bg-ok text-white" : "bg-raised text-ink shadow-card")}>
                {x.right && <Check className="size-[1em]" strokeWidth={3.4} />}
                <span className="min-w-0 flex-1 truncate">{x.text}</span>
                <span className="tabular-nums opacity-80">{x.count}</span>
              </motion.div>
            ))}
          </div>
        )}
        {q.type === "puzzle" && (
          <ol className="flex w-full max-w-[min(900px,80vw)] flex-col gap-[1vh] self-center">
            {q.choices.map((c, i) => (
              <motion.li key={c.id} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.12, type: "spring", stiffness: 300, damping: 22 }} className="flex items-center gap-4 rounded-2xl px-5 py-[1.2vh] text-[clamp(16px,1.9vw,32px)] font-bold text-white" style={{ background: styleAt(i).color }}>
                <span className="grid size-[1.6em] place-items-center rounded-full bg-white/25 tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 hyphens-auto [overflow-wrap:break-word]">{c.text}</span>
              </motion.li>
            ))}
          </ol>
        )}
        {q.type === "slider" && q.slider && <SliderReveal view={view} t={t} />}
      </div>
      {choiceType && <Tiles view={view} revealed />}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {q.type !== "poll" && (
          <span className="rounded-full bg-raised px-4 py-1.5 text-[clamp(14px,1.4vw,22px)] font-bold text-ink shadow-card">{t.host.correctCount(r.correct, r.answered)}</span>
        )}
        {r.explain && (
          <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-[70vw] rounded-2xl bg-blob-soft px-5 py-2 text-[clamp(14px,1.5vw,24px)] font-medium text-blob-ink">
            <b>{t.host.explain}:</b> {r.explain}
          </motion.p>
        )}
      </div>
    </div>
  );
}

function SliderReveal({ view, t }: { view: HostView; t: T }) {
  const s = view.question!.slider!;
  const r = view.reveal!;
  const pos = (v: number) => `${((v - s.min) / (s.max - s.min || 1)) * 100}%`;
  const tol = r.tolerance ?? 0;
  return (
    <div className="flex w-full max-w-[min(1000px,84vw)] flex-col gap-6 self-center">
      <div className="relative h-5 rounded-full bg-line">
        {tol > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-y-0 rounded-full bg-ok/30" style={{ left: pos(Math.max(s.min, s.value - tol)), right: `calc(100% - ${pos(Math.min(s.max, s.value + tol))})` }} />}
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 14 }} className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ok text-white shadow-pop" style={{ left: pos(s.value) }}>
          <Check className="size-6" strokeWidth={3.4} />
        </motion.div>
        {r.average !== null && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="absolute top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-raised px-3 py-1 text-[clamp(13px,1.3vw,20px)] font-semibold text-ink-2 shadow-card" style={{ left: pos(Math.min(s.max, Math.max(s.min, r.average))) }}>{t.host.average(formatValue(Math.round(r.average / s.step) * s.step, s.step, s.unit))}</motion.div>}
      </div>
      <p className="mt-6 text-center font-display text-[clamp(22px,3vw,52px)] font-bold text-ok">{t.host.rightValue(formatValue(s.value, s.step, s.unit))}</p>
    </div>
  );
}

/** The top five, sliding from where they were before this question to where they are now. */
export function Scoreboard({ view, t }: { view: HostView; t: T }) {
  const board = view.board ?? [];
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMoved(true), 1100);
    return () => clearTimeout(timer);
  }, []);
  const rows = moved ? board : [...board].sort((a, b) => a.beforeRank - b.beforeRank || b.before - a.before);
  const left = view.game.total - view.game.q - 1;
  return (
    <div className="flex flex-1 flex-col items-center gap-[2.4vh] px-[6vw] pb-[3vh]">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-[clamp(28px,4vw,64px)] font-bold tracking-[-0.02em] text-ink">{t.host.scoreboard}</h1>
        {left > 0 && (
          <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={cn("rounded-full px-4 py-1 text-[clamp(13px,1.3vw,20px)] font-bold", left === 1 ? "bg-[#fff1e6] text-[#c2410c]" : "bg-blob-soft text-blob-ink")}>
            {left === 1 ? t.host.lastNext : t.host.toGo(left)}
          </motion.span>
        )}
      </div>
      <LayoutGroup>
        <ol className="flex w-full max-w-[min(1000px,82vw)] flex-col gap-[1.4vh]">
          {rows.map((s, i) => {
            const up = s.beforeRank - s.rank;
            const first = s.rank === 1 && moved;
            return (
              <motion.li
                layout
                key={s.id}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ layout: { type: "spring", stiffness: 260, damping: 28 }, delay: moved ? 0 : i * 0.07, type: "spring", stiffness: 380, damping: 30 }}
                className={cn("flex items-center gap-[1.4vw] rounded-2xl px-[1.6vw] py-[1vh] shadow-card transition-colors duration-500", first ? "bg-blob text-white" : "bg-raised text-ink")}
              >
                <span className="w-[2ch] text-center font-display text-[clamp(18px,2.2vw,36px)] font-bold tabular-nums">{moved ? s.rank : s.beforeRank}</span>
                <MiniBlob look={s.look} size={60} bounce={first} />
                <span className="min-w-0 flex-1 truncate text-[clamp(18px,2.2vw,36px)] font-bold">{s.nickname}</span>
                <AnimatePresence>
                  {moved && up > 0 && (
                    <motion.span initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.25 }} className={cn("flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[clamp(12px,1.2vw,18px)] font-bold", first ? "bg-white/20 text-white" : "bg-ok/15 text-ok")} title={t.host.moved(up)}>
                      <ArrowUp className="size-[1.1em]" strokeWidth={3} /> {up}
                    </motion.span>
                  )}
                </AnimatePresence>
                {view.game.streaks && s.streak >= 2 && (
                  <span className="flex items-center gap-1 rounded-full bg-[#fff1e6] px-2.5 py-1 text-[clamp(12px,1.2vw,18px)] font-bold text-[#c2410c]" title={t.host.streak(s.streak)}>
                    <Flame className="size-[1.1em]" /> {s.streak}
                  </span>
                )}
                {s.gained > 0 && (
                  <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: moved ? 0.75 : 1, x: 0 }} className="text-[clamp(13px,1.4vw,22px)] font-bold tabular-nums">
                    +{s.gained}
                  </motion.span>
                )}
                <span className="min-w-[4ch] text-right font-display text-[clamp(18px,2.2vw,36px)] font-bold tabular-nums">
                  <Rolling from={s.before} to={s.score} go={moved} />
                </span>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </div>
  );
}

function Rolling({ from, to, go }: { from: number; to: number; go: boolean }) {
  const locale = useLocale();
  const [n, setN] = useState(from);
  useEffect(() => {
    if (!go || from === to) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the number shown before the count starts
      setN(go ? to : from);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setN(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, go]);
  return <>{n.toLocaleString(intlLocale(locale))}</>;
}

/** Third, then second, then the winner: Blobs on rising pedestals, a drumroll and confetti. */
export function Podium({ view, t, sound }: { view: HostView; t: T; sound: boolean }) {
  const locale = useLocale();
  const top = (view.podium ?? []).slice(0, 3);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 900),
      setTimeout(() => setStep(2), 2300),
      setTimeout(() => setStep(3), 4600),
    ];
    if (sound) {
      quizSound().drumroll(2.2);
      timers.push(setTimeout(() => quizSound().fanfare(), 4500));
    }
    return () => timers.forEach(clearTimeout);
  }, [sound]);
  // Shown left to right: second, first, third.
  const slots: { s: Standing | undefined; place: number; at: number; height: string }[] = [
    { s: top[1], place: 2, at: 2, height: "26vh" },
    { s: top[0], place: 1, at: 3, height: "36vh" },
    { s: top[2], place: 3, at: 1, height: "18vh" },
  ];
  const colors = ["#f0bf2e", "#c9ced8", "#d48a4a"];
  const rest = (view.podium ?? []).slice(3, 5);
  return (
    <div className="relative flex flex-1 flex-col items-center justify-end gap-[2vh] overflow-hidden px-[4vw]">
      {step >= 3 && <Confetti ms={9000} count={220} />}
      <AnimatePresence mode="wait">
        <motion.h1 key={step >= 3 ? "win" : "roll"} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="font-display text-[clamp(28px,4vw,68px)] font-bold tracking-[-0.02em] text-ink">
          {step >= 3 && top[0] ? `${top[0].nickname}: ${t.host.winner}` : t.host.drumroll}
        </motion.h1>
      </AnimatePresence>
      {rest.length > 0 && (
        <motion.ol initial={{ opacity: 0 }} animate={{ opacity: step >= 1 ? 1 : 0 }} className="flex flex-wrap justify-center gap-2">
          {rest.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full bg-raised py-1 pl-1.5 pr-4 text-[clamp(13px,1.3vw,20px)] font-bold text-ink shadow-card">
              <MiniBlob look={s.look} size={30} bounce={false} />
              <span className="tabular-nums text-ink-3">{s.rank}.</span>
              <span className="max-w-[16ch] truncate">{s.nickname}</span>
              <span className="tabular-nums text-ink-2">{s.score.toLocaleString(intlLocale(locale))}</span>
            </li>
          ))}
        </motion.ol>
      )}
      <div className="flex w-full max-w-[min(1100px,90vw)] items-end justify-center gap-[2vw]">
        {slots.map(({ s, place, at, height }) => (
          <div key={place} className="flex w-[30%] flex-col items-center gap-[1vh]">
            <AnimatePresence>
              {s && step >= at && (
                <motion.div initial={{ y: 60, opacity: 0, scale: 0.5 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 13 }} className="flex flex-col items-center gap-1">
                  <Blob size={place === 1 ? 170 : 130} mood={place === 1 ? "proud" : "happy"} plain wear={{ skin: s.look.skin, hat: place === 1 ? "crown" : s.look.hat, eyes: null, neck: "medal" }} />
                  <span className="max-w-full truncate text-[clamp(16px,2vw,34px)] font-bold text-ink">{s.nickname}</span>
                  <span className="text-[clamp(14px,1.6vw,26px)] font-semibold tabular-nums text-ink-2">{s.score.toLocaleString(intlLocale(locale))}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div initial={{ height: 0 }} animate={{ height: s && step >= at ? height : "4vh" }} transition={{ type: "spring", stiffness: 120, damping: 18 }} className="flex w-full items-start justify-center rounded-t-3xl pt-[2vh] shadow-pop" style={{ background: `linear-gradient(180deg, ${colors[place - 1]}, color-mix(in oklab, ${colors[place - 1]} 70%, #000))` }}>
              {s && step >= at && (place === 1 ? <Trophy className="size-[clamp(30px,4vw,64px)] text-white" /> : <Medal className="size-[clamp(26px,3vw,50px)] text-white" />)}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
