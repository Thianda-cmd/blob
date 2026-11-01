"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import type { Spot } from "../../types";
import { Bilayer, useIds } from "../kit";

/** Transport across a membrane: outside at the top, the cell at the bottom; molecules on the move. */

export const W = 900;
export const H = 520;
const MY = 206; // membrane top
const MH = 44; // membrane thickness
const font = { fontFamily: "var(--font-sans)" };

function Sides() {
  const tt = useText();
  return (
    <g data-deco>
      <rect x={0} y={0} width={W} height={MY} fill="color-mix(in oklab, var(--bio-capsule) 45%, transparent)" />
      <rect x={0} y={MY + MH} width={W} height={H - MY - MH} fill="var(--bio-cell)" opacity={0.75} />
      <Label x={884} y={MY - 12} anchor="end">{tt(tx("outside", "außen"))}</Label>
      <Label x={884} y={MY + MH + 24} anchor="end">{tt(tx("cytoplasm", "Cytoplasma"))}</Label>
    </g>
  );
}

function Label({ x, y, children, anchor = "middle", size = 12.5 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={500} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" style={font}>
      {children}
    </text>
  );
}

/* Molecules ----------------------------------------------------------------------------------- */

function O2({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx={-4.5} r={6} fill="var(--bio-ion)" stroke="color-mix(in oklab, var(--bio-ion) 70%, black)" strokeWidth={1} />
      <circle cx={4.5} r={6} fill="var(--bio-ion)" stroke="color-mix(in oklab, var(--bio-ion) 70%, black)" strokeWidth={1} />
    </g>
  );
}

function Water({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={6.5} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1} />
      <circle cx={-6} cy={-5} r={3.2} fill="#fff" stroke="var(--bio-water-deep)" strokeWidth={0.8} />
      <circle cx={6} cy={-5} r={3.2} fill="#fff" stroke="var(--bio-water-deep)" strokeWidth={0.8} />
    </g>
  );
}

function Ion({ x, y, label, color, r = 9 }: { x: number; y: number; label: string; color: string; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={color} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.95} fontWeight={700} fill="#fff" style={font}>
        {label}
      </text>
    </g>
  );
}

function Glucose({ x, y, p = false }: { x: number; y: number; p?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5" fill="var(--bio-sugar-mol)" stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
      {p && (
        <g transform="translate(12 6)">
          <circle r={6} fill="var(--bio-a)" />
          <text textAnchor="middle" dominantBaseline="central" fontSize={7.5} fontWeight={700} fill="#fff" style={font}>
            P
          </text>
        </g>
      )}
    </g>
  );
}

function Atp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-20} y={-10} width={40} height={20} rx={10} fill="var(--bio-sun)" stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={800} fill="var(--bio-outline)" style={font}>
        ATP
      </text>
    </g>
  );
}

/** A thing that loops along a vertical path: from y0 to y1 (and fades in and out). */
function Move({ x, y0, y1, delay = 0, dur = 3.2, children }: { x: number; y0: number; y1: number; delay?: number; dur?: number; children: ReactNode }) {
  return (
    <motion.g
      initial={{ x, y: y0, opacity: 0 }}
      animate={{ x, y: [y0, y1], opacity: [0, 1, 1, 0] }}
      transition={{
        y: { duration: dur, delay, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: dur, delay, repeat: Infinity, times: [0, 0.15, 0.85, 1] },
      }}
    >
      {children}
    </motion.g>
  );
}

/** A transport protein across the membrane: two halves with a gap between them. */
function Protein({ x, w = 64, gap = 8, color = "var(--bio-protein)", deep = "var(--bio-protein-deep)", tall = 14, children }: { x: number; w?: number; gap?: number; color?: string; deep?: string; tall?: number; children?: ReactNode }) {
  const half = (w - gap) / 2;
  return (
    <g>
      <rect x={x - w / 2} y={MY - tall} width={half} height={MH + 2 * tall} rx={half / 2.2} fill={color} stroke={deep} strokeWidth={1.5} />
      <rect x={x + gap / 2} y={MY - tall} width={half} height={MH + 2 * tall} rx={half / 2.2} fill={color} stroke={deep} strokeWidth={1.5} />
      {children}
    </g>
  );
}

/* Passive --------------------------------------------------------------------------------------- */

const PX = { diffusion: 180, osmosis: 380, channel: 580, carrier: 770 };

export const PASSIVE_SPOTS = {
  gradient: { at: [44, 116], label: [120, 24], side: "c" },
  bilayer: { at: [690, MY + 22], label: [690, 24], side: "c" },
  diffusion: { at: [PX.diffusion, MY + 22], label: [PX.diffusion, 496], side: "c" },
  osmosis: { at: [PX.osmosis, MY - 8], label: [PX.osmosis, 496], side: "c" },
  channel: { at: [PX.channel, MY - 8], label: [PX.channel, 496], side: "c" },
  carrier: { at: [PX.carrier, MY - 8], label: [PX.carrier, 496], side: "c" },
} satisfies Record<string, Spot>;

export function Passive() {
  const tt = useText();
  const id = useIds("grad");
  const skip = (x: number) => Math.abs(x - PX.osmosis) < 34 || Math.abs(x - PX.channel) < 38 || Math.abs(x - PX.carrier) < 44;
  return (
    <g>
      <defs>
        <linearGradient id={id.grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-ion)" />
          <stop offset="1" stopColor="var(--bio-ion)" stopOpacity={0.12} />
        </linearGradient>
      </defs>
      <Sides />
      <g data-part="bilayer">
        <Bilayer x0={0} x1={W} y={MY} h={MH} gap={9} head={4.2} skip={skip} />
      </g>
      <g data-part="gradient">
        <path d="M 30 40 H 58 V 430 H 72 L 44 470 L 16 430 H 30 Z" fill={`url(#${id.grad})`} stroke="color-mix(in oklab, var(--bio-ion) 70%, black)" strokeWidth={1.2} />
        <Label x={86} y={70} anchor="start">{tt(tx("high", "hoch"))}</Label>
        <Label x={86} y={452} anchor="start">{tt(tx("low", "niedrig"))}</Label>
      </g>

      <g data-part="diffusion">
        {[
          [-40, 60],
          [26, 40],
          [-14, 120],
          [34, 150],
          [-46, 170],
          [8, 86],
        ].map(([dx, y], i) => (
          <O2 key={i} x={PX.diffusion + dx} y={y} />
        ))}
        {[
          [-30, 330],
          [30, 420],
        ].map(([dx, y], i) => (
          <O2 key={i} x={PX.diffusion + dx} y={y} />
        ))}
        <Move x={PX.diffusion} y0={150} y1={330}>
          <O2 x={0} y={0} />
        </Move>
        <Label x={PX.diffusion} y={460}>O₂, CO₂</Label>
      </g>

      <g data-part="osmosis">
        <Protein x={PX.osmosis} w={60} gap={10} color="color-mix(in oklab, var(--bio-water) 45%, var(--bio-protein))" />
        {[
          [-40, 70],
          [30, 52],
          [-18, 140],
          [40, 130],
          [-44, 176],
        ].map(([dx, y], i) => (
          <Water key={i} x={PX.osmosis + dx} y={y} />
        ))}
        {[0, 1, 2].map((i) => (
          <Move key={i} x={PX.osmosis} y0={150} y1={340} delay={i * 1.05}>
            <Water x={0} y={0} />
          </Move>
        ))}
        <Water x={PX.osmosis + 34} y={400} />
        <Label x={PX.osmosis} y={460}>H₂O</Label>
      </g>

      <g data-part="channel">
        <Protein x={PX.channel} w={70} gap={20} color="var(--bio-protein)">
          {/* The open gate. */}
          <path d={`M ${PX.channel - 25} ${MY - 14} q -6 -16 -16 -18`} fill="none" stroke="var(--bio-protein-deep)" strokeWidth={4} strokeLinecap="round" />
        </Protein>
        {[
          [-40, 64],
          [36, 92],
          [-20, 150],
          [44, 166],
        ].map(([dx, y], i) => (
          <Ion key={i} x={PX.channel + dx} y={y} label="K⁺" color="var(--bio-nucleus-deep)" />
        ))}
        {[0, 1].map((i) => (
          <Move key={i} x={PX.channel} y0={150} y1={340} delay={i * 1.4} dur={2.6}>
            <Ion x={0} y={0} label="K⁺" color="var(--bio-nucleus-deep)" />
          </Move>
        ))}
        <Ion x={PX.channel - 30} y={410} label="K⁺" color="var(--bio-nucleus-deep)" />
        <Label x={PX.channel} y={460}>{tt(tx("ions", "Ionen"))}</Label>
      </g>

      <g data-part="carrier">
        {/* A carrier rocking between open to the outside and open to the inside. */}
        <motion.g animate={{ rotate: [-7, 7, -7] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: `${PX.carrier - 22}px ${MY + MH / 2}px` }}>
          <rect x={PX.carrier - 40} y={MY - 16} width={36} height={MH + 32} rx={16} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
        </motion.g>
        <motion.g animate={{ rotate: [7, -7, 7] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: `${PX.carrier + 22}px ${MY + MH / 2}px` }}>
          <rect x={PX.carrier + 4} y={MY - 16} width={36} height={MH + 32} rx={16} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
        </motion.g>
        {[
          [-36, 70],
          [30, 54],
          [-10, 130],
          [42, 150],
        ].map(([dx, y], i) => (
          <Glucose key={i} x={PX.carrier + dx} y={y} />
        ))}
        <Move x={PX.carrier} y0={160} y1={330} dur={3.2}>
          <Glucose x={0} y={0} />
        </Move>
        <Glucose x={PX.carrier + 36} y={400} />
        <Label x={PX.carrier} y={460}>{tt(tx("glucose", "Glucose"))}</Label>
      </g>
    </g>
  );
}

/* Active ---------------------------------------------------------------------------------------- */

const AX = { pump: 120, abc: 296, symport: 470, antiport: 640, pts: 806 };

export const ACTIVE_SPOTS = {
  pump: { at: [AX.pump, MY - 10], label: [170, 24], side: "c" },
  abc: { at: [AX.abc, MY - 10], label: [AX.abc, 496], side: "c" },
  symport: { at: [AX.symport, MY - 10], label: [AX.symport, 496], side: "c" },
  antiport: { at: [AX.antiport, MY - 10], label: [AX.antiport, 496], side: "c" },
  pts: { at: [AX.pts, MY - 10], label: [760, 24], side: "c" },
  atp: { at: [AX.pump + 16, 330], label: [AX.pump + 56, 318], side: "r" },
} satisfies Record<string, Spot>;

export function Active() {
  const tt = useText();
  const skip = (x: number) => Object.values(AX).some((c) => Math.abs(x - c) < 44);
  const NA = "var(--bio-mito-deep)";
  const K = "var(--bio-nucleus-deep)";
  const CA = "var(--bio-leaf-deep)";
  const HP = "var(--bio-ion)";
  return (
    <g>
      <Sides />
      <g data-deco>
        <Bilayer x0={0} x1={W} y={MY} h={MH} gap={9} head={4.2} skip={skip} />
      </g>

      <g data-part="pump">
        <rect x={AX.pump - 38} y={MY - 22} width={76} height={MH + 50} rx={22} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
        <rect x={AX.pump - 6} y={MY - 18} width={12} height={MH + 42} rx={6} fill="color-mix(in oklab, var(--bio-mito) 50%, white)" />
        {[0, 1, 2].map((i) => (
          <Move key={`na${i}`} x={AX.pump - 22 + i * 4} y0={340} y1={110} delay={i * 0.5} dur={3}>
            <Ion x={0} y={0} label="Na⁺" color={NA} r={10} />
          </Move>
        ))}
        {[0, 1].map((i) => (
          <Move key={`k${i}`} x={AX.pump + 22} y0={110} y1={340} delay={0.3 + i * 0.8} dur={3}>
            <Ion x={0} y={0} label="K⁺" color={K} r={10} />
          </Move>
        ))}
        <Label x={AX.pump - 44} y={110}>3 Na⁺ ↑</Label>
        <Label x={AX.pump} y={420}>2 K⁺ ↓</Label>
      </g>

      <g data-part="abc">
        <Protein x={AX.abc} w={70} gap={10} color="var(--bio-protein)" tall={16} />
        {/* The two ATP-binding domains inside. */}
        <circle cx={AX.abc - 16} cy={MY + MH + 30} r={16} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" strokeWidth={1.5} />
        <circle cx={AX.abc + 16} cy={MY + MH + 30} r={16} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" strokeWidth={1.5} />
        <Move x={AX.abc} y0={330} y1={110} dur={3.4}>
          <rect x={-11} y={-6} width={22} height={12} rx={6} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.1} />
        </Move>
        <Label x={AX.abc} y={70}>{tt(tx("drug out", "Wirkstoff hinaus"))}</Label>
      </g>

      <g data-part="symport">
        <Protein x={AX.symport} w={66} gap={12} color="var(--bio-leaf)" deep="var(--bio-leaf-deep)" />
        <Move x={AX.symport - 10} y0={120} y1={340} dur={3}>
          <Ion x={0} y={0} label="Na⁺" color={NA} r={10} />
        </Move>
        <Move x={AX.symport + 10} y0={120} y1={340} dur={3} delay={0.15}>
          <Glucose x={0} y={0} />
        </Move>
        <Label x={AX.symport} y={70}>Na⁺ + {tt(tx("glucose", "Glucose"))} ↓</Label>
      </g>

      <g data-part="antiport">
        <Protein x={AX.antiport} w={66} gap={12} color="var(--bio-leaf)" deep="var(--bio-leaf-deep)" />
        <Move x={AX.antiport - 12} y0={120} y1={340} dur={3}>
          <Ion x={0} y={0} label="Na⁺" color={NA} r={10} />
        </Move>
        <Move x={AX.antiport + 12} y0={340} y1={120} dur={3} delay={0.4}>
          <Ion x={0} y={0} label="Ca²⁺" color={CA} r={11} />
        </Move>
        <Label x={AX.antiport} y={70}>Na⁺ ↓ Ca²⁺ ↑</Label>
      </g>

      <g data-part="pts">
        <Protein x={AX.pts} w={60} gap={10} color="var(--bio-petal)" deep="var(--bio-petal-deep)" />
        {/* Enzyme I and HPr pass the phosphate from PEP to the sugar. */}
        <circle cx={AX.pts - 46} cy={MY + MH + 78} r={15} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
        <circle cx={AX.pts - 12} cy={MY + MH + 60} r={11} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.3} />
        <Label x={AX.pts - 46} y={MY + MH + 82} size={10}>EI</Label>
        <Label x={AX.pts - 12} y={MY + MH + 64} size={9}>HPr</Label>
        <Label x={AX.pts - 60} y={MY + MH + 128}>PEP → {tt(tx("pyruvate", "Pyruvat"))}</Label>
        <Move x={AX.pts} y0={120} y1={250} dur={3.4}>
          <Glucose x={0} y={0} />
        </Move>
        <motion.g initial={{ x: AX.pts + 6, y: 300, opacity: 0 }} animate={{ opacity: [0, 0, 1, 1, 0], y: [300, 300, 300, 336, 360] }} transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.55, 0.7, 0.9, 1] }}>
          <Glucose x={0} y={0} p />
        </motion.g>
        <Label x={AX.pts} y={70}>{tt(tx("glucose → glucose 6-P", "Glucose → Glucose-6-P"))}</Label>
      </g>

      <g data-part="atp">
        <Atp x={AX.pump} y={330} />
        <Atp x={AX.abc} y={MY + MH + 64} />
        <Label x={AX.pump} y={362} size={11}>→ ADP + P</Label>
      </g>
      {/* H⁺ in the symbols of secondary transport: they ride on gradients built by pumps. */}
      <g data-deco>
        <Ion x={AX.symport + 40} y={150} label="H⁺" color={HP} r={8} />
        <Ion x={AX.antiport - 44} y={170} label="Na⁺" color={NA} r={9} />
        <Ion x={AX.symport - 44} y={160} label="Na⁺" color={NA} r={9} />
      </g>
    </g>
  );
}

/* Vesicles -------------------------------------------------------------------------------------- */

const MEM = "M 0 220 L 285 220 C 300 220, 300 268, 330 268 C 360 268, 360 220, 375 220 L 455 220 C 470 220, 466 294, 510 294 C 554 294, 550 220, 565 220 L 690 220 C 700 220, 692 274, 720 276 C 748 274, 740 220, 750 220 L 900 220";
const ARMS = ["M 96 216 C 64 160, 92 100, 138 88", "M 206 216 C 238 160, 210 100, 166 92"];

export const VESICLE_SPOTS = {
  phagocytosis: { at: [152, 140], label: [150, 26], side: "c" },
  pinocytosis: { at: [330, 252], label: [360, 26], side: "c" },
  receptor: { at: [510, 278], label: [510, 496], side: "c" },
  exocytosis: { at: [720, 196], label: [730, 26], side: "c" },
  lysosome: { at: [236, 352], label: [200, 496], side: "c" },
} satisfies Record<string, Spot>;

function MembranePath({ d }: { d: string }) {
  return (
    <g>
      <path d={d} fill="none" stroke="var(--bio-head)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--bio-tail)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function Vesicles() {
  const tt = useText();
  return (
    <g>
      <g data-deco>
        <rect x={0} y={0} width={W} height={H} fill="color-mix(in oklab, var(--bio-capsule) 45%, transparent)" />
        <path d={`${MEM} L 900 520 L 0 520 Z`} fill="var(--bio-cell)" />
        <MembranePath d={MEM} />
        <Label x={884} y={196} anchor="end">{tt(tx("outside", "außen"))}</Label>
        <Label x={884} y={262} anchor="end">{tt(tx("cytoplasm", "Cytoplasma"))}</Label>
      </g>

      <g data-deco>
        {(
          [
            [330, 150, 1],
            [510, 150, 1],
            [720, 150, -1],
          ] as const
        ).map(([x, y, dir]) => (
          <path key={x} d={dir > 0 ? `M ${x} ${y - 26} v 34 m -7 -9 l 7 9 l 7 -9` : `M ${x} ${y + 8} v -34 m -7 9 l 7 -9 l 7 9`} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </g>
      <g data-part="phagocytosis">
        {ARMS.map((d) => (
          <MembranePath key={d} d={d} />
        ))}
        <rect x={-26} y={-11} width={52} height={22} rx={11} fill="var(--bio-gneg)" stroke="color-mix(in oklab, var(--bio-gneg) 70%, black)" strokeWidth={1.3} transform="translate(152 150) rotate(-12)" />
        {/* The phagosome inside, already holding a bacterium. */}
        <circle cx={150} cy={360} r={40} fill="color-mix(in oklab, var(--bio-capsule) 50%, var(--bio-cell))" stroke="var(--bio-head)" strokeWidth={6} />
        <rect x={-20} y={-9} width={40} height={18} rx={9} fill="var(--bio-gneg)" opacity={0.75} transform="translate(146 360) rotate(20)" />
      </g>

      <g data-part="lysosome">
        <circle cx={236} cy={344} r={20} fill="color-mix(in oklab, var(--bio-blood) 35%, var(--bio-cell))" stroke="var(--bio-blood)" strokeWidth={2} />
        {[
          [-6, -5],
          [5, -6],
          [6, 5],
          [-5, 6],
        ].map(([dx, dy], i) => (
          <circle key={i} cx={236 + dx} cy={344 + dy} r={2.2} fill="var(--bio-blood)" />
        ))}
        <Label x={190} y={430}>{tt(tx("phagolysosome", "Phagolysosom"))}</Label>
      </g>

      <g data-part="pinocytosis">
        {[
          [320, 246],
          [338, 252],
          [330, 236],
          [312, 232],
          [346, 238],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.2} fill="var(--bio-water)" />
        ))}
        <circle cx={330} cy={346} r={16} fill="color-mix(in oklab, var(--bio-capsule) 55%, var(--bio-cell))" stroke="var(--bio-head)" strokeWidth={5} />
        {[
          [-5, -3],
          [5, 2],
          [-1, 6],
        ].map(([dx, dy], i) => (
          <circle key={i} cx={330 + dx} cy={346 + dy} r={2.6} fill="var(--bio-water)" />
        ))}
      </g>

      <g data-part="receptor">
        {/* Receptors with their cargo along the pit, clathrin underneath. */}
        {[466, 486, 510, 534, 554].map((x, i) => {
          const y = [236, 268, 282, 268, 236][i];
          return (
            <g key={x}>
              <path d={`M ${x} ${y - 6} v -10 m 0 0 l -5 -6 m 5 6 l 5 -6`} stroke="var(--bio-protein-deep)" strokeWidth={2} fill="none" strokeLinecap="round" />
              <circle cx={x} cy={y - 24} r={4.4} fill="var(--bio-sugar-mol)" stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
            </g>
          );
        })}
        <path d="M 466 250 C 470 300, 550 300, 554 250" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
        {/* A coated vesicle already pinched off. */}
        <circle cx={512} cy={380} r={22} fill="color-mix(in oklab, var(--bio-capsule) 55%, var(--bio-cell))" stroke="var(--bio-head)" strokeWidth={5} />
        <circle cx={512} cy={380} r={28} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={3} strokeDasharray="2 5" strokeLinecap="round" />
        {[
          [-8, -6],
          [7, -5],
          [0, 8],
        ].map(([dx, dy], i) => (
          <circle key={i} cx={512 + dx} cy={380 + dy} r={4} fill="var(--bio-sugar-mol)" stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
        ))}
        <Label x={572} y={300} anchor="start" size={11.5}>{tt(tx("clathrin", "Clathrin"))}</Label>
      </g>

      <g data-part="exocytosis">
        {/* Content spilling out of the fused vesicle, a new one on its way up. */}
        {[0, 1, 2, 3].map((i) => (
          <motion.circle
            key={i}
            r={4}
            fill="var(--bio-petal-deep)"
            initial={{ cx: 720, cy: 250, opacity: 0 }}
            animate={{ cx: [720, 700 + i * 14], cy: [250, 120 - i * 8], opacity: [0, 1, 0] }}
            transition={{ duration: 2.6, delay: i * 0.5, repeat: Infinity }}
          />
        ))}
        <motion.g animate={{ y: [24, 0, 24] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
          <circle cx={724} cy={380} r={24} fill="color-mix(in oklab, var(--bio-petal) 45%, var(--bio-cell))" stroke="var(--bio-head)" strokeWidth={5} />
          {[
            [-8, -6],
            [7, -4],
            [0, 8],
            [-9, 7],
          ].map(([dx, dy], i) => (
            <circle key={i} cx={724 + dx} cy={380 + dy} r={4} fill="var(--bio-petal-deep)" />
          ))}
        </motion.g>
        <Label x={790} y={330} anchor="start" size={11.5}>{tt(tx("from the Golgi", "vom Golgi"))}</Label>
      </g>
    </g>
  );
}
