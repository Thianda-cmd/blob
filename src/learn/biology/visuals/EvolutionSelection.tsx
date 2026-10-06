"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

// Forms of selection as moving frequency distributions: stabilising, directional and
// disruptive selection. The dashed curve is the starting population.

export type SelForm = "stabilizing" | "directional" | "disruptive";

export const SEL_TRAITS: Text[] = [tx("beak size", "Schnabelgröße"), tx("body size", "Körpergröße"), tx("fur length", "Felllänge"), tx("wing length", "Flügellänge")];

const gauss = (x: number, m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

/** Frequency at trait value x (0–10) after progress g (0–1) of selection. */
export function density(form: SelForm, g: number, x: number, dir: 1 | -1 = 1) {
  const s0 = 1.25;
  if (form === "stabilizing") return gauss(x, 5, s0 * (1 - 0.45 * g));
  if (form === "directional") return gauss(x, 5 + dir * 2.2 * g, s0);
  const s1 = s0 * (1 - 0.32 * g);
  return 0.5 * gauss(x, 5 - 2.1 * g, s1) + 0.5 * gauss(x, 5 + 2.1 * g, s1);
}

const W = 520;
const H = 250;
const L = 30;
const R = 14;
const T = 18;
const B = 40;
const X = (v: number) => L + ((W - L - R) * v) / 10;

function curve(form: SelForm, g: number, dir: 1 | -1, yMax: number, closed: boolean) {
  const Y = (d: number) => H - B - ((H - T - B) * d) / yMax;
  const pts: string[] = [];
  for (let i = 0; i <= 100; i++) {
    const v = i / 10;
    pts.push(`${X(v).toFixed(1)} ${Y(density(form, g, v, dir)).toFixed(1)}`);
  }
  return closed ? `M${X(0)} ${H - B} L${pts.join(" L")} L${X(10)} ${H - B} Z` : `M${pts.join(" L")}`;
}

/** Where selection works against the individuals (trait ranges). */
const AGAINST: Record<SelForm, (dir: 1 | -1) => [number, number][]> = {
  stabilizing: () => [
    [0, 2.9],
    [7.1, 10],
  ],
  directional: (dir) => (dir === 1 ? [[0, 4.1]] : [[5.9, 10]]),
  disruptive: () => [[4.1, 5.9]],
};

function Axes({ trait }: { trait: Text }) {
  const t = useText();
  return (
    <g style={{ fontFamily: "var(--font-sans)" }}>
      <line x1={L} x2={L} y1={T - 6} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
      <path d={`M${W - R - 6} ${H - B - 4} L${W - R} ${H - B} L${W - R - 6} ${H - B + 4}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
      <path d={`M${L - 4} ${T} L${L} ${T - 6} L${L + 4} ${T}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
      <text x={L - 8} y={(T + H - B) / 2} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)" transform={`rotate(-90 ${L - 8} ${(T + H - B) / 2})`}>
        {t(tx("number of individuals", "Anzahl der Individuen"))}
      </text>
      <text x={(L + W - R) / 2} y={H - B + 18} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)">
        {t(tx("small", "klein"))} {"←"} {t(trait)} {"→"} {t(tx("large", "groß"))}
      </text>
    </g>
  );
}

/** Task picture: a population before (dashed) and after selection (filled), without naming the form. */
export function SelectionGraph({ form, dir = 1, trait = 0 }: { form: SelForm; dir?: 1 | -1; trait?: number }) {
  const t = useText();
  const yMax = form === "stabilizing" ? 0.6 : 0.4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Frequency distribution before and after selection", "Häufigkeitsverteilung vor und nach der Selektion"))}>
      <path d={curve(form, 1, dir, yMax, true)} fill="color-mix(in oklab, var(--blob) 16%, transparent)" stroke="var(--blob)" strokeWidth={2.6} strokeLinejoin="round" />
      <path d={curve(form, 0, dir, yMax, false)} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="6 5" />
      <Axes trait={SEL_TRAITS[trait % SEL_TRAITS.length]} />
      <g fontSize={12.5} style={{ fontFamily: "var(--font-sans)" }}>
        <line x1={W - 170} x2={W - 146} y1={T + 4} y2={T + 4} stroke="var(--ink-2)" strokeWidth={2} strokeDasharray="6 5" />
        <text x={W - 140} y={T + 4} dominantBaseline="central" fill="var(--ink-2)">
          {t(tx("before", "vorher"))}
        </text>
        <line x1={W - 90} x2={W - 66} y1={T + 4} y2={T + 4} stroke="var(--blob)" strokeWidth={2.6} />
        <text x={W - 60} y={T + 4} dominantBaseline="central" fill="var(--ink-2)">
          {t(tx("after", "nachher"))}
        </text>
      </g>
    </svg>
  );
}

const FORMS: { id: SelForm; name: Text; text: Text }[] = [
  {
    id: "stabilizing",
    name: tx("stabilising", "stabilisierend"),
    text: tx(
      "Both extremes are at a disadvantage, the average form is favoured. The range of variation shrinks, the mean stays. Typical when the environment stays the same. Example: birth weight in humans.",
      "Beide Extreme sind im Nachteil, die mittlere Ausprägung wird begünstigt. Die Variationsbreite wird kleiner, der Mittelwert bleibt. Typisch bei gleichbleibender Umwelt. Beispiel: Geburtsgewicht beim Menschen.",
    ),
  },
  {
    id: "directional",
    name: tx("directional", "transformierend (gerichtet)"),
    text: tx(
      "One extreme is favoured, often after the environment has changed. The mean shifts in one direction. Examples: peppered moths in sooty forests, larger beaks of Darwin's finches after a drought, antibiotic resistance.",
      "Eine Extremform ist im Vorteil, oft nach einer Umweltänderung. Der Mittelwert verschiebt sich in eine Richtung. Beispiele: Birkenspanner in rußigen Wäldern, größere Schnäbel bei Darwinfinken nach einer Dürre, Antibiotikaresistenz.",
    ),
  },
  {
    id: "disruptive",
    name: tx("disruptive", "disruptiv (aufspaltend)"),
    text: tx(
      "Both extremes are favoured, the average form is at a disadvantage. Two peaks form, which can be a first step towards new species. Example: seedcrackers with small beaks for soft seeds and large beaks for hard seeds.",
      "Beide Extreme sind im Vorteil, die mittlere Form ist im Nachteil. Es entstehen zwei Gipfel, ein möglicher erster Schritt zur Artbildung. Beispiel: Purpurastrilde mit kleinen Schnäbeln für weiche und großen Schnäbeln für harte Samen.",
    ),
  },
];

export function EvolutionSelection() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [form, setForm] = useState<SelForm>("stabilizing");
  const [gen, setGen] = useState(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const g = gen / 10;
  const yMax = 0.6;
  const info = FORMS.find((f) => f.id === form)!;

  const play = () => {
    ctrl.current?.stop();
    if (reduce) {
      setGen(10);
      return;
    }
    const from = gen >= 10 ? 0 : gen;
    ctrl.current = animate(from, 10, { duration: 3.2 * (1 - from / 10), ease: "easeInOut", onUpdate: setGen });
  };
  const choose = (f: SelForm) => {
    ctrl.current?.stop();
    setForm(f);
    setGen(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Form of selection", "Selektionsform"))}>
        {FORMS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={form === f.id}
            onClick={() => choose(f.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", form === f.id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {form === f.id && <motion.span layoutId={`${scope}-f`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(f.name)}</span>
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={t(info.name)}>
        {AGAINST[form](1).map(([a, b], i) => (
          <g key={i}>
            <rect x={X(a)} y={T} width={X(b) - X(a)} height={H - B - T} fill="color-mix(in oklab, var(--bio-blood) 10%, transparent)" />
            <g transform={`translate(${(X(a) + X(b)) / 2} ${T + 8})`}>
              <path d="M0 0 L0 30 M-7 22 L0 30 L7 22" fill="none" stroke="var(--bio-blood)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        ))}
        <text x={X(AGAINST[form](1)[0][0]) + 4} y={T + 50} fontSize={11.5} fill="var(--bio-blood)" style={{ fontFamily: "var(--font-sans)" }}>
          {form === "disruptive" ? "" : t(tx("selection pressure", "Selektionsdruck"))}
        </text>
        <path d={curve(form, g, 1, yMax, true)} fill="color-mix(in oklab, var(--blob) 16%, transparent)" stroke="var(--blob)" strokeWidth={2.6} strokeLinejoin="round" />
        <path d={curve(form, 0, 1, yMax, false)} fill="none" stroke="var(--ink-2)" strokeWidth={1.8} strokeDasharray="6 5" />
        <Axes trait={SEL_TRAITS[0]} />
      </svg>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={play} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14.5px] font-semibold text-white">
          {gen >= 10 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
          {t(gen >= 10 ? tx("Again", "Nochmal") : tx("Let generations pass", "Generationen ablaufen lassen"))}
        </button>
        <label className="flex min-w-[180px] flex-1 items-center gap-3 text-[13.5px] text-ink-2">
          <span className="shrink-0 tabular-nums">{t(tx(`Generations: ${Math.round(gen * 10)}`, `Generationen: ${Math.round(gen * 10)}`))}</span>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={gen}
            onChange={(e) => {
              ctrl.current?.stop();
              setGen(Number(e.target.value));
            }}
            className="w-full accent-blob"
            aria-label={t(tx("Generations", "Generationen"))}
          />
        </label>
      </div>
      <motion.p key={form} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{t(tx("Selection", "Selektion"))}: {t(info.name)}. </span>
        {t(info.text)}
      </motion.p>
    </div>
  );
}
