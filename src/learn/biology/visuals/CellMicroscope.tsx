"use client";

// A school light microscope (side view) as a labelled schematic: eyepiece, tube, revolving
// nosepiece with three colour-coded objectives, stage, diaphragm, lamp, arm and focus knobs.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cos, sin } from "@/lib/stableMath";

export const MICROSCOPE_PARTS: FigurePart[] = [
  { id: "eyepiece", label: tx("eyepiece", "Okular"), at: [170, 58], tag: [34, 58], info: tx("The lens you look through (from Latin oculus, eye). It magnifies the image again, usually 10×.", "Die Linse, durch die du schaust (lateinisch oculus: Auge). Sie vergrößert das Bild noch einmal, meist 10-fach.") },
  { id: "tube", label: tx("tube", "Tubus"), at: [170, 160], tag: [34, 160], info: tx("Connects the eyepiece with the objective.", "Verbindet Okular und Objektiv.") },
  { id: "nosepiece", label: tx("revolving nosepiece", "Objektivrevolver"), at: [146, 235], tag: [34, 222], info: tx("Turn it to swap objectives until one clicks into place.", "Durch Drehen wechselst du das Objektiv, bis es einrastet.") },
  { id: "objective", label: tx("objective", "Objektiv"), at: [170, 270], tag: [34, 266], info: tx("The lens near the object. Usually 4×, 10× and 40×.", "Die Linse nahe am Objekt. Meist 4-fach, 10-fach und 40-fach.") },
  { id: "slide", label: tx("slide with specimen", "Objektträger mit Präparat"), at: [124, 298], tag: [34, 300], info: tx("Glass slide with the thin specimen under a cover slip.", "Glasplättchen mit dem dünnen Präparat unter einem Deckgläschen.") },
  { id: "stage", label: tx("stage", "Objekttisch"), at: [92, 310], tag: [34, 334], info: tx("Holds the slide. Two clips keep it in place.", "Trägt den Objektträger. Zwei Klammern halten ihn fest.") },
  { id: "diaphragm", label: tx("diaphragm", "Blende"), at: [132, 332], tag: [34, 368], info: tx("Lets more or less light through: brightness and contrast.", "Lässt mehr oder weniger Licht durch: Helligkeit und Kontrast.") },
  { id: "light", label: tx("light source", "Lichtquelle (Beleuchtung)"), at: [170, 404], tag: [34, 404], info: tx("Shines through the specimen from below. The specimen must be thin!", "Durchleuchtet das Präparat von unten. Deshalb muss es dünn sein!") },
  { id: "arm", label: tx("arm and base", "Stativ mit Fuß"), at: [306, 190], tag: [404, 150], info: tx("Holds everything together. Carry the microscope by the arm, with a hand under the base.", "Hält alles zusammen. Trag das Mikroskop am Stativ, eine Hand unter dem Fuß.") },
  { id: "coarse", label: tx("coarse focus knob", "Grobtrieb"), at: [318, 262], tag: [404, 248], info: tx("Big knob: moves the stage a lot. For focusing roughly with small objectives.", "Großes Rad: bewegt den Tisch stark. Zum groben Scharfstellen bei kleinen Objektiven.") },
  { id: "fine", label: tx("fine focus knob", "Feintrieb"), at: [318, 326], tag: [404, 330], info: tx("Small knob: moves the stage just a little. For sharp images, especially at 40×.", "Kleines Rad: bewegt den Tisch nur wenig. Für ein scharfes Bild, vor allem bei 40-fach.") },
];

const OUT = "var(--bio-outline)";
const BODY = "var(--bio-bone)";

/** One objective lens hanging from the nosepiece, with its colour ring. */
function Objective({ x, y, len, rot, ring }: { x: number; y: number; len: number; rot: number; ring: string }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <rect x={x - 10} y={y} width={20} height={len} rx={3} fill={BODY} stroke={OUT} strokeWidth={1.8} />
      <rect x={x - 10} y={y + len * 0.42} width={20} height={4} fill={ring} />
      <path d={`M ${x - 8} ${y + len} L ${x + 8} ${y + len} L ${x + 5} ${y + len + 7} L ${x - 5} ${y + len + 7} Z`} fill="var(--ink-3)" stroke={OUT} strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  );
}

function Knob({ x, y, r }: { x: number; y: number; r: number }) {
  const ridges = Math.round(r * 1.2);
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={BODY} stroke={OUT} strokeWidth={2} />
      {Array.from({ length: ridges }, (_, i) => {
        const a = (i / ridges) * 2 * Math.PI;
        return <line key={i} x1={x + (r - 4) * cos(a)} y1={y + (r - 4) * sin(a)} x2={x + r * cos(a)} y2={y + r * sin(a)} stroke={OUT} strokeWidth={1.1} />;
      })}
      <circle cx={x} cy={y} r={r * 0.38} fill="var(--ink-3)" stroke={OUT} strokeWidth={1.4} />
    </g>
  );
}

export function CellMicroscope({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Light microscope", "Lichtmikroskop")} width={440} height={470} parts={MICROSCOPE_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* light path: from the lamp through the specimen */}
      <path d="M 156 392 L 184 392 L 178 318 L 162 318 Z" fill="var(--bio-sun)" opacity={0.28} />
      <g data-part="arm">
        <path
          d="M 82 424 Q 82 414 92 414 L 352 414 Q 364 414 364 426 L 364 446 Q 364 456 352 456 L 92 456 Q 82 456 82 446 Z"
          fill={BODY}
          stroke={OUT}
          strokeWidth={2}
        />
        <path
          d="M 292 414 L 292 300 C 292 238, 286 196, 258 166 C 240 148, 214 134, 186 128 L 186 98 C 226 104, 266 124, 292 150 C 322 182, 332 236, 332 300 L 332 414 Z"
          fill={BODY}
          stroke={OUT}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
      <g data-part="light">
        <rect x={146} y={392} width={48} height={22} rx={5} fill={BODY} stroke={OUT} strokeWidth={1.8} />
        <ellipse cx={170} cy={392} rx={16} ry={4.5} fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.4} />
      </g>
      <g data-part="diaphragm">
        <rect x={150} y={316} width={40} height={22} rx={3} fill={BODY} stroke={OUT} strokeWidth={1.8} />
        <line x1={150} y1={331} x2={124} y2={334} stroke={OUT} strokeWidth={3} strokeLinecap="round" />
        <circle cx={123} cy={334} r={3.5} fill="var(--ink-3)" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="stage">
        <rect x={70} y={300} width={230} height={16} rx={3} fill={BODY} stroke={OUT} strokeWidth={2} />
        <path d="M 92 300 Q 100 292 116 294 M 226 294 Q 242 292 250 300" fill="none" stroke={OUT} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <g data-part="slide">
        <rect x={104} y={295} width={134} height={5} rx={1} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.1} />
        <rect x={156} y={292} width={28} height={3} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={0.9} />
      </g>
      <g data-part="coarse">
        <Knob x={312} y={262} r={22} />
      </g>
      <g data-part="fine">
        <Knob x={312} y={326} r={13} />
      </g>
      <g data-part="tube">
        <rect x={152} y={92} width={36} height={136} rx={3} fill={BODY} stroke={OUT} strokeWidth={2} />
      </g>
      <g data-part="eyepiece">
        <rect x={156} y={44} width={28} height={50} rx={2} fill={BODY} stroke={OUT} strokeWidth={2} />
        <rect x={150} y={36} width={40} height={12} rx={4} fill="var(--ink-3)" stroke={OUT} strokeWidth={1.8} />
        <ellipse cx={170} cy={37} rx={14} ry={3} fill="var(--bio-vacuole)" stroke={OUT} strokeWidth={1.2} />
      </g>
      <g data-part="objective">
        <Objective x={150} y={244} len={30} rot={28} ring="var(--bio-blood)" />
        <Objective x={190} y={244} len={34} rot={-28} ring="var(--bio-sun)" />
        <Objective x={170} y={246} len={38} rot={0} ring="var(--bio-water)" />
      </g>
      <g data-part="nosepiece">
        <path d="M 132 228 L 208 228 L 200 248 L 140 248 Z" fill="var(--ink-3)" stroke={OUT} strokeWidth={1.8} strokeLinejoin="round" />
        <ellipse cx={170} cy={228} rx={38} ry={6} fill={BODY} stroke={OUT} strokeWidth={1.8} />
      </g>
    </Figure>
  );
}
