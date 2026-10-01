"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { blob } from "@/components/blob/bus";
import { createClient } from "@/lib/supabase/client";
import {
  PAGE_META_COLUMNS,
  type DeckContent,
  type PageKind,
  type PageMeta,
  type Profile,
  type Subject,
  type SubjectColor,
} from "@/lib/types";
import { uid } from "@/lib/utils";

export function newDeckContent(title = ""): DeckContent {
  return {
    theme: "paper",
    slides: [
      { id: uid(), layout: "title", title: title || "Your big idea", body: "A short subtitle, or your name", image: null, notes: "" },
      { id: uid(), layout: "bullets", title: "Three things to know", body: "First point\nSecond point\nThird point", image: null, notes: "" },
    ],
  };
}

type NewPage = { kind?: PageKind; subject_id?: string | null; parent_id?: string | null; title?: string; icon?: string | null };

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
  createSubject: (input: { name: string; color?: SubjectColor; emoji?: string | null }) => Promise<Subject | null>;
  updateSubject: (id: string, patch: Partial<Subject>) => Promise<boolean>;
  deleteSubject: (id: string) => Promise<boolean>;
  /** Re-add pages that were restored somewhere else (e.g. the trash). */
  upsertPages: (pages: PageMeta[]) => void;
  removePages: (ids: string[]) => void;
};

const Ctx = createContext<Workspace | null>(null);

export function useWorkspace() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

function oops(message = "Hmm, that didn't save. Check your connection?") {
  blob.say(message, { mood: "worried" });
  blob.react("shake", "worried");
}

/** Every descendant of `id` (children, grandchildren…). */
export function descendantsOf(pages: PageMeta[], id: string): string[] {
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const p of pages) {
      if (p.parent_id === parent) {
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

  const setProfile = useCallback(
    async (patch: Partial<Profile>) => {
      setProfileState((p) => ({ ...p, ...patch }));
      const { error } = await createClient().from("profiles").update(patch).eq("id", userId);
      if (error) oops();
      return !error;
    },
    [userId],
  );

  const createPage = useCallback(
    async (input: NewPage = {}) => {
      const kind = input.kind ?? "note";
      const siblings = pages.filter((p) => p.parent_id === (input.parent_id ?? null));
      const position = siblings.reduce((max, p) => Math.max(max, p.position), 0) + 1;
      const { data, error } = await createClient()
        .from("pages")
        .insert({
          kind,
          title: input.title ?? "",
          icon: input.icon ?? null,
          subject_id: input.subject_id ?? null,
          parent_id: input.parent_id ?? null,
          position,
          content: kind === "deck" ? newDeckContent(input.title) : {},
        })
        .select(PAGE_META_COLUMNS)
        .single();
      if (error || !data) {
        oops("I couldn't create that page. Try again?");
        return null;
      }
      setPages((ps) => [...ps, data as PageMeta]);
      return data as PageMeta;
    },
    [pages],
  );

  const updatePage = useCallback(async (id: string, patch: Partial<PageMeta>, opts?: { local?: boolean }) => {
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)));
    if (opts?.local) return true;
    const { error } = await createClient().from("pages").update(patch).eq("id", id);
    if (error) oops();
    return !error;
  }, []);

  const trashPage = useCallback(
    async (id: string) => {
      const ids = [id, ...descendantsOf(pages, id)];
      const trashed_at = new Date().toISOString();
      setPages((ps) => ps.filter((p) => !ids.includes(p.id)));
      const { error } = await createClient().from("pages").update({ trashed_at }).in("id", ids);
      if (error) {
        oops();
        return false;
      }
      blob.say("Moved to trash. You can restore it anytime.", { mood: "idle" });
      return true;
    },
    [pages],
  );

  const createSubject = useCallback(
    async (input: { name: string; color?: SubjectColor; emoji?: string | null }) => {
      const position = subjects.reduce((max, s) => Math.max(max, s.position), 0) + 1;
      const { data, error } = await createClient()
        .from("subjects")
        .insert({ name: input.name.trim().slice(0, 60), color: input.color ?? "ink", emoji: input.emoji ?? null, position })
        .select()
        .single();
      if (error || !data) {
        oops("I couldn't add that subject.");
        return null;
      }
      setSubjects((s) => [...s, data as Subject]);
      blob.say(`${input.name} added!`, { mood: "happy" });
      return data as Subject;
    },
    [subjects],
  );

  const updateSubject = useCallback(async (id: string, patch: Partial<Subject>) => {
    setSubjects((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await createClient().from("subjects").update(patch).eq("id", id);
    if (error) oops();
    return !error;
  }, []);

  const deleteSubject = useCallback(async (id: string) => {
    setSubjects((ss) => ss.filter((s) => s.id !== id));
    setPages((ps) => ps.map((p) => (p.subject_id === id ? { ...p, subject_id: null } : p)));
    const { error } = await createClient().from("subjects").delete().eq("id", id);
    if (error) oops();
    return !error;
  }, []);

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
    }),
    [userId, email, profile, subjects, pages, setProfile, createPage, updatePage, trashPage, createSubject, updateSubject, deleteSubject, upsertPages, removePages],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

