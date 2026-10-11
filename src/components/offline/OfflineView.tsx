"use client";

import { CloudOff, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { getAll } from "@/lib/offline/idb";
import type { NoteCopy } from "@/lib/offline/notes";

type Item = { href: string; title: string; at: number };

/** Pages the app keeps (public/sw.js), and the notes on this device (src/lib/offline/notes.ts). */
async function onDevice(): Promise<{ pages: Item[]; notes: Item[] }> {
  const pages: Item[] = [];
  const notes: Item[] = [];
  try {
    const meta = await caches.open("blob-meta-1");
    const index = (await (await meta.match("/__blob/pages"))?.json()) as Record<string, { title: string; at: number }> | undefined;
    for (const [path, v] of Object.entries(index ?? {})) {
      if (path.startsWith("/p/") || path === "/offline" || path.startsWith("/notes/offline")) continue;
      pages.push({ href: path, title: v.title, at: v.at });
    }
  } catch {
    // No caches here.
  }
  try {
    const dbs = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    const name = dbs.find((d) => d.name?.startsWith("blob:"))?.name;
    if (name) {
      const copies = await getAll<NoteCopy>(name.slice(5), "pages");
      for (const c of copies) notes.push({ href: `/p/${c.id}`, title: c.title, at: Date.parse(c.updated_at) || 0 });
    }
  } catch {
    // No device database.
  }
  return { pages: pages.sort((a, b) => a.title.localeCompare(b.title)), notes: notes.sort((a, b) => b.at - a.at) };
}

export function OfflineView() {
  const t = useMessages(offlineText).page;
  const [items, setItems] = useState<{ pages: Item[]; notes: Item[] } | null>(null);

  useEffect(() => {
    let alive = true;
    void onDevice().then((x) => alive && setItems(x));
    // Back online: straight back to where the student wanted to go.
    const back = () => location.reload();
    window.addEventListener("online", back);
    return () => {
      alive = false;
      window.removeEventListener("online", back);
    };
  }, []);

  const untitled = "…";
  return (
    <main className="min-h-dvh bg-paper px-5 pb-16 pt-[max(48px,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[560px]">
        <div className="flex flex-col items-center text-center">
          <BlobMark size={56} />
          <h1 className="mt-4 flex items-center gap-2 font-display text-[24px] font-bold tracking-[-0.02em] text-ink">
            <CloudOff className="size-5 text-ink-3" /> {t.title}
          </h1>
          <p className="mt-2 max-w-[420px] text-[14px] text-ink-2">{t.body}</p>
          <button
            type="button"
            onClick={() => location.reload()}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-[14px] font-medium text-paper active:scale-[0.97]"
          >
            <RefreshCw className="size-4" /> {t.retry}
          </button>
        </div>

        {items && items.pages.length + items.notes.length === 0 && <p className="mt-10 text-center text-[13px] text-ink-3">{t.empty}</p>}

        {items && items.pages.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-2 px-1 text-[12px] font-medium text-ink-3">{t.pagesHeading}</h2>
            <ul className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
              {items.pages.map((p) => (
                <li key={p.href} className="border-b border-line last:border-b-0">
                  <a href={p.href} className="flex h-12 items-center px-4 text-[14px] text-ink hover:bg-hover">
                    {p.title || untitled}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {items && items.notes.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 px-1 text-[12px] font-medium text-ink-3">{t.notesHeading}</h2>
            <ul className="overflow-hidden rounded-2xl border border-line bg-raised shadow-card">
              {items.notes.map((n) => (
                <li key={n.href} className="border-b border-line last:border-b-0">
                  <a href={n.href} className="flex h-12 items-center gap-3 px-4 text-[14px] text-ink hover:bg-hover">
                    <FileText className="size-4 shrink-0 text-ink-3" />
                    <span className="truncate">{n.title || untitled}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
