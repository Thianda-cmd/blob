"use client";
import { cos, sin } from "@/lib/stableMath";

// Tiny molecule glyphs for the photosynthesis drawings, each drawn around (0, 0) so a parent
// <motion.g> can move it. Oxygen atoms are red, carbon dark, hydrogen light, as in school models.

const OUT = "var(--bio-outline)";

/** A water drop (level 1 style). */
export function PhotoDrop({ s = 1 }: { s?: number }) {
  return (
    <path
      d={`M0 ${-7 * s} C ${3.5 * s} ${-2 * s} ${5 * s} ${1 * s} ${5 * s} ${3 * s} A ${5 * s} ${5 * s} 0 0 1 ${-5 * s} ${3 * s} C ${-5 * s} ${1 * s} ${-3.5 * s} ${-2 * s} 0 ${-7 * s} Z`}
      fill="var(--bio-water)"
      stroke="var(--bio-water-deep)"
      strokeWidth={1.2}
    />
  );
}

/** H2O as a ball model: one red oxygen, two small hydrogens. */
export function PhotoH2O({ s = 1 }: { s?: number }) {
  return (
    <g>
      <circle cx={-4.2 * s} cy={3.4 * s} r={2.6 * s} fill="var(--bio-bone)" stroke={OUT} strokeWidth={0.9} />
      <circle cx={4.2 * s} cy={3.4 * s} r={2.6 * s} fill="var(--bio-bone)" stroke={OUT} strokeWidth={0.9} />
      <circle r={4.4 * s} fill="var(--bio-blood)" stroke={OUT} strokeWidth={1} />
    </g>
  );
}

/** CO2: O = C = O in a row. */
export function PhotoCO2({ s = 1 }: { s?: number }) {
  return (
    <g>
      <circle cx={-6.6 * s} r={3.8 * s} fill="var(--bio-blood)" stroke={OUT} strokeWidth={1} />
      <circle cx={6.6 * s} r={3.8 * s} fill="var(--bio-blood)" stroke={OUT} strokeWidth={1} />
      <circle r={4.4 * s} fill={OUT} stroke={OUT} strokeWidth={1} />
    </g>
  );
}

/** O2: two red atoms. */
export function PhotoO2({ s = 1 }: { s?: number }) {
  return (
    <g>
      <circle cx={-3.4 * s} r={4 * s} fill="var(--bio-blood)" stroke={OUT} strokeWidth={1} />
      <circle cx={3.4 * s} r={4 * s} fill="var(--bio-blood)" stroke={OUT} strokeWidth={1} />
    </g>
  );
}

const hex = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(r * cos(a)).toFixed(2)},${(r * sin(a)).toFixed(2)}`;
  }).join(" ");

/** Glucose (Traubenzucker) as a ring, the way school books draw sugar. */
export function PhotoGlucose({ s = 1 }: { s?: number }) {
  return <polygon points={hex(7 * s)} fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.3} strokeLinejoin="round" />;
}

/** Starch: a chain of glucose rings. */
export function PhotoStarchChain({ n, s = 1 }: { n: number; s?: number }) {
  const step = 11.6 * s;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * step} ${i % 2 ? 2.5 * s : -2.5 * s})`}>
          <polygon points={hex(6.4 * s)} fill="var(--bio-bone)" stroke={OUT} strokeWidth={1.1} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
}

/** A small round ion or electron with a symbol, e.g. H⁺ or e⁻. */
export function PhotoIon({ label, fill, r = 7 }: { label: string; fill: string; r?: number }) {
  return (
    <g>
      <circle r={r} fill={fill} stroke={OUT} strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 1.15} fontWeight={700} fill={OUT} style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
        {label}
      </text>
    </g>
  );
}

/** A labelled pill for a carrier molecule (ATP, NADPH…). */
export function PhotoPill({ label, fill, w = 38 }: { label: string; fill: string; w?: number }) {
  return (
    <g>
      <rect x={-w / 2} y={-8} width={w} height={16} rx={8} fill={fill} stroke={OUT} strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={OUT} style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
        {label}
      </text>
    </g>
  );
}
