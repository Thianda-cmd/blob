"use client";

// Level 3: absorption spectra of the leaf pigments and the action spectrum, and Engelmann's
// experiment (1882): a green alga lit through a prism. Oxygen-loving bacteria crowd where the
// alga makes the most oxygen: in blue and red light. Schematic curves, wavelengths in nm.

import { motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

const g = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const edge = (l: number) => Math.min(1, Math.max(0, (l - 395) / 15)) * Math.min(1, Math.max(0, (712 - l) / 22));

export type Pigment = "chlA" | "chlB" | "car" | "action";

export const SPECTRA: Record<Pigment, (l: number) => number> = {
  chlA: (l) => 0.98 * g(l, 430, 17) + 0.12 * g(l, 615, 16) + 0.78 * g(l, 662, 12) + 0.03,
  chlB: (l) => 0.95 * g(l, 455, 15) + 0.08 * g(l, 595, 15) + 0.55 * g(l, 642, 12) + 0.02,
  car: (l) => (0.55 * g(l, 425, 14) + 0.85 * g(l, 452, 14) + 0.75 * g(l, 482, 13)) * (l < 530 ? 1 : 0.2),
  action: (l) => ((0.9 * g(l, 438, 28) + 0.55 * g(l, 482, 18) + 0.95 * g(l, 672, 16) + 0.28) * edge(l)) / 1.12,
};

/** Spectrum colours from the palette, by wavelength. */
const BAND: [number, string][] = [
  [400, "var(--bio-nucleus-deep)"],
  [450, "var(--bio-t)"],
  [500, "var(--bio-water)"],
  [530, "var(--bio-g)"],
  [575, "var(--bio-c)"],
  [610, "var(--bio-mito-deep)"],
  [650, "var(--bio-a)"],
  [700, "var(--bio-blood)"],
];

const W = 600;
const X0 = 50;
const X1 = 570;
const lx = (l: number) => X0 + ((l - 400) / 300) * (X1 - X0);

/** Deterministic pseudo-random numbers for the bacteria (no Math.random during render). */
const rand = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const N = 64;
/** Where the bacteria gather in the spectrum: quantiles of the oxygen production along the alga. */
const GATHER = (() => {
  const steps: number[] = [];
  let sum = 0;
  for (let l = 400; l <= 700; l += 1) {
    const w = SPECTRA.action(l) ** 2.2;
    sum += w;
    steps.push(sum);
  }
  return Array.from({ length: N }, (_, i) => {
    const target = ((i + 0.5) / N) * sum;
    const idx = steps.findIndex((s) => s >= target);
    return 400 + idx;
  });
})();
const BACT = Array.from({ length: N }, (_, i) => ({
  even: 400 + rand(i, 1) * 300,
  gather: GATHER[i] + (rand(i, 2) - 0.5) * 6,
  side: rand(i, 3) < 0.5 ? -1 : 1,
  dy: 6 + rand(i, 4) * 16,
  rot: (rand(i, 5) - 0.5) * 70,
}));

const CURVES: { id: Pigment; label: Text; color: string; dash?: string; width: number }[] = [
  { id: "chlA", label: tx("chlorophyll a", "Chlorophyll a"), color: "var(--bio-leaf-deep)", width: 2.4 },
  { id: "chlB", label: tx("chlorophyll b", "Chlorophyll b"), color: "var(--bio-chloro)", dash: "7 4", width: 2.4 },
  { id: "car", label: tx("carotenoids", "Carotinoide"), color: "var(--bio-mito-deep)", dash: "2 4", width: 2.6 },
  { id: "action", label: tx("action spectrum", "Wirkungsspektrum"), color: "var(--blob)", width: 3.4 },
];

function curvePath(f: (l: number) => number, top: number, h: number) {
  const pts: string[] = [];
  for (let l = 400; l <= 700; l += 3) pts.push(`${pts.length ? "L" : "M"}${lx(l).toFixed(1)} ${(top + h - f(l) * h).toFixed(1)}`);
  return pts.join(" ");
}

/** The spectra on their own (also a task picture). */
export function PhotoSpectraGraph({ show = ["chlA", "chlB", "car"], cursor, labels = true }: { show?: Pigment[]; cursor?: number; labels?: boolean }) {
  const t = useText();
  const top = 14;
  const h = 150;
  return (
    <svg viewBox={`0 0 ${W} 206`} className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(tx("Absorption spectra and action spectrum", "Absorptionsspektren und Wirkungsspektrum"))}>
      <SpectrumAxes top={top} h={h} />
      {CURVES.filter((c) => show.includes(c.id)).map((c) => (
        <path key={c.id} d={curvePath(SPECTRA[c.id], top, h)} fill="none" stroke={c.color} strokeWidth={c.width} strokeDasharray={c.dash} strokeLinecap="round" />
      ))}
      {cursor !== undefined && <line x1={lx(cursor)} x2={lx(cursor)} y1={top} y2={top + h} stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="4 3" />}
      {labels && (
        <g>
          {CURVES.filter((c) => show.includes(c.id)).map((c, i) => (
            <g key={c.id} transform={`translate(${lx(526)} ${top + 14 + i * 16})`}>
              <line x1={0} x2={22} y1={0} y2={0} stroke={c.color} strokeWidth={c.width} strokeDasharray={c.dash} />
              <text x={28} y={4} fontSize={11.5} className="fill-ink-2">
                {t(c.label)}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function SpectrumAxes({ top, h }: { top: number; h: number }) {
  const t = useText();
  return (
    <g>
      <defs>
        <linearGradient id="photo-spectrum-band" x1="0" x2="1" y1="0" y2="0">
          {BAND.map(([l, c]) => (
            <stop key={l} offset={(l - 400) / 300} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      {[400, 450, 500, 550, 600, 650, 700].map((l) => (
        <g key={l}>
          <line x1={lx(l)} x2={lx(l)} y1={top} y2={top + h} stroke="var(--line)" strokeWidth={0.8} />
          <text x={lx(l)} y={top + h + 22} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
            {l}
          </text>
        </g>
      ))}
      <rect x={X0} y={top + h + 2} width={X1 - X0} height={7} rx={2} fill="url(#photo-spectrum-band)" />
      <line x1={X0} x2={X1} y1={top + h} y2={top + h} stroke="var(--ink-2)" strokeWidth={1.2} />
      <line x1={X0} x2={X0} y1={top - 4} y2={top + h} stroke="var(--ink-2)" strokeWidth={1.2} />
      <text x={X0 - 12} y={top + h / 2} fontSize={11} textAnchor="middle" transform={`rotate(-90 ${X0 - 12} ${top + h / 2})`} className="fill-ink-2">
        {t(tx("absorption / rate", "Absorption / Rate"))}
      </text>
      <text x={X1} y={top + h + 36} textAnchor="end" fontSize={11} className="fill-ink-2">
        {t(tx("wavelength in nm", "Wellenlänge in nm"))}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Engelmann's experiment

export function PhotoEngelmann() {
  const t = useText();
  const [prism, setPrism] = useState(true);
  const [show, setShow] = useState<Pigment[]>(["chlA", "action"]);
  const [cursor, setCursor] = useState(550);
  const near = BACT.filter((b) => Math.abs((prism ? b.gather : b.even) - cursor) <= 15).length;
  const toggle = (p: Pigment) => setShow((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const fy = 64; // filament axis
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(tx("Light", "Licht"))}>
        {[
          { on: true, label: tx("Light through a prism", "Licht durch ein Prisma") },
          { on: false, label: tx("White light", "Weißes Licht") },
        ].map((o) => (
          <button
            key={String(o.on)}
            type="button"
            aria-pressed={prism === o.on}
            onClick={() => setPrism(o.on)}
            className={cn("h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", prism === o.on ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(o.label)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-2">
        <svg viewBox={`0 0 ${W} 130`} className="block h-auto w-full" role="img" aria-label={t(tx("Green alga with bacteria in a spectrum", "Grünalge mit Bakterien im Spektrum"))}>
          <defs>
            <linearGradient id="photo-engelmann-light" x1="0" x2="1" y1="0" y2="0">
              {BAND.map(([l, c]) => (
                <stop key={l} offset={(l - 400) / 300} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
          <motion.rect x={X0 - 10} y={20} width={X1 - X0 + 20} height={92} rx={10} fill={prism ? "url(#photo-engelmann-light)" : "var(--bio-sun)"} initial={false} animate={{ opacity: prism ? 0.28 : 0.16 }} />
          {/* the alga filament: cylindrical cells with a net-like chloroplast */}
          <rect x={X0 - 6} y={fy - 14} width={X1 - X0 + 12} height={28} rx={14} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={X0 + 52 + i * 52} x2={X0 + 52 + i * 52} y1={fy - 14} y2={fy + 14} stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <path key={i} d={`M ${X0 + 4 + i * 52} ${fy} q 8 -9 16 0 t 16 0 t 14 0`} fill="none" stroke="var(--bio-chloro)" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
          ))}
          {BACT.map((b, i) => {
            const l = prism ? b.gather : b.even;
            return (
              <motion.ellipse
                key={i}
                rx={3.6}
                ry={1.7}
                fill="var(--bio-outline)"
                initial={false}
                animate={{ cx: lx(l), cy: fy + b.side * (14 + b.dy * 0.9), rotate: b.rot }}
                transition={{ type: "spring", stiffness: 40, damping: 12, delay: (i % 16) * 0.03 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            );
          })}
          <line x1={lx(cursor)} x2={lx(cursor)} y1={16} y2={116} stroke="var(--ink)" strokeWidth={1.4} strokeDasharray="4 3" />
        </svg>
        <PhotoSpectraGraph show={show} cursor={cursor} labels={false} />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(tx("Curves", "Kurven"))}>
        {CURVES.map((c) => {
          const on = show.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(c.id)}
              className={cn("flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors", on ? "border-ink/30 bg-raised text-ink" : "border-line text-ink-3 hover:bg-hover")}
            >
              <svg viewBox="0 0 24 6" className="h-1.5 w-6" aria-hidden>
                <line x1={0} x2={24} y1={3} y2={3} stroke={c.color} strokeWidth={c.width} strokeDasharray={c.dash} opacity={on ? 1 : 0.4} />
              </svg>
              {t(c.label)}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="flex items-baseline justify-between text-[13.5px]">
          <span className="font-medium text-ink-2">{t(tx("Wavelength", "Wellenlänge"))}</span>
          <span className="font-math text-[17px] tabular-nums text-ink">{cursor} nm</span>
        </span>
        <input type="range" min={400} max={700} step={5} value={cursor} onChange={(e) => setCursor(Number(e.target.value))} className="h-9 w-full cursor-pointer accent-[var(--blob)]" />
      </label>

      <p className="rounded-xl bg-blob-soft/70 px-4 py-3 text-[14.5px] leading-relaxed text-ink" aria-live="polite">
        {t(
          prism
            ? tx(
                `Around ${cursor} nm: ${near} bacteria. They crowd where the alga releases most oxygen: in blue and in red light. In green light there are few, because chlorophyll absorbs little green.`,
                `Um ${cursor} nm: ${near} Bakterien. Sie drängen sich dort, wo die Alge am meisten Sauerstoff abgibt: im blauen und im roten Licht. Im grünen Licht sind es wenige, weil Chlorophyll kaum grünes Licht absorbiert.`,
              )
            : tx(
                "In white light the alga makes oxygen along its whole length, so the bacteria spread out evenly.",
                "Im weißen Licht gibt die Alge auf ihrer ganzen Länge Sauerstoff ab, die Bakterien verteilen sich gleichmäßig.",
              ),
        )}
      </p>
    </div>
  );
}
