"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Graph } from "@/learn/visuals/Graph";
import { cn } from "@/lib/utils";
import { clean, dec, enDecimals, minusR, ptSrc, quadSrc } from "./shared";
import { Chip, SPRING, useNum, ValueSlider } from "./ui";

const round2 = (v: number) => clean(Math.round(v * 100) / 100);
const about = (v: number) => (Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? `= ${dec(v)}` : `\\approx ${dec(round2(v))}`);

// ---------------------------------------------------------------------------
// f(x) = a(x − d)² + e with three sliders: a stretches and flips, d moves it
// sideways, e moves it up and down. The vertex S(d | e) can be dragged too.

const A_VALUES = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
const D_VALUES = Array.from({ length: 11 }, (_, i) => i - 5);
const E_VALUES = Array.from({ length: 13 }, (_, i) => i - 6);

/** "2(x - 3)^2 + 1" for a(x − d)² + e. */
export function vertexSrc(a: number, d: number, e: number): string {
  const lead = a === 1 ? "" : a === -1 ? "-" : dec(a);
  const sq = d === 0 ? "x^2" : `(${minusR(d)})^2`;
  return `${lead}${sq}${e === 0 ? "" : ` ${e < 0 ? "-" : "+"} ${dec(Math.abs(e))}`}`;
}

export function VertexLab() {
  const t = useText();
  const show = useNum();
  const [ai, setAi] = useState(5); // a = 1
  const [d, setD] = useState(2);
  const [e, setE] = useState(-3);
  const a = A_VALUES[ai];
  const b = clean(-2 * a * d);
  const c = clean(a * d * d + e);
  const w = clean(-e / a);
  const zeros = w > 1e-9 ? [clean(d - Math.sqrt(w)), clean(d + Math.sqrt(w))] : Math.abs(w) < 1e-9 ? [d] : [];
  const reset = () => {
    setAi(5);
    setD(0);
    setE(0);
  };

  const opens: Text = a > 0 ? tx("opens upward", "nach oben geöffnet") : tx("opens downward", "nach unten geöffnet");
  const shape: Text =
    Math.abs(a) > 1
      ? tx("narrower than the normal parabola", "schmaler als die Normalparabel")
      : Math.abs(a) < 1
        ? tx("wider than the normal parabola", "breiter als die Normalparabel")
        : tx("as wide as the normal parabola", "so breit wie die Normalparabel");
  const side: Text =
    d === 0
      ? tx("not shifted sideways", "nicht seitlich verschoben")
      : d > 0
        ? tx(`${d} to the right`, `um ${d} nach rechts`)
        : tx(`${-d} to the left`, `um ${-d} nach links`);
  const up: Text =
    e === 0
      ? tx("not shifted up or down", "nicht nach oben oder unten verschoben")
      : e > 0
        ? tx(`${e} up`, `um ${e} nach oben`)
        : tx(`${-e} down`, `um ${-e} nach unten`);
  const zeroText: Text =
    zeros.length === 2
      ? enDecimals(`x_1 ${about(zeros[0])} \\quad x_2 ${about(zeros[1])}`)
      : zeros.length === 1
        ? enDecimals(`x = ${dec(zeros[0])}`)
        : tx('"no zeros"', '"keine Nullstellen"');

  const rows: { name: string; text: Text; key: string }[] = [
    { name: "a", key: `a${ai}`, text: `${t(opens)}, ${t(shape)}` },
    { name: "d", key: `d${d}`, text: side },
    { name: "e", key: `e${e}`, text: up },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div>
        <Graph
          xRange={[-7, 7]}
          yRange={[-7, 7]}
          height={380}
          className="aspect-square h-auto!"
          functions={[
            { f: (x) => x * x, key: "normal", color: "ink", dashed: true },
            { f: (x) => a * (x - d) * (x - d) + e, key: "f", color: "blob" },
          ]}
          points={[
            ...zeros.map((z, i) => ({ key: `z${i}`, x: z, y: 0, color: "ok" as const, hollow: true })),
            {
              key: "S",
              x: d,
              y: e,
              label: `S(${show(d)} | ${show(e)})`,
              color: "ink" as const,
              draggable: true,
              onDrag: (x: number, y: number) => {
                setD(Math.max(-5, Math.min(5, Math.round(x))));
                setE(Math.max(-6, Math.min(6, Math.round(y))));
              },
            },
          ]}
          snap={1}
        />
        <p className="mt-1 text-center text-[12.5px] text-ink-3">
          {t(tx("Dashed: the normal parabola y = x². Drag S to move the vertex.", "Gestrichelt: die Normalparabel y = x². Zieh S, um den Scheitelpunkt zu verschieben."))}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1 rounded-xl border border-line bg-surface px-4 py-3">
          <ValueSlider name="a" label={tx("Stretch factor a", "Streckfaktor a")} values={A_VALUES} index={ai} onChange={setAi} />
          <ValueSlider name="d" label={tx("Shift d to the side", "Verschiebung d zur Seite")} values={D_VALUES} index={d + 5} onChange={(i) => setD(D_VALUES[i])} />
          <ValueSlider name="e" label={tx("Shift e up or down", "Verschiebung e nach oben oder unten")} values={E_VALUES} index={e + 6} onChange={(i) => setE(E_VALUES[i])} />
          <div className="flex justify-end pt-1">
            <Chip onClick={reset} active={a === 1 && d === 0 && e === 0}>
              {t(tx("Normal parabola", "Normalparabel"))}
            </Chip>
          </div>
        </div>
        <div className="space-y-2 px-1">
          <div>
            <MathView src={enDecimals(`f(x) = ${vertexSrc(a, d, e)}`)} size="md" animate={false} />
          </div>
          <div>
            <MathView src={enDecimals(`f(x) = ${quadSrc(a, b, c)}`)} size="sm" animate={false} className="text-ink-2" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <MathView src={enDecimals(`S${ptSrc(d, e)}`)} size="sm" animate={false} className="text-blob-ink" />
            <MathView src={zeroText} size="sm" animate={false} className={zeros.length ? "text-ok" : "text-ink-3"} />
          </div>
        </div>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.name} className="flex items-baseline gap-3 rounded-lg bg-paper/60 px-3 py-2">
              <span className="w-4 shrink-0 font-math text-[18px] italic text-blob-ink">{r.name}</span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={r.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3, transition: { duration: 0.1 } }}
                  className="text-[13.5px] leading-snug text-ink-2"
                >
                  {t(r.text)}
                </motion.span>
              </AnimatePresence>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A parameter t in the equation: slide t and watch the parabola. Every value
// you visit leaves a mark on the t-line, coloured by the number of solutions.
// Hunt for the values where it has exactly one.

type Mode = {
  id: "p" | "q";
  label: string;
  values: number[];
  start: number;
  f: (t: number) => (x: number) => number;
  eq: (t: number) => string;
  D: (t: number) => number;
  dSrc: (t: number) => string;
  touch: number[];
  xRange: [number, number];
  yRange: [number, number];
  /** Tailwind aspect class matching the ranges. */
  aspect: string;
};

const halves = (from: number, to: number) => Array.from({ length: (to - from) * 2 + 1 }, (_, i) => from + i / 2);
const par = (v: number) => (v < 0 ? `(${dec(v)})` : dec(v));

const MODES: Mode[] = [
  {
    id: "p",
    label: "x^2 + tx + 4 = 0",
    values: halves(-7, 7),
    start: 2,
    f: (t) => (x) => x * x + t * x + 4,
    eq: (t) => `${quadSrc(1, t, 4)} = 0`,
    D: (t) => clean((t / 2) ** 2 - 4),
    dSrc: (t) => `D = (\\frac{t}{2})^2 - 4 = ${par(clean(t / 2))}^2 - 4 = ${dec(clean((t / 2) ** 2 - 4))}`,
    touch: [-4, 4],
    xRange: [-7, 7],
    yRange: [-9, 9],
    aspect: "aspect-[90/110]",
  },
  {
    id: "q",
    label: "x^2 - 6x + t = 0",
    values: halves(0, 14),
    start: 5,
    f: (t) => (x) => x * x - 6 * x + t,
    eq: (t) => `${quadSrc(1, -6, t)} = 0`,
    D: (t) => clean(9 - t),
    dSrc: (t) => `D = (\\frac{-6}{2})^2 - t = 9 - ${par(t)} = ${dec(clean(9 - t))}`,
    touch: [9],
    xRange: [-3, 9],
    yRange: [-10, 6],
    aspect: "aspect-[87/110]",
  },
];

const COUNT_TEXT: Record<number, Text> = {
  2: tx("two solutions", "zwei Lösungen"),
  1: tx("exactly one solution", "genau eine Lösung"),
  0: tx("no solution", "keine Lösung"),
};
const countOf = (D: number) => (D > 1e-9 ? 2 : D < -1e-9 ? 0 : 1);
const TONE: Record<number, string> = { 2: "var(--blob)", 1: "var(--ok)", 0: "var(--danger)" };

export function ParamLab() {
  const t = useText();
  const show = useNum();
  const scope = useId();
  const [mi, setMi] = useState(0);
  const mode = MODES[mi];
  const [ti, setTi] = useState(mode.values.indexOf(mode.start));
  const [seen, setSeen] = useState<number[]>([mode.start]);
  const tv = mode.values[ti];
  const D = mode.D(tv);
  const k = countOf(D);
  const found = mode.touch.filter((v) => seen.includes(v));
  const lo = mode.values[0];
  const hi = mode.values[mode.values.length - 1];
  const sx = (v: number) => 8 + ((v - lo) / (hi - lo)) * 304;

  function pick(i: number) {
    setTi(i);
    const v = mode.values[i];
    if (!seen.includes(v)) setSeen([...seen, v]);
  }
  function switchMode(i: number) {
    const m = MODES[i];
    setMi(i);
    setTi(m.values.indexOf(m.start));
    setSeen([m.start]);
  }

  const f = mode.f(tv);
  const half = mode.id === "p" ? -tv / 2 : 3;
  const vy = f(half);
  const r = D > 0 ? Math.sqrt(D) : 0;
  const zeros = k === 2 ? [half - r, half + r] : k === 1 ? [half] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-3">{t(tx("Equation:", "Gleichung:"))}</span>
        {MODES.map((m, i) => (
          <Chip key={m.id} active={i === mi} onClick={() => switchMode(i)}>
            <MathView src={m.label} size="sm" animate={false} />
          </Chip>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Graph
          key={mode.id}
          xRange={mode.xRange}
          yRange={mode.yRange}
          height={360}
          className={cn(mode.aspect, "h-auto!")}
          functions={[{ f, key: "f", color: "blob" }]}
          points={[
            ...zeros.map((z, i) => ({ key: `z${i}`, x: z, y: 0, color: (k === 1 ? "ok" : "blob") as "ok" | "blob" })),
            { key: "S", x: half, y: vy, color: "ink" as const, hollow: true },
          ]}
        />
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <ValueSlider name="t" label={tx("Parameter t", "Parameter t")} values={mode.values} index={ti} onChange={pick} />
            <svg viewBox="0 0 320 34" className="mt-1 w-full" aria-hidden>
              <line x1={8} x2={312} y1={14} y2={14} stroke="var(--line)" strokeWidth={2} strokeLinecap="round" />
              {seen.map((v) => (
                <motion.rect
                  key={v}
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  x={sx(v) - 2.6}
                  y={7}
                  width={5.2}
                  height={14}
                  rx={2}
                  fill={TONE[countOf(mode.D(v))]}
                  style={{ transformOrigin: `${sx(v)}px 14px` }}
                />
              ))}
              <motion.circle initial={false} animate={{ cx: sx(tv) }} transition={SPRING} cy={14} r={5} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
              {[lo, 0, hi].filter((v, i, all) => all.indexOf(v) === i && v >= lo && v <= hi).map((v) => (
                <text key={v} x={sx(v)} y={32} textAnchor="middle" fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-math)">
                  {show(v)}
                </text>
              ))}
            </svg>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3">
              {[2, 1, 0].map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-[3px]" style={{ background: TONE[n] }} />
                  {t(COUNT_TEXT[n])}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-2 px-1">
            <div>
              <MathView src={enDecimals(mode.eq(tv))} size="md" animate={false} />
            </div>
            <div>
              <MathView src={enDecimals(mode.dSrc(tv))} size="sm" animate={false} className="text-ink-2" />
            </div>
          </div>
          <div className={cn("relative rounded-xl border px-3 py-2.5 text-[14px] font-semibold", k === 1 ? "border-ok/50 bg-ok/[0.08] text-ok" : k === 2 ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-danger/40 bg-danger/[0.07] text-danger")}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={`${scope}-${k}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3, transition: { duration: 0.1 } }} className="block">
                {t(COUNT_TEXT[k])}
              </motion.span>
            </AnimatePresence>
          </div>
          <p className="text-[13.5px] leading-snug text-ink-2">
            {found.length === mode.touch.length
              ? t(
                  tx(
                    `Found! Exactly one solution only for t = ${mode.touch.map(show).join(" and t = ")}: there D = 0 and the parabola touches the x-axis.`,
                    `Gefunden! Genau eine Lösung gibt es nur für t = ${mode.touch.map(show).join(" und t = ")}: Dort ist D = 0 und die Parabel berührt die x-Achse.`,
                  ),
                )
              : t(
                  tx(
                    `Find every t with exactly one solution (the parabola just touches the x-axis). Found: ${found.length} of ${mode.touch.length}.`,
                    `Finde jedes t mit genau einer Lösung (die Parabel berührt die x-Achse gerade so). Gefunden: ${found.length} von ${mode.touch.length}.`,
                  ),
                )}
          </p>
        </div>
      </div>
    </div>
  );
}
