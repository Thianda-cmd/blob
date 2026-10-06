"use client";

// Blood sugar as a control loop: a small model of glucose, insulin and glucagon after a meal or
// during sport, for a healthy person, untreated type 1 diabetes, type 1 with insulin and type 2.
// Scrub or play through 4 hours; the loop shows which hormone acts. Also exports a graph for
// practice tasks (glucose tolerance tests).

import { animate, AnimatePresence, motion, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

export type Scenario = "healthy" | "t1" | "t1ins" | "t2";
export type Event = "meal" | "sport";

type Point = { G: number; I: number; C: number };

/**
 * The model, per minute. Glucose G (mg/dl) rises with the meal and with output from the liver
 * (more with glucagon, less with insulin) and falls with uptake into cells (more with insulin),
 * extra uptake during sport and loss in the urine above the kidney threshold (180 mg/dl).
 * Insulin follows the glucose level (β cells), glucagon rises when glucose is low (α cells).
 */
function simulate(kind: Scenario, event: Event): Point[] {
  const uInd = 0.6;
  const uIns = 1.4;
  const pc = 1.5;
  const pi = 0.4;
  const sens = kind === "t2" ? 0.15 : 1;
  const secr = (G: number) => (kind === "t1" || kind === "t1ins" ? 0 : (kind === "t2" ? 1.1 : 1) * Math.max(0, (G - 80) / 50));
  const tauI = kind === "t2" ? 25 : 10;
  const glu = (G: number, I: number) => (Math.max(0, (95 - G) / 20) + 0.15) / (1 + 2 * I);
  const I0 = 0.2;
  const p0 = uInd + uIns * I0 - pc * glu(90, I0) + pi * I0;
  const cBoost = kind === "t1" ? 2.2 : 1;
  /** Injected insulin (type 1 with therapy): a long-acting basal dose plus a bolus with the meal. */
  const injected = (t: number) => {
    if (kind !== "t1ins") return 0;
    const s = t - 5;
    const bolus = event === "meal" && s > 0 ? 0.85 * (s / 45) * Math.exp(1 - s / 45) : 0;
    return 0.2 + bolus;
  };
  let G = 90;
  let I = kind === "t1" ? 0 : 0.2;
  let C = glu(90, I);
  const out: Point[] = [];
  const dt = 0.5;
  for (let step = -1200; step <= 480; step++) {
    const t = step * dt;
    if (t >= 0 && step % 2 === 0) out.push({ G, I, C });
    const s = t - 10;
    const Ra = event === "meal" && t >= 0 && s > 0 ? ((190 * s) / (22 * 22)) * Math.exp(-s / 22) : 0;
    const E = event === "sport" && t >= 0 && s > 0 && s < 60 ? (0.6 * G) / 90 : 0;
    const Ieff = sens * I;
    const up = (uInd * G) / 90 + (uIns * Ieff * G) / 90 + E;
    const prod = Math.max(0, p0 + pc * C * cBoost - pi * Ieff);
    const ren = Math.max(0, 0.02 * (G - 180));
    G += dt * (Ra + prod - up - ren);
    const target = kind === "t1ins" ? injected(Math.max(0, t)) : secr(G);
    I += kind === "t1ins" ? (dt * (target - I)) / 4 : (dt * (target - I)) / tauI;
    C += (dt * (glu(G, I) - C)) / 8;
  }
  return out;
}

const RUNS: Record<string, Point[]> = Object.fromEntries(
  (["healthy", "t1", "t1ins", "t2"] as Scenario[]).flatMap((k) => (["meal", "sport"] as Event[]).map((e) => [`${k}-${e}`, simulate(k, e)])),
);
/** The simulated course (one point per minute, 0 to 240 min). */
export const runOf = (k: Scenario, e: Event) => RUNS[`${k}-${e}`];

export const SCENARIOS: { id: Scenario; name: Text }[] = [
  { id: "healthy", name: tx("Healthy", "Gesund") },
  { id: "t1", name: tx("Type 1, untreated", "Typ 1, unbehandelt") },
  { id: "t1ins", name: tx("Type 1 with insulin", "Typ 1 mit Insulin") },
  { id: "t2", name: tx("Type 2", "Typ 2") },
];

// ---------------------------------------------------------------------------
// The graph

const W = 560;
const H = 230;
const X0 = 46;
const X1 = W - 14;
const Y0 = 16;
const Y1 = H - 30;
const GMAX = 300;
const GMIN = 50;
const xOf = (t: number) => X0 + ((X1 - X0) * t) / 240;
const yOf = (g: number) => Y1 - ((Y1 - Y0) * (Math.min(GMAX, Math.max(GMIN, g)) - GMIN)) / (GMAX - GMIN);

const pathOf = (pts: [number, number][]) => pts.map(([t, g], i) => `${i ? "L" : "M"}${xOf(t).toFixed(1)} ${yOf(g).toFixed(1)}`).join(" ");

function Axes({ threshold = true }: { threshold?: boolean }) {
  const t = useText();
  const unit = t(tx("mg/dL", "mg/dl"));
  return (
    <g style={{ fontFamily: "var(--font-sans)" }}>
      <rect x={X0} y={yOf(110)} width={X1 - X0} height={yOf(70) - yOf(110)} fill="var(--bio-leaf)" opacity={0.22} />
      <text x={X1 - 4} y={yOf(70) - 5} textAnchor="end" fontSize={10} fill="var(--ink-2)">
        {t(tx("normal range", "Normalbereich"))}
      </text>
      {threshold && (
        <>
          <line x1={X0} x2={X1} y1={yOf(180)} y2={yOf(180)} stroke="var(--bio-blood)" strokeDasharray="5 4" strokeWidth={1.2} opacity={0.8} />
          <text x={X1 - 4} y={yOf(180) - 4} textAnchor="end" fontSize={10} fill="var(--ink-2)">
            {t(tx("kidney threshold", "Nierenschwelle"))}
          </text>
        </>
      )}
      {[50, 100, 150, 200, 250, 300].map((g) => (
        <g key={g}>
          <line x1={X0} x2={X1} y1={yOf(g)} y2={yOf(g)} stroke="var(--line)" strokeWidth={1} />
          <text x={X0 - 6} y={yOf(g) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-3)">
            {g}
          </text>
        </g>
      ))}
      {[0, 60, 120, 180, 240].map((m) => (
        <text key={m} x={xOf(m)} y={Y1 + 15} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
          {m === 0 ? "0" : `${m / 60} h`}
        </text>
      ))}
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="var(--ink-3)" strokeWidth={1.2} />
      <line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--ink-3)" strokeWidth={1.2} />
      <text x={X0 + 6} y={Y0 + 10} fontSize={10} fill="var(--ink-3)">
        {unit}
      </text>
    </g>
  );
}

/** Task picture: glucose curves (e.g. a glucose tolerance test) labelled A, B, … */
export function DigestionGlucoseGraph({ curves, threshold = false }: { curves: { label: string; points: [number, number][] }[]; threshold?: boolean }) {
  const t = useText();
  const colors = ["var(--blob)", "var(--bio-blood)", "var(--bio-water-deep)"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Blood sugar over time", "Blutzucker im Zeitverlauf"))}>
      <Axes threshold={threshold} />
      {curves.map((c, i) => {
        const last = c.points[c.points.length - 1];
        return (
          <g key={c.label}>
            <path d={pathOf(c.points)} fill="none" stroke={colors[i % colors.length]} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
            {c.points.map(([tt, g]) => (
              <circle key={tt} cx={xOf(tt)} cy={yOf(g)} r={3} fill={colors[i % colors.length]} />
            ))}
            <text x={xOf(last[0]) - 4} y={yOf(last[1]) - 8} textAnchor="end" fontSize={13} fontWeight={700} fill={colors[i % colors.length]} style={{ fontFamily: "var(--font-sans)" }}>
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------

function Bar({ label, value, color }: { label: Text; value: number; color: string }) {
  const t = useText();
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[12.5px]">
        <span className="font-medium text-ink">{t(label)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-hover">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.min(100, value * 100)}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
      </div>
    </div>
  );
}

function stateText(kind: Scenario, p: Point, rising: boolean): Text {
  if (kind === "t1" && p.G > 180)
    return tx("No β cells left, so no insulin: the cells can hardly take up glucose. Above the kidney threshold (about 180 mg/dL) glucose spills into the urine.", "Keine β-Zellen mehr, also kein Insulin: Die Zellen können kaum Glucose aufnehmen. Über der Nierenschwelle (etwa 180 mg/dl) landet Glucose im Urin.");
  if (kind === "t1") return tx("Without insulin the blood sugar can't be brought down. Glucagon isn't held back either, so the liver keeps releasing glucose.", "Ohne Insulin kann der Blutzucker nicht gesenkt werden. Auch Glucagon wird nicht gebremst, die Leber gibt weiter Glucose ab.");
  if (kind === "t2" && p.G > 120)
    return tx("There is insulin, even a lot of it. But the cells respond only weakly (**insulin resistance**), so the level falls slowly.", "Insulin ist da, sogar viel. Aber die Zellen reagieren nur schwach (**Insulinresistenz**), darum sinkt der Spiegel nur langsam.");
  if (kind === "t1ins" && p.G > 110) return tx("The injected insulin takes over the job of the missing β cells. The dose has to match the meal.", "Das gespritzte Insulin übernimmt die Aufgabe der fehlenden β-Zellen. Die Dosis muss zur Mahlzeit passen.");
  if (p.G > 110 || (p.G > 100 && rising))
    return tx("Above the set point: **β cells** release **insulin**. Muscle, fat and liver cells take up glucose, the liver builds **glycogen**. The level falls again: negative feedback.", "Über dem Sollwert: Die **β-Zellen** schütten **Insulin** aus. Muskel-, Fett- und Leberzellen nehmen Glucose auf, die Leber baut **Glykogen** auf. Der Spiegel sinkt wieder: negative Rückkopplung.");
  if (p.G < 85)
    return tx("Below the set point: **α cells** release **glucagon**. The liver breaks down **glycogen** and releases glucose. The level rises again.", "Unter dem Sollwert: Die **α-Zellen** schütten **Glucagon** aus. Die Leber baut **Glykogen** ab und gibt Glucose ins Blut. Der Spiegel steigt wieder.");
  return tx("In the normal range: only a little hormone is needed. The islets of Langerhans keep measuring.", "Im Normalbereich: Es ist nur wenig Hormon nötig. Die Langerhans-Inseln messen ständig weiter.");
}

export function DigestionBloodSugar() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [kind, setKind] = useState<Scenario>("healthy");
  const [event, setEvent] = useState<Event>("meal");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const run = runOf(kind, event);
  const ti = Math.round(time);
  const p = run[ti];
  const rising = ti > 0 && run[ti].G > run[ti - 1].G;

  const player = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => () => player.current?.stop(), []);

  const play = (from: number) => {
    player.current?.stop();
    setPlaying(true);
    player.current = animate(from, 240, {
      duration: reduce ? 0.01 : ((240 - from) / 240) * 9,
      ease: "linear",
      onUpdate: (v) => setTime(v),
      onComplete: () => setPlaying(false),
    });
  };
  const pause = () => {
    player.current?.stop();
    setPlaying(false);
  };

  const choose = (k: Scenario, e: Event) => {
    setKind(k);
    setEvent(e);
    setTime(0);
    play(0);
  };

  const full = run.map((q, i) => [i, q.G] as [number, number]).filter((_, i) => i % 2 === 0);
  const gText = Math.round(p.G);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" onClick={() => choose(s.id, event)} className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors", kind === s.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}>
            {t(s.name)}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        {(["meal", "sport"] as Event[]).map((e) => (
          <button key={e} type="button" onClick={() => choose(kind, e)} className={cn("h-8 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors", event === e ? "bg-ink text-paper" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}>
            {t(e === "meal" ? tx("Meal (carbohydrates)", "Mahlzeit (Kohlenhydrate)") : tx("Sport", "Sport"))}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Blood sugar over time", "Blutzucker im Zeitverlauf"))}>
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={0} width={xOf(time)} height={H} />
            </clipPath>
          </defs>
          <Axes />
          {event === "meal" && <rect x={xOf(10)} y={Y0} width={xOf(30) - xOf(10)} height={Y1 - Y0} fill="var(--bio-sun)" opacity={0.18} />}
          {event === "sport" && <rect x={xOf(10)} y={Y0} width={xOf(70) - xOf(10)} height={Y1 - Y0} fill="var(--bio-water)" opacity={0.14} />}
          <path d={pathOf(full)} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="3 4" opacity={0.6} />
          <path d={pathOf(full)} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinejoin="round" clipPath={`url(#${clip})`} />
          <circle cx={xOf(time)} cy={yOf(p.G)} r={6} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
        </svg>
        <div className="flex items-center gap-2 px-1.5 pt-1">
          <button
            type="button"
            onClick={() => (playing ? pause() : play(time >= 240 ? 0 : time))}
            aria-label={t(playing ? tx("Pause", "Pause") : tx("Play", "Abspielen"))}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-blob text-white"
          >
            {playing ? <Pause className="size-4" /> : time >= 240 ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={240}
            step={1}
            value={ti}
            onChange={(e) => {
              pause();
              setTime(Number(e.target.value));
            }}
            aria-label={t(tx("Time", "Zeit"))}
            className="min-w-0 flex-1 accent-blob"
          />
          <span className="w-[64px] shrink-0 text-right text-[12.5px] tabular-nums text-ink-2">
            {Math.floor(ti / 60)}:{String(ti % 60).padStart(2, "0")} h
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-2.5 rounded-xl border border-line px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Blood sugar", "Blutzucker"))}</span>
            <span className={cn("font-display text-[24px] font-bold tabular-nums", p.G > 180 ? "text-danger" : "text-ink")}>
              {gText} <span className="text-[13px] font-semibold text-ink-2">{locale === "de" ? "mg/dl" : "mg/dL"}</span>
            </span>
          </div>
          <Bar label={tx("Insulin (from β cells)", "Insulin (aus β-Zellen)")} value={p.I / 1.6} color="var(--bio-water-deep)" />
          <Bar label={tx("Glucagon (from α cells)", "Glucagon (aus α-Zellen)")} value={p.C / 0.6} color="var(--bio-mito-deep)" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={t(stateText(kind, p, rising))}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl bg-blob-soft/50 px-3.5 py-3 text-[13.5px] leading-relaxed text-ink"
          >
            <Inline text={stateText(kind, p, rising)} />
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The control loop as a labelled diagram (for the lesson and tasks). */
export function DigestionControlLoop({ highlight }: { highlight?: "insulin" | "glucagon" }) {
  const t = useText();
  const box = "rounded-xl border px-3 py-2 text-center text-[13px] leading-snug";
  const on = (h: "insulin" | "glucagon") => (highlight === h ? "border-blob bg-blob-soft/60 text-ink" : "border-line bg-raised text-ink-2");
  return (
    <div className="grid gap-2 text-ink sm:grid-cols-[1fr_auto_1fr]">
      <div className={cn(box, "border-line bg-surface sm:col-span-3")}>
        <Inline text={tx("**Controlled variable:** blood glucose level (set point about 90 mg/dL) · **Disturbances:** meals, sport, fasting", "**Regelgröße:** Blutzuckerspiegel (Sollwert etwa 90 mg/dl) · **Störgrößen:** Mahlzeiten, Sport, Hunger")} />
      </div>
      <div className={cn(box, on("insulin"))}>
        <Inline text={tx("Too high → **β cells** (sensor and controller) → **insulin**", "Zu hoch → **β-Zellen** (Fühler und Regler) → **Insulin**")} />
      </div>
      <div className="hidden items-center text-ink-3 sm:flex">⇄</div>
      <div className={cn(box, on("glucagon"))}>
        <Inline text={tx("Too low → **α cells** (sensor and controller) → **glucagon**", "Zu niedrig → **α-Zellen** (Fühler und Regler) → **Glucagon**")} />
      </div>
      <div className={cn(box, on("insulin"))}>
        <Inline text={tx("**Effectors:** muscle, fat and liver cells take up glucose, glycogen is built → level falls", "**Stellglieder:** Muskel-, Fett- und Leberzellen nehmen Glucose auf, Glykogen wird aufgebaut → Spiegel sinkt")} />
      </div>
      <div className="hidden sm:block" />
      <div className={cn(box, on("glucagon"))}>
        <Inline text={tx("**Effector:** the liver breaks down glycogen and releases glucose → level rises", "**Stellglied:** Die Leber baut Glykogen ab und gibt Glucose ab → Spiegel steigt")} />
      </div>
      <div className="text-center text-[12px] text-ink-3 sm:col-span-3">{t(tx("Negative feedback: each change triggers its own correction.", "Negative Rückkopplung: Jede Abweichung löst ihre eigene Korrektur aus."))}</div>
    </div>
  );
}
