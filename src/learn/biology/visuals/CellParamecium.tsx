"use client";

// The slipper animalcule (Paramecium), a single-celled organism that does everything in one
// cell: cilia for swimming, an oral groove, food vacuoles, contractile vacuoles and two nuclei.

import { motion, useReducedMotion } from "motion/react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const CX = 262;
const CY = 140;
const A = 204;
const B = 70;

/** A point of the outline: an oval, narrower at the back, with the oral groove dented into the lower side. */
function outline(t: number): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const x = CX + A * c;
  let y = CY + B * s * (c > 0 ? 1 - 0.3 * c * c : 1 - 0.06 * c * c);
  if (s > 0) y -= 17 * Math.exp(-(((x - 196) / 62) ** 2)) * s;
  return [x, y];
}

const N = 180;
const PTS = Array.from({ length: N }, (_, i) => outline((i / N) * 2 * Math.PI));
const BODY = `M ${PTS.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`;
const CILIA = PTS.filter((_, i) => i % 3 === 0).map(([x, y], k) => {
  const i = k * 3;
  const [ax, ay] = PTS[(i + N - 1) % N];
  const [bx, by] = PTS[(i + 1) % N];
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.hypot(dx, dy);
  // outward normal, tilted a little backwards like beating cilia
  const nx = dy / l - (dx / l) * 0.35;
  const ny = -dx / l - (dy / l) * 0.35;
  return [x, y, x + nx * 10, y + ny * 10] as const;
});
const lowerY = (x: number) => {
  // y of the lower outline at a given x (search the sampled points)
  let best = PTS[0];
  for (const p of PTS) if (p[1] > CY && Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
  return best[1];
};

const MOUTH_X = 246;
const MOUTH_Y = lowerY(MOUTH_X);
const ANUS_X = 396;
const ANUS_Y = lowerY(ANUS_X);

export const PARAMECIUM_PARTS: FigurePart[] = [
  { id: "cilia", label: tx("cilia", "Wimpern"), at: [262, 62], tag: [262, 22], info: tx("Thousands of tiny hairs beat like oars: the cell swims and sweeps food into its mouth.", "Tausende winzige Härchen schlagen wie Ruder: Die Zelle schwimmt und strudelt Nahrung zum Mund.") },
  { id: "membrane", label: tx("cell membrane", "Zellmembran"), at: [360, 80], tag: [420, 34], info: tx("Boundary of the cell, strengthened by a firm outer layer (pellicle).", "Grenze der Zelle, verstärkt durch eine feste Außenschicht (Pellicula).") },
  { id: "cytoplasm", label: tx("cytoplasm", "Zellplasma"), at: [292, 178] , info: tx("The filling where the organelles float.", "Die Füllung, in der die Organellen liegen.") },
  { id: "mouth", label: tx("oral groove with cell mouth", "Mundfeld mit Zellmund"), at: [MOUTH_X, MOUTH_Y - 6], tag: [212, 250], info: tx("Food (e.g. bacteria) is swept along the groove into the cell mouth.", "Nahrung (z. B. Bakterien) wird durch das Mundfeld in den Zellmund gestrudelt.") },
  { id: "food", label: tx("food vacuole", "Nahrungsvakuole"), at: [338, 166], tag: [338, 250], info: tx("A bubble around swallowed food: here it is digested.", "Ein Bläschen um die aufgenommene Nahrung: Hier wird sie verdaut.") },
  { id: "contractile", label: tx("contractile vacuole", "pulsierende Vakuole"), at: [392, 120], tag: [480, 60], info: tx("Collects the water that keeps flowing in and pumps it out, so the cell doesn't burst.", "Sammelt das ständig einströmende Wasser und pumpt es hinaus, damit die Zelle nicht platzt.") },
  { id: "macro", label: tx("macronucleus", "Großkern"), at: [272, 134], info: tx("Controls the everyday life of the cell (metabolism).", "Steuert das tägliche Leben der Zelle (Stoffwechsel).") },
  { id: "micro", label: tx("micronucleus", "Kleinkern"), at: [324, 110], tag: [370, 34], info: tx("Important for reproduction: passes on the genetic information.", "Wichtig für die Fortpflanzung: gibt die Erbinformation weiter.") },
  { id: "anus", label: tx("anal pore", "Zellafter"), at: [ANUS_X, ANUS_Y - 3], tag: [440, 240], info: tx("Undigested remains are released here.", "Hier werden unverdauliche Reste abgegeben.") },
];

function Contractile({ x, y, pulse }: { x: number; y: number; pulse: boolean }) {
  const canals = Array.from({ length: 7 }, (_, i) => (i / 7) * 360);
  return (
    <g transform={`translate(${x} ${y})`}>
      {canals.map((a) => (
        <ellipse key={a} cx={0} cy={-15} rx={2.6} ry={8} transform={`rotate(${a})`} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1} />
      ))}
      <motion.circle
        r={9}
        fill="var(--bio-vacuole)"
        stroke="var(--bio-water-deep)"
        strokeWidth={1.5}
        animate={pulse ? { scale: [1, 1.15, 0.55, 1] } : undefined}
        transition={pulse ? { duration: 2.8, repeat: Infinity, times: [0, 0.6, 0.72, 1], ease: "easeInOut" } : undefined}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </g>
  );
}

function FoodVacuole({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
      <circle cx={x - r * 0.3} cy={y - r * 0.2} r={r * 0.2} fill="var(--bio-soil)" />
      <circle cx={x + r * 0.3} cy={y + r * 0.1} r={r * 0.18} fill="var(--bio-soil)" />
      <circle cx={x - r * 0.05} cy={y + r * 0.4} r={r * 0.16} fill="var(--bio-soil)" />
    </g>
  );
}

export function CellParamecium({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const reduce = useReducedMotion();
  return (
    <Figure title={tx("Slipper animalcule (Paramecium), a single-celled organism", "Pantoffeltierchen, ein Einzeller")} width={540} height={270} parts={PARAMECIUM_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="cilia">
        {CILIA.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bio-outline)" strokeWidth={1.2} strokeLinecap="round" opacity={0.75} />
        ))}
      </g>
      <g data-part="cytoplasm">
        <path d={BODY} fill="var(--bio-cell)" />
      </g>
      <g data-part="membrane">
        <path d={BODY} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      <g data-part="mouth">
        <path d={`M 128 ${lowerY(128) - 4} Q 190 ${lowerY(190) - 14} ${MOUTH_X - 6} ${MOUTH_Y - 8}`} fill="none" stroke="var(--bio-membrane)" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
        <path d={`M ${MOUTH_X - 12} ${MOUTH_Y - 1} Q ${MOUTH_X - 2} ${MOUTH_Y - 8} ${MOUTH_X + 4} ${MOUTH_Y - 24} M ${MOUTH_X + 12} ${MOUTH_Y - 1} Q ${MOUTH_X + 8} ${MOUTH_Y - 10} ${MOUTH_X + 13} ${MOUTH_Y - 24}`} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.8} strokeLinecap="round" />
      </g>
      <g data-part="food">
        <FoodVacuole x={MOUTH_X + 9} y={MOUTH_Y - 32} r={6.5} />
        <FoodVacuole x={200} y={118} r={9} />
        <FoodVacuole x={170} y={152} r={8} />
        <FoodVacuole x={338} y={166} r={10} />
        <FoodVacuole x={364} y={146} r={7.5} />
      </g>
      <g data-part="macro">
        <path d="M 230 128 C 232 108, 270 104, 300 110 C 322 115, 324 140, 312 152 C 300 162, 282 150, 262 154 C 240 158, 228 146, 230 128 Z" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
      </g>
      <g data-part="micro">
        <circle cx={324} cy={110} r={7.5} fill="var(--bio-nucleus-deep)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.5} />
      </g>
      <g data-part="contractile">
        <Contractile x={132} y={118} pulse={!reduce} />
        <Contractile x={392} y={120} pulse={!reduce} />
      </g>
      <g data-part="anus">
        <circle cx={ANUS_X} cy={ANUS_Y + 3} r={4} fill="var(--bio-soil)" stroke="var(--bio-flesh-deep)" strokeWidth={1} />
        <circle cx={ANUS_X + 7} cy={ANUS_Y + 9} r={2.6} fill="var(--bio-soil)" />
      </g>
    </Figure>
  );
}
