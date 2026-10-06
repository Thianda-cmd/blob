"use client";

// Cross-section of a foliage leaf (Blattquerschnitt), as in a German Klasse 7–9 textbook:
// cuticle, upper epidermis, palisade, spongy tissue with air spaces, a leaf vein (xylem on
// top, phloem below), lower epidermis with a stoma (two guard cells, substomatal cavity).
// Reusable: <PlantLeafSection mode="explore" />, or with gas arrows for photosynthesis:
// <PlantLeafSection mode="plain" flows={["co2", "o2"]} sun />.

import { motion, useReducedMotion } from "motion/react";
import { Droplets, Wind } from "lucide-react";
import { useId, useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { PlantChip } from "./PlantUi";
import { cos, sin } from "@/lib/stableMath";

export const LEAF_SECTION_PARTS: FigurePart[] = [
  {
    id: "cuticle",
    label: tx("cuticle", "Cuticula"),
    at: [470, 33],
    tag: [530, 20],
    info: tx("A layer of wax. It keeps the leaf from drying out and keeps germs out.", "Eine Wachsschicht. Sie schützt das Blatt vor Wasserverlust (Verdunstung) und vor Krankheitserregern."),
  },
  {
    id: "upper",
    label: tx("upper epidermis", "obere Epidermis"),
    at: [478, 48],
    tag: [530, 50],
    info: tx("One layer of tightly joined cells without chloroplasts: transparent, so light gets through.", "Eine Schicht lückenlos verbundener Zellen ohne Chloroplasten: durchsichtig, damit Licht hindurchkommt."),
  },
  {
    id: "palisade",
    label: tx("palisade tissue", "Palisadengewebe"),
    at: [478, 104],
    tag: [530, 104],
    info: tx("Long, tightly packed cells full of chloroplasts: most of the photosynthesis happens here.", "Lang gestreckte, dicht gepackte Zellen voller Chloroplasten: Hier findet die meiste Fotosynthese statt."),
  },
  {
    id: "spongy",
    label: tx("spongy tissue", "Schwammgewebe"),
    at: [474, 168],
    tag: [530, 162],
    info: tx("Loosely packed, irregular cells with fewer chloroplasts and large air spaces between them.", "Locker liegende, unregelmäßige Zellen mit weniger Chloroplasten und großen Hohlräumen dazwischen."),
  },
  {
    id: "air",
    label: tx("air space", "Interzellulare (Zellzwischenraum)"),
    at: [272, 207],
    tag: [530, 206],
    info: tx("Air-filled spaces between the cells: carbon dioxide, oxygen and water vapour spread out here.", "Luftgefüllte Räume zwischen den Zellen: Hier verteilen sich Kohlenstoffdioxid, Sauerstoff und Wasserdampf."),
  },
  {
    id: "cavity",
    label: tx("substomatal cavity", "Atemhöhle"),
    at: [412, 236],
    tag: [530, 236],
    info: tx("A large air space right above the stoma. Gases enter and leave the leaf here.", "Ein großer Luftraum direkt über der Spaltöffnung. Hier strömen Gase in das Blatt hinein und heraus."),
  },
  {
    id: "lower",
    label: tx("lower epidermis", "untere Epidermis"),
    at: [478, 259],
    tag: [530, 266],
    info: tx("The closing layer on the underside. Most stomata sit here, in the shade.", "Das Abschlussgewebe der Blattunterseite. Hier liegen die meisten Spaltöffnungen, geschützt im Schatten."),
  },
  {
    id: "guard",
    label: tx("guard cell", "Schließzelle"),
    at: [401, 259],
    tag: [372, 306],
    info: tx("Two bean-shaped cells with chloroplasts. They open and close the pore between them.", "Zwei bohnenförmige Zellen mit Chloroplasten. Sie öffnen und schließen den Spalt zwischen sich."),
  },
  {
    id: "stoma",
    label: tx("stoma (pore)", "Spaltöffnung"),
    at: [410, 264],
    tag: [448, 306],
    info: tx("Carbon dioxide comes in through the pore; oxygen and water vapour go out.", "Durch den Spalt strömt Kohlenstoffdioxid hinein, Sauerstoff und Wasserdampf strömen hinaus."),
  },
  {
    id: "xylem",
    label: tx("xylem", "Xylem (Holzteil)"),
    at: [164, 171],
    tag: [30, 150],
    info: tx("The upper part of the vein: brings water and minerals into the leaf.", "Der obere Teil der Blattader: bringt Wasser und Mineralstoffe ins Blatt."),
  },
  {
    id: "phloem",
    label: tx("phloem", "Phloem (Siebteil)"),
    at: [165, 203],
    tag: [30, 196],
    info: tx("The lower part of the vein: carries sugar solution out of the leaf.", "Der untere Teil der Blattader: transportiert Zuckerlösung aus dem Blatt ab."),
  },
  {
    id: "bundle",
    label: tx("vascular bundle (vein)", "Leitbündel (Blattader)"),
    at: [125, 200],
    tag: [30, 240],
    info: tx("A leaf vein: xylem on top, phloem below, wrapped in a sheath of cells.", "Eine Blattader: oben Xylem, unten Phloem, umhüllt von einer Scheide aus Zellen."),
  },
  {
    id: "chloroplast",
    label: tx("chloroplast", "Chloroplast"),
    at: [271, 90],
    tag: [271, 6],
    info: tx("Contains the green pigment chlorophyll: photosynthesis takes place here.", "Enthält den grünen Farbstoff Chlorophyll: Hier läuft die Fotosynthese ab."),
  },
];

const X0 = 60;
const X1 = 500;
const CELL = "var(--bio-cell)";
const WALL = "var(--bio-wall-deep)";
const CHLORO = "var(--bio-chloro)";
const CHLORO_D = "var(--bio-leaf-deep)";

const BUNDLE = { x: 164, y: 190, rx: 40, ry: 35 };
const CAVITY = { x: 410, y: 232, rx: 30, ry: 20 };

/** Upper/lower epidermis: a row of flat cells of slightly different widths. */
function epidermisCells(y: number, h: number, skip?: [number, number]) {
  const widths = [34, 40, 30, 38, 36, 42, 32, 37, 41, 33, 39, 35];
  const out: { x: number; w: number }[] = [];
  let x = X0 - 14;
  let i = 0;
  while (x < X1) {
    const w = widths[i % widths.length];
    if (!skip || x + w <= skip[0] || x >= skip[1]) out.push({ x, w });
    else if (x < skip[0]) out.push({ x, w: skip[0] - x });
    else if (x + w > skip[1]) out.push({ x: skip[1], w: x + w - skip[1] });
    x += w;
    i++;
  }
  return out.map((c) => ({ ...c, y, h }));
}

const PALISADE = Array.from({ length: 20 }, (_, i) => ({ x: X0 - 8 + i * 23, w: 20, nucleus: 74 + ((i * 37) % 54) }));

/** Spongy cells: rounded, loosely packed, leaving air spaces; none inside the vein or the cavity. */
const SPONGY = (() => {
  const rows = [
    { y: 166, x0: 60 },
    { y: 197, x0: 82 },
    { y: 227, x0: 62 },
  ];
  const out: { x: number; y: number; rx: number; ry: number; a: number }[] = [];
  rows.forEach((r, ri) => {
    for (let k = 0; k < 12; k++) {
      const x = r.x0 + k * 42 + (((k * 7 + ri * 3) % 5) - 2) * 2;
      const y = r.y + (((k * 3 + ri) % 3) - 1) * 2.5;
      const rx = 19.5 + ((k + ri) % 3) * 1.5;
      const ry = 12.5 + ((k * 2 + ri) % 3) * 1.1;
      const a = (((k * 5 + ri * 2) % 7) - 3) * 6;
      const inB = ((x - BUNDLE.x) / (BUNDLE.rx + 16)) ** 2 + ((y - BUNDLE.y) / (BUNDLE.ry + 10)) ** 2 < 1;
      const inC = ((x - CAVITY.x) / (CAVITY.rx + 10)) ** 2 + ((y - CAVITY.y) / (CAVITY.ry + 8)) ** 2 < 1;
      if (!inB && !inC && x < X1 + 16) out.push({ x, y, rx, ry, a });
    }
  });
  return out;
})();

/** A few cells of the bundle sheath around the vein. */
const SHEATH = Array.from({ length: 14 }, (_, i) => {
  const t = (i / 14) * Math.PI * 2;
  return { x: BUNDLE.x + cos(t) * BUNDLE.rx, y: BUNDLE.y + sin(t) * BUNDLE.ry };
});

const at = (dx: number, dy: number, r: number): [number, number, number] => [BUNDLE.x + dx, BUNDLE.y + dy, r];
const XYLEM: [number, number, number][] = [at(-15, -14, 7), at(0, -19, 8.5), at(15, -13, 6.5), at(-7, -1, 5), at(8, -1, 5.5), at(-24, -2, 4), at(23, -1, 4)];
const PHLOEM: [number, number, number][] = [at(-17, 12, 3.8), at(-8, 16, 3.2), at(1, 12, 4), at(10, 17, 3.2), at(18, 12, 3.6), at(-12, 22, 2.8), at(4, 23, 3)];

function Arrow({ d, color, head, reduce, delay = 0 }: { d: string; color: string; head: string; reduce: boolean | null; delay?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeDasharray="7 6"
      markerEnd={`url(#${head})`}
      initial={false}
      animate={reduce ? undefined : { strokeDashoffset: [26, 0] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "linear", delay }}
    />
  );
}

export type LeafFlow = "co2" | "o2" | "h2o";

/** The drawing without the Figure frame (for widgets that want to combine it). */
export function PlantLeafSectionBody({ uid, flows = [], sun = false }: { uid: string; flows?: LeafFlow[]; sun?: boolean }) {
  const reduce = useReducedMotion();
  const clip = `lsc-${uid}`;
  const upper = epidermisCells(36, 25);
  const lower = epidermisCells(248, 20, [393, 427]);
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={X0} y={0} width={X1 - X0} height={330} />
        </clipPath>
        {[
          ["aw", "var(--bio-water-deep)"],
          ["ak", "var(--ink-2)"],
          ["ao", "var(--bio-leaf-deep)"],
        ].map(([id, c]) => (
          <marker key={id} id={`${id}-${uid}`} viewBox="0 0 10 10" refX={5} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill={c} />
          </marker>
        ))}
      </defs>

      {sun && (
        <g stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" fill="none">
          {[120, 220, 320, 420].map((x) => (
            <path key={x} d={`M${x - 16} 0 L${x} 22 M${x - 3} 18 L${x} 22 L${x - 6} 21`} />
          ))}
        </g>
      )}

      <g clipPath={`url(#${clip})`}>
        {/* cut faces of the slice */}
        <rect x={X0} y={30} width={X1 - X0} height={244} fill="var(--bio-leaf)" opacity={0.12} />

        <g data-part="cuticle">
          <rect x={X0} y={29} width={X1 - X0} height={7} rx={2} fill="var(--bio-membrane)" opacity={0.75} />
          <rect x={X0} y={268} width={X1 - X0} height={4.5} rx={2} fill="var(--bio-membrane)" opacity={0.75} />
        </g>

        <g data-part="upper">
          {upper.map((c, i) => (
            <rect key={i} x={c.x + 0.8} y={c.y} width={c.w - 1.6} height={c.h} rx={5} fill={CELL} stroke={WALL} strokeWidth={1.5} />
          ))}
        </g>

        <g data-part="palisade">
          {PALISADE.map((c, i) => (
            <g key={i}>
              <rect x={c.x} y={63} width={c.w} height={82} rx={9} fill={CELL} stroke={WALL} strokeWidth={1.5} />
              {i % 2 === 0 && <circle cx={c.x + 10} cy={c.nucleus} r={3.4} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={0.9} />}
            </g>
          ))}
        </g>
        <g data-part="chloroplast">
          {PALISADE.map((c, i) =>
            [0, 1, 2, 3, 4, 5].flatMap((k) => [
              <ellipse key={`${i}l${k}`} cx={c.x + 4.6} cy={72 + k * 12.5} rx={2.5} ry={4.3} fill={CHLORO} stroke={CHLORO_D} strokeWidth={0.6} />,
              <ellipse key={`${i}r${k}`} cx={c.x + c.w - 4.6} cy={78 + k * 12.5} rx={2.5} ry={4.3} fill={CHLORO} stroke={CHLORO_D} strokeWidth={0.6} />,
            ]),
          )}
        </g>

        <g data-part="air">
          <rect x={X0} y={146} width={X1 - X0} height={102} fill="var(--bio-vacuole)" opacity={0.45} />
        </g>
        <g data-part="spongy">
          {SPONGY.map((c, i) => (
            <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a})`}>
              <ellipse rx={c.rx} ry={c.ry} fill={CELL} stroke={WALL} strokeWidth={1.5} />
              {[0.6, 2.3, 3.9].map((t, k) => (
                <ellipse key={k} cx={cos(t + i) * c.rx * 0.62} cy={sin(t + i) * c.ry * 0.55} rx={3.2} ry={2.2} fill={CHLORO} stroke={CHLORO_D} strokeWidth={0.6} />
              ))}
            </g>
          ))}
        </g>
        <g data-part="cavity">
          <ellipse cx={CAVITY.x} cy={CAVITY.y + 2} rx={CAVITY.rx - 4} ry={CAVITY.ry - 6} fill="var(--bio-vacuole)" opacity={0.35} />
        </g>

        {/* the leaf vein */}
        <g data-part="bundle">
          {SHEATH.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={9} fill={CELL} stroke={WALL} strokeWidth={1.4} />
          ))}
        </g>
        <g data-part="xylem">
          <path d={`M${BUNDLE.x - 32} ${BUNDLE.y + 5} A32 28 0 0 1 ${BUNDLE.x + 32} ${BUNDLE.y + 5} Z`} fill="var(--bio-wood)" opacity={0.28} />
          {XYLEM.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={2.2} />
          ))}
        </g>
        <g data-part="phloem">
          <path d={`M${BUNDLE.x - 32} ${BUNDLE.y + 6} A32 26 0 0 0 ${BUNDLE.x + 32} ${BUNDLE.y + 6} Z`} fill="var(--bio-mito)" opacity={0.45} />
          {PHLOEM.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1} />
          ))}
        </g>

        <g data-part="lower">
          {lower.map((c, i) => (
            <rect key={i} x={c.x + 0.8} y={c.y} width={c.w - 1.6} height={c.h} rx={5} fill={CELL} stroke={WALL} strokeWidth={1.5} />
          ))}
        </g>
      </g>

      {/* the stoma: two guard cells with thick walls towards the pore */}
      <g data-part="guard">
        {[-1, 1].map((s) => (
          <g key={s}>
            <path
              d={`M${410 + s * 4} 250 C${410 + s * 18} 247 ${410 + s * 20} 268 ${410 + s * 5} 269 C${410 + s * 2.5} 263 ${410 + s * 2.5} 256 ${410 + s * 4} 250 Z`}
              fill={CELL}
              stroke={WALL}
              strokeWidth={1.5}
            />
            <path d={`M${410 + s * 4} 251 C${410 + s * 2.5} 256 ${410 + s * 2.5} 263 ${410 + s * 5} 268`} fill="none" stroke={WALL} strokeWidth={3.4} strokeLinecap="round" />
            <ellipse cx={410 + s * 12} cy={255} rx={2.4} ry={1.8} fill={CHLORO} stroke={CHLORO_D} strokeWidth={0.6} />
            <ellipse cx={410 + s * 13} cy={262} rx={2.4} ry={1.8} fill={CHLORO} stroke={CHLORO_D} strokeWidth={0.6} />
          </g>
        ))}
      </g>
      <g data-part="stoma">
        <path d="M407 249 C405.5 256 405.5 263 407 270 L413 270 C414.5 263 414.5 256 413 249 Z" fill="var(--bio-outline)" opacity={0.12} />
      </g>

      {/* slice edges */}
      <path d={`M${X0} 29 L${X0} 272 M${X1} 29 L${X1} 272`} stroke="var(--bio-leaf-deep)" strokeWidth={1.2} opacity={0.5} />

      {flows.includes("co2") && (
        <g>
          <Arrow d="M462 322 Q418 304 413 276 L412 246 Q410 206 372 166" color="var(--ink-2)" head={`ak-${uid}`} reduce={reduce} />
          <text x={466} y={318} fontSize={13} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            CO₂
          </text>
        </g>
      )}
      {flows.includes("o2") && (
        <g>
          <Arrow d="M326 160 Q384 198 405 240 L406 274 Q398 302 360 320" color="var(--bio-leaf-deep)" head={`ao-${uid}`} reduce={reduce} delay={0.3} />
          <text x={326} y={324} fontSize={13} fontWeight={700} fill="var(--bio-leaf-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            O₂
          </text>
        </g>
      )}
      {flows.includes("h2o") && (
        <g>
          <Arrow d="M180 168 Q250 150 290 196 Q350 244 404 254 Q410 290 412 326" color="var(--bio-water-deep)" head={`aw-${uid}`} reduce={reduce} delay={0.6} />
          <text x={418} y={330} fontSize={13} fontWeight={700} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            H₂O
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * The leaf cross-section with numbered parts. `flows` adds animated arrows for gas exchange
 * (CO₂ in, O₂ out) and the way of the water (from the xylem out through the stoma).
 */
export function PlantLeafSection({
  mode = "names",
  show,
  ask,
  highlight,
  legend,
  flows,
  sun,
}: DrawingProps & { flows?: LeafFlow[]; sun?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <Figure title={tx("Cross-section of a leaf", "Querschnitt durch ein Laubblatt")} width={560} height={336} parts={LEAF_SECTION_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <PlantLeafSectionBody uid={uid} flows={flows} sun={sun} />
    </Figure>
  );
}

/** The leaf section to explore, with switches for the gas exchange and the way of the water. */
export function PlantLeafExplorer() {
  const t = useText();
  const [gas, setGas] = useState(false);
  const [water, setWater] = useState(false);
  const flows: LeafFlow[] = [...(gas ? (["co2", "o2"] as const) : []), ...(water ? (["h2o"] as const) : [])];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <PlantChip on={gas} onClick={() => setGas(!gas)} icon={<Wind className="size-4" />}>
          {t(tx("Gas exchange", "Gasaustausch"))}
        </PlantChip>
        <PlantChip on={water} onClick={() => setWater(!water)} icon={<Droplets className="size-4" />}>
          {t(tx("Way of the water", "Weg des Wassers"))}
        </PlantChip>
      </div>
      <PlantLeafSection mode="explore" flows={flows} />
    </div>
  );
}
