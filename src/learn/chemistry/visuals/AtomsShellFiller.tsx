"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { byNumber, shells } from "../elements";
import { AtomShells } from "./AtomShells";

const NAMES = ["K", "L", "M", "N"];
/** Places drawn per shell for the first 20 elements (the outermost shell holds at most 8). */
const SLOTS = [2, 8, 8, 8];
const MAX = [2, 8, 18, 32];

function ruleFor(z: number): Text {
  if (z === 1) return tx("The first electron goes onto the K shell, closest to the nucleus.", "Das erste Elektron kommt auf die K-Schale, ganz nah an den Kern.");
  if (z === 2) return tx("The K shell is full: it holds at most 2 electrons. Helium is a noble gas.", "Die K-Schale ist voll: Sie fasst höchstens 2 Elektronen. Helium ist ein Edelgas.");
  if (z < 10) return tx("K is full, so every new electron goes onto the L shell. It holds up to 8.", "K ist voll, also kommt jedes neue Elektron auf die L-Schale. Sie fasst bis zu 8.");
  if (z === 10) return tx("The L shell is full with 8 electrons. Neon has a full outer shell: a noble gas.", "Die L-Schale ist mit 8 Elektronen voll. Neon hat eine volle Außenschale: ein Edelgas.");
  if (z < 18) return tx("K and L are full. Now the M shell fills up.", "K und L sind voll. Jetzt füllt sich die M-Schale.");
  if (z === 18) return tx("8 electrons on the M shell: argon has a full outer shell (noble gas).", "8 Elektronen auf der M-Schale: Argon hat eine volle Außenschale (Edelgas).");
  return tx(
    "The M shell could take up to 18 electrons. But the outermost shell never holds more than 8, so the N shell starts now.",
    "Die M-Schale könnte bis zu 18 Elektronen fassen. Aber auf der äußersten Schale sind nie mehr als 8, darum beginnt jetzt die N-Schale.",
  );
}

/** Fill the shells electron by electron (one element after the next) and watch the rules at work. */
export function AtomsShellFiller() {
  const t = useText();
  const [z, setZ] = useState(11);
  const el = byNumber(z)!;
  const layers = shells(z);
  const outer = layers.length - 1;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-center">
      <div className="flex flex-col items-center gap-2">
        <AtomShells z={z} size={210} />
        <motion.div key={z} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="text-[17px] font-semibold text-ink">
            {t(el.name)} <span className="font-normal text-ink-3">({el.symbol})</span>
          </div>
          <div className="text-[12.5px] text-ink-3">{t(tx(`${z} protons, ${z} electrons`, `${z} Protonen, ${z} Elektronen`))}</div>
        </motion.div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setZ(Math.max(1, z - 1))}
            disabled={z <= 1}
            aria-label={t(tx("One electron less (previous element)", "Ein Elektron weniger (voriges Element)"))}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={20}
            value={z}
            onChange={(ev) => setZ(Number(ev.target.value))}
            aria-label={t(tx("Number of electrons", "Anzahl der Elektronen"))}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-blob"
          />
          <button
            type="button"
            onClick={() => setZ(Math.min(20, z + 1))}
            disabled={z >= 20}
            aria-label={t(tx("One electron more (next element)", "Ein Elektron mehr (nächstes Element)"))}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          >
            <Plus className="size-4" />
          </button>
          <span className="w-[70px] shrink-0 text-right font-math text-[18px] tabular-nums text-ink">{z} e⁻</span>
        </div>

        <div className="space-y-2 rounded-xl border border-line bg-surface p-3.5">
          {NAMES.map((name, i) => {
            const count = layers[i] ?? 0;
            const isOuter = i === outer;
            return (
              <div key={name} className={cn("flex items-center gap-3 transition-opacity", i > outer + 1 && "opacity-40")}>
                <span className={cn("w-5 font-math text-[17px] font-semibold", isOuter ? "text-blob-ink" : "text-ink-2")}>{name}</span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-[5px]">
                  {Array.from({ length: SLOTS[i] }, (_, k) => {
                    const on = k < count;
                    return (
                      <span key={k} className="relative grid size-[15px] place-items-center rounded-full border border-line-2">
                        {on && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 24 }}
                            className={cn("absolute inset-[1.5px] rounded-full", isOuter ? "bg-blob" : "bg-ink-2")}
                          />
                        )}
                      </span>
                    );
                  })}
                </div>
                <span className="w-[74px] shrink-0 text-right text-[12px] tabular-nums text-ink-3">
                  {count} / {i === 2 ? `8 (${MAX[i]})` : SLOTS[i]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-[14px] text-ink-2">
            {t(tx("Outer electrons", "Außenelektronen"))}: <span className="font-math text-[20px] font-semibold text-blob-ink">{layers[outer]}</span>
          </div>
          <div className="font-math text-[15px] text-ink-3">
            {z} = {layers.join(" + ")}
          </div>
        </div>
        <motion.p key={z} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {t(ruleFor(z))}
        </motion.p>
      </div>
    </div>
  );
}
