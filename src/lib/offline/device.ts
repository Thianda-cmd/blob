"use client";

import { noteCache } from "@/components/editor/noteCache";
import { DRAFT_PREFIX, discardOpenSheets, draftPages, flushOpenSheets, forgetOtherAccounts, unsavedSheets } from "@/components/sheet/drafts";
import type { Locale } from "@/i18n/config";
import { blobApp, setOfflineReady } from "@/lib/native";
import { clearNotifications, NOTIFY_EXTRA_KEY } from "@/lib/notify/scheduler";
import { publishWidget } from "@/lib/widget/publish";
import { createClient } from "@/lib/supabase/client";
import { getAll, wipeAllDbs } from "./idb";
import { flushWaitingNotes, settleOwed } from "./notes";
import { flushReviews } from "./reviews";
import { isOnline } from "./net";
import { flushAllSyncs, stopAllSyncs } from "./sync";

// The app's offline helper (public/sw.js): registered inside the Blob apps only. In a browser the
// site works online as before (a shared computer shouldn't keep someone's pages after they leave).

const WARM_KEY = "blob-warm-at";
/** Whose data this device keeps (the offline page lists only that account's notes). */
export const DEVICE_USER_KEY = "blob-device-user";
const WARM_EVERY = 6 * 3600e3;
/** Reworded flashcards that couldn't be saved yet (src/components/notes/study/useCardEdits.ts; the key doesn't name the account). */
const CARD_EDITS_UNSENT = "blob-card-edits-unsent:";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/**
 * Someone is signed in here (browser and app): what another account left on this device goes (it
 * signed out elsewhere, its session ended without signing out on a shared computer, or it was
 * deleted): its databases, its unsaved spreadsheets and reworded flashcards. Inside the app this also
 * installs the offline helper and tells it whose pages it keeps.
 */
export async function registerOffline(userId: string) {
  let before: string | null = null;
  try {
    before = localStorage.getItem(DEVICE_USER_KEY);
    localStorage.setItem(DEVICE_USER_KEY, userId);
  } catch {}
  if (before !== userId) await wipeAllDbs(userId);
  // (Spreadsheet drafts name their account: any other's go. Flashcard wording doesn't: only when
  // this device was known to be someone else's.)
  forgetOtherAccounts(userId);
  if (before && before !== userId) removeKeys((key) => key.startsWith(CARD_EDITS_UNSENT));
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

function removeKeys(match: (key: string) => boolean) {
  try {
    for (const key of Object.keys(localStorage)) if (match(key)) localStorage.removeItem(key);
  } catch {}
}

/** Flashcards reworded on this device whose wording couldn't be saved yet. */
function unsentCardEdits(): number {
  let n = 0;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(CARD_EDITS_UNSENT) && Object.keys(JSON.parse(localStorage.getItem(key) ?? "{}") ?? {}).length) n++;
  } catch {}
  return n;
}

/** Flashcards reworded on this device whose wording couldn't be saved yet: sent now (that code loads only when there are some). */
async function flushCardWording() {
  if (!unsentCardEdits()) return;
  const { flushCardEdits } = await import("@/components/notes/study/useCardEdits");
  await flushCardEdits();
}

/** Spreadsheets kept on this device whose editor is closed: sent now (the saving code loads only when there are some). */
async function flushWaitingSheets(userId: string, locale: Locale) {
  if (!(await draftPages(userId)).length) return;
  const { flushSheetDrafts } = await import("@/components/sheet/flushDrafts");
  await flushSheetDrafts(userId, locale);
}

/**
 * Before signing out: what's still waiting on this device goes to the server first (while it can):
 * calendar and task changes, note text and spreadsheets (open editors and closed ones), edits to
 * shared notes, flashcard answers and reworded flashcards. How many are still waiting afterwards
 * (signing out would delete them).
 */
export async function flushDevice(words: { copyTitle: (t: string) => string; conflict: (t: string) => string }, locale: Locale): Promise<number> {
  const { data } = await createClient().auth.getSession();
  const userId = data.session?.user.id;
  await Promise.race([Promise.all([noteCache.flushOpen(), flushOpenSheets()]), wait(5000)]);
  const outbox = await flushAllSyncs(5000);
  if (!userId) return outbox;
  if (isOnline()) {
    const rest = (async () => {
      await Promise.all([settleOwed(userId, words), flushReviews(userId)]);
      await Promise.all([flushWaitingNotes(userId, words, () => {}), flushWaitingSheets(userId, locale).catch(() => {}), flushCardWording().catch(() => {})]);
    })();
    await Promise.race([rest, wait(8000)]);
  }
  const kept = (await getAll<{ id: string }>(userId, "notes")).filter((r) => r.id.startsWith("owed:") || r.id.startsWith("review:")).length;
  return outbox + noteCache.unsavedCount() + kept + (await unsavedSheets(userId)) + unsentCardEdits();
}

/** Signing out: nothing of the account stays on this device (pages, data, the app's start offline). */
export async function forgetDevice() {
  stopAllSyncs();
  noteCache.reset();
  // Open spreadsheets stop here and in the other tabs: closing them later would write their draft
  // again after the wipe.
  discardOpenSheets();
  await Promise.all([ask({ type: "wipe" }, 10_000), wipeAllDbs(), setOfflineReady(false), clearNotifications(), publishWidget(null)]);
  // (Unsaved spreadsheet work and flashcard wording too: they were counted before, useSignOutGuard.)
  removeKeys(
    (key) =>
      key === WARM_KEY ||
      key.startsWith("blob-card-reviews") ||
      key.startsWith(CARD_EDITS_UNSENT) ||
      key.startsWith(DRAFT_PREFIX) ||
      key === NOTIFY_EXTRA_KEY ||
      key === DEVICE_USER_KEY,
  );
}

/**
 * The app finds itself signed out without having signed out here (signed out everywhere from
 * another device, or the account was deleted): what shows the account outside the app goes (its
 * widgets, reminders, cached pages, starting offline). Its unsent changes stay in its own database
 * in case it signs in again here; another account signing in removes them (registerOffline).
 */
export async function forgetSignedOut() {
  if (!blobApp()) return;
  stopAllSyncs();
  noteCache.reset();
  await Promise.all([ask({ type: "wipe" }, 10_000), setOfflineReady(false), clearNotifications(), publishWidget(null)]);
  removeKeys((key) => key === WARM_KEY || key === NOTIFY_EXTRA_KEY || key === DEVICE_USER_KEY);
}
