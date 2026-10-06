"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";

// Hardy-Weinberg calculator: from the share of individuals with the recessive trait (q²) to the
// allele frequencies q and p and the share of carriers (2pq). The square shows p² + 2pq + q² = 1.

const PRESETS: { id: string; label: Text; q: number }[] = [
  { id: "cf", label: tx("Cystic fibrosis (1 in 2,500)", "Mukoviszidose (1 : 2500)"), q: 0.02 },
  { id: "pku", label: tx("PKU (1 in 10,000)", "Phenylketonurie (1 : 10.000)"), q: 0.01 },
  { id: "ex", label: tx("Example: 16 % show it", "Beispiel: 16 % zeigen es"), q: 0.4 },
];

const S = 220;

/** 1st, 2nd, 3rd, 4th, 11th, 22nd */
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export function EvolutionHardyWeinberg() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const reduce = useReducedMotion();
  const [q, setQ] = useState(0.02);
  const p = 1 - q;
  const q2 = q * q;
  const pq2 = 2 * p * q;
  const p2 = p * p;
  const d = (v: number, digits = 4) => dec(Math.round(v * 10 ** digits) / 10 ** digits, locale, digits);
  const n = 10000;
  const counts = [Math.round(p2 * n), Math.round(pq2 * n), Math.round(q2 * n)];
  const every = pq2 > 0 ? Math.round(1 / pq2) : 0;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 160, damping: 22 };
  const P = S * p;

  const lines = [
    `q^2 = ${d(q2, q2 < 0.001 ? 6 : 4)} \\quad \\Rightarrow \\quad q = \\sqrt{q^2} = ${d(q, 3)}`,
    `p = 1 - q = ${d(p, 3)}`,
    `2pq = 2 \\cdot ${d(p, 3)} \\cdot ${d(q, 3)} = ${d(pq2, 4)}`,
    `p^2 = ${d(p2, 4)} \\quad \\Rightarrow \\quad p^2 + 2pq + q^2 = 1`,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={Math.abs(q - x.q) < 1e-9}
            onClick={() => setQ(x.q)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", Math.abs(q - x.q) < 1e-9 ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {Math.abs(q - x.q) < 1e-9 && <motion.span layoutId={`${scope}-pre`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(x.label)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span className="text-ink-2">{t(tx("Share showing the recessive trait (aa)", "Anteil mit rezessivem Merkmal (aa)"))}</span>
          <span className="font-semibold tabular-nums text-ink">{d(q2 * 100, 2)} %</span>
        </div>
        <input
          type="range"
          min={1}
          max={95}
          step={1}
          value={Math.round(q * 100)}
          onChange={(e) => setQ(Number(e.target.value) / 100)}
          aria-label={t(tx("Share with the recessive trait", "Anteil mit rezessivem Merkmal"))}
          aria-valuetext={`q² = ${d(q2 * 100, 2)} %`}
          className="w-full accent-blob"
        />
      </div>

      <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <svg viewBox={`-26 -26 ${S + 34} ${S + 34}`} className="mx-auto block h-auto w-full max-w-[260px]" role="img" aria-label="p² + 2pq + q² = 1">
          <text x={P / 2} y={-10} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {P > 22 ? "A (p)" : ""}
          </text>
          <text x={P + (S - P) / 2} y={-10} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {S - P > 22 ? "a (q)" : "a"}
          </text>
          <motion.rect x={0} y={0} initial={false} animate={{ width: P, height: P }} transition={spring} fill="var(--bio-nucleus)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <motion.rect y={0} initial={false} animate={{ x: P, width: S - P, height: P }} transition={spring} fill="var(--bio-leaf)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <motion.rect x={0} initial={false} animate={{ y: P, width: P, height: S - P }} transition={spring} fill="var(--bio-leaf)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <motion.rect initial={false} animate={{ x: P, y: P, width: S - P, height: S - P }} transition={spring} fill="var(--bio-mito)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          <g fontSize={15} fontWeight={700} fill="var(--ink)" textAnchor="middle" dominantBaseline="central" style={{ fontFamily: "var(--font-sans)" }}>
            {P > 34 && (
              <text x={P / 2} y={P / 2}>
                AA
              </text>
            )}
            {S - P > 26 && P > 26 && (
              <>
                <text x={P + (S - P) / 2} y={P / 2}>
                  Aa
                </text>
                <text x={P / 2} y={P + (S - P) / 2}>
                  Aa
                </text>
              </>
            )}
            {S - P > 26 && (
              <text x={P + (S - P) / 2} y={P + (S - P) / 2}>
                aa
              </text>
            )}
          </g>
        </svg>

        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5 overflow-x-auto rounded-xl border border-line bg-surface px-4 py-3">
            {lines.map((l, i) => (
              <MathView key={i} src={l} size="sm" scope={`${scope}-l${i}`} animate={false} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "AA", c: "var(--bio-nucleus)", v: counts[0], label: tx("healthy, not a carrier", "gesund, kein Überträger") },
              { k: "Aa", c: "var(--bio-leaf)", v: counts[1], label: tx("carriers", "Überträger") },
              { k: "aa", c: "var(--bio-mito)", v: counts[2], label: tx("show the trait", "zeigen das Merkmal") },
            ].map((x) => (
              <div key={x.k} className="rounded-xl border border-line px-2 py-2">
                <div className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-ink">
                  <span className="size-3 rounded-sm border border-ink/30" style={{ background: x.c }} />
                  {x.k}
                </div>
                <div className="font-display text-[20px] font-bold tabular-nums text-ink">{x.v.toLocaleString(locale === "de" ? "de-DE" : "en-GB")}</div>
                <div className="text-[12px] leading-tight text-ink-3">{t(x.label)}</div>
              </div>
            ))}
          </div>
          <p className="text-[14px] leading-relaxed text-ink-2">
            {t(tx(`Out of 10,000 people (in an ideal population). About every ${ordinal(every)} person is a carrier.`, `Von 10.000 Menschen (in einer idealen Population). Etwa jeder ${every}. ist Überträger.`))}
          </p>
        </div>
      </div>
    </div>
  );
}
