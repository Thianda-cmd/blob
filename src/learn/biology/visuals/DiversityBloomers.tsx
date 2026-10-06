"use client";

// Early bloomers for the "plant-diversity" topic: five spring flowers with their storage organs
// in the soil (bulb, corm, rhizome, root tubers), a section through a bulb, and a widget that
// runs through the year in a beech wood: light on the forest floor, the wood anemone above
// ground and its rhizome filling up and emptying.

import { motion, useReducedMotion } from "motion/react";
import { useId, useState, type ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { petalPath } from "./DiversityShapes";

export type BloomerId = "tulip" | "snowdrop" | "crocus" | "anemone" | "celandine";
export type OrganId = "bulb" | "corm" | "rhizome" | "roottuber";

export const ORGAN_NAMES: Record<OrganId, Text> = {
  bulb: tx("bulb", "Zwiebel"),
  corm: tx("corm (stem tuber)", "Sprossknolle"),
  rhizome: tx("rhizome (underground stem)", "Erdspross (Rhizom)"),
  roottuber: tx("root tubers", "Wurzelknollen"),
};

export const BLOOMER_NAMES: Record<BloomerId, Text> = {
  tulip: tx("tulip", "Tulpe"),
  snowdrop: tx("snowdrop", "Schneeglöckchen"),
  crocus: tx("crocus", "Krokus"),
  anemone: tx("wood anemone", "Buschwindröschen"),
  celandine: tx("lesser celandine", "Scharbockskraut"),
};

export const BLOOMER_ORGAN: Record<BloomerId, OrganId> = { tulip: "bulb", snowdrop: "bulb", crocus: "corm", anemone: "rhizome", celandine: "roottuber" };

const GROUND = 170;

const ORGAN_INFO: Record<OrganId, Text> = {
  bulb: tx("A very short stem (the basal plate) with thick, fleshy leaves that store food.", "Eine stark gestauchte Sprossachse (Zwiebelscheibe) mit dicken, fleischigen Blättern, die Nährstoffe speichern."),
  corm: tx("A thickened, solid piece of stem: no layers inside.", "Ein verdicktes, festes Stück Sprossachse: innen keine Schichten."),
  rhizome: tx("A stem that grows sideways underground. It has buds, so it is a shoot, not a root.", "Eine Sprossachse, die waagerecht im Boden wächst. Sie trägt Knospen, ist also ein Spross und keine Wurzel."),
  roottuber: tx("Thickened roots, shaped like little clubs, full of starch.", "Verdickte Wurzeln, wie kleine Keulen geformt, voller Stärke."),
};

function partsFor(id: BloomerId): FigurePart[] {
  const organ = BLOOMER_ORGAN[id];
  const pos: Record<BloomerId, { flower: [number, number]; leaf: [number, number]; storage: [number, number]; roots: [number, number]; tags: Record<string, [number, number]> }> = {
    tulip: { flower: [150, 62], leaf: [112, 132], storage: [150, 212], roots: [150, 262], tags: { flower: [214, 50], leaf: [64, 108], storage: [226, 206], roots: [214, 272] } },
    snowdrop: { flower: [176, 92], leaf: [128, 128], storage: [150, 214], roots: [150, 258], tags: { flower: [230, 84], leaf: [70, 104], storage: [226, 206], roots: [214, 272] } },
    crocus: { flower: [150, 70], leaf: [118, 120], storage: [150, 214], roots: [150, 260], tags: { flower: [216, 54], leaf: [64, 104], storage: [228, 206], roots: [214, 274] } },
    anemone: { flower: [150, 50], leaf: [104, 106], storage: [212, 200], roots: [92, 236], tags: { flower: [214, 40], leaf: [52, 90], storage: [260, 236], roots: [48, 262] } },
    celandine: { flower: [168, 54], leaf: [110, 134], storage: [146, 232], roots: [184, 254], tags: { flower: [228, 44], leaf: [56, 112], storage: [74, 250], roots: [240, 270] } },
  };
  const p = pos[id];
  return [
    { id: "flower", label: tx("flower", "Blüte"), at: p.flower, tag: p.tags.flower, info: tx("Opens early, while light still reaches the forest floor.", "Öffnet sich früh, solange noch Licht auf den Waldboden fällt.") },
    { id: "leaf", label: tx("leaf", "Laubblatt"), at: p.leaf, tag: p.tags.leaf, info: tx("Makes sugar by photosynthesis and refills the store for next year.", "Bildet durch Fotosynthese Zucker und füllt den Speicher für das nächste Jahr wieder auf.") },
    { id: "storage", label: ORGAN_NAMES[organ], at: p.storage, tag: p.tags.storage, info: ORGAN_INFO[organ] },
    { id: "roots", label: tx("roots", "Wurzeln"), at: p.roots, tag: p.tags.roots, info: tx("Take up water and minerals from the soil.", "Nehmen Wasser und Mineralstoffe aus dem Boden auf.") },
  ];
}

const leafStroke = { fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)", strokeWidth: 1.6, strokeLinejoin: "round" as const };
const rootStroke = { fill: "none", stroke: "var(--bio-wood-deep)", strokeWidth: 1.4, strokeLinecap: "round" as const };

function Roots({ x, y, spread = 30, len = 46 }: { x: number; y: number; spread?: number; len?: number }) {
  const ds = [-1, -0.55, -0.15, 0.2, 0.6, 1].map((k, i) => `M${x + k * spread * 0.3} ${y}Q${x + k * spread * 0.8} ${y + len * 0.5} ${x + k * spread} ${y + len - (i % 2) * 8}`);
  return <path d={ds.join("")} {...rootStroke} />;
}

function Bulb({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  // An onion shape: wide belly, pointed neck; layered scales shown as lines.
  const d = `M${x} ${y - h / 2}C${x + w * 0.18} ${y - h * 0.3} ${x + w * 0.56} ${y - h * 0.12} ${x + w * 0.5} ${y + h * 0.24}C${x + w * 0.46} ${y + h * 0.46} ${x + w * 0.2} ${y + h / 2} ${x} ${y + h / 2}C${x - w * 0.2} ${y + h / 2} ${x - w * 0.46} ${y + h * 0.46} ${x - w * 0.5} ${y + h * 0.24}C${x - w * 0.56} ${y - h * 0.12} ${x - w * 0.18} ${y - h * 0.3} ${x} ${y - h / 2}Z`;
  return (
    <>
      <path d={d} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      <path d={`M${x} ${y - h / 2 + 6}C${x + w * 0.1} ${y - h * 0.2} ${x + w * 0.3} ${y} ${x + w * 0.28} ${y + h * 0.38}M${x} ${y - h / 2 + 6}C${x - w * 0.1} ${y - h * 0.2} ${x - w * 0.3} ${y} ${x - w * 0.28} ${y + h * 0.38}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1} opacity={0.6} />
      <rect x={x - w * 0.3} y={y + h / 2 - 5} width={w * 0.6} height={7} rx={3} fill="var(--bio-wood-deep)" />
    </>
  );
}

function Soil() {
  return (
    <>
      <rect x={0} y={GROUND} width={300} height={300 - GROUND} fill="var(--bio-soil)" opacity={0.28} />
      <path d={`M0 ${GROUND}L300 ${GROUND}`} stroke="var(--bio-soil)" strokeWidth={2.5} />
    </>
  );
}

function Tulip() {
  return (
    <>
      <g data-part="leaf">
        <path d="M146 196C122 170 100 136 104 96C116 128 132 160 150 190Z" {...leafStroke} />
        <path d="M154 196C182 172 200 142 196 108C184 136 168 164 150 190Z" {...leafStroke} />
      </g>
      <path d="M150 200L150 82" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
      <g data-part="flower" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} strokeLinejoin="round">
        <path d="M150 86C132 84 122 66 126 40C134 50 142 56 150 58Z" />
        <path d="M150 86C168 84 178 66 174 40C166 50 158 56 150 58Z" />
        <path d="M150 88C138 84 134 62 150 32C166 62 162 84 150 88Z" />
      </g>
      <g data-part="storage">
        <Bulb x={150} y={212} w={60} h={46} />
      </g>
      <g data-part="roots">
        <Roots x={150} y={236} />
      </g>
    </>
  );
}

function Snowdrop() {
  return (
    <>
      <g data-part="leaf">
        <path d="M146 196C134 160 126 132 128 100C134 104 138 112 140 120C142 146 146 170 150 192Z" {...leafStroke} />
        <path d="M154 196C162 166 166 140 170 118C174 120 174 126 172 134C168 156 162 178 156 194Z" {...leafStroke} />
      </g>
      <path d="M150 200C150 150 152 100 160 70C164 62 170 62 174 70" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M170 64L176 72" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
      <g data-part="flower" strokeLinejoin="round">
        {/* inner tepals with the green mark, then the three white outer tepals hanging down */}
        <path d="M170 92C170 102 182 102 182 92L180 82L172 82Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.2} />
        <path d="M172 96C174 99 178 99 180 96" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinecap="round" />
        <path d="M176 74C164 78 160 92 162 104C168 100 172 92 176 78Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.4} />
        <path d="M176 74C188 78 192 92 190 104C184 100 180 92 176 78Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.4} />
        <path d="M176 74C170 82 170 98 176 110C182 98 182 82 176 74Z" fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.4} />
      </g>
      <g data-part="storage">
        <Bulb x={150} y={214} w={40} h={34} />
      </g>
      <g data-part="roots">
        <Roots x={150} y={232} spread={24} len={36} />
      </g>
    </>
  );
}

function Crocus() {
  return (
    <>
      <g data-part="leaf">
        {[
          [-1, 112, 92],
          [1, 186, 90],
          [-1, 128, 76],
        ].map(([s, tx2, ty], i) => (
          <g key={i}>
            <path d={`M${150 + s * 3} 196C${150 + s * 6} 160 ${tx2 - s * 10} 120 ${tx2} ${ty}C${tx2 + s * 2} ${ty + 6} ${tx2 - s * 2} ${ty + 30} ${150 + s * 8} 196Z`} {...leafStroke} />
            <path d={`M${150 + s * 5} 192C${150 + s * 7} 160 ${tx2 - s * 6} 124 ${tx2 + s * 0.5} ${ty + 4}`} fill="none" stroke="var(--raised)" strokeWidth={1.2} opacity={0.9} />
          </g>
        ))}
      </g>
      <path d="M150 196L150 96" stroke="var(--bio-bone)" strokeWidth={6} strokeLinecap="round" />
      <path d="M150 196L150 96" stroke="var(--bio-outline)" strokeWidth={1} opacity={0.3} />
      <g data-part="flower" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeLinejoin="round">
        <path d="M150 104C134 102 128 80 134 52C140 62 146 70 150 72Z" />
        <path d="M150 104C166 102 172 80 166 52C160 62 154 70 150 72Z" />
        <path d="M150 106C140 96 138 70 150 44C162 70 160 96 150 106Z" />
        <path d="M146 60L144 44M150 58L150 40M154 60L156 44" stroke="var(--bio-pollen)" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </g>
      <g data-part="storage">
        {/* corm: solid, flattened, with a net of fibres; the old corm shrinks underneath */}
        <ellipse cx={150} cy={210} rx={28} ry={18} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <path d="M128 204Q150 198 172 204M126 212Q150 206 174 212M134 222L144 198M150 226L150 194M166 222L156 198" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={0.9} opacity={0.55} />
      </g>
      <g data-part="roots">
        <Roots x={150} y={226} spread={30} len={40} />
      </g>
    </>
  );
}

function Anemone() {
  // A whorl of three deeply divided leaves halfway up the stem, one white star-shaped flower.
  const leafAt = (deg: number) => (
    <g key={deg} transform={`translate(150 112) rotate(${deg})`}>
      <path d="M0 0L0 -22" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
      {[-34, 0, 34].map((a) => (
        <path key={a} d={petalPath(0, -20, 30, 13, a, 0)} {...leafStroke} />
      ))}
    </g>
  );
  return (
    <>
      <g data-part="storage">
        <path d="M44 196C80 186 130 200 170 192C200 186 230 192 262 188" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={11} strokeLinecap="round" />
        <path d="M44 196C80 186 130 200 170 192C200 186 230 192 262 188" fill="none" stroke="var(--bio-wood)" strokeWidth={8} strokeLinecap="round" />
        {[86, 150, 214].map((x) => (
          <path key={x} d={`M${x} ${x === 150 ? 188 : 186}l0 6`} stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
        ))}
        {/* a bud at the tip: next year's shoot */}
        <path d="M262 188C266 178 270 176 272 180C272 186 268 190 262 190Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      </g>
      <g data-part="roots">
        {[70, 112, 136, 190, 236].map((x, i) => (
          <path key={x} d={`M${x} 196Q${x - 6 + i * 3} 220 ${x - 10 + i * 5} ${238 + (i % 2) * 10}`} {...rootStroke} />
        ))}
      </g>
      <path d="M150 192C148 160 152 130 150 112C149 92 150 70 150 56" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.6} strokeLinecap="round" />
      <g data-part="leaf">{[-84, 84, 180].map(leafAt)}</g>
      <g data-part="flower">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} d={petalPath(150, 46, 22, 14, a)} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        ))}
        <circle cx={150} cy={46} r={6.5} fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
      </g>
    </>
  );
}

function Celandine() {
  const heart = (x: number, y: number, deg: number, k: number) => (
    <g key={`${x}-${deg}`} transform={`translate(${x} ${y}) rotate(${deg}) scale(${k})`}>
      <path d="M0 0C-14 -4 -24 -16 -20 -28C-16 -38 -4 -38 0 -30C4 -38 16 -38 20 -28C24 -16 14 -4 0 0Z" {...leafStroke} />
    </g>
  );
  return (
    <>
      <g data-part="leaf">
        <path d="M146 196Q128 160 112 148M150 196Q150 170 152 142M154 196Q176 168 196 150" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
        {heart(112, 150, -40, 1)}
        {heart(196, 152, 44, 1)}
        {heart(152, 146, -8, 0.9)}
      </g>
      <path d="M152 196C156 150 164 100 168 66" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
      <g data-part="flower">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={petalPath(168, 54, 23, 9, i * 40 + 8)} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
        ))}
        <circle cx={168} cy={54} r={6} fill="var(--bio-pollen)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
      </g>
      <g data-part="storage">
        {[
          [-26, 30],
          [-12, 40],
          [2, 44],
          [15, 38],
          [28, 28],
        ].map(([a, len], i) => (
          <g key={i} transform={`translate(${150 + a * 0.2} 200) rotate(${a})`}>
            <path d={`M0 0C-3 ${len * 0.35} -8 ${len * 0.7} -6 ${len}C-4 ${len + 8} 4 ${len + 8} 6 ${len}C8 ${len * 0.7} 3 ${len * 0.35} 0 0Z`} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
          </g>
        ))}
      </g>
      <g data-part="roots">
        <path d="M152 202C166 222 182 240 190 268M152 202C172 214 200 222 222 230M148 202C134 214 112 224 92 232" {...rootStroke} />
      </g>
    </>
  );
}

const DRAW: Record<BloomerId, ComponentType> = { tulip: Tulip, snowdrop: Snowdrop, crocus: Crocus, anemone: Anemone, celandine: Celandine };

/** An early bloomer with its storage organ in the soil. */
export function DiversityBloomer({ plant = "tulip", mode = "names", show, ask, highlight, legend }: DrawingProps & { plant?: BloomerId }) {
  const Draw = DRAW[plant];
  return (
    <Figure title={BLOOMER_NAMES[plant]} width={300} height={290} parts={partsFor(plant)} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <Soil />
      <Draw />
    </Figure>
  );
}

/** Task picture: an early bloomer at a friendly size. */
export function DiversityBloomerPicture(props: DrawingProps & { plant?: BloomerId }) {
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <DiversityBloomer {...props} />
    </div>
  );
}

/** Lesson widget: pick an early bloomer and explore it. */
export function DiversityBloomerExplorer() {
  const t = useText();
  const scope = useId();
  const [plant, setPlant] = useState<BloomerId>("tulip");
  const list: BloomerId[] = ["tulip", "snowdrop", "crocus", "anemone", "celandine"];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {list.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPlant(k)}
            className={cn("relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", plant === k ? "text-white" : "bg-hover text-ink-2 hover:text-ink")}
          >
            {plant === k && <motion.span layoutId={`${scope}-b`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(BLOOMER_NAMES[k])}</span>
          </button>
        ))}
      </div>
      <div className="mx-auto max-w-[600px]">
        <DiversityBloomer key={plant} plant={plant} mode="explore" />
      </div>
      <p className="text-[13px] leading-snug text-ink-3">
        {t(tx("Tap the numbers. Storage organ of this plant: ", "Tipp auf die Nummern. Speicherorgan dieser Pflanze: "))}
        <span className="font-semibold text-ink">{t(ORGAN_NAMES[BLOOMER_ORGAN[plant]])}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A bulb cut lengthwise

const BULB_PARTS: FigurePart[] = [
  { id: "skin", label: tx("dry outer skin", "trockene Zwiebelhaut"), at: [84, 150], tag: [36, 120], info: tx("Dead, papery leaves that protect the bulb.", "Abgestorbene, papierartige Blätter, die die Zwiebel schützen.") },
  { id: "scales", label: tx("fleshy storage leaves (scales)", "Speicherblätter (Zwiebelschuppen)"), at: [112, 176], tag: [40, 196], info: tx("Thick leaves full of stored food. Peel an onion: these are its layers.", "Dicke Blätter voller gespeicherter Nährstoffe. Bei der Küchenzwiebel sind das die Schichten.") },
  { id: "bud", label: tx("bud with the flower already formed", "Knospe mit fertig angelegter Blüte"), at: [160, 110], tag: [236, 80], info: tx("Next spring's shoot and flower are already waiting inside.", "Spross und Blüte des nächsten Frühjahrs warten schon darin.") },
  { id: "daughter", label: tx("daughter bulb (side bud)", "Brutzwiebel (Seitenknospe)"), at: [204, 214], tag: [270, 200], info: tx("Grows into a new plant: a way to multiply without seeds.", "Wächst zu einer neuen Pflanze heran: Vermehrung ohne Samen.") },
  { id: "plate", label: tx("basal plate (very short stem)", "Zwiebelscheibe (gestauchte Sprossachse)"), at: [160, 246], tag: [254, 252], info: tx("The stem of the bulb, squeezed into a flat disc. Leaves grow on top, roots underneath.", "Die Sprossachse der Zwiebel, zu einer flachen Scheibe gestaucht. Oben sitzen die Blätter, unten die Wurzeln.") },
  { id: "roots", label: tx("roots", "Wurzeln"), at: [150, 278], tag: [84, 284], info: tx("Grow from the underside of the basal plate.", "Wachsen an der Unterseite der Zwiebelscheibe.") },
];

export function DiversityBulbSection({ mode = "explore", show, ask, highlight, legend }: DrawingProps) {
  const layer = (k: number) => {
    const w = 78 - k * 14;
    const top = 70 + k * 18;
    return `M160 ${top}C${160 + w * 0.5} ${top + 30} ${160 + w * 1.1} ${150 + k * 6} ${160 + w} ${200}C${160 + w * 0.9} ${232} ${160 + w * 0.4} ${244} 160 ${244}C${160 - w * 0.4} 244 ${160 - w * 0.9} 232 ${160 - w} 200C${160 - w * 1.1} ${150 + k * 6} ${160 - w * 0.5} ${top + 30} 160 ${top}Z`;
  };
  return (
    <Figure title={tx("Tulip bulb cut lengthwise", "Längsschnitt durch eine Tulpenzwiebel")} width={320} height={300} parts={BULB_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="roots" {...rootStroke} strokeWidth={1.8}>
        <path d="M128 248Q118 268 104 286M144 250Q140 272 134 292M160 250Q162 274 158 294M176 250Q182 272 190 290M192 248Q204 264 218 280" />
      </g>
      <g data-part="skin">
        <path d={layer(-0.25)} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      </g>
      <g data-part="scales">
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={layer(k)} fill={k % 2 ? "var(--bio-bone)" : "var(--bio-cell)"} stroke="var(--bio-wood)" strokeWidth={1.4} />
        ))}
      </g>
      <g data-part="bud">
        <path d="M160 238C146 220 146 160 152 128C154 116 158 104 160 96C162 104 166 116 168 128C174 160 174 220 160 238Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
        <path d="M160 132C152 128 150 116 154 104C157 110 160 114 160 118C160 114 163 110 166 104C170 116 168 128 160 132Z" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.2} />
        <path d="M160 236L160 136" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      </g>
      <g data-part="daughter">
        <path d="M204 238C194 236 192 222 196 212C198 206 202 202 204 198C206 202 210 206 212 212C216 222 214 236 204 238Z" fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="plate">
        <path d="M118 238C132 248 188 248 204 238L206 248C190 256 130 256 116 248Z" fill="var(--bio-wood-deep)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// A year in the beech wood

type Month = {
  name: Text;
  light: number;
  canopy: number;
  stage: "rest" | "shoot" | "flower" | "leaves" | "wilt";
  store: number;
  say: Text;
};

export const WOOD_YEAR: Month[] = [
  { name: tx("Jan", "Jan"), light: 55, canopy: 0, stage: "rest", store: 1, say: tx("Winter: the trees are bare. The wood anemone rests in the soil as a rhizome full of starch.", "Winter: Die Bäume sind kahl. Das Buschwindröschen ruht als Erdspross voller Stärke im Boden.") },
  { name: tx("Feb", "Feb"), light: 60, canopy: 0, stage: "rest", store: 1, say: tx("Still cold. Underground, the bud at the tip of the rhizome gets ready.", "Noch kalt. Im Boden macht sich die Knospe an der Spitze des Erdsprosses bereit.") },
  { name: tx("Mar", "Mär"), light: 65, canopy: 0, stage: "shoot", store: 0.65, say: tx("The shoot pushes up fast, using the stored starch. No photosynthesis is needed for that.", "Der Spross schiebt sich schnell nach oben und nutzt dafür die gespeicherte Stärke. Dafür braucht er keine Fotosynthese.") },
  { name: tx("Apr", "Apr"), light: 50, canopy: 0.3, stage: "flower", store: 0.4, say: tx("Full bloom! Plenty of light reaches the floor because the trees have no leaves yet.", "Hauptblüte! Viel Licht erreicht den Boden, weil die Bäume noch kein Laub haben.") },
  { name: tx("May", "Mai"), light: 12, canopy: 0.85, stage: "leaves", store: 0.75, say: tx("The beeches leaf out and it gets dark. Until then the leaves make sugar and refill the rhizome.", "Die Buchen treiben aus, es wird dunkel. Bis dahin bilden die Blätter Zucker und füllen den Erdspross wieder auf.") },
  { name: tx("Jun", "Jun"), light: 5, canopy: 1, stage: "wilt", store: 0.95, say: tx("Too little light. The parts above ground wither, the full store stays in the soil.", "Zu wenig Licht. Die oberirdischen Teile welken, der volle Speicher bleibt im Boden.") },
  { name: tx("Jul", "Jul"), light: 4, canopy: 1, stage: "rest", store: 1, say: tx("Summer: the wood anemone has vanished. It waits underground for next spring.", "Sommer: Vom Buschwindröschen ist nichts mehr zu sehen. Es wartet im Boden auf das nächste Frühjahr.") },
];

/** Lesson widget: move through the year and watch light, leaves and the store. */
export function DiversitySeasons() {
  const t = useText();
  const reduce = useReducedMotion();
  const [m, setM] = useState(3);
  const M = WOOD_YEAR[m];
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 160, damping: 22 };
  // Chart geometry
  const cx = (i: number) => 40 + i * 76;
  const cy = (v: number) => 410 - v * 1.15;
  const crowns: [number, number][] = [
    [96, 70],
    [404, 64],
    [250, 40],
  ];
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 520 440" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("A beech wood through the year", "Ein Buchenwald im Jahreslauf"))}>
        {/* sun and light reaching the floor */}
        <circle cx={470} cy={24} r={16} fill="var(--bio-sun)" />
        <motion.g animate={{ opacity: M.light / 70 }} transition={spring}>
          {[150, 210, 300, 360].map((x) => (
            <path key={x} d={`M${x + 70} 20L${x} 230`} stroke="var(--bio-sun)" strokeWidth={10} opacity={0.35} strokeLinecap="round" />
          ))}
        </motion.g>
        {/* trunks and crowns */}
        {crowns.map(([x, y]) => (
          <g key={x}>
            <path d={`M${x - 7} 236L${x - 5} ${y + 40}L${x + 5} ${y + 40}L${x + 7} 236Z`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
            <path d={`M${x} ${y + 60}L${x - 40} ${y + 22}M${x} ${y + 70}L${x + 44} ${y + 26}M${x} ${y + 44}L${x - 14} ${y + 4}`} stroke="var(--bio-wood-deep)" strokeWidth={2.4} strokeLinecap="round" />
            <motion.ellipse cx={x} cy={y + 30} rx={78} ry={44} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} animate={{ opacity: M.canopy, scale: 0.8 + M.canopy * 0.2 }} transition={spring} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
          </g>
        ))}
        {/* forest floor and soil */}
        <rect x={0} y={236} width={520} height={52} fill="var(--bio-soil)" opacity={0.28} />
        <path d="M0 236L520 236" stroke="var(--bio-soil)" strokeWidth={2.5} />
        {/* rhizome with its store */}
        <path d="M150 262C200 254 260 268 330 258" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={14} strokeLinecap="round" />
        <motion.path d="M150 262C200 254 260 268 330 258" fill="none" stroke="var(--bio-bone)" strokeWidth={9} strokeLinecap="round" animate={{ pathLength: Math.max(0.04, M.store) }} transition={spring} />
        {/* the plant above ground */}
        <motion.g animate={{ opacity: M.stage === "rest" ? 0 : 1 }} transition={spring}>
          <motion.path d="M240 262L240 186" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeLinecap="round" animate={{ pathLength: M.stage === "shoot" ? 0.55 : M.stage === "wilt" ? 0.5 : 1 }} transition={spring} />
          <motion.g animate={{ opacity: M.stage === "flower" || M.stage === "leaves" ? 1 : M.stage === "shoot" ? 0.6 : 0.3, rotate: M.stage === "wilt" ? 40 : 0 }} transition={spring} style={{ transformBox: "view-box", transformOrigin: "240px 236px" }}>
            {[-60, 60].map((a) => (
              <path key={a} d={petalPath(240, 214, 28, 14, a)} fill={M.stage === "wilt" ? "var(--bio-wood)" : "var(--bio-leaf)"} stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
            ))}
          </motion.g>
          <motion.g animate={{ opacity: M.stage === "flower" ? 1 : 0, scale: M.stage === "flower" ? 1 : 0.4 }} transition={spring} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path key={a} d={petalPath(240, 180, 14, 9, a)} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            ))}
            <circle cx={240} cy={180} r={4.5} fill="var(--bio-pollen)" />
          </motion.g>
        </motion.g>
        {/* chart: light on the forest floor */}
        <path d={`M${cx(0)} ${cy(0)}L${cx(6) + 10} ${cy(0)}M${cx(0)} ${cy(0)}L${cx(0)} ${cy(80)}`} stroke="var(--ink-3)" strokeWidth={1.2} />
        <path d={WOOD_YEAR.map((x, i) => `${i ? "L" : "M"}${cx(i)} ${cy(x.light)}`).join("")} fill="none" stroke="var(--bio-sun)" strokeWidth={3} strokeLinejoin="round" />
        {WOOD_YEAR.map((x, i) => (
          <g key={i} onClick={() => setM(i)} className="cursor-pointer">
            <circle cx={cx(i)} cy={cy(x.light)} r={i === m ? 6 : 3.5} fill={i === m ? "var(--blob)" : "var(--bio-sun)"} />
            <text x={cx(i)} y={cy(0) + 16} textAnchor="middle" fontSize={12} fill={i === m ? "var(--ink)" : "var(--ink-3)"} fontWeight={i === m ? 700 : 400} style={{ fontFamily: "var(--font-sans)" }}>
              {t(x.name)}
            </text>
          </g>
        ))}
        <text x={cx(0) + 6} y={cy(80) - 2} fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("light on the forest floor (about, % of full daylight)", "Licht am Waldboden (ungefähr, % des vollen Tageslichts)"))}
        </text>
      </svg>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={WOOD_YEAR.length - 1}
          step={1}
          value={m}
          onChange={(e) => setM(Number(e.target.value))}
          className="w-full accent-[var(--blob)]"
          aria-label={t(tx("Month", "Monat"))}
        />
        <span className="w-12 shrink-0 text-right font-semibold text-ink">{t(M.name)}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex gap-4 text-[13px] text-ink-2">
          <span>
            {t(tx("Light: ", "Licht: "))}
            <span className="font-semibold text-ink">{M.light} %</span>
          </span>
          <span>
            {t(tx("Store: ", "Speicher: "))}
            <span className="font-semibold text-ink">{Math.round(M.store * 100)} %</span>
          </span>
        </div>
        <motion.p key={m} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[14px] leading-snug text-ink">
          {t(M.say)}
        </motion.p>
      </div>
    </div>
  );
}
