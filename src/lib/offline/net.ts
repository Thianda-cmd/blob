"use client";

import { useSyncExternalStore } from "react";

// Whether Blob can reach its server. The browser's own `navigator.onLine` only knows about the
// network interface (it stays true on Wi-Fi without internet), so a failed request also counts as
// offline; then a light check (HEAD /icon.svg) runs with growing pauses until the server answers.

let online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
const listeners = new Set<() => void>();
let probing: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let started = false;

function set(next: boolean) {
  if (online === next) return;
  online = next;
  listeners.forEach((fn) => fn());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => void check());
  window.addEventListener("offline", () => {
    set(false);
    probe();
  });
  if (!online) probe();
}

/** One check: any answer from the server counts. */
async function check(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`/icon.svg?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    // The offline service worker answers 504 for things it can't fetch: still offline.
    const ok = res.status !== 504 && res.headers.get("x-blob-offline") !== "1";
    if (ok) reportOk();
    return ok;
  } catch {
    return false;
  }
}

function probe() {
  if (probing) return;
  const wait = [1000, 2000, 4000, 8000, 15000][Math.min(attempt, 4)];
  probing = setTimeout(async () => {
    probing = null;
    attempt++;
    if (!(await check())) probe();
  }, wait);
}

/** A request failed for lack of a connection: offline until a check gets through. */
export function reportNetworkError() {
  start();
  set(false);
  probe();
}

/** A request got through: online. */
export function reportOk() {
  attempt = 0;
  if (probing) {
    clearTimeout(probing);
    probing = null;
  }
  set(true);
}

export function isOnline() {
  start();
  return online;
}

export function onConnectivity(fn: () => void) {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Resolves when Blob is online again (right away if it is). */
export function whenOnline(): Promise<void> {
  if (isOnline()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = onConnectivity(() => {
      if (online) {
        off();
        resolve();
      }
    });
  });
}

/** Whether Blob can reach its server (true while rendering on the server and before hydration). */
export function useOnline(): boolean {
  return useSyncExternalStore(onConnectivity, isOnline, () => true);
}

/**
 * Whether an error from Supabase (or fetch) means "no connection" rather than "the server said
 * no". Supabase reports a failed fetch with status 0 and the browser's message, which differs per
 * engine ("Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource").
 */
export function isNetworkError(error: unknown, status?: number): boolean {
  if (status === 0) return true;
  if (status !== undefined && status >= 500) return true;
  const message = error instanceof Error ? error.message : typeof error === "object" && error ? String((error as { message?: unknown }).message ?? "") : String(error ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|timeout|aborted|offline/i.test(message);
}
