"use client";

// What is drawn over the cells of one pane: the selected areas (a soft fill, the active cell
// with a strong border), the fill handle or the two round touch handles, the marching ants around
// what was copied, the coloured frames of the references in a formula being typed, and the
// outline of a fill being dragged. A pane draws only its own part of each area.

import { memo, type ReactNode } from "react";
import { sheetColor } from "@/sheet/colors";
import type { Area, Pos, SheetColor } from "@/sheet/types";
import type { Layout } from "./geometry";

/** The rows and columns a pane shows (inclusive). */
export type Bounds = { r0: number; r1: number; c0: number; c1: number };

type Piece = { x: number; y: number; w: number; h: number; top: boolean; right: boolean; bottom: boolean; left: boolean };

/** The part of an area inside a pane, and which of its edges are the area's real edges. */
export function pieceOf(l: Layout, a: Area, b: Bounds): Piece | null {
  const r0 = Math.max(a.r0, b.r0);
  const r1 = Math.min(a.r1, b.r1, l.rows - 1);
  const c0 = Math.max(a.c0, b.c0);
  const c1 = Math.min(a.c1, b.c1, l.cols - 1);
  if (r0 > r1 || c0 > c1) return null;
  const x = l.colLeft[c0];
  const y = l.rowTop[r0];
  const w = l.colLeft[c1 + 1] - x;
  const h = l.rowTop[r1 + 1] - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h, top: a.r0 === r0, bottom: a.r1 === r1, left: a.c0 === c0, right: a.c1 === c1 };
}

/** A box on a piece's real edges, drawn over the gridlines around it (1px out on the top and left). */
function Frame({ p, width, color, fill, dashed }: { p: Piece; width: number; color: string; fill?: string; dashed?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute box-border"
      style={{
        left: p.x - (p.left ? 1 : 0),
        top: p.y - (p.top ? 1 : 0),
        width: p.w + (p.left ? 1 : 0),
        height: p.h + (p.top ? 1 : 0),
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: color,
        borderTopWidth: p.top ? width : 0,
        borderRightWidth: p.right ? width : 0,
        borderBottomWidth: p.bottom ? width : 0,
        borderLeftWidth: p.left ? width : 0,
        background: fill,
      }}
    />
  );
}

/** The area without the active cell (which stays unshaded, like Excel), as up to four areas. */
function around(a: Area, p: Pos): Area[] {
  if (!(p.row >= a.r0 && p.row <= a.r1 && p.col >= a.c0 && p.col <= a.c1)) return [a];
  const out: Area[] = [];
  if (p.row > a.r0) out.push({ r0: a.r0, c0: a.c0, r1: p.row - 1, c1: a.c1 });
  if (p.row < a.r1) out.push({ r0: p.row + 1, c0: a.c0, r1: a.r1, c1: a.c1 });
  if (p.col > a.c0) out.push({ r0: p.row, c0: a.c0, r1: p.row, c1: p.col - 1 });
  if (p.col < a.c1) out.push({ r0: p.row, c0: p.col + 1, r1: p.row, c1: a.c1 });
  return out;
}

export type RefFrame = { area: Area; color: SheetColor };

type Props = {
  layout: Layout;
  bounds: Bounds;
  /** Selected areas (each once) and the main one (the active cell's, where the handles go). */
  areas: Area[];
  main: Area;
  active: Pos;
  /** Hide the selection (while typing into a cell its references are what matters). */
  quiet: boolean;
  handles: "fill" | "touch" | null;
  clip: { area: Area; cut: boolean } | null;
  frames: RefFrame[];
  fillPreview: Area | null;
  /** Labels of the handles (title/aria). */
  fillLabel: string;
  extendLabel: string;
};

export const SelectionLayer = memo(function SelectionLayer(p: Props) {
  const { layout: l, bounds: b } = p;
  const out: ReactNode[] = [];
  const z = l.zoom;

  if (!p.quiet) {
    const many = p.areas.length > 1 || p.areas.some((a) => a.r0 !== a.r1 || a.c0 !== a.c1);
    if (many) {
      p.areas.forEach((a, i) => {
        for (const part of around(a, p.active)) {
          const piece = pieceOf(l, part, b);
          if (piece) out.push(<div key={`f${i}-${part.r0}-${part.c0}`} aria-hidden className="sheet-sel-fill pointer-events-none absolute" style={{ left: piece.x, top: piece.y, width: piece.w, height: piece.h }} />);
        }
        const piece = pieceOf(l, a, b);
        if (piece) out.push(<Frame key={`b${i}`} p={piece} width={1} color="var(--blob)" />);
      });
    }
    const cell = pieceOf(l, { r0: p.active.row, c0: p.active.col, r1: p.active.row, c1: p.active.col }, b);
    if (cell) out.push(<Frame key="active" p={cell} width={2} color="var(--blob)" />);

    const m = p.main;
    const corner = m.r1 >= b.r0 && m.r1 <= b.r1 && m.c1 >= b.c0 && m.c1 <= b.c1;
    if (p.handles === "fill" && corner) {
      const s = Math.max(6, Math.round(7 * z));
      const x = l.colLeft[m.c1 + 1];
      const y = l.rowTop[m.r1 + 1];
      out.push(
        <div
          key="fill"
          data-handle="fill"
          title={p.fillLabel}
          className="absolute z-[2] cursor-crosshair bg-blob shadow-[0_0_0_1.5px_var(--raised)]"
          style={{ left: x - s / 2 - 0.5, top: y - s / 2 - 0.5, width: s, height: s, touchAction: "none" }}
        />,
      );
    }
    if (p.handles === "touch") {
      const start = m.r0 >= b.r0 && m.r0 <= b.r1 && m.c0 >= b.c0 && m.c0 <= b.c1;
      const handle = (key: "tl" | "br", x: number, y: number) => (
        <div
          key={key}
          data-handle={key}
          role="presentation"
          title={p.extendLabel}
          className="absolute z-[2] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center"
          style={{ left: x, top: y, touchAction: "none" }}
        >
          <span className="size-3.5 rounded-full border-2 border-raised bg-blob shadow-card" />
        </div>
      );
      if (start) out.push(handle("tl", l.colLeft[m.c0], l.rowTop[m.r0]));
      if (corner) out.push(handle("br", l.colLeft[m.c1 + 1], l.rowTop[m.r1 + 1]));
    }
  }

  p.frames.forEach((f, i) => {
    const piece = pieceOf(l, f.area, b);
    if (!piece) return;
    const color = sheetColor(f.color);
    out.push(<Frame key={`r${i}`} p={piece} width={2} color={color} fill={`color-mix(in oklab, ${color} 9%, transparent)`} />);
  });

  if (p.fillPreview) {
    const piece = pieceOf(l, p.fillPreview, b);
    if (piece) out.push(<Frame key="preview" p={piece} width={1.5} color="var(--ink-2)" dashed />);
  }

  if (p.clip) {
    const piece = pieceOf(l, p.clip.area, b);
    if (piece) {
      const w = piece.w + 1;
      const h = piece.h + 1;
      const d = [
        piece.top && `M0.75 0.75H${w - 0.75}`,
        piece.right && `M${w - 0.75} 0.75V${h - 0.75}`,
        piece.bottom && `M0.75 ${h - 0.75}H${w - 0.75}`,
        piece.left && `M0.75 0.75V${h - 0.75}`,
      ]
        .filter(Boolean)
        .join("");
      out.push(
        <svg key="ants" aria-hidden className="pointer-events-none absolute overflow-visible" style={{ left: piece.x - 1, top: piece.y - 1, width: w, height: h }}>
          <path d={d} fill="none" stroke="var(--raised)" strokeWidth={2} />
          <path className="sheet-ants" d={d} fill="none" stroke="var(--blob)" strokeWidth={1.5} strokeDasharray="5 4" />
        </svg>,
      );
    }
  }

  return (
    <div aria-hidden={p.handles === null ? true : undefined} className="pointer-events-none absolute inset-0 [&_[data-handle]]:pointer-events-auto">
      {out}
    </div>
  );
});
