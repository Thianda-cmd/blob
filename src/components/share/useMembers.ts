"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccessRole, Member } from "@/lib/types";

export type ShareTarget = { type: "page" | "project"; id: string };

/** Owner first, then editors, then viewers, each by name. */
export function sortMembers<T extends Pick<Member, "role" | "full_name">>(list: T[]): T[] {
  const rank = { owner: 0, editor: 1, viewer: 2 } as const;
  return [...list].sort((a, b) => rank[a.role] - rank[b.role] || a.full_name.localeCompare(b.full_name));
}

/** Your role and everyone on a page or project (owner first). Pass what the server already loaded as `initial`. */
export async function loadMembers(target: ShareTarget): Promise<{ role: AccessRole | null; members: Member[] }> {
  const supabase = createClient();
  const [role, members] = await Promise.all([
    supabase.rpc(target.type === "page" ? "page_role" : "project_role", target.type === "page" ? { p_page: target.id } : { p_project: target.id }),
    supabase.rpc("member_profiles", { p_type: target.type, p_target: target.id }),
  ]);
  return { role: (role.data as AccessRole | null) ?? null, members: sortMembers((members.data ?? []) as Member[]) };
}

/**
 * Role and members of a page or project, loaded in the browser and reloadable after the share
 * dialog changed something. `initial` (from the server) skips the first request.
 */
export function useMembers(target: ShareTarget | null, initial?: { role: AccessRole | null; members: Member[] }) {
  const [state, setState] = useState<{ key: string; role: AccessRole | null; members: Member[] } | null>(
    initial && target ? { key: `${target.type}:${target.id}`, ...initial } : null,
  );
  const key = target ? `${target.type}:${target.id}` : null;
  const type = target?.type;
  const id = target?.id;

  const reload = useCallback(async () => {
    if (!type || !id) return;
    const next = await loadMembers({ type, id });
    setState({ key: `${type}:${id}`, ...next });
  }, [type, id]);

  const fresh = state?.key === key;
  useEffect(() => {
    if (!key || fresh) return;
    let live = true;
    void loadMembers({ type: type!, id: id! }).then((next) => {
      if (live) setState({ key, ...next });
    });
    return () => {
      live = false;
    };
  }, [key, fresh, type, id]);

  return { role: fresh ? state!.role : null, members: fresh ? state!.members : [], loaded: fresh, reload };
}
