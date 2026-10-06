"use client";

// A plant in the sun for level 1: where water, carbon dioxide and light get in. Two magnifier
// bubbles show the chloroplasts in the leaf cells and a stoma on the underside of a leaf.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const PLANT_PARTS: FigurePart[] = [
  { id: "sun", label: tx("sunlight", "Sonnenlicht"), at: [62, 58], info: tx("Supplies the energy. Light is energy, not a substance.", "Liefert die Energie. Licht ist Energie, kein Stoff.") },
  { id: "leaf", label: tx("leaf", "Laubblatt"), at: [330, 118], info: tx("The plant's food factory: photosynthesis happens here.", "Die Nahrungsfabrik der Pflanze: Hier findet die Fotosynthese statt.") },
  {
    id: "chloro",
    label: tx("chloroplasts (with chlorophyll)", "Chloroplasten (mit Chlorophyll)"),
    at: [96, 214],
    tag: [40, 262],
    info: tx("Green grains in the leaf cells. Their green pigment chlorophyll captures the light.", "Grüne Körner in den Blattzellen. Ihr grüner Farbstoff Chlorophyll fängt das Licht ein."),
  },
  {
    id: "stoma",
    label: tx("stoma", "Spaltöffnung"),
    at: [420, 238],
    tag: [470, 286],
    info: tx("Tiny opening, mostly on the underside of the leaf: carbon dioxide gets in, oxygen gets out.", "Winzige Öffnung, meist an der Blattunterseite: Kohlenstoffdioxid kommt hinein, Sauerstoff hinaus."),
  },
  { id: "stem", label: tx("stem", "Sprossachse (Stängel)"), at: [244, 238], info: tx("Carries water up from the roots to the leaves.", "Leitet das Wasser von den Wurzeln zu den Blättern."), tag: [282, 262] },
  { id: "root", label: tx("roots", "Wurzeln"), at: [236, 318], info: tx("Take up water and minerals from the soil. They don't make food.", "Nehmen Wasser und Mineralstoffe aus dem Boden auf. Nahrung stellen sie nicht her.") },
];

const OUT = "var(--bio-outline)";

export function PhotoPlant({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("A plant in the light", "Eine Pflanze im Licht")} width={500} height={350} parts={PLANT_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* soil */}
      <path d="M0 290 Q 120 282 250 288 T 500 286 L 500 350 L 0 350 Z" fill="var(--bio-soil)" opacity={0.75} />

      <g data-part="sun">
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return <line key={i} x1={62 + Math.cos(a) * 32} y1={58 + Math.sin(a) * 32} x2={62 + Math.cos(a) * 44} y2={58 + Math.sin(a) * 44} stroke="var(--bio-sun)" strokeWidth={4} strokeLinecap="round" />;
        })}
        <circle cx={62} cy={58} r={26} fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.8} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${110 + i * 8} ${88 + i * 14} q 18 6 36 4 t 36 6 t 36 4 t 30 6`} fill="none" stroke="var(--bio-sun)" strokeWidth={2.2} strokeDasharray="7 6" strokeLinecap="round" />
        ))}
      </g>

      <g data-part="root" stroke="var(--bio-wood-deep)" strokeLinecap="round" fill="none">
        <path d="M244 292 C 240 312 222 324 200 340" strokeWidth={3.2} />
        <path d="M244 292 C 250 314 268 326 292 338" strokeWidth={3.2} />
        <path d="M244 294 C 246 312 242 330 246 346" strokeWidth={3.2} />
        <path d="M222 322 C 214 326 210 334 206 344" strokeWidth={2} />
        <path d="M266 322 C 274 324 282 330 284 344" strokeWidth={2} />
        {[
          [204, 337, -6, 5],
          [212, 331, -3, 7],
          [288, 336, 6, 5],
          [279, 330, 4, 7],
          [246, 340, -6, 3],
          [246, 340, 6, 3],
        ].map(([x, y, dx, dy], i) => (
          <line key={i} x1={x} y1={y} x2={x + dx} y2={y + dy} strokeWidth={1.1} />
        ))}
      </g>

      <g data-part="stem">
        <path d="M244 292 C 240 250 248 200 244 150 C 242 120 246 100 248 86" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={7} strokeLinecap="round" />
      </g>

      <g data-part="leaf">
        {/* right leaf (the big one) */}
        <path d="M246 170 C 270 110 360 74 452 86 C 430 150 350 196 246 170 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinejoin="round" />
        <path d="M246 170 Q 340 126 452 86" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
        {[0.3, 0.5, 0.7].map((t) => {
          const x = 246 + (452 - 246) * t;
          const y = 170 + (86 - 170) * t - 22 * Math.sin(Math.PI * t);
          return (
            <g key={t} stroke="var(--bio-leaf-deep)" strokeWidth={1.1} fill="none">
              <path d={`M ${x} ${y} q 10 -18 26 -24`} />
              <path d={`M ${x} ${y} q 14 10 30 12`} />
            </g>
          );
        })}
        {/* left leaf */}
        <path d="M244 212 C 216 172 150 160 92 178 C 120 222 190 236 244 212 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinejoin="round" />
        <path d="M244 212 Q 170 190 92 178" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
        {/* top leaves */}
        <path d="M248 88 C 236 70 222 64 206 66 C 214 82 230 92 248 88 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
        <path d="M248 88 C 258 66 274 58 290 60 C 284 78 268 90 248 88 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      </g>

      {/* magnifier: leaf cells with chloroplasts */}
      <g data-part="chloro">
        <line x1={130} y1={196} x2={118} y2={206} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 3" />
        <circle cx={96} cy={226} r={34} fill="var(--bio-cell)" stroke={OUT} strokeWidth={2} />
        <clipPath id="photo-plant-cells">
          <circle cx={96} cy={226} r={33} />
        </clipPath>
        <g clipPath="url(#photo-plant-cells)">
          {[
            [62, 196],
            [96, 196],
            [130, 196],
            [62, 226],
            [96, 226],
            [130, 226],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 16} y={y - 14 + (i % 3 === 1 ? 16 : 0)} width={32} height={28} rx={7} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={1.4} />
          ))}
          {[
            [86, 207],
            [104, 210],
            [94, 222],
            [72, 236],
            [116, 236],
            [80, 248],
            [110, 250],
            [100, 238],
            [62, 214],
            [128, 216],
          ].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={5} ry={3.2} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={0.9} transform={`rotate(${(i * 37) % 180} ${x} ${y})`} />
          ))}
        </g>
      </g>

      {/* magnifier: a stoma on the leaf's underside */}
      <g data-part="stoma">
        <line x1={384} y1={140} x2={410} y2={210} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 3" />
        <circle cx={420} cy={238} r={32} fill="var(--bio-leaf)" stroke={OUT} strokeWidth={2} opacity={0.98} />
        <path d="M420 218 C 404 222 400 254 420 258 C 412 248 412 228 420 218 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <path d="M420 218 C 436 222 440 254 420 258 C 428 248 428 228 420 218 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <ellipse cx={420} cy={238} rx={2.6} ry={13} fill="var(--bio-outline)" opacity={0.85} />
      </g>
    </Figure>
  );
}

/** The plant to explore in the lesson. */
export function PhotoPlantExplore() {
  return <PhotoPlant mode="explore" />;
}
