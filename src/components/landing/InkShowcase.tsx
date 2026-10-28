"use client";

import { Eraser, FileDown, Hand, Highlighter, Lasso, NotebookText, PenLine, Redo2, Type, Undo2, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Caveat } from "next/font/google";
import { useEffect, useId, useRef, useState } from "react";
import { useDark } from "@/components/editor/blocks/useDark";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { inkColor, lookOf } from "@/ink/render";
import { cn } from "@/lib/utils";
import { PointList } from "./Points";
import { useReducedAfterMount } from "./useTyping";

/** A handwriting face for the demo's writing (the real notes keep the strokes people make). */
const hand = Caveat({ subsets: ["latin"], weight: ["500", "600"] });

type Tool = "pen" | "highlighter";
const BLUE = "#2563eb";
const RED = "#dc2626";
const GREEN = "#16a34a";
const AMBER = "#f59e0b";
const YELLOW = "#facc15";

/** What gets written, in order: each step writes one thing, with the pen and colour it takes. */
const STEPS: { ms: number; tool: Tool; color: string }[] = [
  { ms: 800, tool: "pen", color: "ink" }, // 0 the empty page
  { ms: 1300, tool: "pen", color: "ink" }, // 1 the title
  { ms: 500, tool: "pen", color: "ink" }, // 2 its underline
  { ms: 1100, tool: "pen", color: BLUE }, // 3 the formula…
  { ms: 700, tool: "pen", color: BLUE }, // 4 …glucose…
  { ms: 600, tool: "pen", color: BLUE }, // 5 …and the rest
  { ms: 650, tool: "highlighter", color: YELLOW }, // 6 glucose highlighted
  { ms: 1400, tool: "pen", color: "ink" }, // 7 the second line…
  { ms: 500, tool: "pen", color: "ink" }, // 8 …"light"
  { ms: 800, tool: "pen", color: RED }, // 9 a wobbly circle round it
  { ms: 700, tool: "pen", color: RED }, // 10 held still: a clean one
  { ms: 600, tool: "pen", color: RED }, // 11 an arrow to…
  { ms: 900, tool: "pen", color: AMBER }, // 12 …a sun
  { ms: 1300, tool: "pen", color: GREEN }, // 13 a leaf
  { ms: 3400, tool: "pen", color: GREEN }, // 14 a look at it all
];
const LAST = STEPS.length - 1;

/** Chemistry: digits right after a letter are written small and low (CO2 → CO₂). */
function Chem({ text, size }: { text: string; size: number }) {
  const parts = text.split(/(?<=[A-Za-z)])(\d+)/);
  const drop = size * 0.22;
  return (
    <>
      {parts.map((p, k) =>
        k % 2 ? (
          <tspan key={k} dy={drop} fontSize={size * 0.68}>
            {p}
          </tspan>
        ) : (
          <tspan key={k} dy={k ? -drop : undefined}>
            {p}
          </tspan>
        ),
      )}
    </>
  );
}

/** A circle as a hand draws it: a little off, overlapping where it began. */
function wobbly(cx: number, cy: number, rx: number, ry: number) {
  const pts: string[] = [];
  const n = 26;
  for (let k = 0; k <= n; k++) {
    const a = -1.9 + (k / n) * (Math.PI * 2 + 0.45);
    const wob = 1 + 0.06 * Math.sin(k * 1.7) + 0.03 * Math.cos(k * 2.9) + (k / n) * 0.07;
    pts.push(`${(cx + Math.cos(a) * rx * wob).toFixed(1)} ${(cy + Math.sin(a) * ry * wob).toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

type Widths = { title: number; a: number; b: number; c: number; d: number; e: number };

/** A handwritten note on photosynthesis, written by itself: pens, colours, a highlighter, a shape that straightens. */
export function InkShowcase({ className }: { className?: string }) {
  const t = useMessages(landingText).handwriting.demo;
  const uid = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const still = useReducedAfterMount();
  const dark = useDark();
  const look = lookOf("auto", dark);
  const ink = (c: string) => inkColor(c, look.dark);
  const [state, setState] = useState({ round: 0, i: 0 });
  const i = still ? LAST : state.i;

  // How wide each piece came out in the handwriting face (estimated until the face is there).
  const texts = useRef<Record<keyof Widths, SVGTextElement | null>>({ title: null, a: null, b: null, c: null, d: null, e: null });
  const [w, setW] = useState<Widths>(() => ({ title: t.title.length * 17, a: t.a.length * 11, b: t.b.length * 10, c: t.c.length * 11, d: t.d.length * 10, e: t.e.length * 11 }));
  useEffect(() => {
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const next = { ...w };
      for (const k of Object.keys(texts.current) as (keyof Widths)[]) {
        const el = texts.current[k];
        if (el) next[k] = el.getComputedTextLength();
      }
      setW(next);
    };
    void document.fonts.ready.then(measure);
    return () => {
      alive = false;
    };
    // Measured once per language (the widths only depend on the words).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (!visible || still) return;
    const timer = setTimeout(() => setState((s) => (s.i < LAST ? { round: s.round, i: s.i + 1 } : { round: s.round + 1, i: 0 })), STEPS[state.i].ms);
    return () => clearTimeout(timer);
  }, [visible, still, state.i]);

  const step = STEPS[i];
  // Where things go (the page is 600 × 400).
  const xB = 40 + w.a + 12;
  const xC = xB + w.b + 12;
  const xE = 40 + w.d + 20;
  const ring = { cx: xE + w.e / 2, cy: 199, rx: w.e / 2 + 11, ry: 22 };
  const font = { fontFamily: hand.style.fontFamily };

  /** Written out from left to right during its step. */
  const reveal = (k: number, x: number, y: number, width: number, size: number) => (
    <clipPath id={`${uid}-w${k}`}>
      <motion.rect
        x={x - 6}
        y={y - size * 1.05}
        height={size * 1.6}
        initial={still ? false : { width: 0 }}
        animate={{ width: i >= k ? width + 12 : 0 }}
        transition={{ duration: i === k ? STEPS[k].ms / 1000 - 0.08 : 0, ease: "linear" }}
      />
    </clipPath>
  );
  /** Drawn along its length during its step. */
  const draw = (k: number) => ({
    initial: still ? false : { pathLength: 0, opacity: 0 },
    animate: { pathLength: i >= k ? 1 : 0, opacity: i >= k ? 1 : 0 },
    transition: { pathLength: { duration: i === k ? STEPS[k].ms / 1000 - 0.08 : 0, ease: "easeInOut" as const }, opacity: { duration: 0.01 } },
  });

  const lines = Array.from({ length: 10 }, (_, k) => 78 + k * 34);

  return (
    <div ref={ref} role="img" aria-label={t.label} className={cn("relative", className)}>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {/* The floating toolbar, with the pen and colour in use. */}
        <div className="flex justify-center px-3 pt-3">
          <div className="flex items-center gap-0.5 rounded-xl border border-line bg-raised p-1 shadow-card" aria-hidden>
            <ToolIcon Icon={Undo2} />
            <ToolIcon Icon={Redo2} />
            <span className="mx-1 h-5 w-px bg-line" />
            <ToolIcon Icon={PenLine} on={step.tool === "pen"} bar={step.tool === "pen" ? ink(step.color) : undefined} />
            <ToolIcon Icon={Highlighter} on={step.tool === "highlighter"} bar={YELLOW} />
            <ToolIcon Icon={Eraser} />
            <ToolIcon Icon={Lasso} className="max-sm:hidden" />
            <ToolIcon Icon={Type} className="max-sm:hidden" />
            <span className="mx-1 h-5 w-px bg-line" />
            {["ink", BLUE, RED, GREEN].map((c) => (
              <span key={c} className="grid size-7 place-items-center">
                <motion.span
                  className="block size-[18px] rounded-full"
                  style={{ background: ink(c) }}
                  animate={{ boxShadow: step.tool === "pen" && step.color === c ? `0 0 0 2px var(--raised), 0 0 0 3.5px var(--blob)` : "0 0 0 0px var(--raised), 0 0 0 0px var(--blob)" }}
                  transition={{ duration: 0.2 }}
                />
              </span>
            ))}
          </div>
        </div>

        {/* The page. */}
        <div className="px-3 pb-3 pt-2.5 sm:px-5 sm:pb-5">
          <svg viewBox="0 0 600 400" className="block w-full rounded-lg shadow-[0_1px_3px_rgb(40_36_28/0.12)]" style={{ background: look.paper }}>
            {lines.map((y) => (
              <line key={y} x1={0} x2={600} y1={y} y2={y} stroke={look.line} strokeWidth={1} />
            ))}
            <AnimatePresence initial={false}>
              <motion.g key={state.round} initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
                <defs>
                  {reveal(1, 36, 62, w.title, 40)}
                  {reveal(3, 40, 140, w.a, 28)}
                  {reveal(4, xB, 140, w.b, 28)}
                  {reveal(5, xC, 140, w.c, 28)}
                  {reveal(7, 40, 206, w.d, 26)}
                  {reveal(8, xE, 206, w.e, 26)}
                </defs>

                {/* Under the ink: the highlighter. */}
                <motion.path d={`M${xB - 4} 131 L${xB + w.b + 5} 130`} stroke={ink(YELLOW)} strokeOpacity={look.dark ? 0.32 : 0.5} strokeWidth={24} strokeLinecap="round" fill="none" {...draw(6)} />

                <text ref={(el) => void (texts.current.title = el)} x={36} y={62} fontSize={40} fontWeight={600} fill={ink("ink")} style={font} clipPath={`url(#${uid}-w1)`}>
                  {t.title}
                </text>
                <motion.path d={`M34 75 Q ${36 + w.title / 2} 81 ${40 + w.title} 72`} stroke={ink("ink")} strokeWidth={2.6} strokeLinecap="round" fill="none" {...draw(2)} />

                <text ref={(el) => void (texts.current.a = el)} x={40} y={140} fontSize={28} fontWeight={500} fill={ink(BLUE)} style={font} clipPath={`url(#${uid}-w3)`}>
                  <Chem text={t.a} size={28} />
                </text>
                <text ref={(el) => void (texts.current.b = el)} x={xB} y={140} fontSize={28} fontWeight={500} fill={ink(BLUE)} style={font} clipPath={`url(#${uid}-w4)`}>
                  <Chem text={t.b} size={28} />
                </text>
                <text ref={(el) => void (texts.current.c = el)} x={xC} y={140} fontSize={28} fontWeight={500} fill={ink(BLUE)} style={font} clipPath={`url(#${uid}-w5)`}>
                  <Chem text={t.c} size={28} />
                </text>

                <text ref={(el) => void (texts.current.d = el)} x={40} y={206} fontSize={26} fontWeight={500} fill={ink("ink")} style={font} clipPath={`url(#${uid}-w7)`}>
                  {t.d}
                </text>
                <text ref={(el) => void (texts.current.e = el)} x={xE} y={206} fontSize={26} fontWeight={600} fill={ink("ink")} style={font} clipPath={`url(#${uid}-w8)`}>
                  {t.e}
                </text>

                {/* Round "light": drawn by hand, then straightened by holding the pen still. */}
                <motion.path
                  d={wobbly(ring.cx, ring.cy, ring.rx, ring.ry)}
                  stroke={ink(RED)}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={still ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: i >= 9 ? 1 : 0, opacity: i >= 9 && i < 10 ? 1 : 0 }}
                  transition={{ pathLength: { duration: i === 9 ? STEPS[9].ms / 1000 - 0.08 : 0, ease: "easeInOut" }, opacity: { duration: i === 10 ? 0.18 : 0.01 } }}
                />
                <motion.ellipse
                  cx={ring.cx}
                  cy={ring.cy}
                  rx={ring.rx}
                  ry={ring.ry}
                  stroke={ink(RED)}
                  strokeWidth={2.4}
                  fill="none"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  initial={still ? false : { opacity: 0, scale: 1.08 }}
                  animate={{ opacity: i >= 10 ? 1 : 0, scale: i >= 10 ? 1 : 1.08 }}
                  transition={{ duration: i === 10 ? 0.28 : 0, ease: [0.22, 1, 0.36, 1] }}
                />

                {/* An arrow to a sun, and a leaf. */}
                <motion.path
                  d={`M${ring.cx + ring.rx + 4} ${ring.cy - 8} C ${ring.cx + ring.rx + 50} ${ring.cy - 40}, 470 140, 512 126 M502 124 L512 126 L505 134`}
                  stroke={ink(RED)}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  {...draw(11)}
                />
                <motion.path
                  d="M542 96 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 M542 66 L542 56 M542 126 L542 136 M512 96 L502 96 M572 96 L582 96 M521 75 L514 68 M563 75 L570 68 M521 117 L514 124 M563 117 L570 124"
                  stroke={ink(AMBER)}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  fill="none"
                  {...draw(12)}
                />
                <motion.path
                  d="M398 352 C 420 282, 498 252, 562 262 C 552 322, 478 366, 398 352 Z M398 352 C 452 322, 508 290, 562 262 M447 325 L464 297 M480 307 L497 280 M513 289 L530 268 M447 325 L470 341 M480 307 L505 325 M513 289 L536 306"
                  stroke={ink(GREEN)}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  {...draw(13)}
                />
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>
      </div>
    </div>
  );
}

function ToolIcon({ Icon, on, bar, className }: { Icon: LucideIcon; on?: boolean; bar?: string; className?: string }) {
  return (
    <span className={cn("relative grid size-8 place-items-center rounded-lg transition-colors [&_svg]:size-[17px]", on ? "bg-blob-soft text-blob-ink" : "text-ink-3", className)}>
      <Icon />
      {bar && <span className="absolute bottom-1 h-[3px] w-3.5 rounded-full transition-colors" style={{ background: bar }} />}
    </span>
  );
}

/** What handwritten notes do, next to the demo. */
export function InkPoints({ className }: { className?: string }) {
  const t = useMessages(landingText).handwriting.points;
  return (
    <PointList
      className={className}
      points={[
        { key: "pens", Icon: PenLine, ...t.pens },
        { key: "paper", Icon: NotebookText, ...t.paper },
        { key: "shapes", Icon: Lasso, ...t.shapes },
        { key: "tablet", Icon: Hand, ...t.tablet },
        { key: "together", Icon: FileDown, ...t.together },
      ]}
    />
  );
}
