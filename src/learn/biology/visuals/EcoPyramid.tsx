"use client";

// The energy pyramid: each trophic level passes on only about 10 % of its energy; the rest is
// released as heat by cellular respiration or ends up in droppings and uneaten remains. The
// widget lets students fill the pyramid level by level; the picture shows one for tasks.

import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

const fmt = (v: number, locale: Locale) => new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(v);

/** "10.000", "10 000", "1,5" → number (German or English writing). */
export function readAmount(s: string): number | null {
  let x = s.trim().replace(/\s+/g, "").replace(/kj$/i, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(x)) x = x.replace(/\./g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(x)) x = x.replace(/,/g, "");
  x = x.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(x)) return null;
  return Number(x);
}

export const LEVEL_NAMES: Text[] = [
  tx("producers", "Produzenten"),
  tx("primary consumers", "Konsumenten 1. Ordnung"),
  tx("secondary consumers", "Konsumenten 2. Ordnung"),
  tx("tertiary consumers", "Konsumenten 3. Ordnung"),
];

const LEVEL_FILL = ["var(--bio-leaf)", "var(--bio-nucleus)", "var(--bio-mito)", "var(--bio-petal)"];
const LEVEL_STROKE = ["var(--bio-leaf-deep)", "var(--bio-nucleus-deep)", "var(--bio-mito-deep)", "var(--bio-petal-deep)"];
const WIDTHS = [100, 76, 54, 34];

function Bar({ level, name, children, lit }: { level: number; name: Text; children: ReactNode; lit?: boolean }) {
  const t = useText();
  return (
    <motion.div
      layout
      className={cn("mx-auto flex min-h-[54px] flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-center", lit && "ring-2 ring-[var(--blob)] ring-offset-2 ring-offset-[var(--surface)]")}
      style={{ width: `${WIDTHS[level]}%`, minWidth: 128, background: LEVEL_FILL[level], borderColor: LEVEL_STROKE[level] }}
    >
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink/70">{t(LEVEL_NAMES[level])}</span>
      <span className="text-[13.5px] font-semibold leading-tight text-ink">{t(name)}</span>
      {children}
    </motion.div>
  );
}

/** A finished (or partly hidden) energy pyramid for tasks. `levels` from the producers up; value null = "?". */
export function EcoPyramidPicture({ levels, unit = "kJ" }: { levels: { name: Text; value: number | null }[]; unit?: string }) {
  const locale = useLocale();
  return (
    <div className="mx-auto flex max-w-[460px] flex-col-reverse gap-1.5 py-1">
      {levels.map((l, i) => (
        <Bar key={i} level={i} name={l.name}>
          <span className="font-math text-[16px] tabular-nums text-ink">{l.value === null ? "?" : `${fmt(l.value, locale)} ${unit}`}</span>
        </Bar>
      ))}
    </div>
  );
}

type Scenario = { id: string; label: Text; names: Text[]; start: number };
const SCENARIOS: Scenario[] = [
  { id: "meadow", label: tx("Meadow", "Wiese"), names: [tx("grass", "Gras"), tx("grasshopper", "Heuschrecke"), tx("common frog", "Grasfrosch"), tx("white stork", "Weißstorch")], start: 10000 },
  { id: "lake", label: tx("Lake", "See"), names: [tx("algae", "Algen"), tx("water flea", "Wasserfloh"), tx("roach", "Rotauge"), tx("pike", "Hecht")], start: 50000 },
  { id: "forest", label: tx("Forest", "Wald"), names: [tx("oak leaves", "Eichenblätter"), tx("caterpillar", "Raupe"), tx("great tit", "Kohlmeise"), tx("sparrowhawk", "Sperber")], start: 20000 },
];

export function EcoPyramidFill() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [sid, setSid] = useState("meadow");
  const [filled, setFilled] = useState(1);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<Text | null>(null);
  const sc = SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0];
  const values = sc.names.map((_, i) => sc.start / 10 ** i);
  const done = filled >= 4;

  const reset = (id = sid) => {
    setSid(id);
    setFilled(1);
    setInput("");
    setNote(null);
  };

  const submit = () => {
    const v = readAmount(input);
    const prev = values[filled - 1];
    const want = values[filled];
    if (v === null) return setNote(tx("Type a number in kJ.", "Gib eine Zahl in kJ ein."));
    if (Math.abs(v - want) < 1e-6) {
      setFilled(filled + 1);
      setInput("");
      setNote(null);
      return;
    }
    if (Math.abs(v - prev * 0.9) < 1e-6)
      return setNote(tx("You took away 10 %. It's the other way round: only about 10 % is passed on, about 90 % is lost.", "Du hast 10 % abgezogen. Es ist umgekehrt: Nur etwa 10 % werden weitergegeben, rund 90 % gehen verloren."));
    if (v >= prev) return setNote(tx("Going up the pyramid there is always less energy, never more or the same.", "Nach oben wird die Energie immer weniger, nie mehr oder gleich viel."));
    if (Math.abs(v - want / 10) < 1e-6) return setNote(tx("One step too far: take 10 % of the level directly below.", "Einen Schritt zu weit: Nimm 10 % der Stufe direkt darunter."));
    setNote(tx("Take 10 % of the level below, so divide by 10.", "Nimm 10 % der Stufe darunter, also durch 10 teilen."));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => reset(s.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors", s.id === sid ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {s.id === sid && <motion.span layoutId={`${scope}-sc`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(s.label)}</span>
          </button>
        ))}
        <button type="button" onClick={() => reset()} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-4" /> {t(tx("Start again", "Von vorn"))}
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="flex flex-col-reverse gap-1.5">
          {sc.names.map((name, i) => (
            <Bar key={`${sid}-${i}`} level={i} name={name} lit={i === filled && !done}>
              {i < filled ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-math text-[16px] tabular-nums text-ink">
                  {fmt(values[i], locale)} kJ
                </motion.span>
              ) : i === filled ? (
                <form
                  className="mt-0.5 flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    inputMode="decimal"
                    aria-label={t(tx(`Energy of the ${["", "primary", "secondary", "tertiary"][i]} consumers in kJ`, `Energie der Konsumenten ${i}. Ordnung in kJ`))}
                    placeholder="?"
                    className="h-8 w-[84px] rounded-md border border-line bg-raised px-2 text-center font-math text-[15px] text-ink outline-none focus:border-[var(--blob)]"
                  />
                  <span className="text-[13px] text-ink-2">kJ</span>
                  <button type="submit" aria-label={t(tx("Check this level", "Stufe prüfen"))} className="grid size-8 place-items-center rounded-md bg-blob text-white">
                    <Check className="size-4" />
                  </button>
                </form>
              ) : (
                <span className="font-math text-[16px] text-ink/60">?</span>
              )}
            </Bar>
          ))}
        </div>
        <div className="flex flex-col-reverse justify-around gap-1.5 text-[12.5px] leading-snug text-ink-2">
          {[0, 1, 2].map((i) => (
            <AnimatePresence key={i}>
              {i < filled - 1 || (done && i < 3) ? (
                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-1.5">
                  <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden className="shrink-0">
                    <path d="M3 24 C 3 12, 10 8, 18 6" fill="none" stroke="var(--bio-blood)" strokeWidth="2.2" strokeLinecap="round" />
                    <polygon points="21,5 13,3 16,10" fill="var(--bio-blood)" />
                  </svg>
                  <span>
                    <span className="font-semibold text-ink">−{fmt(values[i] * 0.9, locale)} kJ</span>
                    <br />
                    {t(tx("heat, droppings, remains", "Wärme, Kot, Reste"))}
                  </span>
                </motion.div>
              ) : (
                <div className="min-h-[2.5rem]" />
              )}
            </AnimatePresence>
          ))}
          <div className="hidden sm:block" />
        </div>
      </div>

      <motion.p
        key={done ? "done" : note ? `n${filled}-${t(note).length}` : `h${filled}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        aria-live="polite"
        className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", done ? "bg-blob-soft/70 text-ink" : note ? "border border-line bg-surface text-ink" : "bg-surface text-ink-2")}
      >
        {done
          ? t(
              tx(
                `Of ${fmt(values[0], "en")} kJ only ${fmt(values[3], "en")} kJ reach the top: 0.1 %. That's why there are so few top predators and food chains rarely have more than 4 or 5 links.`,
                `Von ${fmt(values[0], "de")} kJ kommen oben nur ${fmt(values[3], "de")} kJ an: 0,1 %. Deshalb gibt es so wenige Endkonsumenten, und Nahrungsketten haben selten mehr als 4 oder 5 Glieder.`,
              ),
            )
          : note
            ? t(note)
            : t(tx(`How much energy reaches the next level? Use the 10 % rule.`, `Wie viel Energie kommt auf der nächsten Stufe an? Nutze die 10-%-Regel.`))}
      </motion.p>
    </div>
  );
}
