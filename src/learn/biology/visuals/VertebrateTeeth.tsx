"use client";

// Mammal teeth tell the diet: plant-eater (cow: no upper incisors, a gap, broad grinding molars
// with enamel ridges), meat-eater (dog: fangs and carnassial teeth like scissors) and omnivore
// (human: all kinds of teeth, molars with blunt cusps). Upper and lower jaw from the side.

import { motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";

export type Diet = "herbivore" | "carnivore" | "omnivore";

export const DIET_NAMES: Record<Diet, { name: Text; animal: Text }> = {
  herbivore: { name: tx("plant-eater", "Pflanzenfresser"), animal: tx("cow", "Rind") },
  carnivore: { name: tx("meat-eater", "Fleischfresser"), animal: tx("dog", "Hund") },
  omnivore: { name: tx("omnivore", "Allesfresser"), animal: tx("human", "Mensch") },
};

const INC: FigurePart = { id: "incisors", label: tx("incisors", "Schneidezähne"), at: [0, 0], info: tx("Bite off and nibble.", "Abbeißen und Abknabbern.") };
const CAN: FigurePart = { id: "canines", label: tx("canines", "Eckzähne"), at: [0, 0], info: tx("Hold and pierce.", "Festhalten und Durchbohren.") };
const MOL: FigurePart = { id: "molars", label: tx("molars", "Backenzähne"), at: [0, 0], info: tx("Chew and grind.", "Zerkauen und Zermahlen.") };

export const TEETH_PARTS: Record<Diet, FigurePart[]> = {
  herbivore: [
    { ...INC, at: [70, 162], tag: [40, 120], info: tx("Only in the lower jaw: they press grass against a horny plate in the upper jaw and tear it off.", "Nur im Unterkiefer: Sie drücken das Gras gegen eine Hornplatte im Oberkiefer und reißen es ab.") },
    { id: "plate", label: tx("horny plate", "Hornplatte"), at: [80, 64], tag: [110, 24], info: tx("Replaces the upper incisors.", "Ersetzt die Schneidezähne im Oberkiefer.") },
    { id: "gap", label: tx("gap (no canines)", "Zahnlücke (keine Eckzähne)"), at: [190, 110], info: tx("Room for the tongue to move the grass around.", "Platz für die Zunge, die das Gras hin und her schiebt.") },
    { ...MOL, at: [380, 110], info: tx("Broad and flat with sharp enamel ridges: they grind tough grass like a millstone.", "Breit und flach mit scharfen Schmelzfalten: Sie zermahlen zähes Gras wie ein Mahlstein.") },
  ],
  carnivore: [
    { ...INC, at: [62, 112], tag: [40, 160], info: tx("Small: scrape meat off bones.", "Klein: schaben Fleisch von Knochen.") },
    { ...CAN, label: tx("canines (fangs)", "Eckzähne (Fangzähne)"), at: [118, 112], tag: [118, 200], info: tx("Long and pointed: grip and kill the prey.", "Lang und spitz: Sie packen und töten die Beute.") },
    { id: "carnassial", label: tx("carnassial teeth", "Reißzähne"), at: [348, 106], tag: [330, 200], info: tx("Large blade-like cheek teeth that slide past each other like scissors and cut meat.", "Große, klingenartige Backenzähne, die wie eine Schere aneinander vorbeigleiten und Fleisch zerschneiden.") },
    { ...MOL, at: [440, 104], tag: [470, 160], info: tx("Few and small: meat is hardly chewed, it's swallowed in pieces.", "Wenige und klein: Fleisch wird kaum gekaut, sondern in Brocken geschluckt.") },
  ],
  omnivore: [
    { ...INC, at: [70, 110], tag: [40, 160], info: tx("Chisel-shaped: bite off.", "Meißelförmig: abbeißen.") },
    { ...CAN, at: [124, 110], tag: [124, 200], info: tx("Short, hardly longer than the other teeth.", "Kurz, kaum länger als die anderen Zähne.") },
    { ...MOL, at: [360, 110], tag: [360, 200], info: tx("Cheek teeth with blunt cusps: they crush and grind all kinds of food.", "Backenzähne mit stumpfen Höckern: Sie zerquetschen und zermahlen jede Art von Nahrung.") },
  ],
};

const ENAMEL = "var(--raised)";
const LINE = "var(--bio-outline)";
const GUM = "color-mix(in oklab, var(--bio-flesh) 80%, var(--raised))";

type Tooth = { kind: "inc" | "can" | "canH" | "pre" | "carn" | "molH" | "molO" | "molC"; x: number; w: number; part: string };

const H = 220;
/** Upper tooth outline hanging from the upper jaw at y=60. */
function shape(t: Tooth): string {
  const { x, w } = t;
  switch (t.kind) {
    case "inc":
      return `M${x} 60 L ${x} 98 Q ${x + w / 2} 104 ${x + w} 98 L ${x + w} 60 Z`;
    case "can":
      return `M${x} 60 C ${x} 86, ${x + w * 0.3} 112, ${x + w * 0.5} 130 C ${x + w * 0.7} 112, ${x + w} 86, ${x + w} 60 Z`;
    case "canH":
      return `M${x} 60 L ${x} 98 L ${x + w / 2} 110 L ${x + w} 98 L ${x + w} 60 Z`;
    case "pre":
      return `M${x} 60 L ${x} 92 L ${x + w * 0.5} 108 L ${x + w} 92 L ${x + w} 60 Z`;
    case "carn":
      return `M${x} 60 L ${x} 90 L ${x + w * 0.3} 114 L ${x + w * 0.52} 98 L ${x + w * 0.78} 116 L ${x + w} 92 L ${x + w} 60 Z`;
    case "molH":
      return `M${x} 60 L ${x} 108 L ${x + w} 108 L ${x + w} 60 Z`;
    case "molO":
      return `M${x} 60 L ${x} 100 Q ${x + w * 0.25} 110 ${x + w * 0.5} 102 Q ${x + w * 0.75} 110 ${x + w} 100 L ${x + w} 60 Z`;
    case "molC":
      return `M${x} 60 L ${x} 94 Q ${x + w / 2} 104 ${x + w} 94 L ${x + w} 60 Z`;
  }
}

const ROWS: Record<Diet, { upper: Tooth[]; lower: Tooth[]; plate?: boolean }> = {
  herbivore: {
    plate: true,
    upper: [
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molH", x: 270 + i * 38, w: 34, part: "molars" })),
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molH", x: 384 + i * 40, w: 36, part: "molars" })),
    ],
    lower: [
      ...[0, 1, 2, 3].map((i): Tooth => ({ kind: "inc", x: 52 + i * 12, w: 11, part: "incisors" })),
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molH", x: 270 + i * 38, w: 34, part: "molars" })),
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molH", x: 384 + i * 40, w: 36, part: "molars" })),
    ],
  },
  carnivore: {
    upper: [
      ...[0, 1, 2].map((i): Tooth => ({ kind: "inc", x: 48 + i * 15, w: 13, part: "incisors" })),
      { kind: "can", x: 104, w: 26, part: "canines" },
      ...[0, 1, 2].map((i): Tooth => ({ kind: "pre", x: 160 + i * 42, w: 34, part: "molars" })),
      { kind: "carn", x: 300, w: 78, part: "carnassial" },
      { kind: "molC", x: 386, w: 40, part: "molars" },
      { kind: "molC", x: 430, w: 30, part: "molars" },
    ],
    lower: [
      ...[0, 1, 2].map((i): Tooth => ({ kind: "inc", x: 54 + i * 14, w: 12, part: "incisors" })),
      { kind: "can", x: 114, w: 24, part: "canines" },
      ...[0, 1, 2, 3].map((i): Tooth => ({ kind: "pre", x: 156 + i * 36, w: 30, part: "molars" })),
      { kind: "carn", x: 306, w: 74, part: "carnassial" },
      { kind: "molC", x: 390, w: 34, part: "molars" },
      { kind: "molC", x: 430, w: 24, part: "molars" },
    ],
  },
  omnivore: {
    upper: [
      ...[0, 1].map((i): Tooth => ({ kind: "inc", x: 50 + i * 22, w: 20, part: "incisors" })),
      { kind: "canH", x: 94, w: 18, part: "canines" },
      ...[0, 1].map((i): Tooth => ({ kind: "molO", x: 118 + i * 30, w: 28, part: "molars" })),
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molO", x: 184 + i * 44, w: 40, part: "molars" })),
    ],
    lower: [
      ...[0, 1].map((i): Tooth => ({ kind: "inc", x: 54 + i * 20, w: 18, part: "incisors" })),
      { kind: "canH", x: 96, w: 18, part: "canines" },
      ...[0, 1].map((i): Tooth => ({ kind: "molO", x: 120 + i * 30, w: 28, part: "molars" })),
      ...[0, 1, 2].map((i): Tooth => ({ kind: "molO", x: 186 + i * 44, w: 40, part: "molars" })),
    ],
  },
};

function ToothShape({ t, lower }: { t: Tooth; lower: boolean }) {
  return (
    <g transform={lower ? `translate(0 ${H}) scale(1 -1)` : undefined}>
      <path d={shape(t)} fill={ENAMEL} stroke={LINE} strokeWidth={1.5} />
      {t.kind === "molH" && <path d={`M${t.x + 4} 104 l 5 -10 l 5 10 l 5 -10 l 5 10 l 5 -10`} fill="none" stroke={LINE} strokeWidth={1.2} opacity={0.75} />}
    </g>
  );
}

const JAW_LEN: Record<Diet, number> = { herbivore: 510, carnivore: 470, omnivore: 320 };

export function VertebrateTeeth({ diet = "herbivore", mode = "names", show, ask, highlight, legend }: DrawingProps & { diet?: Diet }) {
  const R = ROWS[diet];
  const len = JAW_LEN[diet];
  const parts = TEETH_PARTS[diet];
  return (
    <Figure title={tx(`Teeth of a ${resolve(DIET_NAMES[diet].animal, "en")}`, `Gebiss: ${resolve(DIET_NAMES[diet].animal, "de")}`)} width={540} height={H} parts={parts} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d={`M30 60 L ${len} 60 L ${len + 10} 30 L 44 30 C 34 34, 30 46, 30 60 Z`} fill={GUM} stroke={LINE} strokeWidth={1.6} />
        <path d={`M30 ${H - 60} L ${len} ${H - 60} L ${len + 10} ${H - 30} L 44 ${H - 30} C 34 ${H - 34}, 30 ${H - 46}, 30 ${H - 60} Z`} fill={GUM} stroke={LINE} strokeWidth={1.6} />
        {R.plate && <path data-part="plate" d="M48 60 L 104 60 L 104 74 Q 76 80 48 74 Z" fill="color-mix(in oklab, var(--bio-sun) 45%, var(--raised))" stroke={LINE} strokeWidth={1.4} />}
        {diet === "herbivore" && <rect data-part="gap" x={110} y={62} width={150} height={96} rx={10} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="5 5" />}
        {(["incisors", "canines", "carnassial", "molars"] as const).map((p) => (
          <g key={p} data-part={p}>
            {R.upper.filter((t) => t.part === p).map((t, i) => (
              <ToothShape key={`u${i}`} t={t} lower={false} />
            ))}
            {R.lower.filter((t) => t.part === p).map((t, i) => (
              <ToothShape key={`l${i}`} t={t} lower />
            ))}
          </g>
        ))}
      </g>
    </Figure>
  );
}

const resolve = (t: Text, l: "en" | "de") => (typeof t === "string" ? t : t[l]);

export function VertebrateTeethWidget() {
  const t = useText();
  const [diet, setDiet] = useState<Diet>("herbivore");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(DIET_NAMES) as Diet[]).map((d) => (
          <button key={d} type="button" onClick={() => setDiet(d)} className={cn("rounded-full border px-3 py-1 text-[13.5px] font-semibold transition-colors", d === diet ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:text-ink")}>
            {t(DIET_NAMES[d].name)} ({t(DIET_NAMES[d].animal)})
          </button>
        ))}
      </div>
      <motion.div key={diet} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <VertebrateTeeth diet={diet} mode="explore" />
      </motion.div>
    </div>
  );
}
