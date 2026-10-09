"use client";

import { removeUnusedFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";

// Whole-project actions shared by the /projects list and the board. The database decides who may:
// only the owner archives or deletes, anyone can leave.

/** Delete a project with its cards, and the files attached to them. */
export async function deleteProject(projectId: string) {
  const supabase = createClient();
  // Only the owner may delete it: nobody else should get as far as removing its files.
  const { data: role } = await supabase.rpc("project_role", { p_project: projectId });
  if (role !== "owner") return false;
  // The files go first: once the project is gone, storage lets nobody remove them. A file a note
  // still refers to stays; anything left behind goes in the nightly clean-up (api/cron/files).
  await removeUnusedFiles("project", projectId, { minAge: "0 seconds", whole: true });
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  return !error;
}

export async function setArchived(projectId: string, archived: boolean) {
  const archived_at = archived ? new Date().toISOString() : null;
  const { error } = await createClient().from("projects").update({ archived_at }).eq("id", projectId);
  return error ? null : { archived_at };
}

export async function leaveProject(projectId: string, userId: string) {
  const { error } = await createClient().from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  return !error;
}
