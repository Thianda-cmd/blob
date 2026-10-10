"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { newCv } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { workspaceText } from "@/i18n/messages/workspace";
import { useTableChanges } from "@/lib/live";
import { cleanLook } from "@/components/blob/look";
import { BlobLookProvider } from "@/components/blob/LookContext";
import { createClient } from "@/lib/supabase/client";
import {
  PAGE_META_COLUMNS,
  type DeckContent,
  type PageKind,
  type PageMeta,
  type Profile,
  type Subject,
  type SubjectColor,
  type SubjectKind,
} from "@/lib/types";
import { uid } from "@/lib/utils";

/** Starter slides for a new presentation, written in `locale`. */
export function newDeckContent(title: string | undefined, locale: Locale): DeckContent {
  const t = workspaceText[locale].deck;
  return {
    theme: "paper",
    slides: [
      { id: uid(), layout: "title", title: title || t.title, body: t.subtitle, image: null, notes: "" },
      { id: uid(), layout: "bullets", title: t.bulletsTitle, body: t.bullets, image: null, notes: "" },
    ],
  };
}

type NewPage = {
  kind?: PageKind;
  subject_id?: string | null;
  parent_id?: string | null;
  title?: string;
  icon?: string | null;
  /** What the page starts with (a CV from the "new CV" dialog, a copy); otherwise the kind's starter content. */
  content?: unknown;
  /** The searchable text of `content`. */
  plain_text?: string;
  tags?: string[];
  /** Learning-center topics ("fractions", "fractions@2"). */
  topics?: string[];
  /** Pages `content` links to (for backlinks). */
  links?: string[];
};

type Workspace = {
  userId: string;
  email: string;
  profile: Profile;
  subjects: Subject[];
  pages: PageMeta[];
  setProfile: (patch: Partial<Profile>) => Promise<boolean>;
  createPage: (input?: NewPage) => Promise<PageMeta | null>;
  updatePage: (id: string, patch: Partial<PageMeta>, opts?: { local?: boolean }) => Promise<boolean>;
  trashPage: (id: string) => Promise<boolean>;
  /** A school subject, or a notebook (`kind: "notebook"`) for everything else. */
  createSubject: (input: { name: string; color?: SubjectColor; emoji?: string | null; kind?: SubjectKind }) => Promise<Subject | null>;
  updateSubject: (id: string, patch: Partial<Subject>) => Promise<boolean>;
  deleteSubject: (id: string) => Promise<boolean>;
  /** Re-add pages that were restored somewhere else (e.g. the trash). */
  upsertPages: (pages: PageMeta[]) => void;
  removePages: (ids: string[]) => void;
  /** Pages with members (shared by you or with you): the sidebar marks them. */
  sharedIds: Set<string>;
  /** Load the pages again (after joining or leaving a shared page). */
  reloadPages: () => Promise<void>;
};

const Ctx = createContext<Workspace | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

function oops(message: string) {
  blob.say(message, { mood: "worried" });
  blob.react("shake", "worried");
}

/**
 * The server's pages, except where this tab knows better: a page changed here after the server's
 * copy (a title being typed) keeps its local version, and a page created in the last half minute
 * stays even if the server's list was read just before it existed.
 */
function mergePages(local: PageMeta[], server: PageMeta[]): PageMeta[] {
  const byId = new Map(local.map((p) => [p.id, p]));
  const now = Date.now();
  const merged = server.map((p) => {
    const mine = byId.get(p.id);
    return mine && mine.updated_at > p.updated_at ? { ...p, title: mine.title, icon: mine.icon } : p;
  });
  const ids = new Set(server.map((p) => p.id));
  const fresh = local.filter((p) => !ids.has(p.id) && now - new Date(p.created_at).getTime() < 30_000);
  return [...merged, ...fresh];
}

/** Every descendant of `id` (children, grandchildren…). */
export function descendantsOf(pages: PageMeta[], id: string): string[] {
  const out: string[] = [];
  const seen = new Set([id]);
  const walk = (parent: string) => {
    for (const p of pages) {
      // (Each page once, even if old data has a loop.)
      if (p.parent_id === parent && !seen.has(p.id)) {
        seen.add(p.id);
        out.push(p.id);
        walk(p.id);
      }
    }
  };
  walk(id);
  return out;
}

export function WorkspaceProvider({
  userId,
  email,
  initialProfile,
  initialSubjects,
  initialPages,
  children,
}: {
  userId: string;
  email: string;
  initialProfile: Profile;
  initialSubjects: Subject[];
  initialPages: PageMeta[];
  children: ReactNode;
}) {
  const [profile, setProfileState] = useState(initialProfile);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [pages, setPages] = useState(initialPages);
  const [sharedIds, setSharedIds] = useState<Set<string>>(() => new Set());
  const locale = useLocale();
  const t = useMessages(workspaceText);

  // The layout loads pages and subjects again when the route refreshes (after sharing, joining or
  // leaving): take its fresh copy, but keep local changes that are newer (a title being typed) and
  // pages created a moment ago.
  const [seen, setSeen] = useState({ pages: initialPages, subjects: initialSubjects });
  if (seen.pages !== initialPages || seen.subjects !== initialSubjects) {
    setSeen({ pages: initialPages, subjects: initialSubjects });
    if (seen.pages !== initialPages) setPages((local) => mergePages(local, initialPages));
    if (seen.subjects !== initialSubjects) setSubjects(initialSubjects);
  }

  const reloadPages = useCallback(async () => {
    const supabase = createClient();
    const [pagesRes, membersRes] = await Promise.all([
      supabase.from("pages").select(PAGE_META_COLUMNS).is("trashed_at", null).order("position"),
      supabase.from("page_members").select("page_id"),
    ]);
    if (pagesRes.data) setPages((local) => mergePages(local, pagesRes.data as PageMeta[]));
    if (membersRes.data) setSharedIds(new Set((membersRes.data as { page_id: string }[]).map((m) => m.page_id)));
  }, []);

  // Which pages are shared (by you or with you): once now, again when the route refreshes.
  const loadedFor = useRef<PageMeta[] | null>(null);
  useEffect(() => {
    if (loadedFor.current === initialPages) return;
    loadedFor.current = initialPages;
    let cancelled = false;
    void createClient()
      .from("page_members")
      .select("page_id")
      .then(({ data }) => {
        if (!cancelled && data) setSharedIds(new Set((data as { page_id: string }[]).map((m) => m.page_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [initialPages]);

  // Someone shares a page with you (or takes you off one): it shows up in the sidebar right away.
  useTableChanges("page_members", `user_id=eq.${userId}`, () => void reloadPages());

  const setProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setProfileState((p) => ({ ...p, ...patch }));
      const { error } = await createClient().from("profiles").update(patch).eq("id", userId);
      if (error) oops(t.notSaved);
      return !error;
    },
    [userId, t],
  );

  // Requests for the same new page while one is on its way get that one (a button pressed again).
  const creating = useRef(new Map<string, Promise<PageMeta | null>>());

  const create = useCallback(
    async (input: NewPage) => {
      const kind = input.kind ?? "note";
      const siblings = pages.filter((p) => p.parent_id === (input.parent_id ?? null));
      const position = siblings.reduce((max, p) => Math.max(max, p.position), 0) + 1;
      // Your page inside someone else's shared page is yours, but has no subject (theirs decides where it lives).
      const parent = input.parent_id ? pages.find((p) => p.id === input.parent_id) : undefined;
      const foreignParent = Boolean(parent && parent.user_id !== userId);
      const { data, error } = await createClient()
        .from("pages")
        .insert({
          kind,
          title: input.title ?? "",
          icon: input.icon ?? null,
          subject_id: foreignParent ? null : (input.subject_id ?? null),
          parent_id: input.parent_id ?? null,
          position,
          // A folder only holds pages: it has no content of its own.
          content: input.content ?? (kind === "deck" ? newDeckContent(input.title, locale) : kind === "cv" ? newCv(locale) : {}),
          ...(input.plain_text !== undefined && { plain_text: input.plain_text }),
          ...(input.tags?.length && { tags: input.tags.slice(0, 20) }),
          ...(input.topics?.length && { topics: input.topics.slice(0, 20) }),
          ...(input.links?.length && { links: input.links.slice(0, 500) }),
        })
        .select(PAGE_META_COLUMNS)
        .single();
      if (error || !data) {
        oops(t.createFailed);
        return null;
      }
      setPages((ps) => [...ps, data as PageMeta]);
      return data as PageMeta;
    },
    [pages, locale, t, userId],
  );

  const createPage = useCallback(
    (input: NewPage = {}) => {
      // The button that asked for the page lets go of the keyboard: Space or Enter typed right after
      // (while the new page is still opening) must not press it again and make more pages.
      const el = typeof document === "undefined" ? null : document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === "BUTTON" || el.getAttribute("role")?.startsWith("menuitem"))) el.blur();
      const key = JSON.stringify([input.kind ?? "note", input.parent_id ?? null, input.subject_id ?? null, input.title ?? ""]);
      const running = creating.current.get(key);
      if (running) return running;
      const request = create(input).finally(() => creating.current.delete(key));
      creating.current.set(key, request);
      return request;
    },
    [create],
  );

  const updatePage = useCallback(async (id: string, patch: Partial<PageMeta>, opts?: { local?: boolean }) => {
    let before: PageMeta | undefined;
    setPages((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        before = p;
        return { ...p, ...patch, updated_at: new Date().toISOString() };
      }),
    );
    if (opts?.local) return true;
    const { error } = await createClient().from("pages").update(patch).eq("id", id);
    if (error) {
      // Show the page where it really is again (a refused move, a lost connection).
      const keys = Object.keys(patch) as (keyof PageMeta)[];
      if (before) {
        const was = before;
        setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...Object.fromEntries(keys.map((k) => [k, was[k]])) } : p)));
      }
      oops(t.notSaved);
    }
    return !error;
  }, [t]);

  const trashPage = useCallback(
    async (id: string) => {
      // Only your own pages go to the trash (pages shared with you stay with their owner).
      const ids = [id, ...descendantsOf(pages, id)].filter((x) => pages.find((p) => p.id === x)?.user_id === userId);
      if (!ids.length) return false;
      const trashed_at = new Date().toISOString();
      const removed = pages.filter((p) => ids.includes(p.id));
      setPages((ps) => ps.filter((p) => !ids.includes(p.id)));
      const { error } = await createClient().from("pages").update({ trashed_at }).in("id", ids);
      if (error) {
        // Not trashed after all: put the pages back where they were (the sidebar, the CV home…).
        setPages((ps) => [...ps, ...removed.filter((r) => !ps.some((p) => p.id === r.id))]);
        oops(t.notSaved);
        return false;
      }
      blob.say(t.trashed, { mood: "idle" });
      return true;
    },
    [pages, t, userId],
  );

  const createSubject = useCallback(
    async (input: { name: string; color?: SubjectColor; emoji?: string | null; kind?: SubjectKind }) => {
      const position = subjects.reduce((max, s) => Math.max(max, s.position), 0) + 1;
      const { data, error } = await createClient()
        .from("subjects")
        .insert({ name: input.name.trim().slice(0, 60), color: input.color ?? "ink", emoji: input.emoji ?? null, position, kind: input.kind ?? "subject" })
        .select()
        .single();
      if (error || !data) {
        oops(t.subjectFailed);
        return null;
      }
      setSubjects((s) => [...s, data as Subject]);
      blob.say(t.subjectAdded(input.name.trim()), { mood: "happy" });
      return data as Subject;
    },
    [subjects, t],
  );

  const updateSubject = useCallback(async (id: string, patch: Partial<Subject>) => {
    setSubjects((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await createClient().from("subjects").update(patch).eq("id", id);
    if (error) oops(t.notSaved);
    return !error;
  }, [t]);

  const deleteSubject = useCallback(async (id: string) => {
    setSubjects((ss) => ss.filter((s) => s.id !== id));
    setPages((ps) => ps.map((p) => (p.subject_id === id ? { ...p, subject_id: null } : p)));
    const { error } = await createClient().from("subjects").delete().eq("id", id);
    if (error) oops(t.notSaved);
    return !error;
  }, [t]);

  const upsertPages = useCallback((incoming: PageMeta[]) => {
    setPages((ps) => {
      const map = new Map(ps.map((p) => [p.id, p]));
      incoming.forEach((p) => map.set(p.id, p));
      return [...map.values()];
    });
  }, []);

  const removePages = useCallback((ids: string[]) => {
    setPages((ps) => ps.filter((p) => !ids.includes(p.id)));
  }, []);

  const value = useMemo<Workspace>(
    () => ({
      userId,
      email,
      profile,
      subjects: [...subjects].sort((a, b) => a.position - b.position),
      pages,
      setProfile,
      createPage,
      updatePage,
      trashPage,
      createSubject,
      updateSubject,
      deleteSubject,
      upsertPages,
      removePages,
      sharedIds,
      reloadPages,
    }),
    [userId, email, profile, subjects, pages, setProfile, createPage, updatePage, trashPage, createSubject, updateSubject, deleteSubject, upsertPages, removePages, sharedIds, reloadPages],
  );

  // Every Blob in the workspace wears the student's look.
  const blobLook = useMemo(() => cleanLook(profile.blob_look), [profile.blob_look]);

  return (
    <Ctx.Provider value={value}>
      <BlobLookProvider look={blobLook}>{children}</BlobLookProvider>
    </Ctx.Provider>
  );
}

