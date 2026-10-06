"use client";

// The structure of an antibody (immunoglobulin G) as a labelled drawing: two heavy and two light
// chains held together by disulphide bridges, the variable regions at the tips forming two
// identical antigen-binding sites, the constant region in the stem. Plus a small ELISA plate
// picture for tasks.

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { bumpPath, PAINT } from "./ImmuneCells";

export const ANTIBODY_PARTS: FigurePart[] = [
  { id: "heavy", label: tx("heavy chain", "schwere Kette"), at: [226, 290], tag: [170, 296], info: tx("Two identical long chains. They form the stem and the inner half of each arm.", "Zwei identische lange Ketten. Sie bilden den Stamm und die innere Hälfte jedes Arms.") },
  { id: "light", label: tx("light chain", "leichte Kette"), at: [146, 108], tag: [78, 150], info: tx("Two identical short chains on the outer side of the arms.", "Zwei identische kurze Ketten an der Außenseite der Arme.") },
  { id: "variable", label: tx("variable region", "variable Region"), at: [348, 84], tag: [420, 128], info: tx("Differs from antibody to antibody. Parts of a heavy and a light chain together form the antigen-binding site.", "Ist bei jedem Antikörper anders. Teile einer schweren und einer leichten Kette bilden zusammen die Antigenbindungsstelle.") },
  { id: "constant", label: tx("constant region", "konstante Region"), at: [254, 262], tag: [320, 292], info: tx("The same in all antibodies of one class. The stem binds to phagocytes or mast cells.", "Bei allen Antikörpern einer Klasse gleich. Der Stamm bindet an Fresszellen oder Mastzellen.") },
  { id: "disulfide", label: tx("disulphide bridges", "Disulfidbrücken"), at: [240, 196], tag: [314, 200], info: tx("Covalent S–S bonds that hold the four chains together.", "Kovalente S–S-Bindungen, die die vier Ketten zusammenhalten.") },
  { id: "site", label: tx("antigen-binding site", "Antigenbindungsstelle"), at: [366, 54], tag: [436, 40], info: tx("Fits one antigen like a lock fits a key. Each antibody has two identical ones.", "Passt zu einem Antigen wie ein Schloss zum Schlüssel. Jeder Antikörper hat zwei identische.") },
  { id: "antigen", label: tx("antigen", "Antigen"), at: [84, 36], tag: [36, 70], info: tx("The structure on the pathogen that the antibody recognises.", "Die Struktur auf dem Erreger, die der Antikörper erkennt.") },
];

// Arm geometry: hinge (240, 190), tips (114, 64) and (366, 64).
const HEAVY_L = "M 226 322 L 226 180 Q 226 166 217 157 L 120 59";
const HEAVY_R = "M 254 322 L 254 180 Q 254 166 263 157 L 360 59";
const LIGHT_L = "M 107 71 L 178 142";
const LIGHT_R = "M 373 71 L 302 142";

function Chain({ d, color, deep, w }: { d: string; color: string; deep: string; w: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={deep} strokeWidth={w + 3.5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Antibody (IgG): chains, regions, disulphide bridges and binding sites. */
export function ImmuneAntibodyStructure({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Structure of an antibody (IgG)", "Bau eines Antikörpers (IgG)")} width={480} height={340} parts={ANTIBODY_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="constant">
        <rect x={204} y={206} width={72} height={124} rx={18} fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.6} strokeDasharray="5 4" />
        <path d="M 213 170 L 158 115 M 267 170 L 322 115" fill="none" stroke="var(--bio-water-deep)" strokeWidth={34} strokeLinecap="round" opacity={0.12} />
      </g>
      <g data-part="heavy">
        <Chain d={HEAVY_L} color="var(--bio-water)" deep="var(--bio-water-deep)" w={16} />
        <Chain d={HEAVY_R} color="var(--bio-water)" deep="var(--bio-water-deep)" w={16} />
      </g>
      <g data-part="light">
        <Chain d={LIGHT_L} color="var(--bio-vacuole)" deep="var(--bio-water-deep)" w={13} />
        <Chain d={LIGHT_R} color="var(--bio-vacuole)" deep="var(--bio-water-deep)" w={13} />
      </g>
      <g data-part="variable">
        <rect x={-38} y={-27} width={76} height={54} rx={18} transform="translate(130 82) rotate(45)" fill="var(--bio-nerve)" fillOpacity={0.4} stroke="var(--bio-nerve-deep)" strokeWidth={1.8} strokeDasharray="5 4" />
        <rect x={-38} y={-27} width={76} height={54} rx={18} transform="translate(350 82) rotate(-45)" fill="var(--bio-nerve)" fillOpacity={0.4} stroke="var(--bio-nerve-deep)" strokeWidth={1.8} strokeDasharray="5 4" />
      </g>
      <g data-part="disulfide">
        {[188, 202].map((y) => (
          <line key={y} x1={233} x2={247} y1={y} y2={y} stroke="var(--bio-c)" strokeWidth={4} strokeLinecap="round" />
        ))}
        <line x1={182} y1={142} x2={192} y2={132} stroke="var(--bio-c)" strokeWidth={4} strokeLinecap="round" />
        <line x1={298} y1={142} x2={288} y2={132} stroke="var(--bio-c)" strokeWidth={4} strokeLinecap="round" />
      </g>
      <g data-part="site">
        <path d="M 102 60 Q 112 50 124 52" fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={3} strokeLinecap="round" />
        <path d="M 378 60 Q 368 50 356 52" fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={366} cy={56} r={14} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={1.4} strokeDasharray="3 3" />
      </g>
      <g data-part="antigen">
        <circle cx={80} cy={30} r={18} fill={PAINT.virus.fill} stroke={PAINT.virus.stroke} strokeWidth={2} />
        <path d={bumpPath("tri", 7)} transform="translate(92.7 42.7) rotate(135)" fill={PAINT.virus.stroke} />
      </g>
    </Figure>
  );
}

/**
 * An ELISA plate strip: wells with colour intensity 0..1. The first two are the positive and the
 * negative control, then the samples numbered 1, 2, 3...
 */
export function ImmuneElisaPlate({ wells }: { wells: number[] }) {
  const t = useText();
  const n = wells.length;
  const W = 70 * n + 30;
  return (
    <svg viewBox={`0 0 ${W} 140`} className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(tx("ELISA plate", "ELISA-Platte"))}>
      <rect x={4} y={14} width={W - 8} height={96} rx={16} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.6} />
      {wells.map((v, i) => {
        const x = 50 + i * 70;
        return (
          <g key={i}>
            <circle cx={x} cy={62} r={26} fill="var(--bio-cell)" stroke="var(--ink-3)" strokeWidth={1.6} />
            <circle cx={x} cy={62} r={22} fill="var(--bio-water-deep)" opacity={Math.round(v * 85) / 100} />
            <text x={x} y={132} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {i === 0 ? "+" : i === 1 ? "−" : String(i - 1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
