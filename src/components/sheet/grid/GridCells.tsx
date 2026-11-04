"use client";

// The cells of one pane of the grid (the scrolling part, or the frozen rows/columns): only the
// rows and columns near the screen, only cells with something to show, each a memoised element
// that re-renders only when its own look changes. Long text spills over empty neighbours like in
// Excel, numbers too wide for their column shorten or show "###".

import { ArrowDown, ArrowUp, ChevronDown, Filter } from "lucide-react";
import { memo, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { sheetGridText } from "@/i18n/messages/sheetGrid";
import { cellKey } from "@/sheet/a1";
import type { Calc, CellError, CellValue } from "@/sheet/engine";
import type { Area, BorderLine, Cell, Pos, Sheet } from "@/sheet/types";
import { errorHelp } from "../chrome/errorHelp";
import { borderCss, CELL_PAD, fitNumber, lookOf, numberAsText, type CellLook } from "./cellLook";
import { colWidth, type Layout } from "./geometry";
import type { CellDecor } from "./Grid";
import { LINE_HEIGHT, textWidth } from "./measure";
import { filled } from "./navigation";

export type GridText = (typeof sheetGridText)["en"];
type Decorate = (sheetId: string, row: number, col: number) => CellDecor | null;

/**
 * What the cells of a pane read: the sheet's cells, their values and a smart table's look. A new
 * one after every change. Only functions inside, so React's development tools (which compare the
 * props of every re-rendered component, walking into objects) don't walk 10,000 cells per row.
 */
export type CellSource = {
  sheetId: string;
  cell: (row: number, col: number) => Cell | undefined;
  value: (row: number, col: number) => CellValue;
  decor: ((row: number, col: number) => CellDecor | null) | null;
};

export function cellSource(sheet: Sheet, calc: Calc, decorate: Decorate | undefined): CellSource {
  return {
    sheetId: sheet.id,
    cell: (row, col) => sheet.cells[cellKey(row, col)],
    value: (row, col) => calc.value(sheet.id, row, col),
    decor: decorate ? (row, col) => decorate(sheet.id, row, col) : null,
  };
}

/** The id of a cell's element (for aria-activedescendant). */
export const cellId = (gridId: string, row: number, col: number) => `${gridId}-c${row}-${col}`;

/**
 * What a screen reader hears about a cell besides its text: its error in words (the same as the
 * tooltip and the status bar say, errorHelp: `formula` is the cell's own, for one that can't be
 * read), that it is a number stored as text, its note.
 */
export type Describe = (error: CellError | null, note: string, numberText?: boolean, formula?: string) => string | undefined;

export function describer(t: GridText, locale: Locale): Describe {
  return (error, note, numberText, formula) => {
    const help = error ? errorHelp(error, locale, formula) : null;
    return [help && `${help.title}. ${help.text}`, numberText && `${t.numberText.title}. ${t.numberText.text}`, note && `${t.note}: ${note}`].filter(Boolean).join(" ") || undefined;
  };
}

type PaneProps = {
  src: CellSource;
  layout: Layout;
  locale: Locale;
  describe: Describe;
  gridId: string;
  onDecor: (row: number, col: number, anchor: HTMLElement) => void;
  /** The rows and columns to render (inclusive). */
  r0: number;
  r1: number;
  c0: number;
  c1: number;
  /** The pane's own columns: text spills only inside them. */
  colMin: number;
  colMax: number;
  areas: Area[];
  active: Pos | null;
  /** Changes when fonts finished loading (measurements change). */
  fontEpoch: number;
};

/** The selected column spans of a row, as a short key ("0-3,7-7"), so rows that didn't change skip rendering. */
function spansOf(areas: Area[], row: number, c0: number, c1: number): string {
  let key = "";
  for (const a of areas) {
    if (row < a.r0 || row > a.r1 || a.c1 < c0 || a.c0 > c1) continue;
    key += `${key ? "," : ""}${Math.max(a.c0, c0)}-${Math.min(a.c1, c1)}`;
  }
  return key;
}

export const PaneCells = memo(function PaneCells(p: PaneProps) {
  const rows: ReactNode[] = [];
  for (let r = p.r0; r <= p.r1; r++) {
    const h = p.layout.rowTop[r + 1] - p.layout.rowTop[r];
    if (h <= 0) continue;
    rows.push(
      <GridRow
        key={r}
        row={r}
        y={p.layout.rowTop[r]}
        h={h}
        src={p.src}
        layout={p.layout}
        locale={p.locale}
        describe={p.describe}
        gridId={p.gridId}
        onDecor={p.onDecor}
        c0={p.c0}
        c1={p.c1}
        colMin={p.colMin}
        colMax={p.colMax}
        selected={spansOf(p.areas, r, p.c0, p.c1)}
        activeCol={p.active && p.active.row === r ? p.active.col : -1}
        fontEpoch={p.fontEpoch}
      />,
    );
  }
  return <>{rows}</>;
});

type RowProps = Omit<PaneProps, "r0" | "r1" | "areas" | "active"> & {
  row: number;
  y: number;
  h: number;
  selected: string;
  activeCol: number;
};

const inSpans = (spans: string, col: number) => {
  if (!spans) return false;
  for (const s of spans.split(",")) {
    const i = s.indexOf("-");
    if (col >= Number(s.slice(0, i)) && col <= Number(s.slice(i + 1))) return true;
  }
  return false;
};

const GridRow = memo(function GridRow(p: RowProps) {
  const { src, layout, row, locale } = p;
  const zoom = layout.zoom;
  const pad = Math.round(CELL_PAD * zoom);
  const isEmpty = (c: number) => !filled(src.cell(row, c));
  const out: ReactNode[] = [];

  /** One cell's element: its look, fitted into its column, spilling where it may. */
  const place = (c: number, isActive: boolean, only?: "spillOnly") => {
    const w = colWidth(layout, c);
    if (w <= 0) return;
    const cell = src.cell(row, c);
    const decor = src.decor ? src.decor(row, c) : null;
    if (!cell && !decor && !isActive) return;
    const value = cell && (cell.v !== undefined || cell.f !== undefined) ? src.value(row, c) : null;
    const look = lookOf(cell, value, decor, locale);
    const numberText = look.kind === "text" && numberAsText(cell, (d) => (row + d < 0 ? null : src.value(row + d, c)));
    const size = look.size * zoom;
    const buttonW = decor?.button ? Math.round(20 * zoom) : 0;
    const avail = Math.max(0, w - 2 * pad - buttonW);
    let text = look.text;
    let x = layout.colLeft[c];
    let width = w;
    let spill = false;
    if (look.kind === "number" && !look.wrap && text) text = fitNumber(look, value as number, avail, size, locale);
    else if (look.kind === "text" && !look.wrap && text && !decor?.button) {
      // Text wider than its cell runs on over empty neighbours (to the right, left or both, by alignment).
      const need = textWidth(text, size, look.bold, look.italic) - avail;
      if (need > 0) {
        let right = 0;
        let left = 0;
        const wantRight = look.align === "left" ? need : look.align === "center" ? need / 2 : 0;
        const wantLeft = look.align === "right" ? need : look.align === "center" ? need / 2 : 0;
        for (let k = c + 1; right < wantRight && k <= p.colMax && isEmpty(k); k++) right += colWidth(layout, k);
        for (let k = c - 1; left < wantLeft && k >= p.colMin && isEmpty(k); k--) left += colWidth(layout, k);
        if (right || left) {
          spill = true;
          x -= left;
          width += left + right;
        }
      }
    }
    // A cell beside the rendered columns only matters when it spills into them.
    if (only === "spillOnly" && (!spill || x + width <= layout.colLeft[p.c0] || x >= layout.colLeft[p.c1 + 1])) return;
    out.push(
      <GridCell
        key={c}
        id={isActive ? cellId(p.gridId, row, c) : undefined}
        col={c}
        x={x}
        w={width}
        h={p.h}
        pad={pad}
        zoom={zoom}
        text={text}
        look={look}
        size={size}
        spill={spill}
        note={!!cell?.note}
        numberText={numberText}
        description={p.describe(look.error ? { error: look.error, detail: look.errorDetail } : null, cell?.note ?? "", numberText, cell?.f)}
        selected={inSpans(p.selected, c)}
        decorButton={decor?.button ? `${decor.button.state}|${decor.button.label}` : ""}
        lineBelow={decor?.lineBelow === "strong"}
        lineAbove={decor?.lineAbove === "strong"}
        lineColor={decor?.color}
        row={row}
        onDecor={p.onDecor}
      />,
    );
  };

  // Text from a cell just left (or right) of the rendered columns may spill into them.
  for (let k = p.c0 - 1; k >= Math.max(p.colMin, p.c0 - 40); k--) {
    if (!isEmpty(k)) {
      place(k, false, "spillOnly");
      break;
    }
  }
  for (let c = p.c0; c <= p.c1; c++) place(c, c === p.activeCol);
  for (let k = p.c1 + 1; k <= Math.min(p.colMax, p.c1 + 40); k++) {
    if (!isEmpty(k)) {
      place(k, false, "spillOnly");
      break;
    }
  }

  return (
    <div role="row" aria-rowindex={row + 2} className="absolute left-0 w-0" style={{ top: p.y, height: p.h }}>
      {out}
    </div>
  );
});

type CellProps = {
  id: string | undefined;
  row: number;
  col: number;
  x: number;
  w: number;
  h: number;
  pad: number;
  zoom: number;
  text: string;
  look: CellLook;
  size: number;
  spill: boolean;
  /** Has a note (the corner mark). */
  note: boolean;
  /** Text that looks like a number (a mark in the other corner, see numberAsText). */
  numberText: boolean;
  /** The error in words and the note, for screen readers. */
  description: string | undefined;
  selected: boolean;
  /** "state|label" of a smart table's header button, or "". */
  decorButton: string;
  lineBelow: boolean;
  lineAbove: boolean;
  lineColor: string | undefined;
  onDecor: (row: number, col: number, anchor: HTMLElement) => void;
};

/** Shallow compare, but the look by its fields (it is a new object on every render of the row). */
function sameCell(a: CellProps, b: CellProps): boolean {
  for (const k in a) {
    const key = k as keyof CellProps;
    if (key === "look") continue;
    if (a[key] !== b[key]) return false;
  }
  const x = a.look;
  const y = b.look;
  for (const k in x) {
    const key = k as keyof CellLook;
    if (x[key] !== y[key]) return false;
  }
  return true;
}

const BUTTON_ICONS = { plain: ChevronDown, filtered: Filter, sortedAsc: ArrowUp, sortedDesc: ArrowDown } as const;

/**
 * Was a finger's press moved onto a smart table's header button by the browser? Chrome's touch
 * adjustment hands a touch near a small button to that button (pointer events included), though the
 * finger came down on the cell below it; the event's point still says where it really was. Such a
 * press is for the cell under the finger (the grid takes it), not for the button.
 */
export function movedOntoButton(e: { target: EventTarget | null; clientX: number; clientY: number; pointerType: string }): boolean {
  if (e.pointerType !== "touch" || !(e.target instanceof Element)) return false;
  const cell = e.target.closest("[data-decor-button]")?.closest("[role=gridcell]");
  if (!cell) return false;
  const r = cell.getBoundingClientRect();
  return e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom;
}

/**
 * The finger-sized box around a smart table's header button, relative to the button (which sits
 * centred at the cell's right edge): 36 px wide, reaching left over the header text, and exactly as
 * tall as its header cell. Never into the next column or the row above or below: a tap there is
 * meant for that cell (and the browser's touch adjustment would pull it onto the button).
 */
function touchTarget(cellW: number, cellH: number, zoom: number) {
  const size = Math.round(18 * zoom);
  const inset = Math.round(3 * zoom);
  // (Measured from inside the button's 1 px border.)
  return { right: -inset - 1, top: -(cellH - size) / 2 - 1, width: Math.min(cellW, Math.max(36, size + inset)), height: cellH };
}

const GridCell = memo(function GridCell(p: CellProps) {
  const { look, zoom } = p;
  const justify = look.align === "left" ? "flex-start" : look.align === "center" ? "center" : "flex-end";
  const items = look.valign === "top" ? "flex-start" : look.valign === "bottom" ? "flex-end" : "center";
  const decoration = [look.underline && "underline", look.strike && "line-through"].filter(Boolean).join(" ") || undefined;
  const [bt, br, bb, bl] = look.borders ? (look.borders.split(",") as (BorderLine | "")[]) : [];
  const shadows: string[] = [];
  // A spilling cell covers the gridlines it runs over, so it draws its own at its far edges.
  if (p.spill && !look.fill) shadows.push("inset -1px -1px 0 var(--line)");
  if (p.lineBelow) shadows.push(`inset 0 -${Math.max(2, Math.round(2 * zoom))}px 0 ${p.lineColor ?? "var(--ink-3)"}`);
  if (p.lineAbove) shadows.push(`inset 0 ${Math.max(2, Math.round(2 * zoom))}px 0 ${p.lineColor ?? "var(--ink-3)"}`);
  const sep = p.decorButton.indexOf("|");
  const buttonState = (sep > 0 ? p.decorButton.slice(0, sep) : "plain") as keyof typeof BUTTON_ICONS;
  const buttonLabel = sep > 0 ? p.decorButton.slice(sep + 1) : "";
  const Icon = BUTTON_ICONS[buttonState] ?? ChevronDown;
  const mark = Math.max(5, Math.round(6 * zoom));
  const description = p.description;
  return (
    <div
      role="gridcell"
      id={p.id}
      aria-colindex={p.col + 2}
      aria-selected={p.selected}
      aria-label={description ? `${p.text ? `${p.text}. ` : ""}${description}` : undefined}
      className="absolute top-0"
      style={{
        left: p.x,
        width: p.w,
        height: p.h,
        zIndex: p.spill ? 1 : undefined,
        background: look.fill ?? (p.spill ? "var(--raised)" : undefined),
        boxShadow: shadows.length ? shadows.join(", ") : undefined,
      }}
    >
      <div
        className={look.kind === "number" ? "absolute inset-0 flex overflow-hidden tabular-nums" : "absolute inset-0 flex overflow-hidden"}
        style={{
          justifyContent: look.wrap ? undefined : justify,
          alignItems: items,
          paddingLeft: p.pad,
          paddingRight: p.pad + (buttonLabel ? Math.round(20 * zoom) : 0),
          paddingTop: look.wrap ? Math.round(3 * zoom) : 0,
          paddingBottom: look.wrap ? Math.round(3 * zoom) : 0,
          fontSize: p.size,
          lineHeight: LINE_HEIGHT,
          fontWeight: look.bold ? 700 : undefined,
          fontStyle: look.italic ? "italic" : undefined,
          textDecoration: decoration,
          color: look.color ?? (look.kind === "error" ? "var(--sheet-red)" : undefined),
        }}
      >
        {/* A smart table's header ends before its button ("Konzentr…"): the box's padding keeps the
            button's room, but text running on past it would still show between the button and the
            cell's edge. Other text is cut without dots where its cell (or its spill) ends, as in Excel. */}
        <span
          className={look.wrap ? "block w-full whitespace-pre-wrap [overflow-wrap:anywhere]" : buttonLabel ? "min-w-0 overflow-hidden text-ellipsis whitespace-pre" : "whitespace-pre"}
          style={look.wrap ? { textAlign: look.align } : undefined}
        >
          {p.text}
        </span>
      </div>
      {look.borders && (
        <div
          aria-hidden
          className="pointer-events-none absolute -left-px -top-px bottom-0 right-0"
          style={{ borderTop: borderCss(bt, zoom), borderRight: borderCss(br, zoom), borderBottom: borderCss(bb, zoom), borderLeft: borderCss(bl, zoom) }}
        />
      )}
      {look.error && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 size-0"
          style={{ borderTop: `${mark}px solid var(--sheet-red)`, borderRight: `${mark}px solid transparent` }}
        />
      )}
      {p.numberText && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 size-0"
          style={{ borderTop: `${mark + 1}px solid var(--sheet-orange)`, borderRight: `${mark + 1}px solid transparent` }}
        />
      )}
      {p.note && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-0"
          style={{ borderTop: `${mark}px solid var(--blob)`, borderLeft: `${mark}px solid transparent` }}
        />
      )}
      {buttonLabel && (
        <button
          type="button"
          tabIndex={-1}
          data-grid-ignore=""
          data-decor-button=""
          aria-label={buttonLabel}
          title={buttonLabel}
          onPointerDown={(e) => {
            // A press the browser moved here from the cell below goes on to the grid (see movedOntoButton).
            if (movedOntoButton(e)) {
              delete e.currentTarget.dataset.pressed;
              return;
            }
            e.stopPropagation();
            e.currentTarget.dataset.pressed = "";
          }}
          onClick={(e) => {
            const pressed = e.currentTarget.dataset.pressed !== undefined;
            delete e.currentTarget.dataset.pressed;
            // …and so does its tap: a click made by a pointer (detail > 0) opens the menu only after
            // a press on the button. Safari moves the tap's click alone onto the button (the press
            // stays on the cell below), and its click isn't a PointerEvent that would say "touch".
            // A screen reader's or the keyboard's click (detail 0) has no press and always opens it.
            if (e.detail > 0 && !pressed) return;
            p.onDecor(p.row, p.col, e.currentTarget);
          }}
          className={
            buttonState === "plain"
              ? "absolute top-1/2 z-[1] grid -translate-y-1/2 place-items-center rounded-md border border-line bg-raised text-ink-3 shadow-card transition-colors hover:bg-hover hover:text-ink"
              : "absolute top-1/2 z-[1] grid -translate-y-1/2 place-items-center rounded-md border border-blob/40 bg-blob-soft text-blob-ink shadow-card transition-colors hover:bg-blob/20"
          }
          style={{ right: Math.round(3 * zoom), width: Math.round(18 * zoom), height: Math.round(18 * zoom) }}
        >
          <Icon style={{ width: Math.round(12 * zoom), height: Math.round(12 * zoom) }} strokeWidth={2.25} />
          {/* A finger needs more than the small button: on touch screens an invisible target around
              it, 36 px wide over the header text and as tall as the header cell (see touchTarget). */}
          <span aria-hidden className="absolute hidden [@media(hover:none)]:block" style={touchTarget(p.w, p.h, zoom)} />
        </button>
      )}
    </div>
  );
}, sameCell);

/** Gridlines of the rendered part of a pane: one line per column and per row instead of a border on every (mostly empty) cell. */
export const GridLines = memo(function GridLines({ layout, r0, r1, c0, c1 }: { layout: Layout; r0: number; r1: number; c0: number; c1: number }) {
  if (r1 < r0 || c1 < c0) return null;
  const top = layout.rowTop[r0];
  const bottom = layout.rowTop[r1 + 1];
  const left = layout.colLeft[c0];
  const right = layout.colLeft[c1 + 1];
  const lines: ReactNode[] = [];
  for (let c = c0; c <= c1; c++) {
    if (layout.colLeft[c + 1] === layout.colLeft[c]) continue;
    lines.push(<div key={`v${c}`} className="absolute w-px bg-line" style={{ left: layout.colLeft[c + 1] - 1, top, height: bottom - top }} />);
  }
  for (let r = r0; r <= r1; r++) {
    if (layout.rowTop[r + 1] === layout.rowTop[r]) continue;
    lines.push(<div key={`h${r}`} className="absolute h-px bg-line" style={{ top: layout.rowTop[r + 1] - 1, left, width: right - left }} />);
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {lines}
    </div>
  );
});
