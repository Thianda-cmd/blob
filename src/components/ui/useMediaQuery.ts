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

/** A phone-sized screen (sheets instead of popovers). False on the server. */
export const usePhone = () => useMediaQuery("(max-width: 639px)", false);

/** A touch screen without a mouse (bigger targets, hold-to-drag). False on the server. */
export const useTouch = () => useMediaQuery("(hover: none) and (pointer: coarse)", false);

const never = () => () => {};

/** Apple keyboards say ⌘ where others say Ctrl. */
export function useIsMac() {
  return useSyncExternalStore(
    never,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}
