"use client";

// The charts floating on the sheet on screen (Grid overlay): tap to select, drag to move, handles
// to resize, double-tap or the settings button to open the chart panel, Delete to remove.
//
// CONTRACT: <ChartLayer store geom /> is passed as the Grid's overlay by SheetEditor.
//
// Touch: a tap selects, a double tap opens the settings, a swipe that starts on a chart scrolls
// the sheet (selected or not), and a selected chart held still for a moment is picked up and
// follows the finger. Mouse and pen: press and drag moves right away, double-click (double tap)
// opens the settings. Keyboard (the chart has focus, also right after it is inserted or
// duplicated): Delete removes it, Enter opens its settings and goes into them, arrows nudge it
// (Shift: 10 px), Alt + arrows resize it, Ctrl/⌘ + D duplicates it, Ctrl/⌘ + Z / Y undo and redo,
// Escape lets go of it and closes its settings. The selected frame always shows where the
// keyboard is: when it goes back into the cells, the chart is let go of.
//
// Opening the settings scrolls the chart into view without pushing the cells it is made from out
// of view, and closing them scrolls back (not for a new chart: it stays in view); what can't be
// seen, the panel shows itself (inView, decided before the panel is first painted).

import { Copy, ImageDown, Settings2, Trash2, TrendingUp } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTouch } from "@/components/ui/useMediaQuery";
import type { Locale } from "@/i18n/config";
import { sheetChartText } from "@/i18n/messages/sheetChart";
import { cn } from "@/lib/utils";
import { ChartView } from "@/sheet/chart/ChartView";
import { chartData, type ChartData } from "@/sheet/chart/data";
import type { Calc } from "@/sheet/engine";
import { DEFAULT_COL_W, type ChartSpec, type Sheet } from "@/sheet/types";
import { useOpenEmbedItem } from "../embed/openItem";
import { focusSheetGrid, type GridGeometry } from "../grid/Grid";
import { showSheetNotice } from "../notice";
import { PANEL_MIN_WIDTH, PANEL_WIDTH } from "../panelLayout";
import { useSheet, type SheetStore } from "../store";
import { chartDataBlock, deleteChart, duplicateChart, openChartPanel, quickTrendline, saveChartFile, updateChart } from "./actions";
import { BAR_SPACE, barShift, inViewNext, revealScroll, scrollBehavior, shownShare, type Rect } from "./reveal";
import { chartUi, selectChart, setChartUi, setChartViewport, useChartUi, type ChartViewport } from "./selection";

/** The smallest a chart gets by resizing (logical px). */
export const CHART_MIN = { w: 240, h: 160 } as const;

type Box = { x: number; y: number; w: number; h: number };
type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Gesture = {
  pointerId: number;
  kind: "move" | Handle;
  startX: number;
  startY: number;
  base: Box;
  moved: boolean;
  /** A finger or a pen (taps, double taps, a bigger wobble before it counts as moving). */
  touch: boolean;
  /** Moving drags: at once with a mouse, a pen or on a handle; a finger on the chart only after holding still. */
  held: boolean;
  /** A finger held the chart still until it was picked up (lifting it then is no tap). */
  picked: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  zoom: number;
};

/** How long a finger holds a selected chart still before it follows the finger (ms), as on the sheet tabs. */
const HOLD_MS = 450;

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

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** The frozen columns' width and rows' height of a sheet (content px). */
function frozenSize(sheet: Sheet | undefined, geom: GridGeometry): { w: number; h: number } {
  const fc = sheet?.freeze.cols ?? 0;
  const fr = sheet?.freeze.rows ?? 0;
  return { w: fc > 0 ? geom.rect(0, fc).x : 0, h: fr > 0 ? geom.rect(fr, 0).y : 0 };
}

/**
 * Where the grid shows its scrolling cells on screen (the room a chart can be seen in): right of
 * the row numbers and frozen columns, below the column letters and frozen rows, and above the
 * settings SheetEditor docks over the lower part of the editor on narrow screens (a region in
 * [data-sheet-editor], measured without its slide-in transform, so it is right while the panel
 * still moves up). `docked: false` leaves a docked panel out: one that is sliding away.
 */
function gridRoom(card: HTMLElement, frozen: { w: number; h: number }, docked = true): Rect | null {
  const grid = card.closest<HTMLElement>("[data-sheet-grid]");
  const overlay = card.closest<HTMLElement>("[data-grid-overlay]");
  if (!grid || !overlay) return null;
  // The overlay covers the scrolling cells, which start after the row numbers and column letters.
  const cells = overlay.offsetParent instanceof HTMLElement ? overlay.offsetParent : null;
  const g = grid.getBoundingClientRect();
  const room = {
    left: g.left + grid.clientLeft + (cells?.offsetLeft ?? 0) + frozen.w,
    top: g.top + grid.clientTop + (cells?.offsetTop ?? 0) + frozen.h,
    right: g.left + grid.clientLeft + grid.clientWidth,
    bottom: g.top + grid.clientTop + grid.clientHeight,
  };
  const editor = card.closest<HTMLElement>("[data-sheet-editor]");
  const dock = docked ? editor?.querySelector<HTMLElement>(":scope > [data-sheet-dock]") : null;
  if (editor && dock) room.bottom = Math.min(room.bottom, editor.getBoundingClientRect().top + editor.clientTop + dock.offsetTop);
  return room;
}

/**
 * The scroll the open settings made to show their chart, per editor: closing them scrolls back to
 * `from`, unless the student scrolled meanwhile. Switching the settings to another chart keeps
 * the first `from`.
 */
const settingsScroll = new WeakMap<SheetStore, { from: { left: number; top: number }; to: { left: number; top: number } }>();

/** After the settings open from the keyboard, the keyboard goes into them: to their title, from where Tab goes on. */
function focusSettings(chartId: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-chart-panel="${CSS.escape(chartId)}"] [data-chart-panel-title]`)?.focus({ preventScroll: true }));
}

/** The grid's visible cells now, in content px (see ChartViewport). */
function measureViewport(store: SheetStore, geom: GridGeometry): ChartViewport | null {
  const grid = document.querySelector<HTMLElement>("[data-sheet-grid]");
  const overlay = grid?.querySelector<HTMLElement>("[data-grid-overlay]");
  if (!grid || !overlay || !grid.clientWidth) return null;
  const cells = overlay.offsetParent instanceof HTMLElement ? overlay.offsetParent : null;
  const state = store.get();
  const frozen = frozenSize(state.workbook.sheets.find((x) => x.id === geom.sheetId), geom);
  const editor = grid.closest<HTMLElement>("[data-sheet-editor]");
  // No settings open yet: on a wide editor they will open beside the grid and take its room.
  const opens = !state.focus && !!editor && !editor.querySelector(":scope > aside") && editor.clientWidth >= PANEL_MIN_WIDTH;
  return {
    left: grid.scrollLeft + frozen.w,
    right: grid.scrollLeft + grid.clientWidth - (cells?.offsetLeft ?? 0),
    colX: (col) => geom.rect(0, col).x,
    rowY: (row) => geom.rect(row, 0).y,
    zoom: geom.zoom > 0 ? geom.zoom : 1,
    sidePanel: opens ? PANEL_WIDTH : 0,
  };
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
  // Opened from a note's block: what it shows is selected (the layer is on screen whenever the grid is).
  useOpenEmbedItem(store);

  // What the grid shows, for placing a new chart where it can be seen (insertChart).
  const geomRef = useRef(geom);
  useEffect(() => {
    geomRef.current = geom;
  });
  useEffect(() => {
    setChartViewport(store, () => measureViewport(store, geomRef.current));
    return () => setChartViewport(store, null);
  }, [store]);

  // A press anywhere else (a cell, the toolbar) lets go of the selected chart; its panel and the
  // menus and dialogs it opens don't. So does the keyboard going into the cells (Escape in the
  // settings, closing them, Shift+Tab): the frame shows where the keyboard is, so Delete never
  // seems to be about the chart while it clears cells.
  useEffect(() => {
    if (!ui.selected) return;
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-chart-card],[data-chart-panel],[data-sheet-panel],[role=dialog],[role=menu],[role=listbox]")) return;
      selectChart(store, null);
      // The keyboard leaves the chart let go of, for the cells: toolbar buttons keep it where it is
      // (Fett, Rückgängig), and typing after them goes into the cells, as before the chart came.
      // What takes the keyboard itself (a field, a link) still gets it, after this.
      if (document.activeElement?.closest("[data-chart-card]")) focusSheetGrid();
    };
    const onFocus = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-sheet-grid]") && !t.closest("[data-chart-card]")) selectChart(store, null);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("focusin", onFocus);
    };
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
            reveal={ui.revealId === spec.id ? ui.reveal : 0}
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
  // Held still by a finger until picked up: it lifts before it follows the finger.
  const [lifted, setLifted] = useState(false);
  const [saving, setSaving] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const box = preview ?? base;
  const barAbove = box.y >= BAR_SPACE;
  const showBar = selected && !preview && !lifted;

  /** Where the grid shows cells on screen now (see gridRoom). */
  const roomNow = (docked = true) => {
    const el = cardRef.current;
    const sheet = store.get().workbook.sheets.find((x) => x.id === spec.sheetId);
    return el ? gridRoom(el, frozenSize(sheet, geom), docked) : null;
  };

  /** Tell the panel whether the chart can be seen while its settings are open (it shows a copy when not). */
  const setInView = useEffectEvent((shown: boolean) => {
    const cur = chartUi(store).inView;
    if (cur?.id !== spec.id || cur.shown !== shown) setChartUi(store, { inView: { id: spec.id, shown } });
  });

  // Where to scroll the grid so the chart shows (see revealScroll), as `settings` (its settings
  // are opening) or `show` (the chart itself is wanted): where the grid is and would go, whether
  // there is room at all (docked settings can cover nearly all of the grid) and how much of the
  // chart would show there; null when the chart isn't in a grid on screen.
  const planReveal = useEffectEvent((mode: "settings" | "show") => {
    const el = cardRef.current;
    const grid = el?.closest<HTMLElement>("[data-sheet-grid]");
    const overlay = el?.closest<HTMLElement>("[data-grid-overlay]");
    if (!el || !grid || !overlay) return null;
    const from = { left: grid.scrollLeft, top: grid.scrollTop };
    // Docked settings that are open cover the grid (also another chart's, when this one is
    // duplicated); ones sliding away after closing don't.
    const room = roomNow(mode === "settings" || !!store.get().focus);
    const card = rectOf(el);
    const block = chartDataBlock(store.get().workbook, spec);
    const origin = overlay.getBoundingClientRect();
    let data: Rect | null = null;
    if (block) {
      const a = geom.rect(block.r0, block.c0);
      const b = geom.rect(block.r1, block.c1);
      data = { left: origin.left + a.x, top: origin.top + a.y, right: origin.left + b.x + b.w, bottom: origin.top + b.y + b.h };
    }
    const to = room
      ? revealScroll({
          card,
          room,
          bar: selected ? (barAbove ? "above" : "below") : null,
          data,
          mode,
          scroll: { ...from, maxLeft: grid.scrollWidth - grid.clientWidth, maxTop: grid.scrollHeight - grid.clientHeight },
        })
      : null;
    if (!room || !to) return { grid, from, to: from, room: false, shown: 0 };
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    return { grid, from, to, room: true, shown: shownShare({ left: card.left - dx, right: card.right - dx, top: card.top - dy, bottom: card.bottom - dy }, room) };
  });

  /** Scroll the chart into view (see planReveal), and say how. */
  const revealNow = useEffectEvent((mode: "settings" | "show") => {
    const r = planReveal(mode);
    if (r && (r.to.left !== r.from.left || r.to.top !== r.from.top)) r.grid.scrollTo({ ...r.to, behavior: scrollBehavior() });
    return r;
  });

  // The settings opened: the scroll they made is kept for closing them (from where the grid was
  // before other settings scrolled it, when these took their place).
  const settingsOpened = useEffectEvent((r: ReturnType<typeof revealNow>) => {
    if (!r) return;
    const prev = settingsScroll.get(store);
    const from = prev && Math.abs(prev.to.left - r.from.left) <= 2 && Math.abs(prev.to.top - r.from.top) <= 2 ? prev.from : r.from;
    if (from.left !== r.to.left || from.top !== r.to.top) settingsScroll.set(store, { from, to: r.to });
    else settingsScroll.delete(store);
  });

  // The settings closed: back to where the grid was before they scrolled it, unless the student
  // scrolled meanwhile.
  const scrollBack = useEffectEvent(() => {
    const memo = settingsScroll.get(store);
    settingsScroll.delete(store);
    const grid = cardRef.current?.closest<HTMLElement>("[data-sheet-grid]");
    if (!memo || !grid) return;
    // Without the panel beside it the grid is wider again and can't scroll as far.
    const left = Math.min(memo.to.left, grid.scrollWidth - grid.clientWidth);
    const top = Math.min(memo.to.top, grid.scrollHeight - grid.clientHeight);
    if (Math.abs(grid.scrollLeft - left) <= 2 && Math.abs(grid.scrollTop - top) <= 2) grid.scrollTo({ ...memo.from, behavior: scrollBehavior() });
  });

  // Whether the settings that open show a copy of the chart: decided before they are first
  // painted (the side panel or the dock is in place by then), from where the chart will be once
  // they have scrolled it into view, so the copy never flashes up for a chart that can be seen.
  // Still open while the chart leaves the screen: it can't be seen.
  useLayoutEffect(() => {
    if (!panelOpen) return;
    const r = planReveal("settings");
    setInView(!!r?.room && inViewNext(null, r.shown));
    return () => {
      const open = store.get().focus;
      if (open?.kind === "chart" && open.id === spec.id) setInView(false);
      else if (chartUi(store).inView?.id === spec.id) setChartUi(store, { inView: null });
    };
  }, [panelOpen, store, spec.id]);

  // A chart just inserted, duplicated or opened from a note scrolls into view and gets the
  // keyboard (so Delete removes it, never the cells it was made from). A chart whose settings
  // open scrolls into view as far as its data allows (docked at the bottom on narrow screens,
  // they would cover it), and back when they close; a new chart stays where it was shown. A new
  // chart the docked settings left no room for comes into view when they close. A frame later,
  // after whatever else the click or key did with the keyboard.
  const revealed = useRef({ reveal: 0, panel: false, pending: false });
  useEffect(() => {
    const done = revealed.current;
    const asked = reveal !== 0 && reveal !== done.reveal;
    const opened = panelOpen && !done.panel;
    const closed = !panelOpen && done.panel;
    if (!asked && !opened && !closed) return;
    const frame = requestAnimationFrame(() => {
      done.reveal = reveal;
      done.panel = panelOpen;
      if (closed) {
        const pending = done.pending;
        done.pending = false;
        // Closed for good (not switched over to other settings).
        if (!store.get().focus) {
          if (pending) {
            settingsScroll.delete(store);
            revealNow("show");
          } else scrollBack();
        }
      }
      if (asked || opened) {
        const r = revealNow(panelOpen ? "settings" : "show");
        if (asked) done.pending = panelOpen && !!r && (!r.room || !inViewNext(null, r.shown));
        // Closing a new chart's settings scrolls nothing back: it would take the chart away again.
        if (opened && asked) settingsScroll.delete(store);
        else if (opened) settingsOpened(r);
      }
      if (asked) {
        // Done: coming back to this sheet later doesn't scroll to the chart again.
        if (chartUi(store).revealId === spec.id) setChartUi(store, { revealId: null });
        cardRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [reveal, panelOpen, store, spec.id]);

  // While its settings are open: can the chart still be seen after the student scrolls, the
  // docked panel grows or the window changes? Measured once things stop moving (also after the
  // reveal's own smooth scroll), with slack either way so the copy in the panel doesn't flick in
  // and out.
  const measureInView = useEffectEvent(() => {
    const el = cardRef.current;
    if (!el) return;
    const room = roomNow();
    const was = chartUi(store).inView;
    setInView(inViewNext(was?.id === spec.id ? was.shown : null, room ? shownShare(rectOf(el), room) : 0));
  });
  useEffect(() => {
    if (!panelOpen) return;
    const el = cardRef.current;
    const grid = el?.closest<HTMLElement>("[data-sheet-grid]");
    if (!el || !grid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => measureInView(), 160);
    };
    grid.addEventListener("scroll", later, { passive: true });
    const ro = new ResizeObserver(later);
    ro.observe(el);
    ro.observe(grid);
    const dock = el.closest("[data-sheet-editor]")?.querySelector(":scope > [data-sheet-dock]");
    if (dock) ro.observe(dock);
    return () => {
      clearTimeout(timer);
      grid.removeEventListener("scroll", later);
      ro.disconnect();
    };
  }, [panelOpen]);

  // Gone from the screen (deleted, another sheet shown): closing its settings scrolls nothing back.
  useEffect(() => {
    const done = revealed.current;
    return () => {
      if (done.panel) settingsScroll.delete(store);
    };
  }, [store, spec.id]);

  // Gone while it had the keyboard (undone from the toolbar, deleted by someone working on the
  // spreadsheet at the same time): the keyboard goes back to the cells, not nowhere. Checked
  // while the card is still on the page.
  useLayoutEffect(() => {
    const el = cardRef.current;
    const editor = el?.closest("[data-sheet-editor]");
    return () => {
      if (!el?.contains(document.activeElement)) return;
      requestAnimationFrame(() => {
        const now = document.activeElement;
        if (editor?.isConnected && (!now || now === document.body)) focusSheetGrid();
      });
    };
  }, []);

  // The action bar stays where a finger reaches it: inside the cells on screen while the chart
  // shows there (a chart wider than a phone, or half scrolled away), but never over a chart whose
  // settings are open. Moved directly on the element, as the grid scrolls.
  const placeBar = useEffectEvent(() => {
    const bar = barRef.current;
    const el = cardRef.current;
    if (!bar || !el) return;
    const sx = Number(bar.dataset.sx) || 0;
    const sy = Number(bar.dataset.sy) || 0;
    const r = rectOf(bar);
    const room = roomNow(!!store.get().focus);
    const s = room ? barShift({ left: r.left - sx, right: r.right - sx, top: r.top - sy, bottom: r.bottom - sy }, rectOf(el), room, !panelOpen) : { x: 0, y: 0 };
    if (s.x === sx && s.y === sy) return;
    bar.dataset.sx = String(s.x);
    bar.dataset.sy = String(s.y);
    bar.style.transform = s.x || s.y ? `translate(${s.x}px, ${s.y}px)` : "";
  });
  useLayoutEffect(() => {
    if (!showBar) return;
    placeBar();
    const grid = cardRef.current?.closest<HTMLElement>("[data-sheet-grid]");
    const onChange = () => placeBar();
    grid?.addEventListener("scroll", onChange, { passive: true });
    const ro = new ResizeObserver(onChange);
    if (grid) ro.observe(grid);
    return () => {
      grid?.removeEventListener("scroll", onChange);
      ro.disconnect();
    };
  }, [showBar, box.x, box.y, box.w, box.h, panelOpen]);

  // A finger that picked the chart up drags it, and a pen drags it at once: the sheet mustn't
  // scroll under them.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (gesture.current?.held && gesture.current.touch) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

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
    const finger = e.pointerType === "touch";
    // The grid may zoom with a CSS transform: screen px → content px.
    const zoom = Math.max(0.25, store.get().zoom / scale) || 1;
    const g: Gesture = { pointerId: e.pointerId, kind, startX: e.clientX, startY: e.clientY, base, moved: false, touch: e.pointerType !== "mouse", held: !finger || kind !== "move", picked: false, timer: null, zoom };
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = g;
    const el = e.currentTarget;
    const capture = () => {
      try {
        el.setPointerCapture(g.pointerId);
      } catch {
        // Some WebViews refuse capture for pens; moving still works while over the chart.
      }
    };
    if (g.held) capture();
    else if (selected && !readOnly) {
      // A finger on the chart waits: a swipe scrolls the sheet, a tap selects, and on a selected
      // chart holding still for a moment picks it up (it lifts), then it follows the finger.
      g.timer = setTimeout(() => {
        if (gesture.current !== g || g.moved) return;
        g.held = true;
        g.picked = true;
        g.timer = null;
        capture();
        setLifted(true);
        navigator.vibrate?.(12);
      }, HOLD_MS);
    }
    if (!finger) {
      selectChart(store, spec.id);
      cardRef.current?.focus({ preventScroll: true });
    }
  };

  /** The gesture is over (or turned out to be a swipe that scrolls the sheet). */
  const forget = () => {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    gesture.current = null;
    setPreview(null);
    setLifted(false);
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < (g.touch ? 8 : 4)) return;
    if (!g.held) {
      // A finger moving before it held still: it scrolls the sheet.
      forget();
      return;
    }
    if (readOnly) return;
    g.moved = true;
    setPreview(dragged(g.base, g.kind, dx / g.zoom, dy / g.zoom, scale, e.shiftKey));
  };

  const end = (e: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    forget();
    if (g.moved) {
      commit(dragged(g.base, g.kind, (e.clientX - g.startX) / g.zoom, (e.clientY - g.startY) / g.zoom, scale, e.shiftKey), g.kind);
      return;
    }
    if (!g.touch || g.kind !== "move" || g.picked) return;
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

  /** Gone with the chart, the keyboard goes back to the cells. */
  const remove = () => {
    deleteChart(store, spec.id);
    focusSheetGrid();
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
        // Undoing the chart's insertion takes the chart away: the keyboard goes back to the cells.
        if (!store.get().workbook.charts.some((c) => c.id === spec.id)) focusSheetGrid();
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
      if (!readOnly && selected) remove();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!readOnly) {
        openChartPanel(store, spec.id);
        focusSettings(spec.id);
      }
    } else if (e.key === "Escape") {
      // Let go of the chart and close its settings: the keyboard goes back to the cells.
      e.preventDefault();
      const open = store.get().focus;
      if (open?.kind === "chart" && open.id === spec.id) store.setFocus(null);
      selectChart(store, null);
      focusSheetGrid();
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
    const ok = await saveChartFile(store, spec.id, "png");
    setSaving(false);
    // Saved, the browser shows the download; when it fails, the sheet says so.
    if (!ok) showSheetNotice(store, t.saveFailed, "error");
  };

  const kindName = t.kindNames[spec.kind];
  const hit = touch ? 36 : 16;
  const dot = touch ? 14 : 9;
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
      // A finger may scroll the sheet over a chart (the grid lets it pan); holding it still picks the chart up.
      className={cn("pointer-events-auto absolute select-none outline-none [-webkit-touch-callout:none]", selected ? "z-[3]" : "z-[2]")}
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        cursor: selected && !readOnly ? (preview ? "grabbing" : "grab") : "pointer",
      }}
      onPointerDown={(e) => begin(e, "move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={forget}
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
          (preview || lifted) && "shadow-pop",
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

      {showBar && (
        <div
          ref={barRef}
          role="toolbar"
          aria-label={t.chartLabel(kindName, spec.title.trim())}
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-line bg-raised p-1 shadow-pop"
          style={{ top: barAbove ? -48 : box.h + 10 }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.key !== "Tab" && e.stopPropagation()}
        >
          {/* From the keyboard (a click without a pointer), the keyboard goes along into the settings. */}
          {!readOnly && (
            <BarButton
              label={t.settings}
              showLabel={wide}
              onClick={(e) => {
                openChartPanel(store, spec.id);
                if (e.detail === 0) focusSettings(spec.id);
              }}
            >
              <Settings2 />
            </BarButton>
          )}
          {!readOnly && spec.kind !== "pie" && (
            <BarButton
              label={t.trendline}
              title={t.addTrendline}
              showLabel={wide}
              onClick={(e) => {
                if (quickTrendline(store, spec.id) === "opened" && e.detail === 0) focusSettings(spec.id);
              }}
            >
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
            <BarButton label={t.remove} danger onClick={remove}>
              <Trash2 />
            </BarButton>
          )}
        </div>
      )}
    </div>
  );
}

function BarButton({
  label,
  title,
  showLabel,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title?: string;
  showLabel?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
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
