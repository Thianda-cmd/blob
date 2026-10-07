"use client";

// Widget: which model fits? Five data sets from real stories. Pick a model type; the
// widget lays that model through the first points (two for linear and exponential,
// three for quadratic), draws it and shows how far the other points are off. The table
// test below shows why: constant differences (linear), constant second differences
// (quadratic) or constant ratios (exponential). A prediction far ahead shows the limits.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { pow } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { clean, mn, nf } from "./kit";
import { BlobLine, HowTo, Label, Segmented, soft } from "./ui";

type Kind = "lin" | "quad" | "exp";
type DataSet = {
  id: string;
  label: Text;
  story: Text;
  v: string;
  xUnit: string;
  yName: Text;
  xs: number[];
  ys: number[];
  future: number;
  limit: Text;
};

const ball = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

const SETS: DataSet[] = [
  {
    id: "bacteria",
    label: tx("Bacteria", "Bakterien"),
    story: tx("A bacterial culture: bacteria (in thousands) after t hours.", "Eine Bakterienkultur: Bakterien (in Tausend) nach t Stunden."),
    v: "t",
    xUnit: "h",
    yName: tx("N in thousands", "N in Tausend"),
    xs: [0, 1, 2, 3, 4, 5],
    ys: [2, 4, 8, 16, 32, 64],
    future: 24,
    limit: tx(
      "After 24 hours the model predicts over 33 million thousand, that's 33 billion bacteria. The dish runs out of food long before: exponential growth always stops at some point.",
      "Nach 24 Stunden sagt das Modell über 33 Millionen Tausend voraus, also 33 Milliarden Bakterien. Lange vorher geht die Nährlösung aus: Exponentielles Wachstum stoppt immer irgendwann.",
    ),
  },
  {
    id: "candle",
    label: tx("Candle", "Kerze"),
    story: tx("A candle burns down: its height in cm after t hours.", "Eine Kerze brennt ab: ihre Höhe in cm nach t Stunden."),
    v: "t",
    xUnit: "h",
    yName: tx("h in cm", "h in cm"),
    xs: [0, 1, 2, 3, 4, 5],
    ys: [24, 21, 18, 15, 12, 9],
    future: 10,
    limit: tx("After 10 hours the model says −6 cm. A candle can't be shorter than 0: after 8 hours it has burnt down, the model only works for 0 ≤ t ≤ 8.", "Nach 10 Stunden sagt das Modell −6 cm. Kürzer als 0 geht nicht: Nach 8 Stunden ist die Kerze abgebrannt, das Modell gilt nur für 0 ≤ t ≤ 8."),
  },
  {
    id: "brake",
    label: tx("Braking", "Bremsweg"),
    story: tx("Braking distance in m (rule of thumb) at the speed v in km/h.", "Bremsweg in m (Faustformel) bei der Geschwindigkeit v in km/h."),
    v: "v",
    xUnit: "km/h",
    yName: tx("s in m", "s in m"),
    xs: [20, 40, 60, 80, 100, 120],
    ys: [4, 16, 36, 64, 100, 144],
    future: 160,
    limit: tx(
      "At 160 km/h the rule gives 256 m. It's only a rule of thumb for a dry road: on a wet road the car needs more, and the reaction distance comes on top.",
      "Bei 160 km/h ergibt die Faustformel 256 m. Sie gilt nur für trockene Straßen: Bei Nässe braucht das Auto mehr, und der Reaktionsweg kommt noch dazu.",
    ),
  },
  {
    id: "medicine",
    label: tx("Medicine", "Medikament"),
    story: tx("A medicine in the blood: amount in mg after t hours.", "Ein Medikament im Blut: Menge in mg nach t Stunden."),
    v: "t",
    xUnit: "h",
    yName: tx("m in mg", "m in mg"),
    xs: [0, 4, 8, 12, 16, 20],
    ys: [400, 200, 100, 50, 25, 12.5],
    future: 48,
    limit: tx(
      "Every 4 hours, half is gone (half-life 4 h). The model never quite reaches 0, but after two days less than 0.1 mg is left: practically nothing.",
      "Alle 4 Stunden ist die Hälfte weg (Halbwertszeit 4 h). Das Modell wird nie ganz 0, aber nach zwei Tagen ist weniger als 0,1 mg übrig: praktisch nichts.",
    ),
  },
  {
    id: "ball",
    label: tx("Throw", "Wurf"),
    story: tx("A ball thrown straight up: height in m after t seconds.", "Ein senkrecht hochgeworfener Ball: Höhe in m nach t Sekunden."),
    v: "t",
    xUnit: "s",
    yName: tx("h in m", "h in m"),
    xs: ball,
    ys: ball.map((t) => clean(20 * t - 5 * t * t)),
    future: 5,
    limit: tx("After 5 seconds the model says −25 m. But the ball lands after 4 s: the model only works for 0 ≤ t ≤ 4.", "Nach 5 Sekunden sagt das Modell −25 m. Der Ball landet aber nach 4 s: Das Modell gilt nur für 0 ≤ t ≤ 4."),
  },
];

const KINDS: { value: Kind; label: Text }[] = [
  { value: "lin", label: tx("Linear", "Linear") },
  { value: "quad", label: tx("Quadratic", "Quadratisch") },
  { value: "exp", label: tx("Exponential", "Exponentiell") },
];

/** `flat`: a quadratic fit with a = 0, so really a straight line. */
type Fit = { f: (x: number) => number; src: (l: Locale) => string; flat?: boolean } | { error: Text };

/** A number for a formula, rounded to 4 significant digits. */
const sig = (v: number) => (v === 0 ? 0 : Number(v.toPrecision(4)));

/** a·v² + b·v + c in the display language, zero terms left out, signs tidy. */
function poly(coefs: [number, number, number], v: string, l: Locale) {
  const parts: string[] = [];
  coefs.forEach((c0, i) => {
    const c = sig(c0);
    if (Math.abs(c) < 1e-9) return;
    const pow = 2 - i;
    const abs = Math.abs(c);
    const num = pow > 0 && abs === 1 ? "" : mn(abs, l, undefined, 4);
    const body = `${num}${pow === 2 ? `${v}^2` : pow === 1 ? v : ""}`;
    parts.push(parts.length === 0 ? `${c < 0 ? "-" : ""}${body}` : `${c < 0 ? "-" : "+"} ${body}`);
  });
  return parts.length ? parts.join(" ") : "0";
}

function fit(kind: Kind, d: DataSet): Fit {
  const [x0, x1, x2] = d.xs;
  const [y0, y1, y2] = d.ys;
  if (kind === "lin") {
    const m = (y1 - y0) / (x1 - x0);
    const b = y0 - m * x0;
    return { f: (x) => m * x + b, src: (l) => `f(${d.v}) = ${poly([0, m, b], d.v, l)}` };
  }
  if (kind === "quad") {
    // Through three points: a(x − x0)(x − x1) + m(x − x0) + y0, expanded.
    const m = (y1 - y0) / (x1 - x0);
    const A = ((y2 - y0) / (x2 - x0) - m) / (x2 - x1);
    const B = m - A * (x0 + x1);
    const C = y0 - m * x0 + A * x0 * x1;
    return { f: (x) => A * x * x + B * x + C, src: (l) => `f(${d.v}) = ${poly([A, B, C], d.v, l)}`, flat: Math.abs(A) < 1e-12 };
  }
  if (y0 <= 0 || y1 <= 0)
    return {
      error: tx(
        "An exponential model a · bˣ is never 0, but this data starts at 0. So it can't be exponential.",
        "Ein exponentielles Modell a · bˣ wird nie 0, diese Daten beginnen aber bei 0. Exponentiell kann es also nicht sein.",
      ),
    };
  const h = x1 - x0;
  const q = y1 / y0;
  const f = (x: number) => y0 * pow(q, (x - x0) / h);
  return {
    f,
    src: (l) => {
      const e = x0 === 0 ? (h === 1 ? d.v : `${d.v}/${h}`) : `(${d.v} - ${x0})/${h}`;
      return `f(${d.v}) = ${mn(sig(y0), l, undefined, 4)} \\cdot ${mn(sig(q), l, undefined, 4)}^{${e}}`;
    },
  };
}

/** The table test for a model type: differences, second differences or ratios. */
function testRow(kind: Kind, ys: number[]) {
  if (kind === "lin") return ys.slice(1).map((y, i) => clean(y - ys[i], 4));
  if (kind === "quad") {
    const d = ys.slice(1).map((y, i) => y - ys[i]);
    return d.slice(1).map((y, i) => clean(y - d[i], 4));
  }
  return ys.slice(1).map((y, i) => (ys[i] === 0 ? NaN : clean(y / ys[i], 4)));
}

const VW = 360;
const VH = 210;
const ML = 36;
const MR = 12;
const MT = 12;
const MB = 28;

export function ModelLab() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const [setId, setSetId] = useState("bacteria");
  const [kind, setKind] = useState<Kind>("lin");
  const d = SETS.find((s) => s.id === setId)!;
  const model = fit(kind, d);
  const ok = "f" in model;

  const xmin = d.xs[0];
  const xmax = d.xs[d.xs.length - 1];
  const ymin = Math.min(0, ...d.ys);
  const ymax = Math.max(...d.ys) * 1.15;
  const sx = (x: number) => ML + ((x - xmin) / (xmax - xmin)) * (VW - ML - MR);
  const sy = (y: number) => VH - MB - ((y - ymin) / (ymax - ymin)) * (VH - MT - MB);
  const clampY = (y: number) => Math.max(ymin - (ymax - ymin) * 0.3, Math.min(ymax * 1.3, y));

  const errors = ok ? d.ys.map((y, i) => Math.abs(model.f(d.xs[i]) - y)) : [];
  const fits = ok && errors.every((e) => e <= 0.01 * Math.max(...d.ys.map(Math.abs)));
  const worst = ok ? Math.max(...errors) : 0;

  const N = 80;
  const path = ok
    ? Array.from({ length: N + 1 }, (_, i) => {
        const x = xmin + ((xmax - xmin) * i) / N;
        return `${i ? "L" : "M"}${sx(x).toFixed(2)},${sy(clampY(model.f(x))).toFixed(2)}`;
      }).join("")
    : "";
  const row = testRow(kind, d.ys);
  const constant = row.every((v) => Number.isFinite(v) && Math.abs(v - row[0]) < 1e-6);
  const rowName = kind === "lin" ? tx("differences", "Differenzen") : kind === "quad" ? tx("2nd differences", "2. Differenzen") : tx("ratios", "Quotienten");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => ymin + (Math.max(...d.ys) - ymin) * k);

  const flat = ok && !!model.flat;
  const say: Text = !ok
    ? model.error
    : flat
      ? tx("The second differences are all 0, so a = 0: that's no parabola but a straight line. The linear model says it more simply.", "Die 2. Differenzen sind alle 0, also a = 0: Das ist keine Parabel, sondern eine Gerade. Das lineare Modell sagt es einfacher.")
      : fits
      ? tx(`Fits exactly! The ${t(rowName)} are constant, so the ${t(KINDS.find((k) => k.value === kind)!.label).toLowerCase()} model is the right one.`, `Passt genau! Die ${t(rowName)} sind konstant, also ist das ${t(KINDS.find((k) => k.value === kind)!.label).toLowerCase()}e Modell das richtige.`)
      : tx("Doesn't fit: the red lines show how far the points are off. Try another model.", "Passt nicht: Die roten Linien zeigen, wie weit die Punkte danebenliegen. Probier ein anderes Modell.");

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "Choose a data set, then a model type. The model is laid through the first points; the others show whether it really fits.",
          "Wähl eine Messreihe und dann einen Modelltyp. Das Modell wird durch die ersten Punkte gelegt, die übrigen zeigen, ob es wirklich passt.",
        )}
      />
      <div className="space-y-2">
        <Segmented id={`${id}-set`} label={tx("Data set", "Messreihe")} size="sm" value={setId} onChange={setSetId} options={SETS.map((s) => ({ value: s.id, label: s.label }))} />
        <p className="text-[13px] text-ink-3">{t(d.story)}</p>
        <Segmented id={`${id}-kind`} label={tx("Model", "Modell")} value={kind} onChange={setKind} options={KINDS} />
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div>
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img" aria-label={t(tx("Data points and model curve", "Messpunkte und Modellkurve"))}>
            <defs>
              <clipPath id={`${id}-clip`}>
                <rect x={ML} y={MT - 4} width={VW - ML - MR} height={VH - MT - MB + 8} />
              </clipPath>
            </defs>
            {yTicks.map((y, i) => (
              <g key={i}>
                <line x1={ML} x2={VW - MR} y1={sy(y)} y2={sy(y)} stroke="var(--line)" strokeWidth={Math.abs(y) < 1e-9 ? 1.4 : 0.8} />
                <text x={ML - 5} y={sy(y) + 4} textAnchor="end" fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {nf(y, l, 1)}
                </text>
              </g>
            ))}
            {d.xs.map((x, i) =>
              i % (d.xs.length > 6 ? 2 : 1) === 0 ? (
                <text key={x} x={sx(x)} y={VH - MB + 14} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {nf(x, l)}
                </text>
              ) : null,
            )}
            <text x={VW - MR} y={VH - 2} textAnchor="end" fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
              {`${d.v} in ${d.xUnit}`}
            </text>
            <text x={ML} y={MT - 2} fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
              {t(d.yName)}
            </text>
            <g clipPath={`url(#${id}-clip)`}>
              {ok && (
                <motion.path key={`${setId}`} initial={false} animate={{ d: path }} transition={soft} fill="none" stroke="var(--blob)" strokeWidth={2.4} strokeLinecap="round" />
              )}
              {ok &&
                d.xs.map((x, i) =>
                  errors[i] > 0.01 * Math.max(...d.ys.map(Math.abs)) ? (
                    <motion.line
                      key={`e${setId}${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, x1: sx(x), x2: sx(x), y1: sy(d.ys[i]), y2: sy(clampY(model.f(x))) }}
                      stroke="var(--danger)"
                      strokeWidth={1.6}
                      strokeDasharray="3 3"
                    />
                  ) : null,
                )}
            </g>
            {d.xs.map((x, i) => (
              <circle key={`p${setId}${i}`} cx={sx(x)} cy={sy(d.ys[i])} r={3.6} fill="var(--ink)" stroke="var(--raised)" strokeWidth={1.2} />
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          <div className={cn("rounded-xl border px-4 py-3", !ok ? "border-line bg-surface" : fits ? "border-ok/50 bg-ok/10" : "border-danger/40 bg-danger/5")}>
            <Label>{t(tx("Model through the first points", "Modell durch die ersten Punkte"))}</Label>
            <div className="mt-1 min-h-[34px]">{ok ? <MathView src={model.src(l)} size="md" scope={`${id}-f`} /> : <span className="text-[14px] text-ink-2">–</span>}</div>
            <div className={cn("mt-1 text-[13px] font-semibold", !ok ? "text-ink-3" : fits ? "text-ok" : "text-danger")}>
              {!ok ? t(tx("Not possible", "Nicht möglich")) : flat ? t(tx("Fits, but a = 0: a straight line", "Passt, aber a = 0: eine Gerade")) : fits ? t(tx("Fits all points", "Passt zu allen Punkten")) : t(tx(`Doesn't fit: off by up to ${nf(worst, l, 1)}`, `Passt nicht: bis zu ${nf(worst, l, 1)} daneben`))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line px-3 py-2.5">
            <Label>{t(tx(`Table test: ${t(rowName)}`, `Tabellentest: ${t(rowName)}`))}</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {row.map((v, i) => (
                <span key={i} className={cn("rounded-md px-1.5 py-0.5 font-math text-[15px] tabular-nums", constant ? "bg-ok/15 text-ink" : "bg-surface text-ink-2")}>
                  {Number.isFinite(v) ? `${kind === "exp" ? "·" : v >= 0 ? "+" : ""}${nf(v, l, 3)}` : "–"}
                </span>
              ))}
              <span className={cn("ml-1 text-[12.5px] font-semibold", constant ? "text-ok" : "text-ink-3")}>{constant ? t(tx("constant", "konstant")) : t(tx("not constant", "nicht konstant"))}</span>
            </div>
          </div>
        </div>
      </div>

      <BlobLine text={say} mood={!ok ? "thinking" : fits ? "excited" : "thinking"} />

      {ok && fits && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-4 py-3">
          <Label accent>{t(tx("A look ahead: the limits of the model", "Blick nach vorn: die Grenzen des Modells"))}</Label>
          <div className="mt-1">
            <MathView src={`f(${mn(d.future, l)}) \\approx ${mn(sig(model.f(d.future)), l, undefined, 3)}`} size="sm" animate={false} />
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{t(d.limit)}</p>
        </motion.div>
      )}
    </div>
  );
}
