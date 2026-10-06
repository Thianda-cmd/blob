"use client";

// Clonal selection and expansion: many B cell clones exist before any contact, each with its own
// receptor. An antigen binds only to the matching clone (selection); a T helper cell activates
// it; it divides into a clone of identical cells (expansion) that become plasma cells, which
// release antibodies with the same binding site, and memory cells.

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Antibody, BCell, EPITOPES, MemoryCell, PlasmaCell, THelper, VirusParticle, type Epitope } from "./ImmuneCells";

const ROW_Y = 70;
const xOf = (i: number) => 60 + i * 96;
const CENTER: [number, number] = [300, 150];
const GRID: [number, number][] = [195, 265, 335, 405].flatMap((x) => [
  [x, 196] as [number, number],
  [x + 0, 252] as [number, number],
]);
const MEMORY = new Set([2, 5]);
const ANTIGENS: Epitope[] = ["tri", "square", "wave"];
const S = 3.6;

type Step = { name: Text; text: Text };
const STEPS: Step[] = [
  { name: tx("Diversity", "Vielfalt"), text: tx("Even before any contact there are millions of B cell clones, each with its own receptor. They arise at random by recombining gene segments. Choose an antigen!", "Schon vor jedem Kontakt gibt es Millionen B-Zell-Klone, jeder mit einem eigenen Rezeptor. Sie entstehen zufällig durch Neukombination von Gen-Abschnitten. Wähl ein Antigen!") },
  { name: tx("Selection", "Selektion"), text: tx("The antigen only binds to the B cell whose receptor fits exactly. It selects the matching clone (clonal selection). The antigen doesn't shape the receptor: the fitting cell was there before.", "Das Antigen bindet nur an die B-Zelle, deren Rezeptor genau passt. Es wählt den passenden Klon aus (klonale Selektion). Das Antigen formt den Rezeptor nicht: Die passende Zelle war schon vorher da.") },
  { name: tx("Activation", "Aktivierung"), text: tx("A T helper cell that recognised the same antigen activates the selected B cell with interleukins.", "Eine T-Helferzelle, die dasselbe Antigen erkannt hat, aktiviert die ausgewählte B-Zelle mit Interleukinen.") },
  { name: tx("Expansion", "Expansion"), text: tx("The activated B cell divides again and again (mitosis): a clone of many identical cells with the same receptor (clonal expansion).", "Die aktivierte B-Zelle teilt sich immer wieder (Mitose): Es entsteht ein Klon aus vielen identischen Zellen mit demselben Rezeptor (klonale Expansion).") },
  { name: tx("Differentiation", "Differenzierung"), text: tx("Most become plasma cells and release antibodies with exactly this binding site. Some become long-lived memory cells.", "Die meisten werden zu Plasmazellen und geben Antikörper mit genau dieser Bindungsstelle ab. Einige werden zu langlebigen Gedächtniszellen.") },
];

const spring = { type: "spring" as const, stiffness: 60, damping: 15 };

export function ImmuneClonal() {
  const t = useText();
  const [antigen, setAntigen] = useState<Epitope>("tri");
  const [s, setS] = useState(0);
  const pick = EPITOPES.indexOf(antigen);
  const px = xOf(pick);
  const virusTop = ROW_Y - 20 - 5 - 12 - 14;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <span>{t(tx("Antigen:", "Antigen:"))}</span>
        {ANTIGENS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAntigen(a);
              setS(1);
            }}
            className={cn("grid size-11 place-items-center rounded-xl border", antigen === a && s > 0 ? "border-blob bg-blob-soft" : "border-line hover:bg-hover")}
            aria-label={t(tx("Choose this antigen", "Dieses Antigen wählen"))}
          >
            <svg viewBox="-22 -22 44 44" width={34} height={34} aria-hidden>
              <VirusParticle r={13} s={S} shape={a} />
            </svg>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 600 320" className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={t(tx("Clonal selection", "Klonale Selektion"))}>
          {EPITOPES.map((e, i) => {
            const chosen = i === pick && s >= 1;
            const moved = i === pick && s >= 2;
            return (
              <motion.g
                key={e}
                initial={{ x: xOf(i), y: ROW_Y }}
                animate={{ x: moved ? CENTER[0] : xOf(i), y: moved ? CENTER[1] : ROW_Y, opacity: s >= 1 && !chosen ? 0.4 : moved && s >= 3 ? 0 : 1 }}
                transition={spring}
              >
                <BCell r={20} shape={e} s={S} angles={[-90, -30, 30, 90, 150, 210]} glow={chosen && s <= 2} />
              </motion.g>
            );
          })}
          {/* the antigen */}
          <motion.g
            key={`ag-${antigen}`}
            initial={{ x: 300, y: -30 }}
            animate={s === 0 ? { x: 300, y: -30, opacity: 0 } : s === 1 ? { x: px, y: virusTop, opacity: 1 } : s === 2 ? { x: CENTER[0], y: CENTER[1] - (ROW_Y - virusTop), opacity: 1 } : { x: CENTER[0], y: CENTER[1] - 40, opacity: 0 }}
            transition={spring}
          >
            <VirusParticle r={14} s={S} shape={antigen} angles={[90, 150, 210, 270, 330, 30]} />
          </motion.g>
          {/* T helper */}
          <motion.g initial={{ x: 640, y: CENTER[1] }} animate={s === 2 ? { x: CENTER[0] + 66, y: CENTER[1] + 6, opacity: 1 } : { x: 640, y: CENTER[1], opacity: 0 }} transition={spring}>
            <THelper r={20} shape={antigen} s={S} angles={[180, -120, -60, 0, 60, 120]} glow={s === 2} />
          </motion.g>
          {s === 2 &&
            [0, 1, 2].map((i) => (
              <motion.circle key={`il${i}`} r={3.2} fill="var(--blob)" initial={{ cx: CENTER[0] + 40, cy: CENTER[1] + 2, opacity: 0 }} animate={{ cx: CENTER[0] + 18, opacity: [0, 1, 0] }} transition={{ duration: 1, delay: 0.8 + i * 0.25, repeat: 2 }} />
            ))}
          {/* the clone */}
          {GRID.map(([x, y], i) => {
            const mem = MEMORY.has(i);
            const diff = s >= 4;
            return (
              <motion.g key={`g${i}-${antigen}`} initial={{ x: CENTER[0], y: CENTER[1], opacity: 0, scale: 0.4 }} animate={s >= 3 ? { x, y, opacity: 1, scale: 1 } : { x: CENTER[0], y: CENTER[1], opacity: 0, scale: 0.4 }} transition={{ ...spring, delay: s === 3 ? i * 0.12 : 0 }}>
                <motion.g animate={{ opacity: diff ? 0 : 1 }}>
                  <BCell r={18} shape={antigen} s={S} angles={[-90, -30, 30, 90, 150, 210]} />
                </motion.g>
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: diff ? 1 : 0 }} transition={{ delay: diff ? 0.3 + i * 0.08 : 0 }}>
                  {mem ? <MemoryCell r={16} shape={antigen} kind="b" glow /> : <PlasmaCell r={19} />}
                </motion.g>
              </motion.g>
            );
          })}
          {/* antibodies from the plasma cells */}
          {GRID.flatMap(([x, y], i) =>
            MEMORY.has(i)
              ? []
              : [0, 1].map((k) => (
                  <motion.g
                    key={`ab${i}-${k}-${antigen}`}
                    initial={{ x, y, opacity: 0, rotate: 0 }}
                    animate={s >= 4 ? { x: x + (k ? 26 : -24), y: y + (y > 220 ? 50 : -48), opacity: 1, rotate: k ? 25 : -20 } : { x, y, opacity: 0, rotate: 0 }}
                    transition={{ ...spring, delay: s >= 4 ? 0.9 + i * 0.1 + k * 0.15 : 0 }}
                  >
                    <Antibody shape={antigen} s={S} width={2.6} />
                  </motion.g>
                )),
          )}
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setS(Math.max(0, s - 1))} disabled={s === 0} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40" aria-label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1.5">
          {STEPS.map((st, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setS(i)}
              className={cn("rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors", i === s ? "border-blob bg-blob-soft text-blob-ink" : i < s ? "border-line text-ink-2" : "border-line text-ink-3 hover:text-ink")}
            >
              {i + 1}. {t(st.name)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setS(Math.min(STEPS.length - 1, s + 1))} disabled={s === STEPS.length - 1} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-paper disabled:opacity-40" aria-label={t(tx("Next step", "Nächster Schritt"))}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      <motion.p key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{t(STEPS[s].name)}: </span>
        {t(STEPS[s].text)}
      </motion.p>
    </div>
  );
}
