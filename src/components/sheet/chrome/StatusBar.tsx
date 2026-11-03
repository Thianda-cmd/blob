"use client";

// The status bar under the sheet: for several selected cells the sum, mean, count, minimum,
// maximum and standard deviation of their numbers (a click copies one), for a single cell its
// note or what its error means; what typing is doing right now (Eingeben, Bearbeiten, Zeigen);
// and the zoom. When the figures don't all fit (a side panel is open, a phone), the less needed
// ones step aside whole, never cut: Summe, Mittelwert and Anzahl stay longest, with short signs
// (Σ, Ø, n) before one of them has to go.
//
// CONTRACT: <StatusBar store={store} /> is placed by SheetEditor. Implemented by the editor chrome.

import { Check, Lock, Minus, Plus, StickyNote, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { Popover } from "@/components/ui/Menu";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { cellKey, parseKey } from "@/sheet/a1";
import { explainError, formatValue, isError, type Calc } from "@/sheet/engine";
import { getCell, sheetById } from "@/sheet/ops";
import type { Area, NumberFormat, Sheet } from "@/sheet/types";
import { selectionAreas, useSheet, ZOOM_MAX, ZOOM_MIN, type Selection, type SheetStore } from "../store";
import { HoverTips, keepFocus } from "./parts";
import { wantsRef } from "./formulaInput";

export type SelectionStats = { cells: number; filled: number; count: number; sum: number; mean: number; min: number; max: number; stdev: number | null };

/**
 * The numbers of the selected cells (each counted once, hidden rows and columns left out, like
 * what you see): how many, their sum, mean, min, max and sample standard deviation (STABW.S).
 */
export function selectionStats(sheet: Sheet, calc: Calc, sheetId: string, sel: Selection, rowHidden: (row: number) => boolean): SelectionStats {
  const areas = selectionAreas(sel).map((a) => ({ r0: a.r0, c0: a.c0, r1: Math.min(a.r1, sheet.size.rows - 1), c1: Math.min(a.c1, sheet.size.cols - 1) }));
  let cells = 0;
  for (const a of areas) cells += Math.max(0, a.r1 - a.r0 + 1) * Math.max(0, a.c1 - a.c0 + 1);
  const values: number[] = [];
  let filled = 0;
  const hiddenRow = new Map<number, boolean>();
  const visit = (row: number, col: number) => {
    let h = hiddenRow.get(row);
    if (h === undefined) hiddenRow.set(row, (h = rowHidden(row)));
    if (h || sheet.cols[col]?.hidden) return;
    const v = calc.value(sheetId, row, col);
    if (v === null || v === "") return;
    filled++;
    if (typeof v === "number" && Number.isFinite(v)) values.push(v);
  };
  const inside = (a: Area, r: number, c: number) => r >= a.r0 && r <= a.r1 && c >= a.c0 && c <= a.c1;
  const keys = Object.keys(sheet.cells);
  if (cells > keys.length) {
    // A big selection (whole columns): only the cells that exist can hold numbers.
    for (const key of keys) {
      const p = parseKey(key);
      if (areas.some((a) => inside(a, p.row, p.col))) visit(p.row, p.col);
    }
  } else {
    const seen = areas.length > 1 ? new Set<string>() : null;
    for (const a of areas) {
      for (let r = a.r0; r <= a.r1; r++) {
        for (let c = a.c0; c <= a.c1; c++) {
          const key = cellKey(r, c);
          if (!sheet.cells[key]) continue;
          if (seen) {
            if (seen.has(key)) continue;
            seen.add(key);
          }
          visit(r, c);
        }
      }
    }
  }
  const count = values.length;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = count ? sum / count : 0;
  let stdev: number | null = null;
  if (count >= 2) {
    let sq = 0;
    for (const v of values) sq += (v - mean) * (v - mean);
    stdev = Math.sqrt(sq / (count - 1));
  }
  return { cells, filled, count, sum, mean, min: count ? min : 0, max: count ? max : 0, stdev };
}

/** Number formats the figures borrow from the active cell (dates and text don't make sense for a sum). */
function statFormat(fmt: NumberFormat | undefined): NumberFormat | undefined {
  if (!fmt) return undefined;
  return fmt.kind === "number" || fmt.kind === "percent" || fmt.kind === "scientific" || fmt.kind === "significant" || fmt.kind === "currency" ? fmt : undefined;
}

const ZOOMS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export type FigureKey = "sum" | "average" | "count" | "min" | "max" | "stdev";

/** Which figures stay longest when room is short: the first three one by one, then Stdabw., then Min and Max together. */
const FIGURE_PRIORITY: FigureKey[][] = [["sum"], ["average"], ["count"], ["stdev"], ["min", "max"]];
/** Of those, the ones that never give way to a later one (Anzahl is never shown without Summe). */
const CORE = 3;
/** The space between two figures (gap-0.5). */
export const FIGURE_GAP = 2;

/**
 * Which of the figures fit into `room` px, each whole or not at all, and whether with their short
 * signs (Σ, Ø, n, s): words when that shows as many, signs when they let more of the main three
 * stay. `widths` are the figures' widths with words (`full`) and signs (`short`).
 */
export function fitFigures(widths: { key: FigureKey; full: number; short: number }[], room: number): { keys: Set<FigureKey>; short: boolean } {
  const byKey = new Map(widths.map((w) => [w.key, w]));
  const pick = (short: boolean) => {
    const keys = new Set<FigureKey>();
    let used = 0;
    for (let i = 0; i < FIGURE_PRIORITY.length; i++) {
      const group = FIGURE_PRIORITY[i].filter((k) => byKey.has(k));
      if (!group.length) continue;
      let need = 0;
      for (const k of group) need += (short ? byKey.get(k)!.short : byKey.get(k)!.full) + (used + need > 0 ? FIGURE_GAP : 0);
      // (Widths are fractions of a pixel: half a pixel either way is still a fit.)
      if (used + need <= room + 0.5) {
        for (const k of group) keys.add(k);
        used += need;
      } else if (i < CORE) break;
    }
    return keys;
  };
  const isCore = (k: FigureKey) => FIGURE_PRIORITY.slice(0, CORE).some((g) => g.includes(k));
  const coreOf = (keys: Iterable<FigureKey>) => [...keys].filter(isCore).length;
  const words = pick(false);
  if (coreOf(words) >= coreOf(byKey.keys())) return { keys: words, short: false };
  const signs = pick(true);
  return coreOf(signs) > coreOf(words) ? { keys: signs, short: true } : { keys: words, short: false };
}

function Figure({
  label,
  name,
  tip,
  value,
  onCopy,
  copied,
  measure,
}: {
  /** What the figure shows (a word or a short sign). */
  label: string;
  /** Its full name, for screen readers. */
  name: string;
  tip: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  /** Only measured, never seen (the hidden copy that tells what fits). */
  measure?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onCopy}
      data-tip={measure ? undefined : tip}
      data-fig={measure}
      tabIndex={measure ? -1 : undefined}
      aria-label={`${name}: ${value}. ${tip}`}
      className="inline-flex h-7 shrink-0 items-baseline gap-1.5 whitespace-nowrap rounded-md px-1.5 pt-[5px] text-[12px] transition-colors hover:bg-hover [@media(hover:none)]:h-9 [@media(hover:none)]:pt-[9px]"
    >
      <span className="text-ink-3">{label}</span>
      {copied ? (
        <span className="inline-flex items-center gap-0.5 font-medium text-ok">
          <Check className="size-3 self-center" />
        </span>
      ) : (
        <span className="font-medium tabular-nums text-ink">{value}</span>
      )}
    </button>
  );
}

export function StatusBar({ store }: { store: SheetStore }): ReactNode {
  const t = useMessages(sheetChromeText);
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const sheetId = useSheet(store, (s) => s.sheetId);
  const selection = useSheet(store, (s) => s.selection);
  const workbook = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const zoom = useSheet(store, (s) => s.zoom);
  const edit = useSheet(store, (s) => s.edit);
  const [copied, setCopied] = useState<{ key: string; label: string } | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sheet = sheetById(workbook, sheetId);
  const anchor = selection.anchor;
  const areas = selectionAreas(selection);
  const single = areas.length === 1 && areas[0].r0 === areas[0].r1 && areas[0].c0 === areas[0].c1;
  const stats = useMemo(() => {
    if (!sheet || single) return null;
    try {
      return selectionStats(sheet, calc, sheetId, selection, (row) => store.isRowHidden(sheetId, row));
    } catch (err) {
      console.error("sheet: status bar figures failed", err);
      return null;
    }
  }, [sheet, single, calc, sheetId, selection, store]);

  const activeCell = getCell(workbook, sheetId, anchor.row, anchor.col);
  const fmt = statFormat(activeCell?.s?.fmt);
  const fmtNumber = (n: number, plain = false) => formatValue(n, plain ? undefined : fmt, locale);
  const activeValue = single ? calc.value(sheetId, anchor.row, anchor.col) : null;

  const copy = (key: string, label: string, text: string) => {
    const done = () => {
      setCopied({ key, label });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1400);
    };
    // Without clipboard access (an old browser, a denied permission) the figure is at least said out loud.
    const fallback = () => blob.say(`${label}: ${text}`);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  };

  // What typing is doing: "Zeigen" while a formula wants a reference (clicks and arrows insert one).
  let mode: "enter" | "edit" | "point" | null = null;
  if (edit) {
    let pointing = false;
    try {
      pointing = edit.text.startsWith("=") && wantsRef(edit.text, edit.caret, locale);
    } catch {
      pointing = false;
    }
    mode = pointing ? "point" : edit.replace ? "enter" : "edit";
  }

  const figures: { key: FigureKey; tip: string; value: string }[] = [];
  if (stats && stats.count > 0) {
    figures.push({ key: "sum", tip: t.statTips.sum, value: fmtNumber(stats.sum) });
    figures.push({ key: "average", tip: t.statTips.average, value: fmtNumber(stats.mean) });
    figures.push({ key: "count", tip: t.statTips.count, value: fmtNumber(stats.count, true) });
    figures.push({ key: "min", tip: t.statTips.min, value: fmtNumber(stats.min) });
    figures.push({ key: "max", tip: t.statTips.max, value: fmtNumber(stats.max) });
    if (stats.stdev !== null) figures.push({ key: "stdev", tip: t.statTips.stdev, value: fmtNumber(stats.stdev) });
  } else if (stats && stats.filled > 0) {
    figures.push({ key: "count", tip: t.statTips.filled, value: fmtNumber(stats.filled, true) });
  }

  // Which figures fit: a hidden copy of all of them (with words and with signs) is measured, and
  // the room is what the bar may take (the hidden copy asks for all of it, see below).
  const figBox = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ width: number; widths: Record<string, number> } | null>(null);
  const figureKeys = figures.map((f) => f.key).join(",");
  useEffect(() => {
    const box = figBox.current;
    const copies = ghost.current;
    if (!box || !copies || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const widths: Record<string, number> = {};
      for (const el of copies.querySelectorAll<HTMLElement>("[data-fig]")) widths[el.dataset.fig!] = el.getBoundingClientRect().width;
      const width = box.getBoundingClientRect().width;
      setRoom((old) => (old && old.width === width && Object.keys(widths).every((k) => old.widths[k] === widths[k]) && Object.keys(old.widths).length === Object.keys(widths).length ? old : { width, widths }));
    };
    const ro = new ResizeObserver(read);
    ro.observe(box);
    for (const el of copies.querySelectorAll("[data-fig]")) ro.observe(el);
    return () => ro.disconnect();
  }, [figureKeys, locale]);
  const fit = room
    ? fitFigures(
        figures.filter((f) => room.widths[`full:${f.key}`] && room.widths[`short:${f.key}`]).map((f) => ({ key: f.key, full: room.widths[`full:${f.key}`], short: room.widths[`short:${f.key}`] })),
        room.width,
      )
    : null;
  const shown = fit ? figures.filter((f) => fit.keys.has(f.key)) : [];

  const note = single ? activeCell?.note : undefined;
  const problem = single && isError(activeValue) ? explainError(activeValue, locale) : null;

  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    const at = i < 0 ? ZOOMS.length - 1 : i;
    const exact = Math.abs((ZOOMS[at] ?? zoom) - zoom) < 0.001;
    const next = dir > 0 ? ZOOMS[Math.min(ZOOMS.length - 1, exact ? at + 1 : at)] : ZOOMS[Math.max(0, at - 1)];
    store.setZoom(next);
  };
  // German puts a (narrow) space before %, English doesn't.
  const pct = (z: number) => (locale === "de" ? `${Math.round(z * 100)}\u202F%` : `${Math.round(z * 100)}%`);
  // On a phone the steps give their room to the figures: the percentage still opens the zoom levels, and fingers pinch.
  const zoomBtn = "grid size-7 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 max-sm:hidden [@media(hover:none)]:size-9";

  return (
    <div role="group" aria-label={t.statusBar} className="flex h-9 min-w-0 items-center gap-1 px-1.5 text-[12px] text-ink-3 [@media(hover:none)]:h-11">
      {readOnly && (
        <span data-tip={t.readOnlyTip} className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-hover px-2 text-[11.5px] font-medium text-ink-2">
          <Lock className="size-3" />
          {t.readOnly}
        </span>
      )}
      {mode && (
        <span
          data-tip={t.modeTips[mode]}
          className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11.5px] font-medium", mode === "point" ? "bg-blob-soft text-blob-ink" : "bg-hover text-ink-2")}
        >
          {t.modes[mode]}
        </span>
      )}
      <div ref={figBox} className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-w-0 items-center justify-end gap-0.5 overflow-hidden">
          {shown.map((f) => (
            <Figure
              key={f.key}
              label={fit?.short ? t.statsShort[f.key] : t.stats[f.key]}
              name={t.stats[f.key]}
              tip={`${fit?.short ? `${t.stats[f.key]}: ` : ""}${f.tip} · ${t.copyHint}`}
              value={f.value}
              copied={copied?.key === f.key}
              onCopy={() => copy(f.key, t.stats[f.key], f.value)}
            />
          ))}
          {!figures.length && problem && (
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-1.5 text-ink-2" title={problem}>
              <TriangleAlert className="size-3.5 shrink-0 text-danger" />
              <span className="truncate">{problem}</span>
            </span>
          )}
          {!figures.length && !problem && note && (
            <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-1.5 text-ink-2" title={note}>
              <StickyNote className="size-3.5 shrink-0 text-[var(--sheet-yellow)]" />
              <span className="sr-only">{t.note}: </span>
              <span className="truncate">{note.replace(/\s+/g, " ")}</span>
            </span>
          )}
        </div>
        {/* Every figure once more, unseen: with words in the flow (so the bar asks for the room
            they all need, up to what the editor gives it) and with signs out of it; measured above. */}
        <div ref={ghost} aria-hidden inert className="invisible h-0 overflow-hidden">
          <div className="flex w-max gap-0.5">
            {figures.map((f) => (
              <Figure key={f.key} label={t.stats[f.key]} name={t.stats[f.key]} tip="" value={f.value} measure={`full:${f.key}`} />
            ))}
          </div>
          <div className="absolute left-0 top-0 flex w-max gap-0.5">
            {figures.map((f) => (
              <Figure key={f.key} label={t.statsShort[f.key]} name={t.stats[f.key]} tip="" value={f.value} measure={`short:${f.key}`} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t.copied(copied.label) : ""}
      </span>
      <div className="flex shrink-0 items-center" role="group" aria-label={t.zoom}>
        <button type="button" onMouseDown={keepFocus} onClick={() => stepZoom(-1)} disabled={zoom <= ZOOM_MIN + 0.001} aria-label={t.zoomOut} data-tip={t.zoomOut} className={zoomBtn}>
          <Minus className="size-3.5" />
        </button>
        <Popover
          open={zoomOpen}
          onOpenChange={setZoomOpen}
          side="top"
          align="end"
          label={t.zoom}
          className="min-w-[150px]"
          trigger={({ ref }) => (
            <button
              ref={ref}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => setZoomOpen((v) => !v)}
              aria-label={`${t.zoom}: ${pct(zoom)}`}
              aria-haspopup="menu"
              aria-expanded={zoomOpen}
              data-tip={t.zoom}
              className="h-7 min-w-[52px] shrink-0 rounded-md px-1 text-[12px] font-medium tabular-nums text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-9"
            >
              {pct(zoom)}
            </button>
          )}
        >
          {(close) => (
            <div onMouseDown={keepFocus}>
              {Math.abs(zoom - 1) > 0.001 && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      store.setZoom(1);
                      close();
                    }}
                    className="flex h-8 w-full items-center rounded-lg px-2 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:h-10"
                  >
                    {t.zoomReset}
                  </button>
                  <div className="mx-1 my-1 h-px bg-line" />
                </>
              )}
              {ZOOMS.map((z) => (
                <button
                  key={z}
                  type="button"
                  role="menuitemradio"
                  aria-checked={Math.abs(z - zoom) < 0.001}
                  onClick={() => {
                    store.setZoom(z);
                    close();
                  }}
                  className={cn(
                    "flex h-8 w-full items-center justify-between rounded-lg px-2 text-[13px] tabular-nums transition-colors [@media(hover:none)]:h-10",
                    Math.abs(z - zoom) < 0.001 ? "bg-blob-soft text-blob-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
                  )}
                >
                  {pct(z)}
                </button>
              ))}
            </div>
          )}
        </Popover>
        <button type="button" onMouseDown={keepFocus} onClick={() => stepZoom(1)} disabled={zoom >= ZOOM_MAX - 0.001} aria-label={t.zoomIn} data-tip={t.zoomIn} className={zoomBtn}>
          <Plus className="size-3.5" />
        </button>
      </div>
      <HoverTips />
    </div>
  );
}

