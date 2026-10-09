"use client";

import { CalendarDays, Check, CheckSquare, Link2, ListTodo, Paperclip, PenLine, Rows3, SquareKanban, UserPlus, Users } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";
import { PointList } from "./Points";
import { useReducedAfterMount } from "./useTyping";

type Who = "me" | "lena" | "jonas";
type CardKey = "slides" | "practise" | "sources" | "topic";
type Column = "todo" | "doing" | "done";

/** Everyone's colour (from the app's peer colours): avatar, cursor and the ring round a card they look at. */
const COLORS: Record<Who, string> = { me: "#6d3df5", lena: "#c4653e", jonas: "#2f6f6a" };
const COLUMNS: Column[] = ["todo", "doing", "done"];

const CARDS: Record<
  CardKey,
  { label?: { key: "slides" | "talk" | "research"; color: string }; priority: 0 | 1 | 2 | 3; due?: "slides" | "practise"; checklist?: number; files?: number; people: Who[] }
> = {
  slides: { label: { key: "slides", color: "var(--subject-sky)" }, priority: 2, due: "slides", people: ["lena"] },
  practise: { label: { key: "talk", color: "var(--subject-rose)" }, priority: 1, due: "practise", people: ["me", "lena", "jonas"] },
  sources: { label: { key: "research", color: "var(--subject-sand)" }, priority: 3, checklist: 3, files: 2, people: ["jonas"] },
  topic: { priority: 0, people: ["me"] },
};

type Frame = { cols: CardKey[][]; who?: { card: CardKey; who: Who }; lift?: CardKey; ticked: number; ms: number };

const START: CardKey[][] = [["slides", "practise"], ["sources"], ["topic"]];
const MOVED: CardKey[][] = [["practise"], ["slides", "sources"], ["topic"]];
const DONE: CardKey[][] = [["practise"], ["slides"], ["sources", "topic"]];
const LENA = { card: "slides", who: "lena" } as const;
const JONAS = { card: "sources", who: "jonas" } as const;

/** Lena drags her slides to "Doing"; Jonas ticks off the last source and moves his card to "Done". */
const FRAMES: Frame[] = [
  { cols: START, ticked: 2, ms: 1500 },
  { cols: START, who: LENA, ticked: 2, ms: 1100 },
  { cols: START, who: LENA, lift: "slides", ticked: 2, ms: 550 },
  { cols: MOVED, who: LENA, lift: "slides", ticked: 2, ms: 950 },
  { cols: MOVED, who: LENA, ticked: 2, ms: 900 },
  { cols: MOVED, who: JONAS, ticked: 2, ms: 1200 },
  { cols: MOVED, who: JONAS, ticked: 3, ms: 1100 },
  { cols: MOVED, who: JONAS, lift: "sources", ticked: 3, ms: 550 },
  { cols: DONE, who: JONAS, lift: "sources", ticked: 3, ms: 950 },
  { cols: DONE, who: JONAS, ticked: 3, ms: 900 },
  { cols: DONE, ticked: 3, ms: 2800 },
];
/** With reduced motion the board holds still on Lena looking at her card. */
const STILL = 1;

const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

/** A project board where two classmates move cards while you watch; the round starts over with a fade. */
export function BoardShowcase({ className }: { className?: string }) {
  const t = useMessages(landingText).together.board;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const reduce = useReducedAfterMount();
  const [state, setState] = useState({ round: 0, i: 0 });
  const frame = FRAMES[reduce ? STILL : state.i];
  const done = frame.cols[2].length;
  const total = frame.cols.flat().length;

  useEffect(() => {
    if (!visible || reduce) return;
    const timer = setTimeout(
      () => setState((s) => (s.i + 1 < FRAMES.length ? { round: s.round, i: s.i + 1 } : { round: s.round + 1, i: 0 })),
      FRAMES[state.i].ms,
    );
    return () => clearTimeout(timer);
  }, [visible, reduce, state.i]);

  return (
    <div ref={ref} role="img" aria-label={t.label} className={cn("overflow-hidden rounded-2xl border border-line bg-surface shadow-card", className)}>
      <div className="flex h-12 items-center gap-2.5 border-b border-line bg-raised px-3 sm:px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-[15px]">🎤</span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em]">{t.project}</span>
        <span className="flex shrink-0 items-center">
          <Face who="me" name={t.people.me} size={22} />
          <Face who="lena" name={t.people.lena} size={22} here className="-ml-1" />
          <Face who="jonas" name={t.people.jonas} size={22} here className="-ml-1" />
        </span>
        <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-[12.5px] font-medium text-ink-2 shadow-card">
          <UserPlus className="size-3.5" />
          <span className="max-sm:hidden">{t.share}</span>
        </span>
      </div>
      <div className="flex items-center gap-3 px-3 pt-3 sm:px-4">
        <span className="flex rounded-lg bg-hover/70 p-0.5 text-[12px]">
          <span className="flex h-6 items-center gap-1 rounded-md bg-raised px-2 font-medium text-ink shadow-card">
            <SquareKanban className="size-3" />
            {t.views.board}
          </span>
          <span className="flex h-6 items-center gap-1 px-2 text-ink-3">
            <Rows3 className="size-3" />
            {t.views.list}
          </span>
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2 text-[12px] text-ink-3">
          <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-line sm:w-16">
            <motion.span className="block h-full rounded-full bg-ink-2" initial={false} animate={{ width: `${(done / total) * 100}%` }} transition={{ duration: 0.5 }} />
          </span>
          <span className="truncate tabular-nums">{t.progress(done, total)}</span>
        </span>
      </div>
      {/* A fixed height, so the page never moves while cards travel. */}
      <div className="h-[300px] p-3 sm:h-[312px] sm:p-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.round}
            className="grid h-full grid-cols-3 gap-2 sm:gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.4 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <LayoutGroup id={`landing-board-${state.round}`}>
              {COLUMNS.map((col, c) => (
                <div key={col} className="@container flex min-w-0 flex-col rounded-xl bg-hover/45 p-1.5 dark:bg-hover/35">
                  {/* Narrow columns (phones) tighten the header so "In Arbeit" still fits. */}
                  <div className="flex h-8 shrink-0 items-center gap-1 px-1 text-[12px] @min-[150px]:gap-1.5 @min-[150px]:px-1.5 @min-[150px]:text-[12.5px]">
                    {col === "done" ? (
                      <span className="grid size-3 shrink-0 place-items-center rounded-full bg-ink text-paper @min-[150px]:size-3.5">
                        <Check className="size-2 @min-[150px]:size-2.5" strokeWidth={3.5} />
                      </span>
                    ) : (
                      <span className="size-3 shrink-0 rounded-full border-[1.5px] border-ink @min-[150px]:size-3.5" />
                    )}
                    <span className="min-w-0 truncate font-semibold">{t.columns[col]}</span>
                    <span className="tabular-nums text-ink-3">{frame.cols[c].length}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {frame.cols[c].map((key) => (
                      <BoardCard
                        key={key}
                        id={`${state.round}-${key}`}
                        card={key}
                        done={col === "done"}
                        ticked={frame.ticked}
                        lifted={frame.lift === key}
                        watcher={frame.who?.card === key ? frame.who.who : undefined}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function BoardCard({ id, card, done, ticked, lifted, watcher }: { id: string; card: CardKey; done: boolean; ticked: number; lifted: boolean; watcher?: Who }) {
  const t = useMessages(landingText).together.board;
  const c = CARDS[card];
  const ring = watcher ? `0 0 0 1.5px ${COLORS[watcher]}` : null;
  const lift = "0 2px 4px rgb(0 0 0 / 0.06), 0 16px 32px -8px rgb(0 0 0 / 0.28)";
  const checked = card === "sources" ? ticked : 0;
  return (
    <motion.div layoutId={id} transition={spring} className="relative" style={{ zIndex: lifted ? 20 : watcher ? 10 : 0 }}>
      <motion.div
        animate={{ rotate: lifted ? 1.5 : 0, scale: lifted ? 1.03 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className="rounded-[10px] border border-line bg-raised px-2 pb-2 pt-2 transition-shadow duration-200 @min-[150px]:px-2.5"
        style={{ boxShadow: [ring, lifted ? lift : "var(--shadow-card)"].filter(Boolean).join(", ") }}
      >
        {c.label && (
          <span className="mb-1.5 hidden h-[18px] max-w-full items-center gap-1 rounded-md border border-line bg-raised px-1.5 text-[11px] font-medium leading-none text-ink-2 @min-[150px]:inline-flex">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: c.label.color }} />
            <span className="truncate">{t.labels[c.label.key]}</span>
          </span>
        )}
        <div className={cn("break-words text-[12.5px] leading-[1.35] @min-[150px]:text-[13px]", done ? "text-ink-3" : "text-ink")}>
          {done && <Check className="-mt-0.5 mr-1 inline size-3.5 text-ok" strokeWidth={2.6} />}
          {t.cards[card]}
        </div>
        <div className="mt-1.5 flex min-h-5 items-center gap-x-1.5 text-[11px] text-ink-3">
          {c.priority > 0 && <Priority value={c.priority} className="hidden @min-[150px]:block" />}
          {c.due && (
            <span className="hidden h-5 items-center gap-1 rounded-md font-medium tabular-nums @min-[150px]:inline-flex">
              <CalendarDays className="size-3" strokeWidth={2.2} />
              {t.due[c.due]}
            </span>
          )}
          {c.checklist && (
            <span className={cn("inline-flex items-center gap-1 tabular-nums transition-colors duration-300", checked === c.checklist && "text-ok")}>
              <CheckSquare className="size-3" strokeWidth={2.2} />
              {checked}/{c.checklist}
            </span>
          )}
          {c.files && (
            <span className="hidden items-center gap-0.5 tabular-nums @min-[150px]:inline-flex">
              <Paperclip className="size-3" strokeWidth={2.2} />
              {c.files}
            </span>
          )}
          <span className="ml-auto flex">
            {c.people.map((who, i) => (
              <Face key={who} who={who} name={t.people[who]} size={18} className={cn(i > 0 && "-ml-1.5", i > 1 && "@max-[149px]:hidden")} />
            ))}
          </span>
        </div>
      </motion.div>
      <AnimatePresence>
        {watcher && (
          <motion.span
            initial={{ opacity: 0, x: 8, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="pointer-events-none absolute -bottom-3 right-1 flex items-start"
          >
            <svg viewBox="0 0 16 16" className="size-4 drop-shadow-sm" aria-hidden>
              <path d="M2.5 1.8 13 7.2 8.3 8.4 6.2 13z" fill={COLORS[watcher]} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span className="-ml-0.5 mt-3 rounded-[5px] px-1.5 py-px text-[11px] font-semibold leading-tight text-white" style={{ background: COLORS[watcher] }}>
              {t.people[watcher]}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Someone's initial on their colour; `here`: a ring in their colour, they have the board open right now. */
function Face({ who, name, size, here, className }: { who: Who; name: string; size: number; here?: boolean; className?: string }) {
  const color = COLORS[who];
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold leading-none text-white ring-2 ring-raised", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45), background: color, boxShadow: here ? `0 0 0 2px var(--raised), 0 0 0 3.5px ${color}` : undefined }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Priority as three rising bars (like the app's cards): high is orange. */
function Priority({ value, className }: { value: 0 | 1 | 2 | 3; className?: string }) {
  const color = value === 3 ? "var(--subject-clay)" : "currentColor";
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", value < 3 && "text-ink-2", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2.5 + i * 4} y={10 - i * 3.5} width={3} height={3.5 + i * 3.5} rx={1} fill={i < value ? color : "currentColor"} opacity={i < value ? 1 : 0.22} />
      ))}
    </svg>
  );
}

/** Sharing, presence, writing together, boards and your tasks, next to the board. */
export function TogetherPoints({ className }: { className?: string }) {
  const t = useMessages(landingText).together.points;
  return (
    <PointList
      className={className}
      points={[
        { key: "share", Icon: Link2, ...t.share },
        { key: "presence", Icon: Users, ...t.presence },
        { key: "live", Icon: PenLine, ...t.live },
        { key: "boards", Icon: SquareKanban, ...t.boards },
        { key: "tasks", Icon: ListTodo, ...t.tasks },
      ]}
    />
  );
}
