"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { fx, M, massSum, NA, PARTICLES, sci, type ParticleKind } from "../moles-core";

// The mole counter: put a mass of a substance on the scale (slider) and watch it turn into
// an amount of substance (n = m/M, as "mol packets") and a number of particles (N = n · N_A).
// Below, the same amount of other substances shows how different their masses are.

type Item = { f: string; name: Text; kind: ParticleKind; tone: string };

const ITEMS: Item[] = [
  { f: "H2O", name: tx("Water", "Wasser"), kind: "molecule", tone: "color-mix(in oklab, var(--blob) 45%, var(--raised))" },
  { f: "NaCl", name: tx("Table salt", "Kochsalz"), kind: "unit", tone: "color-mix(in oklab, var(--ink) 12%, var(--raised))" },
  { f: "Fe", name: tx("Iron", "Eisen"), kind: "atom", tone: "color-mix(in oklab, var(--ink) 55%, var(--raised))" },
  { f: "C", name: tx("Carbon", "Kohlenstoff"), kind: "atom", tone: "color-mix(in oklab, var(--ink) 85%, var(--raised))" },
  { f: "C12H22O11", name: tx("Sugar", "Zucker"), kind: "molecule", tone: "color-mix(in oklab, var(--ink) 4%, var(--raised))" },
  { f: "Au", name: tx("Gold", "Gold"), kind: "atom", tone: "color-mix(in oklab, var(--blob) 80%, var(--ink))" },
];

const MAX_G = 400;
const MAX_DOTS = 66;
const round = (v: number) => Math.round(v * 100) / 100;

/** A heap of particles on the scale pan; more mass, bigger heap. */
function Heap({ count, tone }: { count: number; tone: string }) {
  const r = 7.2;
  const dots: { x: number; y: number }[] = [];
  // Triangular pile: rows get shorter towards the top.
  let row = 0;
  let left = count;
  while (left > 0) {
    const width = Math.max(1, 11 - row);
    const n = Math.min(width, left);
    for (let k = 0; k < n; k++) dots.push({ x: round((k - (n - 1) / 2) * (2 * r + 0.6)), y: round(-r - row * (2 * r - 2.6)) });
    left -= n;
    row++;
  }
  return (
    <g>
      <AnimatePresence initial={false}>
        {dots.map((d, i) => (
          <motion.circle
            key={i}
            r={r}
            fill={tone}
            stroke="var(--ink-3)"
            strokeWidth={0.8}
            initial={{ opacity: 0, cx: d.x, cy: d.y - 40, scale: 0.4 }}
            animate={{ opacity: 1, cx: d.x, cy: d.y, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
          />
        ))}
      </AnimatePresence>
    </g>
  );
}

export function MolesCounter() {
  const t = useText();
  const locale = useLocale();
  const [pick, setPick] = useState(0);
  const [m, setM] = useState(36);
  const item = ITEMS[pick];
  const molar = M(item.f);
  const n = m / molar;
  const N = n * NA;
  const dots = m <= 0 ? 0 : Math.max(1, Math.min(MAX_DOTS, Math.round((m / MAX_G) * MAX_DOTS * 1.6)));
  const full = Math.floor(n + 1e-9);
  const part = n - full;
  const boxes = Math.min(36, full + (part > 0.004 ? 1 : 0));
  const nd = n >= 10 ? 1 : n >= 1 ? 2 : 3;

  const setMass = (v: number) => setM(Math.max(0, Math.min(MAX_G, round(v))));
  const words = resolveText(PARTICLES[item.kind], locale);

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ITEMS.map((it, i) => (
          <button
            key={it.f}
            type="button"
            onClick={() => setPick(i)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              i === pick ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <span className="size-2.5 rounded-full border border-line-2" style={{ background: it.tone }} />
            {t(it.name)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          <svg viewBox="0 0 240 200" className="mx-auto block w-full max-w-[280px]" role="img" aria-label={t(tx(`Scale with ${fx(m, "en", 1)} g of ${resolveText(item.name, "en").toLowerCase()}`, `Waage mit ${fx(m, "de", 1)} g ${resolveText(item.name, "de")}`))}>
            <g transform="translate(120 132)">
              <Heap count={dots} tone={item.tone} />
            </g>
            <path d="M 34 134 L 206 134 L 196 142 L 44 142 Z" fill="color-mix(in oklab, var(--ink) 14%, var(--raised))" stroke="var(--line-2)" strokeWidth={1.2} />
            <rect x={112} y={142} width={16} height={14} fill="var(--line-2)" />
            <rect x={30} y={156} width={180} height={36} rx={9} fill="color-mix(in oklab, var(--ink) 8%, var(--raised))" stroke="var(--line-2)" strokeWidth={1.2} />
            <rect x={70} y={163} width={100} height={22} rx={5} fill="var(--ink)" />
            <text x={162} y={174} dy="0.36em" textAnchor="end" fontSize={15} fontWeight={600} fill="var(--raised)" className="tabular-nums">
              {fx(m, locale, 1)} g
            </text>
          </svg>
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={MAX_G}
              step={0.5}
              value={m}
              onChange={(e) => setMass(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[var(--blob)]"
              aria-label={t(tx("Mass in grams", "Masse in Gramm"))}
            />
            <div className="flex flex-wrap gap-1.5">
              {[0.5, 1, 2].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMass(k * molar)}
                  disabled={k * molar > MAX_G}
                  className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
                >
                  {fx(k, locale, k % 1 ? 1 : 0)} mol
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Molar mass", "Molare Masse"))}</div>
            <div className="overflow-x-auto">
              <MathView src={`M(\\ce{${item.f}}) = ${fx(molar, locale, 2)} "g/mol"`} size="sm" animate={false} />
            </div>
            <div className="text-[12.5px] text-ink-3">
              {t(tx("from the periodic table:", "aus dem Periodensystem:"))} <MathView src={massSum(item.f, locale)} size="inline" animate={false} />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Amount of substance", "Stoffmenge"))}</div>
            <div className="overflow-x-auto py-1">
              <MathView src={`n = \\frac{m}{M} = \\frac{${fx(m, locale, 1)} "g"}{${fx(molar, locale, 2)} "g/mol"} ${n === 0 || Math.abs(n - Number(n.toFixed(nd))) < 1e-9 ? "=" : "\\approx"} ${fx(n, locale, nd)} "mol"`} size="sm" animate={false} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1" aria-hidden>
              {Array.from({ length: boxes }, (_, i) => {
                const fill = i < full ? 1 : part;
                return (
                  <motion.span key={i} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative size-5 overflow-hidden rounded-[5px] border border-blob/50 bg-blob-soft/40">
                    <motion.span className="absolute inset-y-0 left-0 bg-blob" initial={false} animate={{ width: `${Math.round(fill * 100)}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                  </motion.span>
                );
              })}
              {full + 1 > 36 && <span className="text-[12px] text-ink-3">…</span>}
            </div>
            <div className="mt-1 text-[12px] text-ink-3">{t(tx("1 box = 1 mol", "1 Kästchen = 1 mol"))}</div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Number of particles", "Teilchenzahl"))}</div>
            <div className="overflow-x-auto py-1">
              <MathView src={`N = n \\cdot N_A ${N === 0 ? "= 0" : `\\approx ${sci(N, locale, 2)}`}`} size="sm" animate={false} />
            </div>
            <div className="text-[12.5px] text-ink-2">
              {words}
              {item.kind === "unit" ? t(tx(" (each one Na⁺ and one Cl⁻)", " (je ein Na⁺ und ein Cl⁻)")) : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{t(tx(`The same ${fx(n, "en", nd)} mol of other substances:`, `Dieselben ${fx(n, "de", nd)} mol anderer Stoffe:`))}</span>{" "}
        {ITEMS.filter((_, i) => i !== pick)
          .map((it) => `${t(it.name)} ${fx(n * M(it.f), locale, 1)} g`)
          .join(" · ")}
      </div>
    </div>
  );
}
