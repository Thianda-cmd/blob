"use client";

import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Zap } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { byNumber } from "../elements";
import { atomIon, nobleFor } from "../ionic-bonds-ions";
import { AtomShells, ionShells } from "./AtomShells";

// Electron transfer: a metal atom hands its outer electrons to nonmetal atoms. Both end up
// with a noble gas configuration, and the ions attract each other.

type Setup = {
  id: string;
  /** Chip label (\ce source). */
  label: string;
  /** Atoms from left to right. */
  atoms: string[];
  /** Each arrow moves one electron: [from, to] atom index. */
  moves: [number, number][];
  formula: string;
};

const SETUPS: Setup[] = [
  { id: "NaCl", label: "Na + Cl", atoms: ["Na", "Cl"], moves: [[0, 1]], formula: "NaCl" },
  { id: "MgO", label: "Mg + O", atoms: ["Mg", "O"], moves: [[0, 1], [0, 1]], formula: "MgO" },
  { id: "MgCl2", label: "Mg + 2Cl", atoms: ["Cl", "Mg", "Cl"], moves: [[1, 0], [1, 2]], formula: "MgCl2" },
  { id: "Na2O", label: "2Na + O", atoms: ["Na", "O", "Na"], moves: [[0, 1], [2, 1]], formula: "Na2O" },
];

const CELL = 210;
const SIZE = 176;
const TOP = 8;

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻" };
/** "Mg²⁺", "Cl⁻" for SVG text. */
export const supCharge = (symbol: string, charge: number) =>
  charge === 0 ? symbol : `${symbol}${(Math.abs(charge) > 1 ? String(Math.abs(charge)) : "").replace(/./g, (d) => SUP[d])}${charge > 0 ? "⁺" : "⁻"}`;

/** Radius of the outer shell as AtomShells draws it. */
function outerRadius(z: number, charge: number) {
  const layers = ionShells(z, charge).length;
  const c = SIZE / 2;
  const core = Math.max(16, SIZE * 0.11);
  const gap = (c - core - 10) / Math.max(layers, 2);
  return core + gap * layers;
}

export function IonicBondsTransfer() {
  const t = useText();
  const scope = useId();
  const [setupId, setSetupId] = useState("NaCl");
  const [phase, setPhase] = useState<"idle" | "moving" | "done">("idle");
  const setup = SETUPS.find((s) => s.id === setupId) ?? SETUPS[0];
  const ions = setup.atoms.map((s) => atomIon(s));
  const W = setup.atoms.length * CELL;
  const cx = (i: number) => i * CELL + CELL / 2;
  const cy = TOP + SIZE / 2;

  // Charge of each atom in the current phase: metals give at once, nonmetals receive at the end.
  const charges = ions.map((ion, i) => {
    const given = setup.moves.filter(([from]) => from === i).length;
    const taken = setup.moves.filter(([, to]) => to === i).length;
    if (given && phase !== "idle") return given;
    if (taken && phase === "done") return -taken;
    return 0;
  });

  const choose = (id: string) => {
    setSetupId(id);
    setPhase("idle");
  };

  const caption: Text =
    phase === "done"
      ? tx("Opposite charges attract: that's the ionic bond. All ions now have a noble gas configuration.", "Entgegengesetzte Ladungen ziehen sich an: Das ist die Ionenbindung. Alle Ionen haben jetzt Edelgaskonfiguration.")
      : phase === "moving"
        ? tx("The outer electrons jump across…", "Die Außenelektronen springen hinüber …")
        : tx("The metal atom has few outer electrons, the nonmetal atom is missing a few. Press the button!", "Das Metallatom hat wenige Außenelektronen, dem Nichtmetallatom fehlen ein paar. Drück auf den Knopf!");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {SETUPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.id)}
            className={cn(
              "relative h-9 rounded-lg border px-3 text-[14px] transition-colors",
              s.id === setupId ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {s.id === setupId && <motion.span layoutId={`${scope}-pick`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">
              <MathView src={`\\ce{${s.label}}`} size="sm" animate={false} />
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface px-2 py-3">
        <svg viewBox={`0 0 ${W} ${TOP + SIZE + 72}`} className="mx-auto block w-full" style={{ maxWidth: setup.atoms.length * 230 }} role="img" aria-label={t(tx("Electron transfer between atoms", "Elektronenübergang zwischen Atomen"))}>
          {/* attraction between neighbouring ions */}
          <AnimatePresence>
            {phase === "done" &&
              setup.atoms.slice(1).map((_, i) => (
                <motion.g key={`${setup.id}-pull-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.25 }}>
                  <motion.line
                    x1={cx(i) + SIZE / 2 - 4}
                    x2={cx(i + 1) - SIZE / 2 + 4}
                    y1={cy}
                    y2={cy}
                    stroke="var(--blob)"
                    strokeWidth={2}
                    strokeDasharray="4 5"
                    animate={{ strokeDashoffset: [0, -18] }}
                    transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
                  />
                </motion.g>
              ))}
          </AnimatePresence>

          {ions.map((ion, i) => (
            <g key={`${setup.id}-${i}`} transform={`translate(${cx(i) - SIZE / 2} ${TOP})`}>
              <AtomShells z={ion.z} charge={charges[i]} size={SIZE} spin={false} nucleus />
            </g>
          ))}

          {/* flying electrons */}
          {phase === "moving" &&
            setup.moves.map(([from, to], k) => {
              const dir = to > from ? 1 : -1;
              const r1 = outerRadius(ions[from].z, 0);
              const r2 = outerRadius(ions[to].z, 0);
              const x1 = cx(from) + dir * r1;
              const x2 = cx(to) - dir * r2;
              const y = cy + (setup.moves.filter(([f, tt]) => f === from && tt === to).length > 1 ? (k % 2 ? 9 : -9) : 0);
              const last = k === setup.moves.length - 1;
              return (
                <motion.circle
                  key={`${setup.id}-fly-${k}`}
                  r={6}
                  fill="var(--blob)"
                  initial={{ cx: x1, cy: y, opacity: 0 }}
                  animate={{ cx: [x1, (x1 + x2) / 2, x2], cy: [y, y - 46, y], opacity: [1, 1, 1] }}
                  transition={{ duration: 0.9, delay: 0.15 + k * 0.3, ease: "easeInOut" }}
                  onAnimationComplete={last ? () => setPhase("done") : undefined}
                />
              );
            })}

          {/* labels */}
          {ions.map((ion, i) => {
            const layers = ionShells(ion.z, charges[i]);
            const electrons = layers.reduce((s, x) => s + x, 0);
            const noble = charges[i] !== 0 ? nobleFor(electrons) : undefined;
            return (
              <g key={`${setup.id}-label-${i}`}>
                <text x={cx(i)} y={TOP + SIZE + 28} textAnchor="middle" className="fill-ink font-math" style={{ fontSize: 30 }}>
                  {supCharge(ion.symbol, charges[i])}
                </text>
                <text x={cx(i)} y={TOP + SIZE + 58} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 19 }}>
                  {layers.join(" · ")}
                  {noble && ` = ${noble.symbol}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {phase === "idle" ? (
          <button type="button" onClick={() => setPhase("moving")} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob-deep">
            <Zap className="size-4" /> {t(tx("Transfer electrons", "Elektronen übertragen"))}
          </button>
        ) : (
          <button type="button" onClick={() => setPhase("idle")} disabled={phase === "moving"} className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40">
            <RotateCcw className="size-4" /> {t(tx("Again", "Nochmal"))}
          </button>
        )}
        <AnimatePresence mode="wait">
          {phase === "done" && (
            <motion.div key={setup.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-[14px] text-ink-2">
              {t(tx("Salt:", "Salz:"))} <MathView src={`\\ce{${setup.formula}}`} size="md" animate={false} className="text-ink" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={phase} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {t(caption)}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Task visual: an atom in the shell model with its name, centred. */
export function IonicBondsAtom(props: Record<string, unknown>) {
  const t = useText();
  const z = Number(props.z);
  const el = byNumber(z);
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <AtomShells z={z} size={170} spin />
      <div className="text-[13px] text-ink-2">
        {t(el?.name)} <span className="text-ink-3">({el?.symbol})</span>
      </div>
    </div>
  );
}
