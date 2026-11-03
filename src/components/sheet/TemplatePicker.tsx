"use client";

// Shown in a new, still empty spreadsheet: start blank or from a lab template.
//
// CONTRACT: SheetEditor shows it while the workbook is blank; onPick gets the template's workbook.
//
// "Leere Tabelle" comes first and calls onDismiss (the blank workbook is already there). Each
// template is a card with its icon, a one-line description, a few tags (chart kind, trendline…)
// and, when there is room, a tiny preview: the first rows of its main table as they will look, and
// a thumbnail of its chart. Narrow screens get a plain list. The layout follows the picker's own
// width (container queries), since the editor beside Blob's sidebar is narrower than the window.
// Arrow keys move between the choices (up and down follow the grid as laid out), Enter opens one,
// Escape starts blank, and typing a letter starts blank with it ("tipp einfach los"). The root
// fills its box and scrolls on its own, so the editor can put it over the grid (absolute inset-0)
// or in its place.

import {
  Activity,
  Beaker,
  ChartColumn,
  ChartScatter,
  ChevronRight,
  FlaskConical,
  GraduationCap,
  Pipette,
  Plus,
  Sigma,
  Table2,
  TestTubes,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";
import { IconButton } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { sheetTemplatesText } from "@/i18n/messages/sheetTemplates";
import { resolveText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { cellKey } from "@/sheet/a1";
import { SERIES_COLORS, sheetColor, sheetFill } from "@/sheet/colors";
import { createCalc, formatValue, isError, type Calc, type CellValue } from "@/sheet/engine";
import { SHEET_TEMPLATES, type SheetTemplate } from "@/sheet/templates";
import type { ChartKind, NumberFormat, RangeRef, SheetColor, Workbook } from "@/sheet/types";

const ICONS: Record<string, LucideIcon> = {
  "trending-up": TrendingUp,
  "flask-conical": FlaskConical,
  sigma: Sigma,
  activity: Activity,
  "test-tubes": TestTubes,
  beaker: Beaker,
  pipette: Pipette,
  "graduation-cap": GraduationCap,
};

type Text = (typeof sheetTemplatesText)["en"];

export function TemplatePicker({
  onPick,
  onDismiss,
  onType,
  autoFocus = false,
  className,
}: {
  /** The chosen template's workbook; `template` names it (e.g. to title an untitled page). */
  onPick: (wb: Workbook, template?: { id: string; title: string }) => void;
  /** Start blank: the "Leere Tabelle" card, the close button and Escape. */
  onDismiss: () => void;
  /**
   * A key that types something was pressed: start blank and take the keyboard, during the key
   * press, to where the letter should land (so it isn't lost, nor the ones typed right after).
   */
  onType?: () => void;
  /** Focus "Leere Tabelle" when shown, so the keyboard can choose right away. */
  autoFocus?: boolean;
  className?: string;
}): ReactNode {
  const t = useMessages(sheetTemplatesText);
  const locale = useLocale();
  const headingId = useId();
  const blankHintId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const blankRef = useRef<HTMLButtonElement>(null);
  // Small workbooks, built once per language: the previews show exactly what a pick creates.
  const cards = useMemo(() => SHEET_TEMPLATES.map((tpl) => ({ tpl, preview: previewOf(tpl, locale, t) })), [locale, t]);

  useEffect(() => {
    if (autoFocus) blankRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
      return;
    }
    // Space and Enter stay the keyboard's way to pick the focused card; AltGr (Ctrl+Alt on Windows)
    // types characters such as @. Dead keys (^ before ê) and input methods type too.
    const types = (e.key.length === 1 && e.key !== " ") || e.key === "Dead" || e.key === "Process" || e.keyCode === 229;
    const altGr = e.ctrlKey && e.altKey && !e.metaKey;
    if (onType && types && (altGr || (!e.ctrlKey && !e.metaKey))) {
      onType();
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-pick]") ?? []);
    const next = nextItem(items, items.indexOf(document.activeElement as HTMLElement), e.key);
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
    items[next].scrollIntoView({ block: "nearest" });
  };

  return (
    <section ref={rootRef} aria-labelledby={headingId} onKeyDown={onKeyDown} className={cn("@container h-full w-full overflow-y-auto bg-paper", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 @xl:px-8 @xl:pt-10">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-ink-2">{t.label}</p>
            <h2 id={headingId} className="mt-0.5 font-display text-[24px] font-bold leading-tight tracking-[-0.02em] @xl:text-[28px]">
              {t.heading}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-2">{t.intro}</p>
          </div>
          <IconButton label={t.close} onClick={onDismiss} className="-mr-1 shrink-0">
            <X className="size-4" />
          </IconButton>
        </header>

        <motion.button
          ref={blankRef}
          type="button"
          data-pick
          aria-label={t.blank}
          aria-describedby={blankHintId}
          onClick={onDismiss}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
          className="group mt-6 flex w-full items-center gap-4 rounded-xl border border-blob/35 bg-blob-soft/50 p-3.5 text-left transition-[border-color,background,transform] duration-200 hover:border-blob/70 hover:bg-blob-soft active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper @xl:p-4"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blob text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.12)] transition-transform duration-200 group-hover:scale-105">
            <Plus className="size-5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[16.5px] font-semibold leading-tight text-ink">{t.blank}</span>
            <span id={blankHintId} className="mt-0.5 block text-[13px] text-ink-2">
              {t.blankHint}
            </span>
          </span>
          <EmptyGrid />
        </motion.button>

        <h3 className="mb-3 mt-8 font-display text-[17px] font-semibold tracking-[-0.01em]">{t.templates}</h3>
        <ul className="grid grid-cols-1 gap-2 @xl:grid-cols-2 @xl:gap-3 @6xl:grid-cols-3">
          {cards.map(({ tpl, preview }, i) => (
            <motion.li
              key={tpl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.04 + i * 0.035, duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
              className="min-w-0"
            >
              <TemplateCard tpl={tpl} preview={preview} locale={locale} onPick={onPick} />
            </motion.li>
          ))}
        </ul>

        <p className="mt-6 hidden items-center gap-1.5 text-[12px] text-ink-2 [@media(hover:hover)]:flex">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="mr-2">{t.keys}</span>
          <Kbd>Enter</Kbd>
          <span className="mr-2">{t.open}</span>
          <Kbd>Esc</Kbd>
          <span>{t.blankKey}</span>
        </p>
      </div>
    </section>
  );
}

function TemplateCard({ tpl, preview, locale, onPick }: { tpl: SheetTemplate; preview: CardPreview; locale: Locale; onPick: (wb: Workbook, template?: { id: string; title: string }) => void }) {
  const descId = useId();
  const title = resolveText(tpl.title, locale);
  const color = tpl.color ?? "blue";
  const Icon = ICONS[tpl.icon] ?? Table2;
  return (
    <button
      type="button"
      data-pick
      data-template={tpl.id}
      aria-label={title}
      aria-describedby={descId}
      onClick={() => onPick(tpl.build(locale), { id: tpl.id, title })}
      className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-raised text-left shadow-card transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-pop active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <MiniSheet preview={preview} color={color} />
      <span className="flex min-h-[64px] w-full items-center gap-3 p-3 @xl:items-start @xl:p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: sheetFill(color), color: sheetColor(color) }}>
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug text-ink">{title}</span>
          <span id={descId} className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">
            {resolveText(tpl.description, locale)}
            {/* For screen readers the tags read as part of the description; on screen they're pills. */}
            <span className="sr-only">. {preview.tags.join(", ")}</span>
          </span>
          {preview.tags.length > 0 && (
            <span aria-hidden className="mt-2 hidden flex-wrap gap-1 @xl:flex">
              {preview.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-line bg-surface px-1.5 py-px text-[12px] leading-[16px] text-ink-2">
                  {tag}
                </span>
              ))}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-3 @xl:hidden" />
      </span>
    </button>
  );
}

/** The first rows of the template's main table, and its chart as a thumbnail (when there is room). */
function MiniSheet({ preview, color }: { preview: CardPreview; color: SheetColor }) {
  const cols = preview.head.length;
  const grid = { gridTemplateColumns: `minmax(0,1.35fr) repeat(${Math.max(cols - 1, 0)}, minmax(0,1fr))` };
  return (
    <span aria-hidden className="relative hidden h-[104px] w-full gap-2 overflow-hidden border-b border-line bg-surface px-3 pt-3 @xl:flex">
      <span className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-md border border-b-0 border-line bg-raised text-[10.5px] leading-none">
        <span className="grid" style={{ ...grid, background: sheetFill(color), color: sheetColor(color) }}>
          {preview.head.map((h, i) => (
            <span key={i} className={cn("truncate px-1.5 py-[5px] font-semibold", i > 0 && "border-l border-line/60")}>
              {h}
            </span>
          ))}
        </span>
        {preview.rows.map((row, r) => (
          <span key={r} className="grid border-t border-line/70 text-ink-2" style={grid}>
            {row.map((cell, i) => (
              <span key={i} className={cn("truncate px-1.5 py-[5px] tabular-nums", i > 0 && "border-l border-line/60", cell.align === "right" && "text-right", cell.align === "center" && "text-center", cell.pending && "italic text-ink-3")}>
                {cell.text || " "}
              </span>
            ))}
          </span>
        ))}
      </span>
      {preview.chart && (
        <span className="mb-3 grid w-[92px] shrink-0 place-items-center self-stretch rounded-md border border-line bg-raised shadow-card">
          <ChartThumb chart={preview.chart} />
        </span>
      )}
      {/* The sheet goes on below: fade out the last row. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-surface to-transparent" />
    </span>
  );
}

function EmptyGrid() {
  // A few empty cells with the first one selected: "a blank sheet, ready for you".
  return (
    <span aria-hidden className="relative hidden h-[52px] w-[124px] shrink-0 overflow-hidden rounded-md border border-line bg-raised @xl:block">
      <span className="absolute inset-0 grid grid-cols-4 grid-rows-3">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={cn("border-line/80", i % 4 !== 3 && "border-r", i < 8 && "border-b")} />
        ))}
      </span>
      <span className="absolute left-0 top-0 h-[17px] w-[31px] rounded-[2px] border-2 border-blob bg-blob/10" />
      <span className="absolute left-[27px] top-[13px] size-[6px] rounded-[1px] border border-raised bg-blob" />
    </span>
  );
}

// ----------------------------------------------------------------------------------------------
// Chart thumbnail: the points, columns or line of the template's chart, nothing else.

type Thumb = {
  kind: ChartKind;
  logY: boolean;
  series: { color: SheetColor; points: { x: number; y: number }[]; line: boolean; trend: "linear" | "exponential" | null }[];
};

const W = 92;
const H = 60;
const PAD = 7;

function ChartThumb({ chart }: { chart: Thumb }) {
  const Fallback = chart.kind === "column" || chart.kind === "bar" ? ChartColumn : ChartScatter;
  const ty = (y: number) => (chart.logY ? Math.log10(y) : y);
  const all = chart.series.flatMap((s) => s.points).filter((p) => !chart.logY || p.y > 0);
  if (all.length < 2) return <Fallback className="size-6 text-ink-3" strokeWidth={1.6} />;
  const columns = chart.kind === "column" || chart.kind === "bar";
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => ty(p.y));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = columns ? Math.min(0, ...ys) : Math.min(...ys);
  const y1 = Math.max(...ys);
  const sx = (x: number) => (columns ? PAD + ((x - x0 + 0.5) / (x1 - x0 + 1)) * (W - 2 * PAD) : PAD + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * PAD));
  const sy = (y: number) => H - PAD - ((ty(y) - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
  const barW = ((W - 2 * PAD) / (x1 - x0 + 1)) * 0.6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
      <line x1={PAD - 2} x2={W - PAD + 2} y1={H - PAD + 0.5} y2={H - PAD + 0.5} stroke="var(--line-2)" strokeWidth={1} />
      {chart.series.map((s, i) => {
        const pts = s.points.filter((p) => !chart.logY || p.y > 0);
        const color = sheetColor(s.color);
        if (columns)
          return pts.map((p, j) => {
            const top = sy(Math.max(p.y, 0));
            return <rect key={`${i}-${j}`} x={sx(p.x) - barW / 2} y={top} width={barW} height={Math.max(H - PAD - top, 1)} rx={1.2} fill={color} opacity={0.85} />;
          });
        // The trendline from the first to the last point (an exponential one is fitted on ln y).
        const exp = s.trend === "exponential";
        const fit = s.trend && pts.length >= 2 ? fitLine(pts.map((p) => p.x), pts.map((p) => (exp ? Math.log(p.y) : p.y))) : null;
        const ends = fit ? [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))].map((x) => ({ x, y: exp ? Math.exp(fit.b + fit.m * x) : fit.b + fit.m * x })) : null;
        return (
          <g key={i}>
            {s.line ? (
              <polyline points={pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={1.2} opacity={0.55} />
            ) : null}
            {ends && (
              <line x1={sx(ends[0].x)} y1={sy(ends[0].y)} x2={sx(ends[1].x)} y2={sy(ends[1].y)} stroke={color} strokeWidth={1.3} strokeDasharray={i === 0 ? undefined : "3 2"} opacity={0.8} />
            )}
            {pts.map((p, j) => (
              <circle key={j} cx={sx(p.x)} cy={sy(p.y)} r={2.1} fill={color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Least squares, for the thumbnail's trendline (the real one comes from src/sheet/chart/regression.ts). */
function fitLine(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const m = sxx ? sxy / sxx : 0;
  return { m, b: my - m * mx };
}

// ----------------------------------------------------------------------------------------------
// What a card shows, read from the template's own workbook

type PreviewCell = { text: string; align: "left" | "center" | "right"; pending?: boolean };
type CardPreview = { head: string[]; rows: PreviewCell[][]; chart: Thumb | null; tags: string[] };

function previewOf(tpl: SheetTemplate, locale: Locale, t: Text): CardPreview {
  const wb = tpl.build(locale);
  const sheet = wb.sheets[0];
  const calc = tryCalc(wb, locale);
  const value = (sheetId: string, row: number, col: number): CellValue | undefined => {
    const s = wb.sheets.find((x) => x.id === sheetId);
    const cell = s?.cells[cellKey(row, col)];
    if (!cell) return null;
    if (cell.f === undefined) return cell.v ?? null;
    if (!calc) return undefined;
    try {
      return calc.value(sheetId, row, col);
    } catch {
      return undefined;
    }
  };

  const [r0, r1] = tpl.preview?.rows ?? [0, 3];
  const cols = tpl.preview?.cols ?? [0, 1, 2];
  const shown = (row: number, col: number): PreviewCell => {
    const v = value(sheet.id, row, col);
    // A formula the engine can't calculate yet: a quiet ƒx instead of a value.
    const style = sheet.cells[cellKey(row, col)]?.s;
    if (v === undefined) return { text: "ƒx", align: style?.align ?? "right", pending: true };
    return { text: show(v, style?.fmt, locale), align: style?.align ?? (typeof v === "number" ? "right" : typeof v === "string" ? "left" : "center") };
  };
  const head = cols.map((c) => shown(r0, c).text);
  const rows: PreviewCell[][] = [];
  for (let r = r0 + 1; r <= r1; r++) rows.push(cols.map((c) => shown(r, c)));

  const spec = wb.charts.find((c) => c.sheetId === sheet.id) ?? null;
  let chart: Thumb | null = null;
  if (spec) {
    const numbers = (ref: RangeRef | null, n: number): (number | null)[] => {
      if (!ref) return Array.from({ length: n }, (_, i) => i);
      const out: (number | null)[] = [];
      for (let r = ref.r0; r <= ref.r1; r++)
        for (let c = ref.c0; c <= ref.c1; c++) {
          const v = value(ref.sheetId, r, c);
          out.push(typeof v === "number" ? v : null);
        }
      return out;
    };
    chart = {
      kind: spec.kind,
      logY: spec.yAxis.log,
      series: spec.series.slice(0, 2).map((s, i) => {
        const ys = numbers(s.y, 0);
        const xs = spec.kind === "scatter" ? numbers(s.x ?? spec.x, ys.length) : ys.map((_, j) => j);
        const points = ys.flatMap((y, j) => (y !== null && xs[j] !== null && xs[j] !== undefined ? [{ x: xs[j]!, y }] : []));
        const type = s.trendline?.type;
        return {
          color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
          points,
          line: spec.kind === "line" || spec.kind === "area" || s.line !== "none",
          trend: type === "linear" || type === "exponential" ? type : null,
        };
      }),
    };
  }

  const tags: string[] = [];
  if (spec) {
    tags.push(t.kinds[spec.kind]);
    if (spec.series.some((s) => s.trendline)) tags.push(t.trendline);
    if (spec.series.some((s) => s.errorBars)) tags.push(t.errorBars);
    if (spec.yAxis.log || spec.xAxis.log) tags.push(t.logAxis);
  }
  if (wb.tables.length) tags.push(t.smartTable);
  tags.push(t.formulas(wb.sheets.reduce((n, s) => n + Object.values(s.cells).filter((c) => c.f !== undefined).length, 0)));
  return { head, rows, chart, tags: tags.slice(0, 3) };
}

function tryCalc(wb: Workbook, locale: Locale): Calc | null {
  try {
    return createCalc(wb, { locale });
  } catch {
    // The engine isn't there (yet): the previews show typed values and ƒx for formulas.
    return null;
  }
}

/** A value as the cell shows it; without the engine's formatter, a close imitation with Intl. */
function show(v: CellValue, fmt: NumberFormat | undefined, locale: Locale): string {
  try {
    return formatValue(v, fmt, locale);
  } catch {
    // fall through to the imitation below
  }
  if (v === null) return "";
  if (isError(v)) return v.error;
  if (typeof v === "boolean") return locale === "de" ? (v ? "WAHR" : "FALSCH") : v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  const tag = locale === "de" ? "de-DE" : "en-US";
  const unit = fmt && "unit" in fmt && fmt.unit ? ` ${fmt.unit}` : "";
  switch (fmt?.kind) {
    case "number":
      return new Intl.NumberFormat(tag, { minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals, useGrouping: !!fmt.group }).format(v) + unit;
    case "percent":
      return new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals }).format(v);
    case "significant":
      return new Intl.NumberFormat(tag, { maximumSignificantDigits: fmt.digits, useGrouping: false }).format(v) + unit;
    case "scientific":
      return new Intl.NumberFormat(tag, { notation: "scientific", minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals }).format(v) + unit;
    case "currency":
      return new Intl.NumberFormat(tag, { minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals }).format(v) + ` ${fmt.symbol}`;
    case "date":
    case "datetime":
      return new Intl.DateTimeFormat(tag, { timeZone: "UTC", day: locale === "de" ? "2-digit" : "numeric", month: locale === "de" ? "2-digit" : "numeric", year: "numeric" }).format(new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)));
    default:
      return new Intl.NumberFormat(tag, { maximumFractionDigits: 6, useGrouping: false }).format(v);
  }
}

/** Arrow keys between the choices: left and right in reading order, up and down to the nearest card in the row above or below. */
function nextItem(items: HTMLElement[], current: number, key: string): number | null {
  if (current < 0 || !items.length) return null;
  if (key === "Home") return 0;
  if (key === "End") return items.length - 1;
  if (key === "ArrowRight") return Math.min(items.length - 1, current + 1);
  if (key === "ArrowLeft") return Math.max(0, current - 1);
  const here = items[current].getBoundingClientRect();
  const down = key === "ArrowDown";
  const boxes = items.map((el, i) => ({ i, box: el.getBoundingClientRect() })).filter(({ box }) => (down ? box.top >= here.bottom - 1 : box.bottom <= here.top + 1));
  if (!boxes.length) return null;
  const rowTop = down ? Math.min(...boxes.map((b) => b.box.top)) : Math.max(...boxes.map((b) => b.box.top));
  const center = (b: DOMRect) => b.left + b.width / 2;
  return boxes.filter((b) => Math.abs(b.box.top - rowTop) < 4).reduce((best, b) => (Math.abs(center(b.box) - center(here)) < Math.abs(center(best.box) - center(here)) ? b : best)).i;
}
