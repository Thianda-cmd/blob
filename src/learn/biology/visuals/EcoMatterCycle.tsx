"use client";

// The cycle of matter for beginners: producers → consumers → dead remains → decomposers →
// minerals → producers. A token travels round the ring step by step; the sun only feeds in.

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

const CX = 260;
const CY = 178;
const R = 112;
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number, r = R): [number, number] => [CX + r * cos(rad(deg)), CY + r * sin(rad(deg))];

type Station = "producer" | "consumer" | "remains" | "decomposer" | "minerals";
const STEPS: { at: Station; angle: number; title: Text; text: Text }[] = [
  {
    at: "producer",
    angle: -90,
    title: tx("Producers", "Produzenten"),
    text: tx(
      "Plants use light energy to build their food from water, carbon dioxide and minerals (photosynthesis). They produce food for everyone else.",
      "Pflanzen bauen mit Lichtenergie aus Wasser, Kohlenstoffdioxid und Mineralstoffen ihre Nährstoffe auf (Fotosynthese). Sie erzeugen die Nahrung für alle anderen.",
    ),
  },
  {
    at: "consumer",
    angle: 0,
    title: tx("Consumers", "Konsumenten"),
    text: tx("Animals eat plants or other animals. That's how the substances get into them.", "Tiere fressen Pflanzen oder andere Tiere. So gelangen die Stoffe in ihren Körper."),
  },
  {
    at: "remains",
    angle: 45,
    title: tx("Dead remains", "Tote Reste"),
    text: tx("Dead plants and animals, fallen leaves and droppings are left over. The dashed arrow: leaves also fall straight to the ground.", "Übrig bleiben tote Pflanzen und Tiere, Laub und Kot. Der gestrichelte Pfeil: Laub fällt auch direkt zu Boden."),
  },
  {
    at: "decomposer",
    angle: 90,
    title: tx("Decomposers", "Destruenten (Zersetzer)"),
    text: tx(
      "Soil animals such as earthworms and woodlice chew the remains into small bits. Bacteria and fungi break them down completely.",
      "Bodentiere wie Regenwurm und Assel zerkleinern die Reste. Bakterien und Pilze bauen sie vollständig ab.",
    ),
  },
  {
    at: "minerals",
    angle: 180,
    title: tx("Minerals", "Mineralstoffe"),
    text: tx(
      "What's left are minerals, water and carbon dioxide. Plants take them up again: the cycle is closed. Nothing is lost!",
      "Übrig bleiben Mineralstoffe, Wasser und Kohlenstoffdioxid. Die Pflanzen nehmen sie wieder auf: Der Kreislauf ist geschlossen. Nichts geht verloren!",
    ),
  },
];

function Label({ x, y, text, lit, anchor = "middle" }: { x: number; y: number; text: string; lit: boolean; anchor?: "start" | "middle" | "end" }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={15.5}
      fontWeight={700}
      fill={lit ? "var(--blob)" : "var(--ink)"}
      stroke="var(--raised)"
      strokeWidth={4}
      paintOrder="stroke"
      strokeLinejoin="round"
      style={{ fontFamily: "var(--font-sans)", transition: "fill .25s" }}
    >
      {text}
    </text>
  );
}

function arc(a0: number, a1: number, r = R) {
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function ArcArrow({ a0, a1, lit }: { a0: number; a1: number; lit: boolean }) {
  const [x1, y1] = pt(a1);
  const tang = rad(a1 + 90);
  const l = 11;
  const head = `${x1},${y1} ${x1 - l * cos(tang - 0.45)},${y1 - l * sin(tang - 0.45)} ${x1 - l * cos(tang + 0.45)},${y1 - l * sin(tang + 0.45)}`;
  const c = lit ? "var(--blob)" : "var(--ink-3)";
  return (
    <g style={{ transition: "opacity .25s" }}>
      <path d={arc(a0, a1 - 3)} fill="none" stroke={c} strokeWidth={lit ? 3.5 : 2.5} strokeLinecap="round" />
      <polygon points={head} fill={c} />
    </g>
  );
}

export function EcoMatterCycle() {
  const t = useText();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [lap, setLap] = useState(0);
  const angle = useMotionValue(STEPS[0].angle);
  const tx0 = useTransform(angle, (a) => CX + R * cos(rad(a)));
  const ty0 = useTransform(angle, (a) => CY + R * sin(rad(a)));

  const go = (dir: 1 | -1) => {
    let next = step + dir;
    let nextLap = lap;
    if (next >= STEPS.length) {
      next = 0;
      nextLap = lap + 1;
    }
    if (next < 0) {
      next = STEPS.length - 1;
      nextLap = lap - 1;
    }
    setStep(next);
    setLap(nextLap);
    const target = STEPS[next].angle + 360 * nextLap;
    if (reduce) angle.set(target);
    else animate(angle, target, { type: "spring", stiffness: 70, damping: 16 });
  };

  const at = STEPS[step].at;
  const lit = (s: Station) => s === at;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface px-2 py-2">
        <svg viewBox="0 0 520 356" className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("The cycle of matter in an ecosystem", "Der Stoffkreislauf im Ökosystem"))}>
          {/* sun feeding light energy in */}
          <g>
            <circle cx={60} cy={52} r={22} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.5} />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return <line key={i} x1={60 + 28 * cos(a)} y1={52 + 28 * sin(a)} x2={60 + 36 * cos(a)} y2={52 + 36 * sin(a)} stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" />;
            })}
            <path d="M96 62 Q150 48 196 58" fill="none" stroke="var(--bio-sun)" strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" />
            <polygon points="204,60 192,53 194,65" fill="var(--bio-sun)" />
          </g>

          {/* the ring */}
          <ArcArrow a0={-80} a1={-10} lit={at === "consumer"} />
          <ArcArrow a0={10} a1={80} lit={at === "remains" || at === "decomposer"} />
          <ArcArrow a0={100} a1={170} lit={at === "minerals"} />
          <ArcArrow a0={190} a1={260} lit={at === "producer"} />
          {/* leaves falling straight to the decomposers */}
          <path d={`M${CX} ${CY - R + 46} V${CY + R - 52}`} stroke={at === "remains" ? "var(--blob)" : "var(--ink-3)"} strokeWidth={2.2} strokeDasharray="6 6" />
          <polygon points={`${CX},${CY + R - 44} ${CX - 6},${CY + R - 56} ${CX + 6},${CY + R - 56}`} fill={at === "remains" ? "var(--blob)" : "var(--ink-3)"} />
          <ellipse cx={CX + 16} cy={CY - 8} rx={8} ry={4} transform={`rotate(-30 ${CX + 16} ${CY - 8})`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
          <ellipse cx={CX - 14} cy={CY + 22} rx={8} ry={4} transform={`rotate(25 ${CX - 14} ${CY + 22})`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1} />

          {/* producer: a plant */}
          <g transform={`translate(${CX} ${CY - R})`}>
            <circle r={34} fill="var(--raised)" stroke={lit("producer") ? "var(--blob)" : "var(--line-2)"} strokeWidth={lit("producer") ? 3 : 1.5} />
            <path d="M0 24 V-14" stroke="var(--bio-leaf-deep)" strokeWidth={2.5} />
            <path d="M0 6 q-18 -2 -20 -16 q16 0 20 16 z M0 -2 q18 -2 20 -16 q-16 0 -20 16 z M0 -14 q-8 -12 0 -20 q8 8 0 20 z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
            <path d="M-14 24 h28" stroke="var(--bio-soil)" strokeWidth={3} strokeLinecap="round" />
          </g>
          <Label x={CX + 44} y={CY - R - 14} text={t(tx("Producers", "Produzenten"))} lit={lit("producer")} anchor="start" />

          {/* consumer: a hare */}
          <g transform={`translate(${CX + R} ${CY})`}>
            <circle r={34} fill="var(--raised)" stroke={lit("consumer") ? "var(--blob)" : "var(--line-2)"} strokeWidth={lit("consumer") ? 3 : 1.5} />
            <ellipse cx={-4} cy={8} rx={17} ry={11} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
            <circle cx={12} cy={-2} r={8} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
            <ellipse cx={10} cy={-17} rx={3} ry={10} transform="rotate(-12 10 -17)" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
            <ellipse cx={16} cy={-17} rx={3} ry={10} transform="rotate(10 16 -17)" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
            <circle cx={15} cy={-3} r={1.4} fill="var(--bio-outline)" />
            <circle cx={-21} cy={4} r={4} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
          </g>
          <Label x={CX + R} y={CY + 54} text={t(tx("Consumers", "Konsumenten"))} lit={lit("consumer")} />

          {/* decomposers: mushroom and earthworm */}
          <g transform={`translate(${CX} ${CY + R})`}>
            <circle r={34} fill="var(--raised)" stroke={lit("decomposer") || lit("remains") ? "var(--blob)" : "var(--line-2)"} strokeWidth={lit("decomposer") ? 3 : 1.5} />
            <path d="M-12 14 v-10 q0 -2 2 -2 h4 q2 0 2 2 v10 z" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            <path d="M-20 3 q12 -20 24 0 z" fill="var(--bio-mito-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            <path d="M-2 22 q6 -8 14 -2 q8 6 14 -2" stroke="var(--bio-flesh-deep)" strokeWidth={4.5} fill="none" strokeLinecap="round" />
            <path d="M-24 16 h48" stroke="var(--bio-soil)" strokeWidth={3} strokeLinecap="round" />
          </g>
          <Label x={CX + 44} y={CY + R + 34} text={t(tx("Decomposers", "Destruenten"))} lit={lit("decomposer")} anchor="start" />
          <Label x={CX + R - 14} y={CY + R - 22} text={t(tx("dead remains", "tote Reste"))} lit={lit("remains")} anchor="start" />

          {/* minerals in the soil */}
          <g transform={`translate(${CX - R} ${CY})`}>
            <circle r={34} fill="var(--raised)" stroke={lit("minerals") ? "var(--blob)" : "var(--line-2)"} strokeWidth={lit("minerals") ? 3 : 1.5} />
            <path d="M-26 10 h52 v10 q-26 10 -52 0 z" fill="var(--bio-soil)" opacity={0.7} />
            {[
              [-12, -6, "var(--bio-water)"],
              [4, -12, "var(--bio-sun)"],
              [14, 2, "var(--bio-nucleus-deep)"],
              [-2, 6, "var(--bio-chloro)"],
              [-18, 10, "var(--bio-sun)"],
              [10, 14, "var(--bio-water)"],
            ].map(([x, y, c]) => (
              <path key={`${x}${y}`} d={`M${x} ${Number(y) - 5} l4.3 2.5 v5 l-4.3 2.5 l-4.3 -2.5 v-5 z`} fill={String(c)} stroke="var(--bio-outline)" strokeWidth={0.8} />
            ))}
          </g>
          <Label x={CX - R} y={CY + 54} text={t(tx("Minerals", "Mineralstoffe"))} lit={lit("minerals")} />

          {/* travelling token */}
          <motion.circle cx={tx0} cy={ty0} r={9} fill="var(--blob)" stroke="var(--raised)" strokeWidth={3} />
        </svg>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => go(-1)} aria-label={t(tx("Previous station", "Vorige Station"))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 hover:bg-hover hover:text-ink">
          <ChevronLeft className="size-5" />
        </button>
        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-h-[5.5rem] flex-1 rounded-xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink-2" aria-live="polite">
          <span className="font-semibold text-ink">
            {step + 1}. {t(STEPS[step].title)}
          </span>
          <span className="block">{t(STEPS[step].text)}</span>
        </motion.div>
        <button type="button" onClick={() => go(1)} aria-label={t(tx("Next station", "Nächste Station"))} className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob text-white transition-transform active:scale-[0.96]">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="flex justify-center gap-1.5">
        {STEPS.map((s, i) => (
          <span key={s.at} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-blob" : "w-1.5 bg-line-2")} />
        ))}
      </div>
    </div>
  );
}
