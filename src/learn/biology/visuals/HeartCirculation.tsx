"use client";

// The double circulation as a school diagram: lungs on top, the heart in the middle (its right
// half on the LEFT of the picture), the body's organs below. Blood flows as small cells along
// the vessels; it turns oxygen-rich in the lung capillaries and oxygen-poor in the body's.
//   HeartCirculation           the labelled diagram (lesson pictures and tasks)
//   HeartCirculationWidget     step a blood cell once round both circuits (level 2)
//   HeartTransportWidget       what the blood carries from where to where (level 1)

import { animate, useAnimationFrame, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { bloodMix, Chip, joinPolys, MainButton, pointAt, polyLength, polyPath, SoftButton, svgText, type Pt } from "./HeartShared";

const W = 480;
const H = 492;

// ---------------------------------------------------------------------------
// Geometry

const RA_C: Pt = [200, 231];
const RV_C: Pt = [200, 293];
const LA_C: Pt = [284, 231];
const LV_C: Pt = [284, 293];
const BEDS = { gut: 150, muscle: 250, skin: 350 } as const;
type Bed = keyof typeof BEDS;
const LUNG_Y = [52, 68, 84, 100];
const LUNG_MAIN = 1;
const ART_Y = 390;
const VEIN_Y = 470;
const BED_TOP = 404;
const BED_BOTTOM = 454;

/** A wavy capillary from x0 to x1 at height y (sampled as a polyline). */
function wavy(x0: number, x1: number, y: number, amp = 4, waves = 3): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 36; i++) {
    const f = i / 36;
    pts.push([x0 + (x1 - x0) * f, y + Math.sin(f * Math.PI * 2 * waves) * amp * Math.sin(f * Math.PI)]);
  }
  return pts;
}
function wavyV(x: number, y0: number, y1: number, amp = 4, waves = 2): Pt[] {
  return wavy(y0, y1, x, amp, waves).map(([a, b]) => [b, a] as Pt);
}

const SEG = {
  heartR: [RA_C, [200, 262], RV_C] as Pt[],
  pa: [RV_C, [220, 274], [234, 254], [234, 150], [164, 150], [164, 112], [164, LUNG_Y[LUNG_MAIN]]] as Pt[],
  lung: wavy(164, 296, LUNG_Y[LUNG_MAIN]),
  pv: [[296, LUNG_Y[LUNG_MAIN]], [296, 112], [296, 212], LA_C] as Pt[],
  heartL: [LA_C, [284, 262], LV_C] as Pt[],
  aorta: [LV_C, [266, 274], [252, 254], [252, 168], [258, 154], [274, 148], [406, 148], [420, 162], [420, ART_Y]] as Pt[],
  art: (bed: Bed): Pt[] => [[420, ART_Y], [BEDS[bed], ART_Y], [BEDS[bed], BED_TOP]],
  bed: (bed: Bed): Pt[] => wavyV(BEDS[bed], BED_TOP, BED_BOTTOM, 3, 2),
  vein: (bed: Bed): Pt[] => [[BEDS[bed], BED_BOTTOM], [BEDS[bed], VEIN_Y], [92, VEIN_Y]],
  vc: [[92, VEIN_Y], [92, 231], [178, 231], RA_C] as Pt[],
};

/** How oxygen-rich the blood is along each piece (start → end). */
type Piece = { pts: Pt[]; from: number; to: number };
const piece = (pts: Pt[], from: number, to = from): Piece => ({ pts, from, to });

/** A route through the circulation, with the oxygen state along it. */
type Route = { pts: Pt[]; len: number; marks: { s: number; from: number; to: number; len: number }[] };
function route(...pieces: Piece[]): Route {
  const pts = joinPolys(...pieces.map((p) => p.pts));
  let s = 0;
  const marks = pieces.map((p) => {
    const len = polyLength(p.pts);
    const m = { s, from: p.from, to: p.to, len };
    s += len;
    return m;
  });
  return { pts, len: polyLength(pts), marks };
}
function richAt(r: Route, s: number) {
  const m = [...r.marks].reverse().find((k) => s >= k.s) ?? r.marks[0];
  const f = m.len ? Math.min(1, Math.max(0, (s - m.s) / m.len)) : 0;
  return m.from + (m.to - m.from) * f;
}

/** Once round both circuits, through the muscle. Starts in the right atrium. */
const LOOP = route(
  piece(SEG.heartR, 0),
  piece(SEG.pa, 0),
  piece(SEG.lung, 0, 1),
  piece(SEG.pv, 1),
  piece(SEG.heartL, 1),
  piece(SEG.aorta, 1),
  piece(SEG.art("muscle"), 1),
  piece(SEG.bed("muscle"), 1, 0),
  piece(SEG.vein("muscle"), 0),
  piece(SEG.vc, 0),
);
/** Side streams for the flowing dots. */
const SIDE: Route[] = [
  ...LUNG_Y.filter((_, i) => i !== LUNG_MAIN).map((y) => route(piece([[164, y], ...wavy(164, 296, y), [296, y]], 0, 1))),
  route(piece([[250, ART_Y], [150, ART_Y], [150, BED_TOP]], 1), piece(SEG.bed("gut"), 1, 0), piece([[150, BED_BOTTOM], [150, VEIN_Y]], 0)),
  route(piece([[420, ART_Y], [350, ART_Y], [350, BED_TOP]], 1), piece(SEG.bed("skin"), 1, 0), piece([[350, BED_BOTTOM], [350, VEIN_Y], [250, VEIN_Y]], 0)),
];

const segStart = (pieces: Pt[][]) => pieces.reduce((s, p) => s + polyLength(p), 0);

/** A scalloped outline (lung tissue made of many alveoli). */
function scallop(cx: number, cy: number, rx: number, ry: number, n: number) {
  const at = (k: number, f = 1): Pt => [cx + rx * f * Math.cos((k / n) * Math.PI * 2), cy + ry * f * Math.sin((k / n) * Math.PI * 2)];
  let d = `M${at(0).map((v) => v.toFixed(1)).join(" ")}`;
  for (let i = 0; i < n; i++) {
    const c = at(i + 0.5, 1.13);
    const e = at(i + 1);
    d += ` Q${c[0].toFixed(1)} ${c[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
  }
  return `${d} Z`;
}
const LUNG_OUTLINE = scallop(230, 76, 112, 46, 24);

// ---------------------------------------------------------------------------
// Drawing

function Tube({ pts, color, w = 12 }: { pts: Pt[]; color: string; w?: number }) {
  const d = polyPath(pts);
  return (
    <>
      <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 3.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

const LOW = "var(--bio-blood-low)";
const HIGH = "var(--bio-blood)";

/** Small chevrons that show the direction of flow (always shown; the moving cells come on top). */
function Chevron({ at, dir }: { at: Pt; dir: "up" | "down" | "left" | "right" }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return <path d="M-3.5 -4.5 L2.5 0 L-3.5 4.5" transform={`translate(${at[0]} ${at[1]}) rotate(${rot})`} fill="none" stroke="var(--bio-bone)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />;
}

function CirculationArt({ gradId, variant }: { gradId: string; variant: "full" | "organs" }) {
  const full = variant === "full";
  /** The data-part attribute for a structure, if the variant labels it (parts must not be nested). */
  const dp = (fullId: string | null, organId: string | null) => {
    const id = full ? fullId : organId;
    return id ? { "data-part": id } : {};
  };
  return (
    <g>
      <defs>
        <linearGradient id={`${gradId}-lung`} x1="164" y1="0" x2="296" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0.1" style={{ stopColor: LOW }} />
          <stop offset="0.9" style={{ stopColor: HIGH }} />
        </linearGradient>
        <linearGradient id={`${gradId}-body`} x1="0" y1={BED_TOP} x2="0" y2={BED_BOTTOM} gradientUnits="userSpaceOnUse">
          <stop offset="0.1" style={{ stopColor: HIGH }} />
          <stop offset="0.9" style={{ stopColor: LOW }} />
        </linearGradient>
      </defs>

      {/* Lungs */}
      <g {...dp("lungs", "lungs")}>
        <path d={LUNG_OUTLINE} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={2} strokeLinejoin="round" />
        {LUNG_Y.map((y) => (
          <path key={y} d={polyPath(wavy(164, 296, y))} fill="none" stroke={`url(#${gradId}-lung)`} strokeWidth={5} strokeLinecap="round" />
        ))}
        <path d={`M164 ${LUNG_Y[0]} L164 112`} stroke={LOW} strokeWidth={6} strokeLinecap="round" />
        <path d={`M296 ${LUNG_Y[0]} L296 112`} stroke={HIGH} strokeWidth={6} strokeLinecap="round" />
      </g>

      {/* Body organs (capillary beds in parallel) */}
      {(Object.keys(BEDS) as Bed[]).map((b) => (
        <g key={b} {...dp("body", b)}>
          <g>
            <rect x={BEDS[b] - 40} y={BED_TOP - 8} width={80} height={BED_BOTTOM - BED_TOP + 16} rx={16} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={2} />
            {b === "muscle" && [0, 1, 2, 3].map((i) => <path key={i} d={`M${BEDS[b] - 34} ${BED_TOP - 2 + i * 15} L${BEDS[b] + 34} ${BED_TOP - 2 + i * 15}`} stroke="var(--bio-flesh-deep)" strokeWidth={1} opacity={0.5} />)}
            {b === "gut" && <path d={`M${BEDS[b] - 34} ${BED_TOP + 2} q 6 -8 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0`} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} opacity={0.6} />}
            {b === "skin" && <path d={`M${BEDS[b] - 34} ${BED_BOTTOM + 2} L${BEDS[b] + 34} ${BED_BOTTOM + 2}`} stroke="var(--bio-flesh-deep)" strokeWidth={4} opacity={0.45} />}
            {[-20, 0, 20].map((dx) => (
              <path key={dx} d={polyPath(wavyV(BEDS[b] + dx, BED_TOP, BED_BOTTOM, 3, 2))} fill="none" stroke={`url(#${gradId}-body)`} strokeWidth={5} strokeLinecap="round" />
            ))}
            <path d={`M${BEDS[b] - 20} ${BED_TOP} L${BEDS[b] + 20} ${BED_TOP}`} stroke={HIGH} strokeWidth={6} strokeLinecap="round" />
            <path d={`M${BEDS[b] - 20} ${BED_BOTTOM} L${BEDS[b] + 20} ${BED_BOTTOM}`} stroke={LOW} strokeWidth={6} strokeLinecap="round" />
          </g>
        </g>
      ))}

      {/* Veins and pulmonary artery (oxygen-poor) */}
      <g {...dp("vc", "vein")}>
        <g>
          <Tube pts={[[350, VEIN_Y], [92, VEIN_Y], [92, 231], [180, 231]]} color={LOW} />
          {(Object.keys(BEDS) as Bed[]).map((b) => (
            <Tube key={b} pts={[[BEDS[b], BED_BOTTOM + 2], [BEDS[b], VEIN_Y]]} color={LOW} w={8} />
          ))}
        </g>
      </g>
      <g {...dp("pv", null)}>
        <Tube pts={[[296, 112], [296, 214]]} color={HIGH} />
      </g>

      {/* Heart */}
      <g {...dp(null, "heart")}>
        <path d="M168 214 C168 199 182 194 198 196 L296 196 C314 194 326 202 326 218 L326 292 C326 328 302 346 272 348 C246 350 226 344 208 337 C184 328 166 314 166 290 Z" fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2.2} />
        <g {...dp("ra", null)}>
          <rect x={178} y={206} width={44} height={50} rx={12} fill={LOW} />
        </g>
        <g {...dp("rv", null)}>
          <rect x={178} y={266} width={44} height={56} rx={14} fill={LOW} />
        </g>
        <g {...dp("la", null)}>
          <rect x={262} y={206} width={44} height={50} rx={12} fill={HIGH} />
        </g>
        <g {...dp("lv", null)}>
          <rect x={266} y={270} width={36} height={50} rx={14} fill={HIGH} />
        </g>
        {/* AV valves and semilunar valves */}
        <g stroke="var(--bio-bone)" strokeWidth={3.2} strokeLinecap="round">
          <path d="M186 262 L198 268 M214 262 L202 268" />
          <path d="M270 262 L282 268 M298 262 L286 268" />
        </g>
      </g>

      <g {...dp("pa", null)}>
        <Tube pts={[[212, 276], [234, 254], [234, 150], [164, 150], [164, 112]]} color={LOW} />
      </g>

      {/* Aorta on top (crosses the pulmonary veins) */}
      <g {...dp("aorta", "artery")}>
        <g>
          <Tube pts={[[266, 276], [252, 256], [252, 168], [258, 154], [274, 148], [406, 148], [420, 162], [420, ART_Y], [150, ART_Y]]} color={HIGH} />
          {(Object.keys(BEDS) as Bed[]).map((b) => (
            <Tube key={b} pts={[[BEDS[b], ART_Y], [BEDS[b], BED_TOP - 2]]} color={HIGH} w={8} />
          ))}
        </g>
      </g>
      <g stroke="var(--bio-bone)" strokeWidth={3} strokeLinecap="round">
        <path d="M229 258 L234 264 M239 258 L234 264" />
        <path d="M247 260 L252 266 M257 260 L252 266" />
      </g>

      {/* Direction of flow */}
      <Chevron at={[234, 196]} dir="up" />
      <Chevron at={[198, 150]} dir="left" />
      <Chevron at={[296, 128]} dir="down" />
      <Chevron at={[340, 148]} dir="right" />
      <Chevron at={[420, 270]} dir="down" />
      <Chevron at={[300, ART_Y]} dir="left" />
      <Chevron at={[200, VEIN_Y]} dir="left" />
      <Chevron at={[92, 350]} dir="up" />
    </g>
  );
}

/** Blood cells streaming along all vessels. Only this layer re-renders every frame. */
function FlowDots({ playing }: { playing: boolean }) {
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0);
  useAnimationFrame((_, delta) => {
    if (reduce || !playing) return;
    setTime((t) => t + Math.min(delta, 50) / 1000);
  });
  if (reduce) return null;
  const speed = 46;
  const gap = 24;
  const dots: { p: Pt; rich: number; k: string }[] = [];
  for (const [ri, r] of [LOOP, ...SIDE].entries()) {
    const n = Math.floor(r.len / gap);
    for (let i = 0; i < n; i++) {
      const s = (i * gap + time * speed) % r.len;
      dots.push({ p: pointAt(r.pts, s), rich: richAt(r, s), k: `${ri}-${i}` });
    }
  }
  return (
    <g pointerEvents="none">
      {dots.map((d) => (
        <ellipse key={d.k} cx={d.p[0]} cy={d.p[1]} rx={3.2} ry={2.4} fill={bloodMix(d.rich)} stroke="var(--bio-bone)" strokeWidth={1.1} />
      ))}
    </g>
  );
}

const FULL_PARTS: FigurePart[] = [
  { id: "ra", label: tx("right atrium", "rechter Vorhof"), at: [200, 231] },
  { id: "rv", label: tx("right ventricle", "rechte Herzkammer"), at: [200, 296] },
  { id: "pa", label: tx("pulmonary artery", "Lungenarterie"), at: [196, 150] },
  { id: "lungs", label: tx("lung capillaries", "Lungenkapillaren"), at: [230, 76], tag: [112, 40] },
  { id: "pv", label: tx("pulmonary veins", "Lungenvenen"), at: [296, 184], tag: [348, 196] },
  { id: "la", label: tx("left atrium", "linker Vorhof"), at: [284, 231] },
  { id: "lv", label: tx("left ventricle", "linke Herzkammer"), at: [284, 296] },
  { id: "aorta", label: tx("aorta", "Aorta"), at: [420, 250] },
  { id: "body", label: tx("body capillaries (organs)", "Körperkapillaren (Organe)"), at: [250, 429], tag: [454, 430] },
  { id: "vc", label: tx("venae cavae", "Hohlvenen"), at: [92, 340] },
];

const ORGAN_PARTS: FigurePart[] = [
  { id: "lungs", label: tx("lungs", "Lunge"), at: [230, 76], tag: [112, 40] },
  { id: "heart", label: tx("heart", "Herz"), at: [242, 330], tag: [356, 300] },
  { id: "artery", label: tx("artery (away from the heart)", "Arterie (vom Herzen weg)"), at: [420, 250] },
  { id: "vein", label: tx("vein (to the heart)", "Vene (zum Herzen hin)"), at: [92, 340] },
  { id: "gut", label: tx("intestine", "Darm"), at: [150, 429], tag: [112, 488] },
  { id: "muscle", label: tx("muscle", "Muskel"), at: [250, 429], tag: [250, 488] },
  { id: "skin", label: tx("skin", "Haut"), at: [350, 429], tag: [388, 488] },
];

export type CirculationProps = DrawingProps & {
  /** "full": chambers and vessels (level 2); "organs": organs, artery and vein (level 1). */
  variant?: "full" | "organs";
  /** Blood cells stream along the vessels. */
  flow?: boolean;
  children?: ReactNode;
};

/** The double circulation as a labelled diagram. */
export function HeartCirculation({ mode = "names", show, ask, highlight, legend, variant = "full", flow = false, children }: CirculationProps) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <Figure
      title={variant === "full" ? tx("The double circulation (heart seen from the front)", "Der doppelte Blutkreislauf (Herz von vorn gesehen)") : tx("Blood transports substances through the body", "Das Blut transportiert Stoffe durch den Körper")}
      width={W}
      height={variant === "organs" ? 500 : H}
      parts={variant === "full" ? FULL_PARTS : ORGAN_PARTS}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <CirculationArt gradId={gid} variant={variant} />
      {flow && <FlowDots playing />}
      {children}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Level 2: step once round both circuits

type Station = { at: number; part: string; title: Text; text: Text };
const cum = (...segs: Pt[][]) => segStart(segs);
const STATIONS: Station[] = [
  {
    at: 0,
    part: "ra",
    title: tx("Right atrium", "Rechter Vorhof"),
    text: tx("Oxygen-poor blood from the body arrives through the venae cavae.", "Sauerstoffarmes Blut aus dem Körper kommt über die Hohlvenen an."),
  },
  {
    at: cum(SEG.heartR),
    part: "rv",
    title: tx("Right ventricle", "Rechte Herzkammer"),
    text: tx("Through the atrioventricular valve into the right ventricle.", "Durch die Segelklappe in die rechte Herzkammer."),
  },
  {
    at: cum(SEG.heartR) + 88,
    part: "pa",
    title: tx("Pulmonary artery", "Lungenarterie"),
    text: tx("Pumped through the semilunar valve into the pulmonary artery. An artery, yet the blood is oxygen-poor!", "Durch die Taschenklappe in die Lungenarterie gepumpt. Eine Arterie, und trotzdem ist das Blut sauerstoffarm!"),
  },
  {
    at: cum(SEG.heartR, SEG.pa) + polyLength(SEG.lung) * 0.5,
    part: "lungs",
    title: tx("Lung capillaries", "Lungenkapillaren"),
    text: tx("Gas exchange: carbon dioxide leaves the blood, oxygen enters. Now the blood is oxygen-rich.", "Gasaustausch: Kohlenstoffdioxid geht aus dem Blut heraus, Sauerstoff hinein. Jetzt ist das Blut sauerstoffreich."),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung) + 70,
    part: "pv",
    title: tx("Pulmonary veins", "Lungenvenen"),
    text: tx("Back to the heart. Veins, yet the blood is oxygen-rich!", "Zurück zum Herzen. Venen, und trotzdem ist das Blut sauerstoffreich!"),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung, SEG.pv),
    part: "la",
    title: tx("Left atrium", "Linker Vorhof"),
    text: tx("The pulmonary circulation is complete. The blood is back in the heart, now in the left half.", "Der Lungenkreislauf ist geschafft. Das Blut ist wieder im Herzen, jetzt in der linken Hälfte."),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung, SEG.pv, SEG.heartL),
    part: "lv",
    title: tx("Left ventricle", "Linke Herzkammer"),
    text: tx("Through the atrioventricular valve into the left ventricle. Its wall is the thickest: it pumps blood through the whole body.", "Durch die Segelklappe in die linke Herzkammer. Ihre Wand ist am dicksten: Sie pumpt das Blut durch den ganzen Körper."),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung, SEG.pv, SEG.heartL) + 300,
    part: "aorta",
    title: tx("Aorta", "Aorta"),
    text: tx("Through the semilunar valve into the aorta, the main artery. It branches into ever smaller arteries.", "Durch die Taschenklappe in die Aorta, die Hauptschlagader. Sie verzweigt sich in immer kleinere Arterien."),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung, SEG.pv, SEG.heartL, SEG.aorta, SEG.art("muscle")) + polyLength(SEG.bed("muscle")) * 0.5,
    part: "body",
    title: tx("Body capillaries", "Körperkapillaren"),
    text: tx("In the organs the blood gives oxygen and nutrients to the cells and takes up carbon dioxide. Now it is oxygen-poor.", "In den Organen gibt das Blut Sauerstoff und Nährstoffe an die Zellen ab und nimmt Kohlenstoffdioxid auf. Jetzt ist es sauerstoffarm."),
  },
  {
    at: cum(SEG.heartR, SEG.pa, SEG.lung, SEG.pv, SEG.heartL, SEG.aorta, SEG.art("muscle"), SEG.bed("muscle"), SEG.vein("muscle")) + 120,
    part: "vc",
    title: tx("Venae cavae", "Hohlvenen"),
    text: tx("Veins carry the blood back to the right atrium. One round takes about one minute at rest.", "Venen bringen das Blut zurück zum rechten Vorhof. Eine Runde dauert in Ruhe etwa eine Minute."),
  },
];

/** The blood cell you follow: a red blood cell coloured by its oxygen. */
function Drop({ s }: { s: number }) {
  const p = pointAt(LOOP.pts, s);
  return (
    <g pointerEvents="none">
      <circle cx={p[0]} cy={p[1]} r={13} fill="none" stroke="var(--blob)" strokeWidth={2.5} opacity={0.8} />
      <ellipse cx={p[0]} cy={p[1]} rx={8} ry={6.5} fill={bloodMix(richAt(LOOP, s))} stroke="var(--bio-outline)" strokeWidth={1.6} />
      <ellipse cx={p[0]} cy={p[1]} rx={3.5} ry={2.6} fill="var(--bio-bone)" opacity={0.35} />
    </g>
  );
}

export function HeartCirculationWidget() {
  const t = useText();
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [s, setS] = useState(0);
  const [loop, setLoop] = useState<"none" | "lung" | "body">("none");
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const go = (next: number) => {
    const target = ((next % STATIONS.length) + STATIONS.length) % STATIONS.length;
    ctrl.current?.stop();
    const from = s;
    let to = STATIONS[target].at;
    if (target === 0 && step === STATIONS.length - 1) to = LOOP.len; // finish the round
    setStep(target);
    if (reduce || to < from) {
      setS(STATIONS[target].at);
      return;
    }
    ctrl.current = animate(from, to, {
      duration: Math.min(2.2, 0.5 + (to - from) / 260),
      ease: "easeInOut",
      onUpdate: setS,
      onComplete: () => setS(STATIONS[target].at),
    });
  };
  const st = STATIONS[step];
  const loopParts = loop === "lung" ? ["pa", "lungs", "pv"] : loop === "body" ? ["aorta", "body", "vc"] : [];
  const rich = richAt(LOOP, s);

  return (
    <div className="space-y-4">
      <Figure title={tx("The double circulation (heart seen from the front)", "Der doppelte Blutkreislauf (Herz von vorn gesehen)")} width={W} height={H} parts={FULL_PARTS} mode="names" highlight={loopParts.length ? loopParts : [st.part]}>
        <CirculationArt gradId={gid} variant="full" />
        <FlowDots playing />
        <Drop s={s} />
      </Figure>
      <div className="flex flex-wrap items-center gap-2">
        <SoftButton onClick={() => go(step - 1)} label={t(tx("Back", "Zurück"))} disabled={step === 0}>
          <ChevronLeft className="size-4" />
        </SoftButton>
        <MainButton onClick={() => go(step + 1)}>
          {step === STATIONS.length - 1 ? <RotateCcw className="size-4" /> : <ChevronRight className="size-4" />}
          {step === STATIONS.length - 1 ? t(tx("Next round", "Nächste Runde")) : t(tx("Follow the blood", "Dem Blut folgen"))}
        </MainButton>
        <span className="ml-auto flex flex-wrap gap-2">
          <Chip on={loop === "lung"} onClick={() => setLoop(loop === "lung" ? "none" : "lung")}>
            {t(tx("Pulmonary circulation", "Lungenkreislauf"))}
          </Chip>
          <Chip on={loop === "body"} onClick={() => setLoop(loop === "body" ? "none" : "body")}>
            {t(tx("Systemic circulation", "Körperkreislauf"))}
          </Chip>
        </span>
      </div>
      <div className="rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob text-[12px] font-bold text-white">{step + 1}</span>
          <span className="font-semibold text-ink">{t(st.title)}</span>
          <span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold text-white")} style={{ background: bloodMix(rich) }}>
            {rich > 0.5 ? t(tx("oxygen-rich", "sauerstoffreich")) : t(tx("oxygen-poor", "sauerstoffarm"))}
          </span>
        </div>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{t(st.text)}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 1: what does the blood carry?

type Cargo = "o2" | "food" | "co2" | "heat";
const CARGO: Record<Cargo, { name: Text; from: string; to: string; route: Route; text: Text }> = {
  o2: {
    name: tx("Oxygen", "Sauerstoff"),
    from: "lungs",
    to: "muscle",
    route: route(piece(SEG.lung.slice(18), 0.5, 1), piece(SEG.pv, 1), piece(SEG.heartL, 1), piece(SEG.aorta, 1), piece(SEG.art("muscle"), 1), piece(SEG.bed("muscle").slice(0, 18), 1, 0.5)),
    text: tx("In the lungs the blood takes up oxygen. The heart pumps it through the arteries to all body cells, for example into the muscles.", "In der Lunge nimmt das Blut Sauerstoff auf. Das Herz pumpt es durch die Arterien zu allen Körperzellen, zum Beispiel in die Muskeln."),
  },
  food: {
    name: tx("Nutrients", "Nährstoffe"),
    from: "gut",
    to: "muscle",
    route: route(
      piece(SEG.bed("gut").slice(18), 0.5, 0),
      piece(SEG.vein("gut"), 0),
      piece(SEG.vc, 0),
      piece(SEG.heartR, 0),
      piece(SEG.pa, 0),
      piece(SEG.lung, 0, 1),
      piece(SEG.pv, 1),
      piece(SEG.heartL, 1),
      piece(SEG.aorta, 1),
      piece(SEG.art("muscle"), 1),
      piece(SEG.bed("muscle").slice(0, 18), 1, 0.5),
    ),
    text: tx("In the intestine nutrients such as glucose pass into the blood. The blood brings them to every cell: the cells get energy and building materials.", "Im Darm gehen Nährstoffe wie Traubenzucker ins Blut über. Das Blut bringt sie zu jeder Zelle: Die Zellen bekommen Energie und Baustoffe."),
  },
  co2: {
    name: tx("Carbon dioxide", "Kohlenstoffdioxid"),
    from: "muscle",
    to: "lungs",
    route: route(piece(SEG.bed("muscle").slice(18), 0.5, 0), piece(SEG.vein("muscle"), 0), piece(SEG.vc, 0), piece(SEG.heartR, 0), piece(SEG.pa, 0), piece(SEG.lung.slice(0, 19), 0, 0.5)),
    text: tx("Working cells produce carbon dioxide. The blood takes it through the veins to the heart and on to the lungs, where you breathe it out.", "Arbeitende Zellen bilden Kohlenstoffdioxid. Das Blut bringt es durch die Venen zum Herzen und weiter zur Lunge. Dort atmest du es aus."),
  },
  heat: {
    name: tx("Heat", "Wärme"),
    from: "muscle",
    to: "skin",
    route: route(
      piece(SEG.bed("muscle").slice(18), 0.5, 0),
      piece(SEG.vein("muscle"), 0),
      piece(SEG.vc, 0),
      piece(SEG.heartR, 0),
      piece(SEG.pa, 0),
      piece(SEG.lung, 0, 1),
      piece(SEG.pv, 1),
      piece(SEG.heartL, 1),
      piece(SEG.aorta, 1),
      piece([[420, ART_Y], [350, ART_Y], [350, BED_TOP]], 1),
      piece(SEG.bed("skin").slice(0, 18), 1, 0.5),
    ),
    text: tx("Working muscles get warm. The blood spreads the heat through the whole body. When you are hot, more blood flows through the skin and gives off heat.", "Arbeitende Muskeln werden warm. Das Blut verteilt die Wärme im ganzen Körper. Ist dir heiß, fließt mehr Blut durch die Haut und gibt Wärme ab."),
  },
};

function CargoToken({ kind, at }: { kind: Cargo; at: Pt }) {
  const [x, y] = at;
  return (
    <g transform={`translate(${x} ${y - 16})`} pointerEvents="none" style={svgText}>
      {kind === "food" ? (
        <path d="M0 -10 L8.7 -5 L8.7 5 L0 10 L-8.7 5 L-8.7 -5 Z" fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.5} />
      ) : kind === "heat" ? (
        <g>
          <circle r={11} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.5} />
          <path d="M-5 4 C-7 0 -3 -2 -5 -6 M0 4 C-2 0 2 -2 0 -6 M5 4 C3 0 7 -2 5 -6" fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <circle r={12} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.5} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={kind === "o2" ? 10 : 8.5} fontWeight={700} fill="var(--ink)">
            {kind === "o2" ? "O₂" : "CO₂"}
          </text>
        </g>
      )}
    </g>
  );
}

export function HeartTransportWidget() {
  const t = useText();
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [f, setF] = useState(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const send = (c: Cargo) => {
    ctrl.current?.stop();
    setCargo(c);
    if (reduce) {
      setF(1);
      return;
    }
    setF(0);
    ctrl.current = animate(0, 1, { duration: 1.2 + CARGO[c].route.len / 420, ease: "easeInOut", onUpdate: setF });
  };
  const C = cargo ? CARGO[cargo] : null;
  const pos = C ? pointAt(C.route.pts, f * C.route.len) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CARGO) as Cargo[]).map((c) => (
          <Chip key={c} on={cargo === c} onClick={() => send(c)}>
            {t(CARGO[c].name)}
          </Chip>
        ))}
      </div>
      <Figure title={tx("Blood transports substances through the body", "Das Blut transportiert Stoffe durch den Körper")} width={W} height={500} parts={ORGAN_PARTS} mode="names" highlight={C ? [C.from, C.to] : undefined}>
        <CirculationArt gradId={gid} variant="organs" />
        <FlowDots playing />
        {C && pos && cargo && (
          <g>
            <ellipse cx={pos[0]} cy={pos[1]} rx={8} ry={6.5} fill={bloodMix(richAt(C.route, f * C.route.len))} stroke="var(--bio-outline)" strokeWidth={1.6} />
            <CargoToken kind={cargo} at={pos} />
          </g>
        )}
      </Figure>
      <div className="min-h-[4.5rem] rounded-xl border border-line bg-surface px-4 py-3 text-[14.5px] leading-relaxed" aria-live="polite">
        {C ? (
          <>
            <span className="font-semibold text-ink">{t(C.name)}: </span>
            <span className="text-ink-2">{t(C.text)}</span>
          </>
        ) : (
          <span className="text-ink-3">{t(tx("Pick something the blood carries and watch where it goes.", "Wähle etwas, das das Blut transportiert, und schau, wohin es geht."))}</span>
        )}
      </div>
    </div>
  );
}
