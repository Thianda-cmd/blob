"use client";

// The cardiac cycle (level 3) for the left heart at 75 beats per minute (0.8 s): ECG, pressure
// in the left ventricle, aorta and left atrium, and the volume of the left ventricle. The time
// axis starts with the P wave. Scrub or play it slowly; the heart shows the valves.

import { useAnimationFrame, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";
import { HeartArt, type HeartState } from "./HeartSection";
import { MainButton, monotone, polyPath, svgText, type Pt } from "./HeartShared";
import { sin } from "@/lib/stableMath";

export const CYCLE = 0.8;
export const EVENTS = { avShut: 0.2, slOpen: 0.25, slShut: 0.5, avOpen: 0.58 };

export const LV_P: Pt[] = [[0, 4], [0.05, 5], [0.1, 8], [0.15, 9], [0.19, 9.5], [0.21, 24], [0.23, 52], [0.25, 81], [0.3, 110], [0.35, 121], [0.4, 118], [0.45, 108], [0.5, 97], [0.52, 64], [0.55, 26], [0.58, 9], [0.61, 3.5], [0.66, 3], [0.72, 3.5], [0.8, 4]];
export const AO_P: Pt[] = [[0, 88], [0.1, 85], [0.2, 81], [0.25, 80], [0.3, 108], [0.35, 119.5], [0.4, 117], [0.45, 107], [0.5, 97.5], [0.51, 93], [0.53, 98], [0.57, 96], [0.65, 93], [0.8, 88]];
export const LA_P: Pt[] = [[0, 5], [0.05, 7], [0.1, 11], [0.15, 9.5], [0.2, 8], [0.22, 9.5], [0.26, 5], [0.35, 8], [0.45, 11], [0.55, 13], [0.58, 12], [0.62, 7], [0.7, 5], [0.8, 5]];
export const LV_V: Pt[] = [[0, 112], [0.05, 113], [0.12, 124], [0.18, 130], [0.25, 130], [0.3, 108], [0.38, 80], [0.45, 65], [0.5, 60], [0.58, 60], [0.62, 78], [0.67, 98], [0.73, 107], [0.8, 112]];

const F = { lv: monotone(LV_P), ao: monotone(AO_P), la: monotone(LA_P), vol: monotone(LV_V) };
/** Pressures (mmHg) and volume (ml) of the left heart at time t (s). */
export const cycleValues = (t: number) => ({ lv: F.lv(t), ao: F.ao(t), la: F.la(t), vol: F.vol(t) });

/** ECG (millivolts, schematic) for one beat; P wave starts at 0. `noP` drops the P wave. */
export function ecgAt(t: number, noP = false) {
  const g = (x: number, mu: number, s: number, a: number) => a * Math.exp(-((x - mu) ** 2) / (2 * s * s));
  return (noP ? 0 : g(t, 0.045, 0.018, 0.15)) + g(t, 0.165, 0.006, -0.12) + g(t, 0.185, 0.008, 1.0) + g(t, 0.205, 0.007, -0.25) + g(t, 0.45, 0.035, 0.3);
}

export type Phase = 1 | 2 | 3 | 4;
/** 1 Anspannung, 2 Austreibung, 3 Entspannung, 4 Füllung. */
export const phaseAt = (t: number): Phase => (t >= EVENTS.avShut && t < EVENTS.slOpen ? 1 : t >= EVENTS.slOpen && t < EVENTS.slShut ? 2 : t >= EVENTS.slShut && t < EVENTS.avOpen ? 3 : 4);

export const PHASES: Record<Phase, { name: Text; part: Text; text: Text }> = {
  1: {
    name: tx("Isovolumetric contraction", "Anspannungsphase"),
    part: tx("systole", "Systole"),
    text: tx(
      "The ventricle muscle contracts while all valves are shut. The volume stays the same, the pressure rises steeply until it exceeds the aortic pressure (about 80 mmHg).",
      "Die Kammermuskulatur kontrahiert, alle Klappen sind geschlossen. Das Volumen bleibt gleich, der Druck steigt steil an, bis er den Aortendruck (etwa 80 mmHg) übersteigt.",
    ),
  },
  2: {
    name: tx("Ejection", "Austreibungsphase"),
    part: tx("systole", "Systole"),
    text: tx(
      "The semilunar valves are open and blood is ejected into the aorta. The pressure peaks at about 120 mmHg; the volume falls by the stroke volume (about 70 ml).",
      "Die Taschenklappen sind offen, Blut wird in die Aorta ausgeworfen. Der Druck erreicht etwa 120 mmHg, das Volumen sinkt um das Schlagvolumen (etwa 70 ml).",
    ),
  },
  3: {
    name: tx("Isovolumetric relaxation", "Entspannungsphase"),
    part: tx("diastole", "Diastole"),
    text: tx(
      "The ventricle relaxes. Its pressure drops below the aortic pressure, so the semilunar valves shut (second heart sound). All valves are shut, the pressure falls steeply.",
      "Die Kammer erschlafft. Ihr Druck fällt unter den Aortendruck, deshalb schließen die Taschenklappen (zweiter Herzton). Alle Klappen sind zu, der Druck fällt steil ab.",
    ),
  },
  4: {
    name: tx("Filling", "Füllungsphase"),
    part: tx("diastole", "Diastole"),
    text: tx(
      "The atrioventricular valves open once the ventricular pressure is below the atrial pressure. The ventricle fills, at the end helped by the atrial contraction (after the P wave). When the ventricular pressure exceeds the atrial pressure, the AV valves shut (first heart sound).",
      "Die Segelklappen öffnen sich, sobald der Kammerdruck unter den Vorhofdruck fällt. Die Kammer füllt sich, am Ende hilft die Vorhofkontraktion (nach der P-Welle). Übersteigt der Kammerdruck den Vorhofdruck, schließen die Segelklappen (erster Herzton).",
    ),
  },
};

/** The heart drawing's state at time t. */
export function cycleHeart(t: number): HeartState {
  const atria = t > 0.05 && t < 0.17 ? sin(((t - 0.05) / 0.12) * Math.PI) : 0;
  const vol = F.vol(t);
  const ventricles = Math.max(0, Math.min(1, (130 - vol) / 70));
  const av = t < EVENTS.avShut - 0.005 || t > EVENTS.avOpen + 0.005 ? 1 : 0;
  const sl = t > EVENTS.slOpen && t < EVENTS.slShut ? 1 : 0;
  return { atria, ventricles: phaseAt(t) === 1 ? 0.15 : ventricles, av, sl };
}

// ---------------------------------------------------------------------------
// Chart

const W = 460;
const H = 336;
const X0 = 58;
const X1 = 450;
const tx_ = (t: number) => X0 + (t / CYCLE) * (X1 - X0);
const ECG_Y = 64;
const yP = (p: number) => 236 - (p / 130) * 146;
const yV = (v: number) => 314 - ((v - 50) / 90) * 60;
const yE = (mv: number) => ECG_Y - mv * 36;

const sample = (f: (t: number) => number, map: (v: number) => number): Pt[] => Array.from({ length: 161 }, (_, i) => [tx_((i / 160) * CYCLE), map(f((i / 160) * CYCLE))] as Pt);
const curve = (f: (t: number) => number, map: (v: number) => number) => polyPath(sample(f, map));

export const CYCLE_COLORS = { lv: "var(--bio-blood)", ao: "var(--blob)", la: "var(--bio-water-deep)", ecg: "var(--ink)", vol: "var(--ink-2)" };

export function HeartCycleChart({ cursor, mark, letters = false, className }: { cursor?: number; mark?: number; letters?: boolean; className?: string }) {
  const t = useText();
  const locale = useLocale();
  const ecg = polyPath(sample((x) => ecgAt(x), yE));
  const bands: { from: number; to: number; ph: Phase }[] = [
    { from: 0, to: EVENTS.avShut, ph: 4 },
    { from: EVENTS.avShut, to: EVENTS.slOpen, ph: 1 },
    { from: EVENTS.slOpen, to: EVENTS.slShut, ph: 2 },
    { from: EVENTS.slShut, to: EVENTS.avOpen, ph: 3 },
    { from: EVENTS.avOpen, to: CYCLE, ph: 4 },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full", className)} role="img" aria-label={t(tx("Cardiac cycle: ECG, pressures and volume of the left heart", "Herzzyklus: EKG, Drücke und Volumen des linken Herzens"))} style={svgText}>
      {/* systole shading and phase numbers */}
      <rect x={tx_(EVENTS.avShut)} y={14} width={tx_(EVENTS.slShut) - tx_(EVENTS.avShut)} height={H - 34} fill="var(--blob-soft)" opacity={0.75} />
      {!letters &&
        bands.map((b, i) => (
          <text key={i} x={(tx_(b.from) + tx_(b.to)) / 2} y={11} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink-2)">
            {b.ph}
          </text>
        ))}
      {Object.values(EVENTS).map((e) => (
        <line key={e} x1={tx_(e)} x2={tx_(e)} y1={14} y2={H - 20} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
      ))}
      {/* axes */}
      <g fontSize={10.5} fill="var(--ink-3)">
        <text x={6} y={ECG_Y - 20}>{t(tx("ECG", "EKG"))}</text>
        <text x={6} y={96}>mmHg</text>
        {[0, 40, 80, 120].map((p) => (
          <g key={p}>
            <line x1={X0 - 4} x2={X1} y1={yP(p)} y2={yP(p)} stroke="var(--line)" strokeWidth={0.8} />
            <text x={X0 - 7} y={yP(p) + 3.5} textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        <text x={6} y={262}>ml</text>
        {[60, 100, 140].map((v) => (
          <g key={v}>
            <line x1={X0 - 4} x2={X1} y1={yV(v)} y2={yV(v)} stroke="var(--line)" strokeWidth={0.8} />
            <text x={X0 - 7} y={yV(v) + 3.5} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {[0, 0.2, 0.4, 0.6, 0.8].map((s) => (
          <text key={s} x={tx_(s)} y={H - 6} textAnchor={s === 0.8 ? "end" : "middle"}>
            {dec(s, locale, 1)} s
          </text>
        ))}
      </g>
      <line x1={X0} x2={X1} y1={yP(0)} y2={yP(0)} stroke="var(--ink-2)" strokeWidth={1.2} />
      <line x1={X0} x2={X1} y1={314} y2={314} stroke="var(--ink-2)" strokeWidth={1.2} />
      {/* curves */}
      <path d={ecg} fill="none" stroke={CYCLE_COLORS.ecg} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={curve(F.ao, yP)} fill="none" stroke={CYCLE_COLORS.ao} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={curve(F.la, yP)} fill="none" stroke={CYCLE_COLORS.la} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={curve(F.lv, yP)} fill="none" stroke={CYCLE_COLORS.lv} strokeWidth={2.8} strokeLinejoin="round" />
      <path d={curve(F.vol, yV)} fill="none" stroke={CYCLE_COLORS.vol} strokeWidth={2.4} strokeLinejoin="round" />
      {!letters && (
        <g fontSize={10.5} fontWeight={700}>
          <text x={tx_(0.045)} y={ECG_Y - 12} textAnchor="middle" fill="var(--ink-2)">P</text>
          <text x={tx_(0.185) + 9} y={ECG_Y - 30} fill="var(--ink-2)">QRS</text>
          <text x={tx_(0.45)} y={ECG_Y - 16} textAnchor="middle" fill="var(--ink-2)">T</text>
        </g>
      )}
      {mark !== undefined && (
        <g>
          <line x1={tx_(mark)} x2={tx_(mark)} y1={14} y2={H - 20} stroke="var(--blob)" strokeWidth={2.2} />
          <circle cx={tx_(mark)} cy={14} r={9} fill="var(--blob)" />
          <text x={tx_(mark)} y={14} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff">
            X
          </text>
        </g>
      )}
      {cursor !== undefined && (
        <g>
          <line x1={tx_(cursor)} x2={tx_(cursor)} y1={14} y2={H - 20} stroke="var(--blob)" strokeWidth={2} />
          {[
            [yE(ecgAt(cursor)), CYCLE_COLORS.ecg],
            [yP(F.ao(cursor)), CYCLE_COLORS.ao],
            [yP(F.la(cursor)), CYCLE_COLORS.la],
            [yP(F.lv(cursor)), CYCLE_COLORS.lv],
            [yV(F.vol(cursor)), CYCLE_COLORS.vol],
          ].map(([y, c], i) => (
            <circle key={i} cx={tx_(cursor)} cy={y as number} r={4} fill="var(--raised)" stroke={c as string} strokeWidth={2.2} />
          ))}
        </g>
      )}
    </svg>
  );
}

export function CycleLegend() {
  const t = useText();
  const items: [string, Text][] = [
    [CYCLE_COLORS.lv, tx("left ventricle (pressure)", "linke Kammer (Druck)")],
    [CYCLE_COLORS.ao, tx("aorta (pressure)", "Aorta (Druck)")],
    [CYCLE_COLORS.la, tx("left atrium (pressure)", "linker Vorhof (Druck)")],
    [CYCLE_COLORS.vol, tx("ventricle volume", "Kammervolumen")],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {items.map(([c, l]) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: c }} />
          {t(l)}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 rounded-sm bg-blob-soft" />
        {t(tx("systole", "Systole"))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget

export function HeartCycleWidget() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0.1);
  const [playing, setPlaying] = useState(false);
  useAnimationFrame((_, delta) => {
    if (!playing || reduce) return;
    setTime((x) => (x + (Math.min(delta, 50) / 1000) * (CYCLE / 7)) % CYCLE);
  });
  const ph = phaseAt(time);
  const P = PHASES[ph];
  const heart = cycleHeart(time);
  const vals = cycleValues(time);
  const v = (k: "lv" | "ao" | "la" | "vol") => dec(Math.round(vals[k]), locale);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <HeartCycleChart cursor={time} />
      </div>
      <CycleLegend />
      <div className="flex flex-wrap items-center gap-2">
        {!reduce && (
          <MainButton onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? t(tx("Pause", "Pause")) : t(tx("Play slowly", "Langsam abspielen"))}
          </MainButton>
        )}
        <input
          type="range"
          min={0}
          max={CYCLE - 0.001}
          step={0.001}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Time in the cardiac cycle", "Zeitpunkt im Herzzyklus"))}
          className="h-10 min-w-[160px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
        <span className="w-14 text-right font-math text-[14px] tabular-nums text-ink-2">{dec(time, locale, 2)} s</span>
      </div>
      <div className="grid items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
        <svg viewBox="20 10 450 450" className="mx-auto block h-auto w-full max-w-[170px]" aria-hidden>
          <HeartArt state={heart} arrows={ph === 2 ? "eject" : ph === 4 && heart.av ? "fill" : null} />
        </svg>
        <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-blob text-[12px] font-bold text-white">{ph}</span>
            <span className="font-semibold text-ink">{t(P.name)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-semibold", ph <= 2 ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2")}>{t(P.part)}</span>
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">{t(P.text)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
            <span>
              {t(tx("AV valves", "Segelklappen"))}: <b className="text-ink">{heart.av ? t(tx("open", "offen")) : t(tx("shut", "zu"))}</b>
            </span>
            <span>
              {t(tx("Semilunar valves", "Taschenklappen"))}: <b className="text-ink">{heart.sl ? t(tx("open", "offen")) : t(tx("shut", "zu"))}</b>
            </span>
            <span className="font-math">
              {t(tx("ventricle", "Kammer"))} {v("lv")} · {t(tx("aorta", "Aorta"))} {v("ao")} · {t(tx("atrium", "Vorhof"))} {v("la")} mmHg · {v("vol")} ml
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
