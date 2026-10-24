"use client";

import { useSyncExternalStore } from "react";
import { blobApp, isPhoneApp } from "@/lib/native";
import { BASE_SIZE, clampSize } from "./formatting";

// How notes look on this device (the view menu): the text size, the width of the page, the text
// cursor and focus mode. Kept in this browser only: a phone and a big screen want different things.

export type NoteWidth = "normal" | "wide" | "full";
/** "bold": Blob's own thick cursor (caret.ts); "system": the browser's; "auto": bold in the desktop apps. */
export type CaretMode = "auto" | "bold" | "system";
export type ViewPrefs = { textSize: number; width: NoteWidth; caret: CaretMode; focus: boolean };

const KEY = "blob-note-view";
export const DEFAULT_VIEW: ViewPrefs = { textSize: BASE_SIZE, width: "normal", caret: "auto", focus: false };
const WIDTHS: NoteWidth[] = ["normal", "wide", "full"];
const CARETS: CaretMode[] = ["auto", "bold", "system"];

function parse(raw: string | null): ViewPrefs {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<ViewPrefs>) : {};
    return {
      textSize: typeof v.textSize === "number" ? clampSize(Math.min(28, Math.max(12, v.textSize))) : DEFAULT_VIEW.textSize,
      width: WIDTHS.includes(v.width as NoteWidth) ? (v.width as NoteWidth) : DEFAULT_VIEW.width,
      caret: CARETS.includes(v.caret as CaretMode) ? (v.caret as CaretMode) : DEFAULT_VIEW.caret,
      focus: v.focus === true,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

let current: ViewPrefs | null = null;
const listeners = new Set<() => void>();

function read(): ViewPrefs {
  if (current) return current;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  current = parse(raw);
  return current;
}

export const viewPrefs = {
  get: read,
  set(patch: Partial<ViewPrefs>) {
    current = { ...read(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {}
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    // Another tab changed them.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      current = parse(e.newValue);
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

export function useViewPrefs(): ViewPrefs {
  return useSyncExternalStore(viewPrefs.subscribe, read, () => DEFAULT_VIEW);
}

/** Whether notes draw Blob's own text cursor here (never with a finger: phones have their own handles). */
export function boldCaret(prefs: ViewPrefs = read()): boolean {
  if (typeof window === "undefined" || matchMedia("(pointer: coarse)").matches) return false;
  if (prefs.caret === "auto") {
    const app = blobApp();
    return !!app && !isPhoneApp(app);
  }
  return prefs.caret === "bold";
}
