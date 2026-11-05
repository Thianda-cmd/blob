"use client";

import {
  BadgeQuestionMark,
  CalendarDays,
  CloudOff,
  File as FileIcon,
  FileText,
  FileUser,
  GraduationCap,
  House,
  ListChecks,
  NotebookPen,
  Presentation,
  RefreshCw,
  Settings,
  Sheet as SheetIcon,
  Signature,
  SquareKanban,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { createElement, useEffect, useState } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { pageTitleClass } from "@/components/shell/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { card } from "@/components/ui/surfaces";
import { useMessages } from "@/i18n/client";
import { offlineText } from "@/i18n/messages/offline";
import { DEVICE_USER_KEY } from "@/lib/offline/device";
import { getAll } from "@/lib/offline/idb";
import type { NoteCopy } from "@/lib/offline/notes";
import { cn } from "@/lib/utils";

type Item = { href: string; title: string; at: number; kind?: string };

/** A copy's icon by its kind, as in the lists of the app. */
const KIND_ICON: Record<string, LucideIcon> = { sheet: SheetIcon, ink: Signature, deck: Presentation };

/** A kept page's icon by its address, as in the sidebar. */
const ROUTE_ICON: [string, LucideIcon][] = [
  ["/home", House],
  ["/notes", NotebookPen],
  ["/learn", GraduationCap],
  ["/tasks", ListChecks],
  ["/calendar", CalendarDays],
  ["/projects", SquareKanban],
  ["/cv", FileUser],
  ["/quiz", BadgeQuestionMark],
  ["/trash", Trash2],
  ["/settings", Settings],
];
const routeIcon = (href: string) => ROUTE_ICON.find(([p]) => href === p || href.startsWith(`${p}/`))?.[1] ?? FileIcon;

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
    // Only the notes of the account signed in on this device (none after signing out).
    const userId = localStorage.getItem(DEVICE_USER_KEY);
    if (userId) {
      const copies = await getAll<NoteCopy>(userId, "pages");
      for (const c of copies) notes.push({ href: `/p/${c.id}`, title: c.title, at: Date.parse(c.updated_at) || 0, kind: c.kind });
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
  const sheets = items?.notes.some((n) => n.kind === "sheet");
  return (
    // One column that may shrink below its content (minmax(0,1fr)): an auto track would grow to a long
    // nowrap title and push the page sideways on phones; the titles truncate instead.
    <main className="safe-top safe-x safe-bottom grid min-h-dvh grid-cols-[minmax(0,1fr)] place-items-center bg-paper">
      <div className="w-full max-w-[560px] px-5 py-12">
        <div className="flex flex-col items-center text-center">
          {/* Blob with a small "no connection" badge. */}
          <span className="relative">
            <BlobMark size={56} />
            <span className="absolute -bottom-1 -right-2 grid size-7 place-items-center rounded-full border border-line bg-raised text-ink-2 shadow-card" aria-hidden>
              <CloudOff className="size-3.5" />
            </span>
          </span>
          <h1 className={cn(pageTitleClass, "mt-5")}>{t.title}</h1>
          <p className="mt-2 max-w-[420px] text-pretty text-[14px] leading-relaxed text-ink-2">{t.body}</p>
          <button type="button" onClick={() => location.reload()} className={buttonClass("blob", "md", "mt-5")}>
            <RefreshCw className="size-4" /> {t.retry}
          </button>
        </div>

        {items && items.pages.length + items.notes.length === 0 && <p className="mt-10 text-center text-[13px] text-ink-2">{t.empty}</p>}

        {items && items.pages.length > 0 && (
          <List title={t.pagesHeading} className="mt-10" items={items.pages} icon={(p) => routeIcon(p.href)} untitled={untitled} />
        )}

        {items && items.notes.length > 0 && (
          <List
            title={sheets ? t.notesAndSheetsHeading : t.notesHeading}
            className="mt-8"
            items={items.notes}
            icon={(n) => KIND_ICON[n.kind ?? ""] ?? FileText}
            untitled={untitled}
          />
        )}
      </div>
    </main>
  );
}

function List({ title, items, icon, untitled, className }: { title: string; items: Item[]; icon: (item: Item) => LucideIcon; untitled: string; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-2 px-1 text-[12px] font-medium text-ink-2">{title}</h2>
      <ul className={cn(card, "overflow-hidden")}>
        {items.map((item) => {
          return (
            <li key={item.href} className="border-b border-line last:border-b-0">
              <a href={item.href} className="flex h-12 items-center gap-3 px-4 text-[14px] text-ink transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none">
                {createElement(icon(item), { className: "size-4 shrink-0 text-ink-3", "aria-hidden": true })}
                <span className="truncate">{item.title || untitled}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
