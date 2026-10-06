"use client";

// Tolerance curves: how well an organism does (vitality) depending on one environmental
// factor. A static chart for tasks and a lab with a temperature slider and a fish that swims
// lively in the optimum, slowly in the pessimum and dies outside its range of tolerance.

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Axes, Tag, path, scales, type Box } from "./EcoChart";
import { pow } from "@/lib/stableMath";

export type Curve = { min: number; opt: number; max: number };

/** Vitality 0…1: zero outside [min, max], 1 at the optimum, steeper on the shorter side. */
export function vitality(c: Curve, x: number) {
  if (x <= c.min || x >= c.max) return 0;
  const q = 1.4;
  const p = (q * (c.opt - c.min)) / (c.max - c.opt);
  return pow((x - c.min) / (c.opt - c.min), p) * pow((c.max - x) / (c.max - c.opt), q);
}

/** Where the curve crosses `level` on the left and right of the optimum. */
export function crossings(c: Curve, level: number): [number, number] {
  const solve = (lo: number, hi: number, rising: boolean) => {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const v = vitality(c, mid);
      if (v < level === rising) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return [solve(c.min, c.opt, true), solve(c.opt, c.max, false)];
}

const PESS = 0.3;
const OPTI = 0.92;

const curvePts = (c: Curve, px: (v: number) => number, py: (v: number) => number, x0: number, x1: number): [number, number][] => {
  const pts: [number, number][] = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push([px(x), py(vitality(c, x))]);
  }
  return pts;
};

const BOX: Box = { W: 420, H: 236, l: 34, r: 14, t: 26, b: 40 };

export type ToleranceChartProps = {
  curves: (Curve & { label?: string })[];
  xMin: number;
  xMax: number;
  xStep: number;
  /** Axis name with unit, e.g. tx("temperature in °C", "Temperatur in °C"). */
  xName: Text;
  /** Shade and name optimum and pessimum. */
  zones?: boolean;
  /** Letters on the curve at these x values (for "which point…" tasks). */
  points?: { x: number; label: string }[];
  /** Mark minimum, maximum and the range of tolerance. */
  limits?: boolean;
  /** A movable reading line with a dot on each curve (the lab). */
  cursor?: number;
};

/** A tolerance curve (or two) for tasks: vitality over one factor. */
export function ToleranceChart({ curves, xMin, xMax, xStep, xName, zones, points, limits, cursor }: ToleranceChartProps) {
  const t = useText();
  const locale = useLocale();
  const { px, py } = scales(BOX, [xMin, xMax], [0, 1.12]);
  const ticks: number[] = [];
  for (let v = xMin; v <= xMax + 1e-9; v += xStep) ticks.push(Math.round(v * 100) / 100);
  const fmt = (v: number) => (locale === "de" ? String(v).replace(".", ",") : String(v)).replace("-", "−");
  const colors = ["var(--blob)", "var(--bio-water-deep)"];
  const c0 = curves[0];
  const [p1, p2] = crossings(c0, PESS);
  const [o1, o2] = crossings(c0, OPTI);
  return (
    <svg viewBox={`0 0 ${BOX.W} ${BOX.H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 520 }} role="img" aria-label={t(tx("Tolerance curve", "Toleranzkurve"))}>
      {zones && (
        <g>
          <rect x={px(c0.min)} y={BOX.t} width={px(p1) - px(c0.min)} height={BOX.H - BOX.t - BOX.b} fill="var(--bio-mito)" opacity={0.28} />
          <rect x={px(p2)} y={BOX.t} width={px(c0.max) - px(p2)} height={BOX.H - BOX.t - BOX.b} fill="var(--bio-mito)" opacity={0.28} />
          <rect x={px(o1)} y={BOX.t} width={px(o2) - px(o1)} height={BOX.H - BOX.t - BOX.b} fill="var(--bio-leaf)" opacity={0.35} />
        </g>
      )}
      <Axes box={BOX} x={[xMin, xMax]} y={[0, 1.12]} xTicks={ticks} yTicks={[]} xLabel={t(xName)} yLabel={t(tx("vitality", "Vitalität"))} xFmt={fmt} yTickLabels={false} />
      {curves.map((c, i) => (
        <g key={i}>
          <path d={path(curvePts(c, px, py, Math.max(xMin, c.min), Math.min(xMax, c.max)))} fill="none" stroke={colors[i % 2]} strokeWidth={3} strokeLinejoin="round" />
          {c.label && <Tag x={px(c.opt)} y={py(1) - 8} color={colors[i % 2]}>{c.label}</Tag>}
        </g>
      ))}
      {zones && (
        <g>
          <Tag x={(px(c0.min) + px(p1)) / 2} y={BOX.t + 12} size={10.5}>{t(tx("pessimum", "Pessimum"))}</Tag>
          <Tag x={(px(p2) + px(c0.max)) / 2} y={BOX.t + 12} size={10.5}>{t(tx("pessimum", "Pessimum"))}</Tag>
          <Tag x={(px(o1) + px(o2)) / 2} y={py(0.45)} size={10.5}>{t(tx("optimum", "Optimum"))}</Tag>
        </g>
      )}
      {limits && (
        <g>
          <circle cx={px(c0.min)} cy={py(0)} r={4} fill="var(--ink)" />
          <circle cx={px(c0.max)} cy={py(0)} r={4} fill="var(--ink)" />
          <Tag x={px(c0.min)} y={py(0) - 10} size={10.5}>{t(tx("minimum", "Minimum"))}</Tag>
          <Tag x={px(c0.max)} y={py(0) - 10} size={10.5}>{t(tx("maximum", "Maximum"))}</Tag>
        </g>
      )}
      {cursor !== undefined && (
        <g>
          <motion.line y1={BOX.t} y2={BOX.H - BOX.b} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 4" initial={false} animate={{ x1: px(cursor), x2: px(cursor) }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          {curves.map((c, i) => (
            <motion.circle key={i} r={7} fill="var(--raised)" stroke={colors[i % 2]} strokeWidth={3.5} initial={false} animate={{ cx: px(cursor), cy: py(vitality(c, cursor)) }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          ))}
        </g>
      )}
      {points?.map((p) => {
        const v = vitality(c0, p.x);
        return (
          <g key={p.label}>
            <line x1={px(p.x)} x2={px(p.x)} y1={py(0)} y2={py(v)} stroke="var(--ink-3)" strokeDasharray="3 3" />
            <circle cx={px(p.x)} cy={py(v)} r={5} fill="var(--raised)" stroke="var(--ink)" strokeWidth={2} />
            <Tag x={px(p.x)} y={py(v) - 10} size={12.5} weight={700}>{p.label}</Tag>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The lab

type Species = { id: string; name: Text; curve: Curve; body: string; word: Text };
const SPECIES: Species[] = [
  { id: "trout", name: tx("brown trout", "Bachforelle"), curve: { min: 1, opt: 11, max: 22 }, body: "var(--bio-mito)", word: tx("stenothermal", "stenotherm") },
  { id: "carp", name: tx("carp", "Karpfen"), curve: { min: 2, opt: 24, max: 38 }, body: "var(--bio-pollen)", word: tx("eurythermal", "eurytherm") },
];

function Fish({ body, v }: { body: string; v: number }) {
  const reduce = useReducedMotion();
  const dead = v <= 0;
  const speed = Math.round(v * 4) / 4;
  const swim = !reduce && !dead && speed > 0;
  return (
    <svg viewBox="0 0 160 80" className="h-auto w-full max-w-[180px]" aria-hidden>
      <path d="M0 64 Q40 58 80 64 T160 64 V80 H0 Z" fill="var(--bio-water)" opacity={0.25} />
      <motion.g
        key={`${dead}-${speed}`}
        animate={swim ? { x: [-26, 26, -26], rotate: [0, 0, 0] } : { x: 0 }}
        transition={swim ? { duration: 4 / Math.max(0.25, speed), repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
      >
        <g transform={dead ? "translate(80 40) scale(1 -1) translate(-80 -40)" : undefined} opacity={dead ? 0.55 : 1}>
          <motion.path
            d="M42 40 L24 26 L28 40 L24 54 Z"
            fill={dead ? "var(--line-2)" : body}
            stroke="var(--bio-outline)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            animate={swim ? { rotate: [-12, 12, -12] } : { rotate: 0 }}
            transition={swim ? { duration: 0.9 / Math.max(0.25, speed), repeat: Infinity, ease: "easeInOut" } : undefined}
            style={{ transformBox: "fill-box", transformOrigin: "100% 50%" }}
          />
          <ellipse cx={78} cy={40} rx={38} ry={16} fill={dead ? "var(--line-2)" : body} stroke="var(--bio-outline)" strokeWidth={1.8} />
          <path d="M70 25 q8 -10 18 -1" fill={dead ? "var(--line-2)" : body} stroke="var(--bio-outline)" strokeWidth={1.4} />
          <path d="M98 30 q-4 10 0 20" fill="none" stroke="var(--bio-outline)" strokeWidth={1.2} />
          {dead ? (
            <path d="M103 33 l5 5 m0 -5 l-5 5" stroke="var(--bio-outline)" strokeWidth={1.6} strokeLinecap="round" />
          ) : (
            <circle cx={105} cy={36} r={2.6} fill="var(--bio-outline)" />
          )}
          {!dead && [58, 66, 74, 84].map((x, i) => <circle key={x} cx={x} cy={34 + (i % 2) * 6} r={1.6} fill="var(--bio-mito-deep)" opacity={0.7} />)}
        </g>
      </motion.g>
    </svg>
  );
}

export function EcoToleranceLab() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [sid, setSid] = useState("trout");
  const [temp, setTemp] = useState(11);
  const [both, setBoth] = useState(false);
  const sp = SPECIES.find((s) => s.id === sid) ?? SPECIES[0];
  const v = vitality(sp.curve, temp);
  const [p1, p2] = crossings(sp.curve, PESS);
  const [o1, o2] = crossings(sp.curve, OPTI);
  const zone: "dead" | "pess" | "opt" | "ok" = v <= 0 ? "dead" : temp < p1 || temp > p2 ? "pess" : temp >= o1 && temp <= o2 ? "opt" : "ok";
  const N = (x: Text) => resolveText(x, locale);
  const nameEn = resolveText(sp.name, "en");
  const nameDe = resolveText(sp.name, "de");
  const art = sid === "trout" ? "Die" : "Der";
  const it = sid === "trout" ? "sie" : "er";
  const texts: Record<typeof zone, Text> = {
    dead: tx(`Outside the range of tolerance (below the minimum or above the maximum): the ${nameEn} dies.`, `Außerhalb des Toleranzbereichs (unter dem Minimum oder über dem Maximum): ${art} ${nameDe} stirbt.`),
    pess: tx(`Pessimum: the ${nameEn} survives, but hardly grows and does not reproduce.`, `Pessimum: ${art} ${nameDe} überlebt, wächst aber kaum und pflanzt sich nicht fort.`),
    ok: tx(`Inside the range of tolerance: the ${nameEn} lives well, but not at its best.`, `Im Toleranzbereich: ${art} ${nameDe} lebt gut, aber nicht am besten.`),
    opt: tx(`Optimum: the ${nameEn} is doing best here. It grows and reproduces most.`, `Optimum: Hier geht es ${sid === "trout" ? "der" : "dem"} ${nameDe} am besten. ${it === "sie" ? "Sie" : "Er"} wächst und vermehrt sich am stärksten.`),
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSid(s.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors", s.id === sid ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {s.id === sid && <motion.span layoutId={`${scope}-sp`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative inline-block first-letter:uppercase">{t(s.name)}</span>
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
          <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="size-4 accent-[var(--blob)]" />
          {t(tx("Compare both", "Beide vergleichen"))}
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <ToleranceChart
            curves={both ? SPECIES.map((s) => ({ ...s.curve, label: N(s.word) })) : [sp.curve]}
            xMin={0}
            xMax={40}
            xStep={5}
            xName={tx("water temperature in °C", "Wassertemperatur in °C")}
            zones={!both}
            limits={!both}
            cursor={temp}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Fish body={sp.body} v={v} />
          <div className="font-math text-[26px] tabular-nums text-ink">{(locale === "de" ? String(temp).replace(".", ",") : String(temp))} °C</div>
          <div className="text-[12.5px] text-ink-3">{t(sp.name)}</div>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={40}
        step={0.5}
        value={temp}
        onChange={(e) => setTemp(Number(e.target.value))}
        aria-label={t(tx("Water temperature", "Wassertemperatur"))}
        className="h-10 w-full cursor-pointer accent-[var(--blob)]"
      />

      <motion.p
        key={both ? "both" : `${sid}-${zone}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        aria-live="polite"
        className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", zone === "opt" && !both ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}
      >
        {both
          ? t(
              tx(
                "The trout only copes with a narrow range of temperatures: it is stenothermal (steno = narrow). The carp copes with a wide range: it is eurythermal (eury = wide). In general: stenoecious and euryoecious.",
                "Die Forelle verträgt nur einen engen Temperaturbereich: Sie ist stenotherm (steno = eng). Der Karpfen verträgt einen weiten Bereich: Er ist eurytherm (eury = weit). Allgemein sagt man stenök und euryök.",
              ),
            )
          : t(texts[zone])}
      </motion.p>
      <p className="text-[12px] text-ink-3">{t(tx("Schematic curves. The range of tolerance runs from the minimum to the maximum.", "Schematische Kurven. Der Toleranzbereich reicht vom Minimum bis zum Maximum."))}</p>
    </div>
  );
}
