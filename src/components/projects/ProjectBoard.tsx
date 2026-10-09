"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, CalendarDays, Check, Ellipsis, Eye, FolderKanban, LayoutList, Link2, LogOut, Search, Settings2, SquareKanban, Trash2, Undo2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Blob } from "@/components/blob/Blob";
import { blob } from "@/components/blob/bus";
import { AvatarStack } from "@/components/share/Avatar";
import { ShareDialog } from "@/components/share/ShareDialog";
import { TopBar } from "@/components/shell/TopBar";
import { useNow } from "@/components/tasks/useNow";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { useLocale, useMessages } from "@/i18n/client";
import { projectsText } from "@/i18n/messages/projects";
import { shareText } from "@/i18n/messages/share";
import { subjectColor } from "@/lib/subjects";
import { formatDueLong, taskBucket } from "@/lib/tasks";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteProject, leaveProject, setArchived } from "./actions";
import { BoardView } from "./BoardView";
import { DueChip } from "./CardFace";
import { CardDrawer } from "./CardDrawer";
import { ListView } from "./ListView";
import { PRIORITIES, boardColor, labelKey, projectLabels, projectProgress, type Priority } from "./model";
import { PickRow, PriorityIcon } from "./pickers";
import { ConfirmDialog, ProjectIcon, ProjectSettingsDialog } from "./ProjectDialogs";
import { useBoard, type BoardData } from "./useBoard";

type View = "board" | "list";
type DueFilter = "overdue" | "week" | "none";
type Filters = { q: string; mine: boolean; labels: string[]; priority: Priority | null; due: DueFilter | null };
const NO_FILTERS: Filters = { q: "", mine: false, labels: [], priority: null, due: null };

const VIEW_KEY = "blob-project-view";

/** /projects/<id>: the project's header, its toolbar (view, search, filters) and the board or list, with the card drawer. */
export function ProjectBoard({ initial }: { initial: BoardData }) {
  const t = useMessages(projectsText);
  const s = useMessages(shareText);
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();
  const { userId, profile, subjects } = useWorkspace();
  const me = useMemo(() => ({ user_id: userId, name: profile.full_name?.trim() || "", avatar_url: profile.avatar_url }), [userId, profile.full_name, profile.avatar_url]);
  const board = useBoard(initial, me);
  const { project, cards, columns, members, role, peers } = board;
  const owner = role === "owner";
  const readOnly = role === "viewer" || !!project.archived_at;

  const [view, setView] = useState<View>("board");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const search = useRef<HTMLInputElement>(null);

  // The view you used last, per project.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}")[project.id];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a preference after mount
      if (saved === "list" || saved === "board") setView(saved);
    } catch {}
  }, [project.id]);
  const chooseView = (v: View) => {
    setView(v);
    try {
      const all = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}");
      localStorage.setItem(VIEW_KEY, JSON.stringify({ ...all, [project.id]: v }));
    } catch {}
  };

  // ?card=<id> opens that card (a copied link); the address follows the open card.
  const wanted = params.get("card");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the linked card once the page is in the browser
    if (wanted) setOpenId(wanted);
  }, [wanted]);
  const open = useCallback(
    (id: string | null) => {
      setOpenId(id);
      window.history.replaceState(null, "", id ? `/projects/${project.id}?card=${id}` : `/projects/${project.id}`);
    },
    [project.id],
  );

  // "/" searches, like in most boards.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (document.querySelector("[role=dialog][aria-modal=true]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Removed from the project, or it was deleted: say so and go back to the list.
  useEffect(() => {
    if (!board.gone) return;
    blob.say(board.gone === "removed" ? t.removedFromProject : t.projectGone, { mood: "worried" });
  }, [board.gone, t]);

  const doneColumns = useMemo(() => new Set(columns.filter((c) => c.done).map((c) => c.id)), [columns]);
  const visible = useCallback(
    (card: Task) => {
      const done = card.done || (!!card.column_id && doneColumns.has(card.column_id));
      if (filters.mine && !card.assignees.includes(userId)) return false;
      if (filters.priority !== null && card.priority !== filters.priority) return false;
      if (filters.labels.length && !card.labels.some((raw) => filters.labels.includes(labelKey(raw)))) return false;
      if (filters.due) {
        if (filters.due === "none" ? !!card.due_at : !card.due_at || done) return false;
        if (filters.due !== "none" && now) {
          const bucket = taskBucket({ done: false, due_at: card.due_at }, now);
          if (filters.due === "overdue" && bucket !== "overdue") return false;
          if (filters.due === "week" && !["overdue", "today", "tomorrow", "week"].includes(bucket)) return false;
        }
      }
      const q = filters.q.trim().toLowerCase();
      if (q && !`${card.title} ${card.details ?? ""} ${card.labels.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    },
    [filters, userId, doneColumns, now],
  );
  const filtered = filters.mine || filters.priority !== null || filters.labels.length > 0 || filters.due !== null || filters.q.trim() !== "";
  const shown = filtered ? cards.filter(visible).length : cards.length;
  const progress = projectProgress(columns, cards);
  const subject = subjects.find((x) => x.id === project.subject_id);
  const here = new Set(peers.map((p) => p.user_id));
  const others = members.filter((m) => m.user_id !== userId);

  async function archive() {
    const next = await setArchived(project.id, !project.archived_at);
    if (!next) return blob.say(t.errSave, { mood: "worried" });
    void board.updateProject(next);
    blob.say(next.archived_at ? t.archived : t.restored, { mood: "happy" });
  }

  if (board.gone) {
    return (
      <>
        <TopBar crumbs={[{ label: t.projects, href: "/projects", icon: <FolderKanban className="size-3.5 text-ink-3" /> }]} />
        <div className="grid flex-1 place-items-center px-4">
          <div className="flex flex-col items-center text-center">
            <Blob size={110} mood="worried" />
            <h1 className="mt-2 font-display text-[20px] font-semibold">{board.gone === "removed" ? t.removedFromProject : t.projectGone}</h1>
            <Button variant="primary" className="mt-4" onClick={() => router.push("/projects")}>
              <FolderKanban className="size-4" /> {t.projects}
            </Button>
          </div>
        </div>
      </>
    );
  }

  const title = project.title.trim() || t.untitled;

  return (
    <>
      <TopBar
        crumbs={[
          { label: <span className="max-sm:sr-only">{t.projects}</span>, title: t.projects, href: "/projects", icon: <FolderKanban className="size-3.5 text-ink-3" /> },
          { label: title, icon: <span className="text-[13px] leading-none">{project.icon || "📋"}</span> },
        ]}
        actions={
          <>
            {peers.length > 0 && (
              <AvatarStack
                people={[...new Map(peers.map((p) => [p.user_id, p])).values()]}
                here={here}
                size={24}
                max={3}
                className="mr-1.5 pl-1"
                label={peers.map((p) => t.here(p.name || s.someone)).join(", ")}
              />
            )}
            {role === "viewer" && (
              <span className="flex h-7 items-center gap-1 rounded-full bg-hover px-2 text-[12px] font-medium text-ink-2 max-sm:hidden">
                <Eye className="size-3.5" /> {s.viewOnly}
              </span>
            )}
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-raised pl-1.5 pr-2.5 text-[13px] font-medium text-ink shadow-card transition-colors hover:border-line-2 hover:bg-hover/60 max-sm:px-1.5 [@media(hover:none)]:h-9"
              aria-label={others.length ? `${s.share} · ${s.sharedWith(others.length)}` : s.share}
              title={others.length ? s.sharedWith(others.length) : s.shareTitle}
            >
              {others.length ? <AvatarStack people={others} size={20} max={3} className="max-sm:hidden" /> : <UserPlus className="size-4 text-ink-3" />}
              {others.length > 0 && <UserPlus className="size-4 text-ink-3 sm:hidden" />}
              <span className="max-sm:sr-only">{s.share}</span>
            </button>
            <Popover
              align="end"
              className="w-[230px]"
              trigger={(props) => (
                <button {...props} className="grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9" aria-label={t.projectOptions} title={t.projectOptions}>
                  <Ellipsis className="size-4" />
                </button>
              )}
            >
              {(close) => (
                <>
                  {role !== "viewer" && (
                    <MenuItem
                      icon={<Settings2 />}
                      onSelect={() => {
                        close();
                        setSettings(true);
                      }}
                    >
                      {t.settings}
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<Link2 />}
                    onSelect={() => {
                      navigator.clipboard?.writeText(`${window.location.origin}/projects/${project.id}`);
                      blob.say(t.linkCopied, { mood: "happy" });
                      close();
                    }}
                  >
                    {t.copyLink}
                  </MenuItem>
                  <MenuSeparator />
                  {owner ? (
                    <>
                      <MenuItem
                        icon={<ArchiveRestore />}
                        onSelect={() => {
                          close();
                          void archive();
                        }}
                      >
                        {project.archived_at ? t.unarchive : t.archiveAction}
                      </MenuItem>
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        onSelect={() => {
                          close();
                          setConfirm("delete");
                        }}
                      >
                        {t.delete}
                      </MenuItem>
                    </>
                  ) : (
                    <MenuItem
                      icon={<LogOut />}
                      danger
                      onSelect={() => {
                        close();
                        setConfirm("leave");
                      }}
                    >
                      {t.leave}
                    </MenuItem>
                  )}
                </>
              )}
            </Popover>
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header board={board} readOnly={readOnly} title={title}>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-ink-2">
            {progress.total > 0 ? (
              <span className="flex items-center gap-2" title={t.progress(progress.done, progress.total)}>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-hover">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: boardColor(project.color) }}
                    initial={false}
                    animate={{ width: `${(progress.done / progress.total) * 100}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  />
                </span>
                <span className="tabular-nums">{t.progress(progress.done, progress.total)}</span>
              </span>
            ) : (
              <span className="text-ink-3">{t.noCards}</span>
            )}
            {project.due_at && (
              <span className="flex items-center gap-1" title={formatDueLong(project.due_at, locale)}>
                <DueChip due={project.due_at} now={now} done={progress.total > 0 && progress.done === progress.total} />
              </span>
            )}
            {subject && (
              <Link href={`/subjects/${subject.id}`} className="flex items-center gap-1.5 rounded-md px-1 hover:bg-hover hover:text-ink pointer-coarse:py-1.5">
                {subject.emoji ? <span className="text-[12px]">{subject.emoji}</span> : <span className="size-2 rounded-full" style={{ background: subjectColor(subject.color) }} />}
                {subject.name}
              </Link>
            )}
            {members.length > 1 && (
              <button
                type="button"
                onClick={() => setSharing(true)}
                className="flex items-center gap-1.5 rounded-md py-0.5 pl-0.5 pr-1.5 hover:bg-hover"
                aria-label={t.membersLabel(members.map((m) => m.full_name || s.someone).join(", "))}
              >
                <AvatarStack people={members} here={here} size={22} max={6} />
              </button>
            )}
          </div>
        </Header>

        {(role === "viewer" || project.archived_at) && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl bg-hover/70 px-3 py-2 text-[12.5px] text-ink-2 sm:mx-8 lg:mx-10">
            {project.archived_at ? <ArchiveRestore className="size-4 shrink-0 text-ink-3" /> : <Eye className="size-4 shrink-0 text-ink-3" />}
            <span className="min-w-0 flex-1">{project.archived_at ? t.archivedBanner : t.viewerBanner}</span>
            {project.archived_at && owner && (
              <Button size="xs" onClick={() => void archive()}>
                {t.unarchive}
              </Button>
            )}
          </div>
        )}

        <Toolbar
          view={view}
          onView={chooseView}
          filters={filters}
          setFilters={setFilters}
          filtered={filtered}
          shown={shown}
          total={cards.length}
          labels={projectLabels(cards)}
          searchRef={search}
        />

        <div className="relative min-h-0 flex-1">
          {view === "board" ? (
            <BoardView board={board} visible={visible} readOnly={readOnly} now={now} openId={openId} onOpen={open} meId={userId} />
          ) : (
            <ListView board={board} visible={visible} now={now} openId={openId} onOpen={open} />
          )}
          {filtered && shown === 0 && cards.length > 0 && view === "board" && (
            <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
              <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[13px] text-ink-2 shadow-pop">
                {t.nothingMatches}
                <button onClick={() => setFilters(NO_FILTERS)} className="font-medium text-blob-ink hover:underline">
                  {t.clearFilters}
                </button>
              </div>
            </div>
          )}
        </div>

        <CardDrawer board={board} cardId={openId} onClose={() => open(null)} readOnly={readOnly} now={now} meId={userId} />
      </div>

      <UndoCardToast board={board} />

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        target={{ type: "project", id: project.id }}
        name={title}
        onChanged={board.membersChanged}
        onLeft={() => {
          blob.say(t.left, { mood: "happy" });
          router.push("/projects");
          router.refresh();
        }}
      />
      <ProjectSettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        project={project}
        owner={owner}
        onSave={(patch) => void board.updateProject(patch)}
        onArchive={() => {
          setSettings(false);
          void archive();
        }}
        onDelete={() => {
          setSettings(false);
          setConfirm("delete");
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title={t.confirmDeleteTitle(title)}
        body={t.confirmDeleteBody}
        confirm={t.confirmDelete}
        onConfirm={async () => {
          const ok = await deleteProject(project.id);
          if (!ok) return void blob.say(t.errDelete, { mood: "worried" });
          board.projectDeleted();
          blob.say(t.deleted, { mood: "happy" });
          router.push("/projects");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        onClose={() => setConfirm(null)}
        title={t.confirmLeaveTitle(title)}
        body={t.confirmLeaveBody}
        confirm={t.confirmLeave}
        onConfirm={async () => {
          const ok = await leaveProject(project.id, userId);
          if (!ok) return void blob.say(t.errSave, { mood: "worried" });
          board.membersChanged();
          blob.say(t.left, { mood: "happy" });
          router.push("/projects");
          router.refresh();
        }}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Header: icon, title and description, edited in place
   --------------------------------------------------------------------------- */

function Header({ board, readOnly, title, children }: { board: ReturnType<typeof useBoard>; readOnly: boolean; title: string; children: ReactNode }) {
  const t = useMessages(projectsText);
  const { project } = board;
  const [name, setName] = useState<string | null>(null);
  const [desc, setDesc] = useState<string | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const descValue = desc ?? project.description;
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [descValue]);

  return (
    <header className="shrink-0 px-4 pb-3 pt-2 sm:px-8 lg:px-10 lg:pt-3">
      <div className="flex items-center gap-3">
        <ProjectIcon project={project} size={44} className="max-sm:hidden" />
        <ProjectIcon project={project} size={36} className="sm:hidden" />
        <div className="min-w-0 flex-1">
          <input
            value={name ?? project.title}
            readOnly={readOnly}
            maxLength={120}
            aria-label={t.titlePlaceholder}
            placeholder={title}
            onFocus={() => !readOnly && setName(project.title)}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== null && name.trim() && name !== project.title) void board.updateProject({ title: name });
              setName(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(null);
                e.currentTarget.blur();
              }
            }}
            className={cn(
              "-ml-1.5 w-full truncate rounded-lg bg-transparent px-1.5 font-display text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink outline-none placeholder:text-ink max-sm:text-[22px]",
              !readOnly && "hover:bg-hover/60 focus:bg-hover/60",
            )}
          />
          {(project.description || !readOnly) && (
            <textarea
              ref={descRef}
              rows={1}
              value={descValue}
              readOnly={readOnly}
              maxLength={4000}
              aria-label={t.addDescription}
              placeholder={t.descriptionPlaceholder}
              onFocus={() => !readOnly && setDesc(project.description)}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={() => {
                if (desc !== null && desc !== project.description) void board.updateProject({ description: desc });
                setDesc(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDesc(null);
                  e.currentTarget.blur();
                }
              }}
              className={cn(
                "-ml-1.5 mt-0.5 block max-h-[120px] w-full resize-none overflow-y-auto rounded-md bg-transparent px-1.5 py-0.5 text-[13.5px] leading-snug text-ink-2 outline-none placeholder:text-ink-3/80",
                !readOnly && "hover:bg-hover/60 focus:bg-hover/60",
              )}
            />
          )}
        </div>
      </div>
      {children}
    </header>
  );
}

/* ---------------------------------------------------------------------------
   Toolbar: view switch, search, filters
   --------------------------------------------------------------------------- */

function Toolbar({
  view,
  onView,
  filters,
  setFilters,
  filtered,
  shown,
  total,
  labels,
  searchRef,
}: {
  view: View;
  onView: (v: View) => void;
  filters: Filters;
  setFilters: (fn: (f: Filters) => Filters) => void;
  filtered: boolean;
  shown: number;
  total: number;
  labels: ReturnType<typeof projectLabels>;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const t = useMessages(projectsText);
  const chip = (on: boolean) =>
    cn(
      "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors [@media(hover:none)]:h-9",
      on ? "border-blob/50 bg-blob-soft text-blob-ink" : "border-line bg-raised text-ink-2 hover:border-line-2 hover:text-ink aria-expanded:border-line-2",
    );
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pb-3 max-sm:overflow-x-auto max-sm:[scrollbar-width:none] sm:px-8 lg:px-10 max-sm:[&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 rounded-lg bg-hover p-0.5" role="tablist" aria-label={t.views}>
        {(
          [
            ["board", t.viewBoard, SquareKanban],
            ["list", t.viewList, LayoutList],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => onView(v)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors [@media(hover:none)]:h-8",
              view === v ? "bg-raised text-ink shadow-card dark:bg-white/10" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <label className="relative flex h-8 min-w-[150px] shrink-0 items-center sm:w-[220px] [@media(hover:none)]:h-9">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-ink-3" />
        <input
          ref={searchRef}
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFilters((f) => ({ ...f, q: "" }));
              e.currentTarget.blur();
            }
          }}
          placeholder={t.search}
          aria-label={t.search}
          className="h-full w-full rounded-lg border border-line bg-raised pl-8 pr-7 text-[12.5px] text-ink outline-none transition-[border] placeholder:text-ink-3 hover:border-line-2 focus:border-blob"
        />
        {filters.q ? (
          <button type="button" onClick={() => setFilters((f) => ({ ...f, q: "" }))} className="absolute right-1 grid size-6 place-items-center rounded text-ink-3 hover:text-ink" aria-label={t.clearSearch}>
            <X className="size-3.5" />
          </button>
        ) : (
          <Kbd className="absolute right-2 [@media(hover:none)]:hidden">/</Kbd>
        )}
      </label>

      <button type="button" aria-pressed={filters.mine} onClick={() => setFilters((f) => ({ ...f, mine: !f.mine }))} className={chip(filters.mine)}>
        {filters.mine && <Check className="size-3.5" />}
        {t.mine}
      </button>

      <Popover
        align="start"
        className="w-[230px]"
        role="dialog"
        label={t.labels}
        trigger={(props) => (
          <button type="button" {...props} className={chip(filters.labels.length > 0)}>
            {t.labels}
            {filters.labels.length > 0 && <span className="rounded bg-blob/15 px-1 tabular-nums">{filters.labels.length}</span>}
          </button>
        )}
      >
        <div className="max-h-[280px] overflow-y-auto">
          {labels.length === 0 && <p className="px-2 py-1.5 text-[12.5px] text-ink-3">{t.drawer.noLabels}</p>}
          {labels.map((l) => {
            const key = l.name.toLowerCase();
            const on = filters.labels.includes(key);
            return (
              <PickRow
                key={l.raw}
                multi
                active={on}
                onClick={() => setFilters((f) => ({ ...f, labels: on ? f.labels.filter((x) => x !== key) : [...f.labels, key] }))}
                icon={<span className="size-2.5 rounded-full" style={{ background: boardColor(l.color) }} />}
              >
                {l.name}
              </PickRow>
            );
          })}
        </div>
      </Popover>

      <Popover
        align="start"
        className="w-[200px]"
        trigger={(props) => (
          <button type="button" {...props} className={chip(filters.priority !== null)}>
            {filters.priority !== null && <PriorityIcon priority={filters.priority} className="-ml-0.5" />}
            {filters.priority !== null ? t.priorityNames[filters.priority] : t.priority}
          </button>
        )}
      >
        {(close) =>
          PRIORITIES.map((p) => (
            <PickRow
              key={p}
              active={filters.priority === p}
              icon={<PriorityIcon priority={p} />}
              onClick={() => {
                setFilters((f) => ({ ...f, priority: f.priority === p ? null : p }));
                close();
              }}
            >
              {t.priorityNames[p]}
            </PickRow>
          ))
        }
      </Popover>

      <Popover
        align="start"
        className="w-[210px]"
        trigger={(props) => (
          <button type="button" {...props} className={chip(filters.due !== null)}>
            <CalendarDays className="size-3.5" />
            {filters.due ? t.dueFilter[filters.due] : t.due}
          </button>
        )}
      >
        {(close) =>
          (["overdue", "week", "none"] as const).map((d) => (
            <PickRow
              key={d}
              active={filters.due === d}
              onClick={() => {
                setFilters((f) => ({ ...f, due: f.due === d ? null : d }));
                close();
              }}
            >
              {t.dueFilter[d]}
            </PickRow>
          ))
        }
      </Popover>

      <AnimatePresence initial={false}>
        {filtered && (
          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex shrink-0 items-center gap-2 pl-1 text-[12px] text-ink-3">
            <span className="tabular-nums">{t.showing(shown, total)}</span>
            <button type="button" onClick={() => setFilters(() => NO_FILTERS)} className="rounded-md px-1.5 py-1 font-medium text-ink-2 hover:bg-hover hover:text-ink">
              {t.clearFilters}
            </button>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   "Card deleted · Undo"
   --------------------------------------------------------------------------- */

function UndoCardToast({ board }: { board: ReturnType<typeof useBoard> }) {
  const t = useMessages(projectsText).drawer;
  const { removed, dismissRemoved, undoDelete } = board;
  useEffect(() => {
    if (!removed) return;
    const id = setTimeout(dismissRemoved, 6000);
    return () => clearTimeout(id);
  }, [removed, dismissRemoved]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {removed && (
        <motion.div
          key={removed.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className="fixed bottom-6 left-1/2 z-[65] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-raised py-1 pl-3.5 pr-1 text-[13px] text-ink shadow-pop"
          role="status"
        >
          <span className="min-w-0 truncate">{t.deleted(removed.title)}</span>
          <button onClick={() => void undoDelete()} className="ml-2 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 font-medium text-blob-ink hover:bg-blob-soft">
            <Undo2 className="size-3.5" /> {t.undo}
          </button>
          <button onClick={dismissRemoved} className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-hover hover:text-ink" aria-label={t.close}>
            <X className="size-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
