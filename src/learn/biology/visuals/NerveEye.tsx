"use client";

// The human eye for the "nervous-system" topic: a horizontal section (light comes in from the
// left) with all the parts a school book labels, a front view, and two widgets: the pupil
// reflex with a light slider (level 1) and accommodation with a distance slider (level 2).

import { motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { GhostButton, lerp, Note, Pill, r1, Segmented, Slider } from "./NerveKit";

// ---------------------------------------------------------------------------
// Geometry (viewBox 540 × 320, eye centre C, all radii in viewBox units)

const W = 540;
const H = 320;
const CX = 290;
const CY = 160;
const R0 = 115; // outside of the sclera
const R1 = 109; // sclera / choroid
const R2 = 104; // choroid / retina
const R3 = 98; // retina / vitreous body
const LENS_X = 217;
const IRIS_X = 196;
const FOVEA_X = CX + R3;

const deg = Math.PI / 180;
// Rounded, so server and browser render the same numbers.
const onCircle = (r: number, a: number): [number, number] => [r1(CX + r * Math.cos(a * deg)), r1(CY + r * Math.sin(a * deg))];
const f1 = (v: number) => v.toFixed(1);

/** An annular band between radii r1 > r2, from angle -a to +a through the back of the eye. */
function band(r1: number, r2: number, a: number) {
  const [x1, y1] = onCircle(r1, -a);
  const [x2, y2] = onCircle(r1, a);
  const [x3, y3] = onCircle(r2, a);
  const [x4, y4] = onCircle(r2, -a);
  return `M${f1(x1)} ${f1(y1)} A${r1} ${r1} 0 1 1 ${f1(x2)} ${f1(y2)} L${f1(x3)} ${f1(y3)} A${r2} ${r2} 0 1 0 ${f1(x4)} ${f1(y4)} Z`;
}

/** A short wedge of a ring (where the optic nerve crosses the coats). */
function wedge(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = onCircle(r1, a1);
  const [x2, y2] = onCircle(r1, a2);
  const [x3, y3] = onCircle(r2, a2);
  const [x4, y4] = onCircle(r2, a1);
  return `M${f1(x1)} ${f1(y1)} A${r1} ${r1} 0 0 1 ${f1(x2)} ${f1(y2)} L${f1(x3)} ${f1(y3)} A${r2} ${r2} 0 0 0 ${f1(x4)} ${f1(y4)} Z`;
}

// Sclera + cornea outline; the cornea is a smaller sphere that bulges out at the front.
const OUTER = "M189.4 104.2 A115 115 0 1 1 189.4 215.8 A75 75 0 0 1 189.4 104.2 Z";
const CORNEA = "M189.4 104.2 A75 75 0 0 0 189.4 215.8 L194.7 212.8 A68.8 68.8 0 0 1 194.7 107.2 Z";
const INSIDE = "M194.7 107.2 A109 109 0 1 1 194.7 212.8 A68.8 68.8 0 0 1 194.7 107.2 Z";
const NERVE = "M403.3 180 C440 178 482 182 540 189 L540 218 C482 213 440 210 395 206.8 Z";

/** Pupil half-height for an opening 0 (narrow) … 1 (wide). */
export const pupilHalf = (pupil: number) => lerp(9, 34, pupil);
/** Lens half-thickness and half-height for accommodation 0 (far, flat) … 1 (near, round). */
const lensShape = (lens: number) => ({ rx: lerp(18, 25, lens), ry: lerp(45, 41, lens) });

const ALL_PARTS: FigurePart[] = [
  { id: "cornea", label: tx("cornea", "Hornhaut"), at: [173.3, 124.8], tag: [124, 64], info: tx("Clear, curved window at the front. It protects the eye and already bends the light strongly.", "Durchsichtige, gewölbte Haut ganz vorn. Sie schützt das Auge und bricht das Licht schon stark.") },
  { id: "iris", label: tx("iris", "Iris (Regenbogenhaut)"), at: [194.5, 118], tag: [168, 24], info: tx("Coloured ring with tiny muscles. It makes the pupil narrower or wider and gives the eye its colour.", "Farbiger Ring mit kleinen Muskeln. Er macht die Pupille enger oder weiter und gibt dem Auge seine Farbe.") },
  { id: "pupil", label: tx("pupil", "Pupille"), at: [196, 160], info: tx("The hole in the iris. Light enters the eye through it. It looks black because hardly any light comes back out.", "Das Loch in der Iris. Durch sie fällt Licht ins Auge. Sie sieht schwarz aus, weil kaum Licht zurückkommt.") },
  { id: "lens", label: tx("lens", "Linse"), at: [221, 136], info: tx("Clear and elastic. It bends the light so that a sharp image forms on the retina.", "Durchsichtig und elastisch. Sie bricht das Licht so, dass auf der Netzhaut ein scharfes Bild entsteht.") },
  { id: "ciliary", label: tx("ciliary muscle", "Ziliarmuskel"), at: [207, 92], tag: [236, 22], info: tx("Ring muscle around the lens. When it contracts, the lens gets rounder: you see near things sharply.", "Ringmuskel um die Linse. Zieht er sich zusammen, wird die Linse runder: Du siehst Nahes scharf.") },
  { id: "zonule", label: tx("zonular fibres", "Linsenbänder (Zonulafasern)"), at: [214, 217], tag: [186, 296], info: tx("Fine fibres between ciliary muscle and lens. When they are taut, they pull the lens flat.", "Feine Fasern zwischen Ziliarmuskel und Linse. Sind sie gespannt, ziehen sie die Linse flach.") },
  { id: "vitreous", label: tx("vitreous body", "Glaskörper"), at: [300, 118], info: tx("Clear jelly that fills the eye and keeps it round.", "Durchsichtige, gallertartige Masse. Sie füllt das Auge und hält es rund.") },
  { id: "retina", label: tx("retina", "Netzhaut"), at: onCircle(101, -55), tag: [356, 18], info: tx("The light-sensitive layer with the sensory cells (rods and cones). The image forms here.", "Die lichtempfindliche Schicht mit den Sinneszellen (Stäbchen und Zapfen). Hier entsteht das Bild.") },
  { id: "choroid", label: tx("choroid", "Aderhaut"), at: onCircle(106.5, -33), tag: [436, 40], info: tx("Full of blood vessels: it supplies the retina with oxygen and nutrients.", "Voller Blutgefäße: Sie versorgt die Netzhaut mit Sauerstoff und Nährstoffen.") },
  { id: "sclera", label: tx("sclera", "Lederhaut"), at: onCircle(112, -14), tag: [482, 92], info: tx("Tough white outer coat. It protects the eye and keeps its shape.", "Feste, weiße Hülle. Sie schützt das Auge und hält es in Form.") },
  { id: "fovea", label: tx("yellow spot (fovea)", "Gelber Fleck"), at: [FOVEA_X + 1, 160], tag: [470, 146], info: tx("The point of sharpest vision: cones packed tightly together, especially for colours.", "Die Stelle des schärfsten Sehens: dicht gepackte Zapfen, besonders für das Farbensehen.") },
  { id: "blindspot", label: tx("blind spot", "Blinder Fleck"), at: onCircle(99, 17), tag: [430, 262], info: tx("Here the optic nerve leaves the eye. There are no sensory cells, so you can't see anything at this spot.", "Hier verlässt der Sehnerv das Auge. Es gibt keine Sinneszellen, darum siehst du an dieser Stelle nichts.") },
  { id: "opticnerve", label: tx("optic nerve", "Sehnerv"), at: [492, 202], info: tx("Carries the signals from the retina to the brain.", "Leitet die Signale der Netzhaut zum Gehirn.") },
];

export const EYE_PARTS = ALL_PARTS;
/** The parts a beginner learns (level 1). */
export const EYE_BASIC = ["cornea", "iris", "pupil", "lens", "vitreous", "retina", "fovea", "blindspot", "opticnerve", "sclera"];

export type EyeProps = DrawingProps & {
  /** Accommodation: 0 far (flat lens, relaxed ciliary muscle) … 1 near (round lens). */
  lens?: number;
  /** Pupil opening: 0 narrow (bright) … 1 wide (dark). */
  pupil?: number;
  /** Extra drawing on top of the eye (rays, light). */
  overlay?: ReactNode;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  title?: Text;
};

/** The eye in horizontal section. `show` limits the labelled parts (numbers follow the shown list). */
export function NerveEye({ mode = "names", show, ask, highlight, legend, lens = 0.2, pupil = 0.5, overlay, selected, onSelect, title }: EyeProps) {
  const parts = show ? ALL_PARTS.filter((p) => show.includes(p.id)) : ALL_PARTS;
  const { rx, ry } = lensShape(lens);
  const p = pupilHalf(pupil);
  // Ciliary muscle: contracted (near) = thicker and closer to the lens.
  const tip: [number, number] = [lerp(213, 210.5, lens), lerp(97, 106, lens)];
  const bulge = lerp(0, 5, lens);
  const ciliaryTop = `M195.6 105.5 Q${f1(tip[0] - 9 - bulge)} ${f1(tip[1] + 2)} ${f1(tip[0])} ${f1(tip[1])} Q${f1(tip[0] + 12 + bulge)} ${f1(tip[1] - 8 - bulge)} 215.7 80.3 Z`;
  // Zonular fibres from the ciliary tip to the lens rim: straight when taut, bowed when slack.
  const rim = (dx: number): [number, number] => [LENS_X + dx, CY - ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2))];
  const fibres = [-9, -2, 6].map((dx, i) => {
    const [x2, y2] = rim(dx);
    const x1 = tip[0] - 1 + i * 2.2;
    const y1 = tip[1] + 1;
    const sag = lerp(0, 5, lens) * (i % 2 ? -1 : 1);
    return `M${f1(x1)} ${f1(y1)} Q${f1((x1 + x2) / 2 + sag)} ${f1((y1 + y2) / 2)} ${f1(x2)} ${f1(y2)}`;
  });
  const mirror = `translate(0 ${2 * CY}) scale(1 -1)`;

  return (
    <Figure
      title={title ?? tx("The eye in section", "Das Auge im Schnitt")}
      width={W}
      height={H}
      parts={parts}
      mode={mode}
      ask={ask}
      highlight={highlight}
      legend={legend}
      selected={selected}
      onSelect={onSelect}
    >
      <g data-part="opticnerve">
        <path d={NERVE} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
        {[188, 196, 204].map((y, i) => (
          <path key={y} d={`M${410 + i * 3} ${y - 3} C450 ${y - 4} 490 ${y} 540 ${y + 6}`} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1} opacity={0.6} />
        ))}
      </g>
      <g data-part="sclera">
        <path d={OUTER} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
      </g>
      <path d={INSIDE} fill="var(--bio-vacuole)" opacity={0.55} />
      <g data-part="choroid">
        <path d={band(R1, R2, 146)} fill="var(--bio-blood)" opacity={0.78} />
      </g>
      <g data-part="retina">
        <path d={band(R2, R3, 140)} fill="var(--bio-nerve)" stroke="var(--bio-nerve-deep)" strokeWidth={0.8} />
      </g>
      <g data-part="vitreous">
        <path
          d={`M214.9 97 A98 98 0 1 1 214.9 223 L229 ${f1(CY + ry - 4)} Q${f1(LENS_X + rx + 10)} ${CY} 229 ${f1(CY - ry + 4)} Z`}
          fill="var(--bio-vacuole)"
        />
      </g>
      <g data-part="blindspot">
        <path d={wedge(R0 + 0.5, R3 - 2, 10.5, 23.5)} fill="var(--bio-nerve)" />
        <path d={wedge(R3 + 1, R3 - 3, 12, 22)} fill="var(--bio-nerve-deep)" opacity={0.9} />
      </g>
      <g data-part="fovea">
        <ellipse cx={FOVEA_X + 1} cy={CY} rx={4.5} ry={9} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1} />
      </g>
      <g data-part="cornea">
        <path d={CORNEA} fill="var(--bio-vacuole)" stroke="var(--bio-outline)" strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <g data-part="ciliary">
        {[0, 1].map((k) => (
          <path key={k} d={ciliaryTop} transform={k ? mirror : undefined} fill="var(--bio-flesh-deep)" stroke="var(--bio-outline)" strokeWidth={1.3} strokeLinejoin="round" />
        ))}
      </g>
      <g data-part="zonule">
        {[0, 1].map((k) => (
          <g key={k} transform={k ? mirror : undefined}>
            {fibres.map((d) => (
              <path key={d} d={d} fill="none" stroke="var(--ink-2)" strokeWidth={1} />
            ))}
          </g>
        ))}
      </g>
      <g data-part="lens">
        <ellipse cx={LENS_X} cy={CY} rx={rx} ry={ry} fill="var(--bio-water)" fillOpacity={0.32} stroke="var(--bio-water-deep)" strokeWidth={1.8} />
        <path d={`M${f1(LENS_X - rx * 0.45)} ${f1(CY - ry * 0.6)} Q${f1(LENS_X - rx * 0.7)} ${CY} ${f1(LENS_X - rx * 0.45)} ${f1(CY + ry * 0.6)}`} fill="none" stroke="var(--raised)" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </g>
      <g data-part="pupil">
        <rect x={IRIS_X - 3.5} y={CY - p} width={7} height={2 * p} rx={3} fill="none" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2.5 2.5" />
      </g>
      <g data-part="iris">
        {[0, 1].map((k) => (
          <line key={k} x1={193} y1={108} x2={IRIS_X + 1} y2={f1(CY - p)} transform={k ? mirror : undefined} stroke="var(--bio-wood)" strokeWidth={6} strokeLinecap="round" />
        ))}
      </g>
      {overlay}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Front view: iris and pupil as you see them in a mirror.

export function NerveEyeFront({ pupil, size = 150 }: { pupil: number; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const t = useText();
  const r = lerp(5.5, 19, pupil);
  const almond = "M6 45 Q70 -6 134 45 Q70 96 6 45 Z";
  return (
    <svg viewBox="0 0 140 90" width={size} className="block h-auto max-w-full" role="img" aria-label={t(tx("The eye from the front", "Das Auge von vorn"))}>
      <defs>
        <clipPath id={`${uid}-lid`}>
          <path d={almond} />
        </clipPath>
      </defs>
      <path d={almond} fill="var(--bio-bone)" />
      <g clipPath={`url(#${uid}-lid)`}>
        <circle cx={70} cy={45} r={30} fill="var(--bio-wood)" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <line key={i} x1={r1(70 + Math.cos(a) * (r + 2))} y1={r1(45 + Math.sin(a) * (r + 2))} x2={r1(70 + Math.cos(a) * 29)} y2={r1(45 + Math.sin(a) * 29)} stroke="var(--bio-wood-deep)" strokeWidth={1.1} opacity={0.75} />;
        })}
        <circle cx={70} cy={45} r={30} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <motion.circle cx={70} cy={45} initial={false} animate={{ r }} transition={{ type: "spring", stiffness: 140, damping: 18 }} fill="var(--bio-outline)" />
        <circle cx={78} cy={36} r={4} fill="var(--raised)" opacity={0.85} />
      </g>
      <path d={almond} fill="none" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
      <path d="M8 40 Q70 -14 132 40" fill="none" stroke="var(--bio-outline)" strokeWidth={1.3} opacity={0.5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Level 1 widget: explore the eye and turn the light up and down.

const COMFY = { lo: 0.6, hi: 1.45 };

export function NerveEyeLab() {
  const t = useText();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [light, setLight] = useState(0.35);
  const [reflex, setReflex] = useState(true);
  const [fixed, setFixed] = useState(0.5);
  const [picked, setPicked] = useState<string | null>(null);
  // Light outside, from deep dusk (4 %) to bright sun (100 %), on a log scale like our senses.
  const amount = Math.round(0.04 * 25 ** light * 1e6) / 1e6;
  // With the reflex the pupil opens just enough to keep the light on the retina constant
  // (as far as it can); without it, the pupil stays where it was.
  const pReflex = Math.min(pupilHalf(1), Math.max(pupilHalf(0), pupilHalf(0) / Math.sqrt(amount)));
  const pupil = reflex ? (pReflex - pupilHalf(0)) / (pupilHalf(1) - pupilHalf(0)) : fixed;
  const p = pupilHalf(pupil);
  const onRetina = amount * (p / pupilHalf(0)) ** 2; // 1 = just right
  const state = onRetina > COMFY.hi ? "bright" : onRetina < COMFY.lo ? "dark" : "ok";
  const beam = 0.12 + 0.55 * amount;

  const overlay = (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${uid}-beam`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--bio-sun)" stopOpacity={0} />
          <stop offset="0.45" stopColor="var(--bio-sun)" stopOpacity={1} />
        </linearGradient>
      </defs>
      <path d={`M40 104 L${IRIS_X} 114 L${IRIS_X} 206 L40 216 Z`} fill={`url(#${uid}-beam)`} opacity={beam * 0.6} />
      <g transform="translate(22 160)" opacity={0.35 + 0.65 * light}>
        <circle r={9} fill="var(--bio-sun)" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1={r1(Math.cos((a * Math.PI) / 180) * 12)} y1={r1(Math.sin((a * Math.PI) / 180) * 12)} x2={r1(Math.cos((a * Math.PI) / 180) * 17)} y2={r1(Math.sin((a * Math.PI) / 180) * 17)} stroke="var(--bio-sun)" strokeWidth={2.2} strokeLinecap="round" />
        ))}
      </g>
      <motion.path initial={false} animate={{ d: `M${IRIS_X} ${f1(CY - p + 2)} L${FOVEA_X - 2} ${CY} L${IRIS_X} ${f1(CY + p - 2)} Z` }} transition={{ type: "spring", stiffness: 140, damping: 18 }} fill="var(--bio-sun)" opacity={beam} />
      <motion.circle cx={FOVEA_X - 3} cy={CY} r={9} initial={false} animate={{ opacity: Math.min(1, 0.25 + onRetina * 0.45) }} fill="var(--bio-sun)" />
    </g>
  );

  const note: Text =
    !reflex && state === "bright"
      ? tx("**Too bright!** Without the reflex the wide pupil lets far too much light onto the retina. That dazzles and can even damage the sensory cells.", "**Viel zu hell!** Ohne Reflex lässt die weite Pupille viel zu viel Licht auf die Netzhaut. Das blendet und kann die Sinneszellen sogar schädigen.")
      : !reflex && state === "dark"
        ? tx("**Too dark!** Without the reflex the narrow pupil stays narrow and lets too little light in. You can hardly see anything.", "**Zu dunkel!** Ohne Reflex bleibt die enge Pupille eng und lässt zu wenig Licht herein. Du erkennst kaum etwas.")
        : !reflex
          ? tx("Without the reflex, the pupil only fits this one brightness by chance. Move the slider further!", "Ohne Reflex passt die Pupille nur zufällig zu genau dieser Helligkeit. Schieb den Regler weiter!")
          : state === "dark"
            ? tx("Nearly dark: the pupil is already as wide as it can get. More light can't get in, so you only see a little.", "Fast dunkel: Die Pupille ist schon so weit wie möglich. Mehr Licht kommt nicht herein, darum siehst du nur noch wenig.")
            : light > 0.6
              ? tx("Bright light: the iris narrows the **pupil**. Less light gets in, so the retina is not dazzled. That's the **pupillary reflex**.", "Helles Licht: Die Iris macht die **Pupille** eng. So fällt weniger Licht ein und die Netzhaut wird nicht geblendet. Das ist der **Pupillenreflex**.")
              : light < 0.3
                ? tx("Dim light: the iris opens the **pupil** wide, so that enough light still reaches the retina.", "Dämmerlicht: Die Iris macht die **Pupille** weit, damit noch genug Licht auf die Netzhaut fällt.")
                : tx("Slide the light up and down and watch the pupil, from the front and in the section. Tap a number to find out what a part does.", "Schieb das Licht hoch und runter und beobachte die Pupille, von vorn und im Schnitt. Tipp auf eine Nummer, dann erfährst du, was das Teil macht.");

  return (
    <div className="space-y-4">
      <NerveEye mode="explore" show={EYE_BASIC} pupil={pupil} lens={0.1} overlay={overlay} selected={picked} onSelect={setPicked} />
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
        <div className="flex justify-center">
          <NerveEyeFront pupil={pupil} />
        </div>
        <div className="min-w-0 space-y-2">
          <Slider value={light} onChange={setLight} label={tx("Brightness", "Helligkeit")} left={<Moon className="size-4" />} right={<Sun className="size-4" />} />
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <span>{t(tx("Light on the retina:", "Licht auf der Netzhaut:"))}</span>
            <div className="relative h-2.5 w-28 overflow-hidden rounded-full bg-hover">
              <div className="absolute inset-y-0 rounded-full bg-blob-soft" style={{ left: `${(COMFY.lo / 2) * 100}%`, width: `${((COMFY.hi - COMFY.lo) / 2) * 100}%` }} />
              <motion.div className="absolute inset-y-0 left-0 rounded-full bg-blob" initial={false} animate={{ width: `${Math.min(100, (onRetina / 2) * 100)}%` }} />
            </div>
            <Pill on={state === "ok"}>{t(state === "ok" ? tx("just right", "genau richtig") : state === "bright" ? tx("too bright", "zu hell") : tx("too dark", "zu dunkel"))}</Pill>
          </div>
          <GhostButton
            pressed={!reflex}
            onClick={() => {
              setFixed(pupil);
              setReflex(!reflex);
            }}
          >
            {t(reflex ? tx("Switch the reflex off", "Reflex ausschalten") : tx("Switch the reflex back on", "Reflex wieder einschalten"))}
          </GhostButton>
        </div>
      </div>
      <Note id={`${reflex}-${state}-${light > 0.6 ? 2 : light < 0.3 ? 0 : 1}`} text={note} accent={state !== "ok"} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 2 widget: accommodation. Move the object nearer and the lens bulges.

/** Where the ray from (x1, y1) towards (x2, y2) meets the retina (far side of the circle R3). */
function hitRetina(x1: number, y1: number, x2: number, y2: number): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - CX;
  const fy = y1 - CY;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - R3 * R3;
  const s = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  return [x1 + dx * s, y1 + dy * s];
}

const HEIGHTS = [-24, -12, 0, 12, 24];

export function NerveEyeFocus() {
  const t = useText();
  const reduce = useReducedMotion();
  const [dist, setDist] = useState(0.15);
  const [adapt, setAdapt] = useState<"on" | "off">("on");
  const [names, setNames] = useState(false);
  const near = 1 - dist;
  const lens = adapt === "on" ? near : 0;
  // Where the rays would meet: on the yellow spot if the lens adapts, behind the retina if it can't.
  const focusX = adapt === "on" ? FOVEA_X : FOVEA_X + 170 * near * near;
  const objX = 62 - 560 * dist * dist;
  const showObject = objX > 16;
  const sharp = focusX - FOVEA_X < 6;

  const rays = HEIGHTS.map((h) => {
    const yL = CY + h;
    // Outside the eye: from the object point to the lens (cut off at the left edge).
    const k = objX < 0 ? -objX / (LENS_X - objX) : 0;
    const x0 = objX < 0 ? 0 : objX;
    const y0 = CY + h * k;
    const [xr, yr] = hitRetina(LENS_X, yL, focusX, CY);
    return { d: `M${f1(x0)} ${f1(y0)} L${LENS_X} ${yL} L${f1(xr)} ${f1(yr)}`, end: yr };
  });
  const spread = Math.max(...rays.map((r) => r.end)) - Math.min(...rays.map((r) => r.end));

  const overlay = (
    <g style={{ pointerEvents: "none" }}>
      {rays.map((r, i) => (
        <motion.path key={i} initial={false} animate={{ d: r.d }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }} fill="none" stroke="var(--bio-sun)" strokeWidth={1.7} strokeLinejoin="round" opacity={0.95} />
      ))}
      <motion.ellipse cx={FOVEA_X - 2} initial={false} animate={{ cy: CY, ry: 3 + spread / 2, opacity: sharp ? 0.9 : 0.55 }} rx={3.5} fill="var(--bio-sun)" />
      {showObject && (
        <motion.g initial={false} animate={{ x: objX, opacity: 1 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 22 }}>
          <line x1={0} y1={CY + 5} x2={0} y2={CY + 40} stroke="var(--bio-leaf-deep)" strokeWidth={2.5} strokeLinecap="round" />
          <path d={`M0 ${CY + 26} Q-12 ${CY + 18} -14 ${CY + 28} Q-4 ${CY + 32} 0 ${CY + 26}`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={r1(Math.cos(((a - 90) * Math.PI) / 180) * 6)} cy={r1(CY + Math.sin(((a - 90) * Math.PI) / 180) * 6)} r={5} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={0.8} />
          ))}
          <circle cx={0} cy={CY} r={3.6} fill="var(--bio-pollen)" />
        </motion.g>
      )}
    </g>
  );

  const rows: { label: Text; value: Text; on: boolean }[] = [
    { label: tx("Ciliary muscle", "Ziliarmuskel"), value: lens > 0.5 ? tx("contracted", "angespannt") : tx("relaxed", "entspannt"), on: lens > 0.5 },
    { label: tx("Zonular fibres", "Linsenbänder"), value: lens > 0.5 ? tx("slack", "locker") : tx("taut", "gespannt"), on: lens > 0.5 },
    { label: tx("Lens", "Linse"), value: lens > 0.5 ? tx("round, bends light strongly", "kugelig, bricht stark") : tx("flat, bends light weakly", "flach, bricht schwach"), on: lens > 0.5 },
    { label: tx("Image on the retina", "Bild auf der Netzhaut"), value: sharp ? tx("sharp", "scharf") : tx("blurred", "unscharf"), on: sharp },
  ];

  const note: Text =
    adapt === "off" && !sharp
      ? tx("The lens can't round up any more (as with **presbyopia** in older age). The light would only meet **behind** the retina, so near things look blurred. Reading glasses help.", "Die Linse kann sich nicht mehr runden (wie bei der **Alterssichtigkeit**). Die Lichtstrahlen würden sich erst **hinter** der Netzhaut treffen, Nahes wird unscharf. Eine Lesebrille hilft.")
      : lens > 0.5
        ? tx("**Near:** the ciliary muscle contracts, the ring gets smaller and the zonular fibres go slack. The elastic lens springs into a **rounder** shape and bends the light more strongly.", "**Nah:** Der Ziliarmuskel zieht sich zusammen, der Ring wird enger und die Linsenbänder werden locker. Die elastische Linse wölbt sich **kugeliger** und bricht das Licht stärker.")
        : tx("**Far:** the ciliary muscle relaxes, the zonular fibres are pulled taut and stretch the lens **flat**. It bends the light less, just enough for distant things.", "**Fern:** Der Ziliarmuskel ist entspannt, die Linsenbänder sind gespannt und ziehen die Linse **flach**. Sie bricht das Licht schwächer, gerade richtig für Entferntes.");

  return (
    <div className="space-y-4">
      <NerveEye mode={names ? "names" : "plain"} show={["cornea", "lens", "ciliary", "zonule", "retina", "fovea"]} legend="below" lens={lens} pupil={0.62} overlay={overlay} />
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        <Slider value={dist} onChange={setDist} label={tx("Distance of the object", "Entfernung des Gegenstands")} left={t(tx("near", "nah"))} right={t(tx("far", "fern"))} />
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={t(r.label)} className="flex items-center justify-between gap-2 text-[13.5px]">
              <span className="text-ink-2">{t(r.label)}</span>
              <Pill on={r.on}>{t(r.value)}</Pill>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={adapt}
            onChange={setAdapt}
            label={tx("Lens", "Linse")}
            options={[
              { id: "on", label: tx("young, elastic lens", "junge, elastische Linse") },
              { id: "off", label: tx("stiff lens", "starre Linse") },
            ]}
          />
          <GhostButton pressed={names} onClick={() => setNames(!names)}>
            {t(tx("Labels", "Beschriftung"))}
          </GhostButton>
        </div>
      </div>
      <Note id={`${adapt}-${lens > 0.5}-${sharp}`} text={note} accent={!sharp} className={cn(!sharp && "text-ink")} />
    </div>
  );
}
