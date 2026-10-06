"use client";

// BMI and energy balance: body mass and height give the BMI (kg/m²) on the WHO scale for
// adults; energy intake vs need (basal rate × activity) gives the daily balance and what it
// means for body fat over a month.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export const BMI_CLASSES: { max: number; name: Text; color: string }[] = [
  { max: 18.5, name: tx("underweight", "Untergewicht"), color: "var(--bio-water)" },
  { max: 25, name: tx("normal weight", "Normalgewicht"), color: "var(--bio-leaf)" },
  { max: 30, name: tx("overweight (pre-obesity)", "Übergewicht (Präadipositas)"), color: "var(--bio-sun)" },
  { max: Infinity, name: tx("obesity", "Adipositas"), color: "var(--bio-blood)" },
];

export const bmiClass = (bmi: number) => BMI_CLASSES.findIndex((c) => bmi < c.max);

const SCALE_MIN = 14;
const SCALE_MAX = 40;
const pos = (v: number) => ((Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

const PAL: { v: number; name: Text }[] = [
  { v: 1.4, name: tx("sitting a lot", "viel Sitzen") },
  { v: 1.6, name: tx("medium", "mittel") },
  { v: 1.8, name: tx("very active", "sehr aktiv") },
];

function Range({ label, value, min, max, step = 1, shown, onChange }: { label: Text; value: number; min: number; max: number; step?: number; shown: string; onChange: (v: number) => void }) {
  const t = useText();
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-[13.5px]">
        <span className="font-medium text-ink">{t(label)}</span>
        <span className="font-semibold tabular-nums text-ink">{shown}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={t(label)} className="w-full accent-blob" />
    </label>
  );
}

export function DigestionBmi() {
  const t = useText();
  const locale = useLocale();
  const [m, setM] = useState(70);
  const [cm, setCm] = useState(175);
  const [intake, setIntake] = useState(11000);
  const [pal, setPal] = useState(1);
  const h = cm / 100;
  const bmi = m / (h * h);
  const k = bmiClass(bmi);
  const basal = Math.round(4.2 * m * 24);
  const need = Math.round(basal * PAL[pal].v);
  const balance = intake - need;
  const month = (balance * 30) / 29000;
  const n = (v: number, d = 1) => dec(v, locale, d);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Range label={tx("Body mass", "Körpermasse")} value={m} min={35} max={130} shown={`${m} kg`} onChange={setM} />
          <Range label={tx("Height", "Körpergröße")} value={cm} min={140} max={205} shown={`${n(h, 2)} m`} onChange={setCm} />
        </div>
        <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="overflow-x-auto">
            <MathView src={`\\text{BMI} = \\frac{m}{h^2} = \\frac{${m} "kg"}{(${n(h, 2)} "m")^2} \\approx ${n(bmi)}`} size="md" />
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: BMI_CLASSES[k].color }} />
            <span className="text-[14px] font-semibold text-ink">{t(BMI_CLASSES[k].name)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="relative flex h-4 overflow-hidden rounded-full">
          {BMI_CLASSES.map((c, i) => {
            const from = pos(i ? BMI_CLASSES[i - 1].max : SCALE_MIN);
            const to = pos(c.max === Infinity ? SCALE_MAX : c.max);
            return <div key={i} className={cn("h-full", i !== k && "opacity-45")} style={{ width: `${to - from}%`, background: c.color }} />;
          })}
        </div>
        <div className="relative h-5">
          <motion.div className="absolute top-0 -ml-[7px] size-0 border-x-[7px] border-b-[10px] border-x-transparent border-b-ink" initial={false} animate={{ left: `${pos(bmi)}%` }} transition={{ type: "spring", stiffness: 260, damping: 28 }} />
        </div>
        <div className="relative h-4 text-[11px] tabular-nums text-ink-3">
          {[18.5, 25, 30].map((v) => (
            <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pos(v)}%` }}>
              {n(v)}
            </span>
          ))}
        </div>
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          <Inline
            text={tx(
              "WHO classes for **adults**. For children and teenagers you compare with others of the same age and sex (**BMI percentiles**). The BMI can't tell muscle from fat.",
              "WHO-Einteilung für **Erwachsene**. Bei Kindern und Jugendlichen vergleicht man mit Gleichaltrigen gleichen Geschlechts (**BMI-Perzentile**). Der BMI unterscheidet nicht zwischen Muskeln und Fett.",
            )}
          />
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-line px-4 py-3">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Energy balance", "Energiebilanz"))}</div>
        <Range label={tx("Energy intake per day", "Energiezufuhr pro Tag")} value={intake} min={5000} max={18000} step={100} shown={`${intake} kJ`} onChange={setIntake} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-ink-2">{t(tx("Activity (PAL):", "Aktivität (PAL):"))}</span>
          {PAL.map((p, i) => (
            <button key={i} type="button" onClick={() => setPal(i)} className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors", pal === i ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}>
              {t(p.name)} {n(p.v)}
            </button>
          ))}
        </div>
        <div className="grid gap-1 text-[13.5px] tabular-nums">
          <div className="flex justify-between gap-2 text-ink-2">
            <span>
              {t(tx("Need", "Bedarf"))}: {n(4.2)} kJ × {m} × 24 × {n(PAL[pal].v)}
            </span>
            <span className="font-semibold text-ink">{need} kJ</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-line pt-1">
            <span className="font-medium text-ink">{t(tx("Balance per day", "Bilanz pro Tag"))}</span>
            <span className={cn("font-display text-[18px] font-bold", balance > 0 ? "text-danger" : balance < 0 ? "text-ok" : "text-ink")}>
              {balance > 0 ? "+" : ""}
              {balance} kJ
            </span>
          </div>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={
              Math.abs(balance) < 300
                ? tx("Balanced: intake and need are about the same, the body mass stays.", "Ausgeglichen: Zufuhr und Bedarf sind etwa gleich, die Körpermasse bleibt.")
                : balance > 0
                  ? tx(`**Positive balance**: the extra energy is stored as fat. In 30 days that's about **${n(month)} kg** of body fat (1 kg ≈ 29 000 kJ).`, `**Positive Bilanz**: Die überschüssige Energie wird als Fett gespeichert. In 30 Tagen sind das etwa **${n(month)} kg** Körperfett (1 kg ≈ 29 000 kJ).`)
                  : tx(`**Negative balance**: the body uses its reserves. In 30 days about **${n(-month)} kg** of body fat.`, `**Negative Bilanz**: Der Körper greift seine Reserven an. In 30 Tagen etwa **${n(-month)} kg** Körperfett.`)
            }
          />
        </p>
      </div>
    </div>
  );
}
