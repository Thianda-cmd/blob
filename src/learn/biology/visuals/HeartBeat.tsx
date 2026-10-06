"use client";

// The beating heart (level 2): atria and ventricles contract in turn, the valves open and
// close. Play it slowly or at real speed, or step through the three moments of a heartbeat.

import { animate, useAnimationFrame, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { HEART_H, HEART_PARTS, HEART_W, HeartArt, type HeartArrows, type HeartState } from "./HeartSection";
import { Chip, clamp, MainButton } from "./HeartShared";

/** Smooth ramp 0 → 1 between a and b. */
const ramp = (x: number, a: number, b: number) => {
  const f = clamp((x - a) / (b - a), 0, 1);
  return f * f * (3 - 2 * f);
};

/** The heart at cycle fraction t (0 … 1): ventricular systole from 0.6 to 1. */
export function beatState(t: number): HeartState {
  const v = t >= 0.6 ? ramp(t, 0.6, 0.7) * (1 - ramp(t, 0.95, 1.0) * 0.7) : t < 0.06 ? 0.3 * (1 - ramp(t, 0, 0.06)) : 0;
  const a = ramp(t, 0.45, 0.52) * (1 - ramp(t, 0.55, 0.62));
  const av = t < 0.6 ? ramp(t, 0.02, 0.07) : 1 - ramp(t, 0.6, 0.63);
  const sl = ramp(t, 0.64, 0.68) * (1 - ramp(t, 0.96, 0.995));
  return { atria: a, ventricles: v, av, sl };
}

type Moment = { at: number; title: Text; text: Text; arrows: HeartArrows };
const MOMENTS: Moment[] = [
  {
    at: 0.25,
    title: tx("Diastole: the ventricles fill", "Diastole: Die Kammern füllen sich"),
    text: tx(
      "The ventricles relax. Blood flows from the veins into the atria and on through the open atrioventricular valves into the ventricles. The semilunar valves are shut.",
      "Die Kammern erschlaffen. Blut strömt aus den Venen in die Vorhöfe und weiter durch die offenen Segelklappen in die Kammern. Die Taschenklappen sind geschlossen.",
    ),
    arrows: "fill",
  },
  {
    at: 0.53,
    title: tx("The atria contract", "Die Vorhöfe ziehen sich zusammen"),
    text: tx("At the end of diastole the atria squeeze the last blood into the ventricles.", "Am Ende der Diastole drücken die Vorhöfe das restliche Blut in die Kammern."),
    arrows: "fill",
  },
  {
    at: 0.8,
    title: tx("Systole: the ventricles pump", "Systole: Die Kammern pumpen"),
    text: tx(
      "The ventricles contract. The atrioventricular valves snap shut (first heart sound), the semilunar valves open: blood is pressed into the pulmonary artery and the aorta. When they relax, the semilunar valves shut (second heart sound).",
      "Die Kammern ziehen sich zusammen. Die Segelklappen schlagen zu (erster Herzton), die Taschenklappen öffnen sich: Das Blut wird in Lungenarterie und Aorta gepresst. Erschlaffen die Kammern, schließen die Taschenklappen (zweiter Herzton).",
    ),
    arrows: "eject",
  },
];
const momentAt = (t: number) => (t >= 0.6 ? 2 : t >= 0.45 ? 1 : 0);

function ValveBadge({ name, open }: { name: string; open: boolean }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-colors", open ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2")}>
      {name}: {open ? "↓" : "×"}
    </span>
  );
}

export function HeartBeatWidget() {
  const t = useText();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(MOMENTS[0].at);
  const [playing, setPlaying] = useState(false);
  const [real, setReal] = useState(false);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  useAnimationFrame((_, delta) => {
    if (!playing || reduce) return;
    const period = real ? 0.8 : 4.5;
    setTime((x) => (x + Math.min(delta, 50) / 1000 / period) % 1);
  });

  const jump = (i: number) => {
    setPlaying(false);
    ctrl.current?.stop();
    const to = MOMENTS[i].at;
    if (reduce) return setTime(to);
    const from = time > to ? time - 1 : time;
    ctrl.current = animate(from, to, { duration: 0.9, ease: "easeInOut", onUpdate: (v) => setTime((v + 1) % 1) });
  };

  const st = beatState(time);
  const m = momentAt(time);
  const M = MOMENTS[m];
  const arrows: HeartArrows = st.sl > 0.5 ? "eject" : st.av > 0.5 && st.ventricles < 0.2 ? "fill" : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center">
        <Figure title={tx("The beating heart", "Das schlagende Herz")} width={HEART_W} height={HEART_H} parts={HEART_PARTS} mode="plain">
          <HeartArt state={st} arrows={arrows} />
        </Figure>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {MOMENTS.map((x, i) => (
              <Chip key={i} on={m === i} onClick={() => jump(i)}>
                {i + 1}. {t(i === 0 ? tx("Fill", "Füllen") : i === 1 ? tx("Atria", "Vorhöfe") : tx("Pump", "Pumpen"))}
              </Chip>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
            <div className="font-semibold text-ink">{t(M.title)}</div>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{t(M.text)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ValveBadge name={t(tx("AV valves", "Segelklappen"))} open={st.av > 0.5} />
            <ValveBadge name={t(tx("Semilunar valves", "Taschenklappen"))} open={st.sl > 0.5} />
          </div>
          <p className="text-[12px] text-ink-3">{t(tx("↓ open, × shut", "↓ offen, × geschlossen"))}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!reduce && (
          <MainButton onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? t(tx("Pause", "Pause")) : t(tx("Let it beat", "Schlagen lassen"))}
          </MainButton>
        )}
        {!reduce && (
          <Chip on={real} onClick={() => setReal((r) => !r)}>
            {t(tx("Real speed (75 per minute)", "Echtes Tempo (75 pro Minute)"))}
          </Chip>
        )}
        <input
          type="range"
          min={0}
          max={0.999}
          step={0.001}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            ctrl.current?.stop();
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Moment in the heartbeat", "Zeitpunkt im Herzschlag"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>
    </div>
  );
}
