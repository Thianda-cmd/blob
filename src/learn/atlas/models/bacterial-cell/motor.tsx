"use client";

import { motion } from "motion/react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import type { Spot } from "../../types";
import { Bilayer, useIds, wave, wavePoint } from "../kit";

/**
 * The flagellar motor of a Gram-negative bacterium in section: filament with cap, hook, rod,
 * L and P rings (bearings), MS ring (rotor), C ring (switch), stators and the export apparatus.
 * Protons flow in through the stators; that turns the rotor.
 */

export const W = 900;
export const H = 560;

const X = 430; // the motor's axis
const OM = 214; // outer membrane, top face
const PG = 270; // murein layer, top
const IM = 318; // inner membrane, top face
const MEM_H = 26;

const HOOK = `M ${X} ${OM + 2} C ${X} ${OM - 30}, ${X + 8} ${OM - 52}, ${X + 34} ${OM - 62}`;
const FIL_X = X + 34;
const FIL_Y = OM - 62;
const FILAMENT = wave(FIL_X, FIL_Y, 120, -84, 7, 70, 0);
const TIP = wavePoint(FIL_X, FIL_Y, 120, -84, 7, 70, 0);

export const SPOTS = {
  filament: { at: [FIL_X + 6, FIL_Y - 60], label: [640, 74], side: "r" },
  cap: { at: [TIP[0], TIP[1] - 4], label: [640, 28], side: "r" },
  hook: { at: [X + 12, OM - 40], label: [640, 128], side: "r" },
  lring: { at: [X + 34, OM + 13], label: [640, 184], side: "r" },
  rod: { at: [X, PG - 8], label: [640, 238], side: "r" },
  pring: { at: [X + 30, PG + 8], label: [640, 286], side: "r" },
  msring: { at: [X + 44, IM + 13], label: [640, 334], side: "r" },
  stator: { at: [X + 152, IM + 6], label: [640, 382], side: "r" },
  cring: { at: [X + 80, IM + 74], label: [640, 432], side: "r" },
  export: { at: [X, IM + 98], label: [640, 482], side: "r" },
} satisfies Record<string, Spot>;

const PROTON_PATHS = [X - 152, X + 152];

export function Motor() {
  const tt = useText();
  const id = useIds("pg", "rotor", "bearing", "fil");
  const layer = (y: number, label: string) => (
    <text x={16} y={y} fontSize={13} fontWeight={500} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" style={{ fontFamily: "var(--font-sans)" }}>
      {label}
    </text>
  );
  return (
    <g>
      <defs>
        <pattern id={id.pg} width="12" height="10" patternUnits="userSpaceOnUse">
          <rect width="12" height="10" fill="var(--bio-murein)" />
          <path d="M 0 5 H 12 M 6 0 V 10" stroke="var(--bio-murein-deep)" strokeWidth={1.1} />
        </pattern>
        <linearGradient id={id.rotor} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-nucleus) 70%, var(--bio-nucleus-deep))" />
          <stop offset="0.5" stopColor="var(--bio-nucleus)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-nucleus) 70%, var(--bio-nucleus-deep))" />
        </linearGradient>
        <linearGradient id={id.bearing} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-protein)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-protein) 75%, var(--bio-protein-deep))" />
        </linearGradient>
      </defs>

      {/* The envelope: outer membrane with LPS, periplasm with murein, inner membrane. */}
      <g data-deco>
        <rect x={0} y={OM + MEM_H} width={W} height={IM - OM - MEM_H} fill="color-mix(in oklab, var(--bio-capsule) 45%, transparent)" />
        <rect x={0} y={IM + MEM_H} width={W} height={H - IM - MEM_H} fill="var(--bio-cell)" opacity={0.75} />
        {Array.from({ length: 50 }, (_, i) => 8 + i * 18)
          .filter((x) => Math.abs(x - X) > 70)
          .map((x) => (
            <path key={x} d={`M ${x} ${OM} v -10 m -3 -2 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`} stroke="var(--bio-lps-deep)" strokeWidth={1.3} fill="var(--bio-lps)" />
          ))}
        <Bilayer x0={0} x1={W} y={OM} h={MEM_H} skip={(x) => Math.abs(x - X) < 68} />
        <rect x={0} y={PG} width={W} height={18} fill={`url(#${id.pg})`} opacity={0.95} />
        <Bilayer x0={0} x1={W} y={IM} h={MEM_H} skip={(x) => Math.abs(x - X) < 80 || Math.abs(Math.abs(x - X) - 152) < 20} />
        {layer(OM - 22, tt(tx("outside", "außen")))}
        {layer(OM + 18, tt(tx("outer membrane", "äußere Membran")))}
        {layer(PG + 14, tt(tx("murein", "Murein")))}
        {layer(PG + 38, tt(tx("periplasm", "Periplasma")))}
        {layer(IM + 18, tt(tx("cytoplasmic membrane", "Cytoplasmamembran")))}
        {layer(IM + 64, tt(tx("cytoplasm", "Cytoplasma")))}
      </g>

      <g data-part="filament">
        <path d={FILAMENT} fill="none" stroke="var(--bio-outline)" strokeWidth={12} strokeLinecap="round" />
        <path d={FILAMENT} fill="none" stroke="var(--bio-bone)" strokeWidth={8} strokeLinecap="round" />
        <path d={FILAMENT} fill="none" stroke="var(--bio-outline)" strokeWidth={1} strokeDasharray="2 5" opacity={0.6} />
      </g>
      <g data-part="cap">
        <rect x={TIP[0] - 9} y={TIP[1] - 8} width={18} height={10} rx={3} fill="var(--bio-sugar)" stroke="var(--bio-sugar-deep)" strokeWidth={1.3} transform={`rotate(6 ${TIP[0]} ${TIP[1]})`} />
      </g>
      <g data-part="hook">
        <path d={HOOK} fill="none" stroke="var(--bio-outline)" strokeWidth={13} strokeLinecap="round" />
        <path d={HOOK} fill="none" stroke="var(--bio-mito)" strokeWidth={9} strokeLinecap="round" />
      </g>
      <g data-part="rod">
        <rect x={X - 8} y={OM - 2} width={16} height={IM + 30 - OM} rx={4} fill={`url(#${id.rotor})`} stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="lring">
        <rect x={X - 44} y={OM + 2} width={28} height={22} rx={6} fill={`url(#${id.bearing})`} stroke="var(--bio-protein-deep)" strokeWidth={1.3} />
        <rect x={X + 16} y={OM + 2} width={28} height={22} rx={6} fill={`url(#${id.bearing})`} stroke="var(--bio-protein-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="pring">
        <rect x={X - 40} y={PG - 2} width={24} height={22} rx={6} fill={`url(#${id.bearing})`} stroke="var(--bio-protein-deep)" strokeWidth={1.3} />
        <rect x={X + 16} y={PG - 2} width={24} height={22} rx={6} fill={`url(#${id.bearing})`} stroke="var(--bio-protein-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="msring">
        <path d={`M ${X - 60} ${IM + 2} h 52 v 24 h -52 q -8 0 -8 -8 v -8 q 0 -8 8 -8 Z M ${X + 60} ${IM + 2} h -52 v 24 h 52 q 8 0 8 -8 v -8 q 0 -8 -8 -8 Z`} fill={`url(#${id.rotor})`} stroke="var(--bio-nucleus-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="cring">
        <path
          d={`M ${X - 66} ${IM + 30} L ${X - 92} ${IM + 92} Q ${X - 94} ${IM + 100} ${X - 84} ${IM + 100} L ${X - 62} ${IM + 100} L ${X - 46} ${IM + 30} Z M ${X + 66} ${IM + 30} L ${X + 92} ${IM + 92} Q ${X + 94} ${IM + 100} ${X + 84} ${IM + 100} L ${X + 62} ${IM + 100} L ${X + 46} ${IM + 30} Z`}
          fill={`url(#${id.rotor})`}
          stroke="var(--bio-nucleus-deep)"
          strokeWidth={1.3}
        />
      </g>
      <g data-part="export">
        <rect x={X - 22} y={IM + 34} width={44} height={36} rx={10} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
        {[-15, -5, 5, 15].map((dx) => (
          <circle key={dx} cx={X + dx} cy={IM + 84} r={6} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
        ))}
      </g>
      <g data-part="stator">
        {PROTON_PATHS.map((sx) => (
          <g key={sx}>
            {/* MotB reaches up to the murein; MotA sits in the membrane. */}
            <rect x={sx - 4} y={PG + 16} width={8} height={IM - PG - 14} rx={3} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
            <rect x={sx - 18} y={IM - 4} width={36} height={MEM_H + 10} rx={8} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
            <rect x={sx - 3} y={IM - 2} width={6} height={MEM_H + 6} rx={3} fill="var(--bio-cell)" opacity={0.85} />
          </g>
        ))}
      </g>

      {/* Protons flowing in through the stators. */}
      <g data-deco>
        {PROTON_PATHS.map((sx, k) =>
          [0, 1, 2].map((i) => (
            <motion.g key={`${k}${i}`} initial={{ y: -44, opacity: 0 }} animate={{ y: [-44, 0, 60], opacity: [0, 1, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 + k * 0.4, ease: "linear" }}>
              <circle cx={sx} cy={IM + 4} r={7} fill="var(--bio-ion)" />
              <text x={sx} y={IM + 4} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill="#fff" style={{ fontFamily: "var(--font-sans)" }}>
                H⁺
              </text>
            </motion.g>
          )),
        )}
        {/* The rotor turns. */}
        <path d={`M ${X - 108} ${IM + 120} A 108 18 0 0 0 ${X + 108} ${IM + 120}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="4 5" />
        <path d={`M ${X + 100} ${IM + 112} l 10 7 l -11 5`} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}
