"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { gcd } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { ANIONS, CATIONS, ionCe, part, salt, saltName, type Ion } from "../ionic-bonds-ions";

// Build a salt from ions: add cations and anions until the charges cancel. The formula
// builds itself live, and once it's neutral and in the smallest ratio Blob names the salt.

const CATS = ["Na", "K", "Mg", "Ca", "Al", "Fe3"];
const ANS = ["Cl", "O", "OH", "NO3", "SO4", "PO4"];
const MAX = 6;

export function IonicBondsBuilder() {
  const t = useText();
  const scope = useId();
  const [catId, setCatId] = useState("Mg");
  const [anId, setAnId] = useState("Cl");
  const [nCat, setNCat] = useState(1);
  const [nAn, setNAn] = useState(1);
  const c = CATIONS[catId];
  const a = ANIONS[anId];
  const plus = nCat * c.charge;
  const minus = nAn * -a.charge;
  const balanced = plus === minus;
  const reduced = balanced && gcd(nCat, nAn) === 1;
  const formula = part(c, nCat) + part(a, nAn);
  const goal = salt(catId, anId);
  const units = Math.max(plus, minus);

  const pick = (kind: "cat" | "an", id: string) => {
    if (kind === "cat") setCatId(id);
    else setAnId(id);
    setNCat(1);
    setNAn(1);
  };

  const status = balanced
    ? reduced
      ? t(tx("Neutral! The charges cancel exactly.", "Neutral! Die Ladungen gleichen sich genau aus."))
      : t(tx(`Neutral, but every number can be divided by ${gcd(nCat, nAn)}. Use the smallest ratio.`, `Neutral, aber alle Zahlen lassen sich durch ${gcd(nCat, nAn)} teilen. Nimm das kleinste Verhältnis.`))
    : plus > minus
      ? t(tx(`${plus - minus} positive charge${plus - minus === 1 ? "" : "s"} too many: add anions (or remove cations).`, `${plus - minus} positive Ladung${plus - minus === 1 ? "" : "en"} zu viel: Nimm Anionen dazu (oder Kationen weg).`))
      : t(tx(`${minus - plus} negative charge${minus - plus === 1 ? "" : "s"} too many: add cations (or remove anions).`, `${minus - plus} negative Ladung${minus - plus === 1 ? "" : "en"} zu viel: Nimm Kationen dazu (oder Anionen weg).`));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Picker label={t(tx("Cation", "Kation"))} ids={CATS} table={CATIONS} value={catId} onPick={(id) => pick("cat", id)} scope={`${scope}-c`} />
        <Picker label={t(tx("Anion", "Anion"))} ids={ANS} table={ANIONS} value={anId} onPick={(id) => pick("an", id)} scope={`${scope}-a`} />
      </div>

      <div className="rounded-xl border border-line bg-surface p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tray ion={c} n={nCat} setN={setNCat} tone="plus" label={t(tx("cations", "Kationen"))} />
          <Tray ion={a} n={nAn} setN={setNAn} tone="minus" label={t(tx("anions", "Anionen"))} />
        </div>

        {/* charge blocks: one per elementary charge, plus above minus */}
        <div className="mt-4 overflow-x-auto">
          <div className="inline-grid min-w-full gap-1" style={{ gridTemplateColumns: `4.5rem repeat(${Math.max(units, 1)}, minmax(18px, 26px))` }}>
            <span className="self-center text-[12px] font-semibold text-blob-ink">+{plus}</span>
            {Array.from({ length: Math.max(units, 1) }, (_, i) => (
              <Block key={`p${i}`} on={i < plus} tone="plus" />
            ))}
            <span className="self-center text-[12px] font-semibold text-ink-2">−{minus}</span>
            {Array.from({ length: Math.max(units, 1) }, (_, i) => (
              <Block key={`m${i}`} on={i < minus} tone="minus" />
            ))}
          </div>
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-colors", reduced ? "border-blob/40 bg-blob-soft/60" : "border-line")}>
        <div className={cn("flex items-center gap-2 transition-opacity", balanced ? "opacity-100" : "opacity-45")}>
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Formula", "Formel"))}</span>
          <MathView src={`\\ce{${formula}}`} size="lg" scope={`${scope}-f`} />
        </div>
        <AnimatePresence>
          {reduced && (
            <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
              <Check className="size-4 text-ok" /> {t(saltName(goal))}
            </motion.span>
          )}
        </AnimatePresence>
        <p className="basis-full text-[13.5px] text-ink-2">{status}</p>
      </div>
    </div>
  );
}

function Picker({ label, ids, table, value, onPick, scope }: { label: string; ids: string[]; table: Record<string, Ion>; value: string; onPick: (id: string) => void; scope: string }) {
  const t = useText();
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            aria-label={t(table[id].name)}
            className={cn("relative h-10 min-w-12 rounded-lg border px-2.5 transition-colors", id === value ? "border-transparent text-white" : "border-line text-ink hover:bg-hover")}
          >
            {id === value && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">
              <MathView src={ionCe(table[id])} size="sm" animate={false} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Tray({ ion, n, setN, tone, label }: { ion: Ion; n: number; setN: (n: number) => void; tone: "plus" | "minus"; label: string }) {
  const t = useText();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setN(Math.max(1, n - 1))} disabled={n <= 1} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx(`Fewer ${label}`, `Weniger ${label}`))}>
          <Minus className="size-3.5" />
        </button>
        <motion.span key={n} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-6 text-center font-math text-[19px] tabular-nums">
          {n}
        </motion.span>
        <button type="button" onClick={() => setN(Math.min(MAX, n + 1))} disabled={n >= MAX} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx(`More ${label}`, `Mehr ${label}`))}>
          <Plus className="size-3.5" />
        </button>
        <span className="ml-1 text-[13px] text-ink-3">{label}</span>
      </div>
      <div className="flex min-h-[46px] flex-wrap items-center gap-1.5">
        <AnimatePresence initial={false}>
          {Array.from({ length: n }, (_, i) => (
            <motion.span
              key={i}
              layout
              initial={{ opacity: 0, scale: 0.4, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className={cn(
                "grid h-10 min-w-10 place-items-center rounded-full px-2",
                tone === "plus" ? "bg-blob text-white" : "border border-line-2 bg-raised text-ink",
              )}
            >
              <MathView src={ionCe(ion)} size="sm" animate={false} />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Block({ on, tone }: { on: boolean; tone: "plus" | "minus" }) {
  return (
    <motion.span
      initial={false}
      animate={{ opacity: on ? 1 : 0.18, scale: on ? 1 : 0.8 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "grid h-6 place-items-center rounded-md text-[13px] font-bold",
        tone === "plus" ? "bg-blob text-white" : "bg-ink/80 text-paper",
        !on && "bg-line-2 text-transparent",
      )}
    >
      {tone === "plus" ? "+" : "−"}
    </motion.span>
  );
}
