"use client";

import { cos, sin } from "@/lib/stableMath";
import type { Spot } from "../../types";
import { r1, scatter, Shine, useIds } from "../kit";

/** An animal cell and a plant cell with their organelles, electron-microscope style. */

export const W = 900;
export const H = 600;

/* Shared organelle drawings ----------------------------------------------------------------- */

function Mito({ x, y, rot = 0, l = 34, w = 15 }: { x: number; y: number; rot?: number; l?: number; w?: number }) {
  const folds = [-l + 12, -l + 22, -l + 32, -l + 42, -l + 52].filter((f) => f < l - 8);
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x={-l} y={-w} width={2 * l} height={2 * w} rx={w} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.8} />
      <rect x={-l + 3.5} y={-w + 3.5} width={2 * l - 7} height={2 * w - 7} rx={w - 3.5} fill="color-mix(in oklab, var(--bio-mito) 75%, white)" stroke="var(--bio-mito-deep)" strokeWidth={1.1} />
      {folds.map((f, i) => (
        <path key={f} d={i % 2 ? `M ${f} ${w - 3.5} V ${-w * 0.25}` : `M ${f} ${-w + 3.5} V ${w * 0.25}`} stroke="var(--bio-mito-deep)" strokeWidth={2.2} strokeLinecap="round" />
      ))}
    </g>
  );
}

function Golgi({ x, y, rot = 0, s = 1 }: { x: number; y: number; rot?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {[0, 1, 2, 3, 4].map((k) => {
        const w = 58 - k * 6;
        const yy = -22 + k * 11;
        return <path key={k} d={`M ${-w} ${yy} Q 0 ${yy - 16} ${w} ${yy} q 4 4 0 7 Q 0 ${yy - 9} ${-w} ${yy + 7} q -4 -3 0 -7 Z`} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />;
      })}
      {[
        [-66, -10, 5],
        [66, -8, 5.5],
        [70, 14, 4.5],
        [-62, 18, 4],
      ].map(([vx, vy, r], i) => (
        <circle key={i} cx={vx} cy={vy} r={r} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.1} />
      ))}
    </g>
  );
}

function Lysosome({ x, y, r = 15 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="color-mix(in oklab, var(--bio-blood) 35%, var(--bio-cell))" stroke="var(--bio-blood)" strokeWidth={1.6} />
      {[
        [-5, -4],
        [4, -6],
        [5, 4],
        [-4, 5],
        [0, 0],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={x + (dx * r) / 15} cy={y + (dy * r) / 15} r={1.8} fill="var(--bio-blood)" />
      ))}
    </g>
  );
}

function Peroxisome({ x, y, r = 13 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="color-mix(in oklab, var(--bio-leaf) 35%, var(--bio-cell))" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
      <rect x={x - r * 0.38} y={y - r * 0.38} width={r * 0.76} height={r * 0.76} rx={1.5} fill="var(--bio-leaf-deep)" opacity={0.8} transform={`rotate(45 ${x} ${y})`} />
    </g>
  );
}

function Ribos({ at }: { at: [number, number][] }) {
  return (
    <g>
      {at.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill="var(--bio-ribo)" opacity={0.85} />
      ))}
    </g>
  );
}

/** The nucleus: nucleoplasm and chromatin (part "nucleus"). Envelope and nucleolus are drawn apart. */
function Nucleoplasm({ x, y, r, id }: { x: number; y: number; r: number; id: string }) {
  const chroma = Array.from({ length: 9 }, (_, k) => {
    const a = (k / 9) * 2 * Math.PI + 0.3;
    const rr = r * (0.42 + (k % 3) * 0.14);
    const cx = x + rr * cos(a);
    const cy = y + rr * sin(a);
    return `M ${r1(cx - 9)} ${r1(cy)} q 5 -7 10 0 t 10 0`;
  });
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={`url(#${id})`} />
      <path d={chroma.join(" ")} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}

function Envelope({ x, y, r }: { x: number; y: number; r: number }) {
  const pores = 14;
  const c = 2 * Math.PI * r;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={6} strokeDasharray={`${r1(c / pores - 6)} 6`} />
      <circle cx={x} cy={y} r={r} fill="none" stroke="var(--bio-nucleus)" strokeWidth={2} strokeDasharray={`${r1(c / pores - 6)} 6`} />
    </g>
  );
}

/** Rough ER: curved sheets around the nucleus, ribosomes on the outside. */
function RoughER({ x, y, radii, from, to }: { x: number; y: number; radii: number[]; from: number; to: number }) {
  const arc = (r: number) => {
    const a0 = (from * Math.PI) / 180;
    const a1 = (to * Math.PI) / 180;
    return `M ${r1(x + r * cos(a0))} ${r1(y + r * sin(a0))} A ${r} ${r} 0 0 1 ${r1(x + r * cos(a1))} ${r1(y + r * sin(a1))}`;
  };
  const dots: [number, number][] = [];
  radii.forEach((r) => {
    for (let a = from + 3; a < to; a += 5.5) {
      const t = (a * Math.PI) / 180;
      dots.push([r1(x + (r + 6) * cos(t)), r1(y + (r + 6) * sin(t))]);
    }
  });
  return (
    <g>
      {radii.map((r) => (
        <g key={r}>
          <path d={arc(r)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={8} strokeLinecap="round" opacity={0.5} />
          <path d={arc(r)} fill="none" stroke="color-mix(in oklab, var(--bio-nucleus) 60%, white)" strokeWidth={4.5} strokeLinecap="round" />
        </g>
      ))}
      <Ribos at={dots} />
    </g>
  );
}

function SmoothER({ d }: { d: string[] }) {
  return (
    <g>
      {d.map((p, i) => (
        <g key={i}>
          <path d={p} fill="none" stroke="var(--bio-water-deep)" strokeWidth={8} strokeLinecap="round" opacity={0.55} />
          <path d={p} fill="none" stroke="color-mix(in oklab, var(--bio-water) 50%, white)" strokeWidth={4.5} strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

/* Animal cell -------------------------------------------------------------------------------- */

const OUTLINE = "M 178 300 C 166 180, 262 70, 420 58 C 566 48, 704 108, 728 232 C 752 352, 700 470, 582 524 C 470 572, 300 560, 228 486 C 186 442, 184 380, 178 300 Z";
const N = { x: 420, y: 296, r: 88 };
const CENTRO = { x: 572, y: 196 };
const FREE_RIBO = scatter(
  41,
  60,
  [190, 70, 720, 540],
  (x, y) => {
    const dx = (x - 452) / 262;
    const dy = (y - 304) / 232;
    return dx * dx + dy * dy < 1;
  },
  15,
  (x, y) => Math.hypot(x - N.x, y - N.y) < N.r + 64,
);

export const ANIMAL_SPOTS = {
  membrane: { at: [184, 226], label: [150, 120], side: "l" },
  cytoplasm: { at: [612, 446], label: [748, 470], side: "r" },
  nucleus: { at: [388, 320], label: [150, 330], side: "l" },
  envelope: { at: [N.x - N.r * 0.71, N.y - N.r * 0.71], label: [150, 190], side: "l" },
  nucleolus: { at: [438, 282], label: [150, 260], side: "l" },
  roughER: { at: [N.x + 112, N.y - 40], label: [748, 250], side: "r" },
  smoothER: { at: [600, 400], label: [748, 400], side: "r" },
  golgi: { at: [280, 438], label: [150, 440], side: "l" },
  vesicle: { at: [352, 502], label: [150, 510], side: "l" },
  mito: { at: [300, 154], label: [150, 60], side: "l" },
  lysosome: { at: [592, 136], label: [748, 110], side: "r" },
  peroxisome: { at: [650, 266], label: [748, 320], side: "r" },
  ribosomes: { at: FREE_RIBO[0] ?? [520, 520], label: [748, 540], side: "r" },
  cytoskeleton: { at: [512, 96], label: [748, 40], side: "r" },
  centrosome: { at: [CENTRO.x, CENTRO.y], label: [748, 180], side: "r" },
} satisfies Record<string, Spot>;

export function AnimalCell() {
  const id = useIds("cyto", "nuc", "shine", "clip");
  return (
    <g>
      <defs>
        <clipPath id={id.clip}>
          <path d={OUTLINE} />
        </clipPath>
        <radialGradient id={id.cyto} cx="45%" cy="40%" r="65%">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 85%, var(--bio-membrane))" />
        </radialGradient>
        <radialGradient id={id.nuc} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-nucleus) 60%, white)" />
          <stop offset="1" stopColor="var(--bio-nucleus)" />
        </radialGradient>
        <Shine id={id.shine} cx="30%" cy="20%" />
      </defs>
      <g data-part="cytoplasm">
        <path d={OUTLINE} fill={`url(#${id.cyto})`} />
        <path d={OUTLINE} fill={`url(#${id.shine})`} />
      </g>
      <g data-part="cytoskeleton" clipPath={`url(#${id.clip})`}>
        {[-160, -120, -80, -40, 0, 40, 80, 120, 160, 200].map((a) => {
          const t = (a * Math.PI) / 180;
          return <line key={a} x1={CENTRO.x} y1={CENTRO.y} x2={r1(CENTRO.x + 210 * cos(t))} y2={r1(CENTRO.y + 210 * sin(t))} stroke="var(--bio-outline)" strokeWidth={1.4} opacity={0.22} strokeLinecap="round" />;
        })}
        <path d="M 230 250 C 300 200, 340 140, 470 112 M 250 380 C 300 470, 420 520, 520 500" fill="none" stroke="var(--bio-outline)" strokeWidth={1.4} opacity={0.22} />
      </g>
      <g data-part="membrane">
        <path d={OUTLINE} fill="none" stroke="var(--bio-membrane)" strokeWidth={5} />
        <path d={OUTLINE} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.8} opacity={0.5} />
      </g>
      <g data-part="ribosomes">
        <Ribos at={FREE_RIBO} />
      </g>
      <g data-part="roughER">
        <RoughER x={N.x} y={N.y} radii={[N.r + 20, N.r + 36, N.r + 52]} from={-62} to={70} />
      </g>
      <g data-part="smoothER">
        <SmoothER d={["M 560 380 C 580 360, 610 372, 624 392 S 664 420, 690 398", "M 590 430 C 612 410, 640 420, 652 440", "M 624 392 C 630 410, 620 424, 612 430"]} />
      </g>
      <g data-part="golgi">
        <Golgi x={282} y={440} rot={-28} s={0.95} />
      </g>
      <g data-part="vesicle">
        {[
          [352, 502, 8],
          [326, 470, 6],
          [236, 404, 6],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
        ))}
        {/* A vesicle fusing with the membrane (exocytosis). */}
        <path d="M 380 547 a 11 11 0 0 1 22 0" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="mito">
        <Mito x={300} y={156} rot={18} />
        <Mito x={620} y={328} rot={78} l={30} w={13} />
        <Mito x={244} y={318} rot={-74} l={28} w={13} />
        <Mito x={500} y={480} rot={8} l={30} w={13} />
      </g>
      <g data-part="lysosome">
        <Lysosome x={592} y={136} />
        <Lysosome x={430} y={520} r={11} />
      </g>
      <g data-part="peroxisome">
        <Peroxisome x={650} y={266} />
        <Peroxisome x={232} y={242} r={10} />
      </g>
      <g data-part="centrosome">
        <rect x={CENTRO.x - 12} y={CENTRO.y - 5} width={24} height={10} rx={3} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
        <rect x={CENTRO.x + 8} y={CENTRO.y - 16} width={10} height={24} rx={3} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      </g>
      <g data-part="nucleus">
        <Nucleoplasm x={N.x} y={N.y} r={N.r - 3} id={id.nuc} />
      </g>
      <g data-part="nucleolus">
        <circle cx={438} cy={282} r={26} fill="var(--bio-nucleus-deep)" opacity={0.85} />
        <circle cx={432} cy={276} r={8} fill="color-mix(in oklab, var(--bio-nucleus-deep) 60%, white)" opacity={0.6} />
      </g>
      <g data-part="envelope">
        <Envelope x={N.x} y={N.y} r={N.r} />
      </g>
    </g>
  );
}

/* Plant cell --------------------------------------------------------------------------------- */

const WALL = { x: 178, y: 30, w: 544, h: 540 };
const PN = { x: 290, y: 150, r: 62 };
const VAC = "M 330 250 C 340 210, 420 208, 520 214 C 620 220, 660 240, 664 300 L 668 440 C 670 500, 620 516, 520 514 L 330 512 C 268 510, 250 490, 252 430 L 256 320 C 258 270, 300 256, 330 250 Z";
const CHLOROPLASTS: [number, number, number][] = [
  [226, 300, 90],
  [222, 420, 84],
  [246, 520, 20],
  [400, 528, 0],
  [560, 534, 6],
  [682, 470, 92],
  [688, 330, 96],
  [670, 200, 70],
  [560, 120, -8],
  [440, 104, 6],
];

export const PLANT_SPOTS = {
  wall: { at: [WALL.x + 6, 200], label: [150, 210], side: "l" },
  plasmodesmata: { at: [WALL.x + WALL.w, 260], label: [748, 250], side: "r" },
  membrane: { at: [WALL.x + 15, 470], label: [150, 470], side: "l" },
  vacuole: { at: [470, 370], label: [748, 370], side: "r" },
  chloroplast: { at: [688, 330], label: [748, 310], side: "r" },
  nucleus: { at: [PN.x, PN.y], label: [150, 120], side: "l" },
  mito: { at: [360, 200], label: [150, 300], side: "l" },
  golgi: { at: [602, 224], label: [748, 180], side: "r" },
  roughER: { at: [PN.x + 78, PN.y - 30], label: [150, 50], side: "l" },
  peroxisome: { at: [640, 120], label: [748, 110], side: "r" },
} satisfies Record<string, Spot>;

function Chloroplast({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx={28} ry={13} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
      <ellipse rx={24.5} ry={9.5} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.9} />
      {[-14, 0, 14].map((gx) => (
        <g key={gx}>
          {[-4, -1.3, 1.4, 4.1].map((gy) => (
            <rect key={gy} x={gx - 4} y={gy - 0.9} width={8} height={1.8} rx={0.9} fill="var(--bio-leaf-deep)" />
          ))}
        </g>
      ))}
      <path d="M -20 0 H 20" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />
    </g>
  );
}

export function PlantCell() {
  const id = useIds("cyto", "nuc", "vac", "wall");
  return (
    <g>
      <defs>
        <linearGradient id={id.cyto} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 85%, var(--bio-membrane))" />
        </linearGradient>
        <radialGradient id={id.nuc} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-nucleus) 60%, white)" />
          <stop offset="1" stopColor="var(--bio-nucleus)" />
        </radialGradient>
        <radialGradient id={id.vac} cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-vacuole) 70%, white)" />
          <stop offset="1" stopColor="var(--bio-vacuole)" />
        </radialGradient>
        <pattern id={id.wall} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(60)">
          <rect width="9" height="9" fill="var(--bio-wall)" />
          <path d="M 0 4.5 H 9" stroke="var(--bio-wall-deep)" strokeWidth={1} opacity={0.5} />
        </pattern>
      </defs>
      {/* Neighbouring cells, cut off at the edges. */}
      <g data-deco>
        <rect x={0} y={WALL.y} width={WALL.x - 6} height={WALL.h} fill="color-mix(in oklab, var(--bio-cell) 60%, transparent)" />
        <rect x={WALL.x + WALL.w + 6} y={WALL.y} width={W - WALL.x - WALL.w - 6} height={WALL.h} fill="color-mix(in oklab, var(--bio-cell) 60%, transparent)" />
      </g>
      <g data-part="wall">
        <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} rx={22} fill={`url(#${id.wall})`} stroke="var(--bio-wall-deep)" strokeWidth={2} />
      </g>
      {/* The cytoplasm: background only (not a part in this view), so it is neither tapped nor dimmed. */}
      <rect x={WALL.x + 12} y={WALL.y + 12} width={WALL.w - 24} height={WALL.h - 24} rx={14} fill={`url(#${id.cyto})`} />
      {/* The membrane is just the line at the edge of the protoplast, pressed against the wall. */}
      <g data-part="membrane">
        <rect x={WALL.x + 12} y={WALL.y + 12} width={WALL.w - 24} height={WALL.h - 24} rx={14} fill="none" stroke="var(--bio-membrane)" strokeWidth={4} />
      </g>
      <g data-part="plasmodesmata">
        {[140, 260, 400].map((y) => (
          <g key={y}>
            <rect x={WALL.x + WALL.w - 13} y={y - 3.5} width={26} height={7} rx={3.5} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.4} />
            <line x1={WALL.x + WALL.w - 12} y1={y} x2={WALL.x + WALL.w + 12} y2={y} stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
          </g>
        ))}
        {[300, 470].map((y) => (
          <g key={y}>
            <rect x={WALL.x - 13} y={y - 3.5} width={26} height={7} rx={3.5} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={1.4} />
            <line x1={WALL.x - 12} y1={y} x2={WALL.x + 12} y2={y} stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
          </g>
        ))}
      </g>
      <g data-part="vacuole">
        <path d={VAC} fill={`url(#${id.vac})`} stroke="var(--bio-water-deep)" strokeWidth={2.4} />
      </g>
      <g data-part="roughER">
        <RoughER x={PN.x} y={PN.y} radii={[PN.r + 18, PN.r + 32]} from={-40} to={50} />
      </g>
      <g data-part="chloroplast">
        {CHLOROPLASTS.map(([x, y, r], i) => (
          <Chloroplast key={i} x={x} y={y} rot={r} />
        ))}
      </g>
      <g data-part="mito">
        <Mito x={360} y={200} rot={-12} l={24} w={11} />
        <Mito x={600} y={512} rot={20} l={22} w={10} />
      </g>
      <g data-part="golgi">
        <Golgi x={602} y={226} rot={30} s={0.6} />
      </g>
      <g data-part="peroxisome">
        <Peroxisome x={640} y={120} r={11} />
      </g>
      <g data-part="nucleus">
        <Nucleoplasm x={PN.x} y={PN.y} r={PN.r} id={id.nuc} />
        <circle cx={PN.x + 10} cy={PN.y - 8} r={17} fill="var(--bio-nucleus-deep)" opacity={0.85} />
        <Envelope x={PN.x} y={PN.y} r={PN.r + 3} />
      </g>
    </g>
  );
}
