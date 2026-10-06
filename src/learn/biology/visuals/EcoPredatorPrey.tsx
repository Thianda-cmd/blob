"use client";

// Predator and prey: the Lotka-Volterra model, solved deterministically (Runge-Kutta). Used for
// the lynx and snowshoe hare graph (level 2), the Lotka-Volterra lab with decimation and
// mean values (level 3) and as task pictures.

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Axes, Tag, path, scales, type Box } from "./EcoChart";

// prey growth, predation, predator death, conversion: equilibrium prey c/d = 40, predators a/b = 20
const A = 0.8;
const B = 0.04;
const C = 0.6;
const D = 0.015;
export const PREY_MEAN = C / D;
export const PRED_MEAN = A / B;
const DT = 0.02;

export type LVPoint = { t: number; prey: number; pred: number };

/** Solve the Lotka-Volterra equations from t = 0 to T. `cuts`: at time t both populations are multiplied by `keep`. */
export function simulateLV(prey0: number, pred0: number, T: number, cuts: { t: number; keep: number }[] = []): LVPoint[] {
  const f = (h: number, p: number) => [A * h - B * h * p, D * h * p - C * p];
  let h = prey0;
  let p = pred0;
  const out: LVPoint[] = [];
  const steps = Math.round(T / DT);
  const pending = [...cuts].sort((x, y) => x.t - y.t);
  for (let i = 0; i <= steps; i++) {
    const t = i * DT;
    while (pending.length && pending[0].t <= t + 1e-9) {
      const c = pending.shift()!;
      out.push({ t, prey: h, pred: p });
      h *= c.keep;
      p *= c.keep;
    }
    out.push({ t, prey: h, pred: p });
    const k1 = f(h, p);
    const k2 = f(h + (DT / 2) * k1[0], p + (DT / 2) * k1[1]);
    const k3 = f(h + (DT / 2) * k2[0], p + (DT / 2) * k2[1]);
    const k4 = f(h + DT * k3[0], p + DT * k3[1]);
    h += (DT / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    p += (DT / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return out;
}

/** Times of the maxima of a series. */
export function peaks(pts: LVPoint[], key: "prey" | "pred") {
  const out: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) if (pts[i][key] > pts[i - 1][key] && pts[i][key] >= pts[i + 1][key]) out.push(pts[i].t);
  return out;
}

export const PREY_COLOR = "var(--bio-water-deep)";
export const PRED_COLOR = "var(--bio-blood)";

const BOX: Box = { W: 460, H: 250, l: 36, r: 14, t: 26, b: 38 };

type ChartProps = {
  pts: LVPoint[];
  T: number;
  yMax?: number;
  /** Draw only up to this time (the rest faint). */
  upTo?: number;
  /** Names on the curves (e.g. "A"/"B" in tasks). Default: none, use the legend. */
  labels?: { prey: string; pred: string };
  /** Colour of the curves; tasks use one neutral and one accent colour so colour gives nothing away. */
  colors?: { prey: string; pred: string };
  means?: boolean;
  cutAt?: number[];
  xName: Text;
  yName: Text;
};

export function LVChart({ pts, T, yMax = 100, upTo, labels, colors = { prey: PREY_COLOR, pred: PRED_COLOR }, means, cutAt, xName, yName }: ChartProps) {
  const t = useText();
  const { px, py } = scales(BOX, [0, T], [0, yMax]);
  const xTicks = Array.from({ length: Math.floor(T / 5) + 1 }, (_, i) => i * 5);
  const yTicks = Array.from({ length: Math.floor(yMax / 20) + 1 }, (_, i) => i * 20);
  const shown = upTo === undefined ? pts : pts.filter((p) => p.t <= upTo + 1e-9);
  const line = (list: LVPoint[], k: "prey" | "pred") => path(list.map((p) => [px(p.t), py(Math.min(p[k], yMax))]));
  const last = shown[shown.length - 1];
  const labelAt = (k: "prey" | "pred") => {
    // put the curve name at its first maximum
    const pk = peaks(pts, k)[0] ?? 0;
    const p = pts.find((x) => x.t >= pk) ?? pts[0];
    return { x: px(p.t), y: py(Math.min(p[k], yMax)) - 9 };
  };
  return (
    <svg viewBox={`0 0 ${BOX.W} ${BOX.H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("Population sizes of predator and prey over time", "Populationsgrößen von Räuber und Beute im Lauf der Zeit"))}>
      <Axes box={BOX} x={[0, T]} y={[0, yMax]} xTicks={xTicks} yTicks={yTicks} xLabel={t(xName)} yLabel={t(yName)} />
      {means && (
        <g>
          <line x1={BOX.l} x2={BOX.W - BOX.r} y1={py(PREY_MEAN)} y2={py(PREY_MEAN)} stroke={colors.prey} strokeWidth={1.5} strokeDasharray="6 5" />
          <line x1={BOX.l} x2={BOX.W - BOX.r} y1={py(PRED_MEAN)} y2={py(PRED_MEAN)} stroke={colors.pred} strokeWidth={1.5} strokeDasharray="6 5" />
        </g>
      )}
      {cutAt?.map((c) => (
        <g key={c}>
          <line x1={px(c)} x2={px(c)} y1={BOX.t} y2={BOX.H - BOX.b} stroke="var(--ink-2)" strokeWidth={1.4} strokeDasharray="3 4" />
        </g>
      ))}
      {upTo !== undefined && (
        <g opacity={0.22}>
          <path d={line(pts, "prey")} fill="none" stroke={colors.prey} strokeWidth={2} />
          <path d={line(pts, "pred")} fill="none" stroke={colors.pred} strokeWidth={2} />
        </g>
      )}
      <path d={line(shown, "prey")} fill="none" stroke={colors.prey} strokeWidth={3} strokeLinejoin="round" />
      <path d={line(shown, "pred")} fill="none" stroke={colors.pred} strokeWidth={3} strokeLinejoin="round" />
      {upTo !== undefined && last && (
        <g>
          <line x1={px(last.t)} x2={px(last.t)} y1={BOX.t} y2={BOX.H - BOX.b} stroke="var(--ink-3)" strokeWidth={1} />
          <circle cx={px(last.t)} cy={py(Math.min(last.prey, yMax))} r={5.5} fill="var(--raised)" stroke={colors.prey} strokeWidth={3} />
          <circle cx={px(last.t)} cy={py(Math.min(last.pred, yMax))} r={5.5} fill="var(--raised)" stroke={colors.pred} strokeWidth={3} />
        </g>
      )}
      {labels && (
        <g>
          <Tag {...labelAt("prey")} size={13} weight={700} color={colors.prey}>
            {labels.prey}
          </Tag>
          <Tag {...labelAt("pred")} size={13} weight={700} color={colors.pred}>
            {labels.pred}
          </Tag>
        </g>
      )}
    </svg>
  );
}

function Legend({ prey, pred }: { prey: Text; pred: Text }) {
  const t = useText();
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-[3px] w-6 rounded-full" style={{ background: PREY_COLOR }} />
        {t(prey)}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-[3px] w-6 rounded-full" style={{ background: PRED_COLOR }} />
        {t(pred)}
      </span>
    </div>
  );
}

/** A predator-prey graph for tasks. Curves named by letters; `predFirst` puts the predator's letter first. */
export function EcoPredatorPreyPicture({
  prey0 = 60,
  pred0 = 12,
  T = 30,
  letters,
  predLetter = "B",
  cutAt,
  keep = 0.3,
  legend,
}: {
  prey0?: number;
  pred0?: number;
  T?: number;
  /** Show letters A/B on the curves instead of a legend. */
  letters?: boolean;
  /** Which letter the predator gets. */
  predLetter?: "A" | "B";
  cutAt?: number;
  keep?: number;
  legend?: boolean;
}) {
  const pts = simulateLV(prey0, pred0, T, cutAt !== undefined ? [{ t: cutAt, keep }] : []);
  const neutral = { prey: "var(--ink-2)", pred: "var(--blob)" };
  // with letters the colours must not tell which curve is which: A is always neutral, B always purple
  const colors = letters ? (predLetter === "A" ? { prey: neutral.pred, pred: neutral.prey } : neutral) : undefined;
  return (
    <div className="space-y-1">
      <LVChart
        pts={pts}
        T={T}
        labels={letters ? { prey: predLetter === "A" ? "B" : "A", pred: predLetter } : undefined}
        colors={colors}
        cutAt={cutAt !== undefined ? [cutAt] : undefined}
        xName={tx("time in years", "Zeit in Jahren")}
        yName={tx("number of animals", "Anzahl der Tiere")}
      />
      {legend && <Legend prey={tx("prey", "Beute")} pred={tx("predator", "Räuber")} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lynx and snowshoe hare (level 2)

const LYNX_T = 40;
const LYNX = simulateLV(60, 12, LYNX_T);

export function EcoLynxHare() {
  const t = useText();
  const [time, setTime] = useState(LYNX_T);
  const i = Math.min(LYNX.length - 2, Math.max(1, Math.round(time / DT)));
  const p = LYNX[i];
  const dH = LYNX[i + 1].prey - LYNX[i - 1].prey;
  const dL = LYNX[i + 1].pred - LYNX[i - 1].pred;
  const phase = dH >= 0 && dL < 0 ? 0 : dH >= 0 ? 1 : dL >= 0 ? 2 : 3;
  const PHASES: Text[] = [
    tx("Few lynx: the hares are hardly hunted and multiply quickly.", "Wenige Luchse: Die Hasen werden kaum gejagt und vermehren sich stark."),
    tx("Lots of hares: the lynx find plenty of food and raise more young. Their numbers rise, but later than the hares'.", "Viele Hasen: Die Luchse finden reichlich Beute und ziehen mehr Junge groß. Ihre Zahl steigt, aber später als die der Hasen."),
    tx("Lots of lynx eat lots of hares: the hares decrease.", "Viele Luchse fressen viele Hasen: Die Hasen nehmen ab."),
    tx("Few hares: the lynx don't find enough food and decrease too. Then the cycle starts again.", "Wenige Hasen: Die Luchse finden zu wenig Beute und nehmen ebenfalls ab. Dann beginnt alles von vorn."),
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <LVChart pts={LYNX} T={LYNX_T} upTo={time < LYNX_T ? time : undefined} xName={tx("years", "Jahre")} yName={tx("animals (thousands)", "Tiere (in Tausend)")} />
        <Legend prey={tx("snowshoe hare (prey)", "Schneeschuhhase (Beute)")} pred={tx("Canada lynx (predator)", "Kanadischer Luchs (Räuber)")} />
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-[13px] tabular-nums text-ink-3">
          {t(tx("year", "Jahr"))} {Math.round(time)}
        </span>
        <input
          type="range"
          min={0.5}
          max={LYNX_T}
          step={0.1}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
          aria-label={t(tx("Time", "Zeit"))}
          className="h-10 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={time >= LYNX_T ? "all" : phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          aria-live="polite"
          className="flex gap-3 rounded-xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink-2"
        >
          {time >= LYNX_T ? (
            <span>
              {t(
                tx(
                  "Drag the slider back to the start and move through time. Watch which curve rises first.",
                  "Zieh den Regler zurück an den Anfang und geh durch die Zeit. Achte darauf, welche Kurve zuerst steigt.",
                ),
              )}
            </span>
          ) : (
            <>
              <span className="flex shrink-0 flex-col gap-0.5 font-math text-[14px] leading-tight">
                <span style={{ color: PREY_COLOR }}>
                  {dH >= 0 ? "↑" : "↓"} {Math.round(p.prey)}
                </span>
                <span style={{ color: PRED_COLOR }}>
                  {dL >= 0 ? "↑" : "↓"} {Math.round(p.pred)}
                </span>
              </span>
              <span>{t(PHASES[phase])}</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <p className="text-[12px] text-ink-3">
        {t(tx("Schematic, after the fur trade records of the Hudson's Bay Company in Canada (about 1845 to 1935). Today we know: the hares' food plants matter too.", "Schematisch, nach den Fellhandelsdaten der Hudson's Bay Company in Kanada (etwa 1845 bis 1935). Heute weiß man: Auch die Futterpflanzen der Hasen spielen eine Rolle."))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lotka-Volterra lab (level 3)

const LV_T = 40;

export function EcoLotkaVolterra() {
  const t = useText();
  const reduce = useReducedMotion();
  const [prey0, setPrey0] = useState(60);
  const [pred0, setPred0] = useState(12);
  const [cuts, setCuts] = useState<number[]>([]);
  const [time, setTime] = useState(LV_T);
  const [playing, setPlaying] = useState(false);
  const [means, setMeans] = useState(false);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const pts = simulateLV(prey0, pred0, LV_T, cuts.map((c) => ({ t: c, keep: 0.3 })));
  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const play = () => {
    if (playing) return stop();
    const from = time >= LV_T - 0.01 ? 0 : time;
    if (reduce) return setTime(LV_T);
    setPlaying(true);
    ctrl.current = animate(from, LV_T, { duration: (LV_T - from) / 4, ease: "linear", onUpdate: setTime, onComplete: () => setPlaying(false) });
  };
  const cut = () => {
    const at = time >= LV_T - 0.01 ? 12 : Math.max(0.5, Math.round(time * 10) / 10);
    stop();
    setCuts([...cuts.filter((c) => Math.abs(c - at) > 0.5), at].sort((a, b) => a - b));
    setTime(Math.min(LV_T, at + 12));
  };
  const reset = () => {
    stop();
    setCuts([]);
    setTime(LV_T);
  };

  const rule: Text = cuts.length
    ? tx(
        "Rule 3: both were reduced by the same proportion (to 30 %). The prey recovers first: with few predators left it can multiply almost freely, while the predators first have to wait for more prey.",
        "3. Regel: Beide wurden gleich stark dezimiert (auf 30 %). Die Beute erholt sich zuerst: Bei so wenigen Räubern kann sie sich fast ungehindert vermehren, die Räuber müssen erst auf mehr Beute warten.",
      )
    : means
      ? tx(
          "Rule 2: the mean values (dashed) stay the same over a long time, whatever the starting values. Change the sliders and check!",
          "2. Regel: Die Mittelwerte (gestrichelt) bleiben über lange Zeit gleich, egal mit welchen Startwerten. Verändere die Regler und prüf es nach!",
        )
      : tx(
          "Rule 1: both populations oscillate periodically. The predator maxima follow the prey maxima with a time lag.",
          "1. Regel: Beide Populationen schwanken periodisch. Die Maxima der Räuber folgen phasenverzögert auf die Maxima der Beute.",
        );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-2">
        <LVChart pts={pts} T={LV_T} upTo={time < LV_T - 0.01 ? time : undefined} means={means} cutAt={cuts} xName={tx("time in years", "Zeit in Jahren")} yName={tx("number of animals", "Anzahl der Tiere")} />
        <Legend prey={tx("prey", "Beute")} pred={tx("predator", "Räuber")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={play} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : t(tx("Play", "Abspielen"))}
        </button>
        <button type="button" onClick={cut} className="flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-[13.5px] font-medium text-ink hover:bg-hover">
          <Scissors className="size-4" /> {t(tx("Reduce both to 30 %", "Beide auf 30 % dezimieren"))}
        </button>
        <label className="flex cursor-pointer items-center gap-2 px-1 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={means} onChange={(e) => setMeans(e.target.checked)} className="size-4 accent-[var(--blob)]" />
          {t(tx("Mean values", "Mittelwerte"))}
        </label>
        <button type="button" onClick={reset} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-4" /> {t(tx("Reset", "Zurücksetzen"))}
        </button>
      </div>

      <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
        {(
          [
            ["prey", prey0, setPrey0, 20, 90, tx("Prey at the start", "Beute am Anfang"), PREY_COLOR],
            ["pred", pred0, setPred0, 5, 40, tx("Predators at the start", "Räuber am Anfang"), PRED_COLOR],
          ] as const
        ).map(([k, v, set, lo, hi, label, color]) => (
          <label key={k} className="flex items-center gap-3 text-[13px] text-ink-2">
            <span className="w-36 shrink-0">
              {t(label)} <span className="font-math tabular-nums" style={{ color }}>{v}</span>
            </span>
            <input
              type="range"
              min={lo}
              max={hi}
              value={v}
              onChange={(e) => {
                stop();
                set(Number(e.target.value));
                setCuts([]);
                setTime(LV_T);
              }}
              className="h-9 min-w-0 flex-1 cursor-pointer accent-[var(--blob)]"
            />
          </label>
        ))}
      </div>

      <motion.p key={`${cuts.length > 0}-${means}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} aria-live="polite" className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", cuts.length ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}>
        {t(rule)}
      </motion.p>
      <p className="text-[12px] text-ink-3">{t(tx("A model: one predator, one prey, nothing else. Real populations depend on many more factors.", "Ein Modell: ein Räuber, eine Beute, sonst nichts. Echte Populationen hängen von vielen weiteren Faktoren ab."))}</p>
    </div>
  );
}
