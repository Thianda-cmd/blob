"use client";

import { motion } from "motion/react";
import { Minus, Plus, Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { divMono, gcfOf, isOne, mono, monoSrc, polySrc, type Mono } from "./mono";

type Example = { vars: string[]; terms: Mono[] };

const EXAMPLES: Example[] = [
  { vars: ["x", "y"], terms: [mono(6, 2, 1), mono(-9, 1, 2)] },
  { vars: ["a"], terms: [mono(12, 3), mono(18, 2), mono(-6, 1)] },
  { vars: ["x"], terms: [mono(8, 3), mono(-12, 2)] },
  { vars: ["a", "b"], terms: [mono(4, 1, 2), mono(10, 2, 1)] },
  { vars: ["x"], terms: [mono(-10, 2), mono(-15, 1)] },
];

function Stepper({ label, value, min, max, onChange, name }: { label: React.ReactNode; value: number; min: number; max: number; onChange: (n: number) => void; name: string }) {
  const t = useText();
  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-[3.25rem] text-[12.5px] font-medium text-ink-2">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        aria-label={t(tx(`Less ${name}`, `${name} kleiner`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center font-math text-[19px] tabular-nums">
        {value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-9 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        aria-label={t(tx(`More ${name}`, `${name} größer`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Build the factor in front yourself: a number, a sign and a power of each letter. The bracket follows live. */
export function FactorFinder() {
  const t = useText();
  const scope = useId();
  const [n, setN] = useState(0);
  const ex = EXAMPLES[n % EXAMPLES.length];
  const [num, setNum] = useState(1);
  const [neg, setNeg] = useState(false);
  const [pow, setPow] = useState<number[]>([0, 0]);
  const maxPow = ex.vars.map((_, i) => Math.max(...ex.terms.map((m) => m.e[i] ?? 0)));
  const maxNum = Math.max(...ex.terms.map((m) => Math.abs(m.c)));
  const F: Mono = { c: (neg ? -1 : 1) * num, e: ex.vars.map((_, i) => pow[i] ?? 0) };
  const q = ex.terms.map((m) => divMono(m, F));
  const badNum = ex.terms.filter((m) => m.c % F.c !== 0);
  const badPow = ex.terms.filter((m) => m.e.some((e, i) => e < (F.e[i] ?? 0)));
  const valid = !badNum.length && !badPow.length;
  const rest = valid ? gcfOf(q) : null;
  const trivial = num === 1 && F.e.every((e) => e === 0);
  const best = gcfOf(ex.terms);
  const allNegative = ex.terms.every((m) => m.c < 0);

  function next() {
    setN((v) => v + 1);
    setNum(1);
    setNeg(false);
    setPow([0, 0]);
  }

  // One term of the bracket: fine, or red when the factor doesn't fit.
  const termSrc = (m: Mono, i: number) => {
    const qi = q[i];
    const ok = Number.isInteger(qi.c) && qi.e.every((e) => e >= 0);
    const first = i === 0;
    if (ok) return isOne(qi) ? `${qi.c < 0 ? (first ? "-" : "- ") : first ? "" : "+ "}1` : monoSrc(qi, ex.vars, { first });
    const sign = qi.c < 0 ? (first ? "-" : "- ") : first ? "" : "+ ";
    const c = Math.abs(qi.c);
    const cs = Number.isInteger(c) ? (c === 1 && qi.e.some((e) => e !== 0) ? "" : String(c)) : `\\frac{${Math.abs(m.c)}}{${Math.abs(F.c)}}`;
    const letters = ex.vars.map((v, j) => (qi.e[j] === 0 ? "" : qi.e[j] === 1 ? v : `${v}^{${qi.e[j]}}`)).join("");
    return `${sign}\\red{${cs}${letters}}`;
  };

  const fSrc = trivial && !neg ? "1 \\cdot" : F.c === -1 && F.e.every((e) => e === 0) ? "-" : monoSrc(F, ex.vars, { first: true });
  const formula = `${fSrc} (${ex.terms.map(termSrc).join(" ")})`;

  let status: { tone: "info" | "bad" | "half" | "ok"; text: Text };
  if (!valid) {
    const m = badNum[0] ?? badPow[0];
    const ms = monoSrc(m, ex.vars, { first: true });
    const fs = monoSrc({ ...F, c: Math.abs(F.c) }, ex.vars, { first: true });
    status = badNum.length
      ? { tone: "bad", text: tx(`$${ms}$ can't be divided by $${Math.abs(F.c)}$ without a remainder. Pick a number that divides **every** coefficient.`, `$${ms}$ lässt sich nicht ohne Rest durch $${Math.abs(F.c)}$ teilen. Nimm eine Zahl, die **jeden** Koeffizienten teilt.`) }
      : { tone: "bad", text: tx(`$${ms}$ doesn't contain $${fs}$: a letter's power is too big. Take the **smallest** power that appears.`, `In $${ms}$ steckt $${fs}$ nicht drin: Ein Exponent ist zu groß. Nimm den **kleinsten** Exponenten, der vorkommt.`) };
  } else if (trivial) {
    status = { tone: "info", text: tx("Which number divides all coefficients? Which letters are in **every** term? Build the factor with the buttons.", "Welche Zahl teilt alle Koeffizienten? Welche Buchstaben stecken in **jedem** Term? Bau den Faktor mit den Knöpfen.") };
  } else if (rest && !isOne(rest)) {
    const rs = monoSrc(rest, ex.vars, { first: true });
    status = { tone: "half", text: tx(`That works! But the bracket still has a common factor: $${rs}$. Make the factor in front bigger.`, `Das klappt! Aber in der Klammer steckt noch ein gemeinsamer Faktor: $${rs}$. Mach den Faktor davor größer.`) };
  } else if (allNegative && !neg) {
    status = { tone: "half", text: tx("Greatest common factor found! Every term is negative, though: switch to $-$ and the bracket starts with a plus.", "Größter gemeinsamer Faktor gefunden! Alle Terme sind aber negativ: Schalte auf $-$, dann beginnt die Klammer mit Plus.") };
  } else {
    status = {
      tone: "ok",
      text: neg
        ? tx("Fully factored! You took out a minus as well, so every sign in the bracket flipped.", "Vollständig ausgeklammert! Du hast auch ein Minus ausgeklammert, darum hat sich jedes Vorzeichen in der Klammer umgedreht.")
        : tx(`Fully factored! $${monoSrc(best, ex.vars, { first: true })}$ is the greatest common factor: the bracket has no common factor left.`, `Vollständig ausgeklammert! $${monoSrc(best, ex.vars, { first: true })}$ ist der größte gemeinsame Faktor: In der Klammer steckt kein gemeinsamer Faktor mehr.`),
    };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2">
          <Inline text={tx("Build the factor in front of the bracket: a number, a sign and the letters. The bracket shows what's left of every term.", "Bau den Faktor vor der Klammer: eine Zahl, ein Vorzeichen und die Buchstaben. Die Klammer zeigt, was von jedem Term übrig bleibt.")} />
        </p>
        <button onClick={next} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("Another term", "Anderer Term"))}
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-surface px-4 py-5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <MathView src={polySrc(ex.terms, ex.vars)} size="lg" animate={false} />
          <span className="font-math text-[22px] text-ink-3">=</span>
          <MathView src={formula} size="lg" scope={`${scope}-${n}`} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="min-w-[3.25rem] text-[12.5px] font-medium text-ink-2">{t(tx("Sign", "Vorzeichen"))}</span>
          <div className="flex rounded-lg border border-line p-0.5">
            {[false, true].map((on) => (
              <button
                key={String(on)}
                onClick={() => setNeg(on)}
                aria-pressed={neg === on}
                aria-label={on ? t(tx("Negative factor", "Negativer Faktor")) : t(tx("Positive factor", "Positiver Faktor"))}
                className={cn("relative h-8 w-10 rounded-md text-[18px] font-semibold", neg === on ? "text-white" : "text-ink-2 hover:text-ink")}
              >
                {neg === on && <motion.span layoutId={`${scope}-sign`} className="absolute inset-0 rounded-md bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
                <span className="relative">{on ? "−" : "+"}</span>
              </button>
            ))}
          </div>
        </div>
        <Stepper label={t(tx("Number", "Zahl"))} name={t(tx("number", "Zahl"))} value={num} min={1} max={maxNum} onChange={setNum} />
        {ex.vars.map((v, i) => (
          <Stepper
            key={`${n}-${v}`}
            label={<MathView src={`${v}^{n}`} size="sm" animate={false} />}
            name={t(tx(`power of ${v}`, `Exponent von ${v}`))}
            value={pow[i] ?? 0}
            min={0}
            max={maxPow[i]}
            onChange={(k) => setPow((p) => ex.vars.map((_, j) => (j === i ? k : (p[j] ?? 0))))}
          />
        ))}
      </div>

      <div
        aria-live="polite"
        className={cn(
          "rounded-xl px-4 py-3 text-[14px] leading-relaxed",
          status.tone === "ok" && "bg-ok/10 text-ink",
          status.tone === "bad" && "bg-danger/10 text-ink",
          status.tone === "half" && "bg-blob-soft text-ink",
          status.tone === "info" && "bg-hover text-ink-2",
        )}
      >
        <Inline text={status.text} />
      </div>
    </div>
  );
}
