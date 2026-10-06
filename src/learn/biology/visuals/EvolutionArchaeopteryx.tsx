"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";

// Archaeopteryx, the primeval bird: a transitional form with bird and reptile features.

export type ArchFeature = "feathers" | "wing" | "wishbone" | "teeth" | "claws" | "tail";

export const ARCH_FEATURES: { id: ArchFeature; name: Text; bird: boolean }[] = [
  { id: "feathers", name: tx("feathers", "Federn"), bird: true },
  { id: "wing", name: tx("wings with flight feathers", "Flügel mit Schwungfedern"), bird: true },
  { id: "wishbone", name: tx("wishbone", "Gabelbein"), bird: true },
  { id: "teeth", name: tx("teeth in the jaws", "Zähne im Kiefer"), bird: false },
  { id: "claws", name: tx("clawed fingers on the wings", "Finger mit Krallen am Flügel"), bird: false },
  { id: "tail", name: tx("long tail with many vertebrae", "lange Schwanzwirbelsäule"), bird: false },
];

const PARTS: FigurePart[] = [
  { id: "feathers", label: tx("feathers", "Federn"), at: [150, 203], tag: [128, 160], info: tx("The whole body was covered with feathers, as in birds. Bird feature.", "Der ganze Körper war wie bei Vögeln mit Federn bedeckt. Vogelmerkmal.") },
  { id: "wing", label: tx("wings with flight feathers", "Flügel mit Schwungfedern"), at: [244, 66], info: tx("Wings with long flight feathers: Archaeopteryx could at least glide. Bird feature.", "Flügel mit langen Schwungfedern: Archaeopteryx konnte zumindest gleiten. Vogelmerkmal.") },
  { id: "wishbone", label: tx("wishbone", "Gabelbein"), at: [313, 199], tag: [356, 232], info: tx("The wishbone (fused collarbones) is typical of birds. Bird feature.", "Das Gabelbein (verwachsene Schlüsselbeine) ist typisch für Vögel. Vogelmerkmal.") },
  { id: "teeth", label: tx("teeth in the jaws", "Zähne im Kiefer"), at: [402, 121], tag: [452, 150], info: tx("Pointed teeth in the jaws instead of a horny beak. Reptile feature.", "Spitze Zähne im Kiefer statt eines Hornschnabels. Reptilienmerkmal.") },
  { id: "claws", label: tx("clawed fingers on the wings", "Finger mit Krallen am Flügel"), at: [339, 72], tag: [380, 50], info: tx("Three free fingers with claws on each wing. Reptile feature.", "Drei freie Finger mit Krallen an jedem Flügel. Reptilienmerkmal.") },
  { id: "tail", label: tx("long tail with many vertebrae", "lange Schwanzwirbelsäule"), at: [92, 229], tag: [74, 278], info: tx("A long tail with many vertebrae. Birds today only have a short tail bone. Reptile feature.", "Ein langer Schwanz mit vielen Wirbeln. Heutige Vögel haben nur einen kurzen Steiß. Reptilienmerkmal.") },
];

const OUT = "var(--bio-outline)";
const BONE = "var(--bio-bone)";
const PLUME = "color-mix(in oklab, var(--bio-wood) 55%, var(--bio-bone))";
const WING = "color-mix(in oklab, var(--bio-wood) 72%, var(--bio-bone))";
const VANE = "color-mix(in oklab, var(--bio-wood-deep) 70%, transparent)";

/** A point on the tail curve (quadratic Bézier from the body to the tip). */
function tailAt(t: number): [number, number, number] {
  const [x0, y0, x1, y1, x2, y2] = [214, 200, 130, 228, 36, 232];
  const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
  const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
  const dx = 2 * (1 - t) * (x1 - x0) + 2 * t * (x2 - x1);
  const dy = 2 * (1 - t) * (y1 - y0) + 2 * t * (y2 - y1);
  return [x, y, (Math.atan2(dy, dx) * 180) / Math.PI];
}

const TIPS: [number, number][] = [
  [296, 18],
  [266, 13],
  [236, 20],
  [208, 32],
  [188, 52],
  [173, 77],
  [171, 104],
  [184, 128],
  [204, 145],
];

function Leg({ dx = 0, far = false }: { dx?: number; far?: boolean }) {
  const o = far ? 0.75 : 1;
  return (
    <g transform={`translate(${dx} 0)`} opacity={o}>
      <path d="M258 202 Q286 210 280 240 Q270 252 256 246 Q248 222 258 202 Z" fill={PLUME} stroke={OUT} strokeWidth={1.6} />
      <path d="M262 244 L276 284 L286 300" fill="none" stroke={OUT} strokeWidth={4.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M262 244 L276 284 L286 300" fill="none" stroke="var(--bio-flesh)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {[
        "M286 300 L310 302",
        "M286 300 L306 309",
        "M286 300 L299 314",
        "M284 299 L268 305",
      ].map((d, i) => (
        <path key={i} d={d} stroke={OUT} strokeWidth={2.2} strokeLinecap="round" />
      ))}
      {[
        "M310 302 q4 1 3 5",
        "M306 309 q4 2 2 5",
        "M299 314 q3 2 0 5",
        "M268 305 q-4 1 -3 5",
      ].map((d, i) => (
        <path key={i} d={d} fill="none" stroke={OUT} strokeWidth={1.8} strokeLinecap="round" />
      ))}
    </g>
  );
}

export function ArchaeopteryxFigure({ mode = "names", show, ask, highlight, legend, selected, onSelect }: DrawingProps & { selected?: string | null; onSelect?: (id: string | null) => void }) {
  const tailFeathers = Array.from({ length: 11 }, (_, i) => tailAt(0.12 + i * 0.085));
  const vertebrae = Array.from({ length: 18 }, (_, i) => tailAt(0.02 + i * 0.056));
  const bases = TIPS.map((_, i) => {
    const t = i / (TIPS.length - 1);
    return [314 - 24 * t, 82 + 68 * t] as [number, number];
  });
  return (
    <Figure
      title={tx("Archaeopteryx, the primeval bird", "Archaeopteryx, der Urvogel")}
      width={520}
      height={330}
      parts={PARTS}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
      selected={selected}
      onSelect={onSelect}
    >
      {/* far leg behind the body */}
      <Leg dx={-16} far />
      {/* tail: feathers on both sides, the bony tail on top */}
      <g data-part="feathers">
        {tailFeathers.map(([x, y, a], i) => (
          <g key={i}>
            <ellipse cx={x - 12} cy={y - 13} rx={20} ry={6} transform={`rotate(${a + 40} ${x} ${y})`} fill={PLUME} stroke={OUT} strokeWidth={1.2} />
            <ellipse cx={x - 12} cy={y + 13} rx={20} ry={6} transform={`rotate(${a - 40} ${x} ${y})`} fill={PLUME} stroke={OUT} strokeWidth={1.2} />
          </g>
        ))}
        {/* body plumage */}
        <ellipse cx={268} cy={188} rx={58} ry={39} transform="rotate(-12 268 188)" fill={PLUME} stroke={OUT} strokeWidth={1.8} />
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M${232 + i * 13} ${200 - i * 3} q6 7 12 0`} fill="none" stroke={VANE} strokeWidth={1.2} />
        ))}
        {/* neck */}
        <path d="M298 178 Q316 150 342 124 L360 134 Q338 160 324 190 Z" fill={PLUME} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <g data-part="tail">
        {vertebrae.map(([x, y, a], i) => (
          <rect key={i} x={x - 4.2} y={y - 3.2} width={8.4} height={6.4} rx={2.4} transform={`rotate(${a} ${x} ${y})`} fill={BONE} stroke={OUT} strokeWidth={1.1} />
        ))}
      </g>
      {/* wishbone seen through the chest */}
      <g data-part="wishbone">
        <ellipse cx={313} cy={192} rx={19} ry={21} fill="color-mix(in oklab, var(--bio-bone) 60%, transparent)" stroke="var(--ink-3)" strokeWidth={1.1} strokeDasharray="3 2.5" />
        <path d="M301 176 Q305 196 313 205 Q321 196 325 176" fill="none" stroke={OUT} strokeWidth={5.4} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M301 176 Q305 196 313 205 Q321 196 325 176" fill="none" stroke={BONE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* near wing */}
      <g data-part="wing">
        <path
          d="M296 160 L318 76 Q321 52 312 26 Q298 12 282 14 Q266 9 250 16 Q232 18 220 26 Q204 31 196 42 Q184 50 180 62 Q170 72 172 88 Q168 100 176 112 Q180 124 190 134 Q200 146 214 150 Q244 164 296 160 Z"
          fill={WING}
          stroke={OUT}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
        {TIPS.map(([x, y], i) => (
          <line key={i} x1={bases[i][0]} y1={bases[i][1]} x2={x} y2={y} stroke={VANE} strokeWidth={1.3} />
        ))}
        <path d="M300 152 Q306 112 316 80" fill="none" stroke={VANE} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* clawed fingers at the front of the wing */}
      <g data-part="claws">
        {[
          ["M316 76 L333 62", "M333 62 q6 -1 6 6"],
          ["M314 84 L337 77", "M337 77 q6 1 4 7"],
          ["M311 92 L333 93", "M333 93 q5 3 1 8"],
        ].map(([finger, claw], i) => (
          <g key={i}>
            <path d={finger} stroke={OUT} strokeWidth={4.4} strokeLinecap="round" />
            <path d={finger} stroke="var(--bio-flesh)" strokeWidth={2.2} strokeLinecap="round" />
            <path d={claw} fill="none" stroke={OUT} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        ))}
      </g>
      {/* head with toothed jaws */}
      <path d="M342 126 Q344 104 370 102 Q394 101 424 110 Q429 113 424 117 L384 117 Q364 120 352 134 Z" fill={PLUME} stroke={OUT} strokeWidth={1.7} strokeLinejoin="round" />
      <path d="M352 134 Q368 128 386 127 L418 124 Q422 127 417 130 L384 133 Q366 136 356 140 Z" fill={PLUME} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={369} cy={110} r={4.2} fill={OUT} />
      <circle cx={370.4} cy={108.8} r={1.2} fill="var(--raised)" />
      <ellipse cx={413} cy={111} rx={2.6} ry={1.4} fill={OUT} />
      <g data-part="teeth">
        {[388, 395, 402, 409, 416].map((x) => (
          <path key={`u${x}`} d={`M${x} 117 L${x + 4} 117 L${x + 2} 122.5 Z`} fill={BONE} stroke={OUT} strokeWidth={0.9} strokeLinejoin="round" />
        ))}
        {[391, 398, 405, 412].map((x) => (
          <path key={`l${x}`} d={`M${x} ${127.4 - (x - 391) * 0.08} L${x + 4} ${127.2 - (x - 391) * 0.08} L${x + 2} 122 Z`} fill={BONE} stroke={OUT} strokeWidth={0.9} strokeLinejoin="round" />
        ))}
      </g>
      {/* near leg in front */}
      <Leg />
    </Figure>
  );
}

const GROUPS = [
  { id: "all", label: tx("All features", "Alle Merkmale"), parts: [] as ArchFeature[], text: tx("Features of two groups in one animal: Archaeopteryx is a transitional form between reptiles and birds.", "Merkmale zweier Gruppen in einem Tier: Archaeopteryx ist eine Übergangsform zwischen Reptilien und Vögeln.") },
  { id: "bird", label: tx("Bird features", "Vogelmerkmale"), parts: ARCH_FEATURES.filter((f) => f.bird).map((f) => f.id), text: tx("Like a bird: feathers, wings with flight feathers and a wishbone.", "Wie ein Vogel: Federn, Flügel mit Schwungfedern und ein Gabelbein.") },
  { id: "reptile", label: tx("Reptile features", "Reptilienmerkmale"), parts: ARCH_FEATURES.filter((f) => !f.bird).map((f) => f.id), text: tx("Like a reptile: teeth in the jaws, free fingers with claws and a long tail with many vertebrae.", "Wie ein Reptil: Zähne im Kiefer, freie Finger mit Krallen und eine lange Schwanzwirbelsäule.") },
];

/** Lesson widget: tap the features, or light up all bird or all reptile features at once. */
export function EvolutionArchaeopteryx() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [group, setGroup] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const g = GROUPS.find((x) => x.id === group)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Show features", "Merkmale zeigen"))}>
        {GROUPS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={group === x.id}
            onClick={() => {
              setGroup(x.id);
              setSelected(null);
            }}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", group === x.id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {group === x.id && <motion.span layoutId={`${scope}-g`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(x.label)}</span>
          </button>
        ))}
      </div>
      <ArchaeopteryxFigure mode="explore" highlight={g.parts} selected={selected} onSelect={setSelected} />
      <motion.p key={group} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-blob-soft px-4 py-2.5 text-[14.5px] leading-relaxed text-ink">
        {t(g.text)}
      </motion.p>
    </div>
  );
}
