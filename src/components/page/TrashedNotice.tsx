"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { createClient } from "@/lib/supabase/client";
import { PAGE_META_COLUMNS, type Page, type PageMeta } from "@/lib/types";
import { pageTitle } from "@/lib/utils";

export function TrashedNotice({ page }: { page: Page }) {
  const t = useMessages(pageText);
  const locale = useLocale();
  const title = pageTitle(page.title, page.kind, locale);
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
    if (error) return blob.say(t.restoreFailed, { mood: "worried" });
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
      <TopBar crumbs={[{ label: t.trash, href: "/trash" }, { label: title }]} />
      <div className="grid flex-1 place-items-center">
        <div className="flex flex-col items-center text-center">
          <Blob size={120} mood="worried" />
          <h1 className="mt-2 max-w-[min(560px,calc(100vw-32px))] text-balance px-4 font-display text-[22px] font-semibold">{t.inTrash(title)}</h1>
          <p className="mt-1 px-4 text-[13.5px] text-ink-2">{t.restoreHint}</p>
          <Button variant="primary" className="mt-5" onClick={restore} loading={loading}>
            <RotateCcw className="size-4" /> {t.restore}
          </Button>
        </div>
      </div>
    </>
  );
}
