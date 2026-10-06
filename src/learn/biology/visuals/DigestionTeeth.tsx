"use client";

// The upper jaw of the permanent set of teeth seen from below: 16 teeth in an arch
// (per half: 2 incisors, 1 canine, 2 premolars, 3 molars, the last one the wisdom tooth).

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export type ToothType = "incisors" | "canines" | "premolars" | "molars";

export const TEETH_PARTS: (FigurePart & { id: ToothType })[] = [
  { id: "incisors", label: tx("incisors", "Schneidezähne"), at: [191, 60], tag: [128, 22], info: tx("Bite off pieces with their sharp, chisel-like edge.", "Beißen mit ihrer scharfen, meißelartigen Kante Stücke ab.") },
  { id: "canines", label: tx("canines", "Eckzähne"), at: [234, 84], tag: [318, 56], info: tx("Long and pointed: hold and tear the food. They have the longest root.", "Lang und spitz: halten die Nahrung fest und reißen. Sie haben die längste Wurzel.") },
  { id: "premolars", label: tx("premolars (front cheek teeth)", "vordere Backenzähne"), at: [253, 116], tag: [332, 112], info: tx("Two cusps: they crush the food.", "Zwei Höcker: Sie zerkleinern die Nahrung.") },
  { id: "molars", label: tx("molars (back cheek teeth)", "hintere Backenzähne"), at: [268, 174], tag: [332, 182], info: tx("A broad surface with four cusps grinds the food. The last one is the wisdom tooth.", "Eine breite Kaufläche mit vier Höckern zermahlt die Nahrung. Der letzte ist der Weisheitszahn.") },
];

type Tooth = { type: ToothType; x: number; y: number; a: number; s: number };

// One half of the arch (viewer's right); the other half is mirrored.
const HALF: Tooth[] = [
  { type: "incisors", x: 191, y: 57, a: 8, s: 1.1 },
  { type: "incisors", x: 214, y: 66, a: 28, s: 0.92 },
  { type: "canines", x: 233, y: 83, a: 44, s: 1.1 },
  { type: "premolars", x: 247, y: 104, a: 62, s: 1 },
  { type: "premolars", x: 257, y: 128, a: 74, s: 1 },
  { type: "molars", x: 265, y: 158, a: 83, s: 1.05 },
  { type: "molars", x: 270, y: 191, a: 88, s: 1 },
  { type: "molars", x: 272, y: 222, a: 91, s: 0.9 },
];

const OUT = "var(--bio-outline)";

function ToothShape({ type, s }: { type: ToothType; s: number }) {
  const fill = "var(--bio-bone)";
  switch (type) {
    case "incisors":
      return (
        <g transform={`scale(${s})`}>
          <path d="M-10 -4 Q0 -7 10 -4 L9 4 Q0 8 -9 4 Z" fill={fill} stroke={OUT} strokeWidth={1.3} />
          <path d="M-8 -3.2 Q0 -5.6 8 -3.2" fill="none" stroke={OUT} strokeOpacity={0.5} strokeWidth={0.9} />
        </g>
      );
    case "canines":
      return (
        <g transform={`scale(${s})`}>
          <path d="M-8 2 Q-5 -5 0 -11 Q5 -5 8 2 Q5 8 0 8.5 Q-5 8 -8 2 Z" fill={fill} stroke={OUT} strokeWidth={1.3} />
          <path d="M0 -8 L0 2" stroke={OUT} strokeOpacity={0.45} strokeWidth={1} />
        </g>
      );
    case "premolars":
      return (
        <g transform={`scale(${s})`}>
          <rect x={-7.5} y={-9} width={15} height={18} rx={6} fill={fill} stroke={OUT} strokeWidth={1.3} />
          <path d="M-5 0 L5 0" stroke={OUT} strokeOpacity={0.5} strokeWidth={1} />
        </g>
      );
    case "molars":
      return (
        <g transform={`scale(${s})`}>
          <rect x={-11} y={-11} width={22} height={22} rx={7} fill={fill} stroke={OUT} strokeWidth={1.3} />
          <path d="M-7 0 L7 0 M0 -7 L0 7" stroke={OUT} strokeOpacity={0.5} strokeWidth={1} />
        </g>
      );
  }
}

export function DigestionTeeth({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const W = 360;
  const teeth = [...HALF, ...HALF.map((t) => ({ ...t, x: W - t.x, a: -t.a }))];
  return (
    <Figure title={tx("Upper jaw of an adult (permanent teeth)", "Oberkiefer eines Erwachsenen (Dauergebiss)")} width={W} height={262} parts={TEETH_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* palate and gums */}
      <path d="M86 236 C82 150 110 52 180 46 C250 52 278 150 274 236 Z" fill="color-mix(in oklab, var(--bio-petal) 40%, var(--bio-flesh))" />
      <path d="M86 236 C82 150 110 52 180 46 C250 52 278 150 274 236" fill="none" stroke="color-mix(in oklab, var(--bio-petal) 72%, var(--bio-flesh))" strokeWidth={36} strokeLinecap="round" />
      <path d="M160 108 Q170 102 176 110 M184 110 Q190 102 200 108 M154 130 Q168 122 176 132 M184 132 Q192 122 206 130 M180 100 L180 226" fill="none" stroke="var(--bio-petal-deep)" strokeOpacity={0.4} strokeWidth={1.3} strokeLinecap="round" />
      {(["incisors", "canines", "premolars", "molars"] as ToothType[]).map((type) => (
        <g key={type} data-part={type}>
          {teeth
            .filter((t) => t.type === type)
            .map((t, i) => (
              <g key={i} transform={`translate(${t.x} ${t.y}) rotate(${t.a})`}>
                <ToothShape type={type} s={t.s} />
              </g>
            ))}
        </g>
      ))}
    </Figure>
  );
}

export function DigestionTeethExplore() {
  return <DigestionTeeth mode="explore" />;
}
