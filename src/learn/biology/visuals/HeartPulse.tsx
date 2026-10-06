"use client";

// Feeling the pulse (level 1): two fingertips on the wrist artery, the heart beating alongside.
// Pick an activity and watch the heart rate change; "measure" counts the beats for 15 seconds
// and multiplies by 4, as you do it yourself.

import { useAnimationFrame, useReducedMotion } from "motion/react";
import { Timer } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { HeartArt } from "./HeartSection";
import { Chip, MainButton } from "./HeartShared";

type Activity = { id: string; name: Text; rate: number };
const ACTIVITIES: Activity[] = [
  { id: "sleep", name: tx("Sleeping", "Schlafen"), rate: 58 },
  { id: "sit", name: tx("Sitting", "Sitzen"), rate: 76 },
  { id: "walk", name: tx("Walking", "Gehen"), rate: 96 },
  { id: "stairs", name: tx("Climbing stairs", "Treppensteigen"), rate: 124 },
  { id: "run", name: tx("Sprinting", "Rennen"), rate: 164 },
];
const MEASURE = 15;

type Sim = { phase: number; rate: number; beatAt: number; measure: { left: number; count: number } | null; last: { count: number } | null };

export function HeartPulseWidget() {
  const t = useText();
  const reduce = useReducedMotion();
  const [activity, setActivity] = useState("sit");
  const target = ACTIVITIES.find((a) => a.id === activity)!.rate;
  const [sim, setSim] = useState<Sim>({ phase: 0.5, rate: 76, beatAt: 0, measure: null, last: null });

  useAnimationFrame((time, delta) => {
    const dt = Math.min(delta, 60) / 1000;
    setSim((s) => {
      // The heart rate follows the activity smoothly (sped up: in real life recovery takes minutes).
      const rate = s.rate + (target - s.rate) * Math.min(1, dt * 0.9);
      const next = s.phase + (dt * rate) / 60;
      const beat = Math.floor(next) > Math.floor(s.phase);
      let measure = s.measure;
      let last = s.last;
      if (measure) {
        const left = measure.left - dt;
        const count = measure.count + (beat ? 1 : 0);
        if (left <= 0) {
          last = { count };
          measure = null;
        } else measure = { left, count };
      }
      return { phase: next, rate, beatAt: beat ? time : s.beatAt, measure, last };
    });
  });

  const frac = sim.phase % 1;
  // Systole right after each beat.
  const squeeze = reduce ? 0 : frac < 0.12 ? frac / 0.12 : frac < 0.4 ? 1 - (frac - 0.12) / 0.28 : 0;
  const ring = reduce ? 0 : frac;
  const bpm = Math.round(sim.rate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACTIVITIES.map((a) => (
          <Chip key={a.id} on={activity === a.id} onClick={() => setActivity(a.id)}>
            {t(a.name)}
          </Chip>
        ))}
      </div>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
        <svg viewBox="0 0 360 184" className="block h-auto w-full" role="img" aria-label={t(tx("Feeling the pulse at the wrist", "Puls am Handgelenk fühlen"))}>
          {/* forearm and the heel of the hand, palm up, thumb side on top */}
          <path d="M0 74 L236 66 C252 62 268 56 290 50 C312 26 336 14 352 22 C362 28 356 44 340 58 C352 60 360 62 360 62 L360 176 C330 176 300 172 270 166 L236 160 L0 156 Z" fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
          <path d="M246 74 C252 96 252 132 246 152 M258 72 C264 98 264 130 258 154" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} opacity={0.6} />
          <path d="M300 60 C318 82 322 120 300 150" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.4} opacity={0.5} />
          {/* radial artery on the thumb side */}
          <path d="M0 86 C90 82 170 82 250 84" fill="none" stroke="var(--bio-blood)" strokeWidth={6 + squeeze * 2.5} strokeLinecap="round" opacity={0.85} />
          <path d="M0 132 C90 134 170 134 250 136" fill="none" stroke="var(--bio-blood-low)" strokeWidth={4} strokeLinecap="round" opacity={0.5} />
          {/* pulse ring */}
          {!reduce && <circle cx={196} cy={84} r={8 + ring * 26} fill="none" stroke="var(--blob)" strokeWidth={2.5} opacity={Math.max(0, 0.9 - ring * 1.4)} />}
          {/* two fingertips */}
          <g transform={`translate(0 ${squeeze * -1.5})`}>
            <path d="M150 20 C150 6 172 6 172 20 L172 78 C172 90 150 90 150 78 Z" fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} />
            <path d="M184 14 C184 0 206 0 206 14 L206 76 C206 88 184 88 184 76 Z" fill="var(--bio-flesh)" stroke="var(--bio-outline)" strokeWidth={2} />
            <path d="M154 72 C158 66 166 66 168 72 M188 70 C192 64 200 64 202 70" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1.3} />
          </g>
        </svg>
        <p className="mt-1 text-[12.5px] text-ink-3">{t(tx("Thumb side of the wrist: feel with two fingers, never with your thumb (it has a pulse of its own).", "Daumenseite des Handgelenks: mit zwei Fingern fühlen, nie mit dem Daumen (er hat einen eigenen Puls)."))}</p>
        </div>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 480 470" className="block h-auto w-[48%] max-w-[170px] shrink-0" aria-hidden>
            <HeartArt state={{ atria: 0, ventricles: squeeze, av: squeeze > 0.3 ? 0 : 1, sl: squeeze > 0.3 ? 1 : 0 }} />
          </svg>
          <div>
            <div className="font-math text-[40px] font-semibold leading-none tabular-nums text-ink">{bpm}</div>
            <div className="mt-1 text-[13px] text-ink-2">{t(tx("beats per minute", "Schläge pro Minute"))}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <MainButton onClick={() => setSim((s) => ({ ...s, measure: { left: MEASURE, count: 0 }, last: null }))} disabled={!!sim.measure}>
          <Timer className="size-4" />
          {t(tx("Measure for 15 s", "15 s lang messen"))}
        </MainButton>
        <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-ink-2" aria-live="polite">
          {sim.measure ? (
            <span>
              {t(tx("Counting…", "Zählen…"))} <span className="font-math font-semibold tabular-nums text-ink">{sim.measure.count}</span> · {t(tx("still", "noch"))} {Math.ceil(sim.measure.left)} s
            </span>
          ) : sim.last ? (
            <span>
              <span className="font-math font-semibold text-ink">{sim.last.count}</span> {t(tx("beats in 15 s", "Schläge in 15 s"))} · 4 ={" "}
              <span className={cn("font-math font-semibold text-blob-ink")}>{sim.last.count * 4}</span> {t(tx("beats per minute", "Schläge pro Minute"))}
            </span>
          ) : (
            <span>{t(tx("Count the beats for 15 seconds, then multiply by 4 (a minute has 4 × 15 seconds).", "Zähle die Schläge 15 Sekunden lang und nimm das Ergebnis mal 4 (eine Minute hat 4 × 15 Sekunden)."))}</span>
          )}
        </div>
      </div>
    </div>
  );
}
