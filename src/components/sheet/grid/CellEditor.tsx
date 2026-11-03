"use client";

// Typing into a cell. One textarea that stays mounted for the grid's whole life: invisible on the
// active cell while you move around (so the first key you type, accents and IME included, lands
// in it and starts editing), and shown over the cell while you edit, growing to the right and
// down with the text in the cell's own font. Formulas are coloured (references in the colours of
// their frames on the grid) and get help next to the cell: matching functions, the arguments of
// the one you are in, the result so far, or why the formula doesn't work.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/i18n/config";
import { posName } from "@/sheet/a1";
import { sheetColor } from "@/sheet/colors";
import { toCanonicalFormula, type FunctionName } from "@/sheet/engine";
import { getCell, sheetById } from "@/sheet/ops";
import { applySuggestion } from "../chrome/formulaInput";
import { openParens, useSheet, type SheetStore } from "../store";
import { fillSelectionWith } from "./actions";
import { BASE_FONT, CELL_PAD, shownText } from "./cellLook";
import { formulaArgument, formulaSuggestions, localName, ArgumentHint, SuggestionList } from "./FormulaHints";
import { cellRect, type Layout, type Scroll, type Viewport } from "./geometry";
import type { GridText } from "./GridCells";
import { keypadContext, keypadFor, setKeypadOpen, useKeypad } from "./keypad";
import { LINE_HEIGHT, textWidth, wrappedLines } from "./measure";
import { cycleReference, formulaTokens, moveSelection, pointByKey, pointing } from "./point";

type Props = {
  store: SheetStore;
  layout: Layout;
  scroll: Scroll;
  view: Viewport;
  sheetId: string;
  locale: Locale;
  t: GridText;
  gridId: string;
  textarea: RefObject<HTMLTextAreaElement | null>;
  scroller: RefObject<HTMLDivElement | null>;
  /** Keys while not editing go to the grid. */
  onGridKey: (e: KeyboardEvent<HTMLElement>) => void;
  focusGrid: () => void;
  /** Used by touch: after Enter the on-screen keyboard stays open for the next value; digits or letters (see keypad.ts). */
  touch: boolean;
  /** Set by a tap that starts editing a number: it comes up selected, so what is typed replaces it. */
  selectOnOpenRef: RefObject<boolean>;
};

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/** A box on screen (viewport coordinates). */
type Edges = { top: number; bottom: number; left: number; right: number };

/**
 * What the formula help may cover: the grid's cells (`cells`, without the column letters and row
 * numbers) as far as they can be seen (`screen`: the window above the on-screen keyboard), less a
 * small margin. Null while the cell editor (`editor`) is scrolled out of that part: the help then
 * hides instead of floating over the page around the grid.
 */
export function helpFrame(editor: Edges, cells: Edges, screen: Edges): Edges | null {
  const top = Math.max(cells.top, screen.top);
  const bottom = Math.min(cells.bottom, screen.bottom);
  const left = Math.max(cells.left, screen.left);
  const right = Math.min(cells.right, screen.right);
  if (editor.bottom <= top || editor.top >= bottom || editor.right <= left || editor.left >= right) return null;
  return {
    top: Math.max(cells.top + 4, screen.top + 8),
    bottom: Math.min(cells.bottom - 4, screen.bottom - 8),
    left: Math.max(cells.left + 4, screen.left + 8),
    right: Math.min(cells.right - 4, screen.right - 8),
  };
}

/**
 * Where the formula help goes for the cell editor `cell`, `w` × `h` big, inside `frame` (what can
 * be seen of the grid's cells, see helpFrame). Below the cell; else on its right, ending where the
 * cell ends; else above it (a formula is mostly typed under its data, which must stay in view to be
 * pointed at, so above comes last). When none has room, the roomier of below and above, scrolling
 * (`maxHeight`).
 */
export function placeHelp(cell: Edges, w: number, h: number, frame: Edges): { top: number; left: number; maxHeight: number | null } {
  const gap = 6;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const left = clamp(cell.left, frame.left, frame.right - w);
  const below = frame.bottom - (cell.bottom + gap);
  const above = cell.top - gap - frame.top;
  if (below >= h) return { top: cell.bottom + gap, left, maxHeight: null };
  const tall = frame.bottom - frame.top;
  if (cell.right + gap + w <= frame.right) return { top: clamp(cell.bottom - h, frame.top, frame.bottom - Math.min(h, tall)), left: cell.right + gap, maxHeight: h > tall ? tall : null };
  if (above >= h) return { top: cell.top - gap - h, left, maxHeight: null };
  if (below >= above) return { top: cell.bottom + gap, left, maxHeight: Math.max(0, below) };
  return { top: frame.top, left, maxHeight: Math.max(0, above) };
}

/** Today's date or the time as the user types it ("03.11.2026", "11/3/2026", "14:05"). */
export function nowText(kind: "date" | "time", locale: Locale): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  if (kind === "time") return `${two(d.getHours())}:${two(d.getMinutes())}`;
  return locale === "de" ? `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}` : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function CellEditor({ store, layout, scroll, view, sheetId, locale, t, gridId, textarea, scroller, onGridKey, focusGrid, touch, selectOnOpenRef }: Props) {
  const edit = useSheet(store, (s) => s.edit);
  const anchor = useSheet(store, (s) => s.selection.anchor);
  const workbook = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const box = useRef<HTMLDivElement>(null);
  const helpBox = useRef<HTMLDivElement>(null);
  /** The text and caret last read from the textarea, so changes made elsewhere (a reference pointed at, the formula bar) can be told apart. */
  const synced = useRef<{ text: string; caret: number } | null>(null);
  const [assist, setAssist] = useState<{ key: string; pick: number; closed: boolean }>({ key: "", pick: 0, closed: false });
  /** Counts Enter (or Tab, an arrow) finding the formula still broken: the message is announced again each time. */
  const [attempts, setAttempts] = useState(0);
  /** The help shows while this has the keyboard: a dialog (fx), the formula bar or another window taking it hides the help. */
  const [focused, setFocused] = useState(false);
  const keypad = useKeypad();

  const here = !!edit && edit.sheetId === sheetId;
  const pos = here ? { row: edit.row, col: edit.col } : anchor;
  const cell = getCell(workbook, here ? edit.sheetId : sheetId, pos.row, pos.col);
  const text = edit?.text ?? "";
  const zoom = layout.zoom;
  // On a touch screen: digits for a column of numbers, letters elsewhere (the formula bar switches).
  const shownSheet = sheetById(workbook, here ? edit.sheetId : sheetId);
  const inputMode = touch && shownSheet ? keypadFor(keypadContext(shownSheet, pos), keypad.choice) : undefined;

  // Where and how big: the cell, grown to the right (up to the visible edge) and down with the text.
  const rect = cellRect(layout, pos.row, pos.col);
  const frozenRow = pos.row < layout.freezeRows;
  const frozenCol = pos.col < layout.freezeCols;
  const size = (cell?.s?.size ?? BASE_FONT) * zoom;
  const bold = !!cell?.s?.bold;
  const italic = !!cell?.s?.italic;
  const pad = Math.round(CELL_PAD * zoom);
  const lineH = size * LINE_HEIGHT;
  const padY = Math.max(2, (rect.h - lineH) / 2);
  const viewX = layout.headerW + rect.x - (frozenCol ? 0 : scroll.left);
  const maxW = Math.max(rect.w, view.w - viewX - 12);
  const wrapCell = !!cell?.s?.wrap;
  const natural = Math.ceil(textWidth(text || " ", size, bold, italic)) + 2 * pad + 6;
  const wrap = here && (wrapCell || natural > maxW);
  const w = !here ? rect.w : wrapCell ? rect.w : Math.max(rect.w, Math.min(maxW, natural));
  const lines = !here ? 1 : wrap ? wrappedLines(text, w - 2 * pad - 4, size, bold, italic) : text.split("\n").length;
  const h = Math.max(rect.h, Math.ceil(lines * lineH + 2 * Math.min(padY, 6 * zoom)));
  const top = lines > 1 ? Math.min(padY, 6 * zoom) : padY;

  // Formulas: coloured tokens, function suggestions, the argument hint, the result so far.
  const isFormula = here && text.startsWith("=");
  const tokens = useMemo(() => (isFormula ? formulaTokens(text, locale) : null), [isFormula, text, locale]);
  const caret = edit?.caret ?? 0;
  const suggestions = here && edit.via === "cell" && !edit.error ? formulaSuggestions(text, caret, locale) : null;
  const assistKey = suggestions ? `${suggestions.start}:${text.slice(suggestions.start, suggestions.end)}` : "";
  const listOpen = !!suggestions && !(assist.key === assistKey && assist.closed);
  const pick = assist.key === assistKey ? Math.min(assist.pick, (suggestions?.items.length ?? 1) - 1) : 0;
  const argument = isFormula && !listOpen ? formulaArgument(text, caret, locale) : null;
  const fmt = cell?.s?.fmt;
  const preview = useMemo(() => {
    if (!isFormula || text.length < 2) return null;
    try {
      // While typing, parentheses are often still open: the preview closes them (like Excel's).
      let canonical = toCanonicalFormula(text.slice(1), locale);
      const open = openParens(text);
      if (!("formula" in canonical) && open > 0) canonical = toCanonicalFormula(text.slice(1) + ")".repeat(open), locale);
      if (!("formula" in canonical)) return null;
      const value = calc.evaluate(canonical.formula, { sheetId, row: pos.row, col: pos.col });
      const shown = shownText(value, fmt, locale);
      return shown.length > 60 ? `${shown.slice(0, 60)}…` : shown;
    } catch {
      return null;
    }
  }, [isFormula, text, locale, calc, sheetId, pos.row, pos.col, fmt]);

  // Keep the caret where the store says when the text changed elsewhere (a reference was inserted,
  // a suggestion taken, the formula bar typed); leave it alone while the user moves it. A number a
  // tap opened comes up selected instead (selectOnOpenRef): typing then replaces it.
  useLayoutEffect(() => {
    const el = textarea.current;
    const all = selectOnOpenRef.current;
    selectOnOpenRef.current = false;
    if (!el || !edit) {
      synced.current = null;
      return;
    }
    const last = synced.current;
    if (last && last.text === edit.text && last.caret === edit.caret) return;
    synced.current = { text: edit.text, caret: edit.caret };
    // Only while it has the keyboard (typing in the formula bar must not pull the focus here).
    if (el.value !== edit.text || document.activeElement !== el) return;
    if (all) el.setSelectionRange(0, edit.text.length);
    else if (el.selectionStart !== edit.caret || el.selectionEnd !== edit.caret) el.setSelectionRange(edit.caret, edit.caret);
  }, [edit, textarea, selectOnOpenRef]);

  // The formula bar shows "123" / "ABC" while this has the keyboard (see keypad.ts).
  useEffect(() => () => setKeypadOpen(false), []);

  // The help is a layer of its own on the screen, so the on-screen keyboard doesn't hide it and the
  // grid's edges don't cut it: placed next to the cell inside the grid's visible cells (see
  // helpFrame and placeHelp), again after every change and while the grid scrolls or the keyboard
  // opens. With the cell scrolled away it hides.
  useLayoutEffect(() => {
    const el = helpBox.current;
    const editor = box.current;
    const sc = scroller.current;
    if (!el || !editor || !sc) return;
    const vv = window.visualViewport;
    const place = () => {
      const r = sc.getBoundingClientRect();
      const x = r.left + sc.clientLeft;
      const y = r.top + sc.clientTop;
      const cells = { top: y + layout.headerH, bottom: y + sc.clientHeight, left: x + layout.headerW, right: x + sc.clientWidth };
      const screen = vv
        ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height, left: vv.offsetLeft, right: vv.offsetLeft + vv.width }
        : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
      const cell = editor.getBoundingClientRect();
      const frame = helpFrame(cell, cells, screen);
      el.style.visibility = frame ? "" : "hidden";
      if (!frame) return;
      const room = Math.max(0, frame.right - frame.left);
      el.style.maxWidth = `${Math.min(360, room)}px`;
      el.style.minWidth = `${Math.min(220, room)}px`;
      el.style.maxHeight = "";
      const at = placeHelp(cell, el.offsetWidth, el.offsetHeight, frame);
      el.style.left = `${at.left}px`;
      el.style.top = `${at.top}px`;
      if (at.maxHeight !== null) el.style.maxHeight = `${at.maxHeight}px`;
    };
    place();
    sc.addEventListener("scroll", place, { passive: true });
    vv?.addEventListener("resize", place);
    vv?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      sc.removeEventListener("scroll", place);
      vv?.removeEventListener("resize", place);
      vv?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  });

  // Editing in the cell has the keyboard; when it ends the grid gets it back. On a touch screen
  // the (empty) editor keeps it instead, so the on-screen keyboard stays open for the next value:
  // typing there starts editing the new active cell, a tap on the grid closes the keyboard.
  const editing = !!edit;
  const inCell = !!edit && edit.via === "cell";
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    if (inCell && document.activeElement !== el) el.focus({ preventScroll: true });
    else if (!editing && document.activeElement === el && !touch) focusGrid();
  }, [editing, inCell, textarea, focusGrid, touch]);

  // A frozen cell doesn't scroll: the editor (in the scrolling layer) follows the scroll to stay on it.
  useLayoutEffect(() => {
    const el = box.current;
    const sc = scroller.current;
    if (!el || !sc) return;
    if (!frozenRow && !frozenCol) {
      el.style.transform = "";
      return;
    }
    const follow = () => {
      el.style.transform = `translate(${frozenCol ? sc.scrollLeft : 0}px, ${frozenRow ? sc.scrollTop : 0}px)`;
    };
    follow();
    sc.addEventListener("scroll", follow, { passive: true });
    return () => sc.removeEventListener("scroll", follow);
  }, [frozenRow, frozenCol, scroller]);

  const take = (fn: FunctionName) => {
    const s = store.get();
    const e = s.edit;
    if (!e || !suggestions) return;
    try {
      const next = applySuggestion(e.text, suggestions, localName(fn, locale));
      synced.current = null;
      store.updateEdit(next.text, next.caret);
    } catch (err) {
      console.error("sheet: taking a suggestion failed", err);
    }
  };

  const insertText = (insert: string) => {
    const el = textarea.current;
    const e = store.get().edit;
    if (!el || !e) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = e.text.slice(0, start) + insert + e.text.slice(end);
    store.updateEdit(next, start + insert.length);
  };

  /** Finish the edit; a formula that doesn't work keeps it open with the reason (said again for screen readers). */
  const commit = (move: "down" | "up" | "right" | "left" | null) => {
    const ok = store.commitEdit(move);
    if (!ok && store.get().edit?.error) setAttempts((n) => n + 1);
    return ok;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const s = store.get();
    const ed = s.edit;
    if (!ed) {
      onGridKey(e);
      return;
    }
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const mod = (e.ctrlKey || e.metaKey) && !(e.ctrlKey && e.altKey && !e.metaKey);
    if (listOpen && suggestions && !mod && !e.altKey) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = suggestions.items.length;
        setAssist({ key: assistKey, pick: (pick + (e.key === "ArrowDown" ? 1 : n - 1)) % n, closed: false });
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey) {
        e.preventDefault();
        take(suggestions.items[pick]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setAssist({ key: assistKey, pick, closed: true });
        return;
      }
    }
    const arrow = ARROWS[e.key];
    if (arrow && !e.altKey) {
      // Typing (not F2): arrows point at cells in a formula, otherwise finish and move, like Excel.
      if (!ed.replace) return;
      e.preventDefault();
      if (pointing(store)) pointByKey(store, arrow[0], arrow[1], e.shiftKey, mod);
      else if (commit(null)) moveSelection(store, arrow[0], arrow[1], { extend: false, jump: mod });
      return;
    }
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (e.altKey) insertText("\n");
        else if (mod) {
          if (!fillSelectionWith(store, ed.text) && store.get().edit?.error) setAttempts((n) => n + 1);
        } else commit(e.shiftKey ? "up" : "down");
        return;
      case "Tab":
        e.preventDefault();
        commit(e.shiftKey ? "left" : "right");
        return;
      case "Escape":
        e.preventDefault();
        store.cancelEdit();
        return;
      case "F2":
        e.preventDefault();
        store.startEdit({ via: "cell", replace: !ed.replace });
        return;
      case "F4": {
        e.preventDefault();
        const next = cycleReference(ed.text, ed.caret, locale);
        if (next) store.updateEdit(next.text, next.caret);
        return;
      }
    }
    if (mod && (e.key === ";" || e.key === ".")) {
      e.preventDefault();
      insertText(nowText("date", locale));
    } else if (mod && e.key === ":") {
      e.preventDefault();
      insertText(nowText("time", locale));
    }
  };

  // Formula colouring: the textarea's own text is invisible, this copy underneath shows it in colour.
  const mirror: ReactNode[] = [];
  if (tokens) {
    let at = 0;
    tokens.tokens.forEach((tk, i) => {
      if (tk.start > at) mirror.push(text.slice(at, tk.start));
      const color = tk.kind === "ref" ? tokens.colors.get(tk) : undefined;
      const style = color ? { color: sheetColor(color) } : tk.kind === "string" ? { color: "var(--sheet-green)" } : tk.kind === "error" ? { color: "var(--sheet-red)" } : undefined;
      mirror.push(
        <span key={i} style={style}>
          {text.slice(Math.max(at, tk.start), tk.end)}
        </span>,
      );
      at = Math.max(at, tk.end);
    });
    if (at < text.length) mirror.push(text.slice(at));
  }

  const textStyle = {
    fontSize: size,
    lineHeight: LINE_HEIGHT,
    fontWeight: bold ? 700 : undefined,
    fontStyle: italic ? "italic" : undefined,
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: top,
    paddingBottom: 0,
    whiteSpace: wrap ? ("pre-wrap" as const) : ("pre" as const),
    overflowWrap: wrap ? ("anywhere" as const) : undefined,
  };

  const showHelp = here && edit.via === "cell" && focused;
  // Screen readers hear the reason when Enter finds the formula broken, and the hint with the field.
  const helpId = `${gridId}-fx-help`;
  const errorId = `${gridId}-fx-error`;
  const hint = !!argument || !!preview;
  const help: ReactNode =
    !showHelp ? null : edit.error ? (
      // A new element for each attempt: an alert is announced when it appears.
      <div key={attempts} id={errorId} role="alert" className="px-3 py-2">
        <div className="text-[12px] font-semibold text-danger">{t.formulaProblem}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{edit.error.message}</div>
      </div>
    ) : listOpen && suggestions ? (
      <SuggestionList id={`${gridId}-fx`} items={suggestions.items} pick={pick} locale={locale} label={t.functions} hint={t.pickHint} onPick={take} />
    ) : hint ? (
      <div id={helpId}>
        {argument && <ArgumentHint fn={argument.fn} index={argument.index} locale={locale} />}
        {preview !== null && (
          <div className={`flex items-baseline gap-1.5 px-2.5 py-1.5 text-[12px] ${argument ? "border-t border-line" : ""}`}>
            <span className="text-ink-3">{t.result}</span>
            <span className="truncate font-medium tabular-nums text-ink">{preview}</span>
          </div>
        )}
      </div>
    ) : null;

  return (
    <div
      ref={box}
      // Not editing here (or editing a formula while pointing at another sheet): invisible on the
      // active cell, still able to take the keyboard (visibility:hidden would lose the focus).
      className={here ? "absolute z-40" : "pointer-events-none absolute z-40 opacity-0"}
      style={{ left: layout.headerW + rect.x, top: layout.headerH + rect.y, width: w, height: h }}
    >
      <div
        className={here ? "absolute inset-0 rounded-[1px] bg-raised shadow-[0_0_0_2px_var(--blob),var(--shadow-pop)]" : "absolute inset-0"}
        style={{ fontFamily: "inherit" }}
      >
        {tokens && (
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-ink" style={textStyle}>
            {mirror}
          </div>
        )}
        <textarea
          ref={textarea}
          tabIndex={-1}
          value={text}
          rows={1}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          inputMode={inputMode}
          // On a touch screen Enter goes on to the next cell (the keyboard stays open).
          enterKeyHint={touch ? "next" : undefined}
          aria-label={t.editor(posName(pos))}
          aria-autocomplete={isFormula ? "list" : undefined}
          aria-controls={listOpen ? `${gridId}-fx` : undefined}
          aria-activedescendant={listOpen ? `${gridId}-fx-${pick}` : undefined}
          aria-invalid={edit?.error ? true : undefined}
          aria-describedby={showHelp ? (edit.error ? errorId : !listOpen && hint ? helpId : undefined) : undefined}
          aria-errormessage={showHelp && edit.error ? errorId : undefined}
          className={`absolute inset-0 block h-full w-full resize-none overflow-hidden border-0 bg-transparent text-ink caret-ink outline-none ${tokens ? "sheet-editor-text" : ""}`}
          style={textStyle}
          onChange={(e) => {
            const value = e.target.value;
            const at = e.target.selectionStart ?? value.length;
            synced.current = { text: value, caret: at };
            const s = store.get();
            if (!s.edit) {
              if (value) store.startEdit({ via: "cell", replace: true, text: value });
            } else store.updateEdit(value, at);
          }}
          onSelect={(e) => {
            const el = e.currentTarget;
            const s = store.get();
            if (!s.edit || el.selectionStart !== el.selectionEnd || el.value !== s.edit.text) return;
            if (el.selectionStart === s.edit.caret) return;
            synced.current = { text: el.value, caret: el.selectionStart };
            store.updateEdit(el.value, el.selectionStart);
          }}
          onFocus={() => {
            setFocused(true);
            setKeypadOpen(true);
            const s = store.get();
            if (s.edit && s.edit.via !== "cell" && s.edit.sheetId === s.sheetId) store.startEdit({ via: "cell", replace: false });
          }}
          onBlur={() => {
            setFocused(false);
            setKeypadOpen(false);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {help &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={helpBox}
            // Not the grid's: its pointer handlers leave this alone (React passes a portal's events
            // up to the grid too, hence also the stopPropagation). Only the list of functions takes
            // clicks; the hints let them through to the cells under them, so pointing always works.
            // Under dialogs, bottom sheets and menus (z 70 and up); its size and place come from
            // the effect above.
            data-grid-overlay=""
            className={`fixed left-[-9999px] top-[-9999px] z-[60] w-max overflow-y-auto overscroll-contain rounded-xl border border-line bg-raised text-left shadow-pop ${listOpen ? "" : "pointer-events-none"}`}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
          >
            {help}
          </div>,
          document.body,
        )}
    </div>
  );
}
