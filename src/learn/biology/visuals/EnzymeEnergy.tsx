"use client";

// Energy diagram of a reaction with and without enzyme: the enzyme lowers the activation energy,
// the energy of reactants and products stays the same. In the widget a column of particles shows
// how many have enough energy at body temperature to get over the hill.

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, useState } from "react";
import { tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

const X0 = 64;
const W = 380;
const Y0 = 262;
const K = 2.05;
const xs = (t: number) => X0 + t * W;
const ys = (e: number) => Y0 - e * K;
const r2 = (v: number) => Math.round(v * 100) / 100;

const LEVELS = {
  exo: { r: 50, p: 14, high: 102, low: 72 },
  endo: { r: 18, p: 52, high: 100, low: 72 },
};

function energyAt(t: number, r: number, p: number, peak: number) {
  const u = Math.min(1, Math.max(0, (t - 0.34) / 0.34));
  const s = u * u * (3 - 2 * u);
  const b = Math.exp(-(((t - 0.5) / 0.115) ** 2));
  return r + (p - r) * s + (peak - (r + p) / 2) * b;
}
function pathOf(r: number, p: number, peak: number) {
  let d = "";
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    d += `${i ? "L" : "M"} ${r2(xs(t))} ${r2(ys(energyAt(t, r, p, peak)))} `;
  }
  return d.trim();
}
function topOf(r: number, p: number, peak: number) {
  let best = { t: 0.5, e: -Infinity };
  for (let i = 300; i <= 700; i++) {
    const e = energyAt(i / 1000, r, p, peak);
    if (e > best.e) best = { t: i / 1000, e };
  }
  return best;
}

function Arrow({ x, from, to, id, label, dashedFrom, right }: { x: number; from: number; to: number; id: string; label?: string; dashedFrom?: number; right?: boolean }) {
  return (
    <g>
      {dashedFrom !== undefined && <line x1={dashedFrom} x2={x + 6} y1={to} y2={to} stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 4" />}
      <line x1={x} x2={x} y1={from} y2={to + (to < from ? 3 : -3)} stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${id})`} markerStart={`url(#${id})`} />
      {label && <ArrowLabel x={right ? x + 30 : x} y={(from + to) / 2} text={label} />}
    </g>
  );
}

function ArrowLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <circle cx={x - 15} cy={y} r={10.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={1.6} />
      <text x={x - 15} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--blob-ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {text}
      </text>
    </g>
  );
}

function Frame({ children, id }: { children: React.ReactNode; id: string }) {
  const t = useText();
  return (
    <svg viewBox="0 0 470 300" className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("Energy diagram of a reaction with and without enzyme", "Energiediagramm einer Reaktion mit und ohne Enzym"))}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--blob)" />
        </marker>
        <marker id={`${id}-ax`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--ink-3)" />
        </marker>
      </defs>
      <line x1={X0 - 18} y1={Y0 + 16} x2={X0 - 18} y2={20} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-ax)`} />
      <line x1={X0 - 18} y1={Y0 + 16} x2={xs(1) + 14} y2={Y0 + 16} stroke="var(--ink-3)" strokeWidth={1.4} markerEnd={`url(#${id}-ax)`} />
      <text x={X0 - 10} y={24} fontSize={13} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("Energy", "Energie"))}
      </text>
      <text x={xs(1) + 10} y={Y0 + 34} fontSize={13} textAnchor="end" fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("Course of reaction", "Reaktionsverlauf"))}
      </text>
      {children}
    </svg>
  );
}

function Levels({ r, p }: { r: number; p: number }) {
  const t = useText();
  return (
    <>
      <text x={xs(0.02)} y={ys(r) + 20} fontSize={14} fontWeight={600} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("Substrate", "Substrat"))}
      </text>
      <text x={xs(0.84)} y={ys(p) - 9} fontSize={14} fontWeight={600} textAnchor="middle" fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("Products", "Produkte"))}
      </text>
    </>
  );
}

function Legend() {
  const t = useText();
  return (
    <g fontSize={12.5} style={{ fontFamily: "var(--font-sans)" }}>
      <line x1={318} x2={344} y1={26} y2={26} stroke="var(--ink-3)" strokeWidth={2.2} strokeDasharray="6 5" />
      <text x={350} y={30} fill="var(--ink-2)">
        {t(tx("without enzyme", "ohne Enzym"))}
      </text>
      <line x1={318} x2={344} y1={46} y2={46} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
      <text x={350} y={50} fill="var(--ink-2)">
        {t(tx("with enzyme", "mit Enzym"))}
      </text>
    </g>
  );
}

/**
 * The static diagram for tasks: both curves, three numbered arrows.
 * `labels` = numbers for [activation energy without enzyme, with enzyme, reaction energy].
 */
export function EnzymeEnergyDiagram({ kind = "exo", labels }: { kind?: "exo" | "endo"; labels: [string, string, string] }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const L = LEVELS[kind];
  const hi = topOf(L.r, L.p, L.high);
  const lo = topOf(L.r, L.p, L.low);
  return (
    <Frame id={id}>
      <line x1={xs(0.16)} x2={xs(0.96)} y1={ys(L.r)} y2={ys(L.r)} stroke="var(--line-2)" strokeWidth={1.2} strokeDasharray="4 4" />
      <path d={pathOf(L.r, L.p, L.high)} fill="none" stroke="var(--ink-3)" strokeWidth={2.2} strokeDasharray="6 5" />
      <path d={pathOf(L.r, L.p, L.low)} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
      <Levels r={L.r} p={L.p} />
      <Arrow id={id} x={xs(0.2)} from={ys(L.r)} to={ys(hi.e)} label={labels[0]} dashedFrom={xs(hi.t)} />
      <Arrow id={id} x={xs(0.29)} from={ys(L.r)} to={ys(lo.e)} label={labels[1]} dashedFrom={xs(lo.t)} right />
      <Arrow id={id} x={xs(0.95)} from={ys(L.r)} to={ys(L.p)} label={labels[2]} />
      <Legend />
    </Frame>
  );
}

/** Particles' energies at body temperature: quantiles of an exponential distribution above the substrate level. */
const N = 40;
const KT = 11;
const PARTICLES = Array.from({ length: N }, (_, i) => {
  const q = (i + 0.5) / N;
  return { e: -KT * Math.log(1 - q), x: 8 + ((i * 37) % 47) };
});

export function EnzymeEnergy() {
  const t = useText();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  const [enzyme, setEnzyme] = useState(false);
  const L = LEVELS.exo;
  const peak = useSpring(L.high, { stiffness: 120, damping: 20 });
  useEffect(() => {
    if (reduce) peak.jump(enzyme ? L.low : L.high);
    else peak.set(enzyme ? L.low : L.high);
  }, [enzyme, peak, reduce, L.low, L.high]);
  const d = useTransform(peak, (v) => pathOf(L.r, L.p, v));
  const top = topOf(L.r, L.p, enzyme ? L.low : L.high);
  const ea = top.e - L.r;
  const topY = useTransform(peak, (v) => r2(ys(topOf(L.r, L.p, v).e)));
  const eaTip = useTransform(topY, (v) => v + 3);
  const eaLabelY = useTransform(topY, (v) => (v + ys(L.r)) / 2);
  const over = PARTICLES.filter((p) => p.e >= ea).length;

  const info: Text = enzyme
    ? txMap((tt) =>
        tt(
          `With the enzyme the hill is much lower: **${over} of ${N}** particles now have enough energy. The reaction runs many times faster at body temperature. Look at ΔE: it hasn't changed.`,
          `Mit Enzym ist der Berg viel niedriger: Jetzt haben **${over} von ${N}** Teilchen genug Energie. Die Reaktion läuft bei Körpertemperatur um ein Vielfaches schneller. Schau auf ΔE: Es hat sich nicht verändert.`,
        ),
      )
    : txMap((tt) =>
        tt(
          `Without an enzyme the energy hill (activation energy, $E_A$) is high. At body temperature **${over} of ${N}** particles have enough energy to get over it, so the reaction hardly runs.`,
          `Ohne Enzym ist der Energieberg (Aktivierungsenergie, $E_A$) hoch. Bei Körpertemperatur haben **${over} von ${N}** Teilchen genug Energie, um ihn zu überwinden: Die Reaktion läuft so gut wie nicht.`,
        ),
      );

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line p-0.5">
        {[false, true].map((on) => (
          <button
            key={String(on)}
            type="button"
            onClick={() => setEnzyme(on)}
            className={cn("relative rounded-md px-3.5 py-1.5 text-[13px] font-medium", enzyme === on ? "text-ink" : "text-ink-3 hover:text-ink")}
          >
            {enzyme === on && <motion.span layoutId="enzyme-energy-tab" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{on ? t(tx("With enzyme", "Mit Enzym")) : t(tx("Without enzyme", "Ohne Enzym"))}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <Frame id={id}>
          <line x1={xs(0.16)} x2={xs(0.97)} y1={ys(L.r)} y2={ys(L.r)} stroke="var(--line-2)" strokeWidth={1.2} strokeDasharray="4 4" />
          {enzyme && <path d={pathOf(L.r, L.p, L.high)} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />}
          <motion.path d={d} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
          <Levels r={L.r} p={L.p} />
          {/* threshold line: particles above it make it over the hill */}
          <motion.line x1={xs(0.0)} x2={xs(0.64)} y1={topY} y2={topY} stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="2 4" />
          {PARTICLES.map((p, i) => {
            const ok = p.e >= ea;
            return (
              <motion.circle
                key={i}
                cx={xs(0.03) + p.x * 1.6}
                cy={ys(L.r + p.e) - 5}
                r={4.2}
                initial={false}
                animate={{ fill: ok ? "var(--blob)" : "var(--bio-sun)", scale: ok ? 1.15 : 1 }}
                stroke={ok ? "var(--blob)" : "var(--bio-nerve-deep)"}
                strokeWidth={1.2}
              />
            );
          })}
          <motion.line x1={xs(0.62)} x2={xs(0.62)} y1={ys(L.r)} y2={eaTip} stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${id})`} markerStart={`url(#${id})`} />
          <motion.text x={xs(0.62) + 8} y={eaLabelY} fontSize={15} fontWeight={600} fill="var(--blob-ink)" style={{ fontFamily: "var(--font-sans)" }}>
            E
            <tspan fontSize="0.72em" dy="0.3em">
              A
            </tspan>
          </motion.text>
          <line x1={xs(0.96)} x2={xs(0.96)} y1={ys(L.r)} y2={ys(L.p) - 3} stroke="var(--blob)" strokeWidth={2} markerEnd={`url(#${id})`} />
          <text x={xs(0.96) - 8} y={(ys(L.r) + ys(L.p)) / 2 + 4} textAnchor="end" fontSize={15} fontWeight={600} fill="var(--blob-ink)" style={{ fontFamily: "var(--font-sans)" }}>
            ΔE
          </text>
          {enzyme && <Legend />}
        </Frame>
      </div>

      <motion.p
        key={String(enzyme)}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl px-3.5 py-2.5 text-[14.5px] leading-relaxed", enzyme ? "bg-ok/10 text-ink" : "bg-hover/60 text-ink-2")}
        aria-live="polite"
      >
        <Inline text={info} />
      </motion.p>
    </div>
  );
}
