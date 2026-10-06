"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Flame, Hammer, Lightbulb, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { sin } from "@/lib/stableMath";

// The ionic lattice of sodium chloride as a 2D slice. A hammer blow shifts the layers so
// that equal charges meet (brittle); melting frees the ions so they can carry current.

type Mode = "solid" | "hit" | "melt";

const COLS = 7;
const ROWS = 5;
const CELL = 46;
const X0 = 92;
const Y0 = 76;
const W = 470;
const H = 300;
const LIFT = 30;
const R_CAT = 12;
const R_AN = 18;

/** Deterministic pseudo-random number in [0, 1) for ion i, draw k (same on server and client). */
const rand = (i: number, k: number) => {
  const v = sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return Math.round((v - Math.floor(v)) * 1000) / 1000;
};

type IonDot = { i: number; col: number; row: number; plus: boolean };

const IONS: IonDot[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { i, col, row, plus: (col + row) % 2 === 0 };
});

/**
 * Places in the melt: a loose grid with more slots than ions, shuffled with a bias so that
 * cations tend to the minus pole (left) and anions to the plus pole (right).
 */
const MELT: { x: number; y: number }[] = (() => {
  const slots: { x: number; y: number; key: number }[] = [];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 9; c++) {
      const k = r * 9 + c;
      slots.push({ x: 74 + c * 40 + (rand(k, 8) - 0.5) * 8, y: 48 + r * 41 + (rand(k, 9) - 0.5) * 8, key: 0 });
    }
  slots.forEach((sl, k) => (sl.key = sl.x + rand(k, 10) * 240));
  const order = [...slots].sort((a, b) => a.key - b.key);
  const cations = IONS.filter((d) => d.plus);
  const anions = IONS.filter((d) => !d.plus);
  const out: { x: number; y: number }[] = [];
  // Cations take slots from the left end, anions from the right end of the biased order.
  cations.forEach((d, n) => (out[d.i] = order[n * 2]));
  anions.forEach((d, n) => (out[d.i] = order[order.length - 1 - n * 2]));
  return out.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
})();

const CAPTIONS: Record<Mode, { title: Text; body: Text }> = {
  solid: {
    title: tx("Solid: a firm lattice", "Fest: ein festes Gitter"),
    body: tx(
      "Every Na⁺ is surrounded by Cl⁻ and every Cl⁻ by Na⁺ (in 3D: six neighbours each). The attraction pulls in all directions, so salts are hard and melt only at high temperatures (NaCl: 801 °C). The ions are stuck in place: no current flows.",
      "Jedes Na⁺ ist von Cl⁻ umgeben und jedes Cl⁻ von Na⁺ (räumlich: je sechs Nachbarn). Die Anziehung wirkt in alle Richtungen, deshalb sind Salze hart und schmelzen erst bei hohen Temperaturen (NaCl: 801 °C). Die Ionen sitzen fest: Es fließt kein Strom.",
    ),
  },
  hit: {
    title: tx("A blow: the crystal breaks", "Ein Schlag: Der Kristall bricht"),
    body: tx(
      "The blow shifts one layer by one ion. Now plus sits on plus and minus on minus. Equal charges repel each other, and the crystal splits. That's why salts are brittle.",
      "Der Schlag verschiebt eine Schicht um ein Ion. Jetzt liegt Plus auf Plus und Minus auf Minus. Gleiche Ladungen stoßen sich ab und der Kristall spaltet sich. Deshalb sind Salze spröde.",
    ),
  },
  melt: {
    title: tx("Molten: the ions can move", "Schmelze: Die Ionen sind beweglich"),
    body: tx(
      "In the melt (and in a salt solution) the ions move freely. Cations wander to the minus pole, anions to the plus pole: the melt conducts electricity.",
      "In der Schmelze (und in einer Salzlösung) sind die Ionen frei beweglich. Kationen wandern zum Minuspol, Anionen zum Pluspol: Die Schmelze leitet den elektrischen Strom.",
    ),
  },
};

export function IonicBondsLattice() {
  const t = useText();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("solid");
  const conducts = mode === "melt";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ModeButton active={mode === "hit"} onClick={() => setMode(mode === "hit" ? "solid" : "hit")} icon={<Hammer className="size-4" />} label={t(tx("Hammer blow", "Hammerschlag"))} />
        <ModeButton active={mode === "melt"} onClick={() => setMode(mode === "melt" ? "solid" : "melt")} icon={<Flame className="size-4" />} label={t(tx("Melt", "Schmelzen"))} />
        {mode !== "solid" && (
          <button type="button" onClick={() => setMode("solid")} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> {t(tx("Back to the crystal", "Zurück zum Kristall"))}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={t(CAPTIONS[mode].title)}>
          {/* electrodes and lamp circuit */}
          <path d={`M 26 22 L 26 8 L ${W - 26} 8 L ${W - 26} 22`} fill="none" stroke={conducts ? "var(--blob)" : "var(--line-2)"} strokeWidth={2} />
          <rect x={20} y={22} width={12} height={H - 44} rx={3} fill="var(--ink-3)" opacity={0.55} />
          <rect x={W - 32} y={22} width={12} height={H - 44} rx={3} fill="var(--ink-3)" opacity={0.55} />
          <text x={26} y={H - 6} textAnchor="middle" className="fill-ink-2 font-math" style={{ fontSize: 18 }}>
            −
          </text>
          <text x={W - 26} y={H - 6} textAnchor="middle" className="fill-ink-2 font-math" style={{ fontSize: 18 }}>
            +
          </text>
          <g transform={`translate(${W / 2 - 11} -3)`}>
            <motion.circle cx={11} cy={11} r={16} fill="var(--blob)" initial={false} animate={{ opacity: conducts ? 0.28 : 0, scale: conducts ? [1, 1.25, 1] : 1 }} transition={conducts ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }} style={{ transformOrigin: "11px 11px" }} />
            <rect x={-4} y={-2} width={30} height={26} fill="var(--surface)" />
            <Lightbulb x={0} y={0} width={22} height={22} color={conducts ? "var(--blob)" : "var(--ink-3)"} strokeWidth={2} />
          </g>

          {/* the crystal */}
          <Lattice mode={mode} reduce={!!reduce} />
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full bg-blob" /> {t(tx("sodium ion Na⁺ (smaller)", "Natrium-Ion Na⁺ (kleiner)"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-4 rounded-full border border-line-2 bg-hover" /> {t(tx("chloride ion Cl⁻ (larger)", "Chlorid-Ion Cl⁻ (größer)"))}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-ink">
            {t(CAPTIONS[mode].title)}
            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", conducts ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-3")}>
              {conducts ? t(tx("conducts", "leitet")) : t(tx("does not conduct", "leitet nicht"))}
            </span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{t(CAPTIONS[mode].body)}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", active ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
    >
      {icon} {label}
    </button>
  );
}

const SPLIT = 2; // the top two rows get shifted by the blow

function Lattice({ mode, reduce }: { mode: Mode; reduce: boolean }) {
  const top = IONS.filter((d) => d.row < SPLIT);
  const bottom = IONS.filter((d) => d.row >= SPLIT);
  if (mode === "melt") {
    return (
      <g>
        {IONS.map((d) => {
          const { x, y } = MELT[d.i];
          const bias = d.plus ? -1 : 1;
          const dx = (rand(d.i, 4) - 0.5) * 14 + bias * 6;
          const dy = (rand(d.i, 5) - 0.5) * 14;
          return (
            <motion.g
              key={d.i}
              initial={false}
              animate={reduce ? { x, y } : { x: [x, x + dx, x - dx * 0.4, x], y: [y, y + dy, y - dy, y] }}
              transition={reduce ? { duration: 0.6 } : { duration: 2.4 + rand(d.i, 6) * 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <IonCircle plus={d.plus} />
            </motion.g>
          );
        })}
      </g>
    );
  }
  const hit = mode === "hit";
  return (
    <g>
      {/* lower block stays */}
      {bottom.map((d) => (
        <Placed key={d.i} d={d} shift={0} reduce={reduce} />
      ))}
      {/* the shifted upper block flies off after the shift */}
      <motion.g initial={false} animate={hit ? { y: -LIFT, rotate: -3 } : { y: 0, rotate: 0 }} transition={hit ? { delay: 0.75, type: "spring", stiffness: 120, damping: 14 } : { duration: 0.4 }} style={{ transformOrigin: `${X0}px ${Y0 + CELL}px` }}>
        {top.map((d) => (
          <Placed key={d.i} d={d} shift={hit ? CELL : 0} reduce={reduce} />
        ))}
      </motion.g>
      {/* repulsion between equal charges */}
      <AnimatePresence>
        {hit &&
          top
            .filter((d) => d.row === SPLIT - 1 && d.col < COLS - 1)
            .map((d) => {
              const x = X0 + (d.col + 1) * CELL;
              const r = d.plus ? R_CAT : R_AN;
              const y1 = Y0 + d.row * CELL - LIFT + r + 5;
              const y2 = Y0 + (d.row + 1) * CELL - r - 5;
              return (
                <motion.g key={`rep-${d.i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ delay: 1.1 }}>
                  <line x1={x} x2={x} y1={y1 + 2} y2={y2 - 2} stroke="var(--danger)" strokeWidth={2} />
                  <path d={`M ${x - 5} ${y1 + 7} L ${x} ${y1 + 1} L ${x + 5} ${y1 + 7}`} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <path d={`M ${x - 5} ${y2 - 7} L ${x} ${y2 - 1} L ${x + 5} ${y2 - 7}`} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </motion.g>
              );
            })}
      </AnimatePresence>
    </g>
  );
}

function Placed({ d, shift, reduce }: { d: IonDot; shift: number; reduce: boolean }) {
  const x = X0 + d.col * CELL + shift;
  const y = Y0 + d.row * CELL;
  const wobble = reduce ? 0 : 1.6;
  return (
    <motion.g initial={false} animate={{ x, y }} transition={{ type: "spring", stiffness: 160, damping: 18 }}>
      <motion.g animate={wobble ? { x: [0, wobble, -wobble, 0], y: [0, -wobble, wobble, 0] } : {}} transition={{ duration: 1.6 + rand(d.i, 7), repeat: Infinity, ease: "easeInOut" }}>
        <IonCircle plus={d.plus} />
      </motion.g>
    </motion.g>
  );
}

function IonCircle({ plus }: { plus: boolean }) {
  const r = plus ? R_CAT : R_AN;
  return (
    <g>
      <circle r={r} fill={plus ? "var(--blob)" : "color-mix(in oklab, var(--ink) 14%, var(--raised))"} stroke={plus ? "none" : "color-mix(in oklab, var(--ink) 30%, transparent)"} strokeWidth={1.2} />
      <text textAnchor="middle" dominantBaseline="central" className={plus ? "fill-white font-semibold" : "fill-ink font-semibold"} style={{ fontSize: plus ? 15 : 18 }}>
        {plus ? "+" : "−"}
      </text>
    </g>
  );
}
