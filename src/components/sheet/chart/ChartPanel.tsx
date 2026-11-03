"use client";

// A chart's settings: type, data (series, x values, names), trendline (type, order, intercept,
// equation, R², forecast), error bars, axes (titles, min/max, log scale, grid), look, legend;
// export as PNG/SVG; add to a note. Side panel on wide screens, bottom sheet on phones (SheetEditor decides).
//
// CONTRACT: <ChartPanel store chartId onClose /> is placed by SheetEditor.
//
// Every change is one undo step with its own name ("Trendlinie ändern"); typed text and numbers
// are saved when you leave the field. Sections fold, so the panel stays short on a phone.

import {
  Axis3d,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  Database,
  FileDown,
  ImageDown,
  Info,
  NotebookPen,
  Palette,
  Plus,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { usePhone } from "@/components/ui/useMediaQuery";
import type { Locale } from "@/i18n/config";
import { sheetChartText, type SheetChartText } from "@/i18n/messages/sheetChart";
import { cn } from "@/lib/utils";
import { ChartView } from "@/sheet/chart/ChartView";
import { newSeries } from "@/sheet/chart/create";
import { chartData, seriesColor, type ChartData, type ChartSeriesData } from "@/sheet/chart/data";
import type { Calc } from "@/sheet/engine";
import type { AxisSpec, ChartKind, ChartSpec, ErrorBarSpec, RangeRef, SeriesSpec, Workbook } from "@/sheet/types";
import { AddToNoteDialog } from "../embed/AddToNote";
import { useSheet, type SheetStore } from "../store";
import { deleteChart, saveChartFile, updateChart } from "./actions";
import { Chips, Field, Note, NumberField, RangeField, Section, SeriesPicker, Swatches, TextField, Toggle } from "./PanelParts";
import { selectionRef } from "./ranges";
import { setChartUi, useChartUi, type ChartSection } from "./selection";
import { TrendSection, XTextNote } from "./TrendSection";

const KIND_ICONS: Record<ChartKind, ReactNode> = {
  scatter: <ChartScatter className="size-5" />,
  line: <ChartLine className="size-5" />,
  column: <ChartColumn className="size-5" />,
  bar: <ChartBar className="size-5" />,
  area: <ChartArea className="size-5" />,
  pie: <ChartPie className="size-5" />,
};
const KINDS: ChartKind[] = ["scatter", "line", "column", "bar", "area", "pie"];

/** The live preview at the top of a docked panel is at most this tall (px), so the settings keep room. */
const PREVIEW_MAX_H = 230;
/** Room a chart on the sheet needs besides its own height: its action bar and a margin (px, see ChartLayer). */
const CHART_EXTRA_H = 52 + 2 * 12;

/**
 * Whether the docked panel would cover the chart: SheetEditor docks the settings over the lower
 * part of the editor when it is narrow (phones, tablets held upright, small windows) instead of
 * beside the grid (an <aside>), and the chart, `chartHeight` px with its action bar, doesn't fit
 * in the room left above them. Then the panel shows the chart itself. (When it fits, ChartLayer
 * scrolls it into that room.) Measured again when the editor or the panel changes size.
 */
function useCoveredChart(ref: RefObject<HTMLElement | null>, chartHeight: number): boolean {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.closest("aside")) return;
    const editor = el.closest<HTMLElement>("[data-sheet-editor]");
    const measure = () => {
      const dock = editor?.querySelector<HTMLElement>(":scope > [data-sheet-dock]");
      const grid = editor?.querySelector<HTMLElement>("[data-sheet-grid]");
      const cells = grid?.querySelector<HTMLElement>("[data-grid-overlay]")?.offsetParent;
      if (!editor || !dock || !grid) {
        setCovered(true);
        return;
      }
      // Without the slide-in animation's transform: where the docked panel ends up.
      const dockTop = editor.getBoundingClientRect().top + editor.clientTop + dock.offsetTop;
      const cellsTop = grid.getBoundingClientRect().top + grid.clientTop + (cells instanceof HTMLElement ? cells.offsetTop : 0);
      setCovered(chartHeight + CHART_EXTRA_H > dockTop - cellsTop);
    };
    // A ResizeObserver reports once as soon as it observes, and again on every change of size.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (editor) ro.observe(editor);
    return () => ro.disconnect();
  }, [ref, chartHeight]);
  return covered;
}

function safeData(spec: ChartSpec, calc: Calc, locale: Locale): ChartData {
  try {
    return chartData(spec, calc, locale);
  } catch (err) {
    console.error("chart data", err);
    return { categories: [], series: [], xDecimals: null, yDecimals: null };
  }
}

export function ChartPanel({ store, chartId, onClose }: { store: SheetStore; chartId: string; onClose: () => void }): ReactNode {
  const spec = useSheet(store, (s) => s.workbook.charts.find((c) => c.id === chartId));
  const wb = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const pageId = useSheet(store, (s) => s.pageId);
  const t = sheetChartText[locale];

  if (!spec) {
    return (
      <div data-chart-panel className="flex h-full flex-col" aria-label={t.panel}>
        <PanelHeader title={t.chart} t={t} onClose={onClose} />
        <div className="p-4">
          <Note icon={<Info />}>{t.gone}</Note>
        </div>
      </div>
    );
  }
  return <PanelBody key={spec.id} store={store} spec={spec} wb={wb} calc={calc} locale={locale} readOnly={readOnly} pageId={pageId} t={t} onClose={onClose} />;
}

/**
 * The chart at the top of a docked panel, drawn for the size it gets (at most PREVIEW_MAX_H tall),
 * like a chart in a note: its text stays readable instead of shrinking with the picture.
 */
function PreviewChart({ spec, data, locale, selectedSeries }: { spec: ChartSpec; data: ChartData; locale: Locale; selectedSeries: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ratio = Math.max(1, spec.size.h) / Math.max(1, spec.size.w);
  return (
    <div ref={box} className="mx-auto overflow-hidden rounded-xl bg-raised shadow-card ring-1 ring-line" style={{ maxWidth: Math.round(PREVIEW_MAX_H / ratio) }}>
      {width > 0 ? (
        <ChartView spec={spec} data={data} width={width} height={Math.round(width * ratio)} locale={locale} selectedSeries={selectedSeries} />
      ) : (
        <div style={{ aspectRatio: `${spec.size.w} / ${spec.size.h}` }} />
      )}
    </div>
  );
}

function PanelHeader({ title, t, onClose, icon }: { title: string; t: SheetChartText; onClose: () => void; icon?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
      {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
      <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-semibold text-ink">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={t.close}
        title={t.close}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function PanelBody({
  store,
  spec,
  wb,
  calc,
  locale,
  readOnly,
  pageId,
  t,
  onClose,
}: {
  store: SheetStore;
  spec: ChartSpec;
  wb: Workbook;
  calc: Calc;
  locale: Locale;
  readOnly: boolean;
  pageId: string;
  t: SheetChartText;
  onClose: () => void;
}) {
  const ui = useChartUi(store);
  const phone = usePhone();
  const zoom = useSheet(store, (s) => s.zoom);
  const root = useRef<HTMLDivElement>(null);
  const covered = useCoveredChart(root, spec.size.h * zoom);
  const data = useMemo(() => safeData(spec, calc, locale), [spec, calc, locale]);
  const [open, setOpen] = useState<Set<ChartSection>>(() => new Set<ChartSection>(spec.kind === "scatter" ? ["chart", "trend"] : ["chart", "data"]));
  const [noteOpen, setNoteOpen] = useState(false);
  const [saving, setSaving] = useState<"png" | "svg" | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // A section asked for from outside (the card's "Trendlinie" button) is open and in view.
  const isOpen = (id: ChartSection) => open.has(id) || ui.section === id;
  useEffect(() => {
    if (!ui.section) return;
    scroller.current?.querySelector(`[data-chart-section="${ui.section}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [ui.section]);
  const toggle = (id: ChartSection) => {
    // The section asked for from outside stays open as an ordinary open section.
    const forced = ui.section;
    if (forced) setChartUi(store, { section: null });
    setOpen((prev) => {
      const next = new Set(prev);
      if (forced) next.add(forced);
      if (prev.has(id) || forced === id) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seriesId = ui.series && spec.series.some((s) => s.id === ui.series) ? ui.series : (spec.series[0]?.id ?? "");
  const current = spec.series.find((s) => s.id === seriesId) ?? null;
  const currentData = data.series.find((s) => s.id === seriesId);
  const seriesChoices = spec.series.map((s, i) => ({ id: s.id, name: data.series[i]?.name ?? s.name, color: seriesColor(s, i) }));
  const picker = <SeriesPicker label={t.series} series={seriesChoices} value={seriesId} onChange={(id) => setChartUi(store, { series: id })} />;

  const change = (label: string, fn: (c: ChartSpec) => ChartSpec) => !readOnly && updateChart(store, spec.id, label, fn);
  const changeSeries = (label: string, id: string, fn: (s: SeriesSpec) => SeriesSpec) => change(label, (c) => ({ ...c, series: c.series.map((s) => (s.id === id ? fn(s) : s)) }));
  const fromSelection = (): RangeRef => selectionRef(store.get());
  const scatter = spec.kind === "scatter";
  const lineKind = spec.kind === "scatter" || spec.kind === "line";
  // Text among the chart's x values (of a series that has no x values of its own).
  const sharedXText = scatter ? data.series.find((d, i) => d.xText && !spec.series[i]?.x)?.xText : undefined;

  const changeKind = (kind: ChartKind) =>
    change(t.undo.kind, (c) => ({
      ...c,
      kind,
      series: c.series.map((s) => {
        const wasLine = c.kind === "scatter" || c.kind === "line";
        return {
          ...s,
          marker: (kind === "scatter" || kind === "line") && !wasLine && s.marker === "none" ? "circle" : s.marker,
          line: kind === "line" && s.line === "none" && c.kind !== "scatter" ? "straight" : s.line,
        };
      }),
    }));

  const save = async (format: "png" | "svg") => {
    setSaving(format);
    const ok = await saveChartFile(store, spec.id, format);
    setSaving(null);
    setSaveFailed(!ok);
  };

  const addSeries = () => {
    const sel = fromSelection();
    const last = spec.series[spec.series.length - 1];
    const multi = sel.r0 !== sel.r1 || sel.c0 !== sel.c1;
    // The selection when it is a range, else the column next to the last series.
    const y: RangeRef = multi ? sel : last ? { ...last.y, c0: last.y.c1 + 1, c1: last.y.c1 + 1 } : { ...sel };
    const s = newSeries(spec.kind, y);
    change(t.undo.addSeries, (c) => ({ ...c, series: [...c.series, s], legend: c.series.length >= 1 && c.legend === "none" ? "bottom" : c.legend }));
    setChartUi(store, { series: s.id });
  };

  return (
    <div ref={root} data-chart-panel={spec.id} className="@container/chartpanel flex h-full min-h-0 flex-col bg-surface" role="region" aria-label={t.panel}>
      <PanelHeader title={spec.title.trim() || t.kindNames[spec.kind]} icon={KIND_ICONS[spec.kind]} t={t} onClose={onClose} />
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* Docked at the bottom, the panel can cover the chart on the sheet: the chart, live, on top. */}
        {(phone || covered) && (
          <div className="border-b border-line bg-paper/60 p-3" data-chart-preview="">
            <PreviewChart spec={spec} data={data} locale={locale} selectedSeries={ui.series} />
          </div>
        )}

        <Section id="chart" title={t.sections.chart} icon={<SlidersHorizontal />} open={isOpen("chart")} onToggle={() => toggle("chart")}>
          <Field label={t.chartType}>
            <Chips label={t.chartType} value={spec.kind} size="tile" columns={3} onChange={changeKind} options={KINDS.map((k) => ({ value: k, label: t.kinds[k], icon: KIND_ICONS[k], title: t.kindHints[k], disabled: readOnly }))} />
          </Field>
          <Field label={t.title}>
            <TextField value={spec.title} placeholder={t.titlePlaceholder} label={t.title} onCommit={(v) => change(t.undo.title, (c) => ({ ...c, title: v.trim() }))} />
          </Field>
          <Field label={t.legend}>
            <Segmented
              label={t.legend}
              value={spec.legend}
              options={(["top", "right", "bottom", "none"] as const).map((v) => ({ value: v, label: t.legendPos[v] }))}
              onChange={(v) => change(t.undo.legend, (c) => ({ ...c, legend: v }))}
            />
          </Field>
        </Section>

        <Section id="data" title={t.sections.data} icon={<Database />} open={isOpen("data")} onToggle={() => toggle("data")}>
          {spec.series.map((s, i) => (
            <SeriesCard
              key={s.id}
              s={s}
              index={i}
              name={data.series[i]?.name ?? s.name}
              xText={s.x ? data.series[i]?.xText : undefined}
              spec={spec}
              wb={wb}
              t={t}
              readOnly={readOnly}
              onChange={(fn) => changeSeries(t.undo.series, s.id, fn)}
              onRemove={spec.series.length > 1 ? () => change(t.undo.removeSeries, (c) => ({ ...c, series: c.series.filter((x) => x.id !== s.id) })) : undefined}
              fromSelection={fromSelection}
            />
          ))}
          {!readOnly && spec.kind !== "pie" && (
            <button
              type="button"
              onClick={addSeries}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-blob hover:text-blob-ink [@media(hover:none)]:h-10"
            >
              <Plus className="size-4" />
              {t.addSeries}
            </button>
          )}
          <RangeField
            label={scatter ? t.xShared : t.categories}
            value={spec.x}
            wb={wb}
            hostSheetId={spec.sheetId}
            allowEmpty
            hint={t.noX}
            t={t}
            onCommit={(r) => change(t.undo.x, (c) => ({ ...c, x: r }))}
            onUseSelection={readOnly ? undefined : () => change(t.undo.x, (c) => ({ ...c, x: fromSelection() }))}
          />
          {sharedXText && <XTextNote xText={sharedXText} t={t} />}
        </Section>

        {spec.kind !== "pie" && current && (
          <Section id="trend" title={t.sections.trend} icon={<TrendingUp />} open={isOpen("trend")} onToggle={() => toggle("trend")}>
            <TrendSection store={store} spec={spec} series={current} data={currentData} xFormat={data.xFormat} locale={locale} t={t} readOnly={readOnly} picker={picker} />
          </Section>
        )}

        {spec.kind !== "pie" && current && (
          <Section id="errors" title={t.sections.errors} icon={<ErrorBarIcon />} open={isOpen("errors")} onToggle={() => toggle("errors")}>
            {picker}
            <ErrorBars
              eb={current.errorBars}
              wb={wb}
              spec={spec}
              locale={locale}
              t={t}
              readOnly={readOnly}
              fromSelection={fromSelection}
              onChange={(eb) => changeSeries(t.undo.errors, current.id, (s) => ({ ...s, errorBars: eb }))}
            />
          </Section>
        )}

        {spec.kind !== "pie" && (
          <Section id="axes" title={t.sections.axes} icon={<Axis3d />} open={isOpen("axes")} onToggle={() => toggle("axes")}>
            <AxisFields
              title={spec.kind === "bar" ? t.axisCategories : scatter ? t.axisX : t.axisCategories}
              axis={spec.xAxis}
              numeric={scatter}
              locale={locale}
              t={t}
              onChange={(a) => change(t.undo.axis, (c) => ({ ...c, xAxis: a }))}
            />
            <div className="h-px bg-line" />
            <AxisFields title={spec.kind === "bar" ? t.axisValues : t.axisY} axis={spec.yAxis} numeric locale={locale} t={t} onChange={(a) => change(t.undo.axis, (c) => ({ ...c, yAxis: a }))} />
          </Section>
        )}

        {current && (
          <Section id="look" title={t.sections.look} icon={<Palette />} open={isOpen("look")} onToggle={() => toggle("look")}>
            {spec.kind !== "pie" && picker}
            {spec.kind !== "pie" && (
              <Field label={t.color}>
                <Swatches
                  label={t.color}
                  value={current.color}
                  autoColor={seriesColor({ color: null }, spec.series.indexOf(current))}
                  t={t}
                  onChange={(color) => changeSeries(t.undo.look, current.id, (s) => ({ ...s, color }))}
                />
              </Field>
            )}
            {lineKind && (
              <Field label={t.marker}>
                <Chips
                  label={t.marker}
                  value={current.marker}
                  onChange={(marker) => changeSeries(t.undo.look, current.id, (s) => ({ ...s, marker }))}
                  options={(["none", "circle", "square", "triangle", "diamond"] as const).map((m) => ({ value: m, label: t.markers[m], icon: <MarkerGlyph kind={m} /> }))}
                />
              </Field>
            )}
            {lineKind && (
              <Field label={t.line}>
                <Segmented
                  label={t.line}
                  value={current.line}
                  options={(["none", "straight", "smooth"] as const).map((v) => ({ value: v, label: t.lines[v] }))}
                  onChange={(line) => changeSeries(t.undo.look, current.id, (s) => ({ ...s, line }))}
                />
              </Field>
            )}
            <Toggle label={t.dataLabels} checked={current.labels} disabled={readOnly} onChange={(labels) => changeSeries(t.undo.look, current.id, (s) => ({ ...s, labels }))} />
          </Section>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-line bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {saveFailed && (
          <p className="text-[12px] text-danger" role="alert">
            {t.saveFailed}
          </p>
        )}
        {/* Docked across a tablet's width: one row, so the settings above keep their room. */}
        <div className="grid grid-cols-2 gap-2 @[540px]/chartpanel:flex @[540px]/chartpanel:items-center">
          <FooterButton onClick={() => save("png")} busy={saving === "png"} icon={<ImageDown />} label={t.exportPng}>
            {t.exportPngShort}
          </FooterButton>
          <FooterButton onClick={() => save("svg")} busy={saving === "svg"} icon={<FileDown />} label={t.exportSvg}>
            {t.exportSvgShort}
          </FooterButton>
          {!readOnly && pageId && (
            <FooterButton onClick={() => setNoteOpen(true)} icon={<NotebookPen />} className="col-span-2">
              {t.addToNote}
            </FooterButton>
          )}
          {!readOnly && (
            <FooterButton
              onClick={() => {
                deleteChart(store, spec.id);
                onClose();
              }}
              icon={<Trash2 />}
              danger
              className="col-span-2 @[540px]/chartpanel:ml-auto"
            >
              {t.deleteChart}
            </FooterButton>
          )}
        </div>
      </div>
      {pageId && <AddToNoteDialog open={noteOpen} onClose={() => setNoteOpen(false)} pageId={pageId} item={{ kind: "chart", chartId: spec.id }} />}
    </div>
  );
}

function FooterButton({ onClick, icon, children, label, busy, danger, className }: { onClick: () => void; icon: ReactNode; children: ReactNode; label?: string; busy?: boolean; danger?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={busy}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 [@media(hover:none)]:h-10 [&_svg]:size-4 [&_svg]:shrink-0",
        danger ? "border-transparent text-danger hover:bg-danger/10" : "border-line bg-raised text-ink-2 shadow-card hover:border-line-2 hover:text-ink",
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** Error bars drawn as an icon: a point with a bar and caps (lucide has none). */
function ErrorBarIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M8 2.5v11M5.5 2.5h5M5.5 13.5h5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MarkerGlyph({ kind }: { kind: SeriesSpec["marker"] }) {
  const d: Record<SeriesSpec["marker"], string> = {
    none: "M2 7h10",
    circle: "M3.5 7a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0",
    square: "M4 4h6v6h-6z",
    triangle: "M7 3l3.6 6.5h-7.2z",
    diamond: "M7 2.6l4 4.4l-4 4.4l-4 -4.4z",
  };
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
      <path d={d[kind]} fill={kind === "none" ? "none" : "currentColor"} stroke="currentColor" strokeWidth={kind === "none" ? 1.5 : 0} strokeDasharray={kind === "none" ? "2 2" : undefined} />
    </svg>
  );
}

function SeriesCard({
  s,
  index,
  name,
  xText,
  spec,
  wb,
  t,
  readOnly,
  onChange,
  onRemove,
  fromSelection,
}: {
  s: SeriesSpec;
  index: number;
  name: string;
  /** Text among this series' own x values. */
  xText?: ChartSeriesData["xText"];
  spec: ChartSpec;
  wb: Workbook;
  t: SheetChartText;
  readOnly: boolean;
  onChange: (fn: (s: SeriesSpec) => SeriesSpec) => void;
  onRemove?: () => void;
  fromSelection: () => RangeRef;
}) {
  const [fromCell, setFromCell] = useState(s.nameRef !== null);
  const color = seriesColor(s, index);
  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-raised p-3">
      <div className="flex items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--sheet-${color})` }} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
        {onRemove && !readOnly && (
          <button type="button" onClick={onRemove} aria-label={`${t.removeSeries}: ${name}`} title={t.removeSeries} className="grid size-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-danger/10 hover:text-danger [@media(hover:none)]:size-8">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <Field
        label={t.seriesName}
        action={
          <Segmented
            size="sm"
            label={t.seriesName}
            value={fromCell ? "cell" : "text"}
            options={[
              { value: "text", label: t.nameTyped },
              { value: "cell", label: t.nameFromCell },
            ]}
            onChange={(v) => {
              setFromCell(v === "cell");
              if (v === "text" && s.nameRef) onChange((x) => ({ ...x, name: x.name || name, nameRef: null }));
            }}
          />
        }
      >
        {fromCell ? (
          <RangeField
            label={`${t.seriesName}: ${t.nameFromCell}`}
            hideLabel
            value={s.nameRef}
            wb={wb}
            hostSheetId={spec.sheetId}
            single
            allowEmpty
            t={t}
            onCommit={(r) => onChange((x) => ({ ...x, nameRef: r }))}
            onUseSelection={readOnly ? undefined : () => onChange((x) => ({ ...x, nameRef: { ...fromSelection(), r1: fromSelection().r0, c1: fromSelection().c0 } }))}
          />
        ) : (
          <TextField value={s.name} placeholder={name} label={t.seriesName} onCommit={(v) => onChange((x) => ({ ...x, name: v.trim(), nameRef: null }))} />
        )}
      </Field>
      <RangeField
        label={spec.kind === "scatter" ? t.yValues : t.values}
        value={s.y}
        wb={wb}
        hostSheetId={spec.sheetId}
        t={t}
        onCommit={(r) => r && onChange((x) => ({ ...x, y: r }))}
        onUseSelection={readOnly ? undefined : () => onChange((x) => ({ ...x, y: fromSelection() }))}
      />
      {spec.kind === "scatter" && (
        <RangeField
          label={t.xOwn}
          value={s.x}
          wb={wb}
          hostSheetId={spec.sheetId}
          allowEmpty
          hint={t.xOwnHint}
          t={t}
          onCommit={(r) => onChange((x) => ({ ...x, x: r }))}
          onUseSelection={readOnly ? undefined : () => onChange((x) => ({ ...x, x: fromSelection() }))}
        />
      )}
      {xText && <XTextNote xText={xText} t={t} />}
    </div>
  );
}

type EbKind = ErrorBarSpec["kind"] | "none";

function ErrorBars({
  eb,
  wb,
  spec,
  locale,
  t,
  readOnly,
  fromSelection,
  onChange,
}: {
  eb: ErrorBarSpec | null;
  wb: Workbook;
  spec: ChartSpec;
  locale: Locale;
  t: SheetChartText;
  readOnly: boolean;
  fromSelection: () => RangeRef;
  onChange: (eb: ErrorBarSpec | null) => void;
}) {
  const kind: EbKind = eb?.kind ?? "none";
  const defaults: Record<ErrorBarSpec["kind"], number> = { fixed: 1, percent: 5, stdev: 1, stderr: 1, custom: 0 };
  const choose = (k: EbKind) => {
    if (k === "none") return onChange(null);
    onChange({ kind: k, value: eb?.kind === k ? eb.value : defaults[k], plus: eb?.plus ?? null, minus: eb?.minus ?? null, direction: eb?.direction ?? "both" });
  };
  return (
    <div className="space-y-3.5">
      <Chips
        label={t.sections.errors}
        value={kind}
        columns={2}
        onChange={(k) => !readOnly && choose(k)}
        options={(["none", "fixed", "percent", "stdev", "stderr", "custom"] as const).map((k) => ({ value: k, label: t.errorKinds[k], disabled: readOnly }))}
      />
      {eb && (eb.kind === "fixed" || eb.kind === "percent" || eb.kind === "stdev") && (
        <Field label={eb.kind === "fixed" ? t.errorAmount : eb.kind === "percent" ? t.errorPercent : t.errorFactor}>
          <NumberField locale={locale} value={eb.value} min={0} onCommit={(v) => v !== null && onChange({ ...eb, value: v })} label={t.errorAmount} className="w-32" />
        </Field>
      )}
      {eb?.kind === "stderr" && <p className="text-[11.5px] leading-snug text-ink-3">{t.stderrHint}</p>}
      {eb?.kind === "custom" && (
        <>
          <RangeField label={t.errorPlus} value={eb.plus} wb={wb} hostSheetId={spec.sheetId} allowEmpty t={t} onCommit={(r) => onChange({ ...eb, plus: r })} onUseSelection={readOnly ? undefined : () => onChange({ ...eb, plus: fromSelection() })} />
          <RangeField
            label={t.errorMinus}
            value={eb.minus}
            wb={wb}
            hostSheetId={spec.sheetId}
            allowEmpty
            hint={t.errorMinusSame}
            t={t}
            onCommit={(r) => onChange({ ...eb, minus: r })}
            onUseSelection={readOnly ? undefined : () => onChange({ ...eb, minus: fromSelection() })}
          />
        </>
      )}
      {eb && (
        <Field label={t.direction}>
          <Segmented label={t.direction} value={eb.direction} options={(["both", "plus", "minus"] as const).map((d) => ({ value: d, label: t.directions[d] }))} onChange={(direction) => onChange({ ...eb, direction })} />
        </Field>
      )}
      <Note icon={<Info />}>{t.errorHint}</Note>
    </div>
  );
}

function AxisFields({ title, axis, numeric, locale, t, onChange }: { title: string; axis: AxisSpec; numeric: boolean; locale: Locale; t: SheetChartText; onChange: (a: AxisSpec) => void }) {
  const decimals = axis.decimals === null ? "auto" : String(axis.decimals);
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
      <Field label={t.axisTitle}>
        <TextField value={axis.title} label={`${title}: ${t.axisTitle}`} onCommit={(v) => onChange({ ...axis, title: v.trim() })} />
      </Field>
      {numeric && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.min}>
              <NumberField locale={locale} value={axis.min} allowEmpty placeholder={t.auto} label={`${title}: ${t.min}`} onCommit={(v) => onChange({ ...axis, min: v })} />
            </Field>
            <Field label={t.max}>
              <NumberField locale={locale} value={axis.max} allowEmpty placeholder={t.auto} label={`${title}: ${t.max}`} onCommit={(v) => onChange({ ...axis, max: v })} />
            </Field>
          </div>
          <Toggle label={t.logScale} checked={axis.log} onChange={(log) => onChange({ ...axis, log })} />
          <Field label={t.decimals}>
            <Segmented
              size="sm"
              label={`${title}: ${t.decimals}`}
              value={decimals}
              options={["auto", "0", "1", "2", "3", "4"].map((v) => ({ value: v, label: v === "auto" ? t.auto : v }))}
              onChange={(v) => onChange({ ...axis, decimals: v === "auto" ? null : Number(v) })}
            />
          </Field>
        </>
      )}
      <Toggle label={t.gridlines} checked={axis.grid} onChange={(grid) => onChange({ ...axis, grid })} />
    </div>
  );
}
