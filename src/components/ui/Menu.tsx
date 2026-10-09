"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Align = "start" | "end";

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
}: {
  trigger: (props: { onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean; ref: React.Ref<HTMLButtonElement> }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: Align;
  side?: "bottom" | "top" | "right";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "dialog" for panels with fields and buttons rather than menu items. */
  role?: "menu" | "dialog";
  label?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    setUncontrolled(v);
    onOpenChange?.(v);
  };
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const w = panel.current?.offsetWidth ?? 220;
      const h = panel.current?.offsetHeight ?? 200;
      let left = side === "right" ? r.right + 6 : align === "start" ? r.left : r.right - w;
      let top = side === "bottom" ? r.bottom + 6 : side === "top" ? r.top - h - 6 : r.top;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      setPos({ top, left });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // Content that grows while open (a panel that unfolds more) finds its place again too.
    const grows = typeof ResizeObserver === "undefined" || !panel.current ? null : new ResizeObserver(place);
    if (grows && panel.current) grows.observe(panel.current);
    return () => {
      grows?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, side]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        anchor.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
                style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, transformOrigin: align === "start" ? "top left" : "top right" }}
                className={cn(
                  "fixed z-[80] min-w-[200px] rounded-xl border border-line bg-raised p-1 text-[13px] shadow-pop",
                  className,
                )}
                role={role}
                aria-label={label}
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
  onSelect?: () => void;
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
      {shortcut && <span className="text-[11px] text-ink-3">{shortcut}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-1 my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">{children}</div>;
}
