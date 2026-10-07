"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { gcd } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { num } from "./kit";
import { BlobSays, Stepper } from "./ui";

// Level 3 widget: two pumps fill one pool. Per hour pump A fills 1/a of it, pump B 1/b, together
// 1/a + 1/b = 1/t. The pool shows how much water came from which pump.

const POOL_W = 300;
const POOL_H = 150;

/** p/q reduced, as display source. */
function frac(p: number, q: number) {
  const g = gcd(p, q);
  return q / g === 1 ? `${p / g}` : `\\frac{${p / g}}{${q / g}}`;
}

export function PumpLab() {
  const t = useText();
  const locale = useLocale();
  const [a, setA] = useState(6);
  const [b, setB] = useState(3);
  const [onA, setOnA] = useState(true);
  const [onB, setOnB] = useState(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const rA = onA ? 1 / a : 0;
  const rB = onB ? 1 / b : 0;
  const rate = rA + rB;
  const full = rate > 0 ? 1 / rate : Infinity;
  const tt = Math.min(time, full);
  const partA = rA * tt;
  const partB = rB * tt;
  const done = rate > 0 && time >= full - 1e-6;
  const f = (v: number) => num(Math.round(v * 100) / 100, locale);
  const hm = (h: number) => {
    const m = Math.round(h * 60);
    return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
  };

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const reset = (fn?: () => void) => {
    stop();
    setTime(0);
    fn?.();
  };
  const toggle = () => {
    if (playing) return stop();
    if (!(rate > 0)) return;
    const from = done ? 0 : time;
    if (reduce) {
      setTime(full);
      return;
    }
    setPlaying(true);
    ctrl.current = animate(from, full, { duration: Math.max(1.2, (full - from) * 0.8), ease: "linear", onUpdate: setTime, onComplete: () => setPlaying(false) });
  };

  // Together: 1/a + 1/b = (a + b)/(ab). The sum and t only show once the pool is full: Blob asks for a guess first.
  const equation = onA && onB ? `\\frac{1}{${a}} + \\frac{1}{${b}} = ${done ? `${frac(a + b, a * b)} = ` : ""}\\frac{1}{t}` : onA ? `\\frac{1}{${a}} = \\frac{1}{t}` : onB ? `\\frac{1}{${b}} = \\frac{1}{t}` : "";
  const avg = (a + b) / 2;

  const say: { text: Text; mood: "happy" | "thinking" | "excited" } = !onA && !onB
    ? { text: tx("Switch on at least one pump!", "Schalte mindestens eine Pumpe ein!"), mood: "thinking" }
    : done
      ? onA && onB
        ? {
            text: tx(
              `Full after ${hm(full)}! Faster than the faster pump alone (${Math.min(a, b)} h), and nowhere near the average of ${f(avg)} h.`,
              `Voll nach ${hm(full)}! Schneller als die schnellere Pumpe allein (${Math.min(a, b)} h) und weit weg vom Durchschnitt ${f(avg)} h.`,
            ),
            mood: "excited",
          }
        : { text: tx(`One pump alone: full after ${hm(full)}. Now switch on both!`, `Eine Pumpe allein: voll nach ${hm(full)}. Schalte jetzt beide ein!`), mood: "happy" }
      : time > 0
        ? { text: tx(`After ${f(time)} h the pool is ${Math.round((partA + partB) * 100)} % full.`, `Nach ${f(time)} h ist das Becken zu ${Math.round((partA + partB) * 100)} % voll.`), mood: "happy" }
        : { text: tx("Guess first: how long do both pumps need together? Then press play.", "Schätz zuerst: Wie lange brauchen beide Pumpen zusammen? Dann drück auf Start."), mood: "happy" };

  const hA = partA * POOL_H;
  const hB = partB * POOL_H;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <PumpSwitch on={onA} tone="blob" label={tx("Pump A", "Pumpe A")} onChange={(v) => reset(() => setOnA(v))} />
        <Stepper label={tx("alone:", "allein:")} value={a} min={2} max={12} unit=" h" onChange={(v) => reset(() => setA(v))} />
        <PumpSwitch on={onB} tone="ok" label={tx("Pump B", "Pumpe B")} onChange={(v) => reset(() => setOnB(v))} />
        <Stepper label={tx("alone:", "allein:")} value={b} min={2} max={12} unit=" h" onChange={(v) => reset(() => setB(v))} />
      </div>

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${POOL_W + 40} ${POOL_H + 50}`} className="block h-auto w-full rounded-xl border border-line bg-surface" role="img" aria-label={t(tx("A pool filled by two pumps", "Ein Becken, das von zwei Pumpen gefüllt wird"))}>
          {/* pipes */}
          <rect x={30} y={8} width={14} height={22} rx={3} fill={onA ? "var(--blob)" : "var(--line)"} />
          <rect x={POOL_W - 4} y={8} width={14} height={22} rx={3} fill={onB ? "var(--ok)" : "var(--line)"} />
          <text x={24} y={24} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            A
          </text>
          <text x={POOL_W + 16} y={24} textAnchor="start" fontSize={12} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            B
          </text>
          {playing && onA && <motion.rect x={34} y={30} width={6} height={POOL_H + 10 - hA - hB} fill="var(--blob)" opacity={0.6} animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 0.6, repeat: Infinity }} />}
          {playing && onB && <motion.rect x={POOL_W} y={30} width={6} height={POOL_H + 10 - hA - hB} fill="var(--ok)" opacity={0.6} animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 0.6, repeat: Infinity }} />}
          {/* the pool */}
          <g transform={`translate(20 ${40})`}>
            <rect x={0} y={0} width={POOL_W} height={POOL_H} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.5} />
            <rect x={1} y={POOL_H - hA} width={POOL_W - 2} height={hA} fill="color-mix(in oklab, var(--blob) 55%, transparent)" />
            <rect x={1} y={POOL_H - hA - hB} width={POOL_W - 2} height={hB} fill="color-mix(in oklab, var(--ok) 50%, transparent)" />
            {[0.25, 0.5, 0.75].map((m) => (
              <g key={m}>
                <line x1={POOL_W - 14} x2={POOL_W} y1={POOL_H * (1 - m)} y2={POOL_H * (1 - m)} stroke="var(--ink-3)" />
                <text x={POOL_W - 18} y={POOL_H * (1 - m) + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {`${m * 100} %`}
                </text>
              </g>
            ))}
          </g>
        </svg>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Rate tone="blob" label={tx("A per hour", "A pro Stunde")} src={onA ? `\\frac{1}{${a}}` : "0"} />
            <Rate tone="ok" label={tx("B per hour", "B pro Stunde")} src={onB ? `\\frac{1}{${b}}` : "0"} />
          </div>
          {equation && (
            <div className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Together per hour", "Zusammen pro Stunde"))}</div>
              <MathView src={equation} size="md" animate={false} className="mt-1" />
              <div className="mt-1.5 text-[14px] text-ink-2">
                {t(tx("Full after", "Voll nach"))} <span className="font-semibold tabular-nums text-ink">t = {done ? `${f(full)} h` : "?"}</span>
                {!done || Number.isInteger(full) ? "" : ` (${hm(full)})`}
              </div>
            </div>
          )}
          <div className="text-[13px] text-ink-2">
            {t(tx("Time", "Zeit"))}: <span className="font-semibold tabular-nums text-ink">{f(tt)} h</span>
            {" · "}
            {t(tx("full", "voll"))}: <span className="font-semibold tabular-nums text-ink">{Math.round((partA + partB) * 100)} %</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} disabled={!(rate > 0)} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-40">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : time > 0 && !done ? t(tx("Keep filling", "Weiter füllen")) : t(tx("Start", "Start"))}
        </button>
        <button type="button" onClick={() => reset()} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <RotateCcw className="size-4" /> {t(tx("Empty the pool", "Becken leeren"))}
        </button>
      </div>

      <BlobSays text={say.text} mood={say.mood} />
    </div>
  );
}

function PumpSwitch({ on, tone, label, onChange }: { on: boolean; tone: "blob" | "ok"; label: Text; onChange: (v: boolean) => void }) {
  const t = useText();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("flex h-9 items-center gap-2 rounded-lg border px-3 text-[13.5px] font-semibold transition-colors", on ? "border-line-2 text-ink" : "border-line text-ink-3")}
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", on ? (tone === "blob" ? "bg-blob" : "bg-ok") : "bg-line-2")}>
        <motion.span className="absolute top-0.5 size-4 rounded-full bg-white shadow" animate={{ left: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 32 }} />
      </span>
      {t(label)}
    </button>
  );
}

function Rate({ tone, label, src }: { tone: "blob" | "ok"; label: Text; src: string }) {
  const t = useText();
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <span className={cn("size-2 rounded-full", tone === "blob" ? "bg-blob" : "bg-ok")} />
        {t(label)}
      </div>
      <MathView src={src} size="md" animate={false} />
    </div>
  );
}
