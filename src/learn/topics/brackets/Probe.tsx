"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, Shuffle, X } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { insertedSrc, lg, lt, num, show, src, valueAt, type LN } from "./long";

type Claim = { name: string; result: LN[] };
type Example = { start: LN[]; claims: Claim[] };

/** Three students, one right result and two typical wrong ones that pass with the "wrong" test number. */
const EXAMPLES: Example[] = [
  {
    start: [lt("a", 4, "x"), lg("g", -2, [lt("b", 3, "x"), lt("c", -5)])],
    claims: [
      { name: "Mia", result: [lt("p", 10, "x"), lt("q", 10)] },
      { name: "Ali", result: [lt("p", -2, "x"), lt("q", 10)] },
      { name: "Ben", result: [lt("p", 8, "x")] },
    ],
  },
  {
    start: [lt("a", 7), lg("g", -2, [lt("b", 1, "x"), lt("c", 3)])],
    claims: [
      { name: "Lea", result: [lt("p", 5, "x"), lt("q", 15)] },
      { name: "Tom", result: [lt("q", 1), lt("p", 2, "x")] },
      { name: "Emma", result: [lt("q", 1), lt("p", -2, "x")] },
    ],
  },
  {
    start: [lg("o", 3, [lt("a", 2, "x"), lg("i", -1, [lt("b", 1, "x"), lt("c", -4)])], "[")],
    claims: [
      { name: "Finn", result: [lt("p", 3, "x"), lt("q", 12)] },
      { name: "Noah", result: [lt("p", 9, "x"), lt("q", 12)] },
      { name: "Anna", result: [lt("p", 15, "x")] },
    ],
  },
];

const MIN = -3;
const MAX = 5;

/** The check by inserting a number (Einsetzprobe): who simplified the term correctly? */
export function InsertCheck() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [n, setN] = useState(0);
  const [x, setX] = useState(0);
  const ex = EXAMPLES[n % EXAMPLES.length];
  const target = valueAt(ex.start, { x });
  const pass = ex.claims.map((c) => valueAt(c.result, { x }) === target);
  const passing = ex.claims.filter((_, i) => pass[i]);

  const message =
    passing.length > 1
      ? tx(
          `With $x = ${num(x, "en")}$, ${passing.length} results give the same value. That doesn't settle it: try another number!`,
          `Mit $x = ${num(x, "de")}$ ergeben ${passing.length} Ergebnisse denselben Wert. Das entscheidet noch nichts: Probier eine andere Zahl!`,
        )
      : passing.length === 1
        ? tx(
            `With $x = ${num(x, "en")}$ only ${passing[0].name}'s result gives the same value. A different value proves a mistake, so the other two are wrong.`,
            `Mit $x = ${num(x, "de")}$ ergibt nur das Ergebnis von ${passing[0].name} denselben Wert. Ein anderer Wert beweist einen Fehler, die anderen beiden sind also falsch.`,
          )
        : tx("No result gives the same value here.", "Hier ergibt kein Ergebnis denselben Wert.");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={tx(
              "Three classmates simplified the same term. Insert a number for $x$ into the term and into each result. Whose result always gives the same value?",
              "Drei aus der Klasse haben denselben Term vereinfacht. Setz eine Zahl für $x$ in den Term und in jedes Ergebnis ein. Wessen Ergebnis liefert immer denselben Wert?",
            )}
          />
        </p>
        <button
          onClick={() => {
            setN((v) => v + 1);
            setX(0);
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Shuffle className="size-3.5" /> {t(tx("Another term", "Anderer Term"))}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <button onClick={() => setX((v) => Math.max(MIN, v - 1))} className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Smaller x", "x kleiner"))}>
          <Minus className="size-4" />
        </button>
        <motion.span key={x} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-20 text-center font-math text-[22px] tabular-nums">
          x = {num(x, locale)}
        </motion.span>
        <button onClick={() => setX((v) => Math.min(MAX, v + 1))} className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Bigger x", "x größer"))}>
          <Plus className="size-4" />
        </button>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          aria-label={t(tx("Value of x", "Wert von x"))}
          className="min-w-[140px] flex-1 accent-[var(--blob)]"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-blob-soft px-4 py-3">
          <span className="w-full text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3 sm:w-24">{t(tx("Term", "Term"))}</span>
          <MathView src={show(ex.start, false)} size="md" animate={false} />
          <span className="text-ink-3">→</span>
          <MathView src={`${insertedSrc(ex.start, { x }, locale)} = ${num(target, locale)}`} size="md" scope={`${scope}-s${n}`} />
        </div>
        {ex.claims.map((c, i) => (
          <div key={`${n}-${c.name}`} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 transition-colors", pass[i] ? "border-line" : "border-danger/40")}>
            <span className="w-full text-[13px] font-semibold text-ink-2 sm:w-24">{c.name}</span>
            <MathView src={src(c.result, locale, false)} size="md" animate={false} />
            <span className="text-ink-3">→</span>
            <MathView src={`${insertedSrc(c.result, { x }, locale)} = ${num(valueAt(c.result, { x }), locale)}`} size="md" scope={`${scope}-c${n}${i}`} />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={pass[i] ? "ok" : "no"}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className={cn("ml-auto grid size-7 place-items-center rounded-full", pass[i] ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}
                aria-label={pass[i] ? t(tx("same value", "gleicher Wert")) : t(tx("different value", "anderer Wert"))}
              >
                {pass[i] ? <Check className="size-4" /> : <X className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </div>
        ))}
      </div>

      <p aria-live="polite" className="text-[13.5px] leading-relaxed text-ink-2">
        <Inline text={message} />
      </p>
      <p className="text-[12.5px] text-ink-3">{t(tx("Tip: good test numbers are not 0 and not 1. Those two let mistakes slip through too easily.", "Tipp: Gute Testzahlen sind nicht 0 und nicht 1. Bei diesen beiden rutschen Fehler zu leicht durch."))}</p>
    </div>
  );
}
