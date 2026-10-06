"use client";

// Osmosis lab (topic "cell", level 3): put a red onion cell or a red blood cell into distilled
// water, an isotonic solution or a concentrated salt solution and watch the water flow,
// plasmolysis and deplasmolysis, turgor, haemolysis and crenation.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type OsmoCell = "plant" | "rbc";
export type OsmoSolution = "water" | "iso" | "salt";

const W = 520;
const H = 300;
const CX = 260;
const CY = 150;

// Solute particles outside: the more concentrated, the more of them are shown.
const DOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  let s = 11;
  for (let tries = 0; tries < 6000 && out.length < 70; tries++) {
    s = (s * 16807) % 2147483647;
    const x = 14 + (s % 492);
    s = (s * 16807) % 2147483647;
    const y = 14 + (s % 272);
    const inside = Math.abs(x - CX) < 152 && Math.abs(y - CY) < 114;
    if (!inside && !out.some(([a, b]) => Math.hypot(a - x, b - y) < 22)) out.push([x, y]);
  }
  return out;
})();
const DOTS_FOR: Record<OsmoSolution, number> = { water: 0, iso: 16, salt: 52 };
// In plasmolysis the outside solution fills the gap between wall and protoplast.
const GAP_DOTS: [number, number][] = [
  [150, 80],
  [370, 80],
  [150, 224],
  [372, 222],
  [178, 150],
  [362, 150],
  [256, 82],
  [270, 226],
  [204, 98],
  [330, 214],
];

/** A rounded-rectangle-ish closed shape (superellipse) as a path with a fixed number of points, so shapes can morph. */
function blob(cx: number, cy: number, a: number, b: number, n: number, wobble = 0, k = 0) {
  const pts: string[] = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const r = 1 + wobble * Math.sin(k * t);
    const x = cx + a * r * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + b * r * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

// Plant cell (red onion epidermis): the wall stays, the protoplast shrinks away from it in salt.
const WALL = { a: 128, b: 88 };
const PROTO: Record<OsmoSolution, string> = {
  water: blob(CX, CY, WALL.a - 6, WALL.b - 6, 6),
  iso: blob(CX, CY, WALL.a - 7, WALL.b - 7, 5.2),
  salt: blob(CX + 8, CY + 4, 76, 50, 2.6),
};
const VAC: Record<OsmoSolution, { rx: number; ry: number; cx: number; cy: number }> = {
  water: { rx: 100, ry: 66, cx: CX + 8, cy: CY },
  iso: { rx: 94, ry: 62, cx: CX + 8, cy: CY },
  salt: { rx: 52, ry: 32, cx: CX + 14, cy: CY + 4 },
};

// Red blood cell, seen from above: a disc with a pale dent; swollen and burst in water, spiky (crenated) in salt.
const RBC: Record<OsmoSolution, string> = {
  water: blob(CX, CY, 84, 84, 2),
  iso: blob(CX, CY, 70, 70, 2),
  salt: blob(CX, CY, 52, 52, 2, 0.12, 14),
};

const TEXT: Record<OsmoCell, Record<OsmoSolution, { title: Text; body: Text }>> = {
  plant: {
    water: {
      title: tx("Distilled water: hypotonic outside", "Destilliertes Wasser: außen hypotonisch"),
      body: tx(
        "Outside there are fewer dissolved particles than in the cell sap. Water flows in by osmosis, the vacuole swells and presses the protoplast against the wall: the cell is turgid (turgor). The wall stops it from bursting.",
        "Außen sind weniger gelöste Teilchen als im Zellsaft. Wasser strömt durch Osmose ein, die Vakuole schwillt an und drückt den Protoplasten gegen die Wand: Die Zelle ist prall (Turgor). Die Zellwand verhindert das Platzen.",
      ),
    },
    iso: {
      title: tx("Isotonic solution", "Isotonische Lösung"),
      body: tx(
        "Same concentration of dissolved particles inside and outside: water molecules still move both ways, but there is no net flow. The cell stays as it is.",
        "Innen und außen gleich viele gelöste Teilchen: Wassermoleküle wandern weiter in beide Richtungen, aber netto strömt kein Wasser. Die Zelle bleibt, wie sie ist.",
      ),
    },
    salt: {
      title: tx("Salt solution: hypertonic outside", "Salzlösung: außen hypertonisch"),
      body: tx(
        "Outside there are more dissolved particles. Water leaves the vacuole by osmosis, the vacuole shrinks and its colour gets darker, and the protoplast pulls away from the cell wall: plasmolysis. The salt solution fills the gap, because the wall lets everything through.",
        "Außen sind mehr gelöste Teilchen. Wasser strömt durch Osmose aus der Vakuole, sie schrumpft, ihre Farbe wird dunkler, und der Protoplast löst sich von der Zellwand: Plasmolyse. Die Salzlösung füllt den Spalt, denn die Wand lässt alles durch.",
      ),
    },
  },
  rbc: {
    water: {
      title: tx("Distilled water: hypotonic outside", "Destilliertes Wasser: außen hypotonisch"),
      body: tx(
        "Water flows in. A red blood cell has no wall to hold it: it swells and bursts (haemolysis). This is why infusions are never pure water.",
        "Wasser strömt ein. Ein rotes Blutkörperchen hat keine Zellwand, die es hält: Es schwillt an und platzt (Hämolyse). Deshalb sind Infusionen nie reines Wasser.",
      ),
    },
    iso: {
      title: tx("0.9 % salt solution: isotonic", "0,9-prozentige Kochsalzlösung: isotonisch"),
      body: tx("As concentrated as blood plasma: no net water flow. The cell keeps its disc shape.", "So konzentriert wie Blutplasma: kein Netto-Wasserstrom. Die Zelle behält ihre Scheibenform.") },
    salt: {
      title: tx("Salt solution: hypertonic outside", "Salzlösung: außen hypertonisch"),
      body: tx("Water flows out, the cell shrinks and gets a spiky, crumpled outline (crenation).", "Wasser strömt aus, die Zelle schrumpft und bekommt eine stachelige, geschrumpelte Form (Stechapfelform).") },
  },
};

const DEPLASMOLYSIS: { title: Text; body: Text } = {
  title: tx("Back in water: deplasmolysis", "Zurück ins Wasser: Deplasmolyse"),
  body: tx(
    "Water flows back into the vacuole, the protoplast swells and lies against the wall again. The cell was alive all along: only a living membrane is semipermeable.",
    "Wasser strömt zurück in die Vakuole, der Protoplast schwillt an und legt sich wieder an die Wand. Die Zelle hat überlebt: Nur eine lebende Membran ist semipermeabel.",
  ),
};

function Arrows({ dir, reduce }: { dir: "in" | "out" | "both"; reduce: boolean | null }) {
  const spots: [number, number, number][] = [
    [CX - 150, CY, 0],
    [CX + 150, CY, 180],
    [CX, CY - 112, 90],
    [CX, CY + 112, 270],
  ];
  return (
    <g>
      {spots.map(([x, y, a], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          {(dir === "both" ? [1, -1] : [dir === "in" ? 1 : -1]).map((d, j) => (
            <motion.path
              key={j}
              d={d === 1 ? "M -16 0 L 14 0 M 6 -7 L 14 0 L 6 7" : "M 16 0 L -14 0 M -6 -7 L -14 0 L -6 7"}
              transform={dir === "both" ? `translate(0 ${j === 0 ? -7 : 7})` : undefined}
              fill="none"
              stroke="var(--bio-water-deep)"
              strokeWidth={dir === "both" ? 2 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={reduce || dir === "both" ? { opacity: dir === "both" ? 0.6 : 1 } : { opacity: [0.2, 1, 0.2], x: d === 1 ? [-6, 6, -6] : [6, -6, 6] }}
              transition={reduce || dir === "both" ? { duration: 0.3 } : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

/** The cell in its solution (also used as a task picture with fixed props). */
export function CellOsmosisCell({ cell, solution, animate = true }: { cell: OsmoCell; solution: OsmoSolution; animate?: boolean }) {
  const t = useText();
  const reduce = useReducedMotion();
  const spring = { type: "spring" as const, stiffness: 50, damping: 14 };
  const flow = solution === "water" ? "in" : solution === "salt" ? "out" : "both";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("A cell in a solution", "Eine Zelle in einer Lösung"))}>
      <rect x={2} y={2} width={W - 4} height={H - 4} rx={18} fill="var(--bio-water)" opacity={0.12} stroke="var(--bio-water-deep)" strokeOpacity={0.4} />
      {DOTS.slice(0, DOTS_FOR[solution]).map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={3.2} fill="var(--bio-water-deep)" initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: animate ? i * 0.01 : 0 }} />
      ))}
      {cell === "plant" ? (
        <g>
          {/* the gap between wall and protoplast fills with the outside solution */}
          <rect x={CX - WALL.a} y={CY - WALL.b} width={2 * WALL.a} height={2 * WALL.b} rx={22} fill="var(--bio-water)" opacity={0.18} />
          <rect x={CX - WALL.a - 8} y={CY - WALL.b - 8} width={2 * WALL.a + 16} height={2 * WALL.b + 16} rx={28} fill="none" stroke="var(--bio-wall)" strokeWidth={12} />
          <rect x={CX - WALL.a - 14} y={CY - WALL.b - 14} width={2 * WALL.a + 28} height={2 * WALL.b + 28} rx={32} fill="none" stroke="var(--bio-wall-deep)" strokeWidth={1.6} />
          <rect x={CX - WALL.a - 2} y={CY - WALL.b - 2} width={2 * WALL.a + 4} height={2 * WALL.b + 4} rx={24} fill="none" stroke="var(--bio-wall-deep)" strokeWidth={1.6} />
          {solution === "salt" && GAP_DOTS.map(([x, y], i) => <motion.circle key={i} cx={x} cy={y} r={3.2} fill="var(--bio-water-deep)" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: animate ? 0.8 + i * 0.05 : 0 }} />)}
          <motion.path initial={false} animate={{ d: PROTO[solution] }} transition={animate ? spring : { duration: 0 }} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2.6} />
          <motion.ellipse
            initial={false}
            animate={VAC[solution]}
            transition={animate ? spring : { duration: 0 }}
            fill={solution === "salt" ? "var(--bio-petal-deep)" : "var(--bio-petal)"}
            stroke="var(--bio-petal-deep)"
            strokeWidth={1.6}
          />
          <motion.circle initial={false} animate={solution === "salt" ? { cx: CX - 46, cy: CY - 18 } : { cx: CX - 98, cy: CY - 36 }} transition={animate ? spring : { duration: 0 }} r={13} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
        </g>
      ) : (
        <g>
          <motion.path
            initial={false}
            animate={{ d: RBC[solution], opacity: solution === "water" ? [1, 1, 0.35] : 1 }}
            transition={animate ? (solution === "water" ? { d: spring, opacity: { duration: 2.4, times: [0, 0.6, 1] } } : spring) : { duration: 0 }}
            fill="var(--bio-blood)"
            stroke="var(--bio-blood)"
            strokeWidth={2}
            strokeDasharray={solution === "water" ? "26 10" : undefined}
          />
          <motion.circle initial={false} cx={CX} cy={CY} animate={{ r: solution === "iso" ? 26 : solution === "salt" ? 14 : 0, opacity: solution === "water" ? 0 : 0.55 }} transition={animate ? spring : { duration: 0 }} fill="var(--bio-flesh)" />
          {solution === "water" && <motion.circle cx={CX} cy={CY} r={84} fill="none" stroke="var(--bio-blood)" strokeWidth={14} initial={animate ? { opacity: 0, scale: 1 } : { opacity: 0.25, scale: 1.25 }} animate={{ opacity: [0, 0.35, 0.25], scale: [1, 1.15, 1.25] }} transition={{ duration: animate ? 2.4 : 0, delay: animate ? 0.6 : 0 }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
        </g>
      )}
      <Arrows dir={flow} reduce={reduce || !animate} />
    </svg>
  );
}

export function CellOsmosisLab() {
  const t = useText();
  const [cell, setCell] = useState<OsmoCell>("plant");
  const [sol, setSol] = useState<OsmoSolution>("iso");
  const [prev, setPrev] = useState<OsmoSolution | null>(null);
  const info = cell === "plant" && prev === "salt" && sol !== "salt" ? DEPLASMOLYSIS : TEXT[cell][sol];
  const SOLS: { id: OsmoSolution; name: Text }[] = [
    { id: "water", name: tx("Distilled water", "Destilliertes Wasser") },
    { id: "iso", name: tx("Isotonic", "Isotonisch") },
    { id: "salt", name: tx("Concentrated salt", "Konzentrierte Salzlösung") },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(["plant", "rbc"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cell === c}
              onClick={() => {
                setCell(c);
                setPrev(null);
                setSol("iso");
              }}
              className={cn("h-9 rounded-lg px-3 text-[13.5px] font-semibold transition-colors", cell === c ? "bg-blob text-white" : "text-ink-2 hover:text-ink")}
            >
              {c === "plant" ? t(tx("Red onion cell", "Zelle der roten Zwiebel")) : t(tx("Red blood cell", "Rotes Blutkörperchen"))}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SOLS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={sol === s.id}
            onClick={() => {
              if (s.id === sol) return;
              setPrev(sol);
              setSol(s.id);
            }}
            className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", sol === s.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(s.name)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-center">
        <CellOsmosisCell key={cell} cell={cell} solution={sol} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${cell}-${sol}-${info === DEPLASMOLYSIS}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-surface px-3.5 py-3 text-[14px] leading-relaxed text-ink-2" aria-live="polite">
            <div className="mb-1 font-semibold text-ink">{t(info.title)}</div>
            {t(info.body)}
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="text-[12.5px] text-ink-3">{t(tx("Dots: dissolved particles outside. Arrows: net water flow.", "Punkte: gelöste Teilchen außen. Pfeile: Netto-Wasserstrom."))}</p>
    </div>
  );
}
