"use client";

// Level 3: the Calvin cycle in the stroma. Step through fixation (Rubisco binds CO2 to RuBP),
// reduction (3-PG to G3P with ATP and NADPH), the export of G3P and the regeneration of RuBP,
// with molecules drawn as carbon chains and running totals. "Per glucose" doubles everything.
// PhotoCalvinGraph is the classic light-off / CO2-off experiment as a task picture.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { PhotoCO2, PhotoPill } from "./PhotoMolecules";
import { cos, sin } from "@/lib/stableMath";

const OUT = "var(--bio-outline)";
const W = 600;
const H = 400;
const CX = 300;
const CY = 200;
const R = 106;
const pt = (deg: number): [number, number] => [CX + R * cos((deg * Math.PI) / 180), CY + R * sin((deg * Math.PI) / 180)];

/** A molecule as a chain of carbon beads with phosphate groups. */
function Chain({ c, p }: { c: number; p: "one" | "both" }) {
  const beads = [...(p === "both" ? ["P"] : []), ...Array.from({ length: c }, () => "C"), "P"];
  return (
    <g>
      <line x1={0} x2={(beads.length - 1) * 8.4} y1={0} y2={0} stroke={OUT} strokeWidth={1.4} />
      {beads.map((b, i) =>
        b === "C" ? <circle key={i} cx={i * 8.4} r={3.9} fill={OUT} /> : <circle key={i} cx={i * 8.4} r={3.3} fill="var(--bio-pollen)" stroke={OUT} strokeWidth={1} />,
      )}
    </g>
  );
}

function Pool({ x, y, label, n, kind, lit }: { x: number; y: number; label: Text; n: number; kind: "rubp" | "pg" | "g3p"; lit: boolean }) {
  const t = useText();
  const wide = kind === "rubp";
  const cols = wide ? 2 : 4;
  const cw = wide ? 64 : 36;
  const rows = Math.max(1, Math.ceil((wide ? 6 : 12) / cols));
  const w = cols * cw + 14;
  const h = rows * 14 + 30;
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={12} fill="var(--raised)" stroke={lit ? "var(--blob)" : "var(--line-2)"} strokeWidth={lit ? 2.4 : 1.4} />
      <text x={x - w / 2 + 10} y={y - h / 2 + 16} fontSize={13} fontWeight={700} className="fill-ink">
        {t(label)}
      </text>
      <text x={x + w / 2 - 10} y={y - h / 2 + 16} fontSize={13} fontWeight={700} textAnchor="end" className="fill-blob-ink tabular-nums">
        {n}×
      </text>
      <AnimatePresence>
        {Array.from({ length: n }, (_, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ delay: i * 0.05 }}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <g transform={`translate(${x - w / 2 + 12 + (i % cols) * cw} ${y - h / 2 + 30 + Math.floor(i / cols) * 14})`}>
              <Chain c={kind === "rubp" ? 5 : 3} p={kind === "rubp" ? "both" : "one"} />
            </g>
          </motion.g>
        ))}
      </AnimatePresence>
    </g>
  );
}

function Fly({ from, to, at = 0, dur = 1.1, children }: { from: [number, number]; to: [number, number]; at?: number; dur?: number; children: ReactNode }) {
  return (
    <motion.g initial={{ x: from[0], y: from[1], opacity: 0 }} animate={{ x: [from[0], to[0]], y: [from[1], to[1]], opacity: [0, 1, 1, 0] }} transition={{ delay: at, duration: dur, ease: "easeInOut", opacity: { delay: at, duration: dur, times: [0, 0.15, 0.8, 1] } }}>
      {children}
    </motion.g>
  );
}

type Phase = 0 | 1 | 2 | 3 | 4;

const PHASES: { title: Text; text: (n: number) => Text }[] = [
  {
    title: tx("Start", "Start"),
    text: (n) => tx(`${3 * n} molecules of ribulose-1,5-bisphosphate (RuBP, 5 C each) are waiting in the stroma for CO₂.`, `${3 * n} Moleküle Ribulose-1,5-bisphosphat (RuBP, je 5 C) warten im Stroma auf CO₂.`),
  },
  {
    title: tx("1. Fixation", "1. Fixierung"),
    text: (n) =>
      tx(
        `The enzyme Rubisco binds ${3 * n} CO₂ to ${3 * n} RuBP. Each unstable C₆ intermediate splits at once into two 3-phosphoglycerate (3-PG): ${6 * n} molecules with 3 C.`,
        `Das Enzym Rubisco bindet ${3 * n} CO₂ an ${3 * n} RuBP. Jedes instabile C₆-Zwischenprodukt zerfällt sofort in zwei 3-Phosphoglycerat (3-PG): ${6 * n} Moleküle mit 3 C.`,
      ),
  },
  {
    title: tx("2. Reduction", "2. Reduktion"),
    text: (n) =>
      tx(
        `Using ${6 * n} ATP and ${6 * n} NADPH from the light reactions, 3-PG is reduced to glyceraldehyde 3-phosphate (G3P). ADP, P and NADP⁺ go back to the thylakoids.`,
        `Mit ${6 * n} ATP und ${6 * n} NADPH aus den Lichtreaktionen wird 3-PG zu Glycerinaldehyd-3-phosphat (GAP) reduziert. ADP, P und NADP⁺ gehen zurück zu den Thylakoiden.`,
      ),
  },
  {
    title: tx("3. Gain", "3. Gewinn"),
    text: (n) =>
      tx(
        `${n === 1 ? "One G3P leaves" : "Two G3P leave"} the cycle: that's the gain. ${n === 1 ? "Two of them" : "These two"} make one glucose; from it the plant builds sucrose, starch and much more.`,
        `${n === 1 ? "Ein GAP verlässt" : "Zwei GAP verlassen"} den Kreislauf: Das ist der Gewinn. Aus zwei GAP entsteht eine Glucose, daraus baut die Pflanze Saccharose, Stärke und vieles mehr.`,
      ),
  },
  {
    title: tx("4. Regeneration", "4. Regeneration"),
    text: (n) =>
      tx(
        `The remaining ${5 * n} G3P (${15 * n} C) are rebuilt into ${3 * n} RuBP (${15 * n} C), using another ${3 * n} ATP. The cycle can start again.`,
        `Die übrigen ${5 * n} GAP (${15 * n} C) werden mit weiteren ${3 * n} ATP zu ${3 * n} RuBP (${15 * n} C) umgebaut. Der Zyklus kann von vorn beginnen.`,
      ),
  },
];

export function PhotoCalvin() {
  const t = useText();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(0);
  const [glucose, setGlucose] = useState(false);
  const n = glucose ? 2 : 1;
  const rubp = phase === 0 || phase === 4 ? 3 * n : 0;
  const pg = phase === 1 ? 6 * n : 0;
  const g3p = phase === 2 ? 6 * n : phase === 3 ? 5 * n : 0;
  const tally = {
    co2: phase >= 1 ? 3 * n : 0,
    atp: phase >= 4 ? 9 * n : phase >= 2 ? 6 * n : 0,
    nadph: phase >= 2 ? 6 * n : 0,
    out: phase >= 3 ? n : 0,
  };
  const next = () => setPhase((p) => (p >= 4 ? 0 : ((p + 1) as Phase)));

  const [fx, fy] = pt(-90);
  const rubpAt: [number, number] = [110, 120];
  const pgAt: [number, number] = [490, 120];
  const g3pAt: [number, number] = [300, 360];
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const ATP = <PhotoPill label="ATP" fill="var(--bio-mito)" w={36} />;
  const NADPH = <PhotoPill label="NADPH" fill="var(--bio-petal)" w={50} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(tx("How much", "Wie viel"))}>
        {[
          { g: false, label: tx("3 CO₂ (one G3P)", "3 CO₂ (ein GAP)") },
          { g: true, label: tx("6 CO₂ (one glucose)", "6 CO₂ (eine Glucose)") },
        ].map((o) => (
          <button
            key={String(o.g)}
            type="button"
            aria-pressed={glucose === o.g}
            onClick={() => {
              setGlucose(o.g);
              setPhase(0);
            }}
            className={cn("h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", glucose === o.g ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(o.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="rounded-xl border border-line bg-surface">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("The Calvin cycle", "Der Calvin-Zyklus"))}>
            <defs>
              <marker id="photo-calvin-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse">
                <path d="M0 0 L 10 5 L 0 10 z" fill="var(--ink-2)" />
              </marker>
            </defs>
            {/* the three arcs */}
            {[
              { d: arc(-148, -32), on: phase === 1, label: tx("fixation", "Fixierung"), at: [300, 62] as [number, number] },
              { d: arc(-20, 78), on: phase === 2, label: tx("reduction", "Reduktion"), at: [454, 250] as [number, number] },
              { d: arc(102, 200), on: phase === 4, label: tx("regeneration", "Regeneration"), at: [146, 250] as [number, number] },
            ].map((a, i) => (
              <g key={i}>
                <path d={a.d} fill="none" stroke={a.on ? "var(--blob)" : "var(--ink-3)"} strokeWidth={a.on ? 5 : 3} markerEnd="url(#photo-calvin-arrow)" strokeLinecap="round" />
                <text x={a.at[0]} y={a.at[1]} textAnchor="middle" fontSize={14} fontWeight={700} className={a.on ? "fill-blob-ink" : "fill-ink-2"}>
                  {t(a.label)}
                </text>
              </g>
            ))}
            <text x={CX} y={CY - 6} textAnchor="middle" fontSize={15} fontWeight={700} className="fill-ink-2">
              {t(tx("Calvin cycle", "Calvin-Zyklus"))}
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" fontSize={11.5} className="fill-ink-3">
              {t(tx("in the stroma", "im Stroma"))}
            </text>
            {/* Rubisco on the fixation arc */}
            <g transform={`translate(${fx} ${fy})`}>
              <rect x={-30} y={-11} width={60} height={22} rx={11} fill="var(--bio-leaf)" stroke={phase === 1 ? "var(--blob)" : "var(--bio-leaf-deep)"} strokeWidth={phase === 1 ? 2.4 : 1.4} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={700} fill="var(--ink)">
                Rubisco
              </text>
            </g>
            {/* inputs at rest */}
            <g transform="translate(300 22)">
              <PhotoCO2 s={1.4} />
              <text x={18} y={4} fontSize={12} fontWeight={700} className="fill-ink-2">
                {3 * n} CO₂
              </text>
            </g>
            <g transform="translate(548 214)" opacity={phase === 2 ? 1 : 0.55}>
              {ATP}
              <text x={0} y={-14} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
                {6 * n}×
              </text>
            </g>
            <g transform="translate(548 252)" opacity={phase === 2 ? 1 : 0.55}>
              {NADPH}
              <text x={0} y={22} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
                {6 * n}×
              </text>
            </g>
            <g transform="translate(46 214)" opacity={phase === 4 ? 1 : 0.55}>
              {ATP}
              <text x={0} y={-14} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
                {3 * n}×
              </text>
            </g>
            {/* export */}
            <path d="M 382 372 L 466 388" fill="none" stroke={phase === 3 ? "var(--blob)" : "var(--ink-3)"} strokeWidth={phase === 3 ? 4 : 2.4} markerEnd="url(#photo-calvin-arrow)" />
            <text x={474} y={393} fontSize={12} className="fill-ink-2">
              {t(tx("glucose, starch…", "Glucose, Stärke…"))}
            </text>

            <Pool x={rubpAt[0]} y={rubpAt[1]} label={tx("RuBP (C₅)", "RuBP (C₅)")} n={rubp} kind="rubp" lit={phase === 0 || phase === 4} />
            <Pool x={pgAt[0]} y={pgAt[1]} label={tx("3-PG (C₃)", "3-PG (C₃)")} n={pg} kind="pg" lit={phase === 1} />
            <Pool x={g3pAt[0]} y={g3pAt[1]} label={tx("G3P (C₃)", "GAP (C₃)")} n={g3p} kind="g3p" lit={phase === 2 || phase === 3} />

            {!reduce && (
              <g key={`${phase}-${n}`}>
                {phase === 1 && (
                  <Fly from={[300, 22]} to={[fx, fy + 8]} dur={1}>
                    <PhotoCO2 s={1.4} />
                  </Fly>
                )}
                {phase === 2 && (
                  <>
                    <Fly from={[548, 214]} to={pt(20)}>
                      {ATP}
                    </Fly>
                    <Fly from={[548, 252]} to={pt(28)} at={0.15}>
                      {NADPH}
                    </Fly>
                    <Fly from={pt(50)} to={[560, 330]} at={1.1}>
                      <PhotoPill label="NADP⁺" fill="var(--bio-petal)" w={46} />
                    </Fly>
                  </>
                )}
                {phase === 3 && (
                  <Fly from={[330, 372]} to={[470, 390]} dur={1.3}>
                    <Chain c={3} p="one" />
                  </Fly>
                )}
                {phase === 4 && (
                  <Fly from={[46, 214]} to={pt(160)}>
                    {ATP}
                  </Fly>
                )}
              </g>
            )}
          </svg>
        </div>

        <div className="space-y-2">
          {[
            { label: tx("CO₂ fixed", "CO₂ fixiert"), v: tally.co2 },
            { label: tx("ATP used", "ATP verbraucht"), v: tally.atp },
            { label: tx("NADPH used", "NADPH verbraucht"), v: tally.nadph },
            { label: tx("G3P gained", "GAP gewonnen"), v: tally.out },
          ].map((r) => (
            <div key={t(r.label)} className="flex items-baseline justify-between rounded-xl border border-line bg-surface px-3 py-2">
              <span className="text-[13.5px] text-ink-2">{t(r.label)}</span>
              <motion.span key={r.v} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-math text-[22px] tabular-nums text-ink">
                {r.v}
              </motion.span>
            </div>
          ))}
          <p className="px-1 text-[12.5px] leading-snug text-ink-3">
            {t(
              tx(
                `Carbon check: ${3 * n} RuBP (${15 * n} C) + ${3 * n} CO₂ (${3 * n} C) = ${18 * n} C = ${6 * n} × 3 C.`,
                `Kohlenstoff-Probe: ${3 * n} RuBP (${15 * n} C) + ${3 * n} CO₂ (${3 * n} C) = ${18 * n} C = ${6 * n} × 3 C.`,
              ),
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={next} className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
          {phase === 4 ? <RotateCcw className="size-4" /> : null}
          {phase === 4 ? t(tx("Next turn", "Nächste Runde")) : t(tx("Next phase", "Nächste Phase"))}
          {phase < 4 && <ChevronRight className="size-4" />}
        </button>
        <div className="flex flex-1 justify-end gap-1.5">
          {PHASES.map((p, i) => (
            <button key={i} type="button" onClick={() => setPhase(i as Phase)} className={cn("h-2 rounded-full transition-all", i === phase ? "w-6 bg-blob" : "w-2 bg-line-2 hover:bg-ink-3")} aria-label={t(p.title)} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${phase}-${n}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className="rounded-xl bg-blob-soft/70 px-4 py-3 text-[14.5px] leading-relaxed text-ink"
          aria-live="polite"
        >
          <span className="font-semibold">{t(PHASES[phase].title)}.</span> {t(PHASES[phase].text(n))}
          {phase === 4 && (
            <span className="mt-1 block font-medium">
              {t(tx(`Per turn: ${3 * n} CO₂, ${9 * n} ATP and ${6 * n} NADPH for ${n} G3P.`, `Pro Runde: ${3 * n} CO₂, ${9 * n} ATP und ${6 * n} NADPH für ${n} GAP.`))}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The light-off / CO2-off experiment

export function PhotoCalvinGraph({ event, risingLabel }: { event: "dark" | "noco2"; risingLabel: "A" | "B" }) {
  const t = useText();
  const w = 420;
  const h = 230;
  const m = { l: 40, r: 16, t: 16, b: 36 };
  const X = (s: number) => m.l + (s / 12) * (w - m.l - m.r);
  const Y = (c: number) => h - m.b - (c / 2.2) * (h - m.t - m.b);
  const rise = (s: number) => (s < 5 ? 1 : 1 + 0.9 * (1 - Math.exp(-(s - 5) / 1.1)));
  const fall = (s: number) => (s < 5 ? 0.9 : 0.12 + 0.78 * Math.exp(-(s - 5) / 0.9));
  const path = (f: (s: number) => number) => Array.from({ length: 121 }, (_, i) => `${i ? "L" : "M"}${X(i / 10).toFixed(1)} ${Y(f(i / 10)).toFixed(1)}`).join(" ");
  const other = risingLabel === "A" ? "B" : "A";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(tx("Concentrations in the Calvin cycle over time", "Konzentrationen im Calvin-Zyklus über der Zeit"))}>
      <rect x={X(5)} y={m.t} width={X(12) - X(5)} height={h - m.t - m.b} fill={event === "dark" ? "var(--bio-nucleus)" : "var(--bio-vacuole)"} opacity={0.35} />
      <line x1={X(5)} x2={X(5)} y1={m.t} y2={h - m.b} stroke="var(--ink-2)" strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={X(5) + 6} y={m.t + 14} fontSize={12} fontWeight={700} className="fill-ink">
        {event === "dark" ? t(tx("light off", "Licht aus")) : t(tx("CO₂ removed", "CO₂ entfernt"))}
      </text>
      <line x1={m.l} x2={m.l} y1={m.t - 4} y2={h - m.b} stroke="var(--ink-2)" strokeWidth={1.3} />
      <line x1={m.l} x2={w - m.r + 4} y1={h - m.b} y2={h - m.b} stroke="var(--ink-2)" strokeWidth={1.3} />
      <text x={w - m.r} y={h - 12} textAnchor="end" fontSize={11.5} className="fill-ink-2">
        {t(tx("time", "Zeit"))}
      </text>
      <text x={m.l + 6} y={m.t + 2} fontSize={11.5} className="fill-ink-2">
        {t(tx("concentration", "Konzentration"))}
      </text>
      <path d={path(rise)} fill="none" stroke="var(--blob)" strokeWidth={2.8} />
      <path d={path(fall)} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={2.8} strokeDasharray="8 5" />
      <text x={X(11.4)} y={Y(rise(11.4)) - 8} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-ink">
        {risingLabel}
      </text>
      <text x={X(11.4)} y={Y(fall(11.4)) - 8} textAnchor="middle" fontSize={14} fontWeight={700} className="fill-ink">
        {other}
      </text>
    </svg>
  );
}
