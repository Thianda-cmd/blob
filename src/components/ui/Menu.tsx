"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useClosesOutside, visibleArea, type ShownArea } from "./ContextMenu";
import { keepTabInside, tabbables } from "./Dialog";
import { roveIndex } from "./menuKeys";

type Align = "start" | "end";
type Side = "bottom" | "top" | "right";

/** Where a popover goes: its top-left corner, and how tall it may get (null: as tall as its style allows). */
export type PopoverPlace = { top: number; left: number; maxHeight: number | null };

/**
 * Where a popover `w` × `h` big goes for its trigger `r` (viewport coordinates): below it (or
 * above it, or to its right, as `side` says), lined up with its start or end, and moved to stay
 * inside a window `vw` wide and the part of it that can be seen (`area`, see visibleArea). Taller
 * than that part (an on-screen keyboard is up), it gets as tall as fits and scrolls.
 */
export function placePopover(r: { top: number; bottom: number; left: number; right: number }, w: number, h: number, side: Side, align: Align, area: ShownArea, vw: number): PopoverPlace {
  const tall = Math.max(0, Math.min(h, area.bottom - area.top - 16));
  let left = side === "right" ? r.right + 6 : align === "start" ? r.left : r.right - w;
  let top = side === "bottom" ? r.bottom + 6 : side === "top" ? r.top - tall - 6 : r.top;
  left = Math.max(8, Math.min(left, vw - w - 8));
  top = Math.max(area.top + 8, Math.min(top, area.bottom - tall - 8));
  return { top, left, maxHeight: tall < h ? tall : null };
}

/**
 * How tall a popover is as its own classes let it be, without the cap (inline max-height) of its
 * last placement. Lifting the cap to measure lets it fit, and the browser scrolls it back to its
 * top then: where it was scrolled to is put back, so a list a finger scrolled stays there.
 */
export function uncappedHeight(el: HTMLElement): number {
  const capped = el.style.maxHeight;
  if (!capped) return el.offsetHeight;
  const scrolled = el.scrollTop;
  el.style.maxHeight = "";
  const h = el.offsetHeight;
  el.style.maxHeight = capped;
  el.scrollTop = scrolled;
  return h;
}

/** An item or field that works and can be seen. */
const usable = (el: HTMLElement) => !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true" && !el.closest("[inert]") && el.getClientRects().length > 0;

/** A panel's items and buttons, which the arrow keys go between. */
const ITEMS = "button, [role^=menuitem]";

/**
 * Where the keyboard goes when the entry at `i` stops working under it (`works`: which of the
 * entries do): the next one that works, else the one before it; -1 when none does.
 */
export function nearestWorking(works: boolean[], i: number): number {
  for (let k = i + 1; k < works.length; k++) if (works[k]) return k;
  for (let k = i - 1; k >= 0; k--) if (works[k]) return k;
  return -1;
}

// (Where the arrows, Home and End take the keyboard: menuKeys.ts, shared with ContextMenu.tsx.)
export { roveIndex };

/**
 * Give the keyboard to where it starts in `root` (a menu, a panel, the part of one that just
 * opened): the current choice (a checked item), else the first item or field that works. False
 * when there is none.
 */
export function focusStart(root: HTMLElement): boolean {
  const target = [...root.querySelectorAll<HTMLElement>("[aria-checked=true]")].find(usable) ?? tabbables(root)[0];
  if (!target) return false;
  target.focus({ preventScroll: true });
  // In a list that scrolls (the formats), it is scrolled to once the popover has found its place.
  requestAnimationFrame(() => {
    if (document.activeElement === target) target.scrollIntoView({ block: "nearest" });
  });
  return true;
}

/**
 * Lightweight anchored popover. Renders in a portal, closes on outside click / Escape.
 * `trigger` receives the toggle handler so any element can open it.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  className,
  open: controlledOpen,
  onOpenChange,
  role = "menu",
  label,
  keyboard = false,
  focusOnOpen = false,
}: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  side?: Side;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "dialog" for panels with fields and buttons rather than menu items. */
  role?: "menu" | "dialog";
  label?: string;
  /**
   * Opt in to the keyboard (the spreadsheet's toolbar): with the keyboard in it, the arrow keys,
   * Home and End move between its items and buttons (not in its fields), and Tab goes round inside
   * it; closing it with the keyboard in it (Escape, a choice) gives the keyboard back to the trigger.
   */
  keyboard?: boolean;
  /** With `keyboard`: it opened from the keyboard, which goes into it (see focusStart), unless a field in it took it already. */
  focusOnOpen?: boolean;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    setUncontrolled(v);
    onOpenChange?.(v);
  };
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PopoverPlace | null>(null);
  // It closes on a press outside it (below).
  useClosesOutside(panel, open);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const el = panel.current;
      const r = anchor.current!.getBoundingClientRect();
      const w = el?.offsetWidth ?? 220;
      const h = el ? uncappedHeight(el) : 200;
      setPos(placePopover(r, w, h, side, align, visibleArea(), window.innerWidth));
    };
    place();
    const raf = requestAnimationFrame(place);
    // What it was opened on moving (the page or a list around it scrolling) moves it along; its
    // own list scrolling doesn't.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      place();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    // An on-screen keyboard coming or going changes what can be seen (see visibleArea).
    const view = window.visualViewport;
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    // Content that grows while open (a panel that unfolds more) finds its place again too.
    const grows = typeof ResizeObserver === "undefined" || !panel.current ? null : new ResizeObserver(place);
    if (grows && panel.current) grows.observe(panel.current);
    return () => {
      grows?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
    };
  }, [open, align, side]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        // (Opted in to the keyboard, it goes back to the trigger only from inside, see below.)
        if (!keyboard) anchor.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyboard]);

  // Opted in to the keyboard: opened from it, the keyboard goes in (onto the popover itself when
  // nothing in it works just now, so its words are read out: units for a date, say). Closing with
  // the keyboard in it (or lost from it while it was being used with the keyboard: the item it was
  // on went away), it goes back to the trigger, so it doesn't fall out to the top of the page.
  // Where the keyboard was elsewhere (the grid, for a mouse), it stays there. hadKeyboard: opened
  // from the keyboard, or a key pressed in it last (not a click or a tap).
  const hadKeyboard = useRef(false);
  useEffect(() => {
    if (!open || !keyboard || !focusOnOpen) return;
    const el = panel.current;
    hadKeyboard.current = true;
    if (el && !el.contains(document.activeElement) && !focusStart(el)) el.focus({ preventScroll: true });
  }, [open, keyboard, focusOnOpen]);
  useEffect(() => {
    if (!open || !keyboard) return;
    const el = panel.current;
    const trigger = anchor.current;
    return () => {
      const at = document.activeElement;
      const lost = !at || at === document.body;
      if ((el?.contains(at) || (lost && hadKeyboard.current)) && trigger?.isConnected) trigger.focus({ preventScroll: true });
      hadKeyboard.current = false;
    };
  }, [open, keyboard]);
  // While it stays open, the keyboard lost from it (the button it was on stopped working, was
  // hidden or went away) goes to the entry next to where it was, else where the panel starts, else
  // onto the panel: arrows and Escape keep working, and a screen reader hears where it is.
  useEffect(() => {
    const el = panel.current;
    if (!open || !keyboard || !el) return;
    let frame = 0;
    const onOut = (e: FocusEvent) => {
      if (e.relatedTarget || !hadKeyboard.current) return;
      // (Where it was, found while it is still in the panel: Chromium tells before taking an entry
      // away, too. Not found, the keyboard goes to where the panel starts.)
      const all = [...el.querySelectorAll<HTMLElement>(ITEMS)];
      const i = all.indexOf(e.target as HTMLElement);
      cancelAnimationFrame(frame);
      // Once the panel has settled; the keyboard may have gone somewhere already (a view that
      // replaced the one it was in), or out of the window (another app): then it is left alone.
      frame = requestAnimationFrame(() => {
        const at = document.activeElement;
        if (!el.isConnected || (at && at !== document.body)) return;
        const k = i < 0 ? -1 : nearestWorking(all.map(usable), i);
        if (k >= 0) all[k].focus();
        else if (!focusStart(el)) el.focus({ preventScroll: true });
      });
    };
    el.addEventListener("focusout", onOut);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("focusout", onOut);
    };
  }, [open, keyboard]);

  /** Opted in to the keyboard: arrows, Home and End between the items, Tab round inside. */
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = panel.current;
    if (!el || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !el.contains(e.target as Node)) return;
    if (e.key === "Tab") {
      keepTabInside(e, el);
      return;
    }
    const at = document.activeElement;
    // A field keeps its keys: they move its caret.
    if (!(at instanceof HTMLElement) || at.matches("input, textarea, select")) return;
    // (The entry the keyboard is on counts even when it has just stopped working, the decimals' −
    // at 0: the arrows go on from where it is.)
    const items = [...el.querySelectorAll<HTMLElement>(ITEMS)].filter((x) => x === at || usable(x));
    const next = roveIndex(items.length, items.indexOf(at), e.key);
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    items[next].focus();
  };

  const close = () => setOpen(false);

  return (
    <>
      {trigger({
        ref: anchor,
        "aria-expanded": open,
        onClick: (e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(!open);
        },
      })}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panel}
                initial={{ opacity: 0, scale: 0.94, y: side === "top" ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                transition={{ type: "spring", stiffness: 600, damping: 32 }}
                style={{
                  top: pos?.top ?? -9999,
                  left: pos?.left ?? -9999,
                  transformOrigin: align === "start" ? "top left" : "top right",
                  // Taller than what can be seen (an on-screen keyboard is up): it scrolls.
                  maxHeight: pos?.maxHeight ?? undefined,
                  overflowY: pos?.maxHeight != null ? "auto" : undefined,
                  overscrollBehavior: pos?.maxHeight != null ? "contain" : undefined,
                }}
                className={cn(
                  "fixed z-[80] min-w-[200px] rounded-xl border border-line bg-raised p-1 text-[13px] shadow-pop",
                  // Shortened, the popover is what scrolls: a list inside it that keeps a finger's
                  // scrolling to itself hands it on to the popover at its end, so what lies below the
                  // list can still be reached (the popover keeps it from going further).
                  pos?.maxHeight != null && "[&_.overscroll-contain]:overscroll-auto",
                  className,
                )}
                role={role}
                aria-label={label}
                tabIndex={keyboard ? -1 : undefined}
                onKeyDown={keyboard ? onPanelKey : undefined}
                onKeyDownCapture={
                  keyboard
                    ? () => {
                        hadKeyboard.current = true;
                      }
                    : undefined
                }
                onPointerDownCapture={
                  keyboard
                    ? () => {
                        hadKeyboard.current = false;
                      }
                    : undefined
                }
                // (A click on its own padding doesn't take the keyboard from where it is.)
                onMouseDown={
                  keyboard
                    ? (e) => {
                        if (e.target === e.currentTarget) e.preventDefault();
                      }
                    : undefined
                }
              >
                {typeof children === "function" ? children(close) : children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  danger,
  shortcut,
  active,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect?: (e: MouseEvent<HTMLButtonElement>) => void;
  danger?: boolean;
  shortcut?: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
        danger ? "text-danger hover:bg-danger/10" : "text-ink-2 hover:bg-hover hover:text-ink",
        active && "bg-hover text-ink",
      )}
    >
      {icon && <span className={danger ? "text-danger" : "text-ink-3"}>{icon}</span>}
      <span className="flex-1 truncate" title={typeof children === "string" ? children : undefined}>
        {children}
      </span>
      {/* (data-shortcut: a menu opened by a finger hides these, see the grid's menu.) */}
      {shortcut && (
        <span data-shortcut="" className="text-[11px] text-ink-3">
          {shortcut}
        </span>
      )}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{children}</div>;
}
