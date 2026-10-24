"use client";

import { useSyncExternalStore } from "react";

function subscribe(fn: () => void) {
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** Whether Blob is in dark mode right now (follows the theme switch while open). */
export function useDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
}

/** A theme colour as the browser resolved it ("#6d3df5"), for libraries that need real colours. */
export function themeColor(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Where theme colours come from: the page as it is (themeColor), or the light theme (withLightTheme). */
export type ColorSource = (name: string, fallback: string) => string;

/**
 * The light theme's colour variables, as globals.css sets them on :root (dark mode overrides them),
 * with Tailwind's tokens built on them (":root, :host" inside @layer theme).
 */
function lightVariables(): [string, string][] {
  const out: [string, string][] = [];
  const read = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSLayerBlockRule) read(rule.cssRules);
      else if (rule instanceof CSSStyleRule && rule.selectorText.split(",").some((s) => s.trim() === ":root")) {
        for (const name of rule.style) if (name.startsWith("--")) out.push([name, rule.style.getPropertyValue(name)]);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      read(sheet.cssRules);
    } catch {}
  }
  return out;
}

/**
 * Runs `fn` with the light theme's colours, whatever the page shows: for files that end up on white
 * paper (the Word export). `host` is an element off screen with the light colours, for copies of
 * the page's drawings to take their styles from; it goes when `fn` is done. The page itself keeps
 * its theme (switching it would flicker).
 */
export async function withLightTheme<T>(fn: (scope: { color: ColorSource; host: HTMLElement }) => Promise<T>): Promise<T> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-20000px;top:0;pointer-events:none;color-scheme:light;";
  for (const [name, value] of lightVariables()) host.style.setProperty(name, value);
  document.body.appendChild(host);
  const color: ColorSource = (name, fallback) => getComputedStyle(host).getPropertyValue(name).trim() || fallback;
  try {
    return await fn({ color, host });
  } finally {
    host.remove();
  }
}
