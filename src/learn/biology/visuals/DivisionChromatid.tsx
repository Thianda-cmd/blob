"use client";
import { cos, sin } from "@/lib/stableMath";

// Chromosome drawing for the "cell-division" topic. A chromatid is two arms (short p arm and
// long q arm) that meet at the centromere, where the chromatid is pinched. Arms are stroked
// paths with round caps, so a straight arm looks like a capsule and a decondensed arm can
// wiggle like a thread of chromatin. Two sister chromatids side by side make the familiar X.

/** Colours of the two homologous sets: maternal red, paternal blue (as in German textbooks). */
export const PARENT_FILL = ["var(--bio-blood)", "var(--bio-blood-low)"] as const;

/** The model chromosome pairs (condensed length in viewBox units, share of the short p arm). */
export const PAIRS = [
  { len: 40, cf: 0.42, swapAt: 0.5 },
  { len: 24, cf: 0.33, swapAt: 0.42 },
  { len: 31, cf: 0.2, swapAt: 0.55 },
  { len: 18, cf: 0.4, swapAt: 0.45 },
] as const;

export type ChromatidProps = {
  /** Centromere. */
  x: number;
  y: number;
  /** Directions of the p arm and the q arm in degrees (0 = right, 90 = down). */
  pa: number;
  qa: number;
  /** Condensed length and the share of the p arm. */
  len: number;
  cf: number;
  /** 0 = long thin chromatin thread (interphase), 1 = fully condensed. */
  cond: number;
  fill: string;
  /** Crossing-over: the tip of the q arm (from `swapAt`) is drawn in `other`, with opacity `swap`. */
  other?: string;
  swap?: number;
  swapAt?: number;
  /** Phase of the thread's wiggle (keep sisters equal so they run in parallel). */
  seed?: number;
  opacity?: number;
  /** Thin bands: negative values sit on the p arm (share of it), positive on the q arm. */
  bands?: number[];
  /** Thicker drawing for figures. */
  scale?: number;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** The points of one arm, from near the centromere to its tip. */
function armPoints(x: number, y: number, angle: number, start: number, length: number, amp: number, seed: number) {
  const ux = cos(rad(angle));
  const uy = sin(rad(angle));
  const vx = -uy;
  const vy = ux;
  const pts: [number, number][] = [];
  const steps = Math.max(2, Math.ceil(length / (amp > 0.3 ? 1.6 : length)));
  for (let i = 0; i <= steps; i++) {
    const s = (length * i) / steps;
    const env = Math.min(1, s / 5);
    const off = amp * env * (0.75 * sin((2 * Math.PI * s) / 8 + seed) + 0.35 * sin((2 * Math.PI * s) / 3.1 + 2.3 * seed));
    pts.push([x + ux * (start + s) + vx * off, y + uy * (start + s) + vy * off]);
  }
  return pts;
}

const pathOf = (pts: [number, number][]) => pts.map(([px, py], i) => `${i ? "L" : "M"}${r1(px)} ${r1(py)}`).join("");

export function Chromatid({ x, y, pa, qa, len, cf, cond, fill, other, swap = 0, swapAt = 0.5, seed = 0, opacity = 1, bands, scale = 1 }: ChromatidProps) {
  if (opacity <= 0.01) return null;
  const c = Math.min(1, Math.max(0, cond));
  // Decondensed chromatin is longer, thinner and wiggles.
  const stretch = 1 + 0.42 * (1 - c);
  const amp = 3.4 * (1 - c) * (1 - c);
  const w = (1.9 + 4.2 * c) * scale;
  const gap = (0.6 + 1.6 * c) * scale;
  const pLen = Math.max(1.5, len * cf * stretch - gap);
  const qLen = Math.max(1.5, len * (1 - cf) * stretch - gap);
  const p = armPoints(x, y, pa, gap, pLen, amp, seed);
  const q = armPoints(x, y, qa, gap, qLen, amp, seed + 1.7);
  const waist = `M${r1(p[0][0])} ${r1(p[0][1])}L${r1(x)} ${r1(y)}L${r1(q[0][0])} ${r1(q[0][1])}`;
  const arms = `${pathOf(p)}${pathOf(q)}`;
  const outline = 0.35 + 0.65 * c;
  const k = Math.round(q.length * swapAt);
  const tip = swap > 0.01 && other ? pathOf(q.slice(Math.min(k, q.length - 2))) : null;
  const band = (b: number) => {
    const onQ = b > 0;
    const ang = rad(onQ ? qa : pa);
    const d = gap + Math.abs(b) * (onQ ? qLen : pLen);
    const bx = x + cos(ang) * d;
    const by = y + sin(ang) * d;
    const nx = -sin(ang) * w * 0.5;
    const ny = cos(ang) * w * 0.5;
    return `M${r1(bx - nx)} ${r1(by - ny)}L${r1(bx + nx)} ${r1(by + ny)}`;
  };
  return (
    <g opacity={opacity}>
      <path d={arms} fill="none" stroke="var(--bio-outline)" strokeOpacity={outline} strokeWidth={w + 2.2 * scale} strokeLinecap="round" strokeLinejoin="round" />
      <path d={waist} fill="none" stroke="var(--bio-outline)" strokeOpacity={outline} strokeWidth={w * 0.55 + 2.2 * scale} strokeLinecap="round" strokeLinejoin="round" />
      <path d={arms} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d={waist} fill="none" stroke={fill} strokeWidth={w * 0.55} strokeLinecap="round" strokeLinejoin="round" />
      {tip && <path d={tip} fill="none" stroke={other} strokeOpacity={Math.min(1, swap)} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />}
      {bands?.map((b, i) => (
        <path key={i} d={band(b)} stroke="var(--bio-outline)" strokeOpacity={0.55 * c} strokeWidth={1.3 * scale} />
      ))}
    </g>
  );
}

/**
 * A whole chromosome: one chromatid, or two sister chromatids joined at the centromere.
 * `angle` is the direction of the p arm; the sisters sit side by side across it.
 */
export function Chromosome({
  x,
  y,
  angle = 270,
  pair = 0,
  parent = 0,
  chromatids = 2,
  cond = 1,
  scale = 1,
  bands,
  swap,
  len,
}: {
  x: number;
  y: number;
  angle?: number;
  pair?: number;
  parent?: 0 | 1;
  chromatids?: 1 | 2;
  cond?: number;
  scale?: number;
  bands?: number[];
  /** Crossing-over on the inner chromatid: which sister (-1 or 1) carries the other colour. */
  swap?: -1 | 1;
  len?: number;
}) {
  const spec = PAIRS[pair];
  const L = (len ?? spec.len) * scale;
  const fill = PARENT_FILL[parent];
  const other = PARENT_FILL[1 - parent];
  if (chromatids === 1) return <Chromatid x={x} y={y} pa={angle} qa={angle + 180} len={L} cf={spec.cf} cond={cond} fill={fill} bands={bands} scale={scale} />;
  const d = 2.9 * scale;
  const nx = cos(rad(angle + 90));
  const ny = sin(rad(angle + 90));
  return (
    <g>
      {[-1, 1].map((s) => (
        <Chromatid
          key={s}
          x={x + s * d * nx}
          y={y + s * d * ny}
          pa={angle + s * 7}
          qa={angle + 180 - s * 7}
          len={L}
          cf={spec.cf}
          cond={cond}
          fill={fill}
          other={other}
          swap={swap === s ? 1 : 0}
          swapAt={spec.swapAt}
          bands={bands}
          scale={scale}
        />
      ))}
    </g>
  );
}
