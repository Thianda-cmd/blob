// The layout of a chart as a tree of SVG elements: axes, ticks, grid, series, error bars,
// trendlines with their equation and R², legend, title. Pure (no React, no DOM), so the same
// drawing is rendered by ChartView on screen and serialised to an SVG file by export.ts, and the
// tests can look at it.
//
// Colours are CSS variables by default (they follow dark mode); a fixed theme ("light", "dark")
// uses hex values instead, for files.

import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { COLOR_HEX } from "../colors";
import { formatValue } from "../engine";
import type { AxisSpec, ChartSpec, NumberFormat, SeriesSpec, SheetColor, TrendlineSpec } from "../types";
import { axisFraction, linearAxis, logAxis, logTickLabel, logTicksScientific, type AxisScale } from "./axis";
import type { ChartData, ChartPoint, ChartSeriesData } from "./data";
import { formatChartNumber, formatFixed, isDateFormat } from "./format";
import { equationParts, equationText, isFitError, r2Text, type EqPart, type Fit } from "./regression";
import { linePath, smoothPath, type Pt } from "./smooth";

// ----------------------------------------------------------------------------------------------
// Types

export type SvgAttrs = Record<string, string | number | undefined>;
/** An SVG element: tag, attributes in React's camelCase (strokeWidth), children. */
export type SvgNode = { tag: string; attrs?: SvgAttrs; children?: (SvgNode | string)[] };

export type Box = { x: number; y: number; w: number; h: number };

/** Something a tooltip can show: where it points and what it says. */
export type ChartHit = {
  x: number;
  y: number;
  /** The area that shows it: near a point, inside a box (a category, a bar) or a pie slice. */
  area: { kind: "near"; r: number } | { kind: "box"; x0: number; y0: number; x1: number; y1: number } | { kind: "slice"; cx: number; cy: number; r: number; a0: number; a1: number };
  title: string;
  /** The title's colour dot (the series), if any. */
  color?: string;
  rows: { label: string; value: string; color?: string }[];
  /** Points to ring while it shows. */
  rings: { x: number; y: number; color: string }[];
};

export type Palette = {
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  axis: string;
  bg: string;
  series(c: SheetColor): string;
  /** The trendline's shade of a series colour: darker in light mode, lighter in dark mode. */
  trend(c: SheetColor): string;
};

export type SceneOptions = {
  width: number;
  height: number;
  locale: Locale;
  /** Fixed colours (exports); undefined: CSS variables that follow the page's theme. */
  theme?: "light" | "dark";
  selectedSeries?: string | null;
  /** Makes the clip path ids unique on a page with several charts. */
  idPrefix?: string;
  /** Exports name their fonts; on screen the page's font is inherited. */
  fontFamily?: string;
};

export type ChartScene = {
  width: number;
  height: number;
  nodes: SvgNode[];
  /** <title>: the chart's title or kind. */
  title: string;
  /** aria-label: "Punktdiagramm Kalibrierung, 2 Reihen, Trendlinie y = …, R² = …". */
  label: string;
  plot: Box | null;
  hits: ChartHit[];
  fontSize: number;
  palette: Palette;
};

// ----------------------------------------------------------------------------------------------
// Colours

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const CSS_PALETTE: Palette = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  ink3: "var(--ink-3)",
  grid: "var(--line)",
  axis: "var(--ink-3)",
  bg: "var(--raised)",
  series: (c) => `var(--sheet-${c})`,
  trend: (c) => `color-mix(in oklab, var(--sheet-${c}) 68%, var(--ink))`,
};

const LIGHT_PALETTE: Palette = {
  ink: "#1c1b18",
  ink2: "#4b4a44",
  ink3: "#8b8981",
  grid: "#e6e4dc",
  axis: "#8b8981",
  bg: "#ffffff",
  series: (c) => COLOR_HEX[c].light,
  trend: (c) => mixHex(COLOR_HEX[c].light, "#1c1b18", 0.32),
};

const DARK_PALETTE: Palette = {
  ink: "#edebe4",
  ink2: "#b6b4ab",
  ink3: "#7d7b73",
  grid: "#2f2e2a",
  axis: "#7d7b73",
  bg: "#22221f",
  series: (c) => COLOR_HEX[c].dark,
  trend: (c) => mixHex(COLOR_HEX[c].dark, "#edebe4", 0.32),
};

export const chartPalette = (theme?: "light" | "dark"): Palette => (theme === "light" ? LIGHT_PALETTE : theme === "dark" ? DARK_PALETTE : CSS_PALETTE);

// ----------------------------------------------------------------------------------------------
// Text

/** Average widths of characters (em) of a sans-serif like Geist; enough to lay out labels. */
const CHAR_W: Record<string, number> = {
  " ": 0.28, ".": 0.28, ",": 0.28, ":": 0.28, ";": 0.28, "'": 0.2, "|": 0.26, "!": 0.28, i: 0.24, l: 0.24, j: 0.24, I: 0.3,
  f: 0.32, t: 0.34, r: 0.36, "(": 0.34, ")": 0.34, "[": 0.32, "]": 0.32, "-": 0.38, "−": 0.6, "–": 0.55, "—": 0.9, "+": 0.6,
  "=": 0.6, "%": 0.86, "²": 0.38, "³": 0.38, m: 0.84, w: 0.74, M: 0.86, W: 0.96, "/": 0.36, "°": 0.4, "…": 0.9, "„": 0.38,
  "“": 0.38, "”": 0.38, "ß": 0.6, "µ": 0.58, "μ": 0.58, "#": 0.6, "*": 0.42, "^": 0.48, "·": 0.28, "×": 0.6,
};

export function textWidth(s: string, size: number, weight = 400): number {
  let w = 0;
  for (const ch of s) {
    const known = CHAR_W[ch];
    if (known !== undefined) w += known;
    else if (ch >= "0" && ch <= "9") w += 0.57;
    else if (ch >= "A" && ch <= "Z") w += 0.67;
    else if (ch >= "a" && ch <= "z") w += 0.53;
    else if (/[ÄÖÜ]/.test(ch)) w += 0.67;
    else if (/[äöü]/.test(ch)) w += 0.54;
    else w += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.6;
  }
  return w * size * (weight >= 600 ? 1.06 : 1);
}

/** Shorten text with "…" to fit a width. */
export function fitText(s: string, maxW: number, size: number, weight = 400): string {
  if (textWidth(s, size, weight) <= maxW) return s;
  const chars = [...s];
  while (chars.length > 1 && textWidth(chars.join("") + "…", size, weight) > maxW) chars.pop();
  return chars.length <= 1 && textWidth(chars.join("") + "…", size, weight) > maxW ? "" : chars.join("").trimEnd() + "…";
}

const SUP_SCALE = 0.72;

/** The width of an equation drawn with superscripts. */
function partsWidth(parts: EqPart[], size: number): number {
  return parts.reduce((w, p) => w + textWidth(p.text, p.sup ? size * SUP_SCALE : size), 0);
}

/** <text> children for an equation: superscripts raised and smaller, then back on the line. */
function partsSpans(parts: EqPart[], size: number): (SvgNode | string)[] {
  const out: (SvgNode | string)[] = [];
  const rise = Math.round(size * 0.38 * 10) / 10;
  let raised = false;
  for (const p of parts) {
    if (p.sup) {
      out.push({ tag: "tspan", attrs: { dy: raised ? 0 : -rise, fontSize: Math.round(size * SUP_SCALE * 10) / 10 }, children: [p.text] });
      raised = true;
    } else {
      out.push({ tag: "tspan", attrs: { dy: raised ? rise : 0 }, children: [p.text] });
      raised = false;
    }
  }
  return out;
}

const rnd = (v: number) => Math.round(v * 100) / 100;

function text(x: number, y: number, s: string, attrs: SvgAttrs = {}): SvgNode {
  return { tag: "text", attrs: { x: rnd(x), y: rnd(y), ...attrs }, children: [s] };
}

// ----------------------------------------------------------------------------------------------
// Markers

type MarkerKind = SeriesSpec["marker"];

/** A marker as a sub-path (all markers of a series are one <path>, cheap even for 5 000 points). */
function markerPath(kind: MarkerKind, x: number, y: number, r: number): string {
  const X = rnd(x);
  const Y = rnd(y);
  switch (kind) {
    case "square": {
      const s = rnd(r * 0.86);
      return `M${rnd(X - s)} ${rnd(Y - s)}h${rnd(2 * s)}v${rnd(2 * s)}h${rnd(-2 * s)}Z`;
    }
    case "triangle":
      return `M${X} ${rnd(Y - r * 1.15)}L${rnd(X + r * 1.05)} ${rnd(Y + r * 0.78)}L${rnd(X - r * 1.05)} ${rnd(Y + r * 0.78)}Z`;
    case "diamond":
      return `M${X} ${rnd(Y - r * 1.25)}L${rnd(X + r * 1.1)} ${Y}L${X} ${rnd(Y + r * 1.25)}L${rnd(X - r * 1.1)} ${Y}Z`;
    case "none":
      return "";
    default:
      return `M${rnd(X - r)} ${Y}a${rnd(r)} ${rnd(r)} 0 1 0 ${rnd(2 * r)} 0a${rnd(r)} ${rnd(r)} 0 1 0 ${rnd(-2 * r)} 0Z`;
  }
}

/** A rectangle with the two corners at the value end rounded (columns grow up, bars right). */
function barPath(x0: number, y0: number, x1: number, y1: number, end: "top" | "bottom" | "right" | "left", radius: number): string {
  const l = Math.min(x0, x1);
  const r = Math.max(x0, x1);
  const t = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  const rr = Math.max(0, Math.min(radius, (r - l) / 2, (b - t) / 2));
  const R = rnd(rr);
  if (rr < 0.5) return `M${rnd(l)} ${rnd(t)}H${rnd(r)}V${rnd(b)}H${rnd(l)}Z`;
  switch (end) {
    case "top":
      return `M${rnd(l)} ${rnd(b)}V${rnd(t + rr)}a${R} ${R} 0 0 1 ${R} ${-R}H${rnd(r - rr)}a${R} ${R} 0 0 1 ${R} ${R}V${rnd(b)}Z`;
    case "bottom":
      return `M${rnd(l)} ${rnd(t)}V${rnd(b - rr)}a${R} ${R} 0 0 0 ${R} ${R}H${rnd(r - rr)}a${R} ${R} 0 0 0 ${R} ${-R}V${rnd(t)}Z`;
    case "right":
      return `M${rnd(l)} ${rnd(t)}H${rnd(r - rr)}a${R} ${R} 0 0 1 ${R} ${R}V${rnd(b - rr)}a${R} ${R} 0 0 1 ${-R} ${R}H${rnd(l)}Z`;
    default:
      return `M${rnd(r)} ${rnd(t)}H${rnd(l + rr)}a${R} ${R} 0 0 0 ${-R} ${R}V${rnd(b - rr)}a${R} ${R} 0 0 0 ${R} ${R}H${rnd(r)}Z`;
  }
}

// ----------------------------------------------------------------------------------------------
// Numbers on axes and in tooltips

/** How a value axis writes its ticks. */
function tickFormatter(scale: AxisScale, axis: AxisSpec, fmt: NumberFormat | null | undefined, locale: Locale): (v: number) => string {
  if (isDateFormat(fmt)) return (v) => formatValue(v, fmt ?? undefined, locale);
  if (scale.log) {
    if (axis.decimals !== null) return (v) => formatFixed(v, axis.decimals!, locale);
    // One notation per axis: 1E-07 … 1E-03, never 1E-06 next to 0,00001.
    const scientific = logTicksScientific(scale.ticks);
    return (v) => logTickLabel(v, locale, scientific);
  }
  const decimals = axis.decimals ?? scale.decimals;
  if (fmt && fmt.kind !== "general" && fmt.kind !== "text" && fmt.kind !== "significant") return (v) => formatChartNumber(v, fmt, locale, { decimals });
  return (v) => formatFixed(v, decimals, locale);
}

/** A value as a tooltip or a data label writes it (the cells' format, with its unit in tooltips). */
function valueText(v: number, fmt: NumberFormat | null | undefined, decimals: number | null, locale: Locale, unit: boolean): string {
  if (isDateFormat(fmt)) return formatValue(v, fmt ?? undefined, locale);
  return formatChartNumber(v, fmt, locale, { decimals, unit });
}

// ----------------------------------------------------------------------------------------------
// The scene

type Ctx = {
  spec: ChartSpec;
  data: ChartData;
  locale: Locale;
  pal: Palette;
  fs: number;
  W: number;
  H: number;
  t: (typeof sheetChartText)["en"];
  selected: string | null;
  ids: string;
};

type LegendEntry =
  | { kind: "series"; label: string; color: string; marker: MarkerKind; line: boolean; swatch: boolean; seriesId: string }
  | { kind: "trend"; label: string; color: string; seriesId: string }
  | { kind: "slice"; label: string; color: string };

const usable = (s: ChartSeriesData) => s.points.length > 0;

/** The trendline's name in the legend: its own, or Excel's automatic one ("Linear (Extinktion)"). */
export function trendlineName(tl: NonNullable<SeriesSpec["trendline"]>, seriesName: string, locale: Locale): string {
  return tl.name.trim() || sheetChartText[locale].trendAuto(tl.type, seriesName, Math.max(2, Math.round(tl.period)));
}

/** Font size that scales from small (280×180) to big (1200×800) charts. */
export function chartFontSize(w: number, h: number): number {
  return Math.round(Math.max(10.5, Math.min(15, Math.min(w / 40, h / 24))) * 2) / 2;
}

export function buildChartScene(spec: ChartSpec, data: ChartData, opts: SceneOptions): ChartScene {
  const W = Math.max(40, opts.width);
  const H = Math.max(30, opts.height);
  const pal = chartPalette(opts.theme);
  const fs = chartFontSize(W, H);
  const t = sheetChartText[opts.locale];
  const ctx: Ctx = { spec, data, locale: opts.locale, pal, fs, W, H, t, selected: opts.selectedSeries ?? null, ids: opts.idPrefix ?? "chart" };
  const nodes: SvgNode[] = [];
  if (opts.theme) nodes.push({ tag: "rect", attrs: { x: 0, y: 0, width: W, height: H, fill: pal.bg } });

  const kindName = t.kindNames[spec.kind];
  const titleText = spec.title.trim();
  const shownSeries = spec.kind === "pie" ? data.series.slice(0, 1) : data.series;
  const label = ariaSummary(ctx, kindName, titleText);
  const base = {
    width: W,
    height: H,
    title: titleText || kindName,
    label,
    fontSize: fs,
    palette: pal,
  };

  // Frame: title on top.
  const pad = Math.round(fs * 0.9);
  const frame: Box = { x: pad, y: pad * 0.8, w: W - 2 * pad, h: H - pad * 1.6 };
  if (titleText) {
    const size = Math.round(fs * 1.22 * 10) / 10;
    const s = fitText(titleText, frame.w, size, 600);
    nodes.push(text(W / 2, frame.y + size * 0.95, s, { fontSize: size, fontWeight: 600, fill: pal.ink, textAnchor: "middle" }));
    frame.y += size * 1.55;
    frame.h -= size * 1.55;
  }

  const hasData = shownSeries.some(usable) && (spec.kind !== "pie" || shownSeries[0].points.some((p) => p.y > 0));
  if (!hasData) {
    nodes.push(...emptyState(ctx, frame));
    return { ...base, nodes: withFont(nodes, opts.fontFamily, pal), plot: null, hits: [] };
  }

  // Legend.
  const entries = legendEntries(ctx);
  let legend: { nodes: SvgNode[] } | null = null;
  if (spec.legend !== "none" && entries.length) {
    const laid = layoutLegend(ctx, entries, frame, spec.legend);
    if (laid) legend = laid;
  }

  const result = spec.kind === "pie" ? pieScene(ctx, frame) : cartesianScene(ctx, frame);
  nodes.push(...result.nodes);
  if (legend) nodes.push(...legend.nodes);
  return { ...base, nodes: withFont(nodes, opts.fontFamily, pal), plot: result.plot, hits: result.hits };
}

/** One group with the font, so every <text> inherits it. */
function withFont(nodes: SvgNode[], fontFamily: string | undefined, pal: Palette): SvgNode[] {
  return [{ tag: "g", attrs: { fontFamily, fill: pal.ink }, children: nodes }];
}

function ariaSummary(ctx: Ctx, kindName: string, title: string): string {
  const { t, data, spec, locale } = ctx;
  const parts = [title ? `${kindName} ${title}` : kindName];
  const n = spec.kind === "pie" ? Math.min(1, data.series.length) : data.series.length;
  parts.push(t.seriesCount(n));
  data.series.forEach((s, i) => {
    const tl = spec.series[i]?.trendline;
    if (!tl || !s.fit || isFitError(s.fit) || spec.kind === "pie") return;
    if (s.fit.type === "movingAverage") {
      parts.push(`${t.ariaTrend} ${trendlineName(tl, s.name, locale)}`);
      return;
    }
    let piece = `${t.ariaTrend} ${equationText(s.fit, locale)}`;
    if (s.fit.r2 !== null) piece += `, ${r2Text(s.fit.r2, locale)}`;
    parts.push(piece);
  });
  return parts.join(", ");
}

function emptyState(ctx: Ctx, frame: Box): SvgNode[] {
  const { pal, fs, t } = ctx;
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const s = Math.min(fs * 2.6, frame.h * 0.3);
  const out: SvgNode[] = [];
  if (s >= 14) {
    // Three calm columns on a base line: "a chart goes here".
    const bw = s * 0.22;
    const gap = s * 0.12;
    const x0 = cx - (3 * bw + 2 * gap) / 2;
    const yb = cy - fs * 0.6;
    const heights = [0.45, 0.8, 0.6];
    out.push({
      tag: "g",
      attrs: { fill: "none", stroke: pal.ink3, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round", opacity: 0.7 },
      children: [
        ...heights.map((h, i) => ({ tag: "path", attrs: { d: barPath(x0 + i * (bw + gap), yb, x0 + i * (bw + gap) + bw, yb - h * s, "top", 2) } })),
        { tag: "path", attrs: { d: `M${rnd(x0 - gap)} ${rnd(yb)}H${rnd(x0 + 3 * bw + 3 * gap)}` } },
      ],
    });
  }
  const y1 = s >= 14 ? cy + fs * 1.1 : cy;
  out.push(text(cx, y1, fitText(t.emptyTitle, frame.w, fs, 500), { fontSize: fs, fontWeight: 500, fill: pal.ink2, textAnchor: "middle" }));
  if (frame.h > fs * 6) out.push(text(cx, y1 + fs * 1.45, fitText(t.emptyHint, frame.w, fs * 0.86), { fontSize: fs * 0.86, fill: pal.ink3, textAnchor: "middle" }));
  return out;
}

// ----------------------------------------------------------------------------------------------
// Legend

function legendEntries(ctx: Ctx): LegendEntry[] {
  const { spec, data, pal, locale } = ctx;
  const out: LegendEntry[] = [];
  if (spec.kind === "pie") {
    const s = data.series[0];
    if (!s) return out;
    data.categories.forEach((c, i) => {
      if (s.points.some((p) => p.x === i && p.y > 0)) out.push({ kind: "slice", label: c, color: pal.series(sliceColor(i)) });
    });
    return out;
  }
  const trends: LegendEntry[] = [];
  data.series.forEach((s, i) => {
    const ss = spec.series[i];
    if (!ss) return;
    const lineKind = spec.kind === "scatter" || spec.kind === "line";
    out.push({
      kind: "series",
      label: s.name,
      color: pal.series(s.color),
      marker: lineKind ? ss.marker : "none",
      line: lineKind ? ss.line !== "none" : false,
      swatch: !lineKind,
      seriesId: s.id,
    });
    if (ss.trendline && s.fit && !isFitError(s.fit) && trendDrawable(spec, s.fit, ss.trendline, s)) trends.push({ kind: "trend", label: trendlineName(ss.trendline, s.name, locale), color: pal.trend(s.color), seriesId: s.id });
  });
  return [...out, ...trends];
}

/**
 * The x a trendline is drawn from and to (in the fit's x: category charts count 1, 2, 3 …): the
 * fitted points plus the forecast (moving averages have none, like in Excel).
 */
function trendSpan(fit: Fit, tl: TrendlineSpec, s: ChartSeriesData, scatter: boolean): { x0: number; x1: number } {
  const lo = fit.xMin ?? Math.min(...s.points.map((p) => (scatter ? p.x : p.x + 1)));
  const hi = fit.xMax ?? Math.max(...s.points.map((p) => (scatter ? p.x : p.x + 1)));
  if (fit.type === "movingAverage") return { x0: lo, x1: hi };
  return { x0: lo - Math.max(0, tl.backward || 0), x1: hi + Math.max(0, tl.forward || 0) };
}

/**
 * Whether a trendline shows anything on the chart's axes (a legend entry for a line that isn't
 * drawn would be confusing): somewhere along it the curve has a value, above 0 on a log axis.
 */
function trendDrawable(spec: ChartSpec, fit: Fit, tl: TrendlineSpec, s: ChartSeriesData): boolean {
  const scatter = spec.kind === "scatter";
  const shows = (x: number, y: number) => Number.isFinite(y) && !(spec.yAxis.log && !(y > 0)) && !(scatter && spec.xAxis.log && !(x > 0));
  if (fit.type === "movingAverage") return (fit.points ?? []).some((p) => shows(p.x, p.y));
  const { x0, x1 } = trendSpan(fit, tl, s, scatter);
  for (let k = 0; k <= 32; k++) {
    const x = x0 + ((x1 - x0) * k) / 32;
    if (shows(x, fit.predict(x))) return true;
  }
  return false;
}

function legendSymbol(ctx: Ctx, e: LegendEntry, x: number, y: number): SvgNode[] {
  const { fs, pal } = ctx;
  const w = fs * 1.5;
  const out: SvgNode[] = [];
  if (e.kind === "trend") {
    out.push({ tag: "path", attrs: { d: `M${rnd(x)} ${rnd(y)}H${rnd(x + w)}`, stroke: e.color, strokeWidth: 1.6, strokeDasharray: `${rnd(fs * 0.36)} ${rnd(fs * 0.24)}`, fill: "none" } });
  } else if (e.kind === "slice" || e.swatch) {
    const s = fs * 0.72;
    out.push({ tag: "rect", attrs: { x: rnd(x + (w - s) / 2), y: rnd(y - s / 2), width: rnd(s), height: rnd(s), rx: 2, fill: e.color } });
  } else {
    if (e.line) out.push({ tag: "path", attrs: { d: `M${rnd(x)} ${rnd(y)}H${rnd(x + w)}`, stroke: e.color, strokeWidth: 2, fill: "none", strokeLinecap: "round" } });
    const m = e.marker === "none" && !e.line ? "circle" : e.marker;
    if (m !== "none") out.push({ tag: "path", attrs: { d: markerPath(m, x + w / 2, y, fs * 0.3), fill: e.color, stroke: pal.bg, strokeWidth: 1 } });
  }
  return out;
}

/** Places the legend and shrinks the frame by it; null when it doesn't fit (tiny charts). */
function layoutLegend(ctx: Ctx, entries: LegendEntry[], frame: Box, pos: "top" | "right" | "bottom"): { nodes: SvgNode[] } | null {
  const { fs, pal } = ctx;
  const size = Math.round(fs * 0.92 * 10) / 10;
  const sym = fs * 1.5;
  const gap = fs * 0.45;
  const itemGap = fs * 1.1;
  const rowH = fs * 1.45;
  const nodes: SvgNode[] = [];
  const dim = (e: LegendEntry) => ("seriesId" in e && ctx.selected && e.seriesId !== ctx.selected ? 0.35 : undefined);

  if (pos === "right") {
    const maxW = Math.min(frame.w * 0.36, fs * 14);
    const items = entries.map((e) => ({ e, label: fitText(e.label, maxW - sym - gap, size) }));
    const width = Math.max(...items.map((i) => sym + gap + textWidth(i.label, size)));
    if (frame.w - width - fs < 120 || items.length * rowH > frame.h) return null;
    const x = frame.x + frame.w - width;
    const h = items.length * rowH;
    let y = frame.y + Math.max(0, (frame.h - h) / 2) + rowH / 2;
    for (const { e, label } of items) {
      nodes.push({ tag: "g", attrs: { opacity: dim(e) }, children: [...legendSymbol(ctx, e, x, y), text(x + sym + gap, y + size * 0.35, label, { fontSize: size, fill: pal.ink2 })] });
      y += rowH;
    }
    frame.w -= width + fs;
    return { nodes };
  }

  // Top or bottom: entries in rows, centred.
  const maxItemW = frame.w * 0.9;
  const items = entries.map((e) => {
    const label = fitText(e.label, maxItemW - sym - gap, size);
    return { e, label, w: sym + gap + textWidth(label, size) };
  });
  const rows: (typeof items)[] = [];
  let row: typeof items = [];
  let rowW = 0;
  for (const it of items) {
    if (row.length && rowW + itemGap + it.w > frame.w) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    rowW += (row.length ? itemGap : 0) + it.w;
    row.push(it);
  }
  if (row.length) rows.push(row);
  const shown = rows.slice(0, 3);
  const h = shown.length * rowH;
  if (frame.h - h < 70) return null;
  let y = pos === "top" ? frame.y + rowH / 2 : frame.y + frame.h - h + rowH / 2;
  for (const r of shown) {
    const total = r.reduce((s, it, i) => s + it.w + (i ? itemGap : 0), 0);
    let x = frame.x + (frame.w - total) / 2;
    for (const it of r) {
      nodes.push({ tag: "g", attrs: { opacity: dim(it.e) }, children: [...legendSymbol(ctx, it.e, x, y), text(x + sym + gap, y + size * 0.35, it.label, { fontSize: size, fill: pal.ink2 })] });
      x += it.w + itemGap;
    }
    y += rowH;
  }
  if (pos === "top") frame.y += h + fs * 0.5;
  frame.h -= h + fs * 0.5;
  return { nodes };
}

// ----------------------------------------------------------------------------------------------
// Axes, series, trendlines

/** The palette colours slices of a pie take in turn. */
const SLICE_COLORS: SheetColor[] = ["blue", "orange", "green", "purple", "red", "teal", "pink", "brown", "yellow", "gray"];
const sliceColor = (i: number) => SLICE_COLORS[i % SLICE_COLORS.length];

type Mapper = (v: number) => number;

type TrendDraw = { s: ChartSeriesData; fit: Fit; tl: NonNullable<SeriesSpec["trendline"]>; samples: Pt[] };

function cartesianScene(ctx: Ctx, area: Box): { nodes: SvgNode[]; plot: Box; hits: ChartHit[] } {
  const { spec, data, fs, pal, locale, t } = ctx;
  const kind = spec.kind;
  const horizontal = kind === "bar";
  const scatter = kind === "scatter";
  // Categories with data or labels (category charts; trendline forecasts may add more, below).
  const nData = Math.max(1, data.categories.length, ...data.series.map((s) => (s.points.length ? s.points[s.points.length - 1].x + 1 : 0)));
  const tickSize = Math.round(fs * 0.88 * 10) / 10;
  const titleSize = Math.round(fs * 0.94 * 10) / 10;
  const tickLen = Math.max(3, fs * 0.32);

  // The value domain (y; x of bars): points, error bar ends, forecast parts of trendlines. A log
  // axis has no place for values at or below 0: such points aren't drawn (a note under the plot
  // says how many, like Excel warns), and neither they nor their error bars stretch the axes.
  const valueAxis = spec.yAxis;
  const catAxis = spec.xAxis;
  const vals: number[] = [];
  const xs: number[] = [];
  let logSkipped = 0;
  let drawable = 0;
  for (const s of data.series) {
    for (const p of s.points) {
      if ((valueAxis.log && !(p.y > 0)) || (scatter && catAxis.log && !(p.x > 0))) {
        logSkipped++;
        continue;
      }
      drawable++;
      vals.push(p.y);
      if (p.lo !== undefined) vals.push(p.lo);
      if (p.hi !== undefined) vals.push(p.hi);
      if (scatter) xs.push(p.x);
    }
  }
  // Trendline extents: a forecast forward or backward widens the x axis, like Excel. Category
  // charts count x 1, 2, 3 … and give a forecast categories of its own, without labels, after the
  // data (`after`) and before it (`before`). Category centres sit half a band in from the plot's
  // edges, so the first half period needs no room ("Rückwärts 0,5", Excel's trick to start a
  // column chart's trendline at the axis, leaves the axis as it is).
  const trendExt: { s: ChartSeriesData; fit: Fit; tl: NonNullable<SeriesSpec["trendline"]>; x0: number; x1: number }[] = [];
  let before = 0;
  let after = 0;
  data.series.forEach((s, i) => {
    const tl = spec.series[i]?.trendline;
    if (!tl || !s.fit || isFitError(s.fit)) return;
    const fit = s.fit;
    const { x0, x1 } = trendSpan(fit, tl, s, scatter);
    trendExt.push({ s, fit, tl, x0, x1 });
    if (scatter) xs.push(x0, x1);
    else {
      // Category i (0-based) is fit x i + 1; its band reaches from i to i + 1.
      before = Math.max(before, Math.ceil(0.5 - x0 - 1e-9));
      after = Math.max(after, Math.ceil(x1 - 0.5 - nData - 1e-9));
    }
    if (fit.type !== "movingAverage" && (tl.forward > 0 || tl.backward > 0)) {
      for (const x of [x0, x1]) {
        const y = fit.predict(x);
        if (Number.isFinite(y)) vals.push(y);
      }
    }
  });
  // A forecast of thousands of periods would leave the data a sliver: at most 1000 more.
  before = Math.min(before, 500);
  after = Math.min(after, 500);
  const nCat = nData + before + after;

  // One-line notes under the plot, about what the chart shows differently from the cells.
  const notes: { text: string; warn: boolean }[] = [];
  const xText = scatter ? data.series.find((s) => s.xText)?.xText : undefined;
  if (xText) notes.push({ text: t.xTextNote(xText.cell), warn: true });
  if (logSkipped && drawable) notes.push({ text: t.logSkipped(logSkipped), warn: false });
  const noteSize = Math.round(fs * 0.8 * 10) / 10;
  const noteLine = noteSize * 1.5;
  // Tiny charts keep their room for the data.
  const shownNotes = area.h - notes.length * noteLine >= fs * 9 ? notes : [];
  const frame: Box = { ...area, h: area.h - shownNotes.length * noteLine };

  const yLogVals = vals.filter((v) => v > 0);
  const range = (v: number[]) => (v.length ? [Math.min(...v), Math.max(...v)] : [NaN, NaN]);
  const [vMin, vMax] = range(valueAxis.log ? yLogVals : vals);
  const xLogVals = xs.filter((v) => v > 0);
  const [xMin, xMax] = range(scatter && catAxis.log ? xLogVals : xs);
  const zeroRule = kind === "column" || kind === "bar" || kind === "area" ? "always" : "excel";

  const valueFmt = data.yFormat ?? null;
  const xFmt = data.xFormat ?? null;

  // Lay out in two passes: the value axis' labels set the left margin, which sets the plot width,
  // which sets how many x ticks fit.
  let plot: Box = { ...frame };
  let vScale: AxisScale = linearAxis(0, 1, { min: null, max: null, target: 5, zero: "never" });
  let xScale: AxisScale | null = null;
  let vFmt: (v: number) => string = (v) => String(v);
  let xFmtFn: (v: number) => string = (v) => String(v);
  let catLayout: { labels: string[]; rotate: boolean; every: number; height: number; width: number } = { labels: [], rotate: false, every: 1, height: 0, width: 0 };

  const valueTitle = valueAxis.title.trim();
  const catTitle = catAxis.title.trim();

  for (let pass = 0; pass < 3; pass++) {
    // Value axis along the plot's height (or width for bars).
    const vLen = horizontal ? plot.w : plot.h;
    const vTarget = horizontal ? vLen / Math.max(fs * 5, 60) : vLen / (fs * 2.9);
    vScale = valueAxis.log ? logAxis(vMin, vMax, valueAxis) : linearAxis(vMin, vMax, { min: valueAxis.min, max: valueAxis.max, target: vTarget, zero: zeroRule, pad: true });
    vFmt = tickFormatter(vScale, valueAxis, valueFmt, locale);
    if (scatter) {
      const xTarget = plot.w / Math.max(fs * 5.2, 56);
      xScale = catAxis.log ? logAxis(xMin, xMax, catAxis) : linearAxis(xMin, xMax, { min: catAxis.min, max: catAxis.max, target: xTarget, zero: "excel", pad: true });
      xFmtFn = tickFormatter(xScale, catAxis, xFmt, locale);
      // Labels too wide for their spacing: fewer ticks.
      if (!xScale.log) {
        for (let k = 0; k < 4; k++) {
          const widest = Math.max(...xScale.ticks.map((v) => textWidth(xFmtFn(v), tickSize)));
          const spacing = plot.w / Math.max(1, xScale.ticks.length - 1);
          if (widest + fs * 0.8 <= spacing) break;
          const target = Math.max(2, (xScale.ticks.length - 1) * 0.6);
          xScale = linearAxis(xMin, xMax, { min: catAxis.min, max: catAxis.max, target, zero: "excel", pad: true });
          xFmtFn = tickFormatter(xScale, catAxis, xFmt, locale);
        }
      }
    }
    // Margins from what the axes need.
    plot = { ...frame };
    const vLabels = vScale.ticks.map(vFmt);
    if (horizontal) {
      // Bars: categories on the left, values along the bottom.
      const band = plot.h / nCat;
      catLayout = categoryLayout(data.categories, nData, band, tickSize, false, frame.w * 0.32);
      const left = (catTitle ? titleSize * 1.5 : 0) + catLayout.width + tickLen + fs * 0.4;
      const lastW = textWidth(vLabels[vLabels.length - 1] ?? "", tickSize);
      plot.x += left;
      plot.w -= left + Math.max(fs * 0.3, lastW / 2);
      const bottom = (valueTitle ? titleSize * 1.6 : 0) + tickSize * 1.25 + tickLen + fs * 0.3;
      plot.h -= bottom;
    } else {
      const widest = Math.max(0, ...vLabels.map((s) => textWidth(s, tickSize)));
      const left = (valueTitle ? titleSize * 1.5 : 0) + widest + tickLen + fs * 0.45;
      plot.x += left;
      plot.w -= left;
      plot.y += tickSize * 0.6;
      plot.h -= tickSize * 0.6;
      let bottom: number;
      if (scatter && xScale) {
        const xl = xScale.ticks.map(xFmtFn);
        const lastW = textWidth(xl[xl.length - 1] ?? "", tickSize);
        plot.w -= Math.max(fs * 0.4, lastW / 2);
        bottom = (catTitle ? titleSize * 1.6 : 0) + tickSize * 1.3 + tickLen + fs * 0.25;
      } else {
        catLayout = categoryLayout(data.categories, nData, (plot.w - fs * 0.4) / nCat, tickSize, true, frame.h * 0.3);
        plot.w -= fs * 0.4;
        bottom = (catTitle ? titleSize * 1.6 : 0) + catLayout.height + tickLen + fs * 0.25;
      }
      plot.h -= bottom;
    }
    if (plot.w < 40) plot.w = 40;
    if (plot.h < 30) plot.h = 30;
  }

  const P = plot;
  const vFrac = (v: number) => axisFraction(vScale, v);
  // Screen position of a value on the value axis.
  const vPos: Mapper = horizontal ? (v) => P.x + vFrac(v) * P.w : (v) => P.y + P.h - vFrac(v) * P.h;
  const band = (horizontal ? P.h : P.w) / nCat;
  // The centre of category i (0-based, of the data), after the forecast's own categories.
  const catPos: Mapper = horizontal ? (i) => P.y + (i + before + 0.5) * band : (i) => P.x + (i + before + 0.5) * band;
  const xPos: Mapper = scatter && xScale ? (x) => P.x + axisFraction(xScale!, x) * P.w : catPos;

  const nodes: SvgNode[] = [];
  const clipId = `${ctx.ids}-plot`;
  const clipPad = fs * 0.5;
  nodes.push({
    tag: "defs",
    children: [
      { tag: "clipPath", attrs: { id: clipId }, children: [{ tag: "rect", attrs: { x: rnd(P.x - clipPad), y: rnd(P.y - clipPad), width: rnd(P.w + 2 * clipPad), height: rnd(P.h + 2 * clipPad) } }] },
      { tag: "clipPath", attrs: { id: `${clipId}-tight` }, children: [{ tag: "rect", attrs: { x: rnd(P.x), y: rnd(P.y), width: rnd(P.w), height: rnd(P.h) } }] },
    ],
  });

  // Grid lines, axis lines, ticks and labels.
  const grid: string[] = [];
  const minorGrid: string[] = [];
  const axisTicks: string[] = [];
  const minorTicks: string[] = [];
  const labels: SvgNode[] = [];
  const crisp = (v: number) => Math.round(v) + 0.5;
  const tickAttrs = { fontSize: tickSize, fill: pal.ink2 };

  if (horizontal) {
    for (const v of vScale.ticks) {
      const x = crisp(vPos(v));
      if (valueAxis.grid) grid.push(`M${x} ${rnd(P.y)}V${rnd(P.y + P.h)}`);
      axisTicks.push(`M${x} ${rnd(P.y + P.h)}v${rnd(tickLen)}`);
      labels.push(text(x, P.y + P.h + tickLen + tickSize * 1.05, vFmt(v), { ...tickAttrs, textAnchor: "middle" }));
    }
    for (const v of vScale.minor) {
      const x = crisp(vPos(v));
      if (valueAxis.grid) minorGrid.push(`M${x} ${rnd(P.y)}V${rnd(P.y + P.h)}`);
      minorTicks.push(`M${x} ${rnd(P.y + P.h)}v${rnd(tickLen * 0.6)}`);
    }
    if (catAxis.grid) for (let i = 1; i < nCat; i++) grid.push(`M${rnd(P.x)} ${crisp(P.y + i * band)}H${rnd(P.x + P.w)}`);
    catLayout.labels.forEach((s, i) => {
      if (!s || i % catLayout.every) return;
      labels.push(text(P.x - tickLen - fs * 0.3, catPos(i) + tickSize * 0.35, s, { ...tickAttrs, textAnchor: "end" }));
    });
  } else {
    for (const v of vScale.ticks) {
      const y = crisp(vPos(v));
      if (valueAxis.grid) grid.push(`M${rnd(P.x)} ${y}H${rnd(P.x + P.w)}`);
      axisTicks.push(`M${rnd(P.x)} ${y}h${rnd(-tickLen)}`);
      labels.push(text(P.x - tickLen - fs * 0.3, y + tickSize * 0.35, vFmt(v), { ...tickAttrs, textAnchor: "end" }));
    }
    for (const v of vScale.minor) {
      const y = crisp(vPos(v));
      if (valueAxis.grid) minorGrid.push(`M${rnd(P.x)} ${y}H${rnd(P.x + P.w)}`);
      minorTicks.push(`M${rnd(P.x)} ${y}h${rnd(-tickLen * 0.6)}`);
    }
    if (scatter && xScale) {
      for (const v of xScale.ticks) {
        const x = crisp(xPos(v));
        if (catAxis.grid) grid.push(`M${x} ${rnd(P.y)}V${rnd(P.y + P.h)}`);
        axisTicks.push(`M${x} ${rnd(P.y + P.h)}v${rnd(tickLen)}`);
        labels.push(text(x, P.y + P.h + tickLen + tickSize * 1.05, xFmtFn(v), { ...tickAttrs, textAnchor: "middle" }));
      }
      for (const v of xScale.minor) {
        const x = crisp(xPos(v));
        if (catAxis.grid) minorGrid.push(`M${x} ${rnd(P.y)}V${rnd(P.y + P.h)}`);
        minorTicks.push(`M${x} ${rnd(P.y + P.h)}v${rnd(tickLen * 0.6)}`);
      }
    } else {
      if (catAxis.grid) for (let i = 1; i < nCat; i++) grid.push(`M${crisp(P.x + i * band)} ${rnd(P.y)}V${rnd(P.y + P.h)}`);
      for (let i = 0; i <= nCat; i++) axisTicks.push(`M${crisp(P.x + i * band)} ${rnd(P.y + P.h)}v${rnd(tickLen)}`);
      catLayout.labels.forEach((s, i) => {
        if (!s || i % catLayout.every) return;
        const x = catPos(i);
        const y = P.y + P.h + tickLen + tickSize * 1.05;
        if (catLayout.rotate) labels.push(text(x + tickSize * 0.3, y - tickSize * 0.2, s, { ...tickAttrs, textAnchor: "end", transform: `rotate(-40 ${rnd(x + tickSize * 0.3)} ${rnd(y - tickSize * 0.2)})` }));
        else labels.push(text(x, y, s, { ...tickAttrs, textAnchor: "middle" }));
      });
    }
  }
  if (minorGrid.length) nodes.push({ tag: "path", attrs: { d: minorGrid.join(""), stroke: pal.grid, strokeWidth: 1, fill: "none", opacity: 0.55 } });
  if (grid.length) nodes.push({ tag: "path", attrs: { d: grid.join(""), stroke: pal.grid, strokeWidth: 1, fill: "none" } });
  // A stronger line at 0 when the values cross it (columns grow from there).
  if (!vScale.log && vScale.min < 0 && vScale.max > 0) {
    const z = crisp(vPos(0));
    nodes.push({ tag: "path", attrs: { d: horizontal ? `M${z} ${rnd(P.y)}V${rnd(P.y + P.h)}` : `M${rnd(P.x)} ${z}H${rnd(P.x + P.w)}`, stroke: pal.axis, strokeWidth: 1, fill: "none", opacity: 0.8 } });
  }
  // The L of the axes: left and bottom.
  const axisLine = `M${crisp(P.x)} ${rnd(P.y)}V${crisp(P.y + P.h)}H${rnd(P.x + P.w)}`;
  nodes.push({ tag: "path", attrs: { d: axisLine + axisTicks.join("") + minorTicks.join(""), stroke: pal.axis, strokeWidth: 1, fill: "none", strokeLinecap: "square" } });
  nodes.push({ tag: "g", children: labels });

  // Axis titles.
  if (horizontal) {
    if (valueTitle) nodes.push(text(P.x + P.w / 2, frame.y + frame.h - titleSize * 0.25, fitText(valueTitle, P.w, titleSize, 500), { fontSize: titleSize, fontWeight: 500, fill: pal.ink2, textAnchor: "middle" }));
    if (catTitle) {
      const x = frame.x + titleSize * 0.85;
      const y = P.y + P.h / 2;
      nodes.push(text(x, y, fitText(catTitle, P.h, titleSize, 500), { fontSize: titleSize, fontWeight: 500, fill: pal.ink2, textAnchor: "middle", transform: `rotate(-90 ${rnd(x)} ${rnd(y)})` }));
    }
  } else {
    if (catTitle) nodes.push(text(P.x + P.w / 2, frame.y + frame.h - titleSize * 0.25, fitText(catTitle, P.w, titleSize, 500), { fontSize: titleSize, fontWeight: 500, fill: pal.ink2, textAnchor: "middle" }));
    if (valueTitle) {
      const x = frame.x + titleSize * 0.85;
      const y = P.y + P.h / 2;
      nodes.push(text(x, y, fitText(valueTitle, P.h, titleSize, 500), { fontSize: titleSize, fontWeight: 500, fill: pal.ink2, textAnchor: "middle", transform: `rotate(-90 ${rnd(x)} ${rnd(y)})` }));
    }
  }

  // Series.
  const hits: ChartHit[] = [];
  const seriesNodes: SvgNode[] = [];
  // Values next to points go on top of every series, so the next series doesn't cover them.
  const labelNodes: SvgNode[] = [];
  const pointsOnScreen: Pt[] = [];
  const markerR = fs * 0.34;
  const valueOf = (p: ChartPoint) => p.y;
  const onAxis = (v: number) => !(vScale.log && !(v > 0));
  const zeroPos = vPos(vScale.log ? vScale.min : Math.min(Math.max(0, vScale.min), vScale.max));
  const xTitle = catTitle || "x";
  const yTitle = valueTitle || "y";
  const labelSize = Math.round(fs * 0.8 * 10) / 10;

  const seriesCount = data.series.length;
  const groupW = band * (seriesCount > 1 ? 0.78 : 0.62);
  const barW = groupW / Math.max(1, seriesCount);

  data.series.forEach((s, si) => {
    const ss = spec.series[si];
    if (!ss) return;
    const color = pal.series(s.color);
    const shade = pal.trend(s.color);
    const g: SvgNode[] = [];
    const errors: string[] = [];
    const cap = Math.max(3, fs * 0.36);
    const dataLabels: SvgNode[] = [];
    const scr: (Pt & { p: ChartPoint })[] = [];
    for (const p of s.points) {
      if (!onAxis(valueOf(p))) continue;
      if (scatter && xScale?.log && !(p.x > 0)) continue;
      if (kind === "column") {
        const cx = catPos(p.x) - groupW / 2 + (si + 0.5) * barW;
        scr.push({ x: cx, y: vPos(p.y), p });
      } else if (horizontal) {
        const cy = catPos(p.x) - groupW / 2 + (si + 0.5) * barW;
        scr.push({ x: vPos(p.y), y: cy, p });
      } else scr.push({ x: xPos(p.x), y: vPos(p.y), p });
    }

    if (kind === "column" || horizontal) {
      const inner = Math.max(1, barW * 0.88);
      const bars = scr.map(({ x, y, p }) =>
        horizontal ? barPath(zeroPos, y - inner / 2, x, y + inner / 2, p.y >= 0 ? "right" : "left", 3) : barPath(x - inner / 2, zeroPos, x + inner / 2, y, p.y >= 0 ? "top" : "bottom", 3),
      );
      g.push({ tag: "path", attrs: { d: bars.join(""), fill: color } });
    } else {
      // Lines (and areas).
      const runs: Pt[][] = [];
      let run: Pt[] = [];
      scr.forEach((pt, i) => {
        if (i && !scatter && pt.p.x - scr[i - 1].p.x > 1) {
          runs.push(run);
          run = [];
        }
        run.push(pt);
      });
      if (run.length) runs.push(run);
      const smooth = ss.line === "smooth";
      if (kind === "area") {
        const d = runs
          .filter((r) => r.length > 1)
          .map((r) => {
            const top = smooth ? smoothPath(r) : linePath(r);
            return `${top}L${rnd(r[r.length - 1].x)} ${rnd(zeroPos)}L${rnd(r[0].x)} ${rnd(zeroPos)}Z`;
          })
          .join("");
        if (d) g.push({ tag: "path", attrs: { d, fill: color, fillOpacity: 0.2, stroke: "none" } });
      }
      const drawLine = kind === "area" || ss.line !== "none";
      if (drawLine) {
        const d = runs
          .filter((r) => r.length > 1)
          .map((r) => (smooth ? smoothPath(r) : linePath(r)))
          .join("");
        if (d) g.push({ tag: "path", attrs: { d, fill: "none", stroke: color, strokeWidth: rnd(Math.max(1.75, fs * 0.16)), strokeLinejoin: "round", strokeLinecap: "round" } });
      }
    }

    // Error bars. On a log axis a lower end at or below 0 has no place: the bar runs off the bottom
    // of the plot, like Excel's, without a cap there (a cap would read as a real lower end).
    for (const { x, y, p } of scr) {
      if (p.lo === undefined || p.hi === undefined || !onAxis(p.hi)) continue;
      const low = onAxis(p.lo);
      const a = low ? vPos(p.lo) : horizontal ? P.x : P.y + P.h;
      const b = vPos(p.hi);
      if (horizontal) errors.push(`M${rnd(a)} ${rnd(y)}H${rnd(b)}${low ? `M${rnd(a)} ${rnd(y - cap)}v${rnd(2 * cap)}` : ""}M${rnd(b)} ${rnd(y - cap)}v${rnd(2 * cap)}`);
      else errors.push(`M${rnd(x)} ${rnd(a)}V${rnd(b)}${low ? `M${rnd(x - cap)} ${rnd(a)}h${rnd(2 * cap)}` : ""}M${rnd(x - cap)} ${rnd(b)}h${rnd(2 * cap)}`);
    }
    if (errors.length) g.push({ tag: "path", attrs: { d: errors.join(""), stroke: shade, strokeWidth: 1.3, fill: "none", strokeLinecap: "round" } });

    // Markers.
    if ((scatter || kind === "line") && ss.marker !== "none") {
      const d = scr.map(({ x, y }) => markerPath(ss.marker, x, y, markerR)).join("");
      if (d) g.push({ tag: "path", attrs: { d, fill: color, stroke: pal.bg, strokeWidth: 1.2 } });
    }

    // Values next to the points.
    if (ss.labels) {
      for (const { x, y, p } of scr) {
        const s2 = valueText(p.y, valueFmt, data.yDecimals, locale, false);
        if (horizontal) dataLabels.push(text(x + (p.y >= 0 ? fs * 0.4 : -fs * 0.4), y + labelSize * 0.35, s2, { fontSize: labelSize, fill: pal.ink2, textAnchor: p.y >= 0 ? "start" : "end" }));
        else {
          const above = p.y >= 0 || kind !== "column";
          const dy = kind === "column" ? (above ? -fs * 0.4 : labelSize + fs * 0.2) : -markerR - fs * 0.35;
          dataLabels.push(text(x, y + dy, s2, { fontSize: labelSize, fill: pal.ink2, textAnchor: "middle" }));
        }
      }
    }
    for (const pt of scr) pointsOnScreen.push({ x: pt.x, y: pt.y });

    const dimmed = ctx.selected && ctx.selected !== s.id ? 0.28 : undefined;
    seriesNodes.push({ tag: "g", attrs: { clipPath: `url(#${clipId})`, opacity: dimmed }, children: g });
    if (dataLabels.length) labelNodes.push({ tag: "g", attrs: { opacity: dimmed, stroke: pal.bg, strokeWidth: 3, paintOrder: "stroke", strokeLinejoin: "round" }, children: dataLabels });

    // Tooltips of points (scatter); categories get one per band below.
    if (scatter) {
      for (const { x, y, p } of scr) {
        const rows = [
          { label: xTitle, value: valueText(p.x, xFmt, data.xDecimals, locale, true) },
          { label: yTitle, value: valueText(p.y, valueFmt, data.yDecimals, locale, true) },
        ];
        if (p.lo !== undefined && p.hi !== undefined) rows.push({ label: "±", value: `${valueText(p.hi - p.y, valueFmt, data.yDecimals, locale, false)} / ${valueText(p.y - p.lo, valueFmt, data.yDecimals, locale, false)}` });
        hits.push({ x, y, area: { kind: "near", r: Math.max(16, fs * 1.8) }, title: s.name, color, rows, rings: [{ x, y, color }] });
      }
    }
  });

  // Category tooltips: one per band of the data, with every series' value there.
  if (!scatter) {
    for (let i = 0; i < nData; i++) {
      const rows: ChartHit["rows"] = [];
      const rings: ChartHit["rings"] = [];
      let anchor = horizontal ? -Infinity : Infinity;
      data.series.forEach((s) => {
        const p = s.points.find((q) => q.x === i);
        if (!p || !onAxis(p.y)) return;
        const color = pal.series(s.color);
        let value = valueText(p.y, valueFmt, data.yDecimals, locale, true);
        if (p.lo !== undefined && p.hi !== undefined) value += ` (± ${valueText((p.hi - p.lo) / 2, valueFmt, data.yDecimals, locale, false)})`;
        rows.push({ label: s.name, value, color });
        const v = vPos(p.y);
        if (horizontal) anchor = Math.max(anchor, v);
        else anchor = Math.min(anchor, v);
        if (kind === "line" || kind === "area") rings.push({ x: catPos(i), y: v, color });
      });
      if (!rows.length) continue;
      const c = catPos(i);
      hits.push(
        horizontal
          ? { x: anchor, y: c, area: { kind: "box", x0: P.x, y0: c - band / 2, x1: P.x + P.w, y1: c + band / 2 }, title: data.categories[i] ?? String(i + 1), rows, rings }
          : { x: c, y: anchor, area: { kind: "box", x0: c - band / 2, y0: P.y, x1: c + band / 2, y1: P.y + P.h }, title: data.categories[i] ?? String(i + 1), rows, rings },
      );
    }
  }

  // Trendlines.
  const trends: TrendDraw[] = [];
  for (const { s, fit, tl, x0, x1 } of trendExt) {
    // Fit x → screen: scatter x as is; category charts count 1, 2, 3 … (category index + 1).
    const toScreen = (x: number, y: number): Pt | null => {
      if (!Number.isFinite(y) || !onAxis(y)) return null;
      const along = scatter ? xPos(x) : catPos(x - 1);
      if (!Number.isFinite(along)) return null;
      const v = Math.max(-1e5, Math.min(1e5, vPos(y)));
      return horizontal ? { x: v, y: along } : { x: along, y: v };
    };
    const samples: Pt[] = [];
    if (fit.type === "movingAverage") {
      for (const p of fit.points ?? []) {
        const pt = toScreen(p.x, p.y);
        if (pt) samples.push(pt);
      }
    } else {
      const straight = fit.type === "linear" && !vScale.log && !(scatter && xScale?.log);
      const n = straight ? 1 : 240;
      const logX = scatter && xScale?.log;
      let a = x0;
      if (logX && !(a > 0)) a = xScale!.min;
      const b = x1;
      for (let k = 0; k <= n; k++) {
        const x = logX ? 10 ** (Math.log10(a) + ((Math.log10(b) - Math.log10(a)) * k) / n) : a + ((b - a) * k) / n;
        const pt = toScreen(x, fit.predict(x));
        if (pt) samples.push(pt);
        // A gap (outside the model's domain): break the line there.
        else if (samples.length && !Number.isNaN(samples[samples.length - 1].x)) samples.push({ x: NaN, y: NaN });
      }
    }
    trends.push({ s, fit, tl, samples });
  }
  const trendNodes: SvgNode[] = trends.map(({ s, samples }) => {
    const runs: Pt[][] = [[]];
    for (const p of samples) {
      if (Number.isNaN(p.x)) runs.push([]);
      else runs[runs.length - 1].push(p);
    }
    const d = runs
      .filter((r) => r.length > 1)
      .map(linePath)
      .join("");
    const dimmed = ctx.selected && ctx.selected !== s.id ? 0.28 : undefined;
    return {
      tag: "path",
      attrs: { d, fill: "none", stroke: pal.trend(s.color), strokeWidth: rnd(Math.max(1.5, fs * 0.13)), strokeDasharray: `${rnd(fs * 0.5)} ${rnd(fs * 0.32)}`, strokeLinecap: "round", clipPath: `url(#${clipId}-tight)`, opacity: dimmed },
    };
  });

  nodes.push(...trendNodes.filter((n) => n.attrs?.d), ...seriesNodes, ...labelNodes);
  nodes.push(...equationBoxes(ctx, P, trends, pointsOnScreen));
  // A log axis with nothing above 0 to show says why the chart is empty (Excel warns too).
  if (logSkipped && !drawable) {
    nodes.push(text(P.x + P.w / 2, P.y + P.h / 2, fitText(ctx.t.noPositive, P.w - fs, fs * 0.9), { fontSize: fs * 0.9, fill: pal.ink3, textAnchor: "middle" }));
  }
  // The notes, centred under the plot, in the room kept for them below the axis title.
  shownNotes.forEach((note, k) => {
    const icon = note.warn ? noteSize * 1.05 : 0;
    const gap = note.warn ? noteSize * 0.4 : 0;
    const s = fitText(note.text, area.w - icon - gap, noteSize);
    const w = icon + gap + textWidth(s, noteSize);
    const cx = Math.min(Math.max(P.x + P.w / 2, area.x + w / 2), area.x + area.w - w / 2);
    const baseline = frame.y + frame.h + (k + 0.8) * noteLine;
    const x0 = cx - w / 2;
    if (note.warn) nodes.push(warnIcon(x0, baseline, icon, pal.series("orange"), pal.bg));
    nodes.push(text(x0 + icon + gap, baseline, s, { fontSize: noteSize, fill: note.warn ? pal.ink2 : pal.ink3 }));
  });
  return { nodes, plot: P, hits };
}

/** A small warning triangle with "!" (size × size), its bottom on the text's baseline. */
function warnIcon(x: number, baseline: number, size: number, color: string, bg: string): SvgNode {
  const top = baseline - size * 0.9;
  const mid = x + size / 2;
  return {
    tag: "g",
    children: [
      { tag: "path", attrs: { d: `M${rnd(mid)} ${rnd(top)}L${rnd(x + size)} ${rnd(top + size * 0.9)}H${rnd(x)}Z`, fill: color, strokeLinejoin: "round", stroke: color, strokeWidth: 1 } },
      { tag: "path", attrs: { d: `M${rnd(mid)} ${rnd(top + size * 0.32)}V${rnd(top + size * 0.58)}M${rnd(mid)} ${rnd(top + size * 0.76)}v0.01`, stroke: bg, strokeWidth: rnd(Math.max(1.1, size * 0.13)), strokeLinecap: "round", fill: "none" } },
    ],
  };
}

/** Category labels: all of them when they fit, else every n-th; rotated when long. */
function categoryLayout(cats: string[], n: number, band: number, size: number, below: boolean, maxSpace: number) {
  const labels = Array.from({ length: n }, (_, i) => cats[i] ?? String(i + 1));
  if (!below) {
    // Vertical category axis (bars): every label on its own row, shortened to the space.
    const fitted = labels.map((l) => fitText(l, maxSpace, size));
    const every = Math.max(1, Math.ceil((size * 1.2) / Math.max(1, band)));
    return { labels: fitted, rotate: false, every, height: 0, width: Math.max(0, ...fitted.map((l) => textWidth(l, size))) };
  }
  const widest = Math.max(0, ...labels.map((l) => textWidth(l, size)));
  if (widest <= band * 0.92) return { labels, rotate: false, every: 1, height: size * 1.3, width: widest };
  // Rotated by 40°: needs about half a line per label sideways.
  const short = labels.map((l) => fitText(l, Math.min(maxSpace / Math.sin((40 * Math.PI) / 180), size * 12), size));
  const longest = Math.max(0, ...short.map((l) => textWidth(l, size)));
  const every = Math.max(1, Math.ceil((size * 1.35) / Math.max(1, band)));
  return { labels: short, rotate: true, every, height: longest * Math.sin((40 * Math.PI) / 180) + size * 1.2, width: longest };
}

/**
 * An equation in lines no wider than `maxW`, broken between its terms (before " + " and " - "),
 * the lines after the first lined up after "y = ": a 6th-order polynomial with 4 significant
 * digits per coefficient doesn't fit across a small chart.
 */
export function wrapEquation(parts: EqPart[], maxW: number, size: number): { parts: EqPart[]; indent: number }[] {
  if (partsWidth(parts, size) <= maxW) return [{ parts, indent: 0 }];
  const terms: EqPart[][] = [[]];
  for (const p of parts) {
    if (p.sup) {
      terms[terms.length - 1].push(p);
      continue;
    }
    p.text.split(/(?= [+-] )/).forEach((chunk, i) => {
      if ((i > 0 || /^ [+-] /.test(chunk)) && terms[terms.length - 1].length) terms.push([]);
      terms[terms.length - 1].push({ ...p, text: chunk });
    });
  }
  const indent = textWidth("y = ", size);
  const lines: { parts: EqPart[]; indent: number }[] = [];
  let line: EqPart[] = [];
  for (const term of terms) {
    const room = lines.length ? maxW - indent : maxW;
    if (line.length && partsWidth([...line, ...term], size) > room) {
      lines.push({ parts: line, indent: lines.length ? indent : 0 });
      line = [{ ...term[0], text: term[0].text.replace(/^ /, "") }, ...term.slice(1)];
    } else line.push(...term);
  }
  lines.push({ parts: line, indent: lines.length ? indent : 0 });
  return lines;
}

/** Equation and R² labels, stacked in the corner of the plot with the least data under it. */
function equationBoxes(ctx: Ctx, P: Box, trends: TrendDraw[], points: Pt[]): SvgNode[] {
  const { fs, pal, locale } = ctx;
  const size = Math.round(fs * 0.92 * 10) / 10;
  const lh = size * 1.42;
  const padX = size * 0.6;
  const padY = size * 0.42;
  const blockGap = size * 0.35;
  const inset = Math.max(4, fs * 0.5);
  type Line = { parts: EqPart[]; color: string; indent: number };
  const blocks: Line[][] = [];
  for (const { s, fit, tl } of trends) {
    if (fit.type === "movingAverage") continue;
    const lines: Line[] = [];
    const color = pal.trend(s.color);
    if (tl.showEquation) for (const l of wrapEquation(equationParts(fit, locale), P.w - 2 * (inset + padX), size)) lines.push({ ...l, color });
    if (tl.showR2 && fit.r2 !== null) lines.push({ parts: [{ text: r2Text(fit.r2, locale) }], color, indent: 0 });
    if (lines.length) blocks.push(lines);
  }
  if (!blocks.length) return [];
  const lines = blocks.flat();
  const w = Math.min(P.w, Math.max(...lines.map((l) => l.indent + partsWidth(l.parts, size))) + 2 * padX);
  const h = lines.length * lh + (blocks.length - 1) * blockGap + 2 * padY;
  if (h > P.h + 4) return [];
  const corners = {
    tl: { x: P.x + inset, y: P.y + inset },
    tr: { x: P.x + P.w - inset - w, y: P.y + inset },
    br: { x: P.x + P.w - inset - w, y: P.y + P.h - inset - h },
    bl: { x: P.x + inset, y: P.y + P.h - inset - h },
  };
  // Prefer the empty corner: rising lines leave the top left free, falling ones the top right.
  const firstLine = trends[0]?.samples.filter((p) => !Number.isNaN(p.x)) ?? [];
  const rising = firstLine.length > 1 ? firstLine[firstLine.length - 1].y < firstLine[0].y : true;
  const order: (keyof typeof corners)[] = rising ? ["tl", "tr", "br", "bl"] : ["tr", "tl", "bl", "br"];
  const obstacles = [...points, ...trends.flatMap((tr) => tr.samples.filter((_, i) => i % 4 === 0))];
  const score = (c: { x: number; y: number }) => obstacles.filter((p) => p.x >= c.x - 4 && p.x <= c.x + w + 4 && p.y >= c.y - 4 && p.y <= c.y + h + 4).length;
  let best = order[0];
  let bestScore = Infinity;
  for (const k of order) {
    const sc = score(corners[k]);
    if (sc < bestScore) {
      bestScore = sc;
      best = k;
    }
  }
  const at = corners[best];
  const out: SvgNode[] = [{ tag: "rect", attrs: { x: rnd(at.x), y: rnd(at.y), width: rnd(w), height: rnd(h), rx: 6, fill: pal.bg, fillOpacity: 0.92, stroke: pal.grid, strokeWidth: 1 } }];
  let y = at.y + padY;
  blocks.forEach((block, bi) => {
    if (bi) y += blockGap;
    for (const line of block) {
      y += lh;
      // xml:space keeps the spaces around " + " between the pieces in other SVG programs too.
      out.push({ tag: "text", attrs: { x: rnd(at.x + padX + line.indent), y: rnd(y - lh * 0.3), fontSize: size, fill: line.color, fontWeight: 500, xmlSpace: "preserve" }, children: partsSpans(line.parts, size) });
    }
  });
  return [{ tag: "g", children: out }];
}

// ----------------------------------------------------------------------------------------------
// Pie

function pieScene(ctx: Ctx, frame: Box): { nodes: SvgNode[]; plot: Box; hits: ChartHit[] } {
  const { data, spec, fs, pal, locale } = ctx;
  const s = data.series[0];
  const ss = spec.series[0];
  const slices = s.points.filter((p) => p.y > 0);
  const total = slices.reduce((a, p) => a + p.y, 0);
  const labelSize = Math.round(fs * 0.86 * 10) / 10;
  // Room for labels outside the pie on both sides.
  const labelW = Math.min(frame.w * 0.26, Math.max(...slices.map((p) => textWidth(pieLabel(ctx, p, total, ss?.labels ?? false), labelSize))) + fs);
  const r = Math.max(10, Math.min(frame.h / 2 - fs * 1.2, frame.w / 2 - labelW - fs * 0.6));
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const nodes: SvgNode[] = [];
  const hits: ChartHit[] = [];
  const labels: { x: number; y: number; right: boolean; text: string; ax: number; ay: number }[] = [];
  let a = -Math.PI / 2;
  const sliceNodes: SvgNode[] = [];
  for (const p of slices) {
    const frac = p.y / total;
    const a1 = a + frac * Math.PI * 2;
    const color = pal.series(sliceColor(p.x));
    const large = a1 - a > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.cos(a);
    const y0 = cy + r * Math.sin(a);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const d = frac >= 0.9999 ? `M${rnd(cx - r)} ${rnd(cy)}a${rnd(r)} ${rnd(r)} 0 1 0 ${rnd(2 * r)} 0a${rnd(r)} ${rnd(r)} 0 1 0 ${rnd(-2 * r)} 0Z` : `M${rnd(cx)} ${rnd(cy)}L${rnd(x0)} ${rnd(y0)}A${rnd(r)} ${rnd(r)} 0 ${large} 1 ${rnd(x1)} ${rnd(y1)}Z`;
    sliceNodes.push({ tag: "path", attrs: { d, fill: color, stroke: pal.bg, strokeWidth: 1.5, strokeLinejoin: "round" } });
    const mid = (a + a1) / 2;
    const cat = data.categories[p.x] ?? String(p.x + 1);
    const pct = formatFixed(frac * 100, frac < 0.1 ? 1 : 0, locale) + "%";
    hits.push({
      x: cx + r * 0.62 * Math.cos(mid),
      y: cy + r * 0.62 * Math.sin(mid),
      area: { kind: "slice", cx, cy, r, a0: a, a1 },
      title: cat,
      color,
      rows: [{ label: s.name, value: `${valueText(p.y, data.yFormat, data.yDecimals, locale, true)} (${pct})` }],
      rings: [],
    });
    if (frac >= 0.02) {
      labels.push({
        x: cx + (r + fs * 0.9) * Math.cos(mid),
        y: cy + (r + fs * 0.9) * Math.sin(mid),
        right: Math.cos(mid) >= 0,
        text: pieLabel(ctx, p, total, ss?.labels ?? false),
        ax: cx + r * Math.cos(mid),
        ay: cy + r * Math.sin(mid),
      });
    }
    a = a1;
  }
  nodes.push({ tag: "g", children: sliceNodes });
  // Labels: keep them from overlapping on each side.
  const placed: SvgNode[] = [];
  for (const side of [true, false]) {
    const list = labels.filter((l) => l.right === side).sort((p, q) => p.y - q.y);
    let last = -Infinity;
    for (const l of list) {
      const y = Math.max(l.y, last + labelSize * 1.25);
      last = y;
      const tx = l.x + (side ? fs * 0.2 : -fs * 0.2);
      const textNode = text(tx, y + labelSize * 0.35, fitText(l.text, labelW, labelSize), { fontSize: labelSize, fill: pal.ink2, textAnchor: side ? "start" : "end" });
      placed.push({ tag: "path", attrs: { d: `M${rnd(l.ax)} ${rnd(l.ay)}L${rnd(l.x)} ${rnd(y)}`, stroke: pal.ink3, strokeWidth: 0.8, fill: "none", opacity: 0.7 } }, textNode);
    }
  }
  nodes.push({ tag: "g", children: placed });
  return { nodes, plot: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }, hits };
}

function pieLabel(ctx: Ctx, p: ChartPoint, total: number, withValue: boolean): string {
  const frac = p.y / total;
  const pct = formatFixed(frac * 100, frac < 0.1 ? 1 : 0, ctx.locale) + "%";
  const cat = ctx.data.categories[p.x] ?? String(p.x + 1);
  return withValue ? `${cat} ${valueText(p.y, ctx.data.yFormat, ctx.data.yDecimals, ctx.locale, false)} (${pct})` : `${cat} ${pct}`;
}
