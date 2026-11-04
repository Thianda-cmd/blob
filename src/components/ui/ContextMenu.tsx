"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { pageIndex, roveIndex } from "./menuKeys";

/**
 * A menu, popover or card that closes on a press outside it (this menu, Popover, a smart table
 * column's menu, a cell's note) marks itself while it is open, not while it fades out: on the
 * spreadsheet a finger that comes down only to close one of them does nothing else (see
 * closesPanel and Grid.tsx), as with the system's own menus. `open`: whether it is open.
 */
export function useClosesOutside(panel: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    el.setAttribute("data-closes-outside", "");
    return () => el.removeAttribute("data-closes-outside");
  }, [panel, open]);
}

/** Whether a press on `target` closes one of those (see useClosesOutside): one is open, and the press is outside it. */
export function closesPanel(target: EventTarget | null): boolean {
  return [...document.querySelectorAll("[data-closes-outside]")].some((el) => !(target instanceof Node && el.contains(target)));
}

/**
 * Where a right-click menu opens (viewport coordinates), and whether the keyboard asked for it.
 * `finger`: a long press opened it, and the finger is still on the screen at x, y.
 */
export type MenuPoint = { x: number; y: number; keyboard: boolean; finger?: boolean };

/** Where a menu goes: its top-left corner, how tall it may get (null: as tall as its style allows), and where it grows from. */
export type MenuPlace = { top: number; left: number; maxHeight: number | null; origin: string };

/** Space kept between a menu and the window's edges, and around a fingertip. */
const EDGE = 8;
const FINGER = 28;

/** The part of the window that can be seen, top to bottom (viewport coordinates). */
export type ShownArea = { top: number; bottom: number };

/**
 * The part of the window a menu can be seen in, from the visual viewport (`view`, null where the
 * browser has none). While a text field has the focus (`typing`) an on-screen keyboard may cover
 * the window's bottom: iOS Safari and Chrome on Android leave the window as tall as it was and
 * shrink only the visual viewport (whose top moves too when the page is pushed up for the field).
 * A pinch zoom also shows only part of the window. Otherwise no keyboard is up, or it is on its
 * way down (a finger's menu lets go of it first): the whole window will be seen, and a menu placed
 * for that doesn't jump once the keyboard has gone.
 */
export function shownArea(view: { offsetTop: number; height: number; scale: number } | null, innerHeight: number, typing: boolean): ShownArea {
  if (!view || (!typing && view.scale < 1.01)) return { top: 0, bottom: innerHeight };
  return { top: view.offsetTop, bottom: view.offsetTop + view.height };
}

/** The part of this window a menu can be seen in now (see shownArea). */
export function visibleArea(): ShownArea {
  const at = document.activeElement;
  const typing = at instanceof HTMLElement && (at.isContentEditable || at.matches("input, textarea, select"));
  return shownArea(window.visualViewport ?? null, window.innerHeight, typing);
}

/**
 * Where a menu of width `w` opens for `at` in a window of `vw` × `vh` (what can be seen of it).
 * `h` is its height as its style lets it be, `full` the height of everything in it (more than `h`
 * when it scrolls), `cap` the most it may take. From a mouse or the keyboard: at the point,
 * flipped to stay inside the window, and scrolling when even that is too short for it (an
 * on-screen keyboard is up). From a finger: never under it, so the finger lifting can't land on
 * an item. Beside it when there is room (tablets), else above or below it, where there is more
 * room (the list scrolls).
 */
export function placeMenu(at: MenuPoint, w: number, h: number, full: number, cap: number, vw: number, vh: number): MenuPlace {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  if (!at.finger) {
    const tall = Math.max(0, Math.min(h, vh - 2 * EDGE));
    const flipX = at.x + w + EDGE > vw;
    const flipY = at.y + tall + EDGE > vh;
    const left = Math.max(EDGE, Math.min(flipX ? at.x - w : at.x, vw - w - EDGE));
    const top = Math.max(EDGE, Math.min(flipY ? at.y - tall : at.y, vh - tall - EDGE));
    return { top, left, maxHeight: tall < h ? tall : null, origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}` };
  }
  const natural = Math.min(full, cap, vh - 2 * EDGE);
  const right = at.x + FINGER;
  const leftOf = at.x - FINGER - w;
  if (right + w <= vw - EDGE || leftOf >= EDGE) {
    const left = right + w <= vw - EDGE ? right : leftOf;
    const top = clamp(at.y - 20, EDGE, vh - natural - EDGE);
    return { top, left, maxHeight: natural, origin: `top ${left > at.x ? "left" : "right"}` };
  }
  const below = vh - EDGE - (at.y + FINGER);
  const above = at.y - FINGER - EDGE;
  const down = below >= natural || below >= above;
  const tall = Math.max(0, Math.min(natural, down ? below : above));
  return {
    top: down ? at.y + FINGER : at.y - FINGER - tall,
    left: clamp(at.x - w / 2, EDGE, vw - w - EDGE),
    maxHeight: tall,
    origin: `${down ? "top" : "bottom"} center`,
  };
}

/**
 * placeMenu inside the part of the window that can be seen (`area`, see visibleArea) of a window
 * `vw` wide: `full` is the height of everything in the menu, `cap` the most its style lets it take.
 */
export function placeMenuIn(at: MenuPoint, w: number, full: number, cap: number, vw: number, area: ShownArea): MenuPlace {
  const p = placeMenu({ ...at, y: at.y - area.top }, w, Math.min(full, cap), full, cap, vw, area.bottom - area.top);
  return { ...p, top: p.top + area.top };
}

/**
 * Whether a right-click should open Blob's own menu: not with Shift held (the browser's menu, for
 * spelling suggestions and the like), not in text fields, and not from a long press on a touch
 * screen (that selects text there).
 */
export function wantsOwnMenu(e: MouseEvent | React.MouseEvent, lastPointer: string | null) {
  if (e.shiftKey || lastPointer === "touch" || lastPointer === "pen") return false;
  const target = e.target as HTMLElement | null;
  return !target?.closest("input, textarea, select, [data-native-menu]");
}

/** The kind of pointer that pressed last (a long press on a touch screen also fires "contextmenu"). */
export function useLastPointer() {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      last.current = e.pointerType;
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);
  return last;
}

/** Open state for a right-click menu: `open(e)` from a contextmenu event, `close()`. */
export function useContextMenu() {
  const [at, setAt] = useState<MenuPoint | null>(null);
  const open = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault();
    // The context-menu key and Shift+F10 report no position: open at the focused element instead.
    const keyboard = e.clientX === 0 && e.clientY === 0;
    if (keyboard) {
      const r = (e.target as HTMLElement).getBoundingClientRect();
      setAt({ x: r.left + 8, y: r.top + Math.min(r.height, 28), keyboard });
    } else setAt({ x: e.clientX, y: e.clientY, keyboard });
  }, []);
  const close = useCallback(() => setAt(null), []);
  return { at, open, close, setAt };
}

/**
 * A menu at the pointer. Closes on a click outside, Escape, scrolling the page or a new window
 * width; its own list scrolls when it is longer than what can be seen of the screen (above an
 * on-screen keyboard too). Mouse clicks inside keep the focus where it was (the note's selection
 * stays); from the keyboard the first item gets the focus and the arrow keys move between items.
 * An item only runs for a press that began inside the menu (or for the keyboard): the finger that
 * opened it with a long press lifting over an item chooses nothing.
 */
export function ContextMenu({
  at,
  onClose,
  label,
  className,
  children,
}: {
  at: MenuPoint | null;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  /** The opening (`at`) during which a press began inside the menu. */
  const pressed = useRef<MenuPoint | null>(null);
  const [pos, setPos] = useState<MenuPlace | null>(null);
  useClosesOutside(panel, !!at);

  useLayoutEffect(() => {
    // (Placed before the first paint, so an old position never shows.)
    if (!at) return;
    const place = () => {
      const el = panel.current;
      const w = el?.offsetWidth ?? 220;
      // Everything in it, with its borders (max-height counts them too; scrollHeight doesn't).
      const full = el ? el.scrollHeight + el.offsetHeight - el.clientHeight : 240;
      // The cap is the panel's max-h class below (keep the two in step).
      const cap = Math.min(window.innerHeight * 0.7, 520);
      // Inside what can be seen: above an on-screen keyboard, inside a pinch zoom.
      setPos(placeMenuIn(at, w, full, cap, window.innerWidth, visibleArea()));
    };
    place();
    const grows = typeof ResizeObserver === "undefined" || !panel.current ? null : new ResizeObserver(place);
    if (grows && panel.current) grows.observe(panel.current);
    // An on-screen keyboard coming or going changes what can be seen: the menu finds its place
    // again (on browsers that resize the window for the keyboard too, see the effect below).
    const view = window.visualViewport;
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    window.addEventListener("resize", place);
    return () => {
      grows?.disconnect();
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [at]);

  useEffect(() => {
    if (!at) return;
    if (at.keyboard) panel.current?.querySelector<HTMLElement>("[role=menuitem]:not(:disabled)")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      const el = panel.current;
      const focused = document.activeElement;
      // A field keeps its keys: they move its caret.
      if (!el || (focused instanceof HTMLElement && focused.matches("input, textarea, select"))) return;
      const items = [...el.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)")];
      const i = items.indexOf(focused as HTMLElement);
      // The arrows go between the entries, also into the menu from where the keyboard was (a menu
      // opened with the mouse). With the keyboard in the menu, Home and End go to its first and last
      // entry and PageUp and PageDown about a page of its list further: the list scrolls to the
      // entry, never away from it (the browser would scroll the list and leave the keyboard where
      // it was, out of sight, for Enter to run).
      const arrow = e.key === "ArrowDown" || e.key === "ArrowUp";
      if (!items.length || (i < 0 && !arrow)) return;
      const page = e.key === "PageDown" || e.key === "PageUp";
      const next = page ? pageIndex(items.map((x) => x.getBoundingClientRect().top), i, el.clientHeight, e.key === "PageDown") : roveIndex(items.length, i, e.key);
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      items[next].focus();
    };
    const onAway = () => onClose();
    // What the menu was opened on moving away closes it; the menu's own list scrolling doesn't.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      onClose();
    };
    // A new width moves what the menu was opened on. A new height alone is an on-screen keyboard
    // going down (browsers that resize the window for it) or the browser's bars: the menu stays
    // and finds its place again (see above).
    const width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== width) onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", onAway);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onAway);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [at, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {at && (
        <motion.div
          ref={panel}
          role="menu"
          aria-label={label}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.08 } }}
          transition={{ type: "spring", stiffness: 700, damping: 36 }}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxHeight ?? undefined, transformOrigin: pos?.origin ?? "top left" }}
          onPointerDownCapture={() => {
            pressed.current = at;
          }}
          // A click no press inside started is the end of the gesture that opened the menu (a long
          // press lifting, which browsers turn into a click on whatever is under the finger by
          // then). Keyboard clicks (Enter, Space: detail 0) always count.
          onClickCapture={(e) => {
            if (e.detail !== 0 && pressed.current !== at) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          // Clicking an item keeps the focus (and the note's selection) where it was.
          onMouseDown={(e) => {
            if (!(e.target as HTMLElement).closest("input, textarea")) e.preventDefault();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "fixed z-[90] max-h-[min(70vh,520px)] min-w-[220px] overflow-y-auto overscroll-contain rounded-xl border border-line bg-raised p-1 text-[13px] shadow-pop",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
