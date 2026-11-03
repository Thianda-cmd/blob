"use client";

// The sheet tabs under the grid: a tab per sheet (the one on screen highlighted), "+" for a new
// sheet, a list of all sheets for quick jumps. Double-click (a pen's double tap) renames a tab in
// place; right-click, a long press or tapping the open tab again opens its menu (rename,
// duplicate, move, delete); dragging a tab moves it (on a touch screen: hold it first, then drag).
//
// CONTRACT: <SheetTabs store={store} /> is placed by SheetEditor. Implemented by the editor chrome.

import { ArrowLeft, ArrowRight, Check, Copy, List, PencilLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ContextMenu, type MenuPoint } from "@/components/ui/ContextMenu";
import { Dialog } from "@/components/ui/Dialog";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useIsMac } from "@/components/ui/useMediaQuery";
import { useMessages } from "@/i18n/client";
import { sheetChromeText } from "@/i18n/messages/sheetChrome";
import { cn } from "@/lib/utils";
import { addSheet, deleteSheet, duplicateSheet, moveSheet, renameSheet, validSheetName } from "@/sheet/ops";
import type { Sheet, Workbook } from "@/sheet/types";
import { useSheet, type SheetStore } from "../store";
import { focusGrid, HoverTips, keepFocus, keysText, useKeys } from "./parts";

/** Why a new name doesn't work for a sheet (null: it does). */
export function sheetNameProblem(wb: Workbook, sheetId: string, name: string): "invalid" | "taken" | null {
  const n = name.trim();
  if (!validSheetName(n)) return "invalid";
  if (wb.sheets.some((s) => s.id !== sheetId && s.name.toLowerCase() === n.toLowerCase())) return "taken";
  return null;
}

/** Does a sheet hold anything worth asking about before deleting it (cells, charts, tables)? */
export function sheetHasContent(wb: Workbook, sheet: Sheet): boolean {
  for (const key in sheet.cells) {
    const c = sheet.cells[key];
    if (c.v !== undefined || c.f !== undefined || c.note) return true;
  }
  return wb.charts.some((c) => c.sheetId === sheet.id) || wb.tables.some((t) => t.sheetId === sheet.id);
}

type Press = {
  id: string;
  pointerId: number;
  type: string;
  x0: number;
  y0: number;
  /** Moving the tab (after 5 px with a mouse or pen; after holding still first on a touch screen). */
  dragging: boolean;
  /** A finger has held still long enough: moving now drags, lifting opens the menu. */
  armed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  target: number;
  /** How far the tab may move left and right without leaving the strip. */
  minDx: number;
  maxDx: number;
};

const now = () => Date.now();

export function SheetTabs({ store }: { store: SheetStore }): ReactNode {
  const t = useMessages(sheetChromeText);
  const keys = useKeys();
  const mac = useIsMac();
  const sheets = useSheet(store, (s) => s.workbook.sheets);
  const active = useSheet(store, (s) => s.sheetId);
  const readOnly = useSheet(store, (s) => s.readOnly);
  const [renaming, setRenaming] = useState<{ id: string; draft: string; problem: string | null } | null>(null);
  const [menu, setMenu] = useState<{ id: string; at: MenuPoint } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [drag, setDrag] = useState<{ id: string; dx: number; line: number } | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const skipClick = useRef(false);
  const lastPointer = useRef<string>("mouse");
  const lastPenTap = useRef<{ id: string; at: number } | null>(null);

  // The tab on screen stays in sight.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-sheet-tab="${CSS.escape(active)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, sheets.length]);

  // A finger that held a tab drags it: the strip mustn't scroll under it then.
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (press.current?.armed && press.current.type === "touch") e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, []);

  const indexOf = (id: string) => sheets.findIndex((s) => s.id === id);

  // ---- changes, each one undo step

  const switchTo = (id: string) => {
    if (id !== store.get().sheetId) store.setSheet(id);
  };

  const add = () => {
    const s = store.get();
    if (s.readOnly) return;
    const r = addSheet(s.workbook, s.locale, undefined, indexOf(s.sheetId) + 1);
    const base = s.workbook;
    store.apply(t.steps.addSheet, (wb) => (wb === base ? r.wb : addSheet(wb, s.locale).wb));
    if (sheetsOf(store).some((x) => x.id === r.sheetId)) store.setSheet(r.sheetId);
  };

  const duplicate = (id: string) => {
    const s = store.get();
    if (s.readOnly) return;
    const r = duplicateSheet(s.workbook, id);
    const base = s.workbook;
    store.apply(t.steps.duplicateSheet, (wb) => (wb === base ? r.wb : duplicateSheet(wb, id).wb));
    if (sheetsOf(store).some((x) => x.id === r.sheetId)) store.setSheet(r.sheetId);
  };

  const move = (id: string, to: number) => {
    if (store.get().readOnly) return;
    store.apply(t.steps.moveSheet, (wb) => moveSheet(wb, id, to));
  };

  const remove = (id: string) => {
    const s = store.get();
    if (s.readOnly || s.workbook.sheets.length <= 1) return;
    // Deleting the sheet on screen: its right neighbour (or left one, at the end) comes up. Deleted
    // first, so undoing it shows the sheet again.
    const i = s.workbook.sheets.findIndex((x) => x.id === id);
    const next = s.sheetId === id ? (s.workbook.sheets[i + 1] ?? s.workbook.sheets[i - 1]) : undefined;
    store.apply(t.steps.deleteSheet, (wb) => deleteSheet(wb, id));
    if (next && sheetsOf(store).some((x) => x.id === next.id)) store.setSheet(next.id);
  };

  const askRemove = (id: string) => {
    const s = store.get();
    const sheet = s.workbook.sheets.find((x) => x.id === id);
    if (!sheet || s.workbook.sheets.length <= 1) return;
    if (sheetHasContent(s.workbook, sheet)) setConfirm(id);
    else remove(id);
  };

  // ---- renaming in place

  const startRename = (id: string) => {
    if (store.get().readOnly) return;
    const sheet = sheets.find((s) => s.id === id);
    if (sheet) setRenaming({ id, draft: sheet.name, problem: null });
  };

  const finishRename = (keep: boolean) => {
    const r = renaming;
    if (!r) return;
    const wb = store.get().workbook;
    const sheet = wb.sheets.find((s) => s.id === r.id);
    const name = r.draft.trim();
    if (!keep || !sheet || name === sheet.name) {
      setRenaming(null);
      focusGrid();
      return;
    }
    const problem = sheetNameProblem(wb, r.id, name);
    if (problem) {
      setRenaming({ ...r, problem: problem === "taken" ? t.nameTaken(name) : t.nameInvalid });
      return;
    }
    store.apply(t.steps.renameSheet, (w) => renameSheet(w, r.id, name));
    setRenaming(null);
    focusGrid();
  };

  // ---- the menu

  const openMenu = (id: string, at: MenuPoint) => {
    if (store.get().readOnly) return;
    setMenu({ id, at });
  };
  const menuAtTab = (id: string) => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-sheet-tab="${CSS.escape(id)}"]`);
    const r = el?.getBoundingClientRect();
    openMenu(id, r ? { x: r.left + 4, y: r.top - 4, keyboard: false } : { x: 16, y: 16, keyboard: false });
  };

  // ---- dragging

  /** Where a tab dropped at clientX lands (its index after the move) and where the drop line goes. */
  const dropAt = (id: string, clientX: number): { target: number; line: number } => {
    const box = strip.current;
    if (!box) return { target: indexOf(id), line: 0 };
    const base = box.getBoundingClientRect().left - box.scrollLeft;
    const others = sheets.filter((s) => s.id !== id).map((s) => box.querySelector<HTMLElement>(`[data-sheet-tab="${CSS.escape(s.id)}"]`)?.getBoundingClientRect() ?? null);
    let target = 0;
    for (const r of others) if (r && r.left + r.width / 2 < clientX) target++;
    const before = others[target - 1];
    const after = others[target];
    const line = after ? after.left - 2 - base : before ? before.right + 1 - base : 2;
    return { target, line };
  };

  const endPress = () => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    press.current = null;
    setDrag(null);
    setLifted(null);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    lastPointer.current = e.pointerType;
    if (renaming || (e.pointerType === "mouse" && e.button !== 0)) return;
    const tab = e.currentTarget.getBoundingClientRect();
    const box = strip.current?.getBoundingClientRect();
    const p: Press = {
      id,
      pointerId: e.pointerId,
      type: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      dragging: false,
      armed: e.pointerType !== "touch",
      timer: null,
      target: indexOf(id),
      minDx: box ? box.left - tab.left : -Infinity,
      maxDx: box ? box.right - tab.right : Infinity,
    };
    if (e.pointerType === "touch") {
      p.timer = setTimeout(() => {
        const cur = press.current;
        if (!cur || cur.pointerId !== p.pointerId) return;
        cur.armed = true;
        cur.timer = null;
        setLifted(id);
        navigator.vibrate?.(12);
      }, 450);
    }
    press.current = p;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    if (!p.dragging) {
      if (!p.armed) {
        // A finger moving before it held still: it is scrolling the tabs.
        if (Math.hypot(dx, dy) > 8) endPress();
        return;
      }
      if (Math.abs(dx) < 5 || readOnly || sheets.length < 2) return;
      p.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const d = dropAt(p.id, e.clientX);
    p.target = d.target;
    setDrag({ id: p.id, dx: Math.max(p.minDx, Math.min(p.maxDx, dx)), line: d.line });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (p.timer) clearTimeout(p.timer);
    const wasArmedTouch = p.type === "touch" && p.armed && !p.dragging;
    if (p.dragging) {
      skipClick.current = true;
      if (p.target !== indexOf(p.id)) move(p.id, p.target);
    } else if (wasArmedTouch) {
      // Held still and lifted: the tab's menu.
      skipClick.current = true;
      menuAtTab(p.id);
    } else if (p.type === "pen") {
      // A pen's double tap renames (browsers don't always send dblclick for pens).
      const last = lastPenTap.current;
      lastPenTap.current = { id: p.id, at: now() };
      if (last && last.id === p.id && now() - last.at < 400) {
        lastPenTap.current = null;
        skipClick.current = true;
        startRename(p.id);
      }
    }
    endPress();
  };

  const onClick = (id: string) => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    // On a touch screen, tapping the open tab again opens its menu.
    if (id === store.get().sheetId && lastPointer.current === "touch") {
      menuAtTab(id);
      return;
    }
    switchTo(id);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const i = indexOf(id);
    const focusTab = (j: number) => {
      const target = sheets[Math.max(0, Math.min(sheets.length - 1, j))];
      if (!target) return;
      switchTo(target.id);
      requestAnimationFrame(() => strip.current?.querySelector<HTMLElement>(`[data-sheet-tab="${CSS.escape(target.id)}"]`)?.focus());
    };
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.altKey && !readOnly) move(id, i + (e.key === "ArrowRight" ? 1 : -1));
      else focusTab(i + (e.key === "ArrowRight" ? 1 : -1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      focusTab(e.key === "Home" ? 0 : sheets.length - 1);
    } else if (e.key === "F2" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      startRename(id);
    } else if (e.key === "Delete" && !readOnly) {
      e.preventDefault();
      askRemove(id);
    } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      openMenu(id, { x: r.left + 4, y: r.top - 4, keyboard: true });
    }
  };

  const menuSheet = menu ? sheets.find((s) => s.id === menu.id) : undefined;
  const menuIndex = menuSheet ? indexOf(menuSheet.id) : -1;
  const confirmSheet = confirm ? sheets.find((s) => s.id === confirm) : undefined;
  const runMenu = (f: () => void) => () => {
    setMenu(null);
    f();
  };

  const tabBase =
    "relative flex h-8 max-w-[200px] shrink-0 items-center rounded-lg px-3 text-[13px] outline-none transition-[background,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-blob/50 [@media(hover:none)]:h-9";

  return (
    <div className="flex h-10 min-w-0 items-center gap-1 px-1 [@media(hover:none)]:h-12" onMouseDown={(e) => (renaming ? undefined : keepFocus(e))}>
      <Popover
        open={listOpen}
        onOpenChange={setListOpen}
        side="top"
        label={t.allSheets}
        className="max-h-[min(60vh,420px)] w-[240px] overflow-y-auto"
        trigger={({ ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-label={t.allSheets}
            aria-haspopup="menu"
            aria-expanded={listOpen}
            data-tip={t.allSheets}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
          >
            <List className="size-4" />
          </button>
        )}
      >
        {(close) =>
          sheets.map((sh) => (
            <MenuItem
              key={sh.id}
              icon={sh.id === active ? <Check /> : <span className="inline-block size-4" />}
              active={sh.id === active}
              onSelect={() => {
                close();
                switchTo(sh.id);
              }}
            >
              {sh.name}
            </MenuItem>
          ))
        }
      </Popover>

      <div ref={strip} role="tablist" aria-label={t.sheets} className="relative flex min-w-0 items-center gap-0.5 overflow-x-auto py-1 pl-0.5 pr-1.5 [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden">
        {sheets.map((sh) => {
          const on = sh.id === active;
          if (renaming?.id === sh.id) {
            return (
              <div key={sh.id} className="relative shrink-0">
                <input
                  autoFocus
                  value={renaming.draft}
                  onChange={(e) => setRenaming({ ...renaming, draft: e.target.value.slice(0, 31), problem: null })}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => {
                    // Leaving the field keeps a good name and quietly drops a bad one.
                    const r = renaming;
                    const problem = sheetNameProblem(store.get().workbook, r.id, r.draft);
                    if (problem) setRenaming(null);
                    else finishRename(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter") {
                      e.preventDefault();
                      finishRename(true);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      finishRename(false);
                    }
                  }}
                  aria-label={t.sheetName}
                  aria-invalid={renaming.problem ? true : undefined}
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={31}
                  style={{ width: `${Math.max(6, renaming.draft.length + 2)}ch` }}
                  className="h-8 max-w-[220px] rounded-lg border border-blob bg-raised px-2.5 text-[13px] font-medium text-ink shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] outline-none aria-[invalid=true]:border-danger [@media(hover:none)]:h-9"
                />
              </div>
            );
          }
          const dragging = drag?.id === sh.id;
          return (
            <button
              key={sh.id}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              data-sheet-tab={sh.id}
              data-tip={!readOnly && on ? t.tabHint : undefined}
              onPointerDown={(e) => onPointerDown(e, sh.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={endPress}
              onClick={() => onClick(sh.id)}
              onDoubleClick={() => startRename(sh.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (lastPointer.current === "touch") return;
                const keyboard = e.clientX === 0 && e.clientY === 0;
                if (keyboard) {
                  const r = e.currentTarget.getBoundingClientRect();
                  openMenu(sh.id, { x: r.left + 4, y: r.top - 4, keyboard });
                } else openMenu(sh.id, { x: e.clientX, y: e.clientY, keyboard });
              }}
              onKeyDown={(e) => onTabKey(e, sh.id)}
              style={dragging ? { transform: `translateX(${drag.dx}px)`, zIndex: 10 } : undefined}
              className={cn(
                tabBase,
                on ? "border border-line bg-raised font-medium text-ink shadow-card" : "border border-transparent text-ink-2 hover:bg-hover hover:text-ink",
                (dragging || lifted === sh.id) && "cursor-grabbing border-line bg-raised text-ink shadow-pop",
                // The tab being dragged sticks to the pointer (no easing behind it).
                dragging && "transition-none",
              )}
            >
              <span className="truncate">{sh.name}</span>
            </button>
          );
        })}
        {drag && <span aria-hidden className="pointer-events-none absolute bottom-1 top-1 w-[2px] rounded-full bg-blob" style={{ left: drag.line }} />}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={add}
          aria-label={t.addSheet}
          data-tip={t.addSheet}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
        >
          <Plus className="size-4" />
        </button>
      )}

      {renaming?.problem && (
        <div role="alert" className="pointer-events-none fixed bottom-14 left-1/2 z-[85] w-[min(360px,calc(100vw-24px))] -translate-x-1/2 rounded-lg border border-line bg-raised px-3 py-2 text-[12.5px] leading-snug text-danger shadow-pop">
          {renaming.problem}
        </div>
      )}

      <ContextMenu at={menu?.at ?? null} onClose={() => setMenu(null)} label={menuSheet ? t.sheetMenu(menuSheet.name) : t.sheets}>
        {menuSheet && (
          <>
            <MenuItem icon={<PencilLine />} onSelect={runMenu(() => startRename(menuSheet.id))}>
              {t.rename}
            </MenuItem>
            <MenuItem icon={<Copy />} onSelect={runMenu(() => duplicate(menuSheet.id))}>
              {t.duplicate}
            </MenuItem>
            <MenuItem icon={<ArrowLeft />} disabled={menuIndex <= 0} onSelect={runMenu(() => move(menuSheet.id, menuIndex - 1))}>
              {t.moveLeft}
            </MenuItem>
            <MenuItem icon={<ArrowRight />} disabled={menuIndex >= sheets.length - 1} onSelect={runMenu(() => move(menuSheet.id, menuIndex + 1))}>
              {t.moveRight}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} danger disabled={sheets.length <= 1} onSelect={runMenu(() => askRemove(menuSheet.id))}>
              {sheets.length <= 1 ? t.lastSheet : t.deleteSheet}
            </MenuItem>
          </>
        )}
      </ContextMenu>

      <Dialog open={!!confirmSheet} onClose={() => setConfirm(null)} labelledBy="sheet-delete-title">
        {confirmSheet && (
          <div className="p-5">
            <h2 id="sheet-delete-title" className="font-display text-[17px] font-semibold text-ink">
              {t.deleteTitle(confirmSheet.name)}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{t.deleteText(keysText(keys("Mod+Z"), mac))}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" autoFocus onClick={() => setConfirm(null)}>
                {t.cancel}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const id = confirmSheet.id;
                  setConfirm(null);
                  remove(id);
                }}
              >
                {t.deleteConfirm}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <HoverTips />
    </div>
  );
}

const sheetsOf = (store: SheetStore) => store.get().workbook.sheets;
