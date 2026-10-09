import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessRole, Member, Project, ProjectColumn, Task } from "@/lib/types";
import { projectProgress } from "./model";

// Loading projects (works with the server or the browser Supabase client; RLS decides what you see).

/** A project as the /projects list and Home show it: progress, people, what is yours to do. */
export type ProjectSummary = Project & {
  role: AccessRole;
  members: Member[];
  done: number;
  total: number;
  /** Open cards assigned to you. */
  mine: number;
  /** When anything on the board last changed. */
  active_at: string;
};

const rank = { owner: 0, editor: 1, viewer: 2 } as const;
const sortMembers = (list: Member[]) => [...list].sort((a, b) => rank[a.role] - rank[b.role] || a.full_name.localeCompare(b.full_name));

/** Your projects and the ones you are in, most recently active first. `archived`: only those (or only active ones). */
export async function loadProjectSummaries(
  supabase: SupabaseClient,
  userId: string,
  opts: { archived?: boolean; limit?: number } = {},
): Promise<ProjectSummary[]> {
  let query = supabase.from("projects").select("*");
  if (opts.archived === true) query = query.not("archived_at", "is", null);
  if (opts.archived === false) query = query.is("archived_at", null);
  const { data } = await query.order("updated_at", { ascending: false }).limit(200);
  const projects = (data ?? []) as Project[];
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const [cols, cards, ...people] = await Promise.all([
    supabase.from("project_columns").select("id, project_id, done").in("project_id", ids),
    supabase.from("tasks").select("id, project_id, column_id, done, assignees, updated_at").in("project_id", ids),
    ...ids.map((id) => supabase.rpc("member_profiles", { p_type: "project", p_target: id })),
  ]);
  const columns = (cols.data ?? []) as Pick<ProjectColumn, "id" | "project_id" | "done">[];
  const list = (cards.data ?? []) as Pick<Task, "id" | "project_id" | "column_id" | "done" | "assignees" | "updated_at">[];
  const out = projects.map((p, i): ProjectSummary => {
    const own = list.filter((c) => c.project_id === p.id);
    const ownCols = columns.filter((c) => c.project_id === p.id);
    const doneCols = new Set(ownCols.filter((c) => c.done).map((c) => c.id));
    const members = sortMembers((people[i]?.data ?? []) as Member[]);
    const { done, total } = projectProgress(ownCols, own);
    const active = own.reduce((max, c) => (c.updated_at > max ? c.updated_at : max), p.updated_at);
    return {
      ...p,
      role: p.user_id === userId ? "owner" : (members.find((m) => m.user_id === userId)?.role ?? "viewer"),
      members,
      done,
      total,
      mine: own.filter((c) => c.assignees.includes(userId) && !c.done && !(c.column_id && doneCols.has(c.column_id))).length,
      active_at: active,
    };
  });
  out.sort((a, b) => b.active_at.localeCompare(a.active_at));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export type BoardLoad = { project: Project; columns: ProjectColumn[]; cards: Task[]; members: Member[]; role: AccessRole };

/** Everything a board needs, or null when the project doesn't exist or isn't yours to see. */
export async function loadBoard(supabase: SupabaseClient, id: string): Promise<BoardLoad | null> {
  const [project, columns, cards, members, role] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("project_columns").select("*").eq("project_id", id).order("position"),
    supabase.from("tasks").select("*").eq("project_id", id).order("position").limit(2000),
    supabase.rpc("member_profiles", { p_type: "project", p_target: id }),
    supabase.rpc("project_role", { p_project: id }),
  ]);
  if (!project.data || !role.data) return null;
  return {
    project: project.data as Project,
    columns: (columns.data ?? []) as ProjectColumn[],
    cards: (cards.data ?? []) as Task[],
    members: sortMembers((members.data ?? []) as Member[]),
    role: role.data as AccessRole,
  };
}
