"use client";

// Level 3 widget for "nervous-system": how the resting potential arises, step by step, as a
// thought experiment: ion distribution (0 mV) → K⁺ leak channels open, K⁺ diffuses out →
// electrical gradient pulls back, equilibrium near −90 mV → a little Na⁺ leaks in (−70 mV) →
// the sodium-potassium pump keeps the gradients up (3 Na⁺ out, 2 K⁺ in, ATP).

import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { ActionButton, GhostButton, Note, SvgLabel } from "./NerveKit";

const W = 560;
const H = 230;
const TOP = 88; // membrane top
const BOT = 122; // membrane bottom
const K_CH = [150, 262];
const NA_CH = 374;
const PUMP = 470;

type Kind = "na" | "k" | "cl" | "a";
const COLOR: Record<Kind, string> = { na: "var(--bio-c)", k: "var(--bio-t)", cl: "var(--bio-leaf)", a: "var(--bio-nucleus-deep)" };

const OUT_NA: [number, number][] = [[24, 22], [70, 52], [118, 18], [196, 34], [236, 62], [300, 22], [338, 54], [410, 30], [452, 60], [510, 24], [540, 56], [92, 76]];
const OUT_CL: [number, number][] = [[46, 36], [160, 58], [270, 42], [384, 66], [480, 40], [530, 76], [220, 14]];
const OUT_K: [number, number][] = [[350, 16], [100, 40]];
const IN_K: [number, number][] = [[30, 150], [80, 186], [186, 160], [222, 204], [300, 152], [336, 192], [420, 160], [500, 196], [540, 150], [120, 212]];
const IN_A: [number, number][] = [[60, 206], [132, 160], [250, 180], [380, 204], [460, 178], [528, 214], [196, 214]];
const IN_NA: [number, number][] = [[400, 140], [270, 216]];
/** K⁺ that leave through the leak channels (start inside, end just outside). */
const K_MOVE: { from: [number, number]; to: [number, number]; ch: number }[] = [
  { from: [140, 146], to: [128, 76], ch: 0 },
  { from: [168, 190], to: [176, 70], ch: 0 },
  { from: [250, 140], to: [244, 78], ch: 1 },
  { from: [282, 182], to: [286, 70], ch: 1 },
];

const STEPS: { title: Text; mv: number; text: Text }[] = [
  {
    title: tx("Ion distribution", "Ionenverteilung"),
    mv: 0,
    text: tx(
      "Inside: lots of K⁺ and large, negatively charged protein anions (A⁻). Outside: lots of Na⁺ and Cl⁻. Each side on its own is neutral, so the voltage is 0 mV. (Thought experiment: the membrane doesn't let anything through yet.)",
      "Innen: viele K⁺ und große, negativ geladene Eiweiß-Anionen (A⁻). Außen: viele Na⁺ und Cl⁻. Jede Seite für sich ist neutral, die Spannung ist 0 mV. (Gedankenexperiment: Die Membran lässt noch nichts durch.)",
    ),
  },
  {
    title: tx("K⁺ leak channels", "Kalium-Leckkanäle"),
    mv: -60,
    text: tx(
      "At rest mainly **K⁺ leak channels** are open. K⁺ diffuses **out**, down its concentration gradient. The A⁻ can't follow: a surplus of negative charge stays inside, positive charge builds up outside.",
      "In Ruhe sind vor allem **Kalium-Leckkanäle** offen. K⁺ diffundiert dem Konzentrationsgefälle folgend **nach außen**. Die A⁻ können nicht folgen: Innen bleibt negative Ladung übrig, außen sammelt sich positive Ladung.",
    ),
  },
  {
    title: tx("Equilibrium", "Gleichgewicht"),
    mv: -90,
    text: tx(
      "The more K⁺ is outside, the more strongly the negative inside pulls K⁺ back (**electrical gradient**). At about −90 mV both forces balance: as many K⁺ leave as come back (**equilibrium potential** of K⁺).",
      "Je mehr K⁺ draußen ist, desto stärker zieht das negative Innere K⁺ zurück (**Ladungsgefälle**). Bei etwa −90 mV halten sich beide Kräfte die Waage: Es strömen gleich viele K⁺ hinaus wie herein (**Gleichgewichtspotenzial** von K⁺).",
    ),
  },
  {
    title: tx("A little Na⁺ leaks in", "Etwas Na⁺ sickert ein"),
    mv: -70,
    text: tx(
      "The membrane also lets a little **Na⁺** through. A few Na⁺ leak in and make the inside slightly less negative: the **resting potential is about −70 mV**.",
      "Die Membran ist auch ein wenig für **Na⁺** durchlässig. Ein paar Na⁺ sickern ein und machen das Innere etwas weniger negativ: Das **Ruhepotenzial liegt bei etwa −70 mV**.",
    ),
  },
  {
    title: tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"),
    mv: -70,
    text: tx(
      "Left alone, the leaks would slowly even out the concentrations. The **sodium-potassium pump** uses ATP to move **3 Na⁺ out and 2 K⁺ in** (active transport). It keeps the concentration differences up.",
      "Von allein würden die Leckströme die Konzentrationen langsam ausgleichen. Die **Natrium-Kalium-Pumpe** befördert unter ATP-Verbrauch **3 Na⁺ hinaus und 2 K⁺ hinein** (aktiver Transport). So bleiben die Konzentrationsunterschiede erhalten.",
    ),
  },
];

const TABLE: { ion: string; inside: string; outside: string; kind: Kind }[] = [
  { ion: "K⁺", inside: "155", outside: "4", kind: "k" },
  { ion: "Na⁺", inside: "12", outside: "145", kind: "na" },
  { ion: "Cl⁻", inside: "4", outside: "120", kind: "cl" },
  { ion: "A⁻", inside: "155", outside: "–", kind: "a" },
];

function Ion({ x, y, kind, animateTo, delay = 0 }: { x: number; y: number; kind: Kind; animateTo?: [number, number]; delay?: number }) {
  const r = kind === "a" ? 7.5 : 5.2;
  if (!animateTo) return <circle cx={x} cy={y} r={r} fill={COLOR[kind]} stroke="var(--bio-outline)" strokeWidth={0.7} />;
  return <motion.circle initial={false} animate={{ cx: animateTo[0], cy: animateTo[1] }} transition={{ duration: 1.2, delay, ease: "easeInOut" }} r={r} fill={COLOR[kind]} stroke="var(--bio-outline)" strokeWidth={0.7} />;
}

function Arrow({ x, y1, y2, color, label }: { x: number; y1: number; y2: number; color: string; label: string }) {
  const up = y2 < y1;
  return (
    <g>
      <line x1={x} x2={x} y1={y1} y2={y2 + (up ? 6 : -6)} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <path d={up ? `M${x - 6} ${y2 + 8} L${x} ${y2} L${x + 6} ${y2 + 8}` : `M${x - 6} ${y2 - 8} L${x} ${y2} L${x + 6} ${y2 - 8}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <SvgLabel x={x + 10} y={(y1 + y2) / 2} anchor="start" size={10.5} fill={color} halo>
        {label}
      </SvgLabel>
    </g>
  );
}

export function NerveRestingLab() {
  const t = useText();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const S = STEPS[step];
  const kOpen = step >= 1;
  const charge = step === 0 ? 0 : step === 1 ? 0.6 : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={step === i}
            onClick={() => setStep(i)}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors", step === i ? "border-transparent bg-blob text-white" : i < step ? "border-blob/30 bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover")}
          >
            <span className="font-math">{i + 1}</span> {t(s.title)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-stretch">
        <div className="overflow-hidden rounded-xl border border-line">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Membrane of a nerve cell at rest", "Membran einer Nervenzelle in Ruhe"))}>
            <rect x={0} y={0} width={W} height={TOP} fill="var(--bio-vacuole)" opacity={0.45} />
            <rect x={0} y={BOT} width={W} height={H - BOT} fill="var(--bio-nerve)" opacity={0.18} />
            <rect x={0} y={TOP} width={W} height={BOT - TOP} fill="var(--bio-membrane)" opacity={0.25} />
            {Array.from({ length: 57 }, (_, i) => (
              <g key={i}>
                <circle cx={i * 10 + 2} cy={TOP + 4} r={4} fill="var(--bio-membrane)" />
                <circle cx={i * 10 + 2} cy={BOT - 4} r={4} fill="var(--bio-membrane)" />
              </g>
            ))}
            {/* K⁺ leak channels */}
            {K_CH.map((x) => (
              <g key={x}>
                <rect x={x - 14} y={TOP - 6} width={11} height={BOT - TOP + 12} rx={5} fill="var(--bio-t)" stroke="var(--bio-outline)" strokeWidth={1.2} />
                <rect x={x + 3} y={TOP - 6} width={11} height={BOT - TOP + 12} rx={5} fill="var(--bio-t)" stroke="var(--bio-outline)" strokeWidth={1.2} />
                {!kOpen && <rect x={x - 8} y={TOP - 10} width={16} height={6} rx={3} fill="var(--ink-2)" />}
              </g>
            ))}
            {/* Na⁺ leak channel */}
            <rect x={NA_CH - 12} y={TOP - 6} width={10} height={BOT - TOP + 12} rx={5} fill="var(--bio-c)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            <rect x={NA_CH + 2} y={TOP - 6} width={10} height={BOT - TOP + 12} rx={5} fill="var(--bio-c)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            {step < 3 && <rect x={NA_CH - 7} y={TOP - 10} width={14} height={6} rx={3} fill="var(--ink-2)" />}
            {/* the pump */}
            {step >= 4 && (
              <g>
                <rect x={PUMP - 20} y={TOP - 10} width={40} height={BOT - TOP + 20} rx={14} fill="var(--bio-u)" stroke="var(--bio-outline)" strokeWidth={1.4} />
                <SvgLabel x={PUMP} y={H - 14} size={11} fill="var(--ink)" halo>
                  ATP → ADP
                </SvgLabel>
              </g>
            )}
            {OUT_NA.map(([x, y], i) => (
              <Ion key={`on${i}`} x={x} y={y} kind="na" />
            ))}
            {OUT_CL.map(([x, y], i) => (
              <Ion key={`oc${i}`} x={x} y={y} kind="cl" />
            ))}
            {OUT_K.map(([x, y], i) => (
              <Ion key={`ok${i}`} x={x} y={y} kind="k" />
            ))}
            {IN_K.map(([x, y], i) => (
              <Ion key={`ik${i}`} x={x} y={y} kind="k" />
            ))}
            {IN_A.map(([x, y], i) => (
              <Ion key={`ia${i}`} x={x} y={y} kind="a" />
            ))}
            {IN_NA.map(([x, y], i) => (
              <Ion key={`in${i}`} x={x} y={y} kind="na" />
            ))}
            {K_MOVE.map((m, i) => (
              <Ion key={`km${i}`} x={m.from[0]} y={m.from[1]} kind="k" animateTo={kOpen ? m.to : m.from} delay={reduce ? 0 : i * 0.25} />
            ))}
            <Ion x={NA_CH + 22} y={40} kind="na" animateTo={step >= 3 ? [NA_CH - 6, 150] : [NA_CH + 22, 40]} />
            {step >= 4 && !reduce && (
              <g>
                {[0, 1, 2].map((i) => (
                  <motion.circle
                    key={`pn${i}`}
                    r={5.2}
                    fill={COLOR.na}
                    stroke="var(--bio-outline)"
                    strokeWidth={0.7}
                    initial={{ cx: PUMP - 8 + i * 8, cy: 170 }}
                    animate={{ cx: [PUMP - 8 + i * 8, PUMP - 6 + i * 6, PUMP - 30 + i * 30], cy: [170, 105, 40] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, delay: i * 0.1 }}
                  />
                ))}
                {[0, 1].map((i) => (
                  <motion.circle
                    key={`pk${i}`}
                    r={5.2}
                    fill={COLOR.k}
                    stroke="var(--bio-outline)"
                    strokeWidth={0.7}
                    initial={{ cx: PUMP - 10 + i * 20, cy: 44 }}
                    animate={{ cx: [PUMP - 10 + i * 20, PUMP - 4 + i * 8, PUMP - 22 + i * 44], cy: [44, 105, 176] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, delay: 1.2 + i * 0.1 }}
                  />
                ))}
              </g>
            )}
            {/* charges along the membrane */}
            {charge > 0 &&
              Array.from({ length: 11 }, (_, i) => 30 + i * 50).map((x) => (
                <g key={x} opacity={0.3 + 0.7 * charge}>
                  <SvgLabel x={x} y={TOP - 14} size={14} weight={700} fill="var(--bio-blood)">
                    +
                  </SvgLabel>
                  <SvgLabel x={x} y={BOT + 13} size={14} weight={700} fill="var(--bio-t)">
                    −
                  </SvgLabel>
                </g>
              ))}
            {step === 2 && (
              <g>
                <Arrow x={206} y1={170} y2={64} color="var(--bio-t)" label={t(tx("concentration gradient", "Konzentrationsgefälle"))} />
                <Arrow x={330} y1={64} y2={170} color="var(--bio-blood)" label={t(tx("electrical gradient", "Ladungsgefälle"))} />
              </g>
            )}
            <SvgLabel x={W - 6} y={10} anchor="end" size={11} fill="var(--ink-2)" halo>
              {t(tx("outside", "außen"))}
            </SvgLabel>
            <SvgLabel x={W - 6} y={H - 10} anchor="end" size={11} fill="var(--ink-2)" halo>
              {t(tx("inside", "innen"))}
            </SvgLabel>
          </svg>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-3">
          <div>
            <div className="text-[12px] text-ink-3">{t(tx("Voltage (inside vs outside)", "Spannung (innen gegen außen)"))}</div>
            <motion.div key={S.mv} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-math text-[28px] font-semibold tabular-nums text-blob-ink">
              {S.mv === 0 ? "0" : `−${-S.mv}`} mV
            </motion.div>
          </div>
          <table className="w-full text-[12.5px] tabular-nums">
            <thead>
              <tr className="text-ink-3">
                <th className="text-left font-medium" />
                <th className="text-right font-medium">{t(tx("in", "innen"))}</th>
                <th className="text-right font-medium">{t(tx("out", "außen"))}</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map((r) => (
                <tr key={r.ion} className="text-ink-2">
                  <td className="py-0.5">
                    <span className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: COLOR[r.kind] }} />
                    {r.ion}
                  </td>
                  <td className="text-right">{r.inside}</td>
                  <td className="text-right">{r.outside}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-ink-3">{t(tx("in mmol/l (mammal)", "in mmol/l (Säugetier)"))}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton label={t(tx("Previous step", "Voriger Schritt"))} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          <ChevronLeft className="size-4" />
        </GhostButton>
        <ActionButton onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>
          {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </ActionButton>
      </div>
      <Note id={`s${step}`} text={S.text} accent={step >= 3} />
    </div>
  );
}
