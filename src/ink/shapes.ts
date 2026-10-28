// Drawn shapes: draw a line, circle, rectangle or triangle, keep the pen still for a moment, and it
// becomes exact (like Samsung Notes and Apple Notes). recognize() looks at the stroke and returns the
// clean shape as points, or null when it isn't one.

import type { ShapeKind } from "./model";

export type Shape = { kind: ShapeKind; xs: number[]; ys: number[] };

/** Points along the stroke, evenly spaced. */
function resample(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): { x: number[]; y: number[]; length: number } {
  const n = xs.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  const length = cum[n - 1] ?? 0;
  const x: number[] = [];
  const y: number[] = [];
  let k = 1;
  for (let s = 0; s < count; s++) {
    const at = (length * s) / (count - 1);
    while (k < n - 1 && cum[k] < at) k++;
    const span = cum[k] - cum[k - 1] || 1;
    const t = Math.min(1, Math.max(0, (at - cum[k - 1]) / span));
    x.push(xs[k - 1] + (xs[k] - xs[k - 1]) * t);
    y.push(ys[k - 1] + (ys[k] - ys[k - 1]) * t);
  }
  return { x, y, length };
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

/** Angles within a few degrees of horizontal, vertical or diagonal snap to them. */
function snapAngle(a: number, tight: number, diag: number): number {
  const step = Math.PI / 4;
  const k = Math.round(a / step);
  const snapped = k * step;
  const limit = k % 2 === 0 ? tight : diag;
  return Math.abs(a - snapped) < limit ? snapped : a;
}

/** The stroke as a shape, or null. `px` is one screen pixel in the stroke's units (tolerances). */
export function recognize(xs: ArrayLike<number>, ys: ArrayLike<number>, px: number): Shape | null {
  if (xs.length < 2) return null;
  const { x, y, length } = resample(xs, ys, 72);
  if (length < 24 * px) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < x.length; i++) {
    x0 = Math.min(x0, x[i]);
    y0 = Math.min(y0, y[i]);
    x1 = Math.max(x1, x[i]);
    y1 = Math.max(y1, y[i]);
  }
  const diag = Math.hypot(x1 - x0, y1 - y0);
  const sx = x[0];
  const sy = y[0];
  const ex = x[x.length - 1];
  const ey = y[y.length - 1];
  const gap = dist(sx, sy, ex, ey);

  // A line: every point close to the segment between the ends.
  if (gap > 0.82 * length) {
    let worst = 0;
    for (let i = 0; i < x.length; i++) worst = Math.max(worst, segDist(x[i], y[i], sx, sy, ex, ey));
    if (worst < Math.max(0.055 * length, 2 * px)) {
      const a = snapAngle(Math.atan2(ey - sy, ex - sx), (4 * Math.PI) / 180, (2.5 * Math.PI) / 180);
      return { kind: "line", xs: [sx, sx + Math.cos(a) * gap], ys: [sy, sy + Math.sin(a) * gap] };
    }
    return null;
  }

  // Closed shapes: the ends come back together.
  if (gap > Math.max(0.3 * diag, 18 * px)) return null;
  // Close the loop for fitting (the last stretch from end back to start).
  const ellipse = fitEllipse(x, y);
  const poly = fitPolygon(x, y, diag);
  const pick = ellipse && (!poly || ellipse.error < poly.error * 1.15) ? ellipse.shape : poly?.shape ?? null;
  return pick;
}

/** The ellipse through the points (along their main directions), and how far they stray (0–1). */
function fitEllipse(x: number[], y: number[]): { shape: Shape; error: number } | null {
  const n = x.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  let angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Along the axes: the extent gives the radii and the true centre.
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const u = (x[i] - mx) * ca + (y[i] - my) * sa;
    const v = -(x[i] - mx) * sa + (y[i] - my) * ca;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  let a = (u1 - u0) / 2;
  let b = (v1 - v0) / 2;
  if (a < 1e-6 || b < 1e-6 || b / a < 0.12) return null;
  const cx = mx + ((u0 + u1) / 2) * ca - ((v0 + v1) / 2) * sa;
  const cy = my + ((u0 + u1) / 2) * sa + ((v0 + v1) / 2) * ca;
  let error = 0;
  for (let i = 0; i < n; i++) {
    const u = (x[i] - cx) * ca + (y[i] - cy) * sa;
    const v = -(x[i] - cx) * sa + (y[i] - cy) * ca;
    error += Math.abs(Math.hypot(u / a, v / b) - 1);
  }
  error /= n;
  if (error > 0.11) return null;
  // Nearly round: a circle. Nearly level: level.
  if (Math.max(a, b) / Math.min(a, b) < 1.14) a = b = (a + b) / 2;
  else angle = snapAngle(angle, (6 * Math.PI) / 180, 0);
  const xs: number[] = [];
  const ys: number[] = [];
  const steps = 72;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * Math.PI * 2;
    const u = a * Math.cos(t);
    const v = b * Math.sin(t);
    xs.push(cx + u * c - v * s);
    ys.push(cy + u * s + v * c);
  }
  return { shape: { kind: "ellipse", xs, ys }, error };
}

/** The polygon the points follow (3 to 6 corners), and how far they stray (relative to the size). */
function fitPolygon(x: number[], y: number[], diag: number): { shape: Shape; error: number } | null {
  const n = x.length;
  // Start from the point farthest from the middle (a corner), so the closed path is split well.
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i];
    my += y[i];
  }
  mx /= n;
  my /= n;
  let far = 0;
  for (let i = 1; i < n; i++) if (dist(x[i], y[i], mx, my) > dist(x[far], y[far], mx, my)) far = i;
  // The loop from there around (the end joins the start).
  const px: number[] = [];
  const py: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const i = (far + k) % (n - 1);
    px.push(x[i]);
    py.push(y[i]);
  }
  px.push(px[0]);
  py.push(py[0]);
  const tol = 0.075 * diag;
  const keep = new Uint8Array(px.length);
  keep[0] = keep[px.length - 1] = 1;
  // The point farthest from the first splits the loop in two.
  let opp = 0;
  for (let i = 1; i < px.length - 1; i++) if (dist(px[i], py[i], px[0], py[0]) > dist(px[opp], py[opp], px[0], py[0])) opp = i;
  keep[opp] = 1;
  const stack = [0, opp, opp, px.length - 1];
  while (stack.length) {
    const b = stack.pop()!;
    const a = stack.pop()!;
    let worst = -1;
    let worstD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(px[i], py[i], px[a], py[a], px[b], py[b]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push(a, worst, worst, b);
    }
  }
  const cx: number[] = [];
  const cy: number[] = [];
  for (let i = 0; i < px.length - 1; i++) {
    if (keep[i]) {
      cx.push(px[i]);
      cy.push(py[i]);
    }
  }
  // Corners that are barely corners (almost straight on) are not corners.
  for (let changed = true; changed && cx.length > 3; ) {
    changed = false;
    for (let i = 0; i < cx.length; i++) {
      const a = (i - 1 + cx.length) % cx.length;
      const b = (i + 1) % cx.length;
      const turn = Math.abs(normAngle(Math.atan2(cy[b] - cy[i], cx[b] - cx[i]) - Math.atan2(cy[i] - cy[a], cx[i] - cx[a])));
      if (turn < (28 * Math.PI) / 180) {
        cx.splice(i, 1);
        cy.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  const k = cx.length;
  if (k < 3 || k > 6) return null;
  let error = 0;
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < k; j++) best = Math.min(best, segDist(x[i], y[i], cx[j], cy[j], cx[(j + 1) % k], cy[(j + 1) % k]));
    error += best;
  }
  error /= n * diag;
  if (error > 0.035) return null;
  if (k === 4) {
    const rect = asRectangle(cx, cy);
    if (rect) return { shape: rect, error: error * 0.9 };
  }
  const xs = [...cx, cx[0]];
  const ys = [...cy, cy[0]];
  return { shape: { kind: k === 3 ? "triangle" : "polygon", xs, ys }, error };
}

/** Four corners with right angles: a clean rectangle (level when nearly level). */
function asRectangle(cx: number[], cy: number[]): Shape | null {
  for (let i = 0; i < 4; i++) {
    const a = (i + 3) % 4;
    const b = (i + 1) % 4;
    const turn = Math.abs(normAngle(Math.atan2(cy[b] - cy[i], cx[b] - cx[i]) - Math.atan2(cy[i] - cy[a], cx[i] - cx[a])));
    if (Math.abs(turn - Math.PI / 2) > (16 * Math.PI) / 180) return null;
  }
  // Direction of the sides: the mean of the four (each turned back by its multiple of 90°).
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < 4; i++) {
    const a = Math.atan2(cy[(i + 1) % 4] - cy[i], cx[(i + 1) % 4] - cx[i]);
    sx += Math.cos(4 * a);
    sy += Math.sin(4 * a);
  }
  let angle = Math.atan2(sy, sx) / 4;
  angle = snapAngle(angle, (6 * Math.PI) / 180, 0);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const mx = cx.reduce((p, v) => p + v, 0) / 4;
  const my = cy.reduce((p, v) => p + v, 0) / 4;
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    const u = (cx[i] - mx) * c + (cy[i] - my) * s;
    const v = -(cx[i] - mx) * s + (cy[i] - my) * c;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  // Average the opposite sides rather than taking the widest.
  const hu = (u1 - u0) / 2;
  const hv = (v1 - v0) / 2;
  const corners: [number, number][] = [
    [-hu, -hv],
    [hu, -hv],
    [hu, hv],
    [-hu, hv],
  ];
  const ox = mx + ((u0 + u1) / 2) * c - ((v0 + v1) / 2) * s;
  const oy = my + ((u0 + u1) / 2) * s + ((v0 + v1) / 2) * c;
  const xs = corners.map(([u, v]) => ox + u * c - v * s);
  const ys = corners.map(([u, v]) => oy + u * s + v * c);
  return { kind: "rect", xs: [...xs, xs[0]], ys: [...ys, ys[0]] };
}

const normAngle = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};
