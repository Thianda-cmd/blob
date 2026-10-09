"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BookMarked,
  ChevronRight,
  Ellipsis,
  FilePlus2,
  FileText,
  FileUser,
  Folder,
  FolderOpen,
  FolderPlus,
  GraduationCap,
  House,
  ListChecks,
  LogOut,
  Monitor,
  Moon,
  NotebookPen,
  PanelLeftClose,
  Plus,
  Presentation,
  Search,
  Settings,
  ShieldCheck,
  SquareKanban,
  Star,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useShareInfo } from "@/components/notes/useShared";
import { Avatar } from "@/components/share/Avatar";
import { applyTheme } from "@/components/theme";
import { Kbd } from "@/components/ui/Kbd";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/Menu";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { SubjectMenu } from "@/components/shell/SubjectMenu";
import { useLocale, useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import { shellText } from "@/i18n/messages/shell";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import type { PageKind, PageMeta, Subject, SubjectKind, Theme } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";

// Touch screens (the phone drawer, tablets) get taller rows, bigger icon buttons and always-visible
// row actions: there is no hover to reveal them and 28 px rows are too small for a finger.
const TOUCH_ROW = "[@media(hover:none)]:h-9";
const TOUCH_ICON = "[@media(hover:none)]:size-8";
const TOUCH_SHOW = "focus-within:opacity-100 [@media(hover:none)]:opacity-100";

function useStoredSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
      if (raw) setSet(new Set(JSON.parse(raw)));
    } catch {}
  }, [key]);
  const toggle = (id: string, value?: boolean) =>
    setSet((prev) => {
      const next = new Set(prev);
      const on = value ?? !next.has(id);
      if (on) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  return [set, toggle] as const;
}

export function PageIcon({ page, className, open }: { page: Pick<PageMeta, "icon" | "kind">; className?: string; open?: boolean }) {
  if (page.icon) return <span className={cn("grid size-4 shrink-0 place-items-center text-[13px] leading-none", className)}>{page.icon}</span>;
  const Icon = page.kind === "deck" ? Presentation : page.kind === "cv" ? FileUser : page.kind === "folder" ? (open ? FolderOpen : Folder) : FileText;
  return <Icon className={cn("size-4 shrink-0 text-ink-3", className)} strokeWidth={1.8} />;
}

/** The icon of a subject or notebook: its emoji, else a dot in its colour (notebooks: a notebook). */
export function SubjectIcon({ subject, className }: { subject: Pick<Subject, "emoji" | "color" | "kind">; className?: string }) {
  if (subject.emoji) return <span className={cn("text-[13px] leading-none", className)}>{subject.emoji}</span>;
  if (subject.kind === "notebook") return <BookMarked className={cn("size-3.5", className)} style={{ color: subjectColor(subject.color) }} strokeWidth={2} />;
  return <span className={cn("size-2 rounded-full", className)} style={{ background: subjectColor(subject.color) }} />;
}

type NewKind = Extract<PageKind, "note" | "deck" | "folder">;

export function Sidebar({ onCollapse, onSearch, isAdmin = false }: { onCollapse: () => void; onSearch: () => void; isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { pages, subjects, createPage, profile, email, setProfile, userId, sharedIds } = useWorkspace();
  const locale = useLocale();
  const t = useMessages(shellText).sidebar;
  const adminLabel = useMessages(adminText).nav;
  // Subjects start expanded; we remember the ones you fold.
  const [folded, toggleFolded] = useStoredSet("blob-folded-subjects");
  const [openPages, toggleOpenPage] = useStoredSet("blob-open-pages");
  // Whole sections fold too, so a long list of favourites never pushes the subjects out of sight.
  const [foldedSections, toggleSection] = useStoredSet("blob-folded-sections");
  const sectionProps = (id: string, count: number) => ({
    folded: foldedSections.has(id),
    onToggle: () => toggleSection(id),
    count,
    toggleLabel: foldedSections.has(id) ? t.expand : t.collapse,
  });

  const { tree, roots } = useMemo(() => {
    const ids = new Set(pages.map((p) => p.id));
    const children = new Map<string | null, PageMeta[]>();
    // CVs live on /cv (favourites still list them). A page whose parent you can't see (shared with
    // you on its own, or left behind) is a top-level page.
    for (const p of pages) {
      if (p.kind === "cv") continue;
      const key = p.parent_id && ids.has(p.parent_id) ? p.parent_id : null;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(p);
    }
    children.forEach((list) => list.sort((a, b) => (a.kind === "folder" ? 0 : 1) - (b.kind === "folder" ? 0 : 1) || a.position - b.position || a.created_at.localeCompare(b.created_at)));
    return { tree: children, roots: children.get(null) ?? [] };
  }, [pages]);

  const mineRoots = roots.filter((p) => p.user_id === userId);
  const sharedRoots = roots.filter((p) => p.user_id !== userId);
  const shareInfo = useShareInfo(
    sharedRoots.map((p) => p.id),
    userId,
  );
  const schoolSubjects = subjects.filter((s) => s.kind !== "notebook");
  const notebooks = subjects.filter((s) => s.kind === "notebook");
  // The page open right now (a CV keeps "CV" highlighted, since CVs are not in the tree).
  const openPage = pathname.startsWith("/p/") ? pages.find((p) => p.id === pathname.slice(3)) : undefined;
  // Favourites are your own: someone else's star on a shared page isn't yours.
  const favorites = pages.filter((p) => p.is_favorite && p.user_id === userId).sort((a, b) => a.title.localeCompare(b.title));
  const unfiled = mineRoots.filter((p) => !p.subject_id || !subjects.some((s) => s.id === p.subject_id));

  /** Can you add pages inside this one? Not in a page shared with you for viewing. */
  const canAddInside = (page: PageMeta): boolean => {
    if (page.user_id === userId) return true;
    let top: PageMeta | undefined = page;
    while (top && top.parent_id && pages.some((p) => p.id === top!.parent_id)) top = pages.find((p) => p.id === top!.parent_id);
    if (top && top.user_id === userId) return true;
    return top ? shareInfo[top.id]?.role === "editor" : false;
  };

  async function newPage(kind: NewKind, extra: { subject_id?: string | null; parent_id?: string | null } = {}) {
    const page = await createPage({ kind, ...extra });
    if (!page) return;
    if (extra.parent_id) toggleOpenPage(extra.parent_id, true);
    if (extra.subject_id) toggleFolded(extra.subject_id, false);
    router.push(`/p/${page.id}`);
  }

  const renderPage = (page: PageMeta, depth: number, trailing?: ReactNode): ReactNode => {
    const kids = tree.get(page.id) ?? [];
    const open = openPages.has(page.id);
    const active = pathname === `/p/${page.id}`;
    const folder = page.kind === "folder";
    const addable = (page.kind === "note" || folder) && canAddInside(page);
    const title = pageTitle(page.title, page.kind, locale);
    const sharedMark = page.user_id === userId && sharedIds.has(page.id);
    return (
      <div key={page.id}>
        <div
          className={cn(
            "group relative flex h-7 items-center gap-1.5 rounded-md pr-1 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
            TOUCH_ROW,
            active && "bg-hover font-medium text-ink",
          )}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <button
            onClick={() => toggleOpenPage(page.id)}
            className={cn(
              "grid size-4 shrink-0 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink",
              TOUCH_ICON,
              kids.length === 0 && page.kind !== "note" && !folder && "invisible",
            )}
            aria-label={open ? t.collapse : t.expand}
            aria-expanded={open}
          >
            <ChevronRight className={cn("size-3 transition-transform duration-200", open && "rotate-90")} />
          </button>
          <Link href={`/p/${page.id}`} className="flex min-w-0 flex-1 items-center gap-2 self-stretch" title={title}>
            <PageIcon page={page} open={folder && open} />
            <span className="truncate">{title}</span>
            {sharedMark && <Users className="size-3 shrink-0 text-ink-3" aria-label={t.sharedByYou} />}
          </Link>
          {trailing}
          {addable &&
            (folder ? (
              <AddMenu
                label={t.addInside}
                className={cn("opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [&:has([aria-expanded=true])]:opacity-100", TOUCH_SHOW)}
                onPick={(kind) => newPage(kind, { parent_id: page.id, subject_id: page.subject_id })}
              />
            ) : (
              <button
                onClick={() => newPage("note", { parent_id: page.id, subject_id: page.subject_id })}
                className={cn("grid size-5 shrink-0 place-items-center rounded text-ink-3 opacity-0 hover:bg-line hover:text-ink focus-visible:opacity-100 group-hover:opacity-100", TOUCH_ICON, TOUCH_SHOW)}
                aria-label={t.addInside}
                title={t.addInside}
              >
                <Plus className="size-3.5" />
              </button>
            ))}
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {kids.length ? (
                kids.map((k) => renderPage(k, depth + 1))
              ) : (
                <div className={cn("flex h-7 items-center text-[12.5px] text-ink-3", TOUCH_ROW)} style={{ paddingLeft: 30 + depth * 14 }}>
                  {folder ? t.emptyFolder : t.noPagesInside}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderSubject = (subject: Subject) => {
    const items = mineRoots.filter((p) => p.subject_id === subject.id);
    const open = !folded.has(subject.id);
    const active = pathname === `/subjects/${subject.id}`;
    const notebook = subject.kind === "notebook";
    return (
      <div key={subject.id}>
        <div
          className={cn(
            "group flex h-7 items-center gap-1.5 rounded-md pl-1.5 pr-1 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
            TOUCH_ROW,
            active && "bg-hover font-medium text-ink",
          )}
        >
          <button
            onClick={() => toggleFolded(subject.id)}
            className={cn("grid size-4 shrink-0 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink", TOUCH_ICON)}
            aria-label={open ? (notebook ? t.collapseNotebook : t.collapseSubject) : notebook ? t.expandNotebook : t.expandSubject}
            aria-expanded={open}
          >
            <ChevronRight className={cn("size-3 transition-transform duration-200", open && "rotate-90")} />
          </button>
          <Link href={`/subjects/${subject.id}`} className="flex min-w-0 flex-1 items-center gap-2 self-stretch" title={subject.name}>
            <span className="grid size-4 shrink-0 place-items-center">
              <SubjectIcon subject={subject} />
            </span>
            <span className="truncate">{subject.name}</span>
            {subject.emoji && <span className="ml-auto size-1.5 shrink-0 rounded-full opacity-80" style={{ background: subjectColor(subject.color) }} />}
          </Link>
          <div className={cn("flex opacity-0 group-hover:opacity-100 [&:has([aria-expanded=true])]:opacity-100", TOUCH_SHOW)}>
            <SubjectMenu subject={subject} />
            <AddMenu label={t.addTo(subject.name)} onPick={(kind) => newPage(kind, { subject_id: subject.id })} />
          </div>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {items.length ? (
                items.map((p) => renderPage(p, 1))
              ) : (
                <button
                  onClick={() => newPage("note", { subject_id: subject.id })}
                  className={cn("flex h-7 w-full items-center gap-2 rounded-md pl-[34px] text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink", TOUCH_ROW)}
                >
                  <Plus className="size-3.5" /> {t.addNote}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <nav className="flex h-full w-full flex-col" aria-label={t.label}>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <Link href="/home" className="flex min-w-0 items-center gap-2 rounded-md [@media(hover:none)]:h-9">
          <BlobMark size={22} />
          <span className="font-display text-[17px] font-bold tracking-[-0.03em]">Blob</span>
        </Link>
        <button
          onClick={onCollapse}
          className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9"
          aria-label={t.hide}
          title={t.hideTitle}
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="space-y-0.5 px-2">
        <button
          onClick={onSearch}
          className="mb-1.5 flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink-3 shadow-card transition-colors hover:border-line-2 hover:text-ink-2"
        >
          <Search className="size-3.5" />
          {t.search}
          <span className="ml-auto flex gap-0.5 [@media(hover:none)]:hidden">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <NavLink href="/home" icon={<House />} active={pathname === "/home"}>
          {t.home}
        </NavLink>
        <NavLink href="/notes" icon={<NotebookPen />} active={pathname === "/notes" || pathname.startsWith("/notes/")}>
          {t.notesHome}
        </NavLink>
        <NavLink href="/learn" icon={<GraduationCap />} active={pathname.startsWith("/learn")}>
          {t.learn}
        </NavLink>
        <NavLink href="/tasks" icon={<ListChecks />} active={pathname === "/tasks"}>
          {t.tasks}
        </NavLink>
        <NavLink href="/projects" icon={<SquareKanban />} active={pathname === "/projects" || pathname.startsWith("/projects/")}>
          {t.projects}
        </NavLink>
        <NavLink href="/cv" icon={<FileUser />} active={pathname === "/cv" || openPage?.kind === "cv"}>
          {t.cv}
        </NavLink>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {favorites.length > 0 && (
          <Section title={t.favorites} {...sectionProps("favorites", favorites.length)}>
            {favorites.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.id}`}
                title={pageTitle(p.title, p.kind, locale)}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md px-1.5 text-[13.5px] text-ink-2 hover:bg-hover hover:text-ink",
                  TOUCH_ROW,
                  pathname === `/p/${p.id}` && "bg-hover font-medium text-ink",
                )}
              >
                <Star className="size-3.5 shrink-0 fill-blob text-blob" />
                <span className="truncate">{pageTitle(p.title, p.kind, locale)}</span>
              </Link>
            ))}
          </Section>
        )}

        <Section title={t.subjects} action={<NewSubjectButton kind="subject" />} {...sectionProps("subjects", schoolSubjects.length)}>
          {schoolSubjects.length === 0 && <p className="px-1.5 py-1 text-[12.5px] text-ink-3">{t.noSubjects}</p>}
          {schoolSubjects.map(renderSubject)}
        </Section>

        <Section title={t.notebooks} action={<NewSubjectButton kind="notebook" />} {...sectionProps("notebooks", notebooks.length)}>
          {notebooks.length === 0 && <p className="px-1.5 py-1 text-[12.5px] leading-snug text-ink-3">{t.noNotebooks}</p>}
          {notebooks.map(renderSubject)}
        </Section>

        {sharedRoots.length > 0 && (
          <Section title={t.shared} {...sectionProps("shared", sharedRoots.length)}>
            {sharedRoots.map((p) => {
              const owner = shareInfo[p.id]?.owner;
              return renderPage(
                p,
                0,
                owner ? (
                  <Avatar person={owner} size={16} className="ml-0.5 group-hover:hidden [@media(hover:none)]:hidden" title={t.sharedBy(owner.full_name || "?")} />
                ) : null,
              );
            })}
          </Section>
        )}

        <Section title={t.notes} {...sectionProps("notes", unfiled.length)}>
          {unfiled.length === 0 ? <p className="px-1.5 py-1 text-[12.5px] text-ink-3">{t.noNotes}</p> : unfiled.map((p) => renderPage(p, 0))}
        </Section>
      </div>

      <div className="shrink-0 space-y-0.5 border-t border-line px-2 py-2">
        <div className="mb-1 grid grid-cols-2 gap-1">
          <button
            onClick={() => newPage("note")}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink text-[12.5px] font-medium text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
          >
            <FilePlus2 className="size-3.5" /> {t.newNote}
          </button>
          <button
            onClick={() => newPage("deck")}
            title={t.newDeckTitle}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-medium text-ink-2 transition-transform hover:text-ink active:scale-[0.97]"
          >
            <Presentation className="size-3.5" /> {t.newDeck}
          </button>
        </div>
        {isAdmin && (
          <NavLink href="/admin" icon={<ShieldCheck />} active={pathname === "/admin" || pathname.startsWith("/admin/")}>
            {adminLabel}
          </NavLink>
        )}
        <NavLink href="/trash" icon={<Trash2 />} active={pathname === "/trash"}>
          {t.trash}
        </NavLink>
        <AccountMenu name={profile.full_name} email={email} theme={profile.theme} onTheme={(t) => setProfile({ theme: t })} />
      </div>
    </nav>
  );
}

/** "+" with a small menu: new note, presentation or folder. */
function AddMenu({ label, onPick, className }: { label: string; onPick: (kind: NewKind) => void; className?: string }) {
  const t = useMessages(shellText).sidebar;
  return (
    <Popover
      align="start"
      trigger={(props) => (
        <button {...props} className={cn("grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink", TOUCH_ICON, className)} aria-label={label} title={label}>
          <Plus className="size-3.5" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon={<FileText />} onSelect={() => (close(), onPick("note"))}>
            {t.note}
          </MenuItem>
          <MenuItem icon={<Presentation />} onSelect={() => (close(), onPick("deck"))}>
            {t.presentation}
          </MenuItem>
          <MenuItem icon={<FolderPlus />} onSelect={() => (close(), onPick("folder"))}>
            {t.folder}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function Section({
  title,
  action,
  folded,
  onToggle,
  count,
  toggleLabel,
  children,
}: {
  title: string;
  action?: ReactNode;
  folded: boolean;
  onToggle: () => void;
  /** Shown next to the title while the section is folded. */
  count: number;
  toggleLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="group flex h-6 items-center pl-0.5 pr-1.5 [@media(hover:none)]:h-8">
        <button
          onClick={onToggle}
          aria-expanded={!folded}
          title={toggleLabel}
          className="flex h-full items-center gap-1 rounded-md px-1 text-[11.5px] font-medium text-ink-3 transition-colors hover:text-ink-2"
        >
          {title}
          {folded && count > 0 && <span className="tabular-nums text-ink-3/80">{count}</span>}
          <ChevronRight
            className={cn(
              "size-3 transition-[transform,opacity] duration-200",
              folded ? "opacity-100" : "rotate-90 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
            )}
          />
        </button>
        <span className={cn("ml-auto opacity-0 transition-opacity group-hover:opacity-100 [&:has([aria-expanded=true])]:opacity-100", TOUCH_SHOW)}>{action}</span>
      </div>
      {!folded && <div className="space-y-px">{children}</div>}
    </div>
  );
}

function NavLink({ href, icon, active, children }: { href: string; icon: ReactNode; active?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-1.5 text-[13.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink [&_svg]:size-4 [&_svg]:text-ink-3",
        TOUCH_ROW,
        active && "bg-hover font-medium text-ink [&_svg]:text-ink",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

const COLORS = ["sky", "clay", "moss", "plum", "sand", "rose", "teal"] as const;

/** "+" next to "Fächer" or "Notizbücher": a name, and it's there. */
export function NewSubjectButton({ kind }: { kind: SubjectKind }) {
  const { createSubject } = useWorkspace();
  const t = useMessages(shellText).sidebar;
  const [name, setName] = useState("");
  const notebook = kind === "notebook";
  const label = notebook ? t.addNotebook : t.addSubject;
  return (
    <Popover
      align="end"
      trigger={(props) => (
        <button {...props} className={cn("grid size-5 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink", TOUCH_ICON)} aria-label={label} title={label}>
          <Plus className="size-3.5" />
        </button>
      )}
      className="w-[240px] p-2"
      role="dialog"
      label={notebook ? t.newNotebook : t.newSubject}
    >
      {(close) => (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await createSubject({ name, kind, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
            setName("");
            close();
          }}
        >
          <div className="mb-1.5 px-0.5 text-[12px] font-medium text-ink-2">{notebook ? t.newNotebook : t.newSubject}</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={notebook ? t.notebookPlaceholder : t.subjectPlaceholder}
            maxLength={60}
            className="h-8 w-full rounded-md border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
          />
        </form>
      )}
    </Popover>
  );
}

function AccountMenu({ name, email, theme, onTheme }: { name: string | null; email: string; theme: Theme; onTheme: (t: Theme) => void }) {
  const router = useRouter();
  const t = useMessages(shellText).sidebar;
  const initial = (name || email || "?").trim()[0]?.toUpperCase();

  function pick(t: Theme) {
    applyTheme(t);
    onTheme(t);
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Popover
      side="top"
      align="start"
      className="w-[244px]"
      trigger={(props) => (
        <button {...props} className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob text-[11.5px] font-semibold text-white">{initial}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium leading-tight">{name || t.you}</span>
            <span className="block truncate text-[11.5px] leading-tight text-ink-3" title={email}>
              {email}
            </span>
          </span>
          <Ellipsis className="size-4 text-ink-3" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t.theme}</MenuLabel>
          <div className="mx-1 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-paper p-0.5">
            {(
              [
                ["light", <Sun key="l" />, t.light],
                ["dark", <Moon key="d" />, t.dark],
                ["system", <Monitor key="s" />, t.auto],
              ] as const
            ).map(([value, icon, label]) => (
              <button
                key={value}
                onClick={() => pick(value)}
                className={cn(
                  "flex h-7 items-center justify-center gap-1 rounded-md text-[12px] text-ink-3 transition-colors [&_svg]:size-3.5",
                  theme === value ? "bg-raised font-medium text-ink shadow-card" : "hover:text-ink",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <MenuSeparator />
          <MenuItem icon={<Settings />} onSelect={() => (close(), router.push("/settings"))}>
            {t.settings}
          </MenuItem>
          <MenuItem icon={<LogOut />} onSelect={signOut}>
            {t.signOut}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}
