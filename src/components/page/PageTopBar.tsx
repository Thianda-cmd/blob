"use client";

import { FolderInput, Link2, Star, Trash2, Ellipsis, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { PageIcon } from "@/components/shell/Sidebar";
import { TopBar, type Crumb } from "@/components/shell/TopBar";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { pageText } from "@/i18n/messages/page";
import { subjectColor } from "@/lib/subjects";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { SaveIndicator } from "./SaveIndicator";
import type { SaveState } from "./useAutosave";

/** Breadcrumbs, save state, favorite and the page menu. Shared by notes and presentations. */
export function PageTopBar({ pageId, saveState, actions }: { pageId: string; saveState: SaveState; actions?: ReactNode }) {
  const t = useMessages(pageText);
  const locale = useLocale();
  const router = useRouter();
  const { pages, subjects, updatePage, trashPage } = useWorkspace();
  const page = pages.find((p) => p.id === pageId);
  if (!page) return <TopBar crumbs={[]} />;

  const chain: PageMeta[] = [];
  let parent = pages.find((p) => p.id === page.parent_id);
  while (parent && chain.length < 5) {
    chain.unshift(parent);
    parent = pages.find((p) => p.id === parent!.parent_id);
  }
  const rootSubjectId = (chain[0] ?? page).subject_id;
  const subject = subjects.find((s) => s.id === rootSubjectId);

  const crumbs: Crumb[] = [
    ...(subject
      ? [
          {
            label: subject.name,
            href: `/subjects/${subject.id}`,
            icon: subject.emoji ? <span className="text-[12px]">{subject.emoji}</span> : <span className="size-2 rounded-full" style={{ background: subjectColor(subject.color) }} />,
          },
        ]
      : []),
    ...chain.map((p) => ({ label: pageTitle(p.title, p.kind, locale), href: `/p/${p.id}`, icon: <PageIcon page={p} className="size-3.5" /> })),
    { label: pageTitle(page.title, page.kind, locale), icon: <PageIcon page={page} className="size-3.5" /> },
  ];

  return (
    <TopBar
      crumbs={crumbs}
      actions={
        <>
          <SaveIndicator state={saveState} />
          {actions}
          <button
            onClick={() => {
              updatePage(page.id, { is_favorite: !page.is_favorite });
              if (!page.is_favorite) blob.react("jump", "love", 1400);
            }}
            className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
            aria-label={page.is_favorite ? t.removeFavorite : t.addFavorite}
            title={page.is_favorite ? t.removeFavorite : t.addFavorite}
          >
            <Star className={cn("size-4 transition-transform", page.is_favorite && "scale-110 fill-blob text-blob")} />
          </button>
          <Popover
            align="end"
            className="w-[230px]"
            trigger={(props) => (
              <button {...props} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.options}>
                <Ellipsis className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                {!page.parent_id && (
                  <>
                    <MenuLabel>
                      <span className="flex items-center gap-1.5">
                        <FolderInput className="size-3" /> {t.moveToSubject}
                      </span>
                    </MenuLabel>
                    <div className="max-h-[220px] overflow-y-auto">
                      {subjects.map((s) => (
                        <MenuItem
                          key={s.id}
                          icon={s.emoji ? <span className="text-[13px]">{s.emoji}</span> : <span className="block size-2 rounded-full" style={{ background: subjectColor(s.color) }} />}
                          shortcut={page.subject_id === s.id ? <Check className="size-3.5" /> : undefined}
                          onSelect={() => {
                            updatePage(page.id, { subject_id: s.id });
                            close();
                          }}
                        >
                          {s.name}
                        </MenuItem>
                      ))}
                      <MenuItem
                        icon={<span className="block size-2 rounded-full border border-ink-3" />}
                        shortcut={!page.subject_id ? <Check className="size-3.5" /> : undefined}
                        onSelect={() => {
                          updatePage(page.id, { subject_id: null });
                          close();
                        }}
                      >
                        {t.noSubject}
                      </MenuItem>
                    </div>
                    <MenuSeparator />
                  </>
                )}
                <MenuItem
                  icon={<Link2 />}
                  onSelect={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    blob.say(t.linkCopied, { mood: "happy" });
                    close();
                  }}
                >
                  {t.copyLink}
                </MenuItem>
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={async () => {
                    close();
                    const ok = await trashPage(page.id);
                    if (ok) router.push(page.parent_id ? `/p/${page.parent_id}` : subject ? `/subjects/${subject.id}` : "/home");
                  }}
                >
                  {t.moveToTrash}
                </MenuItem>
              </>
            )}
          </Popover>
        </>
      }
    />
  );
}
