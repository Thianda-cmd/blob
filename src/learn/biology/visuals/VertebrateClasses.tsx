"use client";

// The five vertebrate classes side by side: tap a class to see its profile (skin, breathing,
// body temperature, offspring) and a few members, including surprising ones.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { ANIMALS, CLASS_IDS, CLASSES, type ClassId } from "@/learn/biology/topics/vertebrates/data";
import { cn } from "@/lib/utils";
import { ClassAnimal } from "./VertebrateAnimals";

const ROWS: { key: "skin" | "breath" | "temp" | "young" | "extra"; label: Text }[] = [
  { key: "skin", label: tx("Skin", "Haut") },
  { key: "breath", label: tx("Breathing", "Atmung") },
  { key: "temp", label: tx("Body temperature", "Körpertemperatur") },
  { key: "young", label: tx("Offspring", "Fortpflanzung") },
  { key: "extra", label: tx("Also typical", "Außerdem typisch") },
];

const MEMBERS: Record<ClassId, string[]> = {
  fish: ["trout", "shark", "seahorse", "eel"],
  amph: ["frog", "toad", "salamander", "axolotl"],
  rept: ["lizard", "grasssnake", "crocodile", "slowworm"],
  bird: ["blackbird", "eagle", "penguin", "ostrich"],
  mammal: ["hedgehog", "whale", "bat", "platypus"],
};
/** Members that surprise students (shown in purple). */
const SURPRISE = new Set(["seahorse", "eel", "axolotl", "salamander", "crocodile", "slowworm", "penguin", "ostrich", "whale", "bat", "platypus"]);

export function VertebrateClassCards() {
  const t = useText();
  const [sel, setSel] = useState<ClassId>("fish");
  const C = CLASSES[sel];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3" role="tablist" aria-label={t(tx("Vertebrate classes", "Wirbeltierklassen"))}>
        {CLASS_IDS.map((c) => {
          const on = c === sel;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSel(c)}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 pb-2 pt-1.5 transition-colors sm:px-2",
                on ? "border-blob bg-blob-soft" : "border-line bg-surface hover:bg-hover",
              )}
            >
              <motion.div animate={{ scale: on ? 1.06 : 1, y: on ? -2 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 22 }} className="w-full max-w-[110px]">
                <ClassAnimal cls={c} title={false} />
              </motion.div>
              <span className={cn("w-full hyphens-auto text-center text-[10.5px] font-semibold leading-tight sm:text-[13px]", on ? "text-ink" : "text-ink-2")}>{t(CLASSES[c].name)}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={sel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="rounded-xl border border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-2.5 font-display text-[18px] font-bold">{t(C.name)}</div>
          <dl className="divide-y divide-line">
            {ROWS.map((r, i) => (
              <motion.div
                key={r.key}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="grid gap-0.5 px-4 py-2 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-3"
              >
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(r.label)}</dt>
                <dd className="text-[15px] text-ink">{t(C[r.key])}</dd>
              </motion.div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
            <span className="mr-1 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Examples", "Beispiele"))}</span>
            {MEMBERS[sel].map((id) => {
              const a = ANIMALS.find((x) => x.id === id)!;
              const tricky = SURPRISE.has(id);
              return (
                <span key={id} className={cn("rounded-full px-2.5 py-0.5 text-[13px]", tricky ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2")}>
                  {t(a.name)}
                </span>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
      <p className="text-[13px] text-ink-3">{t(tx("Purple examples are surprising members. Can you say why they belong here?", "Lila Beispiele sind überraschende Mitglieder. Kannst du sagen, warum sie dazugehören?"))}</p>
    </div>
  );
}
