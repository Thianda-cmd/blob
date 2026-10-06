"use client";

// A tissue atlas (Pflanzengewebe): six small pictures of meristem, parenchyma, collenchyma,
// sclerenchyma, epidermis and vascular tissue. `only` shows a single tissue (for tasks).

import { useId, type ReactNode } from "react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export type TissueId = "meristem" | "parenchyma" | "collenchyma" | "sclerenchyma" | "epidermis" | "vascular";

const TILE_W = 200;
const TILE_H = 180;
const POS: Record<TissueId, [number, number]> = {
  meristem: [0, 0],
  parenchyma: [TILE_W, 0],
  collenchyma: [2 * TILE_W, 0],
  sclerenchyma: [0, TILE_H],
  epidermis: [TILE_W, TILE_H],
  vascular: [2 * TILE_W, TILE_H],
};

export const TISSUE_PARTS: FigurePart[] = [
  {
    id: "meristem",
    label: tx("meristem (dividing tissue)", "Bildungsgewebe (Meristem)"),
    at: [18, 18],
    info: tx("Small, thin-walled cells full of cytoplasm with a large nucleus and no big vacuole. They keep dividing: at shoot and root tips and in the cambium.", "Kleine, dünnwandige, plasmareiche Zellen mit großem Kern und ohne große Vakuole. Sie teilen sich ständig: an Spross- und Wurzelspitze und im Kambium."),
  },
  {
    id: "parenchyma",
    label: tx("parenchyma (ground tissue)", "Grundgewebe (Parenchym)"),
    at: [TILE_W + 18, 18],
    info: tx("Living, thin-walled cells with a large vacuole and air spaces between them. Photosynthesis (palisade and spongy tissue), storage (potato), pith.", "Lebende, dünnwandige Zellen mit großer Vakuole und Zellzwischenräumen. Fotosynthese (Palisaden- und Schwammgewebe), Speicherung (Kartoffel), Mark."),
  },
  {
    id: "collenchyma",
    label: tx("collenchyma (supporting tissue)", "Kollenchym (Festigungsgewebe)"),
    at: [2 * TILE_W + 18, 18],
    info: tx("Living cells whose walls are thickened at the corners (cellulose). Firm but stretchy: supports growing organs such as leaf stalks.", "Lebende Zellen, deren Wände an den Kanten verdickt sind (Cellulose). Fest und dehnbar: festigt wachsende Organe wie Blattstiele."),
  },
  {
    id: "sclerenchyma",
    label: tx("sclerenchyma (supporting tissue)", "Sklerenchym (Festigungsgewebe)"),
    at: [18, TILE_H + 18],
    info: tx("Mostly dead cells with very thick, lignified walls. Very hard, not stretchy: fibres (flax) and stone cells (pear, nutshell).", "Meist tote Zellen mit sehr dicken, verholzten Wänden (Lignin). Sehr fest, nicht dehnbar: Fasern (Flachs) und Steinzellen (Birne, Nussschale)."),
  },
  {
    id: "epidermis",
    label: tx("dermal tissue (epidermis)", "Abschlussgewebe (Epidermis)"),
    at: [TILE_W + 18, TILE_H + 18],
    info: tx("One gapless layer with a cuticle, stomata and hairs. Protects against drying out and germs.", "Einschichtig und lückenlos, mit Cuticula, Spaltöffnungen und Haaren. Schützt vor Austrocknung und Krankheitserregern."),
  },
  {
    id: "vascular",
    label: tx("vascular tissue (xylem and phloem)", "Leitgewebe (Xylem und Phloem)"),
    at: [2 * TILE_W + 18, TILE_H + 18],
    info: tx("Xylem: dead vessels for water and minerals. Phloem: living sieve tubes with companion cells for sugar solution.", "Xylem: tote Gefäße für Wasser und Mineralstoffe. Phloem: lebende Siebröhren mit Geleitzellen für Zuckerlösung."),
  },
];

const WALL = "var(--bio-wall-deep)";
const CELL = "var(--bio-cell)";
const NUC = "var(--bio-nucleus)";
const NUC_D = "var(--bio-nucleus-deep)";

/** Centres of a hexagonal grid (pointy top) filling a tile. */
function hexCentres(r: number) {
  const out: [number, number][] = [];
  const dx = Math.sqrt(3) * r;
  const dy = 1.5 * r;
  for (let row = -1; row * dy < TILE_H + r; row++) {
    for (let col = -1; col * dx < TILE_W + r; col++) out.push([col * dx + (row % 2 ? dx / 2 : 0), row * dy]);
  }
  return out;
}

/** A hexagon with rounded corners (corner radius c). */
function roundHex(x: number, y: number, r: number, c: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const f = c / r;
  let d = "";
  pts.forEach((p, i) => {
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];
    const a = lerp(p, prev, f);
    const b = lerp(p, next, f);
    d += `${i === 0 ? "M" : "L"}${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
  });
  return `${d}Z`;
}

function Meristem() {
  const s = 29;
  return (
    <g>
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => {
          const x = 2 + c * s + (r % 2 ? 6 : 0);
          const y = 4 + r * s;
          const dividing = r === 2 && c === 3;
          return (
            <g key={`${r}-${c}`}>
              <rect x={x} y={y} width={s} height={s} fill={CELL} stroke={WALL} strokeWidth={1.1} />
              {dividing ? (
                <g stroke={NUC_D} strokeWidth={2.2} strokeLinecap="round">
                  {[-6, -2, 2, 6].map((dy) => (
                    <line key={dy} x1={x + s / 2 - 4} y1={y + s / 2 + dy} x2={x + s / 2 + 4} y2={y + s / 2 + dy} />
                  ))}
                </g>
              ) : (
                <g>
                  <circle cx={x + s / 2 + ((r + c) % 3) - 1} cy={y + s / 2} r={8.5} fill={NUC} stroke={NUC_D} strokeWidth={1} />
                  <circle cx={x + s / 2 + ((r + c) % 3)} cy={y + s / 2 - 1} r={2} fill={NUC_D} />
                </g>
              )}
            </g>
          );
        }),
      )}
    </g>
  );
}

function Parenchyma() {
  return (
    <g>
      {hexCentres(30).map(([x, y], i) => (
        <g key={i}>
          <path d={roundHex(x, y, 27.5, 7)} fill={CELL} stroke={WALL} strokeWidth={1.3} />
          <path d={roundHex(x, y, 19, 7)} fill="var(--bio-vacuole)" />
          <circle cx={x + 13 * Math.cos(i * 1.7)} cy={y + 13 * Math.sin(i * 1.7)} r={4.2} fill={NUC} stroke={NUC_D} strokeWidth={0.9} />
          <ellipse cx={x - 14 * Math.cos(i * 1.7)} cy={y - 14 * Math.sin(i * 1.7)} rx={3} ry={2} fill="var(--bio-chloro)" />
        </g>
      ))}
    </g>
  );
}

function Collenchyma() {
  return (
    <g>
      <rect x={0} y={0} width={TILE_W} height={TILE_H} fill="var(--bio-wall)" opacity={0.75} />
      {hexCentres(27).map(([x, y], i) => (
        <g key={i}>
          <path d={roundHex(x, y, 27, 0.1)} fill="none" stroke={WALL} strokeWidth={0.8} />
          <path d={roundHex(x, y, 24.5, 11)} fill={CELL} stroke={WALL} strokeWidth={0.9} />
          <circle cx={x + 6} cy={y - 4} r={4.5} fill={NUC} stroke={NUC_D} strokeWidth={0.9} />
          <ellipse cx={x - 5} cy={y + 6} rx={7} ry={5} fill="var(--bio-vacuole)" />
        </g>
      ))}
    </g>
  );
}

function Sclerenchyma() {
  return (
    <g>
      <rect x={0} y={0} width={TILE_W} height={TILE_H} fill="var(--bio-wood)" opacity={0.55} />
      {hexCentres(24).map(([x, y], i) => (
        <g key={i}>
          <path d={roundHex(x, y, 24, 0.1)} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
          <path d={roundHex(x, y, 17, 5)} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.7} opacity={0.5} />
          <path d={roundHex(x, y, 11, 4)} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.7} opacity={0.5} />
          <g stroke="var(--bio-wood-deep)" strokeWidth={1}>
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const a = ((60 * k + 15 * (i % 3)) * Math.PI) / 180;
              return <line key={k} x1={x + Math.cos(a) * 4} y1={y + Math.sin(a) * 4} x2={x + Math.cos(a) * 18} y2={y + Math.sin(a) * 18} />;
            })}
          </g>
          <circle cx={x} cy={y} r={4.2} fill="var(--raised)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
        </g>
      ))}
    </g>
  );
}

function Epidermis() {
  const cells = [0, 40, 78, 112, 152];
  return (
    <g>
      {/* ground tissue below, faded */}
      <g opacity={0.45}>
        {[14, 52, 90, 128, 166].map((x, i) => (
          <ellipse key={i} cx={x + (i % 2) * 6} cy={110} rx={19} ry={16} fill={CELL} stroke={WALL} strokeWidth={1} />
        ))}
        {[30, 70, 110, 150, 190].map((x, i) => (
          <ellipse key={i} cx={x} cy={148} rx={19} ry={16} fill={CELL} stroke={WALL} strokeWidth={1} />
        ))}
      </g>
      <rect x={0} y={60} width={TILE_W} height={8} fill="var(--bio-membrane)" opacity={0.75} />
      {cells.map((x, i) => (
        <g key={i}>
          <rect x={x + 0.8} y={68} width={(cells[i + 1] ?? TILE_W) - x - 1.6} height={26} rx={4} fill={CELL} stroke={WALL} strokeWidth={1.4} />
          <ellipse cx={x + 14} cy={84} rx={4} ry={3} fill={NUC} stroke={NUC_D} strokeWidth={0.8} />
        </g>
      ))}
      {/* a hair made of three cells */}
      <g fill={CELL} stroke={WALL} strokeWidth={1.3}>
        <path d="M86 68 L86 46 Q94 42 102 46 L102 68 Z" />
        <path d="M87 46 L89 28 Q94 25 99 28 L101 46 Z" />
        <path d="M89 28 Q94 6 99 28 Z" />
      </g>
      <path d="M85 68 L85 46 Q94 40 103 46 L103 68" fill="none" stroke="var(--bio-membrane)" strokeWidth={1.4} opacity={0.8} />
    </g>
  );
}

function Vascular() {
  return (
    <g>
      <rect x={34} y={0} width={36} height={TILE_H} fill="var(--bio-vacuole)" />
      <path d={`M34 0 L34 ${TILE_H} M70 0 L70 ${TILE_H}`} stroke="var(--bio-wood-deep)" strokeWidth={2.2} />
      <g stroke="var(--bio-wood-deep)" strokeWidth={2.2} fill="none" strokeLinecap="round">
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M34 ${4 + i * 11.5} Q52 ${-2 + i * 11.5} 70 ${10 + i * 11.5}`} />
        ))}
      </g>
      <rect x={104} y={0} width={34} height={TILE_H} fill="var(--bio-mito)" fillOpacity={0.35} stroke="var(--bio-mito-deep)" strokeWidth={1.5} />
      <path d="M104 92 L138 92" stroke="var(--bio-mito-deep)" strokeWidth={4} strokeDasharray="3.5 2.5" />
      {[6, 98].map((y) => (
        <g key={y}>
          <rect x={138} y={y} width={16} height={78} rx={6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
          <ellipse cx={146} cy={y + 38} rx={4} ry={6} fill={NUC} stroke={NUC_D} strokeWidth={0.9} />
        </g>
      ))}
    </g>
  );
}

const DRAW: Record<TissueId, () => ReactNode> = {
  meristem: Meristem,
  parenchyma: Parenchyma,
  collenchyma: Collenchyma,
  sclerenchyma: Sclerenchyma,
  epidermis: Epidermis,
  vascular: Vascular,
};

const IDS = Object.keys(POS) as TissueId[];

/** The six plant tissues; `only` shows one of them on its own. */
export function PlantTissues({ mode = "names", show, ask, highlight, legend, only }: DrawingProps & { only?: TissueId }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = only ? [only] : IDS;
  const w = only ? TILE_W : 3 * TILE_W;
  const h = only ? TILE_H : 2 * TILE_H;
  const parts = only ? TISSUE_PARTS.filter((p) => p.id === only).map((p) => ({ ...p, at: [18, 18] as [number, number] })) : TISSUE_PARTS;
  return (
    <Figure title={only ? tx("A plant tissue under the microscope", "Ein Pflanzengewebe unter dem Mikroskop") : tx("Plant tissues", "Pflanzengewebe")} width={w} height={h} parts={parts} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {ids.map((id) => {
        const [x, y] = only ? [0, 0] : POS[id];
        const D = DRAW[id];
        return (
          <g key={id} data-part={id} transform={`translate(${x} ${y})`}>
            <defs>
              <clipPath id={`tis-${uid}-${id}`}>
                <rect x={4} y={4} width={TILE_W - 8} height={TILE_H - 8} rx={14} />
              </clipPath>
            </defs>
            <rect x={4} y={4} width={TILE_W - 8} height={TILE_H - 8} rx={14} fill="var(--raised)" />
            <g clipPath={`url(#tis-${uid}-${id})`}>
              <D />
            </g>
            <rect x={4} y={4} width={TILE_W - 8} height={TILE_H - 8} rx={14} fill="none" stroke="var(--line-2)" strokeWidth={1.6} />
          </g>
        );
      })}
    </Figure>
  );
}
