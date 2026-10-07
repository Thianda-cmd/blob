"use client";

// Picture: the modelling cycle (Modellierungskreislauf). Reality on the left, maths on the
// right; four steps lead round: mathematise, solve, interpret, validate. Tap a step to
// read what it means; the phone-battery example runs through all four stations.

import { motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";

type Station = { x: number; y: number; title: Text; example: Text; math?: Text };
type Step = { name: Text; what: Text; from: number; to: number };

const BW = 140;
const BH = 84;
const W = 420;
const H = 290;

const STATIONS: Station[] = [
  { x: 8, y: 22, title: tx("Real situation", "Reale Situation"), example: tx("Battery at 100 %, minus 8 % an hour: when is it empty?", "Akku bei 100 %, minus 8 % pro Stunde: Wann ist er leer?") },
  { x: W - BW - 8, y: 22, title: tx("Maths model", "Mathematisches Modell"), example: "", math: "A(t) = 100 - 8t" },
  { x: W - BW - 8, y: H - BH - 8, title: tx("Maths result", "Mathematisches Ergebnis"), example: "", math: tx("t = 12.5", "t = 12,5") },
  { x: 8, y: H - BH - 8, title: tx("Real result", "Reales Ergebnis"), example: tx("Empty after about 12 h 30 min.", "Nach etwa 12 h 30 min leer.") },
];

const STEPS: Step[] = [
  {
    name: tx("Mathematise", "Mathematisieren"),
    what: tx(
      "Turn the story into maths: choose variables and a model (here linear, because the battery loses the same amount every hour).",
      "Aus der Geschichte wird Mathe: Variablen wählen und ein Modell aufstellen (hier linear, weil der Akku jede Stunde gleich viel verliert).",
    ),
    from: 0,
    to: 1,
  },
  { name: tx("Solve", "Lösen"), what: tx("Work inside the maths: solve 100 − 8t = 0.", "Innerhalb der Mathematik rechnen: 100 − 8t = 0 lösen."), from: 1, to: 2 },
  {
    name: tx("Interpret", "Interpretieren"),
    what: tx("Translate the number back: t = 12.5 means 12 hours and 30 minutes.", "Die Zahl zurückübersetzen: t = 12,5 heißt 12 Stunden und 30 Minuten."),
    from: 2,
    to: 3,
  },
  {
    name: tx("Validate", "Validieren"),
    what: tx(
      "Does it make sense? The model only works from 0 to 12.5 h, and a real battery doesn't drain perfectly evenly. If it doesn't fit, improve the model and go round again.",
      "Passt das? Das Modell gilt nur von 0 bis 12,5 h, und ein echter Akku entlädt sich nicht ganz gleichmäßig. Passt es nicht, verbesserst du das Modell und gehst noch eine Runde.",
    ),
    from: 3,
    to: 0,
  },
];

/** Arrow path between two stations along the outside of the cycle. */
function arrow(i: number) {
  const a = STATIONS[STEPS[i].from];
  const b = STATIONS[STEPS[i].to];
  if (i === 0) return { d: `M ${a.x + BW + 4} ${a.y + BH / 2} L ${b.x - 8} ${b.y + BH / 2}`, lx: W / 2, ly: a.y + BH / 2 - 9 };
  if (i === 1) return { d: `M ${a.x + BW / 2} ${a.y + BH + 4} L ${b.x + BW / 2} ${b.y - 8}`, lx: a.x + BW / 2 + 8, ly: H / 2 + 4 };
  if (i === 2) return { d: `M ${a.x - 4} ${a.y + BH / 2} L ${b.x + BW + 8} ${b.y + BH / 2}`, lx: W / 2, ly: a.y + BH / 2 + 17 };
  return { d: `M ${a.x + BW / 2} ${a.y - 4} L ${b.x + BW / 2} ${b.y + BH + 8}`, lx: a.x + BW / 2 - 8, ly: H / 2 + 4 };
}

export function ModelCycle() {
  const t = useText();
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-[560px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label={t(tx("The modelling cycle", "Der Modellierungskreislauf"))}>
          <defs>
            <marker id="wp-cycle-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
            </marker>
          </defs>
          <line x1={W / 2} x2={W / 2} y1={4} y2={H - 4} stroke="var(--line-2)" strokeDasharray="4 5" />
          <text x={W / 2 - 8} y={14} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.08em" }}>
            {t(tx("REALITY", "REALITÄT"))}
          </text>
          <text x={W / 2 + 8} y={14} fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)", letterSpacing: "0.08em" }}>
            {t(tx("MATHS", "MATHEMATIK"))}
          </text>

          {STEPS.map((s, i) => {
            const a = arrow(i);
            const on = i === step;
            return (
              <g key={i} onClick={() => setStep(i)} style={{ cursor: "pointer" }}>
                <path d={a.d} stroke="transparent" strokeWidth={22} />
                <motion.path
                  d={a.d}
                  fill="none"
                  stroke="var(--blob)"
                  strokeLinecap="round"
                  markerEnd="url(#wp-cycle-arrow)"
                  initial={false}
                  animate={{ strokeWidth: on ? 3.2 : 1.8, opacity: on ? 1 : 0.55 }}
                />
                <text
                  x={a.lx}
                  y={a.ly}
                  textAnchor={i === 1 ? "start" : i === 3 ? "end" : "middle"}
                  fontSize={11.5}
                  fontWeight={on ? 700 : 500}
                  fill={on ? "var(--blob-ink)" : "var(--ink-2)"}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {`${i + 1}. ${t(s.name)}`}
                </text>
              </g>
            );
          })}

          {STATIONS.map((s, i) => {
            const on = STEPS[step].from === i || STEPS[step].to === i;
            return (
              <g key={i}>
                <motion.rect
                  x={s.x}
                  y={s.y}
                  width={BW}
                  height={BH}
                  rx={12}
                  initial={false}
                  animate={{ strokeWidth: on ? 2 : 1 }}
                  fill={on ? "var(--raised)" : "var(--surface)"}
                  stroke={on ? "var(--blob)" : "var(--line-2)"}
                />
                <text x={s.x + 10} y={s.y + 18} fontSize={11} fontWeight={600} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(s.title)}
                </text>
                <foreignObject x={s.x + 6} y={s.y + 24} width={BW - 12} height={BH - 28}>
                  <div className="flex h-full items-center px-1 text-[12px] leading-snug text-ink">
                    {s.math ? <MathView src={s.math} size="sm" animate={false} /> : t(s.example)}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Steps of the cycle", "Schritte des Kreislaufs"))}>
        {STEPS.map((s, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === step}
            onClick={() => setStep(i)}
            className={cn("rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors", i === step ? "bg-blob text-white" : "bg-surface text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {i + 1}. {t(s.name)}
          </button>
        ))}
      </div>
      <motion.p key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-[3em] text-[14px] leading-relaxed text-ink-2">
        {t(STEPS[step].what)}
      </motion.p>
    </div>
  );
}
