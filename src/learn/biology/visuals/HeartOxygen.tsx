"use client";

// The oxygen dissociation curve (level 3): saturation of haemoglobin over the partial pressure
// of oxygen. Sigmoid for haemoglobin (cooperative binding), hyperbolic for myoglobin, shifted
// left for fetal haemoglobin. The CO2/pH slider shows the Bohr effect.

import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";
import { Chip, Slider, svgText } from "./HeartShared";

// ---------------------------------------------------------------------------
// Model (Hill equation)

export type CurveKind = "adult" | "fetal" | "myo";
/** Half-saturation pressure P50 in mmHg; the Bohr effect shifts it with pH (log P50 changes by −0.48 per pH unit). */
export function p50(kind: CurveKind, pH = 7.4) {
  if (kind === "myo") return 2.8;
  const base = kind === "fetal" ? 19 : 26.8;
  return base * Math.pow(10, -0.48 * (pH - 7.4));
}
/** Oxygen saturation in % at pO2 (mmHg). */
export function saturation(pO2: number, kind: CurveKind = "adult", pH = 7.4) {
  const n = kind === "myo" ? 1 : 2.7;
  const p = Math.max(0, pO2);
  return (100 * Math.pow(p, n)) / (Math.pow(p, n) + Math.pow(p50(kind, pH), n));
}
/** CO2 partial pressure (mmHg) that goes with a pH (bicarbonate 24 mmol/l, Henderson-Hasselbalch). */
export const pco2For = (pH: number) => 24 / (0.03 * Math.pow(10, pH - 6.1));

// ---------------------------------------------------------------------------
// Chart

const W = 440;
const H = 300;
const M = { l: 46, r: 14, t: 18, b: 42 };
const px = (p: number) => M.l + (p / 100) * (W - M.l - M.r);
const py = (s: number) => H - M.b - (s / 100) * (H - M.t - M.b);

export type CurveSpec = { kind: CurveKind; pH?: number; color?: string; dashed?: boolean; label?: Text | string; width?: number };

function curvePath(c: CurveSpec) {
  let d = "";
  for (let i = 0; i <= 100; i++) {
    const p = i;
    d += `${i ? "L" : "M"}${px(p).toFixed(1)} ${py(saturation(p, c.kind, c.pH)).toFixed(1)} `;
  }
  return d;
}

const COLORS: Record<CurveKind, string> = { adult: "var(--bio-blood)", fetal: "var(--bio-petal-deep)", myo: "var(--bio-mito-deep)" };

export function HeartO2Chart({
  curves,
  markers = [],
  read,
  className,
}: {
  curves: CurveSpec[];
  /** Vertical lines at these pO2 values (mmHg), optionally named. */
  markers?: { p: number; label?: Text }[];
  /** Guide lines from pO2 up to the first curve and across to the axis. */
  read?: number;
  className?: string;
}) {
  const t = useText();
  const locale = useLocale();
  const first = curves[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full", className)} role="img" aria-label={t(tx("Oxygen dissociation curve: saturation over oxygen partial pressure", "Sauerstoffbindungskurve: Sättigung über dem Sauerstoffpartialdruck"))} style={svgText}>
      {Array.from({ length: 11 }, (_, i) => i * 10).map((v) => (
        <g key={v}>
          <line x1={px(v)} x2={px(v)} y1={py(0)} y2={py(100)} stroke="var(--line)" strokeWidth={v % 20 === 0 ? 1 : 0.6} />
          <line x1={px(0)} x2={px(100)} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth={v % 20 === 0 ? 1 : 0.6} />
          {v % 20 === 0 && (
            <>
              <text x={px(v)} y={H - M.b + 15} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                {v}
              </text>
              <text x={M.l - 6} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
                {v}
              </text>
            </>
          )}
        </g>
      ))}
      <line x1={px(0)} x2={px(100) + 4} y1={py(0)} y2={py(0)} stroke="var(--ink-2)" strokeWidth={1.3} />
      <line x1={px(0)} x2={px(0)} y1={py(0)} y2={py(100) - 6} stroke="var(--ink-2)" strokeWidth={1.3} />
      <text x={px(100)} y={H - 6} textAnchor="end" fontSize={11.5} fill="var(--ink-2)">
        {t(tx("O₂ partial pressure in mmHg", "O₂-Partialdruck in mmHg"))}
      </text>
      <text x={8} y={12} fontSize={11.5} fill="var(--ink-2)">
        {t(tx("O₂ saturation in %", "O₂-Sättigung in %"))}
      </text>
      {markers.map((m) => (
        <g key={m.p}>
          <line x1={px(m.p)} x2={px(m.p)} y1={py(0)} y2={py(100)} stroke="var(--ink-2)" strokeWidth={1.2} strokeDasharray="4 4" />
          {m.label && (
            <text x={px(m.p) - 4} y={py(4)} textAnchor="end" fontSize={10.5} fill="var(--ink-2)" stroke="var(--raised)" strokeWidth={3} paintOrder="stroke">
              {t(m.label)}
            </text>
          )}
        </g>
      ))}
      {curves.map((c, i) => (
        <path key={i} d={curvePath(c)} fill="none" stroke={c.color ?? COLORS[c.kind]} strokeWidth={c.width ?? 3} strokeDasharray={c.dashed ? "6 5" : undefined} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {curves.map((c, i) => {
        if (!c.label) return null;
        const p = c.kind === "myo" ? 12 : c.kind === "fetal" ? 24 : 46;
        const s = saturation(p, c.kind, c.pH);
        return (
          <text key={`l${i}`} x={px(p) + (c.kind === "adult" ? 8 : -6)} y={py(s) + (c.kind === "adult" ? 14 : -6)} textAnchor={c.kind === "adult" ? "start" : "end"} fontSize={12} fontWeight={700} fill={c.color ?? COLORS[c.kind]} stroke="var(--raised)" strokeWidth={3.5} paintOrder="stroke">
            {typeof c.label === "string" ? c.label : t(c.label)}
          </text>
        );
      })}
      {read !== undefined && first && (
        <g>
          <path d={`M${px(read)} ${py(0)} L${px(read)} ${py(saturation(read, first.kind, first.pH))} L${px(0)} ${py(saturation(read, first.kind, first.pH))}`} fill="none" stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="5 4" />
          <circle cx={px(read)} cy={py(saturation(read, first.kind, first.pH))} r={5} fill="var(--raised)" stroke="var(--blob)" strokeWidth={2.5} />
          <text x={px(0) + 4} y={py(saturation(read, first.kind, first.pH)) - 5} fontSize={11} fontWeight={700} fill="var(--blob-ink)">
            {dec(Math.round(saturation(read, first.kind, first.pH)), locale)} %
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Widget

export function HeartOxygenWidget() {
  const t = useText();
  const locale = useLocale();
  const [pH, setPH] = useState(7.4);
  const [fetal, setFetal] = useState(false);
  const [myo, setMyo] = useState(false);
  const [work, setWork] = useState(false);
  const tissue = work ? 20 : 40;
  const lung = saturation(100, "adult", pH);
  const tis = saturation(tissue, "adult", pH);
  const shifted = Math.abs(pH - 7.4) > 0.01;
  const curves: CurveSpec[] = [
    ...(shifted ? [{ kind: "adult" as const, pH: 7.4, color: "var(--ink-3)", dashed: true, width: 2 }] : []),
    ...(fetal ? [{ kind: "fetal" as const, label: tx("fetal Hb", "fetales Hb") }] : []),
    ...(myo ? [{ kind: "myo" as const, label: tx("myoglobin", "Myoglobin") }] : []),
    { kind: "adult", pH, label: "Hb" },
  ];
  const mood: Text =
    pH < 7.37
      ? tx("More CO₂, lower pH (like in a working muscle): the curve shifts to the right. Haemoglobin binds O₂ less tightly and releases more of it.", "Mehr CO₂, niedrigerer pH-Wert (wie im arbeitenden Muskel): Die Kurve verschiebt sich nach rechts. Hämoglobin bindet O₂ schwächer und gibt mehr davon ab.")
      : pH > 7.43
        ? tx("Less CO₂, higher pH (like in the lungs): the curve shifts to the left. Haemoglobin binds O₂ more tightly.", "Weniger CO₂, höherer pH-Wert (wie in der Lunge): Die Kurve verschiebt sich nach links. Hämoglobin bindet O₂ stärker.")
        : tx("Normal blood: pH 7.4. Move the slider to see the Bohr effect.", "Normales Blut: pH 7,4. Verschieb den Regler, um den Bohr-Effekt zu sehen.");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-surface p-2">
          <HeartO2Chart
            curves={curves}
            markers={[
              { p: 100, label: tx("lungs", "Lunge") },
              { p: tissue, label: work ? tx("working muscle", "Muskel bei Arbeit") : tx("tissue at rest", "Gewebe in Ruhe") },
            ]}
          />
        </div>
        <div className="space-y-3">
          <Slider
            label={t(tx("CO₂ in the blood", "CO₂ im Blut"))}
            value={7.8 - pH}
            min={0.2}
            max={0.6}
            step={0.01}
            onChange={(v) => setPH(Math.round((7.8 - v) * 100) / 100)}
            display={`pH ${dec(pH, locale, 2)}`}
          />
          <div className="-mt-1 flex justify-between text-[11.5px] text-ink-3">
            <span>{t(tx("little CO₂", "wenig CO₂"))}</span>
            <span>
              pCO₂ ≈ {dec(Math.round(pco2For(pH)), locale)} mmHg
            </span>
            <span>{t(tx("much CO₂", "viel CO₂"))}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface px-2 py-2">
              <div className="text-[11.5px] text-ink-3">{t(tx("lungs", "Lunge"))}</div>
              <div className="font-math text-[18px] tabular-nums text-ink">{dec(Math.round(lung), locale)} %</div>
            </div>
            <div className="rounded-lg bg-surface px-2 py-2">
              <div className="text-[11.5px] text-ink-3">{work ? t(tx("muscle", "Muskel")) : t(tx("tissue", "Gewebe"))}</div>
              <div className="font-math text-[18px] tabular-nums text-ink">{dec(Math.round(tis), locale)} %</div>
            </div>
            <div className="rounded-lg bg-blob-soft px-2 py-2">
              <div className="text-[11.5px] text-blob-ink">{t(tx("released", "abgegeben"))}</div>
              <div className="font-math text-[18px] font-semibold tabular-nums text-blob-ink">{dec(Math.round(lung - tis), locale)} %</div>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
            {t(mood)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip on={work} onClick={() => setWork((w) => !w)}>
              {t(tx("Muscle at work (20 mmHg)", "Muskel arbeitet (20 mmHg)"))}
            </Chip>
            <Chip on={fetal} onClick={() => setFetal((f) => !f)}>
              {t(tx("Fetal haemoglobin", "Fetales Hämoglobin"))}
            </Chip>
            <Chip on={myo} onClick={() => setMyo((m) => !m)}>
              {t(tx("Myoglobin", "Myoglobin"))}
            </Chip>
          </div>
        </div>
      </div>
    </div>
  );
}
