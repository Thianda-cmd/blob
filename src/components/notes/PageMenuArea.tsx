"use client";

import { ExternalLink, FilePlus2, Link2, Star, StarOff, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { ContextMenu, useContextMenu, useLastPointer, wantsOwnMenu } from "@/components/ui/ContextMenu";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useMessages } from "@/i18n/client";
import { notesText } from "@/i18n/messages/notes";

/**
 * Right-click on any page inside (an element with data-page-id) opens Blob's page menu: open, open in
 * a new tab, favourite, a new note inside, copy the link, move to the trash. Renders no box of its
 * own (display: contents), so it can wrap a list without changing its layout.
 */
export function PageMenuArea({ children }: { children: ReactNode }) {
  const t = useMessages(notesText).pageMenu;
  const router = useRouter();
  const pathname = usePathname();
  const { pages, userId, updatePage, trashPage, createPage } = useWorkspace();
  const { at, open, close } = useContextMenu();
  const last = useLastPointer();
  const [id, setId] = useState<string | null>(null);
  const page = id ? pages.find((p) => p.id === id) : undefined;
  const mine = page?.user_id === userId;

  const act = (fn: () => unknown) => () => {
    close();
    void fn();
  };

  return (
    <div
      className="contents"
      onContextMenu={(e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-page-id]");
        const found = el?.dataset.pageId;
        if (!found || !pages.some((p) => p.id === found) || !wantsOwnMenu(e, last.current)) return;
        setId(found);
        open(e);
      }}
    >
      {children}
      <ContextMenu at={page ? at : null} onClose={close} label={t.label}>
        {page && (
          <>
            <MenuItem icon={<SquareArrowOutUpRight />} onSelect={act(() => router.push(`/p/${page.id}`))}>
              {t.open}
            </MenuItem>
            <MenuItem icon={<ExternalLink />} onSelect={act(() => window.open(`/p/${page.id}`, "_blank", "noopener"))}>
              {t.openNewTab}
            </MenuItem>
            {mine && (
              <MenuItem
                icon={page.is_favorite ? <StarOff /> : <Star />}
                onSelect={act(() => updatePage(page.id, { is_favorite: !page.is_favorite }))}
              >
                {page.is_favorite ? t.unfavorite : t.favorite}
              </MenuItem>
            )}
            {(page.kind === "note" || page.kind === "folder") && (
              <MenuItem
                icon={<FilePlus2 />}
                onSelect={act(async () => {
                  const created = await createPage({ kind: "note", parent_id: page.id, subject_id: page.subject_id });
                  if (created) router.push(`/p/${created.id}`);
                })}
              >
                {t.newInside}
              </MenuItem>
            )}
            <MenuItem
              icon={<Link2 />}
              onSelect={act(async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/p/${page.id}`);
                  blob.say(t.linkCopied, { mood: "happy" });
                } catch {}
              })}
            >
              {t.copyLink}
            </MenuItem>
            {mine && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={act(async () => {
                    // (trashPage says where it went.) Not left looking at a page in the trash:
                    if ((await trashPage(page.id)) && pathname === `/p/${page.id}`) router.push("/notes");
                  })}
                >
                  {t.trash}
                </MenuItem>
              </>
            )}
          </>
        )}
      </ContextMenu>
    </div>
  );
}
