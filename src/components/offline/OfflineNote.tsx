"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { TopBar } from "@/components/shell/TopBar";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { noteCopy, type NoteCopy } from "@/lib/offline/notes";
import { useOnline } from "@/lib/offline/net";
import type { AccessRole, Page } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A note opened from this device's copy (src/lib/offline/notes.ts), for when the note's own page
 * can't load. Your own notes edit like the note itself: what you write is kept on the device and
 * saved once the connection is back, without replacing what another device saved meanwhile.
 * Shared notes are only read here.
 */
export function OfflineNote() {
  const all = useMessages(offlineText);
  const t = all.page;
  const notes = all.notes;
  const { userId } = useWorkspace();
  const online = useOnline();
  const [copy, setCopy] = useState<NoteCopy | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    // (From the address itself: this page may come from the app's cache, made for another note.)
    const id = new URLSearchParams(location.search).get("id") ?? "";
    if (!UUID.test(id)) {
      queueMicrotask(() => alive && setCopy(null));
      return;
    }
    void noteCopy(userId, id).then((c) => alive && setCopy(c));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (copy === undefined) return <TopBar crumbs={[{ label: "…" }]} />;
  if (!copy) {
    return (
      <>
        <TopBar crumbs={[{ label: t.noteTitle }]} />
        <div className="grid flex-1 place-items-center px-6 text-center">
          <div>
            <CloudOff className="mx-auto size-8 text-ink-3" />
            <p className="mt-3 text-[14px] text-ink-2">{t.noteMissing}</p>
            <Link href="/offline" className="mt-4 inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-blob-ink hover:bg-blob-soft">
              {t.notesHeading}
            </Link>
          </div>
        </div>
      </>
    );
  }

  const page: Page = { ...copy, content: copy.content, plain_text: copy.plain_text ?? "", links: copy.links ?? [] } as Page;
  // Your own notes edit as usual. Shared notes (or ones not yet known to be unshared) only read:
  // their edits go through working together, which needs the connection.
  const shared = copy.shared !== false || copy.user_id !== userId;
  const role: AccessRole = shared ? "viewer" : "owner";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-blob-soft/60 px-4 py-2 text-[12.5px] text-blob-ink" role="status">
        <CloudOff className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{shared ? notes.sharedOffline : t.fromDevice}</span>
        {online && (
          <Link href={`/p/${copy.id}`} className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium hover:bg-blob-soft">
            <RefreshCw className="size-3.5" /> {t.openLatest}
          </Link>
        )}
      </div>
      <NoteEditor key={copy.id} page={page} role={role} members={[]} />
    </>
  );
}
