"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Bold } from "./FlowerKit";

// The ABC model of floral organ identity (Arabidopsis): a floral diagram with four whorls and the
// activity of the A, B and C genes. Knock out one function and watch the organs change.

export type Organ = "sepal" | "petal" | "stamen" | "carpel";
export type Mutant = "wt" | "a" | "b" | "c";

/** Organ identity per whorl (outside → inside). */
export const IDENTITY: Record<Mutant, Organ[]> = {
  wt: ["sepal", "petal", "stamen", "carpel"],
  a: ["carpel", "stamen", "stamen", "carpel"],
  b: ["sepal", "sepal", "carpel", "carpel"],
  c: ["sepal", "petal", "petal", "sepal"],
};
/** Gene activity per whorl. */
export const ACTIVE: Record<Mutant, { A: boolean[]; B: boolean[]; C: boolean[] }> = {
  wt: { A: [true, true, false, false], B: [false, true, true, false], C: [false, false, true, true] },
  a: { A: [false, false, false, false], B: [false, true, true, false], C: [true, true, true, true] },
  b: { A: [true, true, false, false], B: [false, false, false, false], C: [false, false, true, true] },
  c: { A: [true, true, true, true], B: [false, true, true, false], C: [false, false, false, false] },
};

export const ORGAN_NAME: Record<Organ, Text> = {
  sepal: tx("sepals", "Kelchblätter"),
  petal: tx("petals", "Kronblätter"),
  stamen: tx("stamens", "Staubblätter"),
  carpel: tx("carpels", "Fruchtblätter"),
};

const MUTANTS: { id: Mutant; label: Text; note: Text }[] = [
  {
    id: "wt",
    label: tx("Wild type", "Wildtyp"),
    note: tx("A alone: sepals. A + B: petals. B + C: stamens. C alone: carpels. **A and C inhibit each other.**", "A allein: Kelchblätter. A + B: Kronblätter. B + C: Staubblätter. C allein: Fruchtblätter. **A und C hemmen sich gegenseitig.**"),
  },
  {
    id: "a",
    label: tx("A mutant", "A-Mutante"),
    note: tx("Without A, nothing holds C back: **C spreads into whorls 1 and 2**. Carpels, stamens, stamens, carpels.", "Ohne A wird C nicht mehr gehemmt: **C breitet sich in Wirtel 1 und 2 aus**. Fruchtblätter, Staubblätter, Staubblätter, Fruchtblätter."),
  },
  {
    id: "b",
    label: tx("B mutant", "B-Mutante"),
    note: tx("Without B, only A and C are left: sepals, sepals, carpels, carpels. **No petals and no stamens.**", "Ohne B bleiben nur A und C: Kelchblätter, Kelchblätter, Fruchtblätter, Fruchtblätter. **Keine Kronblätter und keine Staubblätter.**"),
  },
  {
    id: "c",
    label: tx("C mutant", "C-Mutante"),
    note: tx("Without C, **A spreads inwards**: sepals, petals, petals, sepals. C also stops the flower growing on, so new whorls keep forming inside: a **double flower**.", "Ohne C breitet sich **A nach innen aus**: Kelchblätter, Kronblätter, Kronblätter, Kelchblätter. C beendet außerdem das Wachstum der Blüte, deshalb entstehen innen immer neue Wirtel: eine **gefüllte Blüte**."),
  },
];

const RAD = [118, 86, 54, 0];
const COUNT = [4, 4, 6, 1];
const OFFSET = [0, 45, 0, 0];

function OrganShape({ organ, small }: { organ: Organ; small?: boolean }) {
  const k = small ? 0.62 : 1;
  switch (organ) {
    case "sepal":
      return <path d={`M 0 ${-30 * k} C ${16 * k} ${-20 * k}, ${16 * k} ${18 * k}, 0 ${28 * k} C ${-16 * k} ${18 * k}, ${-16 * k} ${-20 * k}, 0 ${-30 * k} Z`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />;
    case "petal":
      return <path d={`M 0 ${24 * k} C ${-22 * k} ${10 * k}, ${-24 * k} ${-26 * k}, 0 ${-28 * k} C ${24 * k} ${-26 * k}, ${22 * k} ${10 * k}, 0 ${24 * k} Z`} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} />;
    case "stamen":
      return (
        <g>
          {[
            [-5, -6],
            [5, -6],
            [-5, 6],
            [5, 6],
          ].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x * k} cy={y * k} rx={5.5 * k} ry={6.5 * k} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1.1} />
          ))}
        </g>
      );
    case "carpel":
      return (
        <g>
          <ellipse cx={0} cy={0} rx={15 * k} ry={22 * k} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={1.6} />
          {[-11, -3, 5, 13].map((y) => (
            <circle key={y} cx={-5 * k} cy={y * k} r={2.6 * k} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.8} />
          ))}
        </g>
      );
  }
}

/** The inner gynoecium of the wild type: two fused carpels with a false septum and ovules. */
function Gynoecium() {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={30} ry={24} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={1.8} />
      <line x1={-30} y1={0} x2={30} y2={0} stroke="var(--bio-wall-deep)" strokeWidth={1.6} />
      {[-16, -6, 6, 16].map((x) => (
        <g key={x}>
          <circle cx={x} cy={-8} r={3} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.8} />
          <circle cx={x} cy={8} r={3} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.8} />
        </g>
      ))}
    </g>
  );
}

/** A floral diagram for a genotype (also used as a task picture). */
export function FlowerABCDiagram({ mutant = "wt" }: { mutant?: Mutant }) {
  const t = useText();
  const id = IDENTITY[mutant];
  return (
    <svg viewBox="40 40 320 320" className="mx-auto block h-auto w-full" style={{ maxWidth: 340 }} role="img" aria-label={t(tx("Floral diagram", "Blütendiagramm"))}>
      {[118, 86, 54].map((r) => (
        <circle key={r} cx={200} cy={200} r={r} fill="none" stroke="var(--line-2)" strokeWidth={1} strokeDasharray="3 5" />
      ))}
      {[0, 1, 2, 3].map((w) => (
        <AnimatePresence key={w} initial={false}>
          <motion.g
            key={`${w}-${id[w]}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            style={{ transformBox: "view-box", originX: "200px", originY: "200px" }}
          >
            {w === 3 ? (
              id[3] === "carpel" ? (
                <g transform="translate(200 200)">
                  <Gynoecium />
                </g>
              ) : (
                [0, 90, 180, 270].map((a) => (
                  <g key={a} transform={`rotate(${a + 45} 200 200) translate(200 ${200 - 22})`}>
                    <OrganShape organ={id[3]} small />
                  </g>
                ))
              )
            ) : (
              Array.from({ length: COUNT[w] }, (_, i) => {
                const a = OFFSET[w] + (360 / COUNT[w]) * i;
                return (
                  <g key={a} transform={`rotate(${a} 200 200) translate(200 ${200 - RAD[w]})`}>
                    <OrganShape organ={id[w]} small={w === 2 && id[w] !== "stamen"} />
                  </g>
                );
              })
            )}
          </motion.g>
        </AnimatePresence>
      ))}
      {mutant === "c" && (
        <motion.circle cx={200} cy={200} initial={{ r: 4, opacity: 0 }} animate={{ r: 10, opacity: 0.9 }} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      )}
    </svg>
  );
}

const GENE_COLOR = { A: "var(--bio-leaf)", B: "var(--bio-petal)", C: "var(--bio-pollen)" };

export function FlowerABC({ start = "wt" }: { start?: Mutant }) {
  const t = useText();
  const [mutant, setMutant] = useState<Mutant>(start);
  const m = MUTANTS.find((x) => x.id === mutant)!;
  const act = ACTIVE[mutant];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {MUTANTS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={mutant === x.id}
            onClick={() => setMutant(x.id)}
            className={cn("flex h-9 items-center rounded-lg border px-3 text-[13.5px] font-medium transition-colors", mutant === x.id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <FlowerABCDiagram mutant={mutant} />
        <div className="space-y-2.5">
          <div className="overflow-hidden rounded-xl border border-line text-[13px]">
            <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] border-b border-line bg-surface text-center font-semibold text-ink-2">
              <div className="py-1.5" />
              {[1, 2, 3, 4].map((w) => (
                <div key={w} className="px-0.5 py-1.5 text-[12px] leading-tight">
                  {t(tx(`Whorl ${w}`, `Wirtel ${w}`))}
                </div>
              ))}
            </div>
            {(["A", "B", "C"] as const).map((g) => (
              <div key={g} className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-center border-b border-line">
                <div className="py-1.5 text-center font-bold text-ink">{g}</div>
                {act[g].map((on, w) => (
                  <div key={w} className="p-1">
                    <motion.div
                      initial={false}
                      animate={{ opacity: on ? 1 : 0.12, scaleX: on ? 1 : 0.6 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      className="h-5 rounded-md"
                      style={{ background: GENE_COLOR[g] }}
                    />
                  </div>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-start bg-surface text-center">
              <div className="py-1.5" />
              {IDENTITY[mutant].map((o, w) => (
                <div key={`${w}-${o}`} className="hyphens-auto break-words px-0.5 py-1.5 text-[11px] font-semibold leading-tight text-ink">
                  {t(ORGAN_NAME[o])}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[13.5px] leading-snug text-ink-2">
            <Bold text={t(m.note)} />
          </p>
        </div>
      </div>
    </div>
  );
}
