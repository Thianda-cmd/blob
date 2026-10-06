"use client";

// Why sex cells carry only half the chromosomes: egg cell (n) + sperm cell (n) = zygote (2n).
// Pick a living thing, fertilise, and see what would happen if sex cells were not halved.

import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export const ORGANISMS: { id: string; name: Text; n2: number }[] = [
  { id: "human", name: tx("Human", "Mensch"), n2: 46 },
  { id: "chimp", name: tx("Chimpanzee", "Schimpanse"), n2: 48 },
  { id: "dog", name: tx("Dog", "Hund"), n2: 78 },
  { id: "cat", name: tx("Cat", "Katze"), n2: 38 },
  { id: "horse", name: tx("Horse", "Pferd"), n2: 64 },
  { id: "fly", name: tx("Fruit fly", "Taufliege"), n2: 8 },
  { id: "pea", name: tx("Pea", "Erbse"), n2: 14 },
  { id: "maize", name: tx("Maize", "Mais"), n2: 20 },
];

function Count({ x, y, value, fill = "var(--ink)", size = 17 }: { x: number; y: number; value: number | string; fill?: string; size?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={700} fill={fill} style={{ fontFamily: "var(--font-sans)" }}>
      {value}
    </text>
  );
}

const TAIL_A = "M100 105 C 82 92, 70 118, 52 104 S 26 94, 12 106";
const TAIL_B = "M100 105 C 82 116, 70 92, 52 106 S 26 116, 12 102";

export function DivisionFertilisation() {
  const t = useText();
  const reduce = useReducedMotion();
  const [org, setOrg] = useState("human");
  const [done, setDone] = useState(false);
  const [whatIf, setWhatIf] = useState(false);
  const o = ORGANISMS.find((x) => x.id === org)!;
  const n = o.n2 / 2;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 16 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(tx("Choose a living thing", "Wähle ein Lebewesen"))}>
        {ORGANISMS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={org === x.id}
            onClick={() => {
              setOrg(x.id);
              setDone(false);
            }}
            className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", org === x.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(x.name)}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-surface p-2">
        <svg viewBox="0 0 440 210" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Egg cell and sperm cell fuse to form a zygote", "Eizelle und Spermienzelle verschmelzen zur Zygote"))}>
          {/* Egg cell: big, with a nucleus. It becomes the zygote. */}
          <g>
            <circle cx={270} cy={105} r={70} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={3} />
            <circle cx={270} cy={105} r={78} fill="none" stroke="var(--bio-membrane)" strokeOpacity={0.35} strokeWidth={6} />
            <motion.circle cx={270} cy={105} initial={false} animate={{ r: done ? 34 : 26 }} transition={spring} fill="var(--bio-nucleus)" fillOpacity={0.6} stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
            {done ? (
              <g>
                <Count x={270} y={98} value={o.n2} fill="var(--blob)" size={19} />
                <text x={270} y={119} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} style={{ fontFamily: "var(--font-sans)" }}>
                  <tspan fill="var(--bio-blood)">{n}</tspan>
                  <tspan fill="var(--ink-2)"> + </tspan>
                  <tspan fill="var(--bio-blood-low)">{n}</tspan>
                </text>
              </g>
            ) : (
              <Count x={270} y={105} value={n} fill="var(--bio-blood)" />
            )}
          </g>
          {/* Sperm cell: head with nucleus, midpiece, tail. Swims into the egg. */}
          <motion.g initial={false} animate={done ? { x: 152, opacity: 0 } : { x: 0, opacity: 1 }} transition={done ? { ...spring, opacity: { delay: reduce ? 0 : 0.7, duration: 0.3 } } : spring}>
            <motion.path
              d={TAIL_A}
              animate={reduce ? undefined : { d: [TAIL_A, TAIL_B, TAIL_A] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              fill="none"
              stroke="var(--bio-outline)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <rect x={98} y={101} width={14} height={8} rx={3} fill="var(--bio-mito)" stroke="var(--bio-outline)" strokeWidth={1.2} />
            <ellipse cx={130} cy={105} rx={20} ry={14} fill="var(--bio-nucleus)" fillOpacity={0.7} stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
            <Count x={130} y={105} value={n} fill="var(--bio-blood-low)" size={15} />
          </motion.g>
          <text x={110} y={150} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }} opacity={done ? 0 : 1}>
            {t(tx("sperm cell (n)", "Spermienzelle (n)"))}
          </text>
          <text x={270} y={198} textAnchor="middle" fontSize={12} fill={done ? "var(--blob)" : "var(--ink-2)"} fontWeight={done ? 700 : 400} style={{ fontFamily: "var(--font-sans)" }}>
            {done ? t(tx("zygote (2n)", "Zygote (2n)")) : t(tx("egg cell (n)", "Eizelle (n)"))}
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setDone(!done)}
          className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]"
        >
          {done ? <RotateCcw className="size-4" /> : <Sparkles className="size-4" />}
          {t(done ? tx("Start again", "Noch mal") : tx("Fertilise", "Befruchten"))}
        </button>
        <div className="font-math text-[19px] text-ink">
          {n} + {n} = <span className={cn("font-semibold", done ? "text-blob-ink" : "text-ink-3")}>{done ? o.n2 : "?"}</span>
        </div>
      </div>

      <p className="rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        {done
          ? t(
              tx(
                `The zygote has ${o.n2} chromosomes again: ${n} from the mother and ${n} from the father. By mitosis it grows into a whole new living thing, and every body cell has ${o.n2} chromosomes.`,
                `Die Zygote hat wieder ${o.n2} Chromosomen: ${n} von der Mutter und ${n} vom Vater. Durch Mitose wächst daraus ein ganzes Lebewesen, und jede Körperzelle hat ${o.n2} Chromosomen.`,
              ),
            )
          : t(
              tx(
                `Body cells have ${o.n2} chromosomes, sex cells only half: ${n}. Press "Fertilise".`,
                `Körperzellen haben ${o.n2} Chromosomen, Keimzellen nur die Hälfte: ${n}. Drück auf „Befruchten“.`,
              ),
            )}
      </p>

      <div className="rounded-xl border border-line px-3.5 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-medium text-ink">
          <input type="checkbox" checked={whatIf} onChange={(e) => setWhatIf(e.target.checked)} className="size-4 accent-blob" />
          {t(tx("What if sex cells kept all their chromosomes?", "Was wäre, wenn Keimzellen alle Chromosomen behielten?"))}
        </label>
        {whatIf && (
          <div className="mt-3 space-y-1.5">
            {[0, 1, 2, 3].map((g) => {
              const value = o.n2 * 2 ** g;
              return (
                <div key={g} className="flex items-center gap-3 text-[13px]">
                  <span className="w-24 shrink-0 text-ink-2">{t(g === 0 ? tx("Parents", "Eltern") : tx(`Generation ${g}`, `${g}. Generation`))}</span>
                  <div className="h-3 min-w-0 flex-1 rounded-full bg-line">
                    <motion.div className={cn("h-3 rounded-full", g === 0 ? "bg-blob/50" : "bg-danger/70")} initial={{ width: 0 }} animate={{ width: `${(100 * 2 ** g) / 8}%` }} transition={reduce ? { duration: 0 } : { delay: g * 0.15, type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                  <span className="w-12 shrink-0 text-right font-math text-[15px] tabular-nums text-ink">{value}</span>
                </div>
              );
            })}
            <p className="pt-1 text-[13.5px] leading-relaxed text-ink-2">
              {t(tx("The number would double in every generation. That's why sex cells are made by a special division that halves the chromosome number.", "Die Zahl würde sich in jeder Generation verdoppeln. Darum entstehen Keimzellen durch eine besondere Teilung, die die Chromosomenzahl halbiert."))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
