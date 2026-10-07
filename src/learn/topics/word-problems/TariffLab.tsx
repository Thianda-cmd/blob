"use client";

// Widget: compare two tariffs. Each tariff costs a basic fee plus a price per unit
// (km, minute, visit), so its graph is a straight line. Where the lines cross, both
// cost the same (break-even point); on either side a different tariff is cheaper.

import { motion } from "motion/react";
import { useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { clean, eu, mn, nf } from "./kit";
import { BlobLine, HowTo, Label, Segmented, Slider, soft, Stepper } from "./ui";

type Tariff = { name: Text; base: number; rate: number };
type Case = {
  id: string;
  label: Text;
  story: Text;
  unit: Text;
  /** x axis: "km", "min", "Besuche" */
  axis: Text;
  max: number;
  step: number;
  baseStep: number;
  rateStep: number;
  start: number;
  a: Tariff;
  b: Tariff;
};

const CASES: Case[] = [
  {
    id: "taxi",
    label: tx("Taxi", "Taxi"),
    story: tx("Two taxi firms: a basic fare plus a price per kilometre.", "Zwei Taxiunternehmen: Grundpreis plus Preis pro Kilometer."),
    unit: "km",
    axis: "km",
    max: 12,
    step: 0.5,
    baseStep: 0.5,
    rateStep: 0.1,
    start: 3,
    a: { name: tx("Taxi A", "Taxi A"), base: 4, rate: 2 },
    b: { name: tx("Taxi B", "Taxi B"), base: 7, rate: 1.5 },
  },
  {
    id: "phone",
    label: tx("Phone", "Handy"),
    story: tx("Two prepaid phone plans: a monthly fee plus a price per minute.", "Zwei Prepaid-Tarife: Grundgebühr pro Monat plus Preis pro Minute."),
    unit: "min",
    axis: tx("minutes", "Minuten"),
    max: 200,
    step: 5,
    baseStep: 1,
    rateStep: 0.01,
    start: 40,
    a: { name: tx("Plan A", "Tarif A"), base: 0, rate: 0.1 },
    b: { name: tx("Plan B", "Tarif B"), base: 5, rate: 0.05 },
  },
  {
    id: "gym",
    label: tx("Gym", "Fitness"),
    story: tx("A gym: pay per visit, or a monthly fee plus a smaller price per visit.", "Ein Fitnessstudio: pro Besuch zahlen oder Monatsbeitrag plus kleineren Preis pro Besuch."),
    unit: tx("visits", "Besuche"),
    axis: tx("visits", "Besuche"),
    max: 12,
    step: 1,
    baseStep: 5,
    rateStep: 0.5,
    start: 3,
    a: { name: tx("Single tickets", "Einzelkarte"), base: 0, rate: 8 },
    b: { name: tx("Monthly plan", "Monatsabo"), base: 30, rate: 3 },
  },
];

const VW = 360;
const VH = 230;
const ML = 40;
const MR = 14;
const MT = 14;
const MB = 30;

function niceMax(v: number) {
  const steps = [10, 20, 25, 40, 50, 60, 80, 100, 120, 150, 200];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 50) * 50;
}

const cost = (t: Tariff, x: number) => clean(t.base + t.rate * x, 4);
const termSrc = (t: Tariff, sub: string, l: Locale) =>
  `K_{${sub}}#k${sub} =#e${sub} ${t.base ? `${mn(t.base, l, `b${sub}`)} +#p${sub} ` : ""}${mn(t.rate, l, `r${sub}`)} \\cdot#d${sub} x#x${sub}`;

export function TariffLab() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [caseId, setCaseId] = useState("taxi");
  const c0 = CASES.find((c) => c.id === caseId)!;
  const [edits, setEdits] = useState<Record<string, { a: Tariff; b: Tariff }>>({});
  const [xs, setXs] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState(false);
  const a = edits[c0.id]?.a ?? c0.a;
  const b = edits[c0.id]?.b ?? c0.b;
  const x = xs[c0.id] ?? c0.start;

  const ka = cost(a, x);
  const kb = cost(b, x);
  const ymax = niceMax(Math.max(cost(a, c0.max), cost(b, c0.max), 10) * 1.05);
  const sx = (v: number) => ML + (v / c0.max) * (VW - ML - MR);
  const sy = (v: number) => VH - MB - (v / ymax) * (VH - MT - MB);
  const cross = a.rate !== b.rate ? clean((b.base - a.base) / (a.rate - b.rate), 4) : null;
  const crossIn = cross !== null && cross > 0 && cross <= c0.max;
  const unit = t(c0.unit);
  const cheaper = Math.abs(ka - kb) < 1e-9 ? null : ka < kb ? "a" : "b";

  const setX = (v: number) => setXs((o) => ({ ...o, [c0.id]: Math.min(c0.max, Math.max(0, clean(Math.round(v / c0.step) * c0.step, 4))) }));
  const edit = (which: "a" | "b", field: "base" | "rate", d: number) =>
    setEdits((o) => {
      const cur = o[c0.id] ?? { a: c0.a, b: c0.b };
      const tar = cur[which];
      const step = field === "base" ? c0.baseStep : c0.rateStep;
      const v = clean(tar[field] + d * step, 4);
      if (v < 0 || (field === "rate" && v <= 0)) return o;
      return { ...o, [c0.id]: { ...cur, [which]: { ...tar, [field]: v } } };
    });

  function pick(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    setX(((p.x - ML) / (VW - ML - MR)) * c0.max);
  }

  const ticksX = Array.from({ length: 5 }, (_, i) => clean((c0.max / 4) * i, 2));
  const ticksY = Array.from({ length: 5 }, (_, i) => (ymax / 4) * i);

  const say: Text =
    cross === null
      ? tx(
          "Same price per unit: the lines are parallel, they never meet. The one with the smaller basic fee is always cheaper.",
          "Gleicher Preis pro Einheit: Die Geraden sind parallel und treffen sich nie. Der Tarif mit der kleineren Grundgebühr ist immer günstiger.",
        )
      : !crossIn
        ? tx("The lines don't cross in this range: here one tariff is always cheaper.", "Die Geraden schneiden sich in diesem Bereich nicht: Hier ist ein Tarif immer günstiger.")
        : Math.abs(x - cross) < 1e-9
          ? tx(`Break-even! At ${nf(cross, l)} ${unit} both cost ${eu(cost(a, cross), l)} €.`, `Gleichstand! Bei ${nf(cross, l)} ${unit} kosten beide ${eu(cost(a, cross), l)} €.`)
          : x < cross
            ? tx(
                `Left of the crossing point (${nf(cross, l)} ${unit}) the tariff with the smaller basic fee wins.`,
                `Links vom Schnittpunkt (${nf(cross, l)} ${unit}) gewinnt der Tarif mit der kleineren Grundgebühr.`,
              )
            : tx(
                `Right of the crossing point (${nf(cross, l)} ${unit}) the smaller price per unit wins.`,
                `Rechts vom Schnittpunkt (${nf(cross, l)} ${unit}) gewinnt der kleinere Preis pro Einheit.`,
              );

  const card = (tar: Tariff, which: "a" | "b", k: number) => (
    <div className={cn("rounded-xl border px-3.5 py-3 transition-colors", cheaper === which ? "border-ok/50 bg-ok/10" : "border-line bg-surface")}>
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", which === "a" ? "bg-ink-2" : "bg-blob")} />
        <Label>{t(tar.name)}</Label>
        {cheaper === which && <span className="ml-auto rounded-full bg-ok px-2 py-0.5 text-[11px] font-semibold text-white">{t(tx("cheaper", "günstiger"))}</span>}
      </div>
      <div className="mt-1.5">
        <MathView src={termSrc(tar, which.toUpperCase(), l)} size="sm" scope={`${id}-${which}`} />
      </div>
      <div className="mt-1 font-math text-[20px] tabular-nums text-ink">
        {eu(k, l)} €
        <span className="ml-1.5 font-sans text-[12.5px] text-ink-3">
          {t(tx(`for ${nf(x, l)} ${unit}`, `bei ${nf(x, l)} ${unit}`))}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
        <Stepper label={tx("Basic fee", "Grundgebühr")} value={`${eu(tar.base, l)} €`} onDec={() => edit(which, "base", -1)} onInc={() => edit(which, "base", 1)} canDec={tar.base > 0} />
        <Stepper label={tx("Per unit", "Pro Einheit")} value={`${eu(tar.rate, l)} €`} onDec={() => edit(which, "rate", -1)} onInc={() => edit(which, "rate", 1)} canDec={tar.rate > c0.rateStep} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "Each tariff costs a basic fee plus a price per unit. Slide along the x-axis (or tap the graph), and change the tariffs with − and +.",
          "Jeder Tarif kostet eine Grundgebühr plus einen Preis pro Einheit. Fahr an der x-Achse entlang (oder tipp in den Graphen) und ändere die Tarife mit − und +.",
        )}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented id={`${id}-case`} label={tx("Example", "Beispiel")} value={caseId} onChange={setCaseId} options={CASES.map((c) => ({ value: c.id, label: c.label }))} />
        <span className="text-[13px] text-ink-3">{t(c0.story)}</span>
      </div>

      <div className="mx-auto max-w-[620px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={t(tx("Cost graphs of both tariffs", "Kostengraphen beider Tarife"))}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDrag(true);
            pick(e);
          }}
          onPointerMove={(e) => {
            if (drag) pick(e);
          }}
          onPointerUp={() => setDrag(false)}
          onPointerLeave={() => setDrag(false)}
          style={{ cursor: "crosshair" }}
        >
          {ticksY.map((v) => (
            <g key={`y${v}`}>
              <line x1={ML} x2={VW - MR} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.4 : 0.8} />
              <text x={ML - 6} y={sy(v) + 4} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {nf(v, l, 0)} €
              </text>
            </g>
          ))}
          {ticksX.map((v) => (
            <text key={`x${v}`} x={sx(v)} y={VH - MB + 15} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
              {nf(v, l)}
            </text>
          ))}
          <text x={VW - MR} y={VH - 3} textAnchor="end" fontSize={10.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(c0.axis)}
          </text>
          <line x1={ML} x2={ML} y1={MT} y2={VH - MB} stroke="var(--line)" strokeWidth={1.4} />

          {(
            [
              [a, "var(--ink-2)", "a"],
              [b, "var(--blob)", "b"],
            ] as const
          ).map(([tar, color, k]) => (
            <motion.line
              key={`${c0.id}-${k}`}
              initial={false}
              animate={{ x1: sx(0), y1: sy(cost(tar, 0)), x2: sx(c0.max), y2: sy(cost(tar, c0.max)) }}
              transition={soft}
              stroke={color}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          ))}

          {crossIn && cross !== null && (
            <motion.g initial={false} animate={{ x: sx(cross), y: sy(cost(a, cross)) }} transition={soft}>
              <circle r={6} fill="var(--ok)" stroke="var(--raised)" strokeWidth={2} />
            </motion.g>
          )}

          <motion.line initial={false} animate={{ x1: sx(x), x2: sx(x) }} transition={soft} y1={MT} y2={VH - MB} stroke="var(--ink-3)" strokeDasharray="4 4" />
          {(
            [
              [ka, "var(--ink-2)", "a"],
              [kb, "var(--blob)", "b"],
            ] as const
          ).map(([k, color, key]) => (
            <motion.circle key={key} initial={false} animate={{ cx: sx(x), cy: sy(k) }} transition={soft} r={5} fill={color} stroke="var(--raised)" strokeWidth={1.5} />
          ))}
        </svg>
      </div>

      <Slider
        label={tx(`Usage (${t(c0.axis)})`, `Nutzung (${t(c0.axis)})`)}
        value={x}
        min={0}
        max={c0.max}
        step={c0.step}
        onChange={setX}
        display={`${nf(x, l)} ${unit}`}
        valueText={`${nf(x, l)} ${unit}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {card(a, "a", ka)}
        {card(b, "b", kb)}
      </div>
      {crossIn && cross !== null && (
        <div className="overflow-x-auto rounded-xl border border-line px-4 py-3">
          <MathView
            src={`${a.base ? `${mn(a.base, l, "ba")} + ` : ""}${mn(a.rate, l, "ra")} x =#eq ${b.base ? `${mn(b.base, l, "bb")} + ` : ""}${mn(b.rate, l, "rb")} x \\quad \\Rightarrow#th \\quad x ${Math.abs(cross * 100 - Math.round(cross * 100)) < 1e-6 ? "=" : "\\approx"}#e2 ${mn(cross, l, "c")}`}
            size="sm"
            scope={`${id}-eq`}
          />
          <p className="mt-1 text-[12.5px] text-ink-3">{t(tx("Set the two cost terms equal: that's where the lines cross.", "Setz die beiden Kostenterme gleich: Dort schneiden sich die Geraden."))}</p>
        </div>
      )}
      <BlobLine text={say} mood={cross !== null && crossIn && Math.abs(x - cross) < 1e-9 ? "excited" : "happy"} />
    </div>
  );
}
