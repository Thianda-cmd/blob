"use client";

import { useCallback, useSyncExternalStore } from "react";

// A small preference kept in this browser (the calendar's view, filters, side panel). Read
// through useSyncExternalStore, so the server render and hydration use the default and the
// stored value follows right after, without an effect.

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStored(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // Private mode: it just isn't remembered.
      }
      listeners.forEach((fn) => fn());
    },
    [key],
  );
  return [value, set];
}
