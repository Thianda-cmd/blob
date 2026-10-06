"use client";

// Leaves and fruits of common trees for the "plant-diversity" topic: recognisable silhouettes of
// oak, beech, maple, lime, birch, horse chestnut and ash, built from a few control points
// (DiversityShapes), their fruits as small icons, a leaf gallery to explore and task pictures.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { leaf, pathOf, polarLeaf, sideVeins, veinsTo, type Leaf } from "./DiversityShapes";

export type TreeId = "oak" | "beech" | "maple" | "lime" | "birch" | "chestnut" | "ash";

// ---------------------------------------------------------------------------
// Geometry (computed once)

const OAK = leaf({
  right: [
    [0, 0],
    [7, 5],
    [13, 2],
    [13, -8],
    [24, -30],
    [42, -62],
    [56, -100],
    [63, -132],
    [58, -160],
    [42, -181],
    [18, -194],
    [0, -199],
  ],
  lobes: { n: 4.4, depth: 30, from: 0.16, to: 0.93, phase: 0.1, byWidth: true },
  lobesLeft: { n: 4.4, depth: 30, from: 0.16, to: 0.93, phase: 0.28, byWidth: true },
});

/** Arc fractions of the oak's lobe tips on a side with this lobe phase. */
const OAK_LOBES = (phase: number) => [0, 1, 2, 3].map((k) => 0.16 + ((k + 0.5 - phase) / 4.4) * 0.77).filter((f) => f < 0.86);

const BEECH = leaf({
  right: [
    [0, 0],
    [15, -6],
    [38, -28],
    [54, -62],
    [60, -95],
    [55, -128],
    [42, -157],
    [22, -180],
    [0, -196],
  ],
  teeth: { kind: "wave", period: 27, amp: 2.6, from: 0.12, to: 0.94 },
});

const LIME = leaf({
  right: [
    [0, 0],
    [16, 9],
    [40, 11],
    [62, -3],
    [74, -32],
    [72, -70],
    [60, -105],
    [40, -134],
    [20, -154],
    [7, -166],
    [0, -176],
  ],
  left: [
    [0, 0],
    [-12, 2],
    [-34, -2],
    [-56, -17],
    [-68, -44],
    [-67, -78],
    [-55, -109],
    [-37, -136],
    [-18, -156],
    [-6, -167],
    [0, -176],
  ],
  teeth: { kind: "saw", period: 9.5, amp: 3.6, from: 0.1, to: 0.96 },
});

const BIRCH = leaf({
  right: [
    [0, 0],
    [22, -5],
    [45, -21],
    [56, -40],
    [50, -66],
    [37, -95],
    [21, -122],
    [9, -144],
    [0, -164],
  ],
  teeth: { kind: "double", period: 15, amp: 5, from: 0.12, to: 0.95 },
});

const CHESTNUT_LEAFLET = leaf({
  right: [
    [0, 0],
    [5, -12],
    [14, -40],
    [24, -76],
    [30, -106],
    [27, -126],
    [17, -141],
    [6, -150],
    [0, -155],
  ],
  teeth: { kind: "saw", period: 8.5, amp: 2.6, from: 0.22, to: 0.97 },
});

const ASH_LEAFLET = leaf({
  right: [
    [0, 0],
    [6, -6],
    [14, -20],
    [17, -38],
    [15, -56],
    [9, -70],
    [3, -79],
    [0, -84],
  ],
  teeth: { kind: "saw", period: 7, amp: 1.9, from: 0.18, to: 0.94 },
});

// Spitzahorn: five pointed lobes with a few long teeth, round bays, heart-shaped base.
const MAPLE_PTS = polarLeaf(
  [
    // lobe bodies: broad fingers that widen outwards
    { at: 0, len: 90, width: 27, sharp: 0.35 },
    { at: 62, len: 86, width: 27, sharp: 0.35 },
    { at: -62, len: 86, width: 27, sharp: 0.35 },
    { at: 126, len: 60, width: 25, sharp: 0.4 },
    { at: -126, len: 60, width: 25, sharp: 0.4 },
    // long pointed teeth: one at each lobe tip, a pair on each lobe side
    { at: 0, len: 124, width: 9, sharp: 1.25 },
    { at: 17, len: 98, width: 8, sharp: 1.3 },
    { at: -17, len: 98, width: 8, sharp: 1.3 },
    { at: 62, len: 120, width: 9, sharp: 1.25 },
    { at: -62, len: 120, width: 9, sharp: 1.25 },
    { at: 45, len: 94, width: 8, sharp: 1.3 },
    { at: -45, len: 94, width: 8, sharp: 1.3 },
    { at: 79, len: 94, width: 8, sharp: 1.3 },
    { at: -79, len: 94, width: 8, sharp: 1.3 },
    { at: 126, len: 82, width: 9, sharp: 1.25 },
    { at: -126, len: 82, width: 9, sharp: 1.25 },
    { at: 110, len: 64, width: 7, sharp: 1.3 },
    { at: -110, len: 64, width: 7, sharp: 1.3 },
  ],
  { base: 34, notch: 0.75, notchWidth: 20 },
);

type Piece = { d: string; tf: string };

type Geo = {
  /** viewBox of the leaf picture */
  w: number;
  h: number;
  /** Blade outlines and veins, each with its SVG transform. */
  blades: Piece[];
  veins: Piece[];
  /** Petiole and rachis line. */
  stalk: string;
};

const veinsOf = (l: Leaf, ts: number[], reach?: number, lead?: number) => sideVeins(l, ts, reach, lead);
const deg = (a: number) => (a * Math.PI) / 180;
const ray = (len: number, a: number) => `M0 0L${(len * Math.sin(deg(a))).toFixed(1)} ${(-len * Math.cos(deg(a))).toFixed(1)}`;

function geometry(id: TreeId): Geo {
  switch (id) {
    case "oak": {
      const tf = "translate(100 222)";
      return { w: 200, h: 260, blades: [{ d: OAK.outline, tf }], veins: [{ d: `M0 0L0 -192${veinsTo(OAK, OAK_LOBES(0.1), OAK_LOBES(0.28), 0.82)}`, tf }], stalk: "M100 222L100 238" };
    }
    case "beech": {
      const tf = "translate(100 226)";
      return { w: 200, h: 260, blades: [{ d: BEECH.outline, tf }], veins: [{ d: `M0 0L0 -190${veinsOf(BEECH, [0.1, 0.21, 0.32, 0.43, 0.54, 0.65, 0.76], 0.97, 0.09)}`, tf }], stalk: "M100 226L100 246" };
    }
    case "lime": {
      const tf = "translate(100 196)";
      return { w: 200, h: 260, blades: [{ d: LIME.outline, tf }], veins: [{ d: `M0 0L0 -170M0 0Q30 -6 56 -14M0 0Q-26 -8 -50 -24${veinsOf(LIME, [0.18, 0.36, 0.54, 0.7], 0.88, 0.1)}`, tf }], stalk: "M100 196Q101 222 98 250" };
    }
    case "birch": {
      const tf = "translate(100 196)";
      return { w: 200, h: 260, blades: [{ d: BIRCH.outline, tf }], veins: [{ d: `M0 0L0 -158${veinsOf(BIRCH, [0.06, 0.18, 0.3, 0.42, 0.54, 0.66], 0.9, 0.1)}`, tf }], stalk: "M100 196Q102 222 99 248" };
    }
    case "maple": {
      const tf = "translate(130 150)";
      return {
        w: 260,
        h: 260,
        blades: [{ d: pathOf(MAPLE_PTS), tf }],
        veins: [{ d: [ray(112, 0), ray(108, 62), ray(108, -62), ray(72, 126), ray(72, -126)].join(""), tf }],
        stalk: "M130 150Q133 200 128 252",
      };
    }
    case "chestnut": {
      const parts: [number, number][] = [
        [0, 1],
        [34, 0.92],
        [-34, 0.92],
        [70, 0.72],
        [-70, 0.72],
        [104, 0.5],
        [-104, 0.5],
      ];
      const tfs = parts.map(([a, k]) => `translate(150 170) rotate(${a}) scale(${k})`);
      return {
        w: 300,
        h: 260,
        blades: tfs.map((tf) => ({ d: CHESTNUT_LEAFLET.outline, tf })),
        veins: tfs.map((tf) => ({ d: `M0 -4L0 -150${veinsOf(CHESTNUT_LEAFLET, [0.25, 0.38, 0.51, 0.64, 0.77], 0.9, 0.08)}`, tf })),
        stalk: "M150 172Q152 210 148 256",
      };
    }
    case "ash": {
      const ys = [-40, -86, -132, -176];
      const tfs = [...ys.flatMap((y, i) => [`translate(120 ${250 + y}) rotate(${62 - i * 4}) scale(${0.9 + i * 0.04})`, `translate(120 ${250 + y}) rotate(${-62 + i * 4}) scale(${0.9 + i * 0.04})`]), "translate(120 40) scale(1.05)"];
      return {
        w: 240,
        h: 280,
        blades: tfs.map((tf) => ({ d: ASH_LEAFLET.outline, tf })),
        veins: tfs.map((tf) => ({ d: `M0 0L0 -80${veinsOf(ASH_LEAFLET, [0.2, 0.38, 0.56, 0.72], 0.85, 0.1)}`, tf })),
        stalk: "M120 274L120 40",
      };
    }
  }
}

const GEO: Record<TreeId, Geo> = {
  oak: geometry("oak"),
  beech: geometry("beech"),
  maple: geometry("maple"),
  lime: geometry("lime"),
  birch: geometry("birch"),
  chestnut: geometry("chestnut"),
  ash: geometry("ash"),
};

function Blades({ g }: { g: Geo }) {
  return (
    <>
      <path d={g.stalk} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3.2} strokeLinecap="round" />
      <g fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} strokeLinejoin="round">
        {g.blades.map((b, i) => (
          <path key={i} d={b.d} transform={b.tf} />
        ))}
      </g>
      <g fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} strokeLinecap="round" opacity={0.65}>
        {g.veins.map((b, i) => (
          <path key={i} d={b.d} transform={b.tf} />
        ))}
      </g>
    </>
  );
}

/** The leaf drawing itself (no frame). */
export function LeafShape({ id, className, title }: { id: TreeId; className?: string; title?: string }) {
  const g = GEO[id];
  return (
    <svg viewBox={`0 0 ${g.w} ${g.h}`} className={cn("block h-auto w-full", className)} role="img" aria-label={title}>
      <Blades g={g} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Fruits (small icons, viewBox 0 0 100 100)

function Acorn({ x, y, deg }: { x: number; y: number; deg: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      <path d="M-9 0C-10 16 -6 27 0 31C6 27 10 16 9 0Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
      <path d="M0 31L0 34" stroke="var(--bio-wood-deep)" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M-11 2C-11 -6 -6 -10 0 -10C6 -10 11 -6 11 2C5 5 -5 5 -11 2Z" fill="var(--bio-wood-deep)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      <path d="M-8 -3L-4 1M-3 -5L1 -1M3 -5L7 -1M-9 1L-6 3M5 0L8 2" stroke="var(--bio-wood)" strokeWidth={1} opacity={0.8} />
    </g>
  );
}

export function FruitIcon({ id, className }: { id: TreeId; className?: string }) {
  const body = (() => {
    switch (id) {
      case "oak":
        // Stieleiche: acorns on a long common stalk.
        return (
          <>
            <path d="M50 6C50 20 49 32 46 44M49 30C58 36 64 42 66 50" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={2.2} strokeLinecap="round" />
            <Acorn x={44} y={56} deg={8} />
            <Acorn x={68} y={60} deg={-14} />
          </>
        );
      case "beech":
        return (
          <>
            {/* Open husk with four spiny valves and two three-sided nuts. */}
            {[-52, -18, 18, 52].map((d) => (
              <g key={d} transform={`translate(50 74) rotate(${d})`}>
                <path d="M-6 0C-8 -16 -6 -28 0 -36C6 -28 8 -16 6 0Z" fill="var(--bio-wood-deep)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
                <path d="M-6 -8l-4 -2M-7 -16l-4 -2M-6 -24l-4 -3M6 -8l4 -2M7 -16l4 -2M6 -24l4 -3" stroke="var(--bio-wood-deep)" strokeWidth={1.1} strokeLinecap="round" />
              </g>
            ))}
            <path d="M40 66L46 40L52 66Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} strokeLinejoin="round" />
            <path d="M50 66L56 38L62 66Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} strokeLinejoin="round" />
            <path d="M50 74L50 92" stroke="var(--bio-wood-deep)" strokeWidth={2} strokeLinecap="round" />
          </>
        );
      case "maple":
        // Spitzahorn: two winged nutlets, wings spread almost in a straight line.
        return (
          <>
            <path d="M50 52L50 92" stroke="var(--bio-wood-deep)" strokeWidth={1.8} strokeLinecap="round" />
            {[1, -1].map((s) => (
              <g key={s} transform={`translate(50 52) scale(${s} 1)`}>
                <path d="M2 -2C14 -12 30 -20 44 -22C50 -22 52 -16 48 -12C36 -4 20 2 6 6Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} strokeLinejoin="round" opacity={0.95} />
                <path d="M8 2C18 -6 30 -12 44 -17" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.9} opacity={0.6} />
                <ellipse cx={7} cy={1} rx={7} ry={6} fill="var(--bio-wood-deep)" />
              </g>
            ))}
          </>
        );
      case "lime":
        // A pale tongue-shaped bract (flight wing) with a stalk carrying round nutlets.
        return (
          <>
            <path d="M30 8C40 6 46 14 46 26C46 44 40 60 32 66C24 58 22 40 22 24C22 14 25 9 30 8Z" fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            <path d="M34 12C34 30 33 48 32 62" stroke="var(--bio-wood-deep)" strokeWidth={1.2} opacity={0.7} fill="none" />
            <path d="M34 34C46 44 54 56 58 66M58 66L50 78M58 66L64 80M58 66L58 86" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.5} strokeLinecap="round" />
            {[
              [50, 80],
              [65, 83],
              [58, 90],
            ].map(([cx, cy]) => (
              <circle key={`${cx}`} cx={cx} cy={cy} r={5.5} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
            ))}
          </>
        );
      case "birch":
        return (
          <>
            {/* Hanging fruit catkin and two tiny winged nutlets. */}
            <path d="M38 6C38 12 38 16 38 20" stroke="var(--bio-wood-deep)" strokeWidth={1.6} strokeLinecap="round" />
            <rect x={31} y={20} width={14} height={56} rx={7} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            {[28, 36, 44, 52, 60, 68].map((y) => (
              <path key={y} d={`M32 ${y}Q38 ${y + 4} 44 ${y}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.9} opacity={0.7} />
            ))}
            {[
              [68, 40],
              [74, 66],
            ].map(([cx, cy]) => (
              <g key={cx} transform={`translate(${cx} ${cy})`}>
                <path d="M-11 0C-11 -6 -5 -8 0 -4C5 -8 11 -6 11 0C11 6 5 8 0 4C-5 8 -11 6 -11 0Z" fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
                <ellipse cx={0} cy={0} rx={2.6} ry={4} fill="var(--bio-wood-deep)" />
              </g>
            ))}
          </>
        );
      case "chestnut":
        return (
          <>
            {/* Spiny capsule split open, with a glossy brown seed. */}
            <path d="M18 60C14 40 28 24 46 24L46 60Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
            <path d="M82 60C86 40 72 24 54 24L54 60Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
            <path d="M20 40l-7 -3M24 31l-5 -6M32 25l-2 -7M40 23l0 -7M17 50l-7 0M60 23l0 -7M68 25l2 -7M76 31l5 -6M80 40l7 -3M83 50l7 0" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} strokeLinecap="round" />
            <ellipse cx={50} cy={66} rx={20} ry={18} fill="var(--bio-wood-deep)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            <ellipse cx={50} cy={76} rx={11} ry={6} fill="var(--bio-bone)" opacity={0.9} />
            <path d="M40 58C44 54 50 53 55 55" stroke="var(--bio-bone)" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.7} />
          </>
        );
      case "ash":
        return (
          <>
            <path d="M50 6L50 30M50 30L36 44M50 30L64 44M50 30L50 48" stroke="var(--bio-wood-deep)" strokeWidth={1.6} strokeLinecap="round" fill="none" />
            {[
              [36, 44, 20],
              [64, 44, -20],
              [50, 48, 0],
            ].map(([x, y, d]) => (
              <g key={x} transform={`translate(${x} ${y}) rotate(${d})`}>
                <path d="M-4 0C-6 14 -6 30 -3 44C0 48 4 46 5 42C6 28 5 12 4 0Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
                <path d="M-2 2C-3 8 -3 12 -2 16" stroke="var(--bio-wood-deep)" strokeWidth={2.4} strokeLinecap="round" />
              </g>
            ))}
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 100 100" className={cn("block h-auto w-full", className)} aria-hidden>
      {body}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Facts for the gallery

export type TreeFacts = {
  name: Text;
  shape: Text;
  margin: Text;
  kind: Text;
  fruit: Text;
  extra: Text;
};

export const TREE_FACTS: Record<TreeId, TreeFacts> = {
  oak: {
    name: tx("Oak (pedunculate oak)", "Eiche (Stieleiche)"),
    shape: tx("lobed with round lobes (bay-lobed), widest near the tip, tiny ear-like lobes at the base", "gelappt mit runden Lappen (buchtig gelappt), vorne am breitesten, kleine Öhrchen am Blattgrund"),
    margin: tx("smooth edge between the bays", "glatter Rand zwischen den Buchten"),
    kind: tx("simple, very short stalk, alternate", "einfach, sehr kurz gestielt, wechselständig"),
    fruit: tx("acorn in a little cup, on a long stalk", "Eichel im Fruchtbecher, an einem langen Stiel"),
    extra: tx("Its wood is very hard and lasts for centuries.", "Ihr Holz ist sehr hart und hält Jahrhunderte."),
  },
  beech: {
    name: tx("Beech (common beech)", "Buche (Rotbuche)"),
    shape: tx("oval with a short point, parallel side veins", "eiförmig mit kurzer Spitze, parallele Seitennerven"),
    margin: tx("smooth (entire), slightly wavy, with fine hairs", "ganzrandig, leicht gewellt, am Rand fein bewimpert"),
    kind: tx("simple, alternate", "einfach, wechselständig"),
    fruit: tx("beechnuts: three-sided nuts in a spiny husk", "Bucheckern: dreikantige Nüsse im stacheligen Fruchtbecher"),
    extra: tx("Germany's most common broadleaf tree. Its dense crown lets very little light through.", "Der häufigste Laubbaum Deutschlands. Seine dichte Krone lässt kaum Licht durch."),
  },
  maple: {
    name: tx("Maple (Norway maple)", "Ahorn (Spitzahorn)"),
    shape: tx("palm-shaped with five pointed lobes", "handförmig gelappt mit fünf spitzen Lappen"),
    margin: tx("a few large, pointed teeth", "wenige große, spitze Zähne"),
    kind: tx("simple, long stalk, opposite", "einfach, lang gestielt, gegenständig"),
    fruit: tx("winged fruit with two wings that spins like a propeller", "Flügelfrucht mit zwei Flügeln, die wie ein Propeller fliegt"),
    extra: tx("A broken leaf stalk oozes milky sap.", "Ein abgebrochener Blattstiel gibt Milchsaft ab."),
  },
  lime: {
    name: tx("Lime (small-leaved lime)", "Linde (Winterlinde)"),
    shape: tx("heart-shaped, lopsided at the base, with a short point", "herzförmig, am Blattgrund schief, mit kurzer Spitze"),
    margin: tx("finely saw-toothed (serrated)", "fein gesägt"),
    kind: tx("simple, long stalk, alternate", "einfach, lang gestielt, wechselständig"),
    fruit: tx("small round nuts hanging from a pale wing (a bract)", "kleine runde Nüsschen an einem hellen Flugblatt (Hochblatt)"),
    extra: tx("Its flowers smell sweet in June and make lime blossom tea.", "Ihre Blüten duften im Juni und ergeben Lindenblütentee."),
  },
  birch: {
    name: tx("Birch (silver birch)", "Birke (Hängebirke)"),
    shape: tx("diamond-shaped to triangular with a long point", "rautenförmig bis dreieckig mit langer Spitze"),
    margin: tx("double saw-toothed (big teeth with small ones)", "doppelt gesägt (große Zähne mit kleinen darauf)"),
    kind: tx("simple, alternate", "einfach, wechselständig"),
    fruit: tx("tiny winged nuts from cone-like catkins", "winzige geflügelte Nüsschen aus zapfenartigen Kätzchen"),
    extra: tx("Easy to spot by its white bark with black cracks.", "Leicht zu erkennen an der weißen Rinde mit schwarzen Rissen."),
  },
  chestnut: {
    name: tx("Horse chestnut", "Rosskastanie"),
    shape: tx("palmately compound: 5 to 7 leaflets spread like fingers", "gefingert: 5 bis 7 Teilblättchen wie die Finger einer Hand"),
    margin: tx("saw-toothed leaflets", "gesägte Teilblättchen"),
    kind: tx("compound, long stalk, opposite", "zusammengesetzt, lang gestielt, gegenständig"),
    fruit: tx("spiny capsule with shiny brown seeds (conkers)", "stachelige Kapsel mit glänzend braunen Samen (Kastanien)"),
    extra: tx("Not related to the sweet chestnut, whose nuts we eat.", "Nicht verwandt mit der Esskastanie, deren Früchte man isst."),
  },
  ash: {
    name: tx("Ash (common ash)", "Esche (Gemeine Esche)"),
    shape: tx("pinnate: 9 to 15 leaflets in pairs along a central stalk", "gefiedert: 9 bis 15 Fiederblättchen paarweise an einer Mittelachse"),
    margin: tx("finely saw-toothed leaflets", "fein gesägte Fiederblättchen"),
    kind: tx("compound, opposite", "zusammengesetzt, gegenständig"),
    fruit: tx("bunches of nuts with one long wing each", "Büschel von Nüssen mit je einem langen Flügel"),
    extra: tx("Its winter buds are black like velvet.", "Ihre Winterknospen sind schwarz wie Samt."),
  },
};

const ORDER: TreeId[] = ["oak", "beech", "maple", "lime", "birch", "chestnut", "ash"];

/** Lesson widget: tap a tree and see its leaf, its fruit and how to recognise it. */
export function DiversityLeafGallery() {
  const t = useText();
  const scope = useId();
  const [id, setId] = useState<TreeId>("oak");
  const f = TREE_FACTS[id];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setId(k)}
            className={cn("relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", id === k ? "text-white" : "bg-hover text-ink-2 hover:text-ink")}
          >
            {id === k && <motion.span layoutId={`${scope}-tree`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(TREE_FACTS[k].name).split(" (")[0]}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:items-center"
        >
          <div className="relative mx-auto w-full max-w-[280px]">
            <LeafShape id={id} title={t(f.name)} />
            <div className="absolute -bottom-1 right-0 w-[86px] rounded-xl border border-line bg-surface p-1.5 shadow-card">
              <FruitIcon id={id} />
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="font-display text-[22px] font-semibold text-ink">{t(f.name)}</div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px] leading-snug">
              <dt className="font-semibold text-ink-3">{t(tx("Leaf", "Blatt"))}</dt>
              <dd className="text-ink">{t(f.shape)}</dd>
              <dt className="font-semibold text-ink-3">{t(tx("Edge", "Rand"))}</dt>
              <dd className="text-ink">{t(f.margin)}</dd>
              <dt className="font-semibold text-ink-3">{t(tx("Build", "Aufbau"))}</dt>
              <dd className="text-ink">{t(f.kind)}</dd>
              <dt className="font-semibold text-ink-3">{t(tx("Fruit", "Frucht"))}</dt>
              <dd className="text-ink">{t(f.fruit)}</dd>
            </dl>
            <p className="text-[13px] leading-snug text-ink-3">{t(f.extra)}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Task picture: one leaf (and optionally its fruit), no name. */
export function DiversityLeafPicture({ id, fruit = false }: { id: TreeId; fruit?: boolean }) {
  const t = useText();
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <LeafShape id={id} title={t(tx("A leaf", "Ein Blatt"))} />
      {fruit && (
        <div className="absolute -bottom-1 right-0 w-[78px] rounded-xl border border-line bg-raised p-1.5">
          <FruitIcon id={id} />
        </div>
      )}
    </div>
  );
}

/** Task picture: a fruit on its own. */
export function DiversityFruitPicture({ id }: { id: TreeId }) {
  return (
    <div className="mx-auto w-full max-w-[150px]">
      <FruitIcon id={id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts of a leaf (Figure): the lime leaf, labelled.

const LEAF_PARTS: FigurePart[] = [
  { id: "blade", label: tx("leaf blade", "Blattspreite"), at: [150, 110], tag: [190, 70], info: tx("The flat green part: here photosynthesis happens.", "Der flache grüne Teil: Hier findet die Fotosynthese statt.") },
  { id: "tip", label: tx("leaf tip", "Blattspitze"), at: [120, 26], tag: [160, 20], info: tx("The end of the blade. It can be pointed, blunt or long and drawn out.", "Das Ende der Spreite. Sie kann spitz, stumpf oder lang ausgezogen sein.") },
  { id: "midrib", label: tx("midrib (main vein)", "Mittelrippe (Hauptnerv)"), at: [120, 120], tag: [72, 54], info: tx("The main vein carries water in and sugar out, and stiffens the leaf.", "Der Hauptnerv bringt Wasser hinein und Zucker hinaus und stützt das Blatt.") },
  { id: "vein", label: tx("side vein", "Seitennerv"), at: [86, 128], tag: [36, 110], info: tx("Side veins branch off the midrib like a net.", "Seitennerven zweigen von der Mittelrippe ab und bilden ein Netz.") },
  { id: "margin", label: tx("leaf edge (margin)", "Blattrand"), at: [186, 150], tag: [222, 150], info: tx("Smooth, wavy, saw-toothed or lobed: a key feature for identifying.", "Glatt, gewellt, gesägt oder gelappt: ein wichtiges Bestimmungsmerkmal.") },
  { id: "base", label: tx("leaf base", "Blattgrund"), at: [122, 210], tag: [40, 196], info: tx("Where the blade meets the stalk. In the lime it is heart-shaped and lopsided.", "Wo die Spreite in den Stiel übergeht. Bei der Linde herzförmig und schief.") },
  { id: "stalk", label: tx("leaf stalk (petiole)", "Blattstiel"), at: [120, 238], tag: [170, 246], info: tx("Holds the blade towards the light.", "Hält die Spreite ins Licht.") },
];

export function DiversityLeafParts({ mode = "explore", show, ask, highlight, legend }: DrawingProps) {
  const g = GEO.lime;
  const b = g.blades[0];
  return (
    <Figure title={tx("Parts of a leaf (lime)", "Teile eines Blattes (Linde)")} width={240} height={270} parts={LEAF_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g transform="translate(20 4)">
        <g data-part="stalk">
          <path d={g.stalk} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3.4} strokeLinecap="round" />
        </g>
        <g data-part="blade">
          <path d={b.d} transform={b.tf} fill="var(--bio-leaf)" stroke="none" />
        </g>
        <g data-part="margin">
          <path d={b.d} transform={b.tf} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinejoin="round" />
        </g>
        <g data-part="vein" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} opacity={0.75}>
          <path d={`M0 0Q30 -6 56 -14M0 0Q-26 -8 -50 -24${veinsOf(LIME, [0.18, 0.36, 0.54, 0.7], 0.88, 0.1)}`} transform={b.tf} />
        </g>
        <g data-part="midrib">
          <path d="M100 196L100 26" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <g data-part="tip">
          <circle cx={100} cy={22} r={6} fill="var(--bio-leaf)" opacity={0} />
        </g>
        <g data-part="base">
          <circle cx={100} cy={196} r={6} fill="var(--bio-leaf)" opacity={0} />
        </g>
      </g>
    </Figure>
  );
}
