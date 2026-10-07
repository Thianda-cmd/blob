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

type Station = { title: Text; example?: Text; math?: Text };
type Step = { name: Text; what: Text; from: number; to: number };

const STATIONS: Station[] = [
  { title: tx("Real situation", "Reale Situation"), example: tx("Battery at 100 %, minus 8 % an hour: when is it empty?", "Akku bei 100 %, minus 8 % pro Stunde: Wann ist er leer?") },
  { title: tx("Maths model", "Mathematisches Modell"), math: "\\group{A(t) =} \\group{100 - 8t}" },
  { title: tx("Maths result", "Mathematisches Ergebnis"), math: tx("t = 12.5", "t = 12,5") },
  { title: tx("Real result", "Reales Ergebnis"), example: tx("Empty after about 12 h 30 min.", "Nach etwa 12 h 30 min leer.") },
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

/** A straight arrow; `dir` says where it points. */
function Arrow({ dir, on }: { dir: "right" | "down" | "left" | "up"; on: boolean }) {
  const horizontal = dir === "right" || dir === "left";
  const d = horizontal ? (dir === "right" ? "M2 6 H 94 M86 1 L94 6 L86 11" : "M98 6 H 6 M14 1 L6 6 L14 11") : dir === "down" ? "M6 2 V 34 M1 26 L6 34 L11 26" : "M6 38 V 6 M1 14 L6 6 L11 14";
  return (
    <svg viewBox={horizontal ? "0 0 100 12" : "0 0 12 40"} preserveAspectRatio="none" className={horizontal ? "h-3 w-full" : "h-9 w-3"} aria-hidden>
      <motion.path d={d} fill="none" stroke="var(--blob)" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" initial={false} animate={{ strokeWidth: on ? 2.6 : 1.6, opacity: on ? 1 : 0.5 }} />
    </svg>
  );
}

export function ModelCycle() {
  const t = useText();
  const [step, setStep] = useState(0);
  const active = (i: number) => STEPS[step].from === i || STEPS[step].to === i;

  const card = (i: number) => {
    const s = STATIONS[i];
    return (
      <motion.div
        initial={false}
        animate={{ scale: active(i) ? 1 : 0.98 }}
        className={cn("flex min-h-[86px] min-w-0 flex-col rounded-xl border px-3 py-2 transition-colors", active(i) ? "border-blob bg-raised shadow-card" : "border-line-2 bg-surface")}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(s.title)}</span>
        <span className="mt-1 flex flex-1 items-center text-[13px] leading-snug text-ink">{s.math ? <MathView src={s.math} size="sm" animate={false} /> : t(s.example)}</span>
      </motion.div>
    );
  };
  const link = (i: number, dir: "right" | "down" | "left" | "up") => (
    <button
      onClick={() => setStep(i)}
      className={cn("flex min-w-0 items-center gap-1 rounded-md px-1 text-[11.5px] font-semibold leading-tight transition-colors", dir === "right" || dir === "left" ? "flex-col justify-center" : "justify-center", i === step ? "text-blob-ink" : "text-ink-3 hover:text-ink")}
      aria-label={`${i + 1}. ${t(STEPS[i].name)}`}
    >
      {dir === "up" && <Arrow dir="up" on={i === step} />}
      <span className="text-center">
        {i + 1}.<span className="hidden sm:inline"> {t(STEPS[i].name)}</span>
      </span>
      {dir !== "up" && <Arrow dir={dir} on={i === step} />}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="mx-auto max-w-[620px]">
        <div className="mb-1.5 grid grid-cols-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          <span>{t(tx("Reality", "Realität"))}</span>
          <span>{t(tx("Maths", "Mathematik"))}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(36px,0.42fr)_minmax(0,1fr)] items-center gap-y-1">
          {card(0)}
          {link(0, "right")}
          {card(1)}
          <div className="flex justify-center">{link(3, "up")}</div>
          <div className="mx-auto h-full w-px border-l border-dashed border-line-2" />
          <div className="flex justify-center">{link(1, "down")}</div>
          {card(3)}
          {link(2, "left")}
          {card(2)}
        </div>
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
