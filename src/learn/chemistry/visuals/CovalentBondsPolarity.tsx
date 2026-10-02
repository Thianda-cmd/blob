"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { element } from "../elements";

// Electronegativity tug of war: slide the EN difference and watch the shared electron pair
// move from the middle (nonpolar) to one side (polar, δ+/δ−) until it jumps over (ions).

/** Pauling electronegativity rounded to one decimal, as in school tables. */
export const en1 = (symbol: string) => Math.round((element(symbol)?.en ?? 0) * 10 + 1e-6) / 10;
export const deltaEn = (a: string, b: string) => Math.round(Math.abs(en1(a) - en1(b)) * 10) / 10;

export const NONPOLAR_MAX = 0.4;
export const IONIC_MIN = 1.7;
export type BondKind = "nonpolar" | "polar" | "ionic";
export const bondKind = (d: number): BondKind => (d < NONPOLAR_MAX ? "nonpolar" : d <= IONIC_MIN ? "polar" : "ionic");

/** Example pairs: [less electronegative, more electronegative]. */
const EXAMPLES: [string, string][] = [
  ["H", "H"],
  ["Cl", "Cl"],
  ["H", "N"],
  ["H", "Cl"],
  ["H", "O"],
  ["Na", "Cl"],
  ["Li", "F"],
];

const MAX = 3.2;
const W = 520;
const H = 190;

const KIND_TEXT: Record<BondKind, { title: Text; body: Text }> = {
  nonpolar: {
    title: tx("Nonpolar covalent bond", "Unpolare Elektronenpaarbindung"),
    body: tx("Both atoms pull (almost) equally hard. The shared pair stays in the middle.", "Beide Atome ziehen (fast) gleich stark. Das gemeinsame Elektronenpaar bleibt in der Mitte."),
  },
  polar: {
    title: tx("Polar covalent bond", "Polare Elektronenpaarbindung"),
    body: tx(
      "The more electronegative atom pulls the shared pair closer. It gets a partial negative charge δ−, the other one δ+.",
      "Das elektronegativere Atom zieht das gemeinsame Paar näher zu sich. Es bekommt eine negative Teilladung δ−, das andere δ+.",
    ),
  },
  ionic: {
    title: tx("Ionic bond", "Ionenbindung"),
    body: tx("The difference is so big that the electrons change sides completely: ions form.", "Der Unterschied ist so groß, dass die Elektronen ganz die Seite wechseln: Es entstehen Ionen."),
  },
};

export function CovalentBondsPolarity() {
  const t = useText();
  const locale = useLocale();
  /** One decimal, always shown: "1,0" / "1.0". */
  const f1 = (v: number) => (locale === "de" ? v.toFixed(1).replace(".", ",") : v.toFixed(1));
  const scope = useId();
  const [value, setValue] = useState(1.0);
  const [picked, setPicked] = useState<number | null>(3);
  const ex = picked !== null && deltaEn(...EXAMPLES[picked]) === value ? EXAMPLES[picked] : (EXAMPLES.find((p) => deltaEn(...p) === value) ?? null);
  const [la, lb] = ex ?? ["A", "B"];
  const kind = bondKind(value);
  const ionic = kind === "ionic";

  // Geometry: atoms drift apart and change size when they become ions.
  const shift = Math.min(1, value / IONIC_MIN);
  const ax = ionic ? 150 : 175;
  const bx = ionic ? 370 : 345;
  const ra = ionic ? 34 : 44;
  const rb = ionic ? 54 : 44;
  const mid = (ax + bx) / 2;
  const pairX = ionic ? bx - rb + 16 : mid + shift * 62;
  const cloudX = ionic ? bx : mid + shift * 48;
  const cloudW = ionic ? rb + 14 : 120 - shift * 22;
  const partial = Math.min(1, value / NONPOLAR_MAX);
  const cy = 98;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((p, i) => {
          const active = ex === p;
          return (
            <button
              key={p.join("-")}
              type="button"
              onClick={() => {
                setPicked(i);
                setValue(deltaEn(...p));
              }}
              className={cn("relative h-9 rounded-lg border px-2.5 font-math text-[15px] transition-colors", active ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {active && <motion.span layoutId={`${scope}-ex`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
              <span className="relative">
                {p[0]}–{p[1]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={t(KIND_TEXT[kind].title)}>
          <defs>
            <radialGradient id={`${scope}-cloud`}>
              <stop offset="0%" stopColor="var(--blob)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--blob)" stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* electron cloud of the shared pair */}
          <motion.ellipse initial={false} animate={{ cx: cloudX, rx: cloudW, ry: ionic ? rb + 12 : 46 }} cy={cy} fill={`url(#${scope}-cloud)`} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
          {/* bond line fades out when it becomes ionic */}
          <motion.line x1={ax + ra} x2={bx - rb} y1={cy} y2={cy} stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" initial={false} animate={{ opacity: ionic ? 0 : 0.5 }} />
          {/* atoms */}
          {[
            { x: ax, r: ra, label: la, side: "a" as const },
            { x: bx, r: rb, label: lb, side: "b" as const },
          ].map((at) => (
            <motion.g key={at.side} initial={false} animate={{ x: at.x }} transition={{ type: "spring", stiffness: 140, damping: 20 }}>
              <motion.circle cy={cy} initial={false} animate={{ r: at.r }} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.5} />
              <text y={cy} textAnchor="middle" dominantBaseline="central" className="fill-ink font-math" style={{ fontSize: 30 }}>
                {at.label}
              </text>
              <AnimatePresence mode="wait" initial={false}>
                <motion.text
                  key={ionic ? "ion" : "delta"}
                  y={cy - at.r - 12}
                  textAnchor="middle"
                  className="fill-blob-ink font-math font-semibold"
                  style={{ fontSize: 24 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: ionic ? 1 : kind === "polar" ? 1 : partial * 0.25 }}
                  exit={{ opacity: 0 }}
                >
                  {ionic ? (at.side === "a" ? "+" : "−") : at.side === "a" ? "δ+" : "δ−"}
                </motion.text>
              </AnimatePresence>
            </motion.g>
          ))}
          {/* the shared electron pair */}
          {[-7, 7].map((dy) => (
            <motion.circle key={dy} r={6} fill="var(--blob)" initial={false} animate={{ cx: pairX, cy: cy + dy }} transition={{ type: "spring", stiffness: 140, damping: 18 }} />
          ))}
          <text x={W / 2} y={H - 12} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 15 }}>
            {ex ? `EN ${f1(en1(la))}  ·  EN ${f1(en1(lb))}` : ""}
          </text>
        </svg>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label htmlFor={`${scope}-range`} className="shrink-0 font-math text-[17px] text-ink">
            ΔEN = <span className="tabular-nums">{f1(value)}</span>
          </label>
          <input
            id={`${scope}-range`}
            type="range"
            min={0}
            max={MAX}
            step={0.1}
            value={value}
            onChange={(e) => {
              setValue(Math.round(Number(e.target.value) * 10) / 10);
            }}
            className="h-2 w-full cursor-pointer accent-[var(--blob)]"
          />
        </div>
        {/* zones */}
        <div className="relative h-7 overflow-hidden rounded-lg border border-line text-[11.5px] font-semibold">
          {(
            [
              ["nonpolar", 0, NONPOLAR_MAX, tx("nonpolar", "unpolar")],
              ["polar", NONPOLAR_MAX, IONIC_MIN, tx("polar", "polar")],
              ["ionic", IONIC_MIN, MAX, tx("ionic", "ionisch")],
            ] as [BondKind, number, number, Text][]
          ).map(([k, from, to, label]) => (
            <div
              key={k}
              className={cn("absolute inset-y-0 flex items-center transition-colors", k === "nonpolar" ? "justify-start" : "justify-center", k === kind ? "bg-blob-soft text-blob-ink" : "text-ink-3")}
              style={{ left: `${(from / MAX) * 100}%`, width: `${((to - from) / MAX) * 100}%` }}
            >
              <span className={cn("relative z-10 whitespace-nowrap", k === "nonpolar" ? "pl-1.5" : "px-1")}>{t(label)}</span>
            </div>
          ))}
          <motion.div className="absolute inset-y-0 w-0.5 bg-blob" initial={false} animate={{ left: `${(value / MAX) * 100}%` }} transition={{ type: "spring", stiffness: 400, damping: 34 }} />
        </div>
        <div className="relative h-4 text-[11px] tabular-nums text-ink-3">
          {[0, NONPOLAR_MAX, IONIC_MIN, MAX].map((v, i, all) => (
            <span key={v} className="absolute top-0" style={{ left: `${(v / MAX) * 100}%`, transform: i === 0 ? "none" : i === all.length - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>
              {v === 0 ? "0" : f1(v)}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={kind} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
          <div className="text-[14.5px] font-semibold text-ink">{t(KIND_TEXT[kind].title)}</div>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{t(KIND_TEXT[kind].body)}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
