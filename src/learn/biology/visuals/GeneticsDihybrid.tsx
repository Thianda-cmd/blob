"use client";

import { motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { Geno, PeaSeed } from "./GeneticsPea";

/** Seed colour G (yellow) / g (green), seed shape R (round) / r (wrinkled). */
type Cls = "YR" | "Yr" | "yR" | "yr";

const CLASSES: { id: Cls; label: Text; colour: "yellow" | "green"; shape: "round" | "wrinkled" }[] = [
  { id: "YR", label: tx("yellow, round", "gelb, rund"), colour: "yellow", shape: "round" },
  { id: "Yr", label: tx("yellow, wrinkled", "gelb, runzlig"), colour: "yellow", shape: "wrinkled" },
  { id: "yR", label: tx("green, round", "grün, rund"), colour: "green", shape: "round" },
  { id: "yr", label: tx("green, wrinkled", "grün, runzlig"), colour: "green", shape: "wrinkled" },
];

/** "GgRr" from two gametes like "Gr" and "gR". */
function combine(a: string, b: string) {
  const pair = (x: string, y: string) => (x === x.toUpperCase() ? x + y : y + x);
  return pair(a[0], b[0]) + pair(a[1], b[1]);
}
const classOf = (g: string): Cls => `${g.includes("G") ? "Y" : "y"}${g.includes("R") ? "R" : "r"}` as Cls;

/**
 * The dihybrid cross (3rd law): F1 × F1 in a 4 × 4 square, or the test cross with ggrr.
 * Tap a phenotype to light up its cells.
 */
export function GeneticsDihybrid() {
  const t = useText();
  const scope = useId();
  const [test, setTest] = useState(false);
  const [lit, setLit] = useState<Cls | null>(null);
  const top = ["GR", "Gr", "gR", "gr"];
  const side = test ? ["gr"] : ["GR", "Gr", "gR", "gr"];
  const cells = side.flatMap((s) => top.map((c) => combine(c, s)));
  const counts = CLASSES.map((c) => cells.filter((g) => classOf(g) === c.id).length);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {[false, true].map((on) => (
            <button key={String(on)} type="button" onClick={() => setTest(on)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", test === on ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {test === on && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{on ? t(tx("Test cross × ggrr", "Rückkreuzung × ggrr")) : t(tx("F1 × F1", "F1 × F1"))}</span>
            </button>
          ))}
        </div>
        <span className="text-[17px] text-ink-2">
          <Geno g="GgRr" /> <span className="font-math text-ink-3">×</span> <Geno g={test ? "ggrr" : "GgRr"} />
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto grid min-w-[300px] max-w-[520px] gap-1" style={{ gridTemplateColumns: `40px repeat(4, minmax(0, 1fr))` }}>
          <div className="grid place-items-center text-[12px] text-ink-3" aria-hidden>
            ♂ / ♀
          </div>
          {top.map((g) => (
            <div key={g} className="grid place-items-center py-1">
              <span className="rounded-full border-2 border-blob/60 bg-blob-soft px-2 py-0.5 text-[15px] text-ink">
                <Geno g={g} />
              </span>
            </div>
          ))}
          {side.map((s, ri) => (
            <div key={`${test}${ri}`} className="contents">
              <div className="grid place-items-center">
                <span className="rounded-full border-2 border-blob/60 bg-blob-soft px-1.5 py-0.5 text-[14px] text-ink">
                  <Geno g={s} />
                </span>
              </div>
              {top.map((c, ci) => {
                const g = combine(c, s);
                const cls = CLASSES.find((x) => x.id === classOf(g))!;
                const on = !lit || lit === cls.id;
                return (
                  <motion.div
                    key={`${test}${ri}${ci}`}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: on ? 1 : 0.25 }}
                    transition={{ type: "spring", stiffness: 300, damping: 26, delay: lit ? 0 : (ri * 4 + ci) * 0.025 }}
                    className={cn("flex flex-col items-center justify-center gap-0.5 rounded-lg border py-1.5", lit === cls.id ? "border-blob bg-blob-soft" : "border-line bg-raised")}
                  >
                    <svg viewBox="0 0 30 30" className="size-6 sm:size-7" aria-hidden>
                      <PeaSeed cx={15} cy={15} r={11} colour={cls.colour} shape={cls.shape} />
                    </svg>
                    <span className="text-[12px] text-ink-2 sm:text-[13px]">
                      <Geno g={g} />
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t(tx("Phenotypes", "Phänotypen"))}>
        {CLASSES.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setLit(lit === c.id ? null : c.id)}
            aria-pressed={lit === c.id}
            className={cn("flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[13.5px] transition-colors", lit === c.id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover")}
          >
            <svg viewBox="0 0 30 30" className="size-5" aria-hidden>
              <PeaSeed cx={15} cy={15} r={11} colour={c.colour} shape={c.shape} />
            </svg>
            <span className="font-math text-[17px] tabular-nums text-ink">{counts[i]}</span>
            {t(c.label)}
          </button>
        ))}
      </div>
      <motion.p key={`${test}${lit}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-blob-soft px-3 py-2 text-[13.5px] leading-snug text-ink">
        <Inline
          text={
            test
              ? tx(
                  "The test cross gives all four phenotypes **1 : 1 : 1 : 1**. The double heterozygous plant makes four kinds of gametes in equal numbers.",
                  "Die Rückkreuzung ergibt alle vier Phänotypen im Verhältnis **1 : 1 : 1 : 1**. Die doppelt mischerbige Pflanze bildet vier Sorten Keimzellen in gleicher Zahl.",
                )
              : lit === "Yr" || lit === "yR"
                ? tx(
                    "These seeds didn't exist in the P generation (yellow-round × green-wrinkled): **new combinations**! Each trait is inherited on its own.",
                    "Diese Samen gab es in der P-Generation (gelb-rund × grün-runzlig) nicht: **Neukombinationen**! Jedes Merkmal wird für sich vererbt.",
                  )
                : lit === "yr"
                  ? tx("Only 1 of 16 cells: green and wrinkled needs $gg$ **and** $rr$. $\\frac{1}{4} \\cdot \\frac{1}{4} = \\frac{1}{16}$.", "Nur 1 von 16 Feldern: grün und runzlig braucht $gg$ **und** $rr$. $\\frac{1}{4} \\cdot \\frac{1}{4} = \\frac{1}{16}$.")
                  : tx(
                      "**Independence rule** (3rd law): the F2 splits **9 : 3 : 3 : 1**. Tap a phenotype to find its cells.",
                      "**Unabhängigkeitsregel** (3. Mendelsche Regel): Die F2 spaltet **9 : 3 : 3 : 1** auf. Tipp auf einen Phänotyp, um seine Felder zu finden.",
                    )
          }
        />
      </motion.p>
    </div>
  );
}
