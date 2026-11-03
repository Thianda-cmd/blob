// The grid's keyboard when no cell is being edited, like Excel (⌘ instead of Ctrl on a Mac):
// moving and selecting, starting to type, clipboard, undo, formatting, filling, inserting and
// deleting, and the shortcuts that open the editor's panels.

import type { KeyboardEvent } from "react";
import { sheetById } from "@/sheet/ops";
import type { Pos } from "@/sheet/types";
import { insertChart } from "../chart/actions";
import { autoSum, toggleStyle } from "../chrome/actions";
import { openSheetPanel } from "../events";
import { activeArea, type SheetStore } from "../store";
import { makeTableFromSelection } from "../table/actions";
import { clearSelection, deleteAtSelection, fillFrom, insertAtSelection, selectRegionOrAll, wholeness } from "./actions";
import { nowText } from "./CellEditor";
import { endCut } from "./clipboard";
import { pageRows, type Layout, type Viewport } from "./geometry";
import { lastInRow, usedArea } from "./navigation";
import { moveSelection } from "./point";

export type GridKeyContext = {
  store: SheetStore;
  layout: Layout;
  view: Viewport;
  /** Move the keyboard into the cell editor so the key being pressed lands there (typing starts editing). */
  typeInto: () => void;
  /** Get the hidden clipboard field ready, so the browser copies from it or pastes into it. `plain`: paste values only (Ctrl+Shift+V). */
  prepareClipboard: (kind: "copy" | "cut" | "paste", plain: boolean) => void;
  /** The context menu at the active cell (context-menu key, Shift+F10). */
  openMenu: () => void;
  /** Ctrl++ / Ctrl+- when neither whole rows nor whole columns are selected: ask which. */
  openChooser: (kind: "insert" | "delete") => void;
  /** Alt+↓ on a smart table's header cell: its sort and filter menu. */
  openDecor: () => void;
  /** Scroll the active cell into view. */
  reveal: () => void;
};

const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

/** Handle a key on the grid. Keys it doesn't use are left alone (they may reach the page). */
export function handleGridKey(e: KeyboardEvent<HTMLElement>, ctx: GridKeyContext): void {
  const { store } = ctx;
  const s = store.get();
  const sheet = sheetById(s.workbook, s.sheetId);
  if (!sheet) return;
  const key = e.key;
  // AltGr (Ctrl+Alt on Windows) types characters like @ and €: that's typing, not a shortcut.
  const altGr = e.ctrlKey && e.altKey && !e.metaKey && !isMac();
  const mod = (e.ctrlKey || e.metaKey) && !altGr;
  const done = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  const sel = s.selection;
  const extendTo = (p: Pos) => store.select({ anchor: sel.anchor, focus: p, extra: sel.extra });
  const goTo = (p: Pos) => (e.shiftKey ? extendTo(p) : store.select(p));

  // Alt+= : AutoSum (on a German keyboard "=" is Shift+0).
  if (e.altKey && !mod && (key === "=" || e.code === "Equal" || (e.code === "Digit0" && e.shiftKey))) {
    done();
    if (!s.readOnly) autoSum(store);
    return;
  }
  // Shift+Space: whole rows; Ctrl+Space: whole columns.
  if (key === " " && (e.shiftKey || mod) && !(e.shiftKey && mod)) {
    done();
    const a = activeArea(sel);
    if (e.shiftKey) store.select({ anchor: { row: a.r0, col: 0 }, focus: { row: a.r1, col: sheet.size.cols - 1 }, extra: [] });
    else store.select({ anchor: { row: 0, col: a.c0 }, focus: { row: sheet.size.rows - 1, col: a.c1 }, extra: [] });
    return;
  }
  // Typing a character starts editing (replacing the cell): the key itself lands in the editor.
  const printable = key.length === 1 || key === "Dead" || key === "Process" || e.keyCode === 229;
  if (printable && !mod && (!e.altKey || altGr || isMac())) {
    if (!s.readOnly) ctx.typeInto();
    return;
  }

  const arrow = ARROWS[key];
  if (arrow) {
    if (e.altKey) {
      if (key === "ArrowDown" && !mod) {
        done();
        ctx.openDecor();
      }
      return;
    }
    done();
    moveSelection(store, arrow[0], arrow[1], { extend: e.shiftKey, jump: mod });
    return;
  }

  const from = e.shiftKey ? sel.focus : sel.anchor;
  switch (key) {
    case "Home":
      done();
      if (mod) goTo({ row: firstVisible(sheet.size.rows, (r) => store.isRowHidden(s.sheetId, r)), col: firstVisible(sheet.size.cols, (c) => !!sheet.cols[c]?.hidden) });
      else goTo({ row: from.row, col: firstVisible(sheet.size.cols, (c) => !!sheet.cols[c]?.hidden) });
      return;
    case "End": {
      done();
      if (mod) {
        const used = usedArea(sheet);
        goTo(used ? { row: used.r1, col: used.c1 } : { row: 0, col: 0 });
      } else {
        const last = lastInRow(sheet, from.row);
        goTo({ row: from.row, col: last >= 0 ? last : from.col });
      }
      return;
    }
    case "PageDown":
    case "PageUp": {
      done();
      const d = key === "PageDown" ? 1 : -1;
      if (e.altKey) {
        const cols = Math.max(1, Math.floor((ctx.view.w - ctx.layout.headerW - ctx.layout.frozenW) / Math.max(1, Math.round(100 * ctx.layout.zoom))));
        goTo({ row: from.row, col: Math.max(0, Math.min(sheet.size.cols - 1, from.col + d * cols)) });
      } else {
        let row = Math.max(0, Math.min(sheet.size.rows - 1, from.row + d * pageRows(ctx.layout, ctx.view)));
        while (row > 0 && row < sheet.size.rows - 1 && store.isRowHidden(s.sheetId, row)) row += d;
        goTo({ row, col: from.col });
      }
      return;
    }
    case "Tab": {
      // A single cell at the first (or last) column has nowhere to go: then Tab leaves the grid,
      // so keyboard users can always reach the rest of the page.
      const single = sel.extra.length === 0 && sel.anchor.row === sel.focus.row && sel.anchor.col === sel.focus.col;
      const hiddenCol = (c: number) => !!sheet.cols[c]?.hidden;
      const edge = e.shiftKey ? firstVisible(sheet.size.cols, hiddenCol) : lastVisible(sheet.size.cols, hiddenCol);
      if (single && sel.anchor.col === edge) return;
      done();
      store.commitEdit(e.shiftKey ? "left" : "right");
      return;
    }
    case "Enter":
      done();
      store.commitEdit(e.shiftKey ? "up" : "down");
      return;
    case "F2":
      done();
      store.startEdit({ via: "cell", replace: false });
      return;
    case "Delete":
    case "Backspace":
      done();
      if (!s.readOnly) clearSelection(store);
      return;
    case "Escape":
      if (s.clip) {
        done();
        store.setClip(null);
        endCut();
      }
      return;
    case "F3":
      if (e.shiftKey) {
        done();
        openSheetPanel("functions");
      }
      return;
    case "F11":
      done();
      if (!s.readOnly) insertChart(store);
      return;
    case "F1":
      if (e.altKey) {
        done();
        if (!s.readOnly) insertChart(store);
      }
      return;
    case "F10":
      if (e.shiftKey) {
        done();
        ctx.openMenu();
      }
      return;
    case "ContextMenu":
      done();
      ctx.openMenu();
      return;
  }

  if (!mod) return;
  // ⌘⌥F on a Mac (⌘H hides the app there): find and replace. By the key's place, since ⌥ changes the character.
  if (e.altKey && e.code === "KeyF") {
    done();
    openSheetPanel("replace");
    return;
  }
  const k = key.toLowerCase();
  switch (k) {
    case "c":
    case "x":
    case "v":
      // The browser copies or pastes (with the system clipboard); the hidden field and the
      // copy/cut/paste handlers do the rest. Shift+V: paste values only, through the same field.
      ctx.prepareClipboard(k === "c" ? "copy" : k === "x" ? "cut" : "paste", e.shiftKey);
      return;
    case "z":
      done();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    case "y":
      done();
      store.redo();
      return;
    case "b":
    case "i":
    case "u":
      done();
      if (!s.readOnly) toggleStyle(store, k === "b" ? "bold" : k === "i" ? "italic" : "underline");
      return;
    case "5":
      done();
      if (!s.readOnly) toggleStyle(store, "strike");
      return;
    case "a":
      done();
      selectRegionOrAll(store);
      return;
    case "d":
    case "r":
      done();
      if (!s.readOnly) fillFrom(store, k === "d" ? "down" : "right");
      return;
    case ";":
    case ".":
    case ":": {
      done();
      if (!s.readOnly) store.startEdit({ via: "cell", replace: true, text: nowText(k === ":" ? "time" : "date", s.locale) });
      return;
    }
    case "+":
    case "-": {
      done();
      if (s.readOnly) return;
      const whole = wholeness(activeArea(sel), sheet);
      const kind = whole.rows && !whole.cols ? "rows" : whole.cols && !whole.rows ? "cols" : null;
      if (!kind) ctx.openChooser(k === "+" ? "insert" : "delete");
      else if (k === "+") insertAtSelection(store, kind);
      else deleteAtSelection(store, kind);
      return;
    }
    case "f":
      done();
      openSheetPanel("find");
      return;
    case "h":
      // Ctrl+H: find with the replace row open, like Excel's "Ersetzen".
      done();
      openSheetPanel("replace");
      return;
    case "1":
      done();
      openSheetPanel("format");
      return;
    case "t":
    case "l":
      done();
      if (!s.readOnly) makeTableFromSelection(store);
      return;
    case "backspace":
      done();
      ctx.reveal();
      return;
  }
}

function firstVisible(count: number, hidden: (i: number) => boolean): number {
  for (let i = 0; i < count; i++) if (!hidden(i)) return i;
  return 0;
}

function lastVisible(count: number, hidden: (i: number) => boolean): number {
  for (let i = count - 1; i >= 0; i--) if (!hidden(i)) return i;
  return count - 1;
}
