"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab inside an open dialog (the page behind it is out of reach) and gives the focus back to
 * whatever opened it once it closes. `ref` is any element inside the dialog.
 */
export function useTrapFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The dialog's content is on the page by now (it opens in the same render).
    const box = ref.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !ref.current) return;
      const dialog = ref.current.closest<HTMLElement>('[role="dialog"]') ?? ref.current;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.matches(":disabled") && el.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Back to the button that opened it (unless that button is gone, like "Draw" once there is a
      // signature). The dialog is still fading out here, perhaps with the focus inside.
      const dialog = box?.closest('[role="dialog"]');
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || dialog?.contains(active))) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
