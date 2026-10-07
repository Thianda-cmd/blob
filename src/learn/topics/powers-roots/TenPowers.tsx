"use client";

// Level 1 widget: powers of ten. Pick a digit and an exponent; the zeros fly in, the number gets its
// name (thousand, million, billion…), and a challenge asks for a given big number.

import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCw } from "lucide-react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { NumStepper } from "./ui";

/** Big numbers the challenge asks for: [digit, exponent]. */
const TARGETS: [number, number][] = [
  [4, 7],
  [3, 5],
  [7, 9],
  [2, 3],
  [6, 8],
  [5, 12],
  [9, 4],
  [8, 6],
];

const NAMES: Record<Locale, [string, string][]> = {
  en: [
    ["", ""],
    ["thousand", "thousand"],
    ["million", "million"],
    ["billion", "billion"],
    ["trillion", "trillion"],
  ],
  de: [
    ["", ""],
    ["Tausend", "Tausend"],
    ["Million", "Millionen"],
    ["Milliarde", "Milliarden"],
    ["Billion", "Billionen"],
  ],
};

/** "40 million", "3 Milliarden", "500". */
export function bigName(a: number, n: number, l: Locale): string {
  const group = Math.floor(n / 3);
  const lead = a * 10 ** (n % 3);
  if (group === 0) return String(lead);
  const [one, many] = NAMES[l][group];
  return `${lead} ${lead === 1 ? one : many}`;
}

/** Superscript digits for plain text: 10⁶. */
const sup = (k: number) => [...String(k)].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]).join("");

/** The digits of a · 10^n as keyed display tokens, grouped in threes; every zero keeps its own key. */
function digitsSrc(a: number, n: number): string {
  const tokens: string[] = [];
  const total = n + 1;
  for (let pos = total - 1; pos >= 0; pos--) {
    const tok = pos === n ? `${a}#lead` : `0#z${pos}`;
    tokens.push(tok);
    if (pos > 0 && pos % 3 === 0 && total > 4) tokens.push("\\,");
  }
  return tokens.join(" ");
}

/** Pick a digit and an exponent; watch the zeros and the name of the number. */
export function TenPowers() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [a, setA] = useState(3);
  const [n, setN] = useState(6);
  const [round, setRound] = useState(0);
  const [ta, tn] = TARGETS[round % TARGETS.length];
  const solved = a === ta && n === tn;
  const zeros = tx(n === 1 ? "1 zero" : `${n} zeros`, n === 1 ? "1 Null" : `${n} Nullen`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <NumStepper label="a =" name={tx("the digit", "die Ziffer")} value={a} min={1} max={9} onChange={setA} />
        <NumStepper label="n =" name={tx("the exponent", "den Exponenten")} value={n} min={0} max={12} onChange={setN} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-surface px-4 py-6">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <MathView src={`${a}#a \\cdot#d 10#t^{${n}#e} =#eq`} size="lg" scope={`${scope}-p`} />
          <MathView src={digitsSrc(a, n)} size="lg" scope={`${scope}-d`} className="justify-center" />
          <div className="flex flex-wrap items-center justify-center gap-2 text-[14px]">
            <span className="rounded-full bg-blob-soft px-3 py-1 font-semibold text-blob-ink">{t(zeros)}</span>
            {n >= 3 && <span className="rounded-full border border-line px-3 py-1 font-medium text-ink">{bigName(a, n, locale)}</span>}
          </div>
        </div>
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {t(
          n === 0
            ? tx("10⁰ = 1: no factor 10 at all, so no zero.", "10⁰ = 1: gar kein Faktor 10, also keine Null.")
            : n === 1
              ? tx("10¹ = 10: one factor 10, one zero.", "10¹ = 10: ein Faktor 10, eine Null.")
              : tx(`10${sup(n)} is ${n} factors 10. Each factor 10 adds one zero.`, `10${sup(n)} sind ${n} Faktoren 10. Jeder Faktor 10 hängt eine Null an.`),
        )}
        {n >= 9 && n < 12 && ` ${t(tx("(In German, a billion is called Milliarde.)", "(Im Englischen heißt die Milliarde „billion“.)"))}`}
        {n === 12 && ` ${t(tx("(In German this is a Billion: careful, that's not a billion!)", "(Im Englischen heißt das „trillion“.)"))}`}
      </p>

      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors", solved ? "border-ok/50 bg-ok/10" : "border-line")}>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Your turn: build this number", "Du bist dran: Bau diese Zahl"))}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <MathView src={digitsSrc(ta, tn).replace(/#[A-Za-z0-9_-]+/g, "")} size="md" animate={false} />
            <span className="text-[13.5px] text-ink-2">({bigName(ta, tn, locale)})</span>
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {solved ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ok">
                <Check className="size-4" strokeWidth={2.5} /> {t(tx("Got it!", "Geschafft!"))}
              </span>
              <button onClick={() => setRound((r) => r + 1)} className="flex h-9 items-center gap-1.5 rounded-lg bg-blob px-3 text-[13px] font-semibold text-white hover:bg-blob-deep active:scale-[0.97]">
                <RotateCw className="size-3.5" /> {t(tx("Next number", "Nächste Zahl"))}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="skip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRound((r) => r + 1)}
              className="h-9 rounded-lg px-3 text-[13px] font-medium text-ink-3 hover:bg-hover hover:text-ink"
            >
              {t(tx("Another one", "Andere Zahl"))}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
