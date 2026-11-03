"use client";

// What the panel says about a smart table that was just made: whether its first row became the
// header, with a one-tap correction while nothing else has changed. Kept per editor store outside
// React, so the actions (plain functions the toolbar and keyboard call) can set it. (Messages such
// as "Diese Zellen gehören schon zu einer intelligenten Tabelle" go through ../notice.ts.)

import { useSyncExternalStore } from "react";
import type { Area, Workbook } from "@/sheet/types";
import type { SheetStore, Selection } from "../store";

/** A table made a moment ago, and how to make it again with the other header choice. */
export type FreshTable = {
  tableId: string;
  header: "found" | "added";
  sheetId: string;
  /** What was asked to become the table, and the selection then. */
  area: Area;
  selection: Selection;
  /** The workbook before and right after: the correction only applies while nothing else changed. */
  before: Workbook;
  after: Workbook;
};

type Slot = { fresh: FreshTable | null; listeners: Set<() => void> };

const slots = new WeakMap<SheetStore, Slot>();

function slot(store: SheetStore): Slot {
  let s = slots.get(store);
  if (!s) slots.set(store, (s = { fresh: null, listeners: new Set() }));
  return s;
}

function emit(s: Slot) {
  for (const l of [...s.listeners]) l();
}

export function setFreshTable(store: SheetStore, fresh: FreshTable | null) {
  const s = slot(store);
  if (s.fresh === fresh) return;
  s.fresh = fresh;
  emit(s);
}

/** The table made a moment ago, while the workbook is still exactly as it left it. */
export function freshTable(store: SheetStore, tableId?: string): FreshTable | null {
  const f = slot(store).fresh;
  if (!f || (tableId !== undefined && f.tableId !== tableId) || store.get().workbook !== f.after) return null;
  return f;
}

/** One subscribe function per store (a new one every render would resubscribe every render). */
const subscribers = new WeakMap<SheetStore, (listener: () => void) => () => void>();

function subscribe(store: SheetStore) {
  let f = subscribers.get(store);
  if (!f) {
    f = (listener: () => void) => {
      const s = slot(store);
      s.listeners.add(listener);
      const off = store.subscribe(listener);
      return () => {
        s.listeners.delete(listener);
        off();
      };
    };
    subscribers.set(store, f);
  }
  return f;
}

/** The fresh-table info for this table (re-renders when it goes stale). */
export function useFreshTable(store: SheetStore, tableId: string): FreshTable | null {
  return useSyncExternalStore(
    subscribe(store),
    () => freshTable(store, tableId),
    () => null,
  );
}
