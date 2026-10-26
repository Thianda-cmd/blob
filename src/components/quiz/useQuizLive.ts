"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Keeping a device's view of a live game fresh. The server says on the game's channel
// ("quiz:<id>", only it may send there) that something changed; the device then asks for the
// state. It also asks now and then (more often while the channel is down) and right when a
// question opens or closes, so a lost message costs a second at most. `now` in every answer
// keeps the device's clock in step with the server's: countdowns end together everywhere.

type Base = { now: number; game: { id: string; phase: string; openAt: number | null; closeAt: number | null } };

export type Live<V> = {
  view: V | null;
  error: string | null;
  /** Ask for the state now. */
  refresh: () => void;
  /** Use a view an action already returned. */
  put: (v: V) => void;
  /** A server time as a time on this device's clock. */
  local: (serverMs: number) => number;
  connected: boolean;
};

export function useQuizLive<V extends Base>(load: () => Promise<V>, opts: { listenToAnswers?: boolean; enabled?: boolean } = {}): Live<V> {
  const { listenToAnswers = false, enabled = true } = opts;
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const offset = useRef<{ value: number; rtt: number } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const busy = useRef(false);
  const again = useRef(false);
  const latest = useRef<V | null>(null);

  const accept = useCallback((v: V, sent: number, received: number) => {
    const rtt = received - sent;
    const value = v.now - (sent + received) / 2;
    // The quickest round trip gives the best guess; drift slowly toward newer ones.
    const cur = offset.current;
    if (!cur || rtt <= cur.rtt * 1.5) offset.current = { value: cur && rtt > cur.rtt ? (cur.value * 3 + value) / 4 : value, rtt: Math.min(rtt, cur?.rtt ?? rtt) };
    latest.current = v;
    setView(v);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        const sent = Date.now();
        try {
          const v = await loadRef.current();
          accept(v, sent, Date.now());
        } catch (e) {
          setError(e instanceof Error ? e.message : "failed");
        }
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [accept]);

  const put = useCallback(
    (v: V) => {
      latest.current = v;
      setView(v);
    },
    [],
  );

  const local = useCallback((serverMs: number) => serverMs - (offset.current?.value ?? 0), []);

  // First load, and again when the tab comes back or the network returns.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onShow = () => document.visibilityState === "visible" && void refresh();
    window.addEventListener("online", onShow);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("online", onShow);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [enabled, refresh]);

  // The live channel.
  const gameId = view?.game.id ?? null;
  useEffect(() => {
    if (!enabled || !gameId) return;
    const supabase = createClient();
    let throttle: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase.channel(`quiz:${gameId}`, { config: { private: true } });
    ch.on("broadcast", { event: "sync" }, () => void refresh());
    if (listenToAnswers)
      ch.on("broadcast", { event: "answer" }, () => {
        if (throttle) return;
        throttle = setTimeout(() => {
          throttle = null;
          void refresh();
        }, 350);
      });
    ch.subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      if (throttle) clearTimeout(throttle);
      setConnected(false);
      void supabase.removeChannel(ch);
    };
  }, [enabled, gameId, listenToAnswers, refresh]);

  // Asking now and then: often while the channel is down or answers are coming in.
  const phase = view?.game.phase;
  useEffect(() => {
    if (!enabled || phase === "ended") return;
    const every = !connected ? 2000 : phase === "question" && listenToAnswers ? 2500 : 6000;
    const t = setInterval(() => void refresh(), every);
    return () => clearInterval(t);
  }, [enabled, connected, phase, listenToAnswers, refresh]);

  // Right when the answers open and just after the time is up.
  const openAt = view?.game.openAt ?? null;
  const closeAt = view?.game.closeAt ?? null;
  useEffect(() => {
    if (!enabled || phase !== "question") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (serverMs: number | null, extra: number) => {
      if (serverMs === null) return;
      const wait = local(serverMs) + extra - Date.now();
      if (wait > 0 && wait < 600_000) timers.push(setTimeout(() => void refresh(), wait));
    };
    at(openAt, 50);
    at(closeAt, 1500);
    return () => timers.forEach(clearTimeout);
  }, [enabled, phase, openAt, closeAt, local, refresh]);

  return { view, error, refresh: () => void refresh(), put, local, connected };
}
