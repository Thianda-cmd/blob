"use client";

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A panel floating next to an element inside the note (a formula, a diagram…): below it when there
 * is room, otherwise above. Closes on Escape and on a click outside the panel and the anchor.
 */
export function Floating({
  anchor,
  onClose,
  children,
  className,
  label,
  align = "start",
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
  align?: "start" | "center";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const w = panel.current?.offsetWidth ?? 320;
      const h = panel.current?.offsetHeight ?? 200;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const below = r.bottom + 8;
      const above = vh - below < h + 8 && r.top - h - 8 > 8;
      let left = align === "center" ? r.left + r.width / 2 - w / 2 : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      const top = above ? r.top - h - 8 : Math.max(8, Math.min(below, vh - h - 8));
      setPos((p) => (p && p.top === top && p.left === left && p.above === above ? p : { top, left, above }));
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (ro && panel.current) ro.observe(panel.current);
    if (ro) ro.observe(anchor);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor?.contains(t)) return;
      // Menus opened from inside the panel live in their own portal.
      if ((t as HTMLElement).closest?.("[data-floating-keep]")) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchor]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <motion.div
      ref={panel}
      role="dialog"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.96, y: pos?.above ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 560, damping: 34 }}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, transformOrigin: pos?.above ? "bottom left" : "top left" }}
      className={cn("blob-floating fixed z-[65] rounded-xl border border-line bg-raised text-ink shadow-pop", className)}
      // Clicks inside never reach the editor underneath.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>,
    document.body,
  );
}
