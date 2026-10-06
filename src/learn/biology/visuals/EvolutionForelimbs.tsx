"use client";

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

// Homologous forelimbs: human arm, bat wing, whale flipper and horse leg are built from the
// same bones (same colour = same bone), even though they do very different jobs.

const OUT = "var(--bio-outline)";
const C = {
  humerus: "var(--bio-mito)",
  forearm: "var(--bio-sun)",
  carpals: "var(--bio-leaf)",
  metacarpals: "var(--bio-water)",
  phalanges: "var(--bio-nucleus)",
};

type Seg = [number, number, number, number, number];

/** A bone between two points: an outline stroke with the bone's colour on top. */
function Bones({ segs, fill }: { segs: Seg[]; fill: string }) {
  return (
    <>
      {segs.map(([x1, y1, x2, y2, w], i) => (
        <line key={`o${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={OUT} strokeWidth={w + 2.6} strokeLinecap="round" />
      ))}
      {segs.map(([x1, y1, x2, y2, w], i) => (
        <line key={`f${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />
      ))}
    </>
  );
}

function Pebbles({ pts, r, fill }: { pts: [number, number][]; r: number; fill: string }) {
  return (
    <>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={fill} stroke={OUT} strokeWidth={1.2} />
      ))}
    </>
  );
}

/** Finger segments one after another from (x, y), each `len` long in direction (dx, dy). */
function digit(x: number, y: number, dx: number, dy: number, n: number, len: number, w: number): Seg[] {
  const m = Math.hypot(dx, dy);
  const ux = dx / m;
  const uy = dy / m;
  const out: Seg[] = [];
  let cx = x;
  let cy = y;
  for (let i = 0; i < n; i++) {
    const l = len * (1 - i * 0.12);
    out.push([cx, cy, cx + ux * l, cy + uy * l, w]);
    cx += ux * (l + 3.4);
    cy += uy * (l + 3.4);
  }
  return out;
}

// --- the four limbs, bone by bone -------------------------------------------------------

const HUMAN = {
  humerus: [[80, 34, 80, 118, 11]] as Seg[],
  forearm: [
    [75, 127, 72, 196, 6],
    [86, 127, 90, 196, 6],
  ] as Seg[],
  carpals: [
    [71, 205],
    [78, 203],
    [85, 204],
    [92, 206],
    [74, 212],
    [82, 212],
    [89, 213],
  ] as [number, number][],
  metacarpals: [
    [69, 215, 62, 231, 3.6],
    [76, 218, 74, 245, 3.6],
    [82, 218, 82, 248, 3.6],
    [88, 218, 90, 245, 3.6],
    [93, 216, 97, 241, 3.6],
  ] as Seg[],
  phalanges: [...digit(60, 236, -4, 10, 2, 11, 3.2), ...digit(73, 250, -0.5, 10, 3, 12, 3.2), ...digit(82, 253, 0, 10, 3, 13, 3.2), ...digit(91, 250, 0.6, 10, 3, 12, 3.2), ...digit(98, 245, 1.2, 10, 3, 10, 3)],
};

const BAT = {
  humerus: [[228, 34, 216, 96, 10]] as Seg[],
  forearm: [
    [214, 104, 190, 176, 6],
    [221, 105, 208, 136, 3.4],
  ] as Seg[],
  carpals: [
    [185, 182],
    [192, 184],
    [187, 190],
    [194, 191],
  ] as [number, number][],
  metacarpals: [
    [184, 180, 177, 170, 3],
    [189, 194, 204, 246, 3],
    [192, 194, 228, 240, 3],
    [195, 192, 250, 222, 3],
    [196, 188, 258, 196, 3],
  ] as Seg[],
  phalanges: [...digit(175, 166, -0.5, -1, 1, 7, 2.6), ...digit(206, 251, 0.3, 1, 2, 16, 2.4), ...digit(231, 244, 0.7, 1, 2, 24, 2.4), ...digit(254, 225, 1, 0.65, 2, 24, 2.4), ...digit(262, 198, 1, 0.2, 2, 20, 2.4)],
};

const WHALE = {
  humerus: [[385, 42, 385, 82, 18]] as Seg[],
  forearm: [
    [376, 94, 373, 128, 10],
    [394, 94, 397, 128, 10],
  ] as Seg[],
  carpals: [
    [372, 141],
    [381, 140],
    [390, 140],
    [399, 142],
    [376, 150],
    [385, 150],
    [394, 151],
  ] as [number, number][],
  metacarpals: [
    [369, 160, 367, 178, 4.4],
    [379, 160, 378, 180, 4.4],
    [390, 160, 391, 180, 4.4],
    [400, 160, 403, 176, 4.4],
  ] as Seg[],
  phalanges: [...digit(366, 186, -0.25, 1, 5, 13, 4), ...digit(377, 188, -0.08, 1, 7, 13, 4), ...digit(391, 188, 0.08, 1, 5, 13, 4), ...digit(404, 183, 0.3, 1, 3, 12, 3.6)],
};

const HORSE = {
  humerus: [[536, 34, 529, 92, 16]] as Seg[],
  forearm: [
    [531, 101, 534, 175, 11],
    [542, 102, 541, 126, 4.5],
  ] as Seg[],
  carpals: [
    [527, 184],
    [535, 183],
    [543, 185],
    [531, 191],
    [540, 192],
  ] as [number, number][],
  metacarpals: [
    [535, 199, 535, 256, 9],
    [527, 199, 528, 230, 2.8],
    [543, 199, 542, 230, 2.8],
  ] as Seg[],
  phalanges: [
    [535, 263, 536, 274, 8],
    [536, 280, 537, 287, 8],
    [537, 293, 537, 298, 9],
  ] as Seg[],
};

const LIMBS = [HUMAN, BAT, WHALE, HORSE];

const PARTS: FigurePart[] = [
  { id: "humerus", label: tx("upper arm bone (humerus)", "Oberarmknochen"), at: [80, 76], tag: [26, 70], info: tx("One single bone next to the body, in all four animals.", "Ein einzelner Knochen nahe am Körper, bei allen vier Tieren.") },
  { id: "forearm", label: tx("radius and ulna", "Elle und Speiche"), at: [73, 160], tag: [26, 150], info: tx("Two forearm bones. In the bat and the horse one of them is reduced and fused.", "Zwei Unterarmknochen. Bei Fledermaus und Pferd ist einer davon zurückgebildet und verwachsen.") },
  { id: "carpals", label: tx("wrist bones (carpals)", "Handwurzelknochen"), at: [78, 208], tag: [26, 202], info: tx("Several small wrist bones. In the horse they form the 'knee' of the front leg.", "Mehrere kleine Handwurzelknochen. Beim Pferd bilden sie das „Knie“ des Vorderbeins.") },
  { id: "metacarpals", label: tx("metacarpals", "Mittelhandknochen"), at: [76, 232], tag: [26, 238], info: tx("Very long in the bat wing; in the horse one strong cannon bone with two thin splint bones.", "In der Fledermaus sehr lang, beim Pferd ein kräftiger Röhrbeinknochen mit zwei dünnen Griffelbeinen.") },
  { id: "phalanges", label: tx("finger bones (phalanges)", "Fingerknochen"), at: [74, 268], tag: [26, 276], info: tx("Long wing fingers in the bat, many segments in the whale, a single toe with a hoof in the horse.", "Lange Flügelfinger bei der Fledermaus, viele Glieder beim Wal, beim Pferd ein einziger Zeh mit Huf.") },
];

export function EvolutionForelimbs({ mode = "explore", show, ask, highlight, legend }: DrawingProps) {
  const t = useText();
  const skin = "color-mix(in oklab, var(--bio-flesh) 40%, transparent)";
  const edge = "color-mix(in oklab, var(--bio-flesh-deep) 55%, transparent)";
  const names = [tx("human", "Mensch"), tx("bat", "Fledermaus"), tx("whale", "Wal"), tx("horse", "Pferd")];
  const xs = [80, 236, 386, 536];
  return (
    <Figure title={tx("Forelimbs of four mammals", "Vordergliedmaßen von vier Säugetieren")} width={620} height={344} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* soft outlines of arm, wing, flipper and leg */}
      <path d="M66 28 Q62 110 66 198 Q50 222 50 248 Q52 262 58 256 L64 272 Q68 298 82 297 Q100 297 104 274 Q110 236 100 200 Q98 110 96 28 Z" fill={skin} stroke={edge} strokeWidth={1.4} />
      <path d="M222 30 L240 40 Q300 110 302 196 L304 216 Q296 240 300 264 Q290 290 272 308 Q246 290 222 286 Q214 276 208 286 Q200 268 186 196 Q176 172 172 160 Q196 120 206 96 Z" fill={skin} stroke={edge} strokeWidth={1.4} />
      <path d="M370 36 Q352 80 354 140 Q354 220 378 300 Q392 314 400 298 Q416 220 414 140 Q416 80 402 36 Z" fill="color-mix(in oklab, var(--bio-water) 25%, transparent)" stroke="color-mix(in oklab, var(--bio-water-deep) 45%, transparent)" strokeWidth={1.4} />
      <path d="M518 28 Q510 70 516 100 Q520 150 520 200 Q518 250 522 270 L520 290 L552 290 L550 270 Q552 250 550 200 Q552 150 554 100 Q558 60 552 28 Z" fill="color-mix(in oklab, var(--bio-wood) 25%, transparent)" stroke="color-mix(in oklab, var(--bio-wood-deep) 40%, transparent)" strokeWidth={1.4} />
      <path d="M522 286 L550 286 L558 306 L516 306 Z" fill="color-mix(in oklab, var(--bio-outline) 45%, var(--bio-wood))" stroke={OUT} strokeWidth={1.3} strokeLinejoin="round" opacity={0.8} />
      <path d="M174 158 q-6 -6 -2 -11" fill="none" stroke={OUT} strokeWidth={1.6} strokeLinecap="round" />
      <g data-part="humerus">
        {LIMBS.map((l, i) => (
          <Bones key={i} segs={l.humerus} fill={C.humerus} />
        ))}
      </g>
      <g data-part="forearm">
        {LIMBS.map((l, i) => (
          <Bones key={i} segs={l.forearm} fill={C.forearm} />
        ))}
      </g>
      <g data-part="carpals">
        {LIMBS.map((l, i) => (
          <Pebbles key={i} pts={l.carpals} r={i === 2 ? 4.2 : 3.6} fill={C.carpals} />
        ))}
      </g>
      <g data-part="metacarpals">
        {LIMBS.map((l, i) => (
          <Bones key={i} segs={l.metacarpals} fill={C.metacarpals} />
        ))}
      </g>
      <g data-part="phalanges">
        {LIMBS.map((l, i) => (
          <Bones key={i} segs={l.phalanges} fill={C.phalanges} />
        ))}
      </g>
      {names.map((n, i) => (
        <text key={i} x={xs[i]} y={334} textAnchor="middle" fontSize={15} fontWeight={600} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(n)}
        </text>
      ))}
    </Figure>
  );
}
