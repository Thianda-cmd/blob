"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const TABBABLE = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [contenteditable]:not([contenteditable="false"]), [tabindex]';

/** What Tab can reach inside `root`, in order (of a group of radio buttons only the checked one, as the browser does). */
export function tabbables(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled || el.closest("[inert]") || !el.getClientRects().length) continue;
    if (el instanceof HTMLInputElement && el.type === "radio" && el.name && !el.checked) {
      const group = root.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      if ([...group].some((r) => r.checked) || group[0] !== el) continue;
    }
    out.push(el);
  }
  return out;
}

/**
 * Tab and Shift+Tab go round inside `root` (a modal, a popover that took the keyboard): from its
 * last stop to its first and back, instead of on to the page behind it. With no stop in it, the
 * keyboard stays (on `root` itself when it can take it).
 */
export function keepTabInside(e: { shiftKey: boolean; preventDefault(): void }, root: HTMLElement) {
  const items = tabbables(root);
  const at = document.activeElement;
  if (!items.length) {
    e.preventDefault();
    root.focus({ preventScroll: true });
  } else if (e.shiftKey && (at === items[0] || at === root)) {
    e.preventDefault();
    items[items.length - 1].focus();
  } else if (!e.shiftKey && at === items[items.length - 1]) {
    e.preventDefault();
    items[0].focus();
  }
}

/** Can the keyboard go back to this element (still on the page, shown, enabled)? */
function canTakeFocus(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.isConnected && !(el as HTMLButtonElement).disabled && !el.closest("[inert]") && el.getClientRects().length > 0;
}

/**
 * The keyboard in a modal (Dialog, phone Sheet): it starts inside (on the panel, unless a field
 * there took it already), Tab and Shift+Tab go round inside instead of reaching the page behind,
 * and after closing it goes back to where it was before, usually the button that opened it. When
 * that is gone (a menu item, a deselected chart's button), `returnFocus` decides (the spreadsheet
 * passes its grid). A dialog that moved the keyboard on purpose while closing (into the formula
 * bar, say) keeps it there.
 */
export function useModalFocus(open: boolean, panel: RefObject<HTMLElement | null>, returnFocus?: () => void) {
  const opener = useRef<HTMLElement | null>(null);
  const fallback = useRef(returnFocus);
  useEffect(() => {
    fallback.current = returnFocus;
  });

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (!el) return;
    const at = document.activeElement;
    if (!el.contains(at)) {
      if (at instanceof HTMLElement && at !== document.body) opener.current ??= at;
      el.focus({ preventScroll: true });
    }
    return () => {
      const back = opener.current;
      opener.current = null;
      const now = document.activeElement;
      if (now && now !== document.body && !el.contains(now)) return;
      if (canTakeFocus(back)) back.focus({ preventScroll: true });
      else fallback.current?.();
    };
  }, [open, panel]);

  return {
    /** The element the keyboard came from, the first time it enters (fields that focus themselves on opening count too). */
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const from = e.relatedTarget;
      if (opener.current || !(from instanceof HTMLElement) || e.currentTarget.contains(from)) return;
      opener.current = from;
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const el = panel.current;
      // Keys from menus that open out of the dialog (other places on the page, same React tree) are theirs.
      if (e.key !== "Tab" || e.defaultPrevented || !el || !el.contains(e.target as Node)) return;
      keepTabInside(e, el);
    },
  };
}

export function Dialog({
  open,
  onClose,
  children,
  className,
  labelledBy,
  describedBy,
  role = "dialog",
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  /** The id of the text that says what the dialog is about (screen readers read it with the title). */
  describedBy?: string;
  /** "alertdialog" for a question about something that can't simply be taken back (deleting). */
  role?: "dialog" | "alertdialog";
  /** Where the keyboard goes after closing when the element that opened the dialog is gone. */
  returnFocus?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const focus = useModalFocus(open, panel, returnFocus);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-start justify-center overflow-y-auto px-4 pt-[12vh] max-sm:pt-3">
          <motion.div
            className="fixed inset-0 bg-[rgb(20_18_14/0.32)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            onFocus={focus.onFocus}
            onKeyDown={focus.onKeyDown}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
            className={cn("relative w-full max-w-md rounded-2xl border border-line bg-raised shadow-pop outline-none", className)}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
