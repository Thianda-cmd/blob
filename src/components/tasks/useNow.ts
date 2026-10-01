"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, refreshed every 30s so "Today" rolls over at midnight.
 * Returns `null` while server rendering and hydrating: the server doesn't know the
 * user's time zone, so anything that depends on "today" renders after hydration.
 */
let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  current = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(tick, 30_000);
    // The clock may be stale if nobody was listening for a while.
    if (Date.now() - current > 30_000) queueMicrotask(tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
