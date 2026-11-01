"use client";

import { AnimatePresence, motion } from "motion/react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cos, sin } from "@/lib/stableMath";
import { r1, scatter, seeded, useIds } from "../kit";

/**
 * The Gram stain at each step: on the left what goes onto the slide (flame, dropper, alcohol,
 * microscope), on the right a Gram-positive and a Gram-negative cell and the dye inside them.
 */

export const W = 900;
export const H = 440;

const VIOLET = "var(--bio-gpos)";
const RED = "var(--bio-gneg)";
const PALE = "var(--bio-cell)";

type Look = { pos: string; neg: string; dots: "none" | "small" | "complex"; washed: boolean; red: boolean };
const LOOKS: Look[] = [
  { pos: PALE, neg: PALE, dots: "none", washed: false, red: false },
  { pos: VIOLET, neg: VIOLET, dots: "small", washed: false, red: false },
  { pos: VIOLET, neg: VIOLET, dots: "complex", washed: false, red: false },
  { pos: VIOLET, neg: PALE, dots: "complex", washed: true, red: false },
  { pos: VIOLET, neg: RED, dots: "complex", washed: true, red: true },
  { pos: VIOLET, neg: RED, dots: "complex", washed: true, red: true },
];

const REAGENT: Record<number, { color: string; name: Text }> = {
  1: { color: VIOLET, name: tx("Crystal violet", "Kristallviolett") },
  2: { color: "#9a5b1e", name: tx("Lugol's iodine", "Lugolsche Lösung") },
  4: { color: RED, name: tx("Safranin", "Safranin") },
};

// The two cells.
const CW = 176;
const CH = 92;
const POS = { x: 470, y: 176 };
const NEG = { x: 730, y: 176 };

const fade = { transition: "fill .7s ease, stroke .7s ease, opacity .7s ease" };

function inside(cx: number, cy: number, pad: number) {
  return (x: number, y: number) => {
    const half = CW / 2 - CH / 2;
    const dx = Math.max(0, Math.abs(x - cx) - half);
    return dx * dx + (y - cy) ** 2 < (CH / 2 - pad) ** 2;
  };
}

const DOTS_POS = scatter(3, 26, [POS.x - CW / 2, POS.y - CH / 2, POS.x + CW / 2, POS.y + CH / 2], inside(POS.x, POS.y, 16), 13);
const DOTS_NEG = scatter(5, 26, [NEG.x - CW / 2, NEG.y - CH / 2, NEG.x + CW / 2, NEG.y + CH / 2], inside(NEG.x, NEG.y, 12), 13);
/** Dye stuck in the thick Gram-positive wall. */
const WALL_DOTS = (() => {
  const rnd = seeded(9);
  return Array.from({ length: 30 }, (_, i) => {
    const t = (i / 30) * 2 * Math.PI + rnd() * 0.1;
    const half = CW / 2 - CH / 2;
    const r = CH / 2 - 1;
    const x = POS.x + Math.sign(cos(t)) * half * Math.min(1, Math.abs(cos(t)) * 3) + r * cos(t) * 0.98;
    return [r1(x), r1(POS.y + r * sin(t) * 0.98)] as const;
  });
})();

function Cell({ x, y, fill, wall }: { x: number; y: number; fill: string; wall: "thick" | "thin" }) {
  return (
    <g>
      {wall === "thick" ? (
        <rect x={x - CW / 2} y={y - CH / 2} width={CW} height={CH} rx={CH / 2} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.4} />
      ) : (
        <rect x={x - CW / 2 + 6} y={y - CH / 2 + 6} width={CW - 12} height={CH - 12} rx={CH / 2 - 6} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1} />
      )}
      <rect
        x={x - CW / 2 + (wall === "thick" ? 13 : 10)}
        y={y - CH / 2 + (wall === "thick" ? 13 : 10)}
        width={CW - (wall === "thick" ? 26 : 20)}
        height={CH - (wall === "thick" ? 26 : 20)}
        rx={CH / 2 - (wall === "thick" ? 13 : 10)}
        fill={fill}
        stroke="var(--bio-membrane)"
        strokeWidth={2}
        style={fade}
      />
    </g>
  );
}

export function GramStain({ step }: { step: number }) {
  const tt = useText();
  const look = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, step))];
  const id = useIds("glass", "field");
  const reagent = REAGENT[step];
  const font = { fontFamily: "var(--font-sans)" };

  return (
    <g>
      <defs>
        <linearGradient id={id.glass} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in oklab, var(--bio-capsule) 70%, white)" />
          <stop offset="1" stopColor="var(--bio-capsule)" />
        </linearGradient>
        <clipPath id={id.field}>
          <circle cx={160} cy={210} r={128} />
        </clipPath>
      </defs>

      {/* Left: the slide and what goes on it. */}
      {step < 5 ? (
        <g>
          <rect x={36} y={300} width={250} height={54} rx={6} fill={`url(#${id.glass})`} stroke="var(--bio-capsule-deep)" strokeWidth={1.4} />
          <rect x={36} y={300} width={46} height={54} rx={6} fill="color-mix(in oklab, var(--bio-capsule) 40%, var(--raised))" stroke="var(--bio-capsule-deep)" strokeWidth={1.4} />
          <ellipse
            cx={180}
            cy={327}
            rx={62}
            ry={15}
            fill={step === 0 ? "var(--bio-bone)" : step === 3 ? "color-mix(in oklab, var(--bio-gpos) 55%, var(--bio-cell))" : step === 4 ? "color-mix(in oklab, var(--bio-gpos) 55%, var(--bio-gneg))" : step === 2 ? "color-mix(in oklab, var(--bio-gpos) 80%, #9a5b1e)" : VIOLET}
            opacity={0.85}
            style={fade}
          />
          <AnimatePresence mode="wait">
            <motion.g key={step} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              {step === 0 && (
                <g>
                  {/* A Bunsen burner under the slide. */}
                  <rect x={166} y={404} width={28} height={30} rx={4} fill="var(--ink-3)" />
                  <motion.path
                    d="M 180 360 C 166 378, 168 396, 180 404 C 192 396, 194 378, 180 360 Z"
                    fill="#5aa0e6"
                    opacity={0.85}
                    animate={{ scaleY: [1, 1.12, 0.94, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity }}
                    style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                  />
                  <path d="M 180 376 C 174 386, 175 396, 180 401 C 185 396, 186 386, 180 376 Z" fill="#f4c542" />
                </g>
              )}
              {reagent && (
                <g>
                  <path d="M 158 120 h 44 v 96 q 0 14 -14 14 h -16 q -14 0 -14 -14 Z" fill="color-mix(in oklab, var(--raised) 70%, transparent)" stroke="var(--ink-2)" strokeWidth={1.6} />
                  <path d="M 160 160 h 40 v 56 q 0 12 -12 12 h -16 q -12 0 -12 -12 Z" fill={reagent.color} opacity={0.9} />
                  <rect x={170} y={92} width={20} height={30} rx={4} fill="var(--ink-2)" />
                  <path d="M 176 92 v -10 q 4 -8 8 0 v 10" fill="var(--ink-3)" />
                  <path d="M 180 230 v 20" stroke="var(--ink-2)" strokeWidth={3} strokeLinecap="round" />
                  <motion.circle cx={180} cy={256} r={5} fill={reagent.color} animate={{ cy: [256, 312], opacity: [1, 1, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeIn" }} />
                  <text x={226} y={178} fontSize={14} fontWeight={600} fill="var(--ink)" style={font}>
                    {tt(reagent.name)}
                  </text>
                </g>
              )}
              {step === 3 && (
                <g>
                  {/* A wash bottle with alcohol, squirting over the slide. */}
                  <g transform="rotate(-28 130 170)">
                    <path d="M 100 130 h 60 v 92 q 0 14 -14 14 h -32 q -14 0 -14 -14 Z" fill="color-mix(in oklab, var(--raised) 60%, var(--bio-capsule))" stroke="var(--ink-2)" strokeWidth={1.6} />
                    <path d="M 122 130 v -16 h 16 v 16" fill="var(--ink-3)" />
                    <path d="M 130 114 q 0 -26 40 -38" fill="none" stroke="var(--ink-2)" strokeWidth={3} strokeLinecap="round" />
                  </g>
                  <motion.path
                    d="M 196 98 Q 236 150 214 300"
                    fill="none"
                    stroke="var(--bio-capsule-deep)"
                    strokeWidth={2.5}
                    strokeDasharray="6 8"
                    animate={{ strokeDashoffset: [0, -28] }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                  />
                  <text x={228} y={196} fontSize={14} fontWeight={600} fill="var(--ink)" style={font}>
                    {tt(tx("Ethanol 96 %", "Ethanol 96 %"))}
                  </text>
                  {/* Violet running off the slide. */}
                  <motion.path d="M 250 344 q 10 14 4 34" fill="none" stroke={VIOLET} strokeWidth={4} strokeLinecap="round" animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 1.4, repeat: Infinity }} />
                </g>
              )}
            </motion.g>
          </AnimatePresence>
        </g>
      ) : (
        <motion.g initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} style={{ transformOrigin: "160px 210px" }}>
          {/* The view through the oil immersion objective. */}
          <circle cx={160} cy={210} r={132} fill="var(--ink)" opacity={0.9} />
          <circle cx={160} cy={210} r={128} fill="color-mix(in oklab, var(--bio-bone) 55%, white)" />
          <g clipPath={`url(#${id.field})`}>
            {[
              [96, 150],
              [124, 252],
              [214, 170],
            ].map(([cx, cy], k) => (
              <g key={k}>
                {[
                  [0, 0],
                  [11, -4],
                  [5, 9],
                  [-8, 8],
                  [16, 7],
                  [-4, -10],
                ].map(([dx, dy], i) => (
                  <circle key={i} cx={cx + dx} cy={cy + dy} r={5.5} fill={VIOLET} />
                ))}
              </g>
            ))}
            {[
              [70, 210, 20],
              [150, 120, 70],
              [196, 236, -30],
              [236, 286, 10],
              [190, 300, 80],
              [110, 320, -10],
              [250, 120, 40],
              [60, 260, 60],
            ].map(([cx, cy, a], i) => (
              <rect key={i} x={-12} y={-4.5} width={24} height={9} rx={4.5} fill={RED} transform={`translate(${cx} ${cy}) rotate(${a})`} />
            ))}
          </g>
          <text x={160} y={370} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={font}>
            {tt(tx("100× oil immersion: 1000× magnified", "100er-Ölimmersion: 1000-fach vergrößert"))}
          </text>
        </motion.g>
      )}

      {/* Right: one cell of each kind. */}
      <g>
        <Cell x={POS.x} y={POS.y} fill={look.pos} wall="thick" />
        <Cell x={NEG.x} y={NEG.y} fill={look.neg} wall="thin" />
        {/* The outer membrane of the Gram-negative cell: dissolved by alcohol from step 3 on. */}
        <rect
          x={NEG.x - CW / 2}
          y={NEG.y - CH / 2}
          width={CW}
          height={CH}
          rx={CH / 2}
          fill="none"
          stroke="var(--bio-lps-deep)"
          strokeWidth={3}
          strokeDasharray={look.washed ? "3 7" : "none"}
          opacity={look.washed ? 0.45 : 1}
          style={fade}
        />

        {look.dots !== "none" &&
          (
            [
              [DOTS_POS, true],
              [DOTS_NEG, false],
            ] as const
          ).map(([dots, positive]) =>
            dots.map(([x, y], i) => {
              const gone = !positive && look.washed;
              const big = look.dots === "complex";
              const out = positive ? 0 : (x - NEG.x) * 0.9;
              return (
                <motion.circle
                  key={`${positive}${i}`}
                  cx={x}
                  cy={y}
                  r={big ? (i % 3 ? 4.6 : 6) : 2.6}
                  fill={big ? "color-mix(in oklab, var(--bio-gpos) 75%, black)" : VIOLET}
                  initial={false}
                  animate={gone ? { x: out, y: (y - NEG.y) * 1.4, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
                  transition={{ duration: 1.1, delay: gone ? (i % 7) * 0.06 : 0 }}
                />
              );
            }),
          )}
        {look.dots === "complex" &&
          WALL_DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.4} fill="color-mix(in oklab, var(--bio-gpos) 75%, black)" />)}
        {look.red &&
          DOTS_NEG.map(([x, y], i) => (
            <motion.circle key={`r${i}`} cx={x} cy={y} r={2.8} fill="color-mix(in oklab, var(--bio-gneg) 70%, black)" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: (i % 6) * 0.05 }} />
          ))}

        <text x={POS.x} y={POS.y + CH / 2 + 34} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--ink)" style={font}>
          {tt(tx("Gram-positive", "grampositiv"))}
        </text>
        <text x={POS.x} y={POS.y + CH / 2 + 54} textAnchor="middle" fontSize={12.5} fill="var(--ink-3)" style={font}>
          {tt(tx("thick murein", "dicke Mureinschicht"))}
        </text>
        <text x={NEG.x} y={NEG.y + CH / 2 + 34} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--ink)" style={font}>
          {tt(tx("Gram-negative", "gramnegativ"))}
        </text>
        <text x={NEG.x} y={NEG.y + CH / 2 + 54} textAnchor="middle" fontSize={12.5} fill="var(--ink-3)" style={font}>
          {tt(tx("thin murein + outer membrane", "dünnes Murein + äußere Membran"))}
        </text>
        {/* What each cell looks like now. */}
        {(
          [
            [POS.x, look.pos],
            [NEG.x, look.neg],
          ] as const
        ).map(([x, fill]) => (
          <g key={x}>
            <rect x={x - 46} y={POS.y + CH / 2 + 74} width={92} height={28} rx={14} fill={fill} stroke="var(--line-2)" style={fade} />
            <text x={x} y={POS.y + CH / 2 + 92} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={fill === PALE ? "var(--ink-2)" : "#fff"} style={font}>
              {fill === VIOLET ? tt(tx("violet", "violett")) : fill === RED ? tt(tx("red", "rot")) : tt(tx("colourless", "farblos"))}
            </text>
          </g>
        ))}
      </g>
    </g>
  );
}
