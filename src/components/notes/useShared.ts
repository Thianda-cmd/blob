"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/components/share/Avatar";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member } from "@/lib/types";

/** Who owns a page shared with you, and what you may do there. */
export type ShareInfo = { owner: Person | null; role: AccessRole | null };

// One request per page and tab: names don't change while you work.
const cache = new Map<string, Promise<ShareInfo>>();

function load(pageId: string, me: string): Promise<ShareInfo> {
  let p = cache.get(pageId);
  if (!p) {
    p = Promise.resolve(createClient().rpc("member_profiles", { p_type: "page", p_target: pageId })).then(({ data }) => {
      const members = (data ?? []) as Member[];
      const owner = members.find((m) => m.role === "owner");
      return {
        owner: owner ? { user_id: owner.user_id, full_name: owner.full_name, avatar_url: owner.avatar_url } : null,
        role: members.find((m) => m.user_id === me)?.role ?? null,
      };
    });
    cache.set(pageId, p);
  }
  return p;
}

/** Forget what we know (after sharing changed). */
export const forgetShares = () => cache.clear();

/** Owner and your role for each of `pageIds` (pages shared with you), filled in as they load. */
export function useShareInfo(pageIds: string[], me: string): Record<string, ShareInfo> {
  const key = useMemo(() => [...new Set(pageIds)].sort().join(","), [pageIds]);
  const [info, setInfo] = useState<Record<string, ShareInfo>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    const ids = key.split(",");
    void Promise.all(ids.map(async (id) => [id, await load(id, me)] as const)).then((entries) => {
      if (live) setInfo(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, [key, me]);
  return info;
}
