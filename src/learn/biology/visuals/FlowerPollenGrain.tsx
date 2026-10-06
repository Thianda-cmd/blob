"use client";

import { motion, useReducedMotion } from "motion/react";
import { tx, type Text } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cos, sin } from "@/lib/stableMath";

// The male gametophyte: a mature (two-celled) pollen grain with exine, intine and aperture,
// the large vegetative cell and the generative cell inside it. Plus its development from the
// pollen mother cell, for the gametophyte widget.

const C = { x: 180, y: 150 };
const R = 100;

function bumps(n: number, r: number, skipFrom: number, skipTo: number) {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const deg = (a * 180) / Math.PI;
    if (deg > skipFrom && deg < skipTo) continue;
    out.push([C.x + cos(a) * r, C.y + sin(a) * r]);
  }
  return out;
}
/** Spines on the exine, leaving out the aperture (upper right, around 315°). */
const SPINES = bumps(40, R + 2, 296, 334);

export const POLLEN_PARTS: FigurePart[] = [
  { id: "exine", label: tx("exine (outer wall)", "Exine (äußere Wand)"), at: [C.x - 96, C.y + 30], tag: [36, 230], info: tx("Tough, patterned outer wall of sporopollenin: protects the grain on its journey.", "Feste, gemusterte Außenwand aus Sporopollenin: schützt das Korn auf der Reise.") },
  { id: "intine", label: tx("intine (inner wall)", "Intine (innere Wand)"), at: [C.x - 50, C.y + 74], tag: [70, 290], info: tx("Thin inner wall made of cellulose and pectin.", "Dünne Innenwand aus Cellulose und Pektin.") },
  { id: "aperture", label: tx("aperture (germ pore)", "Keimpore (Apertur)"), at: [C.x + 74, C.y - 70], tag: [330, 40], info: tx("A thin spot without exine: the pollen tube grows out here.", "Dünne Stelle ohne Exine: Hier wächst der Pollenschlauch heraus.") },
  { id: "vegetative", label: tx("vegetative cell (tube cell)", "vegetative Zelle (Pollenschlauchzelle)"), at: [C.x - 20, C.y + 50], tag: [330, 270], info: tx("The large cell: it forms the pollen tube.", "Die große Zelle: Sie bildet den Pollenschlauch.") },
  { id: "vnucleus", label: tx("vegetative nucleus", "vegetativer Kern"), at: [C.x - 34, C.y + 14], tag: [36, 110], info: tx("Controls the growth of the tube and leads at its tip.", "Steuert das Wachstum des Schlauchs und wandert an dessen Spitze.") },
  { id: "generative", label: tx("generative cell", "generative Zelle"), at: [C.x + 30, C.y - 22], tag: [330, 140], info: tx("Lies inside the vegetative cell. Divides by mitosis into the two sperm cells.", "Liegt in der vegetativen Zelle. Teilt sich mitotisch in die zwei Spermazellen.") },
];

export function FlowerPollenGrain({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Mature pollen grain (male gametophyte)", "Reifes Pollenkorn (männlicher Gametophyt)")} width={360} height={300} parts={POLLEN_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <PollenGrainDrawing />
    </Figure>
  );
}

export function PollenGrainDrawing() {
  return (
    <>
      <g data-part="exine">
        {SPINES.map(([x, y]) => (
          <circle key={`${x.toFixed(1)}${y.toFixed(1)}`} cx={x} cy={y} r={4.2} fill="var(--bio-pollen)" stroke="var(--bio-membrane)" strokeWidth={1} />
        ))}
        <circle cx={C.x} cy={C.y} r={R} fill="var(--bio-pollen)" stroke="var(--bio-membrane)" strokeWidth={2} />
      </g>
      <circle data-part="intine" cx={C.x} cy={C.y} r={R - 12} fill="var(--bio-bone)" stroke="var(--bio-membrane)" strokeWidth={1} />
      <g data-part="aperture">
        <path d={`M ${C.x + 62} ${C.y - 82} A 102 102 0 0 1 ${C.x + 84} ${C.y - 58} L ${C.x + 72} ${C.y - 50} A 88 88 0 0 0 ${C.x + 54} ${C.y - 70} Z`} fill="var(--bio-bone)" stroke="var(--bio-membrane)" strokeWidth={1} />
      </g>
      <circle data-part="vegetative" cx={C.x} cy={C.y} r={R - 18} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.4} />
      <g data-part="vnucleus">
        <path d={`M ${C.x - 58} ${C.y + 10} C ${C.x - 58} ${C.y - 10}, ${C.x - 30} ${C.y - 16}, ${C.x - 16} ${C.y - 4} C ${C.x - 6} ${C.y + 8}, ${C.x - 18} ${C.y + 34}, ${C.x - 38} ${C.y + 32} C ${C.x - 52} ${C.y + 30}, ${C.x - 58} ${C.y + 22}, ${C.x - 58} ${C.y + 10} Z`} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
        <circle cx={C.x - 36} cy={C.y + 12} r={4} fill="var(--bio-nucleus-deep)" />
      </g>
      <g data-part="generative">
        <ellipse cx={C.x + 26} cy={C.y - 20} rx={40} ry={15} transform={`rotate(-28 ${C.x + 26} ${C.y - 20})`} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.5} />
        <ellipse cx={C.x + 26} cy={C.y - 20} rx={14} ry={8} transform={`rotate(-28 ${C.x + 26} ${C.y - 20})`} fill="var(--bio-nucleus-deep)" opacity={0.85} />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Development of the pollen grain (stages for the gametophyte widget)

export const POLLEN_STEPS: { title: Text; note: Text }[] = [
  {
    title: tx("Pollen mother cell (2n)", "Pollenmutterzelle (2n)"),
    note: tx("In the pollen sacs of the anther lie diploid **pollen mother cells**: still part of the sporophyte.", "In den Pollensäcken des Staubbeutels liegen diploide **Pollenmutterzellen**: noch Teil des Sporophyten."),
  },
  {
    title: tx("Meiosis: a tetrad", "Meiose: eine Tetrade"),
    note: tx("Each mother cell divides by **meiosis** into four haploid **microspores** (n). Meiosis makes spores, not gametes!", "Jede Mutterzelle teilt sich durch **Meiose** in vier haploide **Mikrosporen** (n). Die Meiose bildet Sporen, keine Gameten!"),
  },
  {
    title: tx("A microspore", "Eine Mikrospore"),
    note: tx("The microspores separate and build their tough wall: exine outside, intine inside.", "Die Mikrosporen trennen sich und bauen ihre feste Wand auf: außen die Exine, innen die Intine."),
  },
  {
    title: tx("First pollen mitosis", "Erste Pollenmitose"),
    note: tx("An unequal **mitosis**: a large **vegetative cell** and a small **generative cell** at the wall. The male gametophyte now has two cells.", "Eine ungleiche **Mitose**: eine große **vegetative Zelle** und eine kleine **generative Zelle** an der Wand. Der männliche Gametophyt hat jetzt zwei Zellen."),
  },
  {
    title: tx("Mature pollen grain", "Reifes Pollenkorn"),
    note: tx("The generative cell detaches and lies inside the vegetative cell: a cell inside a cell. That's how the grain leaves the anther.", "Die generative Zelle löst sich ab und liegt in der vegetativen Zelle: eine Zelle in der Zelle. So verlässt das Korn den Staubbeutel."),
  },
  {
    title: tx("Germination on the stigma", "Keimung auf der Narbe"),
    note: tx("The vegetative cell grows out as the **pollen tube**. The generative cell divides by mitosis into **two sperm cells** (second pollen mitosis).", "Die vegetative Zelle wächst zum **Pollenschlauch** aus. Die generative Zelle teilt sich mitotisch in **zwei Spermazellen** (zweite Pollenmitose)."),
  },
];

const ploidyLabel = (x: number, y: number, text: string, show: boolean) => (
  <motion.text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink)" initial={false} animate={{ opacity: show ? 1 : 0 }} style={{ fontFamily: "var(--font-sans)" }}>
    {text}
  </motion.text>
);

/** The pollen grain's development (step 0–5), drawn in a 360 × 260 box. */
export function PollenDevelopment({ step }: { step: number }) {
  const reduce = useReducedMotion();
  const tr = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 80, damping: 16 } as const);
  const tetrad = step === 1;
  const single = step >= 2;
  const walled = step >= 2;
  const split = step >= 3;
  const inside = step >= 4;
  const tube = step >= 5;
  const cells = [
    [152, 102],
    [208, 102],
    [152, 158],
    [208, 158],
  ];
  return (
    <svg viewBox="0 0 400 260" className="mx-auto block h-auto w-full" style={{ maxWidth: 520 }} aria-hidden>
      {/* mother cell */}
      <motion.g initial={false} animate={{ opacity: step === 0 ? 1 : 0, scale: step === 0 ? 1 : 0.8 }} transition={tr}>
        <circle cx={180} cy={130} r={62} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
        <circle cx={180} cy={130} r={24} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
        {ploidyLabel(180, 130, "2n", step === 0)}
      </motion.g>
      {/* tetrad of microspores */}
      <motion.g initial={false} animate={{ opacity: tetrad ? 1 : 0 }} transition={tr}>
        <rect x={112} y={62} width={136} height={136} rx={60} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 4" />
        {cells.map(([x, y]) => (
          <g key={`${x}${y}`}>
            <circle cx={x} cy={y} r={27} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.8} />
            <circle cx={x} cy={y} r={11} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />
            {ploidyLabel(x, y, "n", tetrad)}
          </g>
        ))}
      </motion.g>
      {/* the single microspore / pollen grain */}
      <motion.g initial={false} animate={{ opacity: single ? 1 : 0 }} transition={tr}>
        <motion.circle cx={180} cy={130} initial={false} animate={{ r: walled ? 74 : 50 }} transition={tr} fill="var(--bio-pollen)" stroke="var(--bio-membrane)" strokeWidth={2} />
        <motion.circle cx={180} cy={130} initial={false} animate={{ r: walled ? 64 : 48 }} transition={tr} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.2} />
        {/* aperture */}
        <path d="M 226 78 A 70 70 0 0 1 242 96 L 232 102 A 58 58 0 0 0 218 86 Z" fill="var(--bio-bone)" />
        {/* (vegetative) nucleus */}
        <motion.circle initial={false} animate={{ cx: split ? 160 : 180, cy: split ? 140 : 130, r: split ? 17 : 15, opacity: tube ? 0 : 1 }} transition={tr} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
        {ploidyLabel(180, 130, "n", step === 2)}
        {/* generative cell: first against the wall, then inside, then two sperm cells */}
        <motion.ellipse
          initial={false}
          animate={{ cx: inside ? 200 : 222, cy: inside ? 116 : 150, rx: split ? (inside ? 26 : 12) : 0, ry: split ? (inside ? 10 : 22) : 0, opacity: split && !tube ? 1 : 0 }}
          transition={tr}
          fill="var(--bio-vacuole)"
          stroke="var(--bio-water-deep)"
          strokeWidth={1.4}
        />
      </motion.g>
      {/* germination: the pollen tube with the vegetative nucleus and two sperm cells */}
      <motion.path
        d="M 232 92 C 266 60, 300 70, 316 110 C 330 150, 340 190, 352 236"
        fill="none"
        stroke="var(--bio-cell)"
        strokeWidth={20}
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: tube ? 1 : 0, opacity: tube ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.2 }}
      />
      <motion.path
        d="M 232 92 C 266 60, 300 70, 316 110 C 330 150, 340 190, 352 236"
        fill="none"
        stroke="var(--bio-membrane)"
        strokeWidth={1.5}
        strokeDasharray="0"
        initial={false}
        animate={{ pathLength: tube ? 1 : 0, opacity: tube ? 0.6 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 1.2 }}
      />
      <motion.g initial={false} animate={{ opacity: tube ? 1 : 0 }} transition={reduce ? { duration: 0 } : { delay: tube ? 0.9 : 0 }}>
        <ellipse cx={344} cy={204} rx={9} ry={12} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />
        <ellipse cx={330} cy={162} rx={6} ry={9} fill="var(--bio-nucleus-deep)" />
        <ellipse cx={322} cy={136} rx={6} ry={9} fill="var(--bio-nucleus-deep)" />
      </motion.g>
    </svg>
  );
}
