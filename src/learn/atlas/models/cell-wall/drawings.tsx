"use client";

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cos, sin } from "@/lib/stableMath";
import type { Spot } from "../../types";
import { Bilayer, r1, useIds } from "../kit";

/** The bacterial cell envelope in section (Gram-positive, Gram-negative) and murein as molecules. */

export const W = 900;

/** A small name in the drawing, readable over busy parts thanks to a halo. */
function Layer({ x = 16, y, children, anchor = "start" }: { x?: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={13} fontWeight={500} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </text>
  );
}

/** A beaded chain from (x, y0) up to (x, y1), with a gentle wiggle. */
function Chain({ x, y0, y1, r = 4.2, gap = 10, fill, stroke, phase = 0 }: { x: number; y0: number; y1: number; r?: number; gap?: number; fill: string; stroke: string; phase?: number }) {
  const n = Math.max(1, Math.floor(Math.abs(y0 - y1) / gap));
  const dir = y1 < y0 ? -1 : 1;
  return (
    <g>
      {Array.from({ length: n + 1 }, (_, i) => {
        const y = y0 + dir * i * gap;
        const cx = r1(x + 4 * sin(i * 0.7 + phase));
        return <circle key={i} cx={cx} cy={r1(y)} r={r} fill={fill} stroke={stroke} strokeWidth={1} />;
      })}
    </g>
  );
}

/** Rows of sugar beads with peptide links: the look of a murein layer. */
function MureinPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width="44" height="22" patternUnits="userSpaceOnUse">
      <rect width="44" height="22" fill="var(--bio-murein)" />
      <path d="M 0 7 H 44" stroke="var(--bio-murein-deep)" strokeWidth={1.4} />
      <rect x="3" y="3" width="14" height="8" rx="3" fill="color-mix(in oklab, var(--bio-murein) 70%, white)" stroke="var(--bio-murein-deep)" strokeWidth={1} />
      <rect x="25" y="3" width="14" height="8" rx="3" fill="color-mix(in oklab, var(--bio-murein) 75%, var(--bio-murein-deep))" stroke="var(--bio-murein-deep)" strokeWidth={1} />
      <path d="M 32 11 V 22" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
    </pattern>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export const POS_H = 540;
const P_MUR = 92; // murein top
const P_MEM = 336; // membrane top

export const POS_SPOTS = {
  teichoic: { at: [302, 120], label: [190, 22], side: "c" },
  lipoteichoic: { at: [412, 160], label: [420, 22], side: "c" },
  surface: { at: [642, 58], label: [680, 22], side: "c" },
  murein: { at: [560, 214], label: [190, 506], side: "c" },
  pbp: { at: [470, 326], label: [470, 506], side: "c" },
  membrane: { at: [760, 349], label: [745, 506], side: "c" },
} satisfies Record<string, Spot>;

export function GramPositive() {
  const tt = useText();
  const id = useIds("mur");
  const wta = [120, 302, 520, 708, 836];
  const lta = [212, 412, 612, 772];
  return (
    <g>
      <defs>
        <MureinPattern id={id.mur} />
      </defs>
      <g data-deco>
        <rect x={0} y={P_MEM + 26} width={W} height={POS_H - P_MEM - 26} fill="var(--bio-cell)" opacity={0.8} />
      </g>
      <g data-part="murein">
        <rect x={0} y={P_MUR} width={W} height={P_MEM - P_MUR - 6} fill={`url(#${id.mur})`} />
        <rect x={0} y={P_MUR} width={W} height={P_MEM - P_MUR - 6} fill="none" stroke="var(--bio-murein-deep)" strokeWidth={1.2} />
      </g>
      <g data-part="membrane">
        <Bilayer x0={0} x1={W} y={P_MEM} h={26} />
      </g>
      <g data-part="teichoic">
        {wta.map((x, i) => (
          <Chain key={x} x={x} y0={P_MUR + 150} y1={34 + (i % 2) * 14} fill="var(--bio-water)" stroke="var(--bio-water-deep)" phase={i} />
        ))}
      </g>
      <g data-part="lipoteichoic">
        {lta.map((x, i) => (
          <g key={x}>
            <path d={`M ${x - 3} ${P_MEM + 2} v 10 M ${x + 3} ${P_MEM + 2} v 10`} stroke="var(--bio-sugar-deep)" strokeWidth={1.6} />
            <Chain x={x} y0={P_MEM - 2} y1={48 + (i % 2) * 12} fill="var(--bio-sugar)" stroke="var(--bio-sugar-deep)" phase={i + 2} />
          </g>
        ))}
      </g>
      <g data-part="surface">
        {[362, 642].map((x) => (
          <g key={x}>
            <path d={`M ${x} ${P_MUR + 40} V ${P_MUR}`} stroke="var(--bio-protein-deep)" strokeWidth={2} />
            {[0, 1, 2, 3].map((k) => (
              <ellipse key={k} cx={x + (k % 2 ? 5 : -5)} cy={P_MUR - 10 - k * 15} rx={11} ry={8} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" strokeWidth={1.2} />
            ))}
          </g>
        ))}
      </g>
      <g data-part="pbp">
        {[160, 470, 740].map((x) => (
          <g key={x}>
            <path d={`M ${x} ${P_MEM + 4} v 12`} stroke="var(--bio-mito-deep)" strokeWidth={2.4} />
            <path d={`M ${x - 18} ${P_MEM - 4} q 0 -18 18 -18 q 18 0 18 18 q -4 8 -18 8 q -14 0 -18 -8 Z`} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.3} />
          </g>
        ))}
      </g>
      <g data-deco>
        <Layer y={P_MUR - 18} x={884} anchor="end">{tt(tx("outside", "außen"))}</Layer>
        <Layer y={P_MUR + 130} x={884} anchor="end">{tt(tx("murein (thick)", "Murein (dick)"))}</Layer>
        <Layer y={P_MEM + 60} x={884} anchor="end">{tt(tx("cytoplasm", "Cytoplasma"))}</Layer>
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export const NEG_H = 560;
const N_OM = 192; // outer membrane top
const N_PG = 270; // murein top
const N_IM = 342; // inner membrane top

const PORINS = [252, 640];
const LPS_X = Array.from({ length: 60 }, (_, i) => 6 + i * 15).filter((x) => PORINS.every((p) => Math.abs(x - p) > 34));

export const NEG_SPOTS = {
  oantigen: { at: [336, 104], label: [100, 22], side: "c" },
  core: { at: [426, 166], label: [282, 22], side: "c" },
  lipida: { at: [516, 197], label: [470, 22], side: "c" },
  porin: { at: [640, 206], label: [640, 22], side: "c" },
  outer: { at: [846, 212], label: [812, 22], side: "c" },
  lipoprotein: { at: [124, 240], label: [130, 524], side: "c" },
  periplasm: { at: [330, 312], label: [330, 524], side: "c" },
  thin: { at: [560, 277], label: [560, 524], side: "c" },
  inner: { at: [770, 355], label: [776, 524], side: "c" },
} satisfies Record<string, Spot>;

export function GramNegative() {
  const tt = useText();
  const id = useIds("mur", "lps");
  return (
    <g>
      <defs>
        <MureinPattern id={id.mur} />
      </defs>
      <g data-part="periplasm">
        <rect x={0} y={N_OM + 26} width={W} height={N_IM - N_OM - 26} fill="color-mix(in oklab, var(--bio-capsule) 70%, transparent)" />
        {[60, 210, 380, 470, 700, 820].map((x, i) => (
          <circle key={x} cx={x} cy={N_OM + 40 + (i % 3) * 30 + (i % 2 ? 60 : 0)} r={5} fill="var(--bio-capsule-deep)" opacity={0.45} />
        ))}
      </g>
      <g data-deco>
        <rect x={0} y={N_IM + 26} width={W} height={NEG_H - N_IM - 26} fill="var(--bio-cell)" opacity={0.8} />
      </g>
      <g data-part="thin">
        <rect x={0} y={N_PG} width={W} height={15} fill={`url(#${id.mur})`} />
        <rect x={0} y={N_PG} width={W} height={15} fill="none" stroke="var(--bio-murein-deep)" strokeWidth={1.1} />
      </g>
      <g data-part="inner">
        <Bilayer x0={0} x1={W} y={N_IM} h={26} />
      </g>
      <g data-part="outer">
        <Bilayer x0={0} x1={W} y={N_OM} h={26} skip={(x) => PORINS.some((p) => Math.abs(x - p) < 30)} />
      </g>
      <g data-part="lipida">
        {LPS_X.map((x) => (
          <g key={x}>
            <path d={`M ${x - 3} ${N_OM + 6} v 8 M ${x} ${N_OM + 6} v 9 M ${x + 3} ${N_OM + 6} v 8`} stroke="var(--bio-lps-deep)" strokeWidth={1.2} />
            <rect x={x - 5.5} y={N_OM - 2} width={11} height={8} rx={3} fill="var(--bio-lps-deep)" />
          </g>
        ))}
      </g>
      <g data-part="core">
        {LPS_X.map((x, i) => (
          <g key={x}>
            <path d={`M ${x} ${N_OM - 2} V ${N_OM - 30} M ${x} ${N_OM - 16} l ${i % 2 ? 6 : -6} -6`} stroke="var(--bio-lps-deep)" strokeWidth={1.4} />
            {[N_OM - 10, N_OM - 20, N_OM - 30].map((y) => (
              <circle key={y} cx={x} cy={y} r={3.6} fill="var(--bio-lps)" stroke="var(--bio-lps-deep)" strokeWidth={0.9} />
            ))}
          </g>
        ))}
      </g>
      <g data-part="oantigen">
        {LPS_X.map((x, i) => {
          const len = 4 + ((i * 5) % 7);
          return (
            <g key={x}>
              {Array.from({ length: len }, (_, k) => (
                <rect key={k} x={r1(x - 3.8 + 2.4 * sin(k * 0.9 + i))} y={N_OM - 41 - k * 9} width={7.6} height={7.6} rx={2} fill="var(--bio-sugar)" stroke="var(--bio-sugar-deep)" strokeWidth={0.9} />
              ))}
            </g>
          );
        })}
      </g>
      <g data-part="porin">
        {PORINS.map((x) => (
          <g key={x}>
            <rect x={x - 28} y={N_OM - 6} width={24} height={38} rx={9} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" strokeWidth={1.4} />
            <rect x={x + 4} y={N_OM - 6} width={24} height={38} rx={9} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" strokeWidth={1.4} />
            <rect x={x - 4} y={N_OM - 6} width={8} height={38} fill="color-mix(in oklab, var(--bio-capsule) 60%, var(--raised))" />
          </g>
        ))}
      </g>
      <g data-part="lipoprotein">
        {[124, 450, 780].map((x) => (
          <g key={x}>
            <path d={`M ${x - 3} ${N_OM + 16} v 8 M ${x + 3} ${N_OM + 16} v 8`} stroke="var(--bio-mito-deep)" strokeWidth={1.5} />
            <path d={`M ${x} ${N_OM + 24} q 8 5 0 10 q -8 5 0 10 q 8 5 0 10 q -8 5 0 10 q 8 5 0 10 L ${x} ${N_PG + 4}`} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={2.6} strokeLinecap="round" />
          </g>
        ))}
      </g>
      <g data-deco>
        <Layer y={N_OM + 64} x={884} anchor="end">{tt(tx("periplasm", "Periplasma"))}</Layer>
        <Layer y={N_IM + 64} x={884} anchor="end">{tt(tx("cytoplasm", "Cytoplasma"))}</Layer>
        <Layer y={N_OM - 128} x={884} anchor="end">{tt(tx("outside: LPS", "außen: LPS"))}</Layer>
      </g>
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export const MUR_H = 566;
const STRANDS = [104, 274, 470];
const XS = Array.from({ length: 12 }, (_, i) => 70 + i * 70);
const SUGAR_R = 21;
const BEAD = 15; // spacing of amino acids
const BEAD_COLORS = ["var(--bio-a)", "var(--bio-c)", "var(--bio-g)", "var(--bio-t)"];

/** Peptide beads hanging from a NAM, down (dir 1) or up (dir -1). Returns the last bead's y. */
function peptide(x: number, y: number, dir: 1 | -1) {
  return Array.from({ length: 4 }, (_, k) => [x, y + dir * (SUGAR_R + 9 + k * BEAD)] as const);
}

function hexagon(x: number, y: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${r1(x + r * cos(a))},${r1(y + r * sin(a))}`;
  });
  return pts.join(" ");
}

export const MUR_SPOTS = {
  glycan: { at: [104, STRANDS[0] - 22], label: [200, 24], side: "c" },
  nag: { at: [364, STRANDS[0] + 14], label: [450, 24], side: "c" },
  nam: { at: [714, STRANDS[0] + 14], label: [720, 24], side: "c" },
  glycosidic: { at: [245, STRANDS[1]], label: [236, 544], side: "c" },
  peptide: { at: [560, STRANDS[1] + SUGAR_R + 24], label: [520, 544], side: "c" },
  crosslink: { at: [700, STRANDS[0] + 94], label: [770, 544], side: "c" },
} satisfies Record<string, Spot>;

export function Murein() {
  const tt = useText();
  // Strand 1 peptides hang down; strand 2's go up (to strand 1) at x = 140, 420, 700 and down (to strand 3) at 280, 560, 840.
  const down1 = XS.filter((_, i) => i % 2 === 1).map((x) => ({ x, beads: peptide(x, STRANDS[0], 1) }));
  const up2 = [140, 420, 700].map((x) => ({ x, beads: peptide(x, STRANDS[1], -1) }));
  const down2 = [280, 560, 840].map((x) => ({ x, beads: peptide(x, STRANDS[1], 1) }));
  const up3 = [280, 560, 840].map((x) => ({ x, beads: peptide(x, STRANDS[2], -1) }));
  return (
    <g>
      <g data-part="glycan">
        {STRANDS.map((y) => (
          <rect key={y} x={34} y={y - 32} width={W - 68} height={64} rx={32} fill="color-mix(in oklab, var(--bio-murein) 35%, transparent)" stroke="var(--bio-murein-deep)" strokeWidth={1} strokeDasharray="4 5" />
        ))}
      </g>
      <g data-part="glycosidic">
        {STRANDS.map((y) => XS.slice(0, -1).map((x) => <line key={`${x}${y}`} x1={x + SUGAR_R - 2} y1={y} x2={x + 70 - SUGAR_R + 2} y2={y} stroke="var(--bio-outline)" strokeWidth={4} strokeLinecap="round" />))}
      </g>
      <g data-part="peptide">
        {[...down1, ...up2, ...down2, ...up3].map(({ x, beads }) => (
          <g key={`${x}-${beads[0][1]}`}>
            <line x1={x} y1={beads[0][1]} x2={x} y2={beads[3][1]} stroke="var(--bio-outline)" strokeWidth={1.6} />
            {beads.map(([bx, by], k) => (
              <circle key={k} cx={bx} cy={by} r={6.2} fill={BEAD_COLORS[k]} stroke="var(--bio-outline)" strokeWidth={1} />
            ))}
          </g>
        ))}
      </g>
      <g data-part="crosslink">
        {/* Gram-negative: a direct bond between strands 1 and 2. */}
        {[140, 420, 700].map((x) => {
          const a = down1.find((d) => d.x === x)!.beads[3];
          const b = up2.find((d) => d.x === x)!.beads[2];
          return <path key={x} d={`M ${x} ${a[1] + 6} C ${x + 18} ${a[1] + 14}, ${x + 18} ${b[1] - 12}, ${x} ${b[1] - 6}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3.4} strokeLinecap="round" />;
        })}
        {/* Gram-positive (S. aureus): a pentaglycine bridge between strands 2 and 3. */}
        {[280, 560, 840].map((x) => {
          const a = down2.find((d) => d.x === x)!.beads[2];
          const b = up3.find((d) => d.x === x)!.beads[3];
          const y0 = a[1];
          const y1 = b[1];
          return (
            <g key={x}>
              <path d={`M ${x} ${y0} C ${x + 30} ${y0 + 10}, ${x + 30} ${y1 - 10}, ${x} ${y1}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
              {[0.18, 0.34, 0.5, 0.66, 0.82].map((t) => {
                // Points along the bridge curve.
                const u = 1 - t;
                const px = u ** 3 * x + 3 * u * u * t * (x + 30) + 3 * u * t * t * (x + 30) + t ** 3 * x;
                const py = u ** 3 * y0 + 3 * u * u * t * (y0 + 10) + 3 * u * t * t * (y1 - 10) + t ** 3 * y1;
                return <circle key={t} cx={r1(px)} cy={r1(py)} r={4.6} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />;
              })}
            </g>
          );
        })}
      </g>
      <g data-part="nag">
        {STRANDS.map((y) => XS.filter((_, i) => i % 2 === 0).map((x) => <polygon key={`${x}${y}`} points={hexagon(x, y, SUGAR_R)} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.6} />))}
      </g>
      <g data-part="nam">
        {STRANDS.map((y) => XS.filter((_, i) => i % 2 === 1).map((x) => <polygon key={`${x}${y}`} points={hexagon(x, y, SUGAR_R)} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />))}
      </g>
      <g data-deco style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
        {STRANDS.map((y) =>
          XS.map((x, i) => (
            <text key={`${x}${y}`} x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={i % 2 ? "var(--bio-nucleus-deep)" : "var(--bio-water-deep)"}>
              {i % 2 ? "NAM" : "NAG"}
            </text>
          )),
        )}
        <Layer x={210} y={(STRANDS[0] + STRANDS[1]) / 2 + 4} anchor="middle">{tt(tx("Gram−: direct", "Gram−: direkt"))}</Layer>
        <Layer x={150} y={(STRANDS[1] + STRANDS[2]) / 2 + 4} anchor="middle">{tt(tx("Gram+ (S. aureus): pentaglycine", "Gram+ (S. aureus): Pentaglycin"))}</Layer>
        {(
          [
            ["L-Ala", 0, 0],
            ["D-Glu", 1, 0],
            ["DAP / L-Lys", 2, 1],
            ["D-Ala", 3, 1],
          ] as const
        ).map(([name, k, row], i) => (
          <g key={name} transform={`translate(${36 + (i % 2) * 104} ${404 + row * 20})`}>
            <circle r={5.5} fill={BEAD_COLORS[k]} stroke="var(--bio-outline)" strokeWidth={1} />
            <text x={10} y={4} fontSize={11.5} fill="var(--ink-2)">
              {name}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
}
