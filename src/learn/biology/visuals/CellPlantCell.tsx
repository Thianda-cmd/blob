"use client";

// A plant cell (e.g. from a leaf) as a labelled textbook schematic. `detail="lm"` shows what a
// light microscope shows; `detail="em"` adds the organelles only an electron microscope reveals.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { Chloroplast, Golgi, Mitochondrion, Nucleus, Ribosomes, RoughER } from "./CellOrganelles";

export type CellDetail = "lm" | "em";

export const PLANT_PARTS_LM: FigurePart[] = [
  { id: "wall", label: tx("cell wall", "Zellwand"), at: [56, 250], tag: [24, 250], info: tx("Firm layer of cellulose outside the membrane: gives the cell its shape and strength.", "Feste Hülle aus Cellulose außen um die Membran: gibt der Zelle Form und Festigkeit.") },
  { id: "membrane", label: tx("cell membrane", "Zellmembran"), at: [65.5, 150], tag: [24, 150], info: tx("Thin skin right under the wall: controls what goes in and out.", "Dünnes Häutchen direkt unter der Wand: kontrolliert, was hinein- und hinausgeht.") },
  { id: "cytoplasm", label: tx("cytoplasm", "Zellplasma (Cytoplasma)"), at: [266, 298], info: tx("Jelly-like filling where most of the cell's chemistry happens.", "Gallertartige Grundsubstanz: Hier laufen viele Stoffwechselvorgänge ab.") },
  { id: "nucleus", label: tx("nucleus", "Zellkern"), at: [136, 186], info: tx("Holds the genetic information (DNA) and controls the cell.", "Enthält die Erbinformation (DNA) und steuert die Zelle.") },
  { id: "vacuole", label: tx("vacuole", "Vakuole"), at: [365, 180], info: tx("Large sac of cell sap (water, salts, sugar, dyes): keeps the cell firm.", "Großer Raum mit Zellsaft (Wasser, Salze, Zucker, Farbstoffe): hält die Zelle prall.") },
  { id: "chloroplast", label: tx("chloroplast", "Chloroplast"), at: [300, 64], tag: [300, 14], info: tx("Green with chlorophyll: makes sugar from light, water and carbon dioxide (photosynthesis).", "Grün durch Chlorophyll: stellt mit Licht aus Wasser und Kohlenstoffdioxid Zucker her (Fotosynthese).") },
];

export const PLANT_PARTS_EM: FigurePart[] = [
  ...PLANT_PARTS_LM,
  { id: "mitochondrion", label: tx("mitochondrion", "Mitochondrium"), at: [166, 104], tag: [206, 30], info: tx("Cellular respiration: releases energy from glucose. Plant cells have them too!", "Zellatmung: setzt Energie aus Traubenzucker frei. Auch Pflanzenzellen haben sie!") },
  { id: "er", label: tx("rough ER", "raues ER"), at: [220, 172], info: tx("Membrane channels with ribosomes: proteins are made and transported here.", "Membrankanäle mit Ribosomen: Hier werden Proteine hergestellt und transportiert.") },
  { id: "golgi", label: tx("Golgi apparatus", "Golgi-Apparat"), at: [150, 262], tag: [150, 346], info: tx("Stack of flat sacs: modifies, sorts and packs proteins into vesicles.", "Stapel flacher Säckchen: verändert, sortiert und verpackt Proteine in Vesikel.") },
  { id: "ribosome", label: tx("ribosomes", "Ribosomen"), at: [98, 137], tag: [24, 200], info: tx("Tiny protein factories: they join amino acids into proteins.", "Winzige Eiweißfabriken: Sie verknüpfen Aminosäuren zu Proteinen.") },
];

const CHLOROPLASTS: [number, number, number][] = [
  [180, 64, 3],
  [300, 64, -4],
  [385, 62, 2],
  [456, 80, 26],
  [481, 158, 90],
  [481, 232, 92],
  [452, 290, -24],
  [380, 301, 3],
  [312, 298, -3],
  [84, 216, 84],
  [100, 78, -30],
];

const VACUOLE = "M 285 92 C 345 76, 438 80, 460 110 C 480 140, 476 232, 456 258 C 430 290, 335 288, 292 270 C 258 255, 250 206, 254 168 C 257 132, 263 102, 285 92 Z";

const NX = 150;
const NY = 172;

function arc(r: number, a0: number, a1: number) {
  const p = (a: number) => [NX + r * Math.cos((a * Math.PI) / 180), NY + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(1)).join(" ");
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}
const ER_PATHS = [arc(52, -42, 48), arc(61, -38, 44), arc(70, -34, 40)];
const ER_DOTS: [number, number][] = [55.6, 64.6, 73.6].flatMap((r, k) =>
  Array.from({ length: 9 }, (_, i) => {
    const a = ((-36 + k * 3 + i * 9.4) * Math.PI) / 180;
    return [NX + r * Math.cos(a), NY + r * Math.sin(a)] as [number, number];
  }),
);
const FREE_RIBOSOMES: [number, number][] = [
  [90, 128],
  [98, 137],
  [86, 146],
  [208, 92],
  [216, 100],
  [238, 236],
  [246, 244],
  [108, 230],
  [117, 238],
  [470, 300],
  [462, 306],
  [262, 76],
];

export function CellPlantCell({ mode = "names", show, ask, highlight, legend, detail = "lm" }: DrawingProps & { detail?: CellDetail }) {
  const em = detail === "em";
  return (
    <Figure
      title={em ? tx("Plant cell (electron microscope)", "Pflanzenzelle (elektronenmikroskopisch)") : tx("Plant cell (light microscope)", "Pflanzenzelle (lichtmikroskopisch)")}
      width={560}
      height={360}
      parts={em ? PLANT_PARTS_EM : PLANT_PARTS_LM}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <g data-part="wall">
        <path
          d="M 80 30 H 480 A 30 30 0 0 1 510 60 V 300 A 30 30 0 0 1 480 330 H 80 A 30 30 0 0 1 50 300 V 60 A 30 30 0 0 1 80 30 Z M 84 42 H 476 A 22 22 0 0 1 498 64 V 296 A 22 22 0 0 1 476 318 H 84 A 22 22 0 0 1 62 296 V 64 A 22 22 0 0 1 84 42 Z"
          fill="var(--bio-wall)"
          fillRule="evenodd"
          stroke="var(--bio-wall-deep)"
          strokeWidth={2}
        />
      </g>
      <g data-part="cytoplasm">
        <rect x={65.5} y={45.5} width={429} height={269} rx={19} fill="var(--bio-cell)" />
      </g>
      <g data-part="membrane">
        <rect x={65.5} y={45.5} width={429} height={269} rx={19} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.6} />
      </g>
      <g data-part="vacuole">
        <path d={VACUOLE} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.6} />
      </g>
      {em && (
        <>
          <g data-part="er">
            <RoughER d={ER_PATHS} dots={ER_DOTS} />
          </g>
          <g data-part="golgi">
            <Golgi x={150} y={262} rot={0} s={0.9} />
          </g>
          <g data-part="mitochondrion">
            <Mitochondrion x={150} y={104} rot={-6} l={19} w={9} />
            <Mitochondrion x={226} y={268} rot={74} l={18} w={8.5} />
            <Mitochondrion x={240} y={66} rot={4} l={17} w={8} />
          </g>
          <g data-part="ribosome">
            <Ribosomes at={FREE_RIBOSOMES} />
          </g>
        </>
      )}
      <g data-part="nucleus">
        <Nucleus x={NX} y={NY} r={40} em={em} />
      </g>
      <g data-part="chloroplast">
        {CHLOROPLASTS.map(([x, y, rot], i) => (
          <Chloroplast key={i} x={x} y={y} rot={rot} em={em} />
        ))}
      </g>
    </Figure>
  );
}
