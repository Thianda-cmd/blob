"use client";

// A chloroplast in longitudinal section for level 3: double envelope membrane, stroma, grana
// stacks of thylakoids joined by stroma thylakoids, thylakoid lumen, ring-shaped plastid DNA,
// 70S ribosomes, a starch grain and plastoglobuli.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const CHLORO_PARTS: FigurePart[] = [
  { id: "outer", label: tx("outer membrane", "äußere Membran"), at: [118, 61], tag: [96, 18], info: tx("Part of the double envelope. It's freely permeable to small molecules.", "Teil der Doppelmembran (Hüllmembran). Sie ist für kleine Moleküle gut durchlässig.") },
  { id: "inner", label: tx("inner membrane", "innere Membran"), at: [196, 50], tag: [214, 12], info: tx("Controls what enters and leaves the stroma, with transport proteins.", "Kontrolliert mit Transportproteinen, was ins Stroma hinein- und hinausgeht.") },
  { id: "stroma", label: tx("stroma", "Stroma"), at: [394, 96], info: tx("The fluid inside: the Calvin cycle runs here, with the enzyme Rubisco.", "Die Grundsubstanz: Hier läuft der Calvin-Zyklus ab, mit dem Enzym Rubisco.") },
  { id: "granum", label: tx("granum (stack of thylakoids)", "Granum (Thylakoidstapel)"), at: [180, 152], info: tx("Stacked thylakoids: lots of membrane for the light reactions.", "Gestapelte Thylakoide: viel Membranfläche für die Lichtreaktionen.") },
  { id: "thylakoid", label: tx("thylakoid membrane", "Thylakoidmembran"), at: [306, 129], tag: [318, 18], info: tx("Holds the pigments, photosystems, electron transport chain and ATP synthase.", "Trägt die Pigmente, Fotosysteme, die Elektronentransportkette und die ATP-Synthase.") },
  { id: "lumen", label: tx("thylakoid lumen", "Thylakoidinnenraum (Lumen)"), at: [440, 172], tag: [478, 256], info: tx("The space inside the thylakoids: protons pile up here in the light.", "Der Raum in den Thylakoiden: Hier sammeln sich im Licht Protonen an.") },
  { id: "lamella", label: tx("stroma thylakoid", "Stromathylakoid"), at: [316, 212], tag: [300, 274], info: tx("Joins the grana stacks to one connected membrane system.", "Verbindet die Grana zu einem zusammenhängenden Membransystem.") },
  { id: "dna", label: tx("plastid DNA (ring)", "Plastiden-DNA (ringförmig)"), at: [100, 102], tag: [36, 76], info: tx("Own ring-shaped DNA, like bacteria: evidence for the endosymbiotic theory.", "Eigene, ringförmige DNA wie bei Bakterien: ein Beleg für die Endosymbiontentheorie.") },
  { id: "ribo", label: tx("ribosomes (70S)", "Ribosomen (70S)"), at: [500, 126], tag: [548, 92], info: tx("Small 70S ribosomes, like those of bacteria, make some of the chloroplast's proteins.", "Kleine 70S-Ribosomen wie bei Bakterien stellen einen Teil der Proteine her.") },
  { id: "starch", label: tx("starch grain", "Stärkekorn"), at: [112, 210], tag: [70, 262], info: tx("Glucose from photosynthesis is stored here for a while as starch.", "Hier wird Glucose aus der Fotosynthese vorübergehend als Stärke gespeichert.") },
];

const OUT = "var(--bio-outline)";
const MEM = "var(--bio-leaf-deep)";

const GRANA: [number, number, number][] = [
  [180, 128, 7],
  [306, 116, 8],
  [440, 132, 6],
  [244, 210, 5],
  [384, 196, 5],
];

function Granum({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={x - 32} y={y + i * 9} width={64} height={8} rx={4} fill="var(--bio-chloro)" stroke={MEM} strokeWidth={1.3} />
          <rect x={x - 27} y={y + i * 9 + 2.6} width={54} height={2.8} rx={1.4} fill="var(--bio-leaf)" opacity={0.9} />
        </g>
      ))}
    </g>
  );
}

export function PhotoChloroplast({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Chloroplast (electron microscope view, schematic)", "Chloroplast (elektronenmikroskopisch, schematisch)")} width={580} height={290} parts={CHLORO_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="outer">
        <ellipse cx={290} cy={150} rx={262} ry={118} fill="var(--bio-cell)" stroke={OUT} strokeWidth={2.4} />
      </g>
      <g data-part="inner">
        <ellipse cx={290} cy={150} rx={252} ry={108} fill="none" stroke={MEM} strokeWidth={2} />
      </g>
      <g data-part="stroma">
        <ellipse cx={290} cy={150} rx={250} ry={106} fill="var(--bio-leaf)" opacity={0.28} />
        {[
          [150, 96],
          [262, 86],
          [372, 100],
          [470, 190],
          [210, 236],
          [420, 236],
          [130, 170],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill="var(--bio-pollen)" opacity={0.7} stroke={OUT} strokeWidth={0.6} />
        ))}
      </g>
      <g data-part="lamella" fill="none" stroke={MEM} strokeWidth={2.2} strokeLinecap="round">
        <path d="M212 150 C 240 150 250 138 274 136" />
        <path d="M212 160 C 230 180 220 210 212 214" />
        <path d="M338 136 C 370 140 392 146 408 150" />
        <path d="M338 160 C 360 176 368 190 352 198" />
        <path d="M276 214 C 310 214 330 210 352 206" />
        <path d="M472 150 C 500 152 520 154 534 156" />
        <path d="M148 150 C 110 150 80 150 46 152" />
      </g>
      <g data-part="granum">
        <Granum x={180} y={GRANA[0][1]} n={GRANA[0][2]} />
      </g>
      <g data-part="thylakoid">
        <Granum x={306} y={GRANA[1][1]} n={GRANA[1][2]} />
      </g>
      <g data-part="lumen">
        <Granum x={440} y={GRANA[2][1]} n={GRANA[2][2]} />
        <rect x={413} y={GRANA[2][1] + 36 + 2.6} width={54} height={2.8} rx={1.4} fill="var(--bio-vacuole)" />
      </g>
      <Granum x={GRANA[3][0]} y={GRANA[3][1]} n={GRANA[3][2]} />
      <Granum x={GRANA[4][0]} y={GRANA[4][1]} n={GRANA[4][2]} />
      <g data-part="dna" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8}>
        <path d="M98 112 C 96 98 118 94 124 104 C 132 116 116 128 106 124 C 96 120 102 110 112 112" />
      </g>
      <g data-part="ribo">
        {[
          [494, 118],
          [504, 128],
          [490, 134],
          [512, 114],
          [158, 228],
          [168, 236],
          [360, 72],
          [372, 66],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.6} fill="var(--bio-nucleus-deep)" />
        ))}
      </g>
      <g data-part="starch">
        <ellipse cx={112} cy={210} rx={26} ry={15} fill="var(--bio-bone)" stroke={OUT} strokeWidth={1.4} />
        <ellipse cx={108} cy={207} rx={14} ry={7} fill="none" stroke={OUT} strokeWidth={0.8} opacity={0.5} />
      </g>
    </Figure>
  );
}

/** The chloroplast to explore in the lesson. */
export function PhotoChloroplastExplore() {
  return <PhotoChloroplast mode="explore" />;
}
