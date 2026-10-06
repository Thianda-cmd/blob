"use client";

// More substrate, more speed? A reaction vessel with enzymes and substrate particles: the slider
// adds substrate, bound substrates sit in the active sites. The graph shows the rate rising and
// levelling off (saturation). Doubling the enzyme doubles the maximum rate.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { mm } from "@/learn/biology/topics/enzymes/data";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { Chart, curvePath } from "./EnzymeCharts";
import { EnzymeBody, SubstrateShape } from "./EnzymeShapes";

const K = 3;
const SMAX = 40;
const BOX = { w: 340, h: 200 };

/** Enzyme positions for 6 or 12 enzymes, with their scale. */
const LAYOUT: Record<6 | 12, { s: number; at: [number, number][] }> = {
  6: { s: 0.21, at: [60, 170, 280].flatMap((x) => [70, 152].map((y) => [x, y] as [number, number])) },
  12: { s: 0.16, at: [48, 130, 212, 294].flatMap((x) => [52, 110, 168].map((y) => [x, y] as [number, number])) },
};

/** Fixed spots for free substrate particles (deterministic, away from the enzymes). */
function freeSpots(n: 6 | 12) {
  const L = LAYOUT[n];
  const out: [number, number][] = [];
  let h = 12345;
  for (let i = 0; out.length < SMAX && i < 3000; i++) {
    h = (Math.imul(h ^ (h >>> 13), 1103515245) + 12345) >>> 0;
    const x = 12 + (h % 316);
    const y = 12 + ((h >>> 9) % 176);
    const nearEnzyme = L.at.some(([ex, ey]) => Math.abs(x - ex) < 140 * L.s + 8 && y > ey - 34 * L.s * 1.6 - 6 && y < ey + 125 * L.s + 6);
    const nearOther = out.some(([ox, oy]) => (ox - x) ** 2 + (oy - y) ** 2 < 150);
    if (!nearEnzyme && !nearOther) out.push([x, y]);
  }
  return out;
}
const SPOTS = { 6: freeSpots(6), 12: freeSpots(12) };

export function EnzymeSaturation() {
  const t = useText();
  const [sub, setSub] = useState(4);
  const [nE, setNE] = useState<6 | 12>(6);
  const L = LAYOUT[nE];
  const busy = Math.min(nE, Math.round(mm(sub, nE, K)), sub);
  const free = sub - busy;
  const vmax = nE * 10;
  const v = mm(sub, vmax, K);

  const info: Text =
    sub === 0
      ? tx("No substrate, no reaction. Add some!", "Kein Substrat, keine Reaktion. Gib welches dazu!")
      : busy < nE * 0.6
        ? txMap((tt) =>
            tt(
              `Little substrate: only ${busy} of ${nE} active sites are busy, the others are waiting. More substrate means more collisions, so the rate rises almost in proportion.`,
              `Wenig Substrat: Nur ${busy} von ${nE} aktiven Zentren sind besetzt, die anderen warten. Mehr Substrat bedeutet mehr Zusammenstöße, darum steigt die Geschwindigkeit fast proportional.`,
            ),
          )
        : nE === 12
          ? tx(
              "Twice the enzyme, twice the maximum rate: now twice as many active sites work at the same time. The dashed curve is the one with 6 enzymes.",
              "Doppelt so viel Enzym, doppelte Höchstgeschwindigkeit: Jetzt arbeiten doppelt so viele aktive Zentren gleichzeitig. Die gestrichelte Kurve gilt für 6 Enzyme.",
            )
          : busy < nE
            ? tx("Most active sites are busy. Extra substrate helps less and less: the curve flattens.", "Die meisten aktiven Zentren sind besetzt. Zusätzliches Substrat bringt immer weniger: Die Kurve flacht ab.")
            : tx(
                "**Saturation**: all active sites are busy all the time. More substrate doesn't make it faster. What would help? Try more enzyme.",
                "**Sättigung**: Alle aktiven Zentren sind ständig besetzt. Mehr Substrat macht es nicht schneller. Was würde helfen? Probier mehr Enzym.",
              );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 md:items-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="block h-auto w-full" role="img" aria-label={t(tx("Reaction vessel with enzymes and substrate particles", "Reaktionsgefäß mit Enzymen und Substratteilchen"))}>
            <rect x={2} y={2} width={BOX.w - 4} height={BOX.h - 4} rx={14} fill="color-mix(in oklab, var(--bio-water) 10%, transparent)" stroke="var(--line-2)" strokeWidth={1.5} />
            {L.at.map(([x, y], i) => (
              <g key={`${nE}-${i}`} transform={`translate(${x} ${y}) scale(${L.s})`}>
                <EnzymeBody />
                <AnimatePresence>
                  {i < busy && (
                    <motion.g key="s" initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }} transition={{ type: "spring", stiffness: 160, damping: 18 }}>
                      <SubstrateShape />
                    </motion.g>
                  )}
                </AnimatePresence>
              </g>
            ))}
            <AnimatePresence>
              {SPOTS[nE].slice(0, free).map(([x, y], i) => (
                <motion.circle key={`${nE}-f${i}`} cx={x} cy={y} r={5} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.4} initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.3 }} />
              ))}
            </AnimatePresence>
          </svg>
        </div>
        <div className="rounded-xl border border-line bg-surface p-1.5">
          <Chart
            x={{ min: 0, max: SMAX, step: 10, label: tx("amount of substrate", "Substratmenge"), ticks: false }}
            y={{ min: 0, max: 130, step: 20, label: tx("reaction rate", "Reaktionsgeschwindigkeit"), ticks: false }}
            width={400}
            height={250}
            label={tx("Reaction rate against substrate concentration", "Reaktionsgeschwindigkeit in Abhängigkeit von der Substratkonzentration")}
          >
            {(s) => (
              <>
                {nE === 12 && <path d={curvePath((x) => mm(x, 60, K), 0, SMAX, s)} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />}
                <path d={`M ${s.x0} ${s.py(vmax)} L ${s.x1} ${s.py(vmax)}`} stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="3 4" opacity={0.7} />
                <motion.path initial={false} animate={{ d: curvePath((x) => mm(x, vmax, K), 0, SMAX, s, 100) }} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
                <circle cx={s.px(sub)} cy={s.py(v)} r={6.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />
              </>
            )}
          </Chart>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[13px] text-ink-2">
          <span className="shrink-0">{t(tx("Substrate", "Substrat"))}</span>
          <input type="range" min={0} max={SMAX} step={1} value={sub} onChange={(e) => setSub(Number(e.target.value))} className="w-full accent-[var(--blob)]" />
          <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-ink">{sub}</span>
        </label>
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {([6, 12] as const).map((k) => (
            <button key={k} type="button" onClick={() => setNE(k)} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium", nE === k ? "bg-hover text-ink" : "text-ink-3 hover:text-ink")}>
              {k === 6 ? t(tx("6 enzymes", "6 Enzyme")) : t(tx("12 enzymes", "12 Enzyme"))}
            </button>
          ))}
        </div>
      </div>

      <motion.p
        key={`${nE}-${sub === 0 ? 0 : busy < nE * 0.6 ? 1 : busy < nE ? 2 : 3}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[3.2rem] rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        <Inline text={info} />
      </motion.p>
    </div>
  );
}
