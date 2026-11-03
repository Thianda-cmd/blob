// Paths through points on screen: straight segments, or a smooth curve that never overshoots
// the data (a monotone cubic, like d3's curveMonotoneX) when x only grows, and a Catmull-Rom
// curve through the points in their order otherwise (a scatter line that turns back).

export type Pt = { x: number; y: number };

const r = (v: number) => Math.round(v * 100) / 100;

/** "M x y L x y …" through the points. */
export function linePath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${r(p.x)} ${r(p.y)}`).join("");
}

const sign = (v: number) => (v < 0 ? -1 : 1);

/** Fritsch–Carlson style tangents (as in d3's monotoneX): no bumps between points. */
function monotoneTangents(pts: Pt[]): number[] {
  const n = pts.length;
  const t = new Array<number>(n).fill(0);
  if (n < 2) return t;
  const slope = (i: number) => (pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x);
  for (let i = 1; i < n - 1; i++) {
    const h0 = pts[i].x - pts[i - 1].x;
    const h1 = pts[i + 1].x - pts[i].x;
    const s0 = slope(i - 1);
    const s1 = slope(i);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    t[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  // The ends: a parabola through the end point and its neighbour's tangent.
  t[0] = n > 2 ? (3 * slope(0) - t[1]) / 2 : slope(0);
  t[n - 1] = n > 2 ? (3 * slope(n - 2) - t[n - 2]) / 2 : slope(n - 2);
  return t;
}

/** A monotone cubic through points whose x strictly grows. */
export function monotonePath(pts: Pt[]): string {
  if (pts.length < 3) return linePath(pts);
  const t = monotoneTangents(pts);
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = (b.x - a.x) / 3;
    d += `C${r(a.x + dx)} ${r(a.y + dx * t[i])} ${r(b.x - dx)} ${r(b.y - dx * t[i + 1])} ${r(b.x)} ${r(b.y)}`;
  }
  return d;
}

/** A Catmull-Rom curve through the points in their order (as cubic Béziers). */
export function catmullRomPath(pts: Pt[]): string {
  if (pts.length < 3) return linePath(pts);
  let d = `M${r(pts[0].x)} ${r(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${r(p1.x + (p2.x - p0.x) / 6)} ${r(p1.y + (p2.y - p0.y) / 6)} ${r(p2.x - (p3.x - p1.x) / 6)} ${r(p2.y - (p3.y - p1.y) / 6)} ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

/** A smooth line: monotone when x only grows (left to right on screen), Catmull-Rom otherwise. */
export function smoothPath(pts: Pt[]): string {
  const increasing = pts.every((p, i) => i === 0 || p.x > pts[i - 1].x);
  return increasing ? monotonePath(pts) : catmullRomPath(pts);
}
