"use client";

import { motion } from "motion/react";
import { Check, RotateCcw, Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Rich } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { cat, changedKeys, combineLike, combineNote, doneNote, groupsIn, innermost, join, lg, lt, messyGroup, num, show, sortLike, src, termsOf, tidyInside, resolve, valueAt, type LN } from "./long";

/** Long terms to work through: several brackets, factors, nesting, two variables, decimals. */
const EXAMPLES: LN[][] = [
  [lt("a", 4, "x"), lg("g", -2, [lt("b", 3, "x"), lt("c", -5)]), lg("h", 1, [lt("d", 1, "x"), lt("e", -1)])],
  [lg("o", 3, [lt("a", 2, "x"), lg("i", -1, [lt("b", 1, "x"), lt("c", -4)])], "[")],
  [lg("g", 2, [lt("a", 1, "a"), lt("b", -3, "b")]), lg("h", -3, [lt("c", 1, "a"), lt("d", -2, "b")]), lt("e", 4, "a")],
  [lt("k", 5), lg("o", -2, [lt("a", 3, "y"), lg("i", -1, [lt("b", 1, "y"), lt("c", 4)])], "[")],
  [lg("g", 0.5, [lt("a", 4, "x"), lt("b", -6)]), lg("h", -1.5, [lt("c", 2, "x"), lt("d", -4)])],
];

/** Test values for the check at the end. */
const TEST = { x: 2, y: 2, a: 2, b: 3 };

type State = { n: number; cur: LN[]; note: Text | null; hl: string[]; done: boolean };

const start = (n: number): State => ({ n, cur: EXAMPLES[n % EXAMPLES.length], note: null, hl: [], done: false });

/** Work through a long term yourself: pick a bracket, multiply it out, tidy up, combine. */
export function BracketStepper() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [s, setS] = useState<State>(() => start(0));
  const base = EXAMPLES[s.n % EXAMPLES.length];
  const open = innermost(s.cur);
  const nested = groupsIn(s.cur).length > open.length;
  const messy = messyGroup(s.cur);
  const list = termsOf(s.cur);
  const canCombine = open.length === 0 && !s.done;

  function multiply(gid: string) {
    const g = open.find((x) => x.id === gid);
    if (!g) return;
    setS((p) => ({ ...p, cur: resolve(p.cur, gid), hl: changedKeys(p.cur, gid), note: doneNote(g) }));
  }

  function tidy() {
    if (!messy) return;
    setS((p) => ({ ...p, cur: tidyInside(p.cur), hl: [], note: cat(join(tx("Inside the bracket:", "In der Klammer:"), combineNote(termsOf(messy.items))), ".") }));
  }

  function combine() {
    const sorted = sortLike(list);
    const result = combineLike(sorted);
    const note = result.length < sorted.length ? cat(combineNote(sorted), ".") : tx("Nothing left to combine.", "Hier gibt es nichts mehr zusammenzufassen.");
    setS((p) => ({ ...p, cur: result, hl: [], note, done: true }));
  }

  const env = TEST;
  const vars = [...new Set([...termsOf(base), ...groupsIn(base).flatMap((g) => termsOf(g.items))].map((x) => x.v).filter(Boolean))];
  const testText = vars.map((v) => `${v} = ${env[v as keyof typeof env]}`).join(", ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full min-w-0 text-[13.5px] leading-relaxed text-ink-2 sm:w-auto sm:flex-1">
          {t(tx("Tap a bracket to multiply it out. Inner brackets first, then combine like terms.", "Tippe auf eine Klammer, um sie aufzulösen. Innere Klammern zuerst, dann gleichartige Terme zusammenfassen."))}
        </p>
        <button onClick={() => setS(start(s.n))} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-3.5" /> {t(tx("Start over", "Von vorn"))}
        </button>
        <button onClick={() => setS(start(s.n + 1))} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another term", "Anderer Term"))}
        </button>
      </div>

      <div className="relative grid min-h-[120px] place-items-center overflow-x-auto rounded-xl border border-line bg-surface px-4 py-6">
        <MathView src={show(s.cur)} size="lg" highlight={s.hl} scope={`${scope}-${s.n}`} />
      </div>

      <div aria-live="polite" className="min-h-[48px] rounded-xl bg-blob-soft/60 px-4 py-3 text-[14px] leading-relaxed text-ink">
        {s.note ? (
          <Rich text={s.note} />
        ) : (
          <span className="text-ink-2">
            {t(tx("Start with a bracket below. The factor in front, with its sign, multiplies every term inside.", "Fang unten mit einer Klammer an. Der Faktor davor wird samt Vorzeichen mit jedem Term darin multipliziert."))}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {open.map((g) => (
          <motion.button
            key={g.id}
            layout
            onClick={() => multiply(g.id)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-raised px-3 py-1.5 text-ink shadow-card hover:border-blob hover:bg-hover"
            aria-label={t(tx(`Multiply out ${src([g], locale, false)}`, `${src([g], locale, false)} auflösen`))}
          >
            <MathView src={show([g], false)} size="md" animate={false} />
          </motion.button>
        ))}
        {messy && (
          <button onClick={tidy} className="min-h-11 rounded-xl border border-line px-3 text-[13.5px] font-medium text-ink hover:bg-hover">
            {t(tx("Tidy up inside the bracket", "In der Klammer zusammenfassen"))}
          </button>
        )}
        {(canCombine || s.done) && (
          <button
            onClick={combine}
            disabled={s.done}
            className={cn("min-h-11 rounded-xl px-4 text-[13.5px] font-semibold", s.done ? "bg-hover text-ink-3" : "bg-blob text-white hover:opacity-90")}
          >
            {t(tx("Combine like terms", "Gleichartige Terme zusammenfassen"))}
          </button>
        )}
        {nested && <span className="text-[12.5px] text-ink-3">{t(tx("The outer bracket comes after the inner one.", "Die äußere Klammer kommt nach der inneren dran."))}</span>}
      </div>

      {s.done && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line px-4 py-3 text-[13.5px] text-ink-2">
          <Check className="size-4 shrink-0 text-ok" />
          <span>{t(tx(`Check with ${testText}:`, `Probe mit ${testText}:`))}</span>
          <MathView src={`${src(base, locale, false)} = ${num(valueAt(base, env), locale)}`} size="sm" animate={false} />
          <span className="text-ink-3">{t(tx("and", "und"))}</span>
          <MathView src={`${src(s.cur, locale, false)} = ${num(valueAt(s.cur, env), locale)}`} size="sm" animate={false} />
          <span>{t(tx("Same value!", "Gleicher Wert!"))}</span>
        </motion.div>
      )}
    </div>
  );
}
