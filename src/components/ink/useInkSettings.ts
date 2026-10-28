"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/ink/engine";
import { isColor, isPenTool, type InkColor, type PenTool } from "@/ink/model";
import { PENS } from "@/ink/pens";

// The pens, colours and eraser this device last used (handwriting is personal: kept per device).

const KEY = "blob-ink-settings";
const RECENT_KEY = "blob-ink-colours";
const LAST_PEN_KEY = "blob-ink-last-pen";

function read(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
    const pens = { ...DEFAULT_SETTINGS.pens };
    for (const tool of Object.keys(pens) as PenTool[]) {
      const p = raw.pens?.[tool];
      if (p && isColor(p.color) && typeof p.size === "number") pens[tool] = { color: p.color, size: Math.min(PENS[tool].max, Math.max(PENS[tool].min, p.size)) };
    }
    const tool = raw.tool && (isPenTool(raw.tool) || ["eraser", "lasso", "text"].includes(raw.tool)) ? raw.tool : DEFAULT_SETTINGS.tool;
    const e = raw.eraser;
    return {
      // Text and the lasso are for a moment: a note opens with a pen.
      tool: tool === "text" || tool === "lasso" ? lastPen() : tool,
      pens,
      eraser: {
        mode: e?.mode === "area" ? "area" : "stroke",
        size: typeof e?.size === "number" ? Math.min(60, Math.max(4, e.size)) : DEFAULT_SETTINGS.eraser.size,
        highlighterOnly: !!e?.highlighterOnly,
      },
      fingers: raw.fingers === "draw" || raw.fingers === "pan" ? raw.fingers : "auto",
      text: {
        size: typeof raw.text?.size === "number" ? Math.min(80, Math.max(12, raw.text.size)) : DEFAULT_SETTINGS.text.size,
        color: isColor(raw.text?.color) ? raw.text.color : DEFAULT_SETTINGS.text.color,
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function lastPen(): PenTool {
  try {
    const v = localStorage.getItem(LAST_PEN_KEY);
    return isPenTool(v) && v !== "highlighter" ? v : "pen";
  } catch {
    return "pen";
  }
}

export function useInkSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [recent, setRecent] = useState<InkColor[]>([]);
  // After hydration: the device's own (the server can't know them).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore this device's pens after mount
    setSettings(read());
    try {
      const r = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      if (Array.isArray(r)) setRecent(r.filter(isColor).slice(0, 8));
    } catch {
      // Nothing kept.
    }
  }, []);

  const update = useCallback((fn: (s: Settings) => Settings) => {
    setSettings((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        if (isPenTool(next.tool) && next.tool !== "highlighter") localStorage.setItem(LAST_PEN_KEY, next.tool);
      } catch {
        // Private window: kept for this visit.
      }
      return next;
    });
  }, []);

  /** A colour picked from the custom picker: remembered among the recent ones. */
  const remember = useCallback((color: InkColor) => {
    setRecent((prev) => {
      const next = [color, ...prev.filter((c) => c !== color)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Kept for this visit.
      }
      return next;
    });
  }, []);

  return { settings, update, recent, remember, lastPen };
}
