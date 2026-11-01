"use client";

import type { ReactNode } from "react";
import { sin } from "@/lib/stableMath";
import type { Spot } from "../../types";
import { onStadium, r1, Shine, useIds, wave } from "../kit";

/** The six ways flagella sit on a cell, one tile each. */

export const W = 960;
export const H = 560;

const COLS = [160, 480, 800];
const ROWS = [14, 290];
const TILE_W = 300;
const TILE_H = 250;
const C = (col: number, row: number): [number, number] => [COLS[col] - (col === 0 && row === 1 ? 0 : 34), ROWS[row] + 104];
const spot = (col: number, row: number, at: [number, number]): Spot => ({ at, label: [COLS[col], ROWS[row] + 222], side: "c" });

export const SPOTS = {
  atrichous: spot(0, 0, [C(0, 0)[0], C(0, 0)[1]]),
  monotrichous: spot(1, 0, [C(1, 0)[0] + 112, C(1, 0)[1] + 4]),
  lophotrichous: spot(2, 0, [C(2, 0)[0] + 106, C(2, 0)[1] - 6]),
  amphitrichous: spot(0, 1, [C(0, 1)[0] - 96, C(0, 1)[1] + 2]),
  peritrichous: spot(1, 1, [C(1, 1)[0] + 4, C(1, 1)[1] - 52]),
  endoflagella: spot(2, 1, [C(2, 1)[0] + 6, C(2, 1)[1] - 2]),
} satisfies Record<string, Spot>;

const LEN = 120;
const WID = 46;

function Body({ x, y, id }: { x: number; y: number; id: { body: string; shine: string } }) {
  return (
    <g>
      <rect x={x - LEN / 2} y={y - WID / 2} width={LEN} height={WID} rx={WID / 2} fill={`url(#${id.body})`} stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      <rect x={x - LEN / 2 + 5} y={y - WID / 2 + 5} width={LEN - 10} height={WID - 10} rx={WID / 2 - 5} fill="none" stroke="var(--bio-membrane)" strokeWidth={1.2} opacity={0.8} />
      <rect x={x - LEN / 2} y={y - WID / 2} width={LEN} height={WID} rx={WID / 2} fill={`url(#${id.shine})`} />
    </g>
  );
}

/** A flagellum leaving the outline at angle `a` (degrees) from the pole or side. */
function Flag({ x, y, a, len = 74, amp = 6, wl = 26 }: { x: number; y: number; a: number; len?: number; amp?: number; wl?: number }) {
  return <path d={wave(x, y, len, a, amp, wl, 0)} fill="none" stroke="var(--bio-outline)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
}

function Tile({ col, row, children }: { col: number; row: number; children: ReactNode }) {
  return (
    <g>
      <rect x={COLS[col] - TILE_W / 2} y={ROWS[row]} width={TILE_W} height={TILE_H} rx={18} fill="var(--surface)" stroke="var(--line)" strokeWidth={1} data-deco />
      {children}
    </g>
  );
}

export function Flagella() {
  const id = useIds("body", "shine", "sheath");
  const ids = { body: id.body, shine: id.shine };
  const [ax, ay] = C(0, 0);
  const [mx, my] = C(1, 0);
  const [lx, ly] = C(2, 0);
  const [bx, by] = C(0, 1);
  const [px, py] = C(1, 1);
  const [sx, sy] = C(2, 1);
  // Evenly round the outline, each flagellum leaving along the outward normal.
  const peri = Array.from({ length: 12 }, (_, i) => {
    const [x, y, nx, ny] = onStadium({ x: px - LEN / 2, y: py - WID / 2, w: LEN, h: WID }, i / 12 + 0.03);
    return [r1(x), r1(y), r1((Math.atan2(ny, nx) * 180) / Math.PI)] as const;
  });

  return (
    <g>
      <defs>
        <linearGradient id={id.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 80%, var(--bio-membrane))" />
        </linearGradient>
        <linearGradient id={id.sheath} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-capsule)" stopOpacity={0.55} />
          <stop offset="1" stopColor="var(--bio-capsule)" stopOpacity={0.9} />
        </linearGradient>
        <Shine id={id.shine} cx="40%" cy="15%" />
      </defs>

      <Tile col={0} row={0}>
        <g data-part="atrichous">
          <Body x={ax} y={ay} id={ids} />
        </g>
      </Tile>

      <Tile col={1} row={0}>
        <g data-part="monotrichous">
          <Flag x={mx + LEN / 2 - 1} y={my} a={0} len={100} amp={8} wl={32} />
          <Body x={mx} y={my} id={ids} />
        </g>
      </Tile>

      <Tile col={2} row={0}>
        <g data-part="lophotrichous">
          {[-34, -12, 10, 32].map((a) => (
            <Flag key={a} x={lx + LEN / 2 - 3} y={ly + a * 0.18} a={a} len={92} amp={5} wl={26} />
          ))}
          <Body x={lx} y={ly} id={ids} />
        </g>
      </Tile>

      <Tile col={0} row={1}>
        <g data-part="amphitrichous">
          <Flag x={bx + LEN / 2 - 1} y={by} a={0} len={84} amp={6} wl={28} />
          <Flag x={bx - LEN / 2 + 1} y={by} a={180} len={84} amp={6} wl={28} />
          <Body x={bx} y={by} id={ids} />
        </g>
      </Tile>

      <Tile col={1} row={1}>
        <g data-part="peritrichous">
          {peri.map(([x, y, t], i) => (
            <Flag key={i} x={x} y={y} a={t} len={50} amp={4.5} wl={20} />
          ))}
          <Body x={px} y={py} id={ids} />
        </g>
      </Tile>

      <Tile col={2} row={1}>
        <g data-part="endoflagella">
          {/* A spirochaete: helical body, the outer sheath around it and the flagella in between. */}
          <path d={spiral(sx - 112, sy, 224)} fill="none" stroke="var(--bio-capsule-deep)" strokeWidth={20} strokeLinecap="round" opacity={0.35} />
          <path d={spiral(sx - 112, sy, 224)} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={11} strokeLinecap="round" />
          <path d={spiral(sx - 112, sy, 224)} fill="none" stroke="var(--bio-cell)" strokeWidth={8} strokeLinecap="round" />
          <path d={spiral(sx - 108, sy - 2.2, 108)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeLinecap="round" />
          <path d={spiral(sx + 2, sy + 2.2, 106)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      </Tile>
    </g>
  );
}

function spiral(x: number, y: number, len: number) {
  const pts: string[] = [];
  for (let s = 0; s <= len; s += 2) pts.push(`${r1(x + s)} ${r1(y + 14 * sin((s / 37) * 2 * Math.PI))}`);
  return `M ${pts.join(" L ")}`;
}
