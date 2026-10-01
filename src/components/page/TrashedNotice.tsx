"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { PAGE_META_COLUMNS, type Page, type PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

export function TrashedNotice({ page }: { page: Page }) {
  const router = useRouter();
  const { pages, upsertPages } = useWorkspace();
  const [loading, setLoading] = useState(false);

  async function restore() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pages")
      .update({ trashed_at: null })
      .eq("trashed_at", page.trashed_at!)
      .select(PAGE_META_COLUMNS);
    setLoading(false);
    if (error) return blob.say("Couldn't restore it. Try again?", { mood: "worried" });
    const restored = (data ?? []) as PageMeta[];
    // If the parent is still in the trash, bring the page back at the top level.
    const parentGone = page.parent_id && !pages.some((p) => p.id === page.parent_id) && !restored.some((p) => p.id === page.parent_id);
    if (parentGone) {
      await supabase.from("pages").update({ parent_id: null }).eq("id", page.id);
      restored.forEach((p) => p.id === page.id && (p.parent_id = null));
    }
    upsertPages(restored);
    blob.react("jump", "happy");
    router.refresh();
  }

  return (
    <>
      <TopBar crumbs={[{ label: "Trash", href: "/trash" }, { label: pageTitle(page.title, page.kind) }]} />
      <div className="grid flex-1 place-items-center">
        <div className="flex flex-col items-center text-center">
          <Blob size={120} mood="worried" />
          <h1 className="mt-2 font-display text-[22px] font-semibold">“{pageTitle(page.title, page.kind)}” is in the trash</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">Restore it to keep working on it.</p>
          <Button variant="primary" className="mt-5" onClick={restore} loading={loading}>
            <RotateCcw className="size-4" /> Restore
          </Button>
        </div>
      </div>
    </>
  );
}
