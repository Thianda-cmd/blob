// Where things are on screen: sheets stacked in a column (SHEET_GAP apart), seen through a view
// that scales and moves them. Doc units: x across a sheet (0–SHEET_W), y down the column.

import { SHEET_GAP, SHEET_H, SHEET_W } from "./model";

/** CSS pixels: screen = doc × scale + (tx, ty). */
export type View = { scale: number; tx: number; ty: number };

export const PITCH = SHEET_H + SHEET_GAP;
export const sheetTop = (index: number) => index * PITCH;
export const columnHeight = (sheets: number) => Math.max(0, sheets * PITCH - SHEET_GAP);

/** Space under the last sheet for the "add a page" button (units). */
export const FOOT = 220;

/** The sheet at doc height y (the nearest, for the gaps and beyond the ends). */
export function sheetAt(y: number, count: number): number {
  if (count <= 0) return -1;
  const i = Math.floor((y + SHEET_GAP / 2) / PITCH);
  return Math.max(0, Math.min(count - 1, i));
}

export type Bounds = { width: number; height: number };

/** How big the sheets show by default: their width across the screen, no wider than a large page. */
export function fitScale(b: Bounds, coarse: boolean): number {
  const margin = b.width < 640 ? 10 : 28;
  const fit = (b.width - 2 * margin) / SHEET_W;
  // Desktops: about the size of real paper. Tablets and phones: as wide as the screen.
  return Math.max(0.1, coarse ? fit : Math.min(fit, 1.15));
}

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 6;

/**
 * The view moved inside the column's limits: the sheets centred when narrower than the screen,
 * never scrolled past the first sheet's top (and `head` pixels of title above it) or the foot.
 * `give` lets it stretch past them a little (while a finger drags), like a rubber band.
 */
export function clampView(v: View, b: Bounds, sheets: number, give = 0, head = 0): View {
  const w = SHEET_W * v.scale;
  const h = (columnHeight(sheets) + FOOT) * v.scale;
  const pad = Math.min(28, b.width * 0.04);
  let { tx, ty } = v;
  if (w + 2 * pad <= b.width) tx = (b.width - w) / 2;
  else tx = soft(tx, b.width - w - pad, pad, give);
  // Room above the first sheet for the note's title.
  const top = pad + 6 + head;
  const minTy = Math.min(top, b.height - h);
  ty = soft(ty, minTy, top, give);
  return { scale: v.scale, tx, ty };
}

/** Keeps x within [lo, hi]; with `give`, past the edge moves only a little (rubber band). */
function soft(x: number, lo: number, hi: number, give: number): number {
  if (x > hi) return give ? hi + rubber(x - hi, give) : hi;
  if (x < lo) return give ? lo - rubber(lo - x, give) : lo;
  return x;
}

const rubber = (d: number, dim: number) => (d * dim * 0.55) / (dim + 0.55 * d);
