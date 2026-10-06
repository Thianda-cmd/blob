"use client";

// The layers of a deciduous forest (Stockwerke des Waldes) as a labelled cross-section:
// tree, shrub, herb and moss layer above ground and the root layer in the soil.
// Not to scale: the low layers are stretched so that every layer can be seen.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const PARTS: FigurePart[] = [
  {
    id: "tree",
    label: tx("tree layer", "Baumschicht"),
    at: [432, 92],
    tag: [500, 70],
    info: tx("From about 5 m up to 40 m: beech, oak, spruce; woodpeckers and squirrels. The crowns catch most of the light.", "Ab etwa 5 m bis 40 m: Buche, Eiche, Fichte; Buntspecht und Eichhörnchen. Die Kronen fangen das meiste Licht."),
  },
  {
    id: "shrub",
    label: tx("shrub layer", "Strauchschicht"),
    at: [452, 214],
    tag: [500, 200],
    info: tx("About 1 m to 5 m: hazel, elder, young trees; blackcaps and dormice.", "Etwa 1 m bis 5 m: Hasel, Holunder, junge Bäume; Mönchsgrasmücke und Haselmaus."),
  },
  {
    id: "herb",
    label: tx("herb layer", "Krautschicht"),
    at: [440, 276],
    tag: [500, 258],
    info: tx("Up to about 1 m: wood anemone, woodruff, ferns, grasses. Early bloomers flower before the trees are in leaf.", "Bis etwa 1 m: Buschwindröschen, Waldmeister, Farne, Gräser. Frühblüher blühen, bevor die Bäume Blätter haben."),
  },
  {
    id: "moss",
    label: tx("moss layer", "Moosschicht"),
    at: [448, 296],
    tag: [500, 298],
    info: tx("A few centimetres high: mosses, lichens, mushrooms, leaf litter; beetles, woodlice, ants. Damp and shady.", "Wenige Zentimeter hoch: Moose, Flechten, Pilze, Laubstreu; Käfer, Asseln, Ameisen. Feucht und schattig."),
  },
  {
    id: "root",
    label: tx("root layer (soil)", "Wurzelschicht (Boden)"),
    at: [430, 340],
    tag: [500, 340],
    info: tx("In the soil: roots, fungal threads, earthworms, bacteria. Here dead leaves are broken down.", "Im Boden: Wurzeln, Pilzgeflechte, Regenwürmer, Bakterien. Hier wird totes Laub zersetzt."),
  },
];

const LEAF = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 2 };
const WOOD = { fill: "var(--bio-wood)", stroke: "var(--bio-wood-deep)", strokeWidth: 2 };

function Anemone({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <path d={`M${x} ${y + 30 * s} q-2 ${-14 * s} 0 ${-28 * s}`} stroke="var(--bio-leaf-deep)" strokeWidth={1.6} fill="none" />
      <path d={`M${x} ${y + 16 * s} q-9 -4 -13 2 q8 2 13 -2 z M${x} ${y + 16 * s} q9 -4 13 2 q-8 2 -13 -2 z`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx={x} cy={y - 5.5 * s} rx={2.8 * s} ry={5.2 * s} transform={`rotate(${a} ${x} ${y})`} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={0.9} />
      ))}
      <circle cx={x} cy={y} r={2.4 * s} fill="var(--bio-pollen)" />
    </g>
  );
}

function Fern({ x, y, flip = 1 }: { x: number; y: number; flip?: 1 | -1 }) {
  const fronds = [
    { dx: -30, h: 44 },
    { dx: -12, h: 54 },
    { dx: 10, h: 52 },
    { dx: 28, h: 40 },
  ];
  return (
    <g>
      {fronds.map((f, i) => {
        const ex = x + f.dx * flip;
        const ey = y - f.h;
        const cx = x + f.dx * 0.2 * flip;
        const cy = y - f.h * 1.15;
        return (
          <g key={i}>
            <path d={`M${x} ${y} Q${cx} ${cy} ${ex} ${ey}`} stroke="var(--bio-leaf-deep)" strokeWidth={1.8} fill="none" />
            {[0.25, 0.42, 0.58, 0.74, 0.88].map((t) => {
              const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * cx + t * t * ex;
              const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * ey;
              const r = 6.5 * (1 - t * 0.6);
              return (
                <g key={t}>
                  <ellipse cx={px - r * 0.7} cy={py + 1} rx={r} ry={r * 0.42} transform={`rotate(${-25 * flip} ${px} ${py})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />
                  <ellipse cx={px + r * 0.7} cy={py + 1} rx={r} ry={r * 0.42} transform={`rotate(${25 * flip} ${px} ${py})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={0.8} />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

function Grass({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 8} ${y} q2 -16 -4 -30 M${x - 3} ${y} q1 -20 3 -36 M${x + 2} ${y} q-1 -14 8 -27 M${x + 6} ${y} q3 -12 12 -20`}
      stroke="var(--bio-leaf-deep)"
      strokeWidth={1.8}
      fill="none"
      strokeLinecap="round"
    />
  );
}

function Moss({ x, y, n }: { x: number; y: number; n: number }) {
  let d = `M${x} ${y}`;
  for (let i = 0; i < n; i++) d += ` q5 -10 10 0`;
  d += " z";
  return <path d={d} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} strokeLinejoin="round" />;
}

export function EcoForestLayers({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Layers of a deciduous forest (not to scale)", "Stockwerke eines Laubwaldes (nicht maßstabsgetreu)")} width={520} height={378} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* layer boundaries */}
      {[160, 238, 284].map((y) => (
        <line key={y} x1={8} x2={482} y1={y} y2={y} stroke="var(--line-2)" strokeWidth={1.2} strokeDasharray="6 6" />
      ))}

      <g data-part="root">
        <rect x={6} y={300} width={478} height={72} rx={10} fill="var(--bio-soil)" opacity={0.55} />
        <path d="M6 300 H484" stroke="var(--bio-wood-deep)" strokeWidth={2} />
        {/* roots */}
        <path d="M104 300 q-6 18 -26 30 M104 300 q-2 22 -6 46 M116 300 q8 20 28 30 M116 300 q2 16 14 40" stroke="var(--bio-wood-deep)" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <path d="M252 300 q-4 14 -18 22 M258 300 q6 12 20 18 M255 300 v26" stroke="var(--bio-wood-deep)" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <path d="M388 300 q-10 22 -34 34 M394 300 q0 26 -4 50 M402 300 q12 18 34 28" stroke="var(--bio-wood-deep)" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        {/* fungal threads */}
        <path d="M150 334 q14 6 26 -2 q12 -8 24 2 M170 352 q10 -6 22 0 q10 6 22 -2" stroke="var(--bio-bone)" strokeWidth={1.2} fill="none" />
        {/* earthworm */}
        <path d="M300 348 q10 -10 22 -2 q12 8 24 -2 q6 -5 12 -2" stroke="var(--bio-flesh-deep)" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M312 342 v6 M324 345 v6 M336 346 v6" stroke="var(--bio-flesh)" strokeWidth={1.2} />
      </g>

      <g data-part="tree">
        {/* beech */}
        <path d="M102 300 L104 120 L116 120 L118 300 Z" {...WOOD} />
        <path d="M110 150 l-16 -18 M112 140 l14 -16" stroke="var(--bio-wood-deep)" strokeWidth={3} strokeLinecap="round" />
        <g {...LEAF}>
          <circle cx={70} cy={98} r={40} />
          <circle cx={152} cy={98} r={40} />
          <circle cx={110} cy={66} r={48} />
          <circle cx={110} cy={116} r={36} />
        </g>
        <path d="M84 70 q8 -10 18 -6 M128 58 q8 -2 12 6 M76 112 q6 6 14 4" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} fill="none" />
        {/* spruce */}
        <path d="M252 300 L253 150 L259 150 L260 300 Z" {...WOOD} />
        <g fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={2} strokeLinejoin="round">
          <path d="M256 120 L304 172 L208 172 Z" />
          <path d="M256 84 L296 136 L216 136 Z" />
          <path d="M256 50 L288 100 L224 100 Z" />
          <path d="M256 20 L280 64 L232 64 Z" />
        </g>
        {/* oak */}
        <path d="M386 300 L388 128 L402 128 L404 300 Z" {...WOOD} />
        <path d="M394 160 l-18 -22 M396 150 l16 -18" stroke="var(--bio-wood-deep)" strokeWidth={3} strokeLinecap="round" />
        <g fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={2}>
          <circle cx={356} cy={98} r={34} />
          <circle cx={434} cy={96} r={34} />
          <circle cx={395} cy={64} r={42} />
          <circle cx={378} cy={124} r={28} />
          <circle cx={414} cy={124} r={28} />
        </g>
        <path d="M372 80 q6 -8 14 -4 M408 52 q8 0 10 8 M420 112 q4 6 -2 10" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} fill="none" />
      </g>

      <g data-part="shrub">
        {/* hazel */}
        <path d="M176 300 q-4 -40 -10 -78 M186 300 q0 -46 4 -90 M196 300 q6 -40 14 -76" stroke="var(--bio-wood-deep)" strokeWidth={2.2} fill="none" />
        <g {...LEAF}>
          <circle cx={166} cy={212} r={24} />
          <circle cx={210} cy={214} r={22} />
          <circle cx={190} cy={192} r={28} />
          <circle cx={188} cy={226} r={22} />
        </g>
        {/* elder with berries */}
        <path d="M322 300 q-2 -40 -8 -74 M332 300 q2 -50 2 -96 M342 300 q4 -38 12 -70" stroke="var(--bio-wood-deep)" strokeWidth={2.2} fill="none" />
        <g {...LEAF}>
          <circle cx={312} cy={220} r={22} />
          <circle cx={354} cy={222} r={22} />
          <circle cx={333} cy={200} r={27} />
        </g>
        {[
          [320, 214],
          [326, 220],
          [318, 222],
          [346, 206],
          [352, 213],
          [344, 214],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={2.6} fill="var(--bio-nucleus-deep)" />
        ))}
        {/* young tree */}
        <path d="M455 300 L456 214 L460 214 L461 300 Z" {...WOOD} />
        <g {...LEAF}>
          <circle cx={447} cy={208} r={15} />
          <circle cx={470} cy={210} r={13} />
          <circle cx={458} cy={192} r={17} />
        </g>
      </g>

      <g data-part="herb">
        <Fern x={52} y={298} />
        <Fern x={292} y={298} flip={-1} />
        <Anemone x={140} y={262} />
        <Anemone x={156} y={270} s={0.85} />
        <Anemone x={230} y={264} />
        <Anemone x={368} y={268} s={0.9} />
        <Grass x={214} y={298} />
        <Grass x={420} y={298} />
        <Grass x={448} y={298} />
      </g>

      <g data-part="moss">
        <Moss x={14} y={300} n={6} />
        <Moss x={238} y={300} n={4} />
        <Moss x={424} y={300} n={5} />
        {/* mushroom */}
        <path d="M352 300 v-10 q0 -3 3 -3 h4 q3 0 3 3 v10 z" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.2} />
        <path d="M344 290 q13 -18 26 0 z" fill="var(--bio-mito-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />
        {/* leaf litter */}
        {[
          [90, 298, 20],
          [172, 297, -15],
          [205, 298, 30],
          [326, 298, -25],
          [398, 297, 10],
        ].map(([x, y, a]) => (
          <ellipse key={x} cx={x} cy={y} rx={7} ry={3} transform={`rotate(${a} ${x} ${y})`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
        ))}
      </g>
    </Figure>
  );
}
