"use client";

// "Heat the box": a temperature slider for a substance. The particles vibrate, slide or fly,
// the state's name updates, and crossing a melting or boiling temperature names the change.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { degC } from "../particles-data";
import { ParticleSim } from "./ParticlesSim";

type BoxSubstance = {
  id: string;
  name: Text;
  min: number;
  max: number;
  step: number;
  mp: number;
  bp: number;
  /** Sublimes at normal pressure (no liquid state): mp = bp = sublimation temperature. */
  sublimes?: boolean;
  /** What the substance is called in each state. */
  called: [Text, Text, Text];
};

const BOX_SUBSTANCES: BoxSubstance[] = [
  { id: "water", name: tx("Water", "Wasser"), min: -40, max: 140, step: 1, mp: 0, bp: 100, called: [tx("ice", "Eis"), tx("water", "Wasser"), tx("water vapour", "Wasserdampf")] },
  {
    id: "ethanol",
    name: tx("Ethanol", "Ethanol"),
    min: -160,
    max: 120,
    step: 1,
    mp: -114,
    bp: 78,
    called: [tx("solid ethanol", "festes Ethanol"), tx("liquid ethanol", "flüssiges Ethanol"), tx("ethanol vapour", "Ethanoldampf")],
  },
  { id: "iron", name: tx("Iron", "Eisen"), min: 0, max: 3200, step: 2, mp: 1538, bp: 2862, called: [tx("iron", "Eisen"), tx("molten iron", "flüssiges Eisen"), tx("iron vapour", "Eisendampf")] },
  {
    id: "co2",
    name: tx("Dry ice (CO₂)", "Trockeneis (CO₂)"),
    min: -120,
    max: 20,
    step: 0.5,
    mp: -78.5,
    bp: -78.5,
    sublimes: true,
    called: [tx("dry ice", "Trockeneis"), tx("liquid", "flüssig"), tx("carbon dioxide gas", "Kohlenstoffdioxid-Gas")],
  },
];

type Phase = { liquid: number; gas: number; label: Text; state: 0 | 1 | 2 | null };

function phaseOf(s: BoxSubstance, t: number): Phase {
  if (s.sublimes) {
    if (t < s.mp) return { liquid: 0, gas: 0, label: tx("solid", "fest"), state: 0 };
    if (t === s.mp) return { liquid: 0.5, gas: 0.5, label: tx("subliming: solid and gas", "sublimiert: fest und gasförmig"), state: null };
    return { liquid: 1, gas: 1, label: tx("gas", "gasförmig"), state: 2 };
  }
  if (t < s.mp) return { liquid: 0, gas: 0, label: tx("solid", "fest"), state: 0 };
  if (t === s.mp) return { liquid: 0.5, gas: 0, label: tx("melting point: solid and liquid", "Schmelztemperatur: fest und flüssig"), state: null };
  if (t < s.bp) return { liquid: 1, gas: 0, label: tx("liquid", "flüssig"), state: 1 };
  if (t === s.bp) return { liquid: 1, gas: 0.5, label: tx("boiling point: liquid and gas", "Siedetemperatur: flüssig und gasförmig"), state: null };
  return { liquid: 1, gas: 1, label: tx("gas", "gasförmig"), state: 2 };
}

/** The changes passed when the temperature moves from a to b. */
function crossed(s: BoxSubstance, a: number, b: number): Text[] {
  const out: Text[] = [];
  const up = b > a;
  const passes = (p: number) => (up ? a < p && b >= p : a > p && b <= p);
  if (s.sublimes) {
    if (passes(s.mp)) out.push(up ? tx("Sublimation!", "Sublimieren!") : tx("Deposition!", "Resublimieren!"));
    return out;
  }
  const marks = up ? [s.mp, s.bp] : [s.bp, s.mp];
  for (const p of marks) {
    if (!passes(p)) continue;
    if (p === s.mp) out.push(up ? tx("Melting!", "Schmelzen!") : tx("Freezing!", "Erstarren!"));
    else out.push(up ? tx("Boiling!", "Sieden!") : tx("Condensing!", "Kondensieren!"));
  }
  return out;
}

const FACTS: Record<0 | 1 | 2, { gap: Text; order: Text; move: Text; shape: Text }> = {
  0: {
    gap: tx("very small, tightly packed", "sehr klein, dicht gepackt"),
    order: tx("regular pattern (lattice)", "regelmäßig (Gitter)"),
    move: tx("vibrate in their places", "schwingen auf ihren Plätzen"),
    shape: tx("fixed shape and volume", "feste Form, festes Volumen"),
  },
  1: {
    gap: tx("small, close together", "klein, dicht beieinander"),
    order: tx("no order", "ungeordnet"),
    move: tx("slide past each other", "gleiten aneinander vorbei"),
    shape: tx("fixed volume, takes the container's shape", "festes Volumen, Form passt sich dem Gefäß an"),
  },
  2: {
    gap: tx("very large", "sehr groß"),
    order: tx("no order", "ungeordnet"),
    move: tx("fly fast and freely in all directions", "fliegen schnell und frei in alle Richtungen"),
    shape: tx("fills any space", "füllt jeden Raum aus"),
  },
};

/** A styled range slider with marks (melting and boiling temperature). */
export function TempSlider({
  value,
  min,
  max,
  step,
  marks,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  marks: { at: number; label: string }[];
  onChange: (v: number) => void;
  label: string;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative h-14 select-none">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="peer absolute inset-x-0 top-0 z-10 h-9 w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none absolute inset-x-2.5 top-0 h-9">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,color-mix(in_oklab,var(--subject-sky)_45%,transparent),color-mix(in_oklab,var(--blob)_30%,transparent),color-mix(in_oklab,var(--subject-clay)_55%,transparent))]" />
        {marks.map((m) => (
          <span key={m.label} className="absolute top-[calc(50%-9px)] h-[18px] w-0.5 -translate-x-1/2 rounded-full bg-ink-2" style={{ left: `${pct(m.at)}%` }} />
        ))}
        <motion.div
          className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-blob bg-raised shadow-card ring-blob/25 peer-focus-visible:ring-4"
          initial={false}
          animate={{ left: `${pct(value)}%` }}
          transition={{ type: "spring", stiffness: 600, damping: 42 }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-2.5 top-9 h-5">
        {marks.map((m, i) => (
          <span
            key={m.label}
            className={cn("absolute whitespace-nowrap text-[11.5px] font-medium text-ink-2", i === 0 && marks.length > 1 ? "-translate-x-[85%]" : marks.length > 1 ? "-translate-x-[15%]" : "-translate-x-1/2")}
            style={{ left: `${pct(m.at)}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Heat a box of particles with a slider. */
export function ParticlesBox() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [sid, setSid] = useState("water");
  const s = BOX_SUBSTANCES.find((x) => x.id === sid)!;
  const [temp, setTemp] = useState(-20);
  const [popup, setPopup] = useState<{ n: number; items: Text[] } | null>(null);
  const phase = phaseOf(s, temp);
  const heat = (temp - s.min) / (s.max - s.min);
  const facts = phase.state === null ? null : FACTS[phase.state];

  const pick = (id: string) => {
    const next = BOX_SUBSTANCES.find((x) => x.id === id)!;
    setSid(id);
    setTemp(next.id === "water" ? -20 : next.id === "co2" ? -100 : next.id === "iron" ? 20 : -140);
    setPopup(null);
  };
  const change = (v: number) => {
    const items = crossed(s, temp, v);
    if (items.length) setPopup((p) => ({ n: (p?.n ?? 0) + 1, items }));
    setTemp(v);
  };

  const marks = s.sublimes
    ? [{ at: s.mp, label: `${t(tx("sublimes", "sublimiert"))} ${degC(s.mp, locale)}` }]
    : [
        { at: s.mp, label: `${t(tx("m.p.", "Smt."))} ${degC(s.mp, locale)}` },
        { at: s.bp, label: `${t(tx("b.p.", "Sdt."))} ${degC(s.bp, locale)}` },
      ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {BOX_SUBSTANCES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => pick(x.id)}
            className={cn("relative h-9 rounded-lg px-3 text-[13.5px] font-medium transition-colors", sid === x.id ? "text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {sid === x.id && <motion.span layoutId={`${scope}-pill`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(x.name)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,230px)] md:items-start">
        <div className="space-y-3">
          <div className="relative">
            <ParticleSim key={sid} liquid={phase.liquid} gas={phase.gas} heat={heat} seed={sid.length + 3} label={`${t(s.name)}: ${t(phase.label)}`} />
            <AnimatePresence>
              {popup && (
                <motion.div
                  key={popup.n}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6], scale: [0.9, 1, 1, 1] }}
                  transition={{ duration: 2.2, times: [0, 0.12, 0.8, 1] }}
                  className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-blob px-3.5 py-1 text-[14px] font-semibold whitespace-nowrap text-white shadow-card"
                >
                  {popup.items.map((x) => t(x)).join(" → ")}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Temperature", "Temperatur"))}</span>
            <span className="font-math text-[26px] tabular-nums text-ink">{degC(temp, locale)}</span>
          </div>
          <TempSlider value={temp} min={s.min} max={s.max} step={s.step} marks={marks} onChange={change} label={t(tx("Temperature", "Temperatur"))} />
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("State", "Aggregatzustand"))}</div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={t(phase.label)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                className="font-display text-[22px] font-semibold leading-tight text-blob-ink"
              >
                {t(phase.label)}
                {phase.state !== null && <span className="ml-2 font-math text-[18px] font-normal text-ink-3">({["s", "l", "g"][phase.state]})</span>}
              </motion.div>
            </AnimatePresence>
            {phase.state !== null && <div className="text-[13.5px] text-ink-2">{t(s.called[phase.state])}</div>}
          </div>
          {facts ? (
            <dl className="space-y-1.5 text-[13px]">
              {(
                [
                  [tx("Distance", "Abstand"), facts.gap],
                  [tx("Order", "Ordnung"), facts.order],
                  [tx("Movement", "Bewegung"), facts.move],
                  [tx("Shape", "Form"), facts.shape],
                ] as const
              ).map(([k, v]) => (
                <div key={t(k)} className="flex gap-2">
                  <dt className="w-[76px] shrink-0 text-ink-3">{t(k)}</dt>
                  <dd className="min-w-0 font-medium text-ink">{t(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              {t(
                tx(
                  "Right at this temperature both states exist side by side. All the energy you add goes into breaking the particles apart, so the temperature doesn't rise until the change is complete.",
                  "Genau bei dieser Temperatur gibt es beide Zustände nebeneinander. Die ganze zugeführte Energie löst die Teilchen voneinander, deshalb steigt die Temperatur erst weiter, wenn der Übergang fertig ist.",
                ),
              )}
            </p>
          )}
          <p className="border-t border-line pt-2.5 text-[12.5px] leading-snug text-ink-3">
            {t(tx("The warmer, the faster the particles move. The particles themselves never change.", "Je wärmer, desto schneller bewegen sich die Teilchen. Die Teilchen selbst bleiben immer gleich."))}
          </p>
        </div>
      </div>
    </div>
  );
}
