"use client";

// Short messages from smart tables ("Diese Zellen gehören schon zu einer Tabelle") and what the
// panel says about a table that was just made: whether its first row became the header, with a
// one-tap correction while nothing else has changed. Kept per editor store outside React, so the
// actions (plain functions the toolbar and keyboard call) can post them.

import { useSyncExternalStore } from "react";
import type { Area, Workbook } from "@/sheet/types";
import type { SheetStore, Selection } from "../store";

export type TableNotice = { id: number; text: string; tone: "info" | "error" };

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

type Slot = { notice: TableNotice | null; fresh: FreshTable | null; listeners: Set<() => void>; timer: ReturnType<typeof setTimeout> | null };

const slots = new WeakMap<SheetStore, Slot>();
let nextId = 1;

function slot(store: SheetStore): Slot {
  let s = slots.get(store);
  if (!s) slots.set(store, (s = { notice: null, fresh: null, listeners: new Set(), timer: null }));
  return s;
}

function emit(s: Slot) {
  for (const l of [...s.listeners]) l();
}

/** Show a short message at the bottom of the editor for a few seconds. */
export function showTableNotice(store: SheetStore, text: string, tone: TableNotice["tone"] = "info") {
  const s = slot(store);
  const notice = { id: nextId++, text, tone };
  s.notice = notice;
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => hideTableNotice(store, notice.id), tone === "error" ? 6000 : 4500);
  emit(s);
}

export function hideTableNotice(store: SheetStore, id?: number) {
  const s = slot(store);
  if (!s.notice || (id !== undefined && s.notice.id !== id)) return;
  s.notice = null;
  emit(s);
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

export function useTableNotice(store: SheetStore): TableNotice | null {
  return useSyncExternalStore(
    subscribe(store),
    () => slot(store).notice,
    () => null,
  );
}

/** The fresh-table info for this table (re-renders when it goes stale). */
export function useFreshTable(store: SheetStore, tableId: string): FreshTable | null {
  return useSyncExternalStore(
    subscribe(store),
    () => freshTable(store, tableId),
    () => null,
  );
}
