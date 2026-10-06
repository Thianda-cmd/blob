"use client";

// Level 2 widget: the classic Elodea (Wasserpest) experiment. Move the lamp, count the oxygen
// bubbles rising from the cut stem, record measurements and see the curve appear. Adding sodium
// hydrogen carbonate gives the water more CO2, which raises the rate when the lamp is close.

import { motion, useReducedMotion } from "motion/react";
import { Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";

/** Bubbles per minute at lamp distance d (cm); `extra`: water with added sodium hydrogen carbonate. */
export function bubblesAt(d: number, extra = false) {
  const x = (10 / d) ** 2;
  return Math.round(((extra ? 75 : 45) * x) / (x + 0.3));
}

const SPEED = 4; // time lapse
const RISE = 1.6; // seconds a bubble needs to the surface

type Row = { d: number; extra: boolean; n: number };

export function PhotoElodea() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [d, setD] = useState(25);
  const [extra, setExtra] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const rate = bubblesAt(d, extra);
  const head = 296 - d * 4.6;
  const glow = Math.min(1, (10 / d) ** 2 * 1.1);

  const interval = 60 / (rate * SPEED);
  const slots = Math.max(1, Math.min(12, Math.ceil(RISE / interval) + 1));

  const measure = () => setRows((r) => [...r.filter((x) => !(x.d === d && x.extra === extra)), { d, extra, n: rate }].sort((a, b) => a.d - b.d || Number(a.extra) - Number(b.extra)));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-start">
        <svg viewBox="0 0 520 290" className="block h-auto w-full" role="img" aria-label={t(tx("Elodea in a beaker under a lamp", "Wasserpest in einem Becherglas unter einer Lampe"))}>
          {/* light cone */}
          <motion.polygon points={`${head + 26},${118} ${head + 26},${152} 452,${250} 452,${70}`} fill="var(--bio-sun)" initial={false} animate={{ opacity: 0.08 + glow * 0.32 }} transition={{ duration: 0.3 }} />
          {/* table */}
          <line x1={10} x2={510} y1={262} y2={262} stroke="var(--ink-3)" strokeWidth={2} />
          {/* lamp */}
          <g>
            <rect x={head - 34} y={254} width={44} height={8} rx={3} fill="var(--bio-nucleus-deep)" stroke="var(--bio-outline)" strokeWidth={1.5} />
            <path d={`M ${head - 12} 256 L ${head - 24} 186 L ${head - 4} 140`} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M ${head - 14} 120 L ${head + 18} 112 L ${head + 28} 158 L ${head - 4} 160 Z`} fill="var(--bio-nucleus-deep)" stroke="var(--bio-outline)" strokeWidth={1.5} strokeLinejoin="round" />
            <ellipse cx={head + 24} cy={135} rx={5} ry={22} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.2} transform={`rotate(-12 ${head + 24} 135)`} />
          </g>
          {/* heat filter: a cuvette of water */}
          <rect x={300} y={120} width={14} height={112} rx={3} fill="var(--bio-water)" opacity={0.45} stroke="var(--bio-water-deep)" strokeWidth={1.4} />
          {/* beaker */}
          <path d="M338 74 L 338 252 Q 338 262 348 262 L 446 262 Q 456 262 456 252 L 456 74" fill="none" stroke="var(--ink-2)" strokeWidth={2.2} />
          <path d="M340 92 L 454 92 L 454 252 Q 454 260 446 260 L 348 260 Q 340 260 340 252 Z" fill="var(--bio-water)" opacity={extra ? 0.42 : 0.28} />
          {/* elodea sprig */}
          <path d="M397 252 C 395 210 399 170 397 122" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
          {[236, 218, 200, 182, 164, 146, 130].map((y, i) => (
            <g key={y} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1}>
              <path d={`M397 ${y} q -16 -4 -24 -14 q 12 2 24 10 Z`} transform={i % 2 ? `rotate(8 397 ${y})` : undefined} />
              <path d={`M397 ${y} q 16 -4 24 -14 q -12 2 -24 10 Z`} transform={i % 2 ? `rotate(-8 397 ${y})` : undefined} />
              <path d={`M397 ${y} q 2 -12 -2 -20 q -2 10 2 20 Z`} />
            </g>
          ))}
          <ellipse cx={397} cy={121} rx={2.6} ry={1.4} fill="var(--bio-leaf-deep)" />
          {/* bubbles */}
          {reduce
            ? Array.from({ length: Math.min(6, Math.ceil(rate / 10)) }, (_, i) => <circle key={i} cx={397 + (i % 2 ? 2 : -2)} cy={112 - i * 4} r={2.8} fill="var(--raised)" stroke="var(--bio-water-deep)" strokeWidth={1.1} />)
            : Array.from({ length: slots }, (_, i) => (
                <motion.circle
                  key={`${rate}-${i}`}
                  cx={397}
                  r={2.8}
                  fill="var(--raised)"
                  stroke="var(--bio-water-deep)"
                  strokeWidth={1.1}
                  initial={{ cy: 118, opacity: 0 }}
                  animate={{ cy: [118, 92], cx: [397, 397 + (i % 2 ? 3 : -3)], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: RISE, delay: i * interval, repeat: Infinity, repeatDelay: Math.max(0, slots * interval - RISE), ease: "easeIn", times: [0, 0.1, 0.9, 1] }}
                />
              ))}
          {/* ruler */}
          <line x1={head + 24} x2={397} y1={278} y2={278} stroke="var(--ink-3)" strokeWidth={1.2} />
          <line x1={head + 24} x2={head + 24} y1={272} y2={284} stroke="var(--ink-3)" strokeWidth={1.2} />
          <line x1={397} x2={397} y1={272} y2={284} stroke="var(--ink-3)" strokeWidth={1.2} />
          <text x={(head + 24 + 397) / 2} y={274} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-ink-2" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">
            {d} cm
          </text>
        </svg>

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Bubbles per minute", "Bläschen pro Minute"))}</div>
            <motion.div key={rate} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-math text-[34px] leading-tight tabular-nums text-ink">
              {rate}
            </motion.div>
            <div className="text-[12px] text-ink-3">{t(tx("shown in time lapse", "im Zeitraffer gezeigt"))}</div>
          </div>
          <label className="block">
            <span className="flex items-baseline justify-between text-[13.5px]">
              <span className="font-medium text-ink-2">{t(tx("Distance of the lamp", "Abstand der Lampe"))}</span>
              <span className="font-math text-[17px] tabular-nums">{d} cm</span>
            </span>
            <input type="range" min={10} max={50} step={5} value={d} onChange={(e) => setD(Number(e.target.value))} className="h-9 w-full cursor-pointer accent-[var(--blob)]" />
          </label>
          <button
            type="button"
            aria-pressed={extra}
            onClick={() => setExtra((x) => !x)}
            className={cn("w-full rounded-lg border px-3 py-2 text-left text-[13.5px] font-medium leading-snug transition-colors", extra ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(tx("Add sodium hydrogen carbonate (more CO₂ in the water)", "Natriumhydrogencarbonat zugeben (mehr CO₂ im Wasser)"))}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={measure} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
              <Plus className="size-4" /> {t(tx("Record", "Messwert notieren"))}
            </button>
            <button type="button" onClick={() => setRows([])} disabled={!rows.length} aria-label={t(tx("Clear the table", "Tabelle leeren"))} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
              <RotateCcw className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-3">
              <th className="py-1 font-semibold">{t(tx("Distance", "Abstand"))}</th>
              <th className="py-1 font-semibold">CO₂</th>
              <th className="py-1 text-right font-semibold">{t(tx("Bubbles/min", "Bläschen/min"))}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-ink-3">
                  {t(tx("No measurements yet. Move the lamp and record.", "Noch keine Messwerte. Verschieb die Lampe und notiere."))}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.d}-${r.extra}`} className="border-t border-line">
                <td className="py-1 tabular-nums">{r.d} cm</td>
                <td className="py-1 text-ink-2">{r.extra ? t(tx("more", "mehr")) : t(tx("normal", "normal"))}</td>
                <td className="py-1 text-right font-math tabular-nums">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <svg viewBox="0 0 260 150" className="block h-auto w-full" role="img" aria-label={t(tx("Measured bubbles against distance", "Gemessene Bläschen gegen den Abstand"))}>
          {[0, 20, 40, 60].map((v) => (
            <g key={v}>
              <line x1={34} x2={250} y1={124 - v * 1.8} y2={124 - v * 1.8} stroke="var(--line)" strokeWidth={0.8} />
              <text x={28} y={128 - v * 1.8} textAnchor="end" fontSize={10} className="fill-ink-3 tabular-nums">
                {v}
              </text>
            </g>
          ))}
          {[10, 20, 30, 40, 50].map((v) => (
            <text key={v} x={34 + (v - 10) * 5.2} y={140} textAnchor="middle" fontSize={10} className="fill-ink-3 tabular-nums">
              {v}
            </text>
          ))}
          <text x={250} y={150} textAnchor="end" fontSize={10} className="fill-ink-2">
            {t(tx("distance in cm", "Abstand in cm"))}
          </text>
          {rows.map((r) => (
            <motion.circle
              key={`${r.d}-${r.extra}`}
              cx={34 + (r.d - 10) * 5.2}
              cy={124 - r.n * 1.8}
              r={4.5}
              fill={r.extra ? "var(--bio-chloro)" : "var(--blob)"}
              stroke="var(--raised)"
              strokeWidth={1.5}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
        </svg>
      </div>
      <p className="text-[12px] text-ink-3">
        {t(tx(`The water cuvette in front of the beaker keeps the heat of the lamp away, so only the light changes. Distance ${dec(10, locale)} to 50 cm.`, `Die Wasserküvette vor dem Becherglas hält die Wärme der Lampe ab, damit sich nur das Licht ändert. Abstand ${dec(10, locale)} bis 50 cm.`))}
      </p>
    </div>
  );
}
