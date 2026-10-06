"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { Figure, type FigurePart } from "@/learn/biology/Figure";
import { shiftParts, StepCaption, StepControls } from "./FlowerKit";

// The pistil close up: a pollen grain germinates on the stigma, the pollen tube grows down the
// style and through the micropyle into the ovule, the sperm cell fuses with the egg cell, and
// the zygote develops into the embryo of the seed.

/** The tube's path: from the grain on the stigma down to the egg cell. */
const TUBE: [number, number][] = [
  [186, 42],
  [183, 62],
  [181, 110],
  [182, 170],
  [179, 230],
  [180, 262],
  [180, 284],
  [180, 300],
];
const tubeD = TUBE.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
/** How far the tube has grown at each step (fraction of the points). */
const GROWN = [0, 0.12, 0.6, 1, 1, 1];
const tipIndex = (f: number) => Math.round(f * (TUBE.length - 1));

type Step = { title: Text; note: Text; show: string[] };

const STEPS: Step[] = [
  {
    title: tx("Pollination", "Bestäubung"),
    note: tx("Pollen grains stick to the stigma. Each one carries the male sex cell.", "Pollenkörner kleben auf der Narbe. Jedes enthält die männliche Keimzelle."),
    show: ["pollen", "stigma", "style", "ovary", "ovule", "egg"],
  },
  {
    title: tx("The pollen grain germinates", "Das Pollenkorn keimt"),
    note: tx("Sugary liquid on the stigma makes a pollen grain germinate: a **pollen tube** grows out of it.", "Zuckerhaltige Flüssigkeit auf der Narbe lässt ein Pollenkorn keimen: Ein **Pollenschlauch** wächst heraus."),
    show: ["pollen", "tube", "stigma"],
  },
  {
    title: tx("Down through the style", "Durch den Griffel"),
    note: tx("The pollen tube grows down through the style. At its tip it carries the **sperm cell**.", "Der Pollenschlauch wächst durch den Griffel nach unten. An seiner Spitze trägt er die **Spermazelle**."),
    show: ["tube", "sperm", "style"],
  },
  {
    title: tx("Into the ovule", "In die Samenanlage"),
    note: tx("The tube reaches the ovule and enters it through a tiny opening, the **micropyle**.", "Der Schlauch erreicht die Samenanlage und dringt durch eine winzige Öffnung ein, die **Mikropyle**."),
    show: ["micropyle", "sperm", "egg", "ovule"],
  },
  {
    title: tx("Fertilisation", "Befruchtung"),
    note: tx("The sperm cell fuses with the **egg cell**. The fertilised egg cell is called the **zygote**.", "Die Spermazelle verschmilzt mit der **Eizelle**. Die befruchtete Eizelle heißt **Zygote**."),
    show: ["zygote", "ovule"],
  },
  {
    title: tx("Seed and fruit", "Samen und Frucht"),
    note: tx("The zygote divides again and again and becomes the **embryo**. The ovule becomes the **seed**, the ovary the **fruit**.", "Die Zygote teilt sich immer wieder und wird zum **Keimling** (Embryo). Die Samenanlage wird zum **Samen**, der Fruchtknoten zur **Frucht**."),
    show: ["embryo", "ovule", "ovary"],
  },
];

const BASE_PARTS: FigurePart[] = [
  { id: "pollen", label: tx("pollen grain", "Pollenkorn"), at: [166, 44], tag: [82, 34] },
  { id: "stigma", label: tx("stigma", "Narbe"), at: [204, 56], tag: [292, 40] },
  { id: "tube", label: tx("pollen tube", "Pollenschlauch"), at: [181, 128], tag: [82, 118] },
  { id: "style", label: tx("style", "Griffel"), at: [188, 170], tag: [292, 150] },
  { id: "sperm", label: tx("sperm cell", "Spermazelle"), at: [180, 200], tag: [82, 210] },
  { id: "ovary", label: tx("ovary", "Fruchtknoten"), at: [240, 300], tag: [306, 268] },
  { id: "ovule", label: tx("ovule", "Samenanlage"), at: [206, 352], tag: [306, 384] },
  { id: "micropyle", label: tx("micropyle", "Mikropyle"), at: [180, 293], tag: [82, 280] },
  { id: "egg", label: tx("egg cell", "Eizelle"), at: [180, 312], tag: [82, 326] },
  { id: "zygote", label: tx("zygote", "Zygote"), at: [180, 312], tag: [82, 326] },
  { id: "embryo", label: tx("embryo", "Keimling (Embryo)"), at: [180, 334], tag: [82, 360] },
];

function partsFor(step: number): FigurePart[] {
  const tip = TUBE[tipIndex(GROWN[step])];
  return BASE_PARTS.map((p) => (p.id === "sperm" ? { ...p, at: [tip[0], tip[1] - 4] as [number, number], tag: [82, Math.max(150, tip[1] - 6)] as [number, number] } : p));
}

export function FlowerPollenTube({ start = 0 }: { start?: number }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(start);
  const tr = reduce ? { duration: 0 } : { duration: 1.1, ease: "easeInOut" as const };
  const grown = GROWN[step];
  const tip = TUBE[tipIndex(grown)];
  const fused = step >= 4;
  const seed = step >= 5;

  return (
    <div className="space-y-3">
      <Figure title={tx("Pistil with pollen tube", "Stempel mit Pollenschlauch")} width={480} height={420} parts={shiftParts(partsFor(step).filter((p) => STEPS[step].show.includes(p.id)), 60, 34, 180)} mode="names">
        <g transform="translate(60 0)">
        {/* ovary with its cavity */}
        <motion.ellipse
          data-part="ovary"
          cx={180}
          cy={330}
          initial={false}
          animate={{ rx: seed ? 82 : 70, ry: seed ? 88 : 80 }}
          transition={tr}
          fill="var(--bio-leaf)"
          stroke="var(--bio-leaf-deep)"
          strokeWidth={2}
        />
        <ellipse cx={180} cy={330} rx={54} ry={64} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
        {/* style and stigma */}
        <g data-part="style">
          <path d="M 170 262 L 171 62 L 189 62 L 190 262 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M 177 258 L 177.5 66 L 182.5 66 L 183 258 Z" fill="var(--bio-cell)" opacity={0.55} />
        </g>
        <g data-part="stigma">
          <path d="M 146 62 C 144 40, 216 40, 214 62 C 200 70, 160 70, 146 62 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          {[-24, -16, -8, 0, 8, 16, 24].map((dx) => (
            <circle key={dx} cx={180 + dx} cy={45 + Math.abs(dx) * 0.13} r={2.4} fill="var(--bio-leaf-deep)" opacity={0.7} />
          ))}
        </g>
        {/* ovule: integument with the micropyle at the top, egg cell inside */}
        <g data-part="ovule">
          <path d="M 180 394 L 180 374" stroke="var(--bio-mito-deep)" strokeWidth={4} strokeLinecap="round" />
          <ellipse cx={180} cy={334} rx={31} ry={42} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
          <motion.ellipse cx={180} cy={334} rx={31} ry={42} initial={false} animate={{ opacity: seed ? 1 : 0 }} transition={tr} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
          <ellipse cx={180} cy={337} rx={22} ry={33} fill="var(--bio-cell)" stroke="var(--bio-mito-deep)" strokeWidth={1} />
        </g>
        <g data-part="micropyle">
          <rect x={176.5} y={289} width={7} height={17} fill="var(--bio-cell)" />
          <path d="M 176.5 292 L 176.5 305 M 183.5 292 L 183.5 305" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
        </g>
        {/* egg cell → zygote → embryo */}
        <motion.g data-part={fused ? "zygote" : "egg"} initial={false} animate={{ opacity: seed ? 0 : 1 }} transition={tr}>
          <motion.circle cx={180} cy={314} initial={false} animate={{ r: fused ? 10 : 8.5 }} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
          <circle cx={180} cy={314} r={3.2} fill="var(--bio-nucleus-deep)" />
        </motion.g>
        <motion.g data-part="embryo" initial={false} animate={{ opacity: seed ? 1 : 0, scale: seed ? 1 : 0.3 }} transition={tr}>
          <path d="M 180 306 C 171 306, 166 318, 168 330 C 162 334, 162 350, 170 356 C 174 350, 176 344, 180 342 C 184 344, 186 350, 190 356 C 198 350, 198 334, 192 330 C 194 318, 189 306, 180 306 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        </motion.g>

        {/* pollen grains on the stigma */}
        <g data-part="pollen">
          {[
            [166, 44],
            [186, 39],
            [203, 45],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={6.5} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          ))}
        </g>
        {/* the pollen tube */}
        <g data-part="tube">
          <motion.path
            d={tubeD}
            fill="none"
            stroke="var(--bio-pollen)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: grown, opacity: grown > 0 && !fused ? 1 : fused ? 0.35 : 0 }}
            transition={tr}
          />
        </g>
        {/* the sperm cell rides at the tip of the tube */}
        <motion.ellipse
          data-part="sperm"
          rx={3.4}
          ry={4.6}
          fill="var(--bio-nucleus-deep)"
          initial={false}
          animate={{ cx: fused ? 180 : tip[0], cy: fused ? 314 : tip[1] - 4, opacity: step >= 2 && !fused ? 1 : 0 }}
          transition={tr}
        />
        {fused && !seed && (
          <motion.circle
            cx={180}
            cy={314}
            fill="none"
            stroke="var(--blob)"
            strokeWidth={2.5}
            initial={{ r: 8, opacity: 0.9 }}
            animate={{ r: 24, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 1, repeat: reduce ? 0 : 2 }}
          />
        )}
        </g>
      </Figure>
      <StepCaption n={step + 1} title={STEPS[step].title} note={STEPS[step].note} />
      <StepControls step={step} onStep={setStep} titles={STEPS.map((s) => s.title)} />
    </div>
  );
}
