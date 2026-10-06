"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

// Allopatric speciation on islands (Darwin's finches): founders reach an island, the sea
// isolates the populations, different food selects different beaks, and in the end the birds
// no longer interbreed.

export type BeakType = "ground" | "seed" | "insect" | "cactus";

const OUT = "var(--bio-outline)";
const BEAK: Record<BeakType, { base: number; len: number; curve: number }> = {
  ground: { base: 6, len: 6.5, curve: 0.5 },
  seed: { base: 9, len: 7.5, curve: 1.6 },
  insect: { base: 3.2, len: 8.5, curve: 0 },
  cactus: { base: 4.2, len: 11, curve: 0.8 },
};

/** The beak as a path in the bird's own coordinates (head at (7, -5)). */
export const beakPath = (b: BeakType) => {
  const { base, len, curve } = BEAK[b];
  const x = 11.5;
  const y = -5;
  return `M${x} ${y - base / 2} Q${x + len * 0.6} ${y - base / 2 + curve * 0.4 - 0.5} ${x + len} ${y + curve * 0.6} Q${x + len * 0.5} ${y + base / 2 + 0.3} ${x} ${y + base / 2} Z`;
};

/** A finch sitting, facing right, centred on (0, 0). */
export function Finch({ beak, color, s = 1 }: { beak: BeakType; color: string; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-9 1 L-17 6 L-15 0 Z" fill={color} stroke={OUT} strokeWidth={1.1} strokeLinejoin="round" />
      <ellipse cx={-1} cy={1.5} rx={10} ry={7} fill={color} stroke={OUT} strokeWidth={1.3} />
      <path d="M-6 0 Q-1 -3 4 0" fill="none" stroke={OUT} strokeWidth={0.9} opacity={0.6} />
      <circle cx={7} cy={-5} r={5.6} fill={color} stroke={OUT} strokeWidth={1.3} />
      <motion.path initial={false} animate={{ d: beakPath(beak) }} transition={{ duration: 0.8 }} fill="color-mix(in oklab, var(--bio-outline) 75%, var(--bio-wood))" stroke={OUT} strokeWidth={0.9} strokeLinejoin="round" />
      <circle cx={8.4} cy={-6.2} r={1.2} fill={OUT} />
      <path d="M-2 8 L-3 11 M2 8 L2 11" stroke={OUT} strokeWidth={1.1} strokeLinecap="round" />
    </g>
  );
}

type Isle = "main" | "A" | "B" | "C";
const COLOR: Record<Isle, string> = {
  main: "var(--bio-wood)",
  A: "var(--bio-mito)",
  B: "var(--bio-leaf)",
  C: "color-mix(in oklab, var(--bio-soil) 70%, var(--bio-nucleus))",
};

type Bird = { id: string; x: number; y: number; beak: BeakType; isle: Isle; from?: [number, number] };

const MAIN: [number, number][] = [
  [34, 70],
  [70, 98],
  [40, 132],
  [76, 160],
  [36, 196],
  [72, 226],
  [44, 258],
];
const AT_A: [number, number][] = [
  [254, 96],
  [290, 80],
  [324, 92],
  [272, 120],
  [312, 124],
];
const AT_B: [number, number][] = [
  [446, 66],
  [486, 74],
  [468, 92],
];
const AT_C: [number, number][] = [
  [402, 222],
  [440, 210],
  [474, 228],
];

function birds(stage: number): Bird[] {
  const out: Bird[] = MAIN.map(([x, y], i) => ({ id: `m${i}`, x, y, beak: "ground", isle: "main" }));
  if (stage >= 1) {
    const n = stage === 1 ? 3 : 5;
    AT_A.slice(0, n).forEach(([x, y], i) => out.push({ id: `a${i}`, x, y, beak: stage >= 3 ? "seed" : "ground", isle: stage >= 3 ? "A" : "main", from: i < 3 ? MAIN[i * 2 + 1] : undefined }));
  }
  if (stage >= 2) {
    const n = stage === 2 ? 2 : 3;
    AT_B.slice(0, n).forEach(([x, y], i) => out.push({ id: `b${i}`, x, y, beak: stage >= 3 ? "insect" : "ground", isle: stage >= 3 ? "B" : "main", from: i < 2 ? AT_A[1] : undefined }));
    AT_C.slice(0, n).forEach(([x, y], i) => out.push({ id: `c${i}`, x, y, beak: stage >= 3 ? "cactus" : "ground", isle: stage >= 3 ? "C" : "main", from: i < 2 ? AT_A[3] : undefined }));
  }
  if (stage >= 4) {
    // one insect eater from island B visits island A
    const b = out.find((x) => x.id === "b2")!;
    b.x = 380;
    b.y = 62;
  }
  return out;
}

const STAGES: { title: Text; text: Text }[] = [
  {
    title: tx("One species on the mainland", "Eine Art auf dem Festland"),
    text: tx(
      "A population of ground finches lives on the mainland of South America. They all belong to one species: they mate with each other and their young are fertile.",
      "Auf dem Festland Südamerikas lebt eine Population von Grundfinken. Alle gehören zu einer Art: Sie paaren sich miteinander, und ihre Jungen sind fruchtbar.",
    ),
  },
  {
    title: tx("A storm: founders", "Ein Sturm: Gründer"),
    text: tx(
      "A storm blows a few finches to a far island. These founders carry only a small, random part of the gene pool (founder effect, a kind of genetic drift).",
      "Ein Sturm verweht einige Finken auf eine ferne Insel. Diese Gründer tragen nur einen kleinen, zufälligen Teil des Genpools (Gründereffekt, eine Form der Gendrift).",
    ),
  },
  {
    title: tx("Geographic isolation", "Geografische Isolation"),
    text: tx(
      "The population grows and a few birds reach other islands. The sea separates the populations: there is hardly any gene flow between them any more.",
      "Die Population wächst, einzelne Vögel erreichen weitere Inseln. Das Meer trennt die Populationen: Zwischen ihnen gibt es kaum noch Genfluss.",
    ),
  },
  {
    title: tx("Different islands, different beaks", "Andere Inseln, andere Schnäbel"),
    text: tx(
      "Mutation and recombination create new variants on each island. Each island offers different food: hard seeds, insects, cactus flowers. Selection favours the beak that suits the food, so the gene pools drift apart.",
      "Mutation und Rekombination schaffen auf jeder Insel neue Varianten. Jede Insel bietet anderes Futter: harte Samen, Insekten, Kaktusblüten. Die Selektion begünstigt den passenden Schnabel, und die Genpools entwickeln sich auseinander.",
    ),
  },
  {
    title: tx("New species", "Neue Arten"),
    text: tx(
      "When a bird from island B reaches island A, it no longer mates with the finches there: song, courtship and beak no longer match. Reproductive isolation: separate species have arisen (allopatric speciation).",
      "Wenn ein Vogel von Insel B auf Insel A gelangt, paart er sich nicht mehr mit den Finken dort: Gesang, Balz und Schnabel passen nicht mehr. Fortpflanzungsbarriere: Es sind getrennte Arten entstanden (allopatrische Artbildung).",
    ),
  },
];

function Food({ stage }: { stage: number }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {stage >= 3 && (
        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* hard seeds on island A */}
          {[
            [250, 124],
            [264, 130],
            [342, 118],
            [334, 128],
            [300, 132],
          ].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={4.2} ry={3} transform={`rotate(${i * 40} ${x} ${y})`} fill="var(--bio-wood-deep)" stroke={OUT} strokeWidth={0.8} />
          ))}
          {/* insects on island B */}
          {[
            [430, 86],
            [500, 92],
            [458, 50],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-4 -2 L-7 -4 M-4 2 L-7 4 M0 -3 L0 -6 M0 3 L0 6 M4 -2 L7 -4 M4 2 L7 4" stroke={OUT} strokeWidth={0.9} />
              <ellipse rx={5} ry={3.2} fill="var(--bio-leaf-deep)" stroke={OUT} strokeWidth={0.8} />
            </g>
          ))}
          {/* cactus with flowers on island C */}
          {[
            [420, 236],
            [458, 244],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M0 0 L0 -22 M0 -12 Q-8 -12 -8 -18 M0 -8 Q7 -8 7 -16" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={5} strokeLinecap="round" />
              <circle cx={0} cy={-24} r={3.4} fill="var(--bio-sun)" stroke={OUT} strokeWidth={0.8} />
              <circle cx={7} cy={-18} r={2.8} fill="var(--bio-sun)" stroke={OUT} strokeWidth={0.8} />
            </g>
          ))}
        </motion.g>
      )}
    </AnimatePresence>
  );
}

export function EvolutionIslands() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const last = STAGES.length - 1;
  const list = birds(stage);
  const island = (cx: number, cy: number, rx: number, ry: number, k: number) => (
    <g>
      <ellipse cx={cx} cy={cy + 3} rx={rx + 6} ry={ry + 5} fill="color-mix(in oklab, var(--bio-water) 30%, var(--surface))" />
      <path
        d={`M${cx - rx} ${cy} Q${cx - rx + 4} ${cy - ry} ${cx - rx * 0.2} ${cy - ry + 2} Q${cx + rx * 0.5} ${cy - ry - 4} ${cx + rx} ${cy - ry * 0.2} Q${cx + rx + 3} ${cy + ry * 0.8} ${cx + rx * 0.2} ${cy + ry} Q${cx - rx * 0.6} ${cy + ry + 2} ${cx - rx} ${cy} Z`}
        fill="color-mix(in oklab, var(--bio-sun) 35%, var(--bio-bone))"
        stroke={OUT}
        strokeWidth={1.5}
      />
      <ellipse cx={cx + (k % 2 ? -rx * 0.3 : rx * 0.25)} cy={cy - ry * 0.2} rx={rx * 0.38} ry={ry * 0.4} fill="color-mix(in oklab, var(--bio-leaf) 60%, transparent)" />
    </g>
  );

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 560 300" className="mx-auto block h-auto w-full max-w-[680px] overflow-hidden rounded-2xl" role="img" aria-label={t(STAGES[stage].title)}>
        <rect width={560} height={300} fill="color-mix(in oklab, var(--bio-water) 22%, var(--surface))" />
        {[40, 120, 200, 270].map((y, i) => (
          <path key={i} d={`M${130 + i * 30} ${y} q12 -5 24 0 q12 5 24 0`} fill="none" stroke="color-mix(in oklab, var(--bio-water-deep) 35%, transparent)" strokeWidth={1.4} />
        ))}
        {/* mainland */}
        <path d="M0 0 L96 0 Q112 40 100 80 Q90 120 108 160 Q122 210 100 250 Q92 280 104 300 L0 300 Z" fill="color-mix(in oklab, var(--bio-leaf) 55%, var(--bio-soil))" stroke={OUT} strokeWidth={1.6} />
        {island(296, 104, 74, 40, 0)}
        {island(468, 76, 58, 34, 1)}
        {island(440, 226, 70, 40, 2)}
        {[
          [296, 158, "A"],
          [468, 128, "B"],
          [440, 284, "C"],
        ].map(([x, y, l]) => (
          <text key={l as string} x={x as number} y={y as number} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {l}
          </text>
        ))}
        {/* storm */}
        <AnimatePresence>
          {stage === 1 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[60, 90, 120].map((y, i) => (
                <path key={i} d={`M${120 + i * 6} ${y + 10} Q${170} ${y - 20} ${230 - i * 4} ${y + 4}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.8} strokeDasharray="6 5" strokeLinecap="round" />
              ))}
              <path d="M222 70 L232 74 L224 81" fill="none" stroke="var(--ink-3)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
          )}
          {stage === 2 && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <path d="M340 86 Q390 50 430 64" fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="5 5" />
              <path d="M320 126 Q360 180 396 206" fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="5 5" />
            </motion.g>
          )}
        </AnimatePresence>
        <Food stage={stage} />
        {/* the visiting bird and the barrier between the species */}
        <AnimatePresence>
          {stage === 4 && (
            <motion.g initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: reduce ? 0 : 0.9 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <circle cx={358} cy={60} r={9.5} fill="var(--raised)" stroke="var(--danger)" strokeWidth={1.8} />
              <path d="M353 62 L363 62 M353 58 L363 58 M360 53 L356 67" stroke="var(--danger)" strokeWidth={1.8} strokeLinecap="round" />
            </motion.g>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {list.map((b) => (
            <motion.g
              key={b.id}
              initial={reduce ? false : b.from ? { x: b.from[0], y: b.from[1], opacity: 1 } : { x: b.x, y: b.y, opacity: 0, scale: 0.4 }}
              animate={{ x: b.x, y: b.y, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 40, damping: 12 }}
            >
              <Finch beak={b.beak} color={COLOR[b.isle]} s={1.25} />
            </motion.g>
          ))}
        </AnimatePresence>
      </svg>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStage(Math.max(0, stage - 1))}
          disabled={stage === 0}
          aria-label={t(tx("Previous step", "Vorheriger Schritt"))}
          className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-hover disabled:opacity-40"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label={t(tx("Steps", "Schritte"))}>
          {STAGES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={stage === i}
              onClick={() => setStage(i)}
              className={cn("relative h-10 flex-1 rounded-xl border text-[14px] font-semibold tabular-nums transition-colors", stage === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
            >
              {stage === i && <motion.span layoutId={`${scope}-st`} className="absolute inset-0 rounded-xl bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
              <span className="relative">{i + 1}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStage(Math.min(last, stage + 1))}
          disabled={stage === last}
          aria-label={t(tx("Next step", "Nächster Schritt"))}
          className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-hover disabled:opacity-40"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <motion.div key={stage} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-blob-ink">
          {stage + 1}. {t(STAGES[stage].title)}
        </div>
        <p className="mt-0.5 text-[14.5px] leading-relaxed text-ink-2">{t(STAGES[stage].text)}</p>
      </motion.div>
    </div>
  );
}
