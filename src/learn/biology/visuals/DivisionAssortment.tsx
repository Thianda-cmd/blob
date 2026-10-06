"use client";

// Interchromosomal recombination: in metaphase I every bivalent can face either way. Flip the
// three pairs of a model cell (2n = 6) and collect all 2³ = 8 combinations of sex cells.

import { motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight, Shuffle } from "lucide-react";
import { useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Chromosome, PARENT_FILL } from "./DivisionChromatid";

/** The three pairs from top to bottom: long (A), middle (C), short (B). */
const PAIR_IDS = [0, 2, 1] as const;
const YS = [52, 118, 176];
const MID = 150;

const key = (o: number[]) => o.map((v) => (v > 0 ? "m" : "p")).join("");

export function DivisionAssortment() {
  const t = useText();
  const reduce = useReducedMotion();
  // o[i] = 1: the maternal (red) homologue of pair i faces the left pole.
  const [o, setO] = useState<number[]>([1, 1, -1]);
  const [found, setFound] = useState<string[]>(() => [key([1, 1, -1]), key([-1, -1, 1])]);
  const [crossing, setCrossing] = useState(false);

  const apply = (next: number[]) => {
    setO(next);
    const add = [key(next), key(next.map((v) => -v))];
    setFound((f) => [...f, ...add.filter((k) => !f.includes(k))]);
  };
  const flip = (i: number) => apply(o.map((v, j) => (j === i ? -v : v)));
  const shuffle = () => apply(o.map(() => (Math.random() < 0.5 ? 1 : -1)));
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 22 };

  const all = Array.from({ length: 8 }, (_, i) => [i & 4 ? -1 : 1, i & 2 ? -1 : 1, i & 1 ? -1 : 1]);
  const gamete = (side: 1 | -1) => o.map((v) => (v * side < 0 ? 0 : 1)) as (0 | 1)[];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl bg-surface p-2">
          <svg viewBox="0 0 300 230" className="mx-auto block h-auto w-full max-w-[420px]" role="img" aria-label={t(tx("Metaphase I with three bivalents", "Metaphase I mit drei Bivalenten"))}>
            <ellipse cx={MID} cy={115} rx={140} ry={108} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2.5} />
            <line x1={MID} x2={MID} y1={14} y2={216} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="4 4" />
            {YS.map((y) =>
              [-1, 1].map((s) => (
                <line key={`${y}${s}`} x1={MID + s * 118} y1={115} x2={MID + s * 13} y2={y} stroke="var(--bio-outline)" strokeOpacity={0.35} strokeWidth={1} />
              )),
            )}
            {[-1, 1].map((s) => (
              <g key={s}>
                <rect x={MID + s * 120 - 5} y={113} width={10} height={4} rx={1.5} fill="var(--bio-nerve-deep)" />
                <rect x={MID + s * 120 - 2} y={110} width={4} height={10} rx={1.5} fill="var(--bio-nerve-deep)" />
              </g>
            ))}
            {PAIR_IDS.map((pair, i) => (
              <g key={pair} onClick={() => flip(i)} className="cursor-pointer">
                <rect x={MID - 30} y={YS[i] - 34} width={60} height={62} fill="transparent" />
                {([0, 1] as const).map((parent) => (
                  <motion.g key={parent} initial={false} animate={{ x: (parent === 0 ? -1 : 1) * o[i] * 8.5 }} transition={spring}>
                    <Chromosome x={MID} y={YS[i]} pair={pair} parent={parent} scale={0.95} swap={crossing ? (((parent === 0 ? 1 : -1) * o[i]) as 1 | -1) : undefined} />
                  </motion.g>
                ))}
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PAIR_IDS.map((_, i) => (
              <button key={i} type="button" onClick={() => flip(i)} className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                <ArrowLeftRight className="size-3.5" />
                {t(tx(`Pair ${i + 1}`, `Paar ${i + 1}`))}
              </button>
            ))}
            <button type="button" onClick={shuffle} className="flex h-9 items-center gap-1.5 rounded-lg bg-blob px-3 text-[13px] font-semibold text-white active:scale-[0.97]">
              <Shuffle className="size-3.5" />
              {t(tx("Chance", "Zufall"))}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([-1, 1] as const).map((side) => (
              <div key={side} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="text-[12px] font-semibold text-ink-3">{t(side < 0 ? tx("Left pole", "Linker Pol") : tx("Right pole", "Rechter Pol"))}</div>
                <svg viewBox="0 0 90 46" className="block h-auto w-full max-w-[150px]" aria-hidden>
                  {gamete(side).map((parent, j) => (
                    <Chromosome key={j} x={18 + j * 27} y={22} pair={PAIR_IDS[j]} parent={parent} chromatids={2} scale={0.55} />
                  ))}
                </svg>
              </div>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ink">
            <input type="checkbox" checked={crossing} onChange={(e) => setCrossing(e.target.checked)} className="size-4 accent-blob" />
            {t(tx("Show crossing over too", "Crossing-over dazunehmen"))}
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-ink">{t(tx(`Combinations found: ${found.length} of 8`, `Gefundene Kombinationen: ${found.length} von 8`))}</span>
          <span className="font-math text-[15px] text-ink-2">2³ = 8</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {all.map((combo) => {
            const k = key(combo);
            const on = found.includes(k);
            return (
              <div key={k} className={cn("flex h-11 items-end justify-center gap-1 rounded-lg border px-1 pb-1.5 transition-colors", on ? "border-blob bg-blob-soft" : "border-line")}>
                {combo.map((v, j) => (
                  <span key={j} className="w-2 rounded-full transition-opacity" style={{ height: [26, 16, 21][j], background: PARENT_FILL[v > 0 ? 0 : 1], opacity: on ? 1 : 0.18 }} />
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
          {crossing
            ? t(tx("With crossing over the chromatids themselves are mixed too: on top of the 2ⁿ combinations, practically every sex cell becomes unique.", "Mit Crossing-over werden zusätzlich die Chromatiden selbst neu gemischt: Über die 2ⁿ Kombinationen hinaus wird praktisch jede Keimzelle einzigartig."))
            : found.length < 8
              ? t(tx("Tap a pair to flip it. Each pair faces either way, independently of the others.", "Tipp ein Paar an, um es umzudrehen. Jedes Paar kann unabhängig von den anderen so oder so herum liegen."))
              : t(tx("All 8 found! With n pairs there are 2ⁿ combinations. Humans (n = 23): 2²³ ≈ 8.4 million different sex cells.", "Alle 8 gefunden! Bei n Paaren gibt es 2ⁿ Kombinationen. Beim Menschen (n = 23): 2²³ ≈ 8,4 Millionen verschiedene Keimzellen."))}
        </p>
      </div>
    </div>
  );
}
