"use client";

// A rod-shaped bacterium (prokaryotic cell) as a labelled textbook schematic: no nucleus, the
// ring-shaped bacterial chromosome lies free in the cytoplasm (nucleoid).

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { Ribosomes } from "./CellOrganelles";
import { cos, sin } from "@/lib/stableMath";


// The folded, ring-shaped chromosome: one closed loop with many twists.
const NUCLEOID = (() => {
  const pts: string[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * 2 * Math.PI;
    const x = 272 + 64 * cos(t) + 11 * cos(7 * t) + 4 * sin(13 * t);
    const y = 130 + 20 * sin(t) + 9 * sin(8 * t) + 3 * cos(11 * t);
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
})();

// Ribosomes spread through the cytoplasm, but not on the nucleoid.
const RIBOSOMES: [number, number][] = (() => {
  const out: [number, number][] = [];
  let h = 7;
  for (let i = 0; out.length < 46 && i < 400; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    const x = 126 + (h % 300);
    h = (h * 1103515245 + 12345) % 2147483648;
    const y = 92 + (h % 78);
    const inBody = ((x - 276) / 158) ** 2 + ((y - 130) / 44) ** 2 < 1 && x > 132 && x < 420;
    const onNucleoid = ((x - 272) / 86) ** 2 + ((y - 130) / 34) ** 2 < 1;
    const onPlasmid = Math.hypot(x - 150, y - 112) < 13 || Math.hypot(x - 396, y - 150) < 13 || Math.hypot(x - 176, y - 154) < 11;
    if (inBody && !onNucleoid && !onPlasmid && !out.some(([a, b]) => Math.hypot(a - x, b - y) < 9)) out.push([x, y]);
  }
  return out;
})();

/** The ribosome the marker points at: the one nearest the lower right. */
const RIB_AT = RIBOSOMES.reduce((best, p) => (Math.hypot(p[0] - 414, p[1] - 152) < Math.hypot(best[0] - 414, best[1] - 152) ? p : best));

const FLAGELLUM = (() => {
  const pts: string[] = [];
  for (let x = 452; x <= 554; x += 2) {
    const amp = Math.min(11, (x - 452) * 0.35);
    pts.push(`${x} ${(130 + amp * sin((x - 452) / 9)).toFixed(1)}`);
  }
  return `M 443 130 L ${pts.join(" L ")}`;
})();

const PILI: [number, number, number, number][] = [
  [150, 74, 140, 44],
  [214, 70, 212, 40],
  [300, 70, 304, 40],
  [384, 72, 392, 42],
  [128, 182, 116, 210],
  [196, 190, 190, 220],
  [276, 190, 280, 220],
  [352, 190, 362, 220],
  [104, 112, 72, 104],
];

export const BACTERIUM_PARTS: FigurePart[] = [
  { id: "capsule", label: tx("capsule (slime layer)", "Kapsel (Schleimkapsel)"), at: [200, 62], tag: [200, 20], info: tx("Slimy outer layer: protects against drying out and against the immune system.", "Schleimige Außenschicht: schützt vor Austrocknung und vor dem Immunsystem.") },
  { id: "wall", label: tx("cell wall", "Zellwand"), at: [262, 74], tag: [262, 20], info: tx("Firm wall made of murein (not cellulose): gives shape and protection.", "Feste Wand aus Murein (nicht aus Cellulose): gibt Form und Schutz.") },
  { id: "membrane", label: tx("cell membrane", "Zellmembran"), at: [324, 79.5], tag: [324, 20], info: tx("Controls what goes in and out, like in our cells.", "Kontrolliert, was hinein- und hinausgeht, wie bei unseren Zellen.") },
  { id: "cytoplasm", label: tx("cytoplasm", "Zellplasma (Cytoplasma)"), at: [392, 104], info: tx("Filling of the cell: here the metabolism takes place.", "Füllung der Zelle: Hier läuft der Stoffwechsel ab.") },
  { id: "nucleoid", label: tx("bacterial chromosome (nucleoid)", "Bakterienchromosom (Nucleoid)"), at: [300, 140], info: tx("One ring-shaped DNA molecule, lying free in the cytoplasm: there is no nucleus.", "Ein ringförmiges DNA-Molekül, das frei im Zellplasma liegt: Es gibt keinen Zellkern.") },
  { id: "plasmid", label: tx("plasmid", "Plasmid"), at: [150, 112], tag: [40, 112], info: tx("Small extra DNA ring, e.g. with genes for antibiotic resistance. Can be passed on to other bacteria.", "Kleiner zusätzlicher DNA-Ring, z. B. mit Genen für Antibiotikaresistenz. Kann an andere Bakterien weitergegeben werden.") },
  { id: "ribosome", label: tx("ribosomes (70S)", "Ribosomen (70S)"), at: RIB_AT, tag: [520, 214], info: tx("Make proteins. They are smaller than ours (70S instead of 80S).", "Stellen Proteine her. Sie sind kleiner als unsere (70S statt 80S).") },
  { id: "flagellum", label: tx("flagellum", "Geißel (Flagellum)"), at: [508, 126], info: tx("A whip that rotates like a propeller: the bacterium swims.", "Ein Faden, der sich wie ein Propeller dreht: Das Bakterium schwimmt.") },
  { id: "pili", label: tx("pili", "Pili (Fimbrien)"), at: [384, 47], tag: [440, 20], info: tx("Fine hairs: the bacterium sticks to surfaces with them.", "Feine Härchen: Damit haftet das Bakterium an Oberflächen.") },
];

export function CellBacterium({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Bacterial cell (prokaryote)", "Bakterienzelle (Prokaryot)")} width={560} height={240} parts={BACTERIUM_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="pili">
        {PILI.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bio-wood-deep)" strokeWidth={1.6} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="flagellum">
        <path d={FLAGELLUM} fill="none" stroke="var(--bio-outline)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-part="capsule">
        <rect x={86} y={56} width={380} height={148} rx={74} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.3} strokeDasharray="5 4" />
      </g>
      <g data-part="wall">
        <rect x={100} y={70} width={352} height={120} rx={60} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.8} />
      </g>
      <g data-part="cytoplasm">
        <rect x={109} y={79} width={334} height={102} rx={51} fill="var(--bio-cell)" />
      </g>
      <g data-part="membrane">
        <rect x={109} y={79} width={334} height={102} rx={51} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.6} />
      </g>
      <g data-part="ribosome">
        <Ribosomes at={RIBOSOMES} r={2.3} />
      </g>
      <g data-part="nucleoid">
        <ellipse cx={272} cy={130} rx={82} ry={32} fill="var(--bio-nucleus)" opacity={0.45} />
        <path d={NUCLEOID} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      <g data-part="plasmid">
        {[
          [150, 112, 9],
          [396, 150, 9],
          [176, 154, 7],
        ].map(([cx, cy, r], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} />
            <circle cx={cx} cy={cy} r={r - 2.6} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={0.9} opacity={0.6} />
          </g>
        ))}
      </g>
    </Figure>
  );
}
