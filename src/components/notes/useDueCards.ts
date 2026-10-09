"use client";

import { useEffect, useState } from "react";
import { useNow } from "@/components/tasks/useNow";
import { SUSPENDED, today } from "@/notes/study/srs";
import { createClient } from "@/lib/supabase/client";

/**
 * How many of your flashcards from this note are due today (for a badge next to "Lernen").
 * `null` while loading or when there are none to repeat. Cards you never studied don't count:
 * "due" means "learned before and time to repeat".
 */
export function useDueCards(pageId: string): number | null {
  const now = useNow();
  const day = now ? today(new Date(now)) : null;
  const [due, setDue] = useState<{ key: string; n: number } | null>(null);
  const key = day ? `${pageId}:${day}` : null;

  useEffect(() => {
    if (!key || !day) return;
    let live = true;
    void createClient()
      .from("card_reviews")
      .select("card_id", { count: "exact", head: true })
      .eq("page_id", pageId)
      .gt("reviews", 0)
      .lte("due_on", day)
      .lt("due_on", SUSPENDED)
      .then(({ count }) => {
        if (live) setDue({ key, n: count ?? 0 });
      });
    return () => {
      live = false;
    };
  }, [key, day, pageId]);

  return due && due.key === key && due.n > 0 ? due.n : null;
}
