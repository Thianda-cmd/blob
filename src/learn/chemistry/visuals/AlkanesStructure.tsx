"use client";

import { AnimatePresence, motion } from "motion/react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { graphOf, hydrogens, nameOf, type Skeleton } from "../alkanes-core";

// Alkanes drawn as clean SVG: the full structural formula (Strukturformel, every atom and
// bond) and the condensed one (Halbstrukturformel, CH3/CH2/CH groups) with side chains
// drawn vertically. Optionally the main chain is highlighted and numbered.

const round = (v: number) => Math.round(v * 100) / 100;
const spring = { type: "spring", stiffness: 340, damping: 30 } as const;
/** Bond lengths in grid units: C–C and C–H. */
const CC = 2.4;
const CH = 1.3;

// ---------------------------------------------------------------------------
// Full structural formula

type Atom = { id: string; el: "C" | "H"; x: number; y: number; carbon?: number };
type Bond = { id: string; a: Atom; b: Atom };

/** Row x positions: one C–C bond apart, wider when neighbouring columns both have a side chain on the same side (their H atoms would meet). */
function rowXs(s: Skeleton) {
  const sides = (i: number) => new Set(s.branches.filter((b) => b.at === i).map((b) => b.dir));
  const xs = [0];
  for (let i = 1; i < s.row; i++) {
    const a = sides(i - 1);
    const b = sides(i);
    const clash = [...a].some((d) => b.has(d));
    xs.push(xs[i - 1] + (clash ? 2 * CH + 1.1 : CC));
  }
  return xs;
}

export function layoutFull(s: Skeleton) {
  const g = graphOf(s);
  const xs = rowXs(s);
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const carbonAtom: Atom[] = [];
  const bond = (a: Atom, b: Atom) => bonds.push({ id: [a.id, b.id].sort().join("~"), a, b });
  // Carbons
  for (let c = 0; c < g.n; c++) {
    const p = g.pos[c];
    const id = p.lvl === 0 ? `c${p.col}` : `b${p.col}${p.lvl < 0 ? "u" : "d"}${Math.abs(p.lvl)}`;
    const atom: Atom = { id, el: "C", x: xs[p.col], y: p.lvl * CC, carbon: c };
    atoms.push(atom);
    carbonAtom[c] = atom;
  }
  for (let c = 0; c < g.n; c++) for (const w of g.adj[c]) if (w > c) bond(carbonAtom[c], carbonAtom[w]);
  // Hydrogens: the free directions of each carbon.
  for (let c = 0; c < g.n; c++) {
    const A = carbonAtom[c];
    const p = g.pos[c];
    const dirs: [string, number, number][] = [];
    if (p.lvl === 0) {
      const up = s.branches.some((b) => b.at === p.col && b.dir === -1);
      const down = s.branches.some((b) => b.at === p.col && b.dir === 1);
      if (p.col === 0) dirs.push(["w", -1, 0]);
      if (p.col === s.row - 1) dirs.push(["e", 1, 0]);
      if (!up) dirs.push(["n", 0, -1]);
      if (!down) dirs.push(["s", 0, 1]);
    } else {
      dirs.push(["w", -1, 0], ["e", 1, 0]);
      const last = !g.adj[c].some((w) => Math.abs(g.pos[w].lvl) > Math.abs(p.lvl) && g.pos[w].col === p.col);
      if (last) dirs.push([p.lvl < 0 ? "n" : "s", 0, Math.sign(p.lvl)]);
    }
    for (const [d, dx, dy] of dirs) {
      const h: Atom = { id: `${A.id}h${d}`, el: "H", x: A.x + dx * CH, y: A.y + dy * CH };
      atoms.push(h);
      bond(A, h);
    }
  }
  const minX = Math.min(...atoms.map((a) => a.x));
  const maxX = Math.max(...atoms.map((a) => a.x));
  const minY = Math.min(...atoms.map((a) => a.y));
  const maxY = Math.max(...atoms.map((a) => a.y));
  return { atoms, bonds, box: { minX, maxX, minY, maxY }, g };
}

/**
 * The full structural formula. `chain` highlights and numbers the main chain; `onTapCarbon`
 * makes the row carbons tappable (to attach side chains).
 */
export function StructureFull({
  skeleton,
  chain = false,
  onTapCarbon,
  unit = 28,
  minWidth = 0,
  shrinkTo = 480,
  className,
}: {
  skeleton: Skeleton;
  chain?: boolean;
  onTapCarbon?: (col: number) => void;
  unit?: number;
  minWidth?: number;
  /** Wide molecules shrink to fit their box, but not below this width (then the box scrolls). */
  shrinkTo?: number;
  className?: string;
}) {
  const t = useText();
  const { atoms, bonds, box, g } = layoutFull(skeleton);
  const naming = chain ? nameOf(g) : null;
  const main = new Set(naming?.chain ?? []);
  const locant = new Map<number, number>((naming?.chain ?? []).map((c, i) => [c, i + 1]));
  const pad = 0.9;
  const w = Math.max((box.maxX - box.minX + 2 * pad) * unit, minWidth);
  const h = (box.maxY - box.minY + 2 * pad) * unit;
  const ox = round(w / 2 - ((box.minX + box.maxX) / 2) * unit);
  const oy = round(pad * unit - box.minY * unit);
  const P = (a: Atom) => ({ x: round(a.x * unit), y: round(a.y * unit) });
  const isMain = (bd: Bond) => bd.a.carbon !== undefined && bd.b.carbon !== undefined && main.has(bd.a.carbon) && main.has(bd.b.carbon) && Math.abs(locant.get(bd.a.carbon)! - locant.get(bd.b.carbon)!) === 1;
  const fs = unit * 0.62;

  return (
    <svg
      viewBox={`0 0 ${round(w)} ${round(h)}`}
      style={{ width: round(w), maxWidth: "100%", minWidth: Math.min(round(w), shrinkTo), height: "auto" }}
      className={cn("block select-none", className)}
      role="img"
      aria-label={t(tx("Structural formula", "Strukturformel"))}
    >
      <motion.g initial={false} animate={{ x: ox, y: oy }} transition={spring}>
        <AnimatePresence initial={false}>
          {bonds.map((bd) => {
            const a = P(bd.a);
            const b = P(bd.b);
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const ra = (bd.a.el === "C" ? 0.34 : 0.28) * unit;
            const rb = (bd.b.el === "C" ? 0.34 : 0.28) * unit;
            const ux = (b.x - a.x) / len;
            const uy = (b.y - a.y) / len;
            const lit = isMain(bd);
            return (
              <motion.line
                key={bd.id}
                initial={{ opacity: 0, x1: round(a.x + ux * ra), y1: round(a.y + uy * ra), x2: round(a.x + ux * ra), y2: round(a.y + uy * ra) }}
                animate={{ opacity: 1, x1: round(a.x + ux * ra), y1: round(a.y + uy * ra), x2: round(b.x - ux * rb), y2: round(b.y - uy * rb) }}
                exit={{ opacity: 0 }}
                transition={spring}
                stroke={lit ? "var(--blob)" : "var(--ink-3)"}
                strokeWidth={lit ? 2.6 : 1.5}
                strokeLinecap="round"
              />
            );
          })}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {atoms.map((a) => {
            const p = P(a);
            const lit = a.carbon !== undefined && main.has(a.carbon);
            return (
              <motion.g key={a.id} initial={{ opacity: 0, scale: 0.3, x: p.x, y: p.y }} animate={{ opacity: 1, scale: 1, x: p.x, y: p.y }} exit={{ opacity: 0, scale: 0.3 }} transition={spring}>
                <text
                  textAnchor="middle"
                  dy="0.36em"
                  fontSize={a.el === "C" ? fs * 1.08 : fs * 0.92}
                  fontWeight={a.el === "C" ? 650 : 500}
                  fill={a.el === "C" ? (lit ? "var(--blob-ink)" : "var(--ink)") : "var(--ink-2)"}
                >
                  {a.el}
                </text>
                {a.carbon !== undefined && locant.has(a.carbon) && (
                  <text x={unit * 0.34} y={-unit * 0.3} fontSize={fs * 0.6} fontWeight={700} fill="var(--blob)">
                    {locant.get(a.carbon)}
                  </text>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>
        {onTapCarbon &&
          atoms
            .filter((a) => a.el === "C" && a.y === 0)
            .map((a) => {
              const p = P(a);
              const col = g.pos[a.carbon!].col;
              return (
                <motion.g
                  key={`tap-${a.id}`}
                  role="button"
                  tabIndex={0}
                  aria-label={t(tx(`Carbon atom ${col + 1}: attach or remove a methyl group`, `Kohlenstoffatom ${col + 1}: Methylgruppe anhängen oder entfernen`))}
                  initial={false}
                  animate={{ x: p.x, y: p.y }}
                  transition={spring}
                  onClick={() => onTapCarbon(col)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTapCarbon(col);
                    }
                  }}
                  className="group cursor-pointer outline-none"
                >
                  <circle r={unit * 0.62} fill="transparent" />
                  <circle r={unit * 0.48} fill="none" stroke="var(--blob)" strokeWidth={1.6} className="opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-100" />
                </motion.g>
              );
            })}
      </motion.g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Condensed structural formula (Halbstrukturformel) in 2D

const CW = 0.66; // width of "C" in em
const HW = 0.7; // width of "H" in em
const SW = 0.42; // width of a subscript digit in em

/** Condensed formula with vertical side chains, e.g. for "name this alkane". */
export function StructureCondensed({ skeleton, chain = false, size = 17 }: { skeleton: Skeleton; chain?: boolean; size?: number }) {
  const t = useText();
  const g = graphOf(skeleton);
  const naming = chain ? nameOf(g) : null;
  const locant = new Map<number, number>((naming?.chain ?? []).map((c, i) => [c, i + 1]));
  const COL = size * 3.9;
  const LVL = size * 2.3;
  const hPart = (h: number) => (h === 0 ? 0 : HW + (h > 1 ? SW : 0)) * size;
  const left = (c: number) => g.pos[c].lvl === 0 && g.pos[c].col === 0 && skeleton.row > 1;
  const items = [...Array(g.n).keys()].map((c) => {
    const h = hydrogens(g, c);
    const x = g.pos[c].col * COL;
    const y = g.pos[c].lvl * LVL;
    const half = (CW * size) / 2;
    const l = left(c);
    return { c, h, x, y, l, x0: l ? x - half - hPart(h) : x - half, x1: l ? x + half : x + half + hPart(h) };
  });
  const minX = Math.min(...items.map((i) => i.x0)) - 6;
  const maxX = Math.max(...items.map((i) => i.x1)) + 6;
  const minY = Math.min(...items.map((i) => i.y)) - size * 1.1;
  const maxY = Math.max(...items.map((i) => i.y)) + size * 1.1;
  const W = maxX - minX;
  const H = maxY - minY;
  const gap = size * 0.18;
  const lines: { k: string; x1: number; y1: number; x2: number; y2: number; lit: boolean }[] = [];
  for (let c = 0; c < g.n; c++)
    for (const w of g.adj[c]) {
      if (w < c) continue;
      const a = items[c];
      const b = items[w];
      const lit = locant.has(c) && locant.has(w) && Math.abs(locant.get(c)! - locant.get(w)!) === 1;
      if (a.y === b.y) {
        const [p, q] = a.x < b.x ? [a, b] : [b, a];
        lines.push({ k: `${c}-${w}`, x1: p.x1 + gap, y1: p.y, x2: q.x0 - gap, y2: q.y, lit });
      } else {
        const [p, q] = Math.abs(a.y) < Math.abs(b.y) ? [a, b] : [b, a];
        const s = Math.sign(q.y - p.y);
        lines.push({ k: `${c}-${w}`, x1: p.x, y1: p.y + s * size * 0.62, x2: q.x, y2: q.y - s * size * 0.62, lit });
      }
    }
  const label = (it: (typeof items)[number]) => {
    const lit = locant.has(it.c);
    const color = lit ? "var(--blob-ink)" : "var(--ink)";
    const sub = it.h > 1 ? String(it.h) : "";
    return (
      <g key={it.c}>
        <text x={round(it.x)} y={round(it.y)} dy="0.35em" textAnchor="middle" fontSize={size} fontWeight={600} fill={color}>
          C
        </text>
        {it.h > 0 && (
          <text x={round(it.l ? it.x - (CW * size) / 2 : it.x + (CW * size) / 2)} y={round(it.y)} dy="0.35em" textAnchor={it.l ? "end" : "start"} fontSize={size} fontWeight={500} fill={color}>
            H
            {sub && (
              <tspan fontSize={size * 0.68} dy="0.3em">
                {sub}
              </tspan>
            )}
          </text>
        )}
        {locant.has(it.c) && (
          <text x={round(it.x)} y={round(it.y + (g.pos[it.c].lvl > 0 || (g.pos[it.c].lvl === 0 && skeleton.branches.some((b) => b.at === g.pos[it.c].col && b.dir === -1)) ? size * 1.15 : -size * 0.95))} textAnchor="middle" fontSize={size * 0.62} fontWeight={700} fill="var(--blob)">
            {locant.get(it.c)}
          </text>
        )}
      </g>
    );
  };
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`${round(minX)} ${round(minY)} ${round(W)} ${round(H)}`}
        width={round(W)}
        height={round(H)}
        className="mx-auto block max-w-none font-sans"
        role="img"
        aria-label={t(tx(`Condensed structural formula`, `Halbstrukturformel`))}
      >
        {lines.map((l) => (
          <line key={l.k} x1={round(l.x1)} y1={round(l.y1)} x2={round(l.x2)} y2={round(l.y2)} stroke={l.lit ? "var(--blob)" : "var(--ink-2)"} strokeWidth={l.lit ? 2.4 : 1.6} strokeLinecap="round" />
        ))}
        {items.map(label)}
      </svg>
    </div>
  );
}

/** Exercise visual: a drawn alkane (condensed by default). */
export function AlkaneDrawing({ skeleton, full = false, chain = false }: { skeleton: Skeleton; full?: boolean; chain?: boolean }) {
  if (full)
    return (
      <div className="-mx-1 overflow-x-auto px-1">
        <StructureFull skeleton={skeleton} chain={chain} unit={26} className="mx-auto" />
      </div>
    );
  return <StructureCondensed skeleton={skeleton} chain={chain} />;
}
