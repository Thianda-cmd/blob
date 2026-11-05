"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/client";
import { landingText } from "@/i18n/messages/landing";
import { cn } from "@/lib/utils";

/**
 * Where a demo stands. `poster`: the finished picture the server painted, not played yet (a visitor
 * who lands right on it, e.g. through /#sheets). `waiting`: wound back to the start until it scrolls
 * into view. `playing`, `paused`, and `done`: played once, holding its last frame.
 */
export type DemoMode = "poster" | "waiting" | "playing" | "paused" | "done";

/** What DemoControl needs: the mode, the one button's action, and whether there's anything to control. */
export type DemoPlayer = { mode: DemoMode; toggle: () => void; ready: boolean; still: boolean };

/**
 * A landing demo that plays its frames once when it scrolls into view, then holds the finished
 * picture (WCAG 2.2.2: nothing moves on for long without a way to stop it). DemoControl, next to the
 * demo, pauses it while it plays and plays it again afterwards. Off screen the timer waits.
 *
 * `durations`: how long each frame shows. `poster`: the frame the server paints (the finished
 * picture, also without JavaScript and with reduced motion); a demo that is off screen when the page
 * starts winds back to frame 0 right away, so it plays from the beginning however the visitor gets
 * there (scrolling, or a jump to its section from a link). `end`: the frame it stops on.
 * `still` (reduced motion): it never plays; the demo shows its still frame and no control.
 */
export function useDemoPlayer<E extends Element = HTMLDivElement>(
  durations: readonly number[],
  { poster = 0, end = durations.length - 1, still }: { poster?: number; end?: number; still: boolean },
) {
  const ref = useRef<E>(null);
  const visible = useInView(ref, { amount: 0.35 });
  const [state, setState] = useState<{ i: number; round: number; mode: DemoMode }>({ i: poster, round: 0, mode: poster > 0 ? "poster" : "waiting" });
  const [ready, setReady] = useState(false);

  // Once, at the start: is the demo on screen? If not, its poster winds back to the beginning (a new
  // round, so what was drawn goes); if it is, the visitor keeps the finished picture they're looking at.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      observer.disconnect();
      setReady(true);
      if (!entry.isIntersecting) setState((s) => (s.mode === "poster" ? { i: 0, round: s.round + 1, mode: "waiting" } : s));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Wound back and now in view: play (derived state, set while rendering).
  if (visible && state.mode === "waiting" && ready && !still) setState({ ...state, mode: "playing" });

  /** Moving right now (in view, playing, motion allowed). */
  const live = visible && !still && state.mode === "playing";
  const ms = durations[state.i];
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => setState((s) => (s.i + 1 >= end ? { ...s, i: end, mode: "done" } : { ...s, i: s.i + 1 })), ms);
    return () => clearTimeout(timer);
  }, [live, ms, end, state.i]);

  const toggle = () =>
    setState((s) =>
      s.mode === "playing"
        ? { ...s, mode: "paused" }
        : s.mode === "paused" || s.mode === "waiting"
          ? { ...s, mode: "playing" }
          : { i: 0, round: s.round + 1, mode: "playing" },
    );

  const player: DemoPlayer = { mode: state.mode, toggle, ready, still };
  return { ref, i: state.i, round: state.round, live, player };
}

/**
 * The one small button under a demo: "Anhalten" while it plays, "Weiter" when paused, "Nochmal
 * abspielen" when it's done ("Abspielen" before it ever played). Icon only on phones (the words stay
 * for screen readers, with the demo's name: "Anhalten: Blobxcel"). Hidden with reduced motion (nothing
 * moves) and until the page runs (without JavaScript it would do nothing); its room stays either way.
 */
export function DemoControl({ player, name, className }: { player: DemoPlayer; name: string; className?: string }) {
  const t = useMessages(landingText).player;
  const { mode, toggle, ready, still } = player;
  const [Icon, label] =
    mode === "playing" ? [Pause, t.pause] : mode === "paused" ? [Play, t.resume] : mode === "done" ? [RotateCcw, t.replay] : [Play, t.play];
  const off = !ready || still;
  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-raised px-3 text-[12.5px] font-medium text-ink-2 shadow-card transition-colors hover:border-line-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper max-sm:size-9 max-sm:px-0 [@media(hover:none)]:h-9",
        off && "invisible",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="max-sm:sr-only">{label}</span>
      <span className="sr-only">: {name}</span>
    </button>
  );
}
