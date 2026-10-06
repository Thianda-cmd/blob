"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pickaxe, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { DIG_LAYERS, FOSSILS, type FossilId } from "@/learn/biology/topics/evolution/data";
import { cn } from "@/lib/utils";

// Rock layers with fossils: a widget where you dig down layer by layer (deeper = older), and a
// labelled rock column for tasks ("Which fossil is the oldest?").

const OUT = "var(--bio-outline)";
const BONE = "var(--bio-bone)";
const sans = { fontFamily: "var(--font-sans)" };

/** A line drawn as a bone: an outline stroke with a lighter stroke on top. */
function Bone({ d, w = 3 }: { d: string; w?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={OUT} strokeWidth={w + 2.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={BONE} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Points of a spiral for the ammonite. */
function spiral(turns: number, r0: number, r1: number) {
  const pts: string[] = [];
  const n = turns * 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = r0 + ((r1 - r0) * i) / n;
    pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

/** Fossil drawings, centred on (0, 0), about 70 × 44 units. */
export const FOSSIL_ART: Record<FossilId, () => ReactNode> = {
  tusk: () => (
    <g>
      <path d="M-32 12 Q-14 -20 22 -16 Q31 -15 33 -9 Q12 -11 -1 1 Q-13 13 -27 19 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-19 4 Q-15 8 -12 12 M-6 -6 Q-2 -1 0 3 M8 -12 Q11 -8 12 -5" fill="none" stroke={OUT} strokeWidth={1} opacity={0.6} />
    </g>
  ),
  horse: () => (
    <g>
      <Bone d="M-26 -4 Q-30 2 -33 9" w={2} />
      <Bone d="M-25 -5 Q-2 -13 17 -7" />
      {[-15, -10, -5, 0, 5].map((x) => (
        <Bone key={x} d={`M${x} -9 Q${x + 2} -1 ${x - 1} 4`} w={1.6} />
      ))}
      <Bone d="M-21 -5 L-24 6 L-22 17" w={2.2} />
      <Bone d="M-16 -5 L-14 7 L-17 17" w={2.2} />
      <Bone d="M10 -8 L8 5 L10 17" w={2.2} />
      <Bone d="M14 -8 L18 5 L16 17" w={2.2} />
      <path d="M16 -10 Q22 -16 33 -9 L34 -4 Q26 -3 19 -3 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={24} cy={-9} r={1.6} fill={OUT} />
    </g>
  ),
  archaeopteryx: () => (
    <g>
      {/* feather impressions of wings and tail */}
      {[-50, -35, -20, -5, 10].map((a, i) => (
        <path key={`w${i}`} d={`M-4 -6 l${(Math.cos((a * Math.PI) / 180) * 30).toFixed(1)} ${(Math.sin((a * Math.PI) / 180) * 30 - 6).toFixed(1)}`} stroke={OUT} strokeWidth={1} opacity={0.55} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={`t${i}`} d={`M${-8 - i * 4} ${6 + i * 1.6} l-5 ${i % 2 ? 7 : -7}`} stroke={OUT} strokeWidth={1} opacity={0.55} />
      ))}
      <Bone d="M-6 4 Q-20 12 -32 12" w={2} />
      <Bone d="M-4 -6 Q8 -16 22 -10" w={2.2} />
      <Bone d="M2 0 Q8 -14 2 -24 Q-2 -28 -8 -24" w={2} />
      <ellipse cx={-1} cy={1} rx={8} ry={6} fill={BONE} stroke={OUT} strokeWidth={1.6} />
      <path d="M-8 -24 L-16 -22 L-9 -20 Z" fill={BONE} stroke={OUT} strokeWidth={1.2} strokeLinejoin="round" />
      <Bone d="M2 6 L6 15 L12 18" w={1.8} />
      <Bone d="M-3 6 L-4 16 L1 20" w={1.8} />
    </g>
  ),
  footprint: () => (
    <g fill="color-mix(in oklab, var(--bio-outline) 22%, transparent)" stroke={OUT} strokeWidth={1.5}>
      <ellipse cx={0} cy={10} rx={8} ry={7} />
      <path d="M-3 4 Q-16 -6 -20 -18 Q-18 -20 -15 -18 Q-8 -8 0 2 Z" strokeLinejoin="round" />
      <path d="M-2 3 Q-1 -12 0 -22 Q3 -24 4 -21 Q4 -10 3 3 Z" strokeLinejoin="round" />
      <path d="M3 4 Q14 -6 20 -16 Q23 -16 22 -13 Q16 -2 5 7 Z" strokeLinejoin="round" />
    </g>
  ),
  ammonite: () => (
    <g>
      <circle r={20} fill={BONE} stroke={OUT} strokeWidth={1.6} />
      <path d={spiral(2.6, 2, 18)} fill="none" stroke={OUT} strokeWidth={1.4} />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return <line key={i} x1={Math.cos(a) * 13} y1={Math.sin(a) * 13} x2={Math.cos(a) * 19.5} y2={Math.sin(a) * 19.5} stroke={OUT} strokeWidth={0.9} opacity={0.6} />;
      })}
    </g>
  ),
  fern: () => (
    <g>
      <path d="M-30 16 Q0 4 30 -16" fill="none" stroke={OUT} strokeWidth={2} strokeLinecap="round" />
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 1) / 10;
        const x = -30 + 60 * t;
        const y = 16 - 12 * t - 20 * t * t + 8 * t;
        const s = 1 - t * 0.6;
        return (
          <g key={i}>
            <ellipse cx={x - 3} cy={y - 8 * s} rx={3.2 * s} ry={8 * s} transform={`rotate(-30 ${x - 3} ${y - 8 * s})`} fill="color-mix(in oklab, var(--bio-leaf) 45%, var(--bio-bone))" stroke={OUT} strokeWidth={1.1} />
            <ellipse cx={x + 3} cy={y + 7 * s} rx={3.2 * s} ry={8 * s} transform={`rotate(-30 ${x + 3} ${y + 7 * s})`} fill="color-mix(in oklab, var(--bio-leaf) 45%, var(--bio-bone))" stroke={OUT} strokeWidth={1.1} />
          </g>
        );
      })}
    </g>
  ),
  fish: () => (
    <g>
      <path d="M-26 0 Q-8 -16 16 -9 Q24 -6 30 0 Q24 6 16 9 Q-8 16 -26 0 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-26 0 L-36 -10 L-33 0 L-36 10 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M8 -11 Q14 -12 22 -6 Q26 -3 30 0 Q24 6 16 9 Q12 10 8 11 Q6 0 8 -11 Z" fill="color-mix(in oklab, var(--bio-outline) 22%, var(--bio-bone))" stroke={OUT} strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M15 -9 L15 9 M21 -6 L21 6" stroke={OUT} strokeWidth={1} />
      <circle cx={24} cy={-2} r={1.8} fill={OUT} />
      <path d="M-18 0 L6 0 M-12 -6 L-10 6 M-4 -8 L-2 8 M2 -9 L4 9" stroke={OUT} strokeWidth={1} opacity={0.6} />
    </g>
  ),
  trilobite: () => (
    <g>
      <path d="M-18 -8 Q0 -30 18 -8 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-15 -8 L15 -8 L11 16 Q0 24 -11 16 Z" fill={BONE} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      {[-3, 2, 7, 12].map((y) => (
        <line key={y} x1={-14 + (y + 8) * 0.17} x2={14 - (y + 8) * 0.17} y1={y} y2={y} stroke={OUT} strokeWidth={1} />
      ))}
      <path d="M-5 -20 Q-6 0 -4 19 M5 -20 Q6 0 4 19" fill="none" stroke={OUT} strokeWidth={1.2} />
      <circle cx={-9} cy={-12} r={1.8} fill={OUT} />
      <circle cx={9} cy={-12} r={1.8} fill={OUT} />
    </g>
  ),
  stromatolite: () => (
    <g fill="none" stroke={OUT} strokeWidth={1.4}>
      <path d="M-30 16 Q-18 -16 -4 16" fill="color-mix(in oklab, var(--bio-leaf) 30%, var(--bio-bone))" />
      <path d="M-26 16 Q-18 -6 -9 16" />
      <path d="M0 16 Q14 -22 30 16" fill="color-mix(in oklab, var(--bio-leaf) 30%, var(--bio-bone))" />
      <path d="M5 16 Q14 -10 25 16" />
      <path d="M10 16 Q14 0 20 16" />
    </g>
  ),
};

/** Layer colours from the top down: sand, clay, limestone, marl, coal shale, red sandstone, slate. */
const LAYER_FILL = [
  "color-mix(in oklab, var(--bio-sun) 30%, var(--bio-bone))",
  "color-mix(in oklab, var(--bio-soil) 55%, var(--bio-bone))",
  "color-mix(in oklab, var(--bio-bone) 82%, var(--bio-wall))",
  "color-mix(in oklab, var(--bio-wood) 55%, var(--bio-bone))",
  "color-mix(in oklab, var(--bio-soil) 70%, var(--bio-wood-deep))",
  "color-mix(in oklab, var(--bio-mito) 50%, var(--bio-bone))",
  "color-mix(in oklab, var(--bio-soil) 55%, var(--bio-nucleus))",
  "color-mix(in oklab, var(--bio-wall) 35%, var(--bio-soil))",
];

/** A wavy boundary between layers (deterministic per index). */
function wave(y: number, i: number, x0: number, x1: number) {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 16) pts.push(`${x} ${(y + Math.sin(x / 37 + i * 1.7) * 3.2 + Math.sin(x / 13 + i) * 1.2).toFixed(1)}`);
  return pts;
}

function layerPath(top: number, bottom: number, i: number, x0: number, x1: number) {
  const t = i === 0 ? [`${x0} ${top}`, `${x1} ${top}`] : wave(top, i, x0, x1);
  const b = wave(bottom, i + 1, x0, x1).reverse();
  return `M${t.join(" L")} L${b.join(" L")} Z`;
}

/** Fossil positions in a layer, so neighbouring layers don't line up. */
const SPOTS = [96, 232, 150, 268, 112, 214, 170, 250, 130];

// ---------------------------------------------------------------------------
// Widget: dig down layer by layer

const W = 480;
const X0 = 14;
const X1 = 352;
const TOP = 34;
const LH = 52;

export function EvolutionDig() {
  const t = useText();
  const reduce = useReducedMotion();
  const [dug, setDug] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const n = DIG_LAYERS.length;
  const H = TOP + n * LH + 12;
  const shown = focus ?? (dug > 0 ? dug - 1 : null);
  const fossil = shown !== null ? FOSSILS[DIG_LAYERS[shown]] : null;
  const done = dug >= n;

  const dig = () => {
    if (done) return;
    setDug(dug + 1);
    setFocus(null);
  };
  const reset = () => {
    setDug(0);
    setFocus(null);
  };
  const markerY = TOP + Math.max(0, dug - 1) * LH + LH / 2;

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Rock layers with fossils", "Gesteinsschichten mit Fossilien"))}>
          {/* grass and soil on top */}
          <rect x={X0} y={TOP - 22} width={X1 - X0} height={22} rx={4} fill="var(--bio-soil)" stroke={OUT} strokeWidth={1.5} />
          <path d={`M${X0} ${TOP - 20} ${Array.from({ length: 22 }, (_, i) => `L${X0 + 4 + i * 15.4} ${TOP - 28 - (i % 3) * 3} L${X0 + 11 + i * 15.4} ${TOP - 20}`).join(" ")}`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} strokeLinejoin="round" />
          {DIG_LAYERS.map((id, i) => {
            const top = TOP + i * LH;
            const open = i < dug;
            const x = SPOTS[i];
            const y = top + LH / 2 + 2;
            const lit = shown === i;
            return (
              <g key={id} onClick={open ? () => setFocus(i) : undefined} className={cn(open && "cursor-pointer")}>
                <path d={layerPath(top, top + LH, i, X0, X1)} fill={LAYER_FILL[i]} stroke={OUT} strokeWidth={1.4} strokeLinejoin="round" />
                {/* a few pebbles for texture */}
                {[0, 1, 2].map((k) => (
                  <ellipse key={k} cx={X0 + 40 + ((i * 97 + k * 113) % (X1 - X0 - 80))} cy={top + 12 + ((i * 7 + k * 17) % (LH - 22))} rx={3 + (k % 2)} ry={2} fill="color-mix(in oklab, var(--bio-outline) 18%, transparent)" />
                ))}
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.g
                      key="f"
                      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    >
                      <g transform={`translate(${x} ${y})`} style={lit ? { filter: "drop-shadow(0 0 3px var(--blob))" } : undefined}>
                        {FOSSIL_ART[id]()}
                      </g>
                    </motion.g>
                  ) : (
                    <motion.g key="h" exit={{ opacity: 0 }}>
                      <ellipse cx={x} cy={y} rx={26} ry={15} fill="color-mix(in oklab, var(--surface) 35%, transparent)" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 3" />
                      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill="var(--ink-3)" style={sans}>
                        ?
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>
                {open && (
                  <motion.g initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}>
                    <text x={X1 + 12} y={top + LH / 2} dominantBaseline="central" fontSize={14} fill={lit ? "var(--blob)" : "var(--ink-2)"} fontWeight={lit ? 700 : 500} style={sans}>
                      {t(FOSSILS[id].age < 1 ? tx("20,000 y.", "20.000 J.") : tx(`${FOSSILS[id].age} mill. y.`, `${FOSSILS[id].age} Mio. J.`))}
                    </text>
                  </motion.g>
                )}
              </g>
            );
          })}
          {/* "deeper = older" arrow on the right */}
          <text x={X1 + 12} y={TOP - 14} fontSize={14} fontWeight={600} fill="var(--ink-2)" style={sans}>
            {t(tx("today", "heute"))}
          </text>
          {/* the digger's trowel */}
          {dug > 0 && (
            <motion.g initial={false} animate={{ y: markerY }} transition={{ type: "spring", stiffness: 170, damping: 20 }}>
              <g transform={`translate(${X0 + 22} 0) rotate(-35)`}>
                <rect x={-2.5} y={-22} width={5} height={14} rx={2} fill="var(--bio-wood)" stroke={OUT} strokeWidth={1.2} />
                <path d="M-7 -8 L7 -8 L0 10 Z" fill="var(--blob)" stroke={OUT} strokeWidth={1.2} strokeLinejoin="round" />
              </g>
            </motion.g>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={dig}
          disabled={done}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14.5px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          <Pickaxe className="size-4" />
          {t(dug === 0 ? tx("Start digging", "Losgraben") : tx("Dig deeper", "Tiefer graben"))}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={dug === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          {t(tx("Fill in again", "Zuschütten"))}
        </button>
        <span className="ml-auto text-[13px] text-ink-3 tabular-nums">
          {t(tx(`Layer ${dug} of ${n}`, `Schicht ${dug} von ${n}`))}
        </span>
      </div>

      <motion.div
        key={shown ?? "none"}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[5.5rem] rounded-xl border border-line bg-surface px-4 py-3 text-[14.5px] leading-relaxed"
        aria-live="polite"
      >
        {fossil && shown !== null ? (
          <>
            <div className="text-[12.5px] font-semibold uppercase tracking-wide text-blob-ink">
              {t(tx(`Layer ${shown + 1}`, `Schicht ${shown + 1}`))} · {t(fossil.ageText)}
            </div>
            <div className="mt-0.5 font-semibold text-ink">{t(fossil.name)}</div>
            <div className="text-ink-2">{t(fossil.info)}</div>
          </>
        ) : (
          <span className="text-ink-3">{t(tx("Dig down layer by layer and see what you find.", "Grab Schicht für Schicht nach unten und schau, was du findest."))}</span>
        )}
      </motion.div>
      {done && (
        <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-blob-soft px-4 py-3 text-[14.5px] leading-relaxed text-ink">
          {t(
            tx(
              "You reached the bottom! Layers settle one on top of the other, so the deeper a layer lies, the older it is (as long as the layers were not disturbed). And the older the layer, the less its fossils resemble living things of today.",
              "Du bist unten angekommen! Schichten lagern sich übereinander ab: Je tiefer eine Schicht liegt, desto älter ist sie (solange die Schichten ungestört sind). Und je älter die Schicht, desto weniger ähneln ihre Fossilien den heutigen Lebewesen.",
            ),
          )}
        </motion.p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task picture: a rock column with numbered fossils

/**
 * A column of rock layers, `fossils` from the top layer to the bottom one. `numbering` sets the
 * order of the marker numbers (default: top to bottom).
 */
export function EvolutionRockColumn({ fossils, numbering, mode = "names", ask, highlight, legend }: DrawingProps & { fossils: FossilId[]; numbering?: FossilId[] }) {
  const n = fossils.length;
  const lh = 62;
  const top = 26;
  const x0 = 10;
  const x1 = 330;
  const H = top + n * lh + 10;
  const spotOf = (i: number) => [110 + ((i * 83) % 120), top + i * lh + lh / 2 + 2] as [number, number];
  const parts: FigurePart[] = (numbering ?? fossils).map((id) => {
    const i = fossils.indexOf(id);
    const [x, y] = spotOf(i);
    return { id, label: FOSSILS[id].name, at: [x + 44, y - 12] };
  });
  return (
    <Figure title={tx("Rock layers with fossils", "Gesteinsschichten mit Fossilien")} width={x1 + 14} height={H} parts={parts} mode={mode} ask={ask} highlight={highlight} legend={legend}>
      <rect x={x0} y={top - 16} width={x1 - x0} height={16} rx={4} fill="var(--bio-soil)" stroke={OUT} strokeWidth={1.4} />
      <path d={`M${x0} ${top - 14} ${Array.from({ length: 21 }, (_, i) => `L${x0 + 4 + i * 15.2} ${top - 21 - (i % 3) * 2} L${x0 + 10 + i * 15.2} ${top - 14}`).join(" ")}`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} strokeLinejoin="round" />
      {fossils.map((id, i) => {
        const [x, y] = spotOf(i);
        return (
          <g key={id}>
            <path d={layerPath(top + i * lh, top + (i + 1) * lh, i, x0, x1)} fill={LAYER_FILL[(i * 3 + 1) % LAYER_FILL.length]} stroke={OUT} strokeWidth={1.4} strokeLinejoin="round" />
            <g data-part={id}>
              <g transform={`translate(${x} ${y}) scale(1.1)`}>{FOSSIL_ART[id]()}</g>
            </g>
          </g>
        );
      })}
    </Figure>
  );
}
