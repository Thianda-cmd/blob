"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { OV, OvuleWalls, SacAntipodes, SacEgg, SacPolar, SacSynergids } from "./FlowerEmbryoSac";
import { shiftParts, StepCaption, StepControls } from "./FlowerKit";
import { cos, sin } from "@/lib/stableMath";

// Double fertilisation in angiosperms: the pollen tube enters through the micropyle and bursts
// into a synergid; one sperm cell fuses with the egg cell (zygote, 2n), the other with the
// central cell and its two polar nuclei (endosperm nucleus, 3n). Then the seed develops.

const TUBE = "M 190 432 L 190 364 L 190 320 C 190 302, 184 292, 177 284";

type Step = { title: Text; note: Text; show: string[]; chips: [Text, string][] };

const STEPS: Step[] = [
  {
    title: tx("The embryo sac is ready", "Der Embryosack ist bereit"),
    note: tx("Egg cell and synergids wait at the micropyle, the central cell holds two polar nuclei. All nuclei are haploid.", "Eizelle und Synergiden warten an der Mikropyle, die Zentralzelle enthält zwei Polkerne. Alle Kerne sind haploid."),
    show: ["egg", "synergids", "polar", "antipodes", "micropyle"],
    chips: [
      [tx("egg cell", "Eizelle"), "n"],
      [tx("central cell", "Zentralzelle"), "n + n"],
    ],
  },
  {
    title: tx("The pollen tube enters", "Der Pollenschlauch dringt ein"),
    note: tx("Attracted by the synergids, the pollen tube grows through the **micropyle**. It carries the vegetative nucleus and **two sperm cells**.", "Von den Synergiden angelockt, wächst der Pollenschlauch durch die **Mikropyle**. Er bringt den vegetativen Kern und **zwei Spermazellen** mit."),
    show: ["tube", "sperm", "micropyle", "synergids"],
    chips: [[tx("sperm cells", "Spermazellen"), "n"]],
  },
  {
    title: tx("Released into a synergid", "Entladung in eine Synergide"),
    note: tx("The tube bursts into one synergid, which dies. The two sperm cells are set free.", "Der Schlauch entlädt sich in eine Synergide, die dabei zugrunde geht. Die zwei Spermazellen werden frei."),
    show: ["sperm", "synergids", "egg"],
    chips: [[tx("sperm cells", "Spermazellen"), "n"]],
  },
  {
    title: tx("Two sperm cells, two partners", "Zwei Spermazellen, zwei Partner"),
    note: tx("One sperm cell moves to the **egg cell**, the other one to the **central cell** with the polar nuclei.", "Eine Spermazelle wandert zur **Eizelle**, die andere zur **Zentralzelle** mit den Polkernen."),
    show: ["sperm", "egg", "polar"],
    chips: [
      [tx("sperm → egg cell", "Spermazelle → Eizelle"), "n + n"],
      [tx("sperm → central cell", "Spermazelle → Zentralzelle"), "n + n + n"],
    ],
  },
  {
    title: tx("Double fertilisation", "Doppelte Befruchtung"),
    note: tx("Sperm + egg cell → **zygote (2n)**. Sperm + central cell → **primary endosperm nucleus (3n)**. Two fusions: that's why it's called double fertilisation.", "Spermazelle + Eizelle → **Zygote (2n)**. Spermazelle + Zentralzelle → **primärer Endospermkern (3n)**. Zwei Verschmelzungen: deshalb doppelte Befruchtung."),
    show: ["zygote", "endonucleus"],
    chips: [
      [tx("zygote", "Zygote"), "2n"],
      [tx("endosperm nucleus", "Endospermkern"), "3n"],
    ],
  },
  {
    title: tx("A seed develops", "Ein Samen entsteht"),
    note: tx("Zygote → **embryo** (2n). Endosperm nucleus → **endosperm** (3n), the food store. Integuments → **seed coat** (2n, from the mother plant). Ovule → seed.", "Zygote → **Embryo** (2n). Endospermkern → **Endosperm** (3n), das Nährgewebe. Integumente → **Samenschale** (2n, von der Mutterpflanze). Samenanlage → Samen."),
    show: ["embryo", "endosperm", "coat"],
    chips: [
      [tx("embryo", "Embryo"), "2n"],
      [tx("endosperm", "Endosperm"), "3n"],
      [tx("seed coat", "Samenschale"), "2n"],
    ],
  },
];

const PARTS: FigurePart[] = [
  { id: "egg", label: tx("egg cell (n)", "Eizelle (n)"), at: [190, 250], tag: [366, 240] },
  { id: "synergids", label: tx("synergids (n)", "Synergiden (n)"), at: [205, 280], tag: [366, 300] },
  { id: "polar", label: tx("polar nuclei (n + n)", "Polkerne (n + n)"), at: [199, 197], tag: [366, 175] },
  { id: "antipodes", label: tx("antipodal cells (n)", "Antipoden (n)"), at: [176, 113], tag: [60, 60] },
  { id: "micropyle", label: tx("micropyle", "Mikropyle"), at: [190, 344], tag: [80, 392] },
  { id: "tube", label: tx("pollen tube", "Pollenschlauch"), at: [190, 400], tag: [372, 404] },
  { id: "sperm", label: tx("sperm cells (n)", "Spermazellen (n)"), at: [190, 318], tag: [30, 300] },
  { id: "zygote", label: tx("zygote (2n)", "Zygote (2n)"), at: [206, 252], tag: [366, 240] },
  { id: "endonucleus", label: tx("primary endosperm nucleus (3n)", "primärer Endospermkern (3n)"), at: [202, 192], tag: [366, 175] },
  { id: "embryo", label: tx("embryo (2n)", "Embryo (2n)"), at: [190, 252], tag: [366, 240] },
  { id: "endosperm", label: tx("endosperm (3n)", "Endosperm (3n)"), at: [214, 150], tag: [366, 110] },
  { id: "coat", label: tx("seed coat from the integuments (2n)", "Samenschale aus den Integumenten (2n)"), at: [80, 236], tag: [26, 270] },
];

/** Sperm cell positions per step (two cells). */
const SPERM: [number, number, number][][] = [
  [
    [190, 440, 0],
    [190, 452, 0],
  ],
  [
    [188, 300, 1],
    [190, 316, 1],
  ],
  [
    [184, 262, 1],
    [176, 266, 1],
  ],
  [
    [190, 236, 1],
    [194, 206, 1],
  ],
  [
    [190, 250, 0],
    [190, 195, 0],
  ],
  [
    [190, 250, 0],
    [190, 195, 0],
  ],
];

export function FlowerDoubleFert({ start = 0 }: { start?: number }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(start);
  const tr = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 60, damping: 15 } as const);
  const fused = step >= 4;
  const seed = step >= 5;
  const s = STEPS[step];
  const partsNow = shiftParts(
    PARTS.filter((p) => s.show.includes(p.id)).map((p) => (p.id === "sperm" ? { ...p, at: [SPERM[step][1][0], SPERM[step][1][1]] as [number, number] } : p)),
    60,
    26,
    190,
  );

  return (
    <div className="space-y-3">
      <Figure title={tx("Double fertilisation in the embryo sac", "Doppelte Befruchtung im Embryosack")} width={520} height={440} parts={partsNow} mode="names">
        <g transform="translate(60 0)">
        <OvuleWalls />
        <g data-part="coat">
          <motion.ellipse {...OV.outer} initial={false} animate={{ opacity: seed ? 0.85 : 0 }} transition={tr} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
          <motion.ellipse {...OV.inner} rx={OV.inner.rx - 6} ry={OV.inner.ry - 6} initial={false} animate={{ opacity: seed ? 1 : 0 }} transition={tr} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
        </g>
        {/* embryo sac / endosperm */}
        <motion.ellipse {...OV.sac} initial={false} animate={{ rx: seed ? 80 : OV.sac.rx, ry: seed ? 120 : OV.sac.ry }} transition={tr} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
        <motion.g data-part="endosperm" initial={false} animate={{ opacity: seed ? 1 : 0 }} transition={tr}>
          {Array.from({ length: 26 }, (_, i) => {
            const a = i * 2.39996;
            const r = 16 + (i % 7) * 13;
            const x = 190 + cos(a) * r * 0.62;
            const y = 186 + sin(a) * r * 1.05;
            return y > 228 && Math.abs(x - 190) < 24 ? null : <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={4.2} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />;
          })}
        </motion.g>
        {/* antipodes and synergids die after fertilisation */}
        <motion.g initial={false} animate={{ opacity: fused ? 0 : 1 }} transition={tr}>
          <SacAntipodes />
        </motion.g>
        <motion.g initial={false} animate={{ opacity: fused ? 0 : 1 }} transition={tr}>
          <SacSynergids gone={step >= 2 ? [0] : []} />
        </motion.g>
        {/* polar nuclei → endosperm nucleus */}
        <motion.g initial={false} animate={{ opacity: fused ? 0 : 1 }} transition={tr}>
          <SacPolar />
        </motion.g>
        <motion.g data-part="endonucleus" initial={false} animate={{ opacity: fused && !seed ? 1 : 0, scale: fused ? 1 : 0.4 }} transition={tr}>
          <circle cx={190} cy={195} r={13} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={2} />
          <text x={190} y={195} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
            3n
          </text>
        </motion.g>
        {/* egg cell → zygote → embryo */}
        <motion.g initial={false} animate={{ opacity: fused ? 0 : 1 }} transition={tr}>
          <SacEgg />
        </motion.g>
        <motion.g data-part="zygote" initial={false} animate={{ opacity: fused && !seed ? 1 : 0 }} transition={tr}>
          <ellipse {...OV.egg} rx={17} ry={20} fill="var(--bio-nucleus)" stroke="var(--blob)" strokeWidth={2.5} />
          <text x={190} y={250} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
            2n
          </text>
        </motion.g>
        <motion.g data-part="embryo" initial={false} animate={{ opacity: seed ? 1 : 0, scale: seed ? 1 : 0.3 }} transition={tr}>
          <path d="M 190 222 C 176 222, 170 238, 173 252 C 166 258, 166 278, 176 286 C 182 278, 184 270, 190 268 C 196 270, 198 278, 204 286 C 214 278, 214 258, 207 252 C 210 238, 204 222, 190 222 Z" transform="translate(0 -6)" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
          <path d="M 190 290 L 190 304" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
        </motion.g>
        {/* the pollen tube */}
        <g data-part="tube">
          <motion.path d={TUBE} fill="none" stroke="var(--bio-pollen)" strokeWidth={8} strokeLinecap="round" initial={false} animate={{ pathLength: step >= 1 ? 1 : 0, opacity: step >= 1 && !fused ? 1 : fused && !seed ? 0.3 : 0 }} transition={reduce ? { duration: 0 } : { duration: 1.2 }} />
        </g>
        {/* sperm cells */}
        <g data-part="sperm">
          {[0, 1].map((i) => (
            <motion.ellipse
              key={i}
              rx={4.5}
              ry={6}
              fill="var(--bio-nucleus-deep)"
              stroke="var(--raised)"
              strokeWidth={1}
              initial={false}
              animate={{ cx: SPERM[step][i][0], cy: SPERM[step][i][1], opacity: SPERM[step][i][2] }}
              transition={tr}
            />
          ))}
        </g>
        {/* flash when the nuclei fuse */}
        {step === 4 &&
          [250, 195].map((y) => (
            <motion.circle
              key={y}
              cx={190}
              cy={y}
              fill="none"
              stroke="var(--blob)"
              strokeWidth={2.5}
              initial={{ r: 10, opacity: 0.9 }}
              animate={{ r: 30, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 1, repeat: reduce ? 0 : 2 }}
            />
          ))}
        </g>
      </Figure>
      <div className="flex flex-wrap gap-1.5">
        {s.chips.map(([label, ploidy]) => (
          <span key={`${ploidy}${t(label)}`} className={cn("flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] text-ink-2")}>
            {t(label)}
            <span className="rounded-full bg-blob-soft px-2 py-0.5 font-semibold text-blob-ink">{ploidy}</span>
          </span>
        ))}
      </div>
      <StepCaption n={step + 1} title={s.title} note={s.note} />
      <StepControls step={step} onStep={setStep} titles={STEPS.map((x) => x.title)} delay={2000} />
    </div>
  );
}
