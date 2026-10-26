"use client";

import { useEffect } from "react";

/** Keeps the screen on while `active` (a beamer or a phone going dark mid-question is no fun). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (gone) void lock.release();
      } catch {}
    };
    void take();
    // The browser lets go when the tab is hidden; take it again when it's back.
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
