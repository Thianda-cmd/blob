"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicLink } from "@/lib/publicLink";
import { createClient } from "@/lib/supabase/client";

/**
 * A page's public link (migration 0019), for its owner and editors (others never see one):
 * undefined while loading, null when there is none. The owner creates, changes and removes it;
 * each returns whether it worked.
 */
export function usePublicLink(pageId: string | null) {
  const [state, setState] = useState<{ page: string; link: PublicLink | null } | null>(null);

  const reload = useCallback(async () => {
    if (!pageId) return;
    const { data } = await createClient().from("public_links").select("*").eq("page_id", pageId).maybeSingle();
    setState({ page: pageId, link: (data as PublicLink | null) ?? null });
  }, [pageId]);

  useEffect(() => {
    if (!pageId) return;
    let alive = true;
    void createClient()
      .from("public_links")
      .select("*")
      .eq("page_id", pageId)
      .maybeSingle()
      .then(({ data }) => alive && setState({ page: pageId, link: (data as PublicLink | null) ?? null }));
    return () => {
      alive = false;
    };
  }, [pageId]);

  const create = useCallback(async () => {
    if (!pageId) return false;
    const { data, error } = await createClient().from("public_links").insert({ page_id: pageId }).select("*").single();
    if (error || !data) return false;
    setState({ page: pageId, link: data as PublicLink });
    return true;
  }, [pageId]);

  const setSubPages = useCallback(
    async (sub_pages: boolean) => {
      if (!pageId) return false;
      const { data, error } = await createClient().from("public_links").update({ sub_pages }).eq("page_id", pageId).select("*").maybeSingle();
      if (error || !data) return false;
      setState({ page: pageId, link: data as PublicLink });
      return true;
    },
    [pageId],
  );

  const remove = useCallback(async () => {
    if (!pageId) return false;
    const { error } = await createClient().from("public_links").delete().eq("page_id", pageId);
    if (error) return false;
    setState({ page: pageId, link: null });
    return true;
  }, [pageId]);

  const link = state && state.page === pageId ? state.link : undefined;
  return { link, reload, create, setSubPages, remove };
}
