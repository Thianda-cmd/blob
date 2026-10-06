"use client";

// The action potential for the "nervous-system" topic (level 3): a graph of the membrane
// potential (also used as a task picture with lettered points), and a lab that keeps the graph
// in sync with a piece of axon membrane: voltage-gated Na⁺ and K⁺ channels open, close and get
// inactivated while the ions flow. A stimulus slider shows the threshold and the all-or-none
// law; a second tab shows frequency coding.

import { animate, useReducedMotion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { ActionButton, GhostButton, lerp, Note, Pill, r1, Segmented, Slider, span, SvgLabel } from "./NerveKit";

// ---------------------------------------------------------------------------
// The model (times in ms, potentials in mV)

export const AP = { rest: -70, threshold: -50, peak: 30, hyper: -80, start: 1, fire: 1.4, top: 1.75, back: 2.7, low: 3.2, end: 5.2, T: 6 };
/** Absolute and relative refractory period. */
export const REFRACTORY = { abs: [1.4, 2.5] as const, rel: [2.5, 4.2] as const };

/** Membrane potential of one action potential (a stimulus at 1 ms). `stim` 0..1, threshold at 0.5. */
export function apV(t: number, stim = 1): number {
  const { rest, threshold, peak, hyper, start, fire, top, back, low, end } = AP;
  if (t < start) return rest;
  if (stim < 0.5) {
    // Below threshold: a small local depolarisation that fades away again.
    const a = 40 * stim;
    if (t < fire) return rest + a * span(t, start, fire) ** 1.5;
    return rest + a * Math.exp(-(t - fire) / 0.45);
  }
  if (t < fire) return rest + (threshold - rest) * span(t, start, fire) ** 1.5;
  if (t < top) return threshold + (peak - threshold) * (1 - (1 - span(t, fire, top)) ** 2.2);
  if (t < back) return peak - (peak - rest) * (1 - Math.cos(Math.PI * span(t, top, back))) / 2;
  if (t < low) return rest - (rest - hyper) * Math.sin((Math.PI / 2) * span(t, back, low));
  if (t < end) return hyper + (rest - hyper) * (1 - Math.cos(Math.PI * span(t, low, end))) / 2;
  return rest;
}

export type ApPhase = "rest" | "pre" | "depol" | "repol" | "hyper" | "after";
export function apPhase(t: number, stim = 1): ApPhase {
  if (t < AP.start) return "rest";
  if (stim < 0.5) return t < AP.fire + 1.2 ? "pre" : "after";
  if (t < AP.fire) return "pre";
  if (t < AP.top) return "depol";
  if (t < AP.back) return "repol";
  if (t < AP.end - 0.7) return "hyper";
  return "after";
}

/** Points for task pictures: where each letter sits on the curve. */
export const AP_MARKS: Record<string, number> = { A: 0.5, B: 1.36, C: 1.56, D: 1.75, E: 2.2, F: 3.15 };

// ---------------------------------------------------------------------------
// Graph

const GW = 560;
const GH = 232;
const M = { l: 48, r: 14, t: 12, b: 34 };
const VMIN = -90;
const VMAX = 40;
const gx = (t: number, tmax: number) => M.l + (t / tmax) * (GW - M.l - M.r);
const gy = (v: number) => M.t + ((VMAX - v) / (VMAX - VMIN)) * (GH - M.t - M.b);

export function NerveApGraph({
  upTo,
  stim = 1,
  marks,
  cursor,
  guides = true,
  refractory,
  phaseLabels,
}: {
  /** Draw the curve only up to this time (ms). */
  upTo?: number;
  stim?: number;
  /** Lettered points on the curve, e.g. ["A", "C", "E"]. */
  marks?: string[];
  /** A dot following the curve at this time. */
  cursor?: number;
  /** Dashed lines for resting potential and threshold. */
  guides?: boolean;
  /** Shade the refractory periods. */
  refractory?: boolean;
  /** Write the phase names into the chart. */
  phaseLabels?: boolean;
}) {
  const t = useText();
  const tmax = AP.T;
  const until = upTo ?? tmax;
  const pts: string[] = [];
  for (let x = 0; x <= until + 1e-9; x += 0.02) pts.push(`${pts.length ? "L" : "M"}${gx(x, tmax).toFixed(1)} ${gy(apV(x, stim)).toFixed(1)}`);
  const minus = (n: number) => String(n).replace("-", "−");
  return (
    <svg viewBox={`0 0 ${GW} ${GH}`} className="block h-auto w-full" role="img" aria-label={t(tx("Action potential: membrane potential over time", "Aktionspotenzial: Membranpotenzial über der Zeit"))}>
      {refractory && (
        <g>
          <rect x={gx(REFRACTORY.abs[0], tmax)} y={M.t} width={gx(REFRACTORY.abs[1], tmax) - gx(REFRACTORY.abs[0], tmax)} height={GH - M.t - M.b} fill="var(--blob)" opacity={0.13} />
          <rect x={gx(REFRACTORY.rel[0], tmax)} y={M.t} width={gx(REFRACTORY.rel[1], tmax) - gx(REFRACTORY.rel[0], tmax)} height={GH - M.t - M.b} fill="var(--blob)" opacity={0.06} />
          <SvgLabel x={(gx(REFRACTORY.abs[0], tmax) + gx(REFRACTORY.abs[1], tmax)) / 2} y={M.t + 10} size={10.5} fill="var(--blob-ink)">
            {t(tx("absolute", "absolut"))}
          </SvgLabel>
          <SvgLabel x={(gx(REFRACTORY.rel[0], tmax) + gx(REFRACTORY.rel[1], tmax)) / 2} y={M.t + 10} size={10.5} fill="var(--blob-ink)">
            {t(tx("relative", "relativ"))}
          </SvgLabel>
        </g>
      )}
      {[-80, -60, -40, -20, 0, 20, 40].map((v) => (
        <g key={v}>
          <line x1={M.l} x2={GW - M.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={v === 0 ? 1 : 0.8} />
          <text x={M.l - 6} y={gy(v) + 3.8} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {minus(v)}
          </text>
        </g>
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((x) => (
        <text key={x} x={gx(x, tmax)} y={GH - M.b + 15} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
          {x}
        </text>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t - 2} y2={GH - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
      <line x1={M.l} x2={GW - M.r} y1={GH - M.b} y2={GH - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
      <text x={GW - M.r} y={GH - 4} textAnchor="end" fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("time in ms", "Zeit in ms"))}
      </text>
      <text x={6} y={M.t - 1} fontSize={11.5} fill="var(--ink-2)" dominantBaseline="hanging" style={{ fontFamily: "var(--font-sans)" }}>
        mV
      </text>
      {guides && (
        <g>
          <line x1={M.l} x2={GW - M.r} y1={gy(AP.rest)} y2={gy(AP.rest)} stroke="var(--ink-3)" strokeWidth={1.1} strokeDasharray="5 4" />
          <line x1={M.l} x2={GW - M.r} y1={gy(AP.threshold)} y2={gy(AP.threshold)} stroke="var(--blob)" strokeWidth={1.1} strokeDasharray="5 4" opacity={0.8} />
          <SvgLabel x={GW - M.r - 4} y={gy(AP.threshold) - 8} anchor="end" size={10.5} fill="var(--blob-ink)" halo>
            {t(tx("threshold", "Schwellenwert"))}
          </SvgLabel>
        </g>
      )}
      {phaseLabels && stim >= 0.5 && (
        <g>
          <SvgLabel x={gx(0.5, tmax)} y={gy(AP.rest) - 12} size={10.5} fill="var(--ink-2)" halo>
            {t(tx("resting potential", "Ruhepotenzial"))}
          </SvgLabel>
          <SvgLabel x={gx(1.42, tmax)} y={gy(0)} anchor="end" size={10.5} fill="var(--ink-2)" halo>
            {t(tx("depolarisation", "Depolarisation"))}
          </SvgLabel>
          <SvgLabel x={gx(2.32, tmax)} y={gy(0)} anchor="start" size={10.5} fill="var(--ink-2)" halo>
            {t(tx("repolarisation", "Repolarisation"))}
          </SvgLabel>
          <SvgLabel x={gx(3.2, tmax)} y={gy(AP.hyper) + 13} anchor="start" size={10.5} fill="var(--ink-2)" halo>
            {t(tx("hyperpolarisation", "Hyperpolarisation"))}
          </SvgLabel>
        </g>
      )}
      {pts.length > 1 && <path d={pts.join(" ")} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
      {marks?.map((m) => {
        const x = AP_MARKS[m];
        const cx = gx(x, tmax);
        const cy = gy(apV(x, stim));
        const left = m === "B" || m === "C";
        return (
          <g key={m}>
            <circle cx={r1(cx)} cy={r1(cy)} r={4.5} fill="var(--raised)" stroke="var(--ink)" strokeWidth={2} />
            <SvgLabel x={r1(cx + (left ? -14 : 14))} y={r1(cy + (m === "D" ? -10 : m === "F" ? 12 : 0))} size={14} weight={700} halo>
              {m}
            </SvgLabel>
          </g>
        );
      })}
      {cursor !== undefined && cursor > 0 && <circle cx={r1(gx(Math.min(cursor, tmax), tmax))} cy={r1(gy(apV(Math.min(cursor, tmax), stim)))} r={6} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The piece of membrane with its channels

type Gate = "closed" | "open" | "inactive";
export function naGate(t: number, stim = 1): Gate {
  if (stim < 0.5) return "closed";
  if (t >= AP.fire && t < AP.top) return "open";
  if (t >= AP.top && t < REFRACTORY.abs[1]) return "inactive";
  return "closed";
}
export function kGate(t: number, stim = 1): Gate {
  if (stim < 0.5) return "closed";
  return t >= 1.62 && t < 3.6 ? "open" : "closed";
}

const MW = 560;
const MH = 176;
const MEM_TOP = 70;
const MEM_BOT = 104;
const NA_X = [118, 200];
const K_X = [330, 412];
const LEAK_X = 500;

function Channel({ x, gate, kind }: { x: number; gate: Gate; kind: "na" | "k" | "leak" }) {
  const fill = kind === "na" ? "var(--bio-c)" : "var(--bio-t)";
  const gap = kind === "leak" ? 4 : gate === "open" ? 9 : gate === "inactive" ? 7 : 1.5;
  const w = kind === "leak" ? 9 : 12;
  return (
    <g>
      <rect x={r1(x - gap / 2 - w)} y={MEM_TOP - 6} width={w} height={MEM_BOT - MEM_TOP + 12} rx={5} fill={fill} stroke="var(--bio-outline)" strokeWidth={1.3} />
      <rect x={r1(x + gap / 2)} y={MEM_TOP - 6} width={w} height={MEM_BOT - MEM_TOP + 12} rx={5} fill={fill} stroke="var(--bio-outline)" strokeWidth={1.3} />
      {kind === "na" && gate === "inactive" && (
        <g>
          <path d={`M${x + gap / 2 + w} ${MEM_BOT + 4} q8 10 -2 14`} fill="none" stroke="var(--bio-outline)" strokeWidth={1.4} />
          <circle cx={x} cy={MEM_BOT + 7} r={5.5} fill="var(--ink-2)" stroke="var(--bio-outline)" strokeWidth={1} />
        </g>
      )}
      {kind === "na" && gate !== "inactive" && <path d={`M${x + gap / 2 + w} ${MEM_BOT + 4} q10 6 10 16`} fill="none" stroke="var(--bio-outline)" strokeWidth={1.4} />}
      {kind === "na" && gate !== "inactive" && <circle cx={x + gap / 2 + w + 10} cy={MEM_BOT + 22} r={5.5} fill="var(--ink-2)" stroke="var(--bio-outline)" strokeWidth={1} />}
    </g>
  );
}

const ion = (x: number, y: number, kind: "na" | "k" | "cl" | "a", key: string, o = 1) => (
  <circle key={key} cx={r1(x)} cy={r1(y)} r={kind === "a" ? 7 : 5} fill={kind === "na" ? "var(--bio-c)" : kind === "k" ? "var(--bio-t)" : kind === "cl" ? "var(--bio-leaf)" : "var(--bio-nucleus-deep)"} stroke="var(--bio-outline)" strokeWidth={0.7} opacity={o} />
);

// Fixed scattered ions (outside: lots of Na⁺ and Cl⁻, a little K⁺; inside: lots of K⁺ and A⁻, a little Na⁺).
const OUT_NA = [[30, 20], [70, 40], [160, 18], [250, 34], [290, 16], [372, 22], [452, 40], [540, 18], [96, 14], [232, 52]];
const OUT_CL = [[50, 54], [190, 44], [345, 50], [470, 14], [520, 52]];
const OUT_K = [[140, 50], [400, 50]];
const IN_K = [[40, 130], [86, 158], [150, 128], [240, 150], [276, 126], [360, 160], [440, 132], [520, 156], [190, 166], [300, 168]];
const IN_A = [[64, 150], [222, 126], [330, 142], [480, 146], [120, 168]];
const IN_NA = [[400, 166], [540, 124]];

export function NerveMembraneStrip({ t, stim = 1, pump }: { t: number; stim?: number; pump?: boolean }) {
  const tt = useText();
  const v = apV(t, stim);
  const na = naGate(t, stim);
  const k = kGate(t, stim);
  const out: ReactNode[] = [];
  // Na⁺ that flow in during the depolarisation (3 per channel).
  NA_X.forEach((cx, c) =>
    [0, 1, 2].forEach((i) => {
      const from: [number, number] = [cx + (i - 1) * 16, 30 + i * 9];
      const to: [number, number] = [cx + (i - 1) * 18, 128 + i * 12];
      const k0 = stim < 0.5 ? 0 : span(t, AP.fire + i * 0.07 + c * 0.03, AP.fire + 0.2 + i * 0.07 + c * 0.03);
      const through = k0 < 0.5 ? lerp(from[0], cx, k0 * 2) : lerp(cx, to[0], (k0 - 0.5) * 2);
      const y = lerp(from[1], to[1], k0);
      const back = span(t, 4.6, 5.4);
      out.push(ion(lerp(through, from[0], back), lerp(y, from[1], back), "na", `na${c}${i}`));
    }),
  );
  // K⁺ that flow out during the repolarisation (3 per channel).
  K_X.forEach((cx, c) =>
    [0, 1, 2].forEach((i) => {
      const from: [number, number] = [cx + (i - 1) * 16, 140 + i * 9];
      const to: [number, number] = [cx + (i - 1) * 18, 44 - i * 11];
      const k0 = stim < 0.5 ? 0 : span(t, 1.7 + i * 0.28 + c * 0.1, 2.0 + i * 0.28 + c * 0.1);
      const through = k0 < 0.5 ? lerp(from[0], cx, k0 * 2) : lerp(cx, to[0], (k0 - 0.5) * 2);
      const y = lerp(from[1], to[1], k0);
      const back = span(t, 4.6, 5.4);
      out.push(ion(lerp(through, from[0], back), lerp(y, from[1], back), "k", `k${c}${i}`));
    }),
  );
  const signs = Array.from({ length: 12 }, (_, i) => 24 + i * 46);
  const pos = v > 0;
  const strength = Math.min(1, Math.abs(v) / 70);
  return (
    <svg viewBox={`0 0 ${MW} ${MH}`} className="block h-auto w-full" role="img" aria-label={tt(tx("Axon membrane with ion channels", "Axonmembran mit Ionenkanälen"))}>
      <rect x={0} y={0} width={MW} height={MEM_TOP} fill="var(--bio-vacuole)" opacity={0.45} />
      <rect x={0} y={MEM_BOT} width={MW} height={MH - MEM_BOT} fill="var(--bio-nerve)" opacity={0.18} />
      {/* phospholipid bilayer */}
      <rect x={0} y={MEM_TOP} width={MW} height={MEM_BOT - MEM_TOP} fill="var(--bio-membrane)" opacity={0.25} />
      {Array.from({ length: 57 }, (_, i) => (
        <g key={i}>
          <circle cx={i * 10 + 2} cy={MEM_TOP + 4} r={4} fill="var(--bio-membrane)" />
          <circle cx={i * 10 + 2} cy={MEM_BOT - 4} r={4} fill="var(--bio-membrane)" />
        </g>
      ))}
      {OUT_NA.map(([x, y], i) => ion(x, y, "na", `on${i}`))}
      {OUT_CL.map(([x, y], i) => ion(x, y, "cl", `oc${i}`))}
      {OUT_K.map(([x, y], i) => ion(x, y, "k", `ok${i}`))}
      {IN_K.map(([x, y], i) => ion(x, y, "k", `ik${i}`))}
      {IN_A.map(([x, y], i) => ion(x, y, "a", `ia${i}`))}
      {IN_NA.map(([x, y], i) => ion(x, y, "na", `in${i}`))}
      {NA_X.map((x) => (
        <Channel key={x} x={x} gate={na} kind="na" />
      ))}
      {K_X.map((x) => (
        <Channel key={x} x={x} gate={k} kind="k" />
      ))}
      <Channel x={LEAK_X} gate="open" kind="leak" />
      {pump && (
        <g>
          <rect x={LEAK_X - 52} y={MEM_TOP - 8} width={30} height={MEM_BOT - MEM_TOP + 16} rx={12} fill="var(--bio-u)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        </g>
      )}
      {out}
      {signs.map((x) => (
        <g key={x} opacity={0.35 + 0.65 * strength}>
          <SvgLabel x={x} y={MEM_TOP - 9} size={13} weight={700} fill={pos ? "var(--bio-t)" : "var(--bio-blood)"}>
            {pos ? "−" : "+"}
          </SvgLabel>
          <SvgLabel x={x} y={MEM_BOT + 9} size={13} weight={700} fill={pos ? "var(--bio-blood)" : "var(--bio-t)"}>
            {pos ? "+" : "−"}
          </SvgLabel>
        </g>
      ))}
      <SvgLabel x={MW - 6} y={10} anchor="end" size={11} fill="var(--ink-2)" halo>
        {tt(tx("outside", "außen"))}
      </SvgLabel>
      <SvgLabel x={MW - 6} y={MH - 10} anchor="end" size={11} fill="var(--ink-2)" halo>
        {tt(tx("inside (axon)", "innen (Axon)"))}
      </SvgLabel>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Widget

const PHASE_TEXT: Record<ApPhase, Text> = {
  rest: tx(
    "**Resting potential (−70 mV):** the voltage-gated Na⁺ and K⁺ channels are closed. Only the K⁺ leak channels are open. The inside of the membrane is negative.",
    "**Ruhepotenzial (−70 mV):** Die spannungsgesteuerten Na⁺- und K⁺-Kanäle sind geschlossen, nur die Kalium-Leckkanäle sind offen. Die Membran ist innen negativ geladen.",
  ),
  pre: tx(
    "A stimulus depolarises the membrane a little. Only when the **threshold** (about −50 mV) is reached do the voltage-gated Na⁺ channels open.",
    "Ein Reiz depolarisiert die Membran ein wenig. Erst wenn der **Schwellenwert** (etwa −50 mV) erreicht ist, öffnen sich die spannungsgesteuerten Na⁺-Kanäle.",
  ),
  depol: tx(
    "**Depolarisation:** voltage-gated Na⁺ channels open, Na⁺ **flows in** (down its concentration gradient and attracted by the negative inside). The inside becomes positive, up to about +30 mV (overshoot).",
    "**Depolarisation:** Spannungsgesteuerte Na⁺-Kanäle öffnen sich, Na⁺ **strömt ein** (dem Konzentrationsgefälle folgend und vom negativen Inneren angezogen). Innen wird es positiv, bis etwa +30 mV (Overshoot).",
  ),
  repol: tx(
    "**Repolarisation:** the Na⁺ channels are **inactivated** (plugged). The voltage-gated K⁺ channels open with a delay, K⁺ **flows out**. The inside becomes negative again.",
    "**Repolarisation:** Die Na⁺-Kanäle werden **inaktiviert** (verschlossen). Die spannungsgesteuerten K⁺-Kanäle öffnen sich verzögert, K⁺ **strömt aus**. Innen wird es wieder negativ.",
  ),
  hyper: tx(
    "**Hyperpolarisation:** the K⁺ channels close only slowly, so a little extra K⁺ flows out: briefly more negative than at rest (about −80 mV).",
    "**Hyperpolarisation:** Die K⁺-Kanäle schließen sich nur langsam, deshalb strömt noch etwas mehr K⁺ aus: kurz negativer als in Ruhe (etwa −80 mV).",
  ),
  after: tx(
    "Back to the resting potential. Only very few ions have moved. In the long run the **sodium-potassium pump** (using ATP) restores the ion distribution.",
    "Zurück beim Ruhepotenzial. Nur sehr wenige Ionen haben die Seite gewechselt. Langfristig stellt die **Natrium-Kalium-Pumpe** (mit ATP) die Ionenverteilung wieder her.",
  ),
};
const SUB_TEXT = tx(
  "**Below threshold:** the stimulus only depolarises the membrane a little and the change fades away. No action potential. Push the stimulus higher!",
  "**Unterschwellig:** Der Reiz depolarisiert die Membran nur ein wenig, und das klingt wieder ab. Kein Aktionspotenzial. Mach den Reiz stärker!",
);

function SingleAp() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0);
  const [stim, setStim] = useState(0.75);
  const [refr, setRefr] = useState(false);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const phase = apPhase(time, stim);
  const v = apV(time, stim);
  const na = naGate(time, stim);
  const k = kGate(time, stim);
  const play = () => {
    ctrl.current?.stop();
    if (reduce) {
      const stops = [0.5, 1.3, 1.6, 2.2, 3.1, 5.6];
      setTime(stops.find((s) => s > time + 0.01) ?? 0.5);
      return;
    }
    const from = time >= AP.T - 0.01 ? 0 : time;
    ctrl.current = animate(from, AP.T, { duration: (AP.T - from) * 1.6, ease: "linear", onUpdate: setTime });
  };
  const gateText = (g: Gate): Text => (g === "open" ? tx("open", "offen") : g === "inactive" ? tx("inactivated", "inaktiviert") : tx("closed", "geschlossen"));
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <NerveApGraph upTo={time} stim={stim} cursor={time} refractory={refr && stim >= 0.5} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[13px] text-ink-2">
        <span className="font-math text-[20px] tabular-nums text-ink">
          {Math.round(v) > 0 ? "+" : ""}
          {String(Math.round(v)).replace("-", "−")} mV
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--bio-c)" }} /> {t(tx("Na⁺ channels", "Na⁺-Kanäle"))} <Pill on={na === "open"}>{t(gateText(na))}</Pill>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--bio-t)" }} /> {t(tx("K⁺ channels", "K⁺-Kanäle"))} <Pill on={k === "open"}>{t(gateText(k))}</Pill>
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <NerveMembraneStrip t={time} stim={stim} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        {[
          { c: "var(--bio-c)", l: tx("Na⁺", "Na⁺") },
          { c: "var(--bio-t)", l: tx("K⁺", "K⁺") },
          { c: "var(--bio-leaf)", l: tx("Cl⁻", "Cl⁻") },
          { c: "var(--bio-nucleus-deep)", l: tx("A⁻ (protein anions)", "A⁻ (Eiweiß-Anionen)") },
        ].map((x) => (
          <span key={t(x.l)} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: x.c }} />
            {t(x.l)}
          </span>
        ))}
        <span className="text-ink-3">{t(tx("ball on a chain: inactivation gate of the Na⁺ channel", "Kugel an der Kette: Inaktivierungstor des Na⁺-Kanals"))}</span>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5">
        <Slider value={stim} onChange={(s) => setStim(Math.round(s * 20) / 20)} label={tx("Stimulus strength", "Reizstärke")} left={t(tx("weak stimulus", "schwacher Reiz"))} right={t(tx("strong", "stark"))} />
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton onClick={play}>
            <Play className="size-4" /> {t(time > 0 && time < AP.T ? tx("Continue", "Weiter") : tx("Stimulate", "Reizen"))}
          </ActionButton>
          <GhostButton
            label={t(tx("Start again", "Von vorn"))}
            onClick={() => {
              ctrl.current?.stop();
              setTime(0);
            }}
          >
            <RotateCcw className="size-4" />
          </GhostButton>
          <GhostButton pressed={refr} onClick={() => setRefr(!refr)}>
            {t(tx("Refractory period", "Refraktärzeit"))}
          </GhostButton>
          <input
            type="range"
            min={0}
            max={AP.T}
            step={0.01}
            value={time}
            onChange={(e) => {
              ctrl.current?.stop();
              setTime(Number(e.target.value));
            }}
            aria-label={t(tx("Time in ms", "Zeit in ms"))}
            className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
          />
          <span className="w-[64px] text-right font-math text-[15px] tabular-nums text-ink-2">{time.toFixed(1).replace(".", locale === "de" ? "," : ".")} ms</span>
        </div>
      </div>
      <Note id={`${phase}-${stim < 0.5}`} text={stim < 0.5 && phase !== "rest" ? SUB_TEXT : PHASE_TEXT[phase]} accent={phase === "depol" || phase === "repol" || phase === "hyper"} />
      {refr && stim >= 0.5 && (
        <p className="text-[13px] leading-relaxed text-ink-3">
          {t(
            tx(
              "Absolute refractory period: the Na⁺ channels are inactivated, no new action potential is possible, however strong the stimulus. Relative refractory period: only a stronger stimulus triggers one. That's why an impulse can't run backwards.",
              "Absolute Refraktärzeit: Die Na⁺-Kanäle sind inaktiviert, kein neues Aktionspotenzial möglich, egal wie stark der Reiz ist. Relative Refraktärzeit: Nur ein stärkerer Reiz löst eins aus. Darum kann eine Erregung nicht zurücklaufen.",
            ),
          )}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frequency coding: a lasting stimulus produces a train of identical action potentials.

const FW = 560;
const FH = 190;
const FT = 50; // ms shown

function spike(t: number) {
  // A compressed action potential (about 3 ms long) starting at t = 0.
  if (t < 0 || t > 3) return null;
  return apV(AP.fire + t * 1.25, 1);
}

export function NerveFrequency() {
  const t = useText();
  const [stim, setStim] = useState(0.6);
  const above = stim >= 0.3;
  const isi = above ? lerp(22, 3.4, (stim - 0.3) / 0.7) : Infinity;
  const starts: number[] = [];
  if (above) for (let s = 6; s < FT - 2; s += isi) starts.push(s);
  const fx = (x: number) => 40 + (x / FT) * (FW - 52);
  const fy = (v: number) => 46 + ((40 - v) / 130) * (FH - 64);
  const pts: string[] = [];
  for (let x = 0; x <= FT; x += 0.05) {
    let v = -70;
    if (x >= 5) {
      const last = starts.filter((s) => s <= x).pop();
      const sp = last === undefined ? null : spike(x - last);
      v = sp ?? (above ? -70 + 6 * Math.min(1, (x - 5) / 1.5) : -70 + 50 * stim * Math.min(1, (x - 5) / 1.5));
    }
    pts.push(`${pts.length ? "L" : "M"}${fx(x).toFixed(1)} ${fy(v).toFixed(1)}`);
  }
  const freq = above ? Math.round(1000 / isi) : 0;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <svg viewBox={`0 0 ${FW} ${FH}`} className="block h-auto w-full" role="img" aria-label={t(tx("Stimulus and action potentials over time", "Reiz und Aktionspotenziale über der Zeit"))}>
          <rect x={fx(5)} y={8} width={fx(FT) - fx(5)} height={20} rx={4} fill="var(--bio-sun)" opacity={0.15 + 0.75 * stim} />
          <SvgLabel x={fx(5) + 8} y={18} anchor="start" size={11} fill="var(--ink)" halo>
            {t(tx("lasting stimulus", "Dauerreiz"))}
          </SvgLabel>
          <line x1={40} x2={FW - 12} y1={fy(-70)} y2={fy(-70)} stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1} />
          <line x1={40} x2={FW - 12} y1={fy(-50)} y2={fy(-50)} stroke="var(--blob)" strokeDasharray="5 4" strokeWidth={1} opacity={0.7} />
          <line x1={40} x2={FW - 12} y1={fy(0)} y2={fy(0)} stroke="var(--line)" strokeWidth={1} />
          <text x={34} y={fy(-70) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            −70
          </text>
          <text x={34} y={fy(0) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            0
          </text>
          <text x={34} y={fy(30) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            +30
          </text>
          <path d={pts.join(" ")} fill="none" stroke="var(--blob)" strokeWidth={2.2} strokeLinejoin="round" />
          <text x={FW - 12} y={FH - 4} textAnchor="end" fontSize={11} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("time in ms", "Zeit in ms"))}
          </text>
        </svg>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5">
        <Slider value={stim} onChange={setStim} label={tx("Stimulus strength", "Reizstärke")} left={t(tx("weak", "schwach"))} right={t(tx("strong", "stark"))} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px] text-ink-2">
          <span>
            {t(tx("Action potentials:", "Aktionspotenziale:"))} <span className="font-math font-semibold text-ink">{starts.length}</span>
          </span>
          <span>
            {t(tx("Frequency:", "Frequenz:"))} <span className="font-math font-semibold text-blob-ink">{freq} Hz</span>
          </span>
          <span>
            {t(tx("Height of each:", "Höhe jedes AP:"))} <span className={cn("font-math font-semibold", above ? "text-ink" : "text-ink-3")}>{above ? "+30 mV" : "–"}</span>
          </span>
        </div>
      </div>
      <Note
        id={above ? `f${stim > 0.7}` : "sub"}
        text={
          above
            ? tx(
                "Every action potential is exactly the same height (**all-or-none law**). A stronger stimulus only makes them come **more often**: the information is in the **frequency** (frequency coding). The refractory period sets the upper limit.",
                "Jedes Aktionspotenzial ist genau gleich hoch (**Alles-oder-Nichts-Gesetz**). Ein stärkerer Reiz lässt sie nur **häufiger** kommen: Die Information steckt in der **Frequenz** (Frequenzcodierung). Die Refraktärzeit setzt die Obergrenze.",
              )
            : tx("Below threshold: the membrane is only slightly depolarised. No action potentials at all.", "Unterschwellig: Die Membran wird nur leicht depolarisiert. Es entsteht kein einziges Aktionspotenzial.")
        }
        accent={above}
      />
    </div>
  );
}

export function NerveApLab() {
  const [tab, setTab] = useState<"one" | "freq">("one");
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        label={tx("View", "Ansicht")}
        options={[
          { id: "one", label: tx("One action potential", "Ein Aktionspotenzial") },
          { id: "freq", label: tx("Stimulus and frequency", "Reizstärke und Frequenz") },
        ]}
      />
      {tab === "one" ? <SingleAp /> : <NerveFrequency />}
    </div>
  );
}
