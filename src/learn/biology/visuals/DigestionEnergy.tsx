"use client";

// Energy calculator: grams of fat, carbohydrates and protein → kJ (39 / 17 / 17 kJ per gram),
// with the share of grams vs the share of energy; and the daily energy need from the basal
// metabolic rate (4.2 kJ per kg and hour) plus the extra for activity.
// Also exports a nutrition label for practice tasks.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export const KJ = { fat: 39, carbs: 17, protein: 17 } as const;
type Macro = keyof typeof KJ;

const MACROS: { id: Macro; name: Text; max: number; color: string }[] = [
  { id: "fat", name: tx("Fat", "Fett"), max: 60, color: "var(--bio-sun)" },
  { id: "carbs", name: tx("Carbohydrates", "Kohlenhydrate"), max: 150, color: "var(--bio-wood)" },
  { id: "protein", name: tx("Protein", "Eiweiß"), max: 60, color: "var(--bio-a)" },
];

/** Rounded nutrition values per 100 g (or per portion as named). */
export const FOOD_LABELS: { name: Text; fat: number; carbs: number; protein: number }[] = [
  { name: tx("Milk chocolate, 100 g", "Vollmilchschokolade, 100 g"), fat: 31, carbs: 57, protein: 7 },
  { name: tx("Wholemeal bread, 100 g", "Vollkornbrot, 100 g"), fat: 1, carbs: 40, protein: 7 },
  { name: tx("Peanuts, 100 g", "Erdnüsse, 100 g"), fat: 49, carbs: 12, protein: 25 },
  { name: tx("Apple, 150 g", "Apfel, 150 g"), fat: 0, carbs: 18, protein: 0 },
  { name: tx("Chips, 150 g", "Pommes frites, 150 g"), fat: 15, carbs: 45, protein: 5 },
  { name: tx("Low-fat quark, 100 g", "Magerquark, 100 g"), fat: 0, carbs: 4, protein: 12 },
];

const ACTIVITY: { pal: number; name: Text }[] = [
  { pal: 1.4, name: tx("little (mostly sitting)", "wenig (meist sitzend)") },
  { pal: 1.6, name: tx("medium (walking, some sport)", "mittel (zu Fuß, etwas Sport)") },
  { pal: 1.8, name: tx("a lot (sport most days)", "viel (fast täglich Sport)") },
];

function Slider({ label, value, max, color, unit, onChange }: { label: Text; value: number; max: number; color: string; unit: string; onChange: (v: number) => void }) {
  const t = useText();
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-[13.5px]">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <span className="size-3 rounded-sm" style={{ background: color }} />
          {t(label)}
        </span>
        <span className="font-semibold tabular-nums text-ink">
          {value} {unit}
        </span>
      </span>
      <input type="range" min={0} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={t(label)} className="w-full accent-blob" />
    </label>
  );
}

function FoodEnergy() {
  const t = useText();
  const [g, setG] = useState({ fat: 31, carbs: 57, protein: 7 });
  const kj = MACROS.map((m) => g[m.id] * KJ[m.id]);
  const total = kj.reduce((s, v) => s + v, 0);
  const grams = g.fat + g.carbs + g.protein;
  const minutes = Math.round((total / 1500) * 60);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FOOD_LABELS.map((f) => (
          <button
            key={t(f.name)}
            type="button"
            onClick={() => setG({ fat: f.fat, carbs: f.carbs, protein: f.protein })}
            className={cn(
              "h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
              g.fat === f.fat && g.carbs === f.carbs && g.protein === f.protein ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {t(f.name)}
          </button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {MACROS.map((m) => (
            <Slider key={m.id} label={m.name} value={g[m.id]} max={m.max} color={m.color} unit="g" onChange={(v) => setG((x) => ({ ...x, [m.id]: v }))} />
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Energy", "Energie"))}</div>
            <div className="font-display text-[32px] font-bold leading-tight tabular-nums">
              {total} <span className="text-[18px] font-semibold text-ink-2">kJ</span>
            </div>
            <div className="text-[12.5px] text-ink-3 tabular-nums">
              ≈ {Math.round(total / 4.184)} kcal
            </div>
            <div className="mt-2 space-y-0.5 text-[12.5px] tabular-nums text-ink-2">
              {MACROS.map((m, i) => (
                <div key={m.id} className="flex justify-between gap-2">
                  <span>
                    {g[m.id]} g × {KJ[m.id]} kJ/g
                  </span>
                  <span className="font-medium text-ink">{kj[i]} kJ</span>
                </div>
              ))}
            </div>
          </div>
          {[
            { label: tx("share of the grams", "Anteil an den Gramm"), values: MACROS.map((m) => g[m.id]), sum: grams },
            { label: tx("share of the energy", "Anteil an der Energie"), values: kj, sum: total },
          ].map((bar) => (
            <div key={t(bar.label)} className="space-y-1">
              <div className="text-[12px] text-ink-3">{t(bar.label)}</div>
              <div className="flex h-4 overflow-hidden rounded-full bg-hover">
                {bar.values.map((v, i) => (
                  <motion.div key={i} className="h-full" style={{ background: MACROS[i].color }} initial={false} animate={{ width: bar.sum ? `${(v / bar.sum) * 100}%` : "0%" }} transition={{ type: "spring", stiffness: 220, damping: 28 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="rounded-xl bg-blob-soft/50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">
        <Inline
          text={
            g.fat > 0 && kj[0] > total / 2 && g.fat < grams / 2
              ? tx("Look at the bars: fat is less than half of the grams, but more than half of the energy. **1 g of fat has more than twice the energy of 1 g of sugar.**", "Schau auf die Balken: Fett ist weniger als die Hälfte der Gramm, liefert aber mehr als die Hälfte der Energie. **1 g Fett hat mehr als doppelt so viel Energie wie 1 g Zucker.**")
              : tx(`Enough for about **${minutes} minutes** of cycling (about 1500 kJ per hour).`, `Das reicht für etwa **${minutes} Minuten** Radfahren (etwa 1500 kJ pro Stunde).`)
          }
        />
      </p>
    </div>
  );
}

function EnergyNeed() {
  const t = useText();
  const locale = useLocale();
  const [m, setM] = useState(50);
  const [a, setA] = useState(1);
  const pal = ACTIVITY[a].pal;
  const basal = Math.round(4.2 * m * 24);
  const extra = Math.round(basal * (pal - 1));
  const total = basal + extra;
  return (
    <div className="space-y-4">
      <Slider label={tx("Body mass", "Körpermasse")} value={m} max={100} color="var(--bio-flesh-deep)" unit="kg" onChange={(v) => setM(Math.max(25, v))} />
      <div className="space-y-1.5">
        <div className="text-[13.5px] font-medium text-ink">{t(tx("How active?", "Wie aktiv?"))}</div>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY.map((x, i) => (
            <button key={i} type="button" onClick={() => setA(i)} className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors", a === i ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}>
              {t(x.name)}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex h-5 overflow-hidden rounded-full bg-hover">
          <motion.div className="h-full" style={{ background: "var(--bio-flesh-deep)" }} initial={false} animate={{ width: `${(basal / 15000) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 28 }} />
          <motion.div className="h-full" style={{ background: "var(--bio-sun)" }} initial={false} animate={{ width: `${(extra / 15000) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 28 }} />
        </div>
        <div className="grid gap-1 text-[13.5px] tabular-nums">
          <div className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className="size-3 rounded-sm" style={{ background: "var(--bio-flesh-deep)" }} />
              {t(tx("Basal metabolic rate", "Grundumsatz"))}: 4{locale === "de" ? "," : "."}2 kJ × {m} × 24
            </span>
            <span className="font-semibold text-ink">{basal} kJ</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="flex items-center gap-1.5 text-ink-2">
              <span className="size-3 rounded-sm" style={{ background: "var(--bio-sun)" }} />
              {t(tx("Extra for activity", "Leistungsumsatz"))}
            </span>
            <span className="font-semibold text-ink">+ {extra} kJ</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-line pt-1">
            <span className="font-medium text-ink">{t(tx("Total need per day", "Gesamtbedarf pro Tag"))}</span>
            <span className="font-display text-[18px] font-bold text-ink">{total} kJ</span>
          </div>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-3">
        {t(
          tx(
            `Rule of thumb: the body needs about 4.2 kJ per kg of body mass every hour just to stay alive (breathing, heartbeat, body heat). Growing teenagers need a bit more. That's ${dec(total / 39, "en", 0)} g of pure fat or ${dec(total / 17, "en", 0)} g of sugar.`,
            `Faustregel: Allein zum Leben (Atmung, Herzschlag, Körperwärme) braucht der Körper pro Stunde etwa 4,2 kJ je kg Körpermasse. Wer noch wächst, braucht etwas mehr. Das sind ${dec(total / 39, "de", 0)} g reines Fett oder ${dec(total / 17, "de", 0)} g Zucker.`,
          ),
        )}
      </p>
    </div>
  );
}

export function DigestionEnergy() {
  const t = useText();
  const scope = useId();
  const [tab, setTab] = useState<0 | 1>(0);
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" role="tablist">
        {[tx("Energy in food", "Energie in Lebensmitteln"), tx("Energy you need", "Energiebedarf")].map((label, i) => (
          <button key={i} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i as 0 | 1)} className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", tab === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}>
            {tab === i && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(label)}</span>
          </button>
        ))}
      </div>
      {tab === 0 ? <FoodEnergy /> : <EnergyNeed />}
    </div>
  );
}

/** Task picture: a nutrition label ("Nährwerte pro 100 g"). */
export function DigestionLabel({ name, per, fat, carbs, protein }: { name: Text; per: Text; fat: number; carbs: number; protein: number }) {
  const t = useText();
  const locale = useLocale();
  const rows: [Text, number][] = [
    [tx("Fat", "Fett"), fat],
    [tx("Carbohydrates", "Kohlenhydrate"), carbs],
    [tx("Protein", "Eiweiß"), protein],
  ];
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-lg border-2 border-ink bg-raised px-3 py-2 text-[13.5px] text-ink">
      <div className="font-semibold">{t(name)}</div>
      <div className="flex justify-between border-b-2 border-ink pb-1 text-[12px] text-ink-2">
        <span>{t(tx("Nutrition", "Nährwerte"))}</span>
        <span>{t(per)}</span>
      </div>
      {rows.map(([label, v]) => (
        <div key={t(label)} className="flex justify-between border-b border-line py-1 tabular-nums last:border-0">
          <span>{t(label)}</span>
          <span className="font-medium">{dec(v, locale, 1)} g</span>
        </div>
      ))}
    </div>
  );
}
