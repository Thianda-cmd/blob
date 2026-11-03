import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and while the page's server HTML is being hydrated, true after that.
 * For UI that only exists in the browser (portals into document.body, window-sized popovers):
 * rendering it from the first client render would not match the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
