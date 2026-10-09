"use client";

import { FolderInput, FileUser, Link2, Star, Trash2, Ellipsis, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { PageIcon } from "@/components/shell/Sidebar";
import { TopBar, type Crumb } from "@/components/shell/TopBar";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { pageText } from "@/i18n/messages/page";
import { subjectColor } from "@/lib/subjects";
import type { Peer } from "@/lib/live";
import type { PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { SaveIndicator } from "./SaveIndicator";
import type { SaveState } from "./useAutosave";

/** Breadcrumbs, save state, favorite and the page menu. Shared by notes and presentations. */
export function PageTopBar({ pageId, saveState, actions, peers = [] }: { pageId: string; saveState: SaveState; actions?: ReactNode; peers?: Peer[] }) {
  const t = useMessages(pageText);
  const cvs = useMessages(cvHomeText).title;
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

  // CVs live on /cv, not in a subject.
  const cv = page.kind === "cv";
  // On phones the parents shrink to their icons, so the page's own title keeps the room.
  const parentLabel = (label: string) => <span className="max-sm:sr-only">{label}</span>;
  const crumbs: Crumb[] = [
    ...(cv ? [{ label: parentLabel(cvs), title: cvs, href: "/cv", icon: <FileUser className="size-3.5 text-ink-3" /> }] : []),
    ...(subject && !cv
      ? [
          {
            label: parentLabel(subject.name),
            title: subject.name,
            href: `/subjects/${subject.id}`,
            icon: subject.emoji ? <span className="text-[12px]">{subject.emoji}</span> : <span className="size-2 rounded-full" style={{ background: subjectColor(subject.color) }} />,
          },
        ]
      : []),
    ...chain.map((p) => ({ label: parentLabel(pageTitle(p.title, p.kind, locale)), title: pageTitle(p.title, p.kind, locale), href: `/p/${p.id}`, icon: <PageIcon page={p} className="size-3.5" /> })),
    { label: pageTitle(page.title, page.kind, locale), icon: <PageIcon page={page} className="size-3.5" /> },
  ];

  const toggleFavorite = () => {
    updatePage(page.id, { is_favorite: !page.is_favorite });
    if (!page.is_favorite) blob.react("jump", "love", 1400);
  };
  // Pages with their own actions (presentations) move the star into the menu on phones, so the title keeps some room.
  const starInMenu = Boolean(actions);

  return (
    <TopBar
      crumbs={crumbs}
      actions={
        <>
          <PeerStack peers={peers} />
          <SaveIndicator state={saveState} />
          {actions}
          <button
            onClick={toggleFavorite}
            className={cn("grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9", starInMenu && "max-sm:hidden")}
            aria-label={page.is_favorite ? t.removeFavorite : t.addFavorite}
            title={page.is_favorite ? t.removeFavorite : t.addFavorite}
          >
            <Star className={cn("size-4 transition-transform", page.is_favorite && "scale-110 fill-blob text-blob")} />
          </button>
          <Popover
            align="end"
            className="w-[230px]"
            trigger={(props) => (
              <button {...props} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9" aria-label={t.options} title={t.options}>
                <Ellipsis className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                {starInMenu && (
                  <div className="sm:hidden">
                    <MenuItem
                      icon={<Star className={cn(page.is_favorite && "fill-blob text-blob")} />}
                      onSelect={() => {
                        toggleFavorite();
                        close();
                      }}
                    >
                      {page.is_favorite ? t.removeFavorite : t.addFavorite}
                    </MenuItem>
                    <MenuSeparator />
                  </div>
                )}
                {!page.parent_id && !cv && (
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
                          icon={
                            <span className="grid w-4 place-items-center">
                              {s.emoji ? <span className="text-[13px]">{s.emoji}</span> : <span className="block size-2 rounded-full" style={{ background: subjectColor(s.color) }} />}
                            </span>
                          }
                          shortcut={page.subject_id === s.id ? <Check className="size-3.5" /> : undefined}
                          onSelect={() => {
                            updatePage(page.id, { subject_id: s.id });
                            close();
                          }}
                        >
                          <span title={s.name}>{s.name}</span>
                        </MenuItem>
                      ))}
                      <MenuItem
                        icon={
                          <span className="grid w-4 place-items-center">
                            <span className="block size-2 rounded-full border border-ink-3" />
                          </span>
                        }
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
                    if (ok) router.push(cv ? "/cv" : page.parent_id ? `/p/${page.parent_id}` : subject ? `/subjects/${subject.id}` : "/home");
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

/** Who else has the page open right now (one dot per person, in their colour). */
function PeerStack({ peers }: { peers: Peer[] }) {
  const people = [...new Map(peers.map((p) => [p.user_id, p])).values()];
  if (!people.length) return null;
  return (
    <div className="mr-1 flex -space-x-1.5" aria-label={people.map((p) => p.name).join(", ")}>
      {people.slice(0, 4).map((p) => (
        <span
          key={p.user_id}
          title={p.name}
          className="grid size-6 place-items-center rounded-full border-2 border-paper text-[10.5px] font-semibold text-white"
          style={{ background: p.color }}
        >
          {(p.name.trim()[0] ?? "?").toUpperCase()}
        </span>
      ))}
      {people.length > 4 && <span className="grid size-6 place-items-center rounded-full border-2 border-paper bg-hover text-[10.5px] font-semibold text-ink-2">+{people.length - 4}</span>}
    </div>
  );
}
