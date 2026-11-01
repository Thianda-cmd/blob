"use client";

import type { Spot } from "../../types";
import { inRoundRect, onStadium, r1, scatter, Shine, tangle, useIds, wave, wavePoint } from "../kit";

/**
 * A rod-shaped bacterium in a lengthwise section, drawn for the "Structure" view: capsule,
 * cell wall, membrane, cytoplasm with nucleoid, plasmids, ribosomes and storage granules,
 * fimbriae, a sex pilus and a flagellum.
 */

export const W = 900;
export const H = 520;

// The cell: a stadium. Capsule outside, then wall, membrane band and cytoplasm.
const CAP = { x: 170, y: 150, w: 560, h: 220 };
const WALL = { x: 192, y: 172, w: 516, h: 176 };
const MEM = { x: 203, y: 183, w: 494, h: 154 };
const CYTO = { x: 209, y: 189, w: 482, h: 142 };
const CX = 450;

const NUC = { cx: 448, cy: 262, rx: 104, ry: 34 };
const PLASMIDS: [number, number, number][] = [
  [292, 300, 10],
  [262, 230, 7.5],
  [640, 292, 8],
];
const GRANULES: [number, number, number][] = [
  [592, 222, 12],
  [622, 250, 7.5],
  [566, 312, 6.5],
];

const nearAny = (x: number, y: number, list: [number, number, number][], pad: number) => list.some(([a, b, r]) => (a - x) ** 2 + (b - y) ** 2 < (r + pad) ** 2);

const RIBOSOMES = scatter(
  11,
  92,
  [CYTO.x, CYTO.y, CYTO.x + CYTO.w, CYTO.y + CYTO.h],
  (x, y) => inRoundRect(x, y, CYTO.x, CYTO.y, CYTO.w, CYTO.h, CYTO.h / 2, 7),
  10.5,
  (x, y) => ((x - NUC.cx) / (NUC.rx + 10)) ** 2 + ((y - NUC.cy) / (NUC.ry + 9)) ** 2 < 1 || nearAny(x, y, PLASMIDS, 6) || nearAny(x, y, GRANULES, 6),
);
/** The ribosome the marker points at. */
const RIB = RIBOSOMES.reduce((best, p) => ((p[0] - 372) ** 2 + (p[1] - 316) ** 2 < (best[0] - 372) ** 2 + (best[1] - 316) ** 2 ? p : best));

const FIMBRIAE = Array.from({ length: 40 }, (_, i) => {
  const [x, y, nx, ny] = onStadium(WALL, i / 40 + 0.004);
  const len = 30 + ((i * 7) % 5) * 1.6;
  return [r1(x), r1(y), r1(x + nx * len), r1(y + ny * len)] as const;
}).filter(([x, y]) => !(x > 690 && y > 268 && y < 316) && !(x < 236 && y < 222));

// The flagellum leaves the right pole a little below the middle; hook first, then the wave.
const FLAG_BASE: [number, number] = [701, 292];
const HOOK = "M 701 292 q 12 2 20 10";
const FILAMENT = wave(721, 302, 196, 26, 13, 60, 0);
/** A point on the filament for the marker. */
const FLAG_AT = wavePoint(721, 302, 104, 26, 13, 60, 0);

// The sex pilus leaves the top left and reaches out to the left edge.
const PILUS = "M 222 196 C 186 168, 150 150, 104 146 S 40 152, 18 136";

export const SPOTS = {
  flagellum: { at: FLAG_AT, label: [800, 472], side: "c" },
  fimbriae: { at: [452, 150], label: [300, 58], side: "c" },
  sexpilus: { at: [106, 146], label: [96, 58], side: "c" },
  capsule: { at: [560, 160], label: [500, 58], side: "c" },
  wall: { at: [699, 228], label: [895, 204], side: "l" },
  membrane: { at: [694, 262], label: [895, 256], side: "l" },
  cytoplasm: { at: [612, 288], label: [632, 472], side: "c" },
  nucleoid: { at: [470, 270], label: [478, 472], side: "c" },
  plasmid: { at: [292, 300], label: [160, 472], side: "c" },
  ribosomes: { at: RIB, label: [318, 472], side: "c" },
  inclusions: { at: [598, 214], label: [700, 58], side: "c" },
} satisfies Record<string, Spot>;

export function Structure() {
  const id = useIds("cap", "wall", "cyto", "shine", "nuc", "mesh");
  return (
    <g>
      <defs>
        <radialGradient id={id.cap} cx="50%" cy="45%" r="60%">
          <stop offset="0.7" stopColor="var(--bio-capsule)" stopOpacity={0.35} />
          <stop offset="1" stopColor="var(--bio-capsule)" stopOpacity={0.9} />
        </radialGradient>
        <linearGradient id={id.wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-murein)" />
          <stop offset="1" stopColor="var(--bio-murein-deep)" stopOpacity={0.85} />
        </linearGradient>
        <radialGradient id={id.cyto} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 82%, var(--bio-membrane))" />
        </radialGradient>
        <radialGradient id={id.nuc} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--bio-nucleus)" stopOpacity={0.75} />
          <stop offset="1" stopColor="var(--bio-nucleus)" stopOpacity={0} />
        </radialGradient>
        <pattern id={id.mesh} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M 0 3.5 H 7" stroke="var(--bio-murein-deep)" strokeWidth={0.7} opacity={0.55} />
        </pattern>
        <Shine id={id.shine} cx="35%" cy="20%" />
      </defs>

      <g data-part="sexpilus">
        <path d={PILUS} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={5} strokeLinecap="round" />
        <path d={PILUS} fill="none" stroke="var(--bio-bone)" strokeWidth={2} strokeLinecap="round" />
        <circle cx={18} cy={136} r={4.5} fill="var(--bio-wood-deep)" />
      </g>

      <g data-part="flagellum">
        <path d={HOOK} fill="none" stroke="var(--bio-outline)" strokeWidth={4.2} strokeLinecap="round" />
        <path d={FILAMENT} fill="none" stroke="var(--bio-outline)" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={FLAG_BASE[0]} cy={FLAG_BASE[1]} r={3.6} fill="var(--bio-outline)" />
      </g>

      <g data-part="fimbriae">
        {FIMBRIAE.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bio-wood-deep)" strokeWidth={1.5} strokeLinecap="round" />
        ))}
      </g>

      <g data-part="capsule">
        <rect x={CAP.x} y={CAP.y} width={CAP.w} height={CAP.h} rx={CAP.h / 2} fill={`url(#${id.cap})`} />
        <rect x={CAP.x} y={CAP.y} width={CAP.w} height={CAP.h} rx={CAP.h / 2} fill="none" stroke="var(--bio-capsule-deep)" strokeWidth={1.4} strokeDasharray="5 5" opacity={0.8} />
      </g>

      <g data-part="wall">
        <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} rx={WALL.h / 2} fill={`url(#${id.wall})`} />
        <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} rx={WALL.h / 2} fill={`url(#${id.mesh})`} />
        <rect x={WALL.x} y={WALL.y} width={WALL.w} height={WALL.h} rx={WALL.h / 2} fill="none" stroke="var(--bio-murein-deep)" strokeWidth={1.4} />
      </g>

      <g data-part="membrane">
        <rect x={MEM.x} y={MEM.y} width={MEM.w} height={MEM.h} rx={MEM.h / 2} fill="var(--bio-head)" />
        <rect x={MEM.x + 3} y={MEM.y + 3} width={MEM.w - 6} height={MEM.h - 6} rx={MEM.h / 2 - 3} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.8} opacity={0.5} />
      </g>

      <g data-part="cytoplasm">
        <rect x={CYTO.x} y={CYTO.y} width={CYTO.w} height={CYTO.h} rx={CYTO.h / 2} fill={`url(#${id.cyto})`} />
        <rect x={CYTO.x} y={CYTO.y} width={CYTO.w} height={CYTO.h} rx={CYTO.h / 2} fill={`url(#${id.shine})`} />
      </g>

      <g data-part="ribosomes">
        {RIBOSOMES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.9} fill="var(--bio-ribo)" opacity={0.85} />
        ))}
      </g>

      <g data-part="nucleoid">
        <ellipse cx={NUC.cx} cy={NUC.cy} rx={NUC.rx + 14} ry={NUC.ry + 10} fill={`url(#${id.nuc})`} />
        <path d={tangle(NUC.cx, NUC.cy, NUC.rx, NUC.ry, 3)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} strokeLinejoin="round" />
        <path d={tangle(NUC.cx + 6, NUC.cy - 2, NUC.rx * 0.72, NUC.ry * 0.62, 5)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} strokeLinejoin="round" opacity={0.7} />
      </g>

      <g data-part="plasmid">
        {PLASMIDS.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
            <circle cx={x} cy={y} r={r - 3} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1} opacity={0.6} />
          </g>
        ))}
      </g>

      <g data-part="inclusions">
        {GRANULES.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
            <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.35} fill="#fff" opacity={0.5} />
          </g>
        ))}
      </g>

      {/* Scale bar. */}
      <g data-deco opacity={0.75}>
        <line x1={CX - 107} y1={404} x2={CX + 107} y2={404} stroke="var(--ink-3)" strokeWidth={1.5} />
        <line x1={CX - 107} y1={399} x2={CX - 107} y2={409} stroke="var(--ink-3)" strokeWidth={1.5} />
        <line x1={CX + 107} y1={399} x2={CX + 107} y2={409} stroke="var(--ink-3)" strokeWidth={1.5} />
        <text x={CX} y={424} textAnchor="middle" fontSize={12} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
          1 µm
        </text>
      </g>
    </g>
  );
}
