"use client";

// Short messages of the spreadsheet editor: why a tool did nothing ("Markiere zuerst die Zahlen
// fürs Diagramm…"), what an action did ("In deinen Downloads gespeichert", "Nicht übernommen: …")
// and what went wrong ("Alte .xls-Dateien kann ich nicht lesen…"). They answer what the student
// just did, so they show at the bottom of the editor whether or not Blob's tips are switched on
// (Blob's speech bubble stays away on spreadsheets: the status bar lives in its corner). One
// message at a time; a new one replaces the last. Kept per editor store outside React, so plain
// actions (the toolbar, keyboard shortcuts, menus) can post them.
//
// CONTRACT: showSheetNotice(store, text, tone?, { ms, action }?) from anywhere that has the editor's
// store; SheetEditor renders <SheetNotices store={store} /> (SheetNotice.tsx) once.

import { useSyncExternalStore } from "react";
import type { SheetStore } from "./store";

/**
 * info: a hint or what happened (polite); done: something worked (polite, with a tick); busy: work
 * in progress, until the result replaces it ("Deine Datei wird gelesen…"); error: something failed
 * (announced at once, role=alert).
 */
export type SheetNoticeTone = "info" | "done" | "busy" | "error";

/** A button in the notice that undoes a guess in one click ("Als 1,234 lesen"). */
export type SheetNoticeAction = { label: string; run: () => void };

export type SheetNotice = { id: number; text: string; tone: SheetNoticeTone; action?: SheetNoticeAction };

type Slot = {
  notice: SheetNotice | null;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  /** How long the notice stays (ms). */
  ms: number;
  /**
   * The notice the pointer or the keyboard is on (its id): it doesn't count down meanwhile. Kept
   * per notice: a newer one that replaces it under a resting pointer counts down as usual.
   */
  held: number | null;
};

const slots = new WeakMap<SheetStore, Slot>();
let nextId = 1;

function slot(store: SheetStore): Slot {
  let s = slots.get(store);
  if (!s) slots.set(store, (s = { notice: null, listeners: new Set(), timer: null, ms: 0, held: null }));
  return s;
}

function emit(s: Slot) {
  for (const l of [...s.listeners]) l();
}

/**
 * How long a notice stays: long enough to read it once at a slow pace (70 ms a character, about
 * 14 characters a second), at least a few seconds, longer for problems; resting the pointer on it
 * keeps it for as long as needed. Work in progress stays until its result replaces it (with a
 * limit, in case the result never comes).
 */
export function noticeDuration(text: string, tone: SheetNoticeTone): number {
  if (tone === "busy") return 30_000;
  const min = tone === "error" ? 7000 : tone === "done" ? 4000 : 5500;
  return Math.min(16_000, Math.max(min, text.length * 70));
}

function arm(store: SheetStore, s: Slot) {
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  const id = s.notice?.id;
  if (id === undefined || s.held === id) return;
  s.timer = setTimeout(() => hideSheetNotice(store, id), s.ms);
}

/** Show a message at the bottom of the editor (it replaces the one showing). Returns its id. */
export function showSheetNotice(store: SheetStore, text: string, tone: SheetNoticeTone = "info", opts: { ms?: number; action?: SheetNoticeAction } = {}): number {
  const s = slot(store);
  const notice: SheetNotice = opts.action ? { id: nextId++, text, tone, action: opts.action } : { id: nextId++, text, tone };
  s.notice = notice;
  s.ms = opts.ms ?? noticeDuration(text, tone);
  arm(store, s);
  emit(s);
  return notice.id;
}

/** Hide the notice (only the one with this id, when given: a newer one stays). */
export function hideSheetNotice(store: SheetStore, id?: number) {
  const s = slot(store);
  if (!s.notice || (id !== undefined && s.notice.id !== id)) return;
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  s.notice = null;
  s.held = null;
  emit(s);
}

/**
 * While the pointer rests on the notice with this id or the keyboard is in it, it stays;
 * afterwards it counts down afresh. (A card on its way out lets go of nothing but itself.)
 */
export function holdSheetNotice(store: SheetStore, id: number, held: boolean) {
  const s = slot(store);
  if (held) {
    if (s.notice?.id !== id || s.held === id) return;
    s.held = id;
  } else {
    if (s.held !== id) return;
    s.held = null;
    if (s.notice?.id !== id) return;
  }
  arm(store, s);
}

/** The notice showing right now (F6 in the editor goes to its button; checks and tests). */
export function currentSheetNotice(store: SheetStore): SheetNotice | null {
  return slots.get(store)?.notice ?? null;
}

/** Whether the notice showing is counting down to go (not held), for checks and tests. */
export function sheetNoticeCountsDown(store: SheetStore): boolean {
  return !!slots.get(store)?.timer;
}

/** One subscribe function per store (a new one every render would resubscribe every render). */
const subscribers = new WeakMap<SheetStore, (listener: () => void) => () => void>();

function subscribe(store: SheetStore) {
  let f = subscribers.get(store);
  if (!f) {
    f = (listener: () => void) => {
      const s = slot(store);
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
      };
    };
    subscribers.set(store, f);
  }
  return f;
}

export function useSheetNotice(store: SheetStore): SheetNotice | null {
  return useSyncExternalStore(
    subscribe(store),
    () => slot(store).notice,
    () => null,
  );
}
