"use client";

// Level 3 widgets: a medical test with 1000 people (natural frequencies, Bayes) and an explorer
// for the binomial distribution B(n, p).

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { pow } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { EventName, useNum } from "./pictures";
import { C } from "./kit";
import { Segmented } from "./widgets1";

function Slider({ label, value, min, max, step = 1, onChange, show }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show: string }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between gap-2 text-[13px] text-ink-2">
        <span>{label}</span>
        <span className="font-math text-[17px] text-ink tabular-nums">{show}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blob" aria-label={label} />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Medical test: 10 000 people, one dot for every 10

// Shares of ill people (in %). With 10 000 people every count in the table is a whole number:
// ill = 100 · share, ill and positive = share · sensitivity, healthy and positive = (100 − share) · (100 − specificity).
const PREV = [1, 2, 5, 10, 20, 30, 50];
const N = 10000;
const PER_DOT = 10;
const DOTS = N / PER_DOT;

/**
 * Dots for each group, one for every 10 people. The ill get exactly their share of dots; a group
 * that isn't empty always gets at least one dot, so even 5 ill people with a negative test show up.
 */
function dotCounts(sick: number, tp: number, fp: number) {
  const sickDots = Math.round(sick / PER_DOT);
  const healthyDots = DOTS - sickDots;
  const keep = (v: number, n: number, rest: number, all: number) => Math.min(rest > 0 ? all - 1 : all, Math.max(n > 0 ? 1 : 0, v));
  const tpDots = keep(Math.round(tp / PER_DOT), tp, sick - tp, sickDots);
  const fpDots = keep(Math.round(fp / PER_DOT), fp, N - sick - fp, healthyDots);
  return { tp: tpDots, fn: sickDots - tpDots, fp: fpDots, tn: healthyDots - fpDots };
}

export function ProbabilityBayesLab() {
  const t = useText();
  const num = useNum();
  const locale = useLocale();
  const [pi, setPi] = useState(1); // index into PREV: 2 %
  const [sens, setSens] = useState(90);
  const [spec, setSpec] = useState(95);
  const prev = PREV[pi];
  const sick = (N * prev) / 100;
  const tp = prev * sens;
  const fn = sick - tp;
  const healthy = N - sick;
  const fp = (100 - prev) * (100 - spec);
  const tn = healthy - fp;
  const ppv = tp / (tp + fp);
  const pct = (v: number) => `${num(v * 100, 1)}${locale === "de" ? " %" : "%"}`;
  const big = (v: number) => (v >= 10000 ? v.toLocaleString(locale === "de" ? "de-DE" : "en-GB").replace(/[.,]/g, "\u202f") : String(v));

  // Dots, row by row: sick and positive, sick and negative, healthy and positive, healthy and negative.
  const cols = 40;
  const cell = 10;
  const dots = dotCounts(sick, tp, fp);
  const kinds: ("tp" | "fn" | "fp" | "tn")[] = [
    ...Array<"tp">(dots.tp).fill("tp"),
    ...Array<"fn">(dots.fn).fill("fn"),
    ...Array<"fp">(dots.fp).fill("fp"),
    ...Array<"tn">(dots.tn).fill("tn"),
  ];
  const style = {
    tp: { fill: "var(--danger)", stroke: "var(--danger)", r: 3.8 },
    fn: { fill: "transparent", stroke: "var(--danger)", r: 3.2 },
    fp: { fill: "var(--blob)", stroke: "var(--blob)", r: 3.8 },
    tn: { fill: "var(--line-2)", stroke: "transparent", r: 2.6 },
  } as const;
  const legend = [
    { k: "tp" as const, label: t(tx("ill, test positive", "krank, Test positiv")), n: tp },
    { k: "fn" as const, label: t(tx("ill, test negative", "krank, Test negativ")), n: fn },
    { k: "fp" as const, label: t(tx("healthy, test positive", "gesund, Test positiv")), n: fp },
    { k: "tn" as const, label: t(tx("healthy, test negative", "gesund, Test negativ")), n: tn },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label={t(tx("Share of ill people", "Anteil der Kranken"))} value={pi} min={0} max={PREV.length - 1} onChange={setPi} show={pct(prev / 100)} />
        <Slider label={t(tx("Ill → positive (sensitivity)", "Krank → positiv (Sensitivität)"))} value={sens} min={50} max={99} onChange={setSens} show={pct(sens / 100)} />
        <Slider label={t(tx("Healthy → negative (specificity)", "Gesund → negativ (Spezifität)"))} value={spec} min={50} max={99} onChange={setSpec} show={pct(spec / 100)} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <figure className="rounded-xl border border-line bg-surface p-3">
          <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-ink-3">
            <span className="font-semibold uppercase tracking-[0.06em]">{t(tx(`${big(N)} people`, `${big(N)} Menschen`))}</span>
            <span>{t(tx("1 dot ≈ 10 people", "1 Punkt ≈ 10 Menschen"))}</span>
          </figcaption>
          <svg viewBox={`0 0 ${cols * cell} ${(DOTS / cols) * cell}`} className="block h-auto w-full" role="img" aria-label={t(tx("10 000 people as dots, one dot for every 10", "10 000 Menschen als Punkte, ein Punkt für je 10"))}>
            {kinds.map((k, i) => (
              <circle
                key={i}
                cx={(i % cols) * cell + cell / 2}
                cy={Math.floor(i / cols) * cell + cell / 2}
                r={style[k].r}
                fill={style[k].fill}
                stroke={style[k].stroke}
                strokeWidth={1.3}
                style={{ transition: "fill 0.3s, stroke 0.3s, r 0.3s" }}
              />
            ))}
          </svg>
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] text-ink-2 sm:grid-cols-2">
            {legend.map((l) => (
              <span key={l.k} className="flex items-center gap-2">
                <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
                  <circle cx={6} cy={6} r={style[l.k].r + 0.8} fill={style[l.k].fill} stroke={style[l.k].stroke} strokeWidth={1.3} />
                </svg>
                <span>
                  {l.label}: <span className="font-math tabular-nums text-ink">{l.n}</span>
                </span>
              </span>
            ))}
          </div>
        </figure>

        <div className="space-y-3">
          <table className="w-full border-collapse text-center font-math text-[15px] tabular-nums">
            <thead>
              <tr className="text-ink-2">
                <th className="border-b border-line" />
                <th className="border-b border-line px-2 py-1 font-normal">
                  <EventName label="T" />
                </th>
                <th className="border-b border-line px-2 py-1 font-normal">
                  <EventName label="~T" />
                </th>
                <th className="border-b border-l-2 border-line px-2 py-1 font-normal">Σ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="border-r border-line px-2 py-1 font-normal text-ink-2">
                  <EventName label="K" />
                </th>
                <td className="px-2 py-1 font-semibold text-danger">{tp}</td>
                <td className="px-2 py-1">{fn}</td>
                <td className="border-l-2 border-line px-2 py-1 text-ink-2">{sick}</td>
              </tr>
              <tr>
                <th className="border-r border-line px-2 py-1 font-normal text-ink-2">
                  <EventName label="~K" />
                </th>
                <td className="px-2 py-1 font-semibold text-blob-ink">{fp}</td>
                <td className="px-2 py-1">{tn}</td>
                <td className="border-l-2 border-line px-2 py-1 text-ink-2">{healthy}</td>
              </tr>
              <tr className="border-t-2 border-line text-ink-2">
                <th className="border-r border-line px-2 py-1 font-normal">Σ</th>
                <td className="px-2 py-1">{tp + fp}</td>
                <td className="px-2 py-1">{fn + tn}</td>
                <td className="border-l-2 border-line px-2 py-1">{big(N)}</td>
              </tr>
            </tbody>
          </table>
          <div className="rounded-xl border border-blob/40 bg-blob-soft/50 px-3 py-3">
            <div className="text-[12.5px] text-ink-2">{t(tx("Test positive. Am I really ill?", "Test positiv. Bin ich wirklich krank?"))}</div>
            <MathView src={`P_T(K) = \\frac{${tp}}{${tp} + ${fp}}`} size="md" animate={false} className="mt-1" />
            <motion.div key={Math.round(ppv * 1000)} initial={{ scale: 0.92, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 font-display text-[28px] font-bold text-blob-ink">
              {pct(ppv)}
            </motion.div>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            {t(
              tx(
                `Of all positive tests (red and purple dots), only the red ones are really ill. Compare: the test finds ${pct(sens / 100)} of the ill, but only ${pct(ppv)} of the people who test positive are really ill.`,
                `Von allen positiven Tests (rote und lila Punkte) sind nur die roten wirklich krank. Vergleich: Der Test erkennt ${pct(sens / 100)} der Kranken, aber nur ${pct(ppv)} der positiv Getesteten sind wirklich krank.`,
              ),
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Binomial distribution

type Mode = "eq" | "le" | "ge";

export function ProbabilityBinomialLab() {
  const t = useText();
  const num = useNum();
  const [n, setN] = useState(10);
  const [p100, setP100] = useState(30);
  const [kRaw, setK] = useState(3);
  const [mode, setMode] = useState<Mode>("eq");
  const p = p100 / 100;
  const k = Math.min(kRaw, n);
  const probs = Array.from({ length: n + 1 }, (_, i) => C(n, i) * pow(p, i) * pow(1 - p, n - i));
  const lit = (i: number) => (mode === "eq" ? i === k : mode === "le" ? i <= k : i >= k);
  const total = probs.reduce((s, v, i) => s + (lit(i) ? v : 0), 0);
  const ymax = Math.max(...probs) * 1.18;
  const W = 560;
  const H = 250;
  const x0 = 50;
  const plotW = W - x0 - 10;
  const bw = plotW / (n + 1);
  const y = (v: number) => 14 + (1 - v / ymax) * (H - 56);
  const mu = n * p;
  const step = n > 20 ? 5 : n > 10 ? 2 : 1;
  // Near the right edge the μ label goes to the left of its line, so it isn't cut off.
  const muLeft = mu > 0.75 * n;

  const head = mode === "eq" ? `P(X = ${k})` : mode === "le" ? `P(X \\le ${k})` : `P(X \\ge ${k})`;
  const sumSrc =
    mode === "eq"
      ? `${head} = \\binom{${n}}{${k}} \\cdot ${num(p, 2)}^{${k}} \\cdot ${num(1 - p, 2)}^{${n - k}} \\approx ${num(total, 4)}`
      : mode === "le"
        ? k === 0
          ? `${head} = P(X = 0) \\approx ${num(total, 4)}`
          : `${head} = P(X = 0) + … + P(X = ${k}) \\approx ${num(total, 4)}`
        : k === 0
          ? `${head} = 1`
          : `${head} = 1 - P(X \\le ${k - 1}) \\approx ${num(total, 4)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label={t(tx("Number of trials n", "Anzahl der Versuche n"))} value={n} min={1} max={30} onChange={setN} show={`n = ${n}`} />
        <Slider label={t(tx("Probability of a hit p", "Trefferwahrscheinlichkeit p"))} value={p100} min={5} max={95} step={5} onChange={setP100} show={`p = ${num(p, 2)}`} />
        <Slider label={t(tx("Number of hits k", "Anzahl der Treffer k"))} value={k} min={0} max={n} onChange={setK} show={`k = ${k}`} />
      </div>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { id: "eq", label: "P(X = k)" },
          { id: "le", label: "P(X ≤ k)" },
          { id: "ge", label: "P(X ≥ k)" },
        ]}
      />

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Histogram of the binomial distribution", "Histogramm der Binomialverteilung"))}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={x0} x2={W - 10} y1={y(f * ymax)} y2={y(f * ymax)} stroke="var(--line)" strokeWidth={1} />
            <text x={x0 - 6} y={y(f * ymax) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" className="max-sm:text-[17px]" style={{ fontFamily: "var(--font-sans)" }}>
              {num(f * ymax, 2)}
            </text>
          </g>
        ))}
        {probs.map((v, i) => (
          <g key={i} onClick={() => setK(i)} className="cursor-pointer">
            <rect x={x0 + i * bw} y={14} width={bw} height={H - 56} fill="transparent" />
            <motion.rect
              initial={false}
              animate={{ y: y(v), height: Math.max(0, y(0) - y(v)) }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.35 }}
              x={x0 + i * bw + bw * 0.08}
              width={bw * 0.84}
              rx={Math.min(3, bw * 0.15)}
              fill={lit(i) ? "var(--blob)" : "var(--ink-3)"}
              opacity={lit(i) ? 0.95 : 0.35}
            />
            {i % step === 0 && (
              <text x={x0 + (i + 0.5) * bw} y={H - 24} textAnchor="middle" fontSize={11} fill="var(--ink-2)" className="max-sm:text-[17px]" style={{ fontFamily: "var(--font-sans)" }}>
                {i}
              </text>
            )}
          </g>
        ))}
        <motion.g initial={false} animate={{ x: x0 + (mu + 0.5) * bw }} transition={{ type: "spring", stiffness: 240, damping: 30 }}>
          <line x1={0} x2={0} y1={10} y2={y(0)} stroke="var(--danger)" strokeWidth={1.6} strokeDasharray="5 4" />
          <text x={muLeft ? -4 : 4} y={20} textAnchor={muLeft ? "end" : "start"} fontSize={12} fill="var(--danger)" className="font-math max-sm:text-[18px]">
            μ = {num(mu, 2)}
          </text>
        </motion.g>
        <text x={W - 10} y={H - 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="max-sm:text-[16px]" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("number of hits k", "Anzahl der Treffer k"))}
        </text>
      </svg>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={sumSrc} size="md" animate={false} />
        <div className={cn("mt-1 text-[13px] text-ink-2")}>
          {t(
            tx(
              `Expected value μ = n · p = ${n} · ${num(p, 2)} = ${num(mu, 2)}. The highest bars are always close to μ.`,
              `Erwartungswert μ = n · p = ${n} · ${num(p, 2)} = ${num(mu, 2)}. Die höchsten Säulen liegen immer nahe bei μ.`,
            ),
          )}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-ink-2">
        {t(
          tx(
            "Set n and p with the sliders. Tap a bar (or use the k slider) to choose the number of hits, and switch between exactly, at most and at least k hits.",
            "Stell n und p mit den Reglern ein. Tippe auf eine Säule (oder nimm den k-Regler), um die Trefferzahl zu wählen, und wechsle zwischen genau, höchstens und mindestens k Treffern.",
          ),
        )}
      </p>
    </div>
  );
}
