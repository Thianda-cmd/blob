"use client";

// Graphs for the enzyme topic, drawn like in the exercise book: a grid, axes with arrows and
// labels, smooth curves. Chart is the frame; the static graphs below are task pictures:
// activity over temperature, activity over pH, rate over substrate concentration (Michaelis-
// Menten) and a table of measured values.

import type { ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { mm, phActivity, tempActivity } from "@/learn/biology/topics/enzymes/data";
import { cn } from "@/lib/utils";

export type Axis = { min: number; max: number; step: number; minor?: number; label: Text; ticks?: boolean };
export type Scales = { px: (x: number) => number; py: (y: number) => number; x0: number; x1: number; y0: number; y1: number };

const r1 = (v: number) => Math.round(v * 10) / 10;

/** A graph frame: grid, axes, tick labels and axis titles. `children` draws the content. */
export function Chart({
  x,
  y,
  width = 420,
  height = 270,
  label,
  className,
  children,
}: {
  x: Axis;
  y: Axis;
  width?: number;
  height?: number;
  label: Text;
  className?: string;
  children?: (s: Scales) => ReactNode;
}) {
  const t = useText();
  const locale = useLocale();
  const M = { l: 44, r: 18, t: 30, b: 40 };
  const x0 = M.l;
  const x1 = width - M.r;
  const y0 = height - M.b;
  const y1 = M.t;
  const px = (v: number) => r1(x0 + ((v - x.min) / (x.max - x.min)) * (x1 - x0));
  const py = (v: number) => r1(y0 - ((v - y.min) / (y.max - y.min)) * (y0 - y1));
  const ticks = (a: Axis, step: number) => {
    const out: number[] = [];
    for (let v = a.min; v <= a.max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  const showX = x.ticks !== false;
  const showY = y.ticks !== false;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("mx-auto block h-auto w-full", className)} style={{ maxWidth: 560 }} role="img" aria-label={t(label)}>
      {x.minor && ticks(x, x.minor).map((v) => <line key={`xm${v}`} x1={px(v)} x2={px(v)} y1={y1} y2={y0} stroke="var(--line)" strokeWidth={0.6} />)}
      {y.minor && ticks(y, y.minor).map((v) => <line key={`ym${v}`} x1={x0} x2={x1} y1={py(v)} y2={py(v)} stroke="var(--line)" strokeWidth={0.6} />)}
      {ticks(x, x.step).map((v) => (
        <g key={`x${v}`}>
          <line x1={px(v)} x2={px(v)} y1={y1} y2={y0} stroke="var(--line-2)" strokeWidth={0.9} />
          {showX && (
            <text x={px(v)} y={y0 + 16} textAnchor="middle" fontSize={11.5} fill="var(--ink-3)" className="tabular-nums" style={{ fontFamily: "var(--font-sans)" }}>
              {dec(v, locale)}
            </text>
          )}
        </g>
      ))}
      {ticks(y, y.step).map((v) => (
        <g key={`y${v}`}>
          <line x1={x0} x2={x1} y1={py(v)} y2={py(v)} stroke="var(--line-2)" strokeWidth={0.9} />
          {showY && (
            <text x={x0 - 7} y={py(v) + 4} textAnchor="end" fontSize={11.5} fill="var(--ink-3)" className="tabular-nums" style={{ fontFamily: "var(--font-sans)" }}>
              {dec(v, locale)}
            </text>
          )}
        </g>
      ))}
      <g stroke="var(--ink-2)" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${x0} ${y0} L ${x0} ${y1 - 12}`} />
        <path d={`M ${x0 - 4} ${y1 - 6} L ${x0} ${y1 - 12} L ${x0 + 4} ${y1 - 6}`} />
        <path d={`M ${x0} ${y0} L ${x1 + 10} ${y0}`} />
        <path d={`M ${x1 + 4} ${y0 - 4} L ${x1 + 10} ${y0} L ${x1 + 4} ${y0 + 4}`} />
      </g>
      <text x={x0 + 8} y={y1 - 14} fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(y.label)}
      </text>
      <text x={x1 + 8} y={height - 6} textAnchor="end" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(x.label)}
      </text>
      {children?.({ px, py, x0, x1, y0, y1 })}
    </svg>
  );
}

/** Sampled path of y = f(x) between a and b. */
export function curvePath(f: (x: number) => number, a: number, b: number, s: Scales, steps = 160) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const xv = a + ((b - a) * i) / steps;
    d += `${i ? "L" : "M"} ${s.px(xv)} ${s.py(f(xv))} `;
  }
  return d.trim();
}

/** A round number badge on a curve. */
export function Badge({ x, y, text, accent }: { x: number; y: number; text: string; accent?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10.5} fill={accent ? "var(--blob)" : "var(--raised)"} stroke={accent ? "var(--blob)" : "var(--ink)"} strokeWidth={1.5} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={accent ? "#fff" : "var(--ink)"} style={{ fontFamily: "var(--font-sans)" }}>
        {text}
      </text>
    </g>
  );
}

export const ACTIVITY: Text = tx("activity in %", "Aktivität in %");
export const TEMP_AXIS: Text = tx("temperature in °C", "Temperatur in °C");
export const PH_AXIS: Text = tx("pH", "pH-Wert");
export const S_AXIS: Text = tx("[S] in mmol/L", "[S] in mmol/l");
export const V_AXIS: Text = tx("v in µmol/(L·min)", "v in µmol/(l·min)");

/** Activity over temperature for one or more enzymes (task picture). */
export function EnzymeTempGraph({ curves, xMax = 80 }: { curves: { opt: number; label?: string }[]; xMax?: number }) {
  return (
    <Chart
      x={{ min: 0, max: xMax, step: 10, minor: 5, label: TEMP_AXIS }}
      y={{ min: 0, max: 100, step: 20, minor: 10, label: ACTIVITY }}
      label={tx("Graph: enzyme activity against temperature", "Diagramm: Enzymaktivität in Abhängigkeit von der Temperatur")}
    >
      {(s) =>
        curves.map((c, i) => (
          <g key={i}>
            <path d={curvePath((x) => 100 * tempActivity(x, c.opt), 0, xMax, s)} fill="none" stroke={i ? "var(--bio-water-deep)" : "var(--blob)"} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
            {c.label && <Badge x={s.px(c.opt)} y={s.py(100) - 14} text={c.label} />}
          </g>
        ))
      }
    </Chart>
  );
}

/** Activity over pH for several enzymes, numbered (task picture). */
export function EnzymePhGraph({ curves }: { curves: { opt: number; width: number; label?: string }[] }) {
  return (
    <Chart
      x={{ min: 0, max: 14, step: 1, label: PH_AXIS }}
      y={{ min: 0, max: 100, step: 20, minor: 10, label: ACTIVITY }}
      label={tx("Graph: enzyme activity against pH", "Diagramm: Enzymaktivität in Abhängigkeit vom pH-Wert")}
    >
      {(s) =>
        curves.map((c, i) => (
          <g key={i}>
            <path d={curvePath((x) => 100 * phActivity(x, c.opt, c.width), 0, 14, s)} fill="none" stroke={["var(--blob)", "var(--bio-water-deep)", "var(--bio-mito-deep)", "var(--bio-leaf-deep)"][i % 4]} strokeWidth={2.8} strokeLinecap="round" />
            {c.label && <Badge x={s.px(c.opt)} y={s.py(100) - 14} text={c.label} />}
          </g>
        ))
      }
    </Chart>
  );
}

export type MMCurve = { vmax: number; km: number; label?: string; dashed?: boolean };

/** Rate over substrate concentration (Michaelis-Menten), optionally with the vmax line (task picture). */
export function EnzymeMMGraph({
  curves,
  xMax,
  xStep,
  yMax,
  yStep,
  asymptote,
  bare,
}: {
  curves: MMCurve[];
  xMax: number;
  xStep: number;
  yMax: number;
  yStep: number;
  /** Draw a dashed line at this rate (vmax). */
  asymptote?: number;
  /** No numbers on the axes (for "what happens" graphs). */
  bare?: boolean;
}) {
  return (
    <Chart
      x={{ min: 0, max: xMax, step: xStep, minor: xStep / 2, label: bare ? tx("substrate concentration", "Substratkonzentration") : S_AXIS, ticks: !bare }}
      y={{ min: 0, max: yMax, step: yStep, minor: yStep / 2, label: bare ? tx("reaction rate", "Reaktionsgeschwindigkeit") : V_AXIS, ticks: !bare }}
      label={tx("Graph: reaction rate against substrate concentration", "Diagramm: Reaktionsgeschwindigkeit in Abhängigkeit von der Substratkonzentration")}
    >
      {(s) => (
        <>
          {asymptote !== undefined && <path d={`M ${s.x0} ${s.py(asymptote)} L ${s.x1} ${s.py(asymptote)}`} stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="6 5" />}
          {curves.map((c, i) => (
            <g key={i}>
              <path
                d={curvePath((x) => mm(x, c.vmax, c.km), 0, xMax, s)}
                fill="none"
                stroke={i ? "var(--bio-water-deep)" : "var(--blob)"}
                strokeWidth={2.8}
                strokeDasharray={c.dashed ? "8 6" : undefined}
                strokeLinecap="round"
              />
              {c.label && <Badge x={s.x1 - 14} y={s.py(mm(xMax, c.vmax, c.km)) + (i ? 18 : -18)} text={c.label} />}
            </g>
          ))}
        </>
      )}
    </Chart>
  );
}

/** A table of measured values (task picture). */
export function EnzymeTable({ head, rows, caption, digits = [2, 1] }: { head: [Text, Text]; rows: [number, number][]; caption?: Text; digits?: [number, number] }) {
  const t = useText();
  const locale = useLocale();
  return (
    <div className="mx-auto max-w-[520px] overflow-x-auto">
      <table className="w-full border-collapse text-center text-[14px] tabular-nums">
        <tbody>
          <tr className="border-b border-line-2">
            <th className="whitespace-nowrap px-2 py-1.5 text-left text-[13px] font-semibold text-ink-2">{t(head[0])}</th>
            {rows.map(([a], i) => (
              <td key={i} className="px-2 py-1.5 text-ink">
                {dec(a, locale, digits[0])}
              </td>
            ))}
          </tr>
          <tr>
            <th className="whitespace-nowrap px-2 py-1.5 text-left text-[13px] font-semibold text-ink-2">{t(head[1])}</th>
            {rows.map(([, b], i) => (
              <td key={i} className="px-2 py-1.5 text-ink">
                {dec(b, locale, digits[1])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {caption && <p className="mt-2 text-center text-[12.5px] text-ink-3">{t(caption)}</p>}
    </div>
  );
}
