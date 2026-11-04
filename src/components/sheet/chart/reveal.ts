// Where a chart on the sheet can be seen, for ChartLayer: how far to scroll the grid so a chart
// shows (with its action bar), how much of it shows, and where its action bar goes so a finger
// can reach it. All in screen px from getBoundingClientRect; the measuring is ChartLayer's, the
// arithmetic is here, pure, so the check script tests it.

/** A box on screen (px). */
export type Rect = { left: number; top: number; right: number; bottom: number };

/** Room kept between a chart scrolled into view and the edges of what you see (px). */
const REVEAL_MARGIN = 12;
/** The action bar of a selected chart, with its gap (px): above the chart, or below it at the top of the sheet. */
export const BAR_SPACE = 52;

/**
 * Smooth scrolling, unless the student asked her system for less motion: then the grid jumps.
 * (Also for other scrolling that belongs to the spreadsheet, such as a note's jump into one.)
 */
export function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export type RevealInput = {
  /** The chart now. */
  card: Rect;
  /** Where the grid shows scrolling cells: below the headers and frozen panes, above settings docked over the grid. */
  room: Rect;
  /** Where the chart's action bar is, so it shows too (null: no bar). */
  bar: "above" | "below" | null;
  /** The block of cells the chart is made from (with its labels, x values and header row), or null. */
  data: Rect | null;
  /**
   * settings: the chart's settings are opening. While any of the data shows, it slides no further
   * out on the left or the top, and what doesn't fit beside it the panel shows itself (Excel and
   * Sheets don't move the sheet at all). show: the chart itself is wanted (just duplicated, opened
   * from a note, a new chart once its docked settings close): it comes into view, and the data's
   * left edge only stays when it shows and half of the chart shows already.
   */
  mode: "settings" | "show";
  /** The grid's scroll position and how far it can scroll. */
  scroll: { left: number; top: number; maxLeft: number; maxTop: number };
};

/**
 * Where to scroll the grid (its scrollLeft and scrollTop) so the chart is in view: sideways only as
 * far as it must; up and down so the chart and its bar show, its top when it is taller than the
 * room. null when there is no room to show anything (settings docked over nearly all of the grid).
 */
export function revealScroll({ card, room, bar, data, mode, scroll }: RevealInput): { left: number; top: number } | null {
  const M = REVEAL_MARGIN;
  if (room.right - room.left < 40 || room.bottom - room.top < 40) return null;
  const top0 = card.top - (bar === "above" ? BAR_SPACE : 0);
  const bottom0 = card.bottom + (bar === "below" ? BAR_SPACE : 0);
  let dy = 0;
  // Taller than the room: its top (title, the upper part of the plot) shows.
  if (bottom0 - top0 > room.bottom - room.top - 2 * M || top0 < room.top + M) dy = top0 - (room.top + M);
  else if (bottom0 > room.bottom - M) dy = bottom0 - (room.bottom - M);

  let dx = 0;
  if (card.left < room.left + M) dx = card.left - (room.left + M);
  else if (card.right > room.right - M) dx = Math.max(0, Math.min(card.right - (room.right - M), card.left - (room.left + M)));

  // The cells the chart is made from don't slide (further) out on the left or the top.
  if (data && dx > 0) {
    const width = Math.max(1, card.right - card.left);
    const shown = (Math.min(card.right, room.right) - Math.max(card.left, room.left)) / width;
    const keep =
      mode === "settings" ? data.right > room.left && data.left < room.right : data.left >= room.left - 1 && data.left < room.right && data.left < card.left && shown >= 0.5;
    if (keep) dx = Math.min(dx, Math.max(0, data.left - room.left));
  }
  if (data && dy > 0 && mode === "settings" && data.bottom > room.top && data.top < room.bottom) dy = Math.min(dy, Math.max(0, data.top - room.top));

  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
  return { left: clamp(scroll.left + dx, scroll.maxLeft), top: clamp(scroll.top + dy, scroll.maxTop) };
}

/** How much of a chart shows in the room: the smaller share of its width and of its height (0 to 1). */
export function shownShare(card: Rect, room: Rect): number {
  const w = card.right - card.left;
  const h = card.bottom - card.top;
  if (w <= 0 || h <= 0) return 0;
  const x = Math.max(0, Math.min(card.right, room.right) - Math.max(card.left, room.left));
  const y = Math.max(0, Math.min(card.bottom, room.bottom) - Math.max(card.top, room.top));
  return Math.min(x / w, y / h);
}

/** A chart this much in view counts as seen: its panel leaves out the copy of it. */
export const IN_VIEW = 0.9;
/** Once seen, it counts as gone only below this much: scrolling a little doesn't make the copy flick in and out. */
export const OUT_OF_VIEW = 0.75;

/** Whether the open settings' chart counts as in view now, after counting as `was` (null: not decided yet). */
export function inViewNext(was: boolean | null, share: number): boolean {
  return was ? share >= OUT_OF_VIEW : share >= IN_VIEW;
}

/** Room kept between a selected chart's action bar and the edges of what you see (px). */
const BAR_MARGIN = 8;

/**
 * How far to move a selected chart's action bar from its own place (above or below the chart,
 * centred) so it stays inside the room while the chart shows there: a chart wider than a phone,
 * or scrolled half out of view, keeps its buttons where a finger reaches them. It stays over the
 * part of the chart that shows; wider than that part, it reaches out over the cells beside it, as
 * far as it must to show all its buttons. Nothing moves for a chart that doesn't show.
 * `overChart: false` (the chart's settings are open, the student watches it change): the bar
 * doesn't move up or down onto the chart; where it can't be seen beside it, the settings have
 * the same buttons.
 */
export function barShift(bar: Rect, chart: Rect, room: Rect, overChart = true): { x: number; y: number } {
  const M = BAR_MARGIN;
  let x = 0;
  const lo = Math.max(room.left, chart.left) + M;
  const hi = Math.min(room.right, chart.right) - M;
  if (hi > lo) {
    const w = bar.right - bar.left;
    let left = bar.left < lo ? lo : bar.right > hi ? hi - w : bar.left;
    left = Math.max(room.left + M, Math.min(left, room.right - M - w));
    x = left - bar.left;
  }
  let y = 0;
  const h = bar.bottom - bar.top;
  const minTop = room.top + M;
  const maxTop = room.bottom - M - h;
  if (maxTop >= minTop && chart.bottom > minTop && chart.top < room.bottom - M) {
    const top = Math.max(minTop, Math.min(maxTop, bar.top));
    if (overChart || top >= chart.bottom || top + h <= chart.top) y = top - bar.top;
  }
  return { x: Math.round(x), y: Math.round(y) };
}
