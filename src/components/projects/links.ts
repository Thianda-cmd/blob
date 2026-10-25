import { createClient } from "@/lib/supabase/client";
import type { Attachment, Member, PageMeta, Project, ProjectColumn } from "@/lib/types";
import { uid } from "@/lib/utils";
import { positionBetween } from "./model";

// Notes and projects, from both sides: the project cards a page is attached to, adding a page to a
// project as a new card (and sharing it with the people in the project), and a shared note for a
// project. Browser only; RLS decides which projects and cards you see.

/** A project card a page is attached to. `done`: the card is done (or sits in a "done" column). */
export type PageCard = {
  id: string;
  title: string;
  done: boolean;
  project: Pick<Project, "id" | "title" | "icon" | "color" | "archived_at">;
};

/** The cards (in projects you can see) that have this page attached, newest first. */
export async function loadPageCards(pageId: string): Promise<PageCard[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, done, project_id, column_id")
    .not("project_id", "is", null)
    // As JSON text: postgrest-js would write an array as a Postgres array literal, which jsonb can't compare.
    .contains("attachments", JSON.stringify([{ type: "page", page_id: pageId }]))
    .order("updated_at", { ascending: false })
    .limit(30);
  const cards = (data ?? []) as { id: string; title: string; done: boolean; project_id: string; column_id: string | null }[];
  if (!cards.length) return [];
  const ids = [...new Set(cards.map((c) => c.project_id))];
  const [projects, columns] = await Promise.all([
    supabase.from("projects").select("id, title, icon, color, archived_at").in("id", ids),
    supabase.from("project_columns").select("id, done").in("project_id", ids),
  ]);
  const byId = new Map(((projects.data ?? []) as PageCard["project"][]).map((p) => [p.id, p]));
  const doneColumns = new Set(((columns.data ?? []) as Pick<ProjectColumn, "id" | "done">[]).filter((c) => c.done).map((c) => c.id));
  return cards.flatMap((c) => {
    const project = byId.get(c.project_id);
    return project ? [{ id: c.id, title: c.title, done: c.done || (!!c.column_id && doneColumns.has(c.column_id)), project }] : [];
  });
}

/**
 * Shares a page with the people in a project (viewers of the project can view it, everyone else can
 * edit). Returns how many were added; people already on the page count too.
 */
export async function sharePageWith(pageId: string, members: Member[], me: string) {
  const supabase = createClient();
  const results = await Promise.all(
    members
      .filter((m) => m.user_id !== me)
      .map((m) => supabase.rpc("add_member", { p_type: "page", p_target: pageId, p_user: m.user_id, p_role: m.role === "viewer" ? "viewer" : "editor" })),
  );
  return results.filter((r) => r.data === true).length;
}

/**
 * Adds a page to a project: a new card at the end of the first column that isn't "done", with the
 * page attached, titled `title`. `share`: the people in the project get the page too. Returns the
 * card's id, or null when it couldn't be added.
 */
export async function addPageToProject(
  page: Pick<PageMeta, "id" | "title" | "kind">,
  project: { id: string; members: Member[] },
  opts: { title: string; share: boolean; me: string },
) {
  const supabase = createClient();
  const { data: cols } = await supabase.from("project_columns").select("id, done, position").eq("project_id", project.id).order("position");
  const columns = (cols ?? []) as Pick<ProjectColumn, "id" | "done" | "position">[];
  const column = columns.find((c) => !c.done) ?? columns[0];
  if (!column) return null;
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("project_id", project.id)
    .eq("column_id", column.id)
    .order("position", { ascending: false })
    .limit(1);
  const id = uid();
  const attachment: Attachment = { id: uid(), type: "page", page_id: page.id, title: page.title, kind: page.kind };
  const { error } = await supabase.from("tasks").insert({
    id,
    title: opts.title.trim().slice(0, 200) || "…",
    kind: "project",
    project_id: project.id,
    column_id: column.id,
    position: positionBetween((last?.[0] as { position: number } | undefined)?.position ?? null, null),
    done: column.done,
    attachments: [attachment],
  });
  if (error) return null;
  if (opts.share) await sharePageWith(page.id, project.members, opts.me);
  return id;
}
