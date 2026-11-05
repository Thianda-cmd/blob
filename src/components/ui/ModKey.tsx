"use client";

import { useLocale } from "@/i18n/client";
import { Kbd } from "./Kbd";
import { useIsMac } from "./useMediaQuery";

/** The key for shortcuts with Ctrl: ⌘ on Apple keyboards, "Strg" on German ones, "Ctrl" otherwise. */
export function useModKey() {
  const mac = useIsMac();
  const locale = useLocale();
  return mac ? "⌘" : locale === "de" ? "Strg" : "Ctrl";
}

/** A shortcut with the platform's Ctrl key as key caps: <ModKey k="K" /> → "Strg K" or "⌘ K". */
export function ModKey({ k, className }: { k: string; className?: string }) {
  const mod = useModKey();
  return (
    <span className={className}>
      <Kbd>{mod}</Kbd> <Kbd>{k}</Kbd>
    </span>
  );
}
