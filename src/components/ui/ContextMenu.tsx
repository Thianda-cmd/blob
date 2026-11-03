"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

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

/**
 * Where a menu of width `w` opens for `at` in a window of `vw` × `vh`. `h` is its height as
 * shown, `full` the height of everything in it (more than `h` when it scrolls), `cap` the most
 * it may take. From a mouse or the keyboard: at the point, flipped to stay inside the window.
 * From a finger: never under it, so the finger lifting can't land on an item. Beside it when
 * there is room (tablets), else above or below it, where there is more room (the list scrolls).
 */
export function placeMenu(at: MenuPoint, w: number, h: number, full: number, cap: number, vw: number, vh: number): MenuPlace {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  if (!at.finger) {
    const flipX = at.x + w + EDGE > vw;
    const flipY = at.y + h + EDGE > vh;
    const left = Math.max(EDGE, Math.min(flipX ? at.x - w : at.x, vw - w - EDGE));
    const top = Math.max(EDGE, Math.min(flipY ? at.y - h : at.y, vh - h - EDGE));
    return { top, left, maxHeight: null, origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}` };
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
 * A menu at the pointer. Closes on a click outside, Escape, scrolling the page or resizing; its
 * own list scrolls when it is longer than the screen. Mouse clicks inside keep the focus where it
 * was (the note's selection stays); from the keyboard the first item gets the focus and the arrow
 * keys move between items. An item only runs for a press that began inside the menu (or for the
 * keyboard): the finger that opened it with a long press lifting over an item chooses nothing.
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

  useLayoutEffect(() => {
    // (Placed before the first paint, so an old position never shows.)
    if (!at) return;
    const place = () => {
      const el = panel.current;
      const w = el?.offsetWidth ?? 220;
      const h = el?.offsetHeight ?? 240;
      // The cap is the panel's max-h class below (keep the two in step).
      const cap = Math.min(window.innerHeight * 0.7, 520);
      setPos(placeMenu(at, w, h, el?.scrollHeight ?? h, cap, window.innerWidth, window.innerHeight));
    };
    place();
    const grows = typeof ResizeObserver === "undefined" || !panel.current ? null : new ResizeObserver(place);
    if (grows && panel.current) grows.observe(panel.current);
    return () => grows?.disconnect();
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
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not(:disabled)") ?? [])];
      if (!items.length) return;
      e.preventDefault();
      e.stopPropagation();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length : i) - 1;
      items[next].focus();
    };
    const onAway = () => onClose();
    // What the menu was opened on moving away closes it; the menu's own list scrolling doesn't.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onAway);
    window.addEventListener("blur", onAway);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onAway);
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
