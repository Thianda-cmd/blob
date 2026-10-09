"use client";

import { GraduationCap, Hash, Search } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Blob, type BlobAccessory, type BlobHandle, type BlobMood } from "@/components/blob/Blob";
import { TypedText } from "@/components/blob/speech";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";
import { useReducedAfterMount, useTyping } from "./useTyping";

type Mood = { key: string; mood: BlobMood; accessory?: BlobAccessory; gesture?: "wave" | "celebrate" | "point" };

const MOODS: Mood[] = [
  { key: "hello", mood: "happy", gesture: "wave" },
  { key: "maths", mood: "thinking", accessory: "glasses", gesture: "point" },
  { key: "exam", mood: "happy" },
  { key: "done", mood: "excited", accessory: "cap", gesture: "celebrate" },
  { key: "squish", mood: "love" },
];

/** The big hero Blob: follows the cursor, cycles moods, jiggles when clicked. */
export function HeroBlob() {
  const t = useMessages(landingText).hero;
  const people = useMessages(landingText).together.board.people;
  const ref = useRef<BlobHandle>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % MOODS.length), 3800);
    return () => clearInterval(timer);
  }, []);

  const current = MOODS[i];
  const line = t.lines[current.key as keyof typeof t.lines];
  const { shown, typing } = useTyping(line);

  useEffect(() => {
    const gesture = MOODS[i].gesture;
    const timer = setTimeout(() => {
      if (gesture === "wave") ref.current?.wave();
      if (gesture === "celebrate") ref.current?.celebrate();
      if (gesture === "point") ref.current?.point();
    }, 250);
    return () => clearTimeout(timer);
  }, [i]);

  return (
    // From sm up the cards float around Blob; the top two sit above the speech bubble's band (top padding), never under it.
    <div className="relative mx-auto grid h-[340px] w-full max-w-[540px] place-items-center sm:h-[460px] sm:pt-16 lg:h-[520px]">
      <FloatCard className="left-0 top-[2%] -rotate-6" delay={0}>
        <div className="text-[11px] text-ink-3">{t.cards.subject}</div>
        <div className="font-display text-[15px] font-semibold">{t.cards.note}</div>
        {/* A shared note: two classmates have it open (their colours, as in the app). */}
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-1.5 w-24 rounded bg-line" />
          <span className="flex">
            {[
              { name: people.lena, color: "#c4653e" },
              { name: people.jonas, color: "#2f6f6a" },
            ].map((p, i) => (
              <span
                key={p.name}
                className={cn("grid size-[18px] place-items-center rounded-full text-[9px] font-semibold text-white ring-2 ring-raised", i > 0 && "-ml-1")}
                style={{ background: p.color }}
              >
                {p.name.slice(0, 1)}
              </span>
            ))}
          </span>
        </div>
      </FloatCard>
      <FloatCard className="right-0 top-[7%] rotate-6" delay={0.8}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-blob-ink">{t.cards.exam}</div>
        <div className="text-[13.5px] font-medium">{t.cards.examTitle}</div>
      </FloatCard>
      <FloatCard className="bottom-[10%] left-[4%] rotate-3" delay={1.6}>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="grid size-4 place-items-center rounded-[5px] bg-blob text-white">
            <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
              <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-ink-3 line-through">{t.cards.task}</span>
        </div>
      </FloatCard>
      <FloatCard className="bottom-[5%] right-[3%] -rotate-3" delay={2.4}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-blob-ink">{t.cards.goal}</div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
            <motion.div
              className="h-full rounded-full bg-blob"
              initial={{ width: "20%" }}
              animate={{ width: "75%" }}
              transition={{ delay: 1.2, duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className="text-[12px] font-medium tabular-nums text-ink-2">45/60 XP</span>
        </div>
      </FloatCard>

      <div className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={line}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="absolute left-1/2 top-[10px] z-10 w-max max-w-[300px] -translate-x-1/2 rounded-2xl border border-line bg-raised px-4 py-2 text-center text-[14px] shadow-pop"
          >
            <TypedText text={line} shown={shown} />
            <span className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-b border-r border-line bg-raised" />
          </motion.div>
        </AnimatePresence>
        <Blob
          ref={ref}
          size={340}
          className="max-sm:h-[290px] max-sm:w-[290px]"
          mood={current.mood}
          accessory={current.accessory ?? null}
          talking={typing}
          title={t.blob}
          onClick={() => {
            ref.current?.jump(1.2);
            setI(MOODS.length - 1);
          }}
        />
      </div>
    </div>
  );
}

function FloatCard({ children, className, delay }: { children: React.ReactNode; className: string; delay: number }) {
  return (
    <motion.div
      aria-hidden
      className={`absolute hidden rounded-xl border border-line bg-raised px-3.5 py-2.5 shadow-card sm:block ${className}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{ opacity: { delay: 0.3 + delay / 4, duration: 0.5 }, y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay } }}
    >
      {children}
    </motion.div>
  );
}

/** Fades a block up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Types a quick-add phrase and shows what Blob understood. */
export function QuickAddDemo() {
  const t = useMessages(landingText).homework.demo;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.5 });
  const reduce = useReducedAfterMount();
  const phrase = t.input;
  const [typed, setTyped] = useState({ phrase, count: 0 });

  // A new language restarts the demo (derived-state reset during render).
  if (typed.phrase !== phrase) setTyped({ phrase, count: 0 });
  const count = reduce ? phrase.length : typed.count;
  const text = phrase.slice(0, count);
  const parsed = count >= phrase.length;

  useEffect(() => {
    if (!visible || reduce) return;
    const done = typed.count >= phrase.length;
    const delay = typed.count === 0 ? 600 : done ? 2800 : 70 + ((typed.count * 37) % 60);
    const timer = setTimeout(() => setTyped((s) => ({ phrase: s.phrase, count: done ? 0 : s.count + 1 })), delay);
    return () => clearTimeout(timer);
  }, [visible, reduce, typed.count, phrase.length]);

  return (
    <div ref={ref} aria-hidden className="h-[224px] w-full rounded-xl border border-line bg-raised p-4 shadow-card">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[14px]">
        <span className="text-ink-3">+</span>
        <span className="whitespace-pre">{text}</span>
        <span className="h-4 w-px animate-pulse bg-ink" />
      </div>
      <div className="mt-2.5 flex h-6 flex-wrap gap-1.5">
        <AnimatePresence>
          {parsed &&
            t.chips.map((label, i) => (
              <motion.span
                key={label}
                initial={{ opacity: 0, scale: 0.6, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: i * 0.08, type: "spring", stiffness: 600, damping: 18 } }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", i === 0 ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2")}
              >
                {label}
              </motion.span>
            ))}
        </AnimatePresence>
      </div>
      <ul className="mt-3 border-t border-line pt-1">
        <AnimatePresence initial={false}>
          {parsed && <TaskLine key="new" title={t.task} due={t.due} fresh />}
        </AnimatePresence>
        {t.list.map((task) => (
          <TaskLine key={task.title} title={task.title} due={task.due} />
        ))}
      </ul>
    </div>
  );
}

function TaskLine({ title, due, fresh }: { title: string; due: string; fresh?: boolean }) {
  return (
    <motion.li
      layout="position"
      initial={fresh ? { opacity: 0, height: 0 } : false}
      animate={{ opacity: 1, height: 32 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="flex items-center gap-2.5 overflow-hidden text-[13.5px]"
    >
      <span className="size-4 shrink-0 rounded-[5px] border border-line-2" />
      <span className={cn("min-w-0 flex-1 truncate", fresh ? "font-medium text-ink" : "text-ink-2")}>{title}</span>
      <span className={cn("rounded-md px-1.5 py-px text-[11.5px] font-medium", fresh ? "bg-blob-soft text-blob-ink" : "text-ink-3")}>{due}</span>
    </motion.li>
  );
}

type GraphNode = { key: keyof (typeof landingText)["en"]["organize"]["demo"]["nodes"]; kind: "page" | "tag" | "topic"; x: number; y: number };

// A small knowledge graph of biology notes, drawn like the one on the notes home: pages are dots in their
// subject's colour, a tag and a learning topic are rings with their symbol.
const GRAPH: GraphNode[] = [
  { key: "photo", kind: "page", x: 156, y: 62 },
  { key: "chloro", kind: "page", x: 58, y: 30 },
  { key: "leaf", kind: "page", x: 92, y: 112 },
  { key: "cell", kind: "page", x: 28, y: 84 },
  { key: "resp", kind: "page", x: 286, y: 100 },
  { key: "exam", kind: "tag", x: 262, y: 26 },
  { key: "topic", kind: "topic", x: 196, y: 122 },
];
const EDGES: { a: number; b: number; kind: "link" | "child" | "tag" }[] = [
  { a: 0, b: 1, kind: "link" },
  { a: 0, b: 2, kind: "child" },
  { a: 1, b: 3, kind: "link" },
  { a: 4, b: 3, kind: "link" },
  { a: 0, b: 5, kind: "tag" },
  { a: 4, b: 5, kind: "tag" },
  { a: 0, b: 6, kind: "tag" },
];
/** The node each search query finds. */
const FINDS = [1, 5];

/** The notes home: a search types itself and the knowledge graph lights up what it finds. */
export function KnowledgeDemo() {
  const t = useMessages(landingText).organize.demo;
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.5 });
  const reduce = useReducedAfterMount();
  const [typed, setTyped] = useState({ q: 0, count: 0 });
  // The graph spreads out on wider cards (up to a point) while the labels keep their size.
  const svg = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const span = Math.min(width, 520);
  const X = (x: number) => (width - span) / 2 + (x * span) / 320;
  const query = t.queries[typed.q];
  const count = reduce ? query.length : typed.count;
  const focus = count >= query.length ? FINDS[typed.q] : null;
  const lit = focus === null ? null : new Set([focus, ...EDGES.flatMap((e) => (e.a === focus ? [e.b] : e.b === focus ? [e.a] : []))]);

  useEffect(() => {
    if (!visible || reduce) return;
    const done = typed.count >= query.length;
    const delay = typed.count === 0 ? 700 : done ? 2800 : 110;
    const timer = setTimeout(() => setTyped((s) => (done ? { q: (s.q + 1) % FINDS.length, count: 0 } : { q: s.q, count: s.count + 1 })), delay);
    return () => clearTimeout(timer);
  }, [visible, reduce, typed.count, query.length]);

  const color = (n: GraphNode) => (n.kind === "tag" ? "var(--blob)" : n.kind === "topic" ? "var(--ok)" : "var(--subject-moss)");

  return (
    <div ref={ref} aria-hidden className="h-[224px] w-full rounded-xl border border-line bg-raised p-4 shadow-card">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13.5px]">
        <Search className="size-4 shrink-0 text-ink-3" />
        {/* The caret sits before the placeholder, then after what's typed, like in a real field. */}
        {count > 0 ? (
          <>
            <span className="whitespace-pre">{query.slice(0, count)}</span>
            <span className="-ml-1.5 h-4 w-px shrink-0 animate-pulse bg-ink" />
          </>
        ) : (
          <>
            <span className="-mr-1.5 h-4 w-px shrink-0 animate-pulse bg-ink" />
            <span className="truncate text-ink-3">{t.search}</span>
          </>
        )}
      </div>
      <svg ref={svg} viewBox={`0 0 ${width} 150`} className="mt-2 h-[148px] w-full overflow-visible">
        {EDGES.map((e, i) => {
          const a = GRAPH[e.a];
          const b = GRAPH[e.b];
          const on = lit !== null && (e.a === focus || e.b === focus);
          return (
            <line
              key={i}
              x1={X(a.x)}
              y1={a.y}
              x2={X(b.x)}
              y2={b.y}
              stroke={on ? (e.kind === "link" ? "var(--blob)" : "var(--ink-3)") : "var(--line-2)"}
              strokeWidth={e.kind === "link" ? 1.6 : 1.2}
              strokeDasharray={e.kind === "child" ? "5 4" : e.kind === "tag" ? "1.5 4" : undefined}
              strokeLinecap="round"
              opacity={lit && !on ? 0.25 : 1}
              className="transition-[opacity,stroke] duration-300"
            />
          );
        })}
        {GRAPH.map((n, i) => {
          const c = color(n);
          const r = i === 0 ? 7 : n.kind === "page" ? 5.5 : 7;
          return (
            <g key={n.key} transform={`translate(${X(n.x)} ${n.y})`} opacity={lit && !lit.has(i) ? 0.22 : 1} className="transition-opacity duration-300">
              {n.kind === "page" ? (
                <circle r={r} fill={c} stroke="var(--raised)" strokeWidth={1.5} />
              ) : (
                <>
                  <circle r={r + 2} fill="var(--raised)" stroke={c} strokeWidth={1.8} />
                  {n.kind === "tag" ? (
                    <Hash x={-r * 0.75} y={-r * 0.75} width={r * 1.5} height={r * 1.5} color={c} strokeWidth={2.4} />
                  ) : (
                    <GraduationCap x={-r * 0.75} y={-r * 0.75} width={r * 1.5} height={r * 1.5} color={c} strokeWidth={2.4} />
                  )}
                </>
              )}
              {focus === i && <circle r={r + 5} fill="none" stroke={c} strokeWidth={1.5} opacity={0.5} />}
              <text
                y={r + 14}
                textAnchor="middle"
                fontSize={11}
                fill={n.kind === "page" ? "var(--ink-2)" : c}
                fontWeight={focus === i || n.kind !== "page" ? 600 : 450}
                paintOrder="stroke"
                stroke="var(--raised)"
                strokeWidth={3.5}
                strokeLinejoin="round"
              >
                {n.kind === "tag" ? `#${t.nodes[n.key]}` : t.nodes[n.key]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
