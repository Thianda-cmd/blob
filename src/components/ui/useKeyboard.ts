"use client";

import { useSyncExternalStore } from "react";

// The on-screen keyboard on phones and tablets: whether it is open and how much of the screen it
// covers, from the visual viewport (the part of the page you can see above the keyboard).

type Keyboard = { open: boolean; height: number };

const closed: Keyboard = { open: false, height: 0 };
let current = closed;
const listeners = new Set<() => void>();
let watching = false;

function read(): Keyboard {
  const vv = window.visualViewport;
  const typing = document.activeElement instanceof HTMLElement && document.activeElement.matches("input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select, [contenteditable=true], [contenteditable='']");
  if (!vv || !typing) return closed;
  // What the keyboard takes from the layout viewport (iOS). Android shrinks the layout viewport
  // itself, so there it's about zero while the keyboard is up.
  const height = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
  // A small difference is the browser's own bar, not a keyboard.
  return height > 120 || touch ? { open: true, height: height > 120 ? height : 0 } : closed;
}

function update() {
  const next = read();
  if (next.open === current.open && next.height === current.height) return;
  current = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!watching && typeof window !== "undefined") {
    watching = true;
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("focusin", () => setTimeout(update, 50));
    window.addEventListener("focusout", () => setTimeout(update, 50));
  }
  return () => {
    listeners.delete(fn);
  };
}

export function useKeyboard(): Keyboard {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => closed,
  );
}
