"use client";

import { motion, useReducedMotion } from "motion/react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { element, valenceElectrons } from "../elements";
import { cos, sin } from "@/lib/stableMath";

// Lewis structures (Lewis-Formeln / Valenzstrichformeln) drawn as SVG: element symbols,
// bonding pairs as lines or dots, lone pairs as dots or short strokes. The same molecule can
// also be shown "apart": separate atoms with their outer electrons, which then move together
// so the single electrons pair up into shared bonds.

/** Angles in degrees, SVG style: 0 = right, 90 = down, 180 = left, 270 = up. */
export type LewisAtom = { el: string; x: number; y: number; lone: number[] };
export type LewisBond = { a: number; b: number; order: 1 | 2 | 3 };
export type Molecule = { id: string; formula: string; name: Text; atoms: LewisAtom[]; bonds: LewisBond[]; shape?: Text };

const H = (x: number, y: number): LewisAtom => ({ el: "H", x, y, lone: [] });
const A = (el: string, x: number, y: number, lone: number[] = []): LewisAtom => ({ el, x, y, lone });
const b = (a: number, bb: number, order: 1 | 2 | 3 = 1): LewisBond => ({ a, b: bb, order });

const LEFT3 = [180, 270, 90];
const RIGHT3 = [0, 270, 90];
const DOWN3 = [90, 180, 0];
const UP3 = [270, 180, 0];

const diatomic = (id: string, el: string, name: Text): Molecule => ({ id, formula: `${el}2`, name, atoms: [A(el, -0.5, 0, LEFT3), A(el, 0.5, 0, RIGHT3)], bonds: [b(0, 1)], shape: tx("linear", "linear") });
const hx = (id: string, el: string, name: Text): Molecule => ({ id, formula: `H${el}`, name, atoms: [H(-0.5, 0), A(el, 0.5, 0, RIGHT3)], bonds: [b(0, 1)], shape: tx("linear", "linear") });
const bent = (id: string, el: string, name: Text): Molecule => ({
  id,
  formula: `H2${el}`,
  name,
  atoms: [A(el, 0, 0, [215, 325]), H(-0.79, 0.61), H(0.79, 0.61)],
  bonds: [b(0, 1), b(0, 2)],
  shape: tx("bent", "gewinkelt"),
});
const pyramid = (id: string, center: string, outer: string, name: Text): Molecule => {
  const lone = outer === "H" ? [[], [], []] : [LEFT3, RIGHT3, DOWN3];
  return {
    id,
    formula: `${center}${outer}3`,
    name,
    atoms: [A(center, 0, 0, [270]), A(outer, -1, 0, lone[0]), A(outer, 1, 0, lone[1]), A(outer, 0, 1, lone[2])],
    bonds: [b(0, 1), b(0, 2), b(0, 3)],
    shape: tx("trigonal pyramidal", "trigonal-pyramidal"),
  };
};
const tetra = (id: string, center: string, outer: string, name: Text): Molecule => {
  const lone = outer === "H" ? [[], [], [], []] : [RIGHT3, DOWN3, LEFT3, UP3];
  return {
    id,
    formula: `${center}${outer}4`,
    name,
    atoms: [A(center, 0, 0), A(outer, 1, 0, lone[0]), A(outer, 0, 1, lone[1]), A(outer, -1, 0, lone[2]), A(outer, 0, -1, lone[3])],
    bonds: [b(0, 1), b(0, 2), b(0, 3), b(0, 4)],
    shape: tx("tetrahedral", "tetraedrisch"),
  };
};
const linear3 = (id: string, outer: string, name: Text): Molecule => ({
  id,
  formula: `C${outer}2`,
  name,
  atoms: [A(outer, -1, 0, [225, 135]), A("C", 0, 0), A(outer, 1, 0, [315, 45])],
  bonds: [b(0, 1, 2), b(1, 2, 2)],
  shape: tx("linear", "linear"),
});

export const MOLECULES: Record<string, Molecule> = Object.fromEntries(
  [
    { id: "H2", formula: "H2", name: tx("hydrogen", "Wasserstoff"), atoms: [H(-0.5, 0), H(0.5, 0)], bonds: [b(0, 1)], shape: tx("linear", "linear") },
    diatomic("F2", "F", tx("fluorine", "Fluor")),
    diatomic("Cl2", "Cl", tx("chlorine", "Chlor")),
    diatomic("Br2", "Br", tx("bromine", "Brom")),
    diatomic("I2", "I", tx("iodine", "Iod")),
    { id: "O2", formula: "O2", name: tx("oxygen", "Sauerstoff"), atoms: [A("O", -0.5, 0, [225, 135]), A("O", 0.5, 0, [315, 45])], bonds: [b(0, 1, 2)], shape: tx("linear", "linear") },
    { id: "N2", formula: "N2", name: tx("nitrogen", "Stickstoff"), atoms: [A("N", -0.5, 0, [180]), A("N", 0.5, 0, [0])], bonds: [b(0, 1, 3)], shape: tx("linear", "linear") },
    hx("HF", "F", tx("hydrogen fluoride", "Fluorwasserstoff")),
    hx("HCl", "Cl", tx("hydrogen chloride", "Chlorwasserstoff")),
    hx("HBr", "Br", tx("hydrogen bromide", "Bromwasserstoff")),
    bent("H2O", "O", tx("water", "Wasser")),
    bent("H2S", "S", tx("hydrogen sulfide", "Schwefelwasserstoff")),
    pyramid("NH3", "N", "H", tx("ammonia", "Ammoniak")),
    pyramid("PH3", "P", "H", tx("phosphine", "Phosphan")),
    pyramid("NCl3", "N", "Cl", tx("nitrogen trichloride", "Stickstofftrichlorid")),
    pyramid("PCl3", "P", "Cl", tx("phosphorus trichloride", "Phosphortrichlorid")),
    tetra("CH4", "C", "H", tx("methane", "Methan")),
    tetra("SiH4", "Si", "H", tx("silane", "Silan")),
    tetra("CCl4", "C", "Cl", tx("tetrachloromethane", "Tetrachlormethan")),
    linear3("CO2", "O", tx("carbon dioxide", "Kohlenstoffdioxid")),
    linear3("CS2", "S", tx("carbon disulfide", "Kohlenstoffdisulfid")),
    {
      id: "HCN",
      formula: "HCN",
      name: tx("hydrogen cyanide", "Cyanwasserstoff"),
      atoms: [H(-1, 0), A("C", 0, 0), A("N", 1, 0, [0])],
      bonds: [b(0, 1), b(1, 2, 3)],
      shape: tx("linear", "linear"),
    },
  ].map((m) => [m.id, m]),
);

// ---------------------------------------------------------------------------
// Counting helpers (also used by the generator)

export const bondPairs = (m: Molecule) => m.bonds.reduce((s, x) => s + x.order, 0);
export const lonePairs = (m: Molecule) => m.atoms.reduce((s, x) => s + x.lone.length, 0);
export const valenceTotal = (m: Molecule) => m.atoms.reduce((s, x) => s + (valenceElectrons(element(x.el)!) ?? 0), 0);
/** Electrons around an atom in the structure (shared pairs count for both atoms): 8, or 2 for H. */
export const electronsAround = (m: Molecule, i: number) => 2 * m.atoms[i].lone.length + 2 * m.bonds.filter((x) => x.a === i || x.b === i).reduce((s, x) => s + x.order, 0);

// ---------------------------------------------------------------------------
// Rendering

export type PairStyle = "dots" | "lewis" | "lines";

type Props = {
  mol: string;
  /** Atoms joined (default) or apart with single electrons. */
  bonded?: boolean;
  /** "dots": every electron a dot; "lewis": bond lines, lone pairs as dots; "lines": Valenzstrichformel. */
  pairStyle?: PairStyle;
  lonePairs?: boolean;
  /** Dashed rings with the electron count around each atom. */
  octet?: boolean;
  /** δ+ / δ− labels from electronegativity. */
  partial?: boolean;
  /** Rings at the centres of positive and negative partial charge. */
  centres?: boolean;
  /** Pixels per bond length. */
  unit?: number;
  className?: string;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const rad = (deg: number) => (deg * Math.PI) / 180;
const SPREAD = 1.75;
const DOT = 0.052;

/** Distance from an atom's centre to its lone pairs / bond ends: wider sideways for two-letter symbols. */
const reach = (el: string, angle: number, base: number) => base + (el.length > 1 ? 0.13 : 0.03) * Math.abs(cos(rad(angle)));

const spring = { type: "spring" as const, stiffness: 170, damping: 22 };

export function LewisStructure({ mol, bonded = true, pairStyle = "lewis", lonePairs: showLone = true, octet = false, partial = false, centres = false, unit = 64, className }: Props) {
  const t = useText();
  const reduce = useReducedMotion();
  const m = MOLECULES[mol];
  if (!m) return null;
  const cx = m.atoms.reduce((s, a) => s + a.x, 0) / m.atoms.length;
  const cy = m.atoms.reduce((s, a) => s + a.y, 0) / m.atoms.length;
  const pos = (i: number, apart: boolean) => {
    const a = m.atoms[i];
    const k = apart ? SPREAD : 1;
    return { x: cx + (a.x - cx) * k, y: cy + (a.y - cy) * k };
  };
  const apart = !bonded;

  // Bounds over both states, so the picture doesn't jump when atoms move.
  const pts = m.atoms.flatMap((_, i) => [pos(i, false), pos(i, true)]);
  const pad = 0.78;
  const minX = Math.min(...pts.map((p) => p.x)) - pad;
  const maxX = Math.max(...pts.map((p) => p.x)) + pad;
  const minY = Math.min(...pts.map((p) => p.y)) - pad;
  const maxY = Math.max(...pts.map((p) => p.y)) + pad;
  const W = (maxX - minX) * unit;
  const Hh = (maxY - minY) * unit;
  const X = (x: number) => r2((x - minX) * unit);
  const Y = (y: number) => r2((y - minY) * unit);

  // Partial charges from electronegativity (only for clearly polar bonds).
  const en = (el: string) => element(el)?.en ?? 0;
  const delta = m.atoms.map((a, i) => {
    let s = 0;
    for (const bd of m.bonds) {
      if (bd.a !== i && bd.b !== i) continue;
      const other = m.atoms[bd.a === i ? bd.b : bd.a];
      const d = en(a.el) - en(other.el);
      if (Math.abs(d) >= 0.45) s += Math.sign(d);
    }
    return s;
  });

  const centreOf = (sign: number) => {
    const list = m.atoms.map((a, i) => ({ ...pos(i, false), d: delta[i] })).filter((a) => Math.sign(a.d) === sign);
    if (!list.length) return null;
    return { x: list.reduce((s, a) => s + a.x, 0) / list.length, y: list.reduce((s, a) => s + a.y, 0) / list.length };
  };
  const plusC = centreOf(-1);
  // δ labels go where there is room: away from bonds and lone pairs, preferably above.
  const labelAngle = m.atoms.map((a, i) => {
    const taken = [
      ...a.lone,
      ...m.bonds
        .filter((bd) => bd.a === i || bd.b === i)
        .map((bd) => {
          const o = m.atoms[bd.a === i ? bd.b : bd.a];
          return (Math.atan2(o.y - a.y, o.x - a.x) * 180) / Math.PI;
        }),
    ];
    const gap = (x: number, y: number) => {
      const d = Math.abs(((x - y) % 360) + 360) % 360;
      return Math.min(d, 360 - d);
    };
    const order = [270, 300, 240, 315, 225, 330, 210, 30, 150, 45, 135, 60, 120, 90, 0, 180];
    const room = (cand: number) => (taken.length ? Math.min(...taken.map((x) => gap(cand, x))) : 180);
    // The first direction (in order of preference) with plenty of room, else the roomiest.
    return order.find((cand) => room(cand) >= 75) ?? order.reduce((bestA, cand) => (room(cand) > room(bestA) + 1 ? cand : bestA), order[0]);
  });
  const minusC = centreOf(1);

  const dotsFor = (cxp: number, cyp: number, angle: number, sep: number) => {
    const px = -sin(rad(angle));
    const py = cos(rad(angle));
    return [
      { x: cxp + px * sep, y: cyp + py * sep },
      { x: cxp - px * sep, y: cyp - py * sep },
    ];
  };

  const sym = (el: string) => (el.length > 1 ? 0.36 : 0.4);

  return (
    <svg viewBox={`0 0 ${r2(W)} ${r2(Hh)}`} className={cn("block h-auto max-w-full", className)} style={{ width: r2(W) }} role="img" aria-label={t(tx(`Lewis structure of ${EN(m.name)}`, `Lewis-Formel von ${DE(m.name)}`))}>
      {/* centres of partial charge (behind everything else) */}
      {[
        { c: plusC, key: "plus", r: 0.24, dash: "4 4", stroke: "var(--ink-2)", fill: "color-mix(in oklab, var(--ink) 7%, transparent)" },
        { c: minusC, key: "minus", r: 0.4, dash: undefined, stroke: "var(--blob)", fill: "color-mix(in oklab, var(--blob) 12%, transparent)" },
      ].map(
        (k) =>
          k.c && (
            <motion.circle
              key={k.key}
              cx={X(k.c.x)}
              cy={Y(k.c.y)}
              r={k.r * unit}
              fill={k.fill}
              stroke={k.stroke}
              strokeWidth={2}
              strokeDasharray={k.dash}
              initial={false}
              animate={{ opacity: centres && bonded ? 1 : 0 }}
              transition={{ duration: 0.35, delay: centres ? 0.2 : 0 }}
            />
          ),
      )}

      {/* octet rings */}
      {m.atoms.map((a, i) => {
        const p = pos(i, false);
        const n = electronsAround(m, i);
        const r = a.el === "H" ? 0.5 : 0.66;
        return (
          <motion.g key={`ring-${i}`} initial={false} animate={{ opacity: octet && bonded ? 1 : 0 }} transition={{ duration: 0.35, delay: octet ? 0.15 + i * 0.08 : 0 }}>
            <circle cx={X(p.x)} cy={Y(p.y)} r={r * unit} fill="color-mix(in oklab, var(--blob) 7%, transparent)" stroke="var(--blob)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 5" />
            <g transform={`translate(${X(p.x + cos(rad(labelAngle[i])) * r)} ${Y(p.y + sin(rad(labelAngle[i])) * r)})`}>
              <circle r={0.17 * unit} fill="var(--blob)" />
              <text textAnchor="middle" dominantBaseline="central" className="fill-white font-semibold" style={{ fontSize: 0.2 * unit }}>
                {n}
              </text>
            </g>
          </motion.g>
        );
      })}

      {/* bonds: lines */}
      {m.bonds.map((bd, k) => {
        const pa = pos(bd.a, false);
        const pb = pos(bd.b, false);
        const ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
        const ux = cos(rad(ang));
        const uy = sin(rad(ang));
        const ga = reach(m.atoms[bd.a].el, ang, 0.24);
        const gb = reach(m.atoms[bd.b].el, ang, 0.24);
        const showLines = bonded && pairStyle !== "dots";
        return Array.from({ length: bd.order }, (_, j) => {
          const off = (j - (bd.order - 1) / 2) * 0.15;
          const ox = -uy * off;
          const oy = ux * off;
          const x1 = X(pa.x + ux * ga + ox);
          const y1 = Y(pa.y + uy * ga + oy);
          const x2 = X(pb.x - ux * gb + ox);
          const y2 = Y(pb.y - uy * gb + oy);
          return (
            <motion.line
              key={`bl-${k}-${j}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--ink)"
              strokeWidth={0.045 * unit}
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: showLines ? 1 : 0, opacity: showLines ? 1 : 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.45, delay: showLines ? 0.35 + j * 0.08 : 0 }}
            />
          );
        });
      })}

      {/* bonds: the two electrons of each shared pair */}
      {m.bonds.map((bd, k) => {
        const showDots = apart || pairStyle === "dots";
        return Array.from({ length: bd.order }, (_, j) => {
          const off = (j - (bd.order - 1) / 2) * 0.17;
          return [bd.a, bd.b].map((atom, side) => {
            const other = side === 0 ? bd.b : bd.a;
            const pa = pos(atom, apart);
            const pb = pos(other, apart);
            const ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
            const ux = cos(rad(ang));
            const uy = sin(rad(ang));
            let x: number;
            let y: number;
            if (apart) {
              const rr = reach(m.atoms[atom].el, ang, 0.33);
              x = pa.x + ux * rr - uy * off * 1.3;
              y = pa.y + uy * rr + ux * off * 1.3;
            } else {
              const mx = (pa.x + pb.x) / 2;
              const my = (pa.y + pb.y) / 2;
              x = mx - ux * 0.07 - uy * off;
              y = my - uy * 0.07 + ux * off;
            }
            return (
              <motion.circle
                key={`be-${k}-${j}-${side}`}
                r={DOT * unit}
                fill="var(--blob)"
                initial={false}
                animate={{ cx: X(x), cy: Y(y), opacity: showDots ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : spring}
              />
            );
          });
        });
      })}

      {/* lone pairs */}
      {m.atoms.map((a, i) =>
        a.lone.map((angle, k) => {
          const p = pos(i, apart);
          const rr = reach(a.el, angle, 0.33);
          const c = { x: p.x + cos(rad(angle)) * rr, y: p.y + sin(rad(angle)) * rr };
          const dots = dotsFor(c.x, c.y, angle, 0.075);
          const asLine = bonded && pairStyle === "lines";
          const visible = showLone;
          const ends = dotsFor(c.x, c.y, angle, 0.13);
          return (
            <g key={`lp-${i}-${k}`}>
              {dots.map((d, n) => (
                <motion.circle
                  key={n}
                  r={DOT * unit}
                  fill="var(--ink)"
                  initial={false}
                  animate={{ cx: X(d.x), cy: Y(d.y), opacity: visible && !asLine ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : spring}
                />
              ))}
              <motion.line
                stroke="var(--ink)"
                strokeWidth={0.045 * unit}
                strokeLinecap="round"
                initial={false}
                animate={{ x1: X(ends[0].x), y1: Y(ends[0].y), x2: X(ends[1].x), y2: Y(ends[1].y), opacity: visible && asLine ? 1 : 0 }}
                transition={reduce ? { duration: 0 } : spring}
              />
            </g>
          );
        }),
      )}

      {/* atoms */}
      {m.atoms.map((a, i) => {
        const p = pos(i, apart);
        const d = delta[i];
        return (
          <motion.g key={`at-${i}`} initial={false} animate={{ x: X(p.x), y: Y(p.y) }} transition={reduce ? { duration: 0 } : spring}>
            <text textAnchor="middle" dominantBaseline="central" className="fill-ink font-math" style={{ fontSize: sym(a.el) * unit }}>
              {a.el}
            </text>
            <motion.text
              x={r2(cos(rad(labelAngle[i])) * (a.el.length > 1 ? 0.56 : 0.5) * unit)}
              y={r2(sin(rad(labelAngle[i])) * 0.5 * unit)}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-blob-ink font-math"
              style={{ fontSize: 0.24 * unit }}
              initial={false}
              animate={{ opacity: partial && bonded && d !== 0 ? 1 : 0 }}
            >
              {d < 0 ? "δ+" : "δ−"}
            </motion.text>
          </motion.g>
        );
      })}
    </svg>
  );
}

const EN = (t: Text) => (typeof t === "string" ? t : t.en);
const DE = (t: Text) => (typeof t === "string" ? t : t.de);

/** Task visual: a Lewis structure, centred, optionally without lone pairs (to fill in). */
export function CovalentBondsLewisVisual(props: Record<string, unknown>) {
  const t = useText();
  const m = MOLECULES[String(props.mol)];
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <LewisStructure mol={String(props.mol)} lonePairs={props.lonePairs !== false} unit={Number(props.unit ?? 76)} partial={props.partial === true} />
      {props.caption !== false && m && <div className="text-[13px] text-ink-3">{t(m.name)}</div>}
    </div>
  );
}
