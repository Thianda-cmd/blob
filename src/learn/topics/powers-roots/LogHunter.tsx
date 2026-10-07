"use client";

// Level 3 widget: the logarithm is the exponent. Slide x until b^x hits the target; then see that the
// exponent you found is log_b(y), and how a calculator gets it with lg (or ln).

import { AnimatePresence, motion } from "motion/react";
import { Calculator, Check, Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { pow } from "@/lib/stableMath";
import { Segmented, spring } from "./ui";

const BASES: { b: number; targets: number[]; max: number }[] = [
  { b: 2, targets: [20, 50, 100, 6], max: 8 },
  { b: 3, targets: [10, 50, 200, 2], max: 6 },
  { b: 10, targets: [2, 50, 300, 5], max: 3 },
  { b: 1.5, targets: [3, 10, 25, 2], max: 9 },
];

/** Same digits on server and browser. */
const stable = (v: number) => Number(v.toPrecision(12));
const lg = (v: number) => stable(Math.log10(v));
const ln = (v: number) => stable(Math.log(v));

const fmt = (v: number, l: Locale, digits = 2) => {
  const s = (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits);
  return l === "de" ? s.replace(".", ",") : s;
};
const plain = (v: number, l: Locale) => (l === "de" ? String(v).replace(".", ",") : String(v));

/** Find the exponent: slide x until b^x reaches the target, then see it as a logarithm. */
export function LogHunter() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const [bi, setBi] = useState(0);
  const [ti, setTi] = useState(0);
  const [xh, setXh] = useState(300);
  const [calc, setCalc] = useState(false);
  const B = BASES[bi];
  const target = B.targets[ti];
  const max = B.max * 100;
  const x = Math.min(xh, max) / 100;
  const value = pow(B.b, x);
  const exact = lg(target) / lg(B.b);
  const hit = Math.abs(x - exact) <= 0.0051;
  const k = Math.floor(exact + 1e-9);
  const bS = plain(B.b, l);
  const scaleMax = target * 1.4;
  const fill = Math.min(1, value / scaleMax);
  const goal = target / scaleMax;
  const status = hit
    ? tx(`Got it: $${bS}^{${fmt(x, "en")}} \\approx ${target}$`, `Treffer: $${bS}^{${fmt(x, "de")}} \\approx ${target}$`)
    : value < target
      ? tx("Too small: make $x$ bigger.", "Zu klein: Mach $x$ größer.")
      : tx("Too big: make $x$ smaller.", "Zu groß: Mach $x$ kleiner.");

  const set = (v: number) => {
    setXh(Math.max(0, Math.min(max, Math.round(v))));
  };
  const step = (d: number) => set(Math.min(xh, max) + d);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-math text-[17px] italic text-ink-2">b =</span>
          <Segmented
            scope={`${scope}-b`}
            label={tx("Base", "Basis")}
            value={bi}
            onChange={(i) => {
              setBi(i);
              setTi(0);
              setXh(100);
              setCalc(false);
            }}
            options={BASES.map((o, i) => ({ id: i, label: <span className="font-math">{plain(o.b, l)}</span> }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Target", "Ziel"))}</span>
          <Segmented
            scope={`${scope}-t`}
            label={tx("Target", "Ziel")}
            value={ti}
            onChange={(i) => {
              setTi(i);
              setCalc(false);
            }}
            options={B.targets.map((v, i) => ({ id: i, label: <span className="font-math">{v}</span> }))}
          />
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-5">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <MathView src={`${bS}#b^{${fmt(x, l)}#x} \\approx#eq ${fmt(value, l)}#v`} size="lg" scope={`${scope}-p`} />
            <span className="text-[13.5px] text-ink-2">
              {t(tx("target", "Ziel"))}: <span className="font-math text-[18px] text-ink">{target}</span>
            </span>
          </div>

          {/* how close: a bar from 0 to a bit past the target */}
          <div className="relative mx-auto h-5 max-w-[520px] rounded-full bg-hover">
            <motion.div
              className={cn("absolute inset-y-0 left-0 rounded-full", hit ? "bg-ok" : "bg-blob")}
              initial={false}
              animate={{ width: `${fill * 100}%` }}
              transition={spring}
            />
            <div className="absolute -inset-y-1.5 w-[3px] rounded-full bg-ink" style={{ left: `calc(${goal * 100}% - 1.5px)` }} />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`${hit}${value < target}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("flex items-center justify-center gap-1.5 text-center text-[14px]", hit ? "font-semibold text-ok" : "text-ink-2")}
            >
              {hit && <Check className="size-4" strokeWidth={2.5} />}
              <Inline text={t(status)} />
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="shrink-0 font-math text-[17px] italic text-ink-2">x</span>
        <button onClick={() => step(-1)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink active:scale-95" aria-label={t(tx("x minus 0.01", "x minus 0,01"))}>
          <Minus className="size-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={Math.min(xh, max)}
          onChange={(e) => set(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-[var(--blob)]"
          aria-label={t(tx("Exponent x", "Exponent x"))}
          aria-valuetext={fmt(x, l)}
        />
        <button onClick={() => step(1)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink active:scale-95" aria-label={t(tx("x plus 0.01", "x plus 0,01"))}>
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3 rounded-xl border border-line p-4">
        <p className="text-[14px] leading-relaxed text-ink-2">
          <Inline
            text={t(
              k >= 0
                ? tx(
                    `Without a calculator: $${bS}^{${k}} = ${plain(stable(pow(B.b, k)), "en")}$ and $${bS}^{${k + 1}} = ${plain(stable(pow(B.b, k + 1)), "en")}$, so $x$ lies between $${k}$ and $${k + 1}$. The exponent you are hunting is the **logarithm** $\\log_{${bS}} ${target}$.`,
                    `Ohne Rechner: $${bS}^{${k}} = ${plain(stable(pow(B.b, k)), "de")}$ und $${bS}^{${k + 1}} = ${plain(stable(pow(B.b, k + 1)), "de")}$, also liegt $x$ zwischen $${k}$ und $${k + 1}$. Der gesuchte Exponent ist der **Logarithmus** $\\log_{${bS}} ${target}$.`,
                  )
                : tx("", ""),
            )}
          />
        </p>
        <AnimatePresence initial={false} mode="wait">
          {calc ? (
            <motion.div key="calc" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <MathView
                src={`\\log_{${bS}} \\, ${target} =#e1 \\frac{\\lg ${target}}{\\lg ${bS}} \\approx#e2 \\frac{${fmt(lg(target), l, 5)}}{${fmt(lg(B.b), l, 5)}} \\approx#e3 ${fmt(exact, l)}`}
                size="md"
              />
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                <Inline
                  text={t(
                    tx(
                      `A calculator only knows **lg** (base 10) and **ln** (base $e$). Divide: $\\frac{\\ln ${target}}{\\ln ${bS}} \\approx \\frac{${fmt(ln(target), "en", 5)}}{${fmt(ln(B.b), "en", 5)}}$ gives the same ${fmt(exact, "en")}.`,
                      `Ein Taschenrechner kennt nur **lg** (Basis 10) und **ln** (Basis $e$). Teile: $\\frac{\\ln ${target}}{\\ln ${bS}} \\approx \\frac{${fmt(ln(target), "de", 5)}}{${fmt(ln(B.b), "de", 5)}}$ ergibt dasselbe: ${fmt(exact, "de")}.`,
                    ),
                  )}
                />
              </p>
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCalc(true)}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors active:scale-[0.97]",
                hit ? "bg-blob text-white hover:bg-blob-deep" : "border border-line text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <Calculator className="size-4" /> {t(tx("Show the calculator way", "Zeig den Weg mit dem Rechner"))}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
