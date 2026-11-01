"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { r1, seeded, useIds } from "../kit";

/** Pasteur's swan-neck flasks and Koch's postulates, step by step. */

const font = { fontFamily: "var(--font-sans)" };

function Note({ x, y, children, size = 13, weight = 500, anchor = "middle" }: { x: number; y: number; children: ReactNode; size?: number; weight?: number; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke" style={font}>
      {children}
    </text>
  );
}

/* Pasteur ------------------------------------------------------------------------------------- */

export const PASTEUR_W = 900;
export const PASTEUR_H = 440;

const BROTH = "#e2a64a";
const CLOUDY = "color-mix(in oklab, #e2a64a 55%, #8b7f6a)";

/** A round flask at (x, y) with a straight, swan or broken neck. */
function Flask({ x, y, neck, liquid, glow = false, id }: { x: number; y: number; neck: "straight" | "swan" | "broken"; liquid: string; glow?: boolean; id: string }) {
  const neckPath =
    neck === "straight"
      ? `M ${x - 12} ${y - 78} V ${y - 180} M ${x + 12} ${y - 78} V ${y - 180}`
      : neck === "swan"
        ? `M ${x - 12} ${y - 78} C ${x - 14} ${y - 150}, ${x + 60} ${y - 170}, ${x + 80} ${y - 120} C ${x + 98} ${y - 82}, ${x + 140} ${y - 96}, ${x + 150} ${y - 150} M ${x + 12} ${y - 78} C ${x + 10} ${y - 132}, ${x + 56} ${y - 146}, ${x + 70} ${y - 112} C ${x + 86} ${y - 70}, ${x + 152} ${y - 80}, ${x + 164} ${y - 148}`
        : `M ${x - 12} ${y - 78} V ${y - 118} M ${x + 12} ${y - 78} V ${y - 118}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <circle cx={x} cy={y} r={78} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={80} fill="color-mix(in oklab, var(--bio-capsule) 40%, var(--raised))" />
      <rect x={x - 80} y={y - 4} width={160} height={90} fill={liquid} clipPath={`url(#${id})`} style={{ transition: "fill 1.2s ease" }} />
      {glow && <circle cx={x} cy={y} r={80} fill="none" stroke="var(--ok)" strokeWidth={3} opacity={0.6} />}
      <circle cx={x} cy={y} r={80} fill="none" stroke="var(--ink-2)" strokeWidth={2.4} />
      <path d={neckPath} fill="none" stroke="var(--ink-2)" strokeWidth={2.4} strokeLinecap="round" />
      {neck === "broken" && <path d={`M ${x - 14} ${y - 118} l 6 -6 l 6 5 l 6 -7 l 6 6 l 4 -4`} fill="none" stroke="var(--ink-2)" strokeWidth={2} />}
      <ellipse cx={x - 32} cy={y - 34} rx={14} ry={22} fill="#fff" opacity={0.35} transform={`rotate(30 ${x - 32} ${y - 34})`} />
    </g>
  );
}

const DUST = (() => {
  const rnd = seeded(4);
  return Array.from({ length: 16 }, () => [r1(80 + rnd() * 740), r1(20 + rnd() * 90)] as const);
})();

export function Pasteur({ step }: { step: number }) {
  const tt = useText();
  const id = useIds("f1", "f2", "f3");
  const cx = 360;
  const cy = 300;
  const neck = step === 0 ? "straight" : step >= 4 && step < 5 ? "broken" : "swan";
  const liquid = step === 4 ? CLOUDY : BROTH;

  if (step === 5) {
    return (
      <g>
        <Flask x={250} y={290} neck="swan" liquid={BROTH} id={id.f1} glow />
        <Flask x={640} y={290} neck="broken" liquid={CLOUDY} id={id.f2} />
        <Note x={300} y={410} weight={700} size={15}>
          {tt(tx("swan neck: stays clear", "Schwanenhals: bleibt klar"))}
        </Note>
        <Note x={640} y={410} weight={700} size={15}>
          {tt(tx("neck broken: cloudy", "Hals ab: trüb"))}
        </Note>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={610 + (i % 3) * 26} cy={320 + Math.floor(i / 3) * 22} r={4} fill="var(--bio-wood-deep)" opacity={0.7} />
        ))}
      </g>
    );
  }

  return (
    <g>
      {/* Dust and germs in the air (from step 3 on). */}
      {step >= 3 &&
        DUST.map(([x, y], i) => (
          <motion.circle key={i} cx={x} cy={y} r={3} fill="var(--bio-wood-deep)" opacity={0.55} animate={{ cy: [y, y + 14, y] }} transition={{ duration: 4 + (i % 3), repeat: Infinity }} />
        ))}

      <Flask x={cx} y={cy} neck={neck} liquid={liquid} id={id.f3} />

      {/* Step 0: pouring the broth. */}
      {step === 0 && (
        <motion.g initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <path d={`M ${cx - 70} 40 h 60 v 50 q 0 10 -10 10 h -40 q -10 0 -10 -10 Z`} fill={BROTH} stroke="var(--ink-2)" strokeWidth={2} transform={`rotate(32 ${cx - 40} 70)`} />
          <motion.path d={`M ${cx - 6} 96 Q ${cx} 140 ${cx} 230`} stroke={BROTH} strokeWidth={5} fill="none" strokeLinecap="round" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1, repeat: Infinity }} />
        </motion.g>
      )}

      {/* Step 1: heating the neck to bend it. */}
      {step === 1 && (
        <g>
          <motion.path d={`M ${cx + 76} 236 c -8 -12 -6 -22 0 -30 c 6 8 8 18 0 30 Z`} fill="#f4c542" animate={{ scaleY: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }} />
          <Note x={cx + 230} y={150}>{tt(tx("bent into a swan neck", "zum Schwanenhals gebogen"))}</Note>
          <Note x={cx + 230} y={170}>{tt(tx("still open", "bleibt offen"))}</Note>
        </g>
      )}

      {/* Step 2: boiling. */}
      {step === 2 && (
        <g>
          <rect x={cx - 22} y={cy + 96} width={44} height={36} rx={5} fill="var(--ink-3)" />
          <motion.path d={`M ${cx} ${cy + 82} c -14 10 -14 22 0 30 c 14 -8 14 -20 0 -30 Z`} fill="#5aa0e6" animate={{ scaleY: [1, 1.15, 1] }} transition={{ duration: 0.7, repeat: Infinity }} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle key={i} cx={cx - 40 + i * 20} cy={cy + 60} r={4} fill="#fff" opacity={0.8} animate={{ cy: [cy + 60, cy + 4], opacity: [0.9, 0] }} transition={{ duration: 1.2, delay: i * 0.25, repeat: Infinity }} />
          ))}
          {[0, 1, 2].map((i) => (
            <motion.circle key={`s${i}`} cx={cx + 164} cy={cy - 150} r={8} fill="var(--ink-3)" opacity={0.3} animate={{ cy: [cy - 150, cy - 230], opacity: [0.4, 0] }} transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }} />
          ))}
          <Note x={cx + 260} y={cy + 20}>{tt(tx("all germs in the broth die", "alle Keime in der Brühe sterben"))}</Note>
        </g>
      )}

      {/* Step 3: waiting; dust is caught in the bend. */}
      {step === 3 && (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <motion.circle key={i} cx={cx + 150} cy={cy - 220} r={3.4} fill="var(--bio-wood-deep)" animate={{ cx: [cx + 158, cx + 150, cx + 96, cx + 80], cy: [cy - 230, cy - 150, cy - 110, cy - 96] }} transition={{ duration: 4, delay: i, repeat: Infinity, ease: "easeInOut" }} />
          ))}
          <ellipse cx={cx + 78} cy={cy - 92} rx={14} ry={5} fill="var(--bio-water)" opacity={0.6} />
          <Note x={cx + 250} y={cy - 40}>{tt(tx("germs stuck in the bend", "Keime hängen in der Biegung fest"))}</Note>
          <Note x={cx} y={cy + 120} weight={700}>
            {tt(tx("weeks later: still clear", "Wochen später: immer noch klar"))}
          </Note>
        </g>
      )}

      {/* Step 4: neck broken, germs fall in, cloudy. */}
      {step === 4 && (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.circle key={i} cx={cx - 4 + i * 2} cy={cy - 200} r={3.4} fill="var(--bio-wood-deep)" animate={{ cy: [cy - 200, cy + 10], opacity: [1, 0] }} transition={{ duration: 1.6, delay: i * 0.4, repeat: Infinity }} />
          ))}
          <motion.path d={`M ${cx + 140} ${cy - 160} l 30 10 l 10 -20`} fill="none" stroke="var(--ink-3)" strokeWidth={2.4} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
          <Note x={cx + 250} y={cy - 40}>{tt(tx("germs fall straight in", "Keime fallen direkt hinein"))}</Note>
          <Note x={cx} y={cy + 120} weight={700}>
            {tt(tx("soon cloudy", "bald trüb"))}
          </Note>
        </g>
      )}
    </g>
  );
}

/* Koch ---------------------------------------------------------------------------------------- */

export const KOCH_W = 900;
export const KOCH_H = 420;

/** A little mouse; sick ones curl up, pale, with spots of bacteria. */
function Mouse({ x, y, sick = false, flip = false }: { x: number; y: number; sick?: boolean; flip?: boolean }) {
  const body = sick ? "color-mix(in oklab, var(--bio-bone) 70%, var(--ink-3))" : "var(--bio-bone)";
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M -62 6 C -96 10, -110 -6, -128 4" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={-12} cy={0} rx={56} ry={sick ? 30 : 34} fill={body} stroke="var(--bio-outline)" strokeWidth={2} />
      <circle cx={34} cy={-26} r={15} fill={body} stroke="var(--bio-outline)" strokeWidth={2} />
      <circle cx={34} cy={-26} r={7} fill="var(--bio-flesh)" />
      <ellipse cx={46} cy={-4} rx={26} ry={20} fill={body} stroke="var(--bio-outline)" strokeWidth={2} />
      <circle cx={70} cy={-2} r={4.4} fill="var(--bio-flesh-deep)" />
      {sick ? <path d="M 50 -10 l 8 4 m -8 0 l 8 -4" stroke="var(--bio-outline)" strokeWidth={2} strokeLinecap="round" /> : <circle cx={53} cy={-8} r={3.6} fill="var(--bio-outline)" />}
      <path d="M -40 30 v 10 M -6 32 v 10 M 22 28 v 10" stroke="var(--bio-flesh-deep)" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

/** A magnified drop of blood with or without rod bacteria. */
function Drop({ x, y, germs }: { x: number; y: number; germs: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={46} fill="color-mix(in oklab, var(--bio-blood) 18%, var(--raised))" stroke="var(--ink-2)" strokeWidth={2} />
      {[
        [-20, -14],
        [16, -20],
        [-6, 18],
        [22, 12],
      ].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={y + dy} r={7} fill="var(--bio-blood)" opacity={0.6} />
      ))}
      {germs &&
        [
          [-14, 2, 20],
          [8, -2, -30],
          [0, 26, 70],
          [24, -4, 80],
          [-26, -26, 10],
        ].map(([dx, dy, a], i) => <rect key={i} x={-9} y={-2.6} width={18} height={5.2} rx={2.6} fill="var(--bio-gpos)" transform={`translate(${x + dx} ${y + dy}) rotate(${a})`} />)}
    </g>
  );
}

function Dish({ x, y, colonies }: { x: number; y: number; colonies: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={82} ry={36} fill="color-mix(in oklab, var(--bio-sun) 25%, var(--raised))" stroke="var(--ink-2)" strokeWidth={2} />
      <ellipse cx={x} cy={y - 6} rx={82} ry={36} fill="none" stroke="var(--ink-2)" strokeWidth={1.4} opacity={0.6} />
      {colonies &&
        [
          [-40, -4],
          [-12, 10],
          [18, -10],
          [40, 6],
          [6, 18],
          [-28, 16],
        ].map(([dx, dy], i) => <circle key={i} cx={x + dx} cy={y + dy} r={6} fill="#f2f0e8" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />)}
    </g>
  );
}

export function Koch({ step }: { step: number }) {
  const tt = useText();
  return (
    <AnimatePresence mode="wait">
      <motion.g key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }}>
        {step === 0 && (
          <g>
            <Mouse x={220} y={300} sick />
            <Mouse x={640} y={300} />
            <Drop x={220} y={140} germs />
            <Drop x={640} y={140} germs={false} />
            <path d="M 220 186 L 220 240 M 640 186 L 640 240" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="4 4" />
            <Note x={220} y={390} weight={700}>{tt(tx("sick: germ present", "krank: Erreger da"))}</Note>
            <Note x={640} y={390} weight={700}>{tt(tx("healthy: no germ", "gesund: kein Erreger"))}</Note>
          </g>
        )}
        {step === 1 && (
          <g>
            <Mouse x={200} y={300} sick />
            <Drop x={200} y={140} germs />
            <path d="M 260 140 C 360 100, 480 110, 560 180" fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 5" />
            <path d="M 552 166 l 10 16 l -18 2" fill="none" stroke="var(--ink-3)" strokeWidth={2} />
            <Dish x={640} y={260} colonies />
            <Note x={640} y={330} weight={700}>{tt(tx("pure culture", "Reinkultur"))}</Note>
            <Note x={410} y={96}>{tt(tx("isolate", "isolieren"))}</Note>
          </g>
        )}
        {step === 2 && (
          <g>
            <Dish x={150} y={180} colonies />
            <g transform="translate(360 180) rotate(15)">
              <rect x={-60} y={-8} width={96} height={16} rx={4} fill="color-mix(in oklab, var(--bio-capsule) 50%, var(--raised))" stroke="var(--ink-2)" strokeWidth={2} />
              <rect x={-56} y={-5} width={50} height={10} rx={3} fill="var(--bio-gpos)" opacity={0.6} />
              <path d="M 36 0 h 38" stroke="var(--ink-2)" strokeWidth={2} />
              <path d="M -60 -12 v 24 M -70 0 h 10" stroke="var(--ink-2)" strokeWidth={3} />
            </g>
            <Mouse x={640} y={300} sick />
            <Drop x={640} y={130} germs />
            <Note x={150} y={250}>{tt(tx("pure culture", "Reinkultur"))}</Note>
            <Note x={640} y={390} weight={700}>{tt(tx("healthy mouse falls ill: same disease", "gesunde Maus erkrankt: dieselbe Krankheit"))}</Note>
          </g>
        )}
        {step === 3 && (
          <g>
            <Mouse x={200} y={300} sick />
            <path d="M 280 230 C 360 190, 460 190, 540 230" fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="5 5" />
            <Dish x={640} y={260} colonies />
            <Note x={640} y={330} weight={700}>{tt(tx("same germ again", "wieder derselbe Erreger"))}</Note>
            <circle cx={760} cy={190} r={20} fill="var(--ok)" />
            <path d="M 750 190 l 7 7 l 13 -14" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {step === 4 && (
          <g>
            <Dish x={170} y={200} colonies={false} />
            <path d="M 140 170 l 60 60 M 200 170 l -60 60" stroke="var(--danger)" strokeWidth={5} strokeLinecap="round" />
            <Note x={170} y={290} weight={700}>{tt(tx("can't be grown", "nicht anzüchtbar"))}</Note>
            <Mouse x={460} y={220} />
            <Drop x={460} y={86} germs />
            <Note x={460} y={290} weight={700}>{tt(tx("healthy carrier", "gesunder Träger"))}</Note>
            <g transform="translate(730 200)">
              <circle r={44} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
              <rect x={-26} y={-12} width={22} height={9} rx={4.5} fill="var(--bio-gpos)" />
              <circle cx={14} cy={-10} r={8} fill="var(--bio-gneg)" />
              <path d="M -10 16 q 10 -12 20 0" stroke="var(--bio-leaf-deep)" strokeWidth={4} fill="none" strokeLinecap="round" />
            </g>
            <Note x={730} y={290} weight={700}>{tt(tx("several causes", "mehrere Ursachen"))}</Note>
          </g>
        )}
      </motion.g>
    </AnimatePresence>
  );
}
