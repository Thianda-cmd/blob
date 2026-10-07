"use client";

// Level 1 widgets: a dice lab (law of large numbers, with a drawing pin whose probability is
// unknown) and a spinner you colour in yourself and then spin.

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { gcd } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { BALL, DieFace, SpinnerPointer, SpinnerWheel, useNum, type Ball } from "./pictures";

// ---------------------------------------------------------------------------
// Small shared controls

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const scope = useId();
  return (
    <div className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-line p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === o.id && <motion.span layoutId={`${scope}-seg`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const t = useText();
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[13px] text-ink-2">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        aria-label={t(tx(`Fewer: ${label}`, `Weniger: ${label}`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-6 text-center font-math text-[19px] tabular-nums" aria-live="polite">
        {value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40"
        aria-label={t(tx(`More: ${label}`, `Mehr: ${label}`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Random numbers for the simulations: only ever called from click handlers, never while rendering. */
const randomBelow = (n: number) => Math.floor(Math.random() * n);
const randomUnit = () => Math.random();

const btn = "flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40";

// ---------------------------------------------------------------------------
// Dice lab

type Mode = "die" | "pin";
const PIN_HEAD = 0.62; // the lab's drawing pin lands point up this often (unknown to the student)
const MAX = 10000;

type Run = { counts: number[]; hist: number[]; last: number | null; flips: number };
const fresh = (mode: Mode): Run => ({ counts: mode === "die" ? [0, 0, 0, 0, 0, 0] : [0, 0], hist: [], last: null, flips: 0 });

/** A drawing pin, point up (head) or lying on its side. */
function Pin({ x, y, side, s = 1 }: { x: number; y: number; side: boolean; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${side ? 62 : 0})`}>
      <ellipse cx={0} cy={8} rx={13} ry={4} fill="var(--blob)" />
      <rect x={-5} y={-1} width={10} height={9} rx={2} fill="var(--blob)" />
      <line x1={0} y1={-1} x2={0} y2={-22} stroke="var(--ink-2)" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

export function ProbabilityDiceLab() {
  const t = useText();
  const num = useNum();
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("die");
  const [run, setRun] = useState<Run>(fresh("die"));
  const n = run.hist.length;
  const watch = mode === "die" ? 5 : 0;
  const labels: Text[] = mode === "die" ? ["1", "2", "3", "4", "5", "6"] : [tx("point up", "Kopflage"), tx("on its side", "Seitenlage")];

  function throwMany(times: number) {
    const k = Math.min(times, MAX - n);
    if (k <= 0) return;
    const counts = [...run.counts];
    const hist = run.hist.slice();
    let last = 0;
    for (let i = 0; i < k; i++) {
      last = mode === "die" ? randomBelow(6) : randomUnit() < PIN_HEAD ? 0 : 1;
      counts[last]++;
      hist.push(counts[watch] / (hist.length + 1));
    }
    setRun({ counts, hist, last, flips: run.flips + 1 });
  }

  function switchMode(m: Mode) {
    setMode(m);
    setRun(fresh(m));
  }

  // Bars: relative frequency of each outcome, 0 … 50 % (die) or 0 … 100 % (pin).
  const W = 360;
  const top = 22;
  const plotH = 168;
  const right = 40;
  const yMax = mode === "die" ? 0.5 : 1;
  const barY = (h: number) => top + plotH - (Math.min(h, yMax) / yMax) * plotH;
  const slots = run.counts.length;
  const slotW = (W - 40 - right) / slots;
  const target = mode === "die" ? 1 / 6 : null;

  // Line: relative frequency of the watched outcome after each throw, on a log scale (1 … 10 000).
  const LW = 360;
  const LH = 190;
  const lx = (i: number) => 34 + (Math.log10(i) / 4) * (LW - 64);
  const lyMax = mode === "die" ? 0.5 : 1;
  const ly = (h: number) => 12 + (1 - Math.min(h, lyMax) / lyMax) * (LH - 40);
  const pts: string[] = [];
  if (n > 0) {
    let prev = 0;
    for (let j = 0; j <= 180; j++) {
      const idx = Math.max(1, Math.min(n, Math.round(10 ** ((j / 180) * Math.log10(n)))));
      if (idx === prev) continue;
      prev = idx;
      pts.push(`${lx(idx).toFixed(1)},${ly(run.hist[idx - 1]).toFixed(1)}`);
    }
  }
  const watchName = mode === "die" ? t(tx("six", "Sechs")) : t(tx("point up", "Kopflage"));
  const h = n ? run.counts[watch] / n : 0;
  const pct = (v: number) => `${num(v * 100, 1)}${locale === "de" ? " %" : "%"}`;

  const caption =
    n === 0
      ? mode === "die"
        ? tx("Roll the die. Watch the bars as the number of rolls grows.", "Würfle los! Beobachte die Balken, während die Zahl der Würfe wächst.")
        : tx("Throw the drawing pin. How likely is it to land point up? Nobody can count that in advance.", "Wirf die Reißzwecke. Wie wahrscheinlich ist die Kopflage? Das kann man vorher nicht abzählen.")
      : n < 60
        ? tx("Few throws: the relative frequencies still jump around a lot.", "Wenige Würfe: Die relativen Häufigkeiten springen noch stark hin und her.")
        : mode === "die"
          ? tx("Many rolls: every number settles near 1/6 ≈ 16.7 %. That's the law of large numbers.", "Viele Würfe: Jede Augenzahl pendelt sich bei etwa 1/6 ≈ 16,7 % ein. Das ist das Gesetz der großen Zahlen.")
          : tx(
              `Many throws: the relative frequency settles down. A good estimate is P(point up) ≈ ${pct(h)}.`,
              `Viele Würfe: Die relative Häufigkeit pendelt sich ein. Ein guter Schätzwert ist P(Kopflage) ≈ ${pct(h)}.`,
            );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Segmented
          value={mode}
          onChange={switchMode}
          options={[
            { id: "die", label: t(tx("Die", "Würfel")) },
            { id: "pin", label: t(tx("Drawing pin", "Reißzwecke")) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {[1, 10, 100, 1000].map((k) => (
            <button key={k} onClick={() => throwMany(k)} disabled={n >= MAX} className={btn}>
              +{k.toLocaleString(locale === "de" ? "de-DE" : "en-GB")}
            </button>
          ))}
          <button onClick={() => setRun(fresh(mode))} className={cn(btn, "px-2.5")} aria-label={t(tx("Start again", "Neu starten"))} title={t(tx("Start again", "Neu starten"))}>
            <RotateCcw className="size-3.5" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <svg viewBox="0 0 44 44" className="size-11" aria-hidden>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.g
                key={run.flips}
                initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                style={{ originX: "22px", originY: "22px" }}
              >
                {run.last === null ? (
                  mode === "die" ? <DieFace x={22} y={22} s={34} n={6} /> : <Pin x={22} y={30} side={false} />
                ) : mode === "die" ? (
                  <DieFace x={22} y={22} s={34} n={run.last + 1} lit={run.last === watch} />
                ) : (
                  <Pin x={22} y={30} side={run.last === 1} />
                )}
              </motion.g>
            </AnimatePresence>
          </svg>
          <div className="text-right leading-tight">
            <div className="font-math text-[22px] tabular-nums">{n.toLocaleString(locale === "de" ? "de-DE" : "en-GB")}</div>
            <div className="text-[12px] text-ink-3">{t(mode === "die" ? tx("rolls", "Würfe") : tx("throws", "Würfe"))}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <figure className="rounded-xl border border-line bg-surface p-3">
          <figcaption className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Relative frequency", "Relative Häufigkeit"))}</figcaption>
          <svg viewBox={`0 0 ${W} 244`} className="block h-auto w-full" role="img" aria-label={t(tx("Bar chart of the relative frequencies", "Säulendiagramm der relativen Häufigkeiten"))}>
            {(mode === "die" ? [0, 0.1, 0.2, 0.3, 0.4, 0.5] : [0, 0.25, 0.5, 0.75, 1]).map((v) => (
              <g key={v}>
                <line x1={34} x2={W - right + 4} y1={barY(v)} y2={barY(v)} stroke="var(--line)" strokeWidth={1} />
                <text x={28} y={barY(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            {run.counts.map((c, i) => {
              const hv = n ? c / n : 0;
              const x = 38 + i * slotW + slotW * 0.18;
              const bw = slotW * 0.64;
              const lit = i === watch;
              return (
                <g key={i}>
                  <motion.rect
                    initial={false}
                    animate={{ y: barY(hv), height: Math.max(0, top + plotH - barY(hv)) }}
                    transition={{ type: "tween", ease: "easeOut", duration: 0.35 }}
                    x={x}
                    width={bw}
                    rx={4}
                    fill={lit ? "var(--blob)" : "var(--ink-3)"}
                    opacity={lit ? 0.9 : 0.45}
                  />
                  {n > 0 && (
                    <text x={x + bw / 2} y={barY(hv) - 6} textAnchor="middle" fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                      {num(hv * 100, 1)}
                    </text>
                  )}
                  {mode === "die" ? (
                    <DieFace x={x + bw / 2} y={top + plotH + 20} s={22} n={i + 1} lit={lit} />
                  ) : (
                    <text x={x + bw / 2} y={top + plotH + 24} textAnchor="middle" fontSize={13} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                      {t(labels[i])}
                    </text>
                  )}
                  <text x={x + bw / 2} y={top + plotH + 44} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                    H = {c}
                  </text>
                </g>
              );
            })}
            {target !== null && (
              <g>
                <line x1={34} x2={W - right + 4} y1={barY(target)} y2={barY(target)} stroke="var(--blob)" strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={W - right + 8} y={barY(target) + 4} fontSize={12} fill="var(--blob-ink)" className="font-math">
                  1/6
                </text>
              </g>
            )}
          </svg>
        </figure>

        <figure className="rounded-xl border border-line bg-surface p-3">
          <figcaption className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            {t(tx(`Relative frequency of “${watchName}” over time`, `Relative Häufigkeit von „${watchName}“ im Verlauf`))}
          </figcaption>
          <svg viewBox={`0 0 ${LW} ${LH}`} className="block h-auto w-full" role="img" aria-label={t(tx("Line chart of the relative frequency", "Liniendiagramm der relativen Häufigkeit"))}>
            {[1, 10, 100, 1000, 10000].map((v) => (
              <g key={v}>
                <line x1={lx(v)} x2={lx(v)} y1={ly(lyMax)} y2={ly(0)} stroke="var(--line)" strokeWidth={1} />
                <text x={lx(v)} y={LH - 12} textAnchor="middle" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                  {v.toLocaleString(locale === "de" ? "de-DE" : "en-GB")}
                </text>
              </g>
            ))}
            {[0, 0.25, 0.5, 0.75, 1].filter((v) => v <= lyMax).map((v) => (
              <text key={v} x={28} y={ly(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
                {Math.round(v * 100)}%
              </text>
            ))}
            <line x1={34} x2={lx(10000)} y1={ly(0)} y2={ly(0)} stroke="var(--ink-3)" strokeWidth={1} />
            {target !== null && (
              <g>
                <line x1={34} x2={lx(10000)} y1={ly(target)} y2={ly(target)} stroke="var(--blob)" strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={lx(10000) + 4} y={ly(target) + 4} fontSize={12} fill="var(--blob-ink)" className="font-math">
                  1/6
                </text>
              </g>
            )}
            {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke="var(--blob)" strokeWidth={2} strokeLinejoin="round" />}
            {pts.length > 0 && <circle cx={Number(pts[pts.length - 1].split(",")[0])} cy={Number(pts[pts.length - 1].split(",")[1])} r={3.5} fill="var(--blob)" />}
            <text x={lx(10000)} y={LH - 1} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
              {t(tx("number of throws", "Anzahl der Würfe"))}
            </text>
          </svg>
        </figure>
      </div>

      <p className="min-h-[2.8em] text-[14px] leading-relaxed text-ink-2" aria-live="polite">
        {t(caption)}
        {n > 0 && (
          <span className="ml-1 text-ink">
            {t(tx(` Right now: h(${watchName}) = `, ` Gerade: h(${watchName}) = `))}
            <span className="font-math tabular-nums">
              {run.counts[watch]}/{n} ≈ {pct(h)}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner builder

const CYCLE: Ball[] = ["purple", "red", "green"];
const START: Ball[] = ["purple", "purple", "purple", "green", "green", "green", "red", "red"];

function fracText(k: number, n: number) {
  const g = gcd(k, n) || 1;
  return k === 0 ? "0" : k === n ? "1" : `\\frac{${k}}{${n}}${g > 1 ? ` = \\frac{${k / g}}{${n / g}}` : ""}`;
}

export function ProbabilitySpinnerLab() {
  const t = useText();
  const num = useNum();
  const locale = useLocale();
  const [fields, setFields] = useState<Ball[]>(START);
  const [angle, setAngle] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [tally, setTally] = useState<Record<Ball, number>>({ red: 0, green: 0, purple: 0 });
  const [last, setLast] = useState<number | null>(null);
  const n = fields.length;
  const spins = tally.red + tally.green + tally.purple;

  const reset = (next: Ball[]) => {
    setFields(next);
    setTally({ red: 0, green: 0, purple: 0 });
    setLast(null);
  };
  const setCount = (k: number) => {
    if (pending !== null) return;
    reset(k > n ? [...fields, ...Array.from({ length: k - n }, (_, i) => CYCLE[(n + i) % 3])] : fields.slice(0, k));
  };
  const recolour = (i: number) => {
    if (pending !== null) return;
    reset(fields.map((c, j) => (j === i ? CYCLE[(CYCLE.indexOf(c) + 1) % 3] : c)));
  };

  function spin() {
    if (pending !== null) return;
    const i = randomBelow(n);
    const u = 0.2 + 0.6 * randomUnit();
    const phi = ((i + u) * 360) / n;
    const now = ((angle % 360) + 360) % 360;
    const delta = (((360 - phi - now) % 360) + 360) % 360;
    setAngle(angle + 3 * 360 + delta);
    setPending(i);
  }
  function quick(times: number) {
    if (pending !== null) return;
    const next = { ...tally };
    for (let k = 0; k < times; k++) next[fields[randomBelow(n)]]++;
    setTally(next);
    setLast(null);
  }
  const done = () => {
    if (pending === null) return;
    setTally((tl) => ({ ...tl, [fields[pending]]: tl[fields[pending]] + 1 }));
    setLast(pending);
    setPending(null);
  };

  const pc = (v: number) => num(v * 100, 1);
  const dec = (v: number) => num(v, 4);
  const sp = locale === "de" ? " " : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Stepper label={t(tx("Fields", "Felder"))} value={n} min={2} max={12} onChange={setCount} />
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={spin} disabled={pending !== null} className="flex h-9 items-center gap-1.5 rounded-lg bg-blob px-4 text-[13px] font-semibold text-[color:var(--raised)] transition-[filter] hover:brightness-110 disabled:opacity-50">
            {t(tx("Spin", "Drehen"))}
          </button>
          <button onClick={() => quick(10)} disabled={pending !== null} className={btn}>
            {t(tx("10 spins", "10-mal"))}
          </button>
          <button onClick={() => quick(100)} disabled={pending !== null} className={btn}>
            {t(tx("100 spins", "100-mal"))}
          </button>
        </div>
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[280px]">
          <motion.div animate={{ rotate: angle }} transition={pending !== null ? { duration: 2.4, ease: [0.12, 0.65, 0.18, 1] } : { duration: 0 }} onAnimationComplete={done}>
            <svg viewBox="26 30 208 208" className="block h-auto w-full" role="group" aria-label={t(tx("Spinner: tap a field to change its colour", "Glücksrad: Tippe auf ein Feld, um die Farbe zu wechseln"))}>
              <SpinnerWheel
                sectors={fields.map((c) => ({ w: 1, color: c }))}
                onSector={recolour}
                focusLabel={(i) => `${t(tx("Field", "Feld"))} ${i + 1}: ${t(BALL[fields[i]].name)}`}
              />
            </svg>
          </motion.div>
          <svg viewBox="26 0 208 50" className="pointer-events-none absolute -top-[5%] left-0 block h-auto w-full" aria-hidden>
            <SpinnerPointer />
          </svg>
          <AnimatePresence>
            {last !== null && (
              <motion.div
                key={`${spins}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line bg-raised px-3 py-1 text-[13px] font-semibold shadow-card"
              >
                <span className="mr-1.5 inline-block size-2.5 rounded-full align-middle" style={{ background: BALL[fields[last]].fill }} />
                {t(BALL[fields[last]].name)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          {CYCLE.map((c) => {
            const k = fields.filter((f) => f === c).length;
            const p = k / n;
            const f = spins ? tally[c] / spins : null;
            const tail = k > 0 && k < n ? ` = ${dec(p)} = ${pc(p)} \\, %` : "";
            const src = `P("${t(BALL[c].name)}") = ${fracText(k, n)}${tail}`;
            return (
              <div key={c} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="size-3.5 shrink-0 rounded-full" style={{ background: BALL[c].fill }} />
                  <MathView src={src} size="sm" animate={false} />
                  {(k === 0 || k === n) && (
                    <span className="rounded-full bg-blob-soft px-2 py-0.5 text-[12px] font-semibold text-blob-ink">
                      {k === 0 ? t(tx("impossible", "unmöglich")) : t(tx("certain", "sicher"))}
                    </span>
                  )}
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-line">
                  <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: BALL[c].fill }} initial={false} animate={{ width: `${p * 100}%` }} transition={{ type: "spring", stiffness: 240, damping: 28 }} />
                  {f !== null && (
                    <motion.div
                      className="absolute -top-1 h-4 w-0.5 rounded bg-ink"
                      initial={false}
                      animate={{ left: `calc(${f * 100}% - 1px)` }}
                      transition={{ type: "spring", stiffness: 240, damping: 28 }}
                      title={t(tx("relative frequency", "relative Häufigkeit"))}
                    />
                  )}
                </div>
                {f !== null && (
                  <div className="mt-1 text-[12px] text-ink-3">
                    {t(tx("spun", "gedreht"))}: {tally[c]} / {spins} ≈ {pc(f)}
                    {sp}%
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[13px] leading-relaxed text-ink-2">
            {t(
              tx(
                "Tap a field to change its colour. All fields are the same size, so P = coloured fields : all fields. The thin mark on each bar shows the relative frequency of your spins.",
                "Tippe auf ein Feld, um seine Farbe zu wechseln. Alle Felder sind gleich groß, also ist P = Felder dieser Farbe : alle Felder. Der Strich auf jedem Balken zeigt die relative Häufigkeit deiner Drehungen.",
              ),
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
