"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Live channels for working together. Topics are "page:<id>" and "project:<id>"; they are private
// channels, so only the page's or project's members can join (policies on realtime.messages,
// migration 0010). Presence says who is here and what they look at; broadcast carries quick
// messages that don't need saving (cursor positions, "Lena is typing").

/** Someone with the page or project open. `focus` is what they work on (a slide id, a card id). */
export type Peer = { key: string; user_id: string; name: string; avatar_url: string | null; color: string; focus: string | null };

/** Calm colours for people's cursors and avatars, picked by user id so everyone sees the same one. */
const PEER_COLORS = ["#6d3df5", "#2f6f6a", "#c4653e", "#3f78b3", "#c05475", "#5d8a4c", "#b48e38", "#8a5a9c"];
export const peerColor = (userId: string) => {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
};

/** A per-tab id, so two tabs of the same person count as two (and see each other's edits). */
export const tabId = (() => {
  let id: string | null = null;
  return () => (id ??= crypto.randomUUID().slice(0, 12));
})();

type Me = { user_id: string; name: string; avatar_url: string | null };

/**
 * Join a live channel: who else is here (`peers`, without this tab), `focus` to tell them what you
 * work on, `send` for broadcasts and `listen` to receive them. `topic` null stays offline.
 */
export function useLive(topic: string | null, me: Me) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const channel = useRef<RealtimeChannel | null>(null);
  const focusRef = useRef<string | null>(null);
  const listeners = useRef(new Map<string, Set<(payload: unknown, from: string) => void>>());
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  });

  useEffect(() => {
    if (!topic) return;
    const supabase = createClient();
    const key = tabId();
    const ch = supabase.channel(topic, { config: { private: true, presence: { key }, broadcast: { self: false } } });
    channel.current = ch;
    const track = () => {
      const m = meRef.current;
      return ch.track({ user_id: m.user_id, name: m.name, avatar_url: m.avatar_url, color: peerColor(m.user_id), focus: focusRef.current });
    };
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<Omit<Peer, "key">>();
      const list: Peer[] = [];
      for (const [k, metas] of Object.entries(state)) {
        if (k === key || !metas[0]) continue;
        const { user_id, name, avatar_url, color, focus } = metas[0];
        list.push({ key: k, user_id, name, avatar_url, color, focus: focus ?? null });
      }
      setPeers(list);
    });
    ch.on("broadcast", { event: "*" }, ({ event, payload }) => {
      const msg = payload as { from?: string; data?: unknown };
      listeners.current.get(event)?.forEach((fn) => fn(msg?.data, msg?.from ?? ""));
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") void track();
    });
    return () => {
      channel.current = null;
      setPeers([]);
      void supabase.removeChannel(ch);
    };
  }, [topic]);

  return useMemo(
    () => ({
      peers,
      /** Tell the others what you work on now (null: nothing in particular). */
      focus(next: string | null) {
        if (focusRef.current === next) return;
        focusRef.current = next;
        const ch = channel.current;
        const m = meRef.current;
        if (ch) void ch.track({ user_id: m.user_id, name: m.name, avatar_url: m.avatar_url, color: peerColor(m.user_id), focus: next });
      },
      /** A quick message to everyone else on the channel (not saved). */
      send(event: string, data: unknown) {
        void channel.current?.send({ type: "broadcast", event, payload: { from: tabId(), data } });
      },
      /** Receive `event` broadcasts; returns the unsubscribe function. */
      listen(event: string, fn: (data: unknown, from: string) => void) {
        const set = listeners.current.get(event) ?? new Set();
        set.add(fn);
        listeners.current.set(event, set);
        return () => set.delete(fn);
      },
    }),
    [peers],
  );
}

/**
 * Database changes on one table, filtered (e.g. `project_id=eq.<id>`), as Supabase Realtime sends
 * them. Row level security applies: you only hear about rows you may read. `filter` null is off.
 */
export function useTableChanges<T extends Record<string, unknown>>(
  table: string,
  filter: string | null,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
) {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });
  useEffect(() => {
    if (!filter) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`db:${table}:${filter}:${tabId()}`)
      .on("postgres_changes" as never, { event: "*", schema: "public", table, filter }, (payload: RealtimePostgresChangesPayload<T>) => handler.current(payload))
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [table, filter]);
}
