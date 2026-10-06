"use client";

import { motion, useReducedMotion } from "motion/react";
import { Dices } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { createRng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";

// Genetic drift and selection: six populations start with p(A) = 0.5. Each generation the
// alleles of the next generation are drawn at random from the gene pool (Wright-Fisher model),
// after selection has favoured A by the factor 1 + s. Small populations drift, large ones don't.

const GENS = 80;
const LINES = 6;
const SIZES = [10, 50, 250, 1000];
const SEL: { s: number; label: Text }[] = [
  { s: 0, label: tx("no selection", "keine Selektion") },
  { s: 0.05, label: tx("A slightly favoured", "A leicht im Vorteil") },
  { s: 0.15, label: tx("A strongly favoured", "A stark im Vorteil") },
];
const COLORS = ["var(--bio-nucleus-deep)", "var(--bio-mito-deep)", "var(--bio-leaf-deep)", "var(--bio-water-deep)", "var(--bio-petal-deep)", "var(--bio-wood-deep)"];

/** Allele frequency p(A) over the generations for each population (deterministic per seed). */
function simulate(n: number, s: number, seed: number): number[][] {
  const rng = createRng(seed * 104729 + n * 31 + Math.round(s * 1000));
  const alleles = 2 * n;
  return Array.from({ length: LINES }, () => {
    let p = 0.5;
    const out = [p];
    for (let g = 1; g <= GENS; g++) {
      const ps = (p * (1 + s)) / (1 + s * p);
      let k = 0;
      for (let i = 0; i < alleles; i++) if (rng.next() < ps) k++;
      p = k / alleles;
      out.push(p);
    }
    return out;
  });
}

const W = 520;
const H = 250;
const L = 42;
const R = 12;
const T = 12;
const B = 34;
const x = (g: number) => L + ((W - L - R) * g) / GENS;
const y = (p: number) => T + (H - T - B) * (1 - p);

export function EvolutionDrift() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const reduce = useReducedMotion();
  const [n, setN] = useState(10);
  const [si, setSi] = useState(0);
  const [seed, setSeed] = useState(1);
  const s = SEL[si].s;
  const runs = useMemo(() => simulate(n, s, seed), [n, s, seed]);
  const ends = runs.map((r) => r[r.length - 1]);
  const fixed = ends.filter((p) => p >= 1).length;
  const lost = ends.filter((p) => p <= 0).length;
  const mixed = LINES - fixed - lost;
  const run = `${n}-${si}-${seed}`;

  const chips = <T,>(items: T[], on: (x: T) => boolean, label: (x: T) => string, pick: (x: T) => void, id: string) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          aria-pressed={on(it)}
          onClick={() => pick(it)}
          className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium tabular-nums transition-colors", on(it) ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {on(it) && <motion.span layoutId={`${scope}-${id}`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
          <span className="relative">{label(it)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="text-[13px] font-medium text-ink-2">{t(tx("Population size (individuals)", "Populationsgröße (Individuen)"))}</div>
          {chips(SIZES, (v) => v === n, (v) => `N = ${v}`, setN, "n")}
        </div>
        <div className="space-y-1.5">
          <div className="text-[13px] font-medium text-ink-2">{t(tx("Selection", "Selektion"))}</div>
          {chips(SEL.map((_, i) => i), (i) => i === si, (i) => t(SEL[i].label), setSi, "s")}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Allele frequency of A over 80 generations in six populations", "Allelfrequenz von A über 80 Generationen in sechs Populationen"))}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
            <text x={L - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
              {dec(v, locale)}
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80].map((g) => (
          <text key={g} x={x(g)} y={H - B + 15} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {g}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("generation", "Generation"))}
        </text>
        <text x={12} y={(T + H - B) / 2} textAnchor="middle" fontSize={12} fill="var(--ink-2)" transform={`rotate(-90 12 ${(T + H - B) / 2})`} style={{ fontFamily: "var(--font-sans)" }}>
          p(A)
        </text>
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
        {runs.map((r, i) => (
          <motion.path
            key={`${run}-${i}`}
            d={`M${r.map((p, g) => `${x(g).toFixed(1)} ${y(p).toFixed(1)}`).join(" L")}`}
            fill="none"
            stroke={COLORS[i]}
            strokeWidth={2}
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeOut", delay: i * 0.05 }}
          />
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setSeed(seed + 1)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14.5px] font-semibold text-white">
          <Dices className="size-4" />
          {t(tx("New run", "Neuer Durchlauf"))}
        </button>
        <span className="text-[13.5px] text-ink-2 tabular-nums">
          {t(tx(`After 80 generations: A fixed ${fixed} · A lost ${lost} · still mixed ${mixed}`, `Nach 80 Generationen: A fixiert ${fixed} · A verloren ${lost} · noch gemischt ${mixed}`))}
        </span>
      </div>
      <p className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-relaxed text-ink-2">
        {t(
          s === 0
            ? n <= 50
              ? tx("Small population, no selection: chance alone makes p jump around. Often A is lost or fixed within a few dozen generations. That is genetic drift.", "Kleine Population, keine Selektion: Allein der Zufall lässt p springen. Oft geht A in wenigen Dutzend Generationen verloren oder wird fixiert. Das ist Gendrift.")
              : tx("Large population, no selection: p barely changes. In a very large population drift hardly matters, as Hardy-Weinberg assumes.", "Große Population, keine Selektion: p ändert sich kaum. In einer sehr großen Population spielt Drift kaum eine Rolle, so wie es das Hardy-Weinberg-Gesetz voraussetzt.")
            : n <= 50
              ? tx("Selection pushes A upwards, but in a small population chance can still wipe A out.", "Die Selektion treibt A nach oben, doch in einer kleinen Population kann der Zufall A trotzdem auslöschen.")
              : tx("In a large population selection works reliably: all populations move the same way.", "In einer großen Population wirkt die Selektion zuverlässig: Alle Populationen entwickeln sich in die gleiche Richtung."),
        )}
      </p>
    </div>
  );
}
