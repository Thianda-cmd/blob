"use client";

// The spreadsheet grid: column and row headers, cells (only the visible ones are rendered),
// selection, editing in the cell, keyboard, mouse, touch and pen, clipboard, fill handle,
// resizing, frozen rows/columns and the context menu.
//
// CONTRACT: the props and types below are what the editor (SheetEditor), smart tables
// (decorate) and charts (overlay) are written against. Keep them; add optional props if needed.
//
// How it is built: one scrolling element (role="grid", it has the keyboard) holds a box as big as
// the sheet. The scrolling cells sit in it directly; the frozen rows, the frozen columns, the
// headers and the corner sit in "sticky" layers that the browser keeps in place while scrolling,
// so nothing has to be moved by script and scrolling stays smooth. Each part renders only the
// rows and columns near the screen (see geometry.ts and GridCells.tsx).

import "./grid.css";
import { Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { MenuPoint } from "@/components/ui/ContextMenu";
import { useKeyboard } from "@/components/ui/useKeyboard";
import { useIsMac, useTouch } from "@/components/ui/useMediaQuery";
import type { Locale } from "@/i18n/config";
import { sheetGridText } from "@/i18n/messages/sheetGrid";
import { areaName, cellKey, inArea, parseKey } from "@/sheet/a1";
import { explainError, isError, type Calc, type CellError } from "@/sheet/engine";
import { setColWidths, setRowHeights, sheetById } from "@/sheet/ops";
import { DEFAULT_COL_W, DEFAULT_ROW_H, MAX_ROWS, type Area, type Pos, type Sheet } from "@/sheet/types";
import { cn } from "@/lib/utils";
import { activeArea, mainArea, rowHiddenIn, selectionAreas, useSheet, type SheetStore } from "../store";
import { fillTo, fitColumns, fitRows, isSelected, menuKindFor, selectedIndexes, addRoom, unhideNear } from "./actions";
import { BASE_FONT, CELL_PAD, numberAsText, numberLike, shownText } from "./cellLook";
import { CellEditor } from "./CellEditor";
import { copySelection, pasteData, type PasteMode } from "./clipboard";
import { Chooser, GridMenu, NotePopover, type MenuKind } from "./ContextMenu";
import {
  buildLayout,
  cellRect,
  colAt,
  colWidth,
  contentToView,
  geometryOf,
  hitTest,
  renderWindow,
  rowAt,
  rowHeight,
  scrollToShow,
  viewToContent,
  type Hit,
  type Layout,
  type Scroll,
  type Viewport,
} from "./geometry";
import { cellId, cellSource, describer, GridLines, PaneCells } from "./GridCells";
import { ColumnHeaders, CornerHeader, RowHeaders } from "./Headers";
import { handleGridKey } from "./keys";
import { LINE_HEIGHT, resetMeasure, setMeasureFamily, wrappedLines } from "./measure";
import { fillDownEnd } from "./navigation";
import { formulaTokens, pointAt, pointing, refFrames } from "./point";
import { SelectionLayer, type Bounds, type RefFrame } from "./Selection";

/** Extra look for a cell, from a smart table (header row, banding, totals row). */
export type CellDecor = {
  /** Background (CSS colour, e.g. var(--sheet-blue-fill)); the cell's own fill wins. */
  fill?: string;
  /** Text colour; the cell's own colour wins. */
  color?: string;
  bold?: boolean;
  /** A line under the cell (header row) or above it (totals row). */
  lineBelow?: "strong";
  lineAbove?: "strong";
  /** A small button at the right of the cell: a smart table's sort and filter menu. */
  button?: {
    state: "plain" | "filtered" | "sortedAsc" | "sortedDesc";
    /** For screen readers and the tooltip ("Sortieren und filtern: Extinktion"). */
    label: string;
    onClick: (anchor: HTMLElement) => void;
  };
};

/** Where cells are, in the coordinates of the scrolling content (A1's top-left corner is 0,0). */
export type GridGeometry = {
  /** A cell's box (hidden rows and columns have zero size). */
  rect(row: number, col: number): { x: number; y: number; w: number; h: number };
  /** The cell under a point of the content. */
  cellAt(x: number, y: number): Pos;
  /** The sheet these coordinates belong to. */
  sheetId: string;
  /** The grid's zoom (sizes above are already zoomed; a chart's own px size can be multiplied by it). */
  zoom: number;
};

export type GridProps = {
  store: SheetStore;
  /** Extra look per cell (smart tables). Called only for visible cells. */
  decorate?: (sheetId: string, row: number, col: number) => CellDecor | null;
  /** Things floating above the cells that scroll with them (charts), positioned with `geom`. */
  overlay?: (geom: GridGeometry) => ReactNode;
  /** Entries added at the top of the cells' context menu ("Als intelligente Tabelle", "Diagramm einfügen"). */
  contextMenu?: (close: () => void) => ReactNode;
  className?: string;
};

/** Give the grid the keyboard back (after typing in the formula bar, a dialog…). */
export function focusSheetGrid() {
  document.querySelector<HTMLElement>("[data-sheet-grid]")?.focus({ preventScroll: true });
}

/** The grid re-renders every this many px of scrolling (each render covers more than the screen). */
const SLACK = 96;
const FOOTER = 48;
const MIN_COL = 12;
const MIN_ROW = 10;
const NO_FRAMES: RefFrame[] = [];
/** The time, for telling taps, double taps and long presses apart (only ever read in event handlers). */
const clock = () => Date.now();
const NO_ROWS: ReadonlyMap<number, number> = new Map();
/** How long a finger holds still for the menu (ms), and how far it may wander meanwhile (px): on a cell or header, on a handle. */
const LONG_PRESS = 480;
const TOUCH_SLOP = 10;
const HANDLE_SLOP = 6;

type Box = { x: number; y: number; w: number; h: number };

/**
 * A finger that is down but not yet a gesture: lifting it is a tap, holding it opens the menu,
 * moving it scrolls the sheet (on a cell) or starts a drag (a handle, the column letters or row
 * numbers). `handle`: it came down on a selection or fill handle.
 */
type Pending = {
  id: number;
  x: number;
  y: number;
  hit: Hit;
  handle: string | undefined;
  /** The handle's visible dot (its box's centre), on screen. */
  dot: { x: number; y: number } | null;
  long: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

type Drag =
  | { kind: "cells"; id: number; anchor: Pos; extra: Area[] }
  | { kind: "cols"; id: number; anchor: number; extra: Area[] }
  | { kind: "rows"; id: number; anchor: number; extra: Area[] }
  | { kind: "point"; id: number; anchor: Pos; axis: "cells" | "cols" | "rows" }
  | { kind: "fill"; id: number; from: Area; to: Area | null }
  | { kind: "handle"; id: number; corner: "tl" | "br"; main: Area }
  | { kind: "colSize"; id: number; index: number; all: number[]; start: number; size: number; was: number }
  | { kind: "rowSize"; id: number; index: number; all: number[]; start: number; size: number; was: number };

type Guide = { kind: "col" | "row"; at: number; label: string };
/** `numberText`: the cell holds text that looks like a number (see numberAsText). */
type Tip = { box: Box; note: string; error: CellError | null; numberText: string | null };

/**
 * Rows that need more than the default height (wrapped text, big fonts), unless set by hand.
 * `fonts` only marks that fonts finished loading (text measures differently then).
 */
function tallRows(sheet: Sheet, calc: Calc, locale: Locale, fonts: number): ReadonlyMap<number, number> {
  void fonts;
  let out: Map<number, number> | null = null;
  for (const key in sheet.cells) {
    const cell = sheet.cells[key];
    const s = cell.s;
    if (!s || (!s.wrap && !(s.size && s.size > BASE_FONT)) || (cell.v === undefined && cell.f === undefined)) continue;
    const { row, col } = parseKey(key);
    if (sheet.rows[row]?.h !== undefined) continue;
    const size = s.size ?? BASE_FONT;
    let lines = 1;
    if (s.wrap) {
      const text = shownText(calc.value(sheet.id, row, col), s.fmt, locale);
      if (!text) continue;
      const width = (sheet.cols[col]?.w ?? DEFAULT_COL_W) - 2 * CELL_PAD - 2;
      lines = wrappedLines(text, width, size, !!s.bold, !!s.italic);
    }
    const h = Math.ceil(lines * size * LINE_HEIGHT + 8);
    if (h <= DEFAULT_ROW_H) continue;
    out ??= new Map();
    if (h > (out.get(row) ?? 0)) out.set(row, h);
  }
  return out ?? NO_ROWS;
}

/** How much of the grid's height shows above the on-screen keyboard (the visual viewport ends there), less a small margin. */
function shownHeight(el: HTMLElement): number {
  const vv = window.visualViewport;
  const r = el.getBoundingClientRect();
  const bottom = Math.min(r.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
  return Math.max(0, Math.min(el.clientHeight, bottom - r.top - el.clientTop - 12));
}

/** The target of a fill-handle drag: the selection stretched toward the pointer, along the way it moved most. */
function fillTarget(from: Area, p: Pos): Area | null {
  if (inArea(from, p.row, p.col)) return null;
  const down = p.row - from.r1;
  const up = from.r0 - p.row;
  const right = p.col - from.c1;
  const left = from.c0 - p.col;
  const vertical = Math.max(down, up);
  const horizontal = Math.max(right, left);
  if (vertical >= horizontal && vertical > 0) return down > 0 ? { ...from, r1: p.row } : { ...from, r0: p.row };
  if (horizontal > 0) return right > 0 ? { ...from, c1: p.col } : { ...from, c0: p.col };
  return null;
}

export function Grid({ store, decorate, overlay, contextMenu, className }: GridProps): ReactNode {
  const locale = useSheet(store, (s) => s.locale);
  const t = sheetGridText[locale];
  const mac = useIsMac();
  const gridId = useId();
  const workbook = useSheet(store, (s) => s.workbook);
  const sheetId = useSheet(store, (s) => s.sheetId);
  const calc = useSheet(store, (s) => s.calc);
  const zoom = useSheet(store, (s) => s.zoom);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const selection = useSheet(store, (s) => s.selection);
  const edit = useSheet(store, (s) => s.edit);
  const clip = useSheet(store, (s) => s.clip);
  const sheet = sheetById(workbook, sheetId) ?? workbook.sheets[0];

  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  /** A tap opened a number for editing: the cell editor selects it all (see tap). */
  const selectOnOpen = useRef(false);
  const sink = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<Viewport>({ w: 0, h: 0 });
  const [scroll, setScroll] = useState<Scroll>({ left: 0, top: 0 });
  const [fonts, setFonts] = useState(0);
  const [menu, setMenu] = useState<{ at: MenuPoint; kind: MenuKind } | null>(null);
  const [chooser, setChooser] = useState<{ at: MenuPoint; kind: "insert" | "delete" } | null>(null);
  const [noteFor, setNoteFor] = useState<{ pos: Pos; box: Box } | null>(null);
  const [fillPreview, setFillPreview] = useState<Area | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  // The kind of pointer that pressed last. Before the first press, a touch screen without a mouse
  // is taken to be used with fingers (round handles, not the mouse's 7-px fill handle). The media
  // query reads false on the server, so the first render matches it.
  const coarse = useTouch();
  const [lastPointer, setLastPointer] = useState<"mouse" | "touch" | "pen" | null>(null);
  const pointerKind = lastPointer ?? (coarse ? "touch" : "mouse");
  /** Filling by touch ("Ausfüllen" in the menu): for this selection, the bottom-right handle fills instead of selecting. */
  const [fillFor, setFillFor] = useState<{ sheetId: string; area: Area } | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  // Sizes of everything, and what is on screen.
  const tall = useMemo(() => tallRows(sheet, calc, locale, fonts), [sheet, calc, locale, fonts]);
  const layout = useMemo(() => buildLayout(sheet, zoom, (r) => rowHiddenIn(calc, sheet.id, r, locale), tall), [sheet, zoom, calc, locale, tall]);
  const geometry = useMemo(() => geometryOf(layout), [layout]);
  const src = useMemo(() => cellSource(sheet, calc, decorate), [sheet, calc, decorate]);
  const describe = useMemo(() => describer(t), [t]);
  const ready = view.w > 0 && view.h > 0;
  const win = renderWindow(layout, scroll, view, SLACK);

  const areas = useMemo(() => selectionAreas(selection), [selection]);
  const main = useMemo(() => mainArea(selection), [selection]);
  const active = selection.anchor;
  const editText = edit?.text ?? "";
  const editSheet = edit?.sheetId ?? null;
  const tokens = useMemo(() => (editText.startsWith("=") ? formulaTokens(editText, locale) : null), [editText, locale]);
  const frames = useMemo(() => (editSheet && tokens ? refFrames(workbook, editSheet, sheetId, tokens) : NO_FRAMES), [workbook, editSheet, sheetId, tokens]);
  const clipHere = clip && clip.sheetId === sheetId ? clip : null;
  const touchFill =
    !readOnly && !!fillFor && fillFor.sheetId === sheetId && fillFor.area.r0 === main.r0 && fillFor.area.c0 === main.c0 && fillFor.area.r1 === main.r1 && fillFor.area.c1 === main.c1;
  const handles = edit ? null : pointerKind === "touch" ? (touchFill ? "touchFill" : "touch") : readOnly ? null : "fill";

  // The latest values for event handlers that live longer than one render.
  const latest = useRef({ layout, view, decorate });
  useLayoutEffect(() => {
    latest.current = { layout, view, decorate };
  });

  const focusGrid = useCallback(() => scroller.current?.focus({ preventScroll: true }), []);
  // Stable, so open menus don't re-run their effects (and re-focus their first item) on every render.
  const closeMenu = useCallback(() => {
    setMenu(null);
    if (!store.get().edit) focusGrid();
  }, [store, focusGrid]);
  const closeChooser = useCallback(() => {
    setChooser(null);
    focusGrid();
  }, [focusGrid]);
  const closeNote = useCallback(() => {
    setNoteFor(null);
    focusGrid();
  }, [focusGrid]);

  // The viewport's size.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setView((v) => (v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Text is measured in the grid's own font; web fonts arriving later change the measurements.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) setMeasureFamily(getComputedStyle(el).fontFamily);
  }, []);
  useEffect(() => {
    const set = typeof document === "undefined" ? undefined : document.fonts;
    if (!set) return;
    let alive = true;
    const again = () => {
      if (!alive) return;
      resetMeasure();
      setFonts((n) => n + 1);
    };
    set.ready.then(again).catch(() => {});
    set.addEventListener("loadingdone", again);
    return () => {
      alive = false;
      set.removeEventListener("loadingdone", again);
    };
  }, []);

  // Typing into a cell on a tablet: the on-screen keyboard must not hide the cell being edited.
  // (Typing in the formula bar it may: the bar shows the formula, and scrolling the cell up would
  // push the data at the top, the cells a formula points at, out of view.)
  const keyboard = useKeyboard();
  const editRow = edit && edit.sheetId === sheetId && edit.via === "cell" ? edit.row : -1;
  const editCol = edit && edit.sheetId === sheetId && edit.via === "cell" ? edit.col : -1;
  const latestKeyboard = useRef(false);
  useLayoutEffect(() => {
    latestKeyboard.current = keyboard.open;
  });
  useLayoutEffect(() => {
    const el = scroller.current;
    const field = textarea.current;
    if (!el || !field || editRow < 0 || !keyboard.open) return;
    const vv = window.visualViewport;
    const bottom = Math.min(el.getBoundingClientRect().bottom, vv ? vv.offsetTop + vv.height : window.innerHeight);
    const over = field.getBoundingClientRect().bottom + 12 - bottom;
    if (over > 0) el.scrollTop += over;
  }, [keyboard.open, keyboard.height, view.h, editRow, editCol]);

  // Each sheet keeps its own scroll position, like Excel (before the selection is brought into view
  // below). With it goes where the selection's moving end was: back on a sheet with that same
  // selection, the sheet stays as it was left instead of jumping to the selection (a different one,
  // say a cell picked on that sheet through the name box, is still brought into view).
  const focusRow = selection.focus.row;
  const focusCol = selection.focus.col;
  const scrolls = useRef(new Map<string, { left: number; top: number; row: number; col: number }>());
  const shownSheet = useRef(sheetId);
  const shownFocus = useRef({ row: focusRow, col: focusCol });
  const restored = useRef<{ row: number; col: number } | null>(null);
  /** Where a selection made for a menu ended (see selectForMenu): not brought into view, that scroll would close the menu. */
  const stay = useRef<Pos | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || shownSheet.current === sheetId) return;
    scrolls.current.set(shownSheet.current, { left: el.scrollLeft, top: el.scrollTop, ...shownFocus.current });
    shownSheet.current = sheetId;
    const back = scrolls.current.get(sheetId);
    el.scrollTo({ left: back?.left ?? 0, top: back?.top ?? 0 });
    restored.current = back ? { row: back.row, col: back.col } : null;
  }, [sheetId]);

  // The moving end of the selection stays in view (keys, Enter, pointing at cells for a formula),
  // above the on-screen keyboard while it is open (typing a column of values, Enter after Enter).
  // Whole columns only scroll sideways and whole rows only up and down: clicking a column's
  // letter doesn't jump to its last row.
  useLayoutEffect(() => {
    const back = restored.current;
    restored.current = null;
    const kept = stay.current;
    stay.current = null;
    shownFocus.current = { row: focusRow, col: focusCol };
    if (back && back.row === focusRow && back.col === focusCol) return;
    if (kept && kept.row === focusRow && kept.col === focusCol) return;
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const l = latest.current.layout;
    const a = mainArea(store.get().selection);
    const wholeCols = a.r0 === 0 && a.r1 >= l.rows - 1;
    const wholeRows = a.c0 === 0 && a.c1 >= l.cols - 1;
    const h = latestKeyboard.current ? shownHeight(el) : el.clientHeight;
    const next = scrollToShow(l, { row: focusRow, col: focusCol }, { left: el.scrollLeft, top: el.scrollTop }, { w: el.clientWidth, h });
    const left = wholeRows ? el.scrollLeft : next.left;
    const top = wholeCols ? el.scrollTop : next.top;
    if (Math.abs(left - el.scrollLeft) > 0.5 || Math.abs(top - el.scrollTop) > 0.5) el.scrollTo({ left, top });
  }, [focusRow, focusCol, sheetId, ready, store]);

  // Zooming around a point (Ctrl+wheel, pinch): that point of the sheet stays under the pointer.
  const zoomAnchor = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const zoomAround = useCallback(
    (z: number, clientX: number, clientY: number) => {
      const el = scroller.current;
      if (!el) return;
      const l = latest.current.layout;
      const r = el.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const before = store.get().zoom;
      zoomAnchor.current = { px, py, x: (px - l.headerW + el.scrollLeft) / l.zoom, y: (py - l.headerH + el.scrollTop) / l.zoom };
      store.setZoom(z);
      if (store.get().zoom === before) zoomAnchor.current = null;
    },
    [store],
  );
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const el = scroller.current;
    if (!a || !el) return;
    zoomAnchor.current = null;
    el.scrollLeft = Math.max(0, a.x * layout.zoom - (a.px - layout.headerW));
    el.scrollTop = Math.max(0, a.y * layout.zoom - (a.py - layout.headerH));
  }, [layout]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAround(store.get().zoom * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [store, zoomAround]);

  // ------------------------------------------------------------------------------------------
  // Pointer: mouse and pen select by pressing and dragging; a finger scrolls, taps select, a
  // tap on the active cell (or a double tap) edits, a long press opens the menu, two fingers zoom.

  const drag = useRef<Drag | null>(null);
  const lastPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoFrame = useRef<number | null>(null);
  const touch = useRef<Pending | null>(null);
  const lastTap = useRef<{ at: number; row: number; col: number } | null>(null);
  const lastLongPress = useRef(0);
  /** A long press opened the menu: the finger must not scroll the sheet any more, nor click whatever is under it when it lifts (see the touch listeners). */
  const swallowClick = useRef(false);
  const hoverKey = useRef("");
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteMode = useRef<PasteMode>("all");

  const local = (clientX: number, clientY: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return { px: clientX - r.left - el.clientLeft, py: clientY - r.top - el.clientTop, el };
  };
  const hitAt = (clientX: number, clientY: number, slop: number): Hit => {
    const { px, py, el } = local(clientX, clientY);
    return hitTest(latest.current.layout, px, py, { left: el.scrollLeft, top: el.scrollTop }, slop);
  };
  /** The cell under a point, clamped into the sheet (dragging beyond the edges keeps going). */
  const cellAtClient = (clientX: number, clientY: number): Pos => {
    const { px, py, el } = local(clientX, clientY);
    const l = latest.current.layout;
    const c = viewToContent(l, Math.max(px, l.headerW), Math.max(py, l.headerH), { left: el.scrollLeft, top: el.scrollTop });
    return { row: rowAt(l, c.y), col: colAt(l, c.x) };
  };
  /** A cell's box on screen (viewport coordinates). */
  const cellBox = (p: Pos): Box => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    const l = latest.current.layout;
    const c = cellRect(l, p.row, p.col);
    const v = contentToView(l, c.x, c.y, { left: el.scrollLeft, top: el.scrollTop }, { row: p.row < l.freezeRows, col: p.col < l.freezeCols });
    return { x: r.left + el.clientLeft + v.x, y: r.top + el.clientTop + v.y, w: c.w, h: c.h };
  };

  const notify = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);
  const saidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tell screen readers (copied, cut…) for a moment; then the selection is announced again. */
  const say = (text: string) => {
    setSaid(text);
    if (saidTimer.current) clearTimeout(saidTimer.current);
    saidTimer.current = setTimeout(() => setSaid(""), 2500);
  };

  const tipFor = (p: Pos): Tip | null => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId);
    const cell = sh?.cells[cellKey(p.row, p.col)];
    if (!cell) return null;
    const value = cell.v !== undefined || cell.f !== undefined ? s.calc.value(s.sheetId, p.row, p.col) : null;
    const error = isError(value) ? value : null;
    const numberText = numberAsText(cell, (d) => (p.row + d < 0 ? null : s.calc.value(s.sheetId, p.row + d, p.col))) ? String(cell.v) : null;
    if (!cell.note && !error && !numberText) return null;
    return { box: cellBox(p), note: cell.note ?? "", error, numberText };
  };
  const hover = (p: Pos | null) => {
    const key = p ? `${p.row},${p.col}` : "";
    if (hoverKey.current === key) return;
    hoverKey.current = key;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    const next = p ? tipFor(p) : null;
    if (!next) {
      setTip(null);
      return;
    }
    tipTimer.current = setTimeout(() => setTip(next), 380);
  };

  const stopAuto = () => {
    if (autoFrame.current !== null) cancelAnimationFrame(autoFrame.current);
    autoFrame.current = null;
  };

  const updateDrag = (d: Drag, clientX: number, clientY: number) => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId);
    if (!sh) return;
    const R = sh.size.rows - 1;
    const C = sh.size.cols - 1;
    const l = latest.current.layout;
    switch (d.kind) {
      case "cells":
        store.select({ anchor: d.anchor, focus: cellAtClient(clientX, clientY), extra: d.extra });
        return;
      case "cols":
        store.select({ anchor: { row: 0, col: d.anchor }, focus: { row: R, col: cellAtClient(clientX, clientY).col }, extra: d.extra });
        return;
      case "rows":
        store.select({ anchor: { row: d.anchor, col: 0 }, focus: { row: cellAtClient(clientX, clientY).row, col: C }, extra: d.extra });
        return;
      case "point": {
        const p = cellAtClient(clientX, clientY);
        pointAt(store, d.anchor, d.axis === "cols" ? { row: R, col: p.col } : d.axis === "rows" ? { row: p.row, col: C } : p);
        return;
      }
      case "fill": {
        const to = fillTarget(d.from, cellAtClient(clientX, clientY));
        d.to = to;
        setFillPreview(to);
        return;
      }
      case "handle": {
        const p = cellAtClient(clientX, clientY);
        const m = d.main;
        if (d.corner === "br") store.select({ anchor: { row: m.r0, col: m.c0 }, focus: p, extra: [] });
        else store.select({ anchor: p, focus: { row: m.r1, col: m.c1 }, extra: [] });
        return;
      }
      case "colSize": {
        const { el } = local(clientX, clientY);
        const size = Math.max(MIN_COL * l.zoom, d.was + (clientX - d.start));
        d.size = size;
        const frozen = d.index < l.freezeCols;
        const x = l.headerW + l.colLeft[d.index] + size - (frozen ? 0 : el.scrollLeft);
        setGuide({ kind: "col", at: x, label: t.widthPx(Math.round(size / l.zoom)) });
        return;
      }
      case "rowSize": {
        const { el } = local(clientX, clientY);
        const size = Math.max(MIN_ROW * l.zoom, d.was + (clientY - d.start));
        d.size = size;
        const frozen = d.index < l.freezeRows;
        const y = l.headerH + l.rowTop[d.index] + size - (frozen ? 0 : el.scrollTop);
        setGuide({ kind: "row", at: y, label: t.widthPx(Math.round(size / l.zoom)) });
        return;
      }
    }
  };

  /** While dragging near or past an edge, the grid scrolls that way (faster the further out). */
  const autoScroll = () => {
    stopAuto();
    const step = () => {
      const d = drag.current;
      const el = scroller.current;
      if (!d || !el || d.kind === "colSize" || d.kind === "rowSize") {
        autoFrame.current = null;
        return;
      }
      const l = latest.current.layout;
      const r = el.getBoundingClientRect();
      const { x, y } = lastPoint.current;
      const edge = 28;
      const top = r.top + l.headerH + l.frozenH;
      const left = r.left + l.headerW + l.frozenW;
      const bottom = r.top + el.clientHeight;
      const right = r.left + el.clientWidth;
      const speed = (dist: number) => Math.min(48, 2 + dist / 2.5);
      let dx = 0;
      let dy = 0;
      if (d.kind !== "cols" && y > bottom - edge) dy = speed(y - (bottom - edge));
      else if (d.kind !== "cols" && y < top + edge && el.scrollTop > 0) dy = -speed(top + edge - y);
      if (d.kind !== "rows" && x > right - edge) dx = speed(x - (right - edge));
      else if (d.kind !== "rows" && x < left + edge && el.scrollLeft > 0) dx = -speed(left + edge - x);
      if (dx || dy) {
        el.scrollLeft += dx;
        el.scrollTop += dy;
        updateDrag(d, x, y);
      }
      autoFrame.current = requestAnimationFrame(step);
    };
    autoFrame.current = requestAnimationFrame(step);
  };

  const endDrag = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    stopAuto();
    setFillPreview(null);
    setGuide(null);
    if (!d || !commit) return;
    const s = store.get();
    const l = latest.current.layout;
    if (d.kind === "fill" && d.to) {
      fillTo(store, d.from, d.to);
      // Filling by touch is done (the handle selects again).
      setFillFor(null);
    } else if (d.kind === "colSize") {
      const w = Math.round(d.size / l.zoom);
      if (w !== Math.round(d.was / l.zoom)) store.apply(t.labels.colWidth, (wb) => setColWidths(wb, s.sheetId, d.all, w));
    } else if (d.kind === "rowSize") {
      const h = Math.round(d.size / l.zoom);
      if (h !== Math.round(d.was / l.zoom)) store.apply(t.labels.rowHeight, (wb) => setRowHeights(wb, s.sheetId, d.all, h));
    }
  };

  const cancelTouch = () => {
    const tp = touch.current;
    if (tp?.timer) clearTimeout(tp.timer);
    touch.current = null;
  };

  /** Whether a finger that came down on a handle is on its visible dot (14 px, the fill square 16 px), not just in its finger-sized box. */
  const onDot = (tp: Pending, x: number, y: number) => !!tp.handle && !!tp.dot && Math.hypot(x - tp.dot.x, y - tp.dot.y) <= (tp.handle === "fill" ? 8 : 7);

  /** Whole columns (rows) selected that include this one: resizing one of them resizes them all, like Excel. */
  const resizeSet = (kind: "cols" | "rows", index: number): number[] => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId)!;
    const whole = selectionAreas(s.selection).some((a) =>
      kind === "cols" ? a.r0 === 0 && a.r1 >= sh.size.rows - 1 && index >= a.c0 && index <= a.c1 : a.c0 === 0 && a.c1 >= sh.size.cols - 1 && index >= a.r0 && index <= a.r1,
    );
    return whole ? selectedIndexes(store, kind) : [index];
  };

  /**
   * Mouse and pen (and a finger once it moved off a handle or a header, or tapped a header):
   * select (or resize, fill, point) right away and follow the drag. `drags` false: only select
   * (a finger lifting after a tap has nothing left to drag).
   */
  const press = (e: ReactPointerEvent<HTMLDivElement>, hit: Hit, handle: string | undefined, drags = true) => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId);
    if (!sh) return;
    const R = sh.size.rows - 1;
    const C = sh.size.cols - 1;
    const sel = s.selection;
    const l = latest.current.layout;
    const id = e.pointerId;
    const follow = (d: Drag) => {
      if (!drags) return;
      drag.current = d;
      lastPoint.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(id);
    };
    if (handle === "fill") {
      follow({ kind: "fill", id, from: activeArea(sel), to: null });
      return;
    }
    if (handle === "tl" || handle === "br") {
      follow({ kind: "handle", id, corner: handle, main: mainArea(sel) });
      return;
    }
    if (!s.readOnly && hit.kind === "colHeader" && hit.edge !== null) {
      const was = colWidth(l, hit.edge);
      follow({ kind: "colSize", id, index: hit.edge, all: resizeSet("cols", hit.edge), start: e.clientX, size: was, was });
      if (drag.current) updateDrag(drag.current, e.clientX, e.clientY);
      return;
    }
    if (!s.readOnly && hit.kind === "rowHeader" && hit.edge !== null) {
      const was = rowHeight(l, hit.edge);
      follow({ kind: "rowSize", id, index: hit.edge, all: resizeSet("rows", hit.edge), start: e.clientY, size: was, was });
      if (drag.current) updateDrag(drag.current, e.clientX, e.clientY);
      return;
    }
    if (pointing(store)) {
      // Typing a formula: the cell (or a whole column or row, from its header) becomes a reference.
      if (hit.kind === "cell") {
        const p = { row: hit.row, col: hit.col };
        pointAt(store, p, p);
        follow({ kind: "point", id, anchor: p, axis: "cells" });
        keepTyping();
        return;
      }
      if (hit.kind === "colHeader" || hit.kind === "rowHeader") {
        const cols = hit.kind === "colHeader";
        const a = cols ? { row: 0, col: hit.col } : { row: hit.row, col: 0 };
        pointAt(store, a, cols ? { row: R, col: hit.col } : { row: hit.row, col: C });
        follow({ kind: "point", id, anchor: a, axis: cols ? "cols" : "rows" });
        keepTyping();
        return;
      }
    }
    const extra = e.ctrlKey || e.metaKey ? selectionAreas(sel) : [];
    if (hit.kind === "corner") {
      store.select({ anchor: { row: 0, col: 0 }, focus: { row: R, col: C }, extra: [] });
    } else if (hit.kind === "colHeader") {
      const from = e.shiftKey ? sel.anchor.col : hit.col;
      store.select({ anchor: { row: 0, col: from }, focus: { row: R, col: hit.col }, extra });
      if (!store.get().edit) follow({ kind: "cols", id, anchor: from, extra });
    } else if (hit.kind === "rowHeader") {
      const from = e.shiftKey ? sel.anchor.row : hit.row;
      store.select({ anchor: { row: from, col: 0 }, focus: { row: hit.row, col: C }, extra });
      if (!store.get().edit) follow({ kind: "rows", id, anchor: from, extra });
    } else {
      const p = { row: hit.row, col: hit.col };
      // A pen's double tap edits like a double-click (browsers don't always send dblclick for pens).
      if (e.pointerType === "pen" && !e.shiftKey && !extra.length) {
        const now = clock();
        const last = lastTap.current;
        lastTap.current = { at: now, row: p.row, col: p.col };
        if (last && now - last.at < 400 && last.row === p.row && last.col === p.col && !s.readOnly) {
          lastTap.current = null;
          store.startEdit({ via: "cell", replace: false, at: p });
          if (store.get().edit) {
            textarea.current?.focus({ preventScroll: true });
            return;
          }
        }
      }
      if (e.shiftKey) store.select({ anchor: sel.anchor, focus: p, extra: sel.extra });
      else store.select({ anchor: p, focus: p, extra });
      if (!store.get().edit) follow({ kind: "cells", id, anchor: e.shiftKey ? sel.anchor : p, extra: e.shiftKey ? sel.extra : extra });
    }
    if (!store.get().edit) focusGrid();
  };

  /** Pointing at cells while typing a formula in the cell: the cell editor keeps (or gets back) the keyboard, e.g. after a sheet tab took it. */
  const keepTyping = () => {
    const el = textarea.current;
    if (store.get().edit?.via === "cell" && el && document.activeElement !== el) el.focus({ preventScroll: true });
  };

  /** A finger tapped a cell (no scroll, no long press). */
  const tap = (hit: Hit & { kind: "cell" }, e: ReactPointerEvent<HTMLDivElement>) => {
    const s = store.get();
    const p = { row: hit.row, col: hit.col };
    setFillFor(null);
    if (pointing(store)) {
      pointAt(store, p, p);
      keepTyping();
      return;
    }
    const now = clock();
    const last = lastTap.current;
    lastTap.current = { at: now, row: p.row, col: p.col };
    const double = !!last && now - last.at < 380 && last.row === p.row && last.col === p.col;
    const onActive = s.selection.anchor.row === p.row && s.selection.anchor.col === p.col;
    if (!s.edit && !s.readOnly && (double || onActive)) {
      store.startEdit({ via: "cell", replace: false, at: p });
      // A number comes up selected: a finger has no other quick way to type over a cell, and typing
      // after "0,104" would make "0,1040,110". Text and formulas open with the caret at the end, to
      // fix a word or go on with the formula.
      const cell = sheetById(s.workbook, s.sheetId)?.cells[cellKey(p.row, p.col)];
      const number = !!cell && cell.f === undefined && (typeof cell.v === "number" || (typeof cell.v === "string" && numberLike(cell.v)));
      if (number && store.get().edit) selectOnOpen.current = true;
      // Focus within the tap, so the on-screen keyboard opens.
      textarea.current?.focus({ preventScroll: true });
      return;
    }
    if (e.shiftKey) store.select({ anchor: s.selection.anchor, focus: p, extra: s.selection.extra });
    else store.select(p);
    if (store.get().edit) return;
    focusGrid();
    const info = tipFor(p);
    setTip(info);
  };

  /**
   * Before a menu opens over `hit`, what it is about gets selected, unless it already is (a
   * right-click or long press inside the selection keeps it): a column's letter its column, a row
   * number its row, a cell its cell, the corner everything. Where it is: a cell only partly in view
   * isn't scrolled into view, as that scroll would close the menu again at once.
   */
  const selectForMenu = (hit: Hit) => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId)!;
    const R = sh.size.rows - 1;
    const C = sh.size.cols - 1;
    const select = (anchor: Pos, focus: Pos) => {
      const was = s.selection.focus;
      if (was.row !== focus.row || was.col !== focus.col) stay.current = focus;
      store.select({ anchor, focus, extra: [] });
    };
    if (hit.kind === "colHeader") {
      const inside = selectionAreas(s.selection).some((a) => a.r0 === 0 && a.r1 >= R && hit.col >= a.c0 && hit.col <= a.c1);
      if (!inside) select({ row: 0, col: hit.col }, { row: R, col: hit.col });
    } else if (hit.kind === "rowHeader") {
      const inside = selectionAreas(s.selection).some((a) => a.c0 === 0 && a.c1 >= C && hit.row >= a.r0 && hit.row <= a.r1);
      if (!inside) select({ row: hit.row, col: 0 }, { row: hit.row, col: C });
    } else if (hit.kind === "cell") {
      const p = { row: hit.row, col: hit.col };
      if (!isSelected(store, p)) select(p, p);
    } else select({ row: 0, col: 0 }, { row: R, col: C });
  };

  /** The menu for what is selected: whole columns get the column menu and whole rows the row menu, wherever it was opened. */
  const openMenu = (at: MenuPoint) => {
    const s = store.get();
    const sh = sheetById(s.workbook, s.sheetId);
    if (!sh || s.edit) return;
    setTip(null);
    setMenu({ at, kind: menuKindFor(s.selection, sh) });
  };

  const longPress = () => {
    const tp = touch.current;
    if (!tp) return;
    tp.long = true;
    tp.timer = null;
    lastLongPress.current = clock();
    // A finger held on a handle's dot holds the selection's corner: the menu is for the selection.
    // Elsewhere in the handle's box it is held on the cell under it (the boxes reach into the neighbours).
    if (!onDot(tp, tp.x, tp.y)) {
      const hit = tp.handle ? hitAt(tp.x, tp.y, TOUCH_SLOP) : tp.hit;
      if (hit.kind === "corner") return;
      selectForMenu(hit);
    }
    if (store.get().edit) return;
    swallowClick.current = true;
    navigator.vibrate?.(12);
    openMenu({ x: tp.x, y: tp.y, keyboard: false, finger: true });
  };

  const penHover = (on: boolean) => {
    const el = scroller.current;
    // A pen that hovers before touching should select by dragging, not scroll: no panning while it is near.
    if (el) el.style.touchAction = on ? "none" : "";
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    const target = e.target as HTMLElement;
    if (target.closest("[data-grid-overlay], [data-grid-ignore], textarea, input, button, a, [role=listbox], [role=dialog]")) return;
    const kind = e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "pen" : "mouse";
    if (kind !== lastPointer) setLastPointer(kind);
    if (e.pointerType === "touch") penHover(false);
    setTip(null);
    hoverKey.current = "";
    const { px, py, el } = local(e.clientX, e.clientY);
    // On the scrollbars.
    if (px >= el.clientWidth || py >= el.clientHeight) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const handleEl = target.closest<HTMLElement>("[data-handle]");
    const handle = handleEl?.dataset.handle;
    const hit = hitAt(e.clientX, e.clientY, e.pointerType === "touch" ? TOUCH_SLOP : 4);
    // A finger first waits to see what it does (see Pending), on a column's or row's border too:
    // moving from there resizes, but a tap or a hold is for the column or row under it (a border's
    // finger-wide zone covers most of a row's number). Not on a header while a formula wants a
    // reference (that points at once).
    const header = (hit.kind === "colHeader" || hit.kind === "rowHeader") && !pointing(store);
    if (e.pointerType === "touch" && (handle || hit.kind === "cell" || header)) {
      cancelTouch();
      const r = handleEl?.getBoundingClientRect();
      const dot = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, hit, handle, dot, long: false, timer: setTimeout(longPress, LONG_PRESS) };
      return;
    }
    press(e, hit, handle);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      lastPoint.current = { x: e.clientX, y: e.clientY };
      updateDrag(d, e.clientX, e.clientY);
      if (autoFrame.current === null) autoScroll();
      return;
    }
    const tp = touch.current;
    if (tp && tp.id === e.pointerId) {
      if (Math.hypot(e.clientX - tp.x, e.clientY - tp.y) <= (tp.handle ? HANDLE_SLOP : TOUCH_SLOP)) return;
      cancelTouch();
      // After a long press (the menu is open) moving does nothing more; on a cell the finger scrolls
      // the sheet (the browser does that). On a handle or a header it drags from where it came down.
      if (tp.long || (!tp.handle && tp.hit.kind === "cell")) return;
      press(e, tp.hit, tp.handle);
      const started = drag.current;
      if (started) {
        // A border goes with the finger from where it came down.
        if (started.kind === "colSize") started.start = tp.x;
        else if (started.kind === "rowSize") started.start = tp.y;
        updateDrag(started, e.clientX, e.clientY);
        if (autoFrame.current === null) autoScroll();
      }
      return;
    }
    if (e.pointerType === "pen" && !e.buttons) penHover(true);
    if (e.pointerType !== "mouse" || e.buttons) return;
    const el = scroller.current;
    const target = e.target as HTMLElement;
    if (!el || target.closest("[data-grid-overlay], textarea, button, [role=listbox]")) {
      hover(null);
      return;
    }
    const hit = hitAt(e.clientX, e.clientY, 4);
    el.style.cursor = !readOnly && hit.kind === "colHeader" && hit.edge !== null ? "col-resize" : !readOnly && hit.kind === "rowHeader" && hit.edge !== null ? "row-resize" : "";
    hover(hit.kind === "cell" ? { row: hit.row, col: hit.col } : null);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      endDrag(true);
      return;
    }
    const tp = touch.current;
    if (!tp || tp.id !== e.pointerId) return;
    cancelTouch();
    if (tp.long) return;
    if (tp.handle) {
      // The handles' finger-sized boxes reach into the cells around their corner: a tap there is
      // for that cell. Only a tap on the dot itself is for the handle (the fill square then says
      // how it works).
      if (onDot(tp, e.clientX, e.clientY)) {
        if (tp.handle === "fill") notify(t.fillByTouch);
        return;
      }
      const under = hitAt(e.clientX, e.clientY, TOUCH_SLOP);
      if (under.kind === "cell") tap(under, e);
    } else if (tp.hit.kind === "cell") tap(tp.hit, e);
    else if (tp.hit.kind === "colHeader" || tp.hit.kind === "rowHeader") {
      setFillFor(null);
      // Near a border too: the tap selects the column or row under the finger.
      press(e, { ...tp.hit, edge: null }, undefined, false);
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) endDrag(false);
    if (touch.current?.id === e.pointerId) cancelTouch();
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "pen") penHover(false);
    if (e.pointerType === "mouse") hover(null);
  };

  // Keep the keyboard where it is while pointing at cells for a formula (in the cell or the formula
  // bar); otherwise the grid takes it (focusGrid above). No text selection by dragging either way.
  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest("textarea, input, [data-grid-overlay], [role=dialog]")) e.preventDefault();
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, button, [data-grid-overlay], [role=listbox]")) return;
    const s = store.get();
    if (s.readOnly) return;
    // By position: the first click captured the pointer, so the double-click's target is the grid itself.
    const fillHandle = scroller.current?.querySelector<HTMLElement>('[data-handle="fill"]')?.getBoundingClientRect();
    const onFill = !!fillHandle && e.clientX >= fillHandle.left - 2 && e.clientX <= fillHandle.right + 2 && e.clientY >= fillHandle.top - 2 && e.clientY <= fillHandle.bottom + 2;
    if (onFill) {
      // Fill down as far as the data beside it goes.
      const sh = sheetById(s.workbook, s.sheetId)!;
      const from = activeArea(s.selection);
      const end = fillDownEnd(sh, from);
      if (end === null || end <= from.r1) return;
      fillTo(store, from, { ...from, r1: end });
      return;
    }
    const hit = hitAt(e.clientX, e.clientY, 4);
    const sh = sheetById(s.workbook, s.sheetId)!;
    if (hit.kind === "colHeader" && hit.edge !== null) {
      // A border with hidden columns next to it shows them; otherwise the column fits its content.
      const next = hit.edge + 1;
      if (next < sh.size.cols && sh.cols[next]?.hidden) {
        const run: number[] = [];
        for (let c = next; c < sh.size.cols && sh.cols[c]?.hidden; c++) run.push(c);
        unhideNear(store, "cols", run);
      } else fitColumns(store, resizeSet("cols", hit.edge));
      return;
    }
    if (hit.kind === "rowHeader" && hit.edge !== null) {
      const next = hit.edge + 1;
      if (next < sh.size.rows && sh.rows[next]?.hidden) {
        const run: number[] = [];
        for (let r = next; r < sh.size.rows && sh.rows[r]?.hidden; r++) run.push(r);
        unhideNear(store, "rows", run);
      } else fitRows(store, resizeSet("rows", hit.edge));
      return;
    }
    if (hit.kind === "cell" && !pointing(store) && e.detail >= 2) store.startEdit({ via: "cell", replace: false, at: { row: hit.row, col: hit.col } });
  };

  const onContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, [data-grid-overlay]")) return;
    e.preventDefault();
    // A long press on a touch screen already opened the menu.
    if (clock() - lastLongPress.current < 1200) return;
    // A finger still down (Android's own long press): the menu opens beside it, and lifting it clicks nothing.
    const tp = touch.current;
    if (tp) {
      if (tp.timer) clearTimeout(tp.timer);
      tp.timer = null;
      tp.long = true;
      lastLongPress.current = clock();
      swallowClick.current = true;
    }
    if (e.clientX === 0 && e.clientY === 0) {
      openMenuAtActive();
      return;
    }
    selectForMenu(hitAt(e.clientX, e.clientY, 4));
    if (store.get().edit) return;
    focusGrid();
    openMenu({ x: e.clientX, y: e.clientY, keyboard: false, finger: !!tp });
  };

  // ------------------------------------------------------------------------------------------
  // Keyboard and clipboard

  const openMenuAtActive = () => {
    const box = cellBox(store.get().selection.anchor);
    openMenu({ x: box.x + Math.min(box.w, 24), y: box.y + box.h, keyboard: true });
  };

  const prepareClipboard = (kind: "copy" | "cut" | "paste", plain: boolean) => {
    const el = sink.current;
    if (!el) return;
    pasteMode.current = plain ? "values" : "all";
    // Something selected in a text field: every browser then fires copy/cut at it (and paste into it).
    el.value = kind === "paste" ? "" : " ";
    el.focus({ preventScroll: true });
    el.select();
  };

  const gridKey = (e: ReactKeyboardEvent<HTMLElement>) => {
    const l = latest.current;
    handleGridKey(e, {
      store,
      layout: l.layout,
      view: l.view,
      typeInto: () => textarea.current?.focus({ preventScroll: true }),
      prepareClipboard,
      openMenu: openMenuAtActive,
      openChooser: (kind) => {
        const box = cellBox(store.get().selection.anchor);
        setChooser({ at: { x: box.x + Math.min(box.w, 24), y: box.y + box.h, keyboard: true }, kind });
      },
      openDecor: () => {
        const a = store.get().selection.anchor;
        const button = document.getElementById(cellId(gridId, a.row, a.col))?.querySelector("button");
        if (button) onDecor(a.row, a.col, button);
      },
      reveal: () => {
        const el = scroller.current;
        if (!el) return;
        const f = store.get().selection.anchor;
        const next = scrollToShow(l.layout, f, { left: el.scrollLeft, top: el.scrollTop }, { w: el.clientWidth, h: el.clientHeight });
        el.scrollTo({ left: next.left, top: next.top });
      },
    });
  };

  const backToGrid = () => {
    const el = sink.current;
    if (el && document.activeElement === el) {
      el.value = "";
      focusGrid();
    }
  };

  /** Copy and paste of cells (not of text inside the cell editor, the note card or a chart). */
  const ownsClipboardEvent = (e: ReactClipboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target === sink.current || target === scroller.current) return true;
    if (target === textarea.current) return !store.get().edit;
    return !target.closest("input, textarea, [data-grid-overlay], [role=dialog]");
  };

  const onCopy = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!ownsClipboardEvent(e)) return;
    e.preventDefault();
    const cut = e.type === "cut";
    const p = copySelection(store, cut);
    e.clipboardData.setData("text/plain", p.text);
    e.clipboardData.setData("text/html", p.html);
    say((cut && !readOnly ? t.announceCut : t.announceCopied)(areaName(p.area)));
    backToGrid();
  };

  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    if (!ownsClipboardEvent(e)) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const html = e.clipboardData.getData("text/html");
    const mode = pasteMode.current;
    pasteMode.current = "all";
    if (!readOnly) pasteData(store, { text, html: html || undefined }, mode);
    backToGrid();
  };

  // A smart table's header button: call the newest decorate (the cell keeps its element between renders).
  const onDecor = useCallback(
    (row: number, col: number, anchor: HTMLElement) => {
      latest.current.decorate?.(store.get().sheetId, row, col)?.button?.onClick(anchor);
    },
    [store],
  );

  // Stop timers when the grid goes away.
  useEffect(
    () => () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (saidTimer.current) clearTimeout(saidTimer.current);
      if (autoFrame.current !== null) cancelAnimationFrame(autoFrame.current);
      if (touch.current?.timer) clearTimeout(touch.current.timer);
    },
    [],
  );

  // Two fingers zoom (75–200 %); one finger keeps scrolling natively.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let start: { dist: number; zoom: number } | null = null;
    const spread = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      start = { dist: spread(e), zoom: store.get().zoom };
      const tp = touch.current;
      if (tp?.timer) clearTimeout(tp.timer);
      touch.current = null;
    };
    const onMove = (e: TouchEvent) => {
      // The finger that opened the menu with a long press slides on: the sheet stays still (its
      // scrolling would close the menu).
      if (swallowClick.current && e.cancelable) e.preventDefault();
      if (!start || e.touches.length !== 2 || start.dist <= 0) return;
      e.preventDefault();
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAround(start.zoom * (spread(e) / start.dist), mx, my);
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
      // The finger that opened the menu with a long press lifts. Browsers would now click whatever
      // is under it (iOS always does after a hold): no click. (pointerup came first and already
      // ended the press, so a flag of its own says so.)
      if (e.type === "touchend" && swallowClick.current && e.touches.length === 0) {
        swallowClick.current = false;
        if (e.cancelable) e.preventDefault();
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [store, zoomAround]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const left = Math.floor(el.scrollLeft / SLACK) * SLACK;
    const top = Math.floor(el.scrollTop / SLACK) * SLACK;
    setScroll((s) => (s.left === left && s.top === top ? s : { left, top }));
    if (tip) setTip(null);
  };

  // ------------------------------------------------------------------------------------------
  // Rendering

  const l = layout;
  const fr = l.freezeRows;
  const fc = l.freezeCols;
  const R = l.rows - 1;
  const C = l.cols - 1;
  const footer = readOnly || l.rows >= MAX_ROWS ? 0 : FOOTER;
  const activeShown =
    ready &&
    rowHeight(l, active.row) > 0 &&
    colWidth(l, active.col) > 0 &&
    (active.row < fr || (active.row >= win.r0 && active.row <= win.r1)) &&
    (active.col < fc || (active.col >= win.c0 && active.col <= win.c1));
  const pane = (r0: number, r1: number, c0: number, c1: number, colMin: number, colMax: number) => (
    <PaneCells
      src={src}
      layout={l}
      locale={locale}
      describe={describe}
      gridId={gridId}
      onDecor={onDecor}
      r0={r0}
      r1={r1}
      c0={c0}
      c1={c1}
      colMin={colMin}
      colMax={colMax}
      areas={areas}
      active={active}
      fontEpoch={fonts}
    />
  );
  const marks = (bounds: Bounds) => (
    <SelectionLayer
      layout={l}
      bounds={bounds}
      areas={areas}
      main={main}
      active={active}
      quiet={!!edit && edit.text.startsWith("=")}
      handles={handles}
      clip={clipHere}
      frames={frames}
      fillPreview={fillPreview}
      fillLabel={t.fillHandle}
      extendLabel={t.extendSelection}
    />
  );
  const divider = "pointer-events-none absolute bg-ink-3/45";

  let live = said;
  if (!live && (areas.length > 1 || main.r0 !== main.r1 || main.c0 !== main.c1)) {
    live = areas.length > 1 ? t.announceAreas(areas.length) : t.announceRange(areaName(main), (main.r1 - main.r0 + 1) * (main.c1 - main.c0 + 1));
  }

  return (
    <div className={cn("relative h-full min-h-0 w-full min-w-0", className)}>
      <div
        ref={scroller}
        role="grid"
        tabIndex={0}
        data-sheet-grid=""
        aria-label={t.grid(sheet.name)}
        aria-rowcount={l.rows + 1}
        aria-colcount={l.cols + 1}
        aria-multiselectable
        aria-readonly={readOnly || undefined}
        aria-activedescendant={activeShown && !edit ? cellId(gridId, active.row, active.col) : undefined}
        className="sheet-grid absolute inset-0 overflow-auto overscroll-contain bg-paper text-ink outline-none [touch-action:pan-x_pan-y] focus-visible:shadow-[inset_0_0_0_2px_var(--blob)]"
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={(e) => {
          // Only the grid's own capture ending ends a drag: a finger's drag starts on its first move
          // (see onPointerMove), and taking the capture over from the handle or header it came down
          // on makes that element lose it.
          if (e.target === e.currentTarget && drag.current?.id === e.pointerId) endDrag(true);
        }}
        onPointerLeave={onPointerLeave}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onKeyDown={(e) => {
          if (e.key === "Escape" && fillFor) setFillFor(null);
          if (e.target === e.currentTarget || e.target === sink.current) gridKey(e);
        }}
        onFocus={(e) => {
          // The grid got the keyboard while a cell is being edited in place: the editor takes it.
          const s = store.get();
          if (e.target === e.currentTarget && s.edit?.via === "cell") textarea.current?.focus({ preventScroll: true });
        }}
        onCopy={onCopy}
        onCut={onCopy}
        onPaste={onPaste}
      >
        <div className="relative" style={{ width: l.headerW + l.width, height: l.headerH + l.height + footer }}>
          {/* The scrolling cells */}
          <div className="absolute isolate bg-raised" style={{ left: l.headerW, top: l.headerH, width: l.width, height: l.height, zIndex: 0 }}>
            {ready && (
              <>
                <GridLines layout={l} r0={win.r0} r1={win.r1} c0={win.c0} c1={win.c1} />
                <div role="rowgroup">{pane(win.r0, win.r1, win.c0, win.c1, fc, C)}</div>
                {marks({ r0: fr, r1: R, c0: fc, c1: C })}
                <div data-grid-overlay="" className="pointer-events-none absolute inset-0 z-[3]">
                  {overlay?.(geometry)}
                </div>
              </>
            )}
          </div>

          {/* Column letters and the frozen rows: stay at the top */}
          <div className="sticky top-0 z-20 h-0 w-0">
            {ready && (
              <>
                <div className="absolute left-0 top-0 bg-hover shadow-[inset_0_-1px_0_var(--line-2)] [touch-action:none]" style={{ width: l.headerW + l.width, height: l.headerH }} />
                <div className="[touch-action:none]">
                  <ColumnHeaders layout={l} c0={win.c0} c1={win.c1} areas={areas} t={t} touch={coarse} />
                </div>
                {fr > 0 && (
                  <div className="absolute isolate bg-raised" style={{ left: l.headerW, top: l.headerH, width: l.width, height: l.frozenH }}>
                    <GridLines layout={l} r0={0} r1={fr - 1} c0={win.c0} c1={win.c1} />
                    <div role="rowgroup">{pane(0, fr - 1, win.c0, win.c1, fc, C)}</div>
                    {marks({ r0: 0, r1: fr - 1, c0: fc, c1: C })}
                    <div className={divider} style={{ left: 0, top: l.frozenH - 1, width: l.width, height: 2 }} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Row numbers and the frozen columns: stay at the left */}
          <div className="sticky left-0 z-20 h-0 w-0">
            {ready && (
              <>
                <div className="absolute left-0 bg-hover shadow-[inset_-1px_0_0_var(--line-2)] [touch-action:none]" style={{ top: l.headerH, width: l.headerW, height: l.height }} />
                <div className="[touch-action:none]">
                  <RowHeaders layout={l} r0={win.r0} r1={win.r1} areas={areas} t={t} touch={coarse} />
                </div>
                {fc > 0 && (
                  <div className="absolute isolate bg-raised" style={{ left: l.headerW, top: l.headerH, width: l.frozenW, height: l.height }}>
                    <GridLines layout={l} r0={win.r0} r1={win.r1} c0={0} c1={fc - 1} />
                    <div role="rowgroup">{pane(win.r0, win.r1, 0, fc - 1, 0, fc - 1)}</div>
                    {marks({ r0: fr, r1: R, c0: 0, c1: fc - 1 })}
                    <div className={divider} style={{ left: l.frozenW - 1, top: 0, width: 2, height: l.height }} />
                  </div>
                )}
                {footer > 0 && (
                  <div className="absolute flex items-center gap-2 px-3" style={{ left: 0, top: l.headerH + l.height, height: footer, width: Math.min(view.w, l.headerW + l.width) }}>
                    <button
                      type="button"
                      data-grid-ignore=""
                      onClick={() => addRoom(store, "rows", 100)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-3 text-[12.5px] font-medium text-ink-2 shadow-card transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-9"
                    >
                      <Plus className="size-3.5" />
                      {t.addRows(100)}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* The corner: select all, and the frozen corner of rows and columns */}
          <div className="sticky left-0 top-0 z-30 h-0 w-0">
            {ready && (
              <>
                <div className="[touch-action:none]">
                  <CornerHeader layout={l} all={main.r0 === 0 && main.c0 === 0 && main.r1 >= R && main.c1 >= C} t={t} />
                  {fc > 0 && <ColumnHeaders layout={l} c0={0} c1={fc - 1} areas={areas} t={t} touch={coarse} />}
                  {fr > 0 && <RowHeaders layout={l} r0={0} r1={fr - 1} areas={areas} t={t} touch={coarse} />}
                </div>
                {fr > 0 && fc > 0 && (
                  <div className="absolute isolate bg-raised" style={{ left: l.headerW, top: l.headerH, width: l.frozenW, height: l.frozenH }}>
                    <GridLines layout={l} r0={0} r1={fr - 1} c0={0} c1={fc - 1} />
                    <div role="rowgroup">{pane(0, fr - 1, 0, fc - 1, 0, fc - 1)}</div>
                    {marks({ r0: 0, r1: fr - 1, c0: 0, c1: fc - 1 })}
                    <div className={divider} style={{ left: 0, top: l.frozenH - 1, width: l.frozenW, height: 2 }} />
                    <div className={divider} style={{ left: l.frozenW - 1, top: 0, width: 2, height: l.frozenH }} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Typing into a cell */}
          <CellEditor
            store={store}
            layout={l}
            scroll={scroll}
            view={view}
            sheetId={sheetId}
            locale={locale}
            t={t}
            gridId={gridId}
            textarea={textarea}
            scroller={scroller}
            onGridKey={gridKey}
            focusGrid={focusGrid}
            touch={pointerKind === "touch"}
            selectOnOpenRef={selectOnOpen}
          />

          {/* While resizing: a line where the border will be */}
          {guide && <ResizeGuide guide={guide} layout={l} view={view} />}
        </div>
        {/* The browser copies from and pastes into this hidden field (see prepareClipboard). */}
        <textarea
          ref={sink}
          aria-hidden
          tabIndex={-1}
          readOnly={false}
          className="pointer-events-none fixed left-0 top-0 size-px resize-none opacity-0"
          onKeyDown={(e) => {
            e.stopPropagation();
            focusGrid();
            gridKey(e);
          }}
        />
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>

      {notice && (
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="max-w-md rounded-xl border border-line bg-raised px-3.5 py-2 text-[13px] text-ink-2 shadow-pop">{notice}</div>
        </div>
      )}

      <GridMenu
        store={store}
        at={menu?.at ?? null}
        kind={menu?.kind ?? "cells"}
        onClose={closeMenu}
        extra={contextMenu}
        onNote={(pos) => setNoteFor({ pos, box: cellBox(pos) })}
        onFill={
          pointerKind === "touch"
            ? () => {
                setFillFor({ sheetId: store.get().sheetId, area: mainArea(store.get().selection) });
                notify(t.fillByTouch);
              }
            : undefined
        }
        notify={notify}
        t={t}
        keys={{ mod: mac ? "⌘" : t.ctrl, shift: mac ? "⇧" : t.shift }}
      />
      <Chooser
        store={store}
        at={chooser?.at ?? null}
        kind={chooser?.kind ?? "insert"}
        onClose={closeChooser}
        t={t}
      />
      {noteFor && (
        <NotePopover store={store} at={noteFor.pos} rect={noteFor.box} t={t} onClose={closeNote} />
      )}
      {tip && !menu && !noteFor && <CellTip tip={tip} t={t} locale={locale} />}
    </div>
  );
}

/** The line that shows where a column's or row's border will be, and the new size (in viewport terms: a sticky layer at the top-left). */
function ResizeGuide({ guide, layout, view }: { guide: Guide; layout: Layout; view: Viewport }) {
  const label = "absolute whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-paper shadow-pop";
  return (
    <div aria-hidden className="pointer-events-none sticky left-0 top-0 z-50 h-0 w-0">
      {guide.kind === "col" ? (
        <>
          <div className="absolute top-0 w-0.5 bg-blob" style={{ left: guide.at - 1, height: Math.min(view.h, layout.headerH + layout.height) }} />
          <div className={label} style={{ left: guide.at + 6, top: layout.headerH + 4 }}>
            {guide.label}
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-0 h-0.5 bg-blob" style={{ top: guide.at - 1, width: Math.min(view.w, layout.headerW + layout.width) }} />
          <div className={label} style={{ top: guide.at + 6, left: layout.headerW + 4 }}>
            {guide.label}
          </div>
        </>
      )}
    </div>
  );
}

/** A cell's note or the meaning of its error, beside the cell (hovering with a mouse, tapping on touch). */
function CellTip({ tip, t, locale }: { tip: Tip; t: (typeof sheetGridText)["en"]; locale: Locale }) {
  if (typeof document === "undefined") return null;
  const { box } = tip;
  const width = 280;
  const right = typeof window !== "undefined" && box.x + box.w + width + 12 > window.innerWidth;
  const left = right ? Math.max(8, box.x - width - 6) : box.x + box.w + 6;
  const error = tip.error;
  const help = error ? t.errors[error.error] : null;
  let explained = help?.text ?? "";
  if (error) {
    // The engine knows the details ("unknown-function:SUMM" → did you mean SUMME?); our words are the fallback.
    try {
      explained = explainError(error, locale) || explained;
      // The heading already names the error: don't say it twice ("Division durch null: …").
      if (help && explained.toLowerCase().startsWith(`${help.title.toLowerCase()}:`)) explained = explained.slice(help.title.length + 1).trim();
    } catch {
      const unknown = error.detail?.startsWith("unknown-function:") ? error.detail.slice("unknown-function:".length) : null;
      if (unknown) explained = t.unknownFunction(unknown);
    }
  }
  return createPortal(
    <div role="tooltip" className="pointer-events-none fixed z-[85] w-max max-w-[280px] rounded-xl border border-line bg-raised px-3 py-2 text-[12.5px] leading-snug text-ink-2 shadow-pop" style={{ left, top: box.y }}>
      {help && (
        <div>
          <div className="font-semibold text-[var(--sheet-red)]">{help.title}</div>
          <div className="mt-0.5">{explained}</div>
        </div>
      )}
      {tip.numberText !== null && (
        <div className={help ? "mt-2 border-t border-line pt-2" : undefined}>
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            {/* The same corner mark as on the cell. */}
            <span aria-hidden className="size-0 shrink-0" style={{ borderTop: "8px solid var(--sheet-orange)", borderRight: "8px solid transparent" }} />
            {t.numberText.title}
          </div>
          <div className="mt-0.5">
            {locale === "de" ? `„${tip.numberText}“` : `“${tip.numberText}”`}: {t.numberText.text}
          </div>
        </div>
      )}
      {tip.note && (
        <div className={help || tip.numberText !== null ? "mt-2 border-t border-line pt-2" : undefined}>
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{t.note}</div>
          <div className="mt-0.5 whitespace-pre-wrap text-ink">{tip.note}</div>
        </div>
      )}
    </div>,
    document.body,
  );
}
