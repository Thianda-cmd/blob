"use client";

// Cardiac output calculator (level 3): stroke volume × heart rate. Litre bottles fill up with the
// blood the left ventricle pumps in one minute; presets for rest, an athlete and hard exercise.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { Chip, Slider } from "./HeartShared";

type Preset = { name: Text; sv: number; hr: number; note: Text };
const PRESETS: Preset[] = [
  { name: tx("At rest", "In Ruhe"), sv: 70, hr: 70, note: tx("A typical adult at rest.", "Ein typischer Erwachsener in Ruhe.") },
  { name: tx("Athlete at rest", "Sportler in Ruhe"), sv: 100, hr: 50, note: tx("Training enlarges the heart: a bigger stroke volume, so the same output with a lower heart rate.", "Training vergrößert das Herz: Das Schlagvolumen steigt, deshalb reicht eine niedrigere Herzfrequenz für dieselbe Leistung.") },
  { name: tx("Jogging", "Joggen"), sv: 100, hr: 140, note: tx("Muscles need more oxygen: heart rate and stroke volume rise.", "Die Muskeln brauchen mehr Sauerstoff: Herzfrequenz und Schlagvolumen steigen.") },
  { name: tx("Athlete, all-out", "Sportler, Höchstleistung"), sv: 170, hr: 190, note: tx("Trained endurance athletes reach more than 30 litres per minute.", "Trainierte Ausdauersportler schaffen mehr als 30 Liter pro Minute.") },
];
const BLOOD = 5; // litres of blood in an adult

export function HeartOutputWidget() {
  const t = useText();
  const locale = useLocale();
  const [sv, setSv] = useState(70);
  const [hr, setHr] = useState(70);
  const ml = sv * hr;
  const l = ml / 1000;
  const preset = PRESETS.find((p) => p.sv === sv && p.hr === hr);
  const bottles = Math.ceil(Math.max(l, 1));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Chip
            key={t(p.name)}
            on={preset === p}
            onClick={() => {
              setSv(p.sv);
              setHr(p.hr);
            }}
          >
            {t(p.name)}
          </Chip>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <Slider label={t(tx("Stroke volume (SV)", "Schlagvolumen (SV)"))} value={sv} min={40} max={200} step={5} onChange={setSv} display={`${sv} ml`} />
          <Slider label={t(tx("Heart rate (HR)", "Herzfrequenz (HF)"))} value={hr} min={40} max={200} step={1} onChange={setHr} display={`${hr} /min`} />
          <div className="rounded-xl border border-line bg-surface px-4 py-3 font-math text-[15px] leading-relaxed text-ink">
            <div>
              {t(tx("CO", "HMV"))} = {t(tx("SV", "SV"))} · {t(tx("HR", "HF"))}
            </div>
            <div>
              = {sv} ml · {hr} /min = {dec(ml, locale)} ml/min
            </div>
            <div className="text-[19px] font-semibold text-blob-ink">≈ {dec(Math.round(l * 10) / 10, locale, 1)} l/min</div>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">
            {preset
              ? t(preset.note)
              : t(tx("Cardiac output (CO) is the volume of blood one ventricle pumps per minute.", "Das Herzminutenvolumen (HMV) ist das Blutvolumen, das eine Herzkammer pro Minute auswirft."))}
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" aria-label={t(tx("Litre bottles filled in one minute", "In einer Minute gefüllte Literflaschen"))} role="img">
            {Array.from({ length: Math.min(bottles, 40) }, (_, i) => {
              const fill = Math.max(0, Math.min(1, l - i));
              return (
                <svg key={i} viewBox="0 0 20 34" className="h-9 w-[21px]" aria-hidden>
                  <path d="M7 1 L13 1 L13 7 C18 9 19 12 19 16 L19 30 C19 32 18 33 16 33 L4 33 C2 33 1 32 1 30 L1 16 C1 12 2 9 7 7 Z" fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} />
                  <motion.rect x={1.6} width={16.8} fill="var(--bio-blood)" initial={false} animate={{ y: 32.4 - fill * 22, height: fill * 22 }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
                </svg>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface px-2 py-2.5">
              <div className="text-[11.5px] text-ink-3">{t(tx("all blood (5 l) once round in", "alles Blut (5 l) einmal herum in"))}</div>
              <div className="font-math text-[18px] tabular-nums text-ink">{dec(Math.round((BLOOD / l) * 60), locale)} s</div>
            </div>
            <div className="rounded-lg bg-surface px-2 py-2.5">
              <div className="text-[11.5px] text-ink-3">{t(tx("per day at this rate", "pro Tag bei diesem Tempo"))}</div>
              <div className="font-math text-[18px] tabular-nums text-ink">{dec(Math.round(l * 1440), locale)} l</div>
            </div>
          </div>
          <p className="text-[12px] text-ink-3">{t(tx("Each bottle holds one litre. Watch the units: 1000 ml = 1 l.", "Jede Flasche fasst einen Liter. Achte auf die Einheiten: 1000 ml = 1 l."))}</p>
        </div>
      </div>
    </div>
  );
}
