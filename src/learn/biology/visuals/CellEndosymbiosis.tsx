"use client";

// The endosymbiotic theory step by step (topic "cell", level 3): a host cell engulfs an aerobic
// bacterium, which survives inside and becomes a mitochondrion; later a cyanobacterium becomes
// the chloroplast. The last step lists the evidence.

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Chloroplast, Mitochondrion } from "./CellOrganelles";
import { cos, sin } from "@/lib/stableMath";

const W = 540;
const H = 330;
const CX = 250;
const CY = 168;
const A = 128;
const B = 112;

/** The host's outline; `cup` > 0 makes the membrane flow around a particle at angle `at` (radians). */
function host(cup: number, at: number) {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const th = (i / 96) * 2 * Math.PI;
    const r0 = (A * B) / Math.sqrt((B * cos(th)) ** 2 + (A * sin(th)) ** 2);
    let d = th - at;
    d = Math.atan2(sin(d), cos(d));
    const arms = Math.exp(-((d - 0.27) ** 2) / (2 * 0.085 ** 2)) + Math.exp(-((d + 0.27) ** 2) / (2 * 0.085 ** 2));
    const dent = Math.exp(-(d ** 2) / (2 * 0.12 ** 2));
    const r = r0 + cup * (46 * arms - 14 * dent);
    pts.push(`${(CX + r * cos(th)).toFixed(1)} ${(CY + r * sin(th)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

const AT_BACT = -0.32;
const AT_CYANO = 0.42;
const pos = (at: number, r: number) => ({ x: CX + r * cos(at), y: CY + r * sin(at) });

type Step = { title: Text; body: Text; cup: number; at: number; bact: { x: number; y: number }; bactRing: boolean; mito: boolean; cyano: { x: number; y: number } | null; cyanoRing: boolean; chloro: boolean };

const OUT_B = pos(AT_BACT, 215);
const CUP_B = pos(AT_BACT, 140);
const IN_B = { x: 318, y: 112 };
const OUT_C = pos(AT_CYANO, 225);
const CUP_C = pos(AT_CYANO, 140);
const IN_C = { x: 300, y: 226 };

const STEPS: Step[] = [
  {
    title: tx("Two separate cells", "Zwei getrennte Zellen"),
    body: tx("Roughly 1.5 to 2 billion years ago: a large host cell that feeds by engulfing particles, and a small aerobic bacterium that gets a lot of energy out of food using oxygen.", "Vor rund 1,5 bis 2 Milliarden Jahren: eine große Wirtszelle, die Nahrung durch Umfließen aufnimmt, und ein kleines aerobes Bakterium, das mit Sauerstoff viel Energie aus Nährstoffen gewinnt."),
    cup: 0,
    at: AT_BACT,
    bact: OUT_B,
    bactRing: false,
    mito: false,
    cyano: null,
    cyanoRing: false,
    chloro: false,
  },
  {
    title: tx("Endocytosis", "Endocytose"),
    body: tx("The host's membrane flows around the bacterium and pinches off inwards: the bacterium is now inside a membrane vesicle.", "Die Membran der Wirtszelle umfließt das Bakterium und schnürt sich nach innen ab: Das Bakterium liegt jetzt in einem Membranbläschen."),
    cup: 1,
    at: AT_BACT,
    bact: CUP_B,
    bactRing: false,
    mito: false,
    cyano: null,
    cyanoRing: false,
    chloro: false,
  },
  {
    title: tx("Not digested: two membranes", "Nicht verdaut: zwei Membranen"),
    body: tx("The bacterium is not digested and lives on. Now it is wrapped in two membranes: its own (inner) and the vesicle membrane of the host (outer).", "Das Bakterium wird nicht verdaut und lebt weiter. Jetzt ist es von zwei Membranen umgeben: seiner eigenen (innen) und der Bläschenmembran des Wirts (außen)."),
    cup: 0,
    at: AT_BACT,
    bact: IN_B,
    bactRing: true,
    mito: false,
    cyano: null,
    cyanoRing: false,
    chloro: false,
  },
  {
    title: tx("Endosymbiosis: a mitochondrion", "Endosymbiose: ein Mitochondrium"),
    body: tx("Both profit: the bacterium supplies ATP from cellular respiration, the host supplies nutrients and protection. Over time many of its genes move into the host's nucleus, so it can no longer live on its own: it has become a mitochondrion.", "Beide profitieren: Das Bakterium liefert ATP aus der Zellatmung, der Wirt Nährstoffe und Schutz. Mit der Zeit wandern viele seiner Gene in den Zellkern des Wirts, sodass es allein nicht mehr leben kann: Es ist ein Mitochondrium geworden."),
    cup: 0,
    at: AT_BACT,
    bact: IN_B,
    bactRing: false,
    mito: true,
    cyano: null,
    cyanoRing: false,
    chloro: false,
  },
  {
    title: tx("Later: a cyanobacterium", "Später: ein Cyanobakterium"),
    body: tx("Some of these cells later engulfed a cyanobacterium, a bacterium that does photosynthesis, in the same way.", "Einige dieser Zellen nahmen später auf die gleiche Weise ein Cyanobakterium auf, ein Bakterium, das Fotosynthese betreibt."),
    cup: 1,
    at: AT_CYANO,
    bact: IN_B,
    bactRing: false,
    mito: true,
    cyano: CUP_C,
    cyanoRing: false,
    chloro: false,
  },
  {
    title: tx("A chloroplast: the first algae and plants", "Ein Chloroplast: die ersten Algen und Pflanzen"),
    body: tx("The cyanobacterium became the chloroplast. That's why plant cells have both organelles, animal cells only mitochondria.", "Aus dem Cyanobakterium wurde der Chloroplast. Deshalb haben Pflanzenzellen beide Organellen, Tierzellen nur Mitochondrien."),
    cup: 0,
    at: AT_CYANO,
    bact: IN_B,
    bactRing: false,
    mito: true,
    cyano: IN_C,
    cyanoRing: false,
    chloro: true,
  },
];

const EVIDENCE: Text[] = [
  tx("two membranes (double membrane)", "zwei Membranen (Doppelmembran)"),
  tx("their own ring-shaped DNA, like bacteria", "eigene ringförmige DNA wie bei Bakterien"),
  tx("their own 70S ribosomes, like bacteria", "eigene 70S-Ribosomen wie bei Bakterien"),
  tx("they only arise by dividing, like bacteria", "sie entstehen nur durch Teilung, wie Bakterien"),
  tx("about the size of bacteria", "etwa so groß wie Bakterien"),
];

const spring = { type: "spring" as const, stiffness: 60, damping: 15 };

function Bacterium({ green }: { green: boolean }) {
  return (
    <g>
      <rect x={-24} y={-12} width={48} height={24} rx={12} fill={green ? "var(--bio-chloro)" : "var(--bio-mito)"} stroke={green ? "var(--bio-leaf-deep)" : "var(--bio-mito-deep)"} strokeWidth={1.8} />
      {green ? (
        <path d="M -16 -4 L 16 -4 M -16 2 L 16 2 M -14 7 L 14 7" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      ) : (
        <>
          <circle cx={-6} cy={0} r={5} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
          {[
            [6, -5],
            [12, 3],
            [4, 6],
            [-15, -4],
            [-14, 5],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.5} fill="var(--bio-outline)" />
          ))}
        </>
      )}
    </g>
  );
}

export function CellEndosymbiosis({ start = 0 }: { start?: number }) {
  const t = useText();
  const [i, setI] = useState(start);
  const S = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,290px)] md:items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Endosymbiotic theory", "Endosymbiontentheorie"))}>
          <motion.path initial={false} animate={{ d: host(S.cup, S.at) }} transition={spring} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2.8} strokeLinejoin="round" />
          <circle cx={CX - 52} cy={CY + 6} r={38} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
          <circle cx={CX - 44} cy={CY} r={9} fill="var(--bio-nucleus-deep)" opacity={0.55} />
          {/* the aerobic bacterium, later the mitochondrion */}
          <motion.g initial={false} animate={{ x: S.bact.x, y: S.bact.y }} transition={spring}>
            <motion.circle r={33} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.2} initial={false} animate={{ opacity: S.bactRing ? 1 : 0, scale: S.bactRing ? 1 : 1.3 }} transition={spring} />
            <motion.g initial={false} animate={{ opacity: S.mito ? 0 : 1 }}>
              <Bacterium green={false} />
            </motion.g>
            <motion.g initial={false} animate={{ opacity: S.mito ? 1 : 0, scale: S.mito ? 1 : 0.6 }} transition={spring}>
              <Mitochondrion x={0} y={0} l={28} w={14} />
            </motion.g>
          </motion.g>
          {S.mito && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <path d={`M ${IN_B.x - 34} ${IN_B.y + 14} Q ${IN_B.x - 70} ${IN_B.y + 30} ${CX - 30} ${CY - 26}`} fill="none" stroke="var(--blob)" strokeWidth={2} strokeDasharray="4 3" />
              <text x={IN_B.x - 74} y={IN_B.y + 18} fontSize={12} fontWeight={700} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
                ATP
              </text>
            </motion.g>
          )}
          {/* the cyanobacterium, later the chloroplast */}
          <AnimatePresence>
            {S.cyano && (
              <motion.g key="cyano" initial={{ opacity: 0, x: OUT_C.x, y: OUT_C.y }} animate={{ opacity: 1, x: S.cyano.x, y: S.cyano.y }} exit={{ opacity: 0 }} transition={spring}>
                <motion.g initial={false} animate={{ opacity: S.chloro ? 0 : 1 }}>
                  <Bacterium green />
                </motion.g>
                <motion.g initial={false} animate={{ opacity: S.chloro ? 1 : 0, scale: S.chloro ? 1 : 0.6 }} transition={spring}>
                  <Chloroplast x={0} y={0} rx={30} ry={15} em />
                </motion.g>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-surface px-3.5 py-3 text-[14px] leading-relaxed text-ink-2" aria-live="polite">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-blob-ink">
              {t(tx("Step", "Schritt"))} {i + 1}/{STEPS.length}
            </div>
            <div className="mb-1 font-semibold text-ink">{t(S.title)}</div>
            {t(S.body)}
            {last && (
              <div className="mt-2.5 border-t border-line pt-2">
                <div className="mb-1 font-semibold text-ink">{t(tx("Evidence: mitochondria and chloroplasts have", "Belege: Mitochondrien und Chloroplasten haben"))}</div>
                <ul className="list-disc space-y-0.5 pl-5">
                  {EVIDENCE.map((e, k) => (
                    <li key={k}>{t(e)}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-[14px] font-medium text-ink-2 hover:bg-hover disabled:opacity-40">
          <ChevronLeft className="size-4" /> {t(tx("Back", "Zurück"))}
        </button>
        <button type="button" onClick={() => setI(last ? 0 : i + 1)} className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]">
          {last ? (
            <>
              <RotateCcw className="size-4" /> {t(tx("From the start", "Von vorn"))}
            </>
          ) : (
            <>
              {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
            </>
          )}
        </button>
        <div className="ml-auto flex gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={cn("size-2 rounded-full transition-colors", k === i ? "bg-blob" : k < i ? "bg-blob/40" : "bg-line-2")} />
          ))}
        </div>
      </div>
    </div>
  );
}
