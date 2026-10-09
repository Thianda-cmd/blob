"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Line } from "@/notes/doc";
import type { Card } from "@/notes/study/cards";

/** A card's own wording, as plain text lines. */
export type CardEdit = { front: string; back: string };

const key = (pageId: string) => `blob-card-edits:${pageId}`;
const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => [{ text: l }]);

/**
 * Cards you reworded, kept in this browser (the note itself stays as you wrote it). The card id stays
 * the same, so its spaced-repetition progress carries on.
 */
export function useCardEdits(pageId: string) {
  const [edits, setEdits] = useState<Record<string, CardEdit>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(pageId));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved wording after mount
      if (raw) setEdits(JSON.parse(raw) as Record<string, CardEdit>);
    } catch {}
  }, [pageId]);

  const write = useCallback(
    (next: Record<string, CardEdit>) => {
      setEdits(next);
      try {
        if (Object.keys(next).length) localStorage.setItem(key(pageId), JSON.stringify(next));
        else localStorage.removeItem(key(pageId));
      } catch {}
    },
    [pageId],
  );

  return useMemo(
    () => ({
      has: (id: string) => id in edits,
      set: (id: string, edit: CardEdit) => write({ ...edits, [id]: edit }),
      reset: (id: string) => {
        const next = { ...edits };
        delete next[id];
        write(next);
      },
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
    [edits, write],
  );
}

export type CardEdits = ReturnType<typeof useCardEdits>;
