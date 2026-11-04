"use client";

// Find and replace in the spreadsheet: a small panel under the toolbar that leaves the sheet in
// view. Ctrl+F opens it for finding, Ctrl+H (⌘⌥F on a Mac) with the replace row. Matches are the
// cells whose shown text (or formula, with "In Formeln") contains what you type (* and ? work
// like in Excel); Enter and the arrows go from match to match (onto other sheets with "Alle
// Blätter"), selecting each. Replacing changes typed values, and formulas with "In Formeln"; each
// replace is one undo step.

import { ArrowDown, ArrowUp, CaseSensitive, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { useHydrated } from "@/lib/useHydrated";
import { cn } from "@/lib/utils";
import { findCells, getCell, replaceCells, setCells, type FindOptions } from "@/sheet/ops";
import { useSheet, type SheetStore } from "../store";
import { focusGrid } from "./parts";

type Match = { sheetId: string; row: number; col: number };
type Options = { matchCase: boolean; wholeCell: boolean; inFormulas: boolean; allSheets: boolean };

const NO_OPTIONS: Options = { matchCase: false, wholeCell: false, inFormulas: false, allSheets: false };

/** The match after (or before) a position, in sheet order, then row by row; wraps around. */
export function nextMatch(matches: Match[], sheetOrder: string[], from: Match, dir: 1 | -1): Match | null {
  if (!matches.length) return null;
  const key = (m: Match) => [sheetOrder.indexOf(m.sheetId), m.row, m.col];
  const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const here = key(from);
  if (dir > 0) return matches.find((m) => cmp(key(m), here) > 0) ?? matches[0];
  for (let i = matches.length - 1; i >= 0; i--) if (cmp(key(matches[i]), here) < 0) return matches[i];
  return matches[matches.length - 1];
}

function Toggle({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors [@media(hover:none)]:h-9",
        on ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:border-line-2 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
      {label}
    </button>
  );
}

const iconBtn =
  "grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 [@media(hover:none)]:size-9 [&_svg]:size-4";

export function FindReplace({
  store,
  open,
  focusNonce,
  withReplace = false,
  onClose,
  anchor,
}: {
  store: SheetStore;
  open: boolean;
  /** Changes when Ctrl+F is pressed again: the search field takes the keyboard again. */
  focusNonce: number;
  /** Whether the replace row shows when it is opened (Ctrl+H) or not (Ctrl+F); the user can still fold it either way. */
  withReplace?: boolean;
  onClose: () => void;
  /** The toolbar: the panel opens under its right end. */
  anchor: RefObject<HTMLElement | null>;
}) {
  const t = useMessages(sheetChromeText);
  const mac = useIsMac();
  const workbook = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const sheetId = useSheet(store, (s) => s.sheetId);
  const anchorCell = useSheet(store, (s) => s.selection.anchor);
  const locale = useSheet(store, (s) => s.locale);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [replaceRow, setReplaceRow] = useState(withReplace);
  // Each Ctrl+F / Ctrl+H (a new focusNonce) shows the panel the way it was asked for.
  const [askedAt, setAskedAt] = useState(focusNonce);
  if (askedAt !== focusNonce) {
    setAskedAt(focusNonce);
    setReplaceRow(withReplace);
  }
  const [opts, setOpts] = useState<Options>(NO_OPTIONS);
  const [notice, setNotice] = useState<{ text: string; query: string } | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const findOpts: FindOptions = useMemo(
    () => ({ sheetId: opts.allSheets ? undefined : sheetId, matchCase: opts.matchCase, wholeCell: opts.wholeCell, inFormulas: opts.inFormulas }),
    [opts, sheetId],
  );
  const matches = useMemo(() => {
    if (!open || !query) return [] as Match[];
    try {
      return findCells(workbook, calc, query, findOpts, locale);
    } catch (err) {
      console.error("sheet: find failed", err);
      return [] as Match[];
    }
  }, [open, query, workbook, calc, findOpts, locale]);
  const currentIndex = matches.findIndex((m) => m.sheetId === sheetId && m.row === anchorCell.row && m.col === anchorCell.col);

  // Under the toolbar's right end (the whole width on a phone), following the window's size.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      const vw = window.innerWidth;
      const width = Math.min(440, vw - 16);
      setPos({ top: (r?.bottom ?? 56) + 8, right: r ? Math.max(8, Math.min(vw - r.right, vw - width - 8)) : 8, width });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    input.current?.select();
  }, [open, focusNonce]);

  const sheetOrder = () => store.get().workbook.sheets.map((s) => s.id);

  const select = (m: Match) => {
    if (store.get().sheetId !== m.sheetId) store.setSheet(m.sheetId);
    store.select({ row: m.row, col: m.col });
  };

  const go = (dir: 1 | -1) => {
    const s = store.get();
    const target = nextMatch(matches, sheetOrder(), { sheetId: s.sheetId, ...s.selection.anchor }, dir);
    if (target) select(target);
  };

  const close = () => {
    onClose();
    focusGrid();
  };

  const replaceOne = () => {
    const s = store.get();
    if (s.readOnly || !query) return;
    const at = s.selection.anchor;
    const here = matches.some((m) => m.sheetId === s.sheetId && m.row === at.row && m.col === at.col);
    // Like Excel: the first press finds a match, the next one replaces it and moves on.
    if (!here) {
      go(1);
      return;
    }
    const sid = s.sheetId;
    const before = s.workbook;
    store.apply(t.steps.replace, (wb, c) => {
      const replaced = replaceCells(wb, c, query, replacement, { ...findOpts, sheetId: sid }, s.locale).wb;
      const next = getCell(replaced, sid, at.row, at.col);
      if (next === getCell(wb, sid, at.row, at.col)) return wb;
      return setCells(wb, sid, [{ row: at.row, col: at.col, cell: next ?? null }]);
    });
    const after = store.get();
    if (after.workbook === before) {
      // Shown text that can't be replaced (a formula's result): just go on.
      go(1);
      return;
    }
    const fresh = findCells(after.workbook, after.calc, query, findOpts, after.locale);
    const target = nextMatch(fresh, sheetOrder(), { sheetId: sid, ...at }, 1);
    if (target) select(target);
  };

  const replaceAll = () => {
    const s = store.get();
    if (s.readOnly || !query) return;
    const result = replaceCells(s.workbook, s.calc, query, replacement, findOpts, s.locale);
    if (result.count) store.apply(t.steps.replaceAll, (wb, c) => (wb === s.workbook ? result.wb : replaceCells(wb, c, query, replacement, findOpts, s.locale).wb));
    setNotice({ text: t.replaced(result.count), query });
  };

  /** Ctrl+F and Ctrl+H (⌘⌥F) in the panel switch between finding and replacing, instead of the browser's own find bar or history. */
  const switchKeys = (e: KeyboardEvent<HTMLInputElement>): boolean => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return false;
    const k = e.key.toLowerCase();
    if ((k === "h" && !e.altKey) || (e.metaKey && e.altKey && e.code === "KeyF")) {
      e.preventDefault();
      if (!readOnly) setReplaceRow(true);
      return true;
    }
    if (k === "f" && !e.altKey) {
      e.preventDefault();
      setReplaceRow(false);
      input.current?.focus();
      input.current?.select();
      return true;
    }
    return false;
  };

  const onFindKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || switchKeys(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && (e.altKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      go(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Tab" && !e.shiftKey && replaceRow && !readOnly) {
      // From "find" straight to "replace with", like Excel's dialog.
      e.preventDefault();
      replaceInput.current?.focus();
    }
  };
  const onReplaceKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || switchKeys(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) replaceAll();
      else replaceOne();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      input.current?.focus();
    }
  };

  const toggle = (k: keyof Options) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const status = notice && notice.query === query ? notice.text : !query ? "" : !matches.length ? t.noMatches : currentIndex >= 0 ? t.matchOf(currentIndex + 1, matches.length) : t.matches(matches.length);
  const replaceAllKeys = mac ? "⌘|↵" : `${t.keys.mod}|${t.keys.enter}`;
  const hydrated = useHydrated();

  if (!hydrated) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ type: "spring", stiffness: 560, damping: 36 }}
          style={{ top: pos?.top ?? -9999, right: pos?.right ?? 8, width: pos?.width ?? 420, transformOrigin: "top right" }}
          className="fixed z-[75] rounded-xl border border-line bg-raised p-1.5 text-ink-2 shadow-pop"
          role="search"
          aria-label={t.findLabel}
        >
          <div className="flex items-center gap-1">
            {!readOnly ? (
              <button type="button" onClick={() => setReplaceRow((r) => !r)} className={iconBtn} aria-expanded={replaceRow} aria-label={replaceRow ? t.hideReplace : t.showReplace} data-tip={replaceRow ? t.hideReplace : t.showReplace}>
                <ChevronRight className={cn("transition-transform duration-200", replaceRow && "rotate-90")} />
              </button>
            ) : (
              <span className="w-1" />
            )}
            <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-surface pl-2.5 pr-2 focus-within:border-blob [@media(hover:none)]:h-9">
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onFindKey}
                placeholder={opts.allSheets ? t.findAllPlaceholder : t.findPlaceholder}
                aria-label={t.findField}
                spellCheck={false}
                autoComplete="off"
                enterKeyHint="search"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] [@media(hover:none)]:text-[16px]"
              />
              <span role="status" aria-live="polite" className="shrink-0 text-[12px] tabular-nums text-ink-2">
                {status}
              </span>
            </label>
            <button type="button" onClick={() => go(-1)} disabled={!matches.length} className={iconBtn} aria-label={t.previous} data-tip={t.previous} data-keys={`${t.keys.shift}|${t.keys.enter}`}>
              <ArrowUp />
            </button>
            <button type="button" onClick={() => go(1)} disabled={!matches.length} className={iconBtn} aria-label={t.next} data-tip={t.next} data-keys={t.keys.enter}>
              <ArrowDown />
            </button>
            <button type="button" onClick={close} className={iconBtn} aria-label={t.close} data-tip={t.close} data-keys={t.keys.esc}>
              <X />
            </button>
          </div>
          {replaceRow && !readOnly && (
            <div className="mt-1 flex items-center gap-1 pl-9 [@media(hover:none)]:pl-10">
              <input
                ref={replaceInput}
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                onKeyDown={onReplaceKey}
                placeholder={t.replacePlaceholder}
                aria-label={t.replaceField}
                spellCheck={false}
                autoComplete="off"
                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink outline-none placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] focus:border-blob [@media(hover:none)]:h-9 [@media(hover:none)]:text-[16px]"
              />
              <button
                type="button"
                onClick={replaceOne}
                disabled={!matches.length}
                className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35 [@media(hover:none)]:h-9"
                data-tip={t.replace}
                data-keys={t.keys.enter}
              >
                {t.replace}
              </button>
              <button
                type="button"
                onClick={replaceAll}
                disabled={!matches.length}
                className="h-8 shrink-0 rounded-lg bg-hover px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:bg-line disabled:opacity-35 [@media(hover:none)]:h-9"
                data-tip={t.replaceAll}
                data-keys={replaceAllKeys}
              >
                {t.replaceAll}
              </button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5 pb-0.5">
            <Toggle label={t.matchCase} on={opts.matchCase} onClick={() => toggle("matchCase")}>
              <CaseSensitive className="size-3.5" />
            </Toggle>
            <Toggle label={t.wholeCell} on={opts.wholeCell} onClick={() => toggle("wholeCell")}>
              {null}
            </Toggle>
            <Toggle label={t.inFormulas} on={opts.inFormulas} onClick={() => toggle("inFormulas")}>
              <span className="font-mono text-[11px] font-semibold">=</span>
            </Toggle>
            <Toggle label={t.searchAllSheets} on={opts.allSheets} onClick={() => toggle("allSheets")}>
              {null}
            </Toggle>
          </div>
          <div className="px-1 pb-0.5 pt-1 text-[12px] text-ink-2">{t.wildcards}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
