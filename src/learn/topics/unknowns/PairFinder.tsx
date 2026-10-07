"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type PointerEvent } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { BlobSays, Lamp, soft, Stepper, Tabs } from "./ui";

// Level 2 widget: two clues, two unknowns. Try pairs (x | y) until both clues fit, then show
// the lines of all pairs that fit each clue: the solution is where they cross.

type Clue = { a: number; b: number; c: number; label: Text; unit: Text };
type Story = { id: string; tab: Text; text: Text; vars: Text; I: Clue; II: Clue; max: number; start: [number, number] };

const STORIES: Story[] = [
  {
    id: "tickets",
    tab: tx("Tickets", "Karten"),
    text: tx(
      "At the school concert, **20 tickets** were sold. Adults pay 8 €, children 5 €. Altogether **124 €** came in.",
      "Beim Schulkonzert wurden **20 Karten** verkauft. Erwachsene zahlen 8 €, Kinder 5 €. Insgesamt kamen **124 €** zusammen.",
    ),
    vars: tx("$x$: adult tickets, $y$: child tickets", "$x$: Erwachsenenkarten, $y$: Kinderkarten"),
    I: { a: 1, b: 1, c: 20, label: tx("Tickets", "Karten"), unit: "" },
    II: { a: 8, b: 5, c: 124, label: tx("Money", "Geld"), unit: " €" },
    max: 20,
    start: [5, 5],
  },
  {
    id: "coins",
    tab: tx("Coins", "Münzen"),
    text: tx(
      "A piggy bank holds only 1-euro and 2-euro coins: **16 coins**, worth **21 €** altogether.",
      "In einer Spardose sind nur 1-Euro- und 2-Euro-Münzen: **16 Münzen** im Wert von zusammen **21 €**.",
    ),
    vars: tx("$x$: 1-euro coins, $y$: 2-euro coins", "$x$: 1-Euro-Münzen, $y$: 2-Euro-Münzen"),
    I: { a: 1, b: 1, c: 16, label: tx("Coins", "Münzen"), unit: "" },
    II: { a: 1, b: 2, c: 21, label: tx("Value", "Wert"), unit: " €" },
    max: 20,
    start: [4, 6],
  },
  {
    id: "farm",
    tab: tx("Farm", "Bauernhof"),
    text: tx(
      "On a farm there are chickens and rabbits: **13 heads** and **38 legs** altogether.",
      "Auf einem Bauernhof gibt es Hühner und Kaninchen: zusammen **13 Köpfe** und **38 Beine**.",
    ),
    vars: tx("$x$: chickens, $y$: rabbits", "$x$: Hühner, $y$: Kaninchen"),
    I: { a: 1, b: 1, c: 13, label: tx("Heads", "Köpfe"), unit: "" },
    II: { a: 2, b: 4, c: 38, label: tx("Legs", "Beine"), unit: "" },
    max: 20,
    start: [3, 3],
  },
];

const U = 14; // px per unit in the grid
const PAD = 28;

/** Where the line ax + by = c enters and leaves the square [0, max]². */
function clip(a: number, b: number, c: number, max: number): [number, number][] {
  const pts: [number, number][] = [];
  const add = (x: number, y: number) => {
    if (x < -1e-9 || y < -1e-9 || x > max + 1e-9 || y > max + 1e-9) return;
    if (pts.some(([p, q]) => Math.abs(p - x) < 1e-6 && Math.abs(q - y) < 1e-6)) return;
    pts.push([x, y]);
  };
  add(0, c / b);
  add(c / a, 0);
  add(max, (c - a * max) / b);
  add((c - b * max) / a, max);
  return pts.slice(0, 2);
}

const termSrc = (cl: Clue, x: number, y: number) => `${cl.a === 1 ? "" : `${cl.a} \\cdot `}${x} + ${cl.b === 1 ? "" : `${cl.b} \\cdot `}${y}`;
const eqSrc = (cl: Clue) => `${cl.a === 1 ? "" : cl.a}x + ${cl.b === 1 ? "" : cl.b}y = ${cl.c}`;

export function PairFinder() {
  const [id, setId] = useState(STORIES[0].id);
  const story = STORIES.find((s) => s.id === id)!;
  const scope = useId();
  return (
    <div className="space-y-4">
      <Tabs value={id} options={STORIES.map((s) => [s.id, s.tab] as [string, Text])} onChange={setId} scope={scope} />
      <Finder key={id} story={story} />
    </div>
  );
}

function Finder({ story }: { story: Story }) {
  const t = useText();
  const [[x, y], setXY] = useState<[number, number]>(story.start);
  const [lines, setLines] = useState(false);
  const [moves, setMoves] = useState(0);
  const { I, II, max } = story;
  const v1 = I.a * x + I.b * y;
  const v2 = II.a * x + II.b * y;
  const ok1 = v1 === I.c;
  const ok2 = v2 === II.c;
  const H = max * U;

  const set = (nx: number, ny: number) => {
    const cx = Math.max(0, Math.min(max, Math.round(nx)));
    const cy = Math.max(0, Math.min(max, Math.round(ny)));
    if (cx === x && cy === y) return;
    setXY([cx, cy]);
    setMoves((m) => m + 1);
  };

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    set((p.x - PAD) / U, (PAD + H - p.y) / U);
  };

  const say: { text: Text; mood: "happy" | "thinking" | "excited" } =
    ok1 && ok2
      ? {
          text: tx(
            `Both clues fit! $(${x} \\,|\\, ${y})$ is the **solution of the system**. ${lines ? "And look: it's exactly where the two lines cross." : "Show the lines to see why it's the only one."}`,
            `Beide Hinweise passen! $(${x} \\,|\\, ${y})$ ist die **Lösung des Gleichungssystems**. ${lines ? "Und schau: Genau hier schneiden sich die beiden Geraden." : "Blende die Geraden ein, dann siehst du, warum es nur diese eine gibt."}`,
          ),
          mood: "excited",
        }
      : lines
        ? {
            text: tx(
              "Every point on the purple line fits clue (I), every point on the dark line fits clue (II). Which point fits **both**?",
              "Jeder Punkt auf der lila Geraden erfüllt Hinweis (I), jeder Punkt auf der dunklen Geraden Hinweis (II). Welcher Punkt erfüllt **beide**?",
            ),
            mood: "thinking",
          }
        : ok1 || ok2
          ? {
              text: tx(
                `Clue ${ok1 ? "(I)" : "(II)"} fits, but ${ok1 ? "(II)" : "(I)"} doesn't yet. Many pairs fit one clue. You need the pair that fits both!`,
                `Hinweis ${ok1 ? "(I)" : "(II)"} passt, ${ok1 ? "(II)" : "(I)"} noch nicht. Viele Paare erfüllen einen Hinweis. Gesucht ist das Paar, das beide erfüllt!`,
              ),
              mood: "thinking",
            }
          : moves > 6
            ? { text: tx("Tricky by trial and error, right? Tap **Show lines** for a hint.", "Ganz schön mühsam durch Probieren, oder? Tipp auf **Geraden zeigen** für einen Tipp."), mood: "thinking" }
            : { text: tx("Change $x$ and $y$ (or tap the grid) until both clues light up.", "Ändere $x$ und $y$ (oder tipp ins Gitter), bis beide Hinweise leuchten."), mood: "happy" };

  const l1 = clip(I.a, I.b, I.c, max);
  const l2 = clip(II.a, II.b, II.c, max);
  const sx = (v: number) => PAD + v * U;
  const sy = (v: number) => PAD + H - v * U;
  const ticks = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[15.5px] leading-relaxed text-ink">
        <Inline text={story.text} />
        <div className="mt-1 text-[14px] text-ink-2">
          <Inline text={story.vars} />
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <svg
          viewBox={`0 0 ${H + 2 * PAD} ${H + 2 * PAD}`}
          className="w-full max-w-[340px] touch-none select-none rounded-xl border border-line bg-surface outline-none focus-visible:ring-2 focus-visible:ring-blob"
          role="img"
          tabIndex={0}
          aria-label={t(tx(`Grid of all pairs. Point (${x} | ${y}). Use the arrow keys to move it.`, `Gitter aller Zahlenpaare. Punkt (${x} | ${y}). Mit den Pfeiltasten verschieben.`))}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) fromPointer(e);
          }}
          onKeyDown={(e) => {
            const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
            const m = d[e.key];
            if (!m) return;
            e.preventDefault();
            set(x + m[0], y + m[1]);
          }}
        >
          {Array.from({ length: max + 1 }, (_, i) => (
            <g key={i}>
              <line x1={sx(i)} x2={sx(i)} y1={sy(0)} y2={sy(max)} stroke="var(--line)" strokeWidth={i % 5 === 0 ? 1 : 0.5} />
              <line x1={sx(0)} x2={sx(max)} y1={sy(i)} y2={sy(i)} stroke="var(--line)" strokeWidth={i % 5 === 0 ? 1 : 0.5} />
            </g>
          ))}
          <line x1={sx(0)} x2={sx(max) + 8} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={1.4} />
          <line x1={sx(0)} x2={sx(0)} y1={sy(0)} y2={sy(max) - 8} stroke="var(--ink-3)" strokeWidth={1.4} />
          {ticks.map((v) => (
            <g key={`t${v}`} fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
              <text x={sx(v)} y={sy(0) + 14} textAnchor="middle">
                {v}
              </text>
              {v > 0 && (
                <text x={sx(0) - 6} y={sy(v) + 3.5} textAnchor="end">
                  {v}
                </text>
              )}
            </g>
          ))}
          <text x={sx(max) + 10} y={sy(0) + 4} fontSize={13} fill="var(--ink-2)" className="font-math" fontStyle="italic">
            x
          </text>
          <text x={sx(0) - 4} y={sy(max) - 12} fontSize={13} fill="var(--ink-2)" className="font-math" fontStyle="italic">
            y
          </text>

          <AnimatePresence>
            {lines && (
              <motion.g key="lines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {l1.length === 2 && (
                  <motion.line
                    x1={sx(l1[0][0])}
                    y1={sy(l1[0][1])}
                    x2={sx(l1[1][0])}
                    y2={sy(l1[1][1])}
                    stroke="var(--blob)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
                {l2.length === 2 && (
                  <motion.line
                    x1={sx(l2[0][0])}
                    y1={sy(l2[0][1])}
                    x2={sx(l2[1][0])}
                    y2={sy(l2[1][1])}
                    stroke="var(--ink)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  />
                )}
                {l1[0] && (
                  <text x={sx(l1[0][0]) + 6} y={sy(l1[0][1]) + 12} fontSize={11} fontWeight={700} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
                    (I)
                  </text>
                )}
                {l2[0] && (
                  <text x={sx(l2[0][0]) + 6} y={sy(l2[0][1]) - 6} fontSize={11} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                    (II)
                  </text>
                )}
              </motion.g>
            )}
          </AnimatePresence>

          <motion.line initial={false} animate={{ x1: sx(x), x2: sx(x), y1: sy(0), y2: sy(y) }} transition={soft} stroke="var(--ink-3)" strokeDasharray="3 3" strokeWidth={1} />
          <motion.line initial={false} animate={{ x1: sx(0), x2: sx(x), y1: sy(y), y2: sy(y) }} transition={soft} stroke="var(--ink-3)" strokeDasharray="3 3" strokeWidth={1} />
          <motion.circle
            initial={false}
            animate={{ cx: sx(x), cy: sy(y), r: ok1 && ok2 ? 9 : 7 }}
            transition={soft}
            fill={ok1 && ok2 ? "var(--ok)" : "var(--blob)"}
            stroke="var(--raised)"
            strokeWidth={2.5}
          />
        </svg>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Stepper label="x =" value={x} min={0} max={max} onChange={(v) => set(v, y)} />
            <Stepper label="y =" value={y} min={0} max={max} onChange={(v) => set(x, v)} />
          </div>
          <Lamp on={ok1}>
            <ClueLine name="(I)" clue={I} value={v1} x={x} y={y} />
          </Lamp>
          <Lamp on={ok2}>
            <ClueLine name="(II)" clue={II} value={v2} x={x} y={y} />
          </Lamp>
          <button
            type="button"
            onClick={() => setLines((v) => !v)}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors", lines ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {lines ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {lines ? t(tx("Hide lines", "Geraden ausblenden")) : t(tx("Show lines", "Geraden zeigen"))}
          </button>
        </div>
      </div>

      <BlobSays text={say.text} mood={say.mood} />
    </div>
  );
}

function ClueLine({ name, clue, value, x, y }: { name: string; clue: Clue; value: number; x: number; y: number }) {
  const t = useText();
  const ok = value === clue.c;
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="font-semibold text-ink">
          {name} {t(clue.label)}:
        </span>
        <MathView src={eqSrc(clue)} size="sm" animate={false} className="text-ink-2" />
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 text-ink-2">
        <MathView src={`${termSrc(clue, x, y)} = ${value}`} size="sm" animate={false} />
        {t(clue.unit)}
        <span className={cn("ml-1 text-[12.5px] font-semibold", ok ? "text-ok" : "text-ink-3")}>{ok ? t(tx("fits", "passt")) : t(tx(`needs ${clue.c}`, `soll ${clue.c} sein`))}</span>
      </div>
    </div>
  );
}
