"use client";

// End-product inhibition (feedback inhibition): threonine is turned into isoleucine in several
// steps. Isoleucine binds at the allosteric site of the FIRST enzyme and switches it off. The
// slider sets how much isoleucine the cell uses; the pathway regulates itself. Switch the
// feedback off (a mutant) and isoleucine piles up. EnzymePathway is the static task picture.

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { ALLO_PATH, C, EnzymeBody } from "./EnzymeShapes";

const Y = 168;
const label = { fontFamily: "var(--font-sans)" } as const;

/** Positions of the molecules and enzymes along the chain. */
function layout(n: number) {
  const x0 = 46;
  const x1 = 554;
  const mols = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  const enz = mols.slice(0, -1).map((x, i) => (x + mols[i + 1]) / 2);
  return { mols, enz };
}

function Molecule({ x, text, end, start }: { x: number; text: string; end?: boolean; start?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={Y} r={22} fill={end ? C.allo : start ? C.sub : "color-mix(in oklab, var(--bio-sun) 45%, var(--raised))"} stroke={end ? C.alloLine : C.subLine} strokeWidth={2} />
      <text x={x} y={Y} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="var(--bio-outline)" style={label}>
        {text}
      </text>
    </g>
  );
}

function Step({ x, name, active, inhibited, allo }: { x: number; name: string; active: number; inhibited: boolean; allo: boolean }) {
  return (
    <g>
      <path d={`M ${x - 40} ${Y} L ${x + 34} ${Y}`} stroke="var(--ink-3)" strokeWidth={2.2} />
      <path d={`M ${x + 27} ${Y - 6} L ${x + 35} ${Y} L ${x + 27} ${Y + 6}`} fill="none" stroke="var(--ink-3)" strokeWidth={2.2} strokeLinejoin="round" />
      <g transform={`translate(${x} ${Y - 74}) scale(0.24)`}>
        <motion.g initial={false} animate={{ opacity: 0.45 + 0.55 * active }}>
          <EnzymeBody variant={inhibited ? "distorted" : "fit"} allo={allo} />
        </motion.g>
        {allo && (
          <motion.g initial={false} animate={{ opacity: inhibited ? 1 : 0, x: inhibited ? 0 : 60, y: inhibited ? 0 : 40 }}>
            <path d={ALLO_PATH} fill={C.allo} stroke={C.alloLine} strokeWidth={4} strokeLinejoin="round" />
          </motion.g>
        )}
      </g>
      <text x={x} y={Y - 92} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink-2)" style={label}>
        {name}
      </text>
    </g>
  );
}

/** Static pathway for tasks: molecules A, B, C… with enzymes E1, E2…, optionally the feedback arrow. */
export function EnzymePathway({ steps = 3, feedback = false, ask }: { steps?: number; feedback?: boolean; ask?: number }) {
  const t = useText();
  const { mols, enz } = layout(steps);
  return (
    <svg viewBox="0 0 600 220" className="mx-auto block h-auto w-full" style={{ maxWidth: 600 }} role="img" aria-label={t(tx("A metabolic pathway with several enzymes", "Eine Stoffwechselkette mit mehreren Enzymen"))}>
      {enz.map((x, i) => (
        <g key={i}>
          <Step x={x} name={ask === i ? "?" : `E${i + 1}`} active={1} inhibited={false} allo={i === 0} />
        </g>
      ))}
      {mols.map((x, i) => (
        <Molecule key={i} x={x} text={"ABCDEFG"[i]} start={i === 0} end={i === mols.length - 1} />
      ))}
      {feedback && <FeedbackArrow from={mols[mols.length - 1]} to={enz[0]} />}
    </svg>
  );
}

function FeedbackArrow({ from, to }: { from: number; to: number }) {
  return (
    <g fill="none" stroke={C.alloLine} strokeWidth={2.2} strokeLinecap="round">
      <path d={`M ${from} ${Y - 26} C ${from} ${Y - 150}, ${to + 60} ${Y - 150}, ${to + 34} ${Y - 92}`} strokeDasharray="6 5" />
      <path d={`M ${to + 25} ${Y - 98} L ${to + 43} ${Y - 86}`} strokeWidth={3} />
    </g>
  );
}

export function EnzymeFeedback() {
  const t = useText();
  const reduce = useReducedMotion();
  const [use, setUse] = useState(20);
  const [feedback, setFeedback] = useState(true);
  const c = Math.max(0.04, use / 100);
  // Steady state: production by E1 equals use, with E1 = 1 / (1 + (L/K)²).
  const act = feedback ? c : 1;
  const level = feedback ? Math.min(12, 4 * Math.sqrt(1 / c - 1)) : 14;
  const blocked = Math.round((1 - act) * 3);
  const { mols, enz } = layout(3);
  const dur = 4.5 / Math.max(0.15, act);

  const info: Text = !feedback
    ? tx(
        "Without feedback (a mutant) the first enzyme works flat out, whatever the cell needs. Isoleucine piles up: material and energy are wasted.",
        "Ohne Rückkopplung (eine Mutante) arbeitet das erste Enzym immer mit voller Kraft, egal was die Zelle braucht. Isoleucin häuft sich an: Stoff und Energie werden verschwendet.",
      )
    : use < 35
      ? txMap((tt) =>
          tt(
            `The cell needs little isoleucine, so it piles up a bit and binds to the **allosteric site of the first enzyme**. Most E1 molecules are switched off: the chain runs at only ${Math.round(act * 100)} %.`,
            `Die Zelle braucht wenig Isoleucin. Es staut sich etwas an und bindet am **allosterischen Zentrum des ersten Enzyms**. Die meisten E1-Moleküle sind abgeschaltet: Die Kette läuft nur mit ${Math.round(act * 100)} %.`,
          ),
        )
      : use < 70
        ? tx("Medium demand: isoleucine is used up as fast as it is made. E1 is partly inhibited, the chain runs at the right speed.", "Mittlerer Bedarf: Isoleucin wird so schnell verbraucht, wie es entsteht. E1 ist teilweise gehemmt, die Kette läuft im passenden Tempo.")
        : tx(
            "The cell uses lots of isoleucine, so little is left to inhibit E1. The first enzyme is free and the whole chain runs fast: **negative feedback**.",
            "Die Zelle verbraucht viel Isoleucin, darum bleibt wenig übrig, um E1 zu hemmen. Das erste Enzym ist frei, die ganze Kette läuft schnell: **negative Rückkopplung**.",
          );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-2">
        <svg viewBox="0 0 600 260" className="mx-auto block h-auto w-full" role="img" aria-label={t(tx("Isoleucine inhibits the first enzyme of its own pathway", "Isoleucin hemmt das erste Enzym seiner eigenen Synthesekette"))}>
          {enz.map((x, i) => (
            <Step key={i} x={x} name={`E${i + 1}`} active={i === 0 ? act : Math.max(0.35, act)} inhibited={i === 0 && feedback && blocked >= 2} allo={i === 0} />
          ))}
          {mols.map((x, i) => (
            <Molecule key={i} x={x} text={"ABCD"[i]} start={i === 0} end={i === 3} />
          ))}
          {feedback && <FeedbackArrow from={mols[3]} to={enz[0]} />}
          {/* flowing molecules */}
          {!reduce &&
            [0, 1, 2].map((k) => (
              <motion.circle
                key={`${k}-${Math.round(dur * 10)}`}
                r={5}
                cy={Y}
                fill={C.sub}
                stroke={C.subLine}
                strokeWidth={1.2}
                initial={{ cx: mols[0], opacity: 0 }}
                animate={{ cx: [mols[0], mols[3]], opacity: [0, 1, 1, 0] }}
                transition={{ duration: dur, repeat: Infinity, ease: "linear", delay: (k * dur) / 3 }}
              />
            ))}
          {/* isoleucine pool */}
          {Array.from({ length: Math.round(level) }, (_, i) => (
            <motion.circle
              key={i}
              cx={mols[3] - 22 + (i % 4) * 14.5}
              cy={Y + 40 + Math.floor(i / 4) * 13}
              r={5.5}
              fill={C.allo}
              stroke={C.alloLine}
              strokeWidth={1.2}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
            />
          ))}
        </svg>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 pb-1 text-[12.5px] text-ink-2">
          <span>
            <b className="text-ink">A</b> {t(tx("threonine", "Threonin"))}
          </span>
          <span>
            <b className="text-ink">B, C</b> {t(tx("intermediates", "Zwischenprodukte"))}
          </span>
          <span>
            <b className="text-ink">D</b> {t(tx("isoleucine (end product)", "Isoleucin (Endprodukt)"))}
          </span>
          <span>
            <b className="text-ink">E1</b> {t(tx("threonine deaminase", "Threonin-Desaminase"))}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-3 text-[13px] text-ink-2">
          <span className="shrink-0">{t(tx("Isoleucine used by the cell", "Isoleucin-Verbrauch der Zelle"))}</span>
          <input type="range" min={0} max={100} step={5} value={use} onChange={(e) => setUse(Number(e.target.value))} className="w-full accent-[var(--blob)]" />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={feedback} onChange={(e) => setFeedback(e.target.checked)} className="size-4 accent-[var(--blob)]" />
          {t(tx("Feedback inhibition", "Endprodukthemmung"))}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[13px]">
        <Meter label={tx("E1 activity", "Aktivität von E1")} value={act} />
        <Meter label={tx("Isoleucine in the cell", "Isoleucin in der Zelle")} value={level / 14} warn={!feedback} />
      </div>

      <motion.p
        key={`${feedback}-${use < 35 ? 0 : use < 70 ? 1 : 2}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("min-h-[3.2rem] rounded-xl px-3.5 py-2.5 text-[14.5px] leading-relaxed", feedback ? "bg-hover/60 text-ink-2" : "bg-danger/[0.07] text-ink")}
        aria-live="polite"
      >
        <Inline text={info} />
      </motion.p>
    </div>
  );
}

function Meter({ label: name, value, warn }: { label: Text; value: number; warn?: boolean }) {
  const t = useText();
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="mb-1.5 flex justify-between text-ink-3">
        <span>{t(name)}</span>
        <span className="font-semibold tabular-nums text-ink">{Math.round(value * 100)} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-hover">
        <motion.div className={cn("h-full rounded-full", warn ? "bg-danger" : "bg-blob")} initial={false} animate={{ width: `${Math.round(value * 100)}%` }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
      </div>
    </div>
  );
}
