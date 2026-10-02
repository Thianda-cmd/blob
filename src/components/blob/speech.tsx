"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Types `text` out character by character. `typing` is true until it's done,
 * which is when Blob's mouth should be moving. With reduced motion the text shows at once,
 * but only after mount, so the server and the hydrating render agree.
 */
export function useTypewriter(text: string | null | undefined, charsPerSecond = 42) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);
  const instant = mounted && Boolean(reduce);
  const [state, setState] = useState({ text: text ?? "", count: 0 });

  // Restart whenever the text changes (derived-state reset during render).
  if ((text ?? "") !== state.text) setState({ text: text ?? "", count: 0 });

  useEffect(() => {
    if (!text || reduce) return;
    // Time-based, so a busy main thread skips ahead instead of slowing the speech down.
    const start = performance.now();
    const timer = setInterval(() => {
      const count = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * charsPerSecond));
      setState((s) => (s.text === text && s.count !== count ? { text, count } : s));
      if (count >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text, reduce, charsPerSecond]);

  const full = text ?? "";
  const count = instant ? full.length : state.text === full ? state.count : 0;
  return { shown: full.slice(0, count), typing: count < full.length };
}

/** Renders the typed part of `text` while reserving the full size, so bubbles don't jump. */
export function TypedText({ text, shown }: { text: string; shown: string }) {
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0" aria-hidden>
        {shown}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
