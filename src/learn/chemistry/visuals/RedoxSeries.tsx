"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { LAB_METALS, SERIES, ionText, metal, metalSwap, reacts, type Metal } from "../redox-data";

// The redox series as a ladder: dip a metal strip into a salt solution and see whether the
// metal hands its electrons to the dissolved ions. Only a less noble metal does.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const name = (m: Metal, l: "en" | "de") => resolveText(m.name, l);

/** Ion positions in the beaker (left and right of the strip). */
const SPOTS: [number, number][] = [
  [48, 128],
  [62, 176],
  [44, 214],
  [176, 132],
  [162, 182],
  [180, 216],
];
/** Coating dots on the dipped part of the strip. */
const DOTS: [number, number][] = Array.from({ length: 22 }, (_, i) => [i % 2 ? 100 + ((i * 7) % 8) : 122 - ((i * 5) % 8), 126 + ((i * 37) % 96)]);

export function RedoxSeries() {
  const t = useText();
  const scope = useId();
  const [m, setM] = useState("Zn");
  const [n, setN] = useState("Cu");
  const [dipped, setDipped] = useState(false);
  const M = metal(m);
  const N = metal(n);
  const same = m === n;
  const yes = !same && reacts(M, N);
  const eq = yes ? metalSwap(M, N) : null;
  const show = dipped;

  const pick = (set: (s: string) => void) => (s: string) => {
    set(s);
    setDipped(false);
  };

  const verdict: Text = same
    ? tx("Same metal and same ions: nothing visible happens.", "Gleiches Metall und gleiche Ionen: Es passiert nichts Sichtbares.")
    : yes
      ? txMap((_, l) =>
          l === "de"
            ? `**${name(M, l)}** ist unedler als **${name(N, l)}**. Die ${name(M, l)}-Atome geben Elektronen an die ${resolveText(N.ions, l)} ab: ${name(N, l)} scheidet sich auf dem Streifen ab, ${resolveText(M.ions, l)} gehen in Lösung.`
            : `**${cap(name(M, l))}** is less noble than **${name(N, l)}**. The ${name(M, l)} atoms give electrons to the ${resolveText(N.ions, l)}: ${name(N, l)} is deposited on the strip, ${resolveText(M.ions, l)} go into solution.`,
        )
      : txMap((_, l) =>
          l === "de"
            ? `**${name(M, l)}** ist edler als **${name(N, l)}**: Die ${name(M, l)}-Atome geben ihre Elektronen nicht an die ${resolveText(N.ions, l)} ab. Es passiert nichts.`
            : `**${cap(name(M, l))}** is nobler than **${name(N, l)}**: its atoms don't give their electrons to the ${resolveText(N.ions, l)}. Nothing happens.`,
        );

  const dy = show ? 0 : -62;

  return (
    <div className="space-y-4">
      {/* the ladder */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[12px] font-medium text-ink-3">
          <span>{t(tx("← base: gives electrons easily", "← unedel: gibt leicht Elektronen ab"))}</span>
          <span>{t(tx("noble →", "edel →"))}</span>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-1">
            {SERIES.map((x, i) => {
              const isM = x.symbol === m;
              const isN = x.symbol === n;
              return (
                <div key={x.symbol} className="flex items-center gap-1">
                  {i > 0 && SERIES[i - 1].e0 < 0 && x.e0 > 0 && (
                    <span className="grid h-10 w-9 place-items-center rounded-lg border border-dashed border-line-2 text-[12px] text-ink-3">
                      <MathView src="\ce{H2}" size="sm" animate={false} />
                    </span>
                  )}
                  <span
                    className={cn(
                      "relative grid h-10 w-10 place-items-center rounded-lg border text-[15px] font-semibold transition-colors",
                      isM ? "border-blob bg-blob text-white" : isN ? "border-2 border-dashed border-blob bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink-2",
                    )}
                  >
                    {x.symbol}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-blob" /> {t(tx("metal strip", "Metallstreifen"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border-2 border-dashed border-blob bg-blob-soft" /> {t(tx("ions in the solution", "Ionen in der Lösung"))}
          </span>
        </div>
      </div>

      {/* choices */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Picker label={t(tx("Metal strip", "Metallstreifen"))} scope={`${scope}-m`} value={m} onChange={pick(setM)} items={LAB_METALS.map((x) => ({ id: x.symbol, src: `\\ce{${x.symbol}}`, title: t(x.name) }))} />
        <Picker label={t(tx("Salt solution", "Salzlösung"))} scope={`${scope}-n`} value={n} onChange={pick(setN)} items={LAB_METALS.map((x) => ({ id: x.symbol, src: `\\ce{${x.salt!.formula}}`, title: t(x.salt!.name) }))} />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 224 250" className="w-full max-w-[230px]" role="img" aria-label={t(tx("Beaker with a metal strip in a salt solution", "Becherglas mit einem Metallstreifen in einer Salzlösung"))}>
            <rect x={20} y={96} width={184} height={140} rx={10} style={{ fill: "color-mix(in oklab, var(--blob) 9%, var(--raised))" }} />
            {/* dissolved ions */}
            {SPOTS.map(([x, y], i) => {
              const gone = show && yes && i % 2 === 0;
              return (
                <motion.text key={`${n}-${i}`} x={x} y={y} textAnchor="middle" initial={false} animate={{ opacity: gone ? 0 : 1 }} transition={{ delay: gone ? 0.7 + i * 0.1 : 0 }} className="fill-ink-2 font-math" style={{ fontSize: 15 }}>
                  {ionText(N.symbol, N.charge)}
                </motion.text>
              );
            })}
            <AnimatePresence>
              {show &&
                yes &&
                SPOTS.filter((_, i) => i % 2 === 0).map(([x, y], i) => (
                  <motion.text
                    key={`${m}-${n}-new-${i}`}
                    initial={{ opacity: 0, x: 112, y: y }}
                    animate={{ opacity: 1, x: x + (x < 112 ? 6 : -6), y: y + 18 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.9 + i * 0.15, type: "spring", stiffness: 120, damping: 16 }}
                    textAnchor="middle"
                    className="fill-blob-ink font-math"
                    style={{ fontSize: 15, fontWeight: 600 }}
                  >
                    {ionText(M.symbol, M.charge)}
                  </motion.text>
                ))}
            </AnimatePresence>
            {/* the strip */}
            <motion.g initial={false} animate={{ y: dy }} transition={{ type: "spring", stiffness: 140, damping: 18 }}>
              <rect x={97} y={38} width={30} height={190} rx={4} style={{ fill: "color-mix(in oklab, var(--ink) 22%, var(--raised))", stroke: "var(--ink-3)" }} strokeWidth={1.5} />
              <text x={112} y={60} textAnchor="middle" className="fill-ink font-math" style={{ fontSize: 15, fontWeight: 600 }}>
                {M.symbol}
              </text>
              <AnimatePresence>
                {show &&
                  yes &&
                  DOTS.map(([x, y], i) => (
                    <motion.circle key={`${m}-${n}-d${i}`} cx={x} cy={y} r={3.2} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.6 + i * 0.05 }} fill="var(--ink)" style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }} />
                  ))}
              </AnimatePresence>
            </motion.g>
            {/* beaker */}
            <path d="M14 70 L20 76 L20 228 Q20 242 34 242 L190 242 Q204 242 204 228 L204 76 L210 70" fill="none" stroke="var(--ink-3)" strokeWidth={2.5} strokeLinejoin="round" />
          </svg>
          <span className="text-center text-[12.5px] text-ink-3">
            {t(M.name)} · {t(N.salt!.name)}
          </span>
        </div>

        <div className="space-y-3">
          {!show ? (
            <div className="space-y-3">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {t(tx("Will the strip get a coating? Guess first, then dip it in.", "Bekommt der Streifen einen Belag? Erst tippen, dann eintauchen."))}
              </p>
              <button type="button" onClick={() => setDipped(true)} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white hover:bg-blob-deep">
                <ArrowDownToLine className="size-4" /> {t(tx("Dip it in", "Eintauchen"))}
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${m}-${n}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
                <div className={cn("font-display text-[18px] font-semibold", yes ? "text-blob-ink" : "text-ink-2")}>{t(yes ? tx("It reacts!", "Es reagiert!") : tx("No reaction", "Keine Reaktion"))}</div>
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                  <Inline text={verdict} />
                </p>
                {eq && (
                  <div className="space-y-2 overflow-x-auto rounded-xl border border-line bg-surface px-3 py-2.5">
                    {[
                      { label: tx("Oxidation", "Oxidation"), src: `\\ce{${eq.ox}}${eq.a > 1 ? ` \\quad | \\cdot ${eq.a}` : ""}` },
                      { label: tx("Reduction", "Reduktion"), src: `\\ce{${eq.red}}${eq.b > 1 ? ` \\quad | \\cdot ${eq.b}` : ""}` },
                      { label: tx("Redox", "Redox"), src: `\\ce{${eq.total}}` },
                    ].map((row, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="w-24 shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(row.label)}</span>
                        <MathView src={row.src} size="sm" animate={false} />
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setDipped(false)} className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
                  <RotateCcw className="size-3.5" /> {t(tx("Pull it out", "Herausziehen"))}
                </button>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function Picker({ label, scope, value, onChange, items }: { label: string; scope: string; value: string; onChange: (id: string) => void; items: { id: string; src: string; title: string }[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            title={it.title}
            aria-label={it.title}
            aria-pressed={value === it.id}
            onClick={() => onChange(it.id)}
            className={cn("relative h-9 rounded-lg border px-2.5 transition-colors", value === it.id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {value === it.id && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">
              <MathView src={it.src} size="sm" animate={false} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
