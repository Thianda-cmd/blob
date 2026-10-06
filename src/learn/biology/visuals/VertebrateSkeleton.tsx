"use client";

// The basic plan of a vertebrate skeleton, shown on a dog: skull, backbone, rib cage, shoulder
// girdle, pelvic girdle, front and hind limbs, each group in its own colour.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

export const SKELETON_PARTS: FigurePart[] = [
  { id: "skull", label: tx("skull", "Schädel"), at: [126, 98], info: tx("Protects the brain and sense organs and carries the jaws with the teeth.", "Schützt Gehirn und Sinnesorgane und trägt die Kiefer mit den Zähnen.") },
  { id: "spine", label: tx("backbone", "Wirbelsäule"), at: [290, 104], tag: [300, 52], info: tx("Neck, chest, lumbar, sacral and tail vertebrae: carries the body and protects the spinal cord.", "Hals-, Brust-, Lenden-, Kreuzbein- und Schwanzwirbel: trägt den Körper und schützt das Rückenmark.") },
  { id: "ribs", label: tx("ribs and breastbone", "Rippen und Brustbein"), at: [300, 168], info: tx("Form the rib cage, which protects the heart and lungs.", "Bilden den Brustkorb, der Herz und Lunge schützt.") },
  { id: "shoulder", label: tx("shoulder girdle", "Schultergürtel"), at: [246, 132], tag: [214, 60], info: tx("Shoulder blade (and in many animals the collarbone): joins the front limbs to the trunk.", "Schulterblatt (bei vielen Tieren auch Schlüsselbein): verbindet die Vordergliedmaßen mit dem Rumpf.") },
  { id: "pelvis", label: tx("pelvic girdle", "Beckengürtel"), at: [424, 124], tag: [452, 70], info: tx("The pelvis: joins the hind limbs firmly to the backbone.", "Das Becken: verbindet die Hintergliedmaßen fest mit der Wirbelsäule.") },
  { id: "fore", label: tx("front limb", "Vordergliedmaße"), at: [238, 236], tag: [170, 236], info: tx("Upper arm, ulna and radius, wrist, palm bones, fingers.", "Oberarm, Elle und Speiche, Handwurzel, Mittelhand, Finger.") },
  { id: "hind", label: tx("hind limb", "Hintergliedmaße"), at: [430, 224], tag: [496, 236], info: tx("Thigh bone, shin and calf bone, ankle, foot bones, toes.", "Oberschenkel, Schien- und Wadenbein, Fußwurzel, Mittelfuß, Zehen.") },
];

const LINE = "var(--bio-outline)";
const C = {
  skull: "color-mix(in oklab, var(--bio-nucleus) 70%, var(--raised))",
  spine: "color-mix(in oklab, var(--bio-pollen) 60%, var(--raised))",
  ribs: "var(--bio-bone)",
  girdle: "color-mix(in oklab, var(--bio-mito) 75%, var(--raised))",
  fore: "color-mix(in oklab, var(--bio-water) 65%, var(--raised))",
  hind: "color-mix(in oklab, var(--bio-leaf) 70%, var(--raised))",
};

function Bone({ d, w, fill }: { d: string; w: number; fill: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={LINE} strokeWidth={w + 2.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function chain(p: number[], n: number, size: (t: number) => [number, number], fill: string) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const at = (t: number) => {
    const u = 1 - t;
    return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3];
  };
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const [x, y] = at(t);
    const [xa, ya] = at(Math.max(0, t - 0.01));
    const [xb, yb] = at(Math.min(1, t + 0.01));
    const a = (Math.atan2(yb - ya, xb - xa) * 180) / Math.PI;
    const [w, h] = size(t);
    return <rect key={i} x={x - w / 2} y={y - h / 2} width={w} height={h} rx={Math.min(w, h) / 3} transform={`rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={fill} stroke={LINE} strokeWidth={1.1} />;
  });
}

export function VertebrateSkeleton({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Basic plan of the vertebrate skeleton (dog)", "Grundbauplan des Wirbeltierskeletts (Hund)")} width={600} height={300} parts={SKELETON_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g strokeLinejoin="round" strokeLinecap="round">
        <line x1={20} x2={580} y1={294} y2={294} stroke="var(--line-2)" strokeWidth={2} />

        {/* hind limb behind the pelvis */}
        <g data-part="hind">
          <Bone d="M424 136 L 410 196" w={10} fill={C.hind} />
          <Bone d="M410 198 L 440 248" w={8} fill={C.hind} />
          <Bone d="M414 202 L 436 240" w={2.6} fill={C.hind} />
          <Bone d="M442 250 L 432 282" w={6} fill={C.hind} />
          <Bone d="M432 284 L 414 291" w={4} fill={C.hind} />
          <circle cx={407} cy={193} r={4.5} fill={C.hind} stroke={LINE} strokeWidth={1.1} />
        </g>

        {/* ribs and breastbone */}
        <g data-part="ribs">
          {Array.from({ length: 11 }, (_, i) => {
            const x = 222 + i * 10.5;
            const depth = 98 - Math.abs(i - 4) * 5;
            return <Bone key={i} d={`M${x} 116 C ${x + 18} ${130 + depth * 0.3}, ${x + 14} ${110 + depth}, ${x - 6} ${116 + depth}`} w={3} fill={C.ribs} />;
          })}
          <Bone d="M222 208 C 250 214, 280 216, 306 210" w={5} fill={C.ribs} />
        </g>

        {/* backbone: neck, chest, lumbar, sacrum, tail */}
        <g data-part="spine">
          {chain([170, 100, 186, 108, 200, 114, 216, 116], 7, () => [9, 10], C.spine)}
          {chain([216, 116, 250, 104, 300, 104, 332, 110], 13, () => [8, 12], C.spine)}
          {chain([332, 110, 352, 112, 376, 114, 400, 118], 6, () => [11, 13], C.spine)}
          <path d="M398 112 L 440 122 L 438 134 L 398 126 Z" fill={C.spine} stroke={LINE} strokeWidth={1.2} />
          {chain([442, 128, 480, 140, 530, 156, 578, 178], 15, (t) => [9 - t * 4, 8 - t * 4], C.spine)}
        </g>

        {/* pelvis */}
        <g data-part="pelvis">
          <path d="M392 108 C 412 100, 442 108, 454 122 C 450 138, 434 146, 422 148 L 404 140 C 398 132, 392 122, 392 108 Z" fill={C.girdle} stroke={LINE} strokeWidth={1.5} />
          <circle cx={424} cy={136} r={6} fill="var(--raised)" stroke={LINE} strokeWidth={1.2} />
        </g>

        {/* skull and lower jaw */}
        <g data-part="skull">
          <path d="M48 108 C 50 96, 70 88, 100 84 C 120 70, 150 66, 168 80 C 178 90, 176 110, 164 118 C 140 124, 110 122, 90 120 L 60 118 C 52 117, 48 114, 48 108 Z" fill={C.skull} stroke={LINE} strokeWidth={1.6} />
          <circle cx={128} cy={93} r={9} fill="var(--raised)" stroke={LINE} strokeWidth={1.2} />
          <path d="M54 120 C 70 126, 110 130, 150 124 C 154 132, 142 138, 120 136 C 90 136, 66 132, 54 124 Z" fill={C.skull} stroke={LINE} strokeWidth={1.5} />
        </g>

        {/* shoulder blade */}
        <path data-part="shoulder" d="M228 110 C 244 102, 266 104, 272 112 L 238 172 C 232 172, 226 168, 226 162 Z" fill={C.girdle} stroke={LINE} strokeWidth={1.5} />

        {/* front limb */}
        <g data-part="fore">
          <Bone d="M232 172 L 246 218" w={9} fill={C.fore} />
          <Bone d="M244 220 L 238 262" w={5} fill={C.fore} />
          <Bone d="M250 214 L 244 262" w={4} fill={C.fore} />
          <rect x={232} y={262} width={14} height={8} rx={3} fill={C.fore} stroke={LINE} strokeWidth={1.1} />
          <Bone d="M238 272 L 230 284" w={4} fill={C.fore} />
          <Bone d="M230 286 L 216 291" w={3.4} fill={C.fore} />
        </g>
      </g>
    </Figure>
  );
}

export const VertebrateSkeletonExplore = () => <VertebrateSkeleton mode="explore" />;
