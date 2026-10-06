// Geometry for the "plant-diversity" drawings: smooth leaf outlines from a few control points,
// saw teeth and lobes along the margin, polar outlines for palmate leaves, and a few path helpers.
// Pure functions (no React), so the same shapes serve lesson widgets and task pictures.

export type Pt = [number, number];

const r1 = (v: number) => Math.round(v * 10) / 10;

/** An SVG path through points (closed by default). */
export function pathOf(pts: Pt[], close = true): string {
  if (!pts.length) return "";
  return `M${pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L")}${close ? "Z" : ""}`;
}

/** A smooth Catmull-Rom curve through the control points, as a dense polyline. */
export function spline(points: Pt[], perSeg = 18): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Cumulative arc length along a polyline. */
function arcs(poly: Pt[]): number[] {
  const s = [0];
  for (let i = 1; i < poly.length; i++) s.push(s[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  return s;
}

/** The polyline resampled into n evenly spaced points. */
export function resample(poly: Pt[], n: number): Pt[] {
  const s = arcs(poly);
  const total = s[s.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / (n - 1);
    while (j < s.length - 2 && s[j + 1] < target) j++;
    const seg = s[j + 1] - s[j] || 1;
    const u = Math.min(1, Math.max(0, (target - s[j]) / seg));
    out.push([poly[j][0] + (poly[j + 1][0] - poly[j][0]) * u, poly[j][1] + (poly[j + 1][1] - poly[j][1]) * u]);
  }
  return out;
}

/** Unit normals of a polyline traversed base → tip; side +1 points right of the way up, −1 left. */
function normals(poly: Pt[], side: 1 | -1): Pt[] {
  return poly.map((_, i) => {
    const a = poly[Math.max(0, i - 1)];
    const b = poly[Math.min(poly.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [(side * -dy) / l, (side * dx) / l];
  });
}

export type Teeth = {
  /** Distance between teeth (viewBox units). */
  period: number;
  /** How far a tooth sticks out. */
  amp: number;
  /** saw: teeth point to the tip; double: big teeth with small ones on them; wave: gentle waves. */
  kind: "saw" | "double" | "wave" | "crenate";
  /** Part of the margin (0 = base, 1 = tip) that carries teeth. */
  from?: number;
  to?: number;
};

export type Lobes = {
  /** Number of lobes along one side. */
  n: number;
  /** How deep the bays (sinuses) cut in. */
  depth: number;
  from: number;
  to: number;
  /** Shift of the lobes on this side (oak lobes alternate a little). */
  phase?: number;
};

/** A saw tooth whose sharp point faces the tip. */
const saw = (u: number) => (u < 0.78 ? Math.pow(u / 0.78, 1.35) : (1 - u) / 0.22);

/** Offsets a margin outwards (teeth) or inwards (lobes). */
function shapeMargin(poly: Pt[], side: 1 | -1, teeth?: Teeth, lobes?: Lobes): Pt[] {
  const s = arcs(poly);
  const total = s[s.length - 1];
  const nn = normals(poly, side);
  return poly.map((p, i) => {
    const f = s[i] / total;
    let off = 0;
    if (lobes && f > lobes.from && f < lobes.to) {
      const u = ((f - lobes.from) / (lobes.to - lobes.from)) * lobes.n + (lobes.phase ?? 0);
      const v = u - Math.floor(u);
      // Rounded lobes, narrow rounded bays.
      const lobe = Math.pow(Math.sin(Math.PI * v), 0.5);
      // Fade the bays in and out at the ends.
      const edge = Math.min(1, (f - lobes.from) / 0.04, (lobes.to - f) / 0.06);
      off -= lobes.depth * (1 - lobe) * edge;
    }
    if (teeth) {
      const from = teeth.from ?? 0.08;
      const to = teeth.to ?? 0.97;
      if (f > from && f < to) {
        const edge = Math.min(1, (f - from) / 0.05, (to - f) / 0.05);
        const u = (s[i] - from * total) / teeth.period;
        const v = u - Math.floor(u);
        let t = 0;
        if (teeth.kind === "saw") t = saw(v);
        else if (teeth.kind === "double") {
          const w = u * 3 - Math.floor(u * 3);
          t = 0.72 * saw(v) + 0.42 * saw(w);
        } else if (teeth.kind === "crenate") t = Math.pow(Math.sin(Math.PI * v), 0.6);
        else t = 0.5 - 0.5 * Math.cos(2 * Math.PI * v);
        off += teeth.amp * t * edge;
      }
    }
    return [p[0] + nn[i][0] * off, p[1] + nn[i][1] * off];
  });
}

export type LeafDef = {
  /** Control points of the right half, base (0,0) → tip (0,−L). */
  right: Pt[];
  /** Control points of the left half (base → tip); default: the right half mirrored. */
  left?: Pt[];
  teeth?: Teeth;
  lobes?: Lobes;
  /** Lobes on the left half (default: like the right, shifted). */
  lobesLeft?: Lobes;
  /** Points per side. */
  res?: number;
};

export type Leaf = {
  /** The leaf outline (closed path). */
  outline: string;
  /** The smooth outline without teeth, base → tip, right then left half. */
  rightSmooth: Pt[];
  leftSmooth: Pt[];
  /** Length from base to tip. */
  length: number;
};

export function leaf(def: LeafDef): Leaf {
  const res = def.res ?? 360;
  const left = def.left ?? def.right.map(([x, y]) => [-x, y] as Pt);
  const R = resample(spline(def.right), res);
  const Lp = resample(spline(left), res);
  const rightM = shapeMargin(R, 1, def.teeth, def.lobes);
  const leftM = shapeMargin(Lp, -1, def.teeth, def.lobesLeft ?? (def.lobes ? { ...def.lobes, phase: (def.lobes.phase ?? 0) + 0.18 } : undefined));
  const length = Math.abs(def.right[def.right.length - 1][1]);
  return { outline: pathOf([...rightM, ...leftM.reverse()]), rightSmooth: R, leftSmooth: Lp, length };
}

/** Side veins of a pinnate leaf: from the midrib at height t·L towards the margin, curving to the tip. */
export function sideVeins(l: Leaf, ts: number[], reach = 0.86, lead = 0.1): string {
  const L = l.length;
  const out: string[] = [];
  for (const side of [l.rightSmooth, l.leftSmooth]) {
    for (const t of ts) {
      const y0 = -t * L;
      const target = -(t + lead) * L;
      // First margin point (from the base) that is at least as high as the target.
      const m = side.find((p) => p[1] <= target) ?? side[side.length - 1];
      const ex = m[0] * reach;
      const ey = y0 + (m[1] - y0) * reach;
      const cx = ex * 0.45;
      const cy = y0 + (ey - y0) * 0.15;
      out.push(`M0 ${r1(y0)}Q${r1(cx)} ${r1(cy)} ${r1(ex)} ${r1(ey)}`);
    }
  }
  return out.join("");
}

export type PolarLobe = { at: number; len: number; width: number; sharp?: number };

/**
 * A palmate outline around the petiole attachment (0,0): r(φ) with φ in degrees from straight up
 * (clockwise). Lobes and teeth are pointed bumps; the base dips into a heart-shaped notch.
 */
export function polarLeaf(bumps: PolarLobe[], opts: { base: number; notch: number; notchWidth: number; n?: number }): Pt[] {
  const n = opts.n ?? 900;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const phi = -180 + (360 * i) / n;
    const a = Math.abs(phi);
    let r = opts.base * (1 - opts.notch * Math.exp(-Math.pow((a - 180) / opts.notchWidth, 2)));
    for (const b of bumps) {
      let d = Math.abs(phi - b.at);
      if (d > 180) d = 360 - d;
      if (d < b.width) {
        const v = opts.base + (b.len - opts.base) * Math.pow(1 - d / b.width, b.sharp ?? 1.4);
        if (v > r) r = v;
      }
    }
    const rad = (phi * Math.PI) / 180;
    pts.push([r * Math.sin(rad), -r * Math.cos(rad)]);
  }
  return pts;
}

/** Points of a polyline transformed: rotate by deg around (0,0), scale, then move. */
export function place(pts: Pt[], dx: number, dy: number, deg = 0, k = 1): Pt[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [dx + k * (x * c - y * s), dy + k * (x * s + y * c)]);
}

/** A regular "flower" of n petals around (cx, cy): petal tip radius R, petal width w (for icons). */
export function petalPath(cx: number, cy: number, len: number, width: number, deg: number, notch = 0): string {
  const a = (deg * Math.PI) / 180;
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const px = -uy;
  const py = ux;
  const tipX = cx + ux * len;
  const tipY = cy + uy * len;
  const w = width / 2;
  const c1x = cx + ux * len * 0.55 + px * w * 1.25;
  const c1y = cy + uy * len * 0.55 + py * w * 1.25;
  const c2x = cx + ux * len * 0.55 - px * w * 1.25;
  const c2y = cy + uy * len * 0.55 - py * w * 1.25;
  if (!notch) {
    return `M${r1(cx)} ${r1(cy)}C${r1(c1x)} ${r1(c1y)} ${r1(tipX + px * w * 0.9)} ${r1(tipY + py * w * 0.9)} ${r1(tipX)} ${r1(tipY)}C${r1(tipX - px * w * 0.9)} ${r1(tipY - py * w * 0.9)} ${r1(c2x)} ${r1(c2y)} ${r1(cx)} ${r1(cy)}Z`;
  }
  const nx = cx + ux * (len - notch);
  const ny = cy + uy * (len - notch);
  const lx = tipX + px * w * 0.55;
  const ly = tipY + py * w * 0.55;
  const rx = tipX - px * w * 0.55;
  const ry = tipY - py * w * 0.55;
  return `M${r1(cx)} ${r1(cy)}C${r1(c1x)} ${r1(c1y)} ${r1(lx + px * w * 0.5)} ${r1(ly + py * w * 0.5)} ${r1(lx)} ${r1(ly)}Q${r1(tipX)} ${r1(tipY)} ${r1(nx)} ${r1(ny)}Q${r1(tipX)} ${r1(tipY)} ${r1(rx)} ${r1(ry)}C${r1(rx - px * w * 0.5)} ${r1(ry - py * w * 0.5)} ${r1(c2x)} ${r1(c2y)} ${r1(cx)} ${r1(cy)}Z`;
}
