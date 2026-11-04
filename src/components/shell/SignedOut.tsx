"use client";

import { CloudOff } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useMessages } from "@/i18n/client";
import { signedOutText } from "@/i18n/messages/signedOut";
import { whenOnline } from "@/lib/offline/net";

// Signed out without a connection (Sidebar.tsx, signOut): the sign-in page can't load yet, and
// going there would only show the browser's own "no internet" page. A screen like Blob's offline
// page takes the app's place instead, until Blob is online again and opens the sign-in page.
// Nothing of the account stays open behind it (its pages and editors, the sidebar, the search), so
// going back or a shortcut can't show it again or write it back to this device.

let signedOut = false;
const listeners = new Set<() => void>();

/** This tab is signed out: the app makes way for the screen, and the sign-in page opens once Blob is online again. */
export function showSignedOut() {
  if (signedOut) return;
  signedOut = true;
  listeners.forEach((fn) => fn());
  void whenOnline().then(() => window.location.replace("/login"));
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** The account's app, or the signed-out screen in its place. */
export function SignedOutGate({ children }: { children: ReactNode }) {
  const out = useSyncExternalStore(subscribe, () => signedOut, () => false);
  return out ? <SignedOut /> : children;
}

function SignedOut() {
  const t = useMessages(signedOutText);
  const ref = useRef<HTMLDivElement>(null);
  // (What had the focus is gone with the app: a screen reader reads this out instead.)
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signed-out-title"
      aria-describedby="signed-out-body"
      tabIndex={-1}
      className="fixed inset-0 z-[200] grid place-items-center bg-paper px-5 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] outline-none"
    >
      <div className="flex max-w-[420px] flex-col items-center text-center">
        <BlobMark size={56} />
        <h1 id="signed-out-title" className="mt-4 flex items-center gap-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
          <CloudOff className="size-5 text-ink-3" /> {t.title}
        </h1>
        <p id="signed-out-body" className="mt-2 text-[14px] text-ink-2">
          {t.body}
        </p>
      </div>
    </div>
  );
}
