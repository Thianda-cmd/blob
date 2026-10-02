"use client";

// A small particle simulation for the "particles" topic: a box of a few dozen particles that
// vibrate in a lattice (solid), slide around at the bottom (liquid) or fly through the whole
// box (gas). Each particle is solid, liquid or gas depending on two fractions, so a melting
// block loses its top rows first. Runs on requestAnimationFrame only while the box is on
// screen; with reduced motion it shows still pictures of the same arrangements.

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SimProps = {
  /** Fraction of particles that are no longer solid (0 = all solid, 1 = all liquid or gas). */
  liquid: number;
  /** Fraction of particles that are gas (≤ liquid). */
  gas: number;
  /** Agitation 0..1: how strongly particles vibrate and how fast they move. */
  heat: number;
  width?: number;
  height?: number;
  n?: number;
  r?: number;
  /** Columns of the solid lattice. */
  cols?: number;
  seed?: number;
  /** Fill per particle (CSS colour), defaults to the accent colour. */
  fills?: string[];
  /** A wall in the middle that particles can't cross (diffusion). */
  barrier?: boolean;
  /** Right inner wall (a piston), defaults to the box. */
  right?: number;
  /** Pull liquids down (default true). */
  gravity?: boolean;
  /** Draw the box outline. */
  frame?: boolean;
  /** Called about four times a second with the share of left-born particles now on the right (diffusion). */
  onMix?: (share: number) => void;
  label: string;
  className?: string;
  children?: React.ReactNode;
};

type Pt = { x: number; y: number };

const PAD = 4;

/** Seeded random numbers (mulberry32), so server and client draw the same starting picture. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v: number) => Math.round(v * 10) / 10;

type Geometry = { w: number; h: number; n: number; r: number; cols: number; seed: number };

/** Lattice places of the solid: a block at the bottom, centred. */
function homes({ w, h, n, r, cols }: Geometry): Pt[] {
  const d = 2 * r + 1.6;
  const rows = Math.ceil(n / cols);
  const x0 = (w - (cols - 1) * d) / 2;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    out.push({ x: x0 + col * d, y: h - PAD - r - (rows - 1 - row) * d });
  }
  return out;
}

/** Puddle places of the liquid: close together, no order, spread over the floor. */
function puddle({ w, h, r, seed }: Geometry, count: number): Pt[] {
  const rnd = seeded(seed * 7 + 3);
  const d = 2 * r + 0.8;
  const per = Math.floor((w - 2 * PAD) / d);
  const out: Pt[] = [];
  for (let row = 0; out.length < count; row++) {
    const shift = row % 2 ? d / 2 : 0;
    for (let c = 0; c < per - (row % 2) && out.length < count; c++) {
      out.push({ x: PAD + r + shift + c * d + (rnd() - 0.5) * 3, y: h - PAD - r - row * d * 0.88 + (rnd() - 0.5) * 3 });
    }
  }
  return out;
}

/** Gas places: scattered over the whole box with some distance between them. */
function scatter({ w, h, r, seed }: Geometry, count: number, minX = PAD + r, maxX = w - PAD - r): Pt[] {
  const rnd = seeded(seed * 13 + 5);
  const out: Pt[] = [];
  const minD = Math.min(4.5 * r, Math.sqrt(((maxX - minX) * (h - 2 * PAD)) / Math.max(count, 1)) * 0.8);
  for (let tries = 0; out.length < count && tries < count * 400; tries++) {
    const p = { x: minX + rnd() * (maxX - minX), y: PAD + r + rnd() * (h - 2 * PAD - 2 * r) };
    const need = tries > count * 200 ? 2 * r : minD;
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= need)) out.push(p);
  }
  while (out.length < count) out.push({ x: minX + rnd() * (maxX - minX), y: PAD + r + rnd() * (h - 2 * PAD - 2 * r) });
  return out;
}

/** Melting order: top rows first, and the outer particles of a row before the inner ones. */
function meltRank(g: Geometry, home: Pt[]): number[] {
  const order = home
    .map((p, i) => ({ i, key: p.y * 1000 - Math.abs(p.x - g.w / 2) }))
    .sort((a, b) => a.key - b.key)
    .map((o) => o.i);
  const rank = new Array<number>(home.length);
  order.forEach((i, k) => (rank[i] = k));
  return rank;
}

/** 0 solid, 1 liquid, 2 gas for each particle. */
function modesOf(rank: number[], liquid: number, gas: number): number[] {
  const n = rank.length;
  const L = Math.round(Math.min(1, Math.max(0, liquid)) * n);
  const G = Math.round(Math.min(1, Math.max(0, gas)) * n);
  return rank.map((k) => (k < G ? 2 : k < L ? 1 : 0));
}

/** A still picture of the arrangement (reduced motion, and the very first frame). */
function stillPicture(g: Geometry, home: Pt[], modes: number[], barrier: boolean, right: number): Pt[] {
  const out: Pt[] = home.map((p) => ({ ...p }));
  const taken: Pt[] = [];
  modes.forEach((m, i) => m === 0 && taken.push(out[i]));
  const free = (p: Pt) => taken.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * g.r - 0.5) && p.x <= right - g.r;
  const liquidSpots = puddle({ ...g, w: Math.min(g.w, right + PAD) }, g.n * 2);
  let s = 0;
  modes.forEach((m, i) => {
    if (m !== 1) return;
    while (s < liquidSpots.length && !free(liquidSpots[s])) s++;
    out[i] = liquidSpots[s] ?? out[i];
    taken.push(out[i]);
    s++;
  });
  const gasCount = modes.filter((m) => m === 2).length;
  if (gasCount) {
    if (barrier) {
      // Keep each particle on its own side of the wall.
      const leftSpots = scatter(g, g.n, PAD + g.r, g.w / 2 - 3 - g.r);
      const rightSpots = scatter({ ...g, seed: g.seed + 1 }, g.n, g.w / 2 + 3 + g.r, right - PAD - g.r);
      let a = 0;
      let b = 0;
      modes.forEach((m, i) => {
        if (m !== 2) return;
        out[i] = home[i].x < g.w / 2 ? leftSpots[a++] : rightSpots[b++];
      });
    } else {
      const spots = scatter(g, gasCount * 3, PAD + g.r, right - PAD - g.r);
      let k = 0;
      modes.forEach((m, i) => {
        if (m !== 2) return;
        while (k < spots.length - 1 && !free(spots[k])) k++;
        out[i] = spots[k] ?? out[i];
        taken.push(out[i]);
        k++;
      });
    }
  }
  return out.map((p) => ({ x: round(p.x), y: round(p.y) }));
}

type State = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  side: Int8Array;
  ph: Float32Array;
  w: Float32Array;
  t: number;
  rnd: () => number;
};

function createState(start: Pt[], seed: number, w: number): State {
  const n = start.length;
  const rnd = seeded(seed * 31 + 11);
  const s: State = {
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    side: new Int8Array(n),
    ph: new Float32Array(n * 2),
    w: new Float32Array(n * 2),
    t: 0,
    rnd,
  };
  start.forEach((p, i) => {
    s.x[i] = p.x;
    s.y[i] = p.y;
    const a = rnd() * Math.PI * 2;
    s.vx[i] = Math.cos(a) * 60;
    s.vy[i] = Math.sin(a) * 60;
    s.side[i] = p.x < w / 2 ? -1 : 1;
    s.ph[2 * i] = rnd() * 6.28;
    s.ph[2 * i + 1] = rnd() * 6.28;
    s.w[2 * i] = 9 + rnd() * 6;
    s.w[2 * i + 1] = 9 + rnd() * 6;
  });
  return s;
}

type Live = { modes: number[]; heat: number; barrier: boolean; right: number; gravity: boolean };

function step(s: State, g: Geometry, home: Pt[], live: Live, dt: number) {
  const { modes, heat, barrier, right, gravity } = live;
  const { n, r, h } = g;
  s.t += dt;
  const ax = new Float32Array(n);
  const ay = new Float32Array(n);
  const amp = 0.7 + 2.6 * heat;
  const kick = 2600 * (0.35 + heat);
  for (let i = 0; i < n; i++) {
    const m = modes[i];
    if (m === 0) {
      const tx = home[i].x + amp * Math.sin(s.w[2 * i] * s.t + s.ph[2 * i]);
      const ty = home[i].y + amp * Math.sin(s.w[2 * i + 1] * s.t + s.ph[2 * i + 1]);
      ax[i] += 320 * (tx - s.x[i]) - 26 * s.vx[i];
      ay[i] += 320 * (ty - s.y[i]) - 26 * s.vy[i];
    } else if (m === 1) {
      if (gravity) ay[i] += 700;
      ax[i] += (s.rnd() - 0.5) * 2 * kick - 2.2 * s.vx[i];
      ay[i] += (s.rnd() - 0.5) * 2 * kick - 2.2 * s.vy[i];
    }
  }
  const d2 = 2 * r;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = s.x[j] - s.x[i];
      const dy = s.y[j] - s.y[i];
      const dd = dx * dx + dy * dy;
      if (dd > d2 * d2 * 2.1 || dd < 1e-6) continue;
      const d = Math.sqrt(dd);
      const nx = dx / d;
      const ny = dy / d;
      let f = 0;
      if (d < d2) f = -3200 * (d2 - d);
      else if (modes[i] === 1 && modes[j] === 1) f = 260 * (d - d2); // weak attraction keeps a liquid together
      ax[i] += f * nx;
      ay[i] += f * ny;
      ax[j] -= f * nx;
      ay[j] -= f * ny;
    }
  }
  const vg = 150 + 280 * heat;
  const vl = 70 + 110 * heat;
  const left = PAD + r;
  const top = PAD + r;
  const bottom = h - PAD - r;
  const wallR = right - PAD - r;
  const mid = g.w / 2;
  for (let i = 0; i < n; i++) {
    const m = modes[i];
    s.vx[i] += ax[i] * dt;
    s.vy[i] += ay[i] * dt;
    if (m === 2) {
      const sp = Math.hypot(s.vx[i], s.vy[i]) || 1;
      const k = 1 + (vg / sp - 1) * Math.min(1, 4 * dt);
      s.vx[i] *= k;
      s.vy[i] *= k;
    } else if (m === 1) {
      const sp = Math.hypot(s.vx[i], s.vy[i]);
      if (sp > vl) {
        s.vx[i] *= vl / sp;
        s.vy[i] *= vl / sp;
      }
    }
    s.x[i] += s.vx[i] * dt;
    s.y[i] += s.vy[i] * dt;
    const bounce = m === 2 ? 1 : 0.3;
    let lo = left;
    let hi = wallR;
    if (barrier) {
      if (s.side[i] < 0) hi = Math.min(hi, mid - 3 - r);
      else lo = Math.max(lo, mid + 3 + r);
    }
    if (s.x[i] < lo) {
      s.x[i] = lo;
      s.vx[i] = Math.abs(s.vx[i]) * bounce;
    } else if (s.x[i] > hi) {
      s.x[i] = hi;
      s.vx[i] = -Math.abs(s.vx[i]) * bounce;
    }
    if (s.y[i] < top) {
      s.y[i] = top;
      s.vy[i] = Math.abs(s.vy[i]) * bounce;
    } else if (s.y[i] > bottom) {
      s.y[i] = bottom;
      s.vy[i] = -Math.abs(s.vy[i]) * bounce;
    }
  }
}

/** The particle box. Positions are written straight to the SVG, never through React state. */
export function ParticleSim({
  liquid,
  gas,
  heat,
  width = 320,
  height = 190,
  n = 32,
  r = 8,
  cols = 8,
  seed = 1,
  fills,
  barrier = false,
  right,
  gravity = true,
  frame = true,
  onMix,
  label,
  className,
  children,
}: SimProps) {
  const reduce = useReducedMotion();
  const g: Geometry = { w: width, h: height, n, r, cols, seed };
  const wall = right ?? width;
  const [home] = useState(() => homes(g));
  const [rank] = useState(() => meltRank(g, home));
  const modes = modesOf(rank, liquid, gas);
  const [start] = useState(() => stillPicture(g, home, modes, barrier, wall));
  const svgRef = useRef<SVGSVGElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const live = useRef<Live>({ modes, heat, barrier, right: wall, gravity });
  const mixRef = useRef(onMix);
  const modesKey = modes.join("");

  useEffect(() => {
    live.current = { modes: modesKey.split("").map(Number), heat, barrier, right: wall, gravity };
    mixRef.current = onMix;
  });

  // Reduced motion: jump to the still picture of the current arrangement.
  useEffect(() => {
    if (!reduce) return;
    const geo: Geometry = { w: width, h: height, n, r, cols, seed };
    const pts = stillPicture(geo, home, modesKey.split("").map(Number), barrier, wall);
    pts.forEach((p, i) => {
      dots.current[i]?.setAttribute("cx", String(p.x));
      dots.current[i]?.setAttribute("cy", String(p.y));
    });
  }, [reduce, modesKey, barrier, wall, width, height, n, r, cols, seed, home]);

  // Motion: run the simulation while the box is visible.
  useEffect(() => {
    if (reduce) return;
    const svg = svgRef.current;
    if (!svg) return;
    const geo: Geometry = { w: width, h: height, n, r, cols, seed };
    const current = dots.current.map((c, i) => ({ x: Number(c?.getAttribute("cx") ?? start[i].x), y: Number(c?.getAttribute("cy") ?? start[i].y) }));
    const s = createState(current, seed, width);
    let raf = 0;
    let last = 0;
    let visible = false;
    let sampled = 0;
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const sub = 3;
      for (let k = 0; k < sub; k++) step(s, geo, home, live.current, dt / sub);
      for (let i = 0; i < n; i++) {
        const c = dots.current[i];
        if (!c) continue;
        c.setAttribute("cx", s.x[i].toFixed(1));
        c.setAttribute("cy", s.y[i].toFixed(1));
      }
      if (mixRef.current && now - sampled > 250) {
        sampled = now;
        let born = 0;
        let crossed = 0;
        for (let i = 0; i < n; i++) {
          if (s.side[i] < 0) {
            born++;
            if (s.x[i] > width / 2) crossed++;
          }
        }
        mixRef.current(born ? crossed / born : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      run();
    });
    io.observe(svg);
    document.addEventListener("visibilitychange", run);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", run);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce, width, height, n, r, cols, seed, home, start]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className={cn("block h-auto w-full", className)} role="img" aria-label={label}>
      {frame && <rect x={1} y={1} width={width - 2} height={height - 2} rx={12} fill="var(--surface)" stroke="var(--line-2)" strokeWidth={1.5} />}
      {children}
      {barrier && <rect x={width / 2 - 2} y={2} width={4} height={height - 4} rx={2} fill="var(--ink-3)" />}
      {start.map((p, i) => (
        <circle
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          cx={p.x}
          cy={p.y}
          r={r}
          fill={fills?.[i] ?? "var(--blob)"}
          stroke="color-mix(in oklab, var(--ink) 25%, transparent)"
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

/** A still picture of a state for small task visuals (no animation at all). */
export function ParticleStill({ state, seed = 1, label, className }: { state: 0 | 1 | 2; seed?: number; label: string; className?: string }) {
  return <ParticleSim liquid={state >= 1 ? 1 : 0} gas={state === 2 ? 1 : 0} heat={0.4} seed={seed} label={label} className={className} />;
}
