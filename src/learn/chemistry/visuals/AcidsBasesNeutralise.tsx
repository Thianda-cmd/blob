"use client";

import { AnimatePresence, motion } from "motion/react";
import { Droplet, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { shade } from "../acids-bases-data";
import { liquid } from "./AcidsBasesPh";

// Neutralisation drop by drop: hydrochloric acid with bromothymol blue, and every drop of
// sodium hydroxide solution brings one OH⁻ that meets one H₃O⁺. Yellow, green, blue.

const ACID = 5;
const MAX = 9;

type Chip = { id: string; label: string; kind: "h3o" | "oh" | "spectator" | "water" };

function chips(drops: number): Chip[] {
  const used = Math.min(drops, ACID);
  const out: Chip[] = [];
  for (let i = used; i < ACID; i++) out.push({ id: `h${i}`, label: "H₃O⁺", kind: "h3o" });
  for (let i = ACID; i < drops; i++) out.push({ id: `o${i}`, label: "OH⁻", kind: "oh" });
  for (let i = 0; i < ACID; i++) out.push({ id: `c${i}`, label: "Cl⁻", kind: "spectator" });
  for (let i = 0; i < drops; i++) out.push({ id: `n${i}`, label: "Na⁺", kind: "spectator" });
  for (let i = 0; i < used * 2; i++) out.push({ id: `w${i}`, label: "H₂O", kind: "water" });
  return out;
}

const CHIP: Record<Chip["kind"], string> = {
  h3o: "bg-blob text-white",
  oh: "border-2 border-blob bg-raised text-blob-ink",
  spectator: "border border-line bg-raised/90 text-ink-2",
  water: "bg-raised/55 text-ink-2",
};

export function AcidsBasesNeutralise() {
  const t = useText();
  const [drops, setDrops] = useState(0);
  const left = Math.max(0, ACID - drops);
  const free = Math.max(0, drops - ACID);
  const state = left > 0 ? "acidic" : free > 0 ? "alkaline" : "neutral";
  const colour = shade("bromothymol", state === "acidic" ? 3 : state === "neutral" ? 7 : 11);

  const status: Record<typeof state, Text> = {
    acidic: tx(
      `Still **${left}** oxonium ion${left === 1 ? "" : "s"} left: the solution is acidic, bromothymol blue is **yellow**.`,
      `Noch **${left}** Oxonium-Ion${left === 1 ? "" : "en"} übrig: Die Lösung ist sauer, Bromthymolblau ist **gelb**.`,
    ),
    neutral: tx(
      "Exactly neutralised! Every $\\ce{H3O+}$ has met an $\\ce{OH-}$. What's left is a solution of sodium chloride: salt water. The indicator is **green**.",
      "Genau neutralisiert! Jedes $\\ce{H3O+}$ hat ein $\\ce{OH-}$ getroffen. Übrig ist eine Natriumchlorid-Lösung: Salzwasser. Der Indikator ist **grün**.",
    ),
    alkaline: tx(
      `One drop too many: now **${free}** hydroxide ion${free === 1 ? " finds" : "s find"} no partner. The solution is alkaline, the indicator turns **blue**.`,
      `Ein Tropfen zu viel: Jetzt ${free === 1 ? "findet" : "finden"} **${free}** Hydroxid-Ion${free === 1 ? "" : "en"} keinen Partner mehr. Die Lösung ist alkalisch, der Indikator wird **blau**.`,
    ),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <div className="relative">
          {/* the falling drop */}
          <AnimatePresence>
            {drops > 0 && (
              <motion.div
                key={drops}
                initial={{ y: -10, opacity: 1 }}
                animate={{ y: 26, opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeIn" }}
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
              >
                <Droplet className="size-5 fill-blob text-blob" />
              </motion.div>
            )}
          </AnimatePresence>
          <div
            className="mt-5 min-h-[190px] rounded-b-[28px] rounded-t-md border-2 border-t-0 border-ink-3/60 p-3 transition-colors duration-500"
            style={{ background: liquid(colour.hex) }}
            role="img"
            aria-label={t(tx("Beaker with hydrochloric acid and bromothymol blue", "Becherglas mit Salzsäure und Bromthymolblau"))}
          >
            <motion.div layout className="flex flex-wrap content-start gap-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {chips(drops).map((c) => (
                  <motion.span
                    key={c.id}
                    layout
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className={cn("rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums", CHIP[c.kind])}
                  >
                    {c.label}
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 self-start md:grid-cols-1">
          {[
            { label: "H₃O⁺", value: left, strong: true },
            { label: "OH⁻", value: free, strong: true },
            { label: t(tx("H₂O formed", "H₂O gebildet")), value: Math.min(drops, ACID) * 2, strong: false },
          ].map((row) => (
            <div key={row.label} className="flex flex-col items-center rounded-xl border border-line bg-surface px-2 py-2 md:flex-row md:justify-between md:px-3">
              <span className={cn("text-[13px]", row.strong ? "font-semibold text-ink" : "text-ink-2")}>{row.label}</span>
              <motion.span key={row.value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-math text-[22px] tabular-nums">
                {row.value}
              </motion.span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDrops((d) => Math.min(MAX, d + 1))}
          disabled={drops >= MAX}
          className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob-deep disabled:opacity-40"
        >
          <Droplet className="size-4" /> {t(tx("Add a drop of NaOH solution", "Natronlauge zutropfen"))}
        </button>
        <button type="button" onClick={() => setDrops(0)} disabled={drops === 0} className="flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-[14px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40">
          <RotateCcw className="size-4" /> {t(tx("Start again", "Von vorn"))}
        </button>
        <div className="overflow-x-auto">
          <MathView src="\ce{H3O+ + OH- -> 2H2O}" size="md" animate={false} />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={`${state}-${left}-${free}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {drops === 0 ? (
            <Inline
              text={tx(
                "Hydrochloric acid with a few drops of bromothymol blue. In this model each drop of sodium hydroxide solution brings one $\\ce{Na+}$ and one $\\ce{OH-}$. How many drops until it's neutral?",
                "Salzsäure mit ein paar Tropfen Bromthymolblau. Im Modell bringt jeder Tropfen Natronlauge ein $\\ce{Na+}$ und ein $\\ce{OH-}$ mit. Wie viele Tropfen, bis die Lösung neutral ist?",
              )}
            />
          ) : (
            <Inline text={status[state]} />
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
