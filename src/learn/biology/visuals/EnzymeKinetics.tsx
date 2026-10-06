"use client";

// The Michaelis-Menten diagram: move the substrate concentration and read off the rate, show
// vmax, vmax/2 and KM, then switch on a competitive or a non-competitive inhibitor and watch
// which value changes. A small drawing shows where the inhibitor binds.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { mm } from "@/learn/biology/topics/enzymes/data";
import { dec } from "@/learn/chemistry/format";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { Chart, curvePath, S_AXIS, V_AXIS } from "./EnzymeCharts";
import { ALLO_PATH, C, EnzymeBody, inhibitorPath, SubstrateShape } from "./EnzymeShapes";

const VMAX = 80;
const KM = 2;
const XMAX = 20;

type Mode = "none" | "comp" | "non";

function Sub({ base, sub }: { base: string; sub: string }) {
  return (
    <>
      {base}
      <tspan fontSize="0.72em" dy="0.3em">
        {sub}
      </tspan>
    </>
  );
}

/** Where the inhibitor sits: in the active site (competitive) or at the allosteric site. */
function Inset({ mode, on }: { mode: Mode; on: boolean }) {
  const t = useText();
  return (
    <svg viewBox="0 0 300 220" className="mx-auto block h-auto w-full max-w-[210px]" role="img" aria-label={t(tx("Where the inhibitor binds", "Wo der Hemmstoff bindet"))}>
      <g transform="translate(150 112) scale(0.78)">
        <EnzymeBody variant={mode === "non" && on ? "distorted" : "fit"} allo />
        {mode === "comp" && on && (
          <motion.g initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }}>
            <path d={inhibitorPath()} fill={C.comp} stroke={C.compLine} strokeWidth={2.4} strokeLinejoin="round" />
          </motion.g>
        )}
        {mode === "non" && on && (
          <motion.g initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}>
            <path d={ALLO_PATH} fill={C.allo} stroke={C.alloLine} strokeWidth={2.4} strokeLinejoin="round" />
          </motion.g>
        )}
        <motion.g initial={false} animate={mode !== "none" && on ? { x: mode === "comp" ? -150 : 0, y: -96, rotate: -10 } : { x: 0, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 90, damping: 15 }}>
          <SubstrateShape />
        </motion.g>
      </g>
    </svg>
  );
}

export function EnzymeKinetics() {
  const t = useText();
  const locale = useLocale();
  const [s, setS] = useState(2);
  const [guides, setGuides] = useState(true);
  const [mode, setMode] = useState<Mode>("none");
  const [inh, setInh] = useState(2);
  const on = mode !== "none" && inh > 0;
  const km = mode === "comp" ? KM * (1 + inh) : KM;
  const vmax = mode === "non" ? VMAX / (1 + inh) : VMAX;
  const v = mm(s, vmax, km);
  const f = (x: number, d = 1) => dec(x, locale, d);

  const info: Text =
    mode === "none"
      ? s >= 12
        ? tx(
            "At high substrate concentrations almost every active site is busy: the rate approaches the maximum rate $v_{max}$, but never quite reaches it.",
            "Bei hoher Substratkonzentration sind fast alle aktiven Zentren besetzt: Die Geschwindigkeit nähert sich der Maximalgeschwindigkeit $v_{max}$, erreicht sie aber nie ganz.",
          )
        : Math.abs(s - KM) < 0.15
          ? tx(
              "Here the rate is exactly half of $v_{max}$. The substrate concentration at this point is the **Michaelis constant $K_M$**.",
              "Hier ist die Geschwindigkeit genau halb so groß wie $v_{max}$. Die Substratkonzentration an diesem Punkt ist die **Michaelis-Konstante $K_M$**.",
            )
          : tx(
              "Move the substrate concentration. Where is the rate exactly half of $v_{max}$? That's where you read off $K_M$.",
              "Verschieb die Substratkonzentration. Wo ist die Geschwindigkeit genau halb so groß wie $v_{max}$? Dort liest du $K_M$ ab.",
            )
      : mode === "comp"
        ? txMap((tt, l) =>
            tt(
              `Competitive inhibitor: it occupies the active site. You need more substrate for half the maximum rate: $K_M$ rises from ${dec(KM, l)} to ${dec(km, l, 1)} mmol/L. $v_{max}$ stays ${VMAX}: with very much substrate the substrate wins.`,
              `Kompetitiver Hemmstoff: Er besetzt das aktive Zentrum. Für die halbe Maximalgeschwindigkeit brauchst du mehr Substrat: $K_M$ steigt von ${dec(KM, l)} auf ${dec(km, l, 1)} mmol/l. $v_{max}$ bleibt ${VMAX}: Bei sehr viel Substrat setzt sich das Substrat durch.`,
            ),
          )
        : txMap((tt, l) =>
            tt(
              `Non-competitive (allosteric) inhibitor: it binds elsewhere and deforms the active site. The enzymes it holds are out of action, so $v_{max}$ falls to ${dec(vmax, l, 1)}. $K_M$ stays ${dec(KM, l)} mmol/L, and more substrate doesn't help.`,
              `Nicht-kompetitiver (allosterischer) Hemmstoff: Er bindet woanders und verformt das aktive Zentrum. Die Enzyme, die er besetzt, fallen aus, darum sinkt $v_{max}$ auf ${dec(vmax, l, 1)}. $K_M$ bleibt ${dec(KM, l)} mmol/l, und mehr Substrat hilft nicht.`,
            ),
          );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-line p-0.5">
          {(["none", "comp", "non"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", mode === m ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {mode === m && <motion.span layoutId="enzyme-kin-mode" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">
                {m === "none" ? t(tx("No inhibitor", "Ohne Hemmstoff")) : m === "comp" ? t(tx("Competitive", "Kompetitiv")) : t(tx("Non-competitive", "Nicht-kompetitiv"))}
              </span>
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} className="size-4 accent-[var(--blob)]" />
          {t(tx("Show vmax and KM", "vmax und KM einzeichnen"))}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-1.5">
          <Chart x={{ min: 0, max: XMAX, step: 2, minor: 1, label: S_AXIS }} y={{ min: 0, max: 100, step: 20, minor: 10, label: V_AXIS }} width={440} height={290} label={tx("Michaelis-Menten diagram", "Michaelis-Menten-Diagramm")}>
            {(sc) => (
              <>
                {on && <path d={curvePath((x) => mm(x, VMAX, KM), 0, XMAX, sc)} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />}
                {guides && (
                  <g style={{ fontFamily: "var(--font-sans)" }}>
                    <motion.path initial={false} animate={{ d: `M ${sc.x0} ${sc.py(vmax)} L ${sc.x1} ${sc.py(vmax)}` }} stroke="var(--bio-water-deep)" strokeWidth={1.6} strokeDasharray="7 5" />
                    <motion.text initial={false} animate={{ y: sc.py(vmax) - 6 }} x={sc.x1 - 4} textAnchor="end" fontSize={13} fontWeight={600} fill="var(--bio-water-deep)">
                      <Sub base="v" sub="max" />
                    </motion.text>
                    <motion.path
                      initial={false}
                      animate={{ d: `M ${sc.x0} ${sc.py(vmax / 2)} L ${sc.px(km)} ${sc.py(vmax / 2)} L ${sc.px(km)} ${sc.y0}` }}
                      fill="none"
                      stroke="var(--bio-mito-deep)"
                      strokeWidth={1.6}
                      strokeDasharray="4 4"
                    />
                    <motion.text initial={false} animate={{ y: sc.py(vmax / 2) - 6 }} x={sc.x0 + 6} fontSize={12.5} fontWeight={600} fill="var(--bio-mito-deep)">
                      <Sub base="½ v" sub="max" />
                    </motion.text>
                    <motion.text initial={false} animate={{ x: sc.px(km) + 5 }} y={sc.y0 - 8} fontSize={13} fontWeight={600} fill="var(--bio-mito-deep)">
                      <Sub base="K" sub="M" />
                    </motion.text>
                  </g>
                )}
                <motion.path initial={false} animate={{ d: curvePath((x) => mm(x, vmax, km), 0, XMAX, sc, 120) }} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
                <path d={`M ${sc.px(s)} ${sc.y0} L ${sc.px(s)} ${sc.py(v)} L ${sc.x0} ${sc.py(v)}`} fill="none" stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="2 4" opacity={0.8} />
                <circle cx={sc.px(s)} cy={sc.py(v)} r={6.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />
              </>
            )}
          </Chart>
        </div>
        <div className="space-y-2">
          <Inset mode={mode} on={on} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-line px-3 py-2 text-[13.5px] tabular-nums">
            <dt className="text-ink-3">
              v<sub>max</sub>
            </dt>
            <dd className={cn("text-right font-semibold", vmax !== VMAX ? "text-blob-ink" : "text-ink")}>{f(vmax)}</dd>
            <dt className="text-ink-3">
              K<sub>M</sub>
            </dt>
            <dd className={cn("text-right font-semibold", km !== KM ? "text-blob-ink" : "text-ink")}>
              {f(km)} {t(tx("mmol/L", "mmol/l"))}
            </dd>
            <dt className="text-ink-3">v</dt>
            <dd className="text-right font-semibold text-ink">{f(v)}</dd>
          </dl>
        </div>
      </div>

      <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-[13px] text-ink-2">
          <span className="w-24 shrink-0">{t(tx("Substrate [S]", "Substrat [S]"))}</span>
          <input type="range" min={0} max={XMAX} step={0.1} value={s} onChange={(e) => setS(Number(e.target.value))} className="w-full accent-[var(--blob)]" />
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-ink">{f(s)}</span>
        </label>
        <label className={cn("flex items-center gap-3 text-[13px] text-ink-2", mode === "none" && "opacity-40")}>
          <span className="w-24 shrink-0">{t(tx("Inhibitor", "Hemmstoff"))}</span>
          <input type="range" min={0} max={3} step={0.5} value={inh} disabled={mode === "none"} onChange={(e) => setInh(Number(e.target.value))} className="w-full accent-[var(--blob)]" />
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-ink">{f(inh)}</span>
        </label>
      </div>

      <motion.p
        key={`${mode}-${mode === "none" ? (s >= 12 ? 2 : Math.abs(s - KM) < 0.15 ? 1 : 0) : inh}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[3.2rem] rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        <Inline text={info} />
      </motion.p>
    </div>
  );
}
