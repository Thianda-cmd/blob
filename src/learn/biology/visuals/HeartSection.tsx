"use client";

// The heart in a frontal section, as in a school book: we look at the person from the front,
// so the RIGHT half of the heart is on the LEFT of the picture. Oxygen-poor blood (right half,
// venae cavae, pulmonary arteries) in --bio-blood-low, oxygen-rich blood in --bio-blood.
// The left ventricle has the thickest wall. Valves can open and close, chambers can contract,
// so the same drawing serves the labelled figure, the beating heart and the cardiac cycle.

import { useId } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { svgText } from "./HeartShared";

/** Contraction of atria and ventricles (0 relaxed … 1 fully contracted) and how far the valves are open (0 shut … 1 open). */
export type HeartState = { atria: number; ventricles: number; av: number; sl: number };

/** Diastole: everything relaxed, AV valves open, semilunar valves shut. */
export const RELAXED: HeartState = { atria: 0, ventricles: 0, av: 1, sl: 0 };

export const HEART_W = 480;
export const HEART_H = 470;

// ---------------------------------------------------------------------------
// Geometry (viewBox 480 × 470)

const RA = { cx: 155, cy: 200, rx: 54, ry: 50 };
const LA = { cx: 330, cy: 192, rx: 50, ry: 46 };

const VENTRICLES = "M116 242 C108 290 124 344 168 380 C210 414 268 436 314 442 C346 432 378 398 394 346 C406 300 404 262 392 238 Z";
const SEPTUM = "M238 262 C238 302 234 344 226 380 C250 400 280 408 300 410 C280 396 268 344 266 298 C266 274 258 256 248 244 Z";
const RV_CAVITY = "M128 254 C122 296 134 336 168 364 C190 382 212 388 226 380 C234 344 238 302 238 262 L237 236 L209 236 L204 254 Z";
const LV_CAVITY = "M246 238 L276 238 L294 250 L352 250 C372 282 374 338 352 380 C338 406 316 418 300 410 C280 396 268 344 266 298 C266 274 258 254 246 238 Z";
const RA_CAVITY = "M128 256 C112 238 102 212 108 188 C114 162 136 154 156 154 C182 154 200 168 202 196 C204 222 198 240 190 256 Z";
const LA_CAVITY = "M295 254 C284 232 282 208 288 188 C296 162 318 152 338 154 C362 156 374 174 372 198 C370 224 362 242 352 254 Z";
// Where the cavities shrink towards when they contract (for the ventricles the valve plane stays put).
const RV_ORIGIN: [number, number] = [166, 254];
const LV_ORIGIN: [number, number] = [322, 250];
const RA_ORIGIN: [number, number] = [158, 256];
const LA_ORIGIN: [number, number] = [324, 254];

const AORTA = "M261 246 C261 190 250 150 250 106 C250 52 348 36 348 102 L348 176";
const TRUNK = "M223 244 C223 196 258 150 287 120";
const LPA = "M287 120 C322 106 380 101 456 101";
const RPA = "M287 120 C252 102 150 97 26 99";
const SVC = "M139 18 L139 172";
const IVC = "M100 448 C100 330 106 272 126 236";
const PV_UP = "M352 172 C392 168 420 160 458 158";
const PV_LOW = "M360 214 C396 218 424 224 458 226";
const BRANCHES = ["M268 64 L256 20", "M294 52 L294 12", "M320 56 L334 18"];

type Leaflet = { hinge: [number, number]; open: [number, number]; shut: [number, number]; papillary: [number, number] };
const TRICUSPID: Leaflet[] = [
  { hinge: [129, 253], open: [140, 286], shut: [158, 250], papillary: [152, 350] },
  { hinge: [190, 253], open: [180, 286], shut: [161, 250], papillary: [200, 360] },
];
const MITRAL: Leaflet[] = [
  { hinge: [295, 251], open: [303, 284], shut: [322, 247], papillary: [300, 366] },
  { hinge: [352, 251], open: [345, 284], shut: [325, 247], papillary: [348, 346] },
];
/** Semilunar cusps: hinge on the vessel wall, tip when shut (meeting in the middle) and when open (pressed to the wall). */
type Cusp = { hinge: [number, number]; shut: [number, number]; open: [number, number]; ctrlShut: [number, number]; ctrlOpen: [number, number] };
const PULMONARY: Cusp[] = [
  { hinge: [209, 232], shut: [222, 243], open: [214, 212], ctrlShut: [210, 245], ctrlOpen: [210, 222] },
  { hinge: [237, 232], shut: [224, 243], open: [232, 212], ctrlShut: [236, 245], ctrlOpen: [236, 222] },
];
const AORTIC: Cusp[] = [
  { hinge: [247, 234], shut: [260, 245], open: [252, 214], ctrlShut: [248, 247], ctrlOpen: [248, 224] },
  { hinge: [275, 234], shut: [262, 245], open: [270, 214], ctrlShut: [274, 247], ctrlOpen: [274, 224] },
];

/** Outlines to draw on top of the heart (e.g. the excitation spreading). */
export const HEART_OUTLINES = { ventricles: VENTRICLES, ra: RA, la: LA };

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const lerpPt = (a: [number, number], b: [number, number], f: number): [number, number] => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
const scaleAbout = ([ox, oy]: [number, number], sx: number, sy: number) => `translate(${ox} ${oy}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${-ox} ${-oy})`;

/**
 * Squeezes a cavity (a path of absolute coordinates) towards `origin`. `weight(y)` says how much a
 * point moves (0 near the valve plane, so the valves stay attached, up to 1 further away).
 */
function squeeze(d: string, [ox, oy]: [number, number], kx: number, ky: number, weight: (y: number) => number) {
  if (!kx && !ky) return d;
  let pending: number | null = null;
  return d.replace(/-?\d+(\.\d+)?/g, (num) => {
    const n = Number(num);
    if (pending === null) {
      pending = n;
      return "\u0000";
    }
    const x = pending;
    pending = null;
    const w = weight(n);
    const nx = x + (ox - x) * kx * w;
    const ny = n + (oy - n) * ky * w;
    return `${nx.toFixed(1)} ${ny.toFixed(1)}`;
  }).replace(/\u0000\s*/g, "");
}
const below = (y0: number) => (y: number) => Math.max(0, Math.min(1, (y - y0) / 34));
/** The same squeeze for a single point. */
function squeezePt([x, y]: [number, number], [ox, oy]: [number, number], k: number, weight: (y: number) => number): [number, number] {
  const w = weight(y);
  return [x + (ox - x) * k * w, y + (oy - y) * k * w];
}
const above = (y0: number) => (y: number) => Math.max(0, Math.min(1, (y0 - y) / 30));

function Vessel({ d, w, fill }: { d: string; w: number; fill: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 4} strokeLinecap="butt" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="butt" strokeLinejoin="round" />
    </>
  );
}

/** A cut vessel end: the opening shows as a darker ellipse. */
function CutEnd({ x, y, rx, ry, rot = 0, fill }: { x: number; y: number; rx: number; ry: number; rot?: number; fill: string }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} transform={`rotate(${rot} ${x} ${y})`} fill={fill} stroke="var(--bio-outline)" strokeWidth={1.6} style={{ filter: "brightness(0.8)" }} />;
}

function AvLeaflets({ leaflets, open, move }: { leaflets: Leaflet[]; open: number; move: (p: [number, number]) => [number, number] }) {
  return (
    <g>
      {leaflets.map((l, i) => {
        const tip = lerpPt(l.shut, l.open, open);
        const pap = move(l.papillary);
        return (
          <g key={i}>
            <line x1={tip[0]} y1={tip[1]} x2={pap[0]} y2={pap[1]} stroke="var(--bio-bone)" strokeWidth={1.3} opacity={0.9} />
            <line x1={l.hinge[0]} y1={l.hinge[1]} x2={tip[0]} y2={tip[1]} stroke="var(--bio-outline)" strokeWidth={7.5} strokeLinecap="round" />
            <line x1={l.hinge[0]} y1={l.hinge[1]} x2={tip[0]} y2={tip[1]} stroke="var(--bio-bone)" strokeWidth={4.5} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function Cusps({ cusps, open }: { cusps: Cusp[]; open: number }) {
  return (
    <g>
      {cusps.map((c, i) => {
        const tip = lerpPt(c.shut, c.open, open);
        const ctrl = lerpPt(c.ctrlShut, c.ctrlOpen, open);
        const d = `M${c.hinge[0]} ${c.hinge[1]} Q${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={6.5} strokeLinecap="round" />
            <path d={d} fill="none" stroke="var(--bio-bone)" strokeWidth={3.8} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

function Papillary({ base, tip: rawTip, move }: { base: [number, number][]; tip: [number, number]; move: (p: [number, number]) => [number, number] }) {
  const [a, b] = base.map(move);
  const tip = move(rawTip);
  return <path d={`M${a[0]} ${a[1]} Q${tip[0] - 4} ${tip[1] + 8} ${tip[0]} ${tip[1]} Q${tip[0] + 4} ${tip[1] + 8} ${b[0]} ${b[1]} Z`} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} />;
}

export type HeartArrows = "fill" | "eject" | null;

/**
 * The drawing itself (no Figure around it), so widgets can draw on top of it.
 * `ghost` fades the vessels (for the conduction system).
 */
export function HeartArt({ state = RELAXED, arrows = null, ghost = false }: { state?: HeartState; arrows?: HeartArrows; ghost?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const v = state.ventricles;
  const a = state.atria;
  const vesselOpacity = ghost ? 0.35 : 1;
  const low = "var(--bio-blood-low)";
  const high = "var(--bio-blood)";
  const arrowColor = "var(--ink)";
  const moveR = (p: [number, number]) => squeezePt(p, RV_ORIGIN, 0.3 * v, below(258));
  const moveL = (p: [number, number]) => squeezePt(p, LV_ORIGIN, 0.3 * v, below(256));
  return (
    <g>
      <defs>
        <marker id={`${uid}-ah`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={arrowColor} />
        </marker>
      </defs>

      {/* Vessels behind the heart */}
      <g opacity={vesselOpacity}>
        <g data-part="pa">
          <Vessel d={RPA} w={22} fill={low} />
          <CutEnd x={27} y={99} rx={5} ry={11} fill={low} />
        </g>
        <g data-part="svc">
          <Vessel d={SVC} w={30} fill={low} />
          <CutEnd x={139} y={19} rx={15} ry={5} fill={low} />
        </g>
        <g data-part="ivc">
          <Vessel d={IVC} w={28} fill={low} />
          <CutEnd x={100} y={447} rx={14} ry={5} fill={low} />
        </g>
        <g data-part="pv">
          <Vessel d={PV_UP} w={19} fill={high} />
          <Vessel d={PV_LOW} w={19} fill={high} />
          <CutEnd x={457} y={158} rx={4.5} ry={9.5} fill={high} />
          <CutEnd x={457} y={226} rx={4.5} ry={9.5} fill={high} />
        </g>
        <g data-part="aorta">
          {BRANCHES.map((d) => (
            <Vessel key={d} d={d} w={12} fill={high} />
          ))}
          <Vessel d={AORTA} w={32} fill={high} />
          <CutEnd x={256} y={21} rx={6} ry={2.5} rot={-15} fill={high} />
          <CutEnd x={294} y={13} rx={6} ry={2.5} fill={high} />
          <CutEnd x={334} y={19} rx={6} ry={2.5} rot={20} fill={high} />
        </g>
      </g>

      {/* Heart muscle */}
      <path d={VENTRICLES} transform={scaleAbout([250, 244], 1 - 0.025 * v, 1 - 0.04 * v)} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2.2} strokeLinejoin="round" />
      <g data-part="septum">
        <path d={SEPTUM} transform={scaleAbout([250, 244], 1 - 0.025 * v, 1 - 0.04 * v)} fill="var(--bio-flesh)" />
      </g>
      <ellipse cx={RA.cx} cy={RA.cy} rx={RA.rx * (1 - 0.04 * a)} ry={RA.ry * (1 - 0.04 * a)} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} />
      <ellipse cx={LA.cx} cy={LA.cy} rx={LA.rx * (1 - 0.04 * a)} ry={LA.ry * (1 - 0.04 * a)} fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} />

      {/* Cavities */}
      <g data-part="ra">
        <path d={squeeze(RA_CAVITY, RA_ORIGIN, 0.2 * a, 0.22 * a, above(250))} fill={low} />
      </g>
      <g data-part="la">
        <path d={squeeze(LA_CAVITY, LA_ORIGIN, 0.2 * a, 0.22 * a, above(248))} fill={high} />
      </g>
      <g data-part="rv">
        <path d={squeeze(RV_CAVITY, RV_ORIGIN, 0.3 * v, 0.3 * v, below(258))} fill={low} />
        <Papillary base={[[142, 352], [164, 370]]} tip={TRICUSPID[0].papillary} move={moveR} />
        <Papillary base={[[192, 386], [214, 386]]} tip={TRICUSPID[1].papillary} move={moveR} />
      </g>
      <g data-part="lv">
        <path d={squeeze(LV_CAVITY, LV_ORIGIN, 0.3 * v, 0.3 * v, below(256))} fill={high} />
        <Papillary base={[[286, 398], [310, 412]]} tip={MITRAL[0].papillary} move={moveL} />
        <Papillary base={[[368, 336], [362, 364]]} tip={MITRAL[1].papillary} move={moveL} />
      </g>

      {/* Pulmonary trunk in front of the ascending aorta */}
      <g data-part="pa" opacity={vesselOpacity}>
        <Vessel d={TRUNK} w={30} fill={low} />
        <Vessel d={LPA} w={22} fill={low} />
        <path d="M209 246 L237 246" stroke={low} strokeWidth={6} />
        <CutEnd x={455} y={101} rx={5} ry={11} fill={low} />
      </g>
      <path d="M248 248 L274 248" stroke={high} strokeWidth={8} opacity={vesselOpacity} />

      {/* Valves */}
      <g data-part="av">
        <AvLeaflets leaflets={TRICUSPID} open={state.av} move={moveR} />
        <AvLeaflets leaflets={MITRAL} open={state.av} move={moveL} />
      </g>
      <g data-part="sl">
        <Cusps cusps={PULMONARY} open={state.sl} />
        <Cusps cusps={AORTIC} open={state.sl} />
      </g>

      {/* Flow arrows */}
      {arrows === "fill" && (
        <g fill="none" stroke={arrowColor} strokeWidth={3} strokeLinecap="round" opacity={0.75} markerEnd={`url(#${uid}-ah)`}>
          <path d="M139 70 L139 150" />
          <path d="M108 400 C110 330 116 290 128 262" />
          <path d="M440 158 L388 168" />
          <path d="M440 226 L392 220" />
          <path d="M156 196 C158 230 158 270 160 312" />
          <path d="M330 186 C326 230 324 270 322 312" />
        </g>
      )}
      {arrows === "eject" && (
        <g fill="none" stroke={arrowColor} strokeWidth={3} strokeLinecap="round" opacity={0.75} markerEnd={`url(#${uid}-ah)`}>
          <path d="M178 336 C198 300 220 276 223 226" />
          <path d="M318 344 C298 304 264 284 261 228" />
          <path d="M244 180 C256 162 268 148 280 134" />
          <path d="M296 60 C324 56 346 70 348 112" />
        </g>
      )}
    </g>
  );
}

const PARTS: FigurePart[] = [
  { id: "ra", label: tx("right atrium", "rechter Vorhof"), at: [150, 192], info: tx("Receives oxygen-poor blood from the body through the venae cavae.", "Nimmt sauerstoffarmes Blut aus dem Körper auf (über die Hohlvenen).") },
  { id: "rv", label: tx("right ventricle", "rechte Herzkammer"), at: [168, 322], info: tx("Pumps oxygen-poor blood into the pulmonary artery, to the lungs.", "Pumpt sauerstoffarmes Blut in die Lungenarterie, zur Lunge.") },
  { id: "la", label: tx("left atrium", "linker Vorhof"), at: [332, 184], info: tx("Receives oxygen-rich blood from the lungs through the pulmonary veins.", "Nimmt sauerstoffreiches Blut aus der Lunge auf (über die Lungenvenen).") },
  { id: "lv", label: tx("left ventricle", "linke Herzkammer"), at: [318, 318], info: tx("Pumps oxygen-rich blood into the aorta, through the whole body. That's why its wall is the thickest.", "Pumpt sauerstoffreiches Blut in die Aorta, durch den ganzen Körper. Deshalb hat sie die dickste Wand.") },
  { id: "septum", label: tx("septum", "Herzscheidewand"), at: [251, 340], info: tx("Separates the right and left halves, so oxygen-poor and oxygen-rich blood never mix.", "Trennt rechte und linke Herzhälfte, damit sich sauerstoffarmes und sauerstoffreiches Blut nicht mischen.") },
  { id: "av", label: tx("atrioventricular valves", "Segelklappen"), at: [345, 268], tag: [380, 292], info: tx("Between atrium and ventricle. They stop blood flowing back into the atria when the ventricles contract.", "Zwischen Vorhof und Kammer. Sie verhindern, dass Blut beim Zusammenziehen der Kammern in die Vorhöfe zurückfließt.") },
  { id: "sl", label: tx("semilunar valves", "Taschenklappen"), at: [271, 232], tag: [292, 214], info: tx("At the exits of the ventricles. They stop blood flowing back from the aorta and pulmonary artery.", "Am Ausgang der Kammern. Sie verhindern, dass Blut aus Aorta und Lungenarterie zurückfließt.") },
  { id: "svc", label: tx("superior vena cava", "obere Hohlvene"), at: [139, 64], info: tx("Brings oxygen-poor blood from the head and arms.", "Bringt sauerstoffarmes Blut aus Kopf und Armen.") },
  { id: "ivc", label: tx("inferior vena cava", "untere Hohlvene"), at: [101, 410], info: tx("Brings oxygen-poor blood from the trunk and legs.", "Bringt sauerstoffarmes Blut aus Rumpf und Beinen.") },
  { id: "pa", label: tx("pulmonary artery", "Lungenarterie"), at: [404, 102], info: tx("Carries oxygen-poor blood from the heart to the lungs. An artery, but oxygen-poor!", "Führt sauerstoffarmes Blut vom Herzen zur Lunge. Eine Arterie, aber sauerstoffarm!") },
  { id: "pv", label: tx("pulmonary veins", "Lungenvenen"), at: [424, 224], info: tx("Carry oxygen-rich blood from the lungs to the heart. Veins, but oxygen-rich!", "Führen sauerstoffreiches Blut von der Lunge zum Herzen. Venen, aber sauerstoffreich!") },
  { id: "aorta", label: tx("aorta", "Aorta (Hauptschlagader)"), at: [304, 46], info: tx("The main artery: carries oxygen-rich blood into the body.", "Die Hauptschlagader: führt sauerstoffreiches Blut in den Körper.") },
];

export const HEART_PARTS = PARTS;

/** Names of the heart's parts, for tasks: the id and its label. */
export const heartLabel = (id: string) => PARTS.find((p) => p.id === id)!.label;

export type HeartSectionProps = DrawingProps & {
  state?: HeartState;
  arrows?: HeartArrows;
  /** Write "right half" / "left half" under the heart (the mirror trap). */
  sides?: boolean;
  title?: ReturnType<typeof tx>;
};

/** The labelled heart: explore it in the lesson, ask about a part in a task. */
export function HeartSection({ mode = "names", show, ask, highlight, legend, state, arrows, sides }: HeartSectionProps) {
  const t = useText();
  return (
    <Figure title={tx("The human heart in section (seen from the front)", "Das menschliche Herz im Längsschnitt (von vorn gesehen)")} width={HEART_W} height={HEART_H} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <HeartArt state={state} arrows={arrows} />
      {sides && (
        <g style={svgText} fontSize={14} fontWeight={600} fill="var(--ink-2)" textAnchor="middle">
          <text x={165} y={462}>{t(tx("right half", "rechte Hälfte"))}</text>
          <text x={330} y={462}>{t(tx("left half", "linke Hälfte"))}</text>
        </g>
      )}
    </Figure>
  );
}
