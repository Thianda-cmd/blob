"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Small controls shared by the widgets of this topic.

/** "−3" with a real minus sign, for labels outside the display language. */
export const signed = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));

/** A − value + stepper with a label. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  show = signed,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  show?: (v: number) => string;
}) {
  const t = useText();
  const name = typeof label === "string" ? label : "";
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[13px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Decrease ${name}`, `${name} verkleinern`))}
      >
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-8 text-center font-math text-[19px] tabular-nums">
        {show(value)}
      </motion.span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        aria-label={t(tx(`Increase ${name}`, `${name} vergrößern`))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** A row of mutually exclusive buttons with a sliding highlight. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: ReactNode; aria?: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  size?: "md" | "lg";
}) {
  const scope = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-md font-medium",
            size === "lg" ? "min-w-11 px-3 py-1 font-math text-[20px]" : "px-3 py-1.5 text-[13px]",
            o.value === value ? (size === "lg" ? "text-white" : "text-ink") : "text-ink-3 hover:text-ink",
          )}
        >
          {o.value === value && (
            <motion.span
              layoutId={`${scope}-pill`}
              className={cn("absolute inset-0 rounded-md", size === "lg" ? "bg-blob" : "bg-hover")}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** A small caption line inside a widget. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-ink-3">{children}</p>;
}

// ---------------------------------------------------------------------------
// The number line: geometry, axis drawing and draggable points.

export type Axis = { from: number; to: number; unit: number; pad: number; width: number; x: (v: number) => number };

/** Geometry of a horizontal number line from `from` to `to`, `unit` SVG units per step. */
export function makeAxis(from: number, to: number, unit = 22, pad = 22): Axis {
  return { from, to, unit, pad, width: pad * 2 + (to - from) * unit, x: (v) => pad + (v - from) * unit };
}

/**
 * The line with ticks and numbers. `labelEvery` numbers get a label on every screen; on phones
 * only every `phoneEvery`-th label stays so they don't crowd.
 */
export function AxisLine({
  ax,
  y,
  step = 1,
  labelEvery = 1,
  phoneEvery = 2,
  labels,
}: {
  ax: Axis;
  y: number;
  step?: number;
  labelEvery?: number;
  phoneEvery?: number;
  /** Only these values get a number (for "read the number line" tasks). */
  labels?: number[];
}) {
  const ticks: number[] = [];
  for (let v = ax.from; v <= ax.to + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  const x0 = ax.x(ax.from) - ax.pad * 0.7;
  const x1 = ax.x(ax.to) + ax.pad * 0.8;
  return (
    <g>
      <line x1={x0} x2={x1} y1={y} y2={y} stroke="var(--ink-3)" strokeWidth={1.4} strokeLinecap="round" />
      <path d={`M${x1 - 7} ${y - 5} L${x1} ${y} L${x1 - 7} ${y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {ticks.map((v) => {
        const big = v === 0;
        const shown = labels ? labels.includes(v) : Math.round(v / step) % labelEvery === 0;
        const onPhone = labels ? true : v === 0 || Math.round(v / step) % (labelEvery * phoneEvery) === 0;
        return (
          <g key={v}>
            <line x1={ax.x(v)} x2={ax.x(v)} y1={y - (big ? 9 : 6)} y2={y + (big ? 9 : 6)} stroke={big ? "var(--ink-2)" : "var(--ink-3)"} strokeWidth={big ? 1.8 : 1.1} />
            {shown && (
              <text
                x={ax.x(v)}
                y={y + 26}
                textAnchor="middle"
                fill={big ? "var(--ink)" : "var(--ink-2)"}
                className={cn("font-math text-[14px] max-sm:text-[19px]", !onPhone && "max-sm:hidden")}
                fontWeight={big ? 600 : 400}
              >
                {signed(v)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

const TONE = { blob: "var(--blob)", ink: "var(--ink)", ok: "var(--ok)", danger: "var(--danger)" } as const;
export type Tone = keyof typeof TONE;
export const toneColor = (t: Tone) => TONE[t];

/** Converts a pointer position to the nearest whole value on the axis. */
function valueAt(e: React.PointerEvent<SVGGElement>, ax: Axis, min: number, max: number) {
  const svg = e.currentTarget.ownerSVGElement;
  const ctm = svg?.getScreenCTM();
  if (!svg || !ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const v = Math.round(ax.from + (p.x - ax.pad) / ax.unit);
  return Math.min(max, Math.max(min, v));
}

/** A point on the number line you can drag (mouse, touch) or move with the arrow keys. */
export function DragPoint({
  ax,
  y,
  value,
  onChange,
  label,
  name,
  tone = "blob",
  min = ax.from,
  max = ax.to,
  above = true,
}: {
  ax: Axis;
  y: number;
  value: number;
  onChange: (v: number) => void;
  /** Letter drawn next to the point ("a"). */
  label: string;
  /** Accessible name ("Point a"). */
  name: Text;
  tone?: Tone;
  min?: number;
  max?: number;
  above?: boolean;
}) {
  const t = useText();
  const [drag, setDrag] = useState(false);
  const [focus, setFocus] = useState(false);
  const color = TONE[tone];
  return (
    <motion.g
      initial={false}
      animate={{ x: ax.x(value) }}
      transition={drag ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
      role="slider"
      tabIndex={0}
      aria-label={t(name)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={signed(value)}
      className="cursor-grab outline-none active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onKeyDown={(e) => {
        const by = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
        if (by) {
          e.preventDefault();
          onChange(Math.min(max, Math.max(min, value + by)));
        } else if (e.key === "Home") onChange(min);
        else if (e.key === "End") onChange(max);
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const v = valueAt(e, ax, min, max);
        if (v !== null && v !== value) onChange(v);
      }}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
    >
      <circle cy={y} r={22} fill={color} opacity={drag ? 0.16 : 0.07} />
      {focus && <circle cy={y} r={14} fill="none" stroke={color} strokeWidth={2} opacity={0.6} />}
      <circle cy={y} r={drag ? 10 : 8.5} fill={color} stroke="var(--raised)" strokeWidth={2.5} />
      <text y={above ? y - 20 : y + 46} textAnchor="middle" fill={color} className="font-math text-[17px] italic max-sm:text-[21px]" fontWeight={600}>
        {label}
      </text>
    </motion.g>
  );
}

/** A curly-ish bracket between two points on the line with a label (distances, changes). */
export function Brace({ x1, x2, y, label, tone = "blob", up = true }: { x1: number; x2: number; y: number; label: ReactNode; tone?: Tone; up?: boolean }) {
  const color = TONE[tone];
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  const h = up ? -9 : 9;
  const mid = (a + b) / 2;
  const d = `M${a} ${y} q0 ${h} 6 ${h} L${mid - 6} ${y + h} q6 0 6 ${h} q0 ${-h} 6 ${-h} L${b - 6} ${y + h} q6 0 6 ${-h}`;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.path initial={false} animate={{ d }} transition={{ type: "spring", stiffness: 300, damping: 30 }} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <motion.text initial={false} animate={{ x: mid, y: up ? y + 2 * h - 6 : y + 2 * h + 20 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} textAnchor="middle" fill={color} className="font-math text-[15px] max-sm:text-[19px]" fontWeight={600}>
        {label}
      </motion.text>
    </motion.g>
  );
}

// ---------------------------------------------------------------------------
// Blob, small, for walking along the number line.

const BLOB_PATH = "M16 4.5c6.6 0 11.3 4.9 11.6 11.4.2 5-2.6 9.1-6.8 10.4-3 .9-6.6.9-9.6 0C7 25 4.2 20.9 4.4 15.9 4.7 9.4 9.4 4.5 16 4.5Z";

/** Blob drawn at the origin (feet at y = 0), looking left or right. */
export function MiniBlob({ look, scale = 1.25 }: { look: "left" | "right"; scale?: number }) {
  const id = useId().replace(/:/g, "");
  const dx = look === "right" ? 2.2 : -2.2;
  return (
    <g transform={`scale(${scale}) translate(-16 -27)`}>
      <defs>
        <radialGradient id={`nb-${id}`} cx="36%" cy="28%" r="80%">
          <stop offset="0%" style={{ stopColor: "var(--blob-light)" }} />
          <stop offset="45%" style={{ stopColor: "var(--blob)" }} />
          <stop offset="100%" style={{ stopColor: "var(--blob-deep)" }} />
        </radialGradient>
      </defs>
      <path d={BLOB_PATH} fill={`url(#nb-${id})`} />
      <motion.g initial={false} animate={{ x: dx }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
        <ellipse cx="12.6" cy="15.6" rx="1.45" ry="1.9" fill="var(--blob-face)" />
        <ellipse cx="19.4" cy="15.6" rx="1.45" ry="1.9" fill="var(--blob-face)" />
        <path d="M14.3 19.6q1.7 1.4 3.4 0" stroke="var(--blob-face)" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </motion.g>
    </g>
  );
}
