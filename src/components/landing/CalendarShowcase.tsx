"use client";

import { BellRing, CalendarDays, ChevronLeft, ChevronRight, CloudOff, GraduationCap, LayoutGrid, Move, Plus, Repeat } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";
import { PointList } from "./Points";
import { useReducedAfterMount } from "./useTyping";

type T = (typeof landingText)["en"]["calendar"]["demo"];
type Subject = keyof T["subjects"];

/** The week shows 8:00 to 16:00. */
const FIRST = 8;
const LAST = 16;
const HOUR = 30;
const LANE = 30;
/** The scene's "now": Wednesday, 9:35 (Maths in room 204 starts in ten minutes). */
const TODAY = 2;
const NOW = 9 + 35 / 60;

const COLOR: Record<Subject | "study", string> = {
  maths: "var(--subject-sky)",
  english: "var(--subject-clay)",
  biology: "var(--subject-moss)",
  chemistry: "var(--subject-teal)",
  history: "var(--subject-sand)",
  sport: "var(--subject-rose)",
  choir: "var(--subject-plum)",
  study: "var(--blob)",
};

type Block = { id: string; subject: Subject | "study"; day: number; from: number; to: number };

/** A school timetable (Monday to Friday). */
const WEEK: Block[] = [
  { id: "m1", subject: "maths", day: 0, from: 8, to: 9.5 },
  { id: "e1", subject: "english", day: 0, from: 9.75, to: 11.25 },
  { id: "b1", subject: "biology", day: 0, from: 11.5, to: 13 },
  { id: "c1", subject: "chemistry", day: 1, from: 8, to: 9.5 },
  { id: "h1", subject: "history", day: 1, from: 9.75, to: 11.25 },
  { id: "s1", subject: "sport", day: 1, from: 13.5, to: 15 },
  { id: "e2", subject: "english", day: 2, from: 8, to: 9.5 },
  { id: "m2", subject: "maths", day: 2, from: 9.75, to: 11.25 },
  { id: "b2", subject: "biology", day: 3, from: 8, to: 9.5 },
  { id: "c2", subject: "chemistry", day: 3, from: 9.75, to: 11.25 },
  { id: "m3", subject: "maths", day: 3, from: 11.5, to: 13 },
  { id: "h2", subject: "history", day: 4, from: 8, to: 9.5 },
  { id: "e3", subject: "english", day: 4, from: 9.75, to: 11.25 },
];
const CHOIR_FRI = { day: 4, from: 13.5, to: 15 };
const CHOIR_THU = { day: 3, from: 14, to: 15.5 };
const STUDY: Block = { id: "study", subject: "study", day: 2, from: 14, to: 15.5 };

type Cursor = { day: number; frac: number; h?: number; lane?: boolean; down?: boolean } | null;
type Frame = {
  cursor: Cursor;
  ghost?: number;
  study: boolean;
  choir: "fri" | "thu";
  lifted?: boolean;
  ticked: boolean;
  notify: boolean;
  ms: number;
};

/** Drag a study session into Wednesday, move choir to Thursday, tick off the homework, and a reminder comes in. */
const FRAMES: Frame[] = [
  { cursor: null, study: false, choir: "fri", ticked: false, notify: false, ms: 1300 },
  { cursor: { day: 2, frac: 0.3, h: 14.05 }, study: false, choir: "fri", ticked: false, notify: false, ms: 850 },
  { cursor: { day: 2, frac: 0.3, h: 14.05, down: true }, ghost: 14.5, study: false, choir: "fri", ticked: false, notify: false, ms: 260 },
  { cursor: { day: 2, frac: 0.3, h: 15.45, down: true }, ghost: 15.5, study: false, choir: "fri", ticked: false, notify: false, ms: 800 },
  { cursor: { day: 2, frac: 0.3, h: 15.45 }, study: true, choir: "fri", ticked: false, notify: false, ms: 1000 },
  { cursor: { day: 4, frac: 0.5, h: 14.1 }, study: true, choir: "fri", ticked: false, notify: false, ms: 900 },
  { cursor: { day: 4, frac: 0.5, h: 14.1, down: true }, study: true, choir: "fri", lifted: true, ticked: false, notify: false, ms: 300 },
  { cursor: { day: 3, frac: 0.5, h: 14.6, down: true }, study: true, choir: "thu", lifted: true, ticked: false, notify: false, ms: 850 },
  { cursor: { day: 3, frac: 0.5, h: 14.6 }, study: true, choir: "thu", ticked: false, notify: false, ms: 800 },
  { cursor: { day: 1, frac: 0.13, lane: true }, study: true, choir: "thu", ticked: false, notify: false, ms: 900 },
  { cursor: { day: 1, frac: 0.13, lane: true, down: true }, study: true, choir: "thu", ticked: true, notify: false, ms: 900 },
  { cursor: null, study: true, choir: "thu", ticked: true, notify: true, ms: 3000 },
  { cursor: null, study: true, choir: "thu", ticked: true, notify: false, ms: 1400 },
];
/** With reduced motion the week holds still, planned, with the reminder showing. */
const STILL = 11;

const yOf = (h: number) => LANE + (h - FIRST) * HOUR;
const xOf = (day: number, frac = 0) => `${((day + frac) / 5) * 100}%`;
const clock = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const spring = { type: "spring", stiffness: 300, damping: 30 } as const;

/** A school week in Blob's calendar, playing by itself, with a reminder and the "Next up" widget. */
export function CalendarShowcase({ className }: { className?: string }) {
  const t = useMessages(landingText).calendar.demo;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const reduce = useReducedAfterMount();
  const [state, setState] = useState({ round: 0, i: 0 });
  const frame = FRAMES[reduce ? STILL : state.i];

  useEffect(() => {
    if (!visible || reduce) return;
    const timer = setTimeout(
      () => setState((s) => (s.i + 1 < FRAMES.length ? { round: s.round, i: s.i + 1 } : { round: s.round + 1, i: 0 })),
      FRAMES[state.i].ms,
    );
    return () => clearTimeout(timer);
  }, [visible, reduce, state.i]);

  const choir: Block = { id: "choir", subject: "choir", ...(frame.choir === "fri" ? CHOIR_FRI : CHOIR_THU) };
  const blocks = [...WEEK, choir, ...(frame.study ? [STUDY] : [])];
  const hours = Array.from({ length: LAST - FIRST }, (_, i) => FIRST + i);

  return (
    <div ref={ref} role="img" aria-label={t.label} className={cn("relative", className)}>
      <div className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
        {/* The calendar's bar: the month, Today, the views, New event. */}
        <div className="flex h-12 items-center gap-2 border-b border-line px-3 sm:px-4">
          <CalendarDays className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em]">{t.month}</span>
          <span className="flex h-7 shrink-0 items-center rounded-lg border border-line bg-raised px-2.5 text-[12px] font-medium shadow-card">{t.today}</span>
          <span className="flex shrink-0 items-center text-ink-3 max-sm:hidden">
            <ChevronLeft className="size-4" />
            <ChevronRight className="size-4" />
          </span>
          <span className="flex shrink-0 rounded-lg bg-hover/70 p-0.5 text-[12px] max-md:hidden">
            {(["day", "week", "month"] as const).map((v) => (
              <span key={v} className={cn("flex h-6 items-center rounded-md px-2", v === "week" ? "bg-raised font-medium text-ink shadow-card" : "text-ink-3")}>
                {t.views[v]}
              </span>
            ))}
          </span>
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-blob px-2 text-[12px] font-medium text-white">
            <Plus className="size-3.5" strokeWidth={2.4} />
            <span className="max-sm:hidden">{t.newEvent}</span>
          </span>
        </div>

        {/* Weekdays */}
        <div className="flex border-b border-line">
          <div className="w-9 shrink-0" />
          <div className="grid flex-1 grid-cols-5">
            {t.days.map((d, i) => (
              <div key={d} className="flex h-11 flex-col items-center justify-center gap-0.5 border-l border-line first:border-l-transparent">
                <span className={cn("text-[10.5px] font-medium uppercase tracking-[0.04em]", i === TODAY ? "text-blob-ink" : "text-ink-3")}>{d}</span>
                <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[13px] font-semibold tabular-nums", i === TODAY ? "bg-blob text-white" : "text-ink")}>
                  {19 + i}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* The all-day lane and the hours, with the blocks on top. */}
        <div className="relative flex" style={{ height: yOf(LAST) }}>
          <div className="relative w-9 shrink-0 text-[9.5px] tabular-nums text-ink-3" aria-hidden>
            {hours.slice(1).map((h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 leading-none" style={{ top: yOf(h) }}>
                {h}:00
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            {/* Lines: the lane, the hours, the days. */}
            <div className="absolute inset-x-0 border-b border-line" style={{ top: 0, height: LANE }} />
            <div
              className="absolute inset-x-0 bottom-0"
              style={{ top: LANE, backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: `100% ${HOUR}px` }}
            />
            <div className="absolute inset-0 grid grid-cols-5">
              {t.days.map((d, i) => (
                <div key={d} className={cn("border-l border-line first:border-l-transparent", i === TODAY && "bg-[color-mix(in_oklab,var(--blob)_3.5%,transparent)]")} />
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.round}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.35 } }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
              >
                {/* Homework due Tuesday, the exam on Thursday. */}
                <div className="absolute px-[3px]" style={{ top: 4, height: LANE - 8, left: xOf(1), width: xOf(1) }}>
                  <div className="flex h-full items-center gap-1 overflow-hidden rounded-[5px] border border-line bg-raised px-1 text-[10.5px] font-medium shadow-card">
                    <motion.span
                      className="grid size-3 shrink-0 place-items-center rounded-full border-[1.5px]"
                      animate={{ borderColor: frame.ticked ? "var(--subject-moss)" : "var(--line-2)", backgroundColor: frame.ticked ? "var(--subject-moss)" : "rgba(0,0,0,0)", scale: frame.ticked ? [1, 1.25, 1] : 1 }}
                      transition={{ duration: 0.35 }}
                    >
                      {frame.ticked && (
                        <svg viewBox="0 0 12 12" className="size-2 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.5 6.2l2.3 2.3 4.7-5" />
                        </svg>
                      )}
                    </motion.span>
                    <span className={cn("truncate transition-colors", frame.ticked ? "text-ink-3 line-through" : "text-ink")}>{t.homework}</span>
                  </div>
                </div>
                <div className="absolute px-[3px]" style={{ top: 4, height: LANE - 8, left: xOf(3), width: xOf(1) }}>
                  <div className="flex h-full items-center gap-1 overflow-hidden rounded-[5px] bg-blob-soft px-1 text-[10.5px] font-semibold text-blob-ink ring-1 ring-blob/25">
                    <GraduationCap className="size-3 shrink-0" />
                    <span className="truncate">{t.exam}</span>
                  </div>
                </div>

                {blocks.map((b) => (
                  <motion.div
                    key={b.id}
                    className="absolute px-[2px] pb-px"
                    initial={b.id === "study" ? { opacity: 0, scale: 0.9 } : false}
                    animate={{
                      left: xOf(b.day),
                      top: yOf(b.from),
                      height: (b.to - b.from) * HOUR,
                      opacity: 1,
                      scale: b.id === "choir" && frame.lifted ? 1.04 : 1,
                      zIndex: b.id === "choir" && frame.lifted ? 5 : 1,
                    }}
                    transition={spring}
                    style={{ width: xOf(1) }}
                  >
                    <LessonBlock block={b} t={t} lifted={b.id === "choir" && !!frame.lifted} />
                  </motion.div>
                ))}

                {/* Drawing the new one: its outline grows with the pointer. */}
                <AnimatePresence>
                  {frame.ghost && (
                    <motion.div
                      className="absolute z-[4] px-[2px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, top: yOf(14), height: (frame.ghost - 14) * HOUR, left: xOf(2) }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={spring}
                      style={{ width: xOf(1) }}
                    >
                      <div className="h-full rounded-md border-2 border-dashed border-blob bg-blob/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-blob-ink">
                        14:00 – {clock(frame.ghost)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {/* Now: Wednesday, 9:35. */}
            <div className="pointer-events-none absolute z-[6] h-0" style={{ top: yOf(NOW), left: xOf(TODAY), width: xOf(1) }}>
              <div className="absolute inset-x-0 h-[2px] -translate-y-1/2 bg-blob" />
              <div className="absolute -left-[4px] size-[8px] -translate-y-1/2 rounded-full bg-blob" />
            </div>

            {/* The pointer. */}
            <AnimatePresence>
              {frame.cursor && (
                <motion.div
                  className="pointer-events-none absolute z-10"
                  initial={{ opacity: 0, left: xOf(frame.cursor.day, frame.cursor.frac), top: frame.cursor.lane ? LANE / 2 : yOf(frame.cursor.h ?? 12) }}
                  animate={{
                    opacity: 1,
                    left: xOf(frame.cursor.day, frame.cursor.frac),
                    top: frame.cursor.lane ? LANE / 2 : yOf(frame.cursor.h ?? 12),
                    scale: frame.cursor.down ? 0.86 : 1,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 140, damping: 22 }}
                >
                  <svg viewBox="0 0 20 22" className="-ml-[3px] -mt-[2px] size-5 drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]" aria-hidden>
                    <path d="M3 2 L3 17 L7.2 13.2 L10 19.5 L12.8 18.3 L10.1 12.2 L15.8 12.2 Z" fill="var(--ink)" stroke="var(--paper)" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* A reminder, as the phone or computer shows it. */}
      <AnimatePresence>
        {frame.notify && (
          <motion.div
            className="absolute right-3 top-14 z-20 w-[min(250px,calc(100%-24px))] rounded-2xl border border-line bg-raised/95 p-3 shadow-pop backdrop-blur-md sm:-right-5 sm:top-9"
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
              <BlobMark size={14} />
              <span className="flex-1">{t.notifyApp}</span>
              <BellRing className="size-3" />
            </div>
            <div className="mt-1 text-[13.5px] font-semibold leading-tight text-ink">{t.notifyTitle}</div>
            <div className="text-[12px] text-ink-2">{t.notifyBody}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The "Next up" widget from the home screen. */}
      <NextWidget t={t} live={visible && !reduce} className="absolute -bottom-7 -left-5 z-20 hidden w-[176px] md:block" />
    </div>
  );
}

function LessonBlock({ block, t, lifted }: { block: Block; t: T; lifted: boolean }) {
  const color = COLOR[block.subject];
  const title = block.subject === "study" ? t.study : t.subjects[block.subject];
  const room = block.subject === "study" || block.subject === "choir" ? null : t.rooms[block.subject as keyof T["rooms"]];
  return (
    <div
      className={cn("flex h-full flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 transition-shadow", lifted && "shadow-pop")}
      style={{ borderColor: color, background: `color-mix(in oklab, ${color} 15%, var(--raised))` }}
    >
      <span className="truncate text-[10.5px] font-semibold leading-tight text-ink">{title}</span>
      <span className="truncate text-[9.5px] leading-tight tabular-nums text-ink-2">
        {clock(block.from)}
        {room && <span className="max-lg:hidden"> · {room}</span>}
      </span>
    </div>
  );
}

/** Counts down from ten minutes while on screen (it's a picture of a live widget). */
function NextWidget({ t, live, className }: { t: T; live: boolean; className?: string }) {
  const [left, setLeft] = useState(600);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setLeft((s) => (s > 1 ? s - 1 : 600)), 1000);
    return () => clearInterval(timer);
  }, [live]);
  const countdown = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <motion.div
      className={cn("rounded-[22px] border border-line bg-raised p-3 shadow-pop", className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center gap-1.5">
        <BlobMark size={15} />
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.06em] text-blob-ink">{t.widgetNext}</span>
        <span className="flex h-[18px] items-center gap-0.5 rounded-full bg-blob-soft px-1.5 text-[10.5px] font-bold text-blob-ink">
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
            <path d="M6 1c.4 1.6 2.2 2.5 2.2 4.6 0 .6-.2 1-.4 1.3.6-.2 1.1-.8 1.2-1.5.9.8 1.4 1.9 1.4 3C10.4 10.6 8.4 11 6 11S1.6 10.6 1.6 8.4c0-2.3 2.4-3.4 2.9-5.4.5.8.5 1.6.3 2.3C6 4.6 6.4 2.7 6 1Z" fill="currentColor" />
          </svg>
          6
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <span className="w-1 shrink-0 rounded-full" style={{ background: COLOR.maths }} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-tight text-ink">{t.subjects.maths}</div>
          <div className="truncate text-[11px] tabular-nums text-ink-3">9:45 – 11:15 · {t.rooms.maths}</div>
        </div>
      </div>
      <div className="mt-2.5 text-[13px] font-bold tabular-nums text-blob-ink">{t.widgetSoon(countdown)}</div>
    </motion.div>
  );
}

export function CalendarPoints({ className }: { className?: string }) {
  const t = useMessages(landingText).calendar.points;
  return (
    <PointList
      className={className}
      points={[
        { key: "drag", Icon: Move, ...t.drag },
        { key: "timetable", Icon: Repeat, ...t.timetable },
        { key: "school", Icon: GraduationCap, ...t.school },
        { key: "reminders", Icon: BellRing, ...t.reminders },
        { key: "widgets", Icon: LayoutGrid, ...t.widgets },
        { key: "offline", Icon: CloudOff, ...t.offline },
      ]}
    />
  );
}
