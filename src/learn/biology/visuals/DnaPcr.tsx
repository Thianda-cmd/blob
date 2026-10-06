"use client";

import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { StepButton } from "./DnaKit";

const OLD = "var(--bio-nucleus-deep)";
const NEW = "var(--bio-water)";
const PRIMER = "var(--bio-a)";

const PHASES: { name: Text; temp: number; note: Text }[] = [
  {
    name: tx("Denaturation", "Denaturierung"),
    temp: 95,
    note: tx("At about 95 °C the hydrogen bonds break: the double strand separates into two single strands.", "Bei etwa 95 °C lösen sich die Wasserstoffbrücken: Der Doppelstrang trennt sich in zwei Einzelstränge."),
  },
  {
    name: tx("Annealing of the primers", "Primeranlagerung (Annealing)"),
    temp: 55,
    note: tx(
      "Cooled to about 55 °C (depends on the primers): two short DNA primers bind to the ends of the section that will be copied.",
      "Abgekühlt auf etwa 55 °C (je nach Primer): Zwei kurze DNA-Primer binden an die Enden des Abschnitts, der vervielfältigt werden soll.",
    ),
  },
  {
    name: tx("Elongation", "Elongation (Verlängerung)"),
    temp: 72,
    note: tx(
      "At 72 °C the heat-stable Taq polymerase extends the primers 5′→3′. From one double strand there are now two.",
      "Bei 72 °C verlängert die hitzestabile Taq-Polymerase die Primer in 5′→3′-Richtung. Aus einem Doppelstrang sind zwei geworden.",
    ),
  },
];

/** Temperature profile of one cycle with a marker on the current phase. */
function Profile({ phase }: { phase: number }) {
  const y = (temp: number) => 90 - ((temp - 40) / 60) * 74;
  const xs = [
    [40, 110],
    [130, 200],
    [220, 290],
  ];
  const d = `M20 ${y(95)} L${xs[0][1]} ${y(95)} L${xs[1][0]} ${y(55)} L${xs[1][1]} ${y(55)} L${xs[2][0]} ${y(72)} L300 ${y(72)}`;
  return (
    <svg viewBox="0 0 336 104" className="h-auto w-full max-w-[380px]" aria-hidden>
      {[95, 72, 55].map((temp) => (
        <g key={temp}>
          <line x1={20} x2={300} y1={y(temp)} y2={y(temp)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={306} y={y(temp)} dominantBaseline="central" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {temp} °C
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--ink-2)" strokeWidth={2.5} strokeLinejoin="round" />
      {xs.map(([a, b], k) => (
        <motion.rect key={k} x={a} y={y(PHASES[k].temp) - 5} width={b - a} height={10} rx={5} fill="var(--blob)" initial={false} animate={{ opacity: k === phase ? 0.9 : 0 }} />
      ))}
    </svg>
  );
}

/** One double strand going through denaturation, annealing and elongation. */
function Strands({ phase }: { phase: number }) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 18 };
  const apart = phase >= 0;
  const topY = apart ? 26 : 48;
  const botY = apart ? 94 : 72;
  const label = (x: number, y: number, s: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );
  return (
    <svg viewBox="0 0 360 120" className="h-auto w-full max-w-[400px]" aria-hidden>
      <motion.g initial={false} animate={{ y: topY - 48 }} transition={spring}>
        <line x1={40} x2={320} y1={48} y2={48} stroke={OLD} strokeWidth={8} strokeLinecap="round" />
        {label(24, 48, "5′")}
        {label(336, 48, "3′")}
        {/* primer and new strand on the top template grow leftwards (5′ at the right) */}
        {phase >= 1 && <motion.line initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} x1={268} x2={310} y1={60} y2={60} stroke={PRIMER} strokeWidth={8} />}
        {phase >= 2 && <motion.line initial={{ x1: 268 }} animate={{ x1: 44 }} transition={{ duration: reduce ? 0 : 1.2 }} x2={268} y1={60} y2={60} stroke={NEW} strokeWidth={8} />}
      </motion.g>
      <motion.g initial={false} animate={{ y: botY - 72 }} transition={spring}>
        <line x1={40} x2={320} y1={72} y2={72} stroke={OLD} strokeWidth={8} strokeLinecap="round" />
        {label(24, 72, "3′")}
        {label(336, 72, "5′")}
        {phase >= 1 && <motion.line initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} x1={50} x2={92} y1={60} y2={60} stroke={PRIMER} strokeWidth={8} />}
        {phase >= 2 && <motion.line initial={{ x2: 92 }} animate={{ x2: 316 }} transition={{ duration: reduce ? 0 : 1.2 }} x1={92} y1={60} y2={60} stroke={NEW} strokeWidth={8} />}
      </motion.g>
    </svg>
  );
}

/** PCR: step through one cycle (95/55/72 °C) and count the copies, 2ⁿ after n cycles. */
export function DnaPcr() {
  const t = useText();
  const locale = useLocale();
  const [phase, setPhase] = useState(-1);
  const [n, setN] = useState(0);
  const [start, setStart] = useState(1);
  const copies = start * 2 ** n;
  const fmt = (v: number) => v.toLocaleString(locale === "de" ? "de-DE" : "en-GB");

  const next = () => {
    if (phase < 2) setPhase(phase + 1);
    else {
      setPhase(0);
      setN(Math.min(30, n + 1));
    }
  };
  // The finished cycle counts once elongation is done.
  const shownN = phase === 2 ? Math.min(30, n + 1) : n;
  const shownCopies = start * 2 ** shownN;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 md:items-center">
        <div className="space-y-2">
          <Profile phase={phase} />
          <Strands phase={phase} />
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-[12.5px] text-ink-3">{t(tx("cycles", "Zyklen"))}</div>
            <div className="flex items-baseline gap-3">
              <motion.span key={shownN} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-math text-[30px] tabular-nums text-ink">
                {shownN}
              </motion.span>
              <span className="text-[13.5px] text-ink-2">
                {start} · 2<sup>{shownN}</sup> =
              </span>
            </div>
            <motion.div key={shownCopies} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-math text-[26px] font-semibold tabular-nums text-blob-ink">
              {fmt(shownCopies)}
            </motion.div>
            <div className="text-[12.5px] text-ink-3">{t(tx("copies of the DNA section", "Kopien des DNA-Abschnitts"))}</div>
          </div>
          <label className="flex items-center gap-3 text-[13px] text-ink-3">
            <span className="shrink-0">{t(tx("cycles", "Zyklen"))}</span>
            <input
              type="range"
              min={0}
              max={30}
              value={shownN}
              onChange={(e) => {
                setN(Number(e.target.value));
                setPhase(-1);
              }}
              aria-label={t(tx("Number of cycles", "Anzahl der Zyklen"))}
              className="h-2 min-w-0 flex-1 cursor-pointer accent-blob"
            />
            <span className="w-6 text-right tabular-nums">{shownN}</span>
          </label>
          <div className="flex items-center gap-2 text-[13px] text-ink-3">
            <span>{t(tx("start copies", "Startkopien"))}</span>
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStart(s)}
                aria-pressed={start === s}
                className={cn("h-8 min-w-8 rounded-lg border px-2 text-[13.5px] tabular-nums", start === s ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton primary onClick={next} disabled={n >= 30 && phase === 2} label={t(tx("Next step of the cycle", "Nächster Schritt im Zyklus"))}>
          {t(phase < 0 ? tx("Start cycle", "Zyklus starten") : phase < 2 ? tx("Next step", "Nächster Schritt") : tx("Next cycle", "Nächster Zyklus"))} <ChevronRight className="size-4" />
        </StepButton>
        <StepButton
          onClick={() => {
            setN(0);
            setPhase(-1);
          }}
          disabled={n === 0 && phase < 0}
          label={t(tx("Start again", "Von vorn"))}
        >
          <RotateCcw className="size-4" />
        </StepButton>
        <div className="ml-auto flex gap-1.5">
          {PHASES.map((p, k) => (
            <span key={k} className={cn("rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors", k === phase ? "bg-blob text-white" : "bg-hover text-ink-3")}>
              {p.temp} °C
            </span>
          ))}
        </div>
      </div>

      <motion.p key={`${phase}-${n}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
        {phase < 0 ? (
          <span className="text-ink-2">
            {t(
              tx(
                `Ready: ${fmt(copies)} copies in the tube with primers, nucleotides and Taq polymerase. Start a cycle or drag the slider.`,
                `Bereit: ${fmt(copies)} Kopien im Gefäß, dazu Primer, Nukleotide und Taq-Polymerase. Starte einen Zyklus oder zieh am Regler.`,
              ),
            )}
          </span>
        ) : (
          <>
            <span className="font-semibold text-ink">
              {t(PHASES[phase].name)} ({PHASES[phase].temp} °C):{" "}
            </span>
            <span className="text-ink-2">{t(PHASES[phase].note)}</span>
          </>
        )}
      </motion.p>
    </div>
  );
}
