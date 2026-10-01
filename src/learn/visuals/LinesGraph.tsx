"use client";

import { motion, useSpring, useTransform, type MotionValue } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// A coordinate plane for the "lines" and "linear-systems" topics. Same look as
// <Graph>, but everything on it is driven by motion values: a line drawn
// through two springing points stays glued to them while they move, a slope
// triangle stays on its line, an intersection point stays on both lines.
// HTML labels (with real maths) float above the SVG at world coordinates.

export const TONE = {
  blob: "var(--blob)",
  ink: "var(--ink)",
  soft: "var(--ink-3)",
  ok: "var(--ok)",
  danger: "var(--danger)",
} as const;
export type Tone = keyof typeof TONE;

export type Pt = [number, number];
type Num = number | MotionValue<number>;
export const read = (v: Num) => (typeof v === "number" ? v : v.get());

/** The spring everything on the plane moves with. */
export const PLANE_SPRING = { stiffness: 210, damping: 25, mass: 0.9 };

/** A motion value that springs to `target` whenever the target changes. */
export function useSpringTo(target: number, config: { stiffness: number; damping: number; mass?: number } = PLANE_SPRING) {
  const value = useSpring(target, config);
  useEffect(() => {
    value.set(target);
  }, [value, target]);
  return value;
}

export type PlaneGeo = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  W: number;
  H: number;
  unit: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  /** Position in % of the plane box, for HTML overlays. */
  left: (x: number) => number;
  top: (y: number) => number;
  viewBox: string;
  aspect: string;
};

export function planeGeo([x0, x1]: Pt, [y0, y1]: Pt): PlaneGeo {
  const H = 100;
  const W = (100 * (x1 - x0)) / (y1 - y0);
  const vb = [-6, -4, W + 12, H + 10];
  const sx = (x: number) => ((x - x0) / (x1 - x0)) * W;
  const sy = (y: number) => H - ((y - y0) / (y1 - y0)) * H;
  return {
    x0,
    x1,
    y0,
    y1,
    W,
    H,
    unit: W / (x1 - x0),
    sx,
    sy,
    left: (x) => ((sx(x) - vb[0]) / vb[2]) * 100,
    top: (y) => ((sy(y) - vb[1]) / vb[3]) * 100,
    viewBox: vb.join(" "),
    aspect: `${vb[2]} / ${vb[3]}`,
  };
}

/** The piece of the infinite line through `p` with direction `d` inside the box [x0, x1] × [y0, y1] (Liang–Barsky). */
export function clipLine(p: Pt, d: Pt, [x0, x1, y0, y1]: [number, number, number, number]): [Pt, Pt] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const edges: [number, number][] = [
    [-d[0], p[0] - x0],
    [d[0], x1 - p[0]],
    [-d[1], p[1] - y0],
    [d[1], y1 - p[1]],
  ];
  for (const [a, b] of edges) {
    if (Math.abs(a) < 1e-12) {
      if (b < 0) return null;
      continue;
    }
    const r = b / a;
    if (a < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
  }
  if (!(t0 < t1) || !Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return [
    [p[0] + t0 * d[0], p[1] + t0 * d[1]],
    [p[0] + t1 * d[0], p[1] + t1 * d[1]],
  ];
}

/** Where two lines (point + direction) cross, or null when they're (nearly) parallel. */
export function crossing(p: Pt, d: Pt, q: Pt, e: Pt): Pt | null {
  const det = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(det) < 1e-6) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / det;
  return [p[0] + t * d[0], p[1] + t * d[1]];
}

type Ctx = {
  geo: PlaneGeo;
  clip: string;
  dragging: string | null;
  grab: (id: string, e: React.PointerEvent) => void;
  move?: (id: string, p: Pt) => void;
};

const PlaneContext = createContext<Ctx | null>(null);

function usePlane() {
  const ctx = useContext(PlaneContext);
  if (!ctx) throw new Error("Use inside <Plane>");
  return ctx;
}

/** Inside the visible box (with a little margin)? */
export function inside(geo: PlaneGeo, p: Pt | null, margin = 0): p is Pt {
  return !!p && p[0] >= geo.x0 - margin && p[0] <= geo.x1 + margin && p[1] >= geo.y0 - margin && p[1] <= geo.y1 + margin;
}

/** A coordinate plane. SVG children draw on it, `overlay` holds HTML labels. */
export function Plane({
  xRange = [-5, 5],
  yRange = [-5, 5],
  onMove,
  children,
  overlay,
  className,
  label = "Coordinate plane",
}: {
  xRange?: Pt;
  yRange?: Pt;
  /** Called while a handle is dragged (or moved with the arrow keys), with the snapped grid point. */
  onMove?: (id: string, p: Pt) => void;
  children?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  label?: string;
}) {
  const geo = planeGeo(xRange, yRange);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const last = useRef("");
  const [dragging, setDragging] = useState<string | null>(null);
  const { x0, x1, y0, y1, sx, sy, W, H } = geo;

  function world(e: React.PointerEvent): Pt | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.round(x0 + (p.x / W) * (x1 - x0));
    const y = Math.round(y0 + ((H - p.y) / H) * (y1 - y0));
    return [Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))];
  }

  function grab(id: string, e: React.PointerEvent) {
    if (!onMove) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    last.current = "";
    setDragging(id);
  }

  const ticksX: number[] = [];
  for (let x = Math.ceil(x0); x <= x1; x++) ticksX.push(x);
  const ticksY: number[] = [];
  for (let y = Math.ceil(y0); y <= y1; y++) ticksY.push(y);
  const showX = y0 <= 0 && y1 >= 0;
  const showY = x0 <= 0 && x1 >= 0;
  const clip = `plane-clip-${uid}`;
  const arrow = `plane-arrow-${uid}`;

  return (
    <PlaneContext.Provider value={{ geo, clip, dragging, grab, move: onMove }}>
      <div className={cn("relative w-full select-none", onMove && "touch-none", className)} style={{ aspectRatio: geo.aspect }}>
        <svg
          ref={svgRef}
          viewBox={geo.viewBox}
          className="absolute inset-0 size-full overflow-visible"
          role="group"
          aria-label={label}
          onPointerMove={(e) => {
            if (!dragging || !onMove) return;
            const p = world(e);
            if (!p) return;
            const sig = `${dragging}:${p[0]},${p[1]}`;
            if (sig === last.current) return;
            last.current = sig;
            onMove(dragging, p);
          }}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
          onLostPointerCapture={() => setDragging(null)}
        >
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={0} width={W} height={H} />
            </clipPath>
            <marker id={arrow} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
            </marker>
          </defs>

          <g stroke="var(--line)" strokeWidth={0.25}>
            {ticksX.map((x) => (
              <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} />
            ))}
            {ticksY.map((y) => (
              <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} />
            ))}
          </g>
          {showX && <line x1={0} x2={W + 3} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={0.45} markerEnd={`url(#${arrow})`} />}
          {showY && <line x1={sx(0)} x2={sx(0)} y1={H} y2={-3} stroke="var(--ink-3)" strokeWidth={0.45} markerEnd={`url(#${arrow})`} />}
          <g fontSize={3.1} fill="var(--ink-3)" fontFamily="var(--font-math)">
            {ticksX
              .filter((x) => x !== 0)
              .map((x) => (
                <text key={`lx${x}`} x={sx(x)} y={Math.min(H - 1, Math.max(4, sy(0) + 4.4))} textAnchor="middle">
                  {String(x).replace("-", "−")}
                </text>
              ))}
            {ticksY
              .filter((y) => y !== 0)
              .map((y) => (
                <text key={`ly${y}`} x={Math.min(W - 1, Math.max(3, sx(0) - 1.6))} y={sy(y) + 1.1} textAnchor="end">
                  {String(y).replace("-", "−")}
                </text>
              ))}
            <text x={W + 4} y={sy(0) + 1.2} fontStyle="italic" fontSize={3.8}>
              x
            </text>
            <text x={sx(0) + 1.6} y={-2.6} fontStyle="italic" fontSize={3.8}>
              y
            </text>
          </g>
          {children}
        </svg>
        <div className="pointer-events-none absolute inset-0">{overlay}</div>
      </div>
    </PlaneContext.Provider>
  );
}

/** A path through world points that may move every frame. `shape` reads motion values. */
export function PlanePath({
  shape,
  closed,
  stroke,
  fill = "none",
  width = 0.9,
  dashed,
  clip = true,
  draw,
  opacity = 1,
}: {
  shape: () => Pt[] | null;
  closed?: boolean;
  stroke?: string;
  fill?: string;
  width?: number;
  dashed?: boolean;
  clip?: boolean;
  /** Draw the stroke in when it first appears. */
  draw?: boolean;
  opacity?: number;
}) {
  const { geo, clip: clipId } = usePlane();
  const d = useTransform(() => {
    const pts = shape();
    if (!pts || pts.length < 2 || pts.some((p) => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return "M0 0";
    return pts.map((p, i) => `${i ? "L" : "M"}${geo.sx(p[0]).toFixed(2)} ${geo.sy(p[1]).toFixed(2)}`).join(" ") + (closed ? " Z" : "");
  });
  return (
    <motion.path
      d={d}
      fill={fill}
      stroke={stroke ?? "none"}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "1.8 1.3" : undefined}
      clipPath={clip ? `url(#${clipId})` : undefined}
      initial={draw ? { pathLength: 0, opacity } : false}
      animate={draw ? { pathLength: 1, opacity } : { opacity }}
      transition={{ pathLength: { duration: 0.8, ease: "easeOut" }, opacity: { duration: 0.3 } }}
    />
  );
}

/** The whole straight line through a point in a direction, cut to the plane. */
export function PlaneLine({
  through,
  tone = "blob",
  width = 1,
  dashed,
  opacity,
  draw = true,
}: {
  /** Returns a point on the line and a direction. */
  through: () => [Pt, Pt];
  tone?: Tone;
  width?: number;
  dashed?: boolean;
  opacity?: number;
  draw?: boolean;
}) {
  const { geo } = usePlane();
  const box: [number, number, number, number] = [geo.x0 - 1, geo.x1 + 1, geo.y0 - 1, geo.y1 + 1];
  return (
    <PlanePath
      shape={() => {
        const [p, d] = through();
        return clipLine(p, d, box);
      }}
      stroke={TONE[tone]}
      width={width}
      dashed={dashed}
      opacity={opacity}
      draw={draw}
    />
  );
}

/** A dot (or ring) at a moving world point. Hidden while `at` returns null. */
export function PlaneDot({ at, tone = "blob", r = 1.25, hollow, pulse }: { at: () => Pt | null; tone?: Tone; r?: number; hollow?: boolean; pulse?: string | number }) {
  const { geo } = usePlane();
  const cx = useTransform(() => {
    const p = at();
    return p ? geo.sx(p[0]) : -50;
  });
  const cy = useTransform(() => {
    const p = at();
    return p ? geo.sy(p[1]) : -50;
  });
  const shown = useTransform(() => (inside(geo, at(), 0.01) ? 1 : 0));
  const color = TONE[tone];
  return (
    <motion.g style={{ opacity: shown }}>
      {pulse !== undefined && (
        <motion.circle
          key={String(pulse)}
          cx={cx}
          cy={cy}
          fill="none"
          stroke={color}
          strokeWidth={0.5}
          initial={{ r, opacity: 0.7 }}
          animate={{ r: r * 4.5, opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.25 }}
        />
      )}
      <motion.circle cx={cx} cy={cy} r={r} fill={hollow ? "var(--raised)" : color} stroke={color} strokeWidth={hollow ? 0.55 : 0} />
    </motion.g>
  );
}

/** A point the student drags around the grid (or moves with the arrow keys when focused). */
export function PlaneHandle({ id, x, y, at, tone = "blob", label, hint }: { id: string; x: MotionValue<number>; y: MotionValue<number>; at: Pt; tone?: Tone; label: string; hint?: boolean }) {
  const { geo, dragging, grab, move } = usePlane();
  const [focus, setFocus] = useState(false);
  const cx = useTransform(() => geo.sx(x.get()));
  const cy = useTransform(() => geo.sy(y.get()));
  const active = dragging === id;
  const color = TONE[tone];
  const halo = geo.unit * 0.5;
  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={`${label}: drag it, or use the arrow keys`}
      style={{ cursor: active ? "grabbing" : "grab", outline: "none" }}
      onPointerDown={(e) => grab(id, e)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onKeyDown={(e) => {
        const step: Record<string, Pt> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        const s = step[e.key];
        if (!s || !move) return;
        e.preventDefault();
        // Keep the lesson's ← → navigation from also reacting.
        e.stopPropagation();
        const nx = Math.min(geo.x1, Math.max(geo.x0, at[0] + s[0]));
        const ny = Math.min(geo.y1, Math.max(geo.y0, at[1] + s[1]));
        move(id, [nx, ny]);
      }}
    >
      {hint && !active && (
        <motion.circle
          cx={cx}
          cy={cy}
          fill="none"
          stroke={color}
          strokeWidth={0.45}
          initial={{ r: halo * 0.8, opacity: 0.6 }}
          animate={{ r: halo * 1.9, opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <motion.circle cx={cx} cy={cy} fill={color} initial={false} animate={{ r: active ? halo * 1.25 : halo, opacity: active ? 0.24 : 0.13 }} />
      {focus && <motion.circle cx={cx} cy={cy} r={halo * 1.15} fill="none" stroke={color} strokeWidth={0.5} />}
      <motion.circle cx={cx} cy={cy} r={1.7} fill={color} />
      <motion.circle cx={cx} cy={cy} r={0.65} fill="var(--raised)" />
    </g>
  );
}

/** An HTML label pinned to a moving world point, nudged by (dx, dy) pixels. */
export function PlaneTag({
  at,
  dx = 0,
  dy = 0,
  anchor = "center",
  children,
  className,
}: {
  at: () => Pt | null;
  dx?: number;
  dy?: number;
  /** Which side of the label sits at the point. */
  anchor?: "center" | "left" | "right";
  children: ReactNode;
  className?: string;
}) {
  const { geo } = usePlane();
  const shiftX = anchor === "center" ? "-50%" : anchor === "left" ? "0%" : "-100%";
  const left = useTransform(() => {
    const p = at();
    return `${p ? geo.left(p[0]) : -40}%`;
  });
  const top = useTransform(() => {
    const p = at();
    return `${p ? geo.top(p[1]) : -40}%`;
  });
  const opacity = useTransform(() => (inside(geo, at(), 0.2) ? 1 : 0));
  return (
    <motion.div className="absolute size-0 transition-opacity duration-200" style={{ left, top, opacity }}>
      <div
        className={cn("absolute left-0 top-0 w-max whitespace-nowrap rounded-md bg-raised/85 px-1.5 py-0.5 text-[14px] leading-none shadow-[0_0_0_1px_var(--line)] backdrop-blur-[2px]", className)}
        style={{ transform: `translate(calc(${shiftX} + ${dx}px), calc(-50% + ${dy}px))` }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/** A point along the visible part of a line, `t` of the way from its left end (for line labels). */
export function alongLine(geo: PlaneGeo, p: Pt, d: Pt, t: number): Pt | null {
  const seg = clipLine(p, d, [geo.x0 + 0.3, geo.x1 - 0.3, geo.y0 + 0.3, geo.y1 - 0.3]);
  if (!seg) return null;
  const [a, b] = seg[0][0] <= seg[1][0] ? seg : [seg[1], seg[0]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Read the plane geometry from inside a <Plane> (for shapes that need the box). */
export function usePlaneGeo() {
  return usePlane().geo;
}

// ---------------------------------------------------------------------------
// A slider over a list of values (e.g. nice slopes). Drag, click or use the
// arrow keys; the thumb and the filled part spring to each stop.

export function StepSlider({
  value,
  count,
  onChange,
  label,
  valueText,
  zero = 0,
  tone = "blob",
}: {
  value: number;
  count: number;
  onChange: (index: number) => void;
  label: string;
  valueText?: string;
  /** Index the fill starts from (the middle for signed values). */
  zero?: number;
  tone?: "blob" | "ink";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const pct = (i: number) => (count > 1 ? (i / (count - 1)) * 100 : 0);
  const from = Math.min(pct(zero), pct(value));
  const to = Math.max(pct(zero), pct(value));
  const spring = { type: "spring" as const, stiffness: 420, damping: 32 };
  const color = tone === "blob" ? "var(--blob)" : "var(--ink)";

  function pick(clientX: number) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const t = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const i = Math.round(t * (count - 1));
    if (i !== value) onChange(i);
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count - 1}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className="group relative h-8 cursor-pointer touch-pan-y select-none rounded-full outline-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        pick(e.clientX);
      }}
      onPointerMove={(e) => {
        if (drag) pick(e.clientX);
      }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      onKeyDown={(e) => {
        const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? value + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? value - 1 : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
        if (next === null) return;
        e.preventDefault();
        e.stopPropagation();
        const i = Math.min(count - 1, Math.max(0, next));
        if (i !== value) onChange(i);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line-2" style={{ left: `${pct(i)}%` }} />
      ))}
      <motion.div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{ background: color }}
        initial={false}
        animate={{ left: `${from}%`, width: `${to - from}%` }}
        transition={spring}
      />
      <motion.div
        className="absolute top-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] bg-raised shadow-[0_1px_4px_rgb(0_0_0/0.18)] group-focus-visible:ring-4 group-focus-visible:ring-blob/25"
        style={{ borderColor: color }}
        initial={false}
        animate={{ left: `${pct(value)}%`, scale: drag ? 1.18 : 1 }}
        transition={spring}
      />
    </div>
  );
}
