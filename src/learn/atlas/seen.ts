"use client";

import { useSyncExternalStore } from "react";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";

/**
 * Which structures, steps and milestones a student has opened in the Atlas, per model, kept on
 * this device: `"<view>/<item>"` keys. (Quiz results and "explored everything" are saved to the
 * account through learn_record; this only draws the little ticks.)
 */
type Store = Record<string, string[]>;

const PREFIX = "blob-atlas-seen";
const EMPTY: string[] = [];
const caches = new Map<string, Store>();
const listeners = new Set<() => void>();

const keyOf = (userId: string) => `${PREFIX}:${userId}`;

function read(key: string): Store {
  let store = caches.get(key);
  if (!store) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "{}");
      store = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Store) : {};
    } catch {
      store = {};
    }
    caches.set(key, store);
  }
  return store;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Another tab explored something: read it again.
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) {
      caches.delete(e.key);
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Marks an item as seen. Returns true when it is new. */
export function markSeen(userId: string, slug: string, item: string) {
  const key = keyOf(userId);
  const store = read(key);
  const list = store[slug] ?? EMPTY;
  if (list.includes(item)) return false;
  const next = { ...store, [slug]: [...list, item] };
  caches.set(key, next);
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Private mode or full storage: the ticks last until the page closes.
  }
  listeners.forEach((l) => l());
  return true;
}

/** The items of a model the student has seen (empty on the server and while hydrating). */
export function useSeen(slug: string): string[] {
  const { userId } = useWorkspace();
  return useSyncExternalStore(
    subscribe,
    () => read(keyOf(userId))[slug] ?? EMPTY,
    () => EMPTY,
  );
}

/** Everything seen, per model. */
export function useAllSeen(): Store {
  const { userId } = useWorkspace();
  return useSyncExternalStore(
    subscribe,
    () => read(keyOf(userId)),
    () => EMPTY_STORE,
  );
}

const EMPTY_STORE: Store = {};
