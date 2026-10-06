"use client";

// A flowering plant from root tip to flower (Bau der Blütenpflanze): flower, bud, foliage
// leaves on the shoot axis, taproot with lateral roots, and a magnifier on the root hairs.

import { useId } from "react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const PLANT_PARTS: FigurePart[] = [
  {
    id: "flower",
    label: tx("flower", "Blüte"),
    at: [238, 60],
    tag: [300, 34],
    info: tx("For reproduction: after pollination, fruits with seeds develop from it.", "Dient der Fortpflanzung: Nach der Bestäubung entstehen aus ihr Früchte mit Samen."),
  },
  {
    id: "bud",
    label: tx("bud", "Knospe"),
    at: [200, 86],
    tag: [150, 62],
    info: tx("A new flower or a new shoot develops in here.", "Hier entwickelt sich eine neue Blüte oder ein neuer Trieb."),
  },
  {
    id: "leaf",
    label: tx("foliage leaf", "Laubblatt"),
    at: [318, 174],
    tag: [372, 150],
    info: tx("Makes sugar from water and carbon dioxide using light (photosynthesis). Oxygen is released.", "Stellt mit Licht aus Wasser und Kohlenstoffdioxid Traubenzucker her (Fotosynthese). Dabei entsteht Sauerstoff."),
  },
  {
    id: "stem",
    label: tx("shoot axis (stem)", "Sprossachse (Stängel)"),
    at: [240, 236],
    tag: [292, 228],
    info: tx("Carries leaves and flowers towards the light and transports water upwards and sugar to all parts.", "Trägt Blätter und Blüten zum Licht und leitet Wasser nach oben und Zucker in alle Teile."),
  },
  {
    id: "taproot",
    label: tx("main root (taproot)", "Hauptwurzel"),
    at: [241, 352],
    tag: [216, 404],
    info: tx("Anchors the plant firmly and deep in the ground.", "Verankert die Pflanze fest und tief im Boden."),
  },
  {
    id: "lateral",
    label: tx("lateral root", "Seitenwurzel"),
    at: [172, 300],
    tag: [120, 286],
    info: tx("Branches out in the soil, holds the plant and reaches more water.", "Verzweigt sich im Boden, hält die Pflanze fest und erreicht mehr Wasser."),
  },
  {
    id: "hairs",
    label: tx("root hairs", "Wurzelhaare"),
    at: [398, 312],
    tag: [452, 268],
    info: tx("Tiny outgrowths of the outer root cells. Their huge surface takes up water and minerals.", "Winzige Ausstülpungen der äußeren Wurzelzellen. Mit ihrer riesigen Oberfläche nehmen sie Wasser und Mineralstoffe auf."),
  },
];

const LEAF = "var(--bio-leaf)";
const LEAF_D = "var(--bio-leaf-deep)";
const ROOT = "var(--bio-bone)";
const ROOT_D = "var(--bio-wood-deep)";

/** A leaf with stalk, midrib and side veins, starting at (0,0) and pointing along +x. */
export function PlantLeafShape({ x, y, angle, len, width, veins = true }: { x: number; y: number; angle: number; len: number; width: number; veins?: boolean }) {
  const p = len * 0.2;
  const b = len - p;
  const blade = `M${p} 0 C${p + b * 0.18} ${-width} ${p + b * 0.72} ${-width * 0.92} ${len} 0 C${p + b * 0.72} ${width * 0.92} ${p + b * 0.18} ${width} ${p} 0 Z`;
  const sides = [0.18, 0.36, 0.54, 0.72];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0 L${p + 2} 0`} stroke={LEAF_D} strokeWidth={3.2} strokeLinecap="round" />
      <path d={blade} fill={LEAF} stroke={LEAF_D} strokeWidth={1.8} strokeLinejoin="round" />
      {veins && (
        <g stroke={LEAF_D} strokeWidth={1} strokeLinecap="round" fill="none" opacity={0.75}>
          <path d={`M${p} 0 L${len - 4} 0`} />
          {sides.map((f) => {
            const sx = p + b * f;
            const ex = p + b * (f + 0.17);
            const w = width * 0.62 * Math.sin(Math.PI * Math.min(0.95, f + 0.17));
            return <path key={f} d={`M${sx} 0 Q${sx + b * 0.08} ${-w * 0.5} ${ex} ${-w} M${sx} 0 Q${sx + b * 0.08} ${w * 0.5} ${ex} ${w}`} />;
          })}
        </g>
      )}
    </g>
  );
}

type Pt = [number, number];
/** A root as a chain of quadratic segments: start, then [control, end] pairs. */
type RootLine = { pts: Pt[]; w: number; hairs?: boolean };

const ROOTS: RootLine[] = [
  { pts: [[236, 276], [204, 279], [176, 298], [156, 312], [148, 334]], w: 4, hairs: true },
  { pts: [[188, 290], [178, 302], [181, 320]], w: 2.1, hairs: true },
  { pts: [[160, 310], [140, 314], [126, 330]], w: 1.8, hairs: true },
  { pts: [[238, 314], [212, 321], [199, 342], [190, 356], [188, 374]], w: 3.3, hairs: true },
  { pts: [[204, 334], [188, 337], [175, 352]], w: 1.7, hairs: true },
  { pts: [[245, 284], [270, 289], [289, 305], [304, 318], [308, 336]], w: 3.9, hairs: true },
  { pts: [[287, 304], [298, 320], [293, 340]], w: 1.9, hairs: true },
  { pts: [[243, 330], [262, 338], [274, 356], [282, 368], [284, 384]], w: 3, hairs: true },
  { pts: [[262, 343], [270, 356], [262, 372]], w: 1.5, hairs: true },
  { pts: [[242, 372], [231, 380], [227, 394]], w: 1.5, hairs: true },
];

const pathOf = (pts: Pt[]) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i + 1 < pts.length; i += 2) d += ` Q${pts[i][0]} ${pts[i][1]} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  return d;
};

/** Root hairs: short fine lines on both sides of the last part of a root, not at the very tip. */
function hairsOf(r: RootLine, salt: number) {
  const n = (r.pts.length - 1) / 2;
  const [p0, c, p1] = [r.pts[(n - 1) * 2], r.pts[(n - 1) * 2 + 1], r.pts[n * 2]];
  const out: string[] = [];
  const count = Math.round(6 + r.w * 2);
  for (let k = 0; k < count; k++) {
    const t = 0.2 + (0.62 * k) / count;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1];
    const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]);
    const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]);
    const l = Math.hypot(dx, dy) || 1;
    const side = k % 2 ? 1 : -1;
    const len = 3.2 + ((Math.sin((k + 1) * 12.9898 + salt) * 43758.5453) % 1 + 1) % 1 * 2.6;
    const nx = (-dy / l) * side;
    const ny = (dx / l) * side;
    out.push(`M${(x + nx * r.w * 0.5).toFixed(1)} ${(y + ny * r.w * 0.5).toFixed(1)} l${(nx * len + (dx / l) * 0.8).toFixed(1)} ${(ny * len + (dy / l) * 0.8).toFixed(1)}`);
  }
  return out.join(" ");
}

function Roots() {
  return (
    <g>
      {ROOTS.map((r, i) => (
        <g key={i}>
          <path d={pathOf(r.pts)} stroke={ROOT_D} strokeWidth={r.w + 1.8} fill="none" strokeLinecap="round" />
          <path d={pathOf(r.pts)} stroke={ROOT} strokeWidth={r.w} fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  );
}

function RootHairs() {
  return (
    <g stroke={ROOT_D} strokeWidth={0.75} strokeLinecap="round" opacity={0.85}>
      {ROOTS.filter((r) => r.hairs).map((r, i) => (
        <path key={i} d={hairsOf(r, i * 7.3)} />
      ))}
    </g>
  );
}

/** The magnified root hair zone: epidermis cells whose outgrowths reach between soil crumbs. */
function HairInset({ clip }: { clip: string }) {
  const cx = 398;
  const cy = 330;
  const r = 58;
  const crumbs: [number, number, number][] = [
    [356, 290, 9], [384, 280, 7], [420, 286, 10], [446, 304, 7], [366, 372, 8], [398, 382, 10], [432, 370, 8], [350, 330, 5], [446, 352, 6],
  ];
  const hairs = [348, 357, 366, 375, 384, 393, 402, 411];
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* zoom guide from a root tip to the magnifier */}
      <circle cx={305} cy={326} r={8} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 2.5" />
      <path d="M311 320 L349 297 M311 333 L345 364" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 2.5" />
      <circle cx={cx} cy={cy} r={r} fill="var(--raised)" />
      <g clipPath={`url(#${clip})`}>
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="var(--bio-soil)" opacity={0.18} />
        {crumbs.map(([x, y, s], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={s + 3} ry={s + 2} fill="var(--bio-water)" opacity={0.35} />
            <ellipse cx={x} cy={y} rx={s} ry={s * 0.82} fill="var(--bio-soil)" opacity={0.85} />
          </g>
        ))}
      </g>
      <g data-part="hairs">
        {/* the root piece with its epidermis cells */}
        <path d={`M${cx - r} 316 L428 316 Q450 318 452 330 Q450 342 428 344 L${cx - r} 344`} fill={ROOT} stroke={ROOT_D} strokeWidth={1.6} clipPath={`url(#${clip})`} />
        <g stroke={ROOT_D} strokeWidth={0.9} opacity={0.7} clipPath={`url(#${clip})`}>
          {[346, 358, 370, 382, 394, 406, 418].map((x) => (
            <path key={x} d={`M${x} 316 L${x} 322 M${x + 6} 344 L${x + 6} 338`} />
          ))}
          <path d={`M${cx - r} 322 L430 322 M${cx - r} 338 L430 338`} />
        </g>
        {/* root hairs: long tubes, each one a single cell */}
        <g fill={ROOT} stroke={ROOT_D} strokeWidth={1.2} clipPath={`url(#${clip})`}>
          {hairs.map((x, i) => {
            const up = i % 2 === 0;
            const len = 24 + ((i * 7) % 4) * 4;
            const bend = ((i * 5) % 3) - 1;
            const y0 = up ? 316 : 344;
            const s = up ? -1 : 1;
            return (
              <path
                key={x}
                d={`M${x - 2} ${y0 + s} Q${x - 2 + bend * 6} ${y0 + s * len * 0.55} ${x + bend * 3 - 2} ${y0 + s * len} A2 2 0 0 ${up ? 1 : 0} ${x + bend * 3 + 2} ${y0 + s * len} Q${x + 2 + bend * 6} ${y0 + s * len * 0.55} ${x + 2} ${y0 + s}`}
              />
            );
          })}
        </g>
      </g>
      {/* water films around the crumbs reach the hairs */}
      <g fill="var(--bio-water-deep)" clipPath={`url(#${clip})`}>
        {[[352, 296], [372, 368], [404, 290], [420, 372], [388, 300]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
    </g>
  );
}

/** The drawing without the Figure frame, so widgets can reuse it. */
export function PlantBody({ clip, inset = true }: { clip: string; inset?: boolean }) {
  return (
    <g>
      {/* soil */}
      <rect x={0} y={262} width={480} height={160} fill="var(--bio-soil)" opacity={0.26} />
      <path d="M0 262 Q40 258 80 262 T160 262 T240 262 T320 262 T400 262 T480 262" fill="none" stroke="var(--bio-soil)" strokeWidth={2.4} />
      {[[60, 300, 6], [110, 360, 4], [330, 402, 5], [40, 392, 4.5], [150, 404, 3.5]].map(([x, y, s], i) => (
        <ellipse key={i} cx={x} cy={y} rx={s * 1.4} ry={s} fill="var(--bio-soil)" opacity={0.5} />
      ))}

      {/* roots */}
      <g data-part="lateral">
        <Roots />
      </g>
      <g data-part="taproot">
        <path d="M232 262 C232 300 237 350 241.5 399 C245 350 249 300 249 262 Z" fill={ROOT} stroke={ROOT_D} strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      <RootHairs />

      {/* shoot axis */}
      <g data-part="stem">
        <path d="M240.5 266 C236 214 247 168 240 118 C237 96 238 84 238 70" fill="none" stroke={LEAF_D} strokeWidth={10.5} strokeLinecap="round" />
        <path d="M240.5 266 C236 214 247 168 240 118 C237 96 238 84 238 70" fill="none" stroke={LEAF} strokeWidth={6.5} strokeLinecap="round" />
        <path d="M239.5 120 Q226 104 206 92" fill="none" stroke={LEAF_D} strokeWidth={5.5} strokeLinecap="round" />
        <path d="M239.5 120 Q226 104 206 92" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
      </g>

      {/* leaves */}
      <g data-part="leaf">
        <PlantLeafShape x={239} y={222} angle={202} len={104} width={21} />
        <PlantLeafShape x={242} y={186} angle={-24} len={110} width={23} />
        <PlantLeafShape x={240} y={150} angle={208} len={88} width={18} />
        <PlantLeafShape x={239} y={126} angle={-32} len={70} width={14} />
      </g>

      {/* bud on a side shoot: green sepals, the pink petals just peeking out */}
      <g data-part="bud" transform="translate(206 92) rotate(-50) scale(1.3)">
        <path d="M0 -3 C-7 -8 -7 -19 0 -27 C7 -19 7 -8 0 -3 Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.4} />
        <path d="M0 1 C-9 -3 -9 -13 -3 -20 L0 -11 L3 -20 C9 -13 9 -3 0 1 Z" fill={LEAF} stroke={LEAF_D} strokeWidth={1.4} strokeLinejoin="round" />
      </g>

      {/* flower */}
      <g data-part="flower">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={`s${i}`} d="M0 0 L-4 14 L0 19 L4 14 Z" fill={LEAF} stroke={LEAF_D} strokeWidth={1.2} transform={`translate(238 62) rotate(${i * 72 + 36})`} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={`p${i}`} cx={0} cy={-15} rx={10.5} ry={14} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.5} transform={`translate(238 60) rotate(${i * 72})`} />
        ))}
        <circle cx={238} cy={60} r={8.5} fill="var(--bio-pollen)" stroke="var(--bio-nerve-deep)" strokeWidth={1.3} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle key={`a${i}`} cx={238 + Math.cos((i * Math.PI) / 4) * 5} cy={60 + Math.sin((i * Math.PI) / 4) * 5} r={1.4} fill="var(--bio-nerve-deep)" />
        ))}
      </g>

      {inset && <HairInset clip={clip} />}
    </g>
  );
}

/** The whole flowering plant with numbered parts. */
export function PlantWhole({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const clip = `pw-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <Figure title={tx("A flowering plant", "Eine Blütenpflanze")} width={480} height={420} parts={PLANT_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <PlantBody clip={clip} />
    </Figure>
  );
}
