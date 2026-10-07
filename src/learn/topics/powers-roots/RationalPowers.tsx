"use client";

// Level 3 widget: fractional exponents fill the gaps between the whole-number powers. Pick a base and a
// denominator, slide the exponent, and the point runs along the curve y = b^x while the formula shows
// root first, then power.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { pow } from "@/lib/stableMath";
import { gcdInt } from "./kit";
import { Segmented, spring } from "./ui";

/** Bases with their exponent range (so the curve stays readable) and nice roots. */
const BASES: { b: number; from: number; to: number; yMax: number; yStep: number }[] = [
  { b: 2, from: -2, to: 4, yMax: 17, yStep: 4 },
  { b: 4, from: -1, to: 2, yMax: 17, yStep: 4 },
  { b: 8, from: -1, to: 1.5, yMax: 24, yStep: 8 },
  { b: 9, from: -1, to: 1.5, yMax: 28, yStep: 8 },
  { b: 16, from: -1, to: 1.25, yMax: 34, yStep: 8 },
  { b: 27, from: -1, to: 1, yMax: 28, yStep: 8 },
];
const DENOMS = [1, 2, 3, 4];

const W = 360;
const H = 236;
const PAD = { l: 34, r: 14, t: 12, b: 28 };

/** An exact integer root of b, or null. */
function intRoot(b: number, n: number): number | null {
  const r = Math.round(Math.pow(b, 1 / n));
  return r ** n === b ? r : null;
}

const decL = (v: number, l: Locale, digits = 2) => {
  const s = String(Math.round(v * 10 ** digits) / 10 ** digits);
  return l === "de" ? s.replace(".", ",") : s;
};

/** Slide the exponent along y = b^x: whole powers are dots, fractions fill the gaps. */
export function RationalPowers() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const [bi, setBi] = useState(1);
  const [d, setD] = useState(2);
  const [x, setX] = useState(1.5);
  const B = BASES[bi];
  const lo = Math.ceil(B.from * d - 1e-9);
  const hi = Math.floor(B.to * d + 1e-9);
  const m = Math.min(hi, Math.max(lo, Math.round(x * d)));
  const ex = m / d;

  // reduced exponent p/q
  const g = gcdInt(Math.abs(m), d) || 1;
  const p = m / g;
  const q = d / g;
  const value = pow(B.b, ex);
  const root = q === 1 ? B.b : intRoot(B.b, q);
  const exact = root !== null && Number.isInteger(pow(root, Math.abs(p)));

  const sx = (v: number) => PAD.l + ((v - B.from) / (B.to - B.from)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - (Math.min(v, B.yMax) / B.yMax) * (H - PAD.t - PAD.b);
  const curve = Array.from({ length: 121 }, (_, i) => {
    const xv = B.from + ((B.to - B.from) * i) / 120;
    return `${i ? "L" : "M"}${sx(xv).toFixed(2)},${sy(pow(B.b, xv)).toFixed(2)}`;
  }).join("");
  const ints: number[] = [];
  for (let k = Math.ceil(B.from); k <= Math.floor(B.to); k++) ints.push(k);
  const yTicks: number[] = [];
  for (let v = B.yStep; v < B.yMax; v += B.yStep) yTicks.push(v);

  // The formula: b^{p/q} = (q-th root of b)^p = r^p = value
  const absP = Math.abs(p);
  const expSrc = q === 1 ? `${p}` : `${p < 0 ? "-" : ""}\\frac{${absP}}{${q}}`;
  const rootSrc = q === 2 ? `\\sqrt{${B.b}#rb}#R` : `\\sqrt[${q}#rq]{${B.b}#rb}#R`;
  const valueSrc = exact
    ? p < 0
      ? `\\frac{1}{${pow(root!, absP)}}`
      : `${pow(root!, absP)}`
    : `\\approx ${decL(value, "en")}`;
  let formula: string;
  if (q === 1) formula = `${B.b}#b^{${expSrc}#e} =#eq ${p < 0 ? `\\frac{1}{${B.b ** absP}}` : `${B.b ** absP}`}#v`;
  else {
    const inner = absP === 1 ? rootSrc : `(${rootSrc})#br^{${absP}#p}`;
    const step = p < 0 ? `\\frac{1}{${inner}}#F` : inner;
    const mid = exact && absP > 1 ? ` =#eq2 ${p < 0 ? `\\frac{1}{${root}#r${absP === 1 ? "" : `^{${absP}#p2}`}}#F2` : `${root}#r${absP === 1 ? "" : `^{${absP}#p2}`}`}` : "";
    formula = `${B.b}#b^{${expSrc}#e} =#eq ${step}${mid} ${exact ? "=#eq3" : ""} ${valueSrc}#v`;
  }
  const formulaL = l === "de" ? formula.replace(/(\d)\.(\d)/g, "$1,$2") : formula;

  const lower = Math.floor(ex);
  const between = !Number.isInteger(ex) && lower >= B.from && lower + 1 <= B.to;
  const rootEn = q === 2 ? "square root" : q === 3 ? "cube root" : `${q}th root`;
  const rootDe = q === 2 ? "Quadratwurzel" : `${q}. Wurzel`;
  const caption = ex === 0
    ? tx(`Exponent $0$: no factor at all, so $${B.b}^0 = 1$.`, `Exponent $0$: gar kein Faktor, also ist $${B.b}^0 = 1$.`)
    : Number.isInteger(ex)
    ? tx(
        `A whole exponent: $${Math.abs(ex)}$ ${Math.abs(ex) === 1 ? "factor" : "factors"} $${B.b}$${ex < 0 ? " below the fraction bar" : ""}. Now pick a denominator and slide between the dots.`,
        `Ein ganzzahliger Exponent: $${Math.abs(ex)}$ ${Math.abs(ex) === 1 ? "Faktor" : "Faktoren"} $${B.b}$${ex < 0 ? " unter dem Bruchstrich" : ""}. Wähl jetzt einen Nenner und schieb zwischen die Punkte.`,
      )
    : exact
      ? tx(
          `The denominator $${q}$ means the ${rootEn}: $${q === 2 ? `\\sqrt{${B.b}}` : `\\sqrt[${q}]{${B.b}}`} = ${root}$. The numerator $${absP}$ is the power${p < 0 ? ", and the minus puts it below the fraction bar" : ""}.${between ? ` The point lies between $${B.b}^{${lower}}$ and $${B.b}^{${lower + 1}}$.` : ""}`,
          `Der Nenner $${q}$ steht für die ${rootDe}: $${q === 2 ? `\\sqrt{${B.b}}` : `\\sqrt[${q}]{${B.b}}`} = ${root}$. Der Zähler $${absP}$ ist die Potenz${p < 0 ? ", und das Minus setzt sie unter den Bruchstrich" : ""}.${between ? ` Der Punkt liegt zwischen $${B.b}^{${lower}}$ und $${B.b}^{${lower + 1}}$.` : ""}`,
        )
      : tx(
          `$${q === 2 ? `\\sqrt{${B.b}}` : `\\sqrt[${q}]{${B.b}}`}$ is not a whole number, so the value is rounded. The curve still runs smoothly through it.`,
          `$${q === 2 ? `\\sqrt{${B.b}}` : `\\sqrt[${q}]{${B.b}}`}$ ist keine ganze Zahl, deshalb ist der Wert gerundet. Die Kurve läuft trotzdem glatt hindurch.`,
        );
  const capL = t(caption);

  const px = sx(ex);
  const py = sy(value);
  const clipped = value > B.yMax;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-math text-[17px] italic text-ink-2">b =</span>
          <Segmented scope={`${scope}-b`} label={tx("Base", "Basis")} value={bi} onChange={setBi} options={BASES.map((o, i) => ({ id: i, label: <span className="font-math">{o.b}</span> }))} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Denominator", "Nenner"))}</span>
          <Segmented
            scope={`${scope}-d`}
            label={tx("Denominator", "Nenner")}
            value={d}
            onChange={(nd) => {
              setX(ex);
              setD(nd);
            }}
            options={DENOMS.map((n) => ({ id: n, label: <span className="font-math">{n}</span> }))}
          />
        </div>
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="relative w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-surface">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t(tx(`Graph of y = ${B.b} to the power x`, `Graph von y = ${B.b} hoch x`))}>
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={1} />
                <text x={PAD.l - 6} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" className="font-math">
                  {v}
                </text>
              </g>
            ))}
            {ints.map((k) => (
              <g key={`x${k}`}>
                <line x1={sx(k)} x2={sx(k)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line)" strokeWidth={1} />
                <text x={sx(k)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill="var(--ink-3)" className="font-math">
                  {k}
                </text>
              </g>
            ))}
            {/* axes */}
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={1.2} />
            <line x1={sx(0)} x2={sx(0)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" strokeWidth={1.2} />
            <text x={W - PAD.r} y={H - PAD.b - 6} textAnchor="end" fontSize={12} fill="var(--ink-2)" className="font-math italic">
              x
            </text>
            <text x={sx(0) + 6} y={PAD.t + 10} fontSize={12} fill="var(--ink-2)" className="font-math italic">
              y
            </text>
            <motion.path initial={false} animate={{ d: curve }} transition={{ type: "spring", stiffness: 200, damping: 26 }} fill="none" stroke="var(--blob)" strokeWidth={2.4} strokeLinecap="round" />
            <AnimatePresence initial={false}>
              {ints.map((k) => (
                <motion.circle key={`${B.b}-${k}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} cx={sx(k)} cy={sy(pow(B.b, k))} r={3.6} fill="var(--ink-2)" />
              ))}
            </AnimatePresence>
            {!clipped && (
              <>
                <motion.line initial={false} animate={{ x1: px, x2: px, y1: py, y2: sy(0) }} transition={spring} stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="3 3" />
                <motion.line initial={false} animate={{ x1: sx(0), x2: px, y1: py, y2: py }} transition={spring} stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="3 3" />
                <motion.circle initial={false} animate={{ cx: px, cy: py }} transition={spring} r={7} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2.5} />
              </>
            )}
          </svg>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex min-h-[64px] items-center">
            <MathView src={formulaL} size="lg" scope={`${scope}-f`} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={capL} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[14px] leading-relaxed text-ink-2">
              <Inline text={capL} />
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="shrink-0 text-[13px] text-ink-2">{t(tx("Exponent", "Exponent"))}</span>
        <input
          type="range"
          min={lo}
          max={hi}
          step={1}
          value={m}
          onChange={(e) => setX(Number(e.target.value) / d)}
          className="h-2 w-full cursor-pointer accent-[var(--blob)]"
          aria-valuetext={`${m}/${d}`}
        />
        <span className="w-14 shrink-0 text-right">
          <MathView src={q === 1 ? `${p}` : expSrc} size="sm" animate={false} />
        </span>
      </label>
    </div>
  );
}
