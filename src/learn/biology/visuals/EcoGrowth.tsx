"use client";

// Exponential and logistic population growth. The lab lets students change the growth rate r
// and the carrying capacity K and see the J-curve and the S-curve, the inflection point at K/2
// and the growth per time unit. A static chart serves the tasks.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Axes, Tag, path, scales, type Box } from "./EcoChart";

export const expN = (n0: number, r: number, t: number) => n0 * Math.exp(r * t);
export const logN = (n0: number, r: number, K: number, t: number) => K / (1 + ((K - n0) / n0) * Math.exp(-r * t));
/** Time at which the logistic curve reaches N. */
export const logT = (n0: number, r: number, K: number, n: number) => Math.log(((K - n0) / n0) * (n / (K - n))) / r;

const BOX: Box = { W: 460, H: 250, l: 44, r: 16, t: 26, b: 38 };
const EXP_COLOR = "var(--bio-blood)";
const LOG_COLOR = "var(--blob)";

export type GrowthChartProps = {
  n0: number;
  r: number;
  K: number;
  T: number;
  yMax: number;
  yStep: number;
  xStep: number;
  show: "exp" | "log" | "both";
  /** Letters on the logistic curve at these times. */
  points?: { t: number; label: string }[];
  /** Dashed line at K. */
  kLine?: boolean;
  /** Mark the inflection point at K/2. */
  inflection?: boolean;
  /** Shade the phases of logistic growth. */
  phases?: boolean;
  /** Curve names (in tasks: letters, so the shape has to be recognised). */
  names?: { exp?: string; log?: string };
  xName?: Text;
  yName?: Text;
};

export function GrowthChart({ n0, r, K, T, yMax, yStep, xStep, show, points, kLine, inflection, phases, names, xName = tx("time", "Zeit"), yName = tx("population size N", "Populationsgröße N") }: GrowthChartProps) {
  const t = useText();
  const locale = useLocale();
  const { px, py } = scales(BOX, [0, T], [0, yMax]);
  const xTicks = Array.from({ length: Math.floor(T / xStep) + 1 }, (_, i) => i * xStep);
  const yTicks = Array.from({ length: Math.floor(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const n = 160;
  const logPts: [number, number][] = [];
  const expPts: [number, number][] = [];
  let expDone = false;
  for (let i = 0; i <= n; i++) {
    const tt = (T * i) / n;
    logPts.push([px(tt), py(logN(n0, r, K, tt))]);
    if (expDone) continue;
    const e = expN(n0, r, tt);
    if (e <= yMax) expPts.push([px(tt), py(e)]);
    else {
      // stop exactly at the top edge
      const tEdge = Math.log(yMax / n0) / r;
      expPts.push([px(tEdge), py(yMax)]);
      expDone = true;
    }
  }
  const fmt = (v: number) => (locale === "de" ? String(v).replace(".", ",") : String(v));
  const tHalf = logT(n0, r, K, K / 2);
  const t95 = logT(n0, r, K, 0.95 * K);
  const bands: { from: number; to: number; label: Text }[] = [
    { from: 0, to: tHalf, label: tx("accelerating", "beschleunigt") },
    { from: tHalf, to: t95, label: tx("slowing down", "Verzögerung") },
    { from: t95, to: T, label: tx("stationary", "stationär") },
  ];
  return (
    <svg viewBox={`0 0 ${BOX.W} ${BOX.H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("Population growth over time", "Populationswachstum über die Zeit"))}>
      {phases &&
        bands.map((b, i) =>
          b.to > b.from && b.from < T ? (
            <g key={i}>
              <rect x={px(b.from)} y={BOX.t} width={px(Math.min(b.to, T)) - px(b.from)} height={BOX.H - BOX.t - BOX.b} fill={i === 1 ? "var(--bio-sun)" : i === 0 ? "var(--bio-leaf)" : "var(--bio-vacuole)"} opacity={0.25} />
              <Tag x={(px(b.from) + px(Math.min(b.to, T))) / 2} y={BOX.t + 12} size={10.5} weight={600}>
                {t(b.label)}
              </Tag>
            </g>
          ) : null,
        )}
      <Axes box={BOX} x={[0, T]} y={[0, yMax]} xTicks={xTicks} yTicks={yTicks} xLabel={t(xName)} yLabel={t(yName)} xFmt={fmt} yFmt={fmt} />
      {kLine && (
        <g>
          <line x1={BOX.l} x2={BOX.W - BOX.r} y1={py(K)} y2={py(K)} stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="6 5" />
          <Tag x={BOX.W - BOX.r - 4} y={py(K) - 6} anchor="end" size={12} weight={700}>
            K
          </Tag>
        </g>
      )}
      {(show === "exp" || show === "both") && <path d={path(expPts)} fill="none" stroke={show === "both" && names ? "var(--ink-2)" : EXP_COLOR} strokeWidth={3} strokeLinejoin="round" />}
      {(show === "log" || show === "both") && <path d={path(logPts)} fill="none" stroke={LOG_COLOR} strokeWidth={3} strokeLinejoin="round" />}
      {names?.exp && expPts.length > 1 && (
        <Tag x={expPts[expPts.length - 1][0] - 12} y={expPts[expPts.length - 1][1] + 16} anchor="end" size={13} weight={700}>
          {names.exp}
        </Tag>
      )}
      {names?.log && (
        <Tag x={px(T * 0.86)} y={py(logN(n0, r, K, T * 0.86)) + 18} size={13} weight={700} color={LOG_COLOR}>
          {names.log}
        </Tag>
      )}
      {inflection && tHalf < T && (
        <g>
          <line x1={px(tHalf)} x2={px(tHalf)} y1={py(K / 2)} y2={py(0)} stroke="var(--ink-3)" strokeDasharray="3 3" />
          <circle cx={px(tHalf)} cy={py(K / 2)} r={5.5} fill="var(--raised)" stroke={LOG_COLOR} strokeWidth={3} />
          <Tag x={px(tHalf) + 9} y={py(K / 2) + 4} anchor="start" size={11.5}>
            K/2
          </Tag>
        </g>
      )}
      {points?.map((p) => {
        const y = logN(n0, r, K, p.t);
        return (
          <g key={p.label}>
            <circle cx={px(p.t)} cy={py(y)} r={5} fill="var(--raised)" stroke="var(--ink)" strokeWidth={2} />
            <Tag x={px(p.t) - 9} y={py(y) - 7} anchor="end" size={12.5} weight={700}>
              {p.label}
            </Tag>
          </g>
        );
      })}
    </svg>
  );
}

function RateChart({ r, K, n0, T }: { r: number; K: number; n0: number; T: number }) {
  const t = useText();
  const box: Box = { W: 460, H: 150, l: 44, r: 16, t: 24, b: 30 };
  const maxRate = 900 / 4;
  const { px, py } = scales(box, [0, T], [0, maxRate * 1.05]);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const tt = (T * i) / 120;
    const N = logN(n0, r, K, tt);
    pts.push([px(tt), py(r * N * (1 - N / K))]);
  }
  const tHalf = logT(n0, r, K, K / 2);
  return (
    <svg viewBox={`0 0 ${box.W} ${box.H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("Growth per time unit", "Zuwachs pro Zeiteinheit"))}>
      <Axes box={box} x={[0, T]} y={[0, maxRate * 1.05]} xTicks={[0, 5, 10, 15, 20]} yTicks={[]} xLabel={t(tx("time", "Zeit"))} yLabel={t(tx("growth per time unit ΔN/Δt", "Zuwachs pro Zeiteinheit ΔN/Δt"))} yTickLabels={false} />
      <path d={path(pts)} fill="none" stroke={LOG_COLOR} strokeWidth={2.6} />
      {tHalf < T && <line x1={px(tHalf)} x2={px(tHalf)} y1={box.t} y2={box.H - box.b} stroke="var(--ink-3)" strokeDasharray="3 3" />}
    </svg>
  );
}

export function EcoGrowth() {
  const t = useText();
  const locale = useLocale();
  const [r, setR] = useState(0.5);
  const [K, setK] = useState(600);
  const [rate, setRate] = useState(false);
  const n0 = 10;
  const T = 20;
  const fmt = (v: number) => (locale === "de" ? String(v).replace(".", ",") : String(v));
  const doubling = Math.log(2) / r;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <GrowthChart n0={n0} r={r} K={K} T={T} yMax={1000} yStep={200} xStep={5} show="both" kLine inflection phases />
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-6 rounded-full" style={{ background: EXP_COLOR }} />
            {t(tx("exponential (unlimited)", "exponentiell (unbegrenzt)"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-6 rounded-full" style={{ background: LOG_COLOR }} />
            {t(tx("logistic (limited by K)", "logistisch (begrenzt durch K)"))}
          </span>
        </div>
        {rate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 border-t border-line pt-2">
            <RateChart r={r} K={K} n0={n0} T={T} />
          </motion.div>
        )}
      </div>

      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="w-40 shrink-0">
            {t(tx("growth rate", "Wachstumsrate"))} <span className="font-math text-ink">r = {fmt(r)}</span>
          </span>
          <input type="range" min={0.2} max={1} step={0.05} value={r} onChange={(e) => setR(Number(e.target.value))} className="h-9 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]" />
        </label>
        <label className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="w-40 shrink-0">
            {t(tx("capacity", "Kapazität"))} <span className="font-math text-ink">K = {K}</span>
          </span>
          <input type="range" min={200} max={900} step={50} value={K} onChange={(e) => setK(Number(e.target.value))} className="h-9 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]" />
        </label>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
        <input type="checkbox" checked={rate} onChange={(e) => setRate(e.target.checked)} className="size-4 accent-[var(--blob)]" />
        {t(tx("Show the growth per time unit", "Zuwachs pro Zeiteinheit zeigen"))}
      </label>

      <p className="rounded-xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink-2" aria-live="polite">
        {rate
          ? t(
              tx(
                "The growth per time unit is largest at N = K/2: below it there are few individuals, above it resources run short. Near K it goes towards zero.",
                "Der Zuwachs pro Zeiteinheit ist bei N = K/2 am größten: Darunter gibt es wenige Individuen, darüber werden die Ressourcen knapp. Nahe K geht er gegen null.",
              ),
            )
          : t(
              tx(
                `Unlimited, the population doubles every ${fmt(Math.round(doubling * 10) / 10)} time units (J-curve). Limited by food and space it levels off at the capacity K (S-curve).`,
                `Unbegrenzt verdoppelt sich die Population alle ${fmt(Math.round(doubling * 10) / 10)} Zeiteinheiten (J-Kurve). Begrenzt durch Nahrung und Platz pendelt sie sich bei der Kapazität K ein (S-Kurve).`,
              ),
            )}
      </p>
    </div>
  );
}
