"use client";

// Typing into a cell. One textarea that stays mounted for the grid's whole life: invisible on the
// active cell while you move around (so the first key you type, accents and IME included, lands
// in it and starts editing), and shown over the cell while you edit, growing to the right and
// down with the text in the cell's own font. Formulas are coloured (references in the colours of
// their frames on the grid) and get help underneath: matching functions, the arguments of the
// one you are in, the result so far, or why the formula doesn't work.

import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { Locale } from "@/i18n/config";
import { posName } from "@/sheet/a1";
import { sheetColor } from "@/sheet/colors";
import { toCanonicalFormula, type FunctionName } from "@/sheet/engine";
import { getCell } from "@/sheet/ops";
import { applySuggestion } from "../chrome/formulaInput";
import { openParens, useSheet, type SheetStore } from "../store";
import { fillSelectionWith } from "./actions";
import { BASE_FONT, CELL_PAD, shownText } from "./cellLook";
import { formulaArgument, formulaSuggestions, localName, ArgumentHint, SuggestionList } from "./FormulaHints";
import { cellRect, type Layout, type Scroll, type Viewport } from "./geometry";
import type { GridText } from "./GridCells";
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
  /** Used by touch: after Enter the on-screen keyboard stays open for the next value. */
  touch: boolean;
};

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

/** Today's date or the time as the user types it ("03.11.2026", "11/3/2026", "14:05"). */
export function nowText(kind: "date" | "time", locale: Locale): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  if (kind === "time") return `${two(d.getHours())}:${two(d.getMinutes())}`;
  return locale === "de" ? `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()}` : `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export function CellEditor({ store, layout, scroll, view, sheetId, locale, t, gridId, textarea, scroller, onGridKey, focusGrid, touch }: Props) {
  const edit = useSheet(store, (s) => s.edit);
  const anchor = useSheet(store, (s) => s.selection.anchor);
  const workbook = useSheet(store, (s) => s.workbook);
  const calc = useSheet(store, (s) => s.calc);
  const box = useRef<HTMLDivElement>(null);
  /** The text and caret last read from the textarea, so changes made elsewhere (a reference pointed at, the formula bar) can be told apart. */
  const synced = useRef<{ text: string; caret: number } | null>(null);
  const [assist, setAssist] = useState<{ key: string; pick: number; closed: boolean }>({ key: "", pick: 0, closed: false });

  const here = !!edit && edit.sheetId === sheetId;
  const pos = here ? { row: edit.row, col: edit.col } : anchor;
  const cell = getCell(workbook, here ? edit.sheetId : sheetId, pos.row, pos.col);
  const text = edit?.text ?? "";
  const zoom = layout.zoom;

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

  // The help below the editor (above it near the bottom of the screen, right-aligned near the right edge).
  const viewY = layout.headerH + rect.y - (frozenRow ? 0 : scroll.top);
  const above = viewY + h + 260 > view.h && viewY > 220;
  const toLeft = viewX + 360 > view.w && viewX + w > 360;

  // Keep the caret where the store says when the text changed elsewhere (a reference was inserted,
  // a suggestion taken, the formula bar typed); leave it alone while the user moves it.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el || !edit) {
      synced.current = null;
      return;
    }
    const last = synced.current;
    if (last && last.text === edit.text && last.caret === edit.caret) return;
    synced.current = { text: edit.text, caret: edit.caret };
    // Only while it has the keyboard (typing in the formula bar must not pull the focus here).
    if (el.value !== edit.text || document.activeElement !== el) return;
    if (el.selectionStart !== edit.caret || el.selectionEnd !== edit.caret) el.setSelectionRange(edit.caret, edit.caret);
  }, [edit, textarea]);

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
      else if (store.commitEdit(null)) moveSelection(store, arrow[0], arrow[1], { extend: false, jump: mod });
      return;
    }
    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (e.altKey) insertText("\n");
        else if (mod) fillSelectionWith(store, ed.text);
        else store.commitEdit(e.shiftKey ? "up" : "down");
        return;
      case "Tab":
        e.preventDefault();
        store.commitEdit(e.shiftKey ? "left" : "right");
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

  const showHelp = here && edit.via === "cell";
  const help: ReactNode =
    !showHelp ? null : edit.error ? (
      <div className="px-3 py-2">
        <div className="text-[12px] font-semibold text-danger">{t.formulaProblem}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{edit.error.message}</div>
      </div>
    ) : listOpen && suggestions ? (
      <SuggestionList id={`${gridId}-fx`} items={suggestions.items} pick={pick} locale={locale} label={t.functions} hint={t.pickHint} onPick={take} />
    ) : argument || preview ? (
      <div>
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
          aria-label={t.editor(posName(pos))}
          aria-autocomplete={isFormula ? "list" : undefined}
          aria-controls={listOpen ? `${gridId}-fx` : undefined}
          aria-activedescendant={listOpen ? `${gridId}-fx-${pick}` : undefined}
          aria-invalid={edit?.error ? true : undefined}
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
            const s = store.get();
            if (s.edit && s.edit.via !== "cell" && s.edit.sheetId === s.sheetId) store.startEdit({ via: "cell", replace: false });
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {help && (
        <div
          className="absolute left-0 z-50 w-max min-w-[220px] max-w-[min(360px,80vw)] overflow-hidden rounded-xl border border-line bg-raised text-left shadow-pop"
          style={{ ...(above ? { bottom: h + 6 } : { top: h + 6 }), ...(toLeft ? { right: 0, left: "auto" } : null) }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {help}
        </div>
      )}
    </div>
  );
}
