"use client";

// Labelled drawings of plane shapes and solids for the area-volume levels. Solids are drawn as
// a German "Schrägbild" (cabinet projection: depth at 45°, shortened to half), round solids with
// flat ellipses. Hidden edges are dashed. Everything is computed from the shape's numbers, so
// the drawing is to scale and right angles look right.

import type { Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cos, sin } from "@/lib/stableMath";

export type P = [number, number];
type V3 = [number, number, number];
type Stroke = "ink" | "soft" | "blob" | "hidden" | "hiddenBlob" | "thin";
type Fill = "area" | "area2" | "area3" | "water" | "cut";

type Label = { text: Text; at: P; dir?: P; dist?: number; math?: boolean; tone?: "ink" | "blob" | "soft"; size?: number };
type Prim =
  | { t: "poly"; pts: P[]; closed?: boolean; fill?: Fill; stroke?: Stroke; holes?: P[][] }
  | ({ t: "label" } & Label)
  | { t: "right"; at: P; u: P; v: P; size?: number }
  | { t: "dot"; at: P; tone?: "ink" | "blob" }
  | { t: "grid"; x0: number; y0: number; x1: number; y1: number; step?: number }
  | { t: "dim"; a: P; b: P; text: Text; side: P };

/** A side label: which side of the polygon (from pts[i] to pts[i + 1]) and its text. */
export type SideLabel = { i: number; text: Text };

export type FigureSpec =
  | { kind: "rect"; a: number; b: number; la?: Text; lb?: Text; grid?: boolean; edge?: boolean }
  | { kind: "unitsq"; la: Text; lsmall: Text }
  | { kind: "poly"; pts: P[]; labels: SideLabel[]; split?: [P, P][]; ghost?: P[] }
  | { kind: "tri"; pts: [P, P, P]; base?: number; lh?: Text; labels: SideLabel[]; ghost?: boolean; right?: number; names?: boolean }
  | { kind: "para"; g: number; h: number; off: number; lg?: Text; lh?: Text; ls?: Text; cut?: boolean }
  | { kind: "trap"; a: number; c: number; h: number; off: number; la?: Text; lc?: Text; lh?: Text; ls?: Text; mid?: boolean }
  | { kind: "circle"; r: number; show: "r" | "d" | "rd"; label: Text; ld?: Text; sector?: number; la?: Text }
  | { kind: "window"; w: number; h: number; lw: Text; lh: Text }
  | { kind: "hole"; w: number; h: number; r: number; lw: Text; lh: Text; lr: Text }
  | { kind: "quarter"; w: number; lw: Text }
  | { kind: "track"; w: number; h: number; lw: Text; lh: Text }
  | { kind: "house"; w: number; h: number; t: number; lw: Text; lh: Text; lt: Text }
  | { kind: "cuboid"; a: number; b: number; c: number; la?: Text; lb?: Text; lc?: Text; cubes?: boolean }
  | { kind: "net"; a: number; b: number; c: number; la?: Text; lb?: Text; lc?: Text }
  | { kind: "prism"; g: number; ht: number; px: number; L: number; lg?: Text; lht?: Text; lL?: Text; ls?: Text; sideS?: number }
  | { kind: "cyl"; r: number; h: number; lr?: Text; lh?: Text; diameter?: boolean }
  | { kind: "pyr"; a: number; b?: number; h: number; la?: Text; lb?: Text; lh?: Text; lhs?: Text; ls?: Text; tri?: boolean; hideH?: boolean }
  | { kind: "cone"; r: number; h: number; lr?: Text; lh?: Text; ls?: Text; hideH?: boolean; diameter?: boolean }
  | { kind: "sphere"; r: number; lr: Text; diameter?: boolean; hemi?: boolean }
  | { kind: "cylcone"; r: number; h1: number; h2: number; lr: Text; lh1: Text; lh2: Text }
  | { kind: "cylhemi"; r: number; h1: number; lr: Text; lh1: Text }
  | { kind: "conehemi"; r: number; h: number; lr: Text; lh: Text }
  | { kind: "cubepyr"; a: number; h1: number; h2: number; la: Text; lh1: Text; lh2: Text }
  | { kind: "cylnet"; r: number; h: number; lr: Text; lh: Text; lu: Text }
  | { kind: "conenet"; r: number; s: number; lr: Text; ls: Text; lb: Text }
  | { kind: "pair"; items: FigureSpec[] };

const PI = Math.PI;
const E = 0.32; // flatness of the ellipses of round solids
const K = 0.5 * cos(PI / 4); // depth factor of the Schrägbild
const VIEW: V3 = [K, -1, K]; // towards the viewer

const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const mul = (a: P, k: number): P => [a[0] * k, a[1] * k];
const len = (a: P) => Math.hypot(a[0], a[1]);
const unit = (a: P): P => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const dot = (a: P, b: P) => a[0] * b[0] + a[1] * b[1];
const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const centroid = (pts: P[]): P => mul(pts.reduce((s, p) => add(s, p), [0, 0] as P), 1 / pts.length);
const proj = ([x, y, z]: V3): P => [x + K * y, z + K * y];

/** Points of an ellipse arc (angles in radians, counter-clockwise). */
function arc(c: P, rx: number, ry: number, t0: number, t1: number, n = 48): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    out.push([c[0] + rx * cos(t), c[1] + ry * sin(t)]);
  }
  return out;
}

/** The normal of segment a→b that points away from `ref`. */
function outward(a: P, b: P, ref: P): P {
  const d = unit(sub(b, a));
  const n: P = [d[1], -d[0]];
  return dot(n, sub(ref, mid(a, b))) > 0 ? mul(n, -1) : n;
}

function sideLabels(pts: P[], labels: SideLabel[], ref = centroid(pts)): Prim[] {
  return labels.map(({ i, text }) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    return { t: "label", text, at: mid(a, b), dir: outward(a, b, ref) };
  });
}

/** How far one can go from q along dir before leaving the polygon. */
function room(q: P, dir: P, poly: P[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const e = sub(b, a);
    const den = dir[0] * e[1] - dir[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(a, q);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const u = (w[0] * dir[1] - w[1] * dir[0]) / den;
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

/**
 * A dashed height from `top` down to the line through a, b, with a right-angle mark and the
 * extension of the base if needed. The label goes to the side with more room inside `poly`.
 */
function height(top: P, a: P, b: P, label?: Text, poly?: P[]): Prim[] {
  const u = unit(sub(b, a));
  const foot = add(a, mul(u, dot(sub(top, a), u)));
  const out: Prim[] = [];
  const t = dot(sub(foot, a), u);
  const L = len(sub(b, a));
  if (t < -1e-9) out.push({ t: "poly", pts: [foot, a], stroke: "hidden" });
  if (t > L + 1e-9) out.push({ t: "poly", pts: [b, foot], stroke: "hidden" });
  out.push({ t: "poly", pts: [top, foot], stroke: "hiddenBlob" });
  const v = unit(sub(top, foot));
  const side: P = t > L / 2 ? mul(u, -1) : u;
  out.push({ t: "right", at: foot, u: side, v });
  if (label) {
    const q = mid(top, foot);
    const dir = poly ? (room(q, u, poly) >= room(q, mul(u, -1), poly) ? u : mul(u, -1)) : mul(side, -1);
    out.push({ t: "label", text: label, at: q, dir, tone: "blob", dist: 5 });
  }
  return out;
}

/** A dimension line (Maßlinie) beside a solid: from a to b, shifted by `side` (model units), label outside. */
const dimLine = (a: P, b: P, text: Text, side: P): Prim => ({ t: "dim", a, b, text, side });

// ---------------------------------------------------------------------------
// Solids

/** A convex solid: visible faces filled, edges solid when they touch a visible face, dashed otherwise. */
function polyhedron(verts: V3[], faces: number[][]): Prim[] {
  const c: V3 = [0, 1, 2].map((k) => verts.reduce((s, v) => s + v[k], 0) / verts.length) as V3;
  const out: Prim[] = [];
  const edges = new Map<string, { a: number; b: number; vis: boolean }>();
  faces.forEach((f) => {
    const [p0, p1, p2] = f.map((i) => verts[i]);
    const u: V3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const w: V3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    let n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const fc = [0, 1, 2].map((k) => f.reduce((s, i) => s + verts[i][k], 0) / f.length);
    if (n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]) < 0) n = [-n[0], -n[1], -n[2]];
    const vis = n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2] > 1e-9;
    if (vis) {
      const l = Math.hypot(...n) || 1;
      const fill: Fill = Math.abs(n[2]) / l > 0.7 ? "area2" : n[1] / l < -0.7 ? "area" : "area3";
      out.push({ t: "poly", pts: f.map((i) => proj(verts[i])), closed: true, fill });
    }
    f.forEach((a, k) => {
      const b = f[(k + 1) % f.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const e = edges.get(key);
      if (e) e.vis ||= vis;
      else edges.set(key, { a, b, vis });
    });
  });
  const list = [...edges.values()];
  for (const e of list.filter((e) => !e.vis)) out.push({ t: "poly", pts: [proj(verts[e.a]), proj(verts[e.b])], stroke: "hidden" });
  for (const e of list.filter((e) => e.vis)) out.push({ t: "poly", pts: [proj(verts[e.a]), proj(verts[e.b])], stroke: "ink" });
  return out;
}

function box(a: number, b: number, c: number, z0 = 0): { verts: V3[]; faces: number[][] } {
  const verts: V3[] = [
    [0, 0, z0], [a, 0, z0], [a, b, z0], [0, b, z0],
    [0, 0, z0 + c], [a, 0, z0 + c], [a, b, z0 + c], [0, b, z0 + c],
  ];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return { verts, faces };
}

/** Unit cubes of an a × b × c cuboid, back to front, bottom to top, left to right. */
function unitCubes(a: number, b: number, c: number): Prim[] {
  const out: Prim[] = [];
  for (let y = b - 1; y >= 0; y--)
    for (let z = 0; z < c; z++)
      for (let x = 0; x < a; x++) {
        const q = (dx: number, dy: number, dz: number) => proj([x + dx, y + dy, z + dz]);
        out.push({ t: "poly", pts: [q(0, 0, 0), q(1, 0, 0), q(1, 0, 1), q(0, 0, 1)], closed: true, fill: "area", stroke: "thin" });
        out.push({ t: "poly", pts: [q(0, 0, 1), q(1, 0, 1), q(1, 1, 1), q(0, 1, 1)], closed: true, fill: "area2", stroke: "thin" });
        out.push({ t: "poly", pts: [q(1, 0, 0), q(1, 1, 0), q(1, 1, 1), q(1, 0, 1)], closed: true, fill: "area3", stroke: "thin" });
      }
  return out;
}

/** Bottom ellipse of a round solid: front half solid, back half dashed. */
function baseEllipse(cy: number, r: number, backHidden = true): Prim[] {
  return [
    { t: "poly", pts: arc([0, cy], r, E * r, 0, PI), stroke: backHidden ? "hidden" : "ink" },
    { t: "poly", pts: arc([0, cy], r, E * r, PI, 2 * PI), stroke: "ink" },
  ];
}

/** The two tangent points from an apex (0, cy + h) to the ellipse around (0, cy); h < 0 for an apex below. */
function tangents(cy: number, r: number, h: number): { tR: number; tL: number } {
  const s = Math.max(-0.99, Math.min(0.99, (E * r) / h));
  const tR = Math.asin(s);
  return { tR, tL: PI - tR };
}

function coneShape(cy: number, r: number, h: number, withBase: boolean): Prim[] {
  const apex: P = [0, cy + h];
  const { tR, tL } = tangents(cy, r, h);
  const front = h > 0 ? arc([0, cy], r, E * r, tL, 2 * PI + tR) : arc([0, cy], r, E * r, -tR, PI + tR);
  const out: Prim[] = [{ t: "poly", pts: [apex, ...front], closed: true, fill: "area" }];
  if (withBase) {
    if (h > 0) out.push({ t: "poly", pts: arc([0, cy], r, E * r, tR, tL), stroke: "hidden" });
    out.push({ t: "poly", pts: front, stroke: "ink" });
  }
  out.push({ t: "poly", pts: [front[0], apex, front[front.length - 1]], stroke: "ink" });
  return out;
}

function cylinderShape(r: number, h: number, top: "full" | "front"): Prim[] {
  const side: P[] = [...arc([0, 0], r, E * r, PI, 2 * PI), ...arc([0, h], r, E * r, 0, -PI)];
  const out: Prim[] = [{ t: "poly", pts: side, closed: true, fill: "area" }];
  if (top === "full") out.push({ t: "poly", pts: arc([0, h], r, E * r, 0, 2 * PI, 72), closed: true, fill: "area2", stroke: "ink" });
  else out.push(...baseEllipse(h, r));
  out.push(...baseEllipse(0, r));
  out.push({ t: "poly", pts: [[-r, 0], [-r, h]], stroke: "ink" }, { t: "poly", pts: [[r, 0], [r, h]], stroke: "ink" });
  return out;
}

function domeShape(cy: number, r: number): Prim[] {
  const dome = arc([0, cy], r, r, 0, PI, 60);
  return [
    { t: "poly", pts: [...dome, ...arc([0, cy], r, E * r, PI, 2 * PI)], closed: true, fill: "area2" },
    { t: "poly", pts: dome, stroke: "ink" },
  ];
}

// ---------------------------------------------------------------------------
// Shapes

const DOWN: P = [0, -1];
const LEFT: P = [-1, 0];
const RIGHT: P = [1, 0];
const UP: P = [0, 1];
const DR: P = unit([1, -1]);

function build(s: FigureSpec): Prim[] {
  switch (s.kind) {
    case "rect": {
      const pts: P[] = [[0, 0], [s.a, 0], [s.a, s.b], [0, s.b]];
      const out: Prim[] = [{ t: "poly", pts, closed: true, fill: "area" }];
      if (s.grid) out.push({ t: "grid", x0: 0, y0: 0, x1: s.a, y1: s.b });
      out.push({ t: "poly", pts, closed: true, stroke: s.edge ? "blob" : "ink" });
      if (s.la) out.push({ t: "label", text: s.la, at: [s.a / 2, 0], dir: DOWN });
      if (s.lb) out.push({ t: "label", text: s.lb, at: [0, s.b / 2], dir: LEFT });
      return out;
    }
    case "unitsq": {
      const pts: P[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
      return [
        { t: "poly", pts, closed: true, fill: "area" },
        { t: "grid", x0: 0, y0: 0, x1: 10, y1: 10 },
        { t: "poly", pts: [[0, 9], [1, 9], [1, 10], [0, 10]], closed: true, fill: "water", stroke: "blob" },
        { t: "poly", pts, closed: true, stroke: "ink" },
        { t: "label", text: s.la, at: [5, 0], dir: DOWN },
        { t: "label", text: s.la, at: [10, 5], dir: RIGHT },
        { t: "label", text: s.lsmall, at: [0.5, 10], dir: UP, tone: "blob" },
      ];
    }
    case "poly": {
      const out: Prim[] = [{ t: "poly", pts: s.pts, closed: true, fill: "area" }];
      if (s.ghost) out.push({ t: "poly", pts: s.ghost, closed: true, stroke: "hidden" });
      for (const [a, b] of s.split ?? []) out.push({ t: "poly", pts: [a, b], stroke: "hiddenBlob" });
      out.push({ t: "poly", pts: s.pts, closed: true, stroke: "ink" });
      out.push(...sideLabels(s.pts, s.labels));
      return out;
    }
    case "tri": {
      const pts = s.pts;
      const out: Prim[] = [];
      if (s.ghost) {
        const D = add(pts[1], sub(pts[2], pts[0]));
        out.push({ t: "poly", pts: [pts[1], D, pts[2]], closed: true, fill: "cut", stroke: "hidden" });
      }
      out.push({ t: "poly", pts, closed: true, fill: "area" });
      if (s.base !== undefined) {
        const a = pts[s.base];
        const b = pts[(s.base + 1) % 3];
        const top = pts[(s.base + 2) % 3];
        out.push(...height(top, a, b, s.lh, pts));
      }
      if (s.right !== undefined) {
        const v = pts[s.right];
        out.push({ t: "right", at: v, u: unit(sub(pts[(s.right + 1) % 3], v)), v: unit(sub(pts[(s.right + 2) % 3], v)) });
      }
      out.push({ t: "poly", pts, closed: true, stroke: "ink" });
      out.push(...sideLabels(pts, s.labels));
      if (s.names) {
        const c = centroid(pts);
        ["A", "B", "C"].forEach((n, i) => out.push({ t: "label", text: n, at: pts[i], dir: unit(sub(pts[i], c)), math: true, dist: 4 }));
      }
      return out;
    }
    case "para": {
      const A: P = [0, 0];
      const B: P = [s.g, 0];
      const C: P = [s.g + s.off, s.h];
      const D: P = [s.off, s.h];
      const out: Prim[] = [{ t: "poly", pts: [A, B, C, D], closed: true, fill: "area" }];
      if (s.cut) {
        out.push({ t: "poly", pts: [A, [s.off, 0], D], closed: true, fill: "area2" });
        out.push({ t: "poly", pts: [B, [s.g + s.off, 0], C], closed: true, fill: "cut", stroke: "hidden" });
      }
      out.push(...height(D, A, B, s.lh, [A, B, C, D]));
      out.push({ t: "poly", pts: [A, B, C, D], closed: true, stroke: "ink" });
      if (s.lg) out.push({ t: "label", text: s.lg, at: mid(A, B), dir: DOWN });
      if (s.ls) out.push({ t: "label", text: s.ls, at: mid(A, D), dir: outward(A, D, mid(B, D)) });
      return out;
    }
    case "trap": {
      const A: P = [0, 0];
      const B: P = [s.a, 0];
      const C: P = [s.off + s.c, s.h];
      const D: P = [s.off, s.h];
      const out: Prim[] = [{ t: "poly", pts: [A, B, C, D], closed: true, fill: "area" }];
      out.push(...height(D, A, B, s.lh, [A, B, C, D]));
      if (s.mid) out.push({ t: "poly", pts: [mid(A, D), mid(B, C)], stroke: "hiddenBlob" });
      out.push({ t: "poly", pts: [A, B, C, D], closed: true, stroke: "ink" });
      if (s.la) out.push({ t: "label", text: s.la, at: mid(A, B), dir: DOWN });
      if (s.lc) out.push({ t: "label", text: s.lc, at: mid(C, D), dir: UP });
      if (s.ls) out.push({ t: "label", text: s.ls, at: mid(B, C), dir: outward(B, C, mid(A, D)) });
      return out;
    }
    case "circle": {
      const r = s.r;
      const out: Prim[] = [];
      if (s.sector !== undefined) {
        const a = (s.sector * PI) / 180;
        out.push({ t: "poly", pts: arc([0, 0], r, r, 0, 2 * PI, 90), closed: true, stroke: "hidden" });
        const sec: P[] = [[0, 0], ...arc([0, 0], r, r, 0, a, Math.max(8, Math.round(s.sector / 4)))];
        out.push({ t: "poly", pts: sec, closed: true, fill: "area", stroke: "ink" });
        out.push({ t: "poly", pts: arc([0, 0], r * 0.22, r * 0.22, 0, a, 24), stroke: "blob" });
        if (s.la) out.push({ t: "label", text: s.la, at: [r * 0.22 * cos(a / 2), r * 0.22 * sin(a / 2)], dir: [cos(a / 2), sin(a / 2)], tone: "blob", dist: 6 });
        out.push({ t: "label", text: s.label, at: [r / 2, 0], dir: DOWN, tone: "blob" });
        out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" });
        out.push({ t: "dot", at: [0, 0] });
        return out;
      }
      out.push({ t: "poly", pts: arc([0, 0], r, r, 0, 2 * PI, 90), closed: true, fill: "area", stroke: "ink" });
      if (s.show === "r") {
        out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" });
        out.push({ t: "label", text: s.label, at: [r / 2, 0], dir: UP, tone: "blob", dist: 4 });
      } else if (s.show === "d") {
        out.push({ t: "poly", pts: [[-r, 0], [r, 0]], stroke: "blob" });
        out.push({ t: "label", text: s.label, at: [-r / 2, 0], dir: UP, tone: "blob", dist: 4 });
      } else {
        const t = (200 * PI) / 180;
        const a: P = [r * cos(t), r * sin(t)];
        out.push({ t: "poly", pts: [a, [-a[0], -a[1]]], stroke: "blob" });
        out.push({ t: "label", text: s.ld ?? s.label, at: mul(a, 0.5), dir: unit([-a[1], a[0]]), tone: "blob", dist: 4 });
        out.push({ t: "poly", pts: [[0, 0], [0, r]], stroke: "blob" });
        out.push({ t: "label", text: s.label, at: [0, r / 2], dir: RIGHT, tone: "blob", dist: 4 });
      }
      out.push({ t: "dot", at: [0, 0] });
      return out;
    }
    case "window": {
      const { w, h } = s;
      const outline: P[] = [[0, h], [0, 0], [w, 0], [w, h], ...arc([w / 2, h], w / 2, w / 2, 0, PI, 40)];
      return [
        { t: "poly", pts: outline, closed: true, fill: "area" },
        { t: "poly", pts: arc([w / 2, h], w / 2, w / 2, 0, PI, 40), closed: true, fill: "area2" },
        { t: "poly", pts: [[0, h], [w, h]], stroke: "hiddenBlob" },
        { t: "poly", pts: outline, closed: true, stroke: "ink" },
        { t: "label", text: s.lw, at: [w / 2, 0], dir: DOWN },
        { t: "label", text: s.lh, at: [0, h / 2], dir: LEFT },
      ];
    }
    case "hole": {
      const { w, h, r } = s;
      const outer: P[] = [[0, 0], [w, 0], [w, h], [0, h]];
      const hole = arc([w / 2, h / 2], r, r, 0, 2 * PI, 72);
      return [
        { t: "poly", pts: outer, closed: true, fill: "area", holes: [hole] },
        { t: "poly", pts: outer, closed: true, stroke: "ink" },
        { t: "poly", pts: hole, closed: true, stroke: "ink" },
        { t: "poly", pts: [[w / 2, h / 2], [w / 2 + r, h / 2]], stroke: "blob" },
        { t: "dot", at: [w / 2, h / 2] },
        { t: "label", text: s.lr, at: [w / 2 + r / 2, h / 2], dir: UP, tone: "blob", dist: 4 },
        { t: "label", text: s.lw, at: [w / 2, 0], dir: DOWN },
        { t: "label", text: s.lh, at: [0, h / 2], dir: LEFT },
      ];
    }
    case "quarter": {
      const { w } = s;
      const region: P[] = [[w, 0], [w, w], [0, w], ...arc([0, 0], w, w, PI / 2, 0, 40)];
      return [
        { t: "poly", pts: arc([0, 0], w, w, 0, PI / 2, 40).concat([[0, 0]]), closed: true, fill: "cut", stroke: "hidden" },
        { t: "poly", pts: region, closed: true, fill: "area", stroke: "ink" },
        { t: "poly", pts: [[0, 0], [w, 0], [w, w], [0, w]], closed: true, stroke: "ink" },
        { t: "label", text: s.lw, at: [w / 2, 0], dir: DOWN },
        { t: "label", text: s.lw, at: [w, w / 2], dir: RIGHT },
      ];
    }
    case "track": {
      const { w, h } = s;
      const r = h / 2;
      const outline: P[] = [...arc([w, r], r, r, -PI / 2, PI / 2, 30), ...arc([0, r], r, r, PI / 2, 1.5 * PI, 30)];
      return [
        { t: "poly", pts: outline, closed: true, fill: "area", stroke: "ink" },
        { t: "poly", pts: [[0, 0], [0, h]], stroke: "hiddenBlob" },
        { t: "poly", pts: [[w, 0], [w, h]], stroke: "hiddenBlob" },
        { t: "label", text: s.lw, at: [w / 2, 0], dir: DOWN },
        { t: "label", text: s.lh, at: [w, h / 2], dir: LEFT, tone: "blob" },
      ];
    }
    case "house": {
      const { w, h, t } = s;
      const pts: P[] = [[0, 0], [w, 0], [w, h], [w / 2, h + t], [0, h]];
      return [
        { t: "poly", pts, closed: true, fill: "area" },
        { t: "poly", pts: [[0, h], [w, h], [w / 2, h + t]], closed: true, fill: "area2" },
        { t: "poly", pts: [[0, h], [w, h]], stroke: "hidden" },
        ...height([w / 2, h + t], [0, h], [w, h], s.lt, [[0, h], [w, h], [w / 2, h + t]]),
        { t: "poly", pts, closed: true, stroke: "ink" },
        { t: "label", text: s.lw, at: [w / 2, 0], dir: DOWN },
        { t: "label", text: s.lh, at: [0, h / 2], dir: LEFT },
      ];
    }
    case "cuboid": {
      const { a, b, c } = s;
      const out: Prim[] = [];
      if (s.cubes) {
        out.push(...unitCubes(a, b, c));
        const { verts, faces } = box(a, b, c);
        out.push(...polyhedron(verts, faces).filter((p) => p.t === "poly" && p.stroke === "ink"));
      } else {
        const { verts, faces } = box(a, b, c);
        out.push(...polyhedron(verts, faces));
      }
      if (s.la) out.push({ t: "label", text: s.la, at: proj([a / 2, 0, 0]), dir: DOWN });
      if (s.lc) out.push({ t: "label", text: s.lc, at: proj([0, 0, c / 2]), dir: LEFT });
      if (s.lb) out.push({ t: "label", text: s.lb, at: proj([a, b / 2, 0]), dir: DR });
      return out;
    }
    case "net": {
      const { a, b, c } = s;
      const R = (x: number, y: number, w: number, h: number, fill: Fill): Prim => ({ t: "poly", pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, fill, stroke: "ink" });
      return [
        R(0, b, b, c, "area3"),
        R(b, b, a, c, "area"),
        R(b + a, b, b, c, "area3"),
        R(2 * b + a, b, a, c, "area"),
        R(b, b + c, a, b, "area2"),
        R(b, 0, a, b, "area2"),
        ...(s.la ? [{ t: "label", text: s.la, at: [b + a / 2, 0], dir: DOWN } as Prim] : []),
        ...(s.lb ? [{ t: "label", text: s.lb, at: [b, b / 2], dir: LEFT } as Prim] : []),
        ...(s.lc ? [{ t: "label", text: s.lc, at: [0, b + c / 2], dir: LEFT } as Prim] : []),
      ];
    }
    case "prism": {
      const { g, ht, px, L } = s;
      const verts: V3[] = [[0, 0, 0], [g, 0, 0], [px, 0, ht], [0, L, 0], [g, L, 0], [px, L, ht]];
      const faces = [[0, 1, 2], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
      const out = polyhedron(verts, faces);
      const front: P[] = [[0, 0], [g, 0], [px, ht]];
      out.push({ t: "poly", pts: front, closed: true, fill: "area2" });
      out.push(...height([px, ht], [0, 0], [g, 0], s.lht, front));
      out.push({ t: "poly", pts: front, closed: true, stroke: "ink" });
      if (s.lg) out.push({ t: "label", text: s.lg, at: [g / 2, 0], dir: DOWN });
      if (s.lL) out.push({ t: "label", text: s.lL, at: proj([g, L / 2, 0]), dir: DR });
      if (s.ls) {
        const side = s.sideS === 1 ? ([[g, 0], [px, ht]] as [P, P]) : ([[0, 0], [px, ht]] as [P, P]);
        out.push({ t: "label", text: s.ls, at: mid(side[0], side[1]), dir: outward(side[0], side[1], [g / 2, ht / 3]) });
      }
      return out;
    }
    case "cyl": {
      const { r, h } = s;
      const out = cylinderShape(r, h, "full");
      if (s.diameter) {
        out.push({ t: "poly", pts: [[-r, h], [r, h]], stroke: "blob" });
        if (s.lr) out.push({ t: "label", text: s.lr, at: [0, h + E * r], dir: UP, tone: "blob" });
      } else {
        out.push({ t: "poly", pts: [[0, h], [r, h]], stroke: "blob" }, { t: "dot", at: [0, h] });
        if (s.lr) out.push({ t: "label", text: s.lr, at: [r / 2, h + E * r], dir: UP, tone: "blob", dist: 3 });
      }
      if (s.lh) out.push({ t: "label", text: s.lh, at: [r, h / 2], dir: RIGHT });
      return out;
    }
    case "pyr": {
      const { a, h } = s;
      const b = s.b ?? a;
      const verts: V3[] = [[0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0], [a / 2, b / 2, h]];
      const faces = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
      const out = polyhedron(verts, faces);
      const apex = proj([a / 2, b / 2, h]);
      const M = proj([a / 2, b / 2, 0]);
      const F = proj([a / 2, 0, 0]);
      if (s.tri) {
        out.push({ t: "poly", pts: [apex, M, F], closed: true, fill: "water" });
        out.push({ t: "poly", pts: [M, F], stroke: "hiddenBlob" });
      }
      if (!s.hideH) out.push({ t: "poly", pts: [apex, M], stroke: "hiddenBlob" }, { t: "dot", at: M, tone: "blob" });
      if (s.lhs) out.push({ t: "poly", pts: [apex, F], stroke: "blob" });
      if (s.la) out.push({ t: "label", text: s.la, at: proj([a / 2, 0, 0]), dir: DOWN });
      if (s.lb) out.push({ t: "label", text: s.lb, at: proj([a, b / 2, 0]), dir: DR });
      if (s.lh && !s.hideH) {
        const left = Math.min(proj([0, 0, 0])[0], proj([0, b, 0])[0]) - 0.12 * a;
        out.push(dimLine([left, M[1]], [left, apex[1]], s.lh, LEFT));
      }
      if (s.lhs) out.push({ t: "label", text: s.lhs, at: mid(apex, F), dir: LEFT, tone: "blob", dist: 3 });
      if (s.ls) out.push({ t: "label", text: s.ls, at: mid(apex, proj([a, 0, 0])), dir: RIGHT });
      return out;
    }
    case "cone": {
      const { r, h } = s;
      const out = coneShape(0, r, h, true);
      if (!s.hideH) out.push({ t: "poly", pts: [[0, h], [0, 0]], stroke: "hiddenBlob" });
      if (s.diameter) out.push({ t: "poly", pts: [[-r, 0], [r, 0]], stroke: "blob" });
      else out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" });
      out.push({ t: "dot", at: [0, 0], tone: "blob" });
      if (s.lr) out.push({ t: "label", text: s.lr, at: s.diameter ? [0, -E * r] : [r / 2, -E * r * 0.6], dir: DOWN, tone: "blob" });
      if (s.lh && !s.hideH) out.push(dimLine([-r - 0.15 * r, 0], [-r - 0.15 * r, h], s.lh, LEFT));
      if (s.ls) out.push({ t: "label", text: s.ls, at: [r / 2, h / 2], dir: unit([h, r]) });
      return out;
    }
    case "sphere": {
      const { r } = s;
      const out: Prim[] = [];
      if (s.hemi) {
        out.push(...domeShape(0, r), ...baseEllipse(0, r));
      } else {
        out.push({ t: "poly", pts: arc([0, 0], r, r, 0, 2 * PI, 90), closed: true, fill: "area", stroke: "ink" });
        out.push({ t: "poly", pts: arc([0, 0], r, E * r, 0, PI), stroke: "hidden" }, { t: "poly", pts: arc([0, 0], r, E * r, PI, 2 * PI), stroke: "soft" });
      }
      if (s.diameter) out.push({ t: "poly", pts: [[-r, 0], [r, 0]], stroke: "blob" });
      else out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" });
      out.push({ t: "dot", at: [0, 0], tone: "blob" });
      out.push({ t: "label", text: s.lr, at: [s.diameter ? 0 : r / 2, E * r], dir: UP, tone: "blob", dist: 3 });
      return out;
    }
    case "cylcone": {
      const { r, h1, h2 } = s;
      const out = cylinderShape(r, h1, "front");
      out.push(...coneShape(h1, r, h2, false));
      out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" }, { t: "dot", at: [0, 0], tone: "blob" });
      // Below the solid: inside, the label would cross the dashed back rim or the rim on top.
      out.push({ t: "label", text: s.lr, at: [r / 2, -E * r], dir: DOWN, tone: "blob", dist: 3 });
      out.push(dimLine([r + 0.25 * r, 0], [r + 0.25 * r, h1], s.lh1, RIGHT));
      out.push({ t: "poly", pts: [[0, h1], [0, h1 + h2]], stroke: "hiddenBlob" });
      out.push(dimLine([-r - 0.25 * r, h1], [-r - 0.25 * r, h1 + h2], s.lh2, LEFT));
      return out;
    }
    case "cylhemi": {
      const { r, h1 } = s;
      const out = cylinderShape(r, h1, "front");
      out.push(...domeShape(h1, r));
      out.push({ t: "poly", pts: [[0, 0], [r, 0]], stroke: "blob" }, { t: "dot", at: [0, 0], tone: "blob" });
      // Below the solid: inside, the label would cross the dashed back rim or the rim on top.
      out.push({ t: "label", text: s.lr, at: [r / 2, -E * r], dir: DOWN, tone: "blob", dist: 3 });
      out.push(dimLine([r + 0.25 * r, 0], [r + 0.25 * r, h1], s.lh1, RIGHT));
      return out;
    }
    case "conehemi": {
      const { r, h } = s;
      const out = coneShape(h, r, -h, false);
      out.push(...domeShape(h, r), ...baseEllipse(h, r));
      out.push({ t: "poly", pts: [[0, h], [r, h]], stroke: "blob" }, { t: "dot", at: [0, h], tone: "blob" });
      out.push({ t: "label", text: s.lr, at: [r, h], dir: RIGHT, tone: "blob", dist: 4 });
      out.push(dimLine([-r - 0.25 * r, 0], [-r - 0.25 * r, h], s.lh, LEFT));
      return out;
    }
    case "cubepyr": {
      const { a, h1, h2 } = s;
      const verts: V3[] = [...box(a, a, h1).verts, [a / 2, a / 2, h1 + h2]];
      const faces = [[0, 1, 2, 3], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8]];
      const out = polyhedron(verts, faces);
      const apex = proj([a / 2, a / 2, h1 + h2]);
      const M = proj([a / 2, a / 2, h1]);
      out.push({ t: "poly", pts: [apex, M], stroke: "hiddenBlob" }, { t: "dot", at: M, tone: "blob" });
      out.push({ t: "label", text: s.la, at: proj([a / 2, 0, 0]), dir: DOWN });
      out.push(dimLine([-0.12 * a, 0], [-0.12 * a, h1], s.lh1, LEFT));
      out.push(dimLine([-0.12 * a, M[1]], [-0.12 * a, apex[1]], s.lh2, LEFT));
      return out;
    }
    case "cylnet": {
      const { r, h } = s;
      const u = 2 * PI * r;
      const x0 = 0;
      return [
        { t: "poly", pts: [[x0, 0], [x0 + u, 0], [x0 + u, h], [x0, h]], closed: true, fill: "area", stroke: "ink" },
        { t: "poly", pts: arc([x0 + r, h + r], r, r, 0, 2 * PI, 60), closed: true, fill: "area2", stroke: "ink" },
        { t: "poly", pts: arc([x0 + r, -r], r, r, 0, 2 * PI, 60), closed: true, fill: "area2", stroke: "ink" },
        { t: "poly", pts: [[x0 + r, h + r], [x0 + 2 * r, h + r]], stroke: "blob" },
        { t: "label", text: s.lr, at: [x0 + 1.5 * r, h + r], dir: UP, tone: "blob", dist: 3 },
        { t: "label", text: s.lu, at: [x0 + u / 2 + r, 0], dir: DOWN },
        { t: "label", text: s.lh, at: [x0 + u, h / 2], dir: RIGHT },
      ];
    }
    case "conenet": {
      const { r, s: sl } = s;
      const ang = (2 * PI * r) / sl;
      const t0 = -PI / 2 - ang / 2;
      const apex: P = [0, 0];
      const sec: P[] = [apex, ...arc(apex, sl, sl, t0, t0 + ang, 60)];
      const bottom: P = [0, -sl - r];
      return [
        { t: "poly", pts: sec, closed: true, fill: "area", stroke: "ink" },
        { t: "poly", pts: arc(bottom, r, r, 0, 2 * PI, 60), closed: true, fill: "area2", stroke: "ink" },
        { t: "poly", pts: arc(apex, sl, sl, t0, t0 + ang, 60), stroke: "blob" },
        { t: "poly", pts: [bottom, [r, -sl - r]], stroke: "blob" },
        { t: "label", text: s.lr, at: [r / 2, -sl - r], dir: UP, tone: "blob", dist: 3 },
        { t: "label", text: s.ls, at: mid(apex, sec[1]), dir: unit([-cos(t0 + PI / 2) , -sin(t0 + PI / 2)]) },
        { t: "label", text: s.lb, at: sec[sec.length - 1], dir: RIGHT, tone: "blob" },
      ];
    }
    case "pair":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Rendering

const FILLS: Record<Fill, string> = {
  area: "color-mix(in oklab, var(--blob) 15%, var(--surface))",
  area2: "color-mix(in oklab, var(--blob) 28%, var(--surface))",
  area3: "color-mix(in oklab, var(--blob) 8%, var(--surface))",
  water: "color-mix(in oklab, var(--blob) 38%, var(--surface))",
  cut: "color-mix(in oklab, var(--ink) 6%, transparent)",
};

const STROKES: Record<Stroke, { stroke: string; width: number; dash?: string }> = {
  ink: { stroke: "var(--ink)", width: 1.8 },
  thin: { stroke: "var(--ink-2)", width: 0.9 },
  soft: { stroke: "var(--ink-3)", width: 1.2 },
  blob: { stroke: "var(--blob)", width: 2.4 },
  hidden: { stroke: "var(--ink-3)", width: 1.3, dash: "5 4" },
  hiddenBlob: { stroke: "var(--blob)", width: 1.8, dash: "5 4" },
};

const FONT = 15;
const r2 = (v: number) => Math.round(v * 100) / 100;

type Scene = { els: Prim[]; s: number; minX: number; maxY: number; box: [number, number, number, number] };

/** Fits the geometry into maxW × maxH pixels and measures the labels. */
function layout(prims: Prim[], maxW: number, maxH: number, resolve: (t: Text) => string): Scene {
  const pts: P[] = [];
  for (const p of prims) {
    if (p.t === "poly") pts.push(...p.pts);
    else if (p.t === "grid") pts.push([p.x0, p.y0], [p.x1, p.y1]);
    else if (p.t === "dim") pts.push(p.a, p.b);
    else if (p.t === "dot" || p.t === "label" || p.t === "right") pts.push(p.at);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const s = Math.min(maxW / Math.max(1e-6, maxX - minX), maxH / Math.max(1e-6, maxY - minY));
  let bx0 = 0;
  let by0 = 0;
  let bx1 = (maxX - minX) * s;
  let by1 = (maxY - minY) * s;
  for (const q of prims) {
    if (q.t !== "label" && q.t !== "dim") continue;
    const p = q.t === "dim" ? dimLabel(q) : q;
    const { x, y, w, h } = labelBox(p, s, minX, maxY, resolve);
    bx0 = Math.min(bx0, x - w / 2);
    bx1 = Math.max(bx1, x + w / 2);
    by0 = Math.min(by0, y - h / 2);
    by1 = Math.max(by1, y + h / 2);
  }
  return { els: prims, s, minX, maxY, box: [bx0, by0, bx1, by1] };
}

const dimLabel = (p: Extract<Prim, { t: "dim" }>): Extract<Prim, { t: "label" }> => ({ t: "label", text: p.text, at: mid(p.a, p.b), dir: p.side, tone: "blob", dist: 5 });

function labelBox(p: Extract<Prim, { t: "label" }>, s: number, minX: number, maxY: number, resolve: (t: Text) => string) {
  const size = p.size ?? FONT;
  const text = resolve(p.text);
  const w = text.replace(/_/g, "").length * size * (p.math ? 0.5 : 0.56) + 4;
  const h = size * 1.15;
  const base: P = [(p.at[0] - minX) * s, (maxY - p.at[1]) * s];
  const d = p.dir ? unit(p.dir) : ([0, 0] as P);
  const dist = (p.dist ?? 7) + Math.abs(d[0]) * (w / 2) + Math.abs(d[1]) * (h / 2);
  return { x: base[0] + d[0] * dist, y: base[1] - d[1] * dist, w, h, text, size };
}

function SceneSvg({ scene, resolve }: { scene: Scene; resolve: (t: Text) => string }) {
  const { s, minX, maxY } = scene;
  const m = (p: P) => `${r2((p[0] - minX) * s)},${r2((maxY - p[1]) * s)}`;
  const path = (pts: P[], closed?: boolean) => `M${pts.map(m).join("L")}${closed ? "Z" : ""}`;
  return (
    <>
      {scene.els.map((p, i) => {
        switch (p.t) {
          case "poly": {
            const st = p.stroke ? STROKES[p.stroke] : null;
            const d = path(p.pts, p.closed) + (p.holes ?? []).map((h) => path(h, true)).join("");
            return (
              <path
                key={i}
                d={d}
                fill={p.fill ? FILLS[p.fill] : "none"}
                fillRule="evenodd"
                stroke={st?.stroke ?? "none"}
                strokeWidth={st?.width}
                strokeDasharray={st?.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          }
          case "grid": {
            const step = p.step ?? 1;
            const lines: string[] = [];
            for (let x = p.x0 + step; x < p.x1 - 1e-9; x += step) lines.push(path([[x, p.y0], [x, p.y1]]));
            for (let y = p.y0 + step; y < p.y1 - 1e-9; y += step) lines.push(path([[p.x0, y], [p.x1, y]]));
            return <path key={i} d={lines.join("")} stroke="var(--ink-3)" strokeOpacity={0.55} strokeWidth={0.8} fill="none" />;
          }
          case "right": {
            const k = (p.size ?? 9) / s;
            const a = add(p.at, mul(p.u, k));
            const b = add(a, mul(p.v, k));
            const c = add(p.at, mul(p.v, k));
            return <path key={i} d={path([a, b, c])} stroke="var(--blob)" strokeWidth={1.3} fill="none" />;
          }
          case "dim": {
            const d = unit(sub(p.b, p.a));
            const n: P = mul([-d[1], d[0]], 5 / s);
            const tick = (q: P) => path([add(q, n), sub(q, n)]);
            const b = labelBox(dimLabel(p), s, minX, maxY, resolve);
            return (
              <g key={i}>
                <path d={path([p.a, p.b]) + tick(p.a) + tick(p.b)} stroke="var(--blob)" strokeWidth={1.2} fill="none" />
                <LabelText x={b.x} y={b.y} size={b.size} text={b.text} tone="blob" />
              </g>
            );
          }
          case "dot": {
            const [x, y] = m(p.at).split(",").map(Number);
            return <circle key={i} cx={x} cy={y} r={2.6} fill={p.tone === "blob" ? "var(--blob)" : "var(--ink)"} />;
          }
          case "label": {
            const b = labelBox(p, s, minX, maxY, resolve);
            return <LabelText key={i} x={b.x} y={b.y} size={b.size} text={b.text} tone={p.tone} math={p.math} />;
          }
        }
      })}
    </>
  );
}

/** A label; "h_s" is drawn with a subscript. */
function LabelText({ x, y, size, text, tone, math }: { x: number; y: number; size: number; text: string; tone?: "ink" | "blob" | "soft"; math?: boolean }) {
  const m = /^(.*?)_(\w+)(.*)$/.exec(text);
  return (
    <text
      x={r2(x)}
      y={r2(y)}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fill={tone === "blob" ? "var(--blob)" : tone === "soft" ? "var(--ink-2)" : "var(--ink)"}
      fontWeight={math ? 400 : 500}
      className={math ? "font-math italic" : undefined}
      style={math ? undefined : { fontFamily: "var(--font-sans)" }}
      stroke="var(--surface)"
      strokeWidth={3.5}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {m ? (
        <>
          {m[1]}
          <tspan fontSize={size * 0.72} dy={size * 0.28}>
            {m[2]}
          </tspan>
          <tspan dy={-size * 0.28}>{m[3]}</tspan>
        </>
      ) : (
        text
      )}
    </text>
  );
}

/** Builds the scenes of a figure (several side by side for a pair). */
function scenes(shape: FigureSpec, resolve: (t: Text) => string): Scene[] {
  if (shape.kind === "pair") return shape.items.map((it) => layout(build(it), 190, 170, resolve));
  return [layout(build(shape), 300, 200, resolve)];
}

const PAD = 6;
const GAP = 34;

/** Puts scenes side by side. */
function place(list: Scene[]) {
  let x = 0;
  const placed = list.map((sc) => {
    const [x0, y0, x1, y1] = sc.box;
    const at = { dx: x - x0, w: x1 - x0, y0, h: y1 - y0 };
    x += x1 - x0 + GAP;
    return { sc, ...at };
  });
  return { placed, width: x - GAP + 2 * PAD };
}

/** A labelled drawing of a plane shape or a solid (props: `shape`). */
export function AreaVolumeFigure({ shape, label }: { shape: FigureSpec; label?: Text }) {
  const resolve = useText();
  const { placed, width } = place(scenes(shape, resolve));
  const top = Math.min(...placed.map((p) => p.y0));
  const bottom = Math.max(...placed.map((p) => p.y0 + p.h));
  const height = bottom - top + 2 * PAD;
  return (
    <svg
      viewBox={`${r2(-PAD)} ${r2(top - PAD)} ${r2(width)} ${r2(height)}`}
      className="mx-auto block h-auto w-full"
      style={{ maxWidth: Math.round(width) }}
      role="img"
      aria-label={label ? resolve(label) : undefined}
    >
      {placed.map((p, i) => (
        <g key={i} transform={`translate(${r2(p.dx)} 0)`}>
          <SceneSvg scene={p.sc} resolve={resolve} />
        </g>
      ))}
    </svg>
  );
}

/** A figure as an exercise or explain-step visual. */
export const figure = (shape: FigureSpec, label?: Text) => ({ component: AreaVolumeFigure as never, props: label ? { shape, label } : { shape } });
