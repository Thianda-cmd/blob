"use client";

// The charts floating on the sheet on screen (Grid overlay): tap to select, drag to move, handles
// to resize, double-tap or the settings button to open the chart panel, Delete to remove.
//
// CONTRACT: <ChartLayer store geom /> is passed as the Grid's overlay by SheetEditor.
//
// Touch and pen: a tap selects (a swipe that starts on a chart still scrolls the sheet), a
// selected chart follows the finger, a double tap opens its settings. Mouse: press and drag
// moves right away, double-click opens the settings. Keyboard (the chart has focus): Delete
// removes it, Enter opens its settings, arrows nudge it (Shift: 10 px), Alt + arrows resize it,
// Ctrl/⌘ + D duplicates it, Ctrl/⌘ + Z / Y undo and redo, Escape lets go of it.

import { Copy, ImageDown, Settings2, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useTouch } from "@/components/ui/useMediaQuery";
import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cn } from "@/lib/utils";
import { ChartView } from "@/sheet/chart/ChartView";
import { chartData, type ChartData } from "@/sheet/chart/data";
import type { Calc } from "@/sheet/engine";
import { DEFAULT_COL_W, type ChartSpec, type Sheet } from "@/sheet/types";
import type { GridGeometry } from "../grid/Grid";
import { useSheet, type SheetStore } from "../store";
import { deleteChart, duplicateChart, openChartPanel, quickTrendline, saveChartFile, updateChart } from "./actions";
import { selectChart, useChartUi } from "./selection";

/** The smallest a chart gets by resizing (logical px). */
export const CHART_MIN = { w: 240, h: 160 } as const;

type Box = { x: number; y: number; w: number; h: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Gesture = { pointerId: number; kind: "move" | Handle; startX: number; startY: number; base: Box; moved: boolean; touch: boolean; wasSelected: boolean; zoom: number };

const HANDLES: { h: Handle; x: number; y: number; cursor: CSSProperties["cursor"] }[] = [
  { h: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { h: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { h: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { h: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { h: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { h: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { h: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { h: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

/**
 * Content px per logical px: the grid's zoom (its geometry is already zoomed, so a chart's own
 * size and offset are multiplied by it). Measured from a column when a geometry doesn't say.
 */
function geomScale(geom: GridGeometry, sheet: Sheet | undefined): number {
  if (typeof geom.zoom === "number" && geom.zoom > 0) return geom.zoom;
  for (let c = 0; c < 30; c++) {
    const r = geom.rect(0, c);
    if (r.w > 0) {
      const w = sheet?.cols[String(c)]?.w ?? DEFAULT_COL_W;
      const k = r.w / w;
      return Number.isFinite(k) && k > 0.2 && k < 5 ? Math.round(k * 1000) / 1000 : 1;
    }
  }
  return 1;
}

/** The box after dragging (move) or pulling a handle by (dx, dy) content px; Shift keeps a corner's proportions. */
function dragged(base: Box, kind: "move" | Handle, dx: number, dy: number, scale: number, keepRatio: boolean): Box {
  if (kind === "move") return { ...base, x: Math.max(0, base.x + dx), y: Math.max(0, base.y + dy) };
  const minW = CHART_MIN.w * scale;
  const minH = CHART_MIN.h * scale;
  let { x, y, w, h } = base;
  if (kind.includes("e")) w = Math.max(minW, base.w + dx);
  if (kind.includes("w")) {
    w = Math.max(minW, base.w - dx);
    x = base.x + base.w - w;
  }
  if (kind.includes("s")) h = Math.max(minH, base.h + dy);
  if (kind.includes("n")) {
    h = Math.max(minH, base.h - dy);
    y = base.y + base.h - h;
  }
  if (keepRatio && kind.length === 2) {
    const ratio = base.w / base.h;
    if (w / h > ratio) h = Math.max(minH, w / ratio);
    else w = Math.max(minW, h * ratio);
    if (kind.includes("w")) x = base.x + base.w - w;
    if (kind.includes("n")) y = base.y + base.h - h;
  }
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  return { x, y, w: Math.max(minW, w), h: Math.max(minH, h) };
}

const EMPTY_DATA: ChartData = { categories: [], series: [], xDecimals: null, yDecimals: null };

/** A chart's data; a broken reference or an engine problem shows an empty chart, never a broken sheet. */
function safeChartData(spec: ChartSpec, calc: Calc, locale: Locale): ChartData {
  try {
    return chartData(spec, calc, locale);
  } catch (err) {
    console.error("chart data", err);
    return EMPTY_DATA;
  }
}

export function ChartLayer({ store, geom }: { store: SheetStore; geom: GridGeometry }): ReactNode {
  const charts = useSheet(store, (s) => s.workbook.charts);
  const sheets = useSheet(store, (s) => s.workbook.sheets);
  const calc = useSheet(store, (s) => s.calc);
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const focus = useSheet(store, (s) => s.focus);
  const ui = useChartUi(store);
  const scale = geomScale(
    geom,
    sheets.find((s) => s.id === geom.sheetId),
  );
  const panelChart = focus?.kind === "chart" ? focus.id : null;

  // A press anywhere else (a cell, the toolbar) lets go of the selected chart; its panel and the
  // menus and dialogs it opens don't.
  useEffect(() => {
    if (!ui.selected) return;
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-chart-card],[data-chart-panel],[role=dialog],[role=menu],[role=listbox]")) return;
      selectChart(store, null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [store, ui.selected]);

  return (
    <>
      {charts
        .filter((c) => c.sheetId === geom.sheetId)
        .map((spec) => (
          <ChartCard
            key={spec.id}
            store={store}
            spec={spec}
            calc={calc}
            locale={locale}
            geom={geom}
            scale={scale}
            readOnly={readOnly}
            selected={ui.selected === spec.id}
            panelOpen={panelChart === spec.id}
            highlight={panelChart === spec.id ? ui.series : null}
            reveal={ui.selected === spec.id ? ui.reveal : 0}
          />
        ))}
    </>
  );
}

function ChartCard({
  store,
  spec,
  calc,
  locale,
  geom,
  scale,
  readOnly,
  selected,
  panelOpen,
  highlight,
  reveal,
}: {
  store: SheetStore;
  spec: ChartSpec;
  calc: Calc;
  locale: Locale;
  geom: GridGeometry;
  scale: number;
  readOnly: boolean;
  selected: boolean;
  panelOpen: boolean;
  highlight: string | null;
  reveal: number;
}) {
  const t = sheetChartText[locale];
  const touch = useTouch();
  const hintId = useId();
  // Live values: a new Calc (any edit) reads the cells again.
  const data = useMemo(() => safeChartData(spec, calc, locale), [spec, calc, locale]);
  const anchor = geom.rect(spec.at.row, spec.at.col);
  const base: Box = { x: anchor.x + spec.at.dx * scale, y: anchor.y + spec.at.dy * scale, w: spec.size.w * scale, h: spec.size.h * scale };
  const [preview, setPreview] = useState<Box | null>(null);
  const [saving, setSaving] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const box = preview ?? base;

  // A chart just inserted or duplicated scrolls into view.
  useEffect(() => {
    if (reveal) cardRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [reveal]);

  /** Write the box as the chart's anchor cell + offset and size (logical px). */
  const commit = (next: Box, kind: "move" | Handle) => {
    const x = Math.max(0, next.x);
    const y = Math.max(0, next.y);
    const cell = geom.cellAt(x + 0.5, y + 0.5);
    const r = geom.rect(cell.row, cell.col);
    const at = { row: cell.row, col: cell.col, dx: Math.max(0, Math.round((x - r.x) / scale)), dy: Math.max(0, Math.round((y - r.y) / scale)) };
    const size = kind === "move" ? spec.size : { w: Math.round(next.w / scale), h: Math.round(next.h / scale) };
    updateChart(store, spec.id, kind === "move" ? t.undo.move : t.undo.resize, (c) => ({ ...c, at, size }));
  };

  const begin = (e: PointerEvent<HTMLElement>, kind: "move" | Handle) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    const isTouch = e.pointerType !== "mouse";
    // The grid may zoom with a CSS transform: screen px → content px.
    const zoom = Math.max(0.25, store.get().zoom / scale) || 1;
    gesture.current = { pointerId: e.pointerId, kind, startX: e.clientX, startY: e.clientY, base, moved: false, touch: isTouch, wasSelected: selected, zoom };
    // An unselected chart under a finger waits: a swipe scrolls the sheet, a tap selects.
    if (kind !== "move" || !isTouch || selected) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some WebViews refuse capture for pens; moving still works while over the chart.
      }
    }
    if (!isTouch) {
      selectChart(store, spec.id);
      cardRef.current?.focus({ preventScroll: true });
    }
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < (g.touch ? 8 : 4)) return;
    if (readOnly || (g.kind === "move" && g.touch && !g.wasSelected)) return;
    g.moved = true;
    setPreview(dragged(g.base, g.kind, dx / g.zoom, dy / g.zoom, scale, e.shiftKey));
  };

  const end = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    gesture.current = null;
    setPreview(null);
    if (g.moved) {
      commit(dragged(g.base, g.kind, (e.clientX - g.startX) / g.zoom, (e.clientY - g.startY) / g.zoom, scale, e.shiftKey), g.kind);
      return;
    }
    if (!g.touch || g.kind !== "move") return;
    // A tap: select; a second tap soon after opens the settings.
    selectChart(store, spec.id);
    cardRef.current?.focus({ preventScroll: true });
    const now = e.timeStamp;
    const prev = lastTap.current;
    if (prev && now - prev.t < 380 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap.current = null;
      if (!readOnly) openChartPanel(store, spec.id);
    } else lastTap.current = { t: now, x: e.clientX, y: e.clientY };
  };

  const cancel = () => {
    gesture.current = null;
    setPreview(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.ctrlKey || e.metaKey) {
      // The grid only listens to keys typed into it: undo, redo and duplicate work here too.
      const k = e.key.toLowerCase();
      if (k === "z" || k === "y") {
        e.preventDefault();
        e.stopPropagation();
        if (k === "y" || e.shiftKey) store.redo();
        else store.undo();
      } else if (k === "d" && !readOnly) {
        e.preventDefault();
        e.stopPropagation();
        duplicateChart(store, spec.id);
      }
      return;
    }
    e.stopPropagation();
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (!readOnly && selected) deleteChart(store, spec.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!readOnly) openChartPanel(store, spec.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      selectChart(store, null);
      cardRef.current?.blur();
    } else if (arrows[e.key] && !readOnly && selected) {
      e.preventDefault();
      const [ax, ay] = arrows[e.key];
      const step = e.shiftKey ? 10 : 1;
      if (e.altKey) {
        const w = Math.max(CHART_MIN.w, spec.size.w + ax * step * 10);
        const h = Math.max(CHART_MIN.h, spec.size.h + ay * step * 10);
        updateChart(store, spec.id, t.undo.resize, (c) => ({ ...c, size: { w, h } }));
      } else commit({ ...base, x: base.x + ax * step * scale, y: base.y + ay * step * scale }, "move");
    }
  };

  const savePng = async () => {
    setSaving(true);
    await saveChartFile(store, spec.id, "png");
    setSaving(false);
  };

  const kindName = t.kindNames[spec.kind];
  const hit = touch ? 36 : 16;
  const dot = touch ? 14 : 9;
  const barAbove = box.y >= 52;
  const wide = box.w >= 380;

  return (
    <div
      ref={cardRef}
      data-chart-card={spec.id}
      role="figure"
      tabIndex={0}
      aria-label={t.chartLabel(kindName, spec.title.trim())}
      aria-describedby={hintId}
      aria-keyshortcuts="Delete Enter Escape"
      className={cn("pointer-events-auto absolute select-none outline-none", selected ? "z-[3]" : "z-[2]")}
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        touchAction: selected && !readOnly ? "none" : "auto",
        cursor: selected && !readOnly ? (preview ? "grabbing" : "grab") : "pointer",
      }}
      onPointerDown={(e) => begin(e, "move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      onLostPointerCapture={(e) => gesture.current?.pointerId === e.pointerId && gesture.current.moved && end(e)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!readOnly) openChartPanel(store, spec.id);
      }}
      // Reached with Tab: selected, so the frame shows where the keyboard is.
      onFocus={(e) => e.target === e.currentTarget && !selected && selectChart(store, spec.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        selectChart(store, spec.id);
      }}
      onKeyDown={onKeyDown}
    >
      <span id={hintId} hidden>
        {t.moveHint}
      </span>
      <div
        className={cn(
          "h-full w-full overflow-hidden rounded-xl bg-raised shadow-card transition-shadow",
          selected ? "ring-2 ring-blob" : panelOpen ? "ring-2 ring-blob/45" : "ring-1 ring-line hover:ring-line-2",
          preview && "shadow-pop",
        )}
      >
        <ChartView spec={spec} data={data} width={box.w} height={box.h} locale={locale} interactive={!preview} selectedSeries={highlight} />
      </div>

      {selected &&
        !readOnly &&
        HANDLES.map(({ h, x, y, cursor }) => (
          <div
            key={h}
            aria-hidden
            title={t.resize}
            className="absolute grid place-items-center"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: hit, height: hit, marginLeft: -hit / 2, marginTop: -hit / 2, cursor, touchAction: "none" }}
            onPointerDown={(e) => begin(e, h)}
          >
            <span className="block rounded-[3px] border-[1.5px] border-blob bg-raised shadow-card" style={{ width: dot, height: dot }} />
          </div>
        ))}

      {selected && !preview && (
        <div
          role="toolbar"
          aria-label={t.chartLabel(kindName, spec.title.trim())}
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-line bg-raised p-1 shadow-pop"
          style={{ top: barAbove ? -48 : box.h + 10 }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key !== "Tab" && e.stopPropagation()}
        >
          {!readOnly && (
            <BarButton label={t.settings} showLabel={wide} onClick={() => openChartPanel(store, spec.id)}>
              <Settings2 />
            </BarButton>
          )}
          {!readOnly && spec.kind !== "pie" && (
            <BarButton label={t.trendline} title={t.addTrendline} showLabel={wide} onClick={() => quickTrendline(store, spec.id)}>
              <TrendingUp />
            </BarButton>
          )}
          {!readOnly && (
            <BarButton label={t.duplicate} onClick={() => duplicateChart(store, spec.id)}>
              <Copy />
            </BarButton>
          )}
          <BarButton label={t.saveImage} onClick={savePng} disabled={saving}>
            <ImageDown />
          </BarButton>
          {!readOnly && (
            <BarButton label={t.remove} danger onClick={() => deleteChart(store, spec.id)}>
              <Trash2 />
            </BarButton>
          )}
        </div>
      )}
    </div>
  );
}

function BarButton({ label, title, showLabel, danger, disabled, onClick, children }: { label: string; title?: string; showLabel?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-40 [@media(hover:none)]:h-9 [&_svg]:size-4 [&_svg]:shrink-0",
        showLabel ? "px-2.5" : "w-8 justify-center [@media(hover:none)]:w-9",
        danger ? "text-ink-3 hover:bg-danger/10 hover:text-danger" : "text-ink-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
      {showLabel && <span>{label}</span>}
    </button>
  );
}
