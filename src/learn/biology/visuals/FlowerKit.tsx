"use client";

import type { ReactNode } from "react";

// Shared drawing pieces for the topic "flowers-seeds": the cherry blossom in longitudinal
// section (used by the labelled figure, the pollination widget and the flower-to-fruit
// morph), a stamen, a tube-like stroke and the bee. Colours only from the biology palette.

/** Mirror a left-hand shape to the right side of a drawing that is `w` wide. */
export const mirror = (w = 480) => `translate(${w} 0) scale(-1 1)`;

/** A line drawn as a thin tube: an outline stroke with a lighter core. */
export function Tube({ d, w = 4, core = "var(--bio-cell)", edge = "var(--bio-outline)", className }: { d: string; w?: number; core?: string; edge?: string; className?: string }) {
  return (
    <g className={className}>
      <path d={d} fill="none" stroke={edge} strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke={core} strokeWidth={Math.max(1, w - 2.2)} strokeLinecap="round" />
    </g>
  );
}

/** Two pollen sacs on top of a filament end, tilted by `angle` degrees. */
export function Anther({ x, y, angle = 0, scale = 1, empty = false }: { x: number; y: number; angle?: number; scale?: number; empty?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <ellipse cx={-3.3} cy={-6.5} rx={3.9} ry={7.6} fill={empty ? "var(--bio-bone)" : "var(--bio-pollen)"} stroke="var(--bio-outline)" strokeWidth={1.2} />
      <ellipse cx={3.3} cy={-6.5} rx={3.9} ry={7.6} fill={empty ? "var(--bio-bone)" : "var(--bio-pollen)"} stroke="var(--bio-outline)" strokeWidth={1.2} />
      <line x1={0} y1={-13} x2={0} y2={0} stroke="var(--bio-outline)" strokeWidth={0.9} opacity={0.6} />
    </g>
  );
}

/** A pollen grain: a small round grain with a sculptured rim. */
export function PollenGrain({ x, y, r = 2.4 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={0.8} />;
}

// ---------------------------------------------------------------------------
// The cherry blossom (Prunus), longitudinal section, viewBox 480 × 360.
// Cup-shaped receptacle (Blütenboden / Blütenbecher) with nectar on its inner side, reflexed
// sepals, five petals (two seen in section), many stamens on the rim and one carpel with a
// superior ovary that holds the ovule.

export const CHERRY = {
  petal: "M 187 186 C 166 183, 132 181, 103 167 C 68 150, 54 116, 69 93 C 84 71, 119 75, 143 99 C 165 121, 180 156, 190 184 Z",
  petalVeins: ["M 188 182 C 160 160, 116 128, 84 104", "M 188 182 C 154 170, 118 156, 88 138", "M 188 182 C 166 150, 138 112, 112 90"],
  sepal: "M 185 194 C 171 198, 152 214, 134 244 C 152 237, 172 226, 189 211 Z",
  cup: "M 180 184 C 182 230, 207 262, 240 262 C 273 262, 298 230, 300 184 L 290 184 C 288 222, 267 252, 240 252 C 213 252, 192 222, 190 184 Z",
  nectar: "M 193.5 192 C 196 224, 215 248, 240 248 C 265 248, 284 224, 286.5 192",
  stalk: "M 240 262 C 239 292, 236 324, 232 356",
  style: "M 236.3 202 L 237 100 L 243 100 L 243.7 202 Z",
  ovary: { cx: 240, cy: 226, rx: 21, ry: 26 },
  locule: { cx: 240, cy: 226, rx: 12.5, ry: 17 },
  ovule: { cx: 240, cy: 228, rx: 7, ry: 10 },
  stigma: { cx: 240, cy: 95, rx: 10.5, ry: 6.5 },
  /** Left filaments: [path, anther x, y, angle]. The right side is mirrored. */
  stamens: [
    ["M 185 185 Q 172 150 164 114", 164, 114, -12],
    ["M 188 185 Q 186 146 188 100", 188, 100, 2],
    ["M 190 186 Q 202 154 212 120", 212, 120, 16],
  ] as [string, number, number, number][],
  pollen: [
    [151, 99],
    [158, 88],
    [204, 104],
    [325, 96],
    [334, 108],
  ] as [number, number][],
};

/** Group helper: a `data-part` group (for Figure highlighting) or a plain group. */
export function Part({ id, children, part = true }: { id: string; children: ReactNode; part?: boolean }) {
  return part ? <g data-part={id}>{children}</g> : <g>{children}</g>;
}

export function CherryPetals({ part = true }: { part?: boolean }) {
  const one = (
    <>
      <path d={CHERRY.petal} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.8} strokeLinejoin="round" />
      {CHERRY.petalVeins.map((d) => (
        <path key={d} d={d} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1} opacity={0.45} strokeLinecap="round" />
      ))}
    </>
  );
  const back = <path d={CHERRY.petal} transform="rotate(34 188 184)" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.4} opacity={0.5} />;
  return (
    <Part id="petal" part={part}>
      {back}
      <g transform={mirror()}>{back}</g>
      {one}
      <g transform={mirror()}>{one}</g>
    </Part>
  );
}

export function CherrySepals({ part = true }: { part?: boolean }) {
  const one = <path d={CHERRY.sepal} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} strokeLinejoin="round" />;
  return (
    <Part id="sepal" part={part}>
      {one}
      <g transform={mirror()}>{one}</g>
    </Part>
  );
}

export function CherryStalk({ part = true }: { part?: boolean }) {
  return (
    <Part id="stalk" part={part}>
      <Tube d={CHERRY.stalk} w={10} core="var(--bio-leaf)" edge="var(--bio-leaf-deep)" />
    </Part>
  );
}

export function CherryCup({ part = true }: { part?: boolean }) {
  return (
    <Part id="receptacle" part={part}>
      <path d={CHERRY.cup} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={1.8} strokeLinejoin="round" />
    </Part>
  );
}

export function CherryNectar({ part = true }: { part?: boolean }) {
  return (
    <Part id="nectar" part={part}>
      <path d={CHERRY.nectar} fill="none" stroke="var(--bio-sun)" strokeWidth={4.5} strokeLinecap="round" opacity={0.95} />
      <circle cx={205} cy={226} r={3} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
      <circle cx={276} cy={222} r={2.6} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
      <circle cx={211} cy={236} r={2.2} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
    </Part>
  );
}

export function CherryOvary({ part = true }: { part?: boolean }) {
  const { ovary: o, locule: l } = CHERRY;
  return (
    <Part id="ovary" part={part}>
      <ellipse {...o} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      <ellipse {...l} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
    </Part>
  );
}

export function CherryOvule({ part = true }: { part?: boolean }) {
  const { ovule: v } = CHERRY;
  return (
    <Part id="ovule" part={part}>
      <line x1={240} y1={209} x2={240} y2={219} stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
      <ellipse {...v} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
      <circle cx={240} cy={232} r={2.4} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={0.8} />
    </Part>
  );
}

export function CherryStyle({ part = true }: { part?: boolean }) {
  return (
    <Part id="style" part={part}>
      <path d={CHERRY.style} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} strokeLinejoin="round" />
    </Part>
  );
}

export function CherryStigma({ part = true }: { part?: boolean }) {
  const s = CHERRY.stigma;
  return (
    <Part id="stigma" part={part}>
      <ellipse {...s} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
      {[-7, -3.5, 0, 3.5, 7].map((dx) => (
        <circle key={dx} cx={240 + dx} cy={s.cy - s.ry + 1.4 + Math.abs(dx) * 0.28} r={1.5} fill="var(--bio-leaf-deep)" opacity={0.75} />
      ))}
    </Part>
  );
}

/** Filaments (and optionally the anthers) of all six stamens shown in the section. */
export function CherryStamens({ part = true, anthers = true, filaments = true }: { part?: boolean; anthers?: boolean; filaments?: boolean }) {
  const side = (
    <>
      {filaments && (
        <Part id="filament" part={part}>
          {CHERRY.stamens.map(([d]) => (
            <Tube key={d} d={d} w={3.6} />
          ))}
        </Part>
      )}
      {anthers && (
        <Part id="anther" part={part}>
          {CHERRY.stamens.map(([d, x, y, a]) => (
            <Anther key={d} x={x} y={y} angle={a} />
          ))}
        </Part>
      )}
    </>
  );
  return (
    <>
      {side}
      <g transform={mirror()}>{side}</g>
    </>
  );
}

export function CherryPollen({ part = true }: { part?: boolean }) {
  return (
    <Part id="pollen" part={part}>
      {CHERRY.pollen.map(([x, y]) => (
        <PollenGrain key={`${x}-${y}`} x={x} y={y} />
      ))}
    </Part>
  );
}

/** The whole cherry blossom in section (static). */
export function CherryFlower({ part = true }: { part?: boolean }) {
  return (
    <>
      <CherryPetals part={part} />
      <CherrySepals part={part} />
      <CherryStalk part={part} />
      <CherryCup part={part} />
      <CherryNectar part={part} />
      <CherryOvary part={part} />
      <CherryOvule part={part} />
      <CherryStyle part={part} />
      <CherryStigma part={part} />
      <CherryStamens part={part} />
      <CherryPollen part={part} />
    </>
  );
}

// ---------------------------------------------------------------------------
// A friendly, schematic honey bee (about 64 × 48 units, centred on 0,0, facing right).

export function Bee({ pollen = 0 }: { pollen?: number }) {
  return (
    <g>
      {/* wings */}
      <ellipse cx={-6} cy={-15} rx={11} ry={7} transform="rotate(-25 -6 -15)" fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} opacity={0.9} />
      <ellipse cx={4} cy={-16} rx={10} ry={6.5} transform="rotate(20 4 -16)" fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} opacity={0.9} />
      {/* legs */}
      {[-8, -2, 4].map((x) => (
        <line key={x} x1={x} y1={8} x2={x - 3} y2={15} stroke="var(--bio-outline)" strokeWidth={1.4} strokeLinecap="round" />
      ))}
      {/* body */}
      <ellipse cx={-4} cy={0} rx={15} ry={10} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.6} />
      <path d="M -10 -9.2 Q -7 0 -10 9.2" fill="none" stroke="var(--bio-outline)" strokeWidth={3.2} />
      <path d="M -3 -10 Q 0 0 -3 10" fill="none" stroke="var(--bio-outline)" strokeWidth={3.2} />
      <path d="M -17.5 -4 L -22 0 L -17.5 4 Z" fill="var(--bio-outline)" />
      {/* head */}
      <circle cx={13} cy={-1} r={7} fill="var(--bio-outline)" />
      <circle cx={15.5} cy={-3} r={1.6} fill="var(--raised)" />
      <path d="M 16 -7 Q 19 -14 24 -15" fill="none" stroke="var(--bio-outline)" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M 13 -7.5 Q 14 -15 18 -18" fill="none" stroke="var(--bio-outline)" strokeWidth={1.3} strokeLinecap="round" />
      {/* pollen in the fur and on the legs */}
      {pollen > 0 && (
        <g>
          <circle cx={-6} cy={12} r={3.4} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={0.8} />
          {[
            [-12, -4],
            [-1, 5],
            [6, -6],
            [-15, 4],
            [2, -2],
          ]
            .slice(0, Math.min(5, pollen))
            .map(([x, y]) => (
              <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={0.6} />
            ))}
        </g>
      )}
    </g>
  );
}
