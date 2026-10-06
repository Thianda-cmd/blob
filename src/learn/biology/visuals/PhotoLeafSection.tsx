"use client";

// Cross-section of a leaf for level 2: where in the leaf photosynthesis happens. Tall palisade
// cells full of chloroplasts under a clear epidermis, spongy tissue with air spaces, a vascular
// bundle (xylem on top, phloem below) and a stoma with two guard cells on the underside.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const LEAF_SECTION_PARTS: FigurePart[] = [
  { id: "cuticle", label: tx("cuticle", "Cuticula"), at: [96, 25], tag: [60, 12], info: tx("A thin wax layer. It stops the leaf drying out and lets light through.", "Eine dünne Wachsschicht. Sie schützt vor Austrocknung und lässt Licht durch.") },
  { id: "upper", label: tx("upper epidermis", "obere Epidermis"), at: [214, 41], tag: [214, 12], info: tx("Clear cells without chloroplasts: the light passes straight through.", "Durchsichtige Zellen ohne Chloroplasten: Das Licht geht einfach hindurch.") },
  { id: "palisade", label: tx("palisade tissue", "Palisadengewebe"), at: [452, 100], info: tx("Tall cells packed with chloroplasts right under the surface: most photosynthesis happens here.", "Hohe Zellen voller Chloroplasten direkt unter der Oberfläche: Hier findet die meiste Fotosynthese statt.") },
  { id: "chloro", label: tx("chloroplast", "Chloroplast"), at: [99, 120], tag: [32, 120], info: tx("Contains chlorophyll. Light energy is turned into chemical energy here.", "Enthält Chlorophyll. Hier wird Lichtenergie in chemische Energie umgewandelt.") },
  { id: "spongy", label: tx("spongy tissue", "Schwammgewebe"), at: [470, 200], info: tx("Loosely packed cells with fewer chloroplasts.", "Locker liegende Zellen mit weniger Chloroplasten.") },
  { id: "air", label: tx("air spaces", "Interzellularen (Lufträume)"), at: [396, 214], tag: [396, 296], info: tx("Carbon dioxide spreads through them to the cells, oxygen spreads out.", "Durch sie verteilt sich Kohlenstoffdioxid zu den Zellen, Sauerstoff strömt hinaus.") },
  { id: "bundle", label: tx("vascular bundle (vein)", "Leitbündel (Blattader)"), at: [300, 192], info: tx("Xylem (top) brings water; phloem (bottom) carries the sugar away.", "Xylem (oben) bringt Wasser, Phloem (unten) transportiert den Zucker ab.") },
  { id: "lower", label: tx("lower epidermis", "untere Epidermis"), at: [500, 261], tag: [530, 296], info: tx("The underside of the leaf, with many stomata.", "Die Blattunterseite mit vielen Spaltöffnungen.") },
  { id: "stoma", label: tx("stoma with guard cells", "Spaltöffnung mit Schließzellen"), at: [150, 262], tag: [150, 300], info: tx("Carbon dioxide gets in, oxygen and water vapour get out. The guard cells open and close it.", "Kohlenstoffdioxid kommt hinein, Sauerstoff und Wasserdampf hinaus. Die Schließzellen öffnen und schließen sie.") },
];

const OUT = "var(--bio-outline)";
const WALL = "var(--bio-wall-deep)";

// Deterministic little jitter for the spongy cells.
const jit = (i: number, k: number) => (((i * 9301 + k * 49297) % 233280) / 233280 - 0.5) * 2;

const PALISADE = Array.from({ length: 19 }, (_, i) => 20 + i * 27.4);
const SPONGY: [number, number, number, number][] = [];
for (let row = 0; row < 3; row++) {
  for (let i = 0; i < 13; i++) {
    const x = 34 + i * 41 + (row % 2) * 18 + jit(i, row) * 5;
    const y = 172 + row * 30 + jit(row, i) * 4;
    if (x > 238 && x < 362) continue; // vascular bundle
    if (x > 118 && x < 182 && row === 2) continue; // air chamber above the stoma
    if (x > 540) continue;
    SPONGY.push([x, y, 15 + jit(i + 3, row) * 3, 11 + jit(i, row + 5) * 2]);
  }
}

export function PhotoLeafSection({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Cross-section of a leaf", "Querschnitt durch ein Laubblatt")} width={560} height={312} parts={LEAF_SECTION_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* the leaf's inside: air spaces */}
      <rect x={10} y={26} width={540} height={250} rx={6} fill="var(--bio-vacuole)" opacity={0.35} />
      <g data-part="air">
        {[
          [70, 200],
          [210, 226],
          [396, 214],
          [460, 238],
          [120, 168],
          [500, 176],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={0.8} strokeDasharray="2 2" />
        ))}
      </g>

      <g data-part="cuticle">
        <rect x={10} y={22} width={540} height={7} rx={3} fill="var(--bio-membrane)" opacity={0.85} />
        <rect x={10} y={272} width={540} height={5} rx={2.5} fill="var(--bio-membrane)" opacity={0.85} />
      </g>

      <g data-part="upper">
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={12 + i * 38.4} y={30} width={37} height={23} rx={5} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.5} />
        ))}
      </g>

      <g data-part="palisade">
        {PALISADE.map((x, i) => (
          <rect key={i} x={x} y={56} width={25} height={94} rx={10} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.5} />
        ))}
      </g>
      <g data-part="chloro">
        {PALISADE.flatMap((x, i) =>
          [66, 84, 102, 120, 138].flatMap((y, k) => [
            <ellipse key={`${i}a${k}`} cx={x + 6} cy={y + (i % 2) * 4} rx={3.4} ry={6} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />,
            <ellipse key={`${i}b${k}`} cx={x + 19} cy={y + 8 - (i % 2) * 4} rx={3.4} ry={6} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />,
          ]),
        )}
      </g>

      <g data-part="spongy">
        {SPONGY.map(([x, y, rx, ry], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.4} transform={`rotate(${jit(i, 7) * 25} ${x} ${y})`} />
            <ellipse cx={x - rx * 0.45} cy={y - 2} rx={2.8} ry={4.2} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.7} />
            <ellipse cx={x + rx * 0.4} cy={y + 2} rx={2.8} ry={4.2} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.7} />
          </g>
        ))}
      </g>

      <g data-part="bundle">
        <circle cx={300} cy={192} r={50} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.4} />
        {Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return <circle key={i} cx={300 + Math.cos(a) * 44} cy={192 + Math.sin(a) * 44} r={7.5} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.2} />;
        })}
        {/* xylem: wide, thick-walled vessels towards the upper side */}
        {[
          [280, 172, 7],
          [298, 166, 8],
          [318, 172, 7],
          [289, 186, 6],
          [309, 186, 6],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={2.6} />
        ))}
        {/* phloem: small cells towards the lower side */}
        {[
          [284, 206],
          [296, 212],
          [308, 206],
          [318, 214],
          [290, 220],
          [303, 222],
          [278, 216],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4.6} fill="var(--bio-petal)" stroke={OUT} strokeWidth={0.9} opacity={0.9} />
        ))}
      </g>

      <g data-part="lower">
        {Array.from({ length: 14 }, (_, i) => {
          const x = 12 + i * 38.4;
          if (x > 112 && x < 170) return null;
          return <rect key={i} x={x} y={250} width={37} height={21} rx={5} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.5} />;
        })}
        <rect x={107} y={250} width={22} height={21} rx={5} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.5} />
        <rect x={171} y={250} width={18} height={21} rx={5} fill="var(--bio-cell)" stroke={WALL} strokeWidth={1.5} />
      </g>

      <g data-part="stoma">
        <path d="M118 226 Q 150 214 182 226 L 182 250 L 118 250 Z" fill="var(--bio-vacuole)" opacity={0.6} />
        <path d="M131 251 C 131 262 140 271 147 271 C 148 264 148 258 147 251 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <path d="M169 251 C 169 262 160 271 153 271 C 152 264 152 258 153 251 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      </g>
    </Figure>
  );
}

/** The leaf section to explore in the lesson. */
export function PhotoLeafSectionExplore() {
  return <PhotoLeafSection mode="explore" />;
}
