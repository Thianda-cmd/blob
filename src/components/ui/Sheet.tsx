"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A sheet that slides up from the bottom (phones). Drag the handle down or tap outside to close.
 * Content scrolls inside; the bottom keeps clear of the iPhone's home indicator.
 */
export function Sheet({
  open,
  onClose,
  children,
  label,
  full,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  /** Nearly the whole screen high (editors), instead of as high as the content. */
  full?: boolean;
  className?: string;
}) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[72]" key="sheet">
          <motion.div
            className="absolute inset-0 bg-[rgb(20_18_14/0.32)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={cn(
              "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[20px] border-t border-line bg-raised shadow-pop",
              full ? "h-[92dvh]" : "max-h-[92dvh]",
              className,
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center" onPointerDown={(e) => controls.start(e)} aria-hidden>
              <span className="h-1 w-10 rounded-full bg-line-2" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
