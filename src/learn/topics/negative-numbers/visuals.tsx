"use client";

import { type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { AxisLine, Brace, makeAxis, signed, toneColor, type Tone } from "./ui";

// ---------------------------------------------------------------------------
// A thermometer in °C, optionally with a change from one temperature to another.

export function NegThermometer({
  value,
  from,
  min = -10,
  max = 10,
  caption,
}: {
  value: number;
  /** Start temperature of a change (drawn as an arrow to `value`). */
  from?: number;
  min?: number;
  max?: number;
  caption?: Text;
}) {
  const tt = useText();
  const top = 26;
  const height = 220;
  const k = height / (max - min);
  const y = (v: number) => top + (max - v) * k;
  const cx = 92;
  const bulbY = top + height + 26;
  const every = max - min > 24 ? 5 : 2;
  const ticks: number[] = [];
  for (let v = min; v <= max; v++) ticks.push(v);
  const change = from === undefined ? null : value - from;
  const arrowX = cx + 74;
  return (
    <figure className="mx-auto flex max-w-[420px] flex-col items-center gap-2">
      <svg viewBox="0 0 280 300" className="w-full max-w-[300px]" role="img" aria-label={`${signed(value)} °C`}>
        {/* tube and bulb */}
        <rect x={cx - 11} y={top - 14} width={22} height={height + 30} rx={11} fill="var(--surface)" stroke="var(--line-2)" strokeWidth={2} />
        <circle cx={cx} cy={bulbY} r={19} fill="var(--danger)" stroke="var(--line-2)" strokeWidth={2} />
        <rect x={cx - 5} y={y(value)} width={10} height={bulbY - y(value)} rx={5} fill="var(--danger)" />
        {/* scale */}
        {ticks.map((v) => {
          const big = v === 0;
          const labelled = v % every === 0;
          return (
            <g key={v}>
              <line x1={cx + 14} x2={cx + 14 + (big ? 16 : labelled ? 11 : 6)} y1={y(v)} y2={y(v)} stroke={big ? "var(--ink)" : "var(--ink-3)"} strokeWidth={big ? 2 : 1} />
              {labelled && (
                <text x={cx - 20} y={y(v) + 5} textAnchor="end" fill={big ? "var(--ink)" : "var(--ink-2)"} fontWeight={big ? 700 : 400} className="font-math text-[14px]">
                  {signed(v)}
                </text>
              )}
            </g>
          );
        })}
        <text x={cx - 20} y={top - 20} textAnchor="end" fill="var(--ink-3)" className="font-math text-[13px]">
          °C
        </text>
        {/* zero line across */}
        <line x1={cx - 52} x2={cx + 40} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 4" />
        {/* the change */}
        {change !== null && from !== undefined && (
          <g>
            <circle cx={cx + 30} cy={y(from)} r={4.5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={2} />
            <path
              d={`M${cx + 36} ${y(from)} C${arrowX} ${y(from)}, ${arrowX} ${y(value)}, ${cx + 38} ${y(value)}`}
              fill="none"
              stroke="var(--blob)"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <path
              d={`M${cx + 46} ${y(value) - 5} L${cx + 38} ${y(value)} L${cx + 46} ${y(value) + 5}`}
              fill="none"
              stroke="var(--blob)"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={arrowX + 8} y={(y(from) + y(value)) / 2 + 6} fill="var(--blob)" fontWeight={700} className="font-math text-[19px]">
              {change > 0 ? `+${change}` : signed(change)}
            </text>
            <text x={cx + 40} y={y(from) + (from < value ? 20 : -10)} fill="var(--ink-2)" className="font-math text-[13px]">
              {signed(from)} °C
            </text>
          </g>
        )}
        {/* the reading */}
        <g>
          <circle cx={cx} cy={y(value)} r={6} fill="var(--danger)" stroke="var(--raised)" strokeWidth={2} />
          <text x={change === null ? cx + 40 : cx + 40} y={y(value) + (change !== null && from !== undefined && from > value ? 22 : -10)} fill="var(--ink)" fontWeight={700} className="font-math text-[17px]">
            {signed(value)} °C
          </text>
        </g>
      </svg>
      {caption && (
        <figcaption className="text-center text-[14px] text-ink-2">
          <Inline text={tt(caption)} />
        </figcaption>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// A static number line with marked points, braces and hops.

export type LineMark = { at: number; label?: string; tone?: Tone; hollow?: boolean };
export type LineBrace = { a: number; b: number; label: string; tone?: Tone; below?: boolean };

export function NegLineFigure({
  from = -10,
  to = 10,
  step = 1,
  labels,
  marks = [],
  braces = [],
  caption,
}: {
  from?: number;
  to?: number;
  step?: number;
  /** Only these numbers are written under the line (default: all, thinned out on phones). */
  labels?: number[];
  marks?: LineMark[];
  braces?: LineBrace[];
  caption?: Text;
}) {
  const tt = useText();
  const ticks = (to - from) / step;
  const ax = makeAxis(from, to, 440 / (to - from), 22);
  const hasAbove = braces.some((b) => !b.below) || marks.some((m) => m.label);
  const hasBelow = braces.some((b) => b.below);
  const y = hasAbove ? 70 : 34;
  const h = y + (hasBelow ? 90 : 46);
  return (
    <figure className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-1">
      <svg viewBox={`0 0 ${ax.width} ${h}`} className="w-full overflow-visible" role="img" aria-label={marks.map((m) => `${m.label ?? ""} ${signed(m.at)}`).join(", ")}>
        <AxisLine ax={ax} y={y} step={step} labels={labels} labelEvery={ticks > 24 ? 5 : 1} phoneEvery={ticks > 24 ? 1 : 2} />
        {braces.map((b, i) => (
          <Brace key={`b${i}`} x1={ax.x(b.a)} x2={ax.x(b.b)} y={b.below ? y + 34 : y - 14} label={b.label} tone={b.tone} up={!b.below} />
        ))}
        {marks.map((m, i) => {
          const color = toneColor(m.tone ?? "blob");
          return (
            <g key={`m${i}`} transform={`translate(${ax.x(m.at)} 0)`}>
              <circle cy={y} r={7.5} fill={m.hollow ? "var(--raised)" : color} stroke={color} strokeWidth={2.5} />
              {m.label && (
                <text y={y - 18} textAnchor="middle" fill={color} fontWeight={700} className="font-math text-[17px] max-sm:text-[21px]">
                  {m.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {caption && (
        <figcaption className="text-center text-[14px] text-ink-2">
          <Inline text={tt(caption)} />
        </figcaption>
      )}
    </figure>
  );
}
