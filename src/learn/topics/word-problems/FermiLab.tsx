"use client";

// Widget: a Fermi estimate as a chain of assumptions. Every factor is a slider over
// sensible guesses; the running result updates step by step. The bar below shows the
// result on a scale of powers of ten together with the range of all assumptions: the
// guesses change the answer, but rarely its order of magnitude.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { nf } from "./kit";
import { HowTo, Label, Segmented, Slider, soft } from "./ui";

type Factor = { label: Text; op: "·" | ":"; options: number[]; start: number; show?: (v: number, l: Locale) => string; after: Text };
type Scenario = { id: string; label: Text; question: Text; base: { label: Text; value: number; after: Text }; factors: Factor[]; answer: Text };

const SCENARIOS: Scenario[] = [
  {
    id: "piano",
    label: tx("Piano tuners", "Klavierstimmer"),
    question: tx("How many piano tuners work in Hamburg?", "Wie viele Klavierstimmer arbeiten in Hamburg?"),
    base: { label: tx("Inhabitants of Hamburg (known)", "Einwohner Hamburgs (bekannt)"), value: 1900000, after: tx("inhabitants", "Einwohner") },
    factors: [
      { label: tx("People per household", "Personen pro Haushalt"), op: ":", options: [1.5, 2, 2.5, 3], start: 1, after: tx("households", "Haushalte") },
      { label: tx("Piano in every n-th household", "Klavier in jedem n-ten Haushalt"), op: ":", options: [10, 20, 30, 50], start: 1, show: (v) => `1 : ${v}`, after: tx("pianos", "Klaviere") },
      { label: tx("Tunings per piano and year", "Stimmungen pro Klavier und Jahr"), op: "·", options: [0.5, 1, 2], start: 1, after: tx("tunings a year", "Stimmungen pro Jahr") },
      { label: tx("Pianos a tuner manages a day", "Klaviere pro Stimmer und Tag"), op: ":", options: [2, 3, 4, 5], start: 2, after: tx("working days needed", "nötige Arbeitstage") },
      { label: tx("Working days a year", "Arbeitstage pro Jahr"), op: ":", options: [180, 200, 220, 250], start: 1, after: tx("piano tuners", "Klavierstimmer") },
    ],
    answer: tx("piano tuners", "Klavierstimmer"),
  },
  {
    id: "hair",
    label: tx("Hairdressers", "Friseure"),
    question: tx("How many hairdressers work in Berlin?", "Wie viele Friseurinnen und Friseure arbeiten in Berlin?"),
    base: { label: tx("Inhabitants of Berlin (known)", "Einwohner Berlins (bekannt)"), value: 3800000, after: tx("inhabitants", "Einwohner") },
    factors: [
      { label: tx("Haircuts per person and year", "Haarschnitte pro Person und Jahr"), op: "·", options: [3, 4, 6, 8, 12], start: 2, after: tx("haircuts a year", "Haarschnitte pro Jahr") },
      { label: tx("Haircuts per hairdresser and day", "Haarschnitte pro Friseur und Tag"), op: ":", options: [6, 8, 10, 12], start: 1, after: tx("working days needed", "nötige Arbeitstage") },
      { label: tx("Working days a year", "Arbeitstage pro Jahr"), op: ":", options: [200, 220, 240], start: 1, after: tx("hairdressers", "Friseure") },
    ],
    answer: tx("hairdressers", "Friseure"),
  },
  {
    id: "heart",
    label: tx("Heartbeats", "Herzschläge"),
    question: tx("How often does a heart beat in a whole life?", "Wie oft schlägt ein Herz in einem ganzen Leben?"),
    base: { label: tx("One minute", "Eine Minute"), value: 1, after: tx("minute", "Minute") },
    factors: [
      { label: tx("Beats per minute", "Schläge pro Minute"), op: "·", options: [60, 70, 80, 90], start: 1, after: tx("beats a minute", "Schläge pro Minute") },
      { label: tx("Minutes per hour", "Minuten pro Stunde"), op: "·", options: [60], start: 0, after: tx("beats an hour", "Schläge pro Stunde") },
      { label: tx("Hours per day", "Stunden pro Tag"), op: "·", options: [24], start: 0, after: tx("beats a day", "Schläge pro Tag") },
      { label: tx("Days per year", "Tage pro Jahr"), op: "·", options: [365], start: 0, after: tx("beats a year", "Schläge pro Jahr") },
      { label: tx("Years of life", "Lebensjahre"), op: "·", options: [70, 80, 90], start: 1, after: tx("beats in a life", "Schläge im Leben") },
    ],
    answer: tx("heartbeats", "Herzschläge"),
  },
];

const apply = (v: number, op: "·" | ":", f: number) => (op === "·" ? v * f : v / f);

/** Two significant digits: 59,4 → 59, 12 954 → 13 000. */
function round2(v: number) {
  if (v === 0) return 0;
  const k = Math.floor(Math.log10(Math.abs(v))) - 1;
  const p = 10 ** k;
  return Math.round(v / p) * p;
}

/** "2,9 · 10^9" for big numbers in the display language. */
function sci(v: number, l: Locale) {
  const e = Math.floor(Math.log10(v));
  const m = Math.round((v / 10 ** e) * 10) / 10;
  return `${nf(m, l, 1)} \\cdot 10^{${e}}`;
}

export function FermiLab() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [sid, setSid] = useState("piano");
  const [picks, setPicks] = useState<Record<string, number[]>>({});
  const sc = SCENARIOS.find((s) => s.id === sid)!;
  const idx = picks[sid] ?? sc.factors.map((f) => f.start);

  const running: number[] = [];
  let v = sc.base.value;
  sc.factors.forEach((f, i) => {
    v = apply(v, f.op, f.options[idx[i]]);
    running.push(v);
  });
  const result = v;
  const lo = sc.factors.reduce((acc, f) => apply(acc, f.op, f.op === "·" ? Math.min(...f.options) : Math.max(...f.options)), sc.base.value);
  const hi = sc.factors.reduce((acc, f) => apply(acc, f.op, f.op === "·" ? Math.max(...f.options) : Math.min(...f.options)), sc.base.value);

  const e0 = Math.floor(Math.log10(lo)) - 1;
  const e1 = Math.ceil(Math.log10(hi)) + 1;
  const pos = (x: number) => ((Math.log10(x) - e0) / (e1 - e0)) * 100;
  const big = result >= 1e6;

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "Nobody knows the exact answer, but you can estimate it with a chain of guesses. Change the assumptions and watch what happens to the result and to its order of magnitude.",
          "Die genaue Antwort kennt niemand, aber mit einer Kette von Annahmen kannst du sie schätzen. Ändere die Annahmen und schau, was mit dem Ergebnis und seiner Größenordnung passiert.",
        )}
      />
      <Segmented id={`${id}-sc`} label={tx("Question", "Frage")} size="sm" value={sid} onChange={setSid} options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))} />
      <p className="font-display text-[17px] font-semibold text-ink">{t(sc.question)}</p>

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-surface px-3.5 py-2.5">
          <span className="text-[13px] text-ink-2">{t(sc.base.label)}</span>
          <span className="font-math text-[17px] tabular-nums text-ink">{nf(sc.base.value, l, 0)}</span>
        </div>
        {sc.factors.map((f, i) => {
          const fixed = f.options.length === 1;
          const val = f.options[idx[i]];
          const shown = f.show ? f.show(val, l) : nf(val, l);
          return (
            <div key={`${sid}${i}`} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-2">
              <span className="mt-1.5 grid size-7 place-items-center rounded-full bg-blob-soft font-math text-[16px] text-blob-ink">{f.op}</span>
              <div className="min-w-0 rounded-xl border border-line px-3 py-1.5">
                {fixed ? (
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-[13px] text-ink-2">{t(f.label)}</span>
                    <span className="font-math text-[17px] tabular-nums">{shown}</span>
                  </div>
                ) : (
                  <Slider
                    label={f.label}
                    value={idx[i]}
                    min={0}
                    max={f.options.length - 1}
                    onChange={(k) => setPicks((o) => ({ ...o, [sid]: idx.map((x, j) => (j === i ? k : x)) }))}
                    display={shown}
                    valueText={shown}
                    stacked
                  />
                )}
                <div className="flex items-baseline justify-end gap-1.5 border-t border-line/70 pt-1 text-[12.5px] text-ink-3">
                  =
                  <motion.span key={Math.round(running[i])} initial={{ opacity: 0.3, y: -3 }} animate={{ opacity: 1, y: 0 }} className="font-math text-[15px] tabular-nums text-ink">
                    {nf(running[i] < 100 ? Math.round(running[i] * 10) / 10 : Math.round(running[i]), l, running[i] < 100 ? 1 : 0)}
                  </motion.span>
                  {t(f.after)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-blob/30 bg-blob-soft/40 px-4 py-3">
        <Label accent>{t(tx("Estimate", "Schätzung"))}</Label>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-math text-[26px] font-semibold tabular-nums text-blob-ink">≈ {nf(round2(result), l, 0)}</span>
          <span className="text-[14px] text-ink-2">{t(sc.answer)}</span>
          {big && <MathView src={`\\approx ${sci(result, l)}`} size="sm" animate={false} className="text-ink-2" />}
        </div>
        <div className="mt-4 pb-6">
          <div className="relative h-2.5 rounded-full bg-line">
            <motion.div
              className="absolute top-0 h-full rounded-full bg-blob/30"
              initial={false}
              animate={{ left: `${pos(lo)}%`, width: `${pos(hi) - pos(lo)}%` }}
              transition={soft}
            />
            <motion.div
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-raised bg-blob shadow-card"
              initial={false}
              animate={{ left: `${pos(result)}%` }}
              transition={soft}
            />
            {Array.from({ length: e1 - e0 + 1 }, (_, k) => e0 + k).map((e) => (
              <span key={e} className="absolute top-3.5 -translate-x-1/2 text-ink-3" style={{ left: `${((e - e0) / (e1 - e0)) * 100}%` }}>
                <MathView src={`10^{${e}}`} size="inline" animate={false} className={cn("text-[12px]", (e1 - e0 > 8 && (e - e0) % 2 === 1) && "invisible")} />
              </span>
            ))}
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {t(
            tx(
              `The most extreme assumptions give between ${nf(round2(lo), "en", 0)} and ${nf(round2(hi), "en", 0)} (the light band). A Fermi estimate is after the order of magnitude, not the exact number: sensible guesses land in the middle.`,
              `Die extremsten Annahmen ergeben zwischen ${nf(round2(lo), "de", 0)} und ${nf(round2(hi), "de", 0)} (der helle Streifen). Bei einer Fermi-Aufgabe geht es um die Größenordnung, nicht um die genaue Zahl: Vernünftige Annahmen landen in der Mitte.`,
            ),
          )}
        </p>
      </div>
    </div>
  );
}
