"use client";

// The countercurrent principle in a gill lamella (model): water and blood flow past each other.
// Countercurrent: the water is always richer in oxygen than the blood next to it, so oxygen keeps
// diffusing all along and the blood leaves almost saturated. Same direction: both meet at about half.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

/** Oxygen (percent of the water's starting content) in 5 segments, left to right. */
export const GILL_MODEL = {
  counter: { water: [20, 40, 60, 80, 100], blood: [15, 35, 55, 75, 90] },
  same: { water: [100, 72, 60, 55, 52], blood: [10, 38, 46, 50, 51] },
};

const X0 = 40;
const SEG = 96;
const mixBlood = (v: number) => `color-mix(in oklab, var(--bio-blood) ${v}%, var(--bio-blood-low))`;
const mixWater = (v: number) => `color-mix(in oklab, var(--bio-water) ${Math.round(25 + v * 0.75)}%, var(--raised))`;

export function VertebrateGills() {
  const t = useText();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"counter" | "same">("counter");
  const m = GILL_MODEL[mode];
  const waterLeft = mode === "counter";
  const font = { fontFamily: "var(--font-sans)" };
  return (
    <div className="space-y-3">
      <div className="flex w-fit rounded-full border border-line bg-surface p-0.5 text-[13.5px] font-semibold">
        {(["counter", "same"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setMode(v)} className={cn("rounded-full px-3.5 py-1 transition-colors", mode === v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
            {v === "counter" ? t(tx("Countercurrent", "Gegenstrom")) : t(tx("Same direction", "Gleichstrom"))}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 560 220" className="block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(tx("Gill lamella: water and blood", "Kiemenblättchen: Wasser und Blut"))}>
        <text x={X0} y={24} fontSize={15} fill="var(--ink)" style={font}>
          {t(tx("water", "Wasser"))}
        </text>
        <text x={X0} y={210} fontSize={15} fill="var(--ink)" style={font}>
          {t(tx("blood in the gill capillaries", "Blut in den Kiemenkapillaren"))}
        </text>
        {m.water.map((v, i) => (
          <g key={`w${i}`}>
            <motion.rect x={X0 + i * SEG} y={36} width={SEG - 2} height={52} initial={false} animate={{ fill: mixWater(v) }} transition={{ duration: 0.5 }} rx={i === 0 ? 10 : 2} />
            <text x={X0 + i * SEG + SEG / 2} y={67} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)" style={font}>
              {v} %
            </text>
          </g>
        ))}
        {m.blood.map((v, i) => (
          <g key={`b${i}`}>
            <motion.rect x={X0 + i * SEG} y={132} width={SEG - 2} height={52} initial={false} animate={{ fill: mixBlood(v) }} transition={{ duration: 0.5 }} rx={2} />
            <rect x={X0 + i * SEG + SEG / 2 - 26} y={146} width={52} height={24} rx={12} fill="var(--raised)" opacity={0.9} />
            <text x={X0 + i * SEG + SEG / 2} y={163} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)" style={font}>
              {v} %
            </text>
            {/* diffusion arrow: thicker for a bigger difference */}
            <motion.line x1={X0 + i * SEG + SEG / 2} x2={X0 + i * SEG + SEG / 2} y1={92} y2={124} initial={false} animate={{ strokeWidth: Math.max(1, (m.water[i] - v) / 6), opacity: m.water[i] - v > 2 ? 1 : 0.15 }} stroke="var(--blob)" strokeLinecap="round" />
            <path d={`M${X0 + i * SEG + SEG / 2 - 6} 118 L ${X0 + i * SEG + SEG / 2} 127 L ${X0 + i * SEG + SEG / 2 + 6} 118`} fill="none" stroke="var(--blob)" strokeWidth={2} opacity={m.water[i] - v > 2 ? 1 : 0.15} />
          </g>
        ))}
        {/* flow arrows */}
        <motion.g animate={reduce ? undefined : { x: waterLeft ? [0, -14, 0] : [0, 14, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d={waterLeft ? "M520 20 L 440 20 M452 13 L 440 20 L 452 27" : "M440 20 L 520 20 M508 13 L 520 20 L 508 27"} fill="none" stroke="var(--bio-water-deep)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
        <motion.g animate={reduce ? undefined : { x: [0, 14, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <path d="M440 204 L 520 204 M508 197 L 520 204 L 508 211" fill="none" stroke="var(--bio-blood)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </motion.g>
      </svg>
      <p className="text-[14.5px] text-ink-2">
        {mode === "counter"
          ? t(tx("In every segment the water holds more oxygen than the blood next to it, so oxygen keeps diffusing in. The blood leaves with about 90 %.", "In jedem Abschnitt enthält das Wasser mehr Sauerstoff als das Blut daneben, deshalb diffundiert immer weiter Sauerstoff hinein. Das Blut verlässt die Kieme mit etwa 90 %."))
          : t(tx("Same direction: the difference is used up quickly. Water and blood end at about 50 %, then nothing more diffuses.", "Gleiche Richtung: Der Unterschied ist schnell aufgebraucht. Wasser und Blut enden bei etwa 50 %, dann diffundiert nichts mehr."))}
      </p>
      <p className="text-[12.5px] text-ink-3">{t(tx("Model: oxygen content in percent of the fresh water's content.", "Modell: Sauerstoffgehalt in Prozent des Gehalts im frischen Wasser."))}</p>
    </div>
  );
}
