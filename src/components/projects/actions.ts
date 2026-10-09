"use client";

import { removeFile } from "@/lib/files";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/types";

// Whole-project actions shared by the /projects list and the board. The database decides who may:
// only the owner archives or deletes, anyone can leave.

/** Delete a project with its cards, and the files attached to them. */
export async function deleteProject(projectId: string) {
  const supabase = createClient();
  const { data } = await supabase.from("tasks").select("attachments").eq("project_id", projectId);
  const files = ((data ?? []) as { attachments: Attachment[] }[]).flatMap((r) => r.attachments).filter((a) => a.type === "file");
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return false;
  await Promise.all(files.map((f) => (f.type === "file" ? removeFile(f.path) : null)));
  return true;
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
