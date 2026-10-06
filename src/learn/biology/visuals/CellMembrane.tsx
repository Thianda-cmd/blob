"use client";

// A biomembrane in the fluid mosaic model (Singer and Nicolson): a phospholipid bilayer with
// a channel protein, a carrier, a glycoprotein, a peripheral protein, cholesterol and the sugar
// chains of the glycocalyx on the outside.

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cos, sin } from "@/lib/stableMath";

export const MEMBRANE_PARTS: FigurePart[] = [
  { id: "heads", label: tx("hydrophilic head", "hydrophiler Kopf"), at: [175, 110], tag: [175, 30], info: tx("The polar phosphate head likes water: the heads face the water on both sides.", "Der polare Kopf mit der Phosphatgruppe ist wasserliebend: Die Köpfe zeigen auf beiden Seiten zum Wasser.") },
  { id: "tails", label: tx("hydrophobic tails (fatty acids)", "hydrophobe Schwänze (Fettsäurereste)"), at: [526, 140], tag: [578, 152], info: tx("Two fatty acid tails, nonpolar: they avoid water and point into the middle of the membrane.", "Zwei unpolare Fettsäurereste meiden Wasser und zeigen ins Innere der Membran.") },
  { id: "channel", label: tx("channel protein", "Kanalprotein"), at: [124, 172], info: tx("A water-filled pore: lets certain ions (or water, aquaporins) through, always down the gradient.", "Eine wassergefüllte Pore: lässt bestimmte Ionen (oder Wasser, Aquaporine) durch, immer dem Gefälle nach.") },
  { id: "carrier", label: tx("carrier protein", "Carrier (Transportprotein)"), at: [252, 182], info: tx("Binds a particular substance (e.g. glucose), changes its shape and releases it on the other side.", "Bindet einen bestimmten Stoff (z. B. Glucose), ändert seine Form und gibt ihn auf der anderen Seite ab.") },
  { id: "glyco", label: tx("glycoprotein", "Glykoprotein"), at: [392, 170], info: tx("Integral protein with a sugar chain: a recognition tag of the cell (e.g. blood groups).", "Integrales Protein mit Zuckerkette: Erkennungsmerkmal der Zelle (z. B. Blutgruppen).") },
  { id: "sugar", label: tx("sugar chains (glycocalyx)", "Zuckerketten (Glykokalyx)"), at: [404, 54], tag: [460, 30], info: tx("Carbohydrate chains on the outside only: cell recognition and contact.", "Kohlenhydratketten nur auf der Außenseite: Zellerkennung und Zellkontakt.") },
  { id: "peripheral", label: tx("peripheral protein", "peripheres Protein"), at: [476, 228], info: tx("Only sits on the surface of the membrane, often on the inside (e.g. linked to the cytoskeleton).", "Sitzt nur außen an der Membran an, oft auf der Innenseite (z. B. Verbindung zum Cytoskelett).") },
  { id: "cholesterol", label: tx("cholesterol", "Cholesterin"), at: [332, 136], tag: [306, 30], info: tx("Sits between the lipids in animal membranes and keeps the fluidity just right.", "Sitzt in tierischen Membranen zwischen den Lipiden und hält die Fluidität im richtigen Bereich.") },
];

const TOP = 110; // heads of the outer layer
const BOT = 200; // heads of the inner layer
const GAPS: [number, number][] = [
  [92, 156],
  [218, 288],
  [364, 420],
];
const LIPIDS = (() => {
  const xs: number[] = [];
  for (let x = 22; x <= 580; x += 17) if (!GAPS.some(([a, b]) => x > a && x < b)) xs.push(x);
  return xs;
})();
const CHOL_TOP = [332, 552];
const CHOL_BOT = [196, 452];

function tail(x: number, y0: number, dir: 1 | -1, kink: boolean) {
  const y1 = y0 + dir * 16;
  const y2 = y0 + dir * 34;
  return kink ? `M ${x} ${y0} L ${x} ${y1} L ${x + 4} ${y1 + dir * 6} L ${x + 4} ${y2}` : `M ${x} ${y0} L ${x} ${y2}`;
}

function Lipid({ x, y, dir, i }: { x: number; y: number; dir: 1 | -1; i: number }) {
  return (
    <>
      <path d={tail(x - 3, y + dir * 6, dir, false)} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.7} strokeLinecap="round" />
      <path d={tail(x + 3, y + dir * 6, dir, i % 3 === 1)} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function SugarChain({ x, y, len }: { x: number; y: number; len: number }) {
  const beads: [number, number][] = [];
  for (let i = 0; i < len; i++) beads.push([x + (i % 2 ? 4 : -2), y - i * 11]);
  const branch: [number, number][] = [
    [beads[len - 2][0] + 11, beads[len - 2][1] - 6],
    [beads[len - 2][0] + 20, beads[len - 2][1] - 13],
  ];
  return (
    <g>
      <path d={`M ${x} ${y + 6} ${beads.map(([bx, by]) => `L ${bx} ${by}`).join(" ")} M ${beads[len - 2][0]} ${beads[len - 2][1]} ${branch.map(([bx, by]) => `L ${bx} ${by}`).join(" ")}`} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.3} />
      {[...beads, ...branch].map(([bx, by], i) => (
        <polygon key={i} points={hexagon(bx, by, 4.6)} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
      ))}
    </g>
  );
}

const hexagon = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${(cx + r * cos(a)).toFixed(1)},${(cy + r * sin(a)).toFixed(1)}`;
  }).join(" ");

export function CellMembrane({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const t = useText();
  return (
    <Figure title={tx("Biomembrane (fluid mosaic model)", "Biomembran (Flüssig-Mosaik-Modell)")} width={600} height={290} parts={MEMBRANE_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <rect x={0} y={0} width={600} height={98} fill="var(--bio-water)" opacity={0.1} />
      <rect x={0} y={212} width={600} height={78} fill="var(--bio-cell)" opacity={0.7} />
      <text x={10} y={84} fontSize={13} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("outside", "außen"))}
      </text>
      <text x={10} y={282} fontSize={13} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("inside (cytoplasm)", "innen (Cytoplasma)"))}
      </text>
      <g data-part="tails">
        {LIPIDS.map((x, i) => (
          <g key={i}>
            <Lipid x={x} y={TOP} dir={1} i={i} />
            <Lipid x={x} y={BOT} dir={-1} i={i + 1} />
          </g>
        ))}
      </g>
      <g data-part="cholesterol">
        {CHOL_TOP.map((x) => (
          <g key={x} transform={`translate(${x + 8.5} ${TOP + 10})`}>
            <rect x={-3.5} y={0} width={7} height={22} rx={3} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
            <circle cx={0} cy={-1} r={3} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
          </g>
        ))}
        {CHOL_BOT.map((x) => (
          <g key={x} transform={`translate(${x + 8.5} ${BOT - 10}) scale(1 -1)`}>
            <rect x={-3.5} y={0} width={7} height={22} rx={3} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
            <circle cx={0} cy={-1} r={3} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
          </g>
        ))}
      </g>
      <g data-part="heads">
        {LIPIDS.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={TOP} r={7} fill="var(--bio-membrane)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
            <circle cx={x} cy={BOT} r={7} fill="var(--bio-membrane)" stroke="var(--bio-nerve-deep)" strokeWidth={1.1} />
          </g>
        ))}
      </g>
      <g data-part="channel">
        <rect x={98} y={90} width={22} height={130} rx={10} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.8} />
        <rect x={130} y={90} width={22} height={130} rx={10} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.8} />
        <circle cx={125} cy={128} r={4.5} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1} />
      </g>
      <g data-part="carrier">
        <path
          d="M 226 104 C 222 92, 236 86, 242 96 L 246 108 L 258 108 L 262 96 C 268 86, 284 92, 280 104 C 288 140, 290 180, 282 214 C 274 226, 232 226, 224 214 C 216 180, 218 140, 226 104 Z"
          fill="var(--bio-petal)"
          stroke="var(--bio-petal-deep)"
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        <polygon points={hexagon(252, 80, 7)} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.2} />
      </g>
      <g data-part="glyco">
        <path d="M 372 104 C 366 90, 412 84, 414 100 C 422 140, 420 186, 412 216 C 404 228, 376 228, 370 216 C 362 180, 362 140, 372 104 Z" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      <g data-part="sugar">
        <SugarChain x={394} y={88} len={4} />
        <SugarChain x={532} y={98} len={3} />
      </g>
      <g data-part="peripheral">
        <ellipse cx={476} cy={224} rx={26} ry={13} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.8} />
      </g>
    </Figure>
  );
}
