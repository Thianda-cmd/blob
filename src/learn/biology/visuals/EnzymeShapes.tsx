"use client";

// The enzyme drawing kit: an enzyme (a folded protein with a pocket, the active site), substrates
// that fit or don't, products, inhibitors and the unfolded (denatured) chain. All shapes are
// drawn in the enzyme's own coordinates: the pocket opens at y = 0 around x = 0, the body spans
// x −130…130 and y −18…120. Variants of the body share one path structure, so they can morph.

import { motion, useReducedMotion, type Transition } from "motion/react";

export type Tooth = "tri" | "round" | "square";
type Notch = { type: Tooth; x0: number; x1: number; depth: number };
export type BodyShape = { rim: number; rimTop: number; floor: number; left: Notch; right: Notch };
export type BodyVariant = "fit" | "open" | "closed" | "distorted";

/** Colours (biology palette, they switch for dark mode). */
export const C = {
  enzyme: "var(--bio-vacuole)",
  enzymeLine: "var(--bio-water-deep)",
  pocket: "color-mix(in oklab, var(--bio-water) 35%, var(--bio-vacuole))",
  sub: "var(--bio-sun)",
  subLine: "var(--bio-nerve-deep)",
  wrong: "var(--bio-leaf)",
  wrongLine: "var(--bio-leaf-deep)",
  comp: "var(--bio-petal)",
  compLine: "var(--bio-petal-deep)",
  allo: "var(--bio-mito)",
  alloLine: "var(--bio-mito-deep)",
  cof: "var(--bio-chloro)",
  cofLine: "var(--bio-leaf-deep)",
};

const notch = (type: Tooth, x0: number, x1: number, depth: number): Notch => ({ type, x0, x1, depth });
const DEPTH: Record<Tooth, number> = { tri: 26, round: 15, square: 22 };

/** The body shape of each variant for a pocket with these two teeth. */
export function bodyShape(variant: BodyVariant, l: Tooth = "tri", r: Tooth = "round"): BodyShape {
  switch (variant) {
    case "open":
      return { rim: 58, rimTop: 6, floor: 22, left: notch(l, -42, -6, DEPTH[l] - 6), right: notch(r, 6, 42, DEPTH[r] - 4) };
    case "closed":
      return { rim: 50, rimTop: -14, floor: 22, left: notch(l, -39, -9, DEPTH[l]), right: notch(r, 9, 39, DEPTH[r]) };
    case "distorted":
      return { rim: 43, rimTop: 5, floor: 17, left: notch(l, -33, -15, DEPTH[l] - 14), right: notch(r, 15, 31, DEPTH[r] - 8) };
    default:
      return { rim: 50, rimTop: 0, floor: 22, left: notch(l, -39, -9, DEPTH[l]), right: notch(r, 9, 39, DEPTH[r]) };
  }
}

/** A notch into the body, from (x0, floor) to (x1, floor). */
function notchDown(n: Notch, floor: number) {
  const cx = (n.x0 + n.x1) / 2;
  if (n.type === "tri") return `L ${cx} ${floor + n.depth} L ${n.x1} ${floor}`;
  if (n.type === "round") {
    const r = (n.x1 - n.x0) / 2;
    return `A ${r} ${r} 0 0 0 ${n.x1} ${floor}`;
  }
  return `L ${n.x0} ${floor + n.depth} L ${n.x1} ${floor + n.depth} L ${n.x1} ${floor}`;
}

/** Outline of the enzyme. `allo`: with an allosteric site (a notch at the bottom right). */
export function bodyPath(s: BodyShape, allo = false) {
  const { rim, rimTop, floor, left, right } = s;
  return [
    "M -130 40",
    "C -130 0 -100 -18 -72 -18",
    `C -62 -18 ${-rim - 6} ${rimTop - 8} ${-rim} ${rimTop}`,
    `L ${-rim} ${floor}`,
    `L ${left.x0} ${floor}`,
    notchDown(left, floor),
    `L ${right.x0} ${floor}`,
    notchDown(right, floor),
    `L ${rim} ${floor}`,
    `L ${rim} ${rimTop}`,
    `C ${rim + 6} ${rimTop - 8} 62 -18 72 -18`,
    "C 100 -18 130 0 130 40",
    allo ? "C 130 78 114 104 94 112 L 90 94 L 56 94 L 52 118 C 36 120 20 120 0 120" : "C 130 92 80 120 0 120",
    "C -80 120 -130 94 -130 40 Z",
  ].join(" ");
}

/** The pocket itself (the active site), as an area: for highlighting it. */
export function pocketPath(s: BodyShape) {
  const { rim, rimTop, floor, left, right } = s;
  return [`M ${-rim} ${rimTop}`, `L ${-rim} ${floor}`, `L ${left.x0} ${floor}`, notchDown(left, floor), `L ${right.x0} ${floor}`, notchDown(right, floor), `L ${rim} ${floor}`, `L ${rim} ${rimTop}`, "Z"].join(" ");
}

/** A tooth at the bottom of a substrate, drawn from right (x1) to left (x0). */
function toothUp(type: Tooth, x0: number, x1: number, floor: number) {
  const cx = (x0 + x1) / 2;
  if (type === "tri") return `L ${cx} ${floor + DEPTH.tri - 3} L ${x0} ${floor}`;
  if (type === "round") {
    const r = (x1 - x0) / 2;
    return `A ${r} ${r} 0 0 1 ${x0} ${floor}`;
  }
  return `L ${x1} ${floor + DEPTH.square - 3} L ${x0} ${floor + DEPTH.square - 3} L ${x0} ${floor}`;
}

/** The two halves of a substrate (docked position), split where the bond breaks. */
export function substrateHalves(l: Tooth = "tri", r: Tooth = "round") {
  return {
    left: `M -48 -10 Q -48 -22 -36 -22 L -2 -22 L -2 22 L -11 22 ${toothUp(l, -37, -11, 22)} L -48 22 Z`,
    right: `M 2 -22 L 36 -22 Q 48 -22 48 -10 L 48 22 L 37 22 ${toothUp(r, 11, 37, 22)} L 2 22 Z`,
  };
}

/** A competitive inhibitor: fits the pocket like the substrate, but is one piece with a pointed top. */
export function inhibitorPath(l: Tooth = "tri", r: Tooth = "round") {
  return `M -48 -10 Q -48 -22 -36 -22 L -12 -22 L 0 -34 L 12 -22 L 36 -22 Q 48 -22 48 -10 L 48 22 L 37 22 ${toothUp(r, 11, 37, 22)} L -11 22 ${toothUp(l, -37, -11, 22)} L -48 22 Z`;
}

/** An allosteric effector, docked in the allosteric site. */
export const ALLO_PATH = "M 58 96 L 88 96 L 91 113 Q 92 130 76 130 L 70 130 Q 54 130 55 115 Z";

/** The unfolded protein chain of a denatured enzyme. */
export const CHAIN_PATH = "M -122 70 C -112 20 -92 22 -86 60 S -62 108 -50 66 S -30 10 -12 44 S 8 104 26 70 S 48 18 62 52 S 86 104 100 64 S 118 30 124 52";

/** The enzyme body, morphing smoothly between variants. */
export function EnzymeBody({
  variant = "fit",
  teeth = ["tri", "round"],
  allo = false,
  shadePocket = false,
  transition,
  fill = C.enzyme,
  stroke = C.enzymeLine,
  part,
}: {
  variant?: BodyVariant;
  teeth?: [Tooth, Tooth];
  allo?: boolean;
  shadePocket?: boolean;
  transition?: Transition;
  fill?: string;
  stroke?: string;
  part?: string;
}) {
  const reduce = useReducedMotion();
  const s = bodyShape(variant, teeth[0], teeth[1]);
  const t = reduce ? { duration: 0 } : (transition ?? { type: "spring", stiffness: 140, damping: 18 });
  return (
    <g data-part={part}>
      <motion.path initial={false} animate={{ d: bodyPath(s, allo) }} transition={t} fill={fill} stroke={stroke} strokeWidth={2.4} strokeLinejoin="round" />
      {/* a few folds, so it reads as a folded protein */}
      <path d="M -96 40 C -84 26 -70 52 -56 38 M -40 78 C -24 64 -8 92 8 76 M 60 46 C 74 32 88 58 102 44" fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" opacity={0.45} />
      {shadePocket && <motion.path initial={false} animate={{ d: pocketPath(s) }} transition={t} fill={C.pocket} stroke="none" />}
    </g>
  );
}

/** A substrate (both halves and the bond between them), docked at (0, 0) of the enzyme. */
export function SubstrateShape({ teeth = ["tri", "round"], fill = C.sub, stroke = C.subLine, bond = true }: { teeth?: [Tooth, Tooth]; fill?: string; stroke?: string; bond?: boolean }) {
  const h = substrateHalves(teeth[0], teeth[1]);
  return (
    <g>
      <path d={h.left} fill={fill} stroke={stroke} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={h.right} fill={fill} stroke={stroke} strokeWidth={2.2} strokeLinejoin="round" />
      {bond && <path d="M -9 0 L 9 0" stroke={stroke} strokeWidth={5} strokeLinecap="round" />}
    </g>
  );
}

/** The denatured enzyme: an unfolded chain. */
export function EnzymeChain() {
  return (
    <g>
      <path d={CHAIN_PATH} fill="none" stroke={C.enzymeLine} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <path d={CHAIN_PATH} fill="none" stroke={C.enzyme} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A small arrow (for "→" between stages). */
export function StageArrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g stroke="var(--ink-3)" strokeWidth={2.2} strokeLinecap="round" fill="none">
      <path d={`M ${x1} ${y} L ${x2} ${y}`} />
      <path d={`M ${x2 - 8} ${y - 6} L ${x2} ${y} L ${x2 - 8} ${y + 6}`} strokeLinejoin="round" />
    </g>
  );
}
