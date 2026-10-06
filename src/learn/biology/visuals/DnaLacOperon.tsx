"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Segmented } from "./DnaKit";

type Kind = "lac" | "trp";

const DNA_Y = 176;
const DNA_H = 22;
type Box = { id: string; x0: number; x1: number; fill: string; label: string };

const LAC: Box[] = [
  { id: "reg", x0: 20, x1: 100, fill: "var(--bio-petal)", label: "lacI" },
  { id: "p", x0: 130, x1: 175, fill: "var(--bio-sun)", label: "P" },
  { id: "o", x0: 175, x1: 215, fill: "var(--bio-mito)", label: "O" },
  { id: "z", x0: 215, x1: 335, fill: "var(--bio-leaf)", label: "lacZ" },
  { id: "y", x0: 335, x1: 435, fill: "var(--bio-leaf)", label: "lacY" },
  { id: "a", x0: 435, x1: 520, fill: "var(--bio-leaf)", label: "lacA" },
];
const TRP: Box[] = [
  { id: "reg", x0: 20, x1: 100, fill: "var(--bio-petal)", label: "trpR" },
  { id: "p", x0: 130, x1: 175, fill: "var(--bio-sun)", label: "P" },
  { id: "o", x0: 175, x1: 215, fill: "var(--bio-mito)", label: "O" },
  { id: "e", x0: 215, x1: 278, fill: "var(--bio-leaf)", label: "E" },
  { id: "d", x0: 278, x1: 341, fill: "var(--bio-leaf)", label: "D" },
  { id: "c", x0: 341, x1: 404, fill: "var(--bio-leaf)", label: "C" },
  { id: "b", x0: 404, x1: 467, fill: "var(--bio-leaf)", label: "B" },
  { id: "a2", x0: 467, x1: 530, fill: "var(--bio-leaf)", label: "A" },
];

const NOTES: Record<Kind, [Text, Text]> = {
  lac: [
    tx(
      "No lactose: the repressor (made by the regulator gene lacI) sits on the operator. RNA polymerase can't get past it. The genes for breaking down lactose are switched off: no energy wasted.",
      "Keine Lactose: Der Repressor (gebildet vom Regulatorgen lacI) sitzt auf dem Operator. Die RNA-Polymerase kommt nicht vorbei. Die Gene für den Lactoseabbau sind abgeschaltet: Die Zelle spart Energie.",
    ),
    tx(
      "Lactose there: lactose (as allolactose) binds the repressor as inducer. The repressor changes its shape and lets go of the operator. RNA polymerase transcribes lacZ, lacY and lacA: the enzymes for using lactose are made. Substrate induction!",
      "Lactose da: Lactose (als Allolactose) bindet als Induktor an den Repressor. Der Repressor ändert seine Form und löst sich vom Operator. Die RNA-Polymerase transkribiert lacZ, lacY und lacA: Die Enzyme für die Lactoseverwertung werden gebildet. Substratinduktion!",
    ),
  ],
  trp: [
    tx(
      "Little tryptophan: the trp repressor is inactive and doesn't bind the operator. The genes trpE to trpA are transcribed: the cell makes the enzymes to build tryptophan itself.",
      "Wenig Tryptophan: Der trp-Repressor ist inaktiv und bindet nicht an den Operator. Die Gene trpE bis trpA werden abgelesen: Die Zelle bildet die Enzyme, um Tryptophan selbst herzustellen.",
    ),
    tx(
      "Plenty of tryptophan: the end product binds the repressor as corepressor and activates it. Now it sits on the operator and blocks transcription. End product repression!",
      "Viel Tryptophan: Das Endprodukt bindet als Corepressor an den Repressor und aktiviert ihn. Jetzt sitzt er auf dem Operator und blockiert die Transkription. Endproduktrepression!",
    ),
  ],
};

/** The repressor: fits the operator with its foot when active; tilted when inactive. */
function Repressor({ active, x, y }: { active: boolean; x: number; y: number }) {
  return (
    <motion.g initial={false} animate={{ x, y, rotate: active ? 0 : -24 }} transition={{ type: "spring", stiffness: 90, damping: 16 }}>
      <path
        d="M-24 -16 Q-24 -28 -12 -28 L12 -28 Q24 -28 24 -16 L24 6 L14 6 L14 14 L6 14 L6 6 L-6 6 L-6 14 L-14 14 L-14 6 L-24 6 Z"
        fill="var(--bio-petal)"
        stroke="var(--bio-petal-deep)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={-12} cy={-28} r={6} fill="var(--raised)" stroke="var(--bio-petal-deep)" strokeWidth={1.5} />
    </motion.g>
  );
}

/** Lactose (two linked sugar rings) or tryptophan (a small ring pair) as a small molecule. */
function Molecule({ kind, x, y }: { kind: Kind; x: number; y: number }) {
  if (kind === "lac")
    return (
      <g transform={`translate(${x} ${y})`}>
        <polygon points="-13,0 -9,-6 -2,-6 1,0 -2,6 -9,6" fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
        <polygon points="1,0 4,-6 11,-6 15,0 11,6 4,6" fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
      </g>
    );
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points="-11,0 -7,-6 0,-6 3,0 0,6 -7,6" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
      <polygon points="3,0 6,-5 11,-3 11,3 6,5" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
    </g>
  );
}

const FLOAT: [number, number][] = [
  [330, 40],
  [420, 70],
  [500, 34],
  [250, 66],
  [530, 92],
];

/** The lac operon (substrate induction) and the trp operon (end product repression), switched by a toggle. */
export function DnaLacOperon({ start = "lac" }: { start?: Kind }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<Kind>(start);
  const [present, setPresent] = useState(false);
  const boxes = kind === "lac" ? LAC : TRP;
  // lac: repressor active without lactose. trp: repressor active only with tryptophan.
  const repressorActive = kind === "lac" ? !present : present;
  const on = !repressorActive;
  const end = boxes[boxes.length - 1].x1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Kind>
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPresent(false);
          }}
          label={t(tx("Operon", "Operon"))}
          options={[
            { id: "lac", label: t(tx("lac operon", "lac-Operon")) },
            { id: "trp", label: t(tx("trp operon", "trp-Operon")) },
          ]}
        />
        <button
          type="button"
          role="switch"
          aria-checked={present}
          onClick={() => setPresent(!present)}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-[14px] font-medium text-ink"
        >
          <span className={cn("relative h-6 w-11 rounded-full transition-colors", present ? "bg-blob" : "bg-line-2")}>
            <motion.span layout className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow", present ? "right-0.5" : "left-0.5")} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
          </span>
          {t(kind === "lac" ? tx("Lactose in the medium", "Lactose im Medium") : tx("Tryptophan in the medium", "Tryptophan im Medium"))}
        </button>
      </div>

      <svg viewBox="0 0 580 250" className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(kind === "lac" ? tx("lac operon", "lac-Operon") : tx("trp operon", "trp-Operon"))}>
        {/* free molecules (lactose / tryptophan) */}
        <AnimatePresence>
          {present &&
            FLOAT.map(([x, y], k) => (
              <motion.g key={`${kind}-m${k}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.06 * k }}>
                <Molecule kind={kind} x={x} y={y} />
              </motion.g>
            ))}
        </AnimatePresence>

        {/* DNA */}
        <line x1={100} y1={DNA_Y + DNA_H / 2} x2={130} y2={DNA_Y + DNA_H / 2} stroke="var(--bio-outline)" strokeWidth={3} />
        <line x1={end} y1={DNA_Y + DNA_H / 2} x2={566} y2={DNA_Y + DNA_H / 2} stroke="var(--bio-outline)" strokeWidth={3} />
        {boxes.map((b) => (
          <g key={b.id}>
            <rect x={b.x0} y={DNA_Y} width={b.x1 - b.x0} height={DNA_H} fill={b.fill} stroke="var(--bio-outline)" strokeWidth={1.6} />
            <text x={(b.x0 + b.x1) / 2} y={DNA_Y + DNA_H / 2} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--ink)" fontStyle={b.id === "p" || b.id === "o" ? "normal" : "italic"} style={{ fontFamily: "var(--font-sans)" }}>
              {b.label}
            </text>
          </g>
        ))}
        <text x={(215 + end) / 2} y={DNA_Y + DNA_H + 18} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("structural genes", "Strukturgene"))}
        </text>
        <text x={60} y={DNA_Y + DNA_H + 18} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("regulator gene", "Regulatorgen"))}
        </text>
        {/* regulator gene makes the repressor all the time */}
        <path d="M60 172 Q60 120 84 96" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeDasharray="4 4" />

        {/* mRNA and enzymes when the genes are on */}
        <AnimatePresence>
          {on && (
            <motion.g key={`${kind}-on`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.path
                d={`M215 136 ${Array.from({ length: Math.ceil((end - 215) / 20) }, (_, k) => `Q${225 + k * 20} ${k % 2 ? 142 : 130} ${235 + k * 20} 136`).join(" ")}`}
                fill="none"
                stroke="var(--bio-u)"
                strokeWidth={3}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduce ? 0 : 1.4 }}
              />
              {(kind === "lac" ? [280, 385, 478] : [246, 310, 372, 436, 498]).map((x, k) => (
                <motion.g key={x} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: reduce ? 0 : 1 + 0.15 * k, type: "spring", stiffness: 300, damping: 18 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                  <path d={`M${x - 14} 104 Q${x - 16} 88 ${x} 86 Q${x + 16} 88 ${x + 14} 104 Q${x} 112 ${x - 14} 104 Z`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
                </motion.g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* RNA polymerase */}
        <motion.g
          initial={false}
          animate={on && !reduce ? { x: [0, end - 175, end - 175], opacity: [1, 1, 0] } : { x: on ? 120 : 0, opacity: 1 }}
          transition={on && !reduce ? { duration: 3.2, repeat: Infinity, ease: "linear", times: [0, 0.9, 1] } : { type: "spring", stiffness: 120, damping: 18 }}
        >
          <ellipse cx={150} cy={DNA_Y + 4} rx={26} ry={20} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={2} opacity={0.9} />
        </motion.g>

        {/* repressor (with inducer / corepressor) */}
        <Repressor active={repressorActive} x={repressorActive ? 195 : 104} y={repressorActive ? DNA_Y - 15 : 80} />
        <AnimatePresence>
          {present && (
            <motion.g
              key={`${kind}-bound`}
              initial={{ opacity: 0, x: 330, y: 40 }}
              animate={{ opacity: 1, x: repressorActive ? 183 : 92, y: repressorActive ? DNA_Y - 43 : 52 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 90, damping: 16 }}
            >
              <Molecule kind={kind} x={0} y={0} />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
        <span>{t(tx("P = promoter, O = operator", "P = Promotor, O = Operator"))}</span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border" style={{ background: "var(--bio-petal)", borderColor: "var(--bio-petal-deep)" }} /> {t(tx("repressor", "Repressor"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border" style={{ background: "var(--bio-nucleus)", borderColor: "var(--bio-nucleus-deep)" }} /> {t(tx("RNA polymerase", "RNA-Polymerase"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded-full" style={{ background: "var(--bio-u)" }} /> mRNA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-t-full border" style={{ background: "var(--bio-leaf)", borderColor: "var(--bio-leaf-deep)" }} />{" "}
          {t(kind === "lac" ? tx("enzymes for lactose breakdown", "Enzyme für den Lactoseabbau") : tx("enzymes for tryptophan synthesis", "Enzyme für die Tryptophansynthese"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rotate-45 rounded-[3px] border" style={kind === "lac" ? { background: "var(--bio-sun)", borderColor: "var(--bio-wood-deep)" } : { background: "var(--bio-leaf)", borderColor: "var(--bio-leaf-deep)" }} />{" "}
          {t(kind === "lac" ? tx("lactose (inducer)", "Lactose (Induktor)") : tx("tryptophan (corepressor)", "Tryptophan (Corepressor)"))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className={cn("rounded-full px-2.5 py-0.5", repressorActive ? "bg-danger/10 text-danger" : "bg-hover text-ink-2")}>
          {t(tx("Repressor:", "Repressor:"))} {t(repressorActive ? tx("active, on the operator", "aktiv, am Operator") : tx("inactive", "inaktiv"))}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5", on ? "bg-ok/15 text-ok" : "bg-hover text-ink-2")}>
          {t(tx("Structural genes:", "Strukturgene:"))} {t(on ? tx("transcribed", "werden abgelesen") : tx("switched off", "abgeschaltet"))}
        </span>
      </div>

      <motion.p key={`${kind}-${present}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug text-ink" aria-live="polite">
        {t(NOTES[kind][present ? 1 : 0])}
      </motion.p>
    </div>
  );
}
