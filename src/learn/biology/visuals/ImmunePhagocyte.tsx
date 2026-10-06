"use client";

// Phagocytosis step by step: a macrophage (Fresszelle) recognises a bacterium, flows around it
// with pseudopodia, encloses it in a phagosome, digests it with the enzymes of its lysosomes and
// gets rid of the remains. At level 2 the last step is antigen presentation.

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { BacteriumRod, bumpPath, PAINT } from "./ImmuneCells";

const CX = 220;
const CY = 140;
const N = 72;
const f = (v: number) => Math.round(v * 10) / 10;

/** The cell outline (radius by angle) for each stage; pseudopodia are two bumps around angle 0. */
function radius(theta: number, stage: number) {
  let r = 82 + 5 * Math.sin(3 * theta + 1) + 3 * Math.sin(5 * theta + 2);
  const deg = ((theta * 180) / Math.PI + 540) % 360 - 180;
  const g = (c: number, s: number) => Math.exp(-((deg - c) ** 2) / (2 * s * s));
  if (stage === 1) r += 16 * (g(14, 9) + g(-14, 9));
  if (stage === 2) r += 64 * (g(13, 6) + g(-13, 6)) + 8 * g(0, 4);
  return r;
}

/** A smooth closed path through the outline points (Catmull-Rom as cubic Béziers). */
function outline(stage: number) {
  const pts = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2;
    const r = radius(t, stage);
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  });
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    const p3 = pts[(i + 2) % N];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

/** Outline per step: contact, pseudopodia, closed (and stays closed). */
const OUTLINES = [1, 2, 3, 3, 3].map(outline);

const PHAGO: [number, number] = [CX + 36, CY - 6];
const LYSO: [number, number][] = [
  [CX - 30, CY - 46],
  [CX + 6, CY + 48],
  [CX + 40, CY + 44],
  [CX - 52, CY + 30],
  [CX + 12, CY - 56],
];
const BITS: [number, number][] = [
  [-8, -4],
  [6, -7],
  [9, 5],
  [-4, 7],
  [0, 0],
];
/** Where the presented antigens sit on the surface (angles in degrees). */
const PRESENT = [-118, -64];

type Stage = { name: Text; text: Text };

const STAGES_1: Stage[] = [
  { name: tx("Recognise", "Erkennen"), text: tx("The phagocyte (a white blood cell) recognises the intruder by its foreign surface and sticks to it.", "Die Fresszelle (ein weißes Blutkörperchen) erkennt den Eindringling an seiner fremden Oberfläche und heftet sich an.") },
  { name: tx("Flow around", "Umfließen"), text: tx("It flows around the bacterium with false feet (pseudopodia).", "Sie umfließt das Bakterium mit Scheinfüßchen.") },
  { name: tx("Enclose", "Einschließen"), text: tx("Now the bacterium lies inside a small bubble in the phagocyte.", "Jetzt liegt das Bakterium in einem Bläschen in der Fresszelle.") },
  { name: tx("Digest", "Verdauen"), text: tx("Digestive enzymes break the bacterium down.", "Verdauungsenzyme zerlegen das Bakterium.") },
  { name: tx("Get rid of", "Ausscheiden"), text: tx("The phagocyte releases what it can't digest. Then it's ready for the next intruder.", "Was sie nicht verdauen kann, gibt die Fresszelle nach außen ab. Dann ist sie bereit für den nächsten Eindringling.") },
];

const STAGES_2: Stage[] = [
  { name: tx("Recognise", "Erkennen"), text: tx("The macrophage recognises foreign surface features of the bacterium and attaches itself. It only tells foreign from own: a non-specific defence.", "Die Makrophage erkennt körperfremde Oberflächenmerkmale des Bakteriums und heftet sich an. Sie unterscheidet nur fremd und eigen: unspezifische Abwehr.") },
  { name: tx("Flow around", "Umfließen"), text: tx("With pseudopodia it flows around the bacterium.", "Mit Scheinfüßchen (Pseudopodien) umfließt sie das Bakterium.") },
  { name: tx("Phagosome", "Phagosom"), text: tx("The membrane closes: the bacterium is in a feeding vesicle (phagosome). This uptake is called phagocytosis.", "Die Membran schließt sich: Das Bakterium liegt in einem Fressbläschen (Phagosom). Diese Aufnahme heißt Phagocytose.") },
  { name: tx("Digest", "Verdauen"), text: tx("Lysosomes fuse with the phagosome. Their enzymes break the bacterium down.", "Lysosomen verschmelzen mit dem Phagosom. Ihre Enzyme zerlegen das Bakterium.") },
  { name: tx("Present", "Präsentieren"), text: tx("Remains are released. Fragments of the pathogen (antigens) are displayed on the surface: the signal for the T helper cells.", "Reste werden ausgeschieden. Bruchstücke des Erregers (Antigene) zeigt die Makrophage auf ihrer Oberfläche: das Signal für die T-Helferzellen.") },
];

export function ImmunePhagocyte({ level = 2 }: { level?: 1 | 2 }) {
  const t = useText();
  const stages = level === 1 ? STAGES_1 : STAGES_2;
  const [s, setS] = useState(0);
  const spring = { type: "spring" as const, stiffness: 70, damping: 15 };
  const bactPos = s <= 1 ? { x: CX + 124, y: CY } : { x: PHAGO[0], y: PHAGO[1] };
  const present = level === 2 && s >= 4;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 500 290" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Phagocytosis", "Phagocytose"))}>
          {/* the bacterium arriving (drawn behind the cell once it is inside) */}
          <motion.path d={OUTLINES[0]} animate={{ d: OUTLINES[s] }} transition={{ duration: 1.1, ease: "easeInOut" }} fill={PAINT.macro.fill} stroke={PAINT.macro.stroke} strokeWidth={2.4} strokeLinejoin="round" />
          {/* nucleus */}
          <path
            d={`M ${CX - 58} ${CY + 4} c 2 -26 30 -34 44 -18 c 8 9 0 22 -10 20 c -10 -2 -14 6 -10 14 c 4 10 -6 18 -14 14 c -10 -5 -12 -18 -10 -30 Z`}
            fill="var(--bio-nucleus)"
            stroke="var(--bio-nucleus-deep)"
            strokeWidth={1.6}
          />
          {/* lysosomes */}
          {LYSO.map(([x, y], i) => (
            <motion.circle
              key={i}
              r={6}
              fill="var(--bio-mito-deep)"
              initial={{ cx: x, cy: y, opacity: 0.85 }}
              animate={s >= 3 ? { cx: PHAGO[0] + (i - 2) * 4, cy: PHAGO[1] + ((i % 2) * 2 - 1) * 10, opacity: 0 } : { cx: x, cy: y, opacity: 0.85 }}
              transition={{ duration: 0.9, delay: s >= 3 ? i * 0.08 : 0 }}
            />
          ))}
          {/* phagosome */}
          <motion.circle
            cx={PHAGO[0]}
            cy={PHAGO[1]}
            r={34}
            fill="var(--bio-mito-deep)"
            stroke={PAINT.macro.stroke}
            strokeWidth={1.8}
            initial={{ opacity: 0, fillOpacity: 0 }}
            animate={{ opacity: s >= 2 && s < 4 ? 1 : s >= 4 ? 0.5 : 0, fillOpacity: s >= 3 ? 0.35 : 0.06 }}
            transition={{ duration: 0.8, delay: s === 2 ? 0.6 : 0 }}
          />
          {/* the bacterium, whole */}
          <motion.g initial={{ x: CX + 210, y: CY - 50, opacity: 1 }} animate={{ ...bactPos, opacity: s >= 3 ? 0 : 1, scale: s >= 2 ? 0.85 : 1 }} transition={spring}>
            <BacteriumRod w={22} h={11} flagellum={s === 0} shape="tri" />
          </motion.g>
          {/* fragments */}
          {BITS.map(([dx, dy], i) => {
            const out = i < 3 || level === 1;
            const ang = ((PRESENT[i - 3] ?? -90) * Math.PI) / 180;
            const target =
              s < 4
                ? { x: PHAGO[0] + dx, y: PHAGO[1] + dy }
                : out
                  ? { x: CX - 150 - i * 12, y: CY + 70 + i * 8 }
                  : { x: CX + (radius(ang, 3) + 1) * Math.cos(ang), y: CY + (radius(ang, 3) + 1) * Math.sin(ang) };
            return (
              <motion.g
                key={i}
                initial={{ x: PHAGO[0] + dx, y: PHAGO[1] + dy, opacity: 0, rotate: 0 }}
                animate={{ ...target, opacity: s < 3 ? 0 : out && s >= 4 ? 0.45 : 1, rotate: out ? 0 : (PRESENT[i - 3] ?? 0) + 90 }}
                transition={{ ...spring, delay: s >= 4 ? 0.1 * i : 0.3 }}
              >
                <path d={bumpPath("tri", 5)} fill={PAINT.bact.stroke} />
              </motion.g>
            );
          })}
          {/* MHC "holders" for presented antigens */}
          {level === 2 &&
            PRESENT.map((a) => {
              const ang = (a * Math.PI) / 180;
              const r = radius(ang, 3) - 2;
              return (
                <motion.path
                  key={a}
                  d="M -9 0 L -9 -9 M 9 0 L 9 -9"
                  stroke="var(--bio-u)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  transform={`translate(${f(CX + r * Math.cos(ang))} ${f(CY + r * Math.sin(ang))}) rotate(${a + 90})`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: present ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: present ? 0.8 : 0 }}
                />
              );
            })}
        </svg>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setS(Math.max(0, s - 1))} disabled={s === 0} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40" aria-label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-1.5">
          {stages.map((st, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setS(i)}
              className={cn("rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors", i === s ? "border-blob bg-blob-soft text-blob-ink" : i < s ? "border-line text-ink-2" : "border-line text-ink-3 hover:text-ink")}
            >
              {i + 1}. {t(st.name)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setS(Math.min(stages.length - 1, s + 1))} disabled={s === stages.length - 1} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-paper disabled:opacity-40" aria-label={t(tx("Next step", "Nächster Schritt"))}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      <motion.p key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{t(stages[s].name)}: </span>
        {t(stages[s].text)}
      </motion.p>
    </div>
  );
}
