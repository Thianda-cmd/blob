"use client";

import { noteCache } from "@/components/editor/noteCache";
import { blobApp, setOfflineReady } from "@/lib/native";
import { clearNotifications } from "@/lib/notify/scheduler";
import { wipeAllDbs } from "./idb";
import { isOnline } from "./net";
import { flushAllSyncs, stopAllSyncs } from "./sync";

// The app's offline helper (public/sw.js): registered inside the Blob apps only. In a browser the
// site works online as before (a shared computer shouldn't keep someone's pages after they leave).

const WARM_KEY = "blob-warm-at";
const WARM_EVERY = 6 * 3600e3;

/** Messages the worker and waits for its answer (null when there is no worker or no answer). */
async function ask<T>(message: Record<string, unknown>, ms = 60_000): Promise<T | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const worker = reg?.active ?? navigator.serviceWorker.controller;
  if (!worker) return null;
  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), ms);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data as T);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

/** Inside the app: installs the offline helper and tells it whose pages it keeps. */
export async function registerOffline(userId: string) {
  if (!blobApp() || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    await ask({ type: "user", id: userId }, 10_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the main pages and the most recent notes in the background, so they open offline later.
 * Now and then only (every few hours), and only with a connection.
 */
export async function warmOffline(paths: string[], opts: { force?: boolean } = {}) {
  if (!blobApp() || !isOnline()) return;
  let last = 0;
  try {
    last = Number(localStorage.getItem(WARM_KEY) ?? 0);
  } catch {}
  if (!opts.force && Date.now() - last < WARM_EVERY) return;
  const done = await ask<number>({ type: "warm", urls: paths }, 180_000);
  if (done === null) return;
  try {
    localStorage.setItem(WARM_KEY, String(Date.now()));
  } catch {}
  if (done > 0) await setOfflineReady(true);
}

/** Before signing out: what's still waiting on this device goes to the server first (while it can). */
export function flushDevice() {
  return flushAllSyncs(5000);
}

/** Signing out: nothing of the account stays on this device (pages, data, the app's start offline). */
export async function forgetDevice() {
  stopAllSyncs();
  noteCache.reset();
  await Promise.all([ask({ type: "wipe" }, 10_000), wipeAllDbs(), setOfflineReady(false), clearNotifications()]);
  try {
    for (const key of Object.keys(localStorage)) if (key === WARM_KEY || key.startsWith("blob-card-reviews")) localStorage.removeItem(key);
  } catch {}
}
