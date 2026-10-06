"use client";

// Warm- and cold-blooded on a slider, for the "vertebrates" topic.
//  - "thermo" (level 1): a mouse and a lizard with thermometers; drag the outside temperature.
//  - "graph" (level 2): body temperature against outside temperature, with a hibernating hedgehog.
//  - "energy" (level 3): the same plus the energy use (oxygen consumption) of both animals.
// As a task picture: `fixed` puts a marker at one outside temperature, `anon` names the curves A and B.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Snowflake, Sun } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { decText } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";
import { ClassAnimal } from "./VertebrateAnimals";

/** Body temperatures (°C) at an outside temperature `ta`. */
export const mouseT = () => 37;
export const lizardT = (ta: number) => ta;
/** Hedgehog in hibernation: body temperature follows the surroundings but is defended at about 5 °C. */
export const hedgehogT = (ta: number) => Math.max(5, ta + 1);
/** Energy use, relative to the mouse's resting value. */
export const mouseE = (ta: number) => (ta < 30 ? 1 + 0.1 * (30 - ta) : ta <= 34 ? 1 : 1 + 0.15 * (ta - 34));
export const lizardE = (ta: number) => 0.15 * 2 ** ((ta - 30) / 10);

const WARM = "var(--bio-mito-deep)";
const COLD = "var(--bio-leaf-deep)";
const HEDGE = "var(--bio-nucleus-deep)";

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useText();
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px] font-semibold text-ink-2">
        <span>{t(tx("Outside temperature", "Außentemperatur"))}</span>
        <span className="font-math text-[17px] text-ink">{value} °C</span>
      </span>
      <span className="mt-1.5 flex items-center gap-2.5">
        <Snowflake className="size-4 shrink-0 text-ink-3" />
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer"
          style={{ accentColor: "var(--blob)" }}
          aria-label={t(tx("Outside temperature in °C", "Außentemperatur in °C"))}
        />
        <Sun className="size-4 shrink-0 text-ink-3" />
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Level 1: two thermometers

function Thermometer({ value, color }: { value: number; color: string }) {
  const top = 10;
  const bottom = 128;
  const y = bottom - (value / 45) * (bottom - top);
  return (
    <svg viewBox="0 0 44 160" className="h-[150px] w-auto shrink-0" aria-hidden>
      <rect x={14} y={4} width={16} height={130} rx={8} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.5} />
      {[0, 10, 20, 30, 40].map((v) => {
        const yy = bottom - (v / 45) * (bottom - top);
        return <line key={v} x1={30} x2={36} y1={yy} y2={yy} stroke="var(--ink-3)" strokeWidth={1.2} />;
      })}
      <motion.rect x={18} width={8} rx={4} fill={color} initial={false} animate={{ y, height: 140 - y }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
      <circle cx={22} cy={142} r={12} fill={color} stroke="var(--ink-3)" strokeWidth={1.5} />
    </svg>
  );
}

function Thermo() {
  const t = useText();
  const reduce = useReducedMotion();
  const [ta, setTa] = useState(20);
  const tl = lizardT(ta);
  const food = mouseE(ta);
  const lizardState: { label: Text; speed: number } =
    ta < 8
      ? { label: tx("Cold rigor: can hardly move", "Kältestarre: kann sich kaum bewegen"), speed: 0 }
      : ta < 18
        ? { label: tx("Slow and sluggish", "Langsam und träge"), speed: 0.35 }
        : ta <= 35
          ? { label: tx("Quick and active", "Flink und aktiv"), speed: 1 }
          : { label: tx("Too hot: looks for shade", "Zu heiß: sucht Schatten"), speed: 0.5 };
  const wiggle = !reduce && lizardState.speed > 0;
  return (
    <div className="space-y-5">
      <Slider value={ta} onChange={setTa} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <Thermometer value={37} color={WARM} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="w-24">
              <ClassAnimal cls="mammal" title={false} />
            </div>
            <div className="text-[15px] font-semibold">{t(tx("Mouse: warm-blooded", "Maus: gleichwarm"))}</div>
            <div className="font-math text-[24px] leading-none" style={{ color: WARM }}>
              37 °C
            </div>
            <div className="text-[13px] text-ink-2">{t(tx("Food needed (energy):", "Futterbedarf (Energie):"))}</div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-hover">
              <motion.div className="h-full rounded-full" style={{ background: WARM }} initial={false} animate={{ width: `${Math.min(100, (food / 4.2) * 100)}%` }} transition={{ type: "spring", stiffness: 160, damping: 24 }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <Thermometer value={tl} color={COLD} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <motion.div
              className="w-24"
              animate={wiggle ? { x: [0, 6, 0, -2, 0], rotate: [0, -2, 0, 2, 0] } : { x: 0, rotate: 0 }}
              transition={wiggle ? { duration: 1.6 / lizardState.speed, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            >
              <ClassAnimal cls="rept" title={false} />
            </motion.div>
            <div className="text-[15px] font-semibold">{t(tx("Lizard: cold-blooded", "Eidechse: wechselwarm"))}</div>
            <div className="font-math text-[24px] leading-none" style={{ color: COLD }}>
              {tl} °C
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={t(lizardState.label)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-ink-2">
                {t(lizardState.label)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <p className="text-[13.5px] text-ink-3">
        {ta >= 30
          ? t(tx("Look: on a hot day the lizard is just as warm as the mouse. Cold-blooded doesn't mean cold!", "Schau: An einem heißen Tag ist die Eidechse genauso warm wie die Maus. Wechselwarm heißt nicht kalt!"))
          : t(tx("Drag the slider. Whose body temperature changes?", "Zieh am Regler. Wessen Körpertemperatur ändert sich?"))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Levels 2 and 3: graphs

const W = 520;
const H = 300;
const X0 = 58;
const X1 = 500;
const Y0 = 256;
const Y1 = 18;
const sx = (ta: number) => X0 + (ta / 40) * (X1 - X0);

type Series = { id: string; label: Text; color: string; dash?: string; f: (ta: number) => number; from?: number; to?: number };

function Chart({ series, ymax, yTicks, yLabel, at, zone, decimals = 0 }: { series: Series[]; ymax: number; yTicks: number[]; yLabel: Text; at: number | null; zone?: [number, number]; decimals?: number }) {
  const t = useText();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const sy = (v: number) => Y0 - (v / ymax) * (Y0 - Y1);
  const path = (s: Series) => {
    const pts: string[] = [];
    for (let ta = s.from ?? 0; ta <= (s.to ?? 40) + 1e-9; ta += 0.5) pts.push(`${pts.length ? "L" : "M"}${sx(ta).toFixed(1)} ${sy(Math.min(ymax, s.f(ta))).toFixed(1)}`);
    return pts.join(" ");
  };
  const font = { fontFamily: "var(--font-sans)" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(yLabel)}>
      <defs>
        <clipPath id={`${uid}-plot`}>
          <rect x={X0} y={Y1 - 4} width={X1 - X0 + 4} height={Y0 - Y1 + 4} />
        </clipPath>
      </defs>
      {zone && <rect x={sx(zone[0])} y={Y1} width={sx(zone[1]) - sx(zone[0])} height={Y0 - Y1} fill="var(--blob)" opacity={0.08} />}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={sy(v)} y2={sy(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={X0 - 8} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={14} fill="var(--ink-2)" style={font}>
            {t(decText(v, decimals))}
          </text>
        </g>
      ))}
      {[0, 10, 20, 30, 40].map((v) => (
        <text key={v} x={sx(v)} y={Y0 + 18} textAnchor="middle" fontSize={14} fill="var(--ink-2)" style={font}>
          {v}
        </text>
      ))}
      <line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke="var(--ink-2)" strokeWidth={1.5} />
      <line x1={X0} x2={X0} y1={Y0} y2={Y1 - 6} stroke="var(--ink-2)" strokeWidth={1.5} />
      <text x={(X0 + X1) / 2} y={H - 4} textAnchor="middle" fontSize={14} fill="var(--ink)" style={font}>
        {t(tx("outside temperature in °C", "Außentemperatur in °C"))}
      </text>
      <text x={14} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={14} fill="var(--ink)" style={font} transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}>
        {t(yLabel)}
      </text>
      <g clipPath={`url(#${uid}-plot)`}>
        {series.map((s) =>
          s.dash ? (
            <motion.path key={s.id} d={path(s)} fill="none" stroke={s.color} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={s.dash} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
          ) : (
            <motion.path key={s.id} d={path(s)} fill="none" stroke={s.color} strokeWidth={3.5} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} />
          ),
        )}
      </g>
      {at !== null && (
        <g>
          <motion.line initial={false} animate={{ x1: sx(at), x2: sx(at) }} y1={Y0} y2={Y1} stroke="var(--blob)" strokeWidth={1.5} strokeDasharray="5 4" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          {series
            .filter((s) => at >= (s.from ?? 0) && at <= (s.to ?? 40))
            .map((s) => (
              <motion.circle key={s.id} r={7} fill={s.color} stroke="var(--raised)" strokeWidth={2.5} initial={false} animate={{ cx: sx(at), cy: sy(Math.min(ymax, s.f(at))) }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
            ))}
        </g>
      )}
    </svg>
  );
}

function Legend({ series, at, unit, digits }: { series: Series[]; at: number | null; unit: string; digits: number }) {
  const t = useText();
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[14px]">
      {series.map((s) => {
        const on = at !== null && at >= (s.from ?? 0) && at <= (s.to ?? 40);
        return (
          <span key={s.id} className="flex items-center gap-2">
            <svg width="26" height="8" aria-hidden>
              <line x1="1" x2="25" y1="4" y2="4" stroke={s.color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={s.dash} />
            </svg>
            <span className="text-ink-2">{t(s.label)}</span>
            {on && (
              <span className="font-math text-[16px] text-ink">
                {t(decText(s.f(at!), digits))}
                {unit}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

const BODY: Series[] = [
  { id: "mouse", label: tx("mouse (warm-blooded)", "Maus (gleichwarm)"), color: WARM, f: mouseT },
  { id: "lizard", label: tx("lizard (cold-blooded)", "Eidechse (wechselwarm)"), color: COLD, f: lizardT },
];
const HEDGEHOG: Series = { id: "hedgehog", label: tx("hedgehog in hibernation", "Igel im Winterschlaf"), color: HEDGE, dash: "7 6", f: hedgehogT, from: 0, to: 10 };
const ENERGY: Series[] = [
  { id: "mouse", label: tx("mouse (endothermic)", "Maus (endotherm)"), color: WARM, f: mouseE },
  { id: "lizard", label: tx("lizard (ectothermic)", "Eidechse (ektotherm)"), color: COLD, f: lizardE },
];

/** Task picture: the body-temperature graph with curves A and B (and a marker at `fixed`). */
export function VertebrateTempGraph({ fixed = null, anon = false, swap = false, energy = false }: { fixed?: number | null; anon?: boolean; swap?: boolean; energy?: boolean }) {
  const base = energy ? ENERGY : BODY;
  const series = anon ? base.map((s, i) => ({ ...s, label: (i === 0) !== swap ? "A" : "B", color: (i === 0) !== swap ? "var(--bio-water-deep)" : "var(--bio-petal-deep)" })) : base;
  const ordered = anon ? [...series].sort((a, b) => String(a.label).localeCompare(String(b.label))) : series;
  return (
    <div className="space-y-2">
      <Chart series={ordered} ymax={energy ? 4.5 : 45} yTicks={energy ? [0, 1, 2, 3, 4] : [0, 10, 20, 30, 40]} yLabel={energy ? tx("energy use (relative)", "Energieumsatz (relativ)") : tx("body temperature in °C", "Körpertemperatur in °C")} at={fixed} />
      <Legend series={ordered} at={null} unit="" digits={0} />
    </div>
  );
}

function Graphs({ energy }: { energy: boolean }) {
  const t = useText();
  const [ta, setTa] = useState(15);
  const [winter, setWinter] = useState(false);
  const [view, setView] = useState<"body" | "energy">("body");
  const showEnergy = energy && view === "energy";
  const series = showEnergy ? ENERGY : winter ? [...BODY, HEDGEHOG] : BODY;
  const note: Text = showEnergy
    ? ta < 30
      ? tx("Below about 30 °C the mouse has to burn more and more food to stay at 37 °C. The lizard's metabolism slows down in the cold.", "Unter etwa 30 °C muss die Maus immer mehr Nahrung verbrennen, um bei 37 °C zu bleiben. Der Stoffwechsel der Eidechse wird in der Kälte langsamer.")
      : ta <= 34
        ? tx("Thermoneutral zone (shaded): the mouse needs no extra energy for heating or cooling.", "Thermoneutrale Zone (hinterlegt): Die Maus braucht keine Extra-Energie zum Heizen oder Kühlen.")
        : tx("Too warm: the mouse spends energy on cooling. The lizard speeds up: a warmer body means faster reactions (RGT rule).", "Zu warm: Die Maus braucht Energie zum Kühlen. Die Eidechse wird schneller: Wärmer heißt schnellere Reaktionen (RGT-Regel).")
    : winter && ta <= 10
      ? tx("In hibernation the hedgehog lowers its set point: its body cools down to about 5 °C, but no lower. It is still warm-blooded and wakes up by heating itself.", "Im Winterschlaf senkt der Igel seinen Sollwert: Sein Körper kühlt auf etwa 5 °C ab, aber nicht weiter. Er bleibt gleichwarm und wacht auf, indem er sich selbst aufheizt.")
      : ta < 15
        ? tx("Cold: the lizard's body is as cold as its surroundings, it gets rigid. The mouse stays at 37 °C.", "Kalt: Der Körper der Eidechse ist so kalt wie die Umgebung, sie wird starr. Die Maus bleibt bei 37 °C.")
        : ta >= 33
          ? tx("Hot: now the lizard is about as warm as the mouse. Cold-blooded does not mean cold!", "Heiß: Jetzt ist die Eidechse etwa so warm wie die Maus. Wechselwarm heißt nicht kalt!")
          : tx("The mouse's line stays flat: it keeps its body temperature constant. The lizard's line rises with the surroundings.", "Die Linie der Maus bleibt waagerecht: Sie hält ihre Körpertemperatur konstant. Die Linie der Eidechse steigt mit der Umgebung.");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {energy && (
          <div className="flex rounded-full border border-line bg-surface p-0.5 text-[13.5px] font-semibold">
            {(["body", "energy"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-full px-3 py-1 transition-colors", view === v ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
                {v === "body" ? t(tx("Body temperature", "Körpertemperatur")) : t(tx("Energy use", "Energieumsatz"))}
              </button>
            ))}
          </div>
        )}
        {!showEnergy && (
          <button
            type="button"
            onClick={() => setWinter(!winter)}
            aria-pressed={winter}
            className={cn("rounded-full border px-3 py-1 text-[13.5px] font-semibold transition-colors", winter ? "border-blob bg-blob-soft text-blob-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}
          >
            {t(tx("Hedgehog in hibernation", "Igel im Winterschlaf"))}
          </button>
        )}
      </div>
      <Chart
        series={series}
        ymax={showEnergy ? 4.5 : 45}
        yTicks={showEnergy ? [0, 1, 2, 3, 4] : [0, 10, 20, 30, 40]}
        yLabel={showEnergy ? tx("energy use (relative)", "Energieumsatz (relativ)") : tx("body temperature in °C", "Körpertemperatur in °C")}
        at={ta}
        zone={showEnergy ? [30, 34] : undefined}
      />
      <Legend series={series} at={ta} unit={showEnergy ? "" : " °C"} digits={showEnergy ? 2 : 0} />
      <Slider value={ta} onChange={setTa} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={t(note)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="min-h-[3em] text-[14.5px] text-ink-2">
          {t(note)}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export function VertebrateTemperature({ mode = "thermo" }: { mode?: "thermo" | "graph" | "energy" }) {
  if (mode === "thermo") return <Thermo />;
  return <Graphs energy={mode === "energy"} />;
}

export const VertebrateThermo = () => <VertebrateTemperature mode="thermo" />;
export const VertebrateTempWidget = () => <VertebrateTemperature mode="graph" />;
export const VertebrateEnergyWidget = () => <VertebrateTemperature mode="energy" />;
