"use client";

// An animal cell (e.g. a cheek cell) as a labelled textbook schematic. `detail="lm"` shows the
// light-microscope view; `detail="em"` shows the organelles of the electron microscope image.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { Golgi, Lysosome, Mitochondrion, Nucleus, Ribosomes, RoughER, SmoothER, Vesicle } from "./CellOrganelles";
import type { CellDetail } from "./CellPlantCell";

const NX = 242;
const NY = 178;
const NR = 50;

export const ANIMAL_PARTS_LM: FigurePart[] = [
  { id: "membrane", label: tx("cell membrane", "Zellmembran"), at: [444, 108], tag: [532, 70], info: tx("The outer boundary: a thin, flexible skin that controls what goes in and out.", "Die äußere Grenze: ein dünnes, bewegliches Häutchen, das kontrolliert, was hinein- und hinausgeht.") },
  { id: "cytoplasm", label: tx("cytoplasm", "Zellplasma (Cytoplasma)"), at: [372, 136], info: tx("Jelly-like filling where most of the cell's chemistry happens.", "Gallertartige Grundsubstanz: Hier laufen viele Stoffwechselvorgänge ab.") },
  { id: "nucleus", label: tx("nucleus", "Zellkern"), at: [226, 194], info: tx("Holds the genetic information (DNA) and controls the cell.", "Enthält die Erbinformation (DNA) und steuert die Zelle.") },
];

export const ANIMAL_PARTS_EM: FigurePart[] = [
  ...ANIMAL_PARTS_LM,
  { id: "envelope", label: tx("nuclear envelope", "Kernhülle"), at: [206.6, 142.6], tag: [24, 112], info: tx("Double membrane around the nucleus.", "Doppelte Membran um den Zellkern.") },
  { id: "pore", label: tx("nuclear pore", "Kernpore"), at: [195.8, 197.2], tag: [24, 200], info: tx("Openings in the envelope: mRNA leaves the nucleus through them.", "Öffnungen in der Kernhülle: Durch sie verlässt z. B. die mRNA den Kern.") },
  { id: "mitochondrion", label: tx("mitochondrion", "Mitochondrium"), at: [300, 74], tag: [252, 18], info: tx("Power station of the cell: cellular respiration releases energy (ATP) from glucose.", "Kraftwerk der Zelle: Die Zellatmung setzt Energie (ATP) aus Traubenzucker frei.") },
  { id: "er", label: tx("rough ER", "raues ER"), at: [314, 178], info: tx("Membrane sacs studded with ribosomes: proteins are made and carried on.", "Membransäckchen mit Ribosomen: Proteine werden hergestellt und weitertransportiert.") },
  { id: "ser", label: tx("smooth ER", "glattes ER"), at: [380, 254], info: tx("Tubes without ribosomes: make lipids and store calcium.", "Röhren ohne Ribosomen: bilden Lipide und speichern Calcium.") },
  { id: "golgi", label: tx("Golgi apparatus", "Golgi-Apparat"), at: [150, 248], tag: [24, 290], info: tx("Stack of flat sacs: modifies, sorts and packs proteins into vesicles.", "Stapel flacher Säckchen: verändert, sortiert und verpackt Proteine in Vesikel.") },
  { id: "vesicle", label: tx("vesicle", "Vesikel"), at: [118, 296], tag: [52, 340], info: tx("Small membrane bubbles that carry substances, e.g. to the cell membrane.", "Kleine Membranbläschen, die Stoffe transportieren, z. B. zur Zellmembran.") },
  { id: "lysosome", label: tx("lysosome", "Lysosom"), at: [368, 92], tag: [420, 34], info: tx("Bag of digestive enzymes: breaks down worn-out parts and foreign matter.", "Bläschen mit Verdauungsenzymen: baut alte Zellbestandteile und Fremdstoffe ab.") },
  { id: "ribosome", label: tx("ribosomes", "Ribosomen"), at: [120, 222], tag: [24, 246], info: tx("Tiny protein factories: they join amino acids into proteins.", "Winzige Eiweißfabriken: Sie verknüpfen Aminosäuren zu Proteinen.") },
];

const MEMBRANE = "M 70 160 C 66 98, 128 50, 218 44 C 310 38, 402 54, 444 108 C 482 156, 474 246, 420 294 C 364 342, 238 340, 152 314 C 84 292, 74 222, 70 160 Z";

function arc(r: number, a0: number, a1: number) {
  const p = (a: number) => [NX + r * Math.cos((a * Math.PI) / 180), NY + r * Math.sin((a * Math.PI) / 180)].map((v) => v.toFixed(1)).join(" ");
  return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
}
const ER_PATHS = [arc(63, -48, 46), arc(72, -44, 42), arc(81, -40, 38)];
const ER_DOTS: [number, number][] = [66.6, 75.6, 84.6].flatMap((r, k) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = ((-44 + k * 3 + i * 9) * Math.PI) / 180;
    return [NX + r * Math.cos(a), NY + r * Math.sin(a)] as [number, number];
  }),
);
const SER_PATHS = [
  "M 338 238 C 352 228, 366 230, 378 240 C 390 250, 404 252, 420 240",
  "M 378 240 C 370 252, 372 262, 384 270 C 396 278, 410 276, 424 266",
  "M 384 270 C 376 281, 360 285, 346 278",
  "M 420 240 C 428 232, 432 222, 430 212",
];
const FREE_RIBOSOMES: [number, number][] = [
  [196, 84],
  [205, 92],
  [214, 82],
  [336, 58],
  [344, 64],
  [446, 210],
  [438, 218],
  [300, 302],
  [310, 308],
  [118, 214],
  [126, 222],
  [114, 228],
  [182, 286],
];

export function CellAnimalCell({ mode = "names", show, ask, highlight, legend, detail = "lm" }: DrawingProps & { detail?: CellDetail }) {
  const em = detail === "em";
  return (
    <Figure
      title={em ? tx("Animal cell (electron microscope)", "Tierzelle (elektronenmikroskopisch)") : tx("Animal cell (light microscope)", "Tierzelle (lichtmikroskopisch)")}
      width={560}
      height={360}
      parts={em ? ANIMAL_PARTS_EM : ANIMAL_PARTS_LM}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <g data-part="cytoplasm">
        <path d={MEMBRANE} fill="var(--bio-cell)" />
      </g>
      <g data-part="membrane">
        <path d={MEMBRANE} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.8} />
      </g>
      {em && (
        <>
          <g data-part="er">
            <RoughER d={ER_PATHS} dots={ER_DOTS} />
          </g>
          <g data-part="ser">
            <SmoothER d={SER_PATHS} />
          </g>
          <g data-part="golgi">
            <Golgi x={150} y={248} rot={53} s={0.85} />
          </g>
          <g data-part="vesicle">
            <Vesicle x={118} y={296} />
            <Vesicle x={100} y={268} r={4} />
            <Vesicle x={418} y={290} r={4} />
          </g>
          <g data-part="lysosome">
            <Lysosome x={368} y={92} />
            <Lysosome x={352} y={298} r={9} />
          </g>
          <g data-part="mitochondrion">
            <Mitochondrion x={300} y={74} rot={-10} />
            <Mitochondrion x={410} y={172} rot={84} l={20} w={9.5} />
            <Mitochondrion x={130} y={158} rot={84} l={20} w={9.5} />
            <Mitochondrion x={246} y={290} rot={4} l={20} w={9.5} />
          </g>
          <g data-part="ribosome">
            <Ribosomes at={FREE_RIBOSOMES} />
          </g>
        </>
      )}
      <g data-part="nucleus">
        <Nucleus x={NX} y={NY} r={em ? NR : 44} em={false} />
      </g>
      {em && (
        <>
          <g data-part="envelope">
            <EnvelopeRing />
          </g>
          <g data-part="pore">
            <Pores />
          </g>
        </>
      )}
    </Figure>
  );
}

// The nuclear envelope (double membrane) and its pores, drawn separately so each can light up.
const PORES = 9;
const SEG = (2 * Math.PI * NR) / PORES;
const GAP = 4.5;
function EnvelopeRing() {
  return (
    <>
      <circle cx={NX} cy={NY} r={NR} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={5} strokeDasharray={`${SEG - GAP} ${GAP}`} />
      <circle cx={NX} cy={NY} r={NR} fill="none" stroke="var(--bio-nucleus)" strokeWidth={1.6} strokeDasharray={`${SEG - GAP} ${GAP}`} />
    </>
  );
}
function Pores() {
  return (
    <g>
      {Array.from({ length: PORES }, (_, k) => {
        const a = ((k + 1) * SEG - GAP / 2) / NR;
        const x = NX + NR * Math.cos(a);
        const y = NY + NR * Math.sin(a);
        return <circle key={k} cx={x} cy={y} r={2.6} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1} opacity={0.7} />;
      })}
    </g>
  );
}
