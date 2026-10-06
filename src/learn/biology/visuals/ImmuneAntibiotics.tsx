"use client";

// A mini experiment for level 1: an antibiotic is added to a dish of bacteria and to a dish of
// body cells infected by viruses. The bacteria die except one that happens to be resistant; it
// multiplies and the next dose does nothing. The viruses don't care at all.

import { AnimatePresence, motion } from "motion/react";
import { Hourglass, Pill, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { BacteriumRod, BodyCell, PAINT, VirusParticle } from "./ImmuneCells";

const C = 120;

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 24 places for bacteria inside the dish, not too close to each other. */
const SPOTS: { x: number; y: number; rot: number }[] = (() => {
  const rnd = seeded(11);
  const out: { x: number; y: number; rot: number }[] = [];
  for (let tries = 0; out.length < 24 && tries < 5000; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 80;
    const x = Math.round(C + r * Math.cos(a));
    const y = Math.round(C + r * Math.sin(a));
    if (out.every((p) => Math.hypot(p.x - x, p.y - y) > 32)) out.push({ x, y, rot: Math.round(rnd() * 180) });
  }
  return out;
})();

const START_SPOTS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
const RESISTANT_SPOT = 6;

type Bug = { id: number; spot: number; from: number; res: boolean };
type Phase = "start" | "grown" | "treated" | "regrown" | "useless";

const start = (): Bug[] => START_SPOTS.map((spot, i) => ({ id: i, spot, from: spot, res: spot === RESISTANT_SPOT }));

const CELLS: [number, number][] = [
  [120, 120],
  [120, 62],
  [170, 91],
  [170, 149],
  [120, 178],
  [70, 149],
  [70, 91],
];

const MESSAGES: Record<Phase, Text> = {
  start: tx(
    "Left: bacteria. Right: body cells attacked by viruses. Try out what an antibiotic does, or wait and see what happens without one.",
    "Links: Bakterien. Rechts: Körperzellen, die von Viren befallen sind. Probier aus, was ein Antibiotikum bewirkt, oder warte ab, was ohne passiert.",
  ),
  grown: tx(
    "Without help the bacteria divide: each one becomes two. The viruses infect more and more cells and multiply inside them.",
    "Ohne Hilfe teilen sich die Bakterien: Aus einem werden zwei. Die Viren befallen immer mehr Zellen und vermehren sich darin.",
  ),
  treated: tx(
    "The antibiotic kills almost all bacteria. Only the few that are insensitive (resistant) by a random change in their genetic material survive. The viruses aren't affected at all: they have no cell wall and no metabolism for the antibiotic to attack.",
    "Das Antibiotikum tötet fast alle Bakterien. Nur die wenigen, die durch eine zufällige Veränderung im Erbgut unempfindlich (resistent) sind, überleben. Den Viren macht es gar nichts: Sie haben keine Zellwand und keinen Stoffwechsel, den das Antibiotikum angreifen könnte.",
  ),
  regrown: tx(
    "The resistant bacteria multiply, and all their offspring are resistant too.",
    "Die resistenten Bakterien vermehren sich, und alle ihre Nachkommen sind ebenfalls resistent.",
  ),
  useless: tx(
    "Now the antibiotic doesn't work any more: the bacteria are resistant. That's why antibiotics are only used against bacteria, only when a doctor prescribes them, and exactly as prescribed.",
    "Jetzt wirkt das Antibiotikum nicht mehr: Die Bakterien sind resistent. Deshalb nimmt man Antibiotika nur gegen Bakterien, nur wenn die Ärztin oder der Arzt sie verordnet, und genau so, wie verordnet.",
  ),
};

/** The lesson widget. */
export function ImmuneAntibiotics() {
  const t = useText();
  const [bugs, setBugs] = useState<Bug[]>(start);
  const [infected, setInfected] = useState(2);
  const [phase, setPhase] = useState<Phase>("start");
  const [dose, setDose] = useState(0);
  const [shownRes, setShownRes] = useState(false);
  const [nextId, setNextId] = useState(100);

  const divide = () => {
    const used = new Set(bugs.map((b) => b.spot));
    const born: Bug[] = [];
    let id = nextId;
    for (const b of bugs) {
      const p = SPOTS[b.spot];
      const free = SPOTS.map((q, i) => ({ i, d: Math.hypot(q.x - p.x, q.y - p.y) }))
        .filter((q) => !used.has(q.i))
        .sort((a, c) => a.d - c.d)[0];
      if (!free) break;
      used.add(free.i);
      born.push({ id: id++, spot: free.i, from: b.spot, res: b.res });
    }
    setNextId(id);
    setBugs([...bugs, ...born]);
    setInfected((k) => Math.min(CELLS.length, k + 2));
    setPhase(phase === "treated" || phase === "regrown" || phase === "useless" ? "regrown" : "grown");
  };

  const treat = () => {
    setDose((d) => d + 1);
    setShownRes(true);
    if (bugs.some((b) => !b.res)) {
      setBugs(bugs.filter((b) => b.res));
      setPhase("treated");
    } else {
      setPhase("useless");
    }
  };

  const reset = () => {
    setBugs(start());
    setInfected(2);
    setPhase("start");
    setShownRes(false);
    setDose(0);
  };

  const full = bugs.length >= SPOTS.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Dish title={tx("Bacteria", "Bakterien")} count={tx(`${bugs.length} bacteria`, `${bugs.length} Bakterien`)} dose={dose}>
          <AnimatePresence>
            {bugs.map((b) => {
              const p = SPOTS[b.spot];
              const o = SPOTS[b.from];
              return (
                <motion.g
                  key={b.id}
                  initial={{ x: o.x, y: o.y, rotate: o.rot, scale: 0.4, opacity: 0 }}
                  animate={{ x: p.x, y: p.y, rotate: p.rot, scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.5 } }}
                  transition={{ type: "spring", stiffness: 120, damping: 16 }}
                >
                  <g style={shownRes && b.res ? { filter: "drop-shadow(0 0 3px var(--blob))" } : undefined}>
                    <BacteriumRod w={14} h={7.5} flagellum={false} />
                    {shownRes && b.res && <rect x={-14} y={-7.5} width={28} height={15} rx={7.5} fill="none" stroke="var(--blob)" strokeWidth={2} />}
                  </g>
                </motion.g>
              );
            })}
          </AnimatePresence>
        </Dish>
        <Dish title={tx("Viruses in body cells", "Viren in Körperzellen")} count={tx(`${infected} of 7 cells infected`, `${infected} von 7 Zellen befallen`)} dose={dose}>
          {CELLS.map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <BodyCell r={27} infected={i < infected} />
            </g>
          ))}
          {CELLS.slice(0, infected).map(([x, y], i) => (
            <motion.g key={`v${i}`} initial={{ x, y, opacity: 0 }} animate={{ x: x + (i % 2 ? 22 : -20), y: y - 22, opacity: 1 }} transition={{ type: "spring", stiffness: 80, damping: 14 }}>
              <g transform="scale(0.42)">
                <VirusParticle />
              </g>
            </motion.g>
          ))}
        </Dish>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={treat}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper"
        >
          <Pill className="size-4" /> {t(tx("Add antibiotic", "Antibiotikum zugeben"))}
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={divide}
          disabled={full}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-4 text-[14px] font-semibold text-ink hover:bg-hover disabled:opacity-50"
        >
          <Hourglass className="size-4" /> {t(tx("Wait a while", "Eine Weile warten"))}
        </motion.button>
        <button type="button" onClick={reset} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Start again", "Neu starten"))}>
          <RotateCcw className="size-4" />
        </button>
        {shownRes && (
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <span className="h-3 w-5 rounded-full border-2 border-blob" /> {t(tx("resistant", "resistent"))}
          </span>
        )}
      </div>

      <motion.p
        key={`${phase}-${bugs.length}-${dose}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", phase === "useless" ? "bg-danger/[0.07] text-ink" : "bg-hover/60 text-ink-2")}
      >
        {t(MESSAGES[phase])}
      </motion.p>
    </div>
  );
}

function Dish({ title, count, dose, children }: { title: Text; count: Text; dose: number; children: React.ReactNode }) {
  const t = useText();
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-2.5">
      <div className="flex items-baseline justify-between px-1 text-[12.5px]">
        <span className="font-semibold uppercase tracking-wide text-ink-3">{t(title)}</span>
        <span className="tabular-nums text-ink-3">{t(count)}</span>
      </div>
      <svg viewBox="0 0 240 240" className="mx-auto block h-auto w-full max-w-[260px]" role="img" aria-label={t(title)}>
        <circle cx={C} cy={C} r={112} fill="var(--bio-vacuole)" fillOpacity={0.35} stroke="var(--ink-3)" strokeWidth={2} />
        <circle cx={C} cy={C} r={104} fill="none" stroke="var(--line)" strokeWidth={1.4} />
        {children}
        <AnimatePresence>
          {dose > 0 && (
            <motion.g key={dose} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.9, 0] }} transition={{ duration: 1.6 }}>
              {SPOTS.map((p, i) => (
                <rect key={i} x={p.y - 3} y={p.x - 6} width={6} height={12} rx={3} fill={PAINT.th.stroke} opacity={0.8} />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
