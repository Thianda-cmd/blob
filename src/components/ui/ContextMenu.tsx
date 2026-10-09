"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Where a right-click menu opens (viewport coordinates), and whether the keyboard asked for it. */
export type MenuPoint = { x: number; y: number; keyboard: boolean };

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
 * A menu at the pointer. Closes on a click outside, Escape, scrolling or resizing. Mouse clicks
 * inside keep the focus where it was (the note's selection stays); from the keyboard the first
 * item gets the focus and the arrow keys move between items.
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
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);

  useLayoutEffect(() => {
    // (Placed before the first paint, so an old position never shows.)
    if (!at) return;
    const place = () => {
      const w = panel.current?.offsetWidth ?? 220;
      const h = panel.current?.offsetHeight ?? 240;
      const flipX = at.x + w + 8 > window.innerWidth;
      const flipY = at.y + h + 8 > window.innerHeight;
      const left = Math.max(8, Math.min(flipX ? at.x - w : at.x, window.innerWidth - w - 8));
      const top = Math.max(8, Math.min(flipY ? at.y - h : at.y, window.innerHeight - h - 8));
      setPos({ top, left, origin: `${flipY ? "bottom" : "top"} ${flipX ? "right" : "left"}` });
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
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onAway);
    window.addEventListener("blur", onAway);
    document.addEventListener("scroll", onAway, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onAway);
      window.removeEventListener("blur", onAway);
      document.removeEventListener("scroll", onAway, true);
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
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, transformOrigin: pos?.origin ?? "top left" }}
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
