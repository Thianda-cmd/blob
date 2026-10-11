"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { isOnline, onConnectivity, reportNetworkError } from "@/lib/offline/net";

/** "device": no connection, but what was written is kept on this device until it can be saved. */
export type SaveState = "saved" | "pending" | "saving" | "error" | "device";

/**
 * Debounced, merge-friendly autosave. Call `schedule(patch)` on every change;
 * patches are merged and written after `delay` ms of quiet. Failed writes retry.
 * `onDevice`: the caller keeps unsaved changes on the device (notes), so being offline is calm.
 */
export function useAutosave<T extends object>(save: (patch: Partial<T>) => Promise<boolean>, delay = 700, opts: { onDevice?: boolean } = {}) {
  const onDevice = !!opts.onDevice;
  const t = useMessages(pageText);
  const [state, setState] = useState<SaveState>("saved");
  const pending = useRef<Partial<T> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveRef = useRef(save);
  // Blob's lines, kept current for the long-lived flush below.
  const textRef = useRef(t);
  const failed = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const retry = useRef<() => void>(() => {});
  /** Still on the page. A closed note's editor doesn't keep retrying: its text waits on the device. */
  const alive = useRef(true);

  useEffect(() => {
    saveRef.current = save;
    textRef.current = t;
  });

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    const patch = pending.current;
    if (!patch) return;
    pending.current = null;
    setState("saving");
    const run = (async () => {
      const ok = await saveRef.current(patch);
      if (!ok) {
        pending.current = { ...patch, ...(pending.current ?? {}) };
        // Closed: notes leave it to the background save of waiting notes (src/lib/offline/notes.ts),
        // which starts from what this device knows now, not from this editor's old state.
        if (!alive.current && onDevice) return;
        const offline = typeof navigator !== "undefined" && (navigator.onLine === false || !isOnline());
        if (offline) reportNetworkError();
        if (offline && onDevice) {
          // Kept on the device: it goes out as soon as the connection is back (or in a while).
          setState("device");
          failed.current = true;
          timer.current = setTimeout(() => retry.current(), 30_000);
          return;
        }
        setState("error");
        if (!failed.current) blob.say(textRef.current.cantReach, { mood: "worried" });
        failed.current = true;
        timer.current = setTimeout(() => retry.current(), 4000);
        return;
      }
      if (failed.current) {
        failed.current = false;
        if (!onDevice) blob.say(textRef.current.backOnline, { mood: "happy" });
      }
      setState(pending.current ? "pending" : "saved");
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, [onDevice]);

  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Back online: what's waiting goes now.
  useEffect(
    () =>
      onConnectivity(() => {
        if (isOnline() && pending.current && failed.current) retry.current();
      }),
    [],
  );

  /** Drops what's waiting (it was kept some other way). */
  const discard = useCallback(() => {
    clearTimeout(timer.current);
    pending.current = null;
    failed.current = false;
    setState("saved");
  }, []);

  const schedule = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...(pending.current ?? {}), ...patch };
      setState("pending");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current) return;
      void flush();
      // Notes keep unsaved text on the device: nothing is lost by leaving.
      if (!onDevice) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush, onDevice]);

  return { state, schedule, flush, discard };
}
