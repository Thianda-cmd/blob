"use client";

import type { ReactNode } from "react";
import { useText } from "@/i18n/useText";
import { tx } from "@/i18n/text";
import { sin } from "@/lib/stableMath";
import type { Spot } from "../../types";
import { r1, useIds, wave } from "../kit";

/**
 * Twelve cell shapes and arrangements, each in its own tile, coloured as in a Gram-stained
 * smear: Gram-positive violet, Gram-negative pink.
 */

export const W = 960;
export const H = 632;

const COLS = [120, 360, 600, 840];
const ROWS = [16, 214, 412];
const TILE_W = 224;
const TILE_H = 186;
/** Where a tile's drawing is centred. */
const C = (col: number, row: number): [number, number] => [COLS[col], ROWS[row] + 78];
const LABEL_Y = (row: number) => ROWS[row] + 160;

const spot = (col: number, row: number, dx = 0, dy = 0): Spot => {
  const [x, y] = C(col, row);
  return { at: [x + dx, y + dy], label: [x, LABEL_Y(row)], side: "c" };
};

export const SPOTS = {
  coccus: spot(0, 0, 0, -6),
  diplococcus: spot(1, 0, -30, -14),
  streptococcus: spot(2, 0, 0, 2),
  staphylococcus: spot(3, 0, 0, 0),
  tetrad: spot(0, 1, -26, -14),
  sarcina: spot(1, 1, 0, 0),
  rod: spot(2, 1, 0, -2),
  coccobacillus: spot(3, 1, 0, 0),
  coryneform: spot(0, 2, -6, 0),
  vibrio: spot(1, 2, -4, -10),
  spirillum: spot(2, 2, 0, -4),
  spirochete: spot(3, 2, 0, 6),
} satisfies Record<string, Spot>;

type Fill = { fill: string; stroke: string };

function Coccus({ x, y, r, f }: { x: number; y: number; r: number; f: Fill }) {
  return <circle cx={r1(x)} cy={r1(y)} r={r} fill={f.fill} stroke={f.stroke} strokeWidth={1.3} />;
}

function Rod({ x, y, len, w, angle = 0, f }: { x: number; y: number; len: number; w: number; angle?: number; f: Fill }) {
  return <rect x={-len / 2} y={-w / 2} width={len} height={w} rx={w / 2} fill={f.fill} stroke={f.stroke} strokeWidth={1.3} transform={`translate(${x} ${y}) rotate(${angle})`} />;
}

/** A club: one end thicker than the other. */
function Club({ x, y, angle, f }: { x: number; y: number; angle: number; f: Fill }) {
  return (
    <path
      d="M -26 -4 C -26 -8, -22 -8, -16 -7 L 16 -12 C 31 -13, 31 13, 16 12 L -16 7 C -22 8, -26 8, -26 4 Z"
      fill={f.fill}
      stroke={f.stroke}
      strokeWidth={1.3}
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

/** A comma-shaped vibrio with its polar flagellum. */
function Comma({ x, y, angle, f }: { x: number; y: number; angle: number; f: Fill }) {
  const body = "M -17 9 Q -6 -12 16 -7";
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={wave(16, -7, 44, -8, 4, 20, 0.4)} fill="none" stroke="var(--bio-outline)" strokeWidth={1.4} strokeLinecap="round" />
      <path d={body} fill="none" stroke={f.stroke} strokeWidth={14.5} strokeLinecap="round" />
      <path d={body} fill="none" stroke={f.fill} strokeWidth={12} strokeLinecap="round" />
    </g>
  );
}

function Tile({ col, row, children }: { col: number; row: number; children: ReactNode }) {
  return (
    <g>
      <rect x={COLS[col] - TILE_W / 2} y={ROWS[row]} width={TILE_W} height={TILE_H} rx={18} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} data-deco />
      {children}
    </g>
  );
}

export function Shapes() {
  const tt = useText();
  const id = useIds("pos", "neg");
  const pos: Fill = { fill: `url(#${id.pos})`, stroke: "color-mix(in oklab, var(--bio-gpos) 70%, black)" };
  const neg: Fill = { fill: `url(#${id.neg})`, stroke: "color-mix(in oklab, var(--bio-gneg) 70%, black)" };

  // Staphylococci: a bunch of grapes.
  const grapes: [number, number][] = [
    [-22, -20], [0, -24], [22, -18], [-33, 0], [-11, -3], [11, -2], [33, 2], [-22, 18], [0, 18], [22, 20], [-6, 36], [14, 37], [-30, 34],
  ];
  // Streptococci: a chain along a gentle curve.
  const chain = Array.from({ length: 8 }, (_, i) => [-84 + i * 23, 10 * sin(i * 0.8)] as [number, number]);
  // Sarcina: a packet of eight, back layer offset up and right.
  const cube: [number, number, boolean][] = [
    [-4, -22, true], [20, -22, true], [-4, 2, true], [20, 2, true],
    [-16, -12, false], [8, -12, false], [-16, 12, false], [8, 12, false],
  ];

  return (
    <g>
      <defs>
        <radialGradient id={id.pos} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-gpos) 45%, white)" />
          <stop offset="1" stopColor="var(--bio-gpos)" />
        </radialGradient>
        <radialGradient id={id.neg} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-gneg) 45%, white)" />
          <stop offset="1" stopColor="var(--bio-gneg)" />
        </radialGradient>
      </defs>

      <Tile col={0} row={0}>
        <g data-part="coccus">
          {(
            [
              [-44, -6, 17],
              [24, -26, 17],
              [30, 26, 17],
              [-12, 30, 13],
            ] as const
          ).map(([dx, dy, r], i) => (
            <Coccus key={i} x={C(0, 0)[0] + dx} y={C(0, 0)[1] + dy} r={r} f={pos} />
          ))}
        </g>
      </Tile>

      <Tile col={1} row={0}>
        <g data-part="diplococcus">
          {(
            [
              [-30, -14, 0],
              [34, 18, 35],
            ] as const
          ).map(([dx, dy, a], i) => (
            <g key={i} transform={`translate(${C(1, 0)[0] + dx} ${C(1, 0)[1] + dy}) rotate(${a})`}>
              {/* Two coffee beans, flat sides facing. */}
              <path d="M -3 -14 C -25 -19, -28 17, -3 14 C -8 6, -8 -6, -3 -14 Z" fill={neg.fill} stroke={neg.stroke} strokeWidth={1.3} />
              <path d="M 3 -14 C 25 -19, 28 17, 3 14 C 8 6, 8 -6, 3 -14 Z" fill={neg.fill} stroke={neg.stroke} strokeWidth={1.3} />
            </g>
          ))}
        </g>
      </Tile>

      <Tile col={2} row={0}>
        <g data-part="streptococcus">
          {chain.map(([dx, dy], i) => (
            <Coccus key={i} x={C(2, 0)[0] + dx} y={C(2, 0)[1] + dy} r={11.5} f={pos} />
          ))}
        </g>
      </Tile>

      <Tile col={3} row={0}>
        <g data-part="staphylococcus">
          {grapes.map(([dx, dy], i) => (
            <Coccus key={i} x={C(3, 0)[0] + dx} y={C(3, 0)[1] + dy - 6} r={11.5} f={pos} />
          ))}
        </g>
      </Tile>

      <Tile col={0} row={1}>
        <g data-part="tetrad">
          {(
            [
              [-26, -14, 0],
              [36, 22, 20],
            ] as const
          ).map(([dx, dy, a], k) => (
            <g key={k} transform={`translate(${C(0, 1)[0] + dx} ${C(0, 1)[1] + dy}) rotate(${a})`}>
              {[
                [-12, -12],
                [12, -12],
                [-12, 12],
                [12, 12],
              ].map(([x, y], i) => (
                <Coccus key={i} x={x} y={y} r={11.5} f={pos} />
              ))}
            </g>
          ))}
        </g>
      </Tile>

      <Tile col={1} row={1}>
        <g data-part="sarcina">
          {cube.map(([dx, dy, back], i) => (
            <g key={i} opacity={back ? 0.72 : 1}>
              <Coccus x={C(1, 1)[0] + dx} y={C(1, 1)[1] + dy + 4} r={12.5} f={pos} />
            </g>
          ))}
        </g>
      </Tile>

      <Tile col={2} row={1}>
        <g data-part="rod">
          <Rod x={C(2, 1)[0] - 30} y={C(2, 1)[1] - 22} len={66} w={22} angle={-12} f={neg} />
          <Rod x={C(2, 1)[0] + 34} y={C(2, 1)[1] + 4} len={66} w={22} angle={62} f={neg} />
          <Rod x={C(2, 1)[0] - 18} y={C(2, 1)[1] + 32} len={62} w={21} angle={8} f={neg} />
        </g>
      </Tile>

      <Tile col={3} row={1}>
        <g data-part="coccobacillus">
          {(
            [
              [-44, -18, 10],
              [-6, -30, -20],
              [36, -14, 40],
              [-30, 20, -35],
              [12, 14, 15],
              [44, 32, -10],
            ] as const
          ).map(([dx, dy, a], i) => (
            <Rod key={i} x={C(3, 1)[0] + dx} y={C(3, 1)[1] + dy} len={30} w={19} angle={a} f={neg} />
          ))}
        </g>
      </Tile>

      <Tile col={0} row={2}>
        <g data-part="coryneform">
          {/* V, Y and palisade: "Chinese letters". */}
          <Club x={C(0, 2)[0] - 46} y={C(0, 2)[1] - 14} angle={-62} f={pos} />
          <Club x={C(0, 2)[0] - 24} y={C(0, 2)[1] - 16} angle={-118} f={pos} />
          <Club x={C(0, 2)[0] + 14} y={C(0, 2)[1] + 22} angle={10} f={pos} />
          <Club x={C(0, 2)[0] + 34} y={C(0, 2)[1] - 10} angle={-75} f={pos} />
          <Club x={C(0, 2)[0] + 50} y={C(0, 2)[1] - 6} angle={-100} f={pos} />
          <Club x={C(0, 2)[0] - 38} y={C(0, 2)[1] + 28} angle={170} f={pos} />
        </g>
      </Tile>

      <Tile col={1} row={2}>
        <g data-part="vibrio">
          <Comma x={C(1, 2)[0] - 34} y={C(1, 2)[1] - 10} angle={-10} f={neg} />
          <Comma x={C(1, 2)[0] + 18} y={C(1, 2)[1] + 26} angle={25} f={neg} />
          <Comma x={C(1, 2)[0] + 30} y={C(1, 2)[1] - 30} angle={-40} f={neg} />
        </g>
      </Tile>

      <Tile col={2} row={2}>
        <g data-part="spirillum">
          {(
            [
              [-62, -20, 8],
              [-58, 26, -6],
            ] as const
          ).map(([dx, dy, a], i) => {
            const x0 = C(2, 2)[0] + dx;
            const y0 = C(2, 2)[1] + dy;
            return (
              <g key={i} transform={`rotate(${a} ${x0 + 60} ${y0})`}>
                <path d={wave(x0, y0, 120, 0, 9, 40, 0)} fill="none" stroke={neg.stroke} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
                <path d={wave(x0, y0, 120, 0, 9, 40, 0)} fill="none" stroke={`url(#${id.neg})`} strokeWidth={8.4} strokeLinecap="round" strokeLinejoin="round" />
                {[-24, 0, 24].map((t) => (
                  <path key={t} d={wave(x0 + 120, y0 + 9 * sin((120 / 40) * 2 * Math.PI), 16, t, 2.5, 8, 0)} fill="none" stroke="var(--bio-outline)" strokeWidth={1.2} strokeLinecap="round" />
                ))}
                {[156, 180, 204].map((t) => (
                  <path key={t} d={wave(x0, y0, 16, t, 2.5, 8, 0)} fill="none" stroke="var(--bio-outline)" strokeWidth={1.2} strokeLinecap="round" />
                ))}
              </g>
            );
          })}
        </g>
      </Tile>

      <Tile col={3} row={2}>
        <g data-part="spirochete">
          <path d={coil(C(3, 2)[0] - 88, C(3, 2)[1] - 8, 176, -8)} fill="none" stroke={neg.stroke} strokeWidth={4.6} strokeLinecap="round" />
          <path d={coil(C(3, 2)[0] - 88, C(3, 2)[1] - 8, 176, -8)} fill="none" stroke="var(--bio-gneg)" strokeWidth={2.6} strokeLinecap="round" />
          <path d={coil(C(3, 2)[0] - 70, C(3, 2)[1] + 26, 150, 6)} fill="none" stroke={neg.stroke} strokeWidth={4.6} strokeLinecap="round" />
          <path d={coil(C(3, 2)[0] - 70, C(3, 2)[1] + 26, 150, 6)} fill="none" stroke="var(--bio-gneg)" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      </Tile>

      {/* What the colours mean. */}
      <g data-deco style={{ fontFamily: "var(--font-sans)" }}>
        <circle cx={330} cy={619} r={6} fill={pos.fill} stroke={pos.stroke} />
        <text x={342} y={623} fontSize={12.5} fill="var(--ink-2)">
          {tt(tx("Gram-positive (violet)", "grampositiv (violett)"))}
        </text>
        <circle cx={520} cy={619} r={6} fill={neg.fill} stroke={neg.stroke} />
        <text x={532} y={623} fontSize={12.5} fill="var(--ink-2)">
          {tt(tx("Gram-negative (pink)", "gramnegativ (rosa)"))}
        </text>
      </g>
    </g>
  );
}

/** A tight, gently curving spiral (spirochaete). */
function coil(x: number, y: number, len: number, bend: number) {
  const pts: string[] = [];
  for (let s = 0; s <= len; s += 1.5) {
    const k = s / len;
    pts.push(`${r1(x + s)} ${r1(y + bend * sin(k * Math.PI) + 5 * sin((s / 13) * 2 * Math.PI))}`);
  }
  return `M ${pts.join(" L ")}`;
}
