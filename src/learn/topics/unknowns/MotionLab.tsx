"use client";

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { num } from "./kit";
import { BlobSays, Stepper, Tabs } from "./ui";

// Level 2 widget: two vehicles on one road and their distance-time diagram. Towards each other
// (they meet) or one after the other (the faster one catches up). The meeting point is where the
// two lines in the diagram cross.

type Mode = "meet" | "catch";

const D = 240; // km between A and B (meeting)
const LAG = 1; // h head start (catching up)

const W = 380;
const HH = 230;
const M = { l: 44, r: 14, t: 26, b: 34 };

export function MotionLab() {
  const [mode, setMode] = useState<Mode>("meet");
  const scope = useId();
  return (
    <div className="space-y-4">
      <Tabs
        value={mode}
        options={[
          ["meet", tx("Towards each other", "Aufeinander zu")],
          ["catch", tx("Catching up", "Einholen")],
        ]}
        onChange={setMode}
        scope={scope}
      />
      <Lab key={mode} mode={mode} />
    </div>
  );
}

function Lab({ mode }: { mode: Mode }) {
  const t = useText();
  const locale = useLocale();
  const meet = mode === "meet";
  const [v1, setV1] = useState(meet ? 100 : 15);
  const [v2, setV2] = useState(meet ? 60 : 30);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const T = meet ? 4 : 6;
  const S = meet ? D : 150;
  const sStep = meet ? 40 : 30;
  const posA = (h: number) => (meet ? Math.min(D, v1 * h) : v1 * h);
  const posB = (h: number) => (meet ? Math.max(0, D - v2 * h) : Math.max(0, v2 * (h - LAG)));
  const tStar = meet ? D / (v1 + v2) : v2 > v1 ? (v2 * LAG) / (v2 - v1) : Infinity;
  const sStar = v1 * tStar;
  const onChart = tStar <= T && sStar <= S;
  const met = time >= tStar - 1e-6;
  const f = (v: number) => num(Math.round(v * 100) / 100, locale);
  const minutes = (h: number) => {
    const total = Math.round(h * 60);
    return `${Math.floor(total / 60)} h ${total % 60} min`;
  };

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const run = (to: number) => {
    const from = time >= T - 1e-6 ? 0 : time;
    if (reduce) {
      setTime(to);
      return;
    }
    setPlaying(true);
    ctrl.current = animate(from, to, { duration: (to - from) * 1.5, ease: "linear", onUpdate: setTime, onComplete: () => setPlaying(false) });
  };
  const toggle = () => {
    if (playing) return stop();
    const from = time >= T - 1e-6 ? 0 : time;
    // Stop at the meeting moment first, so nobody misses it.
    run(onChart && from < tStar - 1e-6 ? tStar : T);
  };
  const restart = () => {
    stop();
    setTime(0);
  };

  const px = (h: number) => M.l + (h / T) * (W - M.l - M.r);
  const py = (s: number) => HH - M.b - (s / S) * (HH - M.t - M.b);
  const path = (fn: (h: number) => number, from = 0) => {
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const h = from + ((T - from) * i) / 120;
      const s = fn(h);
      if (s > S + 1e-9 || s < -1e-9) break;
      d += `${d ? "L" : "M"}${px(h).toFixed(1)} ${py(s).toFixed(1)}`;
    }
    return d;
  };
  const lineA = path((h) => v1 * h);
  const lineB = meet ? path((h) => D - v2 * h) : `M${px(0)} ${py(0)}L${px(LAG)} ${py(0)}` + path((h) => v2 * (h - LAG), LAG).replace(/^M/, "L");
  const hTicks = Array.from({ length: T + 1 }, (_, i) => i);
  const sTicks = Array.from({ length: S / sStep + 1 }, (_, i) => i * sStep);

  const a = posA(time);
  const b = posB(time);
  const equation = meet ? `${v1}t = ${D} - ${v2}t` : `${v2}(t - 1) = ${v1}t`;
  const solved = meet ? `${v1 + v2}t = ${D}` : `${v2 - v1}t = ${v2}`;

  const say: { text: Text; mood: "happy" | "thinking" | "excited" } = !meet && v2 <= v1
    ? {
        text: tx("B isn't faster than A, so it never catches up. In the diagram the lines don't cross after B starts.", "B ist nicht schneller als A und holt deshalb nie auf. Im Diagramm schneiden sich die Geraden nach dem Start von B nicht."),
        mood: "thinking",
      }
    : met && onChart
      ? {
          text: meet
            ? tx(
                `They meet after ${f(tStar)} h (${minutes(tStar)}), ${f(sStar)} km from A. In the diagram that's exactly where the two lines cross!`,
                `Sie treffen sich nach ${f(tStar)} h (${minutes(tStar)}), ${f(sStar)} km von A entfernt. Im Diagramm ist das genau der Schnittpunkt der beiden Geraden!`,
              )
            : tx(
                `B catches up after ${f(tStar)} h, ${f(sStar)} km from the start. That's where the two lines cross!`,
                `B holt A nach ${f(tStar)} h ein, ${f(sStar)} km vom Start entfernt. Genau dort schneiden sich die beiden Geraden!`,
              ),
          mood: "excited",
        }
      : !onChart
        ? {
            text: tx(`They'd only meet after ${f(tStar)} h, that's off the chart. Try other speeds!`, `Sie würden sich erst nach ${f(tStar)} h treffen, das liegt außerhalb des Diagramms. Probier andere Geschwindigkeiten!`),
            mood: "thinking",
          }
        : meet
          ? {
              text: tx(`Press play. Every hour the gap shrinks by $${v1} + ${v2} = ${v1 + v2}$ km.`, `Drück auf Start. Jede Stunde schrumpft der Abstand um $${v1} + ${v2} = ${v1 + v2}$ km.`),
              mood: "happy",
            }
          : {
              text: tx(`A has a 1-hour head start. After that, B gains $${v2} - ${v1} = ${v2 - v1}$ km every hour.`, `A hat 1 Stunde Vorsprung. Danach holt B jede Stunde $${v2} - ${v1} = ${v2 - v1}$ km auf.`),
              mood: "happy",
            };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Stepper label={meet ? tx("A from town A", "A ab Ort A") : tx("A (bike)", "A (Rad)")} value={v1} min={meet ? 40 : 10} max={meet ? 120 : 30} step={meet ? 10 : 5} unit=" km/h" onChange={(v) => {
            restart();
            setV1(v);
          }} />
        <Stepper label={meet ? tx("B from town B", "B ab Ort B") : tx("B (moped, 1 h later)", "B (Moped, 1 h später)")} value={v2} min={meet ? 40 : 15} max={meet ? 120 : 45} step={meet ? 10 : 5} unit=" km/h" onChange={(v) => {
            restart();
            setV2(v);
          }} />
      </div>

      {/* the road */}
      <div className="rounded-xl border border-line bg-surface px-4 pb-3 pt-4">
        <div className="relative mx-3 h-12">
          <div className="absolute inset-x-0 top-6 h-1.5 rounded-full bg-line" />
          <div className="absolute left-0 top-9 -translate-x-1/2 text-[11.5px] font-semibold text-ink-3">{meet ? t(tx("town A", "Ort A")) : t(tx("start", "Start"))}</div>
          {meet && <div className="absolute right-0 top-9 translate-x-1/2 text-[11.5px] font-semibold text-ink-3">{t(tx("town B", "Ort B"))}</div>}
          <AnimatePresence>
            {met && onChart && (
              <motion.div
                key="flag"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-ok"
                style={{ left: `${(sStar / S) * 100}%` }}
              />
            )}
          </AnimatePresence>
          <Car label="A" tone="blob" left={(Math.min(a, S) / S) * 100} />
          <Car label="B" tone="ink" left={(Math.min(b, S) / S) * 100} faded={!meet && time < LAG} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-center">
        <svg viewBox={`0 0 ${W} ${HH}`} className="block h-auto w-full rounded-xl border border-line bg-surface" role="img" aria-label={t(tx("Distance-time diagram of A and B", "Weg-Zeit-Diagramm von A und B"))}>
          {sTicks.map((s) => (
            <g key={`s${s}`}>
              <line x1={M.l} x2={W - M.r} y1={py(s)} y2={py(s)} stroke="var(--line)" strokeWidth={0.8} />
              <text x={M.l - 6} y={py(s) + 4.5} textAnchor="end" fontSize={13} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {s}
              </text>
            </g>
          ))}
          {hTicks.map((h) => (
            <g key={`h${h}`}>
              <line x1={px(h)} x2={px(h)} y1={M.t} y2={HH - M.b} stroke="var(--line)" strokeWidth={0.8} />
              <text x={px(h)} y={HH - M.b + 16} textAnchor="middle" fontSize={13} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {h}
              </text>
            </g>
          ))}
          <text x={W - M.r} y={HH - 3} textAnchor="end" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            t in h
          </text>
          <text x={6} y={15} fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            s in km
          </text>
          <path d={lineA} fill="none" stroke="var(--blob)" strokeWidth={2.6} strokeLinecap="round" />
          <path d={lineB} fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <line x1={px(time)} x2={px(time)} y1={M.t} y2={HH - M.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
          {a <= S && <circle cx={px(time)} cy={py(a)} r={5} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />}
          {b <= S && <circle cx={px(time)} cy={py(b)} r={5} fill="var(--ink)" stroke="var(--raised)" strokeWidth={2} />}
          <AnimatePresence>
            {met && onChart && (
              <motion.g key="cross" initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ transformOrigin: `${px(tStar)}px ${py(sStar)}px` }}>
                <circle cx={px(tStar)} cy={py(sStar)} r={9} fill="none" stroke="var(--ok)" strokeWidth={2.5} />
                <text
                  x={px(tStar) + (px(tStar) > W * 0.65 ? -12 : 12)}
                  y={py(sStar) + (meet ? -10 : 18)}
                  textAnchor={px(tStar) > W * 0.65 ? "end" : "start"}
                  fontSize={13.5}
                  fontWeight={700}
                  fill="var(--ink)"
                  stroke="var(--surface)"
                  strokeWidth={3.5}
                  paintOrder="stroke"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  ({f(tStar)} | {f(sStar)})
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>

        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Equation", "Gleichung"))}</div>
            <div className="mt-1.5 space-y-1">
              <MathView src={equation} size="md" animate={false} />
              <AnimatePresence>
                {met && onChart && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <MathView src={`${solved} \\quad \\Rightarrow \\quad t = ${f(tStar)}`} size="md" animate={false} className="text-blob-ink" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Readout label={tx("time", "Zeit")} value={`${f(time)} h`} />
            <Readout label={tx("A at", "A bei")} value={`${f(Math.min(a, S))} km`} tone="blob" />
            <Readout label={tx("B at", "B bei")} value={`${f(Math.min(b, S))} km`} />
          </div>
          <div className="text-[13px] text-ink-2">
            {t(tx("Gap between A and B:", "Abstand zwischen A und B:"))} <span className="font-semibold tabular-nums text-ink">{f(Math.abs(a - b))} km</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : time > 0 && time < T - 1e-6 ? t(tx("Keep going", "Weiterfahren")) : t(tx("Start", "Start"))}
        </button>
        <button
          type="button"
          onClick={restart}
          className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-4" /> {t(tx("Start again", "Von vorn"))}
        </button>
        <input
          type="range"
          min={0}
          max={T}
          step={0.05}
          value={time}
          onChange={(e) => {
            stop();
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Time", "Zeit"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>

      <BlobSays text={say.text} mood={say.mood} />
    </div>
  );
}

function Car({ label, tone, left, faded }: { label: string; tone: "blob" | "ink"; left: number; faded?: boolean }) {
  return (
    <div
      className={cn(
        "absolute top-1.5 grid size-9 -translate-x-1/2 place-items-center rounded-full text-[14px] font-bold shadow-card transition-opacity",
        tone === "blob" ? "bg-blob text-white" : "bg-ink text-paper",
        faded && "opacity-45",
      )}
      style={{ left: `${left}%`, zIndex: tone === "blob" ? 2 : 1 }}
    >
      {label}
    </div>
  );
}

function Readout({ label, value, tone }: { label: Text; value: string; tone?: "blob" }) {
  const t = useText();
  return (
    <div className="rounded-xl border border-line bg-surface px-2 py-2">
      <div className="text-[11.5px] text-ink-3">{t(label)}</div>
      <div className={cn("font-math text-[17px] tabular-nums", tone === "blob" ? "text-blob-ink" : "text-ink")}>{value}</div>
    </div>
  );
}
