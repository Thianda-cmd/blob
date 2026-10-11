import { addDays, startOfDay } from "date-fns";
import type { CalItem } from "./items";
import { MINUTES_PER_DAY, dayDiff, minutesInto, weekStart } from "./time";

// Where things go on screen: side-by-side columns for timed items that overlap on a day, and rows
// for bars in the all-day lane and the month grid.

export type TimedBox = {
  item: CalItem;
  /** Minutes from the day's midnight (clipped to the day). */
  top: number;
  bottom: number;
  /** Column, of `cols` side by side, and how many columns it may stretch over. */
  col: number;
  cols: number;
  span: number;
  /** It started on an earlier day / goes on after this one. */
  fromBefore: boolean;
  goesOn: boolean;
};

/**
 * Lays out one day's timed items. Items shorter than `minMinutes` count as that long, so short ones
 * that would hide each other's titles sit side by side.
 */
export function layoutDay(items: CalItem[], day: Date, minMinutes = 20): TimedBox[] {
  const d = startOfDay(day);
  const boxes: TimedBox[] = [];
  for (const item of items) {
    const s = minutesInto(d, item.start);
    const e = minutesInto(d, item.end);
    const top = Math.max(0, s);
    const bottom = Math.min(MINUTES_PER_DAY, e);
    // (A zero-length item still shows at its time.)
    if (top >= MINUTES_PER_DAY || bottom < 0 || (bottom <= top && !(s === e && s >= 0))) continue;
    boxes.push({ item, top, bottom: Math.max(bottom, top), col: 0, cols: 1, span: 1, fromBefore: s < 0, goesOn: e > MINUTES_PER_DAY });
  }
  boxes.sort((a, b) => a.top - b.top || b.bottom - b.top - (a.bottom - a.top) || a.item.key.localeCompare(b.item.key));

  const seen = (b: TimedBox) => Math.max(b.bottom, b.top + minMinutes);
  let cluster: TimedBox[] = [];
  let columns: number[] = [];
  let clusterEnd = -1;

  const close = () => {
    const cols = columns.length;
    for (const b of cluster) {
      b.cols = cols;
      // Stretch right over columns that are free for the whole of this item.
      let span = 1;
      for (let c = b.col + 1; c < cols; c++) {
        if (cluster.some((o) => o.col === c && o.top < seen(b) && seen(o) > b.top)) break;
        span++;
      }
      b.span = span;
    }
    cluster = [];
    columns = [];
    clusterEnd = -1;
  };

  for (const b of boxes) {
    if (cluster.length && b.top >= clusterEnd) close();
    let col = columns.findIndex((end) => end <= b.top);
    if (col < 0) {
      col = columns.length;
      columns.push(0);
    }
    columns[col] = seen(b);
    b.col = col;
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, seen(b));
  }
  if (cluster.length) close();
  return boxes;
}

export type LaneBar = {
  item: CalItem;
  row: number;
  /** First and last (inclusive) day column it covers. */
  first: number;
  last: number;
  /** It starts before the first day shown / ends after the last. */
  fromBefore: boolean;
  goesOn: boolean;
};

/** The first and last (inclusive) local day an item covers. */
export function itemDays(item: Pick<CalItem, "start" | "end" | "allDay">): { first: Date; last: Date } {
  const first = startOfDay(item.start);
  // The end is exclusive: an all-day item ending at midnight, or a timed one ending at 00:00,
  // doesn't reach that day.
  const endDay = startOfDay(item.end);
  const last = item.end.getTime() > item.start.getTime() && endDay.getTime() === item.end.getTime() ? addDays(endDay, -1) : endDay;
  return { first, last: last < first ? first : last };
}

/** Rows for bars over `days` (consecutive): longer and earlier bars first, each in the first free row. */
export function packLane(items: CalItem[], days: Date[]): { bars: LaneBar[]; rows: number } {
  if (!days.length) return { bars: [], rows: 0 };
  const day0 = startOfDay(days[0]);
  const n = days.length;
  const bars: LaneBar[] = [];
  for (const item of items) {
    const { first, last } = itemDays(item);
    const f = dayDiff(first, day0);
    const l = dayDiff(last, day0);
    if (l < 0 || f > n - 1) continue;
    bars.push({ item, row: 0, first: Math.max(0, f), last: Math.min(n - 1, l), fromBefore: f < 0, goesOn: l > n - 1 });
  }
  bars.sort(
    (a, b) =>
      a.first - b.first ||
      b.last - b.first - (a.last - a.first) ||
      (a.item.allDay === b.item.allDay ? 0 : a.item.allDay ? -1 : 1) ||
      a.item.start.getTime() - b.item.start.getTime() ||
      a.item.title.localeCompare(b.item.title),
  );
  const taken: boolean[][] = [];
  for (const bar of bars) {
    let row = 0;
    for (; ; row++) {
      const r = (taken[row] ??= Array(n).fill(false));
      let free = true;
      for (let c = bar.first; c <= bar.last; c++) if (r[c]) free = false;
      if (free) {
        for (let c = bar.first; c <= bar.last; c++) r[c] = true;
        break;
      }
    }
    bar.row = row;
  }
  return { bars, rows: taken.length };
}

/**
 * With room for `maxRows` rows, which bars show and how many are hidden on each day. When a day
 * needs more rows than fit, its last row becomes "+n more".
 */
export function fitLane(bars: LaneBar[], days: number, maxRows: number): { shown: LaneBar[]; hidden: number[] } {
  const need = Array(days).fill(0);
  for (const b of bars) for (let c = b.first; c <= b.last; c++) need[c] = Math.max(need[c], b.row + 1);
  const hidden = Array(days).fill(0);
  const shown: LaneBar[] = [];
  for (const b of bars) {
    let fits = true;
    for (let c = b.first; c <= b.last; c++) {
      const room = need[c] > maxRows ? maxRows - 1 : maxRows;
      if (b.row >= room) fits = false;
    }
    if (fits) shown.push(b);
    else for (let c = b.first; c <= b.last; c++) hidden[c]++;
  }
  return { shown, hidden };
}

/** The weeks a month view shows (each a list of 7 days), from the week holding the 1st. */
export function monthWeeks(month: Date, weekStartsOn: number): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const weeks: Date[][] = [];
  for (let w = weekStart(first, weekStartsOn); w < next; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  }
  return weeks;
}
