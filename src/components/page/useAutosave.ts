"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blob } from "@/components/blob/bus";
import { useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";

export type SaveState = "saved" | "pending" | "saving" | "error";

/**
 * Debounced, merge-friendly autosave. Call `schedule(patch)` on every change;
 * patches are merged and written after `delay` ms of quiet. Failed writes retry.
 */
export function useAutosave<T extends object>(save: (patch: Partial<T>) => Promise<boolean>, delay = 700) {
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
        setState("error");
        if (!failed.current) blob.say(textRef.current.cantReach, { mood: "worried" });
        failed.current = true;
        timer.current = setTimeout(() => retry.current(), 4000);
        return;
      }
      if (failed.current) {
        failed.current = false;
        blob.say(textRef.current.backOnline, { mood: "happy" });
      }
      setState(pending.current ? "pending" : "saved");
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, []);

  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

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
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  return { state, schedule, flush };
}
