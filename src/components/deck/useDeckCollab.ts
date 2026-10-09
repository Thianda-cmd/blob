"use client";

import { useCallback, useRef } from "react";
import { useLive, useTableChanges, type Peer } from "@/lib/live";
import { createClient } from "@/lib/supabase/client";
import type { Deck } from "@/lib/types";
import { mergeDeck, mergeTitle } from "./collab";
import { deckPlainText, normalizeDeck } from "./deck";

type Local = { deck: Deck; title: string };
type PageRow = { rev: number; content: unknown; title: string };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Saving and live updates for a presentation shared with others (`enabled`). `save` replaces the
 * editor's own save: it names the revision it builds on, and merges when someone else saved first.
 * Their saves arrive live and are merged into the screen through `applyRemote` (`dirty`: the merge
 * kept unsaved changes of ours, so the caller schedules a save of the result).
 */
export function useDeckCollab({
  pageId,
  enabled,
  rev,
  initial,
  getLocal,
  applyRemote,
  me,
}: {
  pageId: string;
  enabled: boolean;
  rev: number;
  initial: Local;
  getLocal: () => Local;
  applyRemote: (next: Local, dirty: boolean) => void;
  me: { user_id: string; name: string; avatar_url: string | null };
}): { save: () => Promise<boolean>; peers: Peer[]; focus: (slideId: string | null) => void } {
  const revRef = useRef(rev);
  const base = useRef<Local>(initial);
  const live = useLive(enabled ? `page:${pageId}` : null, me);

  const save = useCallback(async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const local = getLocal();
      const { data, error } = await createClient().rpc("save_deck", {
        p_page: pageId,
        p_rev: revRef.current,
        p_content: local.deck,
        p_title: local.title,
        p_plain: deckPlainText(local.deck),
      });
      if (error) return false;
      const result = data as { ok: boolean; reason?: string; rev?: number; content?: unknown; title?: string };
      if (result.ok) {
        revRef.current = result.rev ?? revRef.current + 1;
        base.current = local;
        return true;
      }
      if (result.reason !== "behind") return false;
      // Someone saved in between: take theirs as the new base and keep our changes on top.
      const theirs: Local = { deck: normalizeDeck(result.content), title: result.title ?? "" };
      const merged: Local = { deck: mergeDeck(base.current.deck, local.deck, theirs.deck), title: mergeTitle(base.current.title, local.title, theirs.title) };
      base.current = theirs;
      revRef.current = result.rev ?? revRef.current;
      applyRemote(merged, false);
    }
    return false;
  }, [pageId, getLocal, applyRemote]);

  // Their saves, live.
  useTableChanges<PageRow>("pages", enabled ? `id=eq.${pageId}` : null, (payload) => {
    if (payload.eventType !== "UPDATE") return;
    const row = payload.new as PageRow;
    if (typeof row.rev !== "number" || row.rev <= revRef.current) return;
    const theirs: Local = { deck: normalizeDeck(row.content), title: row.title ?? "" };
    const local = getLocal();
    const dirty = !same(local.deck, base.current.deck) || local.title !== base.current.title;
    const next = dirty
      ? { deck: mergeDeck(base.current.deck, local.deck, theirs.deck), title: mergeTitle(base.current.title, local.title, theirs.title) }
      : theirs;
    base.current = theirs;
    revRef.current = row.rev;
    applyRemote(next, dirty);
  });

  return { save, peers: live.peers, focus: live.focus };
}
