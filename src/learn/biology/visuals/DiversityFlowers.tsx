"use client";

// Flowers of six plant families for the "plant-diversity" topic: crucifers, mints, peas (papilionaceous
// flowers), roses, daisies (composites) and grasses. Each is a labelled Figure (explore it in the
// lesson, ask a part in a task), plus a family explorer widget.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { petalPath } from "./DiversityShapes";
import { FloralFormula } from "./DiversityFormula";

export type FamilyId = "brassicaceae" | "lamiaceae" | "fabaceae" | "rosaceae" | "asteraceae" | "poaceae";

export const FAMILY_NAMES: Record<FamilyId, Text> = {
  brassicaceae: tx("cabbage family (crucifers)", "Kreuzblütler"),
  lamiaceae: tx("mint family (labiates)", "Lippenblütler"),
  fabaceae: tx("pea family (papilionaceous flowers)", "Schmetterlingsblütler"),
  rosaceae: tx("rose family", "Rosengewächse"),
  asteraceae: tx("daisy family (composites)", "Korbblütler"),
  poaceae: tx("grass family (true grasses)", "Süßgräser"),
};

/** A rounded petal ("spoon"): narrow claw, broad blade; deg = direction. */
function blade(cx: number, cy: number, len: number, w: number, deg: number, claw = 0.22, notch = 0) {
  const top = notch ? `C${0.6 * w} ${-len} ${0.12 * w} ${-len - 1} 0 ${-len + notch}C${-0.12 * w} ${-len - 1} ${-0.6 * w} ${-len} ${-0.62 * w} ${-len * 0.62}` : `C${0.62 * w} ${-len * 1.04} ${-0.62 * w} ${-len * 1.04} ${-0.62 * w} ${-len * 0.62}`;
  return {
    d: `M0 0L${0.1 * w} ${-len * claw}C${0.55 * w} ${-len * 0.38} ${0.66 * w} ${-len * 0.5} ${0.62 * w} ${-len * 0.62}${top}C${-0.66 * w} ${-len * 0.5} ${-0.55 * w} ${-len * 0.38} ${-0.1 * w} ${-len * claw}Z`,
    transform: `translate(${cx} ${cy}) rotate(${deg})`,
  };
}

const green = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 1.5, strokeLinejoin: "round" as const };
const anther = { fill: "var(--bio-pollen)", stroke: "var(--bio-wood-deep)", strokeWidth: 1 };

// ---------------------------------------------------------------------------
// Crucifer (oilseed rape): flower from above, stamens and pistil from the side, a pod.

const BRASSICA_PARTS: FigurePart[] = [
  { id: "sepal", label: tx("sepal (4)", "Kelchblatt (4)"), at: [104, 52], tag: [30, 24], info: tx("Four narrow green sepals.", "Vier schmale grüne Kelchblätter.") },
  { id: "petal", label: tx("petal (4, in a cross)", "Kronblatt (4, über Kreuz)"), at: [148, 84], tag: [190, 26], info: tx("Four petals form a cross: that gives the family its name.", "Vier Kronblätter bilden ein Kreuz: Daher hat die Familie ihren Namen.") },
  { id: "long", label: tx("long stamen (4)", "langes Staubblatt (4)"), at: [262, 86], tag: [300, 50], info: tx("Four long stamens in two pairs.", "Vier lange Staubblätter in zwei Paaren.") },
  { id: "short", label: tx("short stamen (2)", "kurzes Staubblatt (2)"), at: [228, 128], tag: [218, 200], info: tx("Two short stamens: 6 stamens in all, 4 long and 2 short.", "Zwei kurze Staubblätter: zusammen 6 Staubblätter, 4 lange und 2 kurze.") },
  { id: "pistil", label: tx("pistil (2 fused carpels)", "Stempel (2 verwachsene Fruchtblätter)"), at: [250, 102], tag: [254, 222], info: tx("Ovary above the other parts (superior), made of two fused carpels.", "Fruchtknoten oberständig, aus zwei verwachsenen Fruchtblättern.") },
  { id: "pod", label: tx("silique (pod with a partition)", "Schote"), at: [374, 140], tag: [394, 230], info: tx("Opens with two valves; the seeds sit on a thin partition (septum) in the middle.", "Öffnet sich mit zwei Klappen; die Samen sitzen an einer dünnen Scheidewand in der Mitte.") },
];

function Brassica() {
  const cx = 104;
  const cy = 124;
  return (
    <>
      <g data-part="sepal">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d={petalPath(cx, cy, 78, 16, a)} {...green} />
        ))}
      </g>
      <g data-part="petal">
        {[45, 135, 225, 315].map((a) => {
          const b = blade(0, 0, 84, 58, a, 0.32);
          return <path key={a} d={b.d} transform={`translate(${cx} ${cy}) rotate(${a})`} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} strokeLinejoin="round" />;
        })}
      </g>
      {/* stamens from above: 4 long ones in pairs, 2 short ones further out */}
      <g data-part="long">
        {[
          [cx - 6, cy - 14],
          [cx + 6, cy - 14],
          [cx - 6, cy + 14],
          [cx + 6, cy + 14],
        ].map(([x, y]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx={3.6} ry={5} {...anther} />
        ))}
      </g>
      <g data-part="short">
        {[
          [cx - 20, cy],
          [cx + 20, cy],
        ].map(([x, y]) => (
          <ellipse key={x} cx={x} cy={y} rx={4.4} ry={3.2} {...anther} />
        ))}
      </g>
      <g data-part="pistil">
        <circle cx={cx} cy={cy} r={6} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
      </g>
      {/* side view: pistil in the middle, long and short stamens */}
      <path d="M216 176L284 176" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
      <path d="M250 176L250 198" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
      <g data-part="pistil">
        <path d="M244 176L244 100Q250 92 256 100L256 176Z" {...green} />
        <ellipse cx={250} cy={94} rx={8} ry={4} fill="var(--bio-leaf-deep)" />
      </g>
      <g data-part="long" stroke="var(--bio-wood-deep)" strokeWidth={1.4} fill="none">
        <path d="M238 176Q234 130 236 92M262 176Q266 130 264 92" />
        <path d="M232 176Q228 130 230 96M268 176Q272 130 270 96" opacity={0.6} />
        {[236, 264, 230, 270].map((x, i) => (
          <ellipse key={x} cx={x} cy={i < 2 ? 88 : 92} rx={3.6} ry={6} {...anther} />
        ))}
      </g>
      <g data-part="short" stroke="var(--bio-wood-deep)" strokeWidth={1.4} fill="none">
        <path d="M224 176Q218 152 222 130M276 176Q282 152 278 130" />
        <ellipse cx={222} cy={126} rx={3.6} ry={6} {...anther} />
        <ellipse cx={278} cy={126} rx={3.6} ry={6} {...anther} />
      </g>
      {/* silique: long narrow pod with a beak; one valve lifted to show the septum with seeds */}
      <g data-part="pod">
        <path d="M374 236L374 222" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} />
        <path d="M366 222C364 170 366 100 372 54L376 54C382 100 384 170 382 222Z" {...green} />
        <path d="M374 222L374 58" stroke="var(--bio-cell)" strokeWidth={3} />
        {[70, 90, 110, 130, 150, 170, 190, 208].map((y, i) => (
          <circle key={y} cx={i % 2 ? 378 : 370} cy={y} r={3.2} fill="var(--bio-wood-deep)" />
        ))}
        <path d="M382 220C396 170 398 110 384 60" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <path d="M374 54L374 38" stroke="var(--bio-leaf-deep)" strokeWidth={2.2} strokeLinecap="round" />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Mint family (dead-nettle): side view of the flower, square stem, opposite leaves.

const LAMIUM_PARTS: FigurePart[] = [
  { id: "upper", label: tx("upper lip", "Oberlippe"), at: [186, 68], tag: [140, 28], info: tx("A hood made of two fused petals; it covers the stamens.", "Ein Helm aus zwei verwachsenen Kronblättern; er überdacht die Staubblätter.") },
  { id: "lower", label: tx("lower lip", "Unterlippe"), at: [222, 178], tag: [262, 222], info: tx("Three fused petals: the landing place for bumblebees.", "Drei verwachsene Kronblätter: der Landeplatz für Hummeln.") },
  { id: "calyx", label: tx("calyx (5 fused sepals)", "Kelch (5 verwachsene Kelchblätter)"), at: [108, 186], tag: [56, 224], info: tx("Five sepals grown together into a tube with five teeth.", "Fünf Kelchblätter, zu einer Röhre mit fünf Zähnen verwachsen.") },
  { id: "stamen", label: tx("stamens (4: 2 long, 2 short)", "Staubblätter (4: 2 lange, 2 kurze)"), at: [190, 98], tag: [250, 70], info: tx("Four stamens under the hood; a bee's back brushes against them.", "Vier Staubblätter unter dem Helm; der Rücken einer Hummel streift sie.") },
  { id: "stem", label: tx("square stem", "vierkantiger Stängel"), at: [326, 66], tag: [380, 30], info: tx("Cut across, the stem is square: a sure sign of the mint family.", "Im Querschnitt ist der Stängel viereckig: ein sicheres Zeichen für Lippenblütler.") },
  { id: "leaves", label: tx("opposite leaves", "gegenständige Blätter"), at: [296, 192], tag: [300, 240], info: tx("Two leaves face each other at each node, each pair crossing the next.", "An jedem Knoten stehen sich zwei Blätter gegenüber, jedes Paar über Kreuz zum nächsten.") },
];

function Lamium() {
  return (
    <>
      <path d="M60 236Q80 214 100 200" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
      <g data-part="lower">
        <path d="M154 146C170 148 192 152 212 160C230 168 240 184 232 194C226 200 216 196 210 188C206 196 196 198 190 190C184 180 176 170 168 166C162 166 156 160 152 154Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M168 156C164 146 168 138 176 138C180 144 178 152 172 158Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
        <path d="M186 168C198 172 210 178 218 186" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.2} strokeDasharray="2 3" />
      </g>
      {/* corolla tube */}
      <path d="M104 196C116 176 130 158 150 140L160 150C142 166 126 182 116 202Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
      <g data-part="stamen" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.4}>
        <path d="M154 142C158 120 168 104 184 96M158 144C164 124 176 110 194 102" />
        <ellipse cx={185} cy={95} rx={5} ry={3} fill="var(--bio-wood-deep)" stroke="none" />
        <ellipse cx={195} cy={101} rx={5} ry={3} fill="var(--bio-wood-deep)" stroke="none" />
        <path d="M152 144C160 126 176 110 200 106" />
        <path d="M200 106l7 -4M200 106l6 3" stroke="var(--bio-petal-deep)" />
      </g>
      <g data-part="upper">
        <path d="M146 140C142 112 148 84 166 70C184 58 208 62 216 80C220 92 216 102 208 102C200 92 186 88 174 96C164 106 160 124 160 146Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M170 68C186 62 204 66 212 78" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1} strokeDasharray="1.5 3" />
      </g>
      <g data-part="calyx">
        <path d="M92 206C94 192 102 180 112 174L124 182C122 196 114 208 104 214Z" {...green} />
        <path d="M112 174L104 160L118 172L120 156L124 176L134 166L126 184" {...green} />
      </g>
      {/* square stem in cross-section */}
      <g data-part="stem">
        <rect x={306} y={46} width={40} height={40} rx={8} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
        <rect x={316} y={56} width={20} height={20} rx={4} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
        <path d="M326 96L326 250" stroke="var(--bio-leaf-deep)" strokeWidth={8} strokeLinecap="round" />
        <path d="M326 96L326 250" stroke="var(--bio-leaf)" strokeWidth={4} strokeLinecap="round" />
        <path d="M323 98L323 248" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />
      </g>
      <g data-part="leaves">
        {[
          [1, 0],
          [-1, 0],
        ].map(([s]) => (
          <g key={s} transform={`translate(326 176) scale(${s} 1)`}>
            <path d="M2 0C14 -16 40 -20 56 -8C66 0 62 14 50 20C34 28 14 16 2 0Z" {...green} />
            <path d="M2 0L52 4" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          </g>
        ))}
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pea family (garden pea): side view of the flower and an open pod.

const PEA_PARTS: FigurePart[] = [
  { id: "standard", label: tx("standard (banner)", "Fahne"), at: [168, 70], tag: [110, 30], info: tx("The big upright petal at the back: it signals to insects.", "Das große, aufrechte Kronblatt hinten: Es lockt Insekten an.") },
  { id: "wing", label: tx("wing (2)", "Flügel (2)"), at: [150, 136], tag: [80, 120], info: tx("Two wings at the sides; a bee lands on them.", "Zwei Flügel an den Seiten; eine Biene landet darauf.") },
  { id: "keel", label: tx("keel (2 fused petals)", "Schiffchen (2 verwachsene Kronblätter)"), at: [140, 176], tag: [84, 212], info: tx("Encloses stamens and pistil. When a bee pushes it down, they spring out.", "Umhüllt Staubblätter und Stempel. Drückt eine Biene es nach unten, kommen sie heraus.") },
  { id: "calyx", label: tx("calyx", "Kelch"), at: [226, 168], tag: [268, 130], info: tx("Five sepals fused into a little cup with teeth.", "Fünf verwachsene Kelchblätter mit Zähnen.") },
  { id: "pod", label: tx("legume (pod without a partition)", "Hülse"), at: [330, 222], tag: [384, 186], info: tx("One carpel; opens along two seams, the seeds sit along one edge. No partition, unlike a silique.", "Ein Fruchtblatt; öffnet sich an zwei Nähten, die Samen sitzen an einer Naht. Keine Scheidewand, anders als bei der Schote.") },
];

function Pea() {
  return (
    <>
      <path d="M232 172Q262 178 296 160" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
      <g data-part="standard">
        <path d="M222 168C196 166 140 150 132 104C126 66 160 36 196 46C228 54 240 92 234 128C232 146 228 160 222 168Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M222 160C204 130 190 96 186 60" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1} opacity={0.6} />
      </g>
      <g data-part="wing">
        <path d="M218 168C196 150 162 126 128 128C110 130 108 146 122 152C150 162 184 168 214 176Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <g data-part="keel">
        <path d="M216 176C190 178 150 182 124 172C112 168 108 158 114 156C138 166 180 168 216 166Z" fill="var(--bio-cell)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <g data-part="calyx">
        <path d="M214 160C222 156 236 160 240 170C238 180 222 184 214 178Z" {...green} />
        <path d="M216 160L206 154L218 164M216 178L204 184L218 174M224 158L218 148L228 160" {...green} />
      </g>
      {/* open legume with peas along one seam */}
      <g data-part="pod">
        <path d="M262 214C290 236 350 240 392 214C360 222 300 224 262 214Z" {...green} />
        <path d="M262 214C292 200 352 198 392 214C352 206 296 208 262 214Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} opacity={0.85} />
        {[284, 304, 324, 344, 364].map((x) => (
          <circle key={x} cx={x} cy={219} r={7.5} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
        ))}
        <path d="M392 214L402 206" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinecap="round" />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Rose family (dog rose): flower from above.

const ROSE_PARTS: FigurePart[] = [
  { id: "sepal", label: tx("sepal (5)", "Kelchblatt (5)"), at: [150, 30], tag: [70, 24], info: tx("Five green sepals between the petals.", "Fünf grüne Kelchblätter zwischen den Kronblättern.") },
  { id: "petal", label: tx("petal (5, free)", "Kronblatt (5, frei)"), at: [214, 110], tag: [270, 60], info: tx("Five separate petals: you can pull off each one on its own.", "Fünf freie Kronblätter: Du kannst jedes einzeln abzupfen.") },
  { id: "stamens", label: tx("many stamens", "viele Staubblätter"), at: [174, 148], tag: [266, 220], info: tx("A whole ring of stamens: far more than ten.", "Ein ganzer Kranz Staubblätter: weit mehr als zehn.") },
  { id: "carpels", label: tx("stigmas of the carpels", "Narben der Fruchtblätter"), at: [150, 140], tag: [50, 226], info: tx("In the middle: one or many carpels, depending on the plant (cherry 1, rose many).", "In der Mitte: ein oder viele Fruchtblätter, je nach Pflanze (Kirsche 1, Rose viele).") },
];

function Rose() {
  const cx = 150;
  const cy = 140;
  return (
    <>
      <g data-part="sepal">
        {[36, 108, 180, 252, 324].map((a) => (
          <path key={a} d={petalPath(cx, cy, 104, 16, a + 180)} {...green} />
        ))}
      </g>
      <g data-part="petal">
        {[0, 72, 144, 216, 288].map((a) => {
          const b = blade(0, 0, 92, 84, a, 0.12, 9);
          return <path key={a} d={b.d} transform={`translate(${cx} ${cy}) rotate(${a})`} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.5} strokeLinejoin="round" />;
        })}
      </g>
      <g data-part="stamens">
        {Array.from({ length: 34 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 34;
          const r0 = 15;
          const r = 27 + (i % 3) * 3;
          return (
            <g key={i}>
              <path d={`M${cx + r0 * Math.cos(a)} ${cy + r0 * Math.sin(a)}L${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`} stroke="var(--bio-wood-deep)" strokeWidth={0.9} />
              <circle cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={2.6} fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={0.6} />
            </g>
          );
        })}
      </g>
      <g data-part="carpels">
        <circle cx={cx} cy={cy} r={13} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
        {Array.from({ length: 9 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 9;
          return <circle key={i} cx={cx + 7 * Math.cos(a)} cy={cy + 7 * Math.sin(a)} r={2.4} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={0.6} />;
        })}
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Daisy family (oxeye daisy): the head from above and from the side, single florets enlarged.

const DAISY_PARTS: FigurePart[] = [
  { id: "ray", label: tx("ray floret", "Zungenblüte"), at: [110, 40], tag: [40, 30], info: tx("Each white \"petal\" is a whole flower: a ray floret with a strap-shaped corolla.", "Jedes weiße „Blütenblatt“ ist eine ganze Blüte: eine Zungenblüte mit zungenförmiger Krone.") },
  { id: "disc", label: tx("disc floret", "Röhrenblüte"), at: [120, 128], tag: [210, 30], info: tx("Each yellow dot in the middle is a tiny flower: a disc floret with a 5-lobed tube.", "Jeder gelbe Punkt in der Mitte ist eine winzige Blüte: eine Röhrenblüte mit fünfzipfeliger Röhre.") },
  { id: "bracts", label: tx("involucral bracts", "Hüllblätter"), at: [312, 112], tag: [390, 96], info: tx("Green leaves around the head, like the sepals of a single flower.", "Grüne Blätter, die das Körbchen umhüllen, wie der Kelch einer Einzelblüte.") },
  { id: "base", label: tx("receptacle (head base)", "Körbchenboden"), at: [306, 84], tag: [340, 34], info: tx("All the florets sit on this common base: together they form one head (Körbchen).", "Auf diesem gemeinsamen Boden sitzen alle Blüten: Zusammen bilden sie ein Körbchen.") },
];

function Daisy() {
  const cx = 116;
  const cy = 128;
  const discs = Array.from({ length: 90 }, (_, i) => {
    const r = 2.9 * Math.sqrt(i);
    const a = i * 2.39996;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return (
    <>
      <g data-part="ray">
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={petalPath(cx, cy, 88, 16, (i * 360) / 22 + 4)} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.1} />
        ))}
      </g>
      <g data-part="disc">
        <circle cx={cx} cy={cy} r={31} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
        {discs.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.6} fill="var(--bio-wood-deep)" opacity={0.55} />
        ))}
      </g>
      {/* head from the side, cut: receptacle, bracts below, florets on top */}
      <g data-part="ray">
        <path d="M268 88L232 96M344 88L380 96" stroke="var(--bio-outline)" strokeWidth={6} strokeLinecap="round" />
        <path d="M268 88L232 96M344 88L380 96" stroke="var(--bio-cell)" strokeWidth={3.6} strokeLinecap="round" />
      </g>
      <g data-part="disc">
        {[272, 282, 292, 302, 312, 322, 332, 342].map((x, i) => (
          <path key={x} d={`M${x} ${84 - Math.sin((i / 7) * Math.PI) * 6}l0 -10`} stroke="var(--bio-sun)" strokeWidth={6} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="base">
        <path d="M266 90C276 74 336 74 346 90Z" fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
      </g>
      <g data-part="bracts">
        <path d="M266 90C276 112 336 112 346 90Z" {...green} />
        <path d="M276 96l6 10M290 100l4 10M306 100l0 10M322 100l-4 10M336 96l-6 10" stroke="var(--bio-leaf-deep)" strokeWidth={1.1} />
      </g>
      <path d="M306 108L306 140" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" />
      {/* single florets enlarged */}
      <g data-part="ray">
        <path d="M262 246L262 230" stroke="var(--bio-leaf-deep)" strokeWidth={5} strokeLinecap="round" />
        <path d="M258 230C258 214 262 196 270 180C278 168 290 168 288 178C284 196 272 214 266 230Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      </g>
      <g data-part="disc">
        <path d="M344 248L344 232" stroke="var(--bio-leaf-deep)" strokeWidth={5} strokeLinecap="round" />
        <path d="M338 232L336 200L332 190L338 194L340 186L344 194L348 186L350 194L356 190L352 200L350 232Z" fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M344 196L344 176M344 176l-4 -6M344 176l4 -6" stroke="var(--bio-wood-deep)" strokeWidth={1.3} fill="none" />
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------
// Grass (wheat): stalk with nodes, leaf sheath, ear, one spikelet enlarged.

const GRASS_PARTS: FigurePart[] = [
  { id: "ear", label: tx("ear (spike)", "Ähre"), at: [110, 60], tag: [50, 30], info: tx("Many spikelets sit directly on the main axis.", "Viele Ährchen sitzen direkt an der Hauptachse.") },
  { id: "spikelet", label: tx("spikelet", "Ährchen"), at: [272, 112], tag: [326, 54], info: tx("A small group of flowers wrapped in husks (glumes), no colourful petals.", "Eine kleine Gruppe von Blüten, eingehüllt von Spelzen, ohne bunte Kronblätter.") },
  { id: "stamens", label: tx("hanging stamens (3)", "heraushängende Staubblätter (3)"), at: [300, 170], tag: [356, 210], info: tx("Swing in the wind and release lots of light pollen: wind pollination.", "Pendeln im Wind und geben viel leichten Pollen ab: Windbestäubung.") },
  { id: "stigma", label: tx("feathery stigma", "federartige Narbe"), at: [236, 108], tag: [190, 54], info: tx("Large and feathery to catch pollen from the air.", "Groß und federartig, um Pollen aus der Luft aufzufangen.") },
  { id: "node", label: tx("node", "Knoten"), at: [110, 206], tag: [160, 214], info: tx("A thickened ring that stiffens the hollow stalk.", "Ein verdickter Ring, der den hohlen Halm stabilisiert.") },
  { id: "stalk", label: tx("hollow stalk (culm)", "Halm (hohl)"), at: [110, 150], tag: [160, 140], info: tx("A grass stem: round, hollow between the nodes.", "Der Stängel der Gräser: rund und zwischen den Knoten hohl.") },
  { id: "sheath", label: tx("leaf sheath", "Blattscheide"), at: [110, 236], tag: [44, 256], info: tx("The lower part of the leaf wraps round the stalk.", "Der untere Teil des Blattes umhüllt den Halm.") },
];

function Grass() {
  const spikelets = Array.from({ length: 9 }, (_, i) => ({ y: 112 - i * 10, s: i % 2 ? 1 : -1 }));
  return (
    <>
      <g data-part="stalk">
        <path d="M110 292L110 120" stroke="var(--bio-wood)" strokeWidth={6} strokeLinecap="round" />
      </g>
      <g data-part="sheath">
        <path d="M104 274L104 222Q110 216 116 222L116 274Z" {...green} />
        <path d="M116 226C130 210 150 190 196 170C160 196 136 214 118 236Z" {...green} />
      </g>
      <g data-part="node">
        <rect x={102} y={202} width={16} height={8} rx={4} fill="var(--bio-wood-deep)" />
        <rect x={102} y={274} width={16} height={8} rx={4} fill="var(--bio-wood-deep)" />
      </g>
      <g data-part="ear">
        <path d="M110 124L110 22" stroke="var(--bio-wood)" strokeWidth={3} />
        {spikelets.map(({ y, s }) => (
          <ellipse key={y} cx={110 + s * 7} cy={y} rx={7} ry={10} transform={`rotate(${s * 18} ${110 + s * 7} ${y})`} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
        ))}
      </g>
      {/* enlarged spikelet in flower */}
      <path d="M150 70L238 96" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
      <g data-part="spikelet">
        <path d="M272 160C252 140 250 108 268 76C286 108 290 140 272 160Z" fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
        <path d="M272 160C262 130 264 104 272 84M272 160C282 130 280 104 272 84" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1} opacity={0.6} />
        <path d="M272 160L272 176" stroke="var(--bio-wood)" strokeWidth={3} />
      </g>
      <g data-part="stamens" stroke="var(--bio-wood-deep)" strokeWidth={1.1} fill="none">
        <path d="M280 120Q300 130 300 164M282 128Q314 140 318 170M278 132Q286 150 284 176" />
        <rect x={296} y={164} width={8} height={14} rx={3} fill="var(--bio-pollen)" />
        <rect x={314} y={170} width={8} height={14} rx={3} fill="var(--bio-pollen)" />
        <rect x={280} y={176} width={8} height={14} rx={3} fill="var(--bio-pollen)" />
      </g>
      <g data-part="stigma" stroke="var(--bio-outline)" strokeWidth={1} fill="none">
        <path d="M264 104Q250 100 236 104M266 98Q254 88 244 82" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${262 - i * 5} ${103 - i * 0.2}l-3 -5M${262 - i * 5} ${103 - i * 0.2}l-3 5M${264 - i * 4} ${97 - i * 3}l-5 -2M${264 - i * 4} ${97 - i * 3}l1 -6`} />
        ))}
      </g>
    </>
  );
}

const FIG: Record<FamilyId, { parts: FigurePart[]; w: number; h: number; Draw: ComponentType; title: Text }> = {
  brassicaceae: { parts: BRASSICA_PARTS, w: 420, h: 250, Draw: Brassica, title: tx("Crucifer flower (oilseed rape)", "Kreuzblüte (Raps)") },
  lamiaceae: { parts: LAMIUM_PARTS, w: 420, h: 260, Draw: Lamium, title: tx("Mint-family flower (dead-nettle)", "Lippenblüte (Taubnessel)") },
  fabaceae: { parts: PEA_PARTS, w: 420, h: 250, Draw: Pea, title: tx("Papilionaceous flower (pea)", "Schmetterlingsblüte (Erbse)") },
  rosaceae: { parts: ROSE_PARTS, w: 300, h: 260, Draw: Rose, title: tx("Rose-family flower (dog rose)", "Rosenblüte (Hundsrose)") },
  asteraceae: { parts: DAISY_PARTS, w: 420, h: 260, Draw: Daisy, title: tx("Flower head of the daisy family (oxeye daisy)", "Blütenkörbchen (Margerite)") },
  poaceae: { parts: GRASS_PARTS, w: 400, h: 300, Draw: Grass, title: tx("Grass (wheat) with a spikelet in flower", "Gras (Weizen) mit blühendem Ährchen") },
};

/** The family's flower as a labelled drawing. */
export function DiversityFlower({ family = "brassicaceae", mode = "names", show, ask, highlight, legend }: DrawingProps & { family?: FamilyId }) {
  const f = FIG[family];
  return (
    <Figure title={f.title} width={f.w} height={f.h} parts={f.parts} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <f.Draw />
    </Figure>
  );
}

/** Ids of the labelled parts of a family's drawing (for tasks). */
export const flowerParts = (family: FamilyId) => FIG[family].parts;

export type FamilyFacts = { flower: Text; fruit: Text; more: Text; examples: Text; formula?: string; formulaOf?: Text };

export const FAMILY_FACTS: Record<FamilyId, FamilyFacts> = {
  brassicaceae: {
    flower: tx("4 sepals, 4 petals in a cross, 6 stamens (4 long, 2 short), ovary of 2 fused carpels", "4 Kelchblätter, 4 Kronblätter über Kreuz, 6 Staubblätter (4 lange, 2 kurze), Fruchtknoten aus 2 verwachsenen Fruchtblättern"),
    fruit: tx("silique (pod with a partition), or a short silicle", "Schote (mit Scheidewand) oder Schötchen"),
    more: tx("often yellow or white; leaves often taste sharp (mustard oils)", "oft gelb oder weiß; Blätter schmecken oft scharf (Senföle)"),
    examples: tx("oilseed rape, mustard, cabbage, radish, shepherd's purse", "Raps, Senf, Kohl, Radieschen, Hirtentäschel"),
    formula: "*K4C4A2+4G(2)o",
  },
  lamiaceae: {
    flower: tx("zygomorphic, upper and lower lip, 4 stamens (2 long, 2 short), ovary of 2 carpels", "zygomorph, Ober- und Unterlippe, 4 Staubblätter (2 lange, 2 kurze), Fruchtknoten aus 2 Fruchtblättern"),
    fruit: tx("splits into 4 little nuts (nutlets)", "zerfällt in 4 Nüsschen (Klausenfrucht)"),
    more: tx("square stem, opposite leaves, often fragrant (essential oils)", "vierkantiger Stängel, gegenständige Blätter, oft duftend (ätherische Öle)"),
    examples: tx("dead-nettle, sage, mint, thyme, lavender", "Taubnessel, Salbei, Minze, Thymian, Lavendel"),
    formula: "vK(5)C(2+3)A2+2G(2)o",
  },
  fabaceae: {
    flower: tx("zygomorphic: standard, 2 wings, keel; 10 stamens (9 fused, 1 free); 1 carpel", "zygomorph: Fahne, 2 Flügel, Schiffchen; 10 Staubblätter (9 verwachsen, 1 frei); 1 Fruchtblatt"),
    fruit: tx("legume (pod without a partition)", "Hülse (ohne Scheidewand)"),
    more: tx("root nodules with bacteria that fix nitrogen from the air", "Wurzelknöllchen mit Bakterien, die Stickstoff aus der Luft binden"),
    examples: tx("pea, bean, clover, lupin, soya", "Erbse, Bohne, Klee, Lupine, Soja"),
    formula: "vK(5)C1+2+(2)A(9)+1G1o",
  },
  rosaceae: {
    flower: tx("radial, 5 sepals, 5 free petals, many stamens; one to many carpels", "radiär, 5 Kelchblätter, 5 freie Kronblätter, viele Staubblätter; ein bis viele Fruchtblätter"),
    fruit: tx("very varied: drupe (cherry), pome (apple), aggregate fruits (strawberry, raspberry)", "sehr vielfältig: Steinfrucht (Kirsche), Apfelfrucht (Apfel), Sammelfrüchte (Erdbeere, Himbeere)"),
    more: tx("leaves often with stipules; many of our fruit trees", "Blätter oft mit Nebenblättern; viele unserer Obstbäume"),
    examples: tx("rose, apple, cherry, strawberry, blackberry", "Rose, Apfel, Kirsche, Erdbeere, Brombeere"),
    formula: "*K5C5AxG1m",
    formulaOf: tx("cherry; the carpels vary in this family", "Kirsche; die Fruchtblätter sind in dieser Familie verschieden"),
  },
  asteraceae: {
    flower: tx("a head (Körbchen) of many small florets: ray florets and/or disc florets, surrounded by bracts", "ein Körbchen aus vielen kleinen Blüten: Zungen- und/oder Röhrenblüten, umgeben von Hüllblättern"),
    fruit: tx("achene (small nut), often with a parachute of hairs (pappus)", "Achäne (kleine Nussfrucht), oft mit Haarschirm (Pappus)"),
    more: tx("the head looks like one flower but is a whole inflorescence", "das Körbchen wirkt wie eine Blüte, ist aber ein ganzer Blütenstand"),
    examples: tx("dandelion, daisy, sunflower, chamomile, cornflower", "Löwenzahn, Gänseblümchen, Sonnenblume, Kamille, Kornblume"),
  },
  poaceae: {
    flower: tx("small, plain flowers in spikelets, husks (glumes) instead of petals, 3 hanging stamens, feathery stigmas", "kleine, unscheinbare Blüten in Ährchen, Spelzen statt Kronblättern, 3 heraushängende Staubblätter, federartige Narben"),
    fruit: tx("grain (caryopsis)", "Korn (Karyopse)"),
    more: tx("hollow stalk (culm) with nodes, long narrow leaves with parallel veins and a leaf sheath; wind-pollinated", "hohler Halm mit Knoten, lange schmale Blätter mit parallelen Nerven und Blattscheide; Windbestäubung"),
    examples: tx("wheat, rye, barley, oats, maize, rice", "Weizen, Roggen, Gerste, Hafer, Mais, Reis"),
  },
};

const ORDER: FamilyId[] = ["brassicaceae", "lamiaceae", "fabaceae", "rosaceae", "asteraceae", "poaceae"];

/** Lesson widget: explore the flower of each family. */
export function DiversityFamilies() {
  const t = useText();
  const scope = useId();
  const [fam, setFam] = useState<FamilyId>("brassicaceae");
  const f = FAMILY_FACTS[fam];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFam(k)}
            className={cn("relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", fam === k ? "text-white" : "bg-hover text-ink-2 hover:text-ink")}
          >
            {fam === k && <motion.span layoutId={`${scope}-f`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(FAMILY_NAMES[k]).split(" (")[0]}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={fam} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }} className="space-y-3">
          <DiversityFlower family={fam} mode="explore" />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[14px] leading-snug">
            <dt className="font-semibold text-ink-3">{t(tx("Flower", "Blüte"))}</dt>
            <dd className="text-ink">{t(f.flower)}</dd>
            <dt className="font-semibold text-ink-3">{t(tx("Fruit", "Frucht"))}</dt>
            <dd className="text-ink">{t(f.fruit)}</dd>
            <dt className="font-semibold text-ink-3">{t(tx("Also", "Außerdem"))}</dt>
            <dd className="text-ink">{t(f.more)}</dd>
            <dt className="font-semibold text-ink-3">{t(tx("Examples", "Beispiele"))}</dt>
            <dd className="text-ink">{t(f.examples)}</dd>
            {f.formula && (
              <>
                <dt className="font-semibold text-ink-3">{t(tx("Formula", "Formel"))}</dt>
                <dd className="flex flex-wrap items-baseline gap-x-2">
                  <FloralFormula code={f.formula} size="sm" />
                  {f.formulaOf && <span className="text-[12.5px] text-ink-3">({t(f.formulaOf)})</span>}
                </dd>
              </>
            )}
          </dl>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
