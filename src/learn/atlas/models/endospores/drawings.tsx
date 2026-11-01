"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cos, sin } from "@/lib/stableMath";
import type { Spot } from "../../types";
import { r1, scatter, Shine, tangle, useIds } from "../kit";

/** Endospores: the layers of a spore, sporulation, germination and where spores sit. */

const font = { fontFamily: "var(--font-sans)" };

function Note({ x, y, children, anchor = "middle", size = 13, weight = 500 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" style={font}>
      {children}
    </text>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Structure */

export const STRUCT_W = 900;
export const STRUCT_H = 520;
const SX = 300;
const SY = 262;

/** A point on an ellipse of the spore at angle a (degrees). */
const onEll = (rx: number, ry: number, a: number): [number, number] => [r1(SX + rx * cos((a * Math.PI) / 180)), r1(SY + ry * sin((a * Math.PI) / 180))];

const CORE = { rx: 136, ry: 92 };
const DPA = scatter(17, 22, [SX - CORE.rx, SY - CORE.ry, SX + CORE.rx, SY + CORE.ry], (x, y) => ((x - SX) / (CORE.rx - 14)) ** 2 + ((y - SY) / (CORE.ry - 12)) ** 2 < 1, 17, (x, y) => ((x - SX) / 84) ** 2 + ((y - SY) / 50) ** 2 < 1);
const RIBO = scatter(23, 26, [SX - CORE.rx, SY - CORE.ry, SX + CORE.rx, SY + CORE.ry], (x, y) => ((x - SX) / (CORE.rx - 8)) ** 2 + ((y - SY) / (CORE.ry - 8)) ** 2 < 1, 11, (x, y) => ((x - SX) / 80) ** 2 + ((y - SY) / 46) ** 2 < 1 || DPA.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 100));
const DNA = tangle(SX, SY, 70, 36, 4);

export const STRUCT_SPOTS = {
  exosporium: { at: onEll(262, 222, -58), label: [600, 34], side: "r" },
  coat: { at: onEll(226, 180, -42), label: [600, 88], side: "r" },
  outermembrane: { at: onEll(201, 157, -28), label: [600, 142], side: "r" },
  cortex: { at: onEll(176, 128, -12), label: [600, 196], side: "r" },
  germwall: { at: onEll(150, 104, 4), label: [600, 250], side: "r" },
  innermembrane: { at: onEll(141, 97, 20), label: [600, 304], side: "r" },
  core: { at: [SX + 92, SY + 54], label: [600, 358], side: "r" },
  dpa: { at: DPA.reduce((b, p) => (p[0] - (SX + 96)) ** 2 + (p[1] - SY) ** 2 < (b[0] - (SX + 96)) ** 2 + (b[1] - SY) ** 2 ? p : b), label: [600, 412], side: "r" },
  dna: { at: [SX - 10, SY - 4], label: [600, 466], side: "r" },
} satisfies Record<string, Spot>;

export function SporeStructure() {
  const id = useIds("core", "cortex", "shine");
  return (
    <g>
      <defs>
        <radialGradient id={id.core} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-spore) 55%, var(--bio-cell))" />
          <stop offset="1" stopColor="var(--bio-spore)" />
        </radialGradient>
        <pattern id={id.cortex} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect width="16" height="16" fill="color-mix(in oklab, var(--bio-murein) 60%, var(--bio-cell))" />
          <path d="M 0 8 H 16" stroke="var(--bio-murein-deep)" strokeWidth={0.8} opacity={0.6} />
          <path d="M 8 0 V 4" stroke="var(--bio-murein-deep)" strokeWidth={0.8} opacity={0.45} />
        </pattern>
        <Shine id={id.shine} cx="38%" cy="28%" />
      </defs>
      <g data-part="exosporium">
        <ellipse cx={SX} cy={SY} rx={262} ry={222} fill="color-mix(in oklab, var(--bio-capsule) 35%, transparent)" stroke="var(--bio-capsule-deep)" strokeWidth={1.6} strokeDasharray="7 6" />
      </g>
      <g data-part="coat">
        <ellipse cx={SX} cy={SY} rx={236} ry={192} fill="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" />
        {[0, 6, 12, 18].map((d) => (
          <ellipse key={d} cx={SX} cy={SY} rx={232 - d} ry={188 - d} fill="none" stroke="var(--bio-spore)" strokeWidth={1.2} opacity={0.7} />
        ))}
      </g>
      <g data-part="outermembrane">
        <ellipse cx={SX} cy={SY} rx={204} ry={160} fill="var(--bio-head)" />
      </g>
      <g data-part="cortex">
        <ellipse cx={SX} cy={SY} rx={198} ry={154} fill={`url(#${id.cortex})`} stroke="var(--bio-murein-deep)" strokeWidth={1} />
      </g>
      <g data-part="germwall">
        <ellipse cx={SX} cy={SY} rx={153} ry={107} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.2} />
      </g>
      <g data-part="innermembrane">
        <ellipse cx={SX} cy={SY} rx={143} ry={98} fill="var(--bio-head)" />
      </g>
      <g data-part="core">
        <ellipse cx={SX} cy={SY} rx={CORE.rx} ry={CORE.ry} fill={`url(#${id.core})`} />
        <ellipse cx={SX} cy={SY} rx={CORE.rx} ry={CORE.ry} fill={`url(#${id.shine})`} />
        {RIBO.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.6} fill="var(--bio-ribo)" opacity={0.8} />
        ))}
      </g>
      <g data-part="dpa">
        {DPA.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="var(--bio-sugar-mol)" stroke="var(--bio-wood-deep)" strokeWidth={0.9} />
            <circle cx={6} cy={-5} r={2.6} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={0.7} />
          </g>
        ))}
      </g>
      <g data-part="dna">
        <path d={DNA} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.2} strokeLinejoin="round" />
        {Array.from({ length: 18 }, (_, i) => {
          const t = (i / 18) * 2 * Math.PI;
          return <circle key={i} cx={r1(SX + 70 * cos(t) + 11.9 * cos(9 * t + 4))} cy={r1(SY + 36 * sin(t) + 13.7 * sin(10 * t + 4))} r={3} fill="var(--bio-sugar)" stroke="var(--bio-sugar-deep)" strokeWidth={0.7} />;
        })}
      </g>
    </g>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Sporulation */

export const SPOR_W = 900;
export const SPOR_H = 420;
const CELL = { x: 120, y: 108, w: 660, h: 196 };
const FS = { cx: 660, cy: 206 }; // where the forespore sits

const enter = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.45 } };

export function Sporulation({ step }: { step: number }) {
  const tt = useText();
  const id = useIds("cyto", "spore", "shine");
  const lysed = step >= 7;
  const motherDim = step >= 6;
  // Forespore size and look per stage.
  const fsR = step <= 2 ? 0 : step === 3 ? 58 : 62;
  return (
    <g>
      <defs>
        <linearGradient id={id.cyto} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 80%, var(--bio-membrane))" />
        </linearGradient>
        <radialGradient id={id.spore} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-spore) 40%, white)" />
          <stop offset="1" stopColor="var(--bio-spore)" />
        </radialGradient>
        <Shine id={id.shine} />
      </defs>

      {/* The mother cell (bursts at stage VII). */}
      <AnimatePresence>
        {!lysed && (
          <motion.g key="mother" {...enter}>
            <rect x={CELL.x} y={CELL.y} width={CELL.w} height={CELL.h} rx={CELL.h / 2} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.6} />
            <rect
              x={CELL.x + 9}
              y={CELL.y + 9}
              width={CELL.w - 18}
              height={CELL.h - 18}
              rx={CELL.h / 2 - 9}
              fill={`url(#${id.cyto})`}
              stroke="var(--bio-membrane)"
              strokeWidth={2.4}
              opacity={motherDim ? 0.6 : 1}
              style={{ transition: "opacity .6s" }}
            />
          </motion.g>
        )}
      </AnimatePresence>
      {lysed && (
        <motion.g initial={{ opacity: 1 }} animate={{ opacity: 0.55 }} transition={{ duration: 0.8 }}>
          {/* Fragments of the burst mother cell. */}
          <path d={`M ${CELL.x + 30} ${CELL.y + 40} q 60 -40 140 -28`} stroke="var(--bio-murein-deep)" strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M ${CELL.x + 60} ${CELL.y + 170} q 90 30 180 6`} stroke="var(--bio-murein-deep)" strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M ${CELL.x + 330} ${CELL.y + 10} q 70 -14 130 10`} stroke="var(--bio-murein-deep)" strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d={`M ${CELL.x + 380} ${CELL.y + 186} q 60 16 120 -4`} stroke="var(--bio-murein-deep)" strokeWidth={5} fill="none" strokeLinecap="round" />
        </motion.g>
      )}

      {/* DNA: one nucleoid, then the axial filament, then one chromosome on each side. */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.path key="nuc" {...enter} d={tangle(400, 206, 120, 40, 2)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.2} strokeLinejoin="round" />
        )}
        {step === 1 && (
          <motion.g key="axial" {...enter}>
            <path d="M 200 200 C 300 180, 400 230, 500 200 S 680 180, 720 206" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.4} />
            <path d="M 196 214 C 300 236, 400 186, 500 214 S 680 230, 724 210" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2.4} />
          </motion.g>
        )}
        {step >= 2 && !lysed && (
          <motion.path key="mother-dna" {...enter} d={tangle(330, 206, 80, 34, 6)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" opacity={motherDim ? 0.5 : 1} />
        )}
      </AnimatePresence>

      {/* Stage II: the septum cuts off a small forespore at the pole. */}
      <AnimatePresence>
        {step === 2 && (
          <motion.g key="septum" {...enter}>
            <path d={`M 610 ${CELL.y + 9} Q 600 206 610 ${CELL.y + CELL.h - 9}`} fill="none" stroke="var(--bio-membrane)" strokeWidth={4} />
            <path d={tangle(690, 206, 38, 30, 7)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" />
          </motion.g>
        )}
      </AnimatePresence>

      {/* From stage III: the forespore inside the mother cell, then the spore. */}
      {step >= 3 && (
        <motion.g key="fs" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 20 }} style={{ transformOrigin: `${FS.cx}px ${FS.cy}px` }}>
          {step >= 5 && <ellipse cx={FS.cx} cy={FS.cy} rx={fsR + 26} ry={fsR + 4 + 14} fill="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" />}
          {step >= 4 && <ellipse cx={FS.cx} cy={FS.cy} rx={fsR + 14} ry={fsR + 4} fill="color-mix(in oklab, var(--bio-murein) 70%, var(--bio-cell))" stroke="var(--bio-murein-deep)" strokeWidth={1} />}
          {/* Outer membrane (from the mother cell) and inner membrane. */}
          <ellipse cx={FS.cx} cy={FS.cy} rx={fsR + (step >= 4 ? 15 : 6)} ry={fsR - 8 + (step >= 4 ? 13 : 4)} fill="none" stroke="var(--bio-membrane)" strokeWidth={2.4} />
          <ellipse
            cx={FS.cx}
            cy={FS.cy}
            rx={fsR}
            ry={fsR - 8}
            fill={step >= 4 ? `url(#${id.spore})` : "var(--bio-cell)"}
            stroke="var(--bio-membrane)"
            strokeWidth={2.4}
            style={{ transition: "fill .6s" }}
          />
          {step >= 6 && <ellipse cx={FS.cx} cy={FS.cy} rx={fsR} ry={fsR - 8} fill={`url(#${id.shine})`} />}
          <path d={tangle(FS.cx, FS.cy, 30, 22, 7)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" />
          {step >= 4 &&
            [
              [-30, -18],
              [28, -22],
              [34, 18],
              [-26, 24],
              [0, 32],
              [4, -34],
            ].map(([dx, dy], i) => <polygon key={i} transform={`translate(${FS.cx + dx} ${FS.cy + dy})`} points="0,-4.5 4,-2.3 4,2.3 0,4.5 -4,2.3 -4,-2.3" fill="var(--bio-sugar-mol)" stroke="var(--bio-wood-deep)" strokeWidth={0.7} />)}
          {step >= 6 && (
            <motion.ellipse
              cx={FS.cx}
              cy={FS.cy}
              rx={fsR + 34}
              ry={fsR + 26}
              fill="none"
              stroke="var(--bio-sun)"
              strokeWidth={2}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.g>
      )}

      {/* Names of the compartments. */}
      <g>
        {step >= 2 && !lysed && <Note x={330} y={CELL.y + CELL.h + 34}>{tt(tx("mother cell", "Mutterzelle"))}</Note>}
        {step >= 2 && <Note x={FS.cx} y={CELL.y + CELL.h + 34}>{tt(step >= 7 ? tx("free spore", "freie Spore") : step >= 4 ? tx("spore", "Spore") : tx("forespore", "Vorspore"))}</Note>}
        {step === 0 && <Note x={450} y={CELL.y + CELL.h + 34}>{tt(tx("vegetative cell, nutrients running out", "vegetative Zelle, die Nährstoffe gehen aus"))}</Note>}
        {step === 1 && <Note x={450} y={CELL.y + CELL.h + 34}>{tt(tx("axial filament", "Axialfilament"))}</Note>}
        <Note x={450} y={40} size={15} weight={700}>
          {tt(tx("Stage", "Stadium"))} {["0", "I", "II", "III", "IV", "V", "VI", "VII"][step]}
        </Note>
      </g>
    </g>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Germination */

export const GERM_W = 900;
export const GERM_H = 380;

export function Germination({ step }: { step: number }) {
  const tt = useText();
  const id = useIds("spore", "shine", "cyto");
  const cx = 450;
  const cy = 190;
  return (
    <g>
      <defs>
        <radialGradient id={id.spore} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-spore) 40%, white)" />
          <stop offset="1" stopColor="var(--bio-spore)" />
        </radialGradient>
        <linearGradient id={id.cyto} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 80%, var(--bio-membrane))" />
        </linearGradient>
        <Shine id={id.shine} />
      </defs>

      {step <= 1 && (
        <motion.g key="spore" initial={false} animate={{ scale: step === 1 ? 1.08 : 1 }} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <ellipse cx={cx} cy={cy} rx={120} ry={92} fill="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" />
          <ellipse cx={cx} cy={cy} rx={104} ry={77} fill="color-mix(in oklab, var(--bio-murein) 70%, var(--bio-cell))" opacity={step === 1 ? 0.35 : 1} style={{ transition: "opacity .8s" }} />
          <ellipse cx={cx} cy={cy} rx={78} ry={56} fill={step === 1 ? "color-mix(in oklab, var(--bio-spore) 70%, var(--bio-outline))" : `url(#${id.spore})`} stroke="var(--bio-membrane)" strokeWidth={2.4} style={{ transition: "fill .8s" }} />
          {step === 0 && <ellipse cx={cx} cy={cy} rx={78} ry={56} fill={`url(#${id.shine})`} />}
          <path d={tangle(cx, cy, 36, 24, 3)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" />
        </motion.g>
      )}

      {/* Step 0: heat. */}
      {step === 0 && (
        <g>
          {[-60, 0, 60].map((dx) => (
            <motion.path
              key={dx}
              d={`M ${cx + dx} 350 q -10 -14 0 -28 q 10 -14 0 -28`}
              fill="none"
              stroke="var(--bio-ion)"
              strokeWidth={3}
              strokeLinecap="round"
              animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: dx / 120 + 0.5 }}
            />
          ))}
          <Note x={cx + 190} y={cy - 70} size={15} weight={700}>
            60–80 °C
          </Note>
          <Note x={cx + 190} y={cy - 50}>{tt(tx("short heat shock", "kurzer Hitzeschock"))}</Note>
        </g>
      )}

      {/* Step 1: Ca-DPA out, water in. */}
      {step === 1 &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * 2 * Math.PI;
          const water = i % 2 === 0;
          const x0 = r1(cx + 70 * cos(a));
          const y0 = r1(cy + 50 * sin(a));
          const x1 = r1(cx + 170 * cos(a));
          const y1 = r1(cy + 130 * sin(a));
          return water ? (
            <motion.path
              key={i}
              d="M 0 -6 q 5 7 0 11 q -5 -4 0 -11 Z"
              fill="var(--bio-water)"
              initial={{ x: x1, y: y1, opacity: 0 }}
              animate={{ x: [x1, x0], y: [y1, y0], opacity: [0, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
            />
          ) : (
            <motion.polygon
              key={i}
              points="0,-5 4.4,-2.5 4.4,2.5 0,5 -4.4,2.5 -4.4,-2.5"
              fill="var(--bio-sugar-mol)"
              stroke="var(--bio-wood-deep)"
              strokeWidth={0.8}
              initial={{ x: x0, y: y0, opacity: 0 }}
              animate={{ x: [x0, x1], y: [y0, y1], opacity: [0, 1, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
            />
          );
        })}
      {step === 1 && (
        <g>
          <Note x={150} y={60}>{tt(tx("Ca-DPA out", "Ca-DPA hinaus"))}</Note>
          <Note x={750} y={60}>{tt(tx("water in", "Wasser hinein"))}</Note>
        </g>
      )}

      {/* Step 2: the cell swells and bursts out of the coat. */}
      {step === 2 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <path d={`M ${cx - 130} ${cy - 30} a 120 92 0 0 1 150 -62 l -18 30 l 22 6`} fill="none" stroke="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" strokeWidth={14} strokeLinecap="round" />
          <path d={`M ${cx - 126} ${cy + 40} a 120 92 0 0 0 160 52 l -10 -28 l 20 -4`} fill="none" stroke="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" strokeWidth={14} strokeLinecap="round" />
          <motion.rect
            initial={{ width: 150 }}
            animate={{ width: 260 }}
            transition={{ duration: 1.2 }}
            x={cx - 90}
            y={cy - 40}
            height={80}
            rx={40}
            fill={`url(#${id.cyto})`}
            stroke="var(--bio-membrane)"
            strokeWidth={2.4}
          />
          <path d={tangle(cx, cy, 44, 22, 5)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" />
        </motion.g>
      )}

      {/* Step 3: a vegetative cell, the empty coat beside it. */}
      {step === 3 && (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <path d={`M 150 ${cy - 6} a 70 54 0 0 1 90 -40 M 150 ${cy + 26} a 70 54 0 0 0 96 32`} fill="none" stroke="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" strokeWidth={12} strokeLinecap="round" opacity={0.6} />
          <rect x={cx - 150} y={cy - 44} width={340} height={88} rx={44} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.6} />
          <rect x={cx - 142} y={cy - 36} width={324} height={72} rx={36} fill={`url(#${id.cyto})`} stroke="var(--bio-membrane)" strokeWidth={2.4} />
          <path d={tangle(cx + 20, cy, 70, 22, 2)} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} strokeLinejoin="round" />
          <Note x={200} y={cy + 110}>{tt(tx("empty spore coat", "leere Sporenhülle"))}</Note>
        </motion.g>
      )}
    </g>
  );
}

/* --------------------------------------------------------------------------------------------- */
/* Position */

export const POS_W = 960;
export const POS_H = 300;
const TILE = 224;
const COLS = [120, 360, 600, 840];

export const POS_SPOTS = {
  central: { at: [COLS[0], 118], label: [COLS[0], 262], side: "c" },
  subterminal: { at: [COLS[1] + 44, 118], label: [COLS[1], 262], side: "c" },
  terminal: { at: [COLS[2] + 76, 118], label: [COLS[2], 262], side: "c" },
  stain: { at: [COLS[3], 118], label: [COLS[3], 262], side: "c" },
} satisfies Record<string, Spot>;

function Rod({ x, y, len, w, fill = "var(--bio-cell)" }: { x: number; y: number; len: number; w: number; fill?: string }) {
  return <rect x={x - len / 2} y={y - w / 2} width={len} height={w} rx={w / 2} fill={fill} stroke="var(--bio-wood-deep)" strokeWidth={1.6} />;
}

function Spore({ x, y, rx, ry, fill }: { x: number; y: number; rx: number; ry: number; fill: string }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={fill} stroke="color-mix(in oklab, var(--bio-spore-deep) 75%, var(--bio-outline))" strokeWidth={1.6} />;
}

export function Position() {
  const id = useIds("spore");
  const spore = `url(#${id.spore})`;
  return (
    <g>
      <defs>
        <radialGradient id={id.spore} cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-spore) 35%, white)" />
          <stop offset="1" stopColor="var(--bio-spore)" />
        </radialGradient>
      </defs>
      {COLS.map((x) => (
        <rect key={x} x={x - TILE / 2} y={14} width={TILE} height={220} rx={18} fill="var(--surface)" stroke="var(--line)" data-deco />
      ))}
      <g data-part="central">
        <Rod x={COLS[0]} y={118} len={170} w={50} />
        <Spore x={COLS[0]} y={118} rx={26} ry={17} fill={spore} />
      </g>
      <g data-part="subterminal">
        <path d={`M ${COLS[1] - 85} 118 a 25 25 0 0 1 25 -25 H ${COLS[1] + 20} C ${COLS[1] + 40} 90, ${COLS[1] + 70} 90, ${COLS[1] + 78} 102 q 8 16 0 32 C ${COLS[1] + 70} 146, ${COLS[1] + 40} 146, ${COLS[1] + 20} 143 H ${COLS[1] - 60} a 25 25 0 0 1 -25 -25 Z`} fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <Spore x={COLS[1] + 44} y={118} rx={25} ry={19} fill={spore} />
      </g>
      <g data-part="terminal">
        {/* The drumstick of Clostridium tetani. */}
        <rect x={COLS[2] - 96} y={104} width={150} height={28} rx={14} fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <circle cx={COLS[2] + 76} cy={118} r={26} fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
        <circle cx={COLS[2] + 76} cy={118} r={20} fill={spore} stroke="color-mix(in oklab, var(--bio-spore-deep) 75%, var(--bio-outline))" strokeWidth={1.6} />
      </g>
      <g data-part="stain">
        {/* Schaeffer-Fulton: red cells, green spores, a few free spores. */}
        {(
          [
            [-60, -50, 20, true],
            [10, -60, -15, false],
            [50, -20, 60, true],
            [-40, 10, -30, true],
            [20, 40, 10, false],
            [-70, 60, 15, true],
          ] as const
        ).map(([dx, dy, a, withSpore], i) => (
          <g key={i} transform={`translate(${COLS[3] + dx} ${118 + dy}) rotate(${a})`}>
            <rect x={-26} y={-8} width={52} height={16} rx={8} fill="var(--bio-gneg)" />
            {withSpore && <ellipse cx={8} cy={0} rx={8} ry={5.5} fill="#3fae5c" />}
          </g>
        ))}
        {[
          [70, 50],
          [-10, -10],
          [72, -60],
        ].map(([dx, dy], i) => (
          <ellipse key={i} cx={COLS[3] + dx} cy={118 + dy} rx={7} ry={5} fill="#3fae5c" />
        ))}
      </g>
    </g>
  );
}
