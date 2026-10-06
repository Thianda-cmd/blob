"use client";

// Rate of photosynthesis for level 2: a simple limiting-factor model (Blackman: the factor in
// shortest supply sets the rate), the lab widget with sliders for light, CO2 and temperature, a
// static rate graph for tasks and a net-oxygen graph with the compensation point.

import { AnimatePresence, motion } from "motion/react";
import { Pin, PinOff } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The model (relative units, 0–100)

export type Env = { co2: number; temp: number };
export type Factor = "light" | "co2" | "temp";

/** What light alone would allow (light in % of full sunlight). */
const byLight = (light: number) => 1.3 * light;
/** What the CO2 concentration (in %) allows. */
const byCo2 = (co2: number) => (118 * co2) / (co2 + 0.06);
/** What the enzymes allow at this temperature (°C): rises up to about 33 °C, then falls fast. */
export const byTemp = (temp: number) => (temp <= 33 ? 100 * 2 ** ((temp - 33) / 9) : 100 * Math.max(0, 1 - ((temp - 33) / 13) ** 2));

const limits = (light: number, env: Env) => ({ light: byLight(light), co2: byCo2(env.co2), temp: byTemp(env.temp) });

/** The rate: a soft minimum of the three limits (the smallest one wins). */
export function rateOf(light: number, env: Env) {
  const l = limits(light, env);
  const vals = [l.light, l.co2, l.temp];
  if (vals.some((v) => v <= 0.001)) return 0;
  return vals.reduce((s, v) => s + v ** -8, 0) ** (-1 / 8);
}

/** The factor in shortest supply. */
export function limitingFactor(light: number, env: Env): Factor {
  const l = limits(light, env);
  return (Object.keys(l) as Factor[]).reduce((a, b) => (l[b] < l[a] ? b : a));
}

/** Plateau of the curve (the rate in full light). */
export const plateauOf = (env: Env) => rateOf(100, env);

// ---------------------------------------------------------------------------
// Chart frame

const W = 420;
const H = 260;
const M = { l: 44, r: 16, t: 14, b: 40 };
const px = (x: number, xMax: number) => M.l + (x / xMax) * (W - M.l - M.r);
const py = (y: number, yMin: number, yMax: number) => H - M.b - ((y - yMin) / (yMax - yMin)) * (H - M.t - M.b);

function curvePath(env: Env, upTo = 100) {
  const pts: string[] = [];
  for (let x = 0; x <= upTo + 1e-9; x += 2) pts.push(`${pts.length ? "L" : "M"}${px(x, 100).toFixed(1)} ${py(rateOf(x, env), 0, 100).toFixed(1)}`);
  return pts.join(" ");
}

function Axes({ xLabel, yLabel, xTicks, yTicks, xMax, yMin = 0, yMax = 100, zero }: { xLabel: string; yLabel: string; xTicks?: { v: number; label: string }[]; yTicks?: { v: number; label: string }[]; xMax: number; yMin?: number; yMax?: number; zero?: boolean }) {
  return (
    <g>
      {(yTicks ?? []).map((t) => (
        <g key={`y${t.v}`}>
          <line x1={M.l} x2={W - M.r} y1={py(t.v, yMin, yMax)} y2={py(t.v, yMin, yMax)} stroke={zero && t.v === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={zero && t.v === 0 ? 1.2 : 0.8} />
          <text x={M.l - 6} y={py(t.v, yMin, yMax) + 3.8} textAnchor="end" fontSize={11} className="fill-ink-3 tabular-nums">
            {t.label}
          </text>
        </g>
      ))}
      {(xTicks ?? []).map((t) => (
        <g key={`x${t.v}`}>
          <line x1={px(t.v, xMax)} x2={px(t.v, xMax)} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeWidth={0.8} />
          <text x={px(t.v, xMax)} y={H - M.b + 15} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
            {t.label}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t - 4} y2={H - M.b} stroke="var(--ink-2)" strokeWidth={1.3} />
      <line x1={M.l} x2={W - M.r + 4} y1={py(zero ? 0 : yMin, yMin, yMax)} y2={py(zero ? 0 : yMin, yMin, yMax)} stroke="var(--ink-2)" strokeWidth={1.3} />
      <text x={W - M.r} y={H - 6} textAnchor="end" fontSize={11.5} className="fill-ink-2">
        {xLabel}
      </text>
      <text x={M.l + 6} y={M.t + 4} fontSize={11.5} className="fill-ink-2">
        {yLabel}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Static graph for tasks

export type RateCurve = { co2: number; temp: number; label: Text };
export type RatePoint = { curve: number; light: number; label: string };

/** Rate of photosynthesis against light intensity, one or more curves, optional labelled points. */
export function PhotoRateGraph({ curves, points = [] }: { curves: RateCurve[]; points?: RatePoint[] }) {
  const t = useText();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(tx("Rate of photosynthesis against light intensity", "Fotosyntheserate in Abhängigkeit von der Lichtintensität"))}>
      <Axes xLabel={t(tx("light intensity", "Lichtintensität"))} yLabel={t(tx("rate of photosynthesis", "Fotosyntheserate"))} xMax={100} />
      {curves.map((c, i) => {
        const y = py(rateOf(100, c), 0, 100);
        return (
          <g key={i}>
            <path d={curvePath(c)} fill="none" stroke={i === 0 ? "var(--blob)" : i === 1 ? "var(--bio-leaf-deep)" : "var(--bio-mito-deep)"} strokeWidth={2.6} strokeLinecap="round" strokeDasharray={i === 2 ? "7 5" : undefined} />
            <text x={W - M.r - 2} y={y - 7} textAnchor="end" fontSize={11.5} fontWeight={600} className="fill-ink" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">
              {t(c.label)}
            </text>
          </g>
        );
      })}
      {points.map((p) => {
        const c = curves[p.curve];
        const x = px(p.light, 100);
        const y = py(rateOf(p.light, c), 0, 100);
        return (
          <g key={p.label}>
            <circle cx={x} cy={y} r={5} fill="var(--raised)" stroke="var(--ink)" strokeWidth={2} />
            <text x={x} y={y + 19} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-ink" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Net oxygen release against light intensity: the compensation point

/** Net O2 release (photosynthesis minus respiration) for a plant whose compensation point is `comp` klx. */
export function netOf(light: number, comp: number, resp: number) {
  const K = 6;
  const pmax = (resp * (comp + K)) / comp;
  return (pmax * light) / (light + K) - resp;
}

export function PhotoNetGraph({ comp, resp, mark }: { comp: number; resp: number; mark?: boolean }) {
  const t = useText();
  const locale = useLocale();
  const xMax = 20;
  const yMax = Math.ceil(netOf(20, comp, resp) / 10) * 10 + 10;
  const yMin = -Math.ceil(resp / 10) * 10 - 10;
  const pts: string[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += 0.25) pts.push(`${pts.length ? "L" : "M"}${px(x, xMax).toFixed(1)} ${py(netOf(x, comp, resp), yMin, yMax).toFixed(1)}`);
  const yTicks: { v: number; label: string }[] = [];
  for (let v = yMin; v <= yMax; v += 10) yTicks.push({ v, label: v < 0 ? `−${-v}` : String(v) });
  const xTicks = Array.from({ length: 11 }, (_, i) => ({ v: i * 2, label: dec(i * 2, locale) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(tx("Net oxygen release against light intensity", "Netto-Sauerstoffabgabe in Abhängigkeit von der Lichtintensität"))}>
      {/* minor grid every 0.5 klx makes the reading possible */}
      {Array.from({ length: 40 }, (_, i) => (
        <line key={i} x1={px(i * 0.5, xMax)} x2={px(i * 0.5, xMax)} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeWidth={0.4} />
      ))}
      <Axes xLabel={t(tx("light intensity in klx", "Lichtintensität in klx"))} yLabel={t(tx("O₂ release (net)", "O₂-Abgabe (netto)"))} xMax={xMax} yMin={yMin} yMax={yMax} xTicks={xTicks} yTicks={yTicks} zero />
      <path d={pts.join(" ")} fill="none" stroke="var(--blob)" strokeWidth={2.6} strokeLinecap="round" />
      {mark && <circle cx={px(comp, xMax)} cy={py(0, yMin, yMax)} r={5.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={2.6} />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The limiting-factor lab

const MORE: Record<Factor, Text> = {
  light: tx("More light", "Mehr Licht"),
  co2: tx("More CO₂", "Mehr CO₂"),
  temp: tx("5 °C warmer", "5 °C wärmer"),
};

const FACTOR_NAME: Record<Factor, Text> = {
  light: tx("light intensity", "Lichtintensität"),
  co2: tx("CO₂ concentration", "CO₂-Konzentration"),
  temp: tx("temperature", "Temperatur"),
};

export function PhotoLimitingLab() {
  const t = useText();
  const locale = useLocale();
  const [light, setLight] = useState(30);
  const [co2, setCo2] = useState(0.04);
  const [temp, setTemp] = useState(25);
  const [pinned, setPinned] = useState<Env | null>(null);
  const env = { co2, temp };
  const rate = rateOf(light, env);
  const lim = limitingFactor(light, env);
  const hot = lim === "temp" && temp > 34;

  const gains: { f: Factor; d: number }[] = [
    { f: "light", d: rateOf(Math.min(100, light + 15), env) - rate },
    { f: "co2", d: rateOf(light, { co2: Math.min(0.2, co2 * 1.8), temp }) - rate },
    { f: "temp", d: rateOf(light, { co2, temp: temp + 5 }) - rate },
  ];

  const say: Record<Factor, Text> = {
    light: tx(
      "Light is in shortest supply. More light raises the rate; more CO₂ or warmth would hardly help. You're on the rising part of the curve.",
      "Am knappsten ist das Licht. Mehr Licht steigert die Rate, mehr CO₂ oder Wärme brächte kaum etwas. Du bist im ansteigenden Teil der Kurve.",
    ),
    co2: tx(
      "The curve has levelled off: more light doesn't help any more. Now carbon dioxide is in shortest supply. Raise the CO₂ and the whole plateau goes up.",
      "Die Kurve ist abgeflacht: Mehr Licht hilft nicht mehr. Jetzt ist Kohlenstoffdioxid am knappsten. Erhöhe das CO₂, dann steigt das ganze Plateau.",
    ),
    temp: hot
      ? tx("Too hot! Above about 35 °C the enzymes of photosynthesis are damaged, and the rate drops. More light or CO₂ can't fix that.", "Zu heiß! Über etwa 35 °C werden die Enzyme der Fotosynthese geschädigt, die Rate sinkt. Mehr Licht oder CO₂ ändert daran nichts.")
      : tx("It's too cold: the enzymes work slowly, so temperature limits the rate. A little warmth raises the plateau.", "Es ist zu kalt: Die Enzyme arbeiten langsam, die Temperatur begrenzt die Rate. Etwas Wärme hebt das Plateau."),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-start">
        <div className="rounded-xl border border-line bg-surface p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Rate of photosynthesis against light intensity", "Fotosyntheserate in Abhängigkeit von der Lichtintensität"))}>
            <Axes xLabel={t(tx("light intensity", "Lichtintensität"))} yLabel={t(tx("rate of photosynthesis", "Fotosyntheserate"))} xMax={100} />
            {pinned && <path d={curvePath(pinned)} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />}
            <path d={curvePath(env)} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <line x1={px(light, 100)} x2={px(light, 100)} y1={py(rate, 0, 100)} y2={H - M.b} stroke="var(--blob)" strokeWidth={1.2} strokeDasharray="3 3" />
            <circle cx={px(light, 100)} cy={py(rate, 0, 100)} r={7} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />
          </svg>
        </div>
        <div className="space-y-3">
          <Slider label={t(tx("Light intensity", "Lichtintensität"))} value={light} min={0} max={100} step={1} onChange={setLight} show={`${light} %`} />
          <Slider label={t(tx("CO₂ in the air", "CO₂ in der Luft"))} value={co2} min={0.01} max={0.15} step={0.01} onChange={(v) => setCo2(Math.round(v * 100) / 100)} show={`${dec(co2, locale)} %`} />
          <Slider label={t(tx("Temperature", "Temperatur"))} value={temp} min={0} max={45} step={1} onChange={setTemp} show={`${temp} °C`} />
          <button
            type="button"
            onClick={() => setPinned(pinned ? null : env)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            {pinned ? t(tx("Remove the pinned curve", "Gemerkte Kurve entfernen")) : t(tx("Pin this curve to compare", "Kurve zum Vergleich merken"))}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-live="polite">
        {gains.map((g) => {
          const on = g.f === lim;
          return (
            <div key={g.f} className={cn("rounded-xl border px-3 py-2 transition-colors", on ? "border-blob bg-blob-soft/70" : "border-line bg-surface")}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(MORE[g.f])}</div>
              <div className={cn("font-math text-[20px] tabular-nums", on ? "text-blob-ink" : "text-ink-2")}>
                {g.d >= 0.5 ? "+" : g.d <= -0.5 ? "−" : "±"}
                {dec(Math.abs(Math.round(g.d)), locale)}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${lim}-${hot}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className="rounded-xl bg-blob-soft/70 px-4 py-3 text-[14.5px] leading-relaxed text-ink"
        >
          <span className="font-semibold">
            {t(tx("Limiting factor", "Begrenzender Faktor"))}: {t(FACTOR_NAME[lim])}.
          </span>{" "}
          {t(say[lim])}
        </motion.p>
      </AnimatePresence>
      <p className="text-[12px] text-ink-3">{t(tx("A model in relative units. Real values depend on the plant.", "Ein Modell in relativen Einheiten. Echte Werte hängen von der Pflanze ab."))}</p>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, show }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; show: string }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13.5px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="font-math text-[17px] tabular-nums text-ink">{show}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-full cursor-pointer accent-[var(--blob)]" />
    </label>
  );
}
