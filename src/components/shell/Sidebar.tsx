"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BadgeQuestionMark,
  BookMarked,
  ChevronRight,
  Ellipsis,
  FileText,
  FileUser,
  Folder,
  FolderOpen,
  GraduationCap,
  House,
  ListChecks,
  CalendarDays,
  LogOut,
  Monitor,
  Moon,
  NotebookPen,
  Signature,
  PanelLeftClose,
  Plus,
  Presentation,
  Search,
  Settings,
  Sheet as SheetIcon,
  ShieldCheck,
  SquareKanban,
  Star,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BlobMark } from "@/components/blob/BlobMark";
import { useImporter } from "@/components/notes/useImporter";
import { useShareInfo } from "@/components/notes/useShared";
import { Avatar } from "@/components/share/Avatar";
import { applyTheme } from "@/components/theme";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/Menu";
import { groupLabel } from "@/components/ui/surfaces";
import { ModKey, useModKey } from "@/components/ui/ModKey";
import { PageMenuArea } from "@/components/notes/PageMenuArea";
import { useWorkspace } from "@/components/workspace/WorkspaceProvider";
import { NewPageMenu, type NewKind } from "@/components/shell/NewPageMenu";
import { SubjectMenu } from "@/components/shell/SubjectMenu";
import { useLocale, useMessages } from "@/i18n/client";
import { adminText } from "@/i18n/messages/admin";
import { newPageText } from "@/i18n/messages/newPage";
import { shellText } from "@/i18n/messages/shell";
import { subjectColor } from "@/lib/subjects";
import { createClient } from "@/lib/supabase/client";
import type { PageMeta, Subject, SubjectKind, Theme } from "@/lib/types";
import { cn, pageTitle } from "@/lib/utils";
import { forgetDevice } from "@/lib/offline/device";
import { isNetworkError, isOnline, reportNetworkError } from "@/lib/offline/net";
import { useSignOutGuard } from "@/components/offline/useSignOutGuard";
import { holdDeniedDrafts } from "@/components/sheet/DeniedDrafts";
import { showSignedOut } from "@/components/shell/SignedOut";

// Touch screens (the phone drawer, tablets) get taller rows, bigger icon buttons and always-visible
// row actions: there is no hover to reveal them and 28 px rows are too small for a finger.
const TOUCH_ROW = "[@media(hover:none)]:h-9";
const TOUCH_ICON = "[@media(hover:none)]:size-8";
const TOUCH_SHOW = "focus-within:opacity-100 [@media(hover:none)]:opacity-100";

// A row of the sidebar (a place, a page, a favourite). The one you're on is a raised chip with its
// icon in violet, like the chosen tab of the calendar and the spreadsheet; the others light up grey.
const ROW = "rounded-lg text-[13.5px] transition-colors";
const ROW_ON = "bg-raised font-medium text-ink shadow-card";
const ROW_OFF = "text-ink-2 hover:bg-hover hover:text-ink";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-blob";
/** Small text that says something (an empty section): lighter than ink-2, still 4.5:1. */
const MID = "text-[color-mix(in_srgb,var(--ink-2)_45%,var(--ink-3))]";

/** The violet "+" that makes a page (next to the search, and in the tablet rail); add its size and radius. */
export const NEW_PAGE_BUTTON =
  "grid shrink-0 place-items-center bg-blob text-white shadow-card transition-[background-color,transform] duration-150 hover:bg-blob-deep active:scale-[0.96] aria-expanded:bg-blob-deep dark:bg-blob-deep dark:hover:bg-[color-mix(in_srgb,var(--blob-deep)_88%,white)] dark:aria-expanded:bg-[color-mix(in_srgb,var(--blob-deep)_88%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blob focus-visible:ring-offset-2 focus-visible:ring-offset-paper motion-reduce:transition-none motion-reduce:active:scale-100";

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
  const Icon =
    page.kind === "deck"
      ? Presentation
      : page.kind === "cv"
        ? FileUser
        : page.kind === "folder"
          ? open
            ? FolderOpen
            : Folder
          : page.kind === "ink"
            ? Signature
            : page.kind === "sheet"
              ? SheetIcon
              : FileText;
  return <Icon className={cn("size-4 shrink-0 text-ink-3", className)} strokeWidth={1.8} />;
}

/** The icon of a subject or notebook: its emoji, else a dot in its colour (notebooks: a notebook). */
export function SubjectIcon({ subject, className }: { subject: Pick<Subject, "emoji" | "color" | "kind">; className?: string }) {
  if (subject.emoji) return <span className={cn("text-[13px] leading-none", className)}>{subject.emoji}</span>;
  if (subject.kind === "notebook") return <BookMarked className={cn("size-3.5", className)} style={{ color: subjectColor(subject.color) }} strokeWidth={2} />;
  return <span className={cn("size-2 rounded-full", className)} style={{ background: subjectColor(subject.color) }} />;
}

/** Makes a page of a kind and opens it (the sidebar's "+", the tablet rail's "+"). The workspace guards against a double click. */
export function useNewPage() {
  const router = useRouter();
  const { createPage } = useWorkspace();
  return async (kind: NewKind, extra: { subject_id?: string | null; parent_id?: string | null } = {}) => {
    const page = await createPage({ kind, ...extra });
    if (page) router.push(`/p/${page.id}`);
    return page;
  };
}

type NavItem = { href: string; label: string; icon: ReactNode; active: boolean };

/**
 * The main places, in the sidebar and the tablet rail. "Blobxcel" (your spreadsheets: Notizen with
 * the kind "sheet") sits under "Notizen" and is the one lit there, not "Notizen". `kind` is the
 * address's ?kind=. The rail has no tree: on a page it lights where the page belongs (a
 * spreadsheet Blobxcel, the other pages Notizen), as the phone tabs do.
 */
function useMainNav(kind: string | null, rail: boolean): NavItem[] {
  const pathname = usePathname();
  const { pages } = useWorkspace();
  const t = useMessages(shellText).sidebar;
  // A CV keeps "Lebenslauf" lit (CVs are not in the tree).
  const openPage = pathname.startsWith("/p/") ? pages.find((p) => p.id === pathname.slice(3)) : undefined;
  const inPage = rail && !!openPage && openPage.kind !== "cv";
  const sheets = (pathname === "/notes" && kind === "sheet") || (inPage && openPage.kind === "sheet");
  const notes = ((pathname === "/notes" || pathname.startsWith("/notes/")) && !sheets) || (inPage && openPage.kind !== "sheet");
  return [
    { href: "/home", label: t.home, icon: <House />, active: pathname === "/home" },
    { href: "/notes", label: t.notesHome, icon: <NotebookPen />, active: notes },
    { href: "/notes?kind=sheet", label: t.blobxcel, icon: <SheetIcon />, active: sheets },
    { href: "/learn", label: t.learn, icon: <GraduationCap />, active: pathname.startsWith("/learn") },
    { href: "/tasks", label: t.tasks, icon: <ListChecks />, active: pathname === "/tasks" },
    { href: "/calendar", label: t.calendar, icon: <CalendarDays />, active: pathname === "/calendar" },
    { href: "/projects", label: t.projects, icon: <SquareKanban />, active: pathname === "/projects" || pathname.startsWith("/projects/") },
    { href: "/cv", label: t.cv, icon: <FileUser />, active: pathname === "/cv" || openPage?.kind === "cv" },
    { href: "/quiz", label: t.quiz, icon: <BadgeQuestionMark />, active: pathname === "/quiz" || pathname.startsWith("/quiz/") },
    { href: "/blob", label: t.blob, icon: <BlobMark />, active: pathname === "/blob" },
  ];
}

function MainNavLinks({ variant, kind }: { variant: "list" | "rail"; kind: string | null }) {
  const items = useMainNav(kind, variant === "rail");
  return items.map((item) =>
    variant === "rail" ? (
      <RailLink key={item.href} {...item} />
    ) : (
      <NavLink key={item.href} href={item.href} icon={item.icon} active={item.active}>
        {item.label}
      </NavLink>
    ),
  );
}

function MainNavHere({ variant }: { variant: "list" | "rail" }) {
  const kind = useSearchParams().get("kind");
  return <MainNavLinks variant={variant} kind={kind} />;
}

/**
 * The main places as links: rows in the sidebar, icons in the tablet rail. (The address's query
 * is read under Suspense, as Next.js asks: a page rendered ahead of time shows the links with
 * "Notizen" lit on /notes until it is known.)
 */
export function MainNav({ variant }: { variant: "list" | "rail" }) {
  return (
    <Suspense fallback={<MainNavLinks variant={variant} kind={null} />}>
      <MainNavHere variant={variant} />
    </Suspense>
  );
}

export function Sidebar({
  onCollapse,
  onSearch,
  isAdmin = false,
  drawer = false,
}: {
  onCollapse: () => void;
  onSearch: () => void;
  isAdmin?: boolean;
  /** In the drawer on phones and tablets: its button closes the menu. */
  drawer?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { pages, subjects, createPage, userId, sharedIds } = useWorkspace();
  const importer = useImporter();
  const locale = useLocale();
  const t = useMessages(shellText).sidebar;
  const tn = useMessages(newPageText);
  const mod = useModKey();
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
          data-page-id={page.id}
          className={cn("group relative flex h-7 items-center gap-1.5 pr-1", ROW, TOUCH_ROW, active ? ROW_ON : ROW_OFF)}
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
          <Link
            href={`/p/${page.id}`}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md focus-visible:ring-inset", FOCUS, active && "[&>svg:first-child]:text-blob-ink")}
            title={title}
          >
            <PageIcon page={page} open={folder && open} />
            <span className="truncate">{title}</span>
            {sharedMark && <Users className="size-3 shrink-0 text-ink-3" aria-label={t.sharedByYou} />}
          </Link>
          {trailing}
          {addable &&
            (folder ? (
              <AddMenu
                label={t.addInside}
                className={cn("opacity-0 focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100", TOUCH_SHOW)}
                onPick={(kind) => newPage(kind, { parent_id: page.id, subject_id: page.subject_id })}
                onImport={() => importer.pick({ parentId: page.id })}
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
                <div className={cn("flex h-7 items-center text-[12.5px]", MID, TOUCH_ROW)} style={{ paddingLeft: 30 + depth * 14 }}>
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
        <div className={cn("group flex h-7 items-center gap-1.5 pl-1.5 pr-1", ROW, TOUCH_ROW, active ? ROW_ON : ROW_OFF)}>
          <button
            onClick={() => toggleFolded(subject.id)}
            className={cn("grid size-4 shrink-0 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink", TOUCH_ICON)}
            aria-label={open ? (notebook ? t.collapseNotebook : t.collapseSubject) : notebook ? t.expandNotebook : t.expandSubject}
            aria-expanded={open}
          >
            <ChevronRight className={cn("size-3 transition-transform duration-200", open && "rotate-90")} />
          </button>
          <Link
            href={`/subjects/${subject.id}`}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-md focus-visible:ring-inset", FOCUS)}
            title={subject.name}
          >
            <span className="grid size-4 shrink-0 place-items-center">
              <SubjectIcon subject={subject} />
            </span>
            <span className="truncate">{subject.name}</span>
            {subject.emoji && <span className="ml-auto size-1.5 shrink-0 rounded-full opacity-80" style={{ background: subjectColor(subject.color) }} />}
          </Link>
          <div className={cn("flex opacity-0 group-hover:opacity-100 [&:has([aria-expanded=true])]:opacity-100", TOUCH_SHOW)}>
            <SubjectMenu subject={subject} />
            <AddMenu label={t.addTo(subject.name)} onPick={(kind) => newPage(kind, { subject_id: subject.id })} onImport={() => importer.pick({ subjectId: subject.id })} />
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
                  className={cn("flex h-7 w-full items-center gap-2 rounded-lg pl-[34px] text-[12.5px] hover:bg-hover hover:text-ink", MID, FOCUS, TOUCH_ROW)}
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
        <Link href="/home" className={cn("flex min-w-0 items-center gap-2 rounded-md [@media(hover:none)]:h-9", FOCUS)}>
          <BlobMark size={22} />
          <span className="font-display text-[17px] font-bold tracking-[-0.03em]">Blob</span>
        </Link>
        <button
          onClick={onCollapse}
          className={cn("ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-hover hover:text-ink [@media(hover:none)]:size-9", FOCUS)}
          aria-label={drawer ? t.closeMenu : t.hide}
          title={drawer ? t.closeMenu : t.hideTitle(mod)}
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="space-y-0.5 px-2">
        {/* Search and, beside it, the violet "+": every kind of page, with what it is for. */}
        <div className="mb-1.5 flex gap-1.5">
          <button
            onClick={onSearch}
            title={t.searchTitle(mod)}
            className={cn(
              "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[13px] shadow-card transition-colors hover:border-line-2 hover:text-ink-2 [@media(hover:none)]:h-9",
              MID,
              FOCUS,
            )}
          >
            <Search className="size-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-left">{t.search}</span>
            <ModKey k="K" className="flex shrink-0 gap-0.5 [@media(hover:none)]:hidden" />
          </button>
          <NewPageMenu
            align="start"
            onPick={(kind) => newPage(kind)}
            onImport={() => importer.pick()}
            trigger={({ ref, ...p }) => (
              <button ref={ref} {...p} type="button" aria-label={tn.label} title={tn.title} className={cn(NEW_PAGE_BUTTON, "size-8 rounded-lg [@media(hover:none)]:size-9")}>
                <Plus className="size-4" strokeWidth={2.4} aria-hidden />
              </button>
            )}
          />
        </div>
        <MainNav variant="list" />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <PageMenuArea>
          {favorites.length > 0 && (
            <Section title={t.favorites} {...sectionProps("favorites", favorites.length)}>
              {favorites.map((p) => {
                const active = pathname === `/p/${p.id}`;
                return (
                  <Link
                    key={p.id}
                    href={`/p/${p.id}`}
                    data-page-id={p.id}
                    aria-current={active ? "page" : undefined}
                    title={pageTitle(p.title, p.kind, locale)}
                    className={cn("flex h-7 items-center gap-2 px-1.5", ROW, FOCUS, TOUCH_ROW, active ? ROW_ON : ROW_OFF)}
                  >
                    <Star className="size-3.5 shrink-0 fill-blob text-blob" />
                    <span className="truncate">{pageTitle(p.title, p.kind, locale)}</span>
                  </Link>
                );
              })}
            </Section>
          )}

          <Section title={t.subjects} action={<NewSubjectButton kind="subject" />} {...sectionProps("subjects", schoolSubjects.length)}>
            {schoolSubjects.length === 0 && <p className={cn("px-1.5 py-1 text-[12.5px] leading-snug", MID)}>{t.noSubjects}</p>}
            {schoolSubjects.map(renderSubject)}
          </Section>

          <Section title={t.notebooks} action={<NewSubjectButton kind="notebook" />} {...sectionProps("notebooks", notebooks.length)}>
            {notebooks.length === 0 && <p className={cn("px-1.5 py-1 text-[12.5px] leading-snug", MID)}>{t.noNotebooks}</p>}
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
            {unfiled.length === 0 ? <p className={cn("px-1.5 py-1 text-[12.5px] leading-snug", MID)}>{t.noNotes}</p> : unfiled.map((p) => renderPage(p, 0))}
          </Section>
        </PageMenuArea>
      </div>

      <div className="shrink-0 space-y-0.5 border-t border-line px-2 py-2">
        {isAdmin && (
          <NavLink href="/admin" icon={<ShieldCheck />} active={pathname === "/admin" || pathname.startsWith("/admin/")}>
            {adminLabel}
          </NavLink>
        )}
        <NavLink href="/trash" icon={<Trash2 />} active={pathname === "/trash"}>
          {t.trash}
        </NavLink>
        <AccountMenu />
      </div>
    </nav>
  );
}

/** The small "+" of a subject or a folder in the tree: the create menu, for that place. */
function AddMenu({ label, onPick, onImport, className }: { label: string; onPick: (kind: NewKind) => void; onImport?: () => void; className?: string }) {
  return (
    <NewPageMenu
      align="start"
      onPick={onPick}
      onImport={onImport}
      trigger={({ ref, ...p }) => (
        <button
          ref={ref}
          {...p}
          type="button"
          className={cn("grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-line hover:text-ink aria-expanded:bg-line aria-expanded:text-ink", FOCUS, TOUCH_ICON, className)}
          aria-label={label}
          title={label}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    />
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
          className={cn("flex h-full items-center gap-1 rounded-md px-1 transition-colors hover:text-ink-2", groupLabel, FOCUS)}
        >
          {title}
          {folded && count > 0 && <span className="tabular-nums">{count}</span>}
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
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 items-center gap-2 px-1.5 [&_svg]:size-4",
        ROW,
        FOCUS,
        TOUCH_ROW,
        active ? cn(ROW_ON, "[&_svg]:text-blob-ink") : cn(ROW_OFF, "[&_svg]:text-ink-3"),
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

/** A place in the tablet rail: its icon, its name as the tooltip and for screen readers. */
function RailLink({ href, label, icon, active }: NavItem) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl transition-colors [&_svg]:size-[18px]",
        FOCUS,
        active ? "bg-raised text-blob-ink shadow-card" : "text-ink-3 hover:bg-hover hover:text-ink",
      )}
    >
      {icon}
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
        <button {...props} className={cn("grid size-5 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink", FOCUS, TOUCH_ICON)} aria-label={label} title={label}>
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
            className="h-8 w-full rounded-lg border border-line bg-surface px-2 text-[13px] outline-none focus:border-blob"
          />
        </form>
      )}
    </Popover>
  );
}

/**
 * You: the theme, the settings and signing out. A row with your name at the bottom of the sidebar,
 * or (`variant="avatar"`) just your initial at the bottom of the tablet rail, opening to its right.
 */
export function AccountMenu({ variant = "row" }: { variant?: "row" | "avatar" }) {
  const router = useRouter();
  const guard = useSignOutGuard();
  const { profile, email, setProfile } = useWorkspace();
  const t = useMessages(shellText).sidebar;
  const name = profile.full_name;
  const theme = profile.theme;
  const initial = (name || email || "?").trim()[0]?.toUpperCase();
  const rail = variant === "avatar";

  function pick(t: Theme) {
    applyTheme(t);
    setProfile({ theme: t });
  }

  async function signOut() {
    // One question at a time: the guard's (what can't be sent would be deleted). Blob's question
    // about spreadsheet work it can't save any more waits meanwhile (the guard counts that work too),
    // and comes when signing out is called off, so the work can still be kept as a copy first.
    const release = holdDeniedDrafts();
    let go = false;
    try {
      go = await guard.ready();
      if (!go) return;
      // (Without a connection this still signs out here, on this device.)
      const { error } = await createClient().auth.signOut();
      if (error && isNetworkError(error, error.status)) reportNetworkError();
      // Offline the sign-in page can't load (the browser would show its own "no internet" page):
      // Blob says it's signed out in the app's place (SignedOut.tsx) and opens the sign-in page once
      // it's back online. The account's pages close first, so whatever they save as they close is
      // removed with the rest below.
      const offline = !isOnline();
      if (offline) flushSync(showSignedOut);
      // Nothing of the account stays on this device (its offline copies, unsent changes).
      await forgetDevice();
      if (offline) return;
      router.replace("/login");
      router.refresh();
    } finally {
      release(!go);
    }
  }

  // (White on the dark theme's lighter violet is under 4.5:1: the deeper one there.)
  const dot = "grid shrink-0 place-items-center rounded-full bg-blob font-semibold text-white dark:bg-blob-deep";

  return (
    <>
      <Popover
        side={rail ? "right" : "top"}
        align="start"
        className="w-[244px]"
        trigger={(props) =>
          rail ? (
            <button
              {...props}
              data-account-menu=""
              aria-label={t.account}
              title={name ? `${name} · ${email}` : email}
              className={cn("grid size-10 shrink-0 place-items-center rounded-xl hover:bg-hover aria-expanded:bg-hover", FOCUS)}
            >
              <span className={cn(dot, "size-7 text-[12px]")}>{initial}</span>
            </button>
          ) : (
            <button {...props} data-account-menu="" className={cn("flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-left hover:bg-hover aria-expanded:bg-hover", FOCUS)}>
              <span className={cn(dot, "size-6 text-[11.5px]")}>{initial}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">{name || t.you}</span>
                <span className={cn("block truncate text-[11.5px] leading-tight", MID)} title={email}>
                  {email}
                </span>
              </span>
              <Ellipsis className="size-4 text-ink-3" />
            </button>
          )
        }
      >
        {(close) => (
          <>
            {rail && (
              <div className="px-2 pb-1.5 pt-1">
                <span className="block truncate text-[13px] font-medium leading-tight text-ink">{name || t.you}</span>
                <span className={cn("block truncate text-[11.5px] leading-tight", MID)}>{email}</span>
              </div>
            )}
            <div className={cn("px-2 pb-1 pt-1.5", groupLabel)}>{t.theme}</div>
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
                  aria-pressed={theme === value}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1 rounded-md text-[12px] transition-colors [&_svg]:size-3.5",
                    theme === value ? "bg-raised font-medium text-ink shadow-card" : "text-ink-2 hover:text-ink",
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
            {/* (The menu closes first: what signing out asks is then the only thing open, and the
                keyboard comes back to the account button once it is answered. The button whose
                menu is open: on narrow screens the drawer and the tablet rail have their own, the
                sidebar's is hidden.) */}
            <MenuItem
              icon={<LogOut />}
              onSelect={() => {
                const button = document.querySelector<HTMLElement>('[data-account-menu][aria-expanded="true"]');
                close();
                button?.focus();
                void signOut();
              }}
            >
              {t.signOut}
            </MenuItem>
          </>
        )}
      </Popover>
      {guard.dialog}
    </>
  );
}
