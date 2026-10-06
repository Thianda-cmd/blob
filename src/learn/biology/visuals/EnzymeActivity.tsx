"use client";

// Temperature and pH: two sliders that move a point along the activity curve and show what
// happens to the enzyme. Heating it too far denatures it for good: cool it down again and the
// activity stays low (irreversible), until you take fresh enzyme.

import { AnimatePresence, motion } from "motion/react";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { PH_ENZYMES, phActivity, survivors, tempActivity } from "@/learn/biology/topics/enzymes/data";
import { dec } from "@/learn/chemistry/format";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { ACTIVITY, Chart, curvePath, PH_AXIS, TEMP_AXIS } from "./EnzymeCharts";
import { C, EnzymeBody, EnzymeChain, SubstrateShape } from "./EnzymeShapes";

type State = "slow" | "ok" | "bent" | "chain";

/** The enzyme as it is now: working, slowed down, deformed or unfolded. */
function EnzymeState({ state }: { state: State }) {
  const t = useText();
  const label: Record<State, Text> = {
    slow: tx("intact, but slow", "intakt, aber langsam"),
    ok: tx("intact: the substrate fits", "intakt: Das Substrat passt"),
    bent: tx("active site deformed", "aktives Zentrum verformt"),
    chain: tx("denatured: unfolded chain", "denaturiert: entfaltete Kette"),
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 300 200" className="block h-auto w-full max-w-[220px]" role="img" aria-label={t(label[state])}>
        <g transform="translate(150 112) scale(0.82)">
          <AnimatePresence initial={false}>
            {state === "chain" ? (
              <motion.g key="chain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EnzymeChain />
              </motion.g>
            ) : (
              <motion.g key="body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EnzymeBody variant={state === "bent" ? "distorted" : "fit"} />
              </motion.g>
            )}
          </AnimatePresence>
          <motion.g
            initial={false}
            animate={state === "ok" ? { x: 0, y: 0, rotate: 0 } : state === "slow" ? { x: -70, y: -92, rotate: -10 } : { x: 0, y: -96, rotate: -8 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
          >
            <SubstrateShape fill={C.sub} />
          </motion.g>
        </g>
      </svg>
      <span className="text-center text-[12.5px] font-medium text-ink-2">{t(label[state])}</span>
    </div>
  );
}

const OPT = 37;

function TempPanel() {
  const t = useText();
  const [temp, setTemp] = useState(20);
  const [hottest, setHottest] = useState(20);
  const alive = survivors(hottest, OPT);
  const fresh = tempActivity(temp, OPT);
  const act = fresh * alive;
  const damaged = alive < 0.9;
  const state: State = alive < 0.1 || temp >= 56 ? "chain" : temp > 45 || alive < 0.6 ? "bent" : temp < 12 ? "slow" : "ok";

  const info: Text = damaged && temp < hottest - 4
    ? txMap((tt, l) =>
        tt(
          `You heated the enzyme to ${dec(hottest, l, 0)} °C. Cooling it down doesn't help: the unfolded protein does not fold back correctly. Denaturation is **irreversible**.`,
          `Du hast das Enzym auf ${dec(hottest, l, 0)} °C erhitzt. Abkühlen hilft nicht: Das entfaltete Protein faltet sich nicht wieder richtig zurück. Die Denaturierung ist **irreversibel**.`,
        ),
      )
    : temp < 12
      ? tx(
          "Cold: the particles move slowly, so enzyme and substrate rarely meet. The enzyme is **not damaged**: warm it up and it works again (reversible).",
          "Kalt: Die Teilchen bewegen sich langsam, Enzym und Substrat treffen selten aufeinander. Das Enzym ist aber **nicht geschädigt**: Erwärmst du es, arbeitet es wieder (reversibel).",
        )
      : temp < OPT - 3
        ? tx(
            "**RGT rule**: 10 °C warmer makes the reaction about 2 to 3 times as fast. The particles move faster and collide more often.",
            "**RGT-Regel**: 10 °C wärmer macht die Reaktion etwa 2- bis 3-mal so schnell. Die Teilchen bewegen sich schneller und stoßen häufiger zusammen.",
          )
        : temp <= OPT + 3
          ? tx("**Optimum**: at about 37 °C this human enzyme works fastest.", "**Optimum**: Bei etwa 37 °C arbeitet dieses Enzym des Menschen am schnellsten.")
          : temp < 56
            ? tx(
                "Too hot: the folded structure starts to come apart and the active site is deformed (**denaturation**). The activity drops steeply.",
                "Zu heiß: Die räumliche Struktur löst sich auf, das aktive Zentrum verformt sich (**Denaturierung**). Die Aktivität fällt steil ab.",
              )
            : tx(
                "**Denatured**: the protein has unfolded, the active site is gone. Now cool it down again and watch.",
                "**Denaturiert**: Das Protein ist entfaltet, das aktive Zentrum ist zerstört. Kühl es jetzt wieder ab und beobachte.",
              );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-1.5">
          <Chart x={{ min: 0, max: 80, step: 10, minor: 5, label: TEMP_AXIS }} y={{ min: 0, max: 100, step: 20, minor: 10, label: ACTIVITY }} label={tx("Enzyme activity against temperature", "Enzymaktivität in Abhängigkeit von der Temperatur")}>
            {(s) => (
              <>
                <rect x={s.px(45)} y={s.y1} width={s.x1 - s.px(45)} height={s.y0 - s.y1} fill="color-mix(in oklab, var(--bio-blood) 9%, transparent)" />
                <text x={s.px(62.5)} y={s.y1 + 14} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(tx("denaturation", "Denaturierung"))}
                </text>
                {damaged && <path d={curvePath((x) => 100 * tempActivity(x, OPT), 0, 80, s)} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="6 5" />}
                <motion.path initial={false} animate={{ d: curvePath((x) => 100 * tempActivity(x, OPT) * alive, 0, 80, s, 120) }} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
                <path d={`M ${s.px(temp)} ${s.y0} L ${s.px(temp)} ${s.py(100 * act)} L ${s.x0} ${s.py(100 * act)}`} fill="none" stroke="var(--blob)" strokeWidth={1.3} strokeDasharray="3 4" opacity={0.8} />
                <circle cx={s.px(temp)} cy={s.py(100 * act)} r={6.5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={3} />
              </>
            )}
          </Chart>
        </div>
        <EnzymeState state={state} />
      </div>

      <label className="flex items-center gap-3 text-[13px] text-ink-2">
        <span className="shrink-0">{t(tx("Temperature", "Temperatur"))}</span>
        <input
          type="range"
          min={0}
          max={80}
          step={1}
          value={temp}
          onChange={(e) => {
            const v = Number(e.target.value);
            setTemp(v);
            setHottest((h) => Math.max(h, v));
          }}
          className="w-full accent-[var(--blob)]"
        />
        <span className="w-[8.5rem] shrink-0 text-right tabular-nums">
          <span className="font-semibold text-ink">{temp} °C</span> · {Math.round(100 * act)} %
        </span>
      </label>

      <div className="flex flex-wrap items-start gap-2">
        <motion.p
          key={`${state}-${damaged && temp < hottest - 4}-${temp < 12 ? 0 : temp < OPT - 3 ? 1 : temp <= OPT + 3 ? 2 : 3}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("min-h-[3.2rem] flex-1 rounded-xl px-3.5 py-2.5 text-[14.5px] leading-relaxed", damaged ? "bg-danger/[0.07] text-ink" : "bg-hover/60 text-ink-2")}
          aria-live="polite"
        >
          <Inline text={info} />
        </motion.p>
        {damaged && (
          <button
            type="button"
            onClick={() => {
              setTemp(OPT);
              setHottest(OPT);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-[13.5px] font-medium text-ink hover:bg-hover"
          >
            <FlaskConical className="size-4" /> {t(tx("Fresh enzyme", "Frisches Enzym"))}
          </button>
        )}
      </div>
      <p className="text-[12.5px] text-ink-3">{t(tx("Try it: heat the enzyme above 60 °C, then cool it back down to 37 °C.", "Probier es aus: Erhitze das Enzym auf über 60 °C und kühl es dann wieder auf 37 °C ab."))}</p>
    </div>
  );
}

const PH_SHOWN = ["pepsin", "amylase", "trypsin"];
const COLOURS = ["var(--blob)", "var(--bio-water-deep)", "var(--bio-mito-deep)"];

function PhPanel() {
  const t = useText();
  const locale = useLocale();
  const [ph, setPh] = useState(7);
  const [id, setId] = useState("pepsin");
  const enzymes = PH_ENZYMES.filter((e) => PH_SHOWN.includes(e.id));
  const e = enzymes.find((x) => x.id === id)!;
  const act = phActivity(ph, e.opt, e.width);
  const far = Math.abs(ph - e.opt) > 4.5;
  const state: State = far ? "chain" : act < 0.4 ? "bent" : "ok";
  const kind = ph < 6.5 ? tx("acidic", "sauer") : ph > 7.5 ? tx("basic", "basisch") : tx("neutral", "neutral");
  const where: Record<string, Text> = {
    pepsin: tx("Pepsin splits proteins **in the stomach**, where hydrochloric acid makes it very acidic (pH 1 to 2). Its optimum is about **pH 2**.", "Pepsin spaltet Proteine **im Magen**, wo Salzsäure für eine sehr saure Umgebung sorgt (pH 1 bis 2). Sein Optimum liegt bei etwa **pH 2**."),
    amylase: tx("Salivary amylase splits starch **in the mouth**, where saliva is about neutral. Its optimum is about **pH 7**. In the acidic stomach it stops working.", "Die Speichel-Amylase spaltet Stärke **in der Mundhöhle**, wo der Speichel etwa neutral ist. Ihr Optimum liegt bei etwa **pH 7**. Im sauren Magen hört sie auf zu arbeiten."),
    trypsin: tx("Trypsin splits proteins **in the small intestine**, where it is slightly basic. Its optimum is about **pH 8**.", "Trypsin spaltet Proteine **im Dünndarm**, wo es leicht basisch ist. Sein Optimum liegt bei etwa **pH 8**."),
  };
  const info: Text = far
    ? tx("So far from its optimum the enzyme is **denatured**: strong acids and bases destroy its folded structure.", "So weit weg vom Optimum wird das Enzym **denaturiert**: Starke Säuren und Basen zerstören seine räumliche Struktur.")
    : act < 0.4
      ? tx("Away from the optimum the **charges** in the active site change. The substrate binds badly, the activity drops.", "Abseits vom Optimum ändern sich die **Ladungen** im aktiven Zentrum. Das Substrat bindet schlecht, die Aktivität sinkt.")
      : where[id];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {enzymes.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setId(x.id)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              id === x.id ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <span className="size-2.5 rounded-full" style={{ background: COLOURS[i] }} />
            {t(x.name).replace(/^./, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-1.5">
          <Chart x={{ min: 0, max: 14, step: 1, label: PH_AXIS }} y={{ min: 0, max: 100, step: 20, minor: 10, label: ACTIVITY }} label={tx("Enzyme activity against pH", "Enzymaktivität in Abhängigkeit vom pH-Wert")}>
            {(s) => (
              <>
                {enzymes.map((x, i) => (
                  <path
                    key={x.id}
                    d={curvePath((v) => 100 * phActivity(v, x.opt, x.width), 0, 14, s)}
                    fill="none"
                    stroke={COLOURS[i]}
                    strokeWidth={x.id === id ? 3.2 : 1.8}
                    opacity={x.id === id ? 1 : 0.4}
                    strokeLinecap="round"
                  />
                ))}
                <path d={`M ${s.px(ph)} ${s.y0} L ${s.px(ph)} ${s.py(100 * act)}`} stroke="var(--ink-2)" strokeWidth={1.3} strokeDasharray="3 4" />
                <circle cx={s.px(ph)} cy={s.py(100 * act)} r={6.5} fill="var(--raised)" stroke={COLOURS[enzymes.findIndex((x) => x.id === id)]} strokeWidth={3} />
              </>
            )}
          </Chart>
        </div>
        <EnzymeState state={state} />
      </div>
      <label className="flex items-center gap-3 text-[13px] text-ink-2">
        <span className="shrink-0">{t(tx("pH", "pH-Wert"))}</span>
        <input type="range" min={0} max={14} step={0.5} value={ph} onChange={(ev) => setPh(Number(ev.target.value))} className="w-full accent-[var(--blob)]" />
        <span className="w-[9.5rem] shrink-0 text-right tabular-nums">
          <span className="font-semibold text-ink">pH {dec(ph, locale, 1)}</span> ({t(kind)}) · {Math.round(100 * act)} %
        </span>
      </label>
      <motion.p
        key={`${id}-${state}`}
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

export function EnzymeActivity() {
  const t = useText();
  const [tab, setTab] = useState<"temp" | "ph">("temp");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-line p-0.5">
        {(["temp", "ph"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn("relative rounded-md px-3.5 py-1.5 text-[13px] font-medium", tab === k ? "text-ink" : "text-ink-3 hover:text-ink")}
          >
            {tab === k && <motion.span layoutId="enzyme-activity-tab" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{k === "temp" ? t(tx("Temperature", "Temperatur")) : t(tx("pH", "pH-Wert"))}</span>
          </button>
        ))}
      </div>
      {tab === "temp" ? <TempPanel /> : <PhPanel />}
    </div>
  );
}
