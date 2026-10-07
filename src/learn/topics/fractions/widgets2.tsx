"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronsRight, RotateCcw, Target } from "lucide-react";
import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLocale } from "@/i18n/client";
import { MathView } from "@/learn/components/MathView";
import { frac } from "@/learn/engine/frac";
import { gcd } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { longDivision, periodOf, primeFactors, terminates } from "./decimals";
import { Chip, Stepper, usePick } from "./level1";

// ---------------------------------------------------------------------------
// A decimal with the period marked by a bar: 0,1̅6̅ is drawn as 0,1 with a bar over 6.

export function PeriodicNumber({ int, pre = "", period = "", neg, className }: { int: string; pre?: string; period?: string; neg?: boolean; className?: string }) {
  const de = useLocale() === "de";
  return (
    <span className={cn("inline-flex items-end whitespace-nowrap font-math tabular-nums", className)}>
      {neg && <span className="mr-[0.08em]">−</span>}
      <span>
        {int}
        {int !== "" && (pre || period) ? (de ? "," : ".") : ""}
        {pre}
      </span>
      {period && (
        <span className="relative inline-block">
          <motion.span
            aria-hidden
            className="absolute inset-x-[0.04em] top-[0.12em] block h-[max(1.5px,0.06em)] origin-left rounded-full bg-current"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          />
          {period}
        </span>
      )}
    </span>
  );
}

/** The repeating (or terminating) decimal of a fraction, with the bar. */
export function FractionDecimal({ n, d, className }: { n: number; d: number; className?: string }) {
  const p = periodOf(Math.abs(n), d);
  return <PeriodicNumber int={String(p.int)} pre={p.pre} period={p.period} neg={n < 0} className={className} />;
}

/** Task picture: one big repeating decimal. */
export function FractionsPeriodicPicture({ int, pre, period }: { int: string; pre: string; period: string }) {
  const t = usePick();
  return (
    <div className="grid place-items-center gap-1 px-2 py-5">
      <PeriodicNumber int={int} pre={pre} period={period} className="text-[44px] leading-none" />
      <span className="text-[12.5px] text-ink-3">
        {t("The bar marks the period: these digits repeat forever.", "Der Strich markiert die Periode: Diese Ziffern wiederholen sich endlos.")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explain picture: terminating or repeating?

const TABLE: { n: number; d: number }[] = [
  { n: 3, d: 8 },
  { n: 1, d: 3 },
  { n: 4, d: 11 },
  { n: 1, d: 6 },
];

export function FractionsDecimalKinds() {
  const t = usePick();
  const kind = (n: number, d: number) => {
    const p = periodOf(n, d);
    if (!p.period) return t("terminating", "abbrechend");
    return p.pre ? t("mixed repeating", "gemischt periodisch") : t("purely repeating", "rein periodisch");
  };
  const why = (n: number, d: number) => {
    const f = primeFactors(d).join(" · ");
    const p = periodOf(n, d);
    if (!p.period) return t(`${d} = ${f}: only 2s and 5s`, `${d} = ${f}: nur Zweien und Fünfen`);
    return p.pre
      ? t(`pre-period ${p.pre}, period ${p.period}`, `Vorperiode ${p.pre}, Periode ${p.period}`)
      : t(`period ${p.period}`, `Periode ${p.period}`);
  };
  return (
    <div className="space-y-3">
      <div className="text-[13px] font-semibold text-ink-2">{t("Terminating or repeating?", "Abbrechend oder periodisch?")}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {TABLE.map(({ n, d }, i) => (
          <motion.div
            key={`${n}/${d}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 300, damping: 28 }}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            <MathView src={`\\frac{${n}}{${d}} =`} size="md" animate={false} />
            <FractionDecimal n={n} d={d} className="text-[24px]" />
            <span className="ml-auto text-right text-[12px] leading-tight">
              <span className={cn("block font-semibold", terminates(n, d) ? "text-ok" : "text-blob-ink")}>{kind(n, d)}</span>
              <span className="block text-ink-3">{why(n, d)}</span>
            </span>
          </motion.div>
        ))}
      </div>
      <p className="text-[12.5px] leading-relaxed text-ink-3">
        {t(
          "A fully simplified fraction terminates exactly when its denominator has no prime factors other than 2 and 5.",
          "Ein vollständig gekürzter Bruch bricht genau dann ab, wenn sein Nenner keine anderen Primfaktoren als 2 und 5 hat.",
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: the division machine. n : d by hand, digit by digit, until the remainder is 0
// or a remainder comes back (then everything repeats: the period).

const PRESETS: [number, number][] = [
  [1, 3],
  [1, 6],
  [3, 8],
  [4, 11],
  [5, 12],
  [1, 7],
];

export function FractionsDivisionMachine() {
  const t = usePick();
  const de = useLocale() === "de";
  const [n, setN] = useState(1);
  const [d, setD] = useState(6);
  const [shown, setShown] = useState(0);
  const L = longDivision(n, d);
  const total = L.digits.length;
  const done = shown >= total;
  const repeating = L.start >= 0;
  const r0 = n % d;
  const comma = de ? "," : ".";
  const rest = t("remainder", "Rest");

  const set = (nn: number, dd: number) => {
    setN(nn);
    setD(dd);
    setShown(0);
  };

  // Line k: line 0 is "n : d = int", line i + 1 brings down a zero for digit i.
  const lines = [
    { a: n, q: L.int, r: r0 },
    ...L.digits.slice(0, shown).map((q, i) => ({ a: L.rems[i] * 10, q, r: i + 1 < total ? L.rems[i + 1] : repeating ? L.rems[L.start] : 0 })),
  ];
  const repeatLines = done && repeating ? [L.start, total] : [];

  const reduced = frac(n, d);
  const factors = primeFactors(reduced.d);
  const bad = factors.filter((p) => p !== 2 && p !== 5);
  const p = periodOf(n, d);

  const message = done
    ? !total
      ? t(`${n} : ${d} = ${L.int}. The division ends right away: a whole number.`, `${n} : ${d} = ${L.int}. Die Division geht sofort auf: eine ganze Zahl.`)
      : repeating
        ? t(
            `Remainder ${L.rems[L.start]} has come up before! From here everything repeats: the decimal is repeating with the period ${p.period}.`,
            `Den Rest ${L.rems[L.start]} gab es schon einmal! Ab hier wiederholt sich alles: Die Dezimalzahl ist periodisch mit der Periode ${p.period}.`,
          )
        : t("Remainder 0: the division ends. This is a terminating decimal.", "Rest 0: Die Division geht auf. Das ist eine abbrechende Dezimalzahl.")
    : shown === 0
      ? t(
          `${n} : ${d} = ${L.int} ${rest} ${r0}. Press “Next digit”: add a zero to the remainder and divide again.`,
          `${n} : ${d} = ${L.int} ${rest} ${r0}. Drück auf „Nächste Ziffer“: Hänge an den Rest eine Null an und teile wieder.`,
        )
      : t(`${rest} ${lines[lines.length - 1].r}: add a zero and divide by ${d} again.`, `${rest} ${lines[lines.length - 1].r}: Null anhängen und wieder durch ${d} teilen.`);

  const fs = factors.length > 1 ? ` = ${factors.join(" · ")}` : "";
  const why =
    reduced.d === 1
      ? ""
      : bad.length
        ? t(
            `Simplified denominator ${reduced.d}${fs}. The prime factor ${bad[0]} makes it repeat.`,
            `Gekürzter Nenner ${reduced.d}${fs}. Der Primfaktor ${bad[0]} sorgt für die Periode.`,
          )
        : t(
            `Simplified denominator ${reduced.d}${fs}: only 2s and 5s, so it terminates.`,
            `Gekürzter Nenner ${reduced.d}${fs}: nur Zweien und Fünfen, also bricht sie ab.`,
          );

  const digits = L.digits.slice(0, shown);
  const periodStart = done && repeating ? L.start : digits.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Stepper label={t("Numerator", "Zähler")} value={n} min={1} max={40} onChange={(v) => set(v, d)} />
        <Stepper label={t("Denominator", "Nenner")} value={d} min={2} max={20} onChange={(v) => set(n, v)} />
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map(([a, b]) => (
            <Chip key={`${a}/${b}`} onClick={() => set(a, b)} title={t(`Try ${a}/${b}`, `${a}/${b} ausprobieren`)}>
              <span className="text-[14px]">
                {a}/{b}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-5 rounded-xl border border-line bg-surface p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col items-center justify-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <MathView src={`\\frac{${n}}{${d}} = ${n} : ${d} =`} size="lg" animate={false} />
            <span className="inline-flex flex-wrap items-end font-math text-[32px] leading-tight tabular-nums">
              <span>
                {L.int}
                {total > 0 && (shown > 0 || done) ? comma : ""}
              </span>
              {digits.slice(0, periodStart).map((q, i) => (
                <motion.span key={`${n}/${d}-${i}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}>
                  {q}
                </motion.span>
              ))}
              {done && repeating && <PeriodicNumber int="" period={p.period} className="text-[32px]" />}
              {!done && total > 0 && <span className="ml-0.5 animate-pulse text-ink-3">…</span>}
            </span>
          </div>
          <AnimatePresence>
            {done && total > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={cn("rounded-full px-3 py-1 text-[12.5px] font-semibold", repeating ? "bg-blob-soft text-blob-ink" : "bg-ok/12 text-ok")}
              >
                {repeating ? (p.pre ? t("mixed repeating", "gemischt periodisch") : t("purely repeating", "rein periodisch")) : t("terminating", "abbrechend")}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Dividing by hand", "Schriftlich dividieren")}</div>
          <div className="max-h-[210px] space-y-1 overflow-y-auto pr-1 font-math text-[17px] tabular-nums">
            <AnimatePresence initial={false}>
              {lines.map((ln, i) => {
                const lit = repeatLines.includes(i);
                return (
                  <motion.div
                    key={`${n}/${d}-l${i}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-baseline gap-2 whitespace-nowrap"
                  >
                    <span className="w-14 text-right">{ln.a}</span>
                    <span className="text-ink-3">: {d} =</span>
                    <span className={cn("w-4 text-center font-semibold", i > 0 && "text-blob-ink")}>{ln.q}</span>
                    <span className="font-sans text-[12px] text-ink-3">{rest}</span>
                    <span className={cn("rounded px-1", lit ? "bg-blob text-white" : ln.r === 0 ? "text-ok" : "")}>{ln.r}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShown((s) => Math.min(total, s + 1))}
          disabled={done}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-paper hover:bg-ink/88 disabled:opacity-35"
        >
          {t("Next digit", "Nächste Ziffer")}
        </button>
        <button
          type="button"
          onClick={() => setShown(total)}
          disabled={done}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        >
          <ChevronsRight className="size-3.5" /> {t("All digits", "Alle Ziffern")}
        </button>
        <button
          type="button"
          onClick={() => setShown(0)}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t("Start again", "Von vorn")}
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={message} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13.5px] leading-relaxed text-ink-2">
          {message} {done && why && <span className="text-ink-3">{why}</span>}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A number line for fractions: integers labelled, ticks every 1/d.

const LW = 600;
const PAD = 26;

function lineX(v: number, from: number, to: number) {
  return PAD + ((v - from) / (to - from)) * (LW - 2 * PAD);
}

function Ticks({ from, to, d, y }: { from: number; to: number; d: number; y: number }) {
  const ticks: number[] = [];
  for (let k = from * d; k <= to * d; k++) ticks.push(k);
  return (
    <>
      <line x1={8} x2={LW - 8} y1={y} y2={y} stroke="var(--ink-3)" strokeWidth={1.5} />
      <path d={`M${LW - 14} ${y - 6} L${LW - 6} ${y} L${LW - 14} ${y + 6}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} />
      {ticks.map((k) => {
        const whole = k % d === 0;
        const x = lineX(k / d, from, to);
        return (
          <g key={`${d}:${k}`}>
            <line x1={x} x2={x} y1={y - (whole ? 11 : 6)} y2={y + (whole ? 11 : 6)} stroke={whole ? "var(--ink-2)" : "var(--ink-3)"} strokeWidth={whole ? 2 : 1.2} />
            {whole && (
              <text x={x} y={y + 34} textAnchor="middle" fontSize={23} fill="var(--ink)" style={{ fontFamily: "var(--font-math)" }}>
                {k / d < 0 ? `−${Math.abs(k / d)}` : k / d}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

/** Task picture: a number line with ticks every 1/d and one marked point (n/d), labelled "?". */
export function FractionsLinePicture({ from, to, d, n }: { from: number; to: number; d: number; n: number }) {
  const t = usePick();
  const x = lineX(n / d, from, to);
  return (
    <div className="px-1 py-3">
      <svg viewBox={`0 0 ${LW} 100`} className="block w-full" role="img" aria-label={t("Number line with a marked point", "Zahlenstrahl mit markiertem Punkt")}>
        <Ticks from={from} to={to} d={d} y={52} />
        <motion.g initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.2 }}>
          <circle cx={x} cy={52} r={8} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2.5} />
          <text x={x} y={26} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
            ?
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: one point, three names. Drag the point along the number line; it snaps to
// multiples of 1/d. The point's value is shown as a fraction, a decimal and a percentage.

const FROM = -2;
const TO = 2;

type Goal = { src: string; v: number; hint: number };
const GOALS: Goal[] = [
  { src: "-\\frac{3}{4}", v: -0.75, hint: 4 },
  { src: "1\\frac{1}{3}", v: 4 / 3, hint: 3 },
  { src: "-1,25", v: -1.25, hint: 4 },
  { src: "\\frac{5}{6}", v: 5 / 6, hint: 6 },
  { src: "-0,2", v: -0.2, hint: 5 },
  { src: "150 %", v: 1.5, hint: 2 },
  { src: "-\\frac{2}{3}", v: -2 / 3, hint: 3 },
  { src: "0,375", v: 0.375, hint: 8 },
];

export function FractionsNumberLine() {
  const t = usePick();
  const de = useLocale() === "de";
  const scope = useId();
  const [d, setD] = useState(4);
  const [k, setK] = useState(3);
  const [goal, setGoal] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const v = k / d;
  const f = frac(k, d);
  const x = lineX(v, FROM, TO);

  const changeD = (nd: number) => {
    // Keep the point where it is if it fits the new ticks, otherwise move it to the nearest tick.
    setK(Math.round(v * nd));
    setD(nd);
  };
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - box.left) / box.width) * LW;
    const val = FROM + ((sx - PAD) / (LW - 2 * PAD)) * (TO - FROM);
    setK(Math.max(FROM * d, Math.min(TO * d, Math.round(val * d))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") setK((c) => Math.max(FROM * d, c - 1));
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") setK((c) => Math.min(TO * d, c + 1));
    else return;
    e.preventDefault();
  };

  const target = goal === null ? null : GOALS[goal % GOALS.length];
  const hit = target !== null && Math.abs(target.v - v) < 1e-9;
  const g = gcd(k, d);

  // The value's names.
  const fracSrc = f.d === 1 ? String(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`;
  const raw = g > 1 && f.d !== 1 ? `${k < 0 ? "-" : ""}\\frac{${Math.abs(k)}}{${d}} = ` : "";
  const whole = Math.trunc(Math.abs(f.n) / f.d);
  const mixed = f.d !== 1 && whole > 0 ? ` = ${f.n < 0 ? "-" : ""}${whole}\\frac{${Math.abs(f.n) - whole * f.d}}{${f.d}}` : "";
  const pct = periodOf(Math.abs(f.n) * 100, f.d);

  const nextGoal = () => setGoal((c) => (c === null ? 0 : c + 1));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Stepper label={t("Steps per whole", "Abschnitte pro Ganzes")} value={d} min={1} max={12} onChange={changeD} />
        <button
          type="button"
          onClick={nextGoal}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <Target className="size-3.5" /> {target ? t("Next target", "Nächstes Ziel") : t("Give me a target", "Gib mir ein Ziel")}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {target && (
          <motion.div
            key={goal}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors", hit ? "border-ok/40 bg-ok/10" : "border-blob/30 bg-blob-soft")}>
              <span className="text-[13.5px] font-medium text-ink-2">{t("Put the point on", "Setz den Punkt auf")}</span>
              <MathView src={de ? target.src : target.src.replace(/(\d),(\d)/g, "$1.$2")} size="md" animate={false} />
              {hit ? (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                  <Check className="size-4" /> {t("Spot on!", "Getroffen!")}
                </motion.span>
              ) : (
                <span className="ml-auto text-[12.5px] text-ink-3">
                  {d % target.hint === 0 ? t("These ticks fit. Now find the spot.", "Die Einteilung passt. Jetzt such die Stelle.") : t("Tip: choose ticks that fit this number.", "Tipp: Wähl eine passende Einteilung.")}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-xl border border-line bg-surface px-2 pb-2 pt-3 sm:px-4">
        <div className="relative pt-12">
        <motion.div
          className="pointer-events-none absolute top-0"
          style={{ x: "-50%" }}
          animate={{ left: `${(x / LW) * 100}%` }}
          transition={drag ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
        >
          <div className="rounded-lg bg-blob px-2 py-0.5 text-white shadow-card">
            <MathView src={fracSrc} size="sm" animate={false} />
          </div>
        </motion.div>
        <svg
          viewBox={`0 0 ${LW} 96`}
          className="block w-full cursor-pointer touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blob/40"
          role="slider"
          tabIndex={0}
          aria-label={t("Point on the number line", "Punkt auf dem Zahlenstrahl")}
          aria-valuemin={FROM}
          aria-valuemax={TO}
          aria-valuenow={v}
          aria-valuetext={`${k}/${d}`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(true);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (drag) fromPointer(e);
          }}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
        >
          <Ticks from={FROM} to={TO} d={d} y={34} />
          <motion.circle
            cy={34}
            r={drag ? 13 : 11}
            fill="var(--blob)"
            stroke="var(--raised)"
            strokeWidth={3}
            animate={{ cx: x }}
            transition={drag ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
          />
        </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Fraction", "Bruch")}</div>
          <div className="mt-1 min-h-[44px]">
            <MathView src={`${raw}${fracSrc}${mixed}`} size="md" scope={`${scope}-f`} />
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Decimal", "Dezimalzahl")}</div>
          <div className="mt-1 flex min-h-[44px] items-center">
            <FractionDecimal n={f.n} d={f.d} className="text-[26px]" />
          </div>
        </div>
        <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Percentage", "Prozent")}</div>
          <div className="mt-1 flex min-h-[44px] items-center gap-1">
            <PeriodicNumber int={String(pct.int)} pre={pct.pre} period={pct.period} neg={f.n < 0} className="text-[26px]" />
            <span className="font-math text-[24px]">%</span>
          </div>
        </div>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {t(
          "Drag the point or use the arrow keys. Right of 0 the numbers are positive, left of 0 negative. Further right always means bigger.",
          "Zieh den Punkt oder nimm die Pfeiltasten. Rechts von 0 sind die Zahlen positiv, links negativ. Weiter rechts heißt immer: größer.",
        )}
      </p>
    </div>
  );
}
