"use client";

// A stoma seen from below (Aufsicht auf die untere Epidermis): two bean-shaped guard cells
// with chloroplasts and a thickened wall along the pore, between wavy epidermis cells.
// `open` (0..1) opens the pore with a spring. Optional overlays for the opening mechanism:
// K⁺ ions moving in or out, water flowing in or out, the proton pump and abscisic acid.

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const CX = 180;
const CY = 130;

export const STOMA_PARTS: FigurePart[] = [
  {
    id: "guard",
    label: tx("guard cell", "Schließzelle"),
    at: [CX - 34, CY - 26],
    tag: [44, 34],
    info: tx("Bean-shaped and with chloroplasts. When it fills with water, it bends and opens the pore.", "Bohnenförmig und mit Chloroplasten. Nimmt sie Wasser auf, krümmt sie sich und öffnet den Spalt."),
  },
  {
    id: "pore",
    label: tx("pore (stoma)", "Spalt (Spaltöffnung)"),
    at: [CX, CY + 6],
    tag: [316, 214],
    info: tx("The opening between the two guard cells: gases and water vapour pass through it.", "Die Öffnung zwischen den beiden Schließzellen: Gase und Wasserdampf strömen hier hindurch."),
  },
  {
    id: "wall",
    label: tx("thickened inner wall", "verdickte Zellwand am Spalt"),
    at: [CX + 9, CY - 22],
    tag: [316, 40],
    info: tx("Thicker and less stretchy than the outer wall: that's why the guard cell bends outwards when it swells.", "Dicker und weniger dehnbar als die Außenwand: Darum krümmt sich die Schließzelle nach außen, wenn sie anschwillt."),
  },
  {
    id: "chloroplast",
    label: tx("chloroplast", "Chloroplast"),
    at: [CX + 30, CY + 18],
    tag: [316, 160],
    info: tx("Guard cells are the only cells of the epidermis with chloroplasts.", "Schließzellen sind die einzigen Zellen der Epidermis mit Chloroplasten."),
  },
  {
    id: "epidermis",
    label: tx("epidermis cell", "Epidermiszelle"),
    at: [70, 200],
    tag: [40, 228],
    info: tx("Wavy, tightly joined cells without chloroplasts.", "Gewellte, lückenlos verbundene Zellen ohne Chloroplasten."),
  },
];

/** Outer half-width/half-height of the stoma and the pore size for an opening 0..1. */
function geo(o: number) {
  return { a: 42 + 9 * o, b: 62 - 3 * o, L: 30 + 9 * o, p: 1.2 + 13 * o };
}
const r1 = (v: number) => Math.round(v * 10) / 10;

function cellPath(o: number, s: -1 | 1) {
  const { a, b, L, p } = geo(o);
  return `M${CX} ${r1(CY - b)} A${r1(a)} ${r1(b)} 0 0 ${s < 0 ? 0 : 1} ${CX} ${r1(CY + b)} L${CX} ${r1(CY + L)} Q${r1(CX + s * 2 * p)} ${CY} ${CX} ${r1(CY - L)} Z`;
}
function porePath(o: number) {
  const { L, p } = geo(o);
  return `M${CX} ${r1(CY - L)} Q${r1(CX - 2 * p)} ${CY} ${CX} ${r1(CY + L)} Q${r1(CX + 2 * p)} ${CY} ${CX} ${r1(CY - L)} Z`;
}
function wallPath(o: number, s: -1 | 1) {
  const { L, p } = geo(o);
  return `M${CX} ${r1(CY - L + 2)} Q${r1(CX + s * 2 * p)} ${CY} ${CX} ${r1(CY + L - 2)}`;
}
/** A point in the middle of guard cell `s` at height dy (to place chloroplasts, ions, nucleus). */
function inCell(o: number, s: -1 | 1, dy: number, f = 0.5) {
  const { a, b, L, p } = geo(o);
  const outer = a * Math.sqrt(Math.max(0, 1 - (dy / b) ** 2));
  const inner = Math.abs(dy) < L ? p * (1 - (dy / L) ** 2) : 0;
  return { x: r1(CX + s * (inner + (outer - inner) * f)), y: CY + dy };
}

/** Wavy cell walls of the epidermis around the stoma. */
const WALLS = (() => {
  const wavy = (x0: number, y0: number, x1: number, y1: number, amp = 3.2, waves = 3) => {
    const n = 18;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy);
    const nx = -dy / l;
    const ny = dx / l;
    let d = `M${r1(x0)} ${r1(y0)}`;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const w = Math.sin(t * Math.PI * 2 * waves) * amp * Math.sin(t * Math.PI);
      d += ` L${r1(x0 + dx * t + nx * w)} ${r1(y0 + dy * t + ny * w)}`;
    }
    return d;
  };
  const out: string[] = [];
  const ring = (deg: number, rx: number, ry: number) => [CX + Math.cos((deg * Math.PI) / 180) * rx, CY + Math.sin((deg * Math.PI) / 180) * ry];
  const spokes = [-80, -35, 12, 58, 100, 145, 192, 238];
  // walls from the stoma outwards
  for (const d of spokes) {
    const [x0, y0] = ring(d, 49, 62);
    const [x1, y1] = ring(d, 120, 108);
    out.push(wavy(x0, y0, x1, y1));
  }
  // an outer ring of walls, so the cells close up
  for (let i = 0; i < spokes.length; i++) {
    const a0 = spokes[i];
    const a1 = spokes[(i + 1) % spokes.length] + (i === spokes.length - 1 ? 360 : 0);
    const [x0, y0] = ring(a0, 120, 108);
    const [x1, y1] = ring(a1, 120, 108);
    out.push(wavy(x0, y0, x1, y1, 3.6, 2));
  }
  // walls from the outer ring to the frame
  for (const d of [-60, 0, 35, 80, 125, 170, 215, 262]) {
    const [x0, y0] = ring(d, 120, 108);
    const [x1, y1] = ring(d, 240, 200);
    out.push(wavy(x0, y0, x1, y1, 3.4, 4));
  }
  return out;
})();

/** Where each K⁺ ion sits inside a guard cell and outside in the neighbouring cells. */
const ION_DY = [-40, -26, -12, 2, 16, 30, 42];
const ionOut = (s: -1 | 1, i: number) => {
  const deg = (s < 0 ? 180 : 0) + (i - 3) * 17;
  return { x: r1(CX + Math.cos((deg * Math.PI) / 180) * (88 + (i % 2) * 12)), y: r1(CY + Math.sin((deg * Math.PI) / 180) * (86 + (i % 2) * 10)) };
};

export type StomaOverlay = {
  /** Share of the K⁺ ions that are inside the guard cells (0..1). */
  ions?: number;
  /** Water flowing into or out of the guard cells. */
  water?: "in" | "out" | null;
  /** The proton pump pushes H⁺ out of the guard cells. */
  pump?: boolean;
  /** Abscisic acid (ABA) arrives at the guard cells. */
  aba?: boolean;
};

const SPRING = { type: "spring", stiffness: 120, damping: 20 } as const;

/** The drawing without the Figure frame, so other widgets can embed it. */
export function PlantStomaBody({ open = 1, ions, water, pump, aba, uid }: StomaOverlay & { open?: number; uid: string }) {
  const reduce = useReducedMotion();
  const t = reduce ? { duration: 0 } : SPRING;
  const o = Math.max(0, Math.min(1, open));
  const head = `sh-${uid}`;
  return (
    <g>
      <defs>
        <marker id={`${head}-w`} viewBox="0 0 10 10" refX={5} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--bio-water-deep)" />
        </marker>
        <marker id={`${head}-h`} viewBox="0 0 10 10" refX={5} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--bio-blood)" />
        </marker>
      </defs>
      <g data-part="epidermis">
        <rect x={0} y={0} width={360} height={260} fill="var(--bio-cell)" />
        <g fill="none" stroke="var(--bio-wall-deep)" strokeWidth={1.6} strokeLinejoin="round">
          {WALLS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>
      <g data-part="pore">
        <motion.path initial={false} animate={{ d: porePath(o) }} transition={t} fill="var(--bio-outline)" fillOpacity={0.55} />
      </g>
      <g data-part="guard">
        {([-1, 1] as const).map((s) => (
          <motion.path key={s} initial={false} animate={{ d: cellPath(o, s) }} transition={t} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={2} strokeLinejoin="round" />
        ))}
        {([-1, 1] as const).map((s) => {
          const n = inCell(o, s, 8, 0.55);
          return <motion.ellipse key={`n${s}`} initial={false} animate={{ cx: n.x, cy: n.y }} transition={t} rx={6.5} ry={8} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.1} />;
        })}
      </g>
      <g data-part="wall">
        {([-1, 1] as const).map((s) => (
          <motion.path key={s} initial={false} animate={{ d: wallPath(o, s) }} transition={t} fill="none" stroke="var(--bio-wall-deep)" strokeWidth={5} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="chloroplast">
        {([-1, 1] as const).flatMap((s) =>
          [-40, -24, 22, 38].map((dy) => {
            const c = inCell(o, s, dy, 0.5);
            return <motion.ellipse key={`${s}${dy}`} initial={false} animate={{ cx: c.x, cy: c.y }} transition={t} rx={4.2} ry={3} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />;
          }),
        )}
      </g>

      {water && (
        <g stroke="var(--bio-water-deep)" strokeWidth={3} fill="none" strokeLinecap="round">
          {([-1, 1] as const).flatMap((s) =>
            [-22, 18].map((dy) => {
              const outer = { x: CX + s * 98, y: CY + dy * 1.6 };
              const inner = inCell(o, s, dy, 0.75);
              const [from, to] = water === "in" ? [outer, inner] : [inner, outer];
              return (
                <motion.path
                  key={`${s}${dy}`}
                  d={`M${from.x} ${from.y} L${r1(from.x + (to.x - from.x) * 0.8)} ${r1(from.y + (to.y - from.y) * 0.8)}`}
                  strokeDasharray="6 5"
                  markerEnd={`url(#${head}-w)`}
                  initial={false}
                  animate={reduce ? undefined : { strokeDashoffset: [22, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                />
              );
            }),
          )}
        </g>
      )}

      {pump && (
        <g stroke="var(--bio-blood)" strokeWidth={2.6} fill="none" strokeLinecap="round">
          {([-1, 1] as const).map((s) => {
            const from = inCell(o, s, -6, 0.9);
            return (
              <g key={s}>
                <path d={`M${from.x} ${from.y} l${s * 30} -12`} markerEnd={`url(#${head}-h)`} />
                <text x={from.x + s * 40} y={from.y - 18} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--bio-blood)" stroke="none" style={{ fontFamily: "var(--font-sans)" }}>
                  H⁺
                </text>
              </g>
            );
          })}
        </g>
      )}

      {ions !== undefined && (
        <g>
          {([-1, 1] as const).flatMap((s) =>
            ION_DY.map((dy, i) => {
              const inside = i < Math.round(ions * ION_DY.length);
              const p = inside ? inCell(o, s, dy, i % 2 ? 0.35 : 0.68) : ionOut(s, i);
              return (
                <motion.g key={`${s}${i}`} initial={false} animate={{ x: p.x, y: p.y }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 14, delay: i * 0.05 }}>
                  <circle r={6.2} fill="var(--bio-nerve)" stroke="var(--bio-nerve-deep)" strokeWidth={1.2} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={700} fill="var(--bio-outline)" style={{ fontFamily: "var(--font-sans)" }}>
                    K⁺
                  </text>
                </motion.g>
              );
            }),
          )}
        </g>
      )}

      {aba && (
        <g>
          {[
            [CX - 70, CY - 92],
            [CX + 66, CY + 96],
            [CX + 78, CY - 88],
          ].map(([x, y], i) => (
            <motion.g key={i} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.15 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <rect x={x - 15} y={y - 8} width={30} height={16} rx={8} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="var(--bio-nucleus-deep)" style={{ fontFamily: "var(--font-sans)" }}>
                ABA
              </text>
            </motion.g>
          ))}
        </g>
      )}
    </g>
  );
}

/** A stoma in surface view; `open` from 0 (closed) to 1 (wide open). */
export function PlantStoma({ mode = "names", show, ask, highlight, legend, open = 1, ...overlay }: DrawingProps & StomaOverlay & { open?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <Figure title={tx("A stoma seen from below", "Spaltöffnung in der Aufsicht")} width={360} height={260} parts={STOMA_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <PlantStomaBody uid={uid} open={open} {...overlay} />
    </Figure>
  );
}
