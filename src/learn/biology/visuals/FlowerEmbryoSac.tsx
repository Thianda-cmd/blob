"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { shiftParts, StepCaption, StepControls, Tube } from "./FlowerKit";
import { FlowerPollenGrain, POLLEN_STEPS, PollenDevelopment } from "./FlowerPollenGrain";

// The female gametophyte: an (anatropous) ovule with integuments, nucellus and the mature
// embryo sac of seven cells with eight nuclei. Its development from the megaspore mother cell,
// and the widget that shows both gametophytes of the seed plant.

/** Geometry of the ovule (viewBox 400 × 430); shared with the double fertilisation widget. */
export const OV = {
  outer: { cx: 190, cy: 200, rx: 120, ry: 160 },
  inner: { cx: 190, cy: 204, rx: 102, ry: 140 },
  nucellus: { cx: 190, cy: 200, rx: 84, ry: 122 },
  sac: { cx: 190, cy: 196, rx: 58, ry: 106 },
  antipodes: [
    [176, 113],
    [204, 113],
    [190, 99],
  ] as [number, number][],
  polar: [
    [181, 192],
    [199, 197],
  ] as [number, number][],
  synergids: [
    [175, 273],
    [205, 273],
  ] as [number, number][],
  egg: { cx: 190, cy: 250, rx: 15, ry: 18 },
  micropyle: "M 182 362 L 184 316 L 196 316 L 198 362 Z",
  funiculus: "M 280 318 C 304 342, 318 378, 324 430",
  strand: "M 324 428 C 316 384, 300 340, 292 304 C 302 220, 288 112, 240 66 C 224 54, 206 50, 190 52",
};

export function OvuleWalls() {
  return (
    <>
      <g data-part="funiculus">
        <Tube d={OV.funiculus} w={24} core="var(--bio-mito)" edge="var(--bio-mito-deep)" />
      </g>
      <g data-part="integuments">
        <ellipse {...OV.outer} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={2} />
        <ellipse {...OV.inner} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.5} />
      </g>
      <path d={OV.strand} fill="none" stroke="var(--bio-wall-deep)" strokeWidth={3} strokeDasharray="7 5" strokeLinecap="round" opacity={0.75} />
      <ellipse data-part="nucellus" {...OV.nucellus} fill="var(--bio-bone)" stroke="var(--bio-wood)" strokeWidth={1.5} />
      <g data-part="micropyle">
        <path d={OV.micropyle} fill="var(--bio-cell)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
      </g>
      <circle data-part="chalaza" cx={190} cy={60} r={9} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={1.5} />
    </>
  );
}

const Nucleus = ({ x, y, r = 4.5 }: { x: number; y: number; r?: number }) => <circle cx={x} cy={y} r={r} fill="var(--bio-nucleus-deep)" />;

export function SacAntipodes() {
  return (
    <g data-part="antipodes">
      {OV.antipodes.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={12} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
          <Nucleus x={x} y={y} />
        </g>
      ))}
    </g>
  );
}

export function SacPolar() {
  return (
    <g data-part="polar">
      {OV.polar.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={9} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.5} />
          <circle cx={x} cy={y} r={2.6} fill="var(--bio-nucleus-deep)" />
        </g>
      ))}
    </g>
  );
}

export function SacSynergids({ gone = [] as number[] }: { gone?: number[] }) {
  return (
    <g data-part="synergids">
      {OV.synergids.map(([x, y], i) => (
        <g key={`${x}${y}`} opacity={gone.includes(i) ? 0.35 : 1}>
          <ellipse cx={x} cy={y} rx={12} ry={16} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.3} />
          <Nucleus x={x} y={y + 4} r={4} />
          {[-4, 0, 4].map((dx) => (
            <line key={dx} x1={x + dx} y1={y + 10} x2={x + dx} y2={y + 15} stroke="var(--bio-water-deep)" strokeWidth={1} />
          ))}
        </g>
      ))}
    </g>
  );
}

export function SacEgg() {
  return (
    <g data-part="egg">
      <ellipse {...OV.egg} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
      <Nucleus x={OV.egg.cx} y={OV.egg.cy - 6} r={5} />
    </g>
  );
}

export const SAC_PARTS: FigurePart[] = [
  { id: "integuments", label: tx("integuments", "Integumente"), at: [80, 236], tag: [26, 270], info: tx("Two protective layers (2n, tissue of the mother plant). They become the seed coat.", "Zwei Hüllschichten (2n, Gewebe der Mutterpflanze). Sie werden zur Samenschale.") },
  { id: "nucellus", label: tx("nucellus", "Nucellus"), at: [118, 150], tag: [26, 160], info: tx("Diploid tissue in which the embryo sac developed (the megasporangium).", "Diploides Gewebe, in dem der Embryosack entstanden ist (das Megasporangium).") },
  { id: "sac", label: tx("embryo sac", "Embryosack"), at: [134, 222], tag: [26, 215], info: tx("The female gametophyte: 7 cells with 8 haploid nuclei.", "Der weibliche Gametophyt: 7 Zellen mit 8 haploiden Kernen.") },
  { id: "antipodes", label: tx("antipodal cells (3)", "Antipoden (3)"), at: [176, 113], tag: [60, 60], info: tx("Three cells at the chalazal end (n). They usually die soon.", "Drei Zellen am chalazalen Ende (n). Sie gehen meist bald zugrunde.") },
  { id: "central", label: tx("central cell", "Zentralzelle"), at: [214, 150], tag: [366, 110], info: tx("The large middle cell with two polar nuclei (n + n). Becomes the endosperm after fertilisation.", "Die große mittlere Zelle mit zwei Polkernen (n + n). Wird nach der Befruchtung zum Endosperm.") },
  { id: "polar", label: tx("polar nuclei (2)", "Polkerne (2)"), at: [199, 197], tag: [366, 175], info: tx("Two haploid nuclei of the central cell. They often fuse before fertilisation (secondary nucleus, 2n).", "Zwei haploide Kerne der Zentralzelle. Oft verschmelzen sie schon vor der Befruchtung (sekundärer Embryosackkern, 2n).") },
  { id: "egg", label: tx("egg cell", "Eizelle"), at: [190, 250], tag: [366, 240], info: tx("The female gamete (n). Fuses with a sperm cell to form the zygote.", "Die weibliche Keimzelle (n). Verschmilzt mit einer Spermazelle zur Zygote.") },
  { id: "synergids", label: tx("synergids (2)", "Synergiden (2)"), at: [205, 280], tag: [366, 300], info: tx("Two helper cells beside the egg (n). They attract the pollen tube, which bursts into one of them.", "Zwei Hilfszellen neben der Eizelle (n). Sie locken den Pollenschlauch an, der sich in eine von ihnen entlädt.") },
  { id: "micropyle", label: tx("micropyle", "Mikropyle"), at: [190, 344], tag: [80, 392], info: tx("Narrow gap in the integuments: the pollen tube's entrance.", "Enger Spalt in den Integumenten: der Eingang für den Pollenschlauch.") },
  { id: "funiculus", label: tx("funiculus (seed stalk)", "Funiculus (Samenstiel)"), at: [316, 396], tag: [372, 392], info: tx("Connects the ovule with the placenta. A vascular bundle runs through it.", "Verbindet die Samenanlage mit der Plazenta. Ein Leitbündel läuft hindurch.") },
  { id: "chalaza", label: tx("chalaza", "Chalaza"), at: [190, 60], tag: [300, 24], info: tx("Base of the ovule opposite the micropyle, where the vascular bundle ends.", "Basis der Samenanlage gegenüber der Mikropyle, hier endet das Leitbündel.") },
];

const SAC_PARTS_WIDE = shiftParts(SAC_PARTS, 60, 26, 190);

export function EmbryoSacDrawing() {
  return (
    <>
      <OvuleWalls />
      <g data-part="sac">
        <ellipse {...OV.sac} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
      </g>
      <g data-part="central">
        <ellipse {...OV.sac} rx={OV.sac.rx - 6} ry={OV.sac.ry - 8} fill="none" stroke="var(--bio-membrane)" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.6} />
      </g>
      <SacAntipodes />
      <SacPolar />
      <SacSynergids />
      <SacEgg />
    </>
  );
}

export function FlowerEmbryoSac({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Ovule with mature embryo sac", "Samenanlage mit reifem Embryosack")} width={520} height={430} parts={SAC_PARTS_WIDE} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g transform="translate(60 0)">
        <EmbryoSacDrawing />
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Development of the embryo sac

export const SAC_STEPS: { title: Text; note: Text }[] = [
  {
    title: tx("Megaspore mother cell (2n)", "Megasporenmutterzelle (2n)"),
    note: tx("In the nucellus of the young ovule one diploid cell grows big: the **megaspore mother cell**.", "Im Nucellus der jungen Samenanlage wird eine diploide Zelle besonders groß: die **Megasporenmutterzelle**."),
  },
  {
    title: tx("Meiosis: four megaspores", "Meiose: vier Megasporen"),
    note: tx("By **meiosis** it forms four haploid **megaspores** (n) in a row.", "Durch **Meiose** bildet sie vier haploide **Megasporen** (n) in einer Reihe."),
  },
  {
    title: tx("Three of them die", "Drei gehen zugrunde"),
    note: tx("Three megaspores die. Only the one at the chalazal end survives and grows.", "Drei Megasporen gehen zugrunde. Nur die am chalazalen Ende überlebt und wächst."),
  },
  {
    title: tx("First mitosis: two nuclei", "Erste Mitose: zwei Kerne"),
    note: tx("Its nucleus divides by **mitosis**, without a new cell wall. One nucleus moves to each pole.", "Ihr Kern teilt sich durch **Mitose**, ohne neue Zellwand. Je ein Kern wandert an einen Pol."),
  },
  {
    title: tx("Second mitosis: four nuclei", "Zweite Mitose: vier Kerne"),
    note: tx("Another mitosis: two nuclei at each pole.", "Noch eine Mitose: zwei Kerne an jedem Pol."),
  },
  {
    title: tx("Third mitosis: eight nuclei", "Dritte Mitose: acht Kerne"),
    note: tx("After the third mitosis there are **eight** haploid nuclei, four at each pole.", "Nach der dritten Mitose gibt es **acht** haploide Kerne, vier an jedem Pol."),
  },
  {
    title: tx("Seven cells, eight nuclei", "Sieben Zellen, acht Kerne"),
    note: tx("One nucleus from each pole moves to the middle (**polar nuclei**). Walls form: 3 antipodes, egg cell + 2 synergids, and the central cell with 2 nuclei.", "Von jedem Pol wandert ein Kern in die Mitte (**Polkerne**). Zellwände bilden sich: 3 Antipoden, Eizelle + 2 Synergiden und die Zentralzelle mit 2 Kernen."),
  },
];

/** Nucleus positions for steps 3–6 (8 slots). */
const NUC: [number, number, number][][] = [
  // step 3: 2 nuclei
  [
    [180, 92, 1],
    [180, 208, 1],
    [180, 92, 0],
    [180, 92, 0],
    [180, 208, 0],
    [180, 208, 0],
    [180, 92, 0],
    [180, 208, 0],
  ],
  // step 4: 4 nuclei
  [
    [170, 90, 1],
    [170, 210, 1],
    [190, 90, 1],
    [190, 90, 0],
    [190, 210, 1],
    [190, 210, 0],
    [170, 90, 0],
    [170, 210, 0],
  ],
  // step 5: 8 nuclei
  [
    [164, 88, 1],
    [164, 212, 1],
    [196, 88, 1],
    [180, 76, 1],
    [196, 212, 1],
    [180, 224, 1],
    [180, 102, 1],
    [180, 198, 1],
  ],
  // step 6: cells
  [
    [166, 86, 1],
    [168, 214, 1],
    [194, 86, 1],
    [180, 72, 1],
    [192, 214, 1],
    [180, 194, 1],
    [175, 148, 1],
    [186, 154, 1],
  ],
];

export function SacDevelopment({ step }: { step: number }) {
  const reduce = useReducedMotion();
  const tr = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 80, damping: 16 } as const);
  const sac = step >= 3;
  const nuc = sac ? NUC[step - 3] : null;
  const cells = step >= 6;
  const label = (x: number, y: number, text: string, on: boolean) => (
    <motion.text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink)" initial={false} animate={{ opacity: on ? 1 : 0 }} style={{ fontFamily: "var(--font-sans)" }}>
      {text}
    </motion.text>
  );
  return (
    <svg viewBox="40 0 280 300" className="mx-auto block h-auto w-full" style={{ maxWidth: 360 }} aria-hidden>
      {/* integuments and nucellus */}
      <ellipse cx={180} cy={150} rx={112} ry={140} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={2} />
      <ellipse cx={180} cy={152} rx={98} ry={124} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
      <ellipse cx={180} cy={150} rx={80} ry={108} fill="var(--bio-bone)" stroke="var(--bio-wood)" strokeWidth={1.4} />
      <path d="M 173 292 L 175 254 L 185 254 L 187 292 Z" fill="var(--bio-cell)" stroke="var(--bio-mito-deep)" strokeWidth={1} />
      {/* mother cell */}
      <motion.g initial={false} animate={{ opacity: step === 0 ? 1 : 0 }} transition={tr}>
        <ellipse cx={180} cy={170} rx={26} ry={40} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
        <circle cx={180} cy={170} r={13} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
        {label(180, 170, "2n", step === 0)}
      </motion.g>
      {/* four megaspores in a row; the lower three die */}
      {[0, 1, 2, 3].map((i) => {
        const y = 108 + i * 30;
        const dying = step >= 2 && i > 0;
        const grown = step === 2 && i === 0;
        return (
          <motion.g key={i} initial={false} animate={{ opacity: step === 1 || step === 2 ? (dying ? 0.35 : 1) : 0 }} transition={tr}>
            <motion.ellipse cx={180} initial={false} animate={{ cy: grown ? 100 : y, rx: dying ? 14 : grown ? 26 : 22, ry: dying ? 8 : grown ? 24 : 13 }} transition={tr} fill={dying ? "var(--ink-3)" : "var(--bio-cell)"} stroke="var(--bio-membrane)" strokeWidth={1.6} />
            {!dying && <motion.circle cx={180} initial={false} animate={{ cy: grown ? 100 : y }} transition={tr} r={7} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />}
            {label(180, y, "n", step === 1)}
          </motion.g>
        );
      })}
      {/* the growing embryo sac */}
      <motion.ellipse cx={180} initial={false} animate={{ cy: 150, rx: sac ? 44 : 20, ry: sac ? 92 : 20, opacity: sac ? 1 : 0 }} transition={tr} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
      {/* cells after step 6 */}
      <motion.g initial={false} animate={{ opacity: cells ? 1 : 0 }} transition={tr}>
        {[
          [166, 86],
          [194, 86],
          [180, 72],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={11} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
        ))}
        {[
          [168, 216],
          [192, 216],
        ].map(([x, y]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx={10} ry={14} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.2} />
        ))}
        <ellipse cx={180} cy={196} rx={13} ry={15} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
      </motion.g>
      {/* nuclei */}
      {nuc &&
        nuc.map(([x, y, o], i) => (
          <motion.circle
            key={i}
            initial={false}
            animate={{ cx: x, cy: y, opacity: o, r: cells && i >= 6 ? 7 : 5 }}
            transition={tr}
            fill={cells && i >= 6 ? "var(--bio-nucleus)" : "var(--bio-nucleus-deep)"}
            stroke="var(--bio-nucleus-deep)"
            strokeWidth={1.2}
          />
        ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The widget: both gametophytes of a seed plant

type Tab = "male" | "female";

export function FlowerGametophytes({ startTab = "female", startStep = 0 }: { startTab?: Tab; startStep?: number }) {
  const t = useText();
  const [tab, setTab] = useState<Tab>(startTab);
  const [step, setStep] = useState(startStep);
  const steps = tab === "male" ? POLLEN_STEPS : SAC_STEPS;
  const last = steps.length - 1;
  const finalFigure = tab === "male" ? step === 4 : step === last;
  const choose = (x: Tab) => {
    setTab(x);
    setStep(0);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(
          [
            ["female", tx("♀ Embryo sac", "♀ Embryosack")],
            ["male", tx("♂ Pollen grain", "♂ Pollenkorn")],
          ] as [Tab, Text][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => choose(id)}
            className={cn("flex h-9 items-center rounded-lg border px-3 text-[13.5px] font-medium transition-colors", tab === id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${tab}-${finalFigure ? "fig" : "dev"}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          {finalFigure ? tab === "male" ? <FlowerPollenGrain mode="explore" /> : <FlowerEmbryoSac mode="explore" /> : tab === "male" ? <PollenDevelopment step={step} /> : <SacDevelopment step={step} />}
        </motion.div>
      </AnimatePresence>
      <StepCaption n={step + 1} title={steps[step].title} note={steps[step].note} />
      <StepControls step={step} onStep={setStep} titles={steps.map((s) => s.title)} delay={2000} />
    </div>
  );
}
