"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Whether a media query matches. The server (and the first render) assume `serverValue`. */
export function useMediaQuery(query: string, serverValue = true) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

const never = () => () => {};

/** Apple keyboards say ⌘ where others say Ctrl. */
export function useIsMac() {
  return useSyncExternalStore(
    never,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}
