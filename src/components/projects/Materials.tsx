"use client";

import { ExternalLink, FilePlus2, FileText, Globe, Lock, Paperclip } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { blob } from "@/components/blob/bus";
import { PageIcon } from "@/components/shell/Sidebar";
import { Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { projectLinksText } from "@/i18n/messages/projectLinks";
import { projectsText } from "@/i18n/messages/projects";
import type { Attachment, Task } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { addPageToProject } from "./links";
import type { useBoard } from "./useBoard";

type Row = { attachment: Attachment; cards: Pick<Task, "id" | "title">[] };

/** Everything attached to the cards, once each (a page on two cards is one row naming both). */
function materials(cards: Task[]) {
  const rows = new Map<string, Row>();
  for (const card of cards) {
    for (const a of card.attachments) {
      const key = a.type === "page" ? `page:${a.page_id}` : a.type === "file" ? `file:${a.path}` : `link:${a.url}`;
      const row = rows.get(key) ?? { attachment: a, cards: [] };
      if (!row.cards.some((c) => c.id === card.id)) row.cards.push({ id: card.id, title: card.title });
      rows.set(key, row);
    }
  }
  const all = [...rows.values()];
  return {
    pages: all.filter((r) => r.attachment.type === "page"),
    files: all.filter((r) => r.attachment.type === "file"),
    links: all.filter((r) => r.attachment.type === "link"),
  };
}

/**
 * The project's materials: the notes, presentations, files and links on its cards in one list,
 * each with the card it is on (a click opens the card). Editors can start a shared note, which
 * gets its own card and is shared with everyone in the project.
 */
export function MaterialsButton({ board, readOnly, onOpenCard }: { board: ReturnType<typeof useBoard>; readOnly: boolean; onOpenCard: (id: string) => void }) {
  const t = useMessages(projectLinksText);
  const tp = useMessages(projectsText);
  const locale = useLocale();
  const router = useRouter();
  const { pages, userId, createPage } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const { project, members } = board;
  const groups = materials(board.cards);
  const count = groups.pages.length + groups.files.length + groups.links.length;

  async function newNote(close: () => void) {
    if (busy) return;
    setBusy(true);
    const projectName = project.title.trim() || tp.untitled;
    const page = await createPage({ kind: "note", subject_id: project.subject_id, title: t.noteTitle(projectName) });
    const card = page && (await addPageToProject(page, { id: project.id, members }, { title: t.noteCard, share: true, me: userId }));
    setBusy(false);
    if (!page || !card) return void blob.say(t.failed, { mood: "worried" });
    close();
    blob.say(members.some((m) => m.user_id !== userId) ? t.noteMade : t.noteMadeAlone, { mood: "happy" });
    router.push(`/p/${page.id}`);
  }

  const cardsLine = (row: Row, close: () => void) => (
    <span className="flex min-w-0 flex-wrap gap-x-1 text-[11.5px] text-ink-3">
      {row.cards.map((card, i) => (
        <button
          key={card.id}
          type="button"
          onClick={() => {
            close();
            onOpenCard(card.id);
          }}
          className="relative z-10 max-w-full truncate rounded hover:text-ink hover:underline"
        >
          {t.onCard(card.title)}
          {i < row.cards.length - 1 && ","}
        </button>
      ))}
    </span>
  );

  return (
    <Popover
      align="end"
      className="w-[340px] max-w-[calc(100vw-16px)]"
      role="dialog"
      label={t.materialsTitle}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-ink-2 hover:bg-hover hover:text-ink aria-expanded:bg-hover aria-expanded:text-ink pointer-coarse:py-1.5"
        >
          <Paperclip className="size-3.5" />
          {t.materials}
          {count > 0 && <span className="rounded-full bg-hover px-1.5 text-[11px] font-medium leading-[18px] tabular-nums text-ink-3">{count}</span>}
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          <div className="px-1.5 pb-2 pt-1 text-[12.5px] font-semibold text-ink">{t.materialsTitle}</div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void newNote(close)}
              disabled={busy}
              className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line-2 px-2.5 py-2 text-left transition-colors hover:border-blob/50 hover:bg-blob-soft/50 disabled:opacity-60"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blob-soft text-blob-ink">
                <FilePlus2 className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{t.newNote}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{t.newNoteHint}</span>
              </span>
            </button>
          )}
          {count === 0 ? (
            <p className="px-1.5 pb-1.5 text-[12.5px] leading-snug text-ink-3">{t.materialsEmpty}</p>
          ) : (
            <div className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto pb-1">
              {groups.pages.length > 0 && (
                <Group title={t.groups.pages}>
                  {groups.pages.map((row) => {
                    const a = row.attachment as Extract<Attachment, { type: "page" }>;
                    const page = pages.find((p) => p.id === a.page_id);
                    const name = page ? pageTitle(page.title, page.kind, locale) : pageTitle(a.title, a.kind, locale);
                    return (
                      <Item key={a.page_id} icon={page ? <PageIcon page={page} className="size-4" /> : <Lock className="size-3.5 text-ink-3" />}>
                        {page ? (
                          <Link href={`/p/${page.id}`} onClick={close} className="block truncate text-[13px] font-medium text-ink after:absolute after:inset-0 hover:underline">
                            {name}
                          </Link>
                        ) : (
                          <span className="block truncate text-[13px] text-ink-3" title={t.noAccess}>
                            {name} · {t.noAccess}
                          </span>
                        )}
                        {cardsLine(row, close)}
                      </Item>
                    );
                  })}
                </Group>
              )}
              {groups.files.length > 0 && (
                <Group title={t.groups.files}>
                  {groups.files.map((row) => {
                    const a = row.attachment as Extract<Attachment, { type: "file" }>;
                    return (
                      <Item key={a.path} icon={<FileText className="size-4 text-ink-3" />}>
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            onOpenCard(row.cards[0].id);
                          }}
                          className="block w-full truncate text-left text-[13px] font-medium text-ink after:absolute after:inset-0 hover:underline"
                        >
                          {a.name}
                        </button>
                        {cardsLine(row, close)}
                      </Item>
                    );
                  })}
                </Group>
              )}
              {groups.links.length > 0 && (
                <Group title={t.groups.links}>
                  {groups.links.map((row) => {
                    const a = row.attachment as Extract<Attachment, { type: "link" }>;
                    let host = a.url;
                    try {
                      host = new URL(a.url).hostname.replace(/^www\./, "");
                    } catch {}
                    return (
                      <Item key={a.url} icon={<Globe className="size-4 text-ink-3" />}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex items-center gap-1 truncate text-[13px] font-medium text-ink after:absolute after:inset-0 hover:underline"
                        >
                          <span className="truncate">{a.title || host}</span>
                          <ExternalLink className="size-3 shrink-0 text-ink-3" />
                        </a>
                        {cardsLine(row, close)}
                      </Item>
                    );
                  })}
                </Group>
              )}
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">{title}</h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function Item({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className={cn("relative flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover/70")}>
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-hover/80">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
