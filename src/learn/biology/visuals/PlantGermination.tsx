"use client";

// The germination experiment (Keimungsversuch): bean seeds on cotton wool. Switch water,
// warmth, oxygen and light on or off, run a week in fast motion and record the result.
// PlantDishes shows several prepared dishes (A, B, C…) as a picture for tasks.

import { animate, motion, useReducedMotion } from "motion/react";
import { Droplets, Play, RotateCcw, Sun, Thermometer, Wind } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { PlantChip, PlantNote } from "./PlantUi";

export type Conditions = { water: boolean; warm: boolean; oxygen: boolean; light: boolean };
export type Outcome = "none" | "swell" | "germ" | "pale";

/** What a week does to bean seeds under these conditions. */
export function outcomeOf(c: Conditions): Outcome {
  if (!c.water) return "none";
  if (!c.oxygen || !c.warm) return "swell";
  return c.light ? "germ" : "pale";
}

const SPEED = [1, 0.86, 1.1, 0.94, 0.9];

/** One bean seed at day `day` (0..7). */
function Seed({ x, base, day, c, k, scale = 1 }: { x: number; base: number; day: number; c: Conditions; k: number; scale?: number }) {
  const e = day * SPEED[k % SPEED.length];
  const out = outcomeOf(c);
  const swell = c.water ? Math.min(1, e / 1) : 0;
  const grows = out === "germ" || out === "pale";
  const root = grows ? Math.max(0, Math.min(1, (e - 1.4) / 2)) : 0;
  const shoot = grows ? Math.max(0, Math.min(1, (e - 2.8) / 3)) : 0;
  const leaves = grows ? Math.max(0, Math.min(1, (e - 4.8) / 1.6)) : 0;
  const pale = out === "pale";
  const h = (pale ? 150 : 96) * shoot;
  const stemFill = pale ? "color-mix(in oklab, var(--bio-sun) 45%, var(--raised))" : "var(--bio-leaf)";
  const stemLine = pale ? "var(--bio-nerve-deep)" : "var(--bio-leaf-deep)";
  const rx = 11 * (1 + 0.28 * swell);
  const ry = 7 * (1 + 0.28 * swell);
  const hook = shoot < 0.45;
  const top = base - ry - h;
  const shootPath = hook ? `M${x + 2} ${base - ry + 2} Q${x + 4} ${top - 6} ${x + 12} ${top + 4}` : `M${x + 2} ${base - ry + 2} Q${x + 1} ${base - ry - h * 0.5} ${x} ${top}`;
  return (
    <g transform={`translate(${x} ${base}) scale(${scale}) translate(${-x} ${-base})`}>
      {root > 0 && (
        <g>
          <path d={`M${x - 3} ${base + ry - 2} q-3 ${16 * root} 4 ${34 * root}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={4.6} strokeLinecap="round" />
          <path d={`M${x - 3} ${base + ry - 2} q-3 ${16 * root} 4 ${34 * root}`} fill="none" stroke="var(--bio-bone)" strokeWidth={2.8} strokeLinecap="round" />
          {root > 0.6 &&
            [0.45, 0.6, 0.75].map((f) => (
              <path key={f} d={`M${x - 3 - 1.2 + 3 * f} ${base + ry + 30 * root * f} l-5 -1 M${x - 1 + 3 * f} ${base + ry + 30 * root * f} l5 -1`} stroke="var(--bio-wood-deep)" strokeWidth={0.8} />
            ))}
        </g>
      )}
      {shoot > 0 && (
        <g>
          <path d={shootPath} fill="none" stroke={stemLine} strokeWidth={5} strokeLinecap="round" />
          <path d={shootPath} fill="none" stroke={stemFill} strokeWidth={3} strokeLinecap="round" />
        </g>
      )}
      {leaves > 0 &&
        [-1, 1].map((s) => (
          <path
            key={s}
            d={`M0 0 C${s * 4} ${-6 * leaves} ${s * 14 * leaves} ${-10 * leaves} ${s * (pale ? 7 : 20) * leaves} ${-4 * leaves} C${s * 12 * leaves} ${2 * leaves} ${s * 5} ${2} 0 0 Z`}
            transform={`translate(${x} ${top})`}
            fill={pale ? "color-mix(in oklab, var(--bio-sun) 70%, var(--raised))" : "var(--bio-leaf)"}
            stroke={stemLine}
            strokeWidth={1.3}
          />
        ))}
      <ellipse cx={x} cy={base} rx={rx} ry={ry} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      <ellipse cx={x - rx * 0.15} cy={base - ry * 0.55} rx={rx * 0.32} ry={1.6} fill="var(--bio-bone)" opacity={0.9} />
      {root > 0 && <path d={`M${x - rx * 0.6} ${base + 1} q${rx * 0.6} ${-3} ${rx * 1.2} 0`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />}
    </g>
  );
}

/** A dish of seeds in a setting that shows the conditions (lamp or dark box, thermometer, bell jar). */
function Scene({ c, day }: { c: Conditions; day: number }) {
  const xs = [130, 195, 260, 325, 390];
  const base = 230;
  return (
    <g>
      {/* light: a lamp shining, or a dark cardboard box */}
      {c.light ? (
        <g>
          <path d="M226 6 L294 6 L310 30 L210 30 Z" fill="var(--ink-3)" opacity={0.85} />
          <ellipse cx={260} cy={32} rx={22} ry={6} fill="var(--bio-sun)" />
          {[-60, -30, 0, 30, 60].map((a) => (
            <line key={a} x1={260 + Math.sin((a * Math.PI) / 180) * 30} y1={44} x2={260 + Math.sin((a * Math.PI) / 180) * 70} y2={70} stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
          ))}
        </g>
      ) : (
        <g>
          <rect x={70} y={14} width={380} height={262} rx={10} fill="var(--bio-wood)" opacity={0.28} stroke="var(--bio-wood-deep)" strokeWidth={2} strokeDasharray="10 6" />
          <path d="M86 46 a16 16 0 1 0 16 22 a12 12 0 1 1 -16 -22 Z" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.5} />
        </g>
      )}

      {/* thermometer */}
      <g>
        <rect x={470} y={120} width={12} height={110} rx={6} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.5} />
        <circle cx={476} cy={238} r={10} fill={c.warm ? "var(--bio-blood)" : "var(--bio-water)"} stroke="var(--ink-3)" strokeWidth={1.5} />
        <motion.rect x={473} width={6} rx={3} fill={c.warm ? "var(--bio-blood)" : "var(--bio-water)"} initial={false} animate={{ y: c.warm ? 150 : 214, height: c.warm ? 82 : 18 }} />
        <text x={476} y={110} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {c.warm ? "22 °C" : "4 °C"}
        </text>
      </g>

      {/* dish with cotton wool */}
      <path d="M88 226 L88 262 Q88 270 96 270 L424 270 Q432 270 432 262 L432 226" fill="none" stroke="var(--ink-3)" strokeWidth={2.2} />
      <path
        d="M92 266 L92 238 Q104 228 116 236 Q130 228 144 236 Q158 228 172 236 Q186 228 200 236 Q214 228 228 236 Q242 228 256 236 Q270 228 284 236 Q298 228 312 236 Q326 228 340 236 Q354 228 368 236 Q382 228 396 236 Q410 228 428 238 L428 266 Z"
        fill={c.water ? "var(--bio-vacuole)" : "var(--raised)"}
        stroke="var(--ink-3)"
        strokeWidth={1.2}
      />
      {c.water && <rect x={92} y={254} width={336} height={12} fill="var(--bio-water)" opacity={0.45} />}

      {xs.map((x, k) => (
        <Seed key={k} x={x} base={base} day={day} c={c} k={k} />
      ))}

      {/* no oxygen: an airtight bell jar */}
      {!c.oxygen && (
        <g>
          <path d="M80 272 L80 110 Q80 52 160 46 L360 46 Q440 52 440 110 L440 272" fill="var(--bio-vacuole)" fillOpacity={0.22} stroke="var(--ink-3)" strokeWidth={2.4} />
          <rect x={246} y={32} width={28} height={16} rx={5} fill="var(--ink-3)" />
          <rect x={72} y={268} width={376} height={8} rx={3} fill="var(--ink-3)" opacity={0.8} />
        </g>
      )}
    </g>
  );
}

const COND: { id: keyof Conditions; name: Text; icon: ReactNode }[] = [
  { id: "water", name: tx("Water", "Wasser"), icon: <Droplets className="size-4" /> },
  { id: "warm", name: tx("Warmth", "Wärme"), icon: <Thermometer className="size-4" /> },
  { id: "oxygen", name: tx("Oxygen (air)", "Sauerstoff (Luft)"), icon: <Wind className="size-4" /> },
  { id: "light", name: tx("Light", "Licht"), icon: <Sun className="size-4" /> },
];

const RESULT: Record<Outcome, Text> = {
  none: tx("nothing happens", "nichts passiert"),
  swell: tx("swell, no germination", "quellen, keimen nicht"),
  germ: tx("germinate", "keimen"),
  pale: tx("germinate, pale and long", "keimen, bleich und lang"),
};

function explain(c: Conditions): { text: Text; warn: boolean } {
  const missing = (["water", "warm", "oxygen", "light"] as const).filter((k) => !c[k]);
  if (missing.length > 1)
    return {
      warn: true,
      text: tx(
        "Careful: you left out several conditions at once. Now you can't tell which one was missing. A fair experiment changes only one condition compared with the control dish.",
        "Vorsicht: Du hast mehrere Bedingungen gleichzeitig weggelassen. Jetzt weißt du nicht, welche gefehlt hat. Ein fairer Versuch ändert im Vergleich zum Kontrollansatz immer nur eine Bedingung.",
      ),
    };
  switch (outcomeOf(c)) {
    case "none":
      return { warn: false, text: tx("Without water nothing happens: the dry seed stays at rest. Water makes it swell and wakes it up.", "Ohne Wasser passiert nichts: Der trockene Samen bleibt in Samenruhe. Erst Wasser lässt ihn quellen und weckt ihn auf.") };
    case "swell":
      return !c.oxygen
        ? { warn: false, text: tx("The seeds swell but don't germinate. Without oxygen the embryo can't respire, so it gets no energy from its food stores.", "Die Samen quellen, keimen aber nicht. Ohne Sauerstoff kann der Keimling nicht atmen und bekommt keine Energie aus seinen Vorräten.") }
        : { warn: false, text: tx("The seeds swell but don't germinate. At 4 °C the life processes in the seed run far too slowly.", "Die Samen quellen, keimen aber nicht. Bei 4 °C laufen die Lebensvorgänge im Samen viel zu langsam ab.") };
    case "pale":
      return {
        warn: false,
        text: tx(
          "They germinate in the dark too! Their food is stored in the cotyledons. But the seedlings grow long, thin and pale yellow: without light they make no chlorophyll. They only need light later, for photosynthesis.",
          "Sie keimen auch im Dunkeln! Ihre Nährstoffe stecken in den Keimblättern. Die Keimlinge werden aber lang, dünn und bleich (vergeilt): Ohne Licht bilden sie kein Chlorophyll. Licht brauchen sie erst danach für die Fotosynthese.",
        ),
      };
    default:
      return { warn: false, text: tx("All seeds germinate: with water, warmth and oxygen it works. This is your control dish.", "Alle Samen keimen: Mit Wasser, Wärme und Sauerstoff klappt es. Das ist dein Kontrollansatz.") };
  }
}

type Run = { c: Conditions; out: Outcome; n: number };

export function PlantGermination() {
  const t = useText();
  const reduce = useReducedMotion();
  const [c, setC] = useState<Conditions>({ water: true, warm: true, oxygen: true, light: true });
  const [day, setDay] = useState(0);
  const [runs, setRuns] = useState<Run[]>([]);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const done = day >= 7;
  const record = (cc: Conditions) =>
    setRuns((r) => [{ c: cc, out: outcomeOf(cc), n: (r[0]?.n ?? 0) + 1 }, ...r.filter((x) => JSON.stringify(x.c) !== JSON.stringify(cc))].slice(0, 5));

  const start = () => {
    ctrl.current?.stop();
    const cc = c;
    if (reduce) {
      setDay(7);
      record(cc);
      return;
    }
    setDay(0);
    ctrl.current = animate(0, 7, { duration: 4.2, ease: "linear", onUpdate: setDay, onComplete: () => record(cc) });
  };
  const toggle = (k: keyof Conditions) => {
    ctrl.current?.stop();
    setDay(0);
    setC({ ...c, [k]: !c[k] });
  };
  const info = explain(c);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {COND.map((x) => (
          <PlantChip key={x.id} on={c[x.id]} onClick={() => toggle(x.id)} icon={x.icon}>
            {t(x.name)}
          </PlantChip>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] lg:items-start">
        <div className="space-y-3">
          <svg viewBox="0 0 520 290" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Bean seeds on cotton wool in a dish", "Bohnensamen auf Watte in einer Schale"))}>
            <Scene c={c} day={day} />
          </svg>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={start} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]">
              <Play className="size-4" /> {t(day > 0 && !done ? tx("Running…", "Läuft …") : tx("Run one week", "Eine Woche ablaufen lassen"))}
            </button>
            <button
              type="button"
              onClick={() => {
                ctrl.current?.stop();
                setDay(0);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
            >
              <RotateCcw className="size-4" /> {t(tx("Reset", "Zurück"))}
            </button>
            <span className="ml-auto text-[14px] font-semibold tabular-nums text-ink-2">{t(tx(`Day ${Math.floor(day)}`, `Tag ${Math.floor(day)}`))}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Lab notebook", "Versuchsprotokoll"))}</div>
          {runs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-3 py-3 text-[13px] text-ink-3">{t(tx("Your results appear here.", "Hier erscheinen deine Ergebnisse."))}</div>
          ) : (
            <ul className="space-y-1.5">
              {runs.map((r) => (
                <motion.li key={r.n} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2">
                  <span className="flex gap-1">
                    {COND.map((x) => (
                      <span
                        key={x.id}
                        title={t(x.name)}
                        aria-label={`${t(x.name)}: ${r.c[x.id] ? t(tx("yes", "ja")) : t(tx("no", "nein"))}`}
                        className={cn("grid size-6 place-items-center rounded-md [&>svg]:size-3.5", r.c[x.id] ? "bg-blob text-white" : "bg-line text-ink-3 line-through")}
                      >
                        {x.icon}
                      </span>
                    ))}
                  </span>
                  <span className={cn("min-w-0 text-[13px] leading-tight", r.out === "germ" || r.out === "pale" ? "font-semibold text-ink" : "text-ink-2")}>{t(RESULT[r.out])}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <PlantNote id={done ? `done-${JSON.stringify(c)}` : "idle"} tone={done ? (info.warn ? "warn" : "good") : "plain"}>
        {done
          ? t(info.text)
          : t(tx("Set the conditions and run the experiment. Tip: change only one condition at a time compared with the control dish (everything on).", "Stell die Bedingungen ein und starte den Versuch. Tipp: Ändere immer nur eine Bedingung im Vergleich zum Kontrollansatz (alles an)."))}
      </PlantNote>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prepared dishes for tasks

function Icon({ kind, on, x, y, warmText }: { kind: keyof Conditions; on: boolean; x: number; y: number; warmText?: string }) {
  const col = on ? "var(--blob)" : kind === "warm" ? "var(--bio-water-deep)" : "var(--ink-3)";
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-11} y={-11} width={22} height={22} rx={6} fill={on ? "var(--blob-soft)" : "var(--raised)"} stroke={col} strokeWidth={1.4} />
      {kind === "water" && <path d="M0 -7 C4 -2 6 1 6 3.5 A6 6 0 0 1 -6 3.5 C-6 1 -4 -2 0 -7 Z" fill={on ? "var(--bio-water)" : "none"} stroke={col} strokeWidth={1.4} />}
      {kind === "warm" && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={700} fill={col} style={{ fontFamily: "var(--font-sans)" }}>
          {warmText}
        </text>
      )}
      {kind === "oxygen" && (
        <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill={col} style={{ fontFamily: "var(--font-sans)" }}>
          O₂
        </text>
      )}
      {kind === "light" &&
        (on ? (
          <g>
            <circle r={4} fill="var(--bio-sun)" stroke={col} strokeWidth={1.2} />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <line key={i} x1={Math.cos((i * Math.PI) / 4) * 6} y1={Math.sin((i * Math.PI) / 4) * 6} x2={Math.cos((i * Math.PI) / 4) * 8.5} y2={Math.sin((i * Math.PI) / 4) * 8.5} stroke={col} strokeWidth={1.2} strokeLinecap="round" />
            ))}
          </g>
        ) : (
          <path d="M-1 -7 a7 7 0 1 0 7 9 a5.5 5.5 0 1 1 -7 -9 Z" fill="var(--bio-nucleus)" stroke={col} strokeWidth={1.2} />
        ))}
      {!on && kind !== "light" && kind !== "warm" && <line x1={-8} y1={8} x2={8} y2={-8} stroke="var(--danger)" strokeWidth={1.8} strokeLinecap="round" />}
    </g>
  );
}

/** Several prepared dishes (A, B, C…) with their conditions; `results` shows the seeds after a week. */
export function PlantDishes({ dishes, results = false }: { dishes: Conditions[]; results?: boolean }) {
  const t = useText();
  const w = 128;
  const W = dishes.length * w;
  return (
    <svg viewBox={`0 0 ${W} 210`} className="mx-auto block h-auto w-full" style={{ maxWidth: Math.min(640, dishes.length * 150) }} role="img" aria-label={t(tx("Prepared dishes with seeds", "Vorbereitete Schalen mit Samen"))}>
      {dishes.map((c, i) => {
        const x0 = i * w;
        const cx = x0 + w / 2;
        return (
          <g key={i}>
            <rect x={x0 + 4} y={4} width={w - 8} height={202} rx={12} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.4} />
            <text x={cx} y={24} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {"ABCDEF"[i]}
            </text>
            <Icon kind="water" on={c.water} x={cx - 39} y={48} />
            <Icon kind="warm" on={c.warm} x={cx - 13} y={48} warmText={c.warm ? "22°" : "4°"} />
            <Icon kind="oxygen" on={c.oxygen} x={cx + 13} y={48} />
            <Icon kind="light" on={c.light} x={cx + 39} y={48} />
            <path d={`M${cx - 48} 180 L${cx - 48} 194 Q${cx - 48} 198 ${cx - 44} 198 L${cx + 44} 198 Q${cx + 48} 198 ${cx + 48} 194 L${cx + 48} 180`} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} />
            <rect x={cx - 46} y={182} width={92} height={14} rx={3} fill={c.water ? "var(--bio-vacuole)" : "var(--surface)"} stroke="var(--ink-3)" strokeWidth={0.8} />
            {[-26, 0, 26].map((dx, k) => (
              <Seed key={k} x={cx + dx} base={176} day={results ? 7 : 0} c={c} k={k + 1} scale={0.62} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
