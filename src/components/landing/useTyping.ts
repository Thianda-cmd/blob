"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Types `text` out like `useTypewriter`, but reduced motion (show it all at once) only kicks in
 * after hydration, so the server and the first client render agree.
 */
export function useTyping(text: string, charsPerSecond = 42) {
  const reduce = useReducedMotion();
  const [state, setState] = useState({ text, count: 0 });

  // Restart whenever the text changes (derived-state reset during render).
  if (text !== state.text) setState({ text, count: 0 });

  useEffect(() => {
    if (!text) return;
    if (reduce) {
      const timer = setTimeout(() => setState({ text, count: text.length }), 0);
      return () => clearTimeout(timer);
    }
    // Time-based, so a busy main thread skips ahead instead of slowing the speech down.
    const start = performance.now();
    const timer = setInterval(() => {
      const count = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * charsPerSecond));
      setState((s) => (s.text === text && s.count !== count ? { text, count } : s));
      if (count >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text, reduce, charsPerSecond]);

  const count = state.text === text ? state.count : 0;
  return { shown: text.slice(0, count), typing: count < text.length };
}

/** Reduced motion as state that turns on after mount (safe to branch on while rendering). */
export function useReducedAfterMount() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  return mounted && Boolean(reduce);
}
