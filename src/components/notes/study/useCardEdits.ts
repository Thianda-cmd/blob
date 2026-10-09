"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Line } from "@/notes/doc";
import type { Card } from "@/notes/study/cards";
import { createClient } from "@/lib/supabase/client";

/** A card's own wording, as plain text lines. */
export type CardEdit = { front: string; back: string };

/** A change not yet saved with the account: new wording, or `null` for back to the note's version. */
type Unsent = Record<string, { edit: CardEdit | null; at: number }>;

// Wording used to live only in this browser (the first key). It moves into the account the first
// time the cards are opened; a change that can't be saved waits in the second key and goes next time.
const oldKey = (pageId: string) => `blob-card-edits:${pageId}`;
const unsentKey = (pageId: string) => `blob-card-edits-unsent:${pageId}`;

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: object | null) {
  try {
    if (value && Object.keys(value).length) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {}
}

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => [{ text: l }]);

/** Save one change: the wording, or remove it (back to the note's version). */
async function send(pageId: string, cardId: string, edit: CardEdit | null, at: number) {
  const supabase = createClient();
  const { error } = edit
    ? await supabase
        .from("card_edits")
        .upsert({ page_id: pageId, card_id: cardId, front: edit.front.slice(0, 4000), back: edit.back.slice(0, 4000), updated_at: new Date(at).toISOString() }, { onConflict: "user_id,page_id,card_id" })
    : await supabase.from("card_edits").delete().eq("page_id", pageId).eq("card_id", cardId);
  return !error;
}

/**
 * Cards you reworded, saved with your account (the note itself stays as you wrote it), so they
 * follow you to every device. The card id stays the same, so its spaced-repetition progress
 * carries on. Changes show at once; `failed` says one couldn't be saved (it is kept in this
 * browser and saved the next time the cards are opened).
 */
export function useCardEdits(pageId: string) {
  const [edits, setEdits] = useState<Record<string, CardEdit>>({});
  const [failed, setFailed] = useState(false);
  /** Changes made before the saved wording arrived: they win over it. */
  const early = useRef(new Map<string, CardEdit | null>());
  const loaded = useRef(false);
  /** One save at a time, in order, so a quick "save, then reset" ends as a reset. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const remember = useCallback(
    (cardId: string, edit: CardEdit | null, at: number) => {
      const unsent = readLocal<Unsent>(unsentKey(pageId)) ?? {};
      unsent[cardId] = { edit, at };
      writeLocal(unsentKey(pageId), unsent);
      setFailed(true);
    },
    [pageId],
  );

  /** Saved: drop the waiting copies that are not newer than what was just saved. */
  const forget = useCallback(
    (sent: [cardId: string, at: number][]) => {
      const unsent = readLocal<Unsent>(unsentKey(pageId));
      if (!unsent) return;
      for (const [id, at] of sent) if (unsent[id] && unsent[id].at <= at) delete unsent[id];
      writeLocal(unsentKey(pageId), unsent);
      if (!Object.keys(unsent).length) setFailed(false);
    },
    [pageId],
  );

  useEffect(() => {
    let live = true;
    loaded.current = false;
    early.current.clear();
    void (async () => {
      const { data, error } = await createClient().from("card_edits").select("card_id, front, back, updated_at").eq("page_id", pageId);
      if (!live) return;
      const rows = (data ?? []) as { card_id: string; front: string; back: string; updated_at: string }[];
      const saved = new Map(rows.map((r) => [r.card_id, r]));
      const next: Record<string, CardEdit> = Object.fromEntries(rows.map((r) => [r.card_id, { front: r.front, back: r.back }]));
      const old = readLocal<Record<string, CardEdit>>(oldKey(pageId)) ?? {};
      const unsent = readLocal<Unsent>(unsentKey(pageId)) ?? {};
      // Old browser-only wording counts where the account has none; an unsent change counts
      // unless the account has a newer one (saved on another device since).
      const todo: Unsent = {};
      for (const [id, edit] of Object.entries(old)) if (!saved.has(id) && !unsent[id]) todo[id] = { edit, at: Date.now() };
      for (const [id, u] of Object.entries(unsent)) {
        const row = saved.get(id);
        if (!row || Date.parse(row.updated_at) < u.at) todo[id] = u;
      }
      for (const [id, u] of Object.entries(todo)) {
        if (u.edit) next[id] = u.edit;
        else delete next[id];
      }
      for (const [id, edit] of early.current) {
        if (edit) next[id] = edit;
        else delete next[id];
      }
      loaded.current = true;
      setEdits(next);
      // Without the saved wording (offline), nothing is sent: it all stays here for next time.
      if (error) return;
      const sending = Object.entries(todo).filter(([id]) => !early.current.has(id));
      const results = await Promise.all(sending.map(([id, u]) => send(pageId, id, u.edit, u.at)));
      forget(sending.filter((_, i) => results[i]).map(([id, u]) => [id, u.at]));
      if (results.every(Boolean)) writeLocal(oldKey(pageId), null);
    })();
    return () => {
      live = false;
    };
  }, [pageId, forget]);

  const change = useCallback(
    (cardId: string, edit: CardEdit | null) => {
      setEdits((prev) => {
        const next = { ...prev };
        if (edit) next[cardId] = edit;
        else delete next[cardId];
        return next;
      });
      if (!loaded.current) early.current.set(cardId, edit);
      const at = Date.now();
      queue.current = queue.current.then(async () => {
        if (await send(pageId, cardId, edit, at)) forget([[cardId, at]]);
        else remember(cardId, edit, at);
      });
    },
    [pageId, remember, forget],
  );

  return useMemo(
    () => ({
      has: (id: string) => id in edits,
      set: (id: string, edit: CardEdit) => change(id, edit),
      reset: (id: string) => change(id, null),
      /** A change couldn't be saved with the account (it is kept in this browser for now). */
      failed,
      /** The cards with your wording where you changed it. */
      apply: (cards: Card[]): Card[] =>
        cards.map((c) => {
          const e = edits[c.id];
          if (!e) return c;
          const front = lines(e.front);
          const back = lines(e.back);
          return { ...c, front: front.length ? front : c.front, back: back.length ? back : c.back, source: c.source === "cloze" ? "definition" : c.source };
        }),
    }),
    [edits, failed, change],
  );
}

export type CardEdits = ReturnType<typeof useCardEdits>;
