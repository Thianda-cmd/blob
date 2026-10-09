"use client";

import { deleteProjectForever } from "@/components/files/deleteForever";
import { createClient } from "@/lib/supabase/client";

// Whole-project actions shared by the /projects list and the board. The database decides who may:
// only the owner archives or deletes, anyone can leave.

/**
 * Delete a project with its cards, and the files attached to them. On the server: the project goes
 * first and its files once it is really gone, so a failed delete never leaves it without its files.
 * A file a note still refers to stays.
 */
export async function deleteProject(projectId: string) {
  return deleteProjectForever(projectId).catch(() => false);
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
