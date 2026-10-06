"use client";

// Shared drawings for the immune-system topic: antigens (epitopes) and the complementary
// receptor/antibody ends (lock and key), the Y-shaped antibody, pathogens and the cells of
// the immune system. Every piece is an SVG <g> centred on (0, 0), so widgets can place and
// animate it. One colour per cell type, used in every picture of the topic.

import type { ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";

export type Epitope = "tri" | "round" | "square" | "trap" | "step" | "wave";
export const EPITOPES: Epitope[] = ["tri", "round", "square", "trap", "step", "wave"];

const f = (v: number) => Math.round(v * 100) / 100;
export const rad = (deg: number) => (deg * Math.PI) / 180;
/** Rotate a point by `deg` (clockwise on screen, like SVG's rotate). */
export const turn = ([x, y]: [number, number], deg: number): [number, number] => {
  const a = rad(deg);
  return [f(x * Math.cos(a) - y * Math.sin(a)), f(x * Math.sin(a) + y * Math.cos(a))];
};

/** The bump's outline from (−s, 0) over the top to (s, 0), without the leading M. */
function bumpEdge(shape: Epitope, s: number): string {
  switch (shape) {
    case "tri":
      return `L 0 ${f(-1.3 * s)} L ${s} 0`;
    case "round":
      return `A ${s} ${s} 0 0 1 ${s} 0`;
    case "square":
      return `L ${-s} ${f(-1.2 * s)} L ${s} ${f(-1.2 * s)} L ${s} 0`;
    case "trap":
      return `L ${f(-0.45 * s)} ${f(-1.2 * s)} L ${f(0.45 * s)} ${f(-1.2 * s)} L ${s} 0`;
    case "step":
      return `L ${-s} ${f(-1.3 * s)} L 0 ${f(-1.3 * s)} L 0 ${f(-0.55 * s)} L ${s} ${f(-0.55 * s)} L ${s} 0`;
    case "wave":
      return `L ${f(-0.5 * s)} ${f(-1.25 * s)} L 0 ${f(-0.45 * s)} L ${f(0.5 * s)} ${f(-1.25 * s)} L ${s} 0`;
  }
}

/** An antigen (epitope) on a surface: its base lies on y = 0 and it points up (−y). */
export const bumpPath = (shape: Epitope, s: number) => `M ${-s} 0 ${bumpEdge(shape, s)} Z`;
/** Height of a cup (the block that holds the cut-out). */
export const cupHeight = (s: number) => f(1.3 * s + 4);
/**
 * The complementary end of a receptor or antibody: a block above y = 0 with the bump's shape cut
 * out of its lower side. The antigen comes from below (+y) and fits exactly.
 */
export const cupPath = (shape: Epitope, s: number) => {
  const w = f(1.75 * s);
  const h = cupHeight(s);
  return `M ${-w} 0 L ${-s} 0 ${bumpEdge(shape, s)} L ${w} 0 L ${w} ${-h} L ${-w} ${-h} Z`;
};

// ---------------------------------------------------------------------------
// Colours (biology palette; they switch for dark mode)

export type Paint = { fill: string; stroke: string; fillOpacity?: number };
export const PAINT = {
  macro: { fill: "var(--bio-mito)", stroke: "var(--bio-mito-deep)" },
  th: { fill: "var(--bio-nerve)", stroke: "var(--bio-nerve-deep)" },
  tk: { fill: "var(--bio-blood)", stroke: "var(--bio-blood)", fillOpacity: 0.28 },
  b: { fill: "var(--bio-vacuole)", stroke: "var(--bio-water-deep)" },
  mem: { fill: "var(--bio-nucleus)", stroke: "var(--bio-nucleus-deep)" },
  body: { fill: "var(--bio-flesh)", stroke: "var(--bio-flesh-deep)" },
  virus: { fill: "var(--bio-petal)", stroke: "var(--bio-petal-deep)" },
  bact: { fill: "var(--bio-wall)", stroke: "var(--bio-wall-deep)" },
} satisfies Record<string, Paint>;
export const AB_COLOR = "var(--bio-water-deep)";
export const GLOW = "drop-shadow(0 0 4px var(--blob)) drop-shadow(0 0 1.5px var(--blob))";

// ---------------------------------------------------------------------------
// Antibody (Y shape)

export const AB = { arm: 15, stem: 16, ang: 40 };

/** Where an antibody's binding end sits in its own frame (hinge at 0,0, arms up): origin and rotation of the cup. */
export function abCup(side: -1 | 1, s: number, arm = AB.arm) {
  const a = rad(AB.ang);
  const d: [number, number] = [side * Math.sin(a), -Math.cos(a)];
  const L = arm + cupHeight(s);
  return { at: [f(d[0] * L), f(d[1] * L)] as [number, number], rot: side === -1 ? 140 : -140, dir: d };
}

/** One antibody bridging two pathogens in a clump: from pathogen `a` to `b` at angle `beta`, antibody below (1) or above (−1) the line. */
export type ClumpLink = { a: number; b: number; beta: number; side: 1 | -1 };

/**
 * Lays out an agglutination clump: pathogen centres (radius `rp`, antigens of size `s`), the pose of
 * each bridging antibody, and on every pathogen the angles of its antigens (bound ones first, free
 * ones filled in between). Centred on `center`.
 */
export function clump(links: ClumpLink[], rp: number, s: number, center: [number, number]) {
  const c = abCup(-1, s);
  const c1: [number, number] = [c.at[0] + c.dir[0] * rp, c.at[1] + c.dir[1] * rp];
  const D = Math.abs(2 * c1[0]);
  const lift = Math.abs(c1[1]);
  const P: [number, number][] = [[0, 0]];
  for (const l of links) {
    const r = rad(l.beta);
    P[l.b] = [P[l.a][0] + D * Math.cos(r), P[l.a][1] + D * Math.sin(r)];
  }
  const abs = links.map((l) => {
    const r = rad(l.beta);
    const mid: [number, number] = [(P[l.a][0] + P[l.b][0]) / 2, (P[l.a][1] + P[l.b][1]) / 2];
    return { H: [mid[0] - l.side * lift * Math.sin(r), mid[1] + l.side * lift * Math.cos(r)] as [number, number], rot: l.beta + (l.side === 1 ? 0 : 180) };
  });
  const bound: number[][] = P.map(() => []);
  abs.forEach((ab, i) => {
    for (const side of [-1, 1] as const) {
      const o = turn(abCup(side, s).at, ab.rot);
      const at: [number, number] = [ab.H[0] + o[0], ab.H[1] + o[1]];
      const l = links[i];
      const v = Math.hypot(P[l.a][0] - at[0], P[l.a][1] - at[1]) < Math.hypot(P[l.b][0] - at[0], P[l.b][1] - at[1]) ? l.a : l.b;
      bound[v].push((Math.atan2(at[1] - P[v][1], at[0] - P[v][0]) * 180) / Math.PI);
    }
  });
  const gap = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  const angles = bound.map((list) => {
    const out = [...list];
    const base = list[0] ?? 0;
    for (let k = 1; k < 8; k++) if (out.every((b) => gap(base + k * 45, b) > 38)) out.push(base + k * 45);
    return out.map((a) => Math.round(a * 10) / 10);
  });
  const xs = P.map((p) => p[0]);
  const ys = P.map((p) => p[1]);
  const dx = center[0] - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = center[1] - (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    pathogens: P.map(([x, y], i) => ({ x: f(x + dx), y: f(y + dy), angles: angles[i] })),
    antibodies: abs.map((a) => ({ x: f(a.H[0] + dx), y: f(a.H[1] + dy), rot: Math.round(a.rot) })),
  };
}

/** A Y-shaped antibody: hinge at (0, 0), stem down, the two identical binding sites at the arm tips. */
export function Antibody({
  shape,
  s = 4.5,
  color = AB_COLOR,
  width = 3.2,
  arm = AB.arm,
  stem = AB.stem,
}: {
  shape: Epitope;
  s?: number;
  color?: string;
  width?: number;
  arm?: number;
  stem?: number;
}) {
  const a = rad(AB.ang);
  const tip = (side: -1 | 1): [number, number] => [f(side * arm * Math.sin(a)), f(-arm * Math.cos(a))];
  return (
    <g>
      <path d={`M 0 ${stem} L 0 0 L ${tip(-1)[0]} ${tip(-1)[1]} M 0 0 L ${tip(1)[0]} ${tip(1)[1]}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      {([-1, 1] as const).map((side) => {
        const c = abCup(side, s, arm);
        return <path key={side} d={cupPath(shape, s)} transform={`translate(${c.at[0]} ${c.at[1]}) rotate(${c.rot})`} fill={color} />;
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pathogens

/** Antigens around a round surface of radius r: one bump per angle (degrees, 0 = right, 90 = down). */
export function Bumps({ r, angles, shape, s = 4.5, fill }: { r: number; angles: number[]; shape: Epitope; s?: number; fill: string }) {
  return (
    <>
      {angles.map((t, i) => (
        <path key={i} d={bumpPath(shape, s)} transform={`rotate(${f(t + 90)}) translate(0 ${-r})`} fill={fill} />
      ))}
    </>
  );
}

/** A virus particle: envelope, capsid inside, antigens on the surface. */
export function VirusParticle({ r = 16, shape = "tri", s, angles, faded }: { r?: number; shape?: Epitope; s?: number; angles?: number[]; faded?: boolean }) {
  const bumps = angles ?? [0, 45, 90, 135, 180, 225, 270, 315];
  const k = r / 16;
  const hex = Array.from({ length: 6 }, (_, i) => turn([0, -9 * k], i * 60));
  return (
    <g opacity={faded ? 0.45 : 1}>
      <Bumps r={r} angles={bumps} shape={shape} s={s ?? 4 * k} fill={PAINT.virus.stroke} />
      <circle r={r} fill={PAINT.virus.fill} stroke={PAINT.virus.stroke} strokeWidth={1.8} />
      <path d={`M ${hex.map((p) => p.join(" ")).join(" L ")} Z`} fill="none" stroke={PAINT.virus.stroke} strokeWidth={1.3} strokeLinejoin="round" />
      <path d={`M ${f(-4 * k)} ${f(-3 * k)} q ${f(3 * k)} ${f(-3 * k)} ${f(4 * k)} ${f(1 * k)} t ${f(4 * k)} ${f(2 * k)}`} fill="none" stroke="var(--bio-u)" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

/** A rod-shaped bacterium seen from above (length 2·w, height 2·h). */
export function BacteriumRod({ w = 22, h = 10, flagellum = true, shape, spots = [-11, 0, 11] }: { w?: number; h?: number; flagellum?: boolean; shape?: Epitope; spots?: number[] }) {
  return (
    <g>
      {flagellum && <path d={`M ${w - 1} 0 c 8 -7 12 7 20 0 s 12 -7 18 0`} fill="none" stroke={PAINT.bact.stroke} strokeWidth={1.4} strokeLinecap="round" />}
      {shape &&
        spots.flatMap((x) => [
          <path key={`t${x}`} d={bumpPath(shape, 3.6)} transform={`translate(${x} ${-h + 0.5})`} fill={PAINT.bact.stroke} />,
          <path key={`b${x}`} d={bumpPath(shape, 3.6)} transform={`translate(${x} ${h - 0.5}) rotate(180)`} fill={PAINT.bact.stroke} />,
        ])}
      <rect x={-w} y={-h} width={2 * w} height={2 * h} rx={h} fill={PAINT.bact.fill} stroke={PAINT.bact.stroke} strokeWidth={1.8} />
      <path d={`M ${-w * 0.45} ${-h * 0.15} q ${w * 0.25} ${-h * 0.55} ${w * 0.45} 0 t ${w * 0.45} 0`} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} strokeLinecap="round" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Cells

/** Radius of a blob outline at angle t (radians). */
export function blobRadius(r: number, wobble: number[], t: number) {
  let k = 1;
  wobble.forEach((w, j) => (k += w * Math.sin((j + 2) * t + j * 1.7)));
  return r * k;
}

/** A smooth, slightly irregular closed outline around (0, 0). */
export function blobPath(r: number, wobble: number[], n = 48): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const k = blobRadius(r, wobble, t);
    pts.push([f(k * Math.cos(t)), f(k * Math.sin(t))]);
  }
  return `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;
}

export const MACRO_WOBBLE = [0.06, 0.05, 0.04];
export const BODY_WOBBLE = [0.03, 0.025, 0.02];

type CellProps = { r?: number; glow?: boolean; children?: ReactNode };

function Nucleus({ r, dx = 0, dy = 0, paint = "var(--bio-nucleus)", deep = "var(--bio-nucleus-deep)" }: { r: number; dx?: number; dy?: number; paint?: string; deep?: string }) {
  return <circle cx={dx} cy={dy} r={r} fill={paint} stroke={deep} strokeWidth={1.4} />;
}

/** Macrophage (Fresszelle): large, irregular, with a kidney-shaped nucleus and lysosomes. */
export function Macrophage({ r = 34, glow, children }: CellProps) {
  const k = r / 34;
  return (
    <g style={glow ? { filter: GLOW } : undefined}>
      <path d={blobPath(r, MACRO_WOBBLE)} fill={PAINT.macro.fill} stroke={PAINT.macro.stroke} strokeWidth={2} strokeLinejoin="round" />
      <path
        d={`M ${f(-14 * k)} ${f(-6 * k)} c ${f(4 * k)} ${f(-12 * k)} ${f(22 * k)} ${f(-12 * k)} ${f(24 * k)} ${f(2 * k)} c ${f(1 * k)} ${f(9 * k)} ${f(-8 * k)} ${f(13 * k)} ${f(-12 * k)} ${f(8 * k)} c ${f(-3 * k)} ${f(-3 * k)} ${f(-7 * k)} ${f(-2 * k)} ${f(-9 * k)} ${f(2 * k)} c ${f(-4 * k)} ${f(3 * k)} ${f(-6 * k)} ${f(-6 * k)} ${f(-3 * k)} ${f(-12 * k)} Z`}
        fill="var(--bio-nucleus)"
        stroke="var(--bio-nucleus-deep)"
        strokeWidth={1.4}
      />
      {[
        [-16, 14],
        [12, 16],
        [-4, 22],
        [20, -14],
      ].map(([x, y], i) => (
        <circle key={i} cx={f(x * k)} cy={f(y * k)} r={f(3.2 * k)} fill="var(--bio-mito-deep)" opacity={0.75} />
      ))}
      {children}
    </g>
  );
}

/** A lymphocyte: round, with a big round nucleus. */
function Lymphocyte({ r = 20, paint, glow, children, nucleus = 0.68 }: CellProps & { paint: Paint; nucleus?: number }) {
  return (
    <g style={glow ? { filter: GLOW } : undefined}>
      {children}
      <circle r={r} fill={paint.fill} fillOpacity={paint.fillOpacity} stroke={paint.stroke} strokeWidth={2} />
      <Nucleus r={f(r * nucleus)} dx={f(r * 0.06)} dy={f(r * 0.04)} />
    </g>
  );
}

/** Receptors standing out of a round cell, pointing outwards, with the cup at the end (T cell receptor). */
export function TReceptors({ r, shape, angles, color, s = 4 }: { r: number; shape: Epitope; angles: number[]; color: string; s?: number }) {
  const stalk = 4;
  return (
    <>
      {angles.map((t, i) => (
        <g key={i} transform={`rotate(${f(t - 90)})`}>
          <line x1={0} y1={r - 1} x2={0} y2={r + stalk} stroke={color} strokeWidth={2.2} />
          <path d={cupPath(shape, s)} transform={`translate(0 ${f(r + stalk + cupHeight(s))})`} fill={color} />
        </g>
      ))}
    </>
  );
}

/** Small antibodies standing in a cell's membrane, pointing outwards (B cell receptors). */
export function BReceptors({ r, shape, angles, s = 3.2 }: { r: number; shape: Epitope; angles: number[]; s?: number }) {
  return (
    <>
      {angles.map((t, i) => (
        <g key={i} transform={`rotate(${f(t + 90)}) translate(0 ${f(-(r + 5))})`}>
          <Antibody shape={shape} s={s} width={2.2} arm={7} stem={5} />
        </g>
      ))}
    </>
  );
}

const AROUND = [-90, -30, 30, 90, 150, 210];

export function THelper({ r = 20, shape = "tri", glow, angles = AROUND, s }: CellProps & { shape?: Epitope; angles?: number[]; s?: number }) {
  return (
    <Lymphocyte r={r} paint={PAINT.th} glow={glow}>
      <TReceptors r={r} shape={shape} angles={angles} color={PAINT.th.stroke} s={s} />
    </Lymphocyte>
  );
}

export function TKiller({ r = 20, shape = "tri", glow, angles = AROUND, s }: CellProps & { shape?: Epitope; angles?: number[]; s?: number }) {
  return (
    <Lymphocyte r={r} paint={PAINT.tk} glow={glow}>
      <TReceptors r={r} shape={shape} angles={angles} color={PAINT.tk.stroke} s={s} />
    </Lymphocyte>
  );
}

export function BCell({ r = 20, shape = "tri", glow, angles = AROUND, receptors = true, s }: CellProps & { shape?: Epitope; angles?: number[]; receptors?: boolean; s?: number }) {
  return (
    <Lymphocyte r={r} paint={PAINT.b} glow={glow}>
      {receptors && <BReceptors r={r} shape={shape} angles={angles} s={s} />}
    </Lymphocyte>
  );
}

/** Memory cell (Gedächtniszelle): a small lymphocyte with a double outline. */
export function MemoryCell({ r = 15, glow, shape, kind = "b" }: CellProps & { shape?: Epitope; kind?: "b" | "t" }) {
  return (
    <g style={glow ? { filter: GLOW } : undefined}>
      {shape && kind === "b" && <BReceptors r={r} shape={shape} angles={[-90, 30, 150]} s={3.2} />}
      {shape && kind === "t" && <TReceptors r={r} shape={shape} angles={[-90, 30, 150]} color={PAINT.mem.stroke} s={3.4} />}
      <circle r={r + 3} fill="none" stroke={PAINT.mem.stroke} strokeWidth={1.2} strokeDasharray="2 2.5" />
      <circle r={r} fill={PAINT.mem.fill} stroke={PAINT.mem.stroke} strokeWidth={2} />
      <circle cx={f(r * 0.05)} cy={f(r * 0.05)} r={f(r * 0.62)} fill={PAINT.mem.stroke} opacity={0.4} />
    </g>
  );
}

/** Plasma cell: bigger and oval, nucleus off to one side, packed with rough ER (antibody factory). */
export function PlasmaCell({ r = 24, glow }: CellProps) {
  const k = r / 24;
  return (
    <g style={glow ? { filter: GLOW } : undefined}>
      <ellipse rx={f(r * 1.15)} ry={r} fill={PAINT.b.fill} stroke={PAINT.b.stroke} strokeWidth={2} />
      {[-9, -3, 3, 9].map((y, i) => (
        <path key={i} d={`M ${f(-4 * k)} ${f(y * k)} q ${f(7 * k)} ${f(-3 * k)} ${f(14 * k)} 0 t ${f(10 * k)} 0`} fill="none" stroke={PAINT.b.stroke} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="1 2.4" />
      ))}
      <Nucleus r={f(10 * k)} dx={f(-14 * k)} dy={f(2 * k)} />
    </g>
  );
}

/** A body cell (Körperzelle) with nucleus; optionally infected (viruses inside). */
export function BodyCell({ r = 30, infected, dying, glow, children }: CellProps & { infected?: boolean; dying?: boolean }) {
  const k = r / 30;
  return (
    <g style={glow ? { filter: GLOW } : undefined} opacity={dying ? 0.55 : 1}>
      <path d={blobPath(r, BODY_WOBBLE)} fill={PAINT.body.fill} stroke={PAINT.body.stroke} strokeWidth={2} strokeDasharray={dying ? "5 4" : undefined} />
      <Nucleus r={f(10 * k)} dx={f(-6 * k)} dy={f(-4 * k)} />
      {infected &&
        [
          [10, 10],
          [14, -8],
          [-2, 15],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${f(x * k)} ${f(y * k)}) scale(${f(0.28 * k)})`}>
            <VirusParticle />
          </g>
        ))}
      {children}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Names (legends, chips)

export type CellKind = "macro" | "th" | "tk" | "b" | "plasma" | "mem" | "body" | "virus" | "ab" | "bact";
export const CELL_NAMES: Record<CellKind, Text> = {
  macro: tx("Macrophage (phagocyte)", "Makrophage (Fresszelle)"),
  th: tx("T helper cell", "T-Helferzelle"),
  tk: tx("T killer cell", "T-Killerzelle"),
  b: tx("B cell", "B-Zelle"),
  plasma: tx("Plasma cell", "Plasmazelle"),
  mem: tx("Memory cell", "Gedächtniszelle"),
  body: tx("Body cell", "Körperzelle"),
  virus: tx("Virus with antigens", "Virus mit Antigenen"),
  ab: tx("Antibody", "Antikörper"),
  bact: tx("Bacterium", "Bakterium"),
};

/** A tiny picture of a cell type, for legends. */
export function CellIcon({ kind, size = 22 }: { kind: CellKind; size?: number }) {
  const inner: Record<CellKind, ReactNode> = {
    macro: <Macrophage r={21} />,
    th: <THelper r={11} angles={[-90, 30, 150]} />,
    tk: <TKiller r={11} angles={[-90, 30, 150]} />,
    b: <BCell r={10} angles={[-90, 30, 150]} />,
    plasma: <PlasmaCell r={18} />,
    mem: <MemoryCell r={14} />,
    body: <BodyCell r={22} />,
    virus: <VirusParticle r={16} />,
    ab: (
      <g transform="translate(0 3) scale(1.35)">
        <Antibody shape="tri" s={3.6} />
      </g>
    ),
    bact: (
      <g transform="translate(-8 0)">
        <BacteriumRod w={14} h={8} flagellum />
      </g>
    ),
  };
  return (
    <svg viewBox="-26 -26 52 52" width={size} height={size} aria-hidden className="shrink-0 overflow-visible">
      {inner[kind]}
    </svg>
  );
}
