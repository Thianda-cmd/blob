"use client";

import { FolderInput, FileUser, Link2, LogOut, Star, Trash2, Ellipsis, Check, Eye, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { AvatarStack, personName } from "@/components/share/Avatar";
import { ShareDialog } from "@/components/share/ShareDialog";
import { useMembers } from "@/components/share/useMembers";
import { PageIcon } from "@/components/shell/Sidebar";
import { TopBar, type Crumb } from "@/components/shell/TopBar";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { descendantsOf, useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { pageText } from "@/i18n/messages/page";
import { shareText } from "@/i18n/messages/share";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import type { Peer } from "@/lib/live";
import type { AccessRole, Member, PageMeta } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { SaveIndicator } from "./SaveIndicator";
import type { SaveState } from "./useAutosave";

/**
 * Breadcrumbs, who is here, save state, sharing, favorite and the page menu. Shared by notes and
 * presentations. `role` and `members` (from the page route) save a request; without them the bar
 * loads them itself. Sharing changes refresh the route, so the editors switch to working together.
 */
export function PageTopBar({
  pageId,
  saveState,
  actions,
  peers = [],
  role: initialRole,
  members: initialMembers,
}: {
  pageId: string;
  saveState: SaveState;
  actions?: ReactNode;
  peers?: Peer[];
  role?: AccessRole;
  members?: Member[];
}) {
  const t = useMessages(pageText);
  const s = useMessages(shareText);
  const cvs = useMessages(cvHomeText).title;
  const locale = useLocale();
  const router = useRouter();
  const { pages, subjects, updatePage, trashPage, userId, removePages } = useWorkspace();
  const page = pages.find((p) => p.id === pageId);
  // CVs are never shared: no need to ask who is on them.
  const access = useMembers(
    page && page.kind !== "cv" ? { type: "page", id: pageId } : null,
    initialRole && initialMembers ? { role: initialRole, members: initialMembers } : undefined,
  );
  const [sharing, setSharing] = useState(false);
  if (!page) return <TopBar crumbs={[]} />;

  const chain: PageMeta[] = [];
  let parent = pages.find((p) => p.id === page.parent_id);
  while (parent && chain.length < 5) {
    chain.unshift(parent);
    parent = pages.find((p) => p.id === parent!.parent_id);
  }
  const rootSubjectId = (chain[0] ?? page).subject_id;
  const subject = subjects.find((s) => s.id === rootSubjectId);

  const mine = page.user_id === userId;
  const role: AccessRole | null = access.role ?? (mine ? "owner" : null);
  const canShare = role === "owner" || role === "editor";
  const others = access.members.filter((m) => m.user_id !== userId);
  const owner = access.members.find((m) => m.role === "owner");

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

  /** After sharing changed: the route reloads its members, so the editors switch to working together (or back). */
  const changed = () => {
    void access.reload();
    router.refresh();
  };

  /** Gone from a shared page: forget the pages you no longer see and go home. */
  const leftPage = () => {
    const top = [...chain, page].find((p) => p.user_id !== userId) ?? page;
    removePages([top.id, ...descendantsOf(pages, top.id)].filter((id) => pages.find((p) => p.id === id)?.user_id !== userId));
    blob.say(s.leftPage, { mood: "happy" });
    router.push("/home");
    router.refresh();
  };

  const leave = async () => {
    const ids = [page.id, ...chain.map((p) => p.id)];
    const { error } = await createClient().from("page_members").delete().eq("user_id", userId).in("page_id", ids);
    if (error) return blob.say(s.error, { mood: "worried" });
    leftPage();
  };

  const ownerName = owner ? personName(owner, s.someone) : s.someone;

  return (
    <>
      <TopBar
        crumbs={crumbs}
        actions={
          <>
            <PeerStack peers={peers} />
            <SaveIndicator state={saveState} />
            {actions}
            {!cv && role && !mine && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                title={s.sharedBy(ownerName)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium transition-colors [@media(hover:none)]:h-8",
                  role === "viewer" ? "bg-hover text-ink-2 hover:text-ink" : "bg-blob-soft text-blob-ink hover:bg-blob-soft/70 max-md:hidden",
                )}
              >
                {role === "viewer" ? <Eye className="size-3.5" /> : <UserPlus className="size-3.5" />}
                {role === "viewer" ? s.viewOnly : s.sharedBadge}
              </button>
            )}
            {!cv && canShare && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised pl-1.5 pr-2.5 text-[13px] font-medium text-ink shadow-card transition-colors hover:border-line-2 hover:bg-hover/60 max-sm:px-1.5 [@media(hover:none)]:h-9"
                title={others.length ? s.sharedWith(others.length) : s.shareTitle}
                aria-label={others.length ? `${s.share} · ${s.sharedWith(others.length)}` : s.share}
              >
                {others.length ? <AvatarStack people={others} size={20} max={3} className="max-sm:hidden" /> : <UserPlus className="size-4 text-ink-3" />}
                {others.length > 0 && <UserPlus className="size-4 text-ink-3 sm:hidden" />}
                <span className="max-sm:sr-only">{s.share}</span>
              </button>
            )}
            {mine && (
              <button
                onClick={toggleFavorite}
                className={cn("grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9", starInMenu && "max-sm:hidden")}
                aria-label={page.is_favorite ? t.removeFavorite : t.addFavorite}
                title={page.is_favorite ? t.removeFavorite : t.addFavorite}
              >
                <Star className={cn("size-4 transition-transform", page.is_favorite && "scale-110 fill-blob text-blob")} />
              </button>
            )}
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
                  {starInMenu && mine && (
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
                  {mine && !page.parent_id && !cv && (
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
                  {!cv && role && (
                    <MenuItem
                      icon={<UserPlus />}
                      onSelect={() => {
                        close();
                        setSharing(true);
                      }}
                    >
                      {s.share}
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<Link2 />}
                    onSelect={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      blob.say(others.length ? s.linkCopiedMembers : t.linkCopied, { mood: "happy" });
                      close();
                    }}
                  >
                    {t.copyLink}
                  </MenuItem>
                  {mine ? (
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
                  ) : (
                    role && (
                      <MenuItem
                        icon={<LogOut />}
                        danger
                        onSelect={() => {
                          close();
                          void leave();
                        }}
                      >
                        {s.leavePage}
                      </MenuItem>
                    )
                  )}
                </>
              )}
            </Popover>
          </>
        }
      />
      {!cv && (
        <ShareDialog
          open={sharing}
          onClose={() => setSharing(false)}
          target={{ type: "page", id: page.id }}
          name={pageTitle(page.title, page.kind, locale)}
          ancestors={[...chain].reverse().map((p) => ({ id: p.id, title: pageTitle(p.title, p.kind, locale) }))}
          onChanged={changed}
          onLeft={leftPage}
        />
      )}
    </>
  );
}

/** Who else has the page open right now: their picture or initials, ringed in their colour. */
function PeerStack({ peers }: { peers: Peer[] }) {
  const s = useMessages(shareText);
  const people = [...new Map(peers.map((p) => [p.user_id, p])).values()];
  if (!people.length) return null;
  const here = new Set(people.map((p) => p.user_id));
  return (
    <AvatarStack
      people={people}
      here={here}
      size={24}
      max={3}
      className="mr-1.5 pl-1"
      label={people.map((p) => s.here(p.name || s.someone)).join(", ")}
    />
  );
}
