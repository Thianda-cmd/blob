"use client";

// Paper chromatography for the "mixtures" topic: a felt-tip dot on a paper strip, the solvent
// creeps up, and the dyes in the ink separate because they stick differently to the paper.

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

type Dye = { color: string; rf: number; name: Text };

const YELLOW: Dye = { color: "var(--subject-sand)", rf: 0.86, name: tx("yellow", "gelb") };
const PINK: Dye = { color: "var(--subject-rose)", rf: 0.58, name: tx("pink", "rosa") };
const BLUE: Dye = { color: "var(--subject-sky)", rf: 0.3, name: tx("blue", "blau") };
const RED: Dye = { color: "var(--subject-clay)", rf: 0.5, name: tx("red", "rot") };

const PENS: { id: string; name: Text; ink: string; dyes: Dye[] }[] = [
  { id: "black", name: tx("Black", "Schwarz"), ink: "var(--ink)", dyes: [YELLOW, PINK, BLUE] },
  { id: "green", name: tx("Green", "Grün"), ink: "var(--subject-moss)", dyes: [YELLOW, BLUE] },
  { id: "red", name: tx("Red", "Rot"), ink: "var(--subject-clay)", dyes: [RED] },
];

const W = 220;
const H = 250;
const START = 196; // start line
const TOP = 30; // highest the solvent gets
const LIQ = 214; // solvent level in the beaker

export function MixturesChroma() {
  const t = useText();
  const reduce = useReducedMotion();
  const [pid, setPid] = useState("black");
  const [p, setP] = useState(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const pen = PENS.find((x) => x.id === pid)!;
  const front = START - (START - TOP) * p;

  const runIt = () => {
    ctrl.current?.stop();
    if (reduce) {
      setP(1);
      return;
    }
    ctrl.current = animate(p >= 1 ? 0 : p, 1, { duration: 5 * (1 - (p >= 1 ? 0 : p)), ease: "easeOut", onUpdate: setP });
  };
  const reset = () => {
    ctrl.current?.stop();
    setP(0);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[220px]" role="img" aria-label={t(tx("Paper chromatography of a felt-tip pen", "Papierchromatografie eines Filzstifts"))}>
        {/* beaker with solvent */}
        <rect x={40} y={LIQ} width={140} height={H - LIQ - 8} fill="color-mix(in oklab, var(--subject-sky) 22%, transparent)" />
        <path d={`M34 120 L34 ${H - 12} Q34 ${H - 6} 40 ${H - 6} L180 ${H - 6} Q186 ${H - 6} 186 ${H - 12} L186 120`} fill="none" stroke="var(--ink-2)" strokeWidth={2.2} />
        {/* paper strip */}
        <rect x={80} y={14} width={60} height={H - 22} rx={2} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.2} />
        <rect x={80} y={front} width={60} height={Math.max(0, H - 8 - front)} fill="color-mix(in oklab, var(--subject-sky) 13%, transparent)" />
        {p > 0.02 && <line x1={80} x2={140} y1={front} y2={front} stroke="var(--subject-sky)" strokeWidth={1.2} strokeDasharray="3 3" />}
        <line x1={84} x2={136} y1={START} y2={START} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 3" />
        {/* clip on top */}
        <rect x={70} y={8} width={80} height={10} rx={3} fill="var(--ink-3)" />
        {/* dyes */}
        {pen.dyes.map((d, i) => {
          const y = START - (START - TOP) * p * d.rf;
          const spread = 1 + p * 0.9;
          return <ellipse key={i} cx={110} cy={y} rx={7 + p * 3} ry={5 * spread} fill={p < 0.06 ? pen.ink : d.color} opacity={p < 0.06 ? 1 : 0.85} />;
        })}
        <text x={146} y={START + 4} fontSize={10.5} className="fill-ink-3">
          {t(tx("start", "Start"))}
        </text>
        {p > 0.1 && (
          <text x={146} y={front + 4} fontSize={10.5} className="fill-ink-3">
            {t(tx("front", "Front"))}
          </text>
        )}
      </svg>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PENS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                reset();
                setPid(x.id);
              }}
              className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors", pid === x.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              <span className="size-3 rounded-full border border-white/60" style={{ background: x.ink }} />
              {t(x.name)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={runIt} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]">
            <Play className="size-4" /> {t(tx("Let the solvent rise", "Laufmittel aufsteigen lassen"))}
          </button>
          <button type="button" onClick={reset} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-4" /> {t(tx("Again", "Neu"))}
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={p >= 0.98 ? `end-${pid}` : "run"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
            {p < 0.98
              ? t(tx("A dot of ink sits on the start line. The water (the solvent) creeps up the paper and takes the dyes along.", "Ein Tintenpunkt sitzt auf der Startlinie. Das Wasser (das Laufmittel) steigt im Papier auf und nimmt die Farbstoffe mit."))
              : pen.dyes.length > 1
                ? t(
                    tx(
                      `The ink was a mixture of ${pen.dyes.length} dyes! Dyes that stick less to the paper and dissolve well travel further.`,
                      `Die Tinte war ein Gemisch aus ${pen.dyes.length} Farbstoffen! Farbstoffe, die schwächer am Papier haften und sich gut lösen, wandern weiter.`,
                    ),
                  )
                : t(tx("Only one spot: this ink contains just one dye.", "Nur ein Fleck: Diese Tinte enthält nur einen Farbstoff."))}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

const STRIP_COLORS = ["var(--subject-sand)", "var(--subject-rose)", "var(--subject-sky)", "var(--subject-moss)", "var(--subject-clay)", "var(--subject-plum)"];

/** A finished chromatogram for tasks: `n` spots at different heights. */
export function ChromaStrip({ n, seed }: { n: number; seed: number }) {
  const t = useText();
  const top = 26;
  const start = 150;
  // Spread the spots evenly with a little seeded wobble, so they never touch.
  const rf = Array.from({ length: n }, (_, i) => 0.18 + ((i + 0.5) / n) * 0.72 + (((seed * (i + 3)) % 7) - 3) * 0.008);
  const colors = Array.from({ length: n }, (_, i) => STRIP_COLORS[(seed + i * 2) % STRIP_COLORS.length]);
  return (
    <svg viewBox="0 0 160 176" className="mx-auto block h-auto w-full max-w-[200px]" role="img" aria-label={t(tx("Chromatogram", "Chromatogramm"))}>
      <rect x={50} y={8} width={60} height={160} rx={2} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.2} />
      <rect x={50} y={top} width={60} height={168 - top} fill="color-mix(in oklab, var(--subject-sky) 10%, transparent)" />
      <line x1={50} x2={110} y1={top} y2={top} stroke="var(--subject-sky)" strokeWidth={1.2} strokeDasharray="3 3" />
      <line x1={54} x2={106} y1={start} y2={start} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 3" />
      {rf.map((f, i) => (
        <ellipse key={i} cx={80} cy={start - (start - top) * f} rx={9} ry={6.5} fill={colors[i]} opacity={0.9} />
      ))}
      <text x={114} y={top + 4} fontSize={10} className="fill-ink-3">
        {t(tx("front", "Front"))}
      </text>
      <text x={114} y={start + 4} fontSize={10} className="fill-ink-3">
        {t(tx("start", "Start"))}
      </text>
    </svg>
  );
}
