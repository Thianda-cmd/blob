"use client";

// The grid's menus: the context menu of cells, rows and columns (right-click, long-press, the
// context-menu key), the small "insert what?" menu of Ctrl++ and Ctrl+-, and the note editor.

import {
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  ArrowUpZA,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ClipboardPaste,
  ClipboardType,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  MessageSquareText,
  MessageSquareX,
  MoveHorizontal,
  MoveVertical,
  RemoveFormatting,
  Scissors,
  Snowflake,
  SquareArrowDownRight,
  Trash2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { ContextMenu, useClosesOutside, visibleArea, type MenuPoint } from "@/components/ui/ContextMenu";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { posName } from "@/sheet/a1";
import { sheetById } from "@/sheet/ops";
import type { Pos } from "@/sheet/types";
import { sortSelection } from "../chrome/actions";
import { activeArea, selectionAreas, type SheetStore } from "../store";
import { clearSelection, deleteAtSelection, fillFrom, fitColumns, fitRows, freeze, hiddenNear, hideSelection, insertAtSelection, selectedIndexes, setNote, unhideNear, wholeness } from "./actions";
import { copySelection, hasOwnCopy, pasteData, readSystemClipboard, writeSystemClipboard, type PasteMode } from "./clipboard";
import type { GridText } from "./GridCells";

export type MenuKind = "cells" | "rows" | "cols";

/**
 * Fingers get taller menu entries (40 px) than the shared menu's 32 px, without changing the shared
 * menu item. Also for the spreadsheet's other menus (the sheet tabs').
 */
export const TOUCH_ITEMS = "[@media(hover:none)]:[&_[role=menuitem]]:h-10";

/** A menu opened by a finger shows no keyboard shortcuts (they can't be pressed on a phone). */
const NO_SHORTCUTS = "[&_[data-shortcut]]:hidden";

type Keys = { mod: string; shift: string };

/**
 * What a menu's paste says when it pasted nothing: that there is nothing (the clipboard could be
 * `read`, or there is Blob's `own` copy), else how to paste: with the keyboard, or (`touch`, a
 * menu opened by a finger, which has no keyboard shortcut) by letting the browser read the clipboard.
 */
export function pasteNotice(read: boolean, own: boolean, touch: boolean, t: GridText): string {
  return read || own ? t.pasteNothing : touch ? t.pasteHintTouch : t.pasteHint;
}

/** Paste from a menu: the system clipboard when the browser lets us read it, else Blob's own copy, else a hint (see pasteNotice). */
export async function pasteFromMenu(store: SheetStore, mode: PasteMode, notify: (text: string) => void, t: GridText, touch = false) {
  const data = await readSystemClipboard();
  if (pasteData(store, data, mode)) return;
  notify(pasteNotice(!!data, hasOwnCopy(store.get().pageId), touch, t));
}

/** Copy or cut from a menu (no keyboard event: the async clipboard). */
export function copyFromMenu(store: SheetStore, cut: boolean) {
  const p = copySelection(store, cut);
  void writeSystemClipboard(p.text, p.html);
}

export function GridMenu({
  store,
  at,
  kind,
  onClose,
  extra,
  onNote,
  onFill,
  notify,
  t,
  keys,
  finger = false,
}: {
  store: SheetStore;
  at: MenuPoint | null;
  kind: MenuKind;
  onClose: () => void;
  extra?: (close: () => void) => ReactNode;
  onNote: (at: Pos) => void;
  /** Touch screens: fill by dragging (the bottom-right handle becomes the fill handle). */
  onFill?: () => void;
  notify: (text: string) => void;
  t: GridText;
  keys: Keys;
  /** Opened by a finger: no keyboard shortcuts beside the items, and paste hints for touch screens. */
  finger?: boolean;
}) {
  const s = store.get();
  const readOnly = s.readOnly;
  const sheet = sheetById(s.workbook, s.sheetId);
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  let body: ReactNode = null;
  if (at && sheet) {
    const a = activeArea(s.selection);
    const nRows = a.r1 - a.r0 + 1;
    const nCols = a.c1 - a.c0 + 1;
    const anchor = s.selection.anchor;
    const note = sheet.cells[`${anchor.row},${anchor.col}`]?.note;
    const frozen = sheet.freeze.rows > 0 || sheet.freeze.cols > 0;
    // A selection that spans whole columns (or rows) never offers to insert, delete or hide every
    // row (or column) of the sheet from the cells' menu.
    const whole = selectionAreas(s.selection).map((x) => wholeness(x, sheet));
    const rowItems = kind === "rows" || (kind === "cells" && !whole.some((w) => w.cols));
    const colItems = kind === "cols" || (kind === "cells" && !whole.some((w) => w.rows));
    const hiddenRows = kind !== "cols" ? hiddenNear(store, "rows") : [];
    const hiddenCols = kind !== "rows" ? hiddenNear(store, "cols") : [];
    const extraItems = !readOnly && extra ? extra(onClose) : null;
    body = (
      <>
        {extraItems && (
          <>
            {extraItems}
            <MenuSeparator />
          </>
        )}
        {!readOnly && <MenuItem icon={<Scissors />} shortcut={`${keys.mod}X`} onSelect={run(() => copyFromMenu(store, true))}>{t.cut}</MenuItem>}
        <MenuItem icon={<Copy />} shortcut={`${keys.mod}C`} onSelect={run(() => copyFromMenu(store, false))}>
          {t.copy}
        </MenuItem>
        {!readOnly && (
          <>
            <MenuItem icon={<ClipboardPaste />} shortcut={`${keys.mod}V`} onSelect={run(() => void pasteFromMenu(store, "all", notify, t, finger))}>
              {t.paste}
            </MenuItem>
            <MenuItem icon={<ClipboardType />} shortcut={`${keys.mod}${keys.shift}V`} onSelect={run(() => void pasteFromMenu(store, "values", notify, t, finger))}>
              {t.pasteValues}
            </MenuItem>
            <MenuItem icon={<ArrowRightLeft />} onSelect={run(() => void pasteFromMenu(store, "transpose", notify, t, finger))}>
              {t.pasteTransposed}
            </MenuItem>
            {/* A finger has no fill handle: this turns the bottom-right handle into one (near the top, so it is found). */}
            {onFill && kind === "cells" && (
              <MenuItem icon={<SquareArrowDownRight />} onSelect={run(onFill)}>
                {t.fillTouch}
              </MenuItem>
            )}
            <MenuSeparator />
            {rowItems && (
              <>
                <MenuItem icon={<BetweenHorizontalStart />} onSelect={run(() => insertAtSelection(store, "rows"))}>
                  {t.insertRowsAbove(nRows)}
                </MenuItem>
                {kind === "rows" && (
                  <MenuItem icon={<BetweenHorizontalEnd />} onSelect={run(() => insertAtSelection(store, "rows", true))}>
                    {t.insertRowsBelow(nRows)}
                  </MenuItem>
                )}
                <MenuItem icon={<Trash2 />} onSelect={run(() => deleteAtSelection(store, "rows"))}>
                  {t.deleteRows(selectedIndexes(store, "rows").length)}
                </MenuItem>
              </>
            )}
            {colItems && (
              <>
                <MenuItem icon={<BetweenVerticalStart />} onSelect={run(() => insertAtSelection(store, "cols"))}>
                  {t.insertColsLeft(nCols)}
                </MenuItem>
                {kind === "cols" && (
                  <MenuItem icon={<BetweenVerticalEnd />} onSelect={run(() => insertAtSelection(store, "cols", true))}>
                    {t.insertColsRight(nCols)}
                  </MenuItem>
                )}
                <MenuItem icon={<Trash2 />} onSelect={run(() => deleteAtSelection(store, "cols"))}>
                  {t.deleteCols(selectedIndexes(store, "cols").length)}
                </MenuItem>
              </>
            )}
            {rowItems && (
              <MenuItem icon={<EyeOff />} onSelect={run(() => hideSelection(store, "rows"))}>
                {t.hideRows(selectedIndexes(store, "rows").length)}
              </MenuItem>
            )}
            {colItems && (
              <MenuItem icon={<EyeOff />} onSelect={run(() => hideSelection(store, "cols"))}>
                {t.hideCols(selectedIndexes(store, "cols").length)}
              </MenuItem>
            )}
            {kind === "rows" && (
              <MenuItem icon={<MoveVertical />} onSelect={run(() => fitRows(store, selectedIndexes(store, "rows")))}>
                {t.fitRows}
              </MenuItem>
            )}
            {kind === "cols" && (
              <MenuItem icon={<MoveHorizontal />} onSelect={run(() => fitColumns(store, selectedIndexes(store, "cols")))}>
                {t.fitCols}
              </MenuItem>
            )}
            {hiddenRows.length > 0 && (
              <MenuItem icon={<Eye />} onSelect={run(() => unhideNear(store, "rows", hiddenRows))}>
                {t.unhideRows}
              </MenuItem>
            )}
            {hiddenCols.length > 0 && (
              <MenuItem icon={<Eye />} onSelect={run(() => unhideNear(store, "cols", hiddenCols))}>
                {t.unhideCols}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem icon={<Eraser />} shortcut={t.deleteKey} onSelect={run(() => clearSelection(store))}>
              {t.clearContents}
            </MenuItem>
            <MenuItem icon={<RemoveFormatting />} onSelect={run(() => clearSelection(store, "formats"))}>
              {t.clearFormats}
            </MenuItem>
            <MenuItem icon={<ArrowDownAZ />} onSelect={run(() => sortSelection(store, "asc"))}>
              {t.sortAsc}
            </MenuItem>
            <MenuItem icon={<ArrowUpZA />} onSelect={run(() => sortSelection(store, "desc"))}>
              {t.sortDesc}
            </MenuItem>
            {kind === "cells" && (
              <>
                <MenuItem icon={<ArrowDownToLine />} shortcut={`${keys.mod}D`} onSelect={run(() => fillFrom(store, "down"))}>
                  {t.fillDown}
                </MenuItem>
                <MenuItem icon={<ArrowRightToLine />} shortcut={`${keys.mod}R`} onSelect={run(() => fillFrom(store, "right"))}>
                  {t.fillRight}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<MessageSquareText />} onSelect={run(() => onNote(anchor))}>
                  {note ? t.editNote : t.addNote}
                </MenuItem>
                {note && (
                  <MenuItem icon={<MessageSquareX />} onSelect={run(() => setNote(store, anchor, ""))}>
                    {t.deleteNote}
                  </MenuItem>
                )}
              </>
            )}
            <MenuSeparator />
            {frozen ? (
              <MenuItem icon={<Snowflake />} onSelect={run(() => freeze(store, "off"))}>
                {t.unfreeze}
              </MenuItem>
            ) : (
              <>
                {(anchor.row > 0 || anchor.col > 0 || kind !== "cells") && (
                  <MenuItem icon={<Snowflake />} onSelect={run(() => freeze(store, "here"))}>
                    {t.freezeHere}
                  </MenuItem>
                )}
                <MenuItem icon={<Snowflake />} onSelect={run(() => freeze(store, "top"))}>
                  {t.freezeTopRow}
                </MenuItem>
              </>
            )}
          </>
        )}
      </>
    );
  }
  return (
    <ContextMenu at={at} onClose={onClose} label={t.menu} className={finger ? `${TOUCH_ITEMS} ${NO_SHORTCUTS}` : TOUCH_ITEMS}>
      {body}
    </ContextMenu>
  );
}

/** Ctrl++ / Ctrl+- on cells that aren't whole rows or columns: rows or columns? */
export function Chooser({ store, at, kind, onClose, t }: { store: SheetStore; at: MenuPoint | null; kind: "insert" | "delete"; onClose: () => void; t: GridText }) {
  const s = store.get();
  const a = activeArea(s.selection);
  const nRows = a.r1 - a.r0 + 1;
  const nCols = a.c1 - a.c0 + 1;
  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <ContextMenu at={at} onClose={onClose} label={kind === "insert" ? t.insertWhat : t.deleteWhat} className={TOUCH_ITEMS}>
      <MenuLabel>{kind === "insert" ? t.insertWhat : t.deleteWhat}</MenuLabel>
      {kind === "insert" ? (
        <>
          <MenuItem icon={<BetweenHorizontalStart />} onSelect={run(() => insertAtSelection(store, "rows"))}>
            {t.insertRowsChoice(nRows)}
          </MenuItem>
          <MenuItem icon={<BetweenVerticalStart />} onSelect={run(() => insertAtSelection(store, "cols"))}>
            {t.insertColsChoice(nCols)}
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem icon={<Trash2 />} onSelect={run(() => deleteAtSelection(store, "rows"))}>
            {t.deleteRowsChoice(selectedIndexes(store, "rows").length)}
          </MenuItem>
          <MenuItem icon={<Trash2 />} onSelect={run(() => deleteAtSelection(store, "cols"))}>
            {t.deleteColsChoice(selectedIndexes(store, "cols").length)}
          </MenuItem>
        </>
      )}
    </ContextMenu>
  );
}

/**
 * Writing a cell's note: a small card next to the cell. Ctrl/⌘+Enter or "Speichern" saves,
 * Escape cancels, clicking elsewhere saves (typed text is never lost).
 */
export function NotePopover({
  store,
  at,
  rect,
  onClose,
  t,
}: {
  store: SheetStore;
  at: Pos;
  /** The cell on screen (viewport coordinates). */
  rect: { x: number; y: number; w: number; h: number };
  onClose: () => void;
  t: GridText;
}) {
  const [initial] = useState(() => {
    const s = store.get();
    return sheetById(s.workbook, s.sheetId)?.cells[`${at.row},${at.col}`]?.note ?? "";
  });
  const [text, setText] = useState(initial);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // (Open while it is there: a press outside it saves and closes it, below.)
  useClosesOutside(panel, true);
  const latest = useRef(text);
  useEffect(() => {
    latest.current = text;
  }, [text]);

  const save = () => {
    setNote(store, at, latest.current);
    onClose();
  };

  // Placed beside the cell before the first paint (right of it, or left when there is no room),
  // inside what can be seen: above the on-screen keyboard that its field brings up on a phone, once
  // that is there (see visibleArea).
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const place = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const area = visibleArea();
      let left = rect.x + rect.w + 8;
      if (left + w > window.innerWidth - 8) left = Math.max(8, rect.x - w - 8);
      el.style.left = `${left}px`;
      el.style.top = `${Math.max(area.top + 8, Math.min(rect.y, area.bottom - h - 8))}px`;
    };
    place();
    field.current?.focus();
    field.current?.setSelectionRange(field.current.value.length, field.current.value.length);
    const view = window.visualViewport;
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [rect]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) {
        setNote(store, at, latest.current);
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [store, at, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={t.noteOn(posName(at))}
      className="fixed left-[-9999px] top-[-9999px] z-[95] w-[300px] max-w-[calc(100vw-16px)] rounded-xl border border-line bg-raised p-2.5 shadow-pop"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[12px] font-medium text-ink-2">
        <MessageSquareText className="size-3.5 text-blob" />
        {t.noteOn(posName(at))}
      </div>
      <textarea
        ref={field}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.notePlaceholder}
        rows={4}
        // 16 px on touch screens, like the sheet's other fields: an iPhone zooms the page in on a smaller one.
        className="block w-full resize-none rounded-lg border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))] focus:border-blob/60 [@media(hover:none)]:text-[16px]"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <span className="mr-auto whitespace-nowrap text-[11px] text-ink-3 [@media(hover:none)]:invisible">{t.noteHint}</span>
        {initial && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setNote(store, at, "");
              onClose();
            }}
          >
            {t.noteDelete}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t.noteCancel}
        </Button>
        <Button size="sm" variant="blob" onClick={save}>
          {t.noteSave}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
