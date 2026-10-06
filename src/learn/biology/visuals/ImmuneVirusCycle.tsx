"use client";

// How a virus multiplies inside a host cell, step by step. Level 2: docking, entry, release of
// the genetic material, copying and protein synthesis by the host cell, assembly and release.
// Level 3 (`hiv`): the HIV cycle in a T helper cell with reverse transcription and integration
// into the host's DNA (provirus).

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { bumpPath, cupHeight, cupPath, PAINT, VirusParticle, type Epitope } from "./ImmuneCells";

const CX = 280;
const CY = 232;
const RX = 240;
const RY = 140;
const RV = 22;
const SV = 5;
const memY = (x: number) => CY - RY * Math.sqrt(Math.max(0, 1 - ((x - CX) / RX) ** 2));
const RECEPTORS = [196, 280, 364];
const STALK = 5;
const DOCK_Y = memY(CX) - STALK - cupHeight(SV) - RV;
const ANGLES = [90, 135, 180, 225, 270, 315, 0, 45];

const INSIDE: [number, number][] = [
  [150, 168],
  [222, 140],
  [342, 140],
  [414, 170],
  [178, 222],
  [430, 222],
];
const OUTSIDE: [number, number][] = [
  [92, 52],
  [196, 24],
  [372, 26],
  [478, 58],
  [36, 118],
  [528, 132],
];
const COPIES: [number, number][] = [
  [148, 192],
  [204, 214],
  [380, 196],
  [430, 222],
];
const PROTEINS: [number, number][] = [
  [124, 150],
  [176, 238],
  [250, 196],
  [328, 182],
  [396, 150],
  [454, 196],
];

type Step = { name: Text; text: Text };

const STEPS: Step[] = [
  { name: tx("Docking", "Andocken"), text: tx("The virus attaches with its surface proteins to matching receptors of the host cell, like a key in a lock. That's why each virus only infects certain cells.", "Das Virus heftet sich mit seinen Oberflächenproteinen an passende Rezeptoren der Wirtszelle, wie ein Schlüssel ins Schloss. Deshalb befällt jedes Virus nur bestimmte Zellen.") },
  { name: tx("Entry", "Eindringen"), text: tx("The virus is taken up into the cell.", "Das Virus wird in die Zelle aufgenommen.") },
  { name: tx("Uncoating", "Erbinformation frei"), text: tx("The coats are broken down and the virus's genetic material is set free.", "Die Hüllen werden abgebaut, die Erbinformation des Virus wird frei.") },
  { name: tx("Multiplication", "Vermehrung"), text: tx("The host cell is reprogrammed: it copies the viral genetic material and uses its ribosomes to make viral proteins.", "Die Wirtszelle wird umprogrammiert: Sie kopiert die Erbinformation des Virus und stellt mit ihren Ribosomen Virusproteine her.") },
  { name: tx("Assembly", "Zusammenbau"), text: tx("The copies and proteins are put together into many new viruses.", "Aus den Kopien und Proteinen werden viele neue Viren zusammengebaut.") },
  { name: tx("Release", "Freisetzung"), text: tx("The new viruses leave the cell, which often dies, and infect more cells.", "Die neuen Viren verlassen die Zelle, die dabei oft zugrunde geht, und befallen weitere Zellen.") },
];

const HIV_STEPS: Step[] = [
  { name: tx("Docking", "Andocken"), text: tx("The envelope protein gp120 of HIV fits the CD4 receptor of a T helper cell (plus a co-receptor).", "Das Hüllprotein gp120 des HI-Virus passt zum CD4-Rezeptor einer T-Helferzelle (und zu einem Corezeptor).") },
  { name: tx("Fusion", "Fusion"), text: tx("The viral envelope fuses with the cell membrane. The capsid with two RNA strands and the viral enzymes enters the cytoplasm.", "Die Virushülle verschmilzt mit der Zellmembran. Das Kapsid mit zwei RNA-Strängen und den Virusenzymen gelangt ins Cytoplasma.") },
  { name: tx("Reverse transcription", "Reverse Transkription"), text: tx("The enzyme reverse transcriptase rewrites the viral RNA into DNA. Hence 'retrovirus': the information flows backwards, from RNA to DNA.", "Das Enzym reverse Transkriptase schreibt die Virus-RNA in DNA um. Daher der Name Retrovirus: Die Information fließt rückwärts, von RNA zu DNA.") },
  { name: tx("Integration", "Integration"), text: tx("The viral DNA enters the nucleus. The enzyme integrase inserts it into the host cell's DNA: a provirus. It can rest there for years.", "Die Virus-DNA gelangt in den Zellkern. Das Enzym Integrase baut sie in die DNA der Wirtszelle ein: ein Provirus. Dort kann es jahrelang ruhen.") },
  { name: tx("Transcription and translation", "Transkription und Translation"), text: tx("When the cell becomes active, viral RNA and viral proteins are made from the provirus.", "Wird die Zelle aktiv, entstehen nach dem Bauplan des Provirus Virus-RNA und Virusproteine.") },
  { name: tx("Budding", "Knospung"), text: tx("New viruses are assembled at the membrane and bud off. In the end the T helper cell is destroyed.", "Neue Viren werden an der Membran zusammengebaut und schnüren sich ab. Am Ende geht die T-Helferzelle zugrunde.") },
];

const spring = { type: "spring" as const, stiffness: 60, damping: 15 };

function Strand({ color, double }: { color: string; double?: boolean }) {
  return (
    <g>
      <path d="M -18 0 c 6 -8 12 8 18 0 s 12 -8 18 0" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      {double && <path d="M -18 5 c 6 -8 12 8 18 0 s 12 -8 18 0" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />}
    </g>
  );
}

export function ImmuneVirusCycle({ hiv = false }: { hiv?: boolean }) {
  const t = useText();
  const steps = hiv ? HIV_STEPS : STEPS;
  const [s, setS] = useState(0);
  const shape: Epitope = hiv ? "round" : "tri";
  const host = hiv ? PAINT.th : PAINT.body;
  const dying = s === 5;

  // what is visible in which step
  const virusPos = s === 0 ? { x: CX, y: DOCK_Y, opacity: 1, scale: 1 } : hiv ? { x: CX, y: memY(CX) - 4, opacity: 0, scale: 1.05 } : s === 1 ? { x: CX, y: 156, opacity: 1, scale: 0.85 } : { x: CX, y: 156, opacity: 0, scale: 0.6 };
  const showGenome = hiv ? s === 1 || s === 2 : s === 2;
  const showCopies = hiv ? s === 4 : s === 3;
  const showProteins = hiv ? s === 4 : s === 3;
  const built = hiv ? s >= 5 : s >= 4;
  const out = s >= 5;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 560 340" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={hiv ? t(tx("Replication cycle of HIV", "Vermehrungszyklus von HIV")) : t(tx("Replication cycle of a virus", "Vermehrungszyklus eines Virus"))}>
          {/* host cell */}
          <motion.ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill={host.fill} stroke={host.stroke} strokeWidth={3} animate={{ opacity: dying ? 0.7 : 1 }} strokeDasharray={dying ? "10 7" : undefined} />
          {/* nucleus with host DNA */}
          <ellipse cx={300} cy={264} rx={80} ry={50} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
          <path d="M 236 256 c 14 -12 26 12 40 0 s 26 12 40 0 s 26 12 40 0" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M 244 280 c 14 -12 26 12 40 0 s 26 12 40 0 s 22 10 30 2" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.2} strokeLinecap="round" />
          {hiv && (
            <motion.path d="M 276 256 c 8 -8 16 8 24 0" fill="none" stroke="var(--bio-t)" strokeWidth={4} strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: s >= 3 ? 1 : 0 }} transition={{ delay: s === 3 ? 1.2 : 0 }} />
          )}
          {/* receptors on the membrane */}
          {RECEPTORS.map((x) => {
            const y = memY(x);
            const tilt = (Math.atan2(RY * ((x - CX) / RX), RX * Math.sqrt(1 - ((x - CX) / RX) ** 2)) * 180) / Math.PI;
            return (
              <g key={x} transform={`translate(${x} ${Math.round(y * 10) / 10}) rotate(${Math.round(tilt)})`}>
                <line x1={0} y1={2} x2={0} y2={-STALK} stroke={host.stroke} strokeWidth={2.6} />
                <path d={cupPath(shape, SV)} transform={`translate(0 ${-(STALK + cupHeight(SV))}) rotate(180)`} fill={host.stroke} />
              </g>
            );
          })}
          {/* the infecting virus */}
          <motion.g initial={{ x: CX, y: -40 }} animate={virusPos} transition={spring}>
            <VirusParticle r={RV} s={SV} shape={shape} angles={ANGLES} />
          </motion.g>
          {/* entry vesicle (level 2) */}
          {!hiv && <motion.circle cx={CX} cy={156} r={30} fill="none" stroke={host.stroke} strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: s === 1 ? 1 : 0 }} transition={{ delay: s === 1 ? 0.6 : 0 }} />}
          {/* HIV capsid in the cytoplasm */}
          {hiv && (
            <motion.path d="M -14 -16 L 14 -10 L 10 12 L -10 16 Z" fill={PAINT.virus.fill} stroke={PAINT.virus.stroke} strokeWidth={2} initial={{ x: CX, y: 150, opacity: 0 }} animate={{ x: CX, y: 160, opacity: s === 1 ? 1 : 0 }} transition={{ delay: s === 1 ? 0.6 : 0 }} />
          )}
          {/* the genetic material: RNA, and for HIV the DNA copy */}
          <motion.g initial={{ x: CX, y: 160, opacity: 0 }} animate={{ x: hiv ? CX - 30 : CX - 40, y: hiv ? 168 : 176, opacity: showGenome ? 1 : 0 }} transition={{ ...spring, delay: showGenome && s === (hiv ? 1 : 2) ? 0.6 : 0 }}>
            <Strand color="var(--bio-u)" double={hiv} />
          </motion.g>
          {hiv && (
            <>
              <motion.g initial={{ x: CX + 26, y: 168, opacity: 0 }} animate={s === 2 ? { x: CX + 26, y: 168, opacity: 1 } : s === 3 ? { x: 290, y: 258, opacity: [1, 1, 0] } : { x: CX + 26, y: 168, opacity: 0 }} transition={s === 3 ? { duration: 1.6 } : { delay: s === 2 ? 0.9 : 0 }}>
                <Strand color="var(--bio-t)" double />
              </motion.g>
              <motion.circle r={7} fill="var(--bio-mito-deep)" initial={{ cx: CX - 50, cy: 160, opacity: 0 }} animate={s === 2 ? { cx: [CX - 50, CX - 10], cy: 160, opacity: 1 } : { cx: CX - 50, cy: 160, opacity: 0 }} transition={{ duration: 1.4, delay: 0.3 }} />
            </>
          )}
          {/* copies and proteins */}
          {COPIES.map(([x, y], i) => (
            <motion.g key={`c${i}`} initial={{ x: hiv ? 300 : CX - 40, y: hiv ? 262 : 176, opacity: 0, scale: 0.4 }} animate={showCopies ? { x, y, opacity: 1, scale: 1 } : built ? { x: INSIDE[i][0], y: INSIDE[i][1], opacity: 0, scale: 0.4 } : { x: hiv ? 300 : CX - 40, y: hiv ? 262 : 176, opacity: 0, scale: 0.4 }} transition={{ ...spring, delay: showCopies ? i * 0.15 : 0 }}>
              <g transform="scale(1.4)">
                <Strand color="var(--bio-u)" double={hiv} />
              </g>
            </motion.g>
          ))}
          {PROTEINS.map(([x, y], i) => (
            <motion.g key={`p${i}`} initial={{ x, y, opacity: 0, scale: 0.3 }} animate={{ x: built ? INSIDE[i % INSIDE.length][0] : x, y: built ? INSIDE[i % INSIDE.length][1] : y, opacity: showProteins ? 1 : 0, scale: showProteins ? 1 : 0.3 }} transition={{ ...spring, delay: showProteins ? 0.5 + i * 0.12 : 0 }}>
              {i % 2 ? <path d={bumpPath(shape, 8)} fill={PAINT.virus.stroke} /> : <path d="M -10 -8 L 10 -8 L 13 3 L 0 11 L -13 3 Z" fill={PAINT.virus.fill} stroke={PAINT.virus.stroke} strokeWidth={1.6} />}
            </motion.g>
          ))}
          {/* the new viruses */}
          {INSIDE.map(([x, y], i) => (
            <motion.g
              key={`n${i}`}
              initial={{ x, y, opacity: 0, scale: 0.3 }}
              animate={out ? { x: OUTSIDE[i][0], y: OUTSIDE[i][1], opacity: 1, scale: 0.8 } : built ? { x, y, opacity: 1, scale: 0.8 } : { x, y, opacity: 0, scale: 0.3 }}
              transition={{ ...spring, delay: built ? 0.3 + i * 0.15 : 0 }}
            >
              <VirusParticle r={RV} s={SV} shape={shape} angles={ANGLES} />
            </motion.g>
          ))}
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setS(Math.max(0, s - 1))} disabled={s === 0} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40" aria-label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1.5">
          {steps.map((st, i) => (
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
        <button type="button" onClick={() => setS(Math.min(steps.length - 1, s + 1))} disabled={s === steps.length - 1} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-paper disabled:opacity-40" aria-label={t(tx("Next step", "Nächster Schritt"))}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      <motion.p key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{t(steps[s].name)}: </span>
        {t(steps[s].text)}
      </motion.p>
    </div>
  );
}
