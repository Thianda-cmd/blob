"use client";

// The human digestive system as a friendly textbook schematic: head in profile (mouth, teeth,
// salivary glands), oesophagus, stomach, liver with gall bladder, pancreas, duodenum, the coiled
// small intestine framed by the large intestine, appendix, rectum and anus.
// Used as an explore widget, as task pictures (ask a part) and by the journey widget.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import type { ReactNode } from "react";

export const SYSTEM_W = 440;
export const SYSTEM_H = 580;

export type OrganId =
  | "mouth"
  | "teeth"
  | "saliva"
  | "oesophagus"
  | "stomach"
  | "liver"
  | "gallbladder"
  | "pancreas"
  | "small"
  | "large"
  | "appendix"
  | "rectum"
  | "anus"
  | "duodenum";

export const SYSTEM_PARTS: (FigurePart & { id: OrganId })[] = [
  { id: "mouth", label: tx("mouth (oral cavity)", "Mundhöhle"), at: [238, 106], tag: [402, 112], info: tx("Teeth cut and grind the food, the tongue mixes it with saliva.", "Zähne zerkleinern die Nahrung, die Zunge vermischt sie mit Speichel.") },
  { id: "teeth", label: tx("teeth", "Zähne"), at: [264, 99], tag: [402, 76], info: tx("Bite off, hold and grind the food.", "Beißen ab, halten fest und zermahlen die Nahrung.") },
  { id: "saliva", label: tx("salivary glands", "Speicheldrüsen"), at: [211, 100], tag: [38, 104], info: tx("Make about 1 to 1.5 litres of saliva a day: it makes the food slippery and starts starch digestion.", "Bilden täglich etwa 1 bis 1,5 Liter Speichel: Er macht die Nahrung gleitfähig und beginnt mit der Stärkeverdauung.") },
  { id: "oesophagus", label: tx("oesophagus (gullet)", "Speiseröhre"), at: [218, 190], tag: [38, 186], info: tx("A muscular tube, about 25 cm long. Waves of muscle push each bite down to the stomach.", "Ein Muskelschlauch, etwa 25 cm lang. Muskelwellen schieben jeden Bissen in den Magen.") },
  { id: "stomach", label: tx("stomach", "Magen"), at: [302, 284], tag: [402, 278], info: tx("Kneads the food into a pulp (chyme). Gastric juice with hydrochloric acid kills germs and starts protein digestion.", "Knetet die Nahrung zu einem Brei. Magensaft mit Salzsäure tötet Keime ab und beginnt die Eiweißverdauung.") },
  { id: "liver", label: tx("liver", "Leber"), at: [150, 272], tag: [38, 266], info: tx("The largest gland of the body. Makes bile and stores sugar as glycogen.", "Die größte Drüse des Körpers. Bildet die Galle und speichert Zucker als Glykogen.") },
  { id: "gallbladder", label: tx("gall bladder", "Gallenblase"), at: [183, 308], tag: [38, 314], info: tx("Stores and thickens bile and releases it into the small intestine.", "Speichert und dickt die Galle ein und gibt sie in den Dünndarm ab.") },
  { id: "pancreas", label: tx("pancreas", "Bauchspeicheldrüse"), at: [312, 351], tag: [402, 344], info: tx("Makes pancreatic juice with many digestive enzymes, and the hormones insulin and glucagon.", "Bildet den Bauchspeichel mit vielen Verdauungsenzymen und die Hormone Insulin und Glucagon.") },
  { id: "small", label: tx("small intestine", "Dünndarm"), at: [226, 450], tag: [38, 444], info: tx("3 to 5 m long. Here digestion is finished and the nutrients pass into the blood.", "3 bis 5 m lang. Hier wird die Verdauung beendet und die Nährstoffe gelangen ins Blut.") },
  { id: "large", label: tx("large intestine (colon)", "Dickdarm"), at: [320, 436], tag: [402, 430], info: tx("About 1.5 m long. Takes water and minerals back from the leftovers. Gut bacteria live here.", "Etwa 1,5 m lang. Entzieht den Resten Wasser und Mineralstoffe. Hier leben die Darmbakterien.") },
  { id: "appendix", label: tx("caecum with appendix", "Blinddarm mit Wurmfortsatz"), at: [153, 518], tag: [38, 522], info: tx("The start of the large intestine. The small appendix can become inflamed (appendicitis).", "Der Anfang des Dickdarms. Der kleine Wurmfortsatz kann sich entzünden (Blinddarmentzündung).") },
  { id: "rectum", label: tx("rectum", "Mastdarm"), at: [250, 528], tag: [402, 514], info: tx("Collects the faeces until you go to the toilet.", "Sammelt den Kot, bis du zur Toilette gehst.") },
  { id: "anus", label: tx("anus", "After"), at: [244, 557], tag: [402, 556], info: tx("A ring of muscle (sphincter) opens to let the faeces out.", "Ein Schließmuskel öffnet sich und lässt den Kot hinaus.") },
  { id: "duodenum", label: tx("duodenum", "Zwölffingerdarm"), at: [199, 360], tag: [38, 360], info: tx("The first part of the small intestine. Bile and pancreatic juice flow in here.", "Der erste Abschnitt des Dünndarms. Hier münden Galle und Bauchspeichel.") },
];

/** Every part except the duodenum (for beginners, where it is just "small intestine"). */
export const BASIC_PARTS: OrganId[] = SYSTEM_PARTS.map((p) => p.id).filter((id) => id !== "duodenum");

// ---------------------------------------------------------------------------
// Geometry (also used by the journey widget for the path of a bite)

const COLON: [number, number][] = [
  [146, 494],
  [148, 404],
  [160, 392],
  [222, 400],
  [300, 388],
  [316, 396],
  [320, 476],
  [308, 496],
  [272, 508],
  [254, 512],
];
const RECTUM: [number, number][] = [
  [254, 512],
  [248, 532],
  [244, 548],
];

const poly = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

/** Little cross lines along the colon: the pouches (haustra) seen from outside. */
function haustra(pts: [number, number][], every = 15, half = 9): string {
  let d = "";
  let carry = every / 2;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    let s = carry;
    while (s < len) {
      const cx = x0 + ux * s;
      const cy = y0 + uy * s;
      d += `M${(cx - uy * half).toFixed(1)} ${(cy + ux * half).toFixed(1)} L${(cx + uy * half).toFixed(1)} ${(cy - ux * half).toFixed(1)} `;
      s += every;
    }
    carry = s - len;
  }
  return d;
}
const HAUSTRA = haustra(COLON.slice(1, -1));

const SMALL =
  "M260 362 C262 380 266 396 266 414 Q246 410 226 414 T186 414 A9 9 0 0 0 186 432 Q206 436 226 432 T266 432 Q276 430 286 432 A9 9 0 0 1 286 450 " +
  "Q266 454 246 450 T206 450 Q196 448 186 450 A9 9 0 0 0 186 468 Q206 472 226 468 T266 468 Q276 466 286 468 A9 9 0 0 1 286 486 Q256 490 226 486 T190 486 C176 486 168 484 158 482";
const DUODENUM = "M236 326 C214 326 198 334 198 352 C198 372 216 380 236 376 C248 374 256 368 260 360";
const OESOPHAGUS = "M220 134 C220 180 214 218 232 244 C238 252 246 258 254 262";

/** Way points of a bite, station by station (mouth, oesophagus, stomach, small intestine, large intestine, out). */
export const BITE_PATH: [number, number][][] = [
  [[254, 104]],
  [
    [236, 104],
    [221, 114],
    [219, 150],
    [217, 190],
  ],
  [
    [218, 222],
    [232, 246],
    [256, 262],
    [292, 286],
  ],
  [
    [262, 320],
    [236, 326],
    [204, 338],
    [200, 362],
    [228, 377],
    [260, 362],
    [266, 414],
    [190, 414],
    [184, 432],
    [280, 432],
    [286, 450],
    [232, 450],
  ],
  [
    [190, 450],
    [184, 468],
    [280, 468],
    [286, 486],
    [190, 486],
    [158, 482],
    [148, 470],
    [148, 404],
    [160, 392],
    [222, 400],
    [300, 388],
    [316, 396],
    [320, 440],
  ],
  [
    [320, 476],
    [308, 496],
    [272, 508],
    [254, 512],
    [248, 532],
    [245, 550],
  ],
];

// ---------------------------------------------------------------------------

const OUT = "var(--bio-outline)";

/** The drawing itself (all `data-part` groups), for use inside a <Figure>. */
export function DigestiveOrgans({ extra }: { extra?: ReactNode }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* body */}
      <path
        d="M192 150 C160 140 148 64 196 26 C236 0 270 26 268 52 L272 66 L286 82 L272 88 C275 94 273 98 269 101 L271 106 C273 120 266 132 250 134 C236 136 232 142 232 156 L234 172 C290 176 330 182 340 212 L346 300 C351 380 346 460 332 540 L332 572 L108 572 L108 540 C94 460 89 380 94 300 L100 212 C110 182 150 176 194 172 Z"
        fill="color-mix(in oklab, var(--bio-flesh) 38%, var(--raised))"
        stroke={OUT}
        strokeOpacity={0.45}
        strokeWidth={1.6}
      />
      {/* ear and eye */}
      <path d="M204 68 C192 68 190 92 202 96" fill="none" stroke={OUT} strokeOpacity={0.4} strokeWidth={1.4} />
      <path d="M252 58 Q258 54 263 58" fill="none" stroke={OUT} strokeOpacity={0.55} strokeWidth={1.6} />
      {/* diaphragm */}
      <path d="M100 248 C150 222 290 222 344 248" fill="none" stroke="var(--ink-3)" strokeOpacity={0.55} strokeWidth={1.3} strokeDasharray="4 4" />

      {/* pancreas (behind the stomach) */}
      <g data-part="pancreas">
        <path
          d="M208 348 C208 338 222 336 234 344 C262 352 302 350 328 340 C336 337 338 347 330 353 C302 365 264 367 236 365 C228 372 208 368 208 348 Z"
          fill="var(--bio-nerve)"
          stroke={OUT}
          strokeWidth={1.4}
        />
        {[
          [220, 352],
          [248, 357],
          [272, 358],
          [296, 355],
          [318, 348],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r={2.6} fill="var(--bio-nerve-deep)" opacity={0.45} />
        ))}
      </g>

      {/* stomach */}
      <g data-part="stomach">
        <path
          d="M254 262 C246 248 268 228 296 230 C324 232 336 262 330 292 C324 326 296 346 264 342 C252 340 242 336 236 333 L234 318 C246 318 262 316 270 304 C278 292 274 274 254 262 Z"
          fill="var(--bio-petal)"
          stroke={OUT}
          strokeWidth={1.6}
        />
        <path d="M286 248 C306 262 312 292 300 320 M300 242 C320 262 322 296 312 322 M276 262 C290 278 290 300 280 322" fill="none" stroke="var(--bio-petal-deep)" strokeOpacity={0.55} strokeWidth={1.3} />
        <ellipse cx={236} cy={325.5} rx={3} ry={7.5} fill="var(--bio-petal-deep)" opacity={0.7} />
      </g>

      {/* liver */}
      <g data-part="liver">
        <path
          d="M112 252 C140 236 210 232 246 240 C258 243 258 256 248 262 C222 280 170 306 130 312 C112 314 104 296 112 252 Z"
          fill="color-mix(in oklab, var(--bio-blood) 45%, var(--bio-wood))"
          stroke={OUT}
          strokeWidth={1.6}
        />
        <path d="M200 238 C204 258 202 276 194 292" fill="none" stroke={OUT} strokeOpacity={0.35} strokeWidth={1.3} />
      </g>

      {/* gall bladder and bile duct */}
      <g data-part="gallbladder">
        <path d="M184 292 C194 304 204 322 205 346" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.2} />
        <path d="M175 288 C168 302 172 317 182 317 C193 317 197 302 190 288 Z" fill="var(--bio-leaf)" stroke={OUT} strokeWidth={1.4} />
      </g>

      {/* small intestine: first the coil, then the duodenum */}
      <g data-part="small">
        <path d={SMALL} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={12} />
        <path d={SMALL} fill="none" stroke="var(--bio-flesh)" strokeWidth={8.6} />
      </g>
      <g data-part="duodenum">
        <path d={DUODENUM} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={12} />
        <path d={DUODENUM} fill="none" stroke="color-mix(in oklab, var(--bio-flesh) 82%, var(--bio-sun))" strokeWidth={8.6} />
      </g>

      {/* large intestine */}
      <g data-part="appendix">
        <path d="M144 500 C139 515 148 527 160 525" fill="none" stroke="var(--bio-mito-deep)" strokeWidth={6.5} />
        <path d="M144 500 C139 515 148 527 160 525" fill="none" stroke="var(--bio-mito)" strokeWidth={3.6} />
        <circle cx={146} cy={494} r={13} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
      </g>
      <g data-part="large">
        <path d={poly(COLON)} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={22} />
        <path d={poly(COLON)} fill="none" stroke="var(--bio-mito)" strokeWidth={18.6} />
        <path d={HAUSTRA} fill="none" stroke="var(--bio-mito-deep)" strokeOpacity={0.6} strokeWidth={1.2} />
      </g>
      <g data-part="rectum">
        <path d={poly(RECTUM)} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={17} />
        <path d={poly(RECTUM)} fill="none" stroke="color-mix(in oklab, var(--bio-mito) 78%, var(--bio-mito-deep))" strokeWidth={13.6} />
      </g>
      <g data-part="anus">
        <ellipse cx={244} cy={556} rx={9} ry={4.5} fill="var(--bio-flesh-deep)" stroke={OUT} strokeWidth={1.3} />
      </g>

      {/* oesophagus on top, so its way into the stomach stays visible */}
      <g data-part="oesophagus">
        <path d={OESOPHAGUS} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={11} />
        <path d={OESOPHAGUS} fill="none" stroke="var(--bio-flesh)" strokeWidth={7.6} />
      </g>

      {/* head: oral cavity with tongue and teeth, salivary glands */}
      <g data-part="mouth">
        <path
          d="M268 101 C252 95 234 95 224 102 C216 109 214 122 215 136 L225 136 C225 126 228 119 236 117 C248 115 260 112 270 106 Z"
          fill="color-mix(in oklab, var(--bio-petal-deep) 35%, var(--bio-flesh))"
          stroke={OUT}
          strokeWidth={1.3}
        />
        <path d="M263 107 C253 100 237 100 229 108 C226 114 230 119 238 118 C248 117 258 113 263 107 Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1} />
      </g>
      <g data-part="teeth" fill="var(--bio-bone)" stroke={OUT} strokeWidth={0.9}>
        <rect x={261} y={97.5} width={6} height={5} rx={1.2} />
        <rect x={254.5} y={97} width={6} height={5} rx={1.2} />
        <rect x={262} y={106} width={5.5} height={5} rx={1.2} />
        <rect x={255.5} y={107} width={6} height={5} rx={1.2} />
      </g>
      <g data-part="saliva">
        <path d="M218 101 C228 102 238 103 246 104" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} strokeOpacity={0.7} />
        <ellipse cx={211} cy={100} rx={8} ry={12} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} />
        <ellipse cx={240} cy={127} rx={9} ry={5.5} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} />
      </g>
      {extra}
    </g>
  );
}

export function DigestionSystem({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure
      title={tx("The human digestive system", "Die Verdauungsorgane des Menschen")}
      width={SYSTEM_W}
      height={SYSTEM_H}
      parts={SYSTEM_PARTS}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <DigestiveOrgans />
    </Figure>
  );
}

/** Lesson widget: tap the organs (beginners: without the duodenum). */
export function DigestionSystemExplore() {
  return <DigestionSystem mode="explore" show={BASIC_PARTS} />;
}
