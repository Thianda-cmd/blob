"use client";

// Heating curves for the "particles" topic: a static chart for tasks (temperature over time
// with plateaus) and a lab where students heat ice and watch the curve and the particles.

import { animate, AnimatePresence, motion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { dec } from "../format";
import { degC } from "../particles-data";
import { ParticleSim } from "./ParticlesSim";

export type CurvePoint = [number, number];

const W = 380;
const H = 240;
const M = { l: 46, r: 14, t: 16, b: 38 };

/** The part of the curve up to time `upTo` (interpolated). */
function cut(points: CurvePoint[], upTo: number): CurvePoint[] {
  const out: CurvePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x1 <= upTo) out.push(points[i]);
    else {
      if (upTo > x0) out.push([upTo, y0 + ((y1 - y0) * (upTo - x0)) / (x1 - x0)]);
      break;
    }
  }
  return out;
}

export type ChartProps = {
  points: CurvePoint[];
  yMin: number;
  yMax: number;
  yStep: number;
  xMax: number;
  xStep: number;
  /** Draw the curve only up to this time. */
  upTo?: number;
  /** Labels on the plateaus (only in the lesson, never in tasks). */
  plateaus?: { x0: number; x1: number; y: number; label: string }[];
  /** A dot at the end of the drawn curve. */
  dot?: boolean;
  /** "Cooling curve" instead of "heating curve" (only changes the aria label). */
  cooling?: boolean;
  className?: string;
};

/** Temperature (°C) over time (min) with a grid, like in the exercise book. */
export function HeatingChart({ points, yMin, yMax, yStep, xMax, xStep, upTo, plateaus, dot, cooling, className }: ChartProps) {
  const t = useText();
  const locale = useLocale();
  const px = (x: number) => M.l + (x / xMax) * (W - M.l - M.r);
  const py = (y: number) => H - M.b - ((y - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const drawn = upTo === undefined ? points : cut(points, upTo);
  const yTicks: number[] = [];
  for (let y = yMin; y <= yMax + 1e-9; y += yStep) yTicks.push(Math.round(y * 100) / 100);
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += xStep) xTicks.push(Math.round(x * 100) / 100);
  const minus = (s: string) => s.replace("-", "−");
  const end = drawn[drawn.length - 1];
  const path = drawn.map(([x, y], i) => `${i ? "L" : "M"}${px(x).toFixed(1)} ${py(y).toFixed(1)}`).join(" ");
  const label = cooling ? t(tx("Cooling curve: temperature over time", "Abkühlkurve: Temperatur über der Zeit")) : t(tx("Heating curve: temperature over time", "Erhitzungskurve: Temperatur über der Zeit"));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full", className)} role="img" aria-label={label}>
      {yTicks.map((y) => (
        <g key={`y${y}`}>
          <line x1={M.l} x2={W - M.r} y1={py(y)} y2={py(y)} stroke={y === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={y === 0 ? 1 : 0.8} />
          <text x={M.l - 6} y={py(y) + 3.8} textAnchor="end" fontSize={11} className="fill-ink-3 tabular-nums">
            {minus(dec(y, locale))}
          </text>
        </g>
      ))}
      {xTicks.map((x) => (
        <g key={`x${x}`}>
          <line x1={px(x)} x2={px(x)} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeWidth={0.8} />
          <text x={px(x)} y={H - M.b + 15} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
            {dec(x, locale)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t - 4} y2={H - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
      <line x1={M.l} x2={W - M.r + 4} y1={H - M.b} y2={H - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
      <text x={W - M.r} y={H - 5} textAnchor="end" fontSize={11.5} className="fill-ink-2">
        {t(tx("time in min", "Zeit in min"))}
      </text>
      <text x={8} y={M.t - 4} fontSize={11.5} className="fill-ink-2">
        °C
      </text>
      {plateaus?.map((p) => (
        <motion.g key={p.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <text x={(px(p.x0) + px(p.x1)) / 2} y={py(p.y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-blob-ink">
            {p.label}
          </text>
        </motion.g>
      ))}
      <path d={path} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {dot && end && <circle cx={px(end[0])} cy={py(end[1])} r={5.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The heating lab: ice from −20 °C to steam at 120 °C (schematic durations).

const T1 = 2; // ice warms up
const T2 = 5; // melting done
const T3 = 10; // water warms up
const T4 = 17; // boiling done
const TEND = 18;
const WATER: CurvePoint[] = [
  [0, -20],
  [T1, 0],
  [T2, 0],
  [T3, 100],
  [T4, 100],
  [TEND, 120],
];

function tempAt(time: number) {
  const pts = cut(WATER, time);
  return pts[pts.length - 1][1];
}

export function ParticlesHeatingLab() {
  const t = useText();
  const locale = useLocale();
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const temp = Math.round(tempAt(time) * 10) / 10;
  const melted = time <= T1 ? 0 : time >= T2 ? 1 : (time - T1) / (T2 - T1);
  const boiled = time <= T3 ? 0 : time >= T4 ? 1 : (time - T3) / (T4 - T3);
  const phase: { text: ReturnType<typeof tx>; plateau: boolean } =
    time < T1
      ? { text: tx("The ice warms up. Its particles vibrate more and more.", "Das Eis erwärmt sich. Seine Teilchen schwingen immer stärker."), plateau: false }
      : time < T2
        ? {
            text: tx(
              `Melting! The temperature stays at 0 °C until all the ice has melted (${Math.round(melted * 100)} %). The energy breaks up the lattice.`,
              `Schmelzen! Die Temperatur bleibt bei 0 °C, bis alles Eis geschmolzen ist (${Math.round(melted * 100)} %). Die Energie löst das Gitter auf.`,
            ),
            plateau: true,
          }
        : time < T3
          ? { text: tx("Liquid water warms up. The particles slide faster and faster.", "Das flüssige Wasser erwärmt sich. Die Teilchen gleiten immer schneller."), plateau: false }
          : time < T4
            ? {
                text: tx(
                  `Boiling! The temperature stays at 100 °C until all the water has turned into vapour (${Math.round(boiled * 100)} %). The energy pulls the particles apart.`,
                  `Sieden! Die Temperatur bleibt bei 100 °C, bis alles Wasser verdampft ist (${Math.round(boiled * 100)} %). Die Energie reißt die Teilchen auseinander.`,
                ),
                plateau: true,
              }
            : { text: tx("Only water vapour is left. Now its temperature rises again.", "Jetzt gibt es nur noch Wasserdampf. Seine Temperatur steigt wieder."), plateau: false };

  const plateaus = [
    ...(time > T1 ? [{ x0: T1, x1: T2, y: 0, label: t(tx("melting", "Schmelzen")) }] : []),
    ...(time > T3 ? [{ x0: T3, x1: T4, y: 100, label: t(tx("boiling", "Sieden")) }] : []),
  ];

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const toggle = () => {
    if (playing) return stop();
    const from = time >= TEND ? 0 : time;
    setPlaying(true);
    ctrl.current = animate(from, TEND, { duration: (TEND - from) / 1.4, ease: "linear", onUpdate: setTime, onComplete: () => setPlaying(false) });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <HeatingChart points={WATER} yMin={-20} yMax={120} yStep={20} xMax={TEND} xStep={2} upTo={time} plateaus={plateaus} dot />
        </div>
        <div className="space-y-2">
          <ParticleSim liquid={melted} gas={boiled} heat={(temp + 20) / 140} seed={7} label={t(tx("Water particles while heating", "Wasserteilchen beim Erhitzen"))} />
          <div className="flex items-baseline justify-between gap-2 px-1">
            <span className="text-[13px] text-ink-3">
              {t(tx("time", "Zeit"))} {dec(Math.round(time * 10) / 10, locale)} min
            </span>
            <span className={cn("font-math text-[24px] tabular-nums", phase.plateau ? "text-blob-ink" : "text-ink")}>{degC(temp, locale)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : time > 0 && time < TEND ? t(tx("Keep heating", "Weiter erhitzen")) : t(tx("Heat", "Erhitzen"))}
        </button>
        <button
          type="button"
          onClick={() => {
            stop();
            setTime(0);
          }}
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-4" /> {t(tx("Start again", "Von vorn"))}
        </button>
        <input
          type="range"
          min={0}
          max={TEND}
          step={0.1}
          value={time}
          onChange={(e) => {
            stop();
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Time", "Zeit"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={phase.plateau ? `p${time < T3 ? 1 : 2}` : `r${time < T1 ? 0 : time < T3 ? 1 : 2}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", phase.plateau ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}
        >
          {t(phase.text)}
        </motion.p>
      </AnimatePresence>
      <p className="text-[12px] text-ink-3">{t(tx("Schematic: the real boiling plateau is even longer.", "Schematisch: In echt dauert das Sieden noch länger."))}</p>
    </div>
  );
}
