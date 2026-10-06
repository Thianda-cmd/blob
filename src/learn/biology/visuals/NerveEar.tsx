"use client";

// The human ear in section for the "nervous-system" topic (level 1): outer ear (pinna, ear
// canal), eardrum, middle ear with the three ossicles and the Eustachian tube, inner ear with
// the cochlea and the semicircular canals, and the auditory nerve.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { pathOf, r1, type Pt } from "./NerveKit";
import { cos, sin } from "@/lib/stableMath";

const W = 540;
const H = 300;

const PINNA = "M98 62 C62 36 22 58 24 108 C26 150 46 170 52 196 C58 226 72 254 98 250 C114 248 118 234 112 220 C106 206 94 202 94 186 L100 168 L100 132 C108 116 120 94 114 78 C110 68 106 66 98 62 Z";
const CANAL = "M100 132 C140 126 190 122 230 122 L230 160 C190 162 140 168 100 168 Z";
const MIDDLE = "M238 108 C262 96 302 98 314 114 L314 196 C302 208 262 210 238 198 Z";
const TUBE = "M268 200 C278 232 298 262 318 300 L342 300 C320 258 302 228 296 202 Z";
const NERVE = "M368 164 C420 156 470 152 540 146 L540 170 C470 174 420 180 368 186 Z";

/** An Archimedean spiral for the cochlea (rounded, so server and browser draw the same). */
function spiral(cx: number, cy: number, r0: number, turns: number): Pt[] {
  const pts: Pt[] = [];
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * 2 * Math.PI;
    const r = r0 * (1 - (0.82 * i) / n);
    pts.push([r1(cx + r * cos(a)), r1(cy + r * sin(a))]);
  }
  return pts;
}
const COCHLEA = pathOf(spiral(350, 180, 30, 2.5));

const PARTS: FigurePart[] = [
  { id: "pinna", label: tx("outer ear (pinna)", "Ohrmuschel"), at: [44, 150], info: tx("Catches the sound like a funnel.", "Fängt den Schall auf wie ein Trichter.") },
  { id: "canal", label: tx("ear canal", "Gehörgang"), at: [168, 144], info: tx("Leads the sound to the eardrum.", "Leitet den Schall zum Trommelfell.") },
  { id: "eardrum", label: tx("eardrum", "Trommelfell"), at: [235, 150], tag: [214, 232], info: tx("A thin skin that is made to vibrate by the sound.", "Eine dünne Haut, die vom Schall in Schwingung versetzt wird.") },
  { id: "ossicles", label: tx("ossicles (hammer, anvil, stirrup)", "Gehörknöchelchen (Hammer, Amboss, Steigbügel)"), at: [270, 116], tag: [250, 22], info: tx("Three tiny bones in the middle ear. They pass the vibrations on to the inner ear and make them stronger.", "Drei winzige Knochen im Mittelohr. Sie übertragen die Schwingungen verstärkt auf das Innenohr.") },
  { id: "canals", label: tx("semicircular canals (balance)", "Bogengänge (Gleichgewichtsorgan)"), at: [344, 70], tag: [390, 20], info: tx("Part of the organ of balance: they register turning movements of the head.", "Teil des Gleichgewichtsorgans: Sie melden Drehbewegungen des Kopfes.") },
  { id: "cochlea", label: tx("cochlea", "Schnecke"), at: [350, 180], info: tx("The coiled tube in the inner ear. It contains the sensory cells for hearing.", "Der aufgewundene Gang im Innenohr. Er enthält die Hörsinneszellen.") },
  { id: "nerve", label: tx("auditory nerve", "Hörnerv"), at: [470, 162], info: tx("Carries the signals from the cochlea to the brain.", "Leitet die Erregungen von der Schnecke zum Gehirn.") },
  { id: "tube", label: tx("Eustachian tube", "Ohrtrompete"), at: [306, 262], tag: [384, 262], info: tx("Connects the middle ear with the throat and evens out the air pressure.", "Verbindet das Mittelohr mit dem Rachen und gleicht den Luftdruck aus.") },
];

export const EAR_PARTS = PARTS;

export function NerveEar({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const parts = show ? PARTS.filter((p) => show.includes(p.id)) : PARTS;
  return (
    <Figure title={tx("The ear in section", "Das Ohr im Schnitt")} width={W} height={H} parts={parts} mode={mode} ask={ask} highlight={highlight} legend={legend}>
      {/* temporal bone */}
      <path d="M204 58 Q204 38 226 38 L540 38 L540 282 L226 282 Q204 282 204 262 Z" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.2} opacity={0.75} />
      <g data-part="tube">
        <path d={TUBE} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={1.4} />
      </g>
      <path d={MIDDLE} fill="var(--bio-vacuole)" stroke="var(--bio-outline)" strokeWidth={1.4} />
      <g data-part="nerve">
        <path d={NERVE} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.6} strokeLinejoin="round" />
        {[160, 168, 176].map((y) => (
          <path key={y} d={`M380 ${y} C430 ${y - 6} 480 ${y - 10} 540 ${y - 14}`} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1} opacity={0.6} />
        ))}
      </g>
      <g data-part="pinna">
        <path d={PINNA} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
        <path d="M90 82 C62 68 42 90 46 120 C50 146 66 160 70 182" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={2} strokeLinecap="round" />
        <path d="M80 104 C66 104 62 124 72 136" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.6} strokeLinecap="round" />
      </g>
      <g data-part="canal">
        <path d={CANAL} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <g data-part="eardrum">
        <path d="M230 116 Q242 141 232 166" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={4.5} strokeLinecap="round" />
      </g>
      <g data-part="ossicles" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.3} strokeLinejoin="round">
        <path d="M236 144 L250 120 C252 108 264 104 268 113 C270 120 262 126 255 124 L240 146 Z" />
        <path d="M262 108 C270 102 282 104 286 112 L292 134 C290 139 285 139 283 134 L277 120 C270 124 262 120 262 108 Z" />
        <path d="M288 134 L312 138 L312 158 L288 144 Z" />
      </g>
      <g data-part="canals" fill="none" strokeLinecap="round">
        {[
          "M318 128 C306 98 318 58 344 58 C370 58 378 94 360 120",
          "M330 126 C340 96 372 88 386 100 C400 114 384 134 362 132",
          "M322 132 C300 120 296 92 312 84",
        ].map((d) => (
          <g key={d}>
            <path d={d} stroke="var(--bio-outline)" strokeWidth={10} />
            <path d={d} stroke="var(--bio-water)" strokeWidth={7} />
          </g>
        ))}
      </g>
      <g data-part="cochlea" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M314 148 C322 150 330 156 336 164" stroke="var(--bio-outline)" strokeWidth={13} />
        <path d={COCHLEA} stroke="var(--bio-outline)" strokeWidth={12} />
        <path d="M314 148 C322 150 330 156 336 164" stroke="var(--bio-water)" strokeWidth={9.5} />
        <path d={COCHLEA} stroke="var(--bio-water)" strokeWidth={9} />
      </g>
    </Figure>
  );
}
