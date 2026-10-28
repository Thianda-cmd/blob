// The shape of a stroke: a smooth centre line through its points (centripetal Catmull-Rom), and
// around it the outline of the union of a circle at every point (its radius is half the line's
// width there). The outline is one closed path whose every part winds the same way, so filling it
// with the nonzero rule covers the whole stroke, also where it crosses itself or turns sharply, and
// leaves the inside of loops ("o", "e") open. See scripts/check-ink.ts.

import type { Box } from "./model";

/** Where paths are drawn: a Path2D, or the PDF and SVG writers. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  /** Like CanvasPath.arc: from angle a0 to a1 (radians, clockwise on screen), `ccw` the other way. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  closePath(): void;
}

/** A dense centre line: points and radii. */
export type Line = { x: Float64Array; y: Float64Array; r: Float64Array; n: number };

/** Longest straight piece of a smoothed line (units) and the most it may turn (radians). */
const MAX_LEN = 3;
const MAX_TURN = 0.12;
const MAX_STEPS = 24;

export function strokeBox(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) {
    const r = ws[i] / 2 + 1;
    if (xs[i] - r < x0) x0 = xs[i] - r;
    if (ys[i] - r < y0) y0 = ys[i] - r;
    if (xs[i] + r > x1) x1 = xs[i] + r;
    if (ys[i] + r > y1) y1 = ys[i] + r;
  }
  return { x0, y0, x1, y1 };
}

/**
 * The centre line through the points. Smoothed (a centripetal Catmull-Rom spline, so it never
 * loops or overshoots between close points), or straight between them (shapes).
 */
export function centerline(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>, smooth = true): Line {
  const n = xs.length;
  if (!smooth || n < 3) {
    const line = alloc(Math.max(n, 1));
    for (let i = 0; i < n; i++) push(line, xs[i], ys[i], ws[i] / 2);
    return line;
  }
  // Count first, so the arrays are allocated once.
  const steps = new Uint8Array(n - 1);
  let total = 1;
  for (let i = 0; i < n - 1; i++) {
    const k = stepsFor(xs, ys, i, n);
    steps[i] = k;
    total += k;
  }
  const line = alloc(total);
  for (let i = 0; i < n - 1; i++) {
    const k = steps[i];
    const x1 = xs[i];
    const y1 = ys[i];
    const x2 = xs[i + 1];
    const y2 = ys[i + 1];
    const r1 = ws[i] / 2;
    const r2 = ws[i + 1] / 2;
    if (k === 0) continue;
    if (k === 1) {
      push(line, x1, y1, r1);
      continue;
    }
    // Neighbours; past the ends, the end point mirrored.
    const x0 = i > 0 ? xs[i - 1] : 2 * x1 - x2;
    const y0 = i > 0 ? ys[i - 1] : 2 * y1 - y2;
    const x3 = i + 2 < n ? xs[i + 2] : 2 * x2 - x1;
    const y3 = i + 2 < n ? ys[i + 2] : 2 * y2 - y1;
    const d01 = Math.max(Math.sqrt(Math.hypot(x1 - x0, y1 - y0)), 1e-6);
    const d12 = Math.max(Math.sqrt(Math.hypot(x2 - x1, y2 - y1)), 1e-6);
    const d23 = Math.max(Math.sqrt(Math.hypot(x3 - x2, y3 - y2)), 1e-6);
    // Tangents at both ends (centripetal parametrisation), scaled to the unit interval.
    const m1x = x2 - x1 + d12 * ((x1 - x0) / d01 - (x2 - x0) / (d01 + d12));
    const m1y = y2 - y1 + d12 * ((y1 - y0) / d01 - (y2 - y0) / (d01 + d12));
    const m2x = x2 - x1 + d12 * ((x3 - x2) / d23 - (x3 - x1) / (d12 + d23));
    const m2y = y2 - y1 + d12 * ((y3 - y2) / d23 - (y3 - y1) / (d12 + d23));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      push(line, h00 * x1 + h10 * m1x + h01 * x2 + h11 * m2x, h00 * y1 + h10 * m1y + h01 * y2 + h11 * m2y, r1 + (r2 - r1) * t);
    }
  }
  push(line, xs[n - 1], ys[n - 1], ws[n - 1] / 2);
  return line;
}

/** How many straight pieces the curve between points i and i+1 gets (0: the points are the same). */
function stepsFor(xs: ArrayLike<number>, ys: ArrayLike<number>, i: number, n: number): number {
  const dx = xs[i + 1] - xs[i];
  const dy = ys[i + 1] - ys[i];
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return 0;
  // How much the direction changes around this piece (before it and after it).
  let turn = 0;
  if (i > 0) turn += angleBetween(xs[i] - xs[i - 1], ys[i] - ys[i - 1], dx, dy);
  if (i + 2 < n) turn += angleBetween(dx, dy, xs[i + 2] - xs[i + 1], ys[i + 2] - ys[i + 1]);
  return Math.min(MAX_STEPS, Math.max(1, Math.ceil(len / MAX_LEN), Math.ceil(turn / 2 / MAX_TURN)));
}

function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-9 || lb < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
}

function alloc(cap: number): Line {
  return { x: new Float64Array(cap), y: new Float64Array(cap), r: new Float64Array(cap), n: 0 };
}

function push(line: Line, x: number, y: number, r: number) {
  if (line.n >= line.x.length) {
    const cap = Math.max(8, line.x.length * 2);
    const grow = (a: Float64Array) => {
      const b = new Float64Array(cap);
      b.set(a);
      return b;
    };
    line.x = grow(line.x);
    line.y = grow(line.y);
    line.r = grow(line.r);
  }
  line.x[line.n] = x;
  line.y[line.n] = y;
  line.r[line.n] = Math.max(r, 0.05);
  line.n++;
}

/**
 * The outline of the union of the line's circles (and the hull between each two neighbours). Pieces
 * of the line are joined into runs, each one closed path: the start's round end, one side forward,
 * the far end, the other side back. Where two pieces of a side meet, their edges either overlap
 * (they end at their crossing point) or leave a gap (filled by the circle between them). Where a
 * side would fold back on itself, or one circle holds the next, a new run starts. Every run winds
 * the same way and never folds, so the nonzero fill covers exactly the union, loops stay open.
 */
export function outline(line: Line, sink: PathSink): void {
  const { x, y, r } = line;
  const n = line.n;
  if (!n) return;
  let run: Run | null = null;
  /** The last circle drawn on its own (pieces where one circle holds the other). */
  let drawn = -1;
  for (let i = 0; i < n - 1; i++) {
    const j = i + 1;
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    const d = Math.hypot(dx, dy);
    if (d + Math.min(r[i], r[j]) <= Math.max(r[i], r[j]) + 1e-9) {
      // This piece is just its bigger circle.
      const big = r[i] >= r[j] ? i : j;
      if (run) {
        finish(run, line, sink);
        if (big === run.last.j) drawn = big;
        run = null;
      }
      if (drawn !== big) {
        circle(sink, x[big], y[big], r[big]);
        drawn = big;
      }
      continue;
    }
    const theta = Math.atan2(dy, dx);
    const phi = Math.acos(Math.max(-1, Math.min(1, (r[i] - r[j]) / d)));
    const seg: Seg = { i, j, aL: theta + phi, aR: theta - phi, phi };
    if (run && extend(run, seg, line)) continue;
    if (run) finish(run, line, sink);
    run = { first: seg, last: seg, left: [], right: [], uL: 0, uR: 0 };
  }
  if (run) finish(run, line, sink);
  else if (n === 1 || drawn < 0) circle(sink, x[0], y[0], r[0]);
}

/** A piece of the line between circles i and j = i + 1, and the angles of its tangent points. */
type Seg = { i: number; j: number; aL: number; aR: number; phi: number };

/** A side's way forward: a line to a point, or along a circle. */
type Op = { arc: false; x: number; y: number } | { arc: true; cx: number; cy: number; r: number; a0: number; a1: number; ccw: boolean; x: number; y: number };

type Run = {
  first: Seg;
  last: Seg;
  /** The sides after the start: left (aL) forward from the first piece's start, right (aR) the same. */
  left: Op[];
  right: Op[];
  /** Where the sides are now on the last piece's edges (0 at its start, 1 at its end). */
  uL: number;
  uR: number;
};

const norm = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

/** One side of a piece: its straight edge from circle i to circle j. */
function edge(line: Line, s: Seg, a: number): [number, number, number, number] {
  const { x, y, r } = line;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return [x[s.i] + r[s.i] * c, y[s.i] + r[s.i] * sn, x[s.j] + r[s.j] * c, y[s.j] + r[s.j] * sn];
}

/** How one side gets from the last piece to the next at their shared circle; null where it would fold. */
function joinSide(line: Line, prev: Seg, seg: Seg, left: boolean, u0: number): { ops: Op[]; u: number } | null {
  const a0 = left ? prev.aL : prev.aR;
  const a1 = left ? seg.aL : seg.aR;
  const turn = norm(a1 - a0);
  const [p0x, p0y, p1x, p1y] = edge(line, prev, a0);
  const [q0x, q0y, q1x, q1y] = edge(line, seg, a1);
  if (Math.abs(turn) < 1e-9) return { ops: [{ arc: false, x: q0x, y: q0y }], u: 0 };
  // Left side: the tangent point moves back (turn > 0) when the edges overlap; the right side mirrors it.
  const overlap = left ? turn > 0 : turn < 0;
  if (!overlap) {
    // A gap: around the shared circle, as long as both pieces leave that arc open.
    if (Math.abs(turn) >= Math.min(2 * prev.phi, 2 * Math.PI - 2 * seg.phi) - 1e-9) return null;
    const c = seg.i;
    return {
      ops: [
        { arc: false, x: p1x, y: p1y },
        { arc: true, cx: line.x[c], cy: line.y[c], r: line.r[c], a0, a1, ccw: left, x: q0x, y: q0y },
      ],
      u: 0,
    };
  }
  // The edges cross: the side turns at the crossing, which must lie on both edges (after where the
  // side already is on the last one).
  const ex = p1x - p0x;
  const ey = p1y - p0y;
  const fx = q1x - q0x;
  const fy = q1y - q0y;
  const den = ex * fy - ey * fx;
  if (Math.abs(den) < 1e-12) return null;
  const u = ((q0x - p0x) * fy - (q0y - p0y) * fx) / den;
  const v = ((q0x - p0x) * ey - (q0y - p0y) * ex) / den;
  if (!(u > u0 + 1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v < 1 - 1e-9)) return null;
  return { ops: [{ arc: false, x: p0x + u * ex, y: p0y + u * ey }], u: Math.max(0, v) };
}

/** Adds the piece to the run, unless a side would fold there. */
function extend(run: Run, seg: Seg, line: Line): boolean {
  const l = joinSide(line, run.last, seg, true, run.uL);
  if (!l) return false;
  const rt = joinSide(line, run.last, seg, false, run.uR);
  if (!rt) return false;
  run.left.push(...l.ops);
  run.right.push(...rt.ops);
  run.uL = l.u;
  run.uR = rt.u;
  run.last = seg;
  return true;
}

function finish(run: Run, line: Line, sink: PathSink) {
  const { x, y, r } = line;
  const f = run.first;
  const l = run.last;
  const [r0x, r0y] = edge(line, f, f.aR);
  sink.moveTo(r0x, r0y);
  // The start: round, around the back.
  sink.arc(x[f.i], y[f.i], r[f.i], f.aR, f.aL, true);
  for (const op of run.left) {
    if (op.arc) sink.arc(op.cx, op.cy, op.r, op.a0, op.a1, op.ccw);
    else sink.lineTo(op.x, op.y);
  }
  const [, , l1x, l1y, ] = edge(line, l, l.aL);
  sink.lineTo(l1x, l1y);
  // The end: round, around the front.
  sink.arc(x[l.j], y[l.j], r[l.j], l.aL, l.aR, true);
  // The right side, backwards.
  const ops = run.right;
  for (let k = ops.length - 1; k >= 0; k--) {
    const op = ops[k];
    if (op.arc) sink.arc(op.cx, op.cy, op.r, op.a1, op.a0, !op.ccw);
    else sink.lineTo(op.x, op.y);
    // A line op ends where it points; going back, the side continues from the op before it.
  }
  sink.lineTo(r0x, r0y);
  sink.closePath();
}

/** A whole circle, wound the same way as outlines. */
export function circle(sink: PathSink, cx: number, cy: number, r: number) {
  sink.moveTo(cx + r, cy);
  sink.arc(cx, cy, r, 0, Math.PI, true);
  sink.arc(cx, cy, r, Math.PI, 2 * Math.PI, true);
  sink.closePath();
}

// Distances ---------------------------------------------------------------------------------------

/** Squared distance from P to the segment AB. */
export function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px;
  const qy = ay + t * dy - py;
  return qx * qx + qy * qy;
}

/** Distance between the segments AB and CD. */
export function segSegDist(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  if (segmentsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.sqrt(Math.min(segDist2(ax, ay, cx, cy, dx, dy), segDist2(bx, by, cx, cy, dx, dy), segDist2(cx, cy, ax, ay, bx, by), segDist2(dx, dy, ax, ay, bx, by)));
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

const cross = (ax: number, ay: number, bx: number, by: number, px: number, py: number) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/** Whether a circle of radius `rad` moving from A to B touches the stroke's line (its width included). */
export function touches(xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>, box: Box, ax: number, ay: number, bx: number, by: number, rad: number): boolean {
  if (Math.max(ax, bx) + rad < box.x0 || Math.min(ax, bx) - rad > box.x1 || Math.max(ay, by) + rad < box.y0 || Math.min(ay, by) - rad > box.y1) return false;
  const n = xs.length;
  if (n === 1) return segDist2(xs[0], ys[0], ax, ay, bx, by) <= (rad + ws[0] / 2) ** 2;
  for (let i = 0; i < n - 1; i++) {
    const reach = rad + Math.max(ws[i], ws[i + 1]) / 2;
    // Cheap rejection first.
    if (Math.min(xs[i], xs[i + 1]) - reach > Math.max(ax, bx) || Math.max(xs[i], xs[i + 1]) + reach < Math.min(ax, bx)) continue;
    if (Math.min(ys[i], ys[i + 1]) - reach > Math.max(ay, by) || Math.max(ys[i], ys[i + 1]) + reach < Math.min(ay, by)) continue;
    if (segSegDist(xs[i], ys[i], xs[i + 1], ys[i + 1], ax, ay, bx, by) <= reach) return true;
  }
  return false;
}

// Cutting (the area eraser) -------------------------------------------------------------------

export type Piece = { xs: Float32Array; ys: Float32Array; ws: Float32Array };

/**
 * The stroke with what a circle of radius `rad` moving from A to B covers cut away: the pieces that
 * are left (an empty list when nothing is), or null when the circle doesn't reach the stroke.
 * Works on the smoothed line, cuts at the exact edge of the eraser, and simplifies what is left.
 */
export function cut(line: Line, ax: number, ay: number, bx: number, by: number, rad: number): Piece[] | null {
  const n = line.n;
  const { x, y, r } = line;
  // A point goes when the eraser covers its middle (and a little of its width).
  const reach = (i: number) => rad + r[i] * 0.3;
  const gone = new Uint8Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    if (segDist2(x[i], y[i], ax, ay, bx, by) <= reach(i) ** 2) {
      gone[i] = 1;
      any = true;
    }
  }
  if (!any) {
    // The eraser may pass between two points of a long straight piece.
    for (let i = 0; i < n - 1; i++) {
      if (segSegDist(x[i], y[i], x[i + 1], y[i + 1], ax, ay, bx, by) <= Math.min(reach(i), reach(i + 1))) {
        return cutBetween(line, i, ax, ay, bx, by, rad);
      }
    }
    return null;
  }
  const pieces: Piece[] = [];
  let px: number[] = [];
  let py: number[] = [];
  let pr: number[] = [];
  const edge = (i: number, j: number) => {
    // Between kept point i and erased point j: where the eraser's edge is.
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      const qx = x[i] + (x[j] - x[i]) * mid;
      const qy = y[i] + (y[j] - y[i]) * mid;
      const qr = r[i] + (r[j] - r[i]) * mid;
      if (segDist2(qx, qy, ax, ay, bx, by) <= (rad + qr * 0.3) ** 2) hi = mid;
      else lo = mid;
    }
    return lo;
  };
  const flush = () => {
    if (px.length) pieces.push(simplify(px, py, pr));
    px = [];
    py = [];
    pr = [];
  };
  for (let i = 0; i < n; i++) {
    if (gone[i]) {
      if (i > 0 && !gone[i - 1]) {
        const t = edge(i - 1, i);
        px.push(x[i - 1] + (x[i] - x[i - 1]) * t);
        py.push(y[i - 1] + (y[i] - y[i - 1]) * t);
        pr.push(r[i - 1] + (r[i] - r[i - 1]) * t);
        flush();
      }
      continue;
    }
    if (i > 0 && gone[i - 1]) {
      const t = edge(i, i - 1);
      px.push(x[i] + (x[i - 1] - x[i]) * t);
      py.push(y[i] + (y[i - 1] - y[i]) * t);
      pr.push(r[i] + (r[i - 1] - r[i]) * t);
    }
    px.push(x[i]);
    py.push(y[i]);
    pr.push(r[i]);
  }
  flush();
  return pieces.filter((p) => p.xs.length > 1 || p.ws[0] > 0.5);
}

/** The eraser crossed the piece between points i and i+1 without covering either: split there. */
function cutBetween(line: Line, i: number, ax: number, ay: number, bx: number, by: number, rad: number): Piece[] | null {
  const { x, y, r } = line;
  // Walk the piece in small steps and drop what the eraser covers.
  const steps = Math.min(4000, Math.max(2, Math.ceil(Math.hypot(x[i + 1] - x[i], y[i + 1] - y[i]) / Math.max(0.2, rad / 6))));
  const xs: number[] = [];
  const ys: number[] = [];
  const rs: number[] = [];
  for (let k = 0; k < line.n; k++) {
    xs.push(x[k]);
    ys.push(y[k]);
    rs.push(r[k]);
    if (k === i) {
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        xs.push(x[i] + (x[i + 1] - x[i]) * t);
        ys.push(y[i] + (y[i + 1] - y[i]) * t);
        rs.push(r[i] + (r[i + 1] - r[i]) * t);
      }
    }
  }
  const dense: Line = { x: Float64Array.from(xs), y: Float64Array.from(ys), r: Float64Array.from(rs), n: xs.length };
  // Some point is covered now (unless the eraser only grazed the line).
  return cut(dense, ax, ay, bx, by, rad);
}

/**
 * Fewer points for the same line (Ramer–Douglas–Peucker), keeping points where the width changes.
 * `tol` is how far (units) the simplified line may stray.
 */
export function simplify(xs: ArrayLike<number>, ys: ArrayLike<number>, rs: ArrayLike<number>, tol = 0.12): Piece {
  const n = xs.length;
  if (n <= 2) {
    return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), ws: Float32Array.from(Array.from(rs, (v) => v * 2)) };
  }
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: number[] = [0, n - 1];
  while (stack.length) {
    const b = stack.pop()!;
    const a = stack.pop()!;
    let worst = -1;
    let worstD = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.sqrt(segDist2(xs[i], ys[i], xs[a], ys[a], xs[b], ys[b]));
      // Width: compared with a straight change between the ends.
      const t = (i - a) / (b - a);
      const dr = Math.abs(rs[i] - (rs[a] + (rs[b] - rs[a]) * t));
      const score = Math.max(d, dr * 1.5);
      if (score > worstD) {
        worstD = score;
        worst = i;
      }
    }
    if (worst >= 0 && worstD > tol) {
      keep[worst] = 1;
      stack.push(a, worst, worst, b);
    }
  }
  let m = 0;
  for (let i = 0; i < n; i++) m += keep[i];
  const out = { xs: new Float32Array(m), ys: new Float32Array(m), ws: new Float32Array(m) };
  for (let i = 0, k = 0; i < n; i++) {
    if (!keep[i]) continue;
    out.xs[k] = xs[i];
    out.ys[k] = ys[i];
    out.ws[k] = rs[i] * 2;
    k++;
  }
  return out;
}

// Selecting ----------------------------------------------------------------------------------

/** Whether P is inside the closed polygon (x, y pairs). */
export function inPolygon(px: number, py: number, poly: ArrayLike<number>): boolean {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2];
    const yi = poly[i * 2 + 1];
    const xj = poly[j * 2];
    const yj = poly[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The share (0–1) of the points inside the polygon. */
export function shareInside(xs: ArrayLike<number>, ys: ArrayLike<number>, poly: ArrayLike<number>): number {
  if (!xs.length) return 0;
  // Long strokes: every few points is enough.
  const step = Math.max(1, Math.floor(xs.length / 64));
  let inside = 0;
  let total = 0;
  for (let i = 0; i < xs.length; i += step) {
    total++;
    if (inPolygon(xs[i], ys[i], poly)) inside++;
  }
  return inside / total;
}

// Moving --------------------------------------------------------------------------------------

/** An affine map [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (like DOMMatrix). */
export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export function multiply(m: Affine, n: Affine): Affine {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

export const translate = (dx: number, dy: number): Affine => [1, 0, 0, 1, dx, dy];
export const scaleAround = (s: number, cx: number, cy: number): Affine => [s, 0, 0, s, cx - s * cx, cy - s * cy];
export function rotateAround(a: number, cx: number, cy: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}

/** How much the map scales lengths (and so line widths). */
export const scaleOf = (m: Affine) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

export function applyPoints(m: Affine, xs: ArrayLike<number>, ys: ArrayLike<number>, ws: ArrayLike<number>): Piece {
  const n = xs.length;
  const s = scaleOf(m);
  const out = { xs: new Float32Array(n), ys: new Float32Array(n), ws: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    out.xs[i] = m[0] * xs[i] + m[2] * ys[i] + m[4];
    out.ys[i] = m[1] * xs[i] + m[3] * ys[i] + m[5];
    out.ws[i] = Math.max(0.1, ws[i] * s);
  }
  return out;
}

export function applyPoint(m: Affine, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
