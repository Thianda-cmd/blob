"use client";

// Absorption through an epithelial cell of the small intestine, step by step: the Na⁺/K⁺ pump
// keeps Na⁺ low inside; glucose and amino acids enter by Na⁺ symport (secondary active) and
// leave by carriers (facilitated diffusion) into the blood; fatty acids and monoglycerides
// diffuse in, are rebuilt into triglycerides in the ER, packed into chylomicrons and leave
// by exocytosis into the lymph.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type FigurePart } from "@/learn/biology/Figure";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export type TransportPart = "microvilli" | "junction" | "sglt" | "aa" | "glut" | "carrier" | "pump" | "er" | "blood" | "lymph";

export const TRANSPORT_PARTS: (FigurePart & { id: TransportPart })[] = [
  { id: "microvilli", label: tx("brush border (microvilli)", "Bürstensaum (Mikrovilli)"), at: [330, 70], tag: [336, 24], info: tx("The apical membrane, folded into microvilli. The transporters sit here.", "Die apikale Membran, zu Mikrovilli aufgefaltet. Hier sitzen die Transporter.") },
  { id: "sglt", label: tx("Na⁺-glucose symporter (SGLT1)", "Na⁺-Glucose-Symporter (SGLT1)"), at: [200, 82], tag: [196, 24], info: tx("Takes 2 Na⁺ and 1 glucose into the cell together: secondary active transport.", "Nimmt 2 Na⁺ und 1 Glucose gemeinsam in die Zelle auf: sekundär aktiver Transport.") },
  { id: "aa", label: tx("Na⁺-amino acid symporter", "Na⁺-Aminosäure-Symporter"), at: [268, 82], tag: [266, 24], info: tx("Takes amino acids in together with Na⁺: secondary active.", "Nimmt Aminosäuren zusammen mit Na⁺ auf: sekundär aktiv.") },
  { id: "junction", label: tx("tight junction", "Schlussleiste (Tight Junction)"), at: [148, 88], tag: [52, 40], info: tx("Seals the gap between neighbouring cells: substances must go through the cells.", "Dichtet den Spalt zwischen Nachbarzellen ab: Stoffe müssen durch die Zellen hindurch.") },
  { id: "pump", label: tx("Na⁺/K⁺ pump (ATPase)", "Na⁺/K⁺-Pumpe (ATPase)"), at: [252, 262], tag: [252, 352], info: tx("Uses ATP to pump 3 Na⁺ out and 2 K⁺ in. It keeps the Na⁺ concentration in the cell low.", "Pumpt unter ATP-Verbrauch 3 Na⁺ hinaus und 2 K⁺ hinein. Sie hält die Na⁺-Konzentration in der Zelle niedrig.") },
  { id: "glut", label: tx("glucose carrier (GLUT2)", "Glucose-Carrier (GLUT2)"), at: [200, 262], tag: [176, 352], info: tx("Lets glucose out into the blood by facilitated diffusion (passive).", "Lässt Glucose durch erleichterte Diffusion (passiv) ins Blut.") },
  { id: "carrier", label: tx("amino acid carrier", "Aminosäure-Carrier"), at: [318, 262], tag: [330, 352], info: tx("Lets amino acids out into the blood by facilitated diffusion.", "Lässt Aminosäuren durch erleichterte Diffusion ins Blut.") },
  { id: "er", label: tx("smooth ER", "glattes ER"), at: [372, 132], tag: [486, 132], info: tx("Rebuilds triglycerides from fatty acids and monoglycerides and packs them into chylomicrons.", "Baut aus Fettsäuren und Monoglyceriden wieder Triglyceride auf und verpackt sie zu Chylomikronen.") },
  { id: "blood", label: tx("blood capillary (to the portal vein)", "Blutkapillare (zur Pfortader)"), at: [120, 312], tag: [40, 312], info: tx("Takes glucose and amino acids. The portal vein carries them to the liver.", "Nimmt Glucose und Aminosäuren auf. Die Pfortader bringt sie zur Leber.") },
  { id: "lymph", label: tx("lymph vessel (lacteal)", "Lymphgefäß (Chylusgefäß)"), at: [470, 312], tag: [530, 352], info: tx("Takes the chylomicrons, which are too big for the capillaries.", "Nimmt die Chylomikronen auf, die für die Kapillaren zu groß sind.") },
];

type Mode = "glucose" | "amino" | "fat";
type Step = { text: Text; parts: TransportPart[]; show: ReactNode };

const OUT = "var(--bio-outline)";
const LYMPH = "color-mix(in oklab, var(--bio-sun) 30%, var(--raised))";

// ---------------------------------------------------------------------------
// Particles

const label = (s: string) => (
  <text textAnchor="middle" dominantBaseline="central" fontSize={7.5} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
    {s}
  </text>
);
const Na = () => (
  <g>
    <circle r={8.5} fill="var(--bio-nerve)" stroke={OUT} strokeWidth={1} />
    {label("Na⁺")}
  </g>
);
const K = () => (
  <g>
    <circle r={8.5} fill="var(--bio-u)" stroke={OUT} strokeWidth={1} />
    {label("K⁺")}
  </g>
);
const Glc = () => <polygon points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5" fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.2} />;
const AA = () => <circle r={7} fill="var(--bio-a)" stroke={OUT} strokeWidth={1.2} />;
const FA = () => <path d="M-10 0 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke="var(--bio-membrane)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />;
const Micelle = () => (
  <g>
    <circle r={13} fill="color-mix(in oklab, var(--bio-sun) 35%, var(--raised))" />
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return <circle key={i} cx={13 * Math.cos(a)} cy={13 * Math.sin(a)} r={2.6} fill="var(--bio-leaf)" stroke={OUT} strokeWidth={0.6} />;
    })}
  </g>
);
const Chylo = () => (
  <g>
    <circle r={11} fill="color-mix(in oklab, var(--bio-sun) 45%, var(--raised))" stroke="var(--bio-membrane)" strokeWidth={1.8} />
    <circle cx={-3} cy={-2} r={2} fill="var(--bio-membrane)" />
    <circle cx={4} cy={3} r={2} fill="var(--bio-membrane)" />
  </g>
);

function Mover({ pts, delay = 0, dur = 2.2, children }: { pts: [number, number][]; delay?: number; dur?: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  const last = pts[pts.length - 1];
  if (reduce) return <g transform={`translate(${last[0]} ${last[1]})`}>{children}</g>;
  return (
    <motion.g
      initial={{ x: pts[0][0], y: pts[0][1], opacity: 0 }}
      animate={{ x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), opacity: [0, 1, 1, 1, 0.9] }}
      transition={{ duration: dur, delay, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
    >
      {children}
    </motion.g>
  );
}

const pumpStep: Step = {
  text: tx(
    "**Step 1: the Na⁺/K⁺ pump.** At the bottom (basolateral) membrane it uses **ATP** to pump 3 Na⁺ out and 2 K⁺ in. So the Na⁺ concentration inside the cell stays low: a steep Na⁺ gradient from the gut into the cell.",
    "**Schritt 1: die Na⁺/K⁺-Pumpe.** An der unteren (basolateralen) Membran pumpt sie unter **ATP**-Verbrauch 3 Na⁺ hinaus und 2 K⁺ hinein. So bleibt die Na⁺-Konzentration in der Zelle niedrig: ein starkes Na⁺-Gefälle vom Darm in die Zelle.",
  ),
  parts: ["pump"],
  show: (
    <g>
      {[0, 1, 2].map((i) => (
        <Mover key={`n${i}`} pts={[[238 + i * 12, 226], [252, 262], [236 + i * 14, 284]]} delay={i * 0.15}>
          <Na />
        </Mover>
      ))}
      {[0, 1].map((i) => (
        <Mover key={`k${i}`} pts={[[244 + i * 16, 286], [252, 262], [246 + i * 14, 230]]} delay={0.5 + i * 0.15}>
          <K />
        </Mover>
      ))}
    </g>
  ),
};

const STEPS: Record<Mode, Step[]> = {
  glucose: [
    pumpStep,
    {
      text: tx(
        "**Step 2: SGLT1.** 2 Na⁺ flow down their gradient into the cell and take 1 glucose with them, even against the glucose gradient. The energy comes from the Na⁺ gradient, not directly from ATP: **secondary active transport (symport)**.",
        "**Schritt 2: SGLT1.** 2 Na⁺ strömen ihrem Gefälle folgend in die Zelle und nehmen 1 Glucose mit, sogar gegen deren Konzentrationsgefälle. Die Energie stammt aus dem Na⁺-Gefälle, nicht direkt aus ATP: **sekundär aktiver Transport (Symport)**.",
      ),
      parts: ["sglt", "microvilli"],
      show: (
        <g>
          <Mover pts={[[184, 28], [194, 80], [182, 132]]}>
            <Na />
          </Mover>
          <Mover pts={[[216, 28], [206, 80], [218, 134]]} delay={0.05}>
            <Na />
          </Mover>
          <Mover pts={[[200, 36], [200, 80], [200, 150]]} delay={0.1}>
            <Glc />
          </Mover>
        </g>
      ),
    },
    {
      text: tx(
        "**Step 3: GLUT2.** Glucose is now more concentrated in the cell than in the blood. It leaves through a carrier by **facilitated diffusion** (passive) into the capillary, and with the blood via the **portal vein** to the liver.",
        "**Schritt 3: GLUT2.** In der Zelle ist jetzt mehr Glucose als im Blut. Sie verlässt die Zelle über einen Carrier durch **erleichterte Diffusion** (passiv) in die Kapillare und mit dem Blut über die **Pfortader** zur Leber.",
      ),
      parts: ["glut", "blood"],
      show: (
        <g>
          {[0, 1].map((i) => (
            <Mover key={i} pts={[[196 + i * 10, 160], [200, 262], [196, 308], [112, 308]]} delay={i * 0.6} dur={2.6}>
              <Glc />
            </Mover>
          ))}
        </g>
      ),
    },
  ],
  amino: [
    pumpStep,
    {
      text: tx(
        "**Step 2: Na⁺ symport.** Amino acids are taken in together with Na⁺ by symporters: again **secondary active**, driven by the Na⁺ gradient. (Short peptides of two or three amino acids are taken in with H⁺ and split inside the cell.)",
        "**Schritt 2: Na⁺-Symport.** Aminosäuren werden zusammen mit Na⁺ von Symportern aufgenommen: wieder **sekundär aktiv**, angetrieben vom Na⁺-Gefälle. (Kurze Peptide aus zwei oder drei Aminosäuren werden mit H⁺ aufgenommen und in der Zelle gespalten.)",
      ),
      parts: ["aa", "microvilli"],
      show: (
        <g>
          <Mover pts={[[254, 28], [262, 80], [250, 132]]}>
            <Na />
          </Mover>
          <Mover pts={[[282, 34], [272, 80], [286, 148]]} delay={0.1}>
            <AA />
          </Mover>
        </g>
      ),
    },
    {
      text: tx(
        "**Step 3: out into the blood.** A carrier lets the amino acids out by facilitated diffusion. Like glucose they travel via the portal vein to the liver.",
        "**Schritt 3: hinaus ins Blut.** Ein Carrier lässt die Aminosäuren durch erleichterte Diffusion hinaus. Wie Glucose gelangen sie über die Pfortader zur Leber.",
      ),
      parts: ["carrier", "blood"],
      show: (
        <g>
          {[0, 1].map((i) => (
            <Mover key={i} pts={[[290, 168 + i * 12], [318, 262], [300, 308], [112, 308]]} delay={i * 0.6} dur={2.8}>
              <AA />
            </Mover>
          ))}
        </g>
      ),
    },
  ],
  fat: [
    {
      text: tx(
        "**Step 1: micelles.** Lipase has split the fats mostly into fatty acids and monoglycerides. With bile salts they form tiny **micelles** that carry them to the brush border. Being fat-soluble, they **diffuse** through the membrane (passive).",
        "**Schritt 1: Micellen.** Die Lipase hat die Fette vor allem in Fettsäuren und Monoglyceride gespalten. Mit Gallensalzen bilden sie winzige **Micellen**, die sie zum Bürstensaum bringen. Weil sie fettlöslich sind, **diffundieren** sie durch die Membran (passiv).",
      ),
      parts: ["microvilli"],
      show: (
        <g>
          <Mover pts={[[440, 28], [372, 36], [360, 44]]} dur={2}>
            <Micelle />
          </Mover>
          {[0, 1, 2].map((i) => (
            <Mover key={i} pts={[[356 + i * 6, 46], [352 + i * 8, 84], [354 + i * 6, 112]]} delay={0.9 + i * 0.2} dur={1.6}>
              <FA />
            </Mover>
          ))}
        </g>
      ),
    },
    {
      text: tx(
        "**Step 2: rebuilt and packed.** In the smooth ER the fatty acids and monoglycerides are put back together into **triglycerides**. With cholesterol, phospholipids and proteins they are packed into fat droplets: **chylomicrons**.",
        "**Schritt 2: neu gebaut und verpackt.** Im glatten ER werden Fettsäuren und Monoglyceride wieder zu **Triglyceriden** zusammengesetzt. Mit Cholesterin, Phospholipiden und Proteinen werden sie zu Fetttröpfchen verpackt: **Chylomikronen**.",
      ),
      parts: ["er"],
      show: (
        <g>
          {[0, 1, 2].map((i) => (
            <Mover key={i} pts={[[350 + i * 6, 110], [366, 138], [372, 176]]} delay={i * 0.15} dur={1.6}>
              <FA />
            </Mover>
          ))}
          <Mover pts={[[372, 176], [372, 176], [372, 196]]} delay={1.2} dur={1.4}>
            <Chylo />
          </Mover>
        </g>
      ),
    },
    {
      text: tx(
        "**Step 3: into the lymph.** The chylomicrons leave the cell by **exocytosis**. They are too big for the blood capillaries and enter the **lymph vessel**. The lymph reaches the blood near the heart.",
        "**Schritt 3: in die Lymphe.** Die Chylomikronen verlassen die Zelle durch **Exocytose**. Sie sind zu groß für die Blutkapillaren und gelangen in das **Lymphgefäß**. Die Lymphe mündet in der Nähe des Herzens ins Blut.",
      ),
      parts: ["lymph"],
      show: (
        <g>
          {[0, 1].map((i) => (
            <Mover key={i} pts={[[372, 196], [378, 262], [400, 308], [512, 310]]} delay={i * 0.8} dur={2.6}>
              <Chylo />
            </Mover>
          ))}
        </g>
      ),
    },
  ],
};

const MODES: { id: Mode; name: Text }[] = [
  { id: "glucose", name: tx("Glucose", "Glucose") },
  { id: "amino", name: tx("Amino acids", "Aminosäuren") },
  { id: "fat", name: tx("Fats", "Fette") },
];

/** The cell with its transporters, vessels and organelles (no particles). */
export function TransportCell() {
  return (
    <g strokeLinejoin="round">
      <rect x={0} y={0} width={560} height={56} fill="color-mix(in oklab, var(--bio-water) 12%, var(--raised))" />
      {/* neighbour cells and the cell */}
      <rect x={-12} y={80} width={158} height={182} rx={8} fill="color-mix(in oklab, var(--bio-cell) 70%, var(--raised))" stroke={OUT} strokeWidth={1.4} />
      <rect x={414} y={80} width={160} height={182} rx={8} fill="color-mix(in oklab, var(--bio-cell) 70%, var(--raised))" stroke={OUT} strokeWidth={1.4} />
      <g data-part="microvilli">
        {Array.from({ length: 28 }, (_, i) => 154 + i * 9.2).map((x) => (
          <rect key={x} x={x} y={58} width={5.4} height={26} rx={2.7} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.1} />
        ))}
      </g>
      <rect x={150} y={80} width={260} height={182} rx={8} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
      <g data-part="junction" fill={OUT}>
        <rect x={145} y={81} width={10} height={9} rx={2} />
        <rect x={405} y={81} width={10} height={9} rx={2} />
      </g>
      {/* organelles */}
      <ellipse cx={240} cy={198} rx={24} ry={16} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} />
      <ellipse cx={176} cy={236} rx={10} ry={5} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1} transform="rotate(-20 176 236)" />
      <ellipse cx={392} cy={236} rx={10} ry={5} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1} transform="rotate(25 392 236)" />
      <g data-part="er" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeLinecap="round">
        <path d="M346 120 q8 -8 16 0 t16 0 t16 0" />
        <path d="M346 134 q8 -8 16 0 t16 0 t16 0" />
        <path d="M346 148 q8 -8 16 0 t16 0 t16 0" />
      </g>
      {/* transporters */}
      <g data-part="sglt">
        <rect x={191} y={71} width={18} height={22} rx={5} fill="var(--bio-nucleus)" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="aa">
        <rect x={259} y={71} width={18} height={22} rx={5} fill="var(--bio-chloro)" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="glut">
        <rect x={191} y={251} width={18} height={22} rx={5} fill="var(--bio-leaf)" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="carrier">
        <rect x={309} y={251} width={18} height={22} rx={5} fill="color-mix(in oklab, var(--bio-leaf) 50%, var(--bio-a))" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="pump">
        <rect x={241} y={249} width={22} height={26} rx={6} fill="var(--bio-mito)" stroke={OUT} strokeWidth={1.2} />
        <text x={274} y={244} fontSize={8} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          ATP
        </text>
      </g>
      {/* vessels */}
      <g data-part="blood">
        <rect x={96} y={296} width={222} height={28} rx={14} fill="color-mix(in oklab, var(--bio-blood) 30%, var(--raised))" stroke="var(--bio-blood)" strokeWidth={1.6} />
        <ellipse cx={140} cy={310} rx={7} ry={4} fill="var(--bio-blood)" opacity={0.7} />
        <ellipse cx={250} cy={312} rx={7} ry={4} fill="var(--bio-blood)" opacity={0.7} />
      </g>
      <g data-part="lymph">
        <rect x={338} y={296} width={190} height={28} rx={14} fill={LYMPH} stroke="var(--bio-membrane)" strokeWidth={1.6} />
      </g>
    </g>
  );
}

export function DigestionTransport() {
  const t = useText();
  const [mode, setMode] = useState<Mode>("glucose");
  const [step, setStep] = useState(0);
  const steps = STEPS[mode];
  const st = steps[step];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setStep(0);
            }}
            className={cn("h-9 rounded-lg px-3 text-[13.5px] font-medium transition-colors", mode === m.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(m.name)}
          </button>
        ))}
      </div>
      <Figure title={tx("Absorption through a cell of the gut lining", "Resorption durch eine Zelle der Darmschleimhaut")} width={560} height={366} parts={TRANSPORT_PARTS} mode="names" highlight={st.parts}>
        <TransportCell />
        <g key={`${mode}-${step}`}>{st.show}</g>
      </Figure>
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label={t(tx("Previous step", "Vorheriger Schritt"))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 hover:bg-hover disabled:opacity-35">
          <ChevronLeft className="size-4" />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={`${mode}-${step}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-h-[5.5rem] flex-1 rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink">
            <Inline text={st.text} />
          </motion.p>
        </AnimatePresence>
        <button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1} aria-label={t(tx("Next step", "Nächster Schritt"))} className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob text-white disabled:opacity-35">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="flex justify-center gap-1.5">
        {steps.map((_, i) => (
          <button key={i} type="button" onClick={() => setStep(i)} aria-label={`${i + 1}`} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-blob" : "w-1.5 bg-line-2")} />
        ))}
      </div>
    </div>
  );
}
